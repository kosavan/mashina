# OCR, output languages, large archives and vehicle suggestions

English · [Russian](ocr-results-archives.ru.md) · [Update and rollback](updating.md)

Prepared for 1.9.0; publication requires exact-source CI and the production container restore drill.

## Local OCR and review

Text PDFs first use Poppler's local text layer, preserving characters and table layout. Scans and photographs use two bounded Tesseract RU/EN passes with different segmentation and sharpening. Dark panels are inverted, transparent images are flattened on white, and the working image is bounded to 2800 pixels on its longest side. Crop and rotation remain available; choose up to three PDF pages.

Conflicting labelled values appear as selectable candidates beside the editable field, along with alternate source text. Choosing a candidate does not select the transfer checkbox. Nothing writes a record until you review, apply and save. The same applies to totals, dates, fuel quantities and odometers. Recognition does not infer a full tank, missed fill-up, currency conversion or measured mileage from a forecast.

Service tables support labelled quantity, unit price, monetary or percentage discount, VAT/tax amounts or rates, and printed final line totals. Tax is included in the suggested unit price and discount is an amount for the whole line. Tax rows require a matching printed line total; unknown columns, conflicting passes, unsupported wrapping and inconsistent arithmetic remain source text. Review every selected line. The server still computes one exact expense from those lines. You cannot transfer both the total and line items.

A conservative seven-segment baseline is evaluated on clean light/dark synthetic LCD crops and offered only as an experimental candidate in instrument-panel mode with cropping enabled. A number alone is never a confirmed kilometre reading: trip distance, range and miles can look identical. Oblique, damaged, illuminated or stylized displays are not universally supported. There is no measured accuracy guarantee for arbitrary real documents; compare with your source and use manual input when needed.

The worker remains local and temporary, one request at a time, with 512 MiB address space on Linux, per-command timeouts, a 65-second processing budget and a 75-second outer timeout. Up to two OCR passes per page trade additional CPU for reviewable alternatives; no background daemon or new mandatory dependency is introduced. PDF text extraction is skipped when a crop/rotation was requested.

## Output languages

Sale PDFs, readable CSV and generic Push/Telegram notifications use the recipient's account language in RU/EN/DE. Other interface languages currently fall back to English for these outputs. Dates and numbers follow the output locale; amounts remain exact and currencies are not converted. PDF titles, headings and generated labels are translated; user names, descriptions, part names and custom categories remain unchanged, even when identical to an application label.

The Settings CSV download uses `/api/v1/export.csv?readable=true` for a localized event table. Formula-like user text is escaped for spreadsheet safety. `/api/v1/export.csv` retains its legacy machine format, and `/api/v1/export.json` retains stable keys and records. These machine exports are intentionally language independent. Notification delivery, consent and deduplication are unchanged; selecting a language does not send a message.

## Large archives

Full backup downloads, CLI backups, upgrade snapshots and pre-restore recovery copies write ZIP64 archives directly to disk, hashing and copying files in chunks. Restore accepts the original format-1 archives; the database, attachments, stable IDs, exact amounts and operation receipts are preserved. New code accepts up to 20 GiB compressed or expanded and 100,000 archive entries, with a 16 MiB manifest bound. Previews remain rebuildable caches outside the archive.

Browser restore streams a raw `application/zip` request to `/api/v1/restore/stream`, staging on the persistent data volume rather than the production `/tmp` tmpfs. Authentication, administrator permission and CSRF protection are required. Permissions are rechecked immediately before replacement. The existing multipart `/api/v1/restore` endpoint remains compatible with older clients and small uploads; large clients should use the streaming endpoint or CLI. Both verify checksums, paths, schema, ownership and database integrity before changing live data. Invalid archives and failed downloads remove task temporary files. A complete `data/pre-restore.zip` is atomically preserved before replacement; file or migration failures roll back to the previous database and attachments.

Have room on the data volume for the incoming ZIP, expanded restored data, a complete backup of the current garage, and a temporary SQLite snapshot, in addition to live data and retained backups. Reverse proxies must allow the archive size and a suitably long upload/response timeout. The 20 GiB bound is an application safety limit, not a claim that every browser/proxy/server has that capacity. For large or slow transfers prefer CLI while the app and notification dispatcher are stopped. Keep the previous image and a verified pre-update data copy for rollback; an older release cannot restore a new archive larger than its 200 MiB bound.

## Vehicle suggestions

Make, model and engine inputs are searchable editable comboboxes with keyboard support. Models depend on the selected make, engines on the model. Suggestions are bundled locally, work offline and include visible saved custom values. Changing a make clears the draft model/engine; changing a model clears the draft engine. Saving an unchanged existing vehicle preserves all custom values. Manual entry is always available.

The starter catalogue contains 29 makes and 123 models; it is a curated typing aid, not a complete licensed vehicle/engine/parts database. Generations and markets are combined, so confirm the variant against your vehicle documents. No characteristics are inferred from a choice, and no VIN, registration plate or garage data is sent to an external service. VIN/parts compatibility remains research.

Manufacturer reference examples used when reviewing engine-family labels: [Volvo XC60 specifications](https://www.volvocars.com/uk/support/car/xc60/2021/article/b0804d54c7fc096bc0a81f6f065ad63e/8899be1dc7fc78b1c0a81f6f5a01b4ab/00d308891f0cc443c0a80151619a46e9/), [Skoda Octavia powertrains](https://www.skoda-auto.com/models/layers/layers/octavia-powertrain-and-safety-old), [Toyota Corolla](https://media.toyota.co.uk/vehicles/corolla-2019-current/) and [BMW 3 Series](https://www.press.bmwgroup.com/global/article/detail/T0285128EN/the-all-new-bmw-3-series-sedan?language=en). These examples do not certify every catalogue entry or a particular vehicle's fitment.
