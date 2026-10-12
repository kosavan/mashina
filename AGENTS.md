# MASHINA repository instructions

Read `.specify/memory/constitution.md` before changing application behavior.

## Compatibility is a release requirement

- Preserve supported installations: databases, files, settings, stable record/operation
  IDs, authorization boundaries and pending offline queues. Never require a data reset.
- Never modify a released migration or `backend/schema.py`'s frozen initial schema.
  Add a new revision; extend real-schema upgrade tests and recovery verification.
  Keep `backend/migrations/frozen.json`'s released fingerprints unchanged.
- Reject unsupported/newer schemas rather than silently downgrading. Before changing
  an installed schema, preserve a consistent complete recovery snapshot.
- For each change, review compatibility with old API payloads and offline clients.
  Test the affected existing journeys as well as new behavior. Financial operations
  must remain idempotent and exact after upgrade, edit, retry and restoration.
- Update `docs/updating.md` and `docs/updating.ru.md` whenever deployment/schema/config
  behavior changes. Include backup, verification and a matching data/image rollback.
- Run appropriate regressions, `tools/check_docs.py`, `tools/check_migrations.py` and
  the secret scan. Production durability changes require the read-only non-root
  container restore check. Publish only after exact-source CI succeeds.

## Product and documentation

- Keep the MASHINA name, premium mobile UI, local-first privacy and isolated demo.
  Do not replace finished UI with generic administration scaffolding or placeholders.
- Update both `docs/roadmap.md` and `docs/roadmap.ru.md` when accepting requests,
  changing scope or shipping verified work. Distinguish shipped, planned and research.
- English README/user guides must be English; use separate `.ru.md` guides and
  keep cross-language navigation clear. Do not translate user-entered data.
- Keep secrets, personal files, data directories and backups out of Git/public logs.
  Never change an owner's server infrastructure as part of a repository audit.
