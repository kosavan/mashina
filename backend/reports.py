"""Private allowlisted sale snapshots and bounded local PDF generation."""

from dataclasses import dataclass
from functools import partial
from datetime import date
from decimal import Decimal
import io
import json
from pathlib import Path
from threading import Lock
from xml.sax.saxutils import escape

from PIL import Image as PILImage, ImageOps
from pydantic import BaseModel, ConfigDict, model_validator
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image,
    Table,
    TableStyle,
    PageBreak,
    CondPageBreak,
)

from backend.access import vehicle_access
from backend.domain import analytics
from backend.storage import row_data
from backend.output_locale import translate, user_locale, number

MAX_WORKS = 500
MAX_EVENTS = 5000
MAX_PDF = 5 * 1024 * 1024
FONT_LOCK = Lock()
RENDER_LOCK = Lock()
FONTS = Path(__file__).parent / "assets" / "fonts"
INK = colors.HexColor("#19221b")
MUTED = colors.HexColor("#697566")
LIME = colors.HexColor("#c8ec8b")
LINE = colors.HexColor("#e2e7dd")


class ReportOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start: str = ""
    end: str = ""
    include_cover: bool = False
    include_costs: bool = False
    include_identifiers: bool = False
    include_descriptions: bool = False

    @model_validator(mode="after")
    def valid_period(self):
        for value in (self.start, self.end):
            if value:
                try:
                    if date.fromisoformat(value).isoformat() != value:
                        raise ValueError()
                except ValueError:
                    raise ValueError("Нужна дата в формате ГГГГ-ММ-ДД") from None
        if self.start and self.end and self.start > self.end:
            raise ValueError("Начало периода позже конца")
        return self


@dataclass
class ReportSnapshot:
    vehicle: dict
    works: list[dict]
    options: ReportOptions
    finance: list[dict]
    mileage: int | None
    cover: bytes | None
    demo: bool
    generated: str
    locale: str = "ru"


def report_snapshot(store, actor: str, vehicle_id: str, options: ReportOptions, demo=False):
    """Only one vehicle; raw private JSON never reaches the renderer."""
    with store.transaction() as c:
        raw, _ = vehicle_access(c, vehicle_id, actor, write=True)
        car = row_data(raw)
        rows = c.exec_driver_sql(
            "SELECT * FROM events WHERE vehicle_id=? AND deleted=0 AND (?='' OR substr(json_extract(data,'$.occurred_at'),1,10)>=?) AND (?='' OR substr(json_extract(data,'$.occurred_at'),1,10)<=?) ORDER BY json_extract(data,'$.occurred_at'),id LIMIT ?",
            (vehicle_id, options.start, options.start, options.end, options.end, MAX_EVENTS + 1),
        ).mappings()
        selected = [row_data(r) for r in rows]
        if len(selected) > MAX_EVENTS:
            raise ValueError("Больше 5 000 событий за период. Сузьте период отчёта.")
        events = list(selected)
        if options.start:
            # Shared analytics needs the latest baseline and prior maximum. Keep only
            # those readings, not every historical expense outside the selected period.
            for ordering in (
                "substr(json_extract(data,'$.occurred_at'),1,10) DESC,json_extract(data,'$.odometer') DESC",
                "json_extract(data,'$.odometer') DESC",
            ):
                past = (
                    c.exec_driver_sql(
                        f"SELECT * FROM events WHERE vehicle_id=? AND deleted=0 AND json_extract(data,'$.odometer') IS NOT NULL AND substr(json_extract(data,'$.occurred_at'),1,10)<? AND (?='' OR substr(json_extract(data,'$.occurred_at'),1,10)>=?) ORDER BY {ordering} LIMIT 1",
                        (
                            vehicle_id,
                            options.start,
                            car.get("purchase_date", ""),
                            car.get("purchase_date", ""),
                        ),
                    )
                    .mappings()
                    .first()
                )
                if past:
                    reading = row_data(past)
                    # Synthetic read-only input carries no money into aggregation.
                    events.append(
                        {
                            "id": reading["id"],
                            "vehicle_id": vehicle_id,
                            "kind": "odometer",
                            "currency": car.get("currency", "RUB"),
                            "occurred_at": reading["occurred_at"],
                            "odometer": reading["odometer"],
                            "amount_minor": 0,
                        }
                    )
        maximum = c.exec_driver_sql(
            "SELECT MAX(json_extract(data,'$.odometer')) FROM events WHERE vehicle_id=? AND deleted=0",
            (vehicle_id,),
        ).scalar()
        works = [e for e in selected if e["kind"] == "maintenance"]
        if len(works) > MAX_WORKS:
            raise ValueError("Больше 500 работ. Сузьте период отчёта.")
        currencies = sorted(
            {e["currency"] for e in selected if e.get("amount_minor")}
            | {car.get("currency", "RUB")}
        )
        if len(currencies) > 10:
            raise ValueError("Слишком много валют. Сузьте период отчёта.")
        summary = analytics([car], events, options.start, options.end)
        finance = []
        if options.include_costs:
            for code in currencies:
                totals = analytics([car], events, options.start, options.end, currency_code=code)
                finance.append(
                    {
                        key: totals[key]
                        for key in (
                            "currency",
                            "total_minor",
                            "fuel_minor",
                            "maintenance_minor",
                            "purchase_minor",
                            "sale_minor",
                            "cost_per_km",
                        )
                    }
                )
        public = {
            key: car.get(key)
            for key in (
                "name",
                "brand",
                "model",
                "year",
                "generation",
                "trim",
                "engine",
                "transmission",
                "drive",
                "fuel",
                "purchase_date",
                "purchase_odometer",
            )
        }
        public["current_odometer"] = max(car.get("purchase_odometer", 0), maximum or 0)
        if options.include_identifiers:
            public.update({key: car.get(key) for key in ("vin", "plate")})
        safe_works = []
        for work in works:
            entry = {key: work.get(key) for key in ("occurred_at", "odometer")}
            entry["items"] = [
                {
                    key: item.get(key)
                    for key in (
                        "name",
                        "part_number",
                        "quantity",
                        *(("amount_minor",) if options.include_costs else ()),
                    )
                }
                for item in work.get("items", [])
            ]
            if options.include_descriptions:
                entry["description"] = work.get("description")
            if options.include_costs:
                entry.update(amount_minor=work["amount_minor"], currency=work["currency"])
            safe_works.append(entry)
        cover = None
        if options.include_cover:
            if car.get("photo_id"):
                image = (
                    c.exec_driver_sql(
                        "SELECT filename,data FROM attachments WHERE id=? AND vehicle_id=?",
                        (car["photo_id"], vehicle_id),
                    )
                    .mappings()
                    .first()
                )
                if image and json.loads(image["data"]).get("media_type") == "image/jpeg":
                    filename = image["filename"]
                    if Path(filename).name != filename or ":" in filename or "\\" in filename:
                        raise ValueError("Недопустимый путь обложки")
                    target = store.uploads / filename
                    if not target.is_file():
                        raise ValueError("Файл обложки отсутствует. Проверьте резервную копию.")
                    cover = target.read_bytes()
            elif demo and car.get("demo_image") in {"volvo-demo.webp", "porsche-demo.webp"}:
                target = Path(__file__).parents[1] / "frontend" / "dist" / car["demo_image"]
                if target.is_file():
                    cover = target.read_bytes()
        return ReportSnapshot(
            public,
            safe_works,
            options,
            finance,
            summary["mileage"],
            cover,
            demo,
            date.today().isoformat(),
            user_locale(store, actor),
        )


def money(value: int, code="RUB", locale="ru"):
    return number(Decimal(value) / 100, locale, 2) + " " + ("₽" if code == "RUB" else code)


def date_label(value, locale="ru"):
    return (date.fromisoformat(value[:10]).strftime("%d/%m/%Y" if locale == "en" else "%d.%m.%Y")
            if value else translate("Не указана", locale))


class LimitedCanvas(Canvas):
    def showPage(self):
        if self.getPageNumber() > 100:
            raise ValueError("Отчёт превышает 100 страниц. Сузьте период.")
        super().showPage()


def render_report(snapshot: ReportSnapshot):
    def t(label):
        return translate(label, snapshot.locale)

    money_label = partial(money, locale=snapshot.locale)
    date_value = partial(date_label, locale=snapshot.locale)

    if len(snapshot.works) > MAX_WORKS:
        raise ValueError("Больше 500 работ. Сузьте период отчёта.")
    if len(json.dumps(snapshot.works, ensure_ascii=False)) > 400000:
        raise ValueError("Слишком много текста и позиций. Сузьте период отчёта.")
    with FONT_LOCK:
        if "Manrope" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("Manrope", str(FONTS / "Manrope-Regular.ttf")))
            pdfmetrics.registerFont(TTFont("Manrope-Bold", str(FONTS / "Manrope-Bold.ttf")))
            pdfmetrics.registerFontFamily(
                "Manrope",
                normal="Manrope",
                bold="Manrope-Bold",
                italic="Manrope",
                boldItalic="Manrope-Bold",
            )
    styles = {
        "body": ParagraphStyle(
            "body",
            fontName="Manrope",
            fontSize=10,
            leading=16,
            textColor=INK,
            splitLongWords=True,
            spaceAfter=8,
        ),
        "small": ParagraphStyle(
            "small",
            fontName="Manrope",
            fontSize=8,
            leading=12,
            textColor=MUTED,
            splitLongWords=True,
        ),
        "title": ParagraphStyle(
            "title",
            fontName="Manrope-Bold",
            fontSize=32,
            leading=38,
            textColor=INK,
            spaceAfter=14,
            splitLongWords=True,
        ),
        "heading": ParagraphStyle(
            "heading",
            fontName="Manrope-Bold",
            fontSize=19,
            leading=25,
            textColor=INK,
            spaceBefore=14,
            spaceAfter=14,
        ),
        "number": ParagraphStyle(
            "number", fontName="Manrope-Bold", fontSize=24, leading=30, textColor=INK
        ),
        "right": ParagraphStyle(
            "right", fontName="Manrope", fontSize=9, leading=14, textColor=INK, alignment=TA_RIGHT
        ),
    }

    def p(value, style="body"):
        return Paragraph(escape(str(value or "")).replace("\n", "<br/>"), styles[style])

    def table(rows, widths, header=False, split_rows=False, compact=False):
        item = Table(
            rows,
            colWidths=widths,
            repeatRows=1 if header else 0,
            hAlign="LEFT",
            splitInRow=int(split_rows),
        )
        item.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                    ("TOPPADDING", (0, 0), (-1, -1), 5 if compact else 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5 if compact else 10),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
                ]
            )
        )
        return item

    out = io.BytesIO()
    doc = SimpleDocTemplate(
        out,
        pagesize=A4,
        rightMargin=42,
        leftMargin=42,
        topMargin=82,
        bottomMargin=52,
        title=t("История автомобиля | MASHINA"),
        author="MASHINA",
        pageCompression=1,
    )
    width = A4[0] - 84
    story = [
        p(t("ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ") if snapshot.demo else t("ИСТОРИЯ АВТОМОБИЛЯ"), "small"),
        Spacer(1, 12),
        p(snapshot.vehicle["name"], "title"),
    ]
    subtitle = " · ".join(
        str(snapshot.vehicle[k]) for k in ("year", "generation", "trim") if snapshot.vehicle.get(k)
    )
    if subtitle:
        story.append(p(subtitle))
    if snapshot.cover:
        try:
            with PILImage.open(io.BytesIO(snapshot.cover)) as original:
                if original.width * original.height > 25_000_000:
                    raise ValueError("Слишком большая обложка")
                original.load()
                canvas = PILImage.new("RGB", (1200, 510), "#171c18")
                image = ImageOps.contain(original.convert("RGB"), (1200, 510))
                canvas.paste(image, ((1200 - image.width) // 2, (510 - image.height) // 2))
                photo = io.BytesIO()
                canvas.save(photo, format="JPEG", quality=85)
                story.extend(
                    [
                        Spacer(1, 12),
                        Image(io.BytesIO(photo.getvalue()), width=width, height=width * 510 / 1200),
                        Spacer(1, 12),
                    ]
                )
        except (OSError, ValueError, PILImage.DecompressionBombError):
            raise ValueError(
                "Обложка повреждена. Отключите фото или загрузите его заново."
            ) from None
    current = number(snapshot.vehicle["current_odometer"], snapshot.locale)
    distance = (
        number(snapshot.mileage, snapshot.locale) if snapshot.mileage is not None else t("Нет данных")
    )
    story.append(
        table(
            [
                [p(t("ПОСЛЕДНИЙ ИЗВЕСТНЫЙ ПРОБЕГ"), "small"), p(t("ПРОБЕГ ЗА ПЕРИОД ВЛАДЕНИЯ"), "small")],
                [
                    p(current + t(" км"), "number"),
                    p(distance + (t(" км") if snapshot.mileage is not None else ""), "number"),
                ],
            ],
            [width / 2, width / 2],
        )
    )
    story.append(
        p(
            t("Показания внесены пользователем. Расстояние считается от подтверждённой исходной точки, а не от нулевого одометра."),
            "small",
        )
    )
    story.append(p(t("Автомобиль в деталях"), "heading"))
    fields = [
        (
            t("Марка / модель"),
            " ".join(filter(None, [snapshot.vehicle.get("brand"), snapshot.vehicle.get("model")])),
        ),
        (t("Двигатель"), snapshot.vehicle.get("engine")),
        (t("Коробка передач"), snapshot.vehicle.get("transmission")),
        (t("Привод"), snapshot.vehicle.get("drive")),
        (
            t("Топливо"),
            {
                "petrol": t("Бензин"),
                "diesel": t("Дизель"),
                "electric": t("Электричество"),
                "hybrid": t("Гибрид"),
            }.get(snapshot.vehicle.get("fuel"), snapshot.vehicle.get("fuel")),
        ),
        (
            t("Начало владения"),
            date_value(snapshot.vehicle.get("purchase_date"))
            if snapshot.vehicle.get("purchase_date")
            else None,
        ),
    ]
    if snapshot.options.include_identifiers:
        fields += [
            ("VIN", snapshot.vehicle.get("vin")),
            (t("Государственный номер"), snapshot.vehicle.get("plate")),
        ]
    details = [[p(label, "small"), p(value)] for label, value in fields if value]
    if details:
        story.append(table(details, [width * 0.38, width * 0.62], compact=True))
    else:
        story.append(p(t("Характеристики пока не заполнены."), "small"))
    story.append(PageBreak())
    period = (
        (date_value(snapshot.options.start) if snapshot.options.start else t("Начало истории"))
        + " - "
        + (
            date_value(snapshot.options.end)
            if snapshot.options.end
            else date_value(snapshot.generated)
        )
    )
    story.append(p(t("Период отчёта: ") + period, "small"))
    story.append(
        p(
            t("Данные отражают записи владельцев и водителей и не заменяют независимую диагностику или проверку документов. Личные документы, заметки и сведения об аккаунтах в этот отчёт не включены."),
            "small",
        )
    )
    story.append(Spacer(1, 12))
    if snapshot.options.include_costs:
        story.append(p(t("Финансовая история"), "heading"))
        for totals in snapshot.finance:
            code = totals["currency"]
            story.extend(
                [
                    p(t("Эксплуатационные расходы · ") + code, "small"),
                    p(money_label(totals["total_minor"], code), "number"),
                ]
            )
            rows = [
                [p(t("Топливо"), "small"), p(money_label(totals["fuel_minor"], code), "right")],
                [
                    p(t("Обслуживание и ремонт"), "small"),
                    p(money_label(totals["maintenance_minor"], code), "right"),
                ],
            ]
            if totals["cost_per_km"] is not None:
                value = number(Decimal(str(totals["cost_per_km"])), snapshot.locale, 2)
                rows.append(
                    [
                        p(t("Эксплуатация на километр"), "small"),
                        p(value + " " + ("₽" if code == "RUB" else code), "right"),
                    ]
                )
            else:
                rows.append(
                    [
                        p(t("Эксплуатация на километр"), "small"),
                        p(t("Недостаточно подтверждённых показаний"), "small"),
                    ]
                )
            for key, label in (
                ("purchase_minor", t("Цена покупки (отдельно)")),
                ("sale_minor", t("Цена продажи (отдельно)")),
            ):
                if totals[key]:
                    rows.append([p(label, "small"), p(money_label(totals[key], code), "right")])
            story.extend([table(rows, [width * 0.60, width * 0.40]), Spacer(1, 14)])
        story.append(
            p(
                t("Цена покупки и продажи не включена в эксплуатационные расходы. Изменение рыночной стоимости не оценивалось. Валюты не конвертируются и не суммируются."),
                "small",
            )
        )
        story.append(Spacer(1, 20))
    story.append(p(t("История обслуживания"), "heading"))
    if not snapshot.works:
        story.append(p(t("Работы за этот период не записаны.")))
    for work in snapshot.works:
        story.append(CondPageBreak(85))
        stamp = date_value(work["occurred_at"])
        if work.get("odometer") is not None:
            stamp += " · " + number(work["odometer"], snapshot.locale) + t(" км")
        story.extend(
            [
                Spacer(1, 14),
                p(stamp, "small"),
                p(work.get("description") or t("Обслуживание / ремонт")),
            ]
        )
        rows = []
        for item in work.get("items", []):
            label = str(item.get("name") or t("Запчасть / работа"))
            if item.get("part_number"):
                label += t("\nАртикул: ") + str(item["part_number"])
            row = [p(label, "small"), p(str(item.get("quantity") or "1") + t(" шт."), "right")]
            if snapshot.options.include_costs:
                row.append(p(money_label(item.get("amount_minor") or 0, work["currency"]), "right"))
            rows.append(row)
        if rows:
            story.append(
                table(
                    rows,
                    [width * 0.60, width * 0.15, width * 0.25]
                    if snapshot.options.include_costs
                    else [width * 0.80, width * 0.20],
                    split_rows=True,
                )
            )
        if snapshot.options.include_costs:
            story.append(
                p(t("Стоимость записи: ") + money_label(work["amount_minor"], work["currency"]), "right")
            )

    def page_chrome(c, document):
        c.saveState()
        c.setFillColor(INK)
        c.setFont("Manrope-Bold", 16)
        c.drawString(42, A4[1] - 44, "MASHINA")
        c.setFillColor(LIME)
        c.rect(42, A4[1] - 55, 42, 3, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont("Manrope", 8)
        c.drawRightString(A4[0] - 42, A4[1] - 44, t("ЦИФРОВАЯ ИСТОРИЯ АВТОМОБИЛЯ"))
        c.setStrokeColor(LINE)
        c.line(42, 39, A4[0] - 42, 39)
        c.drawString(
            42,
            25,
            t("Подготовлено ")
            + date_value(snapshot.generated)
            + (t(" · Демо") if snapshot.demo else " · MASHINA"),
        )
        c.drawRightString(A4[0] - 42, 25, str(document.page))
        c.restoreState()

    doc.build(story, onFirstPage=page_chrome, onLaterPages=page_chrome, canvasmaker=LimitedCanvas)
    result = out.getvalue()
    if len(result) > MAX_PDF:
        raise ValueError("Отчёт превышает 5 МБ. Сузьте период или отключите обложку.")
    return result
