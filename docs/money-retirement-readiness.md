# Money retirement readiness — Everyday → Command

**As of Command v34 (2026-11-11). Status: NOT YET READY TO DELETE THE SOURCE DATA.**

Command has the main financial workflows from Everyday. The code-level checks completed on synthetic data are not an assertion that the user's actual finance history or all iPhone PWA interactions have been verified.

## Implemented in Command

| Everyday workflow | Command | Status |
| --- | --- | --- |
| Original imported transactions, identifiers, bank details and receipts | Money History, original-data locks | Implemented; original imported data must be verified |
| Add/edit/search/filter transactions | Money History | Implemented |
| Archive/restore records | Money History | Implemented; safer alternative to destructive delete |
| Spending caps, recurring bills and paychecks, occurrence statuses | Money Budgets / Bills | Implemented |
| Paycheck overrides and bill-to-paycheck assignment | Money Bills | Implemented |
| Assign discretionary purchases to paycheck | Money History editor | Implemented |
| Paycheck period ledger, held-back previous-check estimate, what-if spending | Money Overview | Implemented v34 |
| 7-/14-day cash-flow and 35-day forecast | Money Overview / Budgets | Implemented; these are estimates |
| Bank of America checking, savings, card CSV | Money Import → Bank of America | Implemented v33; real statement validation outstanding |
| Receipt/finance CSV, item rows and sum validation | Money Import → Receipt / transactions | Implemented v33 |
| Export enrichment CSV / paste ID-anchored clarifications | Money Import → Transaction clarifications | Implemented v33 |
| Duplicate bank identity, receipt matching, persistent unresolved bank rows | Money Import bank preview and review queue | Implemented v33; real statement validation outstanding |
| Merchant classification rules and select-to-apply review | Money Budgets | Implemented v32 |
| Spending insights, 30/90 days, monthly, merchants/categories/transfers | Money Insights | Implemented v33 |
| Google full backup and opt-in incremental sync | Money Sync and Back up to Firebase | Implemented; cross-device verification outstanding |

## Required acceptance tests before hiding Money in Everyday

1. **Latest source archive:** Export *fresh* Everyday Finances JSON and Command Money JSON, keeping both files outside the installed PWAs. Do not delete or reset an app before both exports are saved.
2. **Audit identity and totals:** Compare every source transaction ID with Command's active + archived IDs, identify and explain differences caused by legitimate Command-only edits, verify bank/receipt fields on sample matched records, and inspect rules, budgets, schedules, bill assignments, paycheck overrides, and unresolved bank rows. If Everyday has newer records, reconcile them explicitly; do not overwrite the newer Command data with an old full export.
3. **Real bank import:** In Command, import a real, overlapping Bank of America CSV; confirm previously imported rows are skipped, ambiguous rows remain reviewable, and a matched receipt is not duplicated. Confirm statement labels, debit/credit direction, transfer handling and a refund.
4. **Real receipt/enrichment:** Paste a multi-item receipt and an enrichment CSV; confirm the item totals, stable IDs, personal edits, and protected raw bank metadata. Test a malformed CSV and confirm nothing is saved.
5. **Real device/cloud recovery:** After a successful full Money backup and up-to-date sync, sign in on a second device or isolated browser session. Verify source fields, transactions, rules and plans after restoring. Test offline edit/reconnect and observe any conflict pause (do not risk the only real backup).
6. **Practical daily-use check:** For at least one full pay cycle, verify actual payday period, bill allocation, posted purchases, budget remaining, manual cash balance, and the 1-/2-check view against expectations. Confirm no silent duplicate charges.
7. **Retire non-destructively first:** Hide Everyday's Money navigation **in a separately approved change**, without deleting the finance data in Firebase or local storage. Keep a source JSON and restore path until a longer period of Command usage has been satisfactory.

## Known open items

- Source-vs-Command **automatic conflict-aware incremental merge** is not implemented. JSON re-import after Command edits is blocked intentionally. If both apps have been edited since initial migration, reconcile differences before retirement.
- Actual iPhone rendering and Bank of America CSV formats used by the user have not been exercised in this development session.
- Firestore immutable sync chunks currently have no automatic retention cleanup; monitoring and pruning will be a later operational task.
- Cross-device sync works while Command runs and is opt-in; the iOS PWA cannot promise delivery when force-closed.
- The source retirement/removal has not been performed. This is deliberate.

**Never publish real bank data or exported finance JSON to this public GitHub repository.**

## v36 — visible Money redesign

- A time-to-decision approach: four main screens only — Overview, Spending, Transactions, Bills. Advanced Bank CSV, bank reconciliation, archives, classification rules, detailed budgets, import, manual/cloud sync and audits remain under a single **Manage Money** entry, not repeated on every screen.
- Overview shows the user-supplied cash balance, minus unsettled bills due before the next scheduled payday. If no cash balance is saved, it requests one. If the balance date is not today, it clearly identifies the number as an estimate requiring an update; it is not a live bank feed.
- Spending shows 7-, 30-, 90-day actual transaction totals, itemized category splits, top merchants and only verifiable period-over-period patterns.
- Transactions has everyday type/category/month and review filters with the existing editor and archive/recovery behavior.
- Bills & Paychecks shows this-check/next-check allocations, upcoming unpaid bills, and a non-recording what-if calculation. Detailed scheduling/marking stays one level below in Manage Money.
- Firebase synchronization conflicts remain visible from the main Money screens; opting in and backups still require explicit user action.
- v35 fixed a Money rendering failure where a sync-status constant was referenced before initialization.
- Existing finances, import/backup formats and cloud records are not rewritten by this visual redesign. Real iPhone verification is still necessary.
