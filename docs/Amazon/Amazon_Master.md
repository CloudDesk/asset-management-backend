# Amazon Integration — Master File

One place for everything Amazon (SP-API) in Nivaana: how it works, where it is switched on, what broke, what changed, and what is planned.

**How to use this file**
- Every Amazon fix gets an entry in section 8 here **and** the usual entry in `docs/Fix_After_Sep30/Master.md` (same FIX number).
- Every Amazon env / script / Cloud Scheduler change also gets a row in `docs/RELEASE_SCRIPTS_CHECKLIST.md` section 4e.
- Amazon plans live in section 9 here as `AMZ-PLAN-xx` (not in `docs/Future_Plans.md`).
- Last updated: 2026-10-22. Full gap list: section 10.

---

## 1. Current status (2026-10-21)

| Item | Local / dev DB | SIT | UAT | Prod |
| --- | --- | --- | --- | --- |
| Backend Amazon routes (`AMAZON_INTEGRATION_ENABLED`) | on (default `true`) | **off** (`.env.sit`) | **off** (`.env.uat`) | not set up |
| Inventory Amazon UI (`integrationFeatures.amazon = !isSitEnvironment`) | shown | hidden | shown (backend off → errors) | shown (backend off → errors) |
| `AMAZON_ENVIRONMENT` | `SANDBOX` (value in `.env`; production account credentials used through the env fallback) | `SANDBOX` | `SANDBOX` | — |
| Production writes (`AMAZON_PRODUCTION_WRITES_ENABLED`) | off | off | off | — |
| Order auto-sync (node-cron) | **on** (`.env` `AMAZON_ORDER_AUTO_SYNC_ENABLED="true"`) | off | off | — |
| Cloud Scheduler jobs | none | none | none | none |
| Amazon credentials | **rejected by Amazon since 2026-10-14 13:00 UTC** (`invalid_client`, section 6) | — | — | — |

**Data on the dev DB (`assetmanagement_dev`):** 172 listings (all 172 unmapped), 495 orders, 1,102 FAILED and 1,076 COMPLETED order import jobs; last successful order import 2026-10-14 12:45 UTC.

---

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
| `/api/channels/amazon/jobs` | `amazon-scheduler-jobs.route.ts` | **Cloud Scheduler jobs** (FIX-124): `order-sync`, `listing-sync`, `retry-queue`; header `x-scheduler-secret` |

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

After the first successful run, set the matching node-cron switch to `"false"` in that environment. Prod: create the jobs **paused**. The first 3 Scheduler jobs per billing account are free (Shipmozo already uses one per environment).

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

### 6.1 Amazon rejects the app credentials (`invalid_client`) — open, fix planned 2026-10-22 morning

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

### 6.2 Activity tab always says "Needs attention" — open
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
**Status:** Open, blocking everything else; fix planned 2026-10-22 morning — step-by-step runbook in section 6.1. Get the current LWA client secret (Seller Central → Develop Apps), update `.env` and GCP secrets, re-authorize if `invalid_grant` appears. Write down the secret's expiry date here and add a reminder before the next rotation (Amazon expires LWA client secrets periodically).

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
**Status:** Open. Reports API polling is too long for one request: split into a "request report" job and a "collect finished reports" job (both quick), or keep node-cron for returns on an always-on instance.

### AMZ-PLAN-06: Failure lifecycle and "Needs attention"
**Status:** Open. Mark failed order / listing imports as superseded once a later run succeeds (or count only failures after the last success), so the Activity badge turns green again. Add backoff when the same credential error repeats (today 96 failed jobs a day per laptop).

### AMZ-PLAN-07: Overview shows import status, not just time
**Status:** Open. "Last order import 18:30" should say "Failed" / "Successful" and show the last successful time too.

### AMZ-PLAN-08: Map the 172 unmapped listings
**Status:** Open (business task). Stock sync and seller-fulfilled order processing need mapped SKUs. Mappings tab → bulk map.

### AMZ-PLAN-09: Real-time notifications (SQS / EventBridge)
**Status:** Open. All 5 subscription types show "Setup required"; needs an AWS destination and `AMAZON_NOTIFICATION_*` values. Until then the scheduled sync is the only update path.

### AMZ-PLAN-10: Who may authorize a seller account
**Status:** Open. OAuth connections are per user and change which account that user sees. Decide: hide Authorize Seller Account, or allow only operations admins (`access.operationsAdmin` instead of `access.manageConnection`).

### AMZ-PLAN-11: Split the large Amazon components
**Status:** Open. Move the 5 modals out of `AmazonProductionListingsTable.tsx` and the test-order modal / fulfillment panel out of `AmazonOrderHub.tsx` into their own files, no logic change, before further UI work. `AmazonOrderHub` and `AmazonOrderFulfillmentPanel` are also used by Orders and Amazon order detail.

### AMZ-PLAN-12: Remove unused Amazon frontend files
**Status:** Open. `AmazonAccordionContent.tsx`, `AmazonIntegrationContent.tsx`, `AmazonChannelPage.tsx`, `pages/amazon/AmazonPage.tsx` are not imported anywhere; confirm and delete. Sandbox panel component (`AmazonSandboxInventoryTable`) kept for developers.

### AMZ-PLAN-13: Pre-existing lint / type errors in Amazon frontend
**Status:** Open. `AmazonAttributeFields.tsx` uses `Array.prototype.at` (needs `es2022` lib), `AmazonPublishDraftModal.tsx` has an `any`. Not touched during the UI-only restyle.

### AMZ-PLAN-14: Split stock when one Nivaana product has several seller-fulfilled listings
**Status:** Open (business decision needed). Found 2026-10-21 (FIX-127).
- **Today:** one Nivaana product may be mapped to many Amazon listings. Production automatic stock sync (`amazon-production-inventory.service.ts` → `syncAutomaticPlatformStock`) loops over every mapped FBM / Easy Ship listing with `inventorySyncMode = AUTOMATIC` and publishes `floor(Nivaana Amazon-platform available / pack size)` to **each** — e.g. 10 in stock, single listing shows 10 and pack-of-2 listing shows 5, so up to 20 units can be ordered against 10. The manual preview / sync per listing uses the same full number. The older sandbox path `selectMappedAmazonSellerSku` refuses more than one mapping, so the two paths disagree.
- **Mitigation now:** mapping dialog warning (FIX-127); orders import reduces Nivaana stock and the next automatic sync corrects Amazon, but the gap is the risk window.
- **Options:** (a) only one listing per product may be AUTOMATIC, others manual; (b) split by a share per listing (new `stockSharePercent` on the listing); (c) publish the full number to one "primary" listing and 0 / a reserve to the rest; (d) block a second seller-fulfilled mapping (FBA unaffected). Also make the sandbox and production paths follow the same rule.
- **Touch points:** `marketplace_listings` (new field for b / c), `amazon-production-inventory.service.ts` (`preview`, `syncAutomaticPlatformStock`, `calculateAmazonTargetQuantity`), mapping dialog / Stock Sync tab UI, tests in `amazon-production-inventory*.test.ts`.

### AMZ-PLAN-15: Alert when Amazon sync keeps failing
**Status:** Open. Gap P2. Today a credential failure ran for a week unnoticed. Options: after N consecutive FAILED order / listing imports (or any `AMAZON_INVALID_AUTHORIZATION`), notify (email / in-app banner on Channels and Amazon Operations); show a red "Amazon disconnected since …" banner from the latest job status; Cloud Scheduler job failure alert in GCP Monitoring once AMZ-PLAN-03 is live.

### AMZ-PLAN-16: Amazon API error and schema hygiene
**Status:** Open. Gaps P8, P9. `amazon-operations.route.ts` `fail()` should pass through only known Amazon errors (as `inventoryErrorResponse` does since FIX-129) and answer a generic 500 otherwise. Add `activeOnly` to the `GET /listings` route querystring. Test through Fastify inject (route schemas strip unlisted fields).

### AMZ-PLAN-17: ASIN on Nivaana products for automatic mapping
**Status:** Open. Gap D4. Add an optional `asin` (and optionally EAN) to `product` (migration + product form). On listing import, a listing whose ASIN equals a product's ASIN is suggested as a **Strong** match (or auto-mapped with pack size 1 after confirmation). Mapping table stays — Amazon orders and stock updates are keyed by seller SKU, and one product can have several listings.

### AMZ-PLAN-18: Show data freshness
**Status:** Open. Gap D1. Show "Amazon data as of <last successful import>" on Mappings / Stock Sync / Listing details, amber when older than the schedule (e.g. > 12 h), red with the last error when imports are failing.

### AMZ-PLAN-19: Stock Sync tab and dialog redesign
**Status:** Proposed 2026-10-21, not started. Gaps U3, U4, U8. Table columns for the Stock Sync tab: Amazon qty, Nivaana (Amazon platform) stock, target, difference, sync mode badge (backend adds the platform stock to the listing list response). Dialog: wide, three figure tiles, Off / Manual / Automatic segmented switch with the current mode, plain-language reason when publishing is blocked (no env names), friendly history. Sync rules unchanged. Also verify Esc handling in the mapping dialog's product search.

### AMZ-PLAN-20: Review Orders and Fulfillment tabs
**Status:** To review. Gaps U5, U6. Same review as Overview / Mappings / Stock Sync: purpose, data sources, UI gaps, theme leftovers in `AmazonOrderHub.tsx` and `AmazonOrderDetailPage.tsx`, error handling.

### AMZ-PLAN-21: Missing Amazon fulfilment features
**Status:** Open (needs backend APIs). Gap U7. Easy Ship cancellation, Amazon shipping document download, product-content editing, listing disable, alert recipients, per-workflow automation controls. These were listed in the old Settings note (removed from the page 2026-10-21).

---

## 10. Gap register (2026-10-22)

Every known gap across the Amazon modules, in one list. Severity: **Critical** = Amazon does not work; **High** = wrong numbers / oversell / silent failure; **Medium** = confusing or noisy; **Low** = polish. "Plan" points to section 9. Update the Status column when a gap is closed.

### 10.1 Platform and backend

| # | Gap | Severity | Plan | Status |
| --- | --- | --- | --- | --- |
| P1 | Amazon rejects the app credentials (`invalid_client`) since 2026-10-14; every Amazon call fails | Critical | AMZ-PLAN-01 (runbook 6.1) | Fix planned 2026-10-22 |
| P2 | No alert when Amazon sync keeps failing — a week of failures went unnoticed | High | AMZ-PLAN-15 | Open |
| P3 | Scheduled work on node-cron: unreliable on Cloud Run, and runs on every developer laptop against the shared dev DB | High | AMZ-PLAN-03, AMZ-PLAN-04 | Endpoints built (FIX-124, not committed); jobs not created |
| P4 | Returns import has no Cloud Scheduler job (Reports API polling too long for one request) | Medium | AMZ-PLAN-05 | Open |
| P5 | Failed jobs are never marked resolved; no backoff on repeated credential errors (~96 failed jobs / day / laptop) | Medium | AMZ-PLAN-06 | Open |
| P6 | Real-time notifications (SQS / EventBridge) not set up; only the scheduled sync updates data | Medium | AMZ-PLAN-09 | Open |
| P7 | Stock is not split when one product has several seller-fulfilled listings; sandbox and production paths disagree | High | AMZ-PLAN-14 | Warning added (FIX-127) |
| P8 | Operations API (`amazon-operations.route.ts` `fail()`) returns any error's raw message with status 400 — unknown errors leak internal text and look like client errors | Medium | AMZ-PLAN-16 | Open |
| P9 | `GET /listings` route schema has no `activeOnly`, so Fastify drops it silently (default behaviour happens to match) | Low | AMZ-PLAN-16 | Open |
| P10 | Local `.env` says `AMAZON_ENVIRONMENT=SANDBOX` while the env fallback uses the production account — confusing, and writes need `PRODUCTION` | Low | Section 5a | Open |
| P11 | Amazon off on SIT / UAT; SIT on the Prod account read-only not done | Medium | AMZ-PLAN-02 | Decided, not started |
| P12 | Who may authorize a seller account (OAuth is per user and changes that user's data) | Medium | AMZ-PLAN-10 | Open |

### 10.2 Data

| # | Gap | Severity | Plan | Status |
| --- | --- | --- | --- | --- |
| D1 | All Amazon numbers on screen are the 2026-10-14 snapshot; the UI does not say how old they are | High | AMZ-PLAN-18 | Open |
| D2 | Amazon orders after 2026-10-14 16:51 IST are not in Nivaana | High | AMZ-PLAN-01 (runbook step 5) | Catch-up after the fix |
| D3 | 171 of 172 active listings unmapped | High | AMZ-PLAN-08 | 1 mapped (KRA-0049) |
| D4 | No ASIN / barcode on Nivaana products, Amazon SKUs ≠ PUCs → no automatic mapping, suggestions max "Possible" | Medium | AMZ-PLAN-17 | Open |
| D5 | Dev DB stock is test data but the account is real — any write from local / dev would publish test numbers | High | Section 5a, AMZ-PLAN-04 | Writes off |
| D6 | Nivaana "amazon" platform allocation must be maintained correctly (it is what Stock Sync publishes); e.g. KRA-0049 = 5 vs Amazon 29 | High | Section 5a | Business process |

### 10.3 Inventory screens

| # | Module | Gap | Severity | Plan | Status |
| --- | --- | --- | --- | --- | --- |
| U1 | Overview | "Last order import" shows a failed run's time as if fine | Medium | AMZ-PLAN-07 | Open |
| U2 | Overview / Activity | "Needs attention" stays red after recovery | Medium | AMZ-PLAN-06 | Open |
| U3 | Stock Sync tab | Table shows Mappings columns; no Nivaana stock / target / difference / sync mode per row | High | AMZ-PLAN-19 | Proposed |
| U4 | Stock Sync dialog | No current-mode indicator, 5 buttons in a row, env variable names shown to users, no reason why "Sync stock now" is disabled, raw history enums, narrow modal | Medium | AMZ-PLAN-19 | Proposed |
| U5 | Orders tab | Not reviewed in detail yet (layout restyled only) | — | AMZ-PLAN-20 | To review |
| U6 | Fulfillment tab / Amazon order detail | Not reviewed in detail; remaining non-theme colours in `AmazonOrderHub.tsx`, `AmazonOrderDetailPage.tsx` | — | AMZ-PLAN-20 | To review |
| U7 | Fulfillment | Not available: Easy Ship cancellation, Amazon document download, product-content editing, listing disable, alert recipients, per-workflow automation controls (no backend APIs) | Medium | AMZ-PLAN-21 | Open |
| U8 | Mapping dialog | Esc in the product search may also close the dialog (not verified) | Low | AMZ-PLAN-19 | To verify |
| U9 | Mapping | Bulk map applies one product to every selected listing — only right for variants of the same item | Low | — | Tooltip explains it |
| U10 | Channels page | Shipmozo row makes a live Shipmozo call on every page open; its service does not log out on a portal 401 | Low | — | Open |
| U11 | Code | Large multi-component files (`AmazonProductionListingsTable` ~1,680 lines, `AmazonOrderHub` ~1,070) | Low | AMZ-PLAN-11 | Open |
| U12 | Code | Unused Amazon files; old lint / type errors (`.at()`, `any`, useless try/catch in `amazonService.ts`) | Low | AMZ-PLAN-12, AMZ-PLAN-13 | Open |

### 10.4 Housekeeping

| # | Gap | Status |
| --- | --- | --- |
| H1 | Work from 2026-10-21 not committed: backend FIX-124 – FIX-129 + docs; Inventory Channels / Amazon Operations UI | Commit to `DEV-NEW` (per commit workflow) before further changes |
| H2 | Inventory UI backup branch `backup/amazon-ui-before-redesign-2026-10-21` (pushed) | Keep until the redesign is released |
