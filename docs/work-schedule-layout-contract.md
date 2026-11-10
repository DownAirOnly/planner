# Command Work Schedule — approved layout contract

**Approved reference:** v10 Work Schedule on iPhone, November 8, 2026. Preserve the visual arrangement and density from the screenshots reviewed then.

## Stable screen order

1. Small top brand and Settings (no device-status text).
2. Work / School / Personal / All.
3. Week / Scheduled / Month, with Import and Add beside the tabs.
4. Compact calendar directly below controls: prev, date range, Today, next; weekday labels match the selected period.
5. **Shifts**: chronological rows immediately below the calendar. Date at left, time and assignment/island in the center, full scheduled duration at right.
6. Compact Work Week / Pay Week selector and Scheduled / Breaks / Adjusted totals. In Scheduled mode the selector appears above the weekly slices.
7. Usual workdays near the bottom.

**Preserve** v10 card radii, spacing, colors, date cell height, shift density, and summary sizing. Avoid new introductory headings, duplicated period labels, or extra explanatory cards. Check any UI changes against the approved iPhone screenshots before altering layout.

**Work > Week:** Pay Week (left, default) displays Sunday–Saturday; Work Week (right) displays Friday–Thursday. Switching these changes the calendar dates, shift list, and hours totals together and persists the choice. **Scheduled** shows a slice for every week with saved shifts, grouped according to the selected period; its selector appears above the slices. **Month** remains a Sunday-first conventional calendar. School, Personal, and All week calendars begin Sunday.

Location parsing: WWoHP / Hogsmeade means **Hogsmeade Village**; Area Support is an assignment. Missing locations stay missing rather than inheriting another shift's location. Do not alter saved shifts without an explicit edit.

**Privacy:** The approved screenshots include the user's actual work shifts. Keep them in the private review context, not in this public repository. This contract preserves the decisions without exposing the schedule.

## iPhone standalone viewport

As of v14, do not reintroduce `viewport-fit=cover` or a `100dvh` fixed-height shell without a physical iPhone cold-launch test. They caused an extra bottom strip measuring about 62 CSS pixels. Preserve the in-flow nav, local data, and unmodified approved Work Schedule visual hierarchy.

## v19 schedule and import updates

- Automatic breaks: at least **6 hours = 15 minutes** and at least **8 hours = 30 minutes**. Manual override remains available.
- Work views are **Week / Scheduled / Month**. Scheduled shows every week containing saved nonrecurring shifts as a separate calendar slice with chronological shift rows. Weeks without shifts do not appear. An indefinitely recurring shift is represented within a bounded one-year lookback/lookahead; finite individual shifts are not excluded by date.
- The Pay Week / Work Week selector regroups the Scheduled slices Sunday–Saturday or Friday–Thursday. Month stays Sunday-first.
- Shift row duration is the **full scheduled time**; the scheduled/breaks/adjusted summary remains separate.
- During import review, the first shift needing attention opens by default; otherwise the first new shift. Only one editor opens at a time, and date/time fields stack on narrow devices.
- Location editing shows **Island** when the park is IOA; otherwise **Area**, including when the park is changed during review.

These are specific revisions to the v10-approved layout. Preserve the rest.

## v21 correction — Scheduled is one calendar, not a series of week cards

In Work → Scheduled, show **one continuous seven-column calendar block** beginning at the current pay/work week and continuing through all upcoming individually saved work shifts. Include intervening empty weeks as rows of the same calendar (no separate weekly cards). Place **one chronological shift list** immediately below that calendar, containing shifts from the entire current period (including earlier days in it) and all subsequent saved shifts. Changing Pay Week / Work Week changes the weekday columns (Sunday–Saturday or Friday–Thursday) and the start/end grouping, without fragmenting the calendar. The summary shows the CURRENT selected accounting period. Only indefinite recurring weekly shifts have a finite display horizon of 12 weeks; show that limitation to the user. Do not alter stored events or break overrides.
