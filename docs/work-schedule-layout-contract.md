# Command Work Schedule — approved layout contract

**Approved reference:** v10 Work Schedule on iPhone, November 8, 2026. Preserve the visual arrangement and density from the screenshots reviewed then.

## Stable screen order

1. Small top brand and Settings (no device-status text).
2. Work / School / Personal / All.
3. Week / Month / 4 Weeks, with Import and Add beside the tabs.
4. Compact calendar directly below controls: prev, date range, Today, next; weekday labels match the selected period.
5. **Shifts**: chronological rows immediately below the calendar. Date at left, hours and assignment/area in the center, adjusted hours at right.
6. Compact Work Week / Pay Week selector and Scheduled / Breaks / Adjusted totals.
7. Usual workdays near the bottom.

**Preserve** v10 card radii, spacing, colors, date cell height, shift density, and summary sizing. Avoid new introductory headings, duplicated period labels, or extra explanatory cards. Check any UI changes against the approved iPhone screenshots before altering layout.

**Work > Week:** Pay Week (left, default) displays Sunday–Saturday; Work Week (right) displays Friday–Thursday. Switching these changes the calendar dates, shift list, and hours totals together and persists the choice. Switching periods from Month or 4 Weeks opens the corresponding Week view. Month and 4 Weeks remain Sunday-first calendars, and 4 Weeks contains four full Sunday–Saturday rows. School, Personal, and All week calendars also start Sunday. No calendar begins on Monday.

Location parsing: WWoHP / Hogsmeade means **Hogsmeade Village**; Area Support is an assignment. Missing locations stay missing rather than inheriting another shift's location. Do not alter saved shifts without an explicit edit.

**Privacy:** The approved screenshots include the user's actual work shifts. Keep them in the private review context, not in this public repository. This contract preserves the decisions without exposing the schedule.

## iPhone standalone viewport

As of v14, do not reintroduce `viewport-fit=cover` or a `100dvh` fixed-height shell without a physical iPhone cold-launch test. They caused an extra bottom strip measuring about 62 CSS pixels. Preserve the in-flow nav, local data, and unmodified approved Work Schedule visual hierarchy.
