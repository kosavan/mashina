import { tr } from "./i18n";
import type { TireSet } from "./types";
import { tireCondition } from "./tires";
import { dateLabel, number } from "./utils";

export function TireHealth({ tire }: { tire: TireSet }) {
  const health = tireCondition(tire);
  return (
    <section className="tire-health" aria-label={tr("Возраст и измерения шин")}>
      {tire.pending && (
        <p className="field-help">
          {tr("Черновик на устройстве · ожидает проверки сервером")}
        </p>
      )}
      <div className="tire-health-metrics">
        <div>
          <span>{tr("Возраст по DOT")}</span>
          <strong>
            {health.age === null
              ? tr("Не указан")
              : tr("≈ {0} лет", [health.age])}
          </strong>
          <small>
            {health.year
              ? tr("Неделя {0}, {1}", [
                  tire.manufacture_code?.slice(0, 2),
                  health.year,
                ])
              : tr("Укажите маркировку самой старой шины")}
          </small>
        </div>
        <div>
          <span>{tr("Протектор · минимум")}</span>
          <strong>
            {health.latest
              ? tr("{0} мм", [number(health.latest.depth_tenths / 10, 1)])
              : tr("Не измерен")}
          </strong>
          <small>
            {health.latest
              ? tr("Минимум за {0}", [dateLabel(health.latest.measured_at)])
              : tr("Пробег не заменяет измерение")}
          </small>
        </div>
      </div>
      {health.atThreshold && (
        <p className="warning-text">
          {tr("Достигнут ваш порог")}{" "}
          {number((tire.tread_threshold_tenths || 0) / 10, 1)}{" "}
          {tr(" мм. Запланируйте осмотр и замену.")}
        </p>
      )}
      {health.tenYears && (
        <p className="warning-text">
          {tr(
            "С изготовления прошло более 10 лет. Michelin рекомендует профилактическую замену даже при сохранившемся протекторе.",
          )}
        </p>
      )}
      {health.approachingTen && (
        <p className="warning-text">
          {tr(
            "В этом году шинам исполняется 10 лет. Уточните неделю DOT и запланируйте профилактическую замену по рекомендации производителя.",
          )}
        </p>
      )}
      <details>
        <summary>{tr("Уход и рекомендации")}</summary>
        <p>
          {tr(
            "После 5 лет эксплуатации Michelin рекомендует ежегодный профессиональный осмотр; через 10 лет от изготовления — профилактическую замену. DOT не показывает дату начала эксплуатации.",
          )}
        </p>
        <p>
          {tr(
            "Проверяйте давление по табличке автомобиля, повреждения боковин и равномерность износа. Сезон выбирайте по местным условиям и руководству автомобиля; календарный месяц сам по себе не определяет необходимость смены.",
          )}
        </p>
        <p>
          {tr(
            "Измерение и возраст не подтверждают исправность. Размер, индексы нагрузки и скорости сверяйте с руководством автомобиля. Ваш порог — личная настройка, не юридический минимум.",
          )}
        </p>
        <a
          href="https://www.michelinman.com/auto/auto-tips-and-advice/tire-buying-guide/when-do-i-need-new-tires"
          target="_blank"
          rel="noopener noreferrer"
        >
          {tr("Рекомендации Michelin ↗")}
        </a>
      </details>
    </section>
  );
}
