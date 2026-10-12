# Data model

UserSettings.locale: optional “ru” | “en”; old absent values are compatible. Credentials.locale: default ru, accepted during setup. Device preference: mashina-locale. All use validated supported locales. No currency/unit conversion, SQL migration or change to finance/category IDs.
