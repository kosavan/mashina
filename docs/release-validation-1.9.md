# MASHINA 1.9.0 release validation

Released and deployed with owner authorization on 19 October 2026.

- Release tag `v1.9.0`: source `11124130bf59b8cc70f83f43dce2e482b78b3902`.
- [Exact-source CI](https://github.com/kosavan/mashina/actions/runs/39287255353): success,
  including production image build, native OCR/PDF checks and read-only non-root restore.
- [Merged change](https://github.com/kosavan/mashina/pull/24); main commit
  `6e320a028e7a92187c7f0050b21c6442d0e11853` has the identical source tree.
  [Post-merge CI](https://github.com/kosavan/mashina/actions/runs/39288552403): success.
- Local backend regression: 298 passed, 12 native-tool skips on Windows; Linux native
  suite: 58 passed. Frontend unit checks: 36 passed. Browser regression: 54 passed
  across Chromium/WebKit, plus four focused checks after final vehicle-entry adjustments.
- A 201.07 MiB archive round-trip used 4.33 MiB traced Python peak allocation. This
  exercises the former 200 MiB boundary, not a measured 20 GiB full-load benchmark.
- RU/EN/DE PDFs were rendered and visually reviewed. Documentation, released migration
  fingerprints and tracked-file secret checks passed. Schema remains 007.

Deployment preserved the previous image and complete recovery material before replacing
the application. The actual installed backup was restored into an isolated, networkless,
read-only, non-root container using the new image. Original database record fingerprints
(excluding expiring sessions) and attachment hashes matched after deployment. Application
and existing HTTPS gateway health checks passed at version 1.9.0; a further backup copy
was retained outside the application container. Private paths and owner data are omitted.

[Feature limits](ocr-results-archives.md) · [Backup and rollback](updating.md)
