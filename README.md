# Command

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

Command uses browser localStorage **on this device only**. It does not have Firebase, account login, cloud backup, notifications, or cross-device sync yet. Clearing site data can erase your saved records. Use Settings → Export backup before significant changes. Import **replaces everything**, including calendar events.

The browser OCR uses **Tesseract.js v7** loaded from a CDN on demand and reads the image locally on the device. Language/worker assets are downloaded from external CDNs. The selected screenshots themselves are not uploaded to a Command server and are not stored after OCR. You can instead paste copied text to avoid using OCR. OCR may be slow and cannot reliably interpret every screenshot layout; always review imported events.

Only general starter information belongs in this public repository. Personal schedules, health information, and financial records should not be committed to git.

## Deployment

GitHub Pages is configured through `.github/workflows/pages.yml` to deploy when main changes.

App: https://downaironly.github.io/planner/

On iPhone, open in Safari and choose Share → Add to Home Screen. The app's standard pages work offline after an initial load; the screenshot text reader may need internet to fetch its OCR engine.

## Next

Improve schedule parsing for actual screenshots, exceptions to recurring events, Firebase Authentication and Firestore sync, and reviewed ChatGPT handoffs.
