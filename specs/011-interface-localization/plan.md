# Plan

Keep the React/TypeScript/FastAPI/SQLite modular monolith. Use local English message catalog with Russian source resources, parameterized messages, typed Locale union and explicit React render calls. No DOM text replacement and no external translation service. Locale subscription triggers render while preserving component state. Existing exact money and canonical category values remain intact.

Store locale in localStorage for pre-auth/offline and existing users.settings JSON for account preference. Validate ru/en at the server boundary; first setup accepts locale. No table/schema migration is needed. Normal offline settings mutations provide durable synchronization. Default old accounts to Russian/device choice when locale is absent.

Only the isolated fixture has a presentation projection; actual stored user data are untouched. Date and number utilities use Intl for selected locale. Existing chart calculations stay intact; screenshots explicitly choose Volvo rather than mixing cars in one fuel line.

Research terminology with three SpecKit-plan research agents; consolidate and review catalogs, especially Expense vs Consumption and odometer vs period distance. Tests cover both locales, drafts, errors, persistence, real user text, categories, offline settings and English mobile. Update existing Hyperframes infographic with local language-specific demo assets and validate snapshots; no video export.

Gates: Pytest, Vitest, Playwright, static checks/build180KiB budget, local visual inspection and source scan. Final-head GitHub/LinuxDocker CI before merge/release.
