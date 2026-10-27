# MASHINA 1.9.0 (prepared; publication gated by exact-source CI)

Local OCR first reads native PDF text and uses complementary image-recognition passes for scans/photos. Review conflicting candidates and reconciled service lines with tax/discounts; the experimental seven-segment reader only suggests values for cropped panels. Nothing creates financial or odometer records without review and save.

Sale PDFs, readable CSV and generic notifications support RU/EN/DE while preserving user text. Other output languages fall back to English. Machine JSON and legacy CSV retain their existing formats.

ZIP64 backup, recovery snapshots and restore stream through disk with a 20 GiB compressed/expanded bound. Browser restore uploads directly to the data volume rather than the small temporary tmpfs. Old format-1 backups remain supported. Local searchable make/model/engine suggestions work offline, include saved custom values and always allow manual entry. The starter catalogue is not a fitment database.

Schema remains 007; released migrations, stable IDs, authorization, exact sums and offline queues remain compatible. Keep the verified pre-update data backup and previous image for rollback; an older image cannot restore a new archive above its old 200 MiB bound.

[Feature scope and limits](docs/ocr-results-archives.md) · [Russian guide](docs/ocr-results-archives.ru.md) · [Update and rollback](docs/updating.md)

---

# MASHINA 1.8.1

Vehicle profiles now display the same compact, authorized WebP preview as garage
cards, avoiding another full-size download when opening a car. Existing photos work
without uploading them again. Original attachment bytes, downloads and report photos
are unchanged. Images decode asynchronously.

A browser regression uploads a large synthetic photo, opens the mobile profile,
verifies that the image renders through the preview endpoint and confirms that the
download still returns the original. No schema, API, dependency or configuration
change; preserve browser storage and offline queues when updating.

[Update and rollback](docs/updating.md) · [Russian update guide](docs/updating.ru.md)

---

# MASHINA 1.8.0

A clearer installed PWA, lighter garage photos, eight languages and more capable local OCR.

- Safe-area-aware header/menu/title in portrait and landscape, with Chromium and WebKit regression coverage.
- Compact authorized WebP card previews for existing and new photos. Original files, hashes, IDs, downloads and report images stay intact.
- Simplified Chinese, Hindi, Spanish, Arabic (RTL) and French join Russian, English and German. New catalogs load on demand; offline switching remains available.
- Clockwise rotation, crop preview, up to three selected PDF pages and editable, opt-in line items from simple labelled service tables. Normal Save remains the only financial write.
- Preserve supported old payloads, schemas 001-007, settings, attachment references, exact amounts and offline operation IDs. No schema/configuration/dependency change from 1.7.

[Update and rollback](docs/updating.md) · [Russian update guide](docs/updating.ru.md) · [Languages](docs/languages.md) · [Local OCR](docs/local-ocr.md) · [Validation](docs/release-validation-1.8.md)

Back up the complete garage and retain the old image before updating. Old servers do not accept the new language/OCR options: update backend and frontend together. Preview caches are rebuildable and not operational backups. OCR uses local rus/eng data; complex tables and difficult instrument displays still need review. Physical iPhone validation remains separate from automated WebKit coverage.

---

# MASHINA 1.7.0

German joins your garage, following [community request #20](https://github.com/kosavan/mashina/issues/20).

- Choose **Deutsch** before setup/sign-in/demo or in Settings.
- Complete German interface and isolated demo, including forms, validation, body damage, sharing and import; German date/number formatting.
- Save account language through the durable offline queue without changing personal records, exact money, currency or units.
- German README and update/rollback walkthrough; updated English/Russian guides, roadmap and product-page language metadata.
- Bundled translation catalogs are cached with the app shell for offline switching. No external translation service.
- Scroll the sidebar on shorter screens so longer German labels keep the theme and account controls reachable.

[German introduction](README.de.md) · [German update instructions](docs/updating.de.md) · [English update guide](docs/updating.md) · [Russian update guide](docs/updating.ru.md) · [Validation](docs/release-validation-1.7.md)

No schema change from 1.6.0 (007), new dependency or configuration. Update backend and frontend together; old servers reject German settings. Older installations still apply the intervening migrations. Keep a full backup and the previous image. PDF/CSV output labels, external notification payloads and OCR recognition languages retain their existing scope; German OCR is not added. User-entered content is never translated.

---

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
