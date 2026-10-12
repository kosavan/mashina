# Plan

Use on-demand Tesseract rus+eng and Poppler from local OS/container packages. No external
provider or model endpoint. Keep current monolith and schema. Isolate native decoding/OCR
in a one-shot Python worker with fixed argument lists, private temporary directory,
Linux resource caps, native command deadlines and outer process-group cleanup. One global
nonblocking semaphore; async HTTP delegates work to a thread, leaving health/API responsive.

Separate conservative pure text parsing from extraction. Only labelled facts become
suggestions; ambiguous totals/dates/odo values are omitted. Plain extracted text is inert
React text, not HTML or instructions. Local clipboard/manual editing covers arbitrary layouts.

OCR review lives inside existing RecordForm, avoiding stacked modal and preserving draft.
Stateful editable suggestion fields are applied deliberately through existing native form
inputs/React fuel state; no new saving endpoint. Original attachment is opt-in. Recognition
does not mutate the database. Recheck vehicle permission after the native task completes.

Install native packages in Docker and Linux CI; real generated image/PDF fixtures prove OCR
execution. Unit tests cover conservative parsing and worker failures; browser tests use
controlled extraction responses only for interaction assertions, never as product demo OCR.
Real engine tests are required in CI; local Windows missing-engine limitations are reported.
