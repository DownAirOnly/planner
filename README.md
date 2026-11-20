# Command

## v42.3 — UKG work-schedule screenshot import

- Recognizes both pale-blue shift cards and the darker gray selected-day card, so a selected shift is no longer omitted just because the card has a different background.
- Uses a printed weekday/day label to resolve dates in the adjacent month when the visible schedule week crosses a month or year boundary; ambiguous pairs are not guessed.
- Reads a narrower date gutter near each card to avoid incorrectly attaching a previous card's weekday.
- Skips obviously clipped, time-free card fragments while retaining genuine full-card OCR failures for explicit review.
- Suppresses repeat undated attempts across overlapping screenshots only when they share confirmed shifts within one seven-day period; preserves multiple legitimate shifts with the same hours.
- Recognizes Rescue as a work assignment area.
- Includes synthetic OCR regression checks; no employee schedule screenshots or personal schedules are stored in the public repository.
- No calendar-event migration or changes to saved shift records. All detected entries remain reviewable before import.


## v42.2 — Sanity and recovery safeguards

- A locally unreadable or checksum-mismatched Money ledger now shows the verified import preview and confirmation. Recovery can proceed without clearing browser data.
- Before replacing an unreadable ledger via JSON or cloud restore, Command retains its exact original storage bytes in a separate local recovery slot. A previous verified recovery snapshot is not overwritten by a damaged record.
- Successfully importing or restoring a verified Money copy clears the recovery warning. Replacements remain explicitly confirmed.
- Repaired the legacy migration test fixture to use synthetic projects and tasks, instead of assuming empty app defaults contain records.
- No Finance schema or task/schedule migration, and no modifications to existing user records.


## v42 — Tasks and Home integration

- **Up next** shows explicitly pinned, still-open tasks in the chosen order. Waiting and blocked tasks remain visible if intentionally pinned; completed items stay out of Home and regain their prior position if reopened.
- **Suggested next** separately offers up to three actionable, confirmed tasks from organized areas or active, unblocked projects. Fresh Inbox captures, unreviewed legacy tasks, and work in blocked/waiting projects are never automatically promoted.
- Suggestions have Pin and Dismiss controls. Dismissed tasks are excluded from future suggestions until restored using the Inbox bell. Pinning clears dismissal; deleting tasks also removes stale priority references.
- **Tasks** has Open, Ready, Waiting, Done, and All filters with horizontal mobile scrolling. Task rows allow one-tap Pin / Unpin without opening the editor.
- Home shows open and due/overdue counts, and avoids repeating selected follow-ups in both priorities and the follow-up section. Organized follow-ups waiting for replies may remain due; dismissed and Inbox-only follow-ups do not reappear as reminders.
- No new schema, migration, invented tasks, or changes to Schedule, Money, or saved calendar entries.


## v41 — Money essentials

- **Available to spend** is shown only when the manually entered cash snapshot is dated today. Older snapshots show their original cash value with a prominent update prompt, not a misleading current spending figure.
- Available-to-spend subtracts still-unpaid scheduled bills until the next scheduled payday, or across a clearly labeled 14-day window if no payday is scheduled. It is an estimate, not a bank balance. Recorded purchases do not automatically adjust manual cash.
- Monthly category limits appear on the Money Overview with remaining/over-limit amounts and direct access to manage those caps. Existing receipt-item allocations and categories are reused without changing any transaction.
- Unpaid bills and the next payday are surfaced alongside recent spending and category totals.
- Bills display **planned remainder**, not a presumed spendable bank balance.
- Devices without existing Money data can start a verified empty ledger. Starting fresh never overwrites an existing local ledger and never creates sample transactions.
- Existing Everyday imports, bank reconciliation, recovery, and Google account syncing are retained. No finance schema migration or scheduled charge mutation.


## v40.1 — Schedule selection and editing reliability

- The selected day is indicated in the existing Work Week shift list without rearranging the approved layout.
- Saving or importing a shift displays the correct date and calendar immediately, including when the date or calendar changes.
- Opening a work shift from Home preserves the chosen Pay Week / Work Week grouping.
- Work shift editors say Add shift / Edit shift rather than generic event wording.
- The OCR importer and saved shifts are unchanged; v40 screenshot detection remains in place.


## v8 — Life areas and chosen priorities

- Navigation: Home, Schedule, Areas, Inbox.
- Home: pinned Up next items with Move up/Unpin, optional suggestions ranked by due date then priority, active project next steps, and separate upcoming Work/School/Personal commitments.
- Suggestions can be accepted or dismissed. Restore dismissed suggestions from Inbox. Only confirmed, actionable items are suggested; blocked/waiting/later projects are excluded.
- Areas: Home, School, Work & career, Health & fitness, Personal, Apps & projects. Direct tasks do not require a project. Items can be tasks, decisions, or follow-ups; ideas remain optional.
- Capture adds a task to Inbox with one text field. Edit to assign an area, project, kind, status, or optional date.
- Project blockers show only a Blocker indicator outside the project. Details appear inside the project and editor, and are included in private device exports.
- Existing data is migrated additively to schema 5. Projects infer areas from prior categories; all older projects/tasks are flagged for review and excluded from automatic Home suggestions until confirmed. No old tasks are assumed completed. Calendar events and work/pay-week behavior are retained.
- The original pre-v8 local record is retained in `command.pre-v8` as recovery data. Export backups remain the supported way to move data between devices; imports replace data after confirmation.
- No new personal balance, transcript, or health details are embedded in public source. Enter personal items on your own device.


## v7 — Work and pay week hours

Work scheduling now supports two seven-day groupings:

- **Work Week:** Friday through Thursday
- **Pay Week:** Sunday through Saturday

Both use the same saved shifts. Each period shows scheduled hours, planned break deductions, and adjusted hours. The weekly agenda displays daily totals and shift details, including days off. Shifts that run past midnight are assigned to their starting day, without a "next day" label.

Breaks default to:
- **Up to 6 hours:** 0 minutes
- **Over 6 hours through 8 hours:** 15 minutes
- **Over 8 hours:** 30 minutes

Individual shifts can switch to a **manual** break deduction in minutes (including zero), or back to **automatic**. Overrides are saved with events and included in JSON exports/imports. Only the Work calendar uses these hour summaries; School and Personal remain separate.

**Adjusted hours are estimates based on scheduled time and planned breaks, not verified payroll or actual clock punches.**


## v6 — Workweek-aware screenshot imports

- Proposed shifts are sorted by date and time, including after a corrected date.
- Importing overlapping full-image and cropped-image OCR passes no longer presents an unsupported, low-confidence shift outside the usual workweek (such as an invented Wednesday). An explicitly recognized Wednesday remains eligible for review.
- **Schedule → Work → Usual workdays → Edit** lets you change the default Friday–Tuesday workweek. The choice is saved locally and included in JSON backups. It helps interpret unclear screenshots but never creates shifts by itself.
- The original screenshot is still the source for scheduled hours; unknown hours remain blank.


## v5 — Work scheduling

- Proposed work shifts include an assignment: **Lead, Zones, RTC, Detail, Other**, or Not set. Zones can be color-coded (red, orange, yellow, green, blue, purple).
- Importer infers park and area from job text; normal IOA schedule cards display the area without repeating the park name. CityWalk and USF remain distinguishable.
- Date confidence is labeled **High / Medium / Low**, with a brief reason for estimates. These are heuristic labels, not calibrated probabilities. Imported rows remain editable before saving.
- The importer makes a second local OCR pass of the upper screenshot when it may contain a cut-off shift. If a preceding weekday is visible but its times are unreadable, it may propose an **unchecked, low-confidence** partial shift to complete manually; it does not fabricate times.
- Other schedule domains (School, Personal) remain separate and unaffected.

## v4 screenshot import

Screenshot import now opens a compact **proposed schedule** with one line per detected shift and an **Edit** button for each. The unprocessed OCR text is hidden in **Other import options**. Month headings and split day-number columns are supported; when OCR loses a date, the app can estimate a neighboring date and marks it for review. Time ranges crossing midnight show **next day**. Always review suggestions before saving.


Personal dashboard with separate work, school, and personal calendars; projects, tasks, and ideas.

## Command v5

- **Home:** concise overview of next work shift, next class, tasks, and projects. Work and school summaries remain separate.
- **Schedule:** dedicated tab with Work, School, Personal, and optional All filters. Day, week, and month calendars. No automatic mixing between domains.
- **Events:** create and edit timed or all-day events. Support for repeated weekly classes, weekdays, and an optional series end date. Editing a repeated event changes the series.
- **Import schedule:** paste extracted text from Photos/Live Text, or choose one or more screenshots and use local-browser OCR. Review and correct detected dates and times before saving. Detection is intentionally conservative. Some formats need manual adjustment.
- **Projects, Tasks, Ideas:** remain editable; Ideas is accessible in Projects.
- **JSON backup:** exports calendar events as well as projects, tasks, and ideas. Existing v1 backups can still be read but have no calendar events.

## Important privacy and data notes

Command stores tasks, projects, ideas and schedules in browser localStorage, with optional Google sign-in and manually initiated account backup/restore. The Money ledger is stored separately and offers its own export, verified cloud backup and opt-in account sync. The bell displays in-app Inbox items; it is not a push-notification service. Clearing site data may erase records not safely backed up. Export both the Command backup and Money JSON before significant changes. Main-data imports replace the existing tasks/projects/schedules after confirmation. Money imports have additional conflict checks and recovery safeguards.

The browser OCR uses **Tesseract.js v7** loaded from a CDN on demand and reads the image locally on the device. Language/worker assets are downloaded from external CDNs. The selected screenshots themselves are not uploaded to a Command server and are not stored after OCR. You can instead paste copied text to avoid using OCR. OCR may be slow and cannot reliably interpret every screenshot layout; always review imported events.

Only general starter information belongs in this public repository. Personal schedules, health information, and financial records should not be committed to git.

## Deployment

GitHub Pages is configured through `.github/workflows/pages.yml` to deploy when main changes.

App: https://downaironly.github.io/planner/

On iPhone, open in Safari and choose Share → Add to Home Screen. The app's standard pages work offline after an initial load; the screenshot text reader may need internet to fetch its OCR engine.

## Next

Improve schedule parsing for actual screenshots, exceptions to recurring events, Firebase Authentication and Firestore sync, and reviewed ChatGPT handoffs.
