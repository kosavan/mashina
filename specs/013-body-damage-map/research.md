# Research decisions
Phase 0 read-only agent inspected the existing implementation and integration paths.

- Decision: separate JSON-backed versioned `body_damages` table in revision 007.
  Rationale: preserve financial invariants and reuse audit/receipts/roles; embedding
  issues in vehicle JSON would cause unrelated edits to conflict and grow the cache.
- Decision: local SVG panel geometry, normalized x/y, HTML marker buttons and list.
  Rationale: accessible, responsive, no remote model assets or heavy dependencies.
  Alternatives: model-specific 3D/canvas diagrams deferred as unnecessary complexity.
- Decision: reference existing image IDs with before/after phase and maintenance ID.
  Rationale: no storage duplication or double accounting. Uploaded images remain local;
  missing evidence is explicit. Reuse existing upload limits and document permissions.
- Decision: owner writes, vehicle participants read; private photos filtered by existing
  attachment authorization. Existing machine API remains event/reminder only.
- Decision: revision-aware restore extends all bank/machine/notification safety branches,
  validates damage links/ownership and retains old archive support. Upgrade matrix
  uses actual schemas 001–007, never relabelled current databases.
- Decision: server-owned status history ignores submitted history and appends on changes;
  offline projected status is provisional until synchronization. Existing audit retains edits.
