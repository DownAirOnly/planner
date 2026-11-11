# Command Money migration checklist

**Goal:** Move all of Everyday's Finances data to Command, prove it matches, then retire Money in Everyday in a later, separately approved release.

## Source of truth

- The current Everyday account is authoritative until a **fresh** export has been checked.
- Everyday's `Settings → Export separate JSON files → Finances` produces a file with `format: "everyday-section-v1"`, `section: "finances"`, and `data.transactions`, `data.classificationRules`, `data.budgetPlan`.
- Full Everyday backups with those three top-level data fields are also accepted.
- Never paste or commit any real bank transactions, descriptions, statements, receipts, or account identifiers into this public repository.

## Import acceptance

1. Export a fresh finance section from Everyday, **not a settings-only copy**.
2. Open Command → **Money → Import Everyday finance**, pick the JSON, and review the on-screen audit.
3. Verify transaction count, oldest/newest dates, total income, expense and transfer **in cents**, bank metadata, receipt itemizations, classification rules, recurring income/bill schedules, spending caps, paycheck overrides, bill assignments and unresolved bank rows.
4. If replacing an earlier Command import, confirm that the proposed file has **no missing transaction IDs**. The importer refuses regressions and never silently merges transactions.
5. Type `IMPORT` to save locally. Verify the stored finance checksum and export **Audit report**. The audit includes SHA-256 of sorted source transaction IDs, which can be compared to an independent source audit.
6. Export Money JSON as a separate recovery file, and keep the original Everyday JSON.
7. Sign into the **same Google account** in Command; publish `firestore.rules` to Firebase before the first finance backup.
8. In Money, tap **Back up to Firebase** and confirm. The cloud snapshot uses immutable chunks, a final manifest revision and a full read-back checksum comparison.
9. Tap **Check cloud backup** to verify that the cloud snapshot and device copy match exactly.
10. On another device, after sign-in, verify the cloud restore path using a non-destructive backup. Review all important finance screens and history coverage.
11. Only **after** data integrity and functional parity are confirmed should a separate, explicitly requested change remove the Money feature from Everyday. It must never delete the Everyday financial data automatically.

## Current limitations

- v27 is a **read-only migration and audit stage**, with manual cloud snapshots. It is not continuous, multi-device financial synchronization.
- Forecast cards are informative planned-period estimates, not authenticated bank balances.
- The existing Command tasks/shifts backup is separate from the Money backup; export both if relying on offline backups.
- The cloud snapshot is chunked rather than yet partitioned into independently writable months; monthly sync and in-app editing will need a subsequent design and migration.
- Dates, IDs and all unknown original finance fields are preserved on import; no transaction classifications are silently rewritten.

**Do not delete or reset Everyday finances during this stage.**

## v29 — local transaction management

- Money → History supports merchant/description/bank-text search, month/type/category filters, new transactions, and edits.
- Original imported bank amount, bank posting date, statement text and external bank IDs are immutable in the editor. Receipt line-item names/categories can be revised while retaining their item amounts and reconciled receipt total.
- Archive is reversible and excludes that record from active income/expense totals; archived IDs and original record fields are preserved in the finance backup. Archived entries cannot be silently reintroduced by an Everyday re-import.
- Every transaction save first snapshots the previous whole local finance state for recovery, validates the entire edited ledger, hashes it, and verifies its saved bytes. A stale copy from another tab cannot overwrite a newer local checksum.
- Re-import of Everyday data is blocked if it would overwrite edited Command transactions; future safe merge requires a separate design.
- Local changes invalidate the prior cloud verification until the owner manually backs up and verifies again. No automatic cloud sync is represented as active.
