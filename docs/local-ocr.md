# Fully local text recognition

For prepared 1.9 improvements and updated limits, see [1.9](ocr-results-archives.md).

## Use

While adding a fuel fill-up, expense, service record or odometer reading, choose
**Read a photo or PDF**. Choose fuel receipt, workshop invoice,
dashboard or any screenshot/document. Select JPEG/PNG/WebP or up to three distinct PDF pages (1–20),
optionally choose clockwise rotation and a normalized crop in **Crop and rotate**, then **Read locally**. The crop applies after rotation to each selected page; the original attachment is unchanged. Inspect the extracted text and correct suggested values.
Tick only fields you verified, then **Apply selected fields**. This only updates the
current draft: the normal **Save** action creates the entry through the existing
validated, idempotent workflow. Cancel does not apply recognition values.

All fields start unchecked, including the odometer. Attaching the source is opt-in;
otherwise recognition creates no attachment. Full tank, missed fill-ups, vehicle,
currency and historical odometer corrections are never inferred. Existing invoice
line items must be reconciled manually before applying an OCR total.

The general screenshot mode extracts text from banking apps, vehicle apps and other
screens. It does not assume that a bank payment is fuel, treat balance as an expense,
or assign unlabelled digits to the odometer. You can enter values manually in review.
OCR accuracy varies with layout, glare and font. Compressed scans can lose date
punctuation; unknown dates remain empty rather than guessing a separator. Seven-segment displays and unlabelled
dashboards can require manual transcription. Workshop text is available immediately;
simple labelled tables now yield editable, individually unchecked line-item suggestions in maintenance drafts. Select either reviewed items or the total amount. Existing draft items are never overwritten. Tables with tax/discount/unknown columns, ambiguous layouts and unlabelled rows remain manual from the text; richer layouts are a [follow-up](roadmap.md).

## Local processing and limits

The standard Docker image contains Tesseract with Russian/English data and Poppler.
There is no OCR provider, external URL, cloud fallback or runtime model download.
OCR runs on demand on the owner's server, one file at a time, with one CPU thread.
Native decoding happens in a short-lived process; private temporary input/output is
removed after success/failure. It is process isolation with limits, not a full security sandbox.

Limits: 20 MiB file, 25 MP image, up to three distinct PDF pages up to page 20, 2100px normalized image (small sources upscaled at most 2x),
64 KiB recognized text, 45s deadline, 10 requests per user/client in five minutes.
Linux worker caps address space at 512 MiB and native CPU time at 30s. Oversized,
corrupt, protected or unreadable documents produce errors. OCR itself needs a connection
to your server; ordinary manual/offline entry remains available.

For development outside Docker, install `tesseract`, `rus` and `eng` language data,
and `pdftoppm` on the server's PATH. Debian/Ubuntu:

```sh
sudo apt-get install tesseract-ocr tesseract-ocr-rus tesseract-ocr-eng poppler-utils
```

On macOS use local packages (`brew install tesseract tesseract-lang poppler`); on
Windows use a local Tesseract installation with rus/eng and Poppler, or the documented
Docker setup. OCR does not run on the phone itself. Linux CI requires the real engine
and generated Russian/English image/PDF fixtures; browser interception only tests UI
review behavior and is never wired into production or demo results.

References: [Tesseract CLI](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html),
[installation/language data](https://tesseract-ocr.github.io/tessdoc/Installation.html).

## API contract

`POST /api/v1/ocr` uses an authenticated session and `X-CSRF-Token`, with multipart
`file`, `vehicle_id`, `mode` (`receipt`, `service`, `odometer`, `screenshot`) and
`page` (default 1). Optional additive fields: `pages` (comma-separated, up to three distinct pages 1-20), `rotation` (0/90/180/270 clockwise), `crop` (JSON array `[x,y,width,height]` normalized to 0-1, applied after rotation). Images support page 1 only. Existing single-page payloads remain valid. Only users with access to the active vehicle may call it.
A successful response contains inert `text`, optional string fields `amount`,
`liters`, `price`, `odometer`, `occurred_at`, and `engine: tesseract-local`.
The response additionally includes selected `pages` and `items` for simple labelled service tables (name, optional part_number, quantity, unit_price, discount=0). These remain inert suggestions and are never saved by OCR. Decimal strings use a dot; dates use ISO format. Missing or ambiguous facts are omitted.
The endpoint has no database writes and never returns a proposed record identifier.
Validation/recognition failures use the application's normal error envelope. Access
is checked again after processing; revoked access cannot receive the result.
