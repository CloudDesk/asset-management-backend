# Amazon Integration — Master File

One place for everything Amazon (SP-API) in Nivaana: how it works, where it is switched on, what broke, what changed, and what is planned.

**How to use this file**
- Every Amazon fix gets an entry in section 8 here **and** the usual entry in `docs/Fix_After_Sep30/Master.md` (same FIX number).
- Every Amazon env / script / Cloud Scheduler change also gets a row in `docs/RELEASE_SCRIPTS_CHECKLIST.md` section 4e.
- Amazon plans live in section 9 here as `AMZ-PLAN-xx` (not in `docs/Future_Plans.md`).
- Last updated: 2026-10-23. Full gap list: section 10. **Deploying Amazon to SIT / UAT / Prod: section 4a.**
- Order fulfilment flow (FBA / Easy Ship / Self Ship), what exists, gaps and plan: [`Amazon_Order_Fulfillment.md`](Amazon_Order_Fulfillment.md) (AMZ-PLAN-25).

---

## 1. Current status (updated 2026-10-23)

**Full before → after record of the 21–22 Oct work (FIX-124 – FIX-158), decisions, commits and open items: [Amazon_Changes_2026-10.md](Amazon_Changes_2026-10.md).**

| Item | Local / dev DB (shared with SIT) | SIT | UAT | Prod |
| --- | --- | --- | --- | --- |
| Amazon credentials | **working** (new LWA secret + refresh token in `.env`, FIX-130) | old Secret Manager versions (14 Aug) — update with `update-amazon-secrets.mjs` (4a.3) | old GCP secret | old GCP secret |
| Backend Amazon routes (`AMAZON_INTEGRATION_ENABLED`) | on (default) | on in `.env.sit` (2026-10-23, not deployed yet) | off (`.env.uat`) | on |
| Inventory Amazon UI (`integrationFeatures.amazon = !isSitEnvironment`) | shown | hidden | shown | shown |
| Writes (`AMAZON_ENVIRONMENT` + `AMAZON_PRODUCTION_WRITES_ENABLED`) | off (set back 2026-10-23) | off | off | `PRODUCTION` |
| Order auto-sync (node-cron, `AMAZON_ORDER_AUTO_SYNC_ENABLED`) | off (2026-10-23) | off | off | — |
| Cloud Scheduler jobs | — | none yet (secret in `.env.sit`, `--timeout 900`; create after deploy, 4a.3) | none | none |
| ASIN column (`20261022_add_product_asin.sql`) | applied | applied (same DB) | ⬜ | ⬜ |

**Data on the dev DB (`assetmanagement_dev`, 22 Oct):** 172 listings (171 priced + 1 incomplete), 1 mapped (KRA-0049); 518 real Amazon orders (235 without items from the July import — fix with Activity → Import all orders again) + 3 test orders. First live stock send 22 Oct 16:28 IST (KRAFT-PARROTPAIR-HOMEDECOR 29 → 5, applied by Amazon).

---

## 1a. Environments and Amazon (one live Amazon account, four databases)

| Environment | Database | Data | Amazon reads (import listings / orders) | Amazon writes (stock, price, shipment) | Scheduled order sync |
| --- | --- | --- | --- | --- | --- |
| Local | `assetmanagement_dev` | Test data | Manual only (Refresh) | **Never** | **Off** (`AMAZON_ORDER_AUTO_SYNC_ENABLED="false"`) |
| SIT | `assetmanagement_dev` (**same as local**) | Test data | Yes | **Never** | Cloud Scheduler, hourly (one runner per DB) |
| UAT | `assetmanagement_uat` | Prod-like copy | Yes — best place to try mapping and stock previews with realistic stock | **One controlled single-listing test only** (below); otherwise never | Cloud Scheduler (optional) |
| Prod | `railway` | Live | Yes | Yes, after the go-live checklist (5a) | Cloud Scheduler, every 15 min |

Rules that follow:
- **Writes only from Prod.** Every environment talks to the same live Seller Central account. If UAT (or SIT) also published stock, two systems would overwrite each other's numbers on the same Amazon listings; UAT stock also drifts from Prod after the copy. Keep `AMAZON_PRODUCTION_WRITES_ENABLED="false"` and `AMAZON_ENVIRONMENT` ≠ `PRODUCTION` everywhere except Prod.
- **UAT single-listing write test (allowed once, before Prod go-live):** proves the write path (token, SP-API role, `patchListingsItem`, submission status) without touching other listings. Steps: (1) credentials fixed, `AMAZON_INTEGRATION_ENABLED: "true"` on UAT, listings imported; (2) pick **one** FBM listing, map it, pack size 1; (3) set the UAT "amazon" platform stock of that product to the quantity Amazon **already shows** (so the published number does not change what customers see); (4) temporarily `AMAZON_ENVIRONMENT: PRODUCTION` + `AMAZON_PRODUCTION_WRITES_ENABLED: "true"`, keep `AMAZON_AUTO_SYNC_ENABLED: "false"`; (5) listing mode **Manual**, preview, Sync stock now, check Seller Central and the sync history; (6) set the listing back to Off and the two write switches back to SANDBOX / false the same day. Never Automatic on UAT.
- **Local and SIT share one database:** only one of them may run the scheduled order sync (SIT via Cloud Scheduler). Listings imported or mapped on local appear on SIT and the other way round.
- **Each database keeps its own copy** of listings, orders and **mappings**. Mapping done on local / SIT / UAT does **not** reach Prod. The 172 mappings must be done on Prod (or exported and imported — AMZ-PLAN-23); mapping elsewhere is practice / testing.
- Orders imported into dev / UAT are copies of real orders: view only, never fulfil them there (shipment confirmation is a write and is blocked by the locks above).
- Credentials are the same set everywhere (one app, one seller); rotating the secret means updating local `.env` and the GCP secrets of SIT, UAT and Prod together.

## 2. How it fits together

### 2.1 Credentials: which Amazon account is used
`src/services/amazon-listing-scope.service.ts` → `resolve(userId)`:
1. The logged-in user has a row in `amazonConnection` (created by **Authorize Seller Account** → Amazon OAuth) → that user's encrypted refresh token is used (`source: OAUTH`).
2. Otherwise → the shared account from `.env` (`AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_REFRESH_TOKEN`, `AMAZON_SELLER_ID`) (`source: ENVIRONMENT_FALLBACK`).

Today nobody has authorized, so everything runs on the `.env` account ("Using server credentials" in the UI). An OAuth connection is **per user**: a user who authorizes a different seller account sees that account's listings and orders, everyone else keeps the server account.

Access tokens: `src/services/amazon-lwa-token.service.ts` exchanges the refresh token at `https://api.amazon.com/auth/o2/token` (LWA). Errors there are reported as `Amazon rejected the configured credentials … (invalid_client / invalid_grant: …)`; builds before commit `671f808` (2026-10-14) reported every failure as "Amazon authorization is invalid or has expired".

### 2.2 Backend routes (all loaded only when `AMAZON_INTEGRATION_ENABLED` is true)
| Prefix | File | What |
| --- | --- | --- |
| `/v1/amazon` | `amazon.route.ts` | OAuth initiate / connection / initialize / disconnect; sandbox inventory |
| `/api/channels/amazon` | `amazon-channel.route.ts` | status; listings import, list, map / unmap, offer and listing edit preview / apply, inventory preview / sync / history; orders import, jobs, list, fulfillment (pick, pack, shipping, documents, tracking, ship and confirm, Easy Ship slots / schedule), exceptions retry / resolve; returns import / list / receive; order notification ingest |
| `/api/channels/amazon` | `amazon-listing-publish.route.ts` | publish drafts (catalog search, product type, eligibility, validation, submit, images) |
| `/api/channels/amazon/operations` | `amazon-operations.route.ts` | dashboard (Activity tab), activity, failures, write pause / resume, retries, notifications configure / refresh, export |
| `/api/channels/amazon/jobs` | `amazon-scheduler-jobs.route.ts` | **Cloud Scheduler jobs** (FIX-124, FIX-143): `order-sync`, `listing-sync`, `retry-queue`, `return-sync`; header `x-scheduler-secret` |

`/api/channels/amazon/*` is outside the `/v1` smart-auth scope: every route sets its own `preHandler` (login + channel permission), except the scheduler jobs (secret header) and order notification ingest (`x-amazon-notification-secret`).

### 2.3 Scheduled work
| Work | node-cron (in the backend process) | Switch | Cloud Scheduler endpoint (FIX-124) |
| --- | --- | --- | --- |
| Order import | `amazon-order-scheduler.service.ts`, `AMAZON_ORDER_SYNC_CRON` (`*/15 * * * *`); also runs once at backend start | `AMAZON_ORDER_AUTO_SYNC_ENABLED` | `POST /api/channels/amazon/jobs/order-sync` (waits for the result) |
| Listing import | `amazon-listing-scheduler.service.ts`, `AMAZON_LISTING_SYNC_CRON` (`0 */6 * * *`) | `AMAZON_LISTING_AUTO_SYNC_ENABLED` + `AMAZON_LISTING_IMPORT_ENABLED` | `POST …/jobs/listing-sync` |
| Retry queue | `amazon-retry-scheduler.service.ts`, `AMAZON_RETRY_WORKER_CRON` (`*/5 * * * *`) | `AMAZON_RETRY_WORKER_ENABLED` | `POST …/jobs/retry-queue` |
| Returns import (Reports API) | `amazon-return-scheduler.service.ts`, `AMAZON_RETURN_SYNC_CRON` (`30 2 * * *`) | `AMAZON_RETURN_AUTO_SYNC_ENABLED` | none yet (AMZ-PLAN-05) |

node-cron runs wherever a backend process runs with the switch on. Because local `.env` has order sync on and points at the shared dev DB, **every developer laptop running the backend runs the 15-minute order sync** (visible as SCHEDULED jobs at odd times right after a restart, and gaps when no laptop is running).

### 2.4 Main tables
`amazonConnection` (OAuth tokens), `marketplaceListing` + `marketplaceListingAudit` (listings, mapping), `channelSyncLog` (listing imports), `amazonOrderImportJob`, `amazonMarketplaceOrder`, `amazonOrderNotification`, `amazonOrderFulfillmentException`, `amazonInventorySyncAttempt`, `amazonRetryJob`, `amazonReturnImportJob`, `amazonOperationsSetting` (emergency pause), `amazonOperationsAudit`. 19 Amazon migrations in `prisma/migrations`.

### 2.5 Inventory (frontend) pages
| Page | File | Notes |
| --- | --- | --- |
| Channels | `src/pages/channels/ChannelsPage.tsx` | Accordion rows: Amazon (`AmazonChannelSummary.tsx`), Flipkart, Ekart, Shipmozo |
| Amazon Operations `/channels/amazon` | `src/pages/amazon/AmazonWorkspacePage.tsx` | Tabs: Overview (counts, warning banners, Amazon connection), Mappings, Stock Sync, Orders, Fulfillment, Activity. Settings tab folded into Overview; `?tab=settings` (OAuth callback) falls back to Overview |
| Orders → Amazon tab | `src/pages/orders/OrdersPage.tsx` + `components/amazon/AmazonOrderHub.tsx` | |
| Amazon order detail | `src/pages/orders/AmazonOrderDetailPage.tsx` | uses `AmazonOrderFulfillmentPanel` |
| Listing editor | `src/pages/amazon/AmazonListingEditorPage.tsx` | uses `AmazonPublishDraftModal` |
| OAuth callback | `src/pages/amazon/AmazonCallbackPage.tsx` | redirects to `/channels/amazon?tab=settings` |

Large multi-component files: `AmazonProductionListingsTable.tsx` (1,311 lines, table + 5 modals; used for both Mappings and Stock Sync), `AmazonOrderHub.tsx` (1,074 lines). Apparently unused: `pages/channels/AmazonAccordionContent.tsx`, `AmazonIntegrationContent.tsx`, `AmazonChannelPage.tsx`, `pages/amazon/AmazonPage.tsx`.

---

## 3. Environment variables (backend `src/config/env.ts`)

**Start here: [`amazon.env.example`](amazon.env.example)** — only what an environment needs, grouped by purpose: 4 connection values, 5–6 switches, optional groups (OAuth, notifications, listing publish, other schedules), defaults to leave unset, and 8 variables to remove. Today `.env.sit` / `.env.uat` carry 31 Amazon lines and `cloudbuildprod.yaml` 25; most are defaults or unused (AMZ-PLAN-22). The full table below is the complete list.

| Group | Variables |
| --- | --- |
| Master switch | `AMAZON_INTEGRATION_ENABLED` |
| Shared account (env fallback) | `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_REFRESH_TOKEN`, `AMAZON_SELLER_ID`, `AMAZON_MARKETPLACE_ID`, `AMAZON_REGION`, `AMAZON_SP_API_BASE_URL`, `AMAZON_PRODUCTION_SP_API_BASE_URL`, `AMAZON_AWS_IAM_ROLE_ARN` |
| OAuth (Authorize Seller Account) | `AMAZON_SP_API_APP_ID`, `AMAZON_OAUTH_VERSION`, `AMAZON_REDIRECT_URI` (`<inventory-host>/amazon/callback`), `AMAZON_TOKEN_ENCRYPTION_KEY` (64 hex), `AMAZON_OAUTH_STATE_TTL_SECONDS`, `AMAZON_SELLER_CENTRAL_URL` |
| Environment / safety | `AMAZON_ENVIRONMENT` (`SANDBOX` / `PRODUCTION`), `AMAZON_PRODUCTION_WRITES_ENABLED` (writes need this **and** `AMAZON_ENVIRONMENT=PRODUCTION`, and no emergency pause), `AMAZON_LISTING_CREATION_ENABLED`, `AMAZON_FULL_CATALOG_CREATION_ENABLED`, `AMAZON_LISTING_EDIT_ENABLED` |
| Imports | `AMAZON_LISTING_IMPORT_ENABLED`, `AMAZON_LISTING_IMPORT_PAGE_SIZE`, `AMAZON_LISTING_IMPORT_MAX_RETRIES` |
| node-cron schedules | `AMAZON_AUTO_SYNC_ENABLED`, `AMAZON_ORDER_AUTO_SYNC_ENABLED` / `_CRON`, `AMAZON_LISTING_AUTO_SYNC_ENABLED` / `_CRON`, `AMAZON_RETRY_WORKER_ENABLED` / `_CRON`, `AMAZON_RETURN_AUTO_SYNC_ENABLED` / `_CRON` |
| Cloud Scheduler | `AMAZON_SCHEDULER_SECRET` (16+ characters, FIX-124) |
| Real-time notifications | `AMAZON_NOTIFICATION_INGEST_SECRET` (32+), `AMAZON_NOTIFICATION_DESTINATION_ID`, `AMAZON_NOTIFICATION_SQS_DESTINATION_ID`, `AMAZON_NOTIFICATION_EVENTBRIDGE_DESTINATION_ID` |
| Sandbox | `AMAZON_SANDBOX_CREDENTIAL_SOURCE`, `AMAZON_SANDBOX_CLIENT_ID`, `AMAZON_SANDBOX_CLIENT_SECRET`, `AMAZON_SANDBOX_REFRESH_TOKEN`, `AMAZON_SANDBOX_SP_API_BASE_URL` |

Where the values live: local `.env` holds the shared-account credentials; SIT / UAT / Prod get Amazon credentials from GCP secrets (`scripts/update-amazon-secrets.mjs`, config `config/amazon-secrets.sit.json`, target Cloud Run `nivaana-dev`). `.env.sit`, `.env.uat`, `.env.prod` hold no Amazon credentials.

---

## 4. Cloud Scheduler: when and how to create the jobs

**Not yet.** Create them only when all of these are true for that environment:
1. FIX-124 is deployed there.
2. Amazon is switched on there (`AMAZON_INTEGRATION_ENABLED: "true"`; today off on SIT and UAT).
3. Amazon credentials work (section 6 fixed), otherwise every run just records another FAILED job.
4. `AMAZON_SCHEDULER_SECRET` is set there.

Then, per environment (same settings as the Shipmozo job, region `asia-south1`, time zone `Asia/Kolkata`, header `x-scheduler-secret: <secret>`, attempt deadline 10 min, Cloud Run request timeout above that):

| Job | URL path | Schedule | Needed? |
| --- | --- | --- | --- |
| `amazon-order-sync-<env>` | `/api/channels/amazon/jobs/order-sync` | `*/15 * * * *` (SIT on the Prod account: hourly, AMZ-PLAN-02) | **yes** |
| `amazon-listing-sync-<env>` | `/api/channels/amazon/jobs/listing-sync` | `0 */6 * * *` | only with `AMAZON_LISTING_IMPORT_ENABLED: "true"` |
| `amazon-retry-queue-<env>` | `/api/channels/amazon/jobs/retry-queue` | `*/5 * * * *` | optional; only if retries should run without someone pressing Retry |
| `amazon-return-sync-<env>` | `/api/channels/amazon/jobs/return-sync` | `*/30 * * * *` | optional; FBA / FBM returns import. Each call is one quick step (request the report, or collect it once Amazon finished), so a report is collected on a later call (FIX-143) |

After the first successful run, set the matching node-cron switch to `"false"` in that environment. Prod: create the jobs **paused**. The first 3 Scheduler jobs per billing account are free (Shipmozo already uses one per environment).


## 4a. Deploying Amazon to an environment (runbook, 2026-10-23)

Follow these steps in order for each environment (SIT first, then UAT, then Prod). SIT was prepared this way on 2026-10-23 (FIX-159). Reference values: [`amazon.env.example`](amazon.env.example).

### 4a.1 Where each kind of setting lives

| Kind | SIT | UAT | Prod |
| --- | --- | --- | --- |
| Deploy file | `cloudbuildsit.yaml` (service `nivaana-dev`) | `cloudbuilduat.yaml` on the `UAT` branch (service `nivaana-uat`) | `cloudbuildprod.yaml` + trigger `nivaana-production` substitutions (service `nivaana`) |
| Plain settings | `.env.sit` (tracked in git) | `.env.uat` (tracked in git) | trigger substitutions `_AMAZON_*` → `cloudbuildprod.yaml` |
| **Credentials** (client ID, client secret, refresh token) | Secret Manager `nivaana-sit-amazon-client-id / -client-secret / -refresh-token`, passed with `--set-secrets` (2026-10-23: putting them in `.env.sit` was tried and **GitHub push protection blocked the push** — never commit them) | Secret Manager (create `nivaana-uat-amazon-*` + `config/amazon-secrets.uat.json`) or the same `--set-secrets` pattern | trigger substitutions `_AMAZON_CLIENT_ID`, `_AMAZON_CLIENT_SECRET`, `_AMAZON_REFRESH_TOKEN` |
| Scheduler secret | `.env.sit` (`AMAZON_SCHEDULER_SECRET`, like `SHIPMOZO_SCHEDULER_SECRET`) | `.env.uat` (new value) | add `_AMAZON_SCHEDULER_SECRET` to `cloudbuildprod.yaml` + trigger (not mapped yet) |
| Request timeout | `--timeout 900` ✅ (2026-10-23) | add `--timeout 900` | add `--timeout 900` |

**One source per key:** a key set both in `--env-vars-file` and `--set-secrets` makes the deploy fail, and switching a key from a Secret Manager reference to a plain value needs `--clear-secrets` (or `--remove-secrets`) on that deploy. Amazon credentials never go in `.env.sit` / `.env.uat`: GitHub secret scanning blocks the push ("Login with Amazon OAuth Client Secret"); do not press Bypass. Watch YAML syntax in the env files: `KEY: value` (colon right after the key, then one space); `KEY :value` breaks the whole file.

### 4a.2 Amazon lines per environment (only these; everything else is a code default)

| Variable | Local `.env` | SIT `.env.sit` | UAT `.env.uat` | Prod |
| --- | --- | --- | --- | --- |
| `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_REFRESH_TOKEN` | in `.env` (not tracked) | Secret Manager (`nivaana-sit-amazon-*`) | Secret Manager (`nivaana-uat-amazon-*`) | trigger |
| `AMAZON_SELLER_ID` | `APCBEZW09ZM60` | same | same | same |
| `AMAZON_TOKEN_ENCRYPTION_KEY` | set | **same as local** (shared dev DB: stored connections are encrypted with it) | own value (own DB) | own value |
| `AMAZON_LISTING_IMPORT_ENABLED` | `"true"` | `"true"` | `"true"` | `"true"` |
| `AMAZON_SCHEDULER_SECRET` | — | set (own value) | set (own value) | set (own value) |
| `AMAZON_ORDER_AUTO_SYNC_ENABLED` | `"false"` | `"false"` | `"false"` | `"false"` (Cloud Scheduler runs it) |
| `AMAZON_ENVIRONMENT` | `"SANDBOX"` | `"SANDBOX"` | `"SANDBOX"` | `"PRODUCTION"` |
| `AMAZON_PRODUCTION_WRITES_ENABLED` | `"false"` | `"false"` | `"false"` | `"true"` after checklist 5a |
| `AMAZON_AUTO_SYNC_ENABLED` (stock) | `"false"` | `"false"` | `"false"` | `"false"` until AMZ-PLAN-24 |
| OAuth button (`AMAZON_SP_API_APP_ID`, `AMAZON_OAUTH_VERSION`, `AMAZON_REDIRECT_URI`) | kept (local UI shows the button) | removed (UI hidden on SIT) | only if the button is used; redirect must be **that** environment's Inventory host | same rule |

Removed from `.env.sit` on 2026-10-23 because they equal the code default or are unused there: `AMAZON_INTEGRATION_ENABLED` (default `true`), `AMAZON_MARKETPLACE_ID`, `AMAZON_SELLER_CENTRAL_URL`, `AMAZON_PRODUCTION_SP_API_BASE_URL`, `AMAZON_LISTING_IMPORT_PAGE_SIZE`, `AMAZON_LISTING_IMPORT_MAX_RETRIES`, the three `*_CRON` values, `AMAZON_LISTING_AUTO_SYNC_ENABLED`, `AMAZON_RETRY_WORKER_ENABLED`, the three empty `AMAZON_NOTIFICATION_*` IDs, and the OAuth trio. `.env.uat` still has all of them plus `AMAZON_INTEGRATION_ENABLED: "false"`: trim it the same way with the `SIT` → `UAT` merge.

**Local `.env` (2026-10-23):** writes and both auto-syncs set back to off (`SANDBOX` / `"false"`). Local shares the dev DB with SIT, so only SIT's Cloud Scheduler may run the scheduled order sync, and test stock must never be sent to the live listings.

### 4a.3 Steps

1. **Env file / trigger:** set the lines in 4a.2. Generate the scheduler secret with `openssl rand -hex 24` (a new value per environment; do not reuse or tweak the Shipmozo secret).
2. **Credentials:** put the working LWA client ID, client secret and refresh token into that environment's store. SIT: `node scripts/update-amazon-secrets.mjs --from-env .env --dry-run`, then without `--dry-run` (uses `config/amazon-secrets.sit.json`; `--redeploy` also redeploys `nivaana-dev`). Other environments: copy the config file with that environment's project / service / secret names and pass `--config <file> --confirm-target <project/service>`. When the LWA secret is rotated, update **every** environment the same day (section 6.1).
3. **Build file:** `--timeout 900` on `gcloud run deploy` (above the 10-minute scheduler deadline). For credentials from Secret Manager, `--set-secrets AMAZON_CLIENT_ID=<secret>:latest,...`, and the service account needs `roles/secretmanager.secretAccessor` on those secrets.
4. **Database:** run the pending Amazon migrations for that DB (release checklist 4a, e.g. `20261022_add_product_asin.sql`).
5. **Deploy**, then check: `GET /api/channels/amazon/status` (or Inventory → Channels → Amazon) shows connected; Activity → Refresh imports orders without `invalid_client`.
6. **Cloud Scheduler jobs** (section 4 table). Service URLs: SIT `https://nivaana-dev-715569764663.asia-south1.run.app`, UAT `https://nivaana-uat-715569764663.asia-south1.run.app`, Prod `https://nivaana-715569764663.asia-south1.run.app`. Example (SIT, hourly order sync and 6-hourly listing sync):

```bash
gcloud scheduler jobs create http amazon-order-sync-sit --location=asia-south1 --schedule="0 * * * *" --time-zone="Asia/Kolkata" --uri="https://nivaana-dev-715569764663.asia-south1.run.app/api/channels/amazon/jobs/order-sync" --http-method=POST --headers="x-scheduler-secret=<SIT_AMAZON_SCHEDULER_SECRET>" --attempt-deadline=600s
gcloud scheduler jobs create http amazon-listing-sync-sit --location=asia-south1 --schedule="0 */6 * * *" --time-zone="Asia/Kolkata" --uri="https://nivaana-dev-715569764663.asia-south1.run.app/api/channels/amazon/jobs/listing-sync" --http-method=POST --headers="x-scheduler-secret=<SIT_AMAZON_SCHEDULER_SECRET>" --attempt-deadline=600s
```

   Replace `-sit`, the URL and the secret for UAT / Prod; order sync `*/15 * * * *` on Prod; Prod jobs are created with `--paused` until Amazon is live there.
7. **Test once:** `gcloud scheduler jobs run amazon-order-sync-<env> --location=asia-south1`, then read the Cloud Run logs:

| Result | Meaning |
| --- | --- |
| 200, log "Scheduled Amazon order sync completed" | Working |
| 401 "Invalid scheduler secret" | Header value ≠ `AMAZON_SCHEDULER_SECRET` |
| 503 "Scheduler job is not configured" | `AMAZON_SCHEDULER_SECRET` missing or under 16 characters |
| 404 | Amazon routes not loaded (`AMAZON_INTEGRATION_ENABLED: "false"`) or wrong URL path |
| 200 with `skipped: AMAZON_LISTING_IMPORT_ENABLED is off` | Listing job runs but the switch is off |
| Job FAILED with `invalid_client` / `invalid_grant` | Credentials in that environment's store are old (step 2) |
| Deadline exceeded / 504 | `--timeout` missing (default 300 s) |

8. **Record it:** tick the rows in `docs/RELEASE_SCRIPTS_CHECKLIST.md` section 4e and update the section 1 table here.

---

## 5. Safety rules
- Reads (listings, orders, returns) never change anything on Amazon.
- Every Amazon write (stock quantity, offer price, listing edit, shipment confirmation, Easy Ship) goes through `amazonProductionWriteGuardService.assertEnabled`: needs `AMAZON_PRODUCTION_WRITES_ENABLED=true`, `AMAZON_ENVIRONMENT=PRODUCTION`, and no emergency pause (Activity tab → Emergency pause, stored in `amazonOperationsSetting`).
- Stock sync applies to seller-fulfilled listings (FBM / Self Ship, Easy Ship); FBA stays Amazon-managed and read-only.
- Mapping a listing changes Nivaana metadata only, never stock on either side.

---

## 5a. Stock Sync go-live checklist

Stock sync writes to the **real** Amazon account (there is no sandbox account with real data). Turn it on only in the environment whose database holds the real Nivaana stock.

| # | Check | Why |
| --- | --- | --- |
| 1 | Amazon credentials work (AMZ-PLAN-01; today `invalid_client`) | Preview reads the live Amazon quantity first; without a token every preview fails |
| 2 | `AMAZON_ENVIRONMENT=PRODUCTION` | The write guard needs it **and** `AMAZON_PRODUCTION_WRITES_ENABLED=true`; local `.env`, SIT and UAT say `SANDBOX` |
| 3 | `AMAZON_PRODUCTION_WRITES_ENABLED=true` | Manual and automatic publishing |
| 4 | `AMAZON_AUTO_SYNC_ENABLED=true` (only for automatic mode) | Automatic sync runs after Nivaana stock changes (platform stock create / update / transfer, stock import, Amazon order routing, returns) |
| 5 | Nivaana "amazon" platform stock is the real number for each mapped product | The target published to Amazon is this number ÷ pack size; e.g. KRA-0049 on the dev DB has 5 (test data) while Amazon shows 29 |
| 6 | Listing mapped, active, FBM / Easy Ship, correct pack size | FBA is blocked; wrong pack size over- or under-sells |
| 7 | Listing sync mode set per listing (all 191 are DISABLED today) | Start with **Manual** on one listing, check Seller Central, then more; Automatic last |
| 8 | Same product not mapped to two seller-fulfilled listings, or accept the risk (AMZ-PLAN-14) | Stock is not split |
| 9 | Emergency pause off (Activity tab) | Pause blocks all writes |
| 10 | Amazon app has the SP-API role for listings / inventory updates | Writes use `patchListingsItem` (MFN quantity); a missing role fails at the first write |
| 11 | Amazon order import works (credentials) | Orders must reduce Nivaana stock, otherwise the next sync republishes the old number |

**Never enable writes on local / dev:** local `.env` points at the shared dev DB (test stock) but uses the production Amazon account — every laptop would push test numbers to the live listings, and with automatic mode on, any stock edit on any laptop would.

## 6. Known issues

### 6.1 Amazon rejects the app credentials (`invalid_client`) — **resolved locally 2026-10-22 (FIX-130)**; GCP secrets pending

**2026-10-22 result:** token test failed for both apps (expired secrets), then OK after the new client secret + refresh token went into local `.env`. Listing import 172 / 172 updated, 0 failed. Order catch-up: 46 orders (26 new) since 2026-10-14, total 495 → 521. Remaining: GCP secrets for SIT / UAT / Prod, secret expiry reminder, local order sync off after SIT's Cloud Scheduler job.

**Timeline (dev DB `assetmanagement_dev`, IST = UTC + 5:30)**

| When | What |
| --- | --- |
| 2026-10-14 16:41 IST (11:11 UTC) | Last **successful listing import**: 172 listings fetched |
| 2026-10-14 16:41 – 16:46 IST | `lastImportedAt` of every listing (the "Last imported" in Listing details) |
| 2026-10-14 16:51 IST | Newest Amazon order row saved |
| 2026-10-14 18:15 IST (12:45 UTC) | Last **successful order import** job (1 order) |
| 2026-10-14 18:30 IST (13:00 UTC) | First failure; every Amazon call fails from here |
| 2026-10-21 17:03 IST | Latest listing import attempt — FAILED |
| up to 2026-10-21 | 1,102 FAILED order import jobs (15-minute node-cron on developer laptops) |

**Error and meaning**
- Raw error: `Amazon rejected the configured credentials. Check the selected credential source and reconnect if needed. (invalid_client: Client authentication failed)` — from the LWA token call (`https://api.amazon.com/auth/o2/token`, `src/services/amazon-lwa-token.service.ts`).
- `invalid_client` = the `AMAZON_CLIENT_ID` + `AMAZON_CLIENT_SECRET` pair is not accepted. A bad refresh token would say `invalid_grant`.
- Builds before commit `671f808` (2026-10-14) logged the same failure as "Amazon authorization is invalid or has expired"; that commit only added the detail.
- Checked: local `.env` has each value once, correct formats (`amzn1.application-oa2-client…`, `amzn1.oa2-cs.v1…`, `Atzr|…`), no whitespace. Token request code unchanged. Most likely the LWA client secret was rotated or expired in Seller Central → Develop Apps.
- Where the values live: local backend `.env` (`AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_REFRESH_TOKEN`); SIT / UAT / Prod read GCP secrets (`scripts/update-amazon-secrets.mjs`, config `config/amazon-secrets.sit.json`, Cloud Run `nivaana-dev`). `.env.sit`, `.env.uat`, `.env.prod` hold none.

**Why the screens still show Amazon data**

Nothing on screen is read live from Amazon except where noted below. Imports copy Amazon data into the Nivaana DB; the pages read that copy.

```
Amazon ──(import: needs credentials)──▶ Nivaana DB (marketplace_listings, amazon orders, …) ──▶ Inventory screens
```

| Works without Amazon (DB only) | Needs a live Amazon call (fails today) |
| --- | --- |
| Mappings / Stock Sync table, Listing details, Issues, mapping history | Refresh from Amazon (listing import) |
| Map / edit / unmap (saved in Nivaana only) | Order sync (Cloud Scheduler / node-cron / Sync orders now) |
| Overview counts, Activity dashboard | Stock sync **preview** (reads the live Amazon quantity) and publish |
| Amazon orders already imported | Offer validate / apply, listing edit / publish drafts |
| | Returns import, notifications, sandbox panel |

So every Amazon number on screen (quantity, price, status) is the **2026-10-14 snapshot**, and Amazon orders placed after 2026-10-14 16:51 IST are **not in Nivaana**. Example: `KRAFT-PARROTPAIR-HOMEDECOR` shows Amazon qty 29 from that snapshot.

**Fix runbook (2026-10-22 morning)**
1. Seller Central → Apps and Services → Develop Apps → the Nivaana app → **View LWA credentials**. Copy the client ID and the **current** client secret (rotate if it shows expired; note the new expiry date in AMZ-PLAN-01).
2. Local: update `AMAZON_CLIENT_ID` / `AMAZON_CLIENT_SECRET` in `asset-management-backend/.env`. Also set `AMAZON_ORDER_AUTO_SYNC_ENABLED="false"` (laptops must not run the sync against the shared dev DB). Restart the backend.
3. Test the token: Inventory → Amazon Operations → Mappings → **Refresh** (listing import). Success = "Import completed" with ~172 fetched.
   - If the error becomes `invalid_grant`: the refresh token is invalid too → Seller Central → Develop Apps → **Authorize** the app again, put the new `AMAZON_REFRESH_TOKEN` in `.env`, restart, retry.
   - If it still says `invalid_client`: the client ID and secret do not belong to the same app, or the app was deleted / suspended.
4. GCP: update the SIT secrets with the same values (`node scripts/update-amazon-secrets.mjs --from-env .env --dry-run`, then without `--dry-run`; add `--redeploy` to restart `nivaana-dev`). The user runs GCP write commands. Prod secrets only when Amazon goes live there.
5. Catch up: Activity → **Sync orders now** (incremental from the last success, 2026-10-14) — orders from 14–22 Oct come in; check the Orders → Amazon tab.
6. Verify:
   - Activity: Amazon connection OK, latest order and listing import **Successful**, no new failed jobs.
   - Listing details "Last imported" = today.
   - Stock Sync → open `KRAFT-PARROTPAIR-HOMEDECOR` → preview loads (Amazon qty from Amazon now, Nivaana 5, target 5). **Do not publish** from local / dev (section 5a).
7. Log the result here and in `Fix_After_Sep30/Master.md`; mark AMZ-PLAN-01 done.

**After the fix, still open:** old FAILED jobs keep the Activity badge red (6.2, AMZ-PLAN-06); Cloud Scheduler jobs not created yet (section 4); writes stay off until the go-live checklist (section 5a).

### 6.2 Activity tab always says "Needs attention" — fixed 2026-10-22 (FIX-132)
`health.overall` is `ATTENTION` whenever any of the latest failures exist; failed order import jobs have no resolved state, so old failures keep it red even after sync works again (AMZ-PLAN-06).

### 6.3 Overview "Last order import" shows failed runs as if fine — open
The time shown is the latest job, whatever its status (AMZ-PLAN-07).

---

## 7. Decisions
| Date | Decision |
| --- | --- |
| 2026-10-14 | Amazon UI visible as on `DEV-NEW` (hidden only on SIT) — Master.md, 2026-10-13 entry update |
| 2026-10-21 | Scheduled Amazon work moves to **GCP Cloud Scheduler** endpoints, like Shipmozo (FIX-120); node-cron stays behind the env switches |
| 2026-10-21 | Amazon Operations: Settings tab folded into Overview; Developer tools (sandbox) and the internal "not exposed" note removed from the page; Recommended next action replaced by warning banners |
| 2026-10-21 | Authorize Seller Account opens Amazon in a new tab |
| 2026-10-21 | SIT may use the **Prod Amazon account read-only** (sandbox has no useful data) — not done yet, see AMZ-PLAN-02 |

---

## 8. Change log

### 2026-10-23: Amazon — SIT ready for Cloud Scheduler; env files cleaned; deployment runbook (FIX-159, backend DEV-NEW, config + docs)
`.env.sit`: Amazon on (`AMAZON_LISTING_IMPORT_ENABLED: "true"`, `AMAZON_SCHEDULER_SECRET` set, integration default `true`), writes off, credentials stay in Secret Manager (`--set-secrets`; a try with them in `.env.sit` was blocked by GitHub push protection; the earlier malformed `AMAZON_REFRESH_TOKEN :` line would have broken the deploy); unused `ACCESSKEYID`, `SECRETACCESSKEY`, `REGION`, `PROTOCOL`, `POSTGRES__DATABASE`, `PROD_DATABASE_URL` removed; Shipmozo node-cron off, defaults and the unused OAuth trio removed — 8 Amazon lines left. Local `.env`: writes, stock auto-sync and order auto-sync off; defaults removed. `cloudbuildsit.yaml`: `--timeout 900`. New section 4a: per-environment settings, credentials, build flags, scheduler commands, error table. Open: update the SIT Secret Manager versions, commit, deploy, create jobs.

### 2026-10-13: Inventory — Amazon Integration UI Ported from Dev (FIX-108)
Full Amazon UI ported to Inventory `DEV-NEW` (branch `feature/amazon-ui-port`); hidden at first, then shown except on SIT (2026-10-14). Details: `Fix_After_Sep30/Master.md`.

### 2026-10-14: Backend — Amazon token error detail (commit `671f808`, Amazon/Feature)
LWA token failures now report Amazon's own reason (`invalid_client`, `invalid_grant`, temporary / network errors) instead of one generic message. Also hardened `scripts/update-amazon-secrets.mjs` (no credentials on the command line, `--confirm-target` for custom targets).

### 2026-10-21: Inventory — Channels page and Amazon Operations UI (DEV-NEW, not committed)
- Sidebar: duplicate Channels entry removed from Configuration.
- Channels page: list-page header; Amazon, Flipkart, Ekart and new **Shipmozo** rows as one accordion; Shipmozo status = backend config check + live warehouse call; "Loading…" instead of "Not available" while loading.
- Amazon Operations: Nivaana theme (`uiTheme`, `nv-btn-primary` / `nv-btn-secondary` in `index.css`), title / subtitle header, glassy tabs, Overview = counts + warning banners + Amazon connection; Settings tab, Setup and health, Recommended next action (its Continue button went to a hidden tab), Developer tools and the internal note removed. All Amazon tab components re-themed (classes only; verified word by word).
- Authorize Seller Account: clearer label, opens in a new tab (`connect({ newTab: true })`, other callers unchanged), refreshes the card when the user comes back.
- Mappings tab (`AmazonProductionListingsTable`, also used by Stock Sync): list-page pattern — no title / description block (saves space; title kept as the table's `aria-label`, description as the bulk button tooltip), one `ListToolbar` row (search on Enter, mapping status, fulfilment channel, listing status **dropdown** instead of free text, clear-filters icon; Map (n) / Preview stock (n) and **Refresh** on the right; listing count stays in the table footer), friendly labels (Unmapped / Mapped / Conflict; "Buyable · Discoverable" instead of `DISCOVERABLE,BUYABLE`, raw value on hover), theme buttons, page sizes 10/20/50/100 (backend max 100). "Review unmapped" removed (same as the dropdown); the row Stock sync button shows only on the Stock Sync tab. Handlers and API calls unchanged.
- Mappings / Stock Sync table columns: price as `₹1,599` (`Intl` en-IN; other currencies get their symbol, unknown codes fall back to text, raw value on hover); every column after Amazon listing and Identifiers centred; FNSKU line only when present (only the 2 FBA listings have one); listing status only when something is wrong ("Not buyable", "Not discoverable", red for Inactive / Suppressed / other; live Buyable + Discoverable shows nothing; deleted is already marked in the listing column; raw status on hover); "No Nivaana product selected" dropped under the Unmapped badge (mapped rows still show PUC, name, units per listing).
- Identifiers column merged into the listing column: `SELLER-SKU | ASIN (| FNSKU)` under the title, each with a hover label; full title on hover. Listing details modal redesigned (markup only): summary card (full title, SKU | ASIN | FNSKU, fulfilment / "Live on Amazon" or problem / mapping badges), 4 figure tiles (Amazon qty, ₹ price, product type in plain case, last imported), Nivaana product card when mapped, FBA tiles, issues with icon + plain-case name + message (red for ERROR), offer form with a label above every field and "Now …" placeholders, Validate button right-aligned with the last submission note, mapping history as a timeline. Row actions are 32px icon buttons with tooltips: Details (eye), Map (link, gold) / Edit mapping (pen, gold), Remove mapping (link-slash, red), Stock sync (rotate, Stock Sync tab only).
- Backup before the redesign: branch `backup/amazon-ui-before-redesign-2026-10-21` (pushed).

### 2026-10-22: Amazon order page cleaned up; Orders tab = overview + full list (FIX-158, Inventory DEV-NEW, UI only)
Order page (`/orders/amazon/:id`): it showed "Nivaana status: Amazon Easy Ship" for every Easy Ship order (real state e.g. Needs mapping), "Courier / Tracking: Not assigned" on shipped Easy Ship orders, Easy Ship three times, the total twice, no way to map the listing, and long dates. Now: breadcrumb Amazon › Orders › id; header with order, "Placed Today, 08:46", one Amazon status and one Nivaana state badge (same labels as the list), total; tiles Shipping (Easy Ship / Self Ship / FBA with what it means) · Ship by (Late in red) · Tracking (Self Ship tracking, or "Amazon courier – tracking is in Seller Central"); a "Next step" line per case (nothing to do / book pickup / pick-pack-ship / ship in Seller Central + map / items missing + Activity) with its link; pickup / shipping actions only when there is something to do; items with "Not linked · Map listing" (opens Mappings searched for the SKU, new `?tab=mappings&q=`); timeline Order placed · Ship by · Last change on Amazon · Last checked by Nivaana. Test-order controls kept (dev only). Orders tab: overview tiles on top and the full order list (toolbar, filters, table) below on one page; the separate "All orders" view, the latest-5 table and the breadcrumb are gone; the list's refresh also refreshes the tiles; links point to `?tab=orders`.

### 2026-10-22: Amazon orders have one home: Amazon Operations → Orders (FIX-157, Inventory DEV-NEW, UI only)
Amazon orders appeared in three places (Amazon Operations → Orders summary, Orders → Amazon → Overview, Orders → Amazon → Orders list). Now: the full list is Amazon Operations → Orders → "All orders" (`/channels/amazon?tab=orders&view=list`), a new `AmazonOrderList` in the Mappings style — breadcrumb "Orders › All orders", ListToolbar (search after 3 characters, Shipping / Amazon status / Nivaana state filters applied at once, Clear filters, one refresh icon = get latest orders), table Order + product · Purchased · Units · Amount · Amazon status badge · Shipping · In Nivaana badge, row opens the order, same pagination as Mappings. Shared display helpers in `utils/amazonOrderDisplay.ts` (older dates show the year). The Orders module lists Nivaana orders only (Nivaana / Amazon / Flipkart tabs removed; Flipkart was a placeholder) with an "Amazon orders →" link; `/orders?tab=amazon` redirects; the order detail breadcrumb is Amazon › Orders › order. "Test order" is no longer on any list (dev tool); "Import all order history" (re-read 2 years, repair only) moved to Activity → "Import all orders again" (admins, with confirmation). `AmazonOrderHub` is no longer rendered (its `AmazonOrderFulfillmentPanel` export is still used by the order detail page).

### 2026-10-22: Amazon — interrupted listing imports closed; orders without items = "Items missing" (FIX-156, backend + Inventory DEV-NEW)
Investigation: listing import #49 (16:43 IST) stayed RUNNING — the dev server (`tsx watch`) restarted mid-import; order jobs have startup recovery, listing imports had none. `closeInterruptedSyncLogs()` marks Amazon listing imports RUNNING for over 30 minutes as FAILED "Interrupted: the server stopped during this import" — on backend start and before every new import. "30 mapped Easy Ship orders without stock reservation" was a misread: 235 of 518 real orders (21–28 July full-history import, earliest code) have no order items; 30 of them were routed "ready" because zero items counted as "no unmapped items". Stock is correct: orders already shipped when imported never change Nivaana stock (by design). Rule now: an order with no items is `BLOCKED_ITEMS_MISSING` ("Items missing") in the import and in routing, never ready / unmapped; labels on the Orders tab, Fulfillment queue and the order list filter. To refresh: run "Import all order history" once per database (fills the items, re-routes; read-only to Amazon; no stock change for shipped / cancelled orders).

### 2026-10-22: Amazon — Activity tab simplified (FIX-155, backend + Inventory DEV-NEW)
The tab repeated Overview (counts, connection, schedules), showed the unconfigured real-time updates table (P6), and its 20-row "Recent activity" was filled by the 15-minute order imports (78 in 24 h) and per-listing import audit rows (1,166 IMPORT_UPDATED). Backend: `activity(…, { realEventsOnly: true })` for the dashboard leaves out scheduled order imports and IMPORT_* audit rows, adds stock sent to Amazon, and gives each row who did it (`by`, `resolveActorNames`); new `scheduledOrderImports` (last 24 h: runs, failed, latest) summarised in one line (`summarizeScheduledImports`). Tab now: Needs attention (failures + open retries, Retry / Run now; "Nothing failed" when empty) · Recent activity (one import summary line + real events with result and who) · Export reports (CSV) · Stock updates to Amazon (admins: On / Paused / Off on this server, Pause / Resume with reason). Hidden: duplicate cards and facts, real-time updates table, request capacity, "Sync orders now". `GET /api/channels/amazon/operations/activity` unchanged (all events). Open: one listing import left in RUNNING since 16:43 IST (to check).

### 2026-10-22: Amazon — Fulfillment tab is a work queue (FIX-154, Inventory DEV-NEW, UI only)
The tab showed the full order list again (same component as Orders → Amazon), opened on FBM / Self Ship — only the 3 test orders, because every real order is Easy Ship — with test order, full-history import and status filters. Now `AmazonFulfillmentQueue`: only orders still to ship (Amazon status Unshipped / Partially shipped, FBA and cancelled left out), soonest ship-by deadline first; tiles To ship · Due in 24 hours · Late; "Orders updated <time>"; failed shipping steps banner (link to Activity); each row Order (link) · Product · Ship by (amber due soon, red late) · Easy Ship / Self Ship · Next step button that opens the order ("Book pickup", "Pickup booked · slot", "Pick", "Pack", "Choose shipping", "Add tracking", "Confirm to Amazon", "Link listing to a product", failures in red). Empty state "Nothing to ship right now". Same fonts / table style as the Orders tab. Orders → Amazon list unchanged (search, history, test order, full-history import stay there).

### 2026-10-22: Amazon — Orders tab simplified (FIX-153, Inventory DEV-NEW, UI only)
Review (U5): the Orders tab is a summary; the full list is Orders → Amazon (`/orders?tab=amazon`) and the Fulfillment tab. Dev DB: 518 real orders — 438 blocked (listing not mapped), 49 cancelled, 30 Easy Ship (KRA-0049, already shipped), 1 shipped; 0 stock reservations (to check: mapped Easy Ship orders imported after shipping reserve no stock). Tab now: one card under the tabs with the tiles and the buttons "Get latest orders" / "Open all Amazon orders" (no separate header or "Latest orders / View all" header); tiles Amazon orders · Waiting to ship (Unshipped) · Need mapping (all-time, not last import) · Last import (when, result, by whom); latest 5 orders with the order ID linking to the order detail page and plain states ("Needs mapping", "Easy Ship", "Amazon ships (FBA)", …). Schedule line, "Started by" and duplicate exception count removed.

### 2026-10-22: Amazon — Stock sync dialog checks Amazon by itself while an update is pending (FIX-152, backend + Inventory DEV-NEW)
First live send (KRAFT-PARROTPAIR-HOMEDECOR, 29 → 5, 16:28 IST): Amazon accepted it and Seller Central showed 5 a few minutes later, but the open dialog kept "Amazon is updating" and Amazon 29, because Amazon was only re-read when the dialog opened or on Refresh preview. New `GET /listings/:id/inventory/check` re-reads Amazon and confirms (or times out after 15 min) a waiting send without recording a preview; the dialog calls it every 20 s while a send is waiting, shows "Last checked hh:mm:ss", and reloads numbers and history once Amazon has applied it ("Amazon updated" / "has not applied the update" message). Sends nobody watches are still confirmed the next time the dialog is opened.

### 2026-10-22: Amazon — Stock Sync: mapped only, no sync-mode choice, history of real sends (FIX-151, backend + Inventory DEV-NEW)
Stock Sync tab lists mapped listings only (mapping filter removed). The Off / Manual / Automatic choice is removed from the screen (decision): "Sync stock now" works for any mapped self-ship listing once writes are on; automatic sending is not offered for now (AMAZON_AUTO_SYNC_ENABLED has no effect until a way to enable it per listing returns — see AMZ-PLAN-24). Table column "Sync mode" → "Last sent". Bulk "Preview stock (N)" and the Stock Sync checkboxes hidden (`BULK_STOCK_SYNC_ENABLED = false`): stock is sent one listing at a time. History shows only stock actually sent to Amazon: "Amazon 29 → 5 · Synced by <name> · Confirmed · Today, 15:47"; previews are no longer listed (still stored). Amazon does not record which Nivaana user changed a quantity, so the name is kept in Nivaana.

### 2026-10-22: Amazon — Bulk map hidden (FIX-150, Inventory DEV-NEW, UI only)
"Map (N)" bulk mapping applied one product and one pack size to every selected listing; each Amazon listing is its own product / pack, so mapping is one at a time (decision 2026-10-22). Button and the Mappings checkbox column hidden (`BULK_MAPPING_ENABLED = false`); Stock Sync keeps its checkboxes for "Preview stock". Backend `POST /listings/bulk-map` unchanged.

### 2026-10-22: Amazon — clearer button names, tile alignment (FIX-149, Inventory DEV-NEW, UI only)
"Recheck" / "Recheck connection" → **Test connection** (Amazon Overview, Channels Amazon and Shipmozo cards; only checks sign-in and last import status). "Refresh from Amazon" → **Get latest listings** (downloads listings, read-only; "sync" avoided because Stock Sync means sending stock to Amazon). "Orders needing attention" tile top-aligned like the other tiles.

### 2026-10-22: Amazon — listing toolbar: search while typing, visible reloads, Clear filters (FIX-148, Inventory DEV-NEW)
Mappings / Stock Sync toolbar: search runs while typing (3+ characters, 400 ms after the last key; Enter searches at once; a "N more characters" hint for 1–2); fewer than 3 characters means no search. Filters already reloaded on change but showed nothing while loading — the table now dims and the search icon spins; only the latest request updates the table. Icon-only clear button replaced by a "Clear filters" text link, shown only when something is filtered. "Refresh" renamed (now "Get latest listings", FIX-149; fetches listings, quantities, prices and status; read-only).

### 2026-10-22: Amazon — data freshness moved into the tab bar (FIX-147, Inventory DEV-NEW, UI only)
The full-width "Amazon data as of …" bar on Mappings / Stock Sync is now a compact line at the right end of the tab bar: "Updated 14:37 · 33 min ago" (date shown only when not today); amber when older than 12 h, red "Refresh failed · data from …" when the last refresh failed; full sentence and error on hover.

### 2026-10-22: Amazon — "Incomplete" listings (no price) counted like Seller Central (FIX-146, backend + Inventory DEV-NEW)
Amazon's Listings API returns a listing that has no offer price (e.g. `NIV_CIH_PACK`, a pack created but never priced); Seller Central's Listing Status widget leaves such listings out. Rule (`isIncompleteAmazonListing`): not deleted and no price = **Incomplete**. Overview Listings / Unmapped count priced listings only (dev DB 172 → 171 = Seller Central, unmapped 171 → 170) with a "+1 incomplete (no price yet)" note; Mappings shows an **Incomplete** badge and a status filter "Incomplete (no price)" (`incomplete=true`); stock sync refuses it (409 `AMAZON_LISTING_INCOMPLETE`). Import, delete detection and mapping unchanged; once Amazon returns a price the listing counts normally.

### 2026-10-22: Amazon — Overview numbers match Seller Central (FIX-145, backend + Inventory DEV-NEW)
Orders count leaves out Nivaana test orders (`TEST-AMZ-…`): dev DB 521 → 518 = Seller Central (469 sent incl. 11 waiting for pickup + 49 cancelled, Easy Ship). Overview tiles: Listings, Unmapped, Amazon orders, **Orders needing attention** (was "Exceptions"; red when > 0, opens Activity). "Retry queue" removed from Overview (still in Activity — retries are queued only when someone presses Retry).

### 2026-10-22: Amazon — remaining code gaps (FIX-141 – FIX-144, backend + Inventory DEV-NEW)
- FIX-141 (P7): one Automatic listing per product — `setMode` refuses a second (409 `AMAZON_AUTOMATIC_ALREADY_SET`), remapping an Automatic listing onto such a product drops it to Manual, automatic sync refuses to publish when older data has several. Stock Sync dialog shows the other listings sharing the stock.
- FIX-142 (P2, P12, U6, U8): connection alert on every Amazon tab and the Dashboard; "Authorize Seller Account" hidden; Esc in the mapping search; dark-mode brand text.
- FIX-143 (P4): `POST /api/channels/amazon/jobs/return-sync` — one quick step per call (request, or collect when Amazon finished); stale return jobs (6 h without progress) are released.
- FIX-144 (D7): `npm run amazon:mappings` export / import of mappings between databases by seller SKU + PUC.

### 2026-10-22: Amazon — ASIN on products, Strong match (FIX-140, backend + Inventory DEV-NEW)
`product.asin` (nullable, indexed; SQL `20261022_add_product_asin.sql`, applied on SIT 2026-10-22). Product create / edit / detail show "Amazon ASIN" (10 letters/digits, saved upper case, empty clears). Mapping suggestions: same ASIN +90 → HIGH ("Same ASIN"). ASINs still have to be entered per product.

### 2026-10-22: Amazon / Shipmozo — lint, types, expired login (FIX-138, Inventory DEV-NEW)
Amazon Inventory files: 0 type / lint errors (two attribute-JSON `any` kept with a scoped exception). Shipmozo service logs out on a portal 401.

### 2026-10-22: Amazon — sandbox removed (FIX-137, backend + Inventory DEV-NEW)
Sandbox service, routes, status section and stock-sync branch removed; 8 env variables gone (43 → 35); Inventory sandbox table and 4 unused Amazon files deleted. Outside PRODUCTION, stock sync skips.

### 2026-10-22: Amazon — credential backoff for scheduled order sync (FIX-136, backend DEV-NEW)
After consecutive credential failures, scheduled order runs wait 15 → 30 → 60 … ≤ 360 minutes; manual sync never blocked. Outage replay for one runner: 744 → 35 failed jobs.

### 2026-10-22: Amazon — Operations API error hygiene (FIX-135, backend DEV-NEW)
Operations errors: Amazon error classes and validation pass through, anything else is a generic 500; four plain user errors became `AmazonOperationsError`. `/listings` accepts `activeOnly`.

### 2026-10-22: Amazon — Stock Sync tab and dialog (FIX-134, backend + Inventory DEV-NEW)
Rows show Nivaana "amazon" stock, target, difference and sync mode (backend adds `nivaanaStock` to mapped seller-fulfilled rows; target formula shared in `utils/amazonStockTarget.ts`). Dialog: three figures, Off / Manual / Automatic switch, plain reason when publishing is blocked, friendly history.

### 2026-10-22: Amazon — data freshness bar (FIX-133, Inventory DEV-NEW)
Mappings and Stock Sync show "Amazon data as of …" from the last listing import: plain, amber after 12 h, red when the latest refresh failed; updates after Refresh.

### 2026-10-22: Amazon — "Needs attention" clears after recovery (FIX-132, backend DEV-NEW)
Order / listing import failures followed by a successful import of the same kind no longer count; dev DB 50 → 0 failures, health HEALTHY.

### 2026-10-22: Amazon — Connection restored (FIX-130) and real connection status (FIX-131)
FIX-130: new LWA client secret + refresh token in local `.env`; 172 listings imported; 46 orders caught up. FIX-131: `GET /api/channels/amazon/connection-check` (live token + latest imports) drives the Channels badge and the Overview connection card — Connected / Connected · sync failing / Connection failed (since …) / Amazon unreachable / Not configured / Disabled, with Amazon's reason and a Recheck button. The old "Environment configured" label is gone.

### 2026-10-21: Amazon — Stock Sync shows the real Amazon error (FIX-129, backend DEV-NEW)
Inventory endpoints now return Amazon credential / API / write-switch errors with their message and `AMAZON_*` code instead of a generic 500 (no logout: the Inventory ignores `AMAZON_*` 401s).

**Stock sync direction:** FBM / Easy Ship → Nivaana "amazon" platform stock ÷ pack size is published **to Amazon**; Nivaana stock is never changed by a sync (orders reduce it). FBA → stock sync is blocked; listing import copies Amazon FBA quantities **into** Nivaana's "amazon" platform stock.

### 2026-10-21: Amazon — Mapping history with names (FIX-128, backend + Inventory DEV-NEW)
Audits return product PUC / name and the user's full name; history reads "None → KRA-0049 · … by Harish Raja".

**Listing issues (Listing details → Issues)** come from `listingIssues()` in `amazon-listing.repository.ts`: UNMAPPED_PRODUCT (warning), MAPPING_CONFLICT (error), MISSING_ASIN (warning), MISSING_TITLE (info), QUANTITY_UNAVAILABLE (info), UNKNOWN_FULFILMENT (warning), INACTIVE_LISTING when the status contains inactive / deleted / blocked / suppressed (warning). They are data-quality checks on the imported listing and its mapping, not Amazon account health.

### 2026-10-21: Amazon — Shared-product warning in the mapping dialog (FIX-127, backend + Inventory DEV-NEW)
`GET /listings?productId=` filter; the mapping dialog lists other Amazon listings already mapped to the chosen product (SKU, channel, pack) and warns that each seller-fulfilled listing gets the full stock. Mapping still allowed. Stock split parked as AMZ-PLAN-14.

### 2026-10-21: Amazon — Better mapping suggestions (FIX-126, backend DEV-NEW)
Suggestions now ignore brand / filler / packaging words, score by how much of the product's distinctive name appears in the Amazon title (rare words weigh more, pack numbers kept), need score ≥ 25 and return at most 4. Suggestion cards in the dialog are compact rows (reasons on hover). Details: `Fix_After_Sep30/Master.md` FIX-126.

**How suggestion scoring works:** current mapping +100; seller SKU = PUC +80 (partial +45); same ASIN / SKU mapped to the product before +35; name match up to +70 (`src/utils/amazonProductMatch.ts`). HIGH ≥ 80, MEDIUM ≥ 45, else LOW. Amazon seller SKUs (`VQ-…`, `KRAFT-…`) differ from Nivaana PUCs (`NIV-…`, `KRA-…`), so today most suggestions come from the name match and show as "Possible" at best.

### 2026-10-21: Amazon — Mapping screen fixes (FIX-125, backend + Inventory DEV-NEW)
All 8 backend suggestions shown (was 4) as crisp cards; suggestion candidate pool no longer cut at an unordered 30 before scoring (`take: 500`); product search is an autocomplete (list opens on click / typing, closes on select, outside click or Esc), pages 25 at a time ("Showing X of Y", Load more) and reports failures instead of "No matching products"; wide dialog; **Pack size** label (units per listing). Details: `Fix_After_Sep30/Master.md` FIX-125.

**Pack size (units per listing)** = how many Nivaana units one Amazon unit contains. Stock sync publishes `floor(Nivaana available / pack size)` to Amazon; e.g. Amazon "Pack of 2", Nivaana 10 in stock → Amazon shows 5. Use 1 for single items.

### 2026-10-21: Amazon — Cloud Scheduler Job Endpoints (FIX-124, backend DEV-NEW)
`POST /api/channels/amazon/jobs/order-sync`, `/listing-sync`, `/retry-queue`, secret header `AMAZON_SCHEDULER_SECRET`; order sync awaits the job (`enqueue(…, { background: false })` + `run()`). Returns not covered. Tests: `tests/amazonSchedulerJobs.test.ts`; 154 Amazon tests pass; full-app inject 401 / 200. Details: `Fix_After_Sep30/Master.md` FIX-124.

---

## 9. Future plans (AMZ-PLAN-xx)

### AMZ-PLAN-01: Fix and rotate the Amazon app credentials
**Status:** Local fixed 2026-10-22 (FIX-130); **left:** GCP secrets for SIT / UAT / Prod, record the new secret's expiry date here and set a reminder. Runbook in section 6.1. Get the current LWA client secret (Seller Central → Develop Apps), update `.env` and GCP secrets, re-authorize if `invalid_grant` appears. Write down the secret's expiry date here and add a reminder before the next rotation (Amazon expires LWA client secrets periodically).

### AMZ-PLAN-02: SIT on the Prod Amazon account, read-only
**Status:** Decided in principle 2026-10-21, not started. Sandbox has no useful data.
- Backend `.env.sit`: `AMAZON_INTEGRATION_ENABLED: "true"`, `AMAZON_ENVIRONMENT: PRODUCTION`, **`AMAZON_PRODUCTION_WRITES_ENABLED: "false"`** (keep), node-cron switches `"false"`, `AMAZON_SCHEDULER_SECRET`.
- Prod Amazon credentials in SIT GCP secrets.
- Inventory: show Amazon on SIT (`integrationFeatures.amazon`), with a clear "SIT — read-only, do not ship" label.
- Cloud Scheduler order sync on SIT **hourly**, not every 15 minutes (shared rate limits with Prod).
- Risks: the same real orders appear in SIT and Prod DBs (nobody may ship from SIT); rate limits shared; secret rotation must update both.

### AMZ-PLAN-03: Create the Cloud Scheduler jobs per environment
**Status:** Waiting for FIX-124 deploy + AMZ-PLAN-01. Steps in section 4. User runs the GCP commands.

### AMZ-PLAN-04: Turn off laptop node-cron against the shared dev DB
**Status:** Open. Local `.env` `AMAZON_ORDER_AUTO_SYNC_ENABLED="false"` for every developer; optionally make node-cron refuse to start when `NODE_ENV=development` unless a separate opt-in flag is set.

### AMZ-PLAN-05: Returns import on Cloud Scheduler
**Status:** Done 2026-10-22 (FIX-143): step endpoint `/jobs/return-sync`. Before: Open. Reports API polling is too long for one request: split into a "request report" job and a "collect finished reports" job (both quick), or keep node-cron for returns on an always-on instance.

### AMZ-PLAN-06: Failure lifecycle and "Needs attention"
**Status:** Done 2026-10-22 (FIX-132 resolved failures, FIX-136 credential backoff). Mark failed order / listing imports as superseded once a later run succeeds (or count only failures after the last success), so the Activity badge turns green again. Add backoff when the same credential error repeats (today 96 failed jobs a day per laptop).

### AMZ-PLAN-07: Overview shows import status, not just time
**Status:** Open. "Last order import 18:30" should say "Failed" / "Successful" and show the last successful time too.

### AMZ-PLAN-08: Map the 172 unmapped listings
**Status:** Open (business task). Do it on **Prod** (or on UAT and move with AMZ-PLAN-23) — mappings do not travel between databases (section 1a). Stock sync and seller-fulfilled order processing need mapped SKUs. Mappings tab → bulk map.

### AMZ-PLAN-09: Real-time notifications (SQS / EventBridge)
**Status:** Open. All 5 subscription types show "Setup required"; needs an AWS destination and `AMAZON_NOTIFICATION_*` values. Until then the scheduled sync is the only update path.

### AMZ-PLAN-10: Who may authorize a seller account
**Status:** Done 2026-10-22 (FIX-142): button hidden, shared account only (decision). Before: Open. OAuth connections are per user and change which account that user sees. Decide: hide Authorize Seller Account, or allow only operations admins (`access.operationsAdmin` instead of `access.manageConnection`).

### AMZ-PLAN-11: Split the large Amazon components
**Status:** Open. Move the 5 modals out of `AmazonProductionListingsTable.tsx` and the test-order modal / fulfillment panel out of `AmazonOrderHub.tsx` into their own files, no logic change, before further UI work. `AmazonOrderHub` and `AmazonOrderFulfillmentPanel` are also used by Orders and Amazon order detail.

### AMZ-PLAN-12: Remove unused Amazon frontend files
**Status:** Done 2026-10-22 (FIX-137). `AmazonAccordionContent.tsx`, `AmazonIntegrationContent.tsx`, `AmazonChannelPage.tsx`, `pages/amazon/AmazonPage.tsx` are not imported anywhere; confirm and delete. Sandbox panel component (`AmazonSandboxInventoryTable`) kept for developers.

### AMZ-PLAN-13: Pre-existing lint / type errors in Amazon frontend
**Status:** Done 2026-10-22 (FIX-138); hook-dependency warnings remain by choice. `AmazonAttributeFields.tsx` uses `Array.prototype.at` (needs `es2022` lib), `AmazonPublishDraftModal.tsx` has an `any`. Not touched during the UI-only restyle.

### AMZ-PLAN-14: Split stock when one Nivaana product has several seller-fulfilled listings
**Status:** Done 2026-10-22 (FIX-141): option (a), one Automatic listing per product (decision). Before: Open (business decision needed). Found 2026-10-21 (FIX-127).
- **Today:** one Nivaana product may be mapped to many Amazon listings. Production automatic stock sync (`amazon-production-inventory.service.ts` → `syncAutomaticPlatformStock`) loops over every mapped FBM / Easy Ship listing with `inventorySyncMode = AUTOMATIC` and publishes `floor(Nivaana Amazon-platform available / pack size)` to **each** — e.g. 10 in stock, single listing shows 10 and pack-of-2 listing shows 5, so up to 20 units can be ordered against 10. The manual preview / sync per listing uses the same full number. The older sandbox path `selectMappedAmazonSellerSku` refuses more than one mapping, so the two paths disagree.
- **Mitigation now:** mapping dialog warning (FIX-127); orders import reduces Nivaana stock and the next automatic sync corrects Amazon, but the gap is the risk window.
- **Options:** (a) only one listing per product may be AUTOMATIC, others manual; (b) split by a share per listing (new `stockSharePercent` on the listing); (c) publish the full number to one "primary" listing and 0 / a reserve to the rest; (d) block a second seller-fulfilled mapping (FBA unaffected). Also make the sandbox and production paths follow the same rule.
- **Touch points:** `marketplace_listings` (new field for b / c), `amazon-production-inventory.service.ts` (`preview`, `syncAutomaticPlatformStock`, `calculateAmazonTargetQuantity`), mapping dialog / Stock Sync tab UI, tests in `amazon-production-inventory*.test.ts`.

### AMZ-PLAN-15: Alert when Amazon sync keeps failing
**Status:** Done 2026-10-22 (FIX-142): in-app alert on Amazon tabs + Dashboard; no email (decision). Before: Open. Gap P2. Today a credential failure ran for a week unnoticed. Options: after N consecutive FAILED order / listing imports (or any `AMAZON_INVALID_AUTHORIZATION`), notify (email / in-app banner on Channels and Amazon Operations); show a red "Amazon disconnected since …" banner from the latest job status; Cloud Scheduler job failure alert in GCP Monitoring once AMZ-PLAN-03 is live.

### AMZ-PLAN-16: Amazon API error and schema hygiene
**Status:** Done 2026-10-22 (FIX-135). Gaps P8, P9. `amazon-operations.route.ts` `fail()` should pass through only known Amazon errors (as `inventoryErrorResponse` does since FIX-129) and answer a generic 500 otherwise. Add `activeOnly` to the `GET /listings` route querystring. Test through Fastify inject (route schemas strip unlisted fields).

### AMZ-PLAN-17: ASIN on Nivaana products for automatic mapping
**Status:** Done 2026-10-22 (FIX-140): `product.asin` + form field + "Same ASIN" Strong suggestion. Not done: EAN, auto-map; ASINs must be filled per product (SQL on UAT / Prod still to run). Original plan: Gap D4. Add an optional `asin` (and optionally EAN) to `product` (migration + product form). On listing import, a listing whose ASIN equals a product's ASIN is suggested as a **Strong** match (or auto-mapped with pack size 1 after confirmation). Mapping table stays — Amazon orders and stock updates are keyed by seller SKU, and one product can have several listings.

### AMZ-PLAN-18: Show data freshness
**Status:** Done 2026-10-22 (FIX-133) for Mappings and Stock Sync. Possible later: the same bar on the Orders / Fulfillment tabs (order import time). Gap D1. Show "Amazon data as of <last successful import>" on Mappings / Stock Sync / Listing details, amber when older than the schedule (e.g. > 12 h), red with the last error when imports are failing.

### AMZ-PLAN-19: Stock Sync tab and dialog redesign
**Status:** Done 2026-10-22 (FIX-134, Esc FIX-142). Before: Done 2026-10-22 (FIX-134), except verifying Esc in the mapping dialog's product search (U8). Gaps U3, U4, U8. Table columns for the Stock Sync tab: Amazon qty, Nivaana (Amazon platform) stock, target, difference, sync mode badge (backend adds the platform stock to the listing list response). Dialog: wide, three figure tiles, Off / Manual / Automatic segmented switch with the current mode, plain-language reason when publishing is blocked (no env names), friendly history. Sync rules unchanged. Also verify Esc handling in the mapping dialog's product search.

### AMZ-PLAN-20: Review Orders and Fulfillment tabs
**Status:** Partly done 2026-10-22: colours / dark mode (FIX-142); full review of data and errors still open. Before: To review. Gaps U5, U6. Same review as Overview / Mappings / Stock Sync: purpose, data sources, UI gaps, theme leftovers in `AmazonOrderHub.tsx` and `AmazonOrderDetailPage.tsx`, error handling.

### AMZ-PLAN-21: Missing Amazon fulfilment features
**Status:** Open (needs backend APIs). Gap U7. Easy Ship cancellation, Amazon shipping document download, product-content editing, listing disable, alert recipients, per-workflow automation controls. These were listed in the old Settings note (removed from the page 2026-10-21).


### AMZ-PLAN-22: Trim Amazon environment variables
**Status:** Done 2026-10-22 (env files: FIX-130 commit; code: FIX-137). Only left: rotate or delete the sandbox app in Seller Central (P14). Found 2026-10-22. **Done 2026-10-22 (not committed):** `AMAZON_REGION` and the five `AMAZON_SANDBOX_*` lines removed from `.env`, `.env.sit`, `.env.uat`, `.env.prod`, `cloudbuildprod.yaml` (release checklist 4e). **Left:** remove the variables and the sandbox code from `env.ts` / services / routes / Inventory; trim lines equal to defaults; rotate or delete the sandbox app. 43 Amazon variables exist; a deployment needs about 9 (`amazon.env.example`).
- **Remove from `env.ts` and every env file / trigger:** `AMAZON_SP_API_BASE_URL`, `AMAZON_AWS_IAM_ROLE_ARN`, `AMAZON_REGION` (never read by code).
- **Security first:** `.env.sit` / `.env.uat` (tracked in git) hold the sandbox app's client secret and refresh token. Remove the lines, then rotate that app's secret or delete the app in Seller Central (git history still has the old values).
- **Remove the sandbox feature:** `AMAZON_SANDBOX_CLIENT_ID`, `_CLIENT_SECRET`, `_REFRESH_TOKEN`, `_SP_API_BASE_URL`, `AMAZON_SANDBOX_CREDENTIAL_SOURCE`, plus `amazon-sandbox-inventory.service.ts`, the `/v1/amazon/sandbox/*` routes in `amazon.route.ts`, the sandbox section of `amazon-integration-status.service.ts`, the non-production branch of `amazon-inventory-sync.service.ts`, and Inventory `AmazonSandboxInventoryTable.tsx` (panel already removed from the page). Sandbox has no real data and its credentials belong to a different Amazon app.
- **Trim `.env.sit`, `.env.uat`, `cloudbuildprod.yaml`** to the sample: drop lines equal to the default.
- **Consider:** rename `AMAZON_AUTO_SYNC_ENABLED` → `AMAZON_STOCK_AUTO_SYNC_ENABLED` (keep the old name as a fallback for one release); keep `AMAZON_ENVIRONMENT` — it is the second lock on writes.
- **Release:** rows in `RELEASE_SCRIPTS_CHECKLIST.md` 4e for each env file change; tests for env parsing and the removed routes (404).


### AMZ-PLAN-24: Automatic stock sending (after go-live)
**Status:** Open (parked 2026-10-22). The per-listing Off / Manual / Automatic choice was removed from the Stock sync dialog (FIX-151) because it confused users; only "Sync stock now" remains. When automatic sending is wanted, decide how to switch it on (one global setting for all mapped self-ship listings, or a per-listing toggle in the table) and keep the one-automatic-listing-per-product rule (FIX-141).

### AMZ-PLAN-23: Move mappings between environments
**Status:** Done 2026-10-22 (FIX-144): `npm run amazon:mappings` (option b). Before: Open. Found 2026-10-22. Mappings live in each database (`marketplace_listings.productId`, `unitsPerListing`, `inventorySyncMode`), so work done on dev / UAT does not reach Prod. Options: (a) map directly on Prod once it reads Amazon; (b) export from UAT (seller SKU → product PUC, pack size) and import on Prod with a script that matches by seller SKU and PUC, dry-run first, and writes the normal mapping audit rows. Product IDs differ between databases, so match by PUC, never by ID.


### AMZ-PLAN-25: Amazon order fulfilment — courier, address, delivery tracking
**Status:** Parked 2026-10-23, waiting for client confirmation (Easy Ship or Self Ship, couriers, booking in Nivaana or not). Full flow, current features, gaps and client questions: [`Amazon_Order_Fulfillment.md`](Amazon_Order_Fulfillment.md). Today the team books the courier outside Nivaana, types the tracking number, and clicks **Confirm shipment to Amazon** (the only status Amazon accepts from the seller; Amazon then tracks delivery via the courier). Missing: courier code is free text (phase 1: dropdown), buyer address not fetched (phase 2: RDT, needs Amazon PII role), no courier booking from the Amazon order (phase 3), no courier webhook for Amazon orders (phase 4: Nivaana-only delivery status, never sent to Amazon), RTO handling (phase 5).
---

## 10. Gap register (2026-10-22)

Every known gap across the Amazon modules, in one list. Severity: **Critical** = Amazon does not work; **High** = wrong numbers / oversell / silent failure; **Medium** = confusing or noisy; **Low** = polish. "Plan" points to section 9. Update the Status column when a gap is closed.

### 10.1 Platform and backend

| # | Gap | Severity | Plan | Status |
| --- | --- | --- | --- | --- |
| P1 | Amazon rejects the app credentials (`invalid_client`) since 2026-10-14; every Amazon call fails | Critical | AMZ-PLAN-01 (runbook 6.1) | ✅ Local fixed 2026-10-22 (FIX-130); GCP secrets pending |
| P2 | No alert when Amazon sync keeps failing — a week of failures went unnoticed | High | AMZ-PLAN-15 | ✅ Fixed 2026-10-22: "Amazon disconnected / sync failing since …" alert on every Amazon tab and the Dashboard (FIX-142); push / email alert not wanted (decision 2026-10-22); GCP Scheduler failure alerts come with P3 |
| P3 | Scheduled work on node-cron: unreliable on Cloud Run, and runs on every developer laptop against the shared dev DB | High | AMZ-PLAN-03, AMZ-PLAN-04 | Endpoints built (FIX-124, not committed); jobs not created |
| P4 | Returns import has no Cloud Scheduler job (Reports API polling too long for one request) | Medium | AMZ-PLAN-05 | ✅ Fixed 2026-10-22 (FIX-143): `POST …/jobs/return-sync`, one step per call; job `amazon-return-sync-<env>` still to create in GCP |
| P5 | Failed jobs are never marked resolved; no backoff on repeated credential errors (~96 failed jobs / day / laptop) | Medium | AMZ-PLAN-06 | ✅ Fixed 2026-10-22 (FIX-132 resolved failures; FIX-136 backoff 15 → 360 min) |
| P6 | Real-time notifications (SQS / EventBridge) not set up; only the scheduled sync updates data | Medium | AMZ-PLAN-09 | Open |
| P7 | Stock is not split when one product has several seller-fulfilled listings; sandbox and production paths disagree | High | AMZ-PLAN-14 | ✅ Fixed 2026-10-22 (FIX-141): only one Automatic listing per product (decision: option a); Stock Sync dialog warns when other listings share the stock; Manual publishing still shows the full number on each listing |
| P8 | Operations API (`amazon-operations.route.ts` `fail()`) returns any error's raw message with status 400 — unknown errors leak internal text and look like client errors | Medium | AMZ-PLAN-16 | ✅ Fixed 2026-10-22 (FIX-135) |
| P9 | `GET /listings` route schema has no `activeOnly`, so Fastify drops it silently (default behaviour happens to match) | Low | AMZ-PLAN-16 | ✅ Fixed 2026-10-22 (FIX-135) |
| P10 | Local `.env` says `AMAZON_ENVIRONMENT=SANDBOX` while the env fallback uses the production account — confusing, and writes need `PRODUCTION` | Low | Section 5a | ✅ Documented 2026-10-22: `AMAZON_ENVIRONMENT=SANDBOX` is the read-only value (anything but PRODUCTION blocks writes; reads use the production account). See `amazon.env.example` |
| P11 | Amazon off on SIT / UAT; SIT on the Prod account read-only not done | Medium | AMZ-PLAN-02 | Decided, not started |
| P12 | Who may authorize a seller account (OAuth is per user and changes that user's data) | Medium | AMZ-PLAN-10 | ✅ Fixed 2026-10-22 (FIX-142): "Authorize Seller Account" hidden — everyone uses the shared account (decision); Disconnect kept for users who authorized earlier |
| P13 | 43 Amazon env variables for one integration (31 lines in `.env.sit`); 3 unused, 5 sandbox-only, most others defaults — hard to deploy and review | Medium | AMZ-PLAN-22 | ✅ Fixed 2026-10-22 (env files trimmed; FIX-137 removed sandbox code and 8 variables, 43 → 35) |
| P14 | **Secrets committed in git:** `.env.sit` and `.env.uat` (tracked) contain `AMAZON_SANDBOX_CLIENT_SECRET` and `AMAZON_SANDBOX_REFRESH_TOKEN` values (a second Amazon app). Production credentials are not in these files. History keeps them even after removal | High | AMZ-PLAN-22 | Removed from the files 2026-10-22 (not committed); **rotate / delete that app in Seller Central** still open |

### 10.2 Data

| # | Gap | Severity | Plan | Status |
| --- | --- | --- | --- | --- |
| D1 | All Amazon numbers on screen are the 2026-10-14 snapshot; the UI does not say how old they are | High | AMZ-PLAN-18 | ✅ Fixed 2026-10-22 (FIX-133: "Amazon data as of …" bar on Mappings / Stock Sync); data refreshed the same day |
| D2 | Amazon orders after 2026-10-14 16:51 IST are not in Nivaana | High | AMZ-PLAN-01 (runbook step 5) | ✅ Caught up 2026-10-22 on the dev DB (46 orders); UAT / Prod when their secrets are updated |
| D3 | 171 of 172 active listings unmapped | High | AMZ-PLAN-08 | 1 mapped (KRA-0049) |
| D4 | No ASIN / barcode on Nivaana products, Amazon SKUs ≠ PUCs → no automatic mapping, suggestions max "Possible" | Medium | AMZ-PLAN-17 | ✅ Fixed 2026-10-22 (FIX-140); ASINs still to be entered per product; SQL on UAT / Prod pending |
| D5 | Dev DB stock is test data but the account is real — any write from local / dev would publish test numbers | High | Section 5a, AMZ-PLAN-04 | Writes off |
| D6 | Nivaana "amazon" platform allocation must be maintained correctly (it is what Stock Sync publishes); e.g. KRA-0049 = 5 vs Amazon 29 | High | Section 5a | Business process |
| D7 | Mappings are stored per database (local+SIT share one; UAT and Prod separate) — mapping done outside Prod does not reach Prod | High | AMZ-PLAN-23 | ✅ Tool ready 2026-10-22 (FIX-144): `npm run amazon:mappings -- export <env>` / `import <env> --file=…` (dry run, then `--apply --confirm=NIVAANA_AMAZON_MAPPINGS`); matches by seller SKU + PUC |
| D8 | All environments use the same live Amazon account — writes or fulfilment from SIT / UAT would change the real listings | High | Section 1a | Writes off outside Prod |

### 10.3 Inventory screens

| # | Module | Gap | Severity | Plan | Status |
| --- | --- | --- | --- | --- | --- |
| U1 | Overview | "Last order import" shows a failed run's time as if fine | Medium | AMZ-PLAN-07 | ✅ Fixed 2026-10-22 (FIX-131: ✅ / ❌ per import) |
| U2 | Overview / Activity | "Needs attention" stays red after recovery | Medium | AMZ-PLAN-06 | ✅ Fixed 2026-10-22 (FIX-132) |
| U3 | Stock Sync tab | Table shows Mappings columns; no Nivaana stock / target / difference / sync mode per row | High | AMZ-PLAN-19 | ✅ Fixed 2026-10-22 (FIX-134) |
| U4 | Stock Sync dialog | No current-mode indicator, 5 buttons in a row, env variable names shown to users, no reason why "Sync stock now" is disabled, raw history enums, narrow modal | Medium | AMZ-PLAN-19 | ✅ Fixed 2026-10-22 (FIX-134) |
| U5 | Orders tab | Not reviewed in detail yet (layout restyled only) | — | AMZ-PLAN-20 | ✅ Reviewed and simplified 2026-10-22 (FIX-153); open question: no stock reservation for mapped orders imported after shipping |
| U6 | Fulfillment tab / Amazon order detail | Not reviewed in detail; remaining non-theme colours in `AmazonOrderHub.tsx`, `AmazonOrderDetailPage.tsx` | — | AMZ-PLAN-20 | ✅ 2026-10-22: dark-mode colours (FIX-142); Fulfillment tab rebuilt as a work queue (FIX-154) |
| U7 | Fulfillment | Not available: Easy Ship cancellation, Amazon document download, product-content editing, listing disable, alert recipients, per-workflow automation controls (no backend APIs) | Medium | AMZ-PLAN-21 | Open |
| U8 | Mapping dialog | Esc in the product search may also close the dialog (not verified) | Low | AMZ-PLAN-19 | ✅ Fixed 2026-10-22 (FIX-142): first Esc closes the product list, the next closes the dialog (before, Esc in the search never closed the dialog) |
| U9 | Mapping | Bulk map applies one product to every selected listing — only right for variants of the same item | Low | — | ✅ Bulk map hidden 2026-10-22 (FIX-150); kept hidden 2026-10-23 after checking the data (repeated-title listings are different fragrances or pack sizes) |
| U10 | Channels page | Shipmozo row makes a live Shipmozo call on every page open; its service does not log out on a portal 401 | Low | — | 401 handling ✅ (FIX-138); the live Shipmozo call on page open is kept — it is what makes the status real |
| U11 | Code | Large multi-component files (`AmazonProductionListingsTable` ~1,680 lines, `AmazonOrderHub` ~1,070) | Low | AMZ-PLAN-11 | Open |
| U12 | Code | Unused Amazon files; old lint / type errors (`.at()`, `any`, useless try/catch in `amazonService.ts`) | Low | AMZ-PLAN-12, AMZ-PLAN-13 | ✅ Fixed 2026-10-22 (FIX-137 unused files; FIX-138 type / lint errors — hook-dependency warnings left on purpose) |

### 10.4 Housekeeping

| # | Gap | Status |
| --- | --- | --- |
| H1 | Work from 2026-10-21 not committed: backend FIX-124 – FIX-129 + docs; Inventory Channels / Amazon Operations UI | ✅ Committed 2026-10-22 (backend `ff24126`, Inventory `3d8da3a`; FIX-124 – FIX-140) |
| H2 | Inventory UI backup branch `backup/amazon-ui-before-redesign-2026-10-21` (pushed) | Keep until the redesign is released |
