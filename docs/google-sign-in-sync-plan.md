# Command — Google sign-in and safe sync plan

Status: design prepared following v13; **no live authentication or cloud writes yet**.
Hosting remains **GitHub Pages**. Data safety is a release-blocking requirement.

## Goal

Let the owner sign into Command with Google and use the same projects, tasks, ideas, and schedules across devices, including the installed iPhone PWA. Preserve offline use and manual JSON backups.

## Recommended implementation

- A dedicated **Firebase project for Command** with Google-enabled Firebase Authentication and Cloud Firestore. Do not share Botanica or Everyday's data collections.
- Authorized website: `downaironly.github.io` (OAuth authorized domain). Continue to host Command at `https://downaironly.github.io/planner/`.
- Consider popup-based Firebase sign-in first because GitHub Pages does not host Firebase's redirect helper at the application origin. Validate on the installed iPhone before shipping. Firebase notes that redirect sign-in requires cross-origin storage mitigations on Safari and that popup availability varies by platform. If needed, use a carefully tested same-origin helper or Google credential flow; do not silently switch hosting.
- Security rules must enforce a user-specific namespace, e.g. `/users/{uid}/... ` accessible only when `request.auth.uid == uid`. Do not rely on hidden controls as security.
- Keep sign-in voluntary and separate from Google account data in other apps.

## Data model

- `users/{uid}/projects/{projectId}`
- `users/{uid}/tasks/{taskId}`
- `users/{uid}/ideas/{ideaId}`
- `users/{uid}/events/{eventId}`
- `users/{uid}/preferences/main` (schedule tabs, usual workdays, pinned items)
- `users/{uid}/meta/sync` (schema version and migration metadata)

Preserve stable record IDs. Use timestamps/revisions and explicit delete markers for conflict handling; a blind whole-file last-write-wins sync can lose work.

## Migration safety

1. First display sign-in without changing the existing `command.v1` record.
2. On first sign-in, generate an exportable local backup and an independent recovery snapshot **before** touching the cloud.
3. If no cloud data exists, propose **Copy this device to my account**. Ask before uploading.
4. If cloud data exists, offer: **Use cloud copy**, **Keep this device copy**, or **Review merge**. Never auto-overwrite or silently combine.
5. Compare stable IDs and modified timestamps for merging; detect conflicts instead of duplicates. Calendar events must not be duplicated simply because dates/times match.
6. After migration, verify counts and record IDs for projects, tasks, ideas, and events, including repeat rules and manual break deductions.
7. Keep the original local record intact until migration verification succeeds. Export and recovery remain supported.
8. Offline edits should queue and reconcile after reconnect; surface an explicit sync status and meaningful errors.

## Delivery sequence

**Step A — Configure:** create Firebase project; register web app; enable Google provider and Firestore; authorize the GitHub Pages domain; author and deploy restricted Firestore rules.

**Step B — Auth-only:** connect Google login and logout, session persistence, and account UI in Settings. No cloud data changes yet. Test Safari and iPhone Home Screen launches.

**Step C — Migration:** explicit first-sign-in import preview and per-user cloud writes; verify data and offline behavior. Never erase the local record automatically.

**Step D — Sync:** per-record updates, conflict handling, record deletions, versioned backup, and multi-device tests.

## Acceptance tests

- Existing iPhone schedule and its time/break adjustments survive updates, sign-in, sign-out, interrupted migration, offline use, and reconnect.
- A different Google account cannot read another user's data.
- A fresh second device shows the correct same-account records.
- No account, new provider, or failure can trigger destructive reset.
- All pages retain the approved Work Schedule design and the GitHub Pages deployment.
