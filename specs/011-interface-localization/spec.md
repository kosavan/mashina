# MASHINA — English and Russian interface

Owner request: choose Russian or English during initial setup and in the app, later extend to other languages. English README shows English screens; Russian README shows Russian screens. Analytics screenshots select one vehicle so unrelated fuel histories are not connected. Both READMEs end with exactly “Vibecoded with love ❤️”.

## Acceptance
- Visible language choice before setup/login/demo; Russian remains default on an unconfigured browser.
- Language selection changes navigation, forms, accessibility labels, feedback, dates/numbers and analytical captions without reloading or losing drafts.
- Supported locale is persisted on the device and in account settings; offline settings changes synchronize through the existing idempotent queue.
- Real names, notes, categories, attachments and money/units never change when the display language changes. Built-in category labels retain their canonical stored values. Only isolated synthetic demo presentation is localized.
- Both mobile360px and desktop layouts work; all existing Russian journeys remain valid and English journeys are tested.
- Language-specific genuine demo screenshots are produced with a single selected vehicle in analytics. Values are not smoothed or fabricated.
- App source and docs publish only after tests and CI, no secrets or user data.

## Scope
UI and demo presentation, setup/settings locale, README visuals/footer. Report/CSV document contents and provider-delivered notifications are not silently translated; currency and units do not change. No external translation API, geocoding or AI dependency.
