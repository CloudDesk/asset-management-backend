# Release Scripts & Migrations Checklist

**Last updated:** 2026-10-14 · **Owner:** Suresh

One place for every database migration and one-time script that must run when code moves between environments. A branch merge is **not complete** until every row below that applies to the target environment is ticked for that environment.

> **Run database steps BEFORE deploying the backend.** The new backend reads the new columns as soon as it starts. Prod 2026-10-14: the backend was deployed before `20261006_sync_authoritative_product_tax.sql` ran, so `product.hsn_code` / `gst_rate` were missing and every Prisma product query failed (P2022) until the script ran (FIX-2026-10-14-114).

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

## 3. Branch state (2026-10-14)

| From → to | Prisma migrations missing in target | Script files missing in target |
| --- | --- | --- |
| `DEV-NEW` → `SIT` | none | none pushed yet; local `DEV-NEW` adds `scripts/retire-stale-cart-rule-versions.ts` (PLAN-107, not pushed) |
| `SIT` → `UAT` | none | none |
| `UAT` → `Prod` | none: merged and released 2026-10-14 (`Prod` = `5d2c605`) | none |

**Database state (checked 2026-10-14 from `_prisma_migrations`):** Prod has every migration up to `20261009120000`. **UAT has none after `20260908170000_add_invoice_seller_address`**: the 7 migrations in section 4a are not applied on `assetmanagement_uat` (no `return_requests.groupnumber`, no `pg_trgm`, `orders.vendor` still defaults to `'EKART'`), although the `UAT` backend code needs them. Run `migrate deploy` on UAT (section 5).

Drift to fix:

- `scripts/migrations/20261006_sync_authoritative_product_tax.sql` exists **only on `UAT`**, not on `DEV-NEW` / `SIT`. Bring it back to `DEV-NEW` so a later `SIT` → `UAT` merge cannot drop it.
- The dev/SIT database has 4 migrations from `Flipkart-Integration` (`20260803000000_restore_product_remarks_and_name_limits`, `20260826090000_add_flipkart_integration_foundation`, `20260826130000_add_flipkart_order_operations`, `20260826170000_add_flipkart_order_stock_reservations`) that no release branch has. `prisma migrate status` on dev/SIT reports them as "not found locally". UAT / Prod need them only when that branch is released.
- 3 empty, untracked folders on this machine (`20260731000000_expand_product_remarks`, `20260924090000_make_promotion_budgets_unlimited`, `20260924100000_make_campaign_redemptions_unlimited`) were **deleted 2026-10-14**: `migrate deploy` refuses to run while any migration folder has no `migration.sql` (P3015). If they reappear in another checkout, delete them before `migrate deploy`.

## 4. Tracker

### 4a. Prisma migrations (`prisma/migrations`)

Apply with `DATABASE_URL="$TARGET_DB_URL" npx prisma migrate deploy` after a backup. Rows with data changes need the row-count check before and after.

| Migration | Changes data? | Dev / SIT DB | UAT DB | Prod DB |
| --- | --- | --- | --- | --- |
| All migrations up to `20260908170000_add_invoice_seller_address` | mixed | ✅ | ✅ 2026-09-08 | ✅ 2026-09-08 |
| `20260909110000_remove_default_order_courier` | yes (drops `orders.vendor` default `'EKART'`; clears `EKART` on orders with no shipment data) | ✅ | ⬜ | ✅ 2026-10-14 |
| `20260922090000_fix_promotion_utc_epoch_timestamps` | yes (promotion dates −5:30) | ✅ | ⬜ | ✅ 2026-10-14 |
| `20260924110000_normalize_optional_promotion_limits` | yes (0 limits → NULL) | ✅ | ⬜ | ✅ 2026-10-14 |
| `20260927100000_normalize_standalone_coupon_policy` | yes (wallet coupon channel / stacking) | ✅ | ⬜ | ✅ 2026-10-14 |
| `20261008090000_optimize_instore_search` | no (pg_trgm + indexes) | ✅ | ⬜ | ✅ 2026-10-14 |
| `20261008195500_fix_order_lifecycle_utc_timestamps` | yes (triggers + one-time order date fix) | ✅ | ⬜ | ✅ 2026-10-14 |
| `20261009120000_add_return_request_groupnumber` | no (new column + index) | ✅ | ⬜ | ✅ 2026-10-14 |
| Flipkart-Integration (4, section 3) | yes | ✅ | ➖ until branch released | ➖ until branch released |

### 4b. SQL scripts (`scripts/migrations`)

**Runner (2026-10-22):** `npm run db:sql -- <sit|uat|prod>` shows which scripts are pending in that database (default `sit`, status only). Add `--apply` to run the pending ones in date order; Prod also needs `--confirm=NIVAANA_PROD_SQL` (backup first). It stops if the connected database is not the expected one (sit → `assetmanagement_dev`, uat → `assetmanagement_uat`, prod → `railway`) and records each run in `release_ops.sql_script_log` (own schema, so Prisma never sees it), so a script never runs twice. A script run by hand earlier: `npm run db:sql -- <env> --mark-applied=<file>`. Superseded scripts are in `scripts/migrations/superseded/` and are never picked up.

Manual alternative: run with `psql` (or the Railway console) inside the file's own transaction. Without `psql`: `DATABASE_URL="$TARGET_DB_URL" npx prisma db execute --file scripts/migrations/<file>.sql --schema prisma/schema.prisma` (prints only "Script executed successfully"; run the count query separately). Validate counts after each environment (runbook section 6). **Run before the backend deploy.**

| Script | Purpose | Dev / SIT DB | UAT DB | Prod DB |
| --- | --- | --- | --- | --- |
| `20261006_sync_authoritative_product_tax.sql` | Product / mapping HSN and GST from the approved table. Expected: 77 products both set, 11 decor blank HSN + 18%, 1 peaceful_nights both blank (89 products). Creates `product.hsn_code` / `gst_rate` if missing: **the backend fails on every product query without them** | ❓ | ✅ columns present (90 products: 78 HSN, 89 GST on 2026-10-14) | ✅ 2026-10-14 (89 products: 77 HSN, 88 GST; ran after the backend deploy, see top note) |
| `20261022_add_product_asin.sql` | Amazon gap D4 / AMZ-PLAN-17: adds nullable `product.asin` VARCHAR(20) + index `product_asin_idx`. No data change (every product starts NULL). Idempotent. Run before the backend that has `asin` in the Prisma schema, or every product query fails. Verify: column + index queries at the end of the file, `products_with_asin = 0`. Code: FIX-140 | ✅ 2026-10-22 (`db:sql`) | ⬜ | ⬜ (backup first) |
| `20261026_add_amazon_ship_now_fields.sql` | AMZ-PLAN-25 Ship now: 9 nullable columns on `amazon_order_fulfillments` (`shippingProvider`, `providerOrderId`, `publicTrackingLink`, `deliveryStatus`, `deliveryStatusSource`, `deliveryProviderStatus`, `deliveryUpdatedAt`, `deliveredAt`, `deliveryNextSyncAt`) + index `amazon_order_fulfillment_tracking_idx`. No data change, no address stored. Idempotent. Run before the backend that has these fields in the Prisma schema, or every Amazon order query fails. Verify: queries at the end of the file, `with_provider = 0`. Code: FIX-162 | ✅ 2026-10-26 (`db:sql`; 9 columns + index, 531 rows, `with_provider = 0`) | ✅ 2026-10-27 (run by the user before the UAT deploy; UAT order sync reads and writes `amazon_order_fulfillments` without errors) | ⬜ (backup first) |
| `20261027_amazon_combo_stock_reservations.sql` | AMZ-PLAN-27 Amazon combo listings: adds nullable `amazon_order_stock_reservations."comboProductId"` (FK `product`, ON DELETE SET NULL) and changes the unique key `(orderId, amazonOrderItemId)` → `(orderId, amazonOrderItemId, productId)` so a combo order item holds one reservation per component. No data change (existing rows: one per item, `comboProductId` NULL). Idempotent. **Run before the backend that has `comboProductId` in the Prisma schema**, or every Amazon order query fails. Verify: queries at the end of the file, `with_combo = 0`. Code: FIX-2026-10-27-168 | ✅ 2026-10-27 (`db:sql`; column bigint nullable, FK, new unique index only, 1 row, `with_combo = 0`) | ⬜ | ⬜ (backup first) |
| `superseded/20260930_add_product_hsn_gst_backfill.sql` | Earlier HSN/GST backfill that enforces NOT NULL. Moved to `superseded/` 2026-10-22 so `db:sql` skips it. The runbook names `20261006` as the source; treat this as superseded and do not run after `20261006` (confirm with the team) | ❓ | ➖ | ➖ |

### 4c. One-time data scripts (`scripts/*.ts`)

All default to a dry run. Save both outputs.

| Script | When | Dev / SIT DB | UAT DB | Prod DB |
| --- | --- | --- | --- | --- |
| `move-amazon-mappings.ts` (FIX-2026-10-22-144, `npm run amazon:mappings`) | Only when mappings made in one database should reach another (usually UAT → Prod, after Prod has refreshed Amazon listings). `export <src>` (read-only, JSON in `scripts/dryrun-logs/`), `import <dst> --file=…` dry run, then `--apply --confirm=NIVAANA_AMAZON_MAPPINGS` (`--remap` to replace different mappings). Sync mode is never copied | ➖ | ➖ | ⬜ when needed |
| `create-amazon-combos.ts` (FIX-2026-10-27-169, `npm run amazon:combos`) | AMZ-PLAN-27 P5: creates the Inventory combos that Amazon combo listings need, from the reviewed CSV `docs/Amazon/Amazon_Listings_vs_Inventory_UAT_2026-10-27.csv` (groups 3 and 4), through `ProductService.create` (same validation, naming, PUC, bundle map, duplicate check as the product form; **Amazon stock row only**, FIX-171, so the combos are not on the Nivaana website). Combos can also be made one by one in the mapping dialog ("Map as combo"). Dry run by default (`npm run amazon:combos -- <env>`, log in `scripts/dryrun-logs/`); apply `--apply --confirm=NIVAANA_AMAZON_COMBOS`. Needs FIX-168 + its SQL on that database first, and the business review of the CSV (incense 30-stick vs 10-stick). Skips combos that exist, mixed brand / subcategory, different HSN / GST, missing components. Mapping the listings is a separate step | ⬜ | ⬜ dry run 2026-10-27: 95 to create, 1 exists (`AUO-0098`), 1 skipped (collections 6-pack) | ⬜ (backup first) |
| `retire-stale-cart-rule-versions.ts` (PLAN-2026-10-12-107) | After the PLAN-107 backend is deployed. Retires leftover V2 rules on Free Shipping / cart promotions. Apply: `RETIRE_STALE_RULES_APPLY=true` | ✅ 2026-10-12 (0 found; #75 retired on save) | ✅ 2026-10-13 dry run: 0 found, nothing to apply | ✅ 2026-10-14 dry run: 0 found, nothing to apply |
| `normalize-fragrance-type-dependencies.ts` | Fragrance Type picklist dependencies → Subcategory. UAT/Prod: `--target-env=.env.uat --expected-db=assetmanagement_uat` (Prod: `.env.prod`, `railway`); apply adds `--apply --confirm=NIVAANA_NORMALIZE_FRAGRANCE_DEPENDENCIES` | ❓ | ⬜ | ✅ 2026-10-14: 22 of 33 rows moved from Subsubcategory to Subcategory; backup `docs/backups/FRAGRANCE_DEPENDENCY_BACKUP_railway_2026-10-14T05-34-16-511Z.json` (local) |
| `repair-subcategory-parents.ts` | Subcategory parent links per taxonomy. Apply: `--apply --confirm=NIVAANA_REPAIR_SUBCATEGORY_PARENTS`. Reads `.env` (set `DATABASE_URL`). Its taxonomy expects the SIT-only test value `candle&candle`, so it stops with "Required active subcategories are missing" anywhere else | ❓ | ➖ same state as Prod | ➖ 2026-10-14: stops on `candle&candle`; all 27 subcategories already have the right parent (only `controlled*` fields empty, same as UAT). Not needed |
| `audit-standalone-coupon-policy.ts` | Read-only check after `20260927100000_normalize_standalone_coupon_policy` | ❓ | ⬜ | ✅ 2026-10-14: 3 assignments, 0 non-compliant |
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

### 4e. Environment config changes (`.env.sit` / `.env.uat` / Prod trigger)

Settings that must change in an environment file when code moves there. SIT and UAT read `.env.sit` / `.env.uat` from their own branch at deploy time; Prod reads Cloud Build trigger substitutions (runbook section 3).

| Change | Why | SIT (`.env.sit` on `SIT`) | UAT (`.env.uat` on `UAT`) | Prod (trigger `nivaana-production`) |
| --- | --- | --- | --- | --- |
| **Shipmozo on** (FIX-2026-10-13-113): `SHIPMOZO_INTEGRATION_ENABLED: "true"`, `SHIPMOZO_TRACKING_SYNC_ENABLED: "true"` | From Inventory commit `b401efd` the Inventory shows Shipmozo in **every** environment. Where the backend switch is `"false"` the Shipmozo routes are not loaded, so Create Shipment → Shipmozo fails. Shipmozo keys are shared with the live account: shipments created in SIT / UAT book real pickups; use test orders and cancel them. | ✅ 2026-10-13 (committed on `SIT` with the `DEV-NEW` merge) | ⬜ **Set in the same `SIT` → `UAT` merge, before pushing `UAT`** | ✅ already `"true"`; verify `_SHIPMOZO_PUBLIC_KEY`, `_SHIPMOZO_PRIVATE_KEY`, `_SHIPMOZO_WAREHOUSE_ID` are filled in the trigger |
| Optional: `SHIPMOZO_WEBHOOK_SECRET` (16+ characters) | Shipmozo push status updates. Without it the webhook is refused and only the 15-minute sync updates status. | ➖ not set | ➖ not set | ❓ verify trigger value |
| Optional: `SHIPMOZO_WAREHOUSE_ID` | Default pickup warehouse. Empty: the shipment form loads the warehouse list from Shipmozo. | ➖ not set | ➖ not set | ❓ verify trigger value |
| **Shipmozo auto-sync via Cloud Scheduler** (FIX-2026-10-20-120): `SHIPMOZO_SCHEDULER_SECRET: "<random, 16+ characters>"` (generate with `openssl rand -hex 24`; a different value per environment) | The scheduler endpoint `POST /v1/shipmozo/jobs/tracking-sync` checks the `x-scheduler-secret` header against it; without it the endpoint answers 503. Decided 2026-10-20: keep it in `.env.sit` like the other SIT settings (no Secret Manager). The Cloud Scheduler job header must carry the same value. | ⬜ add to `.env.sit` on `SIT` with the FIX-120 merge | ⬜ add to `.env.uat` with the `SIT` → `UAT` merge (new value; `cloudbuilduat.yaml` reads `.env.uat`, no YAML change) | ✅ `cloudbuildprod.yaml` maps `_SHIPMOZO_SCHEDULER_SECRET` (2026-10-20, empty value skipped, under 16 characters stops the build); ⬜ set `SHIPMOZO_SCHEDULER_SECRET` on trigger `nivaana-production` before the next Prod deploy |
| **Cloud Scheduler job** `shipmozo-tracking-sync-<env>` (FIX-120): `POST <service-url>/v1/shipmozo/jobs/tracking-sync`, header `x-scheduler-secret: <secret>`, schedule `*/15 * * * *`, time zone `Asia/Kolkata`, region `asia-south1` | Replaces the in-process node-cron, which does not run reliably on Cloud Run (CPU throttled / scaled to zero). First 3 jobs per billing account are free. | ✅ 2026-10-20 created `shipmozo-tracking-sync-sit` (URL `https://nivaana-dev-715569764663.asia-south1.run.app/...`); succeeds once FIX-120 is deployed | ⬜ create after the UAT deploy (URL `https://nivaana-uat-715569764663.asia-south1.run.app/...`) | ⬜ create **paused** (URL `https://nivaana-715569764663.asia-south1.run.app/...`); resume only when Shipmozo is live in Prod |
| **In-process cron off** (FIX-120): `SHIPMOZO_TRACKING_SYNC_ENABLED: "false"` | Avoids double runs once the Cloud Scheduler job is live. Optional `SHIPMOZO_TRACKING_RECHECK_MINUTES` (default 10; keep it below the scheduler interval). | ⬜ set in `.env.sit` on `SIT` with the merge | ➖ decided 2026-10-20: keep `"true"` on UAT for now (set it in `.env.uat` on `UAT`; it is `"false"` there today), alongside the Cloud Scheduler job | ✅ `cloudbuildprod.yaml` default `_SHIPMOZO_TRACKING_SYNC_ENABLED: "false"` (2026-10-20); check the trigger does not override it |
| ~~**Inventory: Shipmozo hidden in Prod** (FIX-2026-10-14-115)~~ **Superseded 2026-10-21 by FIX-121: Shipmozo shown in Prod** (`Prod` `f6eb718`, same file as `DEV-NEW`; deploy with `npm run deploy:prod`) | Shipmozo REST API is not active on the account (FIX-113), so every Shipmozo call fails. Inventory `Prod` branch `src/config/integrationFeatures.ts` hides Shipmozo when `VITE_APP_ENV` / mode is `prod`. `DEV-NEW` still has `shipmozo: true`: **keep the Prod check in the next `UAT` → `Prod` Inventory merge** until Shipmozo is active. | ➖ | ➖ | ✅ 2026-10-14 (deploy with `npm run deploy:prod`) |
| **Amazon auto-sync via Cloud Scheduler** (FIX-2026-10-21-124): `AMAZON_SCHEDULER_SECRET: "<random, 16+ characters>"` (generate with `openssl rand -hex 24`; a different value per environment) | The job endpoints `POST /api/channels/amazon/jobs/order-sync`, `/listing-sync`, `/retry-queue` check the `x-scheduler-secret` header against it; without it they answer 503. Only loaded where `AMAZON_INTEGRATION_ENABLED: "true"`. Needs working Amazon credentials (see the `invalid_client` note in Master.md FIX-124) or every run records a FAILED order import job. | ✅ 2026-10-23 in `.env.sit` on `DEV-NEW` with `AMAZON_INTEGRATION_ENABLED: "true"` and `AMAZON_LISTING_IMPORT_ENABLED: "true"`; writes stay off. Credentials (client ID, client secret, refresh token) also in `.env.sit` (decided 2026-10-23, like other SIT settings); `cloudbuildsit.yaml` uses `--clear-secrets` instead of `--set-secrets` | ✅ 2026-10-27 committed on `UAT` (`4a472e9`, not pushed): see "UAT Amazon credentials" row | ⬜ add `_AMAZON_SCHEDULER_SECRET` to `cloudbuildprod.yaml` and the trigger when Amazon goes live |
| **Cloud Scheduler jobs** (FIX-124): `amazon-order-sync-<env>` → `POST <service-url>/api/channels/amazon/jobs/order-sync` (`*/15 * * * *`); optional `amazon-listing-sync-<env>` → `/listing-sync` (`0 */6 * * *`, only does work with `AMAZON_LISTING_IMPORT_ENABLED: "true"`); optional `amazon-retry-queue-<env>` → `/retry-queue` (`*/5 * * * *`); optional `amazon-return-sync-<env>` → `/return-sync` (`*/30 * * * *`, FIX-143). Header `x-scheduler-secret: <secret>`, time zone `Asia/Kolkata`, region `asia-south1`, **attempt deadline 10 min** | The endpoints wait for the import to finish (Cloud Run throttles CPU after the response, so background work is unreliable). Keep the Cloud Run request timeout above the attempt deadline (SIT: `--timeout 900` in `cloudbuildsit.yaml`, 2026-10-23; UAT / Prod: set the same before creating their jobs). Returns: `/return-sync` does one quick step per call (request or collect the report), so it fits the timeout; then `AMAZON_RETURN_AUTO_SYNC_ENABLED` stays `"false"`. First 3 Scheduler jobs per billing account are free (Shipmozo uses one per environment). | ⬜ | ✅ 2026-10-27 `amazon-order-sync-uat` (`0 * * * *`) and `amazon-listing-sync-uat` (`0 */6 * * *`), Asia/Kolkata, deadline 600 s, header = `AMAZON_SCHEDULER_SECRET` from `.env.uat`; test runs OK (order sync 200 in 56 s; listing sync checked by the user) | ⬜ create **paused**; resume when Amazon is live |
| **In-process Amazon cron off** (FIX-124): `AMAZON_ORDER_AUTO_SYNC_ENABLED: "false"`, `AMAZON_LISTING_AUTO_SYNC_ENABLED: "false"`, `AMAZON_RETRY_WORKER_ENABLED: "false"` | Avoids double runs once the Cloud Scheduler jobs are live. The node-cron code stays behind these switches. **Local `.env` has `AMAZON_ORDER_AUTO_SYNC_ENABLED="true"`**: every developer laptop running the backend against the shared dev DB runs the 15-minute order sync; set it to `"false"` locally. | ✅ already `"false"` | ✅ already `"false"` | ⬜ check `cloudbuildprod.yaml` / trigger |
| **SIT Amazon writes ON** (2026-10-26, user decision): `.env.sit` `AMAZON_ENVIRONMENT: "PRODUCTION"`, `AMAZON_PRODUCTION_WRITES_ENABLED: "true"` (`AMAZON_AUTO_SYNC_ENABLED` stays `"false"`) | SIT can send to the **live** Amazon account from the shared dev database: Sync stock now, Ship now / confirm shipment (also for real orders copied into the dev DB), Easy Ship schedule, price / listing edits and publishing. Only manual clicks send; order sync never pushes stock by itself. Quick stop without a deploy: Amazon Operations → pause production writes; to switch off, set both back (`"SANDBOX"`, `"false"`) on `SIT` and redeploy. Committed on the `SIT` branch only (`123f32a`, not pushed) — `DEV-NEW` keeps `"SANDBOX"` / `"false"`, so a later DEV-NEW → SIT merge does not change it. | ✅ committed on `SIT` 2026-10-26; live after push + SIT deploy | ➖ unchanged (off) | ➖ (Prod already `PRODUCTION`) |
| **UAT Amazon credentials from Secret Manager** (2026-10-27): `cloudbuilduat.yaml` adds `--timeout 900` and `--set-secrets AMAZON_CLIENT_ID=nivaana-uat-amazon-client-id:latest,AMAZON_CLIENT_SECRET=nivaana-uat-amazon-client-secret:latest,AMAZON_REFRESH_TOKEN=nivaana-uat-amazon-refresh-token:latest`; `.env.uat` sets `AMAZON_INTEGRATION_ENABLED: "true"`, `AMAZON_LISTING_IMPORT_ENABLED: "true"` and a new `AMAZON_SCHEDULER_SECRET` (writes stay off: `"SANDBOX"` / `"false"`); new `config/amazon-secrets.uat.json` (service `nivaana-uat`, service account `nivaana-uat@nivaana.iam.gserviceaccount.com`) | UAT had Amazon off, no credentials and no secret wiring (only `nivaana-sit-amazon-*` exist in Secret Manager). Credentials never go in `.env.uat` (GitHub push protection). **The three secrets must exist before the UAT deploy, or `gcloud run deploy` fails**: `node scripts/update-amazon-secrets.mjs --config config/amazon-secrets.uat.json --from-env .env --dry-run`, then again with `--confirm-target nivaana/nivaana-uat` (creates the secrets, adds the version, grants `secretAccessor` to `nivaana-uat@`). Also run the pending Amazon SQL on `assetmanagement_uat` (`npm run db:sql -- uat`, then `--apply`; incl. `20261026_add_amazon_ship_now_fields.sql`). After deploy: Inventory → Channels → Amazon shows connected; Cloud Scheduler jobs optional (row above). | ➖ | ✅ 2026-10-27: committed on `UAT` (`4a472e9`), 3 secrets created, SQL run, pushed + deployed, Amazon connected; scheduler jobs created and tested (row above) | ➖ |
| **Amazon env trim** (AMZ-PLAN-22, 2026-10-22): removed `AMAZON_REGION` and the five `AMAZON_SANDBOX_*` lines (`CREDENTIAL_SOURCE`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`, `SP_API_BASE_URL`) | `AMAZON_REGION` is never read by the code; the sandbox panel was removed from the Inventory and sandbox has no real data. Defaults in `env.ts` apply, so behaviour is unchanged. The sandbox client secret and refresh token were committed in these files: **rotate that app's secret or delete the app in Seller Central** (git history keeps the old values). Reference: `docs/Amazon/amazon.env.example`. | ✅ removed from `.env.sit` on `DEV-NEW` (carry to `SIT` with the merge) | ✅ removed from `.env.uat` on `DEV-NEW` (carry to `UAT` with the merge) | ✅ `cloudbuildprod.yaml` no longer maps `_AMAZON_REGION` (3 lines) and `.env.prod` drops it; delete `_AMAZON_REGION` from trigger `nivaana-production` (optional, unused) |
| **Inventory: Amazon shown except SIT** (FIX-2026-10-13-108, branch `feature/amazon-ui-port`) | Once merged, Inventory `integrationFeatures.amazon = !isSitEnvironment` shows the full Amazon UI (sidebar, Orders tab, workspace) on **UAT and Prod** builds. Without the backend Amazon settings the pages show "not connected" / errors. Before the `SIT` → `UAT` and `UAT` → `Prod` Inventory merges, either set `AMAZON_SP_API_APP_ID`, `AMAZON_REDIRECT_URI` (`<inventory-host>/amazon/callback`), `AMAZON_TOKEN_ENCRYPTION_KEY` (64 hex), `AMAZON_SELLER_ID`, `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_ENVIRONMENT`, or hide Amazon on that branch (as done for Shipmozo in Prod). Sync / write switches stay `false` until decided. | ➖ hidden on SIT | ⬜ decide: set Amazon env or hide | ⬜ decide: set Amazon env or hide |

## 5. Per-environment run order

### SIT (merge `DEV-NEW` → `SIT`)

Dev and SIT share a database, so database steps done on dev are already done here.

- [ ] Section 4e: environment config changes for SIT are in `.env.sit` on `SIT`
- [ ] Compare branches: `git diff --stat origin/SIT origin/DEV-NEW -- prisma/migrations scripts`; every new file has a row in section 4
- [ ] `npx prisma migrate status` (dev `.env`): only the known Flipkart / empty-folder differences (section 3)
- [ ] Run any section 4 row marked ⬜ or ❓ for Dev / SIT DB; save logs (4b: `npm run db:sql -- sit`, then `--apply`)
- [ ] Deploy SIT (runbook section 12), then smoke tests
- [ ] Update this file and Master.md

### UAT (merge `SIT` → `UAT`)

- [ ] **Section 4e: in this merge set `.env.uat` `SHIPMOZO_INTEGRATION_ENABLED: "true"` and `SHIPMOZO_TRACKING_SYNC_ENABLED: "true"` before pushing `UAT`** (the UAT Inventory shows Shipmozo from this release; with the switch off it fails)
- [ ] Compare branches: `git diff --stat origin/UAT origin/SIT -- prisma/migrations scripts`; every new file has a row
- [ ] **2026-10-14: UAT DB is missing the 7 migrations after `20260908170000` (section 3); apply them now, do not wait for the next merge**
- [ ] Backup / snapshot `assetmanagement_uat`
- [ ] `DATABASE_URL="$TARGET_DB_URL" npx prisma migrate status` with `.env.uat`; confirm DB name `assetmanagement_uat`; record which section 4a rows are applied
- [ ] `npx prisma migrate deploy` for pending migrations; re-run `migrate status`
- [ ] SQL scripts (4b): `npm run db:sql -- uat`, then `--apply`; run each file's verification queries
- [ ] Data scripts (4c) for UAT in table order: dry run, review, apply
- [ ] Deploy UAT (file upload → backend → inventory → ecom), smoke tests
- [ ] Update this file and Master.md

### Prod (merge `UAT` → `Prod`)

Released 2026-10-14 (all database rows in section 4 done for Prod). Next time keep this order: **every database step before the backend deploy.**

- [ ] Compare branches: `git diff --stat origin/Prod origin/UAT -- prisma/migrations scripts`; every new file has a row
- [ ] Delete empty migration folders (no `migration.sql`) or `migrate deploy` fails with P3015
- [ ] Restorable backup of the Prod database; record current Cloud Run revisions
- [ ] Section 4e: Prod trigger substitutions for each config row (Shipmozo keys, warehouse, webhook secret)
- [ ] Confirm the target DB from the deployed service (runbook section 2); `migrate status` shows `railway`
- [ ] Review row-impact of data migrations: `20260922090000`, `20260924110000`, `20260927100000`, `20261008195500`
- [ ] `npx prisma migrate deploy`; re-run `migrate status`
- [ ] SQL scripts (4b): `npm run db:sql -- prod`, then `--apply --confirm=NIVAANA_PROD_SQL` (after the backup); run each file's verification queries
- [ ] Check nothing is missing: `npx prisma migrate diff --from-url "$TARGET_DB_URL" --to-schema-datamodel prisma/schema.prisma --script | grep -E 'CREATE TABLE|ADD COLUMN'` (known old drift only: `quotes`, `picklist_backup`)
- [ ] Data scripts (4c) for Prod in table order: dry run, review, apply; `retire-stale-cart-rule-versions.ts` right after the PLAN-107 backend deploy
- [ ] PLAN-107: list active promotions of old type `PERCENT_OFF_ITEM` / `FIXED_AMOUNT_OFF_ITEM` with no product / category / subcategory scope and no published V2 rule (whole-cart offers such as FESTIVE SALE). Change each in admin to "Percent of entire cart value" / "Fixed amount of entire cart value" and re-enter the value. UAT 2026-10-13: #1 FESTIVE SALE was `PERCENT_OFF_ITEM` and applied 10% to the whole cart until changed.
- [ ] Deploy Prod in runbook order, production smoke tests, monitor logs
- [ ] Update this file and Master.md

## 6. Adding a new script or migration

Add one row to the right table in section 4 with: file, purpose, apply flag / confirm word, expected result or counts, and `⬜` for every environment that needs it (`➖` where it does not). Note the Master.md fix ID in the purpose.
