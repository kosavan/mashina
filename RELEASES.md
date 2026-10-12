# MASHINA 1.6.0

A bodywork history for every car.

- Five interactive body views with panel/point markers and multiple issues per panel.
- Damage types, owner-assessed severity, discovery/repair dates, notes and optional contextual mileage.
- Status filters, dated repair/reopening history, soft deletion and undo.
- Local before/after photos, existing image reuse and same-car service links. Estimates remain separate from actual costs; damage never creates an expense or odometer reading.
- Mobile English/Russian dark/light UI, keyboard controls, accessible list and isolated fictional demo issues.
- Durable offline text/marker create/edit and idempotent synchronization. New photo files require an online upload and stay only in the open editor until uploaded.
- JSON/CSV and full database/file backup include damage history. Additive schema 007 preserves supported installations and snapshots older schemas before upgrade.
- Fix sequential create/photo-link saves to check authorization against the latest client state.

[Body condition guide](docs/body-damage.md) · [Russian guide](docs/body-damage.ru.md) · [Update / rollback](docs/updating.md) · [Roadmap](docs/roadmap.md)

Read the update guide first. Older images cannot open schema 007: rollback requires the matching pre-upgrade data and image. No new dependencies, external services or infrastructure changes. Generic diagrams and owner observations; physical iPhone/arm64 validation remains open.

---

# MASHINA 1.5.1

Maintenance audit, safe updates and a living bilingual roadmap.

- Fix backup restoration inside read-only non-root containers and recover from failures during every initial file swap.
- Preserve unrelated and future preferences on partial settings updates; language changes send only their own field.
- Before an installed schema upgrades, retain a private full recovery snapshot. Refuse newer/unknown/unversioned existing schemas without resetting data.
- Test actual Alembic upgrades for every supported schema 001–006 and retain immutable fingerprints of released migrations.
- Serialize overlapping offline/reconnect synchronization requests so pending records are not stranded.
- Serve bundled fonts as local files compatible with the existing self-only font policy.
- Publish shipped/planned/research roadmap, complete English user guides with separate Russian versions, and update/rollback walkthroughs for Linux, macOS and Windows.
- Extend CI with English documentation/link checks and a real production-container restore drill. Include the prior offline lazy-module caching fix.

[Roadmap](docs/roadmap.md) · [Update / rollback](docs/updating.md) · [Russian update guide](docs/updating.ru.md) · [Audit and remaining limits](docs/audit-1.5.1.md)

No schema revision, external service or infrastructure change. Preserve your existing data and environment; read the update guide before switching versions. Publication requires full Linux/native OCR/browser/container CI. Hardware-specific validation and large-archive streaming remain open.

---

# MASHINA 1.5.0

Fully local text OCR for receipts, workshop invoices/work orders, dashboard photographs and arbitrary screenshots.

- Read JPEG/PNG/WebP or a selected PDF page on the owner's server using bundled Tesseract rus+eng and Poppler. No external provider, paid API, cloud fallback or runtime model download.
- Inspect text, edit suggestions and explicitly select fields to apply to fuel, expense, maintenance or odometer drafts. All checkboxes start unchecked. Original attachment is opt-in.
- Recognition never saves a financial/mileage record. Normal Save preserves exact validation, historical mileage warnings and idempotency. Full tank, currency, trip/range/miles and ambiguous numbers are not guessed.
- Bounded on-demand processing, one job/CPU thread, private temporary files, time/resource limits, authorization and post-processing revocation checks.
- Updated roadmap includes general screenshots, workshop line-item extraction, crop/rotation and local-only future improvements.

[Local OCR guide and limits](docs/local-ocr.md) · [Roadmap](docs/roadmap.md)

First local text-recognition slice, not universal document understanding. One PDF page per request; workshop line items remain manual from extracted text. Seven-segment/unlabelled/glare-heavy dashboards may require manual input. Offline OCR needs the local server; ordinary manual offline entry continues. No schema migration or infrastructure change. Real-engine Linux CI is mandatory before publication; Windows local native OCR is not installed.

---

# MASHINA 1.4.0

English and Russian, from the first setup to daily use.

- Choose the interface language before setup/sign-in/demo and change it in Settings.
- Local UI resources cover navigation, forms, feedback, accessibility labels, date/number formatting and analytics. Account preferences synchronize safely after offline changes.
- User names, notes, documents, canonical categories, exact monetary values and units remain unchanged. The isolated demo has a separate localized presentation.
- English and Russian READMEs now have matching screenshots and Hyperframes infographics. Analytics screenshots select Volvo XC60 to avoid connecting different vehicles' fuel histories.
- Fixed administrator backup controls being hidden in Settings.
- Both README footers: Vibecoded with love ❤️

[Validation and limitations](docs/release-validation-1.4.md) · [macOS / Windows testing](docs/testing-release.md)

Russian remains the default. No schema migration, translation API or infrastructure change. Export/PDF contents and external notification payloads keep their existing language; no currency/unit conversion. Physical iPhone and separate macOS/arm64 Docker remain unverified. Existing OCR/AI and other future integrations are outside this release.

---

# MASHINA 1.3.0

A more personal garage: dedicated tire care, clearer fuel analytics and a new green Apex M identity.

- Fixed Fuel → charts to keep the selected vehicle and fuel filter, including demo and mobile.
- Reworked welcome artwork, replaced branding with the owner-approved green logo, favicon and iOS/PWA icons.
- Added dedicated Tires navigation, oldest-tire DOT, dated tread measurements and a personal replacement threshold. Unknown condition stays unknown; guidance distinguishes manufacture age from service life.
- Added private service addresses and optional coordinates. Styled OpenStreetMap view loads only after an explicit disclosed action; no automatic geocoding or GPS tracking.
- Improved per-vehicle fuel defaults and receipt/payment entry guidance. Full tank requires confirmation; no automatic screenshot recognition is claimed.
- Rebuilt the GitHub landing page in English with a Russian option, a local Hyperframes infographic and isolated demo screenshots.
- Included macOS/Windows testing, self-hosting, capture strategy and tire/location documentation.

[Installation and testing](docs/testing-release.md) · [Validation evidence and limitations](docs/release-validation-1.3.md)

Source-only release. Back up database and attachments before updating; new JSON fields are additive and no destructive migration is added. Physical iPhone, separate arm64/macOS Docker and real external notifications remain unverified. OCR and the remaining 2.0 integrations are still future work.

---

# MASHINA 1.2.0

Проверенный текущий срез персонального self-hosted гаража. Релиз фиксирует готовый
функционал по просьбе владельца; дальнейшее расширение временно остановлено.
Это не полный запланированный релиз 2.0.

## Что входит

Всё из 1.1: несколько автомобилей и их история, точные расходы/заправки/ТО,
файлы/документы, напоминания, аналитика, офлайн-очередь/PWA, изолированное демо,
шины/детали, бюджеты/план затрат, CSV, совместный доступ, локальный PDF для продажи,
опциональные Push/Telegram-напоминания, полный бэкап/восстановление/экспорт.

Дополнительно:

- Локальный банковский CSV с явным сопоставлением, проверкой совпадений и подтверждением
  связи с уже учтённой заправкой/ТО. Стабильные ID и транзакционные receipts защищают
  от повторного учёта; банковские данные приватны.
- Выключенный по умолчанию ограниченный API: ключи с выбранными автомобилями,
  сроком жизни, чтением по умолчанию и отдельным разрешением записи. Секрет показывается
  один раз. Отзыв, смена пароля, отключение аккаунта и restore аннулируют доступ.
- Необязательный read-only MCP через STDIO: машины, ограниченная история, напоминания
  и эксплуатационная аналитика. Современный 2026-07-28 и совместимый 2025-11-25 протоколы,
  проверяемый TLS, лимиты запросов/ответов и отмена. Документы/учётные записи/банковская
  сверка/бэкапы этим ключам недоступны.

## Как проверить и развернуть

[Подробная инструкция с тестовыми сценариями](docs/testing-release.md).
Исходники не содержат паролей, API-ключей, личной истории и вложений.
Перед обновлением обязательно скачайте полный бэкап на другой диск.
Миграция 006 аддитивная; восстановление проверяет архивы старых схем 001–005.
После restore внешние уведомления на паузе, machine-ключи отозваны.

## Проверки

Локально прошли 159 Pytest, 17 Vitest и все 21 headless Playwright, статические проверки
и production-сборка. Основной JS 129,1 КиБ gzip при бюджете 180 КиБ.
[Отчёт проверки](docs/release-validation-1.2.md); успешный финальный Linux Docker CI
обязателен перед публикацией тега. Ссылка на него прилагается к GitHub-релизу.
Физический iPhone, реальные внешние уведомления и отдельная arm64-машина не проверялись.

## Не включено

AI-распознавание документов с подтверждением черновика, поиск естественным языком,
Telegram-ввод расходов, OBD-II, Passkeys. Незавершённая основа распознавания сохранена
отдельно в `codex/mashina-document-review`; не подключена к стабильному UI/API.
Банковский импорт — CSV с явным сопоставлением, без прямого банковского доступа,
распознавания PDF/XLSX или автоматического принятия совпадений.

Предыдущий релиз: [MASHINA 1.1.0](https://github.com/kosavan/mashina/releases/tag/v1.1.0).
