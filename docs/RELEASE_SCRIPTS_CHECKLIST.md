# Release Scripts & Migrations Checklist

**Last updated:** 2026-10-12 · **Owner:** Suresh

One place for every database migration and one-time script that must run when code moves between environments. A branch merge is **not complete** until every row below that applies to the target environment is ticked for that environment.

Related: [SIT_UAT_PROD_DEPLOYMENT_RUNBOOK.md](SIT_UAT_PROD_DEPLOYMENT_RUNBOOK.md) (deploy order, backups, Cloud Build), [Fix_After_Sep30/Master.md](Fix_After_Sep30/Master.md) (fix log).

**Keeping it current**

- Every new migration or script gets a row in the tracker (section 4) in the same commit that adds it.
- After running anything, update its cell for that environment with the date (e.g. `✅ 2026-10-14`) and save the output (dry run + apply) under `scripts/dryrun-logs/`.
- Status keys: `✅ date` done · `⬜` to do · `❓` not recorded, verify · `➖` not needed in this environment.

---

## 1. Environments, branches, databases

| Environment | Backend branch | Database | Local env file | Notes |
| --- | --- | --- | --- | --- |
| Dev (local) | `DEV-NEW` | `assetmanagement_dev` | `.env` | **Same database as SIT.** Anything run on dev is already done on SIT. |
| SIT | `SIT` | `assetmanagement_dev` | `.env.sit` | Shared with dev. |
| UAT | `UAT` | `assetmanagement_uat` | `.env.uat` | Apply migrations explicitly; `prisma generate` does not run SQL. |
| Prod | `Prod` | `railway` (from the deployed service's `DATABASE_URL`) | `.env.prod` | Backup first. Confirm the target DB name printed by the command before applying. |

Merge path: `DEV-NEW` → `SIT` → `UAT` → `Prod`. Admin, Ecom and mobile have no database scripts; their release steps are in the runbook.

## 2. How to point a command at an environment

Run everything from `asset-management-backend`. Prisma and scripts read `DATABASE_URL` from `.env` unless it is already set, so set it from the target env file for that one command:

```bash
cd /Users/sureshkumar/Documents/GitHub/Nivaana/asset-management-backend
export TARGET_DB_URL="$(grep -E '^DATABASE_URL[[:space:]]*[:=]' .env.uat | head -1 | sed -E 's/^DATABASE_URL[[:space:]]*[:=][[:space:]]*//' | tr -d "\"'")"
```

Works for both `.env` (`KEY=value`) and the Cloud Build files `.env.sit` / `.env.uat` / `.env.prod` (`KEY: "value"`). Checked 2026-10-12: `.env` and `.env.sit` → `assetmanagement_dev`, `.env.uat` → `assetmanagement_uat`, `.env.prod` → `railway`.

Then prefix each command with `DATABASE_URL="$TARGET_DB_URL"`:

```bash
DATABASE_URL="$TARGET_DB_URL" npx prisma migrate status
```

- `prisma migrate status` prints `PostgreSQL database "<name>"`. **Stop if the name is not the expected one** (section 1).
- Prod: the runbook says the live service's `DATABASE_URL` is the source of truth, not the local file. Verify before applying.
- Never paste or log the connection string.

## 3. Branch state (2026-10-12)

| From → to | Prisma migrations missing in target | Script files missing in target |
| --- | --- | --- |
| `DEV-NEW` → `SIT` | none | none pushed yet; local `DEV-NEW` adds `scripts/retire-stale-cart-rule-versions.ts` (PLAN-107, not pushed) |
| `SIT` → `UAT` | none | none |
| `UAT` → `Prod` | 6: `20260922090000_fix_promotion_utc_epoch_timestamps`, `20260924110000_normalize_optional_promotion_limits`, `20260927100000_normalize_standalone_coupon_policy`, `20261008090000_optimize_instore_search`, `20261008195500_fix_order_lifecycle_utc_timestamps`, `20261009120000_add_return_request_groupnumber` | 11, incl. `scripts/migrations/20261006_sync_authoritative_product_tax.sql`, `normalize-fragrance-type-dependencies.ts`, `repair-subcategory-parents.ts`, `audit-standalone-coupon-policy.ts`, `recount-platform-stock.ts`, picklist sync / restore |

Drift to fix:

- `scripts/migrations/20261006_sync_authoritative_product_tax.sql` exists **only on `UAT`**, not on `DEV-NEW` / `SIT`. Bring it back to `DEV-NEW` so a later `SIT` → `UAT` merge cannot drop it.
- The dev/SIT database has 4 migrations from `Flipkart-Integration` (`20260803000000_restore_product_remarks_and_name_limits`, `20260826090000_add_flipkart_integration_foundation`, `20260826130000_add_flipkart_order_operations`, `20260826170000_add_flipkart_order_stock_reservations`) that no release branch has. `prisma migrate status` on dev/SIT reports them as "not found locally". UAT / Prod need them only when that branch is released.
- 3 empty, untracked folders on this machine (`20260731000000_expand_product_remarks`, `20260924090000_make_promotion_budgets_unlimited`, `20260924100000_make_campaign_redemptions_unlimited`) show as "not yet applied" in `migrate status`. They are not in git; ignore or delete locally.

## 4. Tracker

### 4a. Prisma migrations (`prisma/migrations`)

Apply with `DATABASE_URL="$TARGET_DB_URL" npx prisma migrate deploy` after a backup. Rows with data changes need the row-count check before and after.

| Migration | Changes data? | Dev / SIT DB | UAT DB | Prod DB |
| --- | --- | --- | --- | --- |
| All migrations up to `20260904090000_add_promotions_v2_engine` | mixed | ✅ | ❓ verify with `migrate status` | ❓ verify |
| `20260922090000_fix_promotion_utc_epoch_timestamps` | yes (promotion dates −5:30) | ✅ | ❓ | ⬜ |
| `20260924110000_normalize_optional_promotion_limits` | yes (0 limits → NULL) | ✅ | ❓ | ⬜ |
| `20260927100000_normalize_standalone_coupon_policy` | yes (wallet coupon channel / stacking) | ✅ | ❓ | ⬜ |
| `20261008090000_optimize_instore_search` | no (pg_trgm + indexes) | ✅ | ❓ | ⬜ |
| `20261008195500_fix_order_lifecycle_utc_timestamps` | yes (triggers + one-time order date fix) | ✅ | ❓ | ⬜ |
| `20261009120000_add_return_request_groupnumber` | no (new column + index) | ✅ | ❓ | ⬜ |
| Flipkart-Integration (4, section 3) | yes | ✅ | ➖ until branch released | ➖ until branch released |

### 4b. SQL scripts (`scripts/migrations`)

Run with `psql` (or the Railway console) inside the file's own transaction. Validate counts after each environment (runbook section 6).

| Script | Purpose | Dev / SIT DB | UAT DB | Prod DB |
| --- | --- | --- | --- | --- |
| `20261006_sync_authoritative_product_tax.sql` | Product / mapping HSN and GST from the approved table. Expected: 77 products both set, 11 decor blank HSN + 18%, 1 peaceful_nights both blank (89 products) | ❓ | ❓ | ⬜ |
| `20260930_add_product_hsn_gst_backfill.sql` | Earlier HSN/GST backfill that enforces NOT NULL. The runbook names `20261006` as the source; treat this as superseded and do not run after `20261006` (confirm with the team) | ❓ | ➖ | ➖ |

### 4c. One-time data scripts (`scripts/*.ts`)

All default to a dry run. Save both outputs.

| Script | When | Dev / SIT DB | UAT DB | Prod DB |
| --- | --- | --- | --- | --- |
| `retire-stale-cart-rule-versions.ts` (PLAN-2026-10-12-107) | After the PLAN-107 backend is deployed. Retires leftover V2 rules on Free Shipping / cart promotions. Apply: `RETIRE_STALE_RULES_APPLY=true` | ✅ 2026-10-12 (0 found; #75 retired on save) | ⬜ | ⬜ |
| `normalize-fragrance-type-dependencies.ts` | Fragrance Type picklist dependencies → Subcategory. UAT/Prod: `--target-env=.env.uat --expected-db=assetmanagement_uat` (Prod: `.env.prod`, `railway`); apply adds `--apply --confirm=NIVAANA_NORMALIZE_FRAGRANCE_DEPENDENCIES` | ❓ | ⬜ | ⬜ |
| `repair-subcategory-parents.ts` | Subcategory parent links per taxonomy. Apply: `--apply --confirm=NIVAANA_REPAIR_SUBCATEGORY_PARENTS` | ❓ | ❓ | ⬜ |
| `audit-standalone-coupon-policy.ts` | Read-only check after `20260927100000_normalize_standalone_coupon_policy` | ❓ | ⬜ | ⬜ |
| `sync-sit-picklist-from-uat.ts` | SIT only: picklist + GST/HSN mappings from UAT | ✅ 2026-10-07 (log in `scripts/dryrun-logs/`) | ➖ | ➖ |
| `restore-sit-picklist-backup.ts` | SIT only, rollback of the sync above if ever needed | ➖ | ➖ | ➖ |

### 4d. Do not run as part of a release

| Script | Why |
| --- | --- |
| `recount-platform-stock.ts` | Applied to product 82 only (2026-10-07). Bulk apply is parked: dry run shows 101 differing rows to review first (Future_Plans.md, item 4). |
| `migrate-promotions-v2.ts` | Converts legacy promotions to V2 drafts. Not needed for current releases. If ever run, run `retire-stale-cart-rule-versions.ts` afterwards. |
| `external-sold-update.ts` | Manual stock operation; follow [manual-external-sold-update-checklist.md](manual-external-sold-update-checklist.md). |
| `import-production-product-catalogue.ts`, `migrate-gst-taxonomy.ts`, `migrate-product-names.ts`, `migrate-product-shortnames.ts`, `migrate-product-taxonomy.ts`, `backup-taxonomy-state.ts` | Jul–Aug 2026 migrations, already on the `Prod` branch. Historical. |
| `load-test-promotions-v2.ts`, `verify-amazon-inventory-handoff.ts`, `update-amazon-secrets.*`, `deploy-cloud-run-dev.sh` | Tools, not data changes. |

## 5. Per-environment run order

### SIT (merge `DEV-NEW` → `SIT`)

Dev and SIT share a database, so database steps done on dev are already done here.

- [ ] Compare branches: `git diff --stat origin/SIT origin/DEV-NEW -- prisma/migrations scripts`; every new file has a row in section 4
- [ ] `npx prisma migrate status` (dev `.env`): only the known Flipkart / empty-folder differences (section 3)
- [ ] Run any section 4 row marked ⬜ or ❓ for Dev / SIT DB; save logs
- [ ] Deploy SIT (runbook section 12), then smoke tests
- [ ] Update this file and Master.md

### UAT (merge `SIT` → `UAT`)

- [ ] Compare branches: `git diff --stat origin/UAT origin/SIT -- prisma/migrations scripts`; every new file has a row
- [ ] Backup / snapshot `assetmanagement_uat`
- [ ] `DATABASE_URL="$TARGET_DB_URL" npx prisma migrate status` with `.env.uat`; confirm DB name `assetmanagement_uat`; record which section 4a rows are applied
- [ ] `npx prisma migrate deploy` for pending migrations; re-run `migrate status`
- [ ] SQL scripts (4b) marked ⬜ / ❓ for UAT; validate HSN/GST counts
- [ ] Data scripts (4c) for UAT in table order: dry run, review, apply
- [ ] Deploy UAT (file upload → backend → inventory → ecom), smoke tests
- [ ] Update this file and Master.md

### Prod (merge `UAT` → `Prod`)

- [ ] Compare branches: `git diff --stat origin/Prod origin/UAT -- prisma/migrations scripts` (today: 6 migrations + scripts, section 3)
- [ ] Restorable backup of the Prod database; record current Cloud Run revisions
- [ ] Confirm the target DB from the deployed service (runbook section 2); `migrate status` shows `railway`
- [ ] Review row-impact of data migrations: `20260922090000`, `20260924110000`, `20260927100000`, `20261008195500`
- [ ] `npx prisma migrate deploy`; re-run `migrate status`
- [ ] `20261006_sync_authoritative_product_tax.sql`; validate HSN/GST counts
- [ ] Data scripts (4c) for Prod in table order: dry run, review, apply; `retire-stale-cart-rule-versions.ts` right after the PLAN-107 backend deploy
- [ ] Deploy Prod in runbook order, production smoke tests, monitor logs
- [ ] Update this file and Master.md

## 6. Adding a new script or migration

Add one row to the right table in section 4 with: file, purpose, apply flag / confirm word, expected result or counts, and `⬜` for every environment that needs it (`➖` where it does not). Note the Master.md fix ID in the purpose.
