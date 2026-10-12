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
