# Interface languages

English · [Russian](languages.ru.md) · [Deutsch introduction](../README.de.md)

MASHINA 1.8.0 supports **English**, **Deutsch**, **Russian**, **Simplified Chinese**, **Hindi**, **Spanish**, **Arabic** and **French**. Arabic uses right-to-left layout. Russian remains
the default. Choose a language before setup/sign-in/demo, or under
**Settings → App language** (**Einstellungen → App-Sprache** in German).

The local browser preference survives reload. Account language is saved through
the existing durable offline queue and synchronizes when connected. Changes send
only the language field and preserve other account preferences. Update frontend
and backend together: servers before 1.7 accept Russian/English, 1.7 additionally
accepts German, and 1.8 accepts all eight preferences.
Previously supported payloads and pending financial operations remain compatible.

Bundled resources cover navigation, forms, accessibility labels, known validation
messages, analytics, body damage and an isolated fictional demo presentation.
All eight languages use their own date/number formatting; German uses `de-DE`. New language catalogs load on demand and all public catalogs are precached for offline use. Your currency, units, exact monetary amounts,
IDs, custom categories, names, notes and files do not change. Demo presentation
never rewrites its stored records or canonical financial categories.

PDF/CSV output labels and external notification payloads retain their existing
language; full output localization remains planned in the [roadmap](roadmap.md).
OCR still uses the bundled Russian/English Tesseract data; changing the interface
language does not add recognition languages. No runtime translation service is used.

[English update/rollback](updating.md) · [German update/rollback](updating.de.md) ·
[Validation](release-validation-1.7.md)
