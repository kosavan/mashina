# German interface — community request #20

## Outcome and scope

German-speaking owners can choose Deutsch before setup, sign-in and demo and in
account Settings. All existing interface and isolated demo resources have German
translations. Dates/numbers use de-DE. Russian remains default; English/Russian
continue working. Bundled resources work without an external translation service.

## Acceptance criteria

1. German setup persists locale=de; settings accept ru/en/de and reject unsupported
   values. Old payloads remain valid; partial updates retain other preferences.
2. Every existing English UI/demo key has a German counterpart; parameter indices
   are preserved, including messages whose German word order differs.
3. Switching languages preserves drafts and user records. Exact money, currencies,
   units, stable IDs, canonical categories and financial operation queues are unchanged.
4. German navigation/forms/body damage work on desktop and 360px without overflow;
   account language and one exact expense survive offline reload and single replay.
5. README, active operational/product docs, public language metadata and bilingual
   roadmaps describe German support. A German update guide includes backup,
   verification, matching previous data/image rollback and old-server limits.
6. Release and reply to seals187 only after exact-source Linux CI passes. Reply links
   the actual release and German update instructions and states remaining output/OCR scope.

## Implementation and compatibility

Extend existing locale union/validation and choose a per-language catalog at each
translation call. Keep source patterns independent of translated word order. Add
separate German demo projection. No schema, migration, dependencies, provider calls
or server infrastructure changes. Existing offline records remain replayable.
Old servers reject de, so update backend/frontend together. Old frontends do not
support a saved de preference; documented rollback restores matching data/image.

PDF/CSV output labels, external notification payloads and German OCR are excluded
and remain clearly documented. Historical release/audit evidence remains unchanged.

## Verification

Catalog/placeholder and formatting unit tests; parameterized backend setup/settings
regressions; real German browser journeys and existing Russian/English journeys;
full financial/security/upgrade/backup regressions; immutable migration, docs/link,
source-secret and build-size guards; exact-source CI including native OCR and
read-only non-root container restore. Evidence: docs/release-validation-1.7.md.
