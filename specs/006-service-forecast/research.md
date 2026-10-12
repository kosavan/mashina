# Research decisions
Read-only architecture research reviewed existing normalization, ownership report and completion/offline code.
- Decision: nullable exact integer estimate/currency on existing Reminder JSON. Rationale: no second financial model or SQL schema change; old backups default unknown. Alternative inferred cost from history rejected as unconfirmed.
- Decision: next dated service only; date+km is a calendar deadline that can occur earlier by confirmed mileage. Mileage-only and overdue costs remain separate. Future recurrence rejected because it assumes unconfirmed completion.
- Decision: fix completion clearing of non-repeating criteria and mirror it offline; require km only for km repeat and never silently substitute today's odometer into historical work. Rationale: otherwise next forecast can be immediately overdue or use unconfirmed values.
- Decision: keep currencies separate, do not calculate mixed total; label cached plan when unsynchronized changes exist. No new dependencies or external research necessary: this reuses audited local exact arithmetic and existing contracts.
