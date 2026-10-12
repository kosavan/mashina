# Body condition and damage

English · [Russian](body-damage.ru.md) · [Update safely](updating.md) · [Roadmap](roadmap.md)

Available in **MASHINA 1.6.0** inside each vehicle profile, below the ownership metrics.
The isolated demo includes fictional issues so you can explore the interface first.

1. Open a vehicle and choose front, rear, left, right or top.
2. Tap a panel to place a marker, or choose **Mark damage**. Keyboard users can focus
   a panel and press Enter/Space. The form also provides a panel selector.
3. Enter a title, type, your assessment of severity, discovery date and status.
   The expandable position section lets you move the point. Multiple issues can share a panel.
4. Save. Open any marker or list card to review it, edit, delete or undo deletion.
   Filter unresolved issues separately from repaired history; longer lists load six at a time.
5. Optionally add notes, contextual mileage, a repair date and estimate. Link an existing
   maintenance record for the same car to see the actual work and cost. Record that repair
   normally in Maintenance; the marker and estimate never create another expense or mileage reading.
6. Select before/after photos or reuse authorized images from that car's Documents.
   New photos upload when you save, require a connection and use the existing file limits.
   Up to 20 image references per issue; unlinking a photo or deleting an issue preserves its file.

Status changes retain a server-dated history, including reopening an issue. Severity is
your observation, not a diagnosis or measured technical condition. The diagram is universal,
not a model-specific body drawing. Archived/sold vehicles retain their condition history.

Markers and text are durably queued offline. Wait for the save confirmation before closing
or reloading; reconnect and keep the app open to synchronize. Conflicts remain visible in
the existing sync queue. Selected new photo files stay only in the open editor until uploaded;
they are **not** persisted in the offline queue. If an upload fails after the record saves,
the editor explains what remains and allows retrying. Already removed evidence is labelled
unavailable; private images remain subject to the existing file permissions.

Vehicle owners edit condition records; drivers can read them and only photos they are already
authorized to access. JSON/CSV exports include damage records; a full ZIP includes the database
and image files. Status history retains up to 10,000 transitions per issue.

This release adds schema **007**. Existing schemas 001-006 upgrade additively after a full
automatic recovery snapshot. Keep an off-disk backup and follow the update guide; rolling
back to an older image requires its matching pre-upgrade data. No data reset or new service.

Automated coverage includes mobile CRUD, keyboard placement, before/after photos, exact
financial separation, offline create/edit/reload, permissions, supported upgrades and full
restore/restart in the read-only non-root production container. Physical iPhone testing
remains a separate device-level check.
