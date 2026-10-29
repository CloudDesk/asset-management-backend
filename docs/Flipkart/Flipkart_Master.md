# Flipkart Integration — Master File

One place for Flipkart status, credentials, decisions and the build plan (FKT-PLAN-xx). Built the same way as Amazon ([Amazon_Master.md](../Amazon/Amazon_Master.md)). Fix log entries still go in [Master.md](../Fix_After_Sep30/Master.md).

## 1. Current status (2026-10-29)

| Item | State |
| --- | --- |
| Code on `DEV-NEW` | Base setup from `Flipkart-Integration` (FIX-2026-10-29-175): tables, mock client, mapping, stock preview, order reservations, Inventory workspace (Overview, Listings & Mapping, Stock Sync, Orders, Fulfillment, Activity). |
| Seller Hub app | **Self Access** app "Nivaana Inventory", status **Approved**, never expires (Seller Hub → Manage Profile → Developer Access). |
| Credentials in local `.env` | `FLIPKART_APP_ID`, `FLIPKART_APP_SECRET` set. **Connection test passed 2026-10-29**: token scope `Seller_Api`, seller ID `3b08d2518bc0424b` found from live listings (`/listings/v3/product/search`). |
| Real API calls | Connection test and listing reads (FKT-PLAN-02, `LiveFlipkartSellerApiClient`). Stock and order calls answer "not built yet" (501) until FKT-PLAN-03 / 04 / 05. |
| Feature switch | `FLIPKART_INTEGRATION_ENABLED` (backend, default off; on in local `.env`) and `integrationFeatures.flipkart` (Inventory: local dev + SIT, hidden on UAT / Prod) — FKT-PLAN-01. |
| Shared dev DB | MOCK listings / shipments from the branch are hidden when mock mode is off; `npm run flipkart:clear-mock` removes them (dry run done, not applied). Saved connection row: PRODUCTION, CONNECTED. |

## 2. Credentials and settings

| Setting | What it is | Where it comes from | Needed for |
| --- | --- | --- | --- |
| `FLIPKART_APP_ID` | Self Access "API Key" | Seller Hub → Developer Access | everything |
| `FLIPKART_APP_SECRET` | Self Access secret ("Copy Secret") | same | everything |
| `FLIPKART_SELLER_ID` | Optional; found automatically (`3b08d2518bc0424b`) | connection test | — |
| Location ID (`LOC…`) | Flipkart warehouse / pickup location; required on every stock update | **found in listing details: one location `LOCf859a88d49c54d04846571124f047535`** (ENABLED) | stock sync (P3), order actions |
| `FLIPKART_MOCK_MODE` | `true` = simulated data only | env | off once the real client exists |
| `FLIPKART_INVENTORY_WRITES_ENABLED` | Allows real stock / order writes | env | **Prod only** (decision D2) |
| Scheduler secret (P3) | Header secret for Cloud Scheduler jobs, like `AMAZON_SCHEDULER_SECRET` | `openssl rand -hex 24`, one per environment | order / listing auto-sync |

Rules: same live account for every environment (one seller, four databases). Secrets never go in the Inventory, Git or chat; SIT / UAT / Prod read them from Secret Manager like the UAT Amazon secrets. Self Access credentials must not be shared with any third party (Seller Hub warning: account deactivation).

## 3. Decisions (2026-10-29)

| # | Decision |
| --- | --- |
| D1 | Fulfilment: support all three like Amazon — **Flipkart pickup** (seller-fulfilled, Flipkart label), **Self Ship** (Ekart / Shipmozo / manual tracking), **FBF** (Flipkart warehouse; stock owned by Flipkart, no Nivaana reservation). User to confirm which are actually used. |
| D2 | **Writes from Prod only.** Dev / SIT / UAT read listings and orders but never send stock or order actions to Flipkart. |
| D3 | New product column for the Flipkart catalogue ID, like `product.asin`: `product.fsn` (Flipkart Serial Number), used for strong-match mapping. Seller SKU is matched to PUC as well when equal. |
| D4 | Combo listings follow the Amazon approach (AMZ-PLAN-27): listing mapped to a combo product, stock = min of components, orders reserve each component. |

## 4. What exists vs Amazon

| Area | Amazon (done) | Flipkart base setup | Gap |
| --- | --- | --- | --- |
| Connection / status | LWA token, diagnostics, status page | Token + seller discovery (real) | Save result in `flipkart_connections`, show on Overview |
| Feature switch | `AMAZON_INTEGRATION_ENABLED`, `integrationFeatures.amazon` | none | add both |
| Listings import | real, paged, scheduler | mock only | real client: listing search by state, paging, prices, locations |
| Mapping | SKU / PUC / ASIN suggestions, strong match, combo map | manual map, units per listing | `product.fsn`, suggestions, combo map |
| Stock sync | preview → send, write guard, history, auto mode | preview + mock apply | real `updateInventory` (≤10 SKUs per call, per location), Prod write guard, combo stock |
| Orders | import, scheduler, reservations, combo reserve | mock import, reservations | real shipment search / details, scheduler job, combo reserve |
| Fulfilment | Easy Ship, Self Ship (Ship now via Ekart / Shipmozo), labels | mock pack / RTD / self-ship | real pack (invoice), label PDF, RTD, self-ship dispatch + delivered |
| Sale → stock units | AMZ-PLAN-28 units marked sold | counters only | same unit marking |
| Returns | return service, restock / damaged | none | returns import + receive |
| Scheduled work | Cloud Scheduler jobs | none | order / listing / retry jobs |

## 5. Build plan (one phase at a time)

| Plan | Scope | Writes to Flipkart? |
| --- | --- | --- |
| **FKT-PLAN-01** Safety and connection — ✅ implemented 2026-10-29 (FIX-176, not committed) | `FLIPKART_INTEGRATION_ENABLED` (backend) + `integrationFeatures.flipkart` (Inventory); hide mock buttons when not in mock mode; Overview "Test connection" with saved result; clear dev-DB mock rows (script, dry run first) | no |
| **FKT-PLAN-02** Real listings import — ✅ implemented 2026-10-29 (FIX-177, not committed; 287 live listings imported on dev DB) | Real client listing search (all states, paging); store listings, prices, locations (gives the Location ID); `product.fsn` SQL + product form field; mapping suggestions (SKU = PUC, FSN) | no |
| **FKT-PLAN-02b** Combo mapping | 148 of 238 active listings are mixed combos (e.g. `Auora_VaniVaniJungle_Pack3` = 2 × Vanilla + 1 × Jungle Vibe). Reuse Amazon "Map as combo" (FIX-171: find or create the combo product from products × quantity) for Flipkart listings, so stock and orders use components | no |
| **FKT-PLAN-03** Stock sync | Real inventory update per location, preview → confirm → send, Prod-only write guard, history; combo stock | yes (Prod) |
| **FKT-PLAN-04** Order import | Real shipment search + details, reservations (combo aware), scheduler job, FBF orders shown but not reserved | no |
| **FKT-PLAN-05** Fulfilment | Pack with invoice, label PDF, Ready to dispatch; Self Ship dispatch via Ekart / Shipmozo and delivered | yes (Prod) |
| **FKT-PLAN-06** Sold units and returns | Mark units sold on dispatch (like AMZ-PLAN-28); returns import, restock / damaged | no / yes |

Each phase: Master.md FIX entry, checklist rows for SQL / env changes, tests, and a short change-log line below.

## 5a. Seller API endpoints in use

| Purpose | Call | Notes |
| --- | --- | --- |
| Token | `GET /oauth-service/oauth/token?grant_type=client_credentials&scope=Seller_Api` (Basic app ID:secret) | ~30 days validity, cached |
| Listing search | `POST /listings/v3/product/search` `{ batchNo, internalState }` | 20 per batch; `productId` = FSN; states ACTIVE, INACTIVE, READY_FOR_ACTIVATION, INACTIVATED_BY_FLIPKART, ARCHIVED |
| Listing details | `GET /sellers/listings/v3/{sku1,sku2,…}` | up to 10 SKUs; price, tax, `fulfillment_profile`, `locations[]` with stock |

Live account 2026-10-29: 238 active, 41 inactive, 1 ready for activation, 1 inactivated by Flipkart, 6 archived; all checked listings `NON_FBF`, shipping provider FLIPKART (Flipkart pickup).

## 6. Open questions

- Which fulfilment types are really used (D1)? Answer decides whether FKT-PLAN-05 starts with Flipkart pickup or Self Ship.
- Location ID(s): one so far (`LOCf859…`); the full import will confirm.

## 7. Change log

### 2026-10-29: Flipkart base setup on DEV-NEW; real credentials verified
FIX-2026-10-29-175 brought the branch to `DEV-NEW`. Connection test with the Self Access app passed (seller `3b08d2518bc0424b`). Decisions D1–D4 recorded; plan FKT-PLAN-01 … 06.

### 2026-10-29: FKT-PLAN-01 — switch, connection status, mock data apart (FIX-2026-10-29-176)
Backend switch `FLIPKART_INTEGRATION_ENABLED`; Inventory flag `integrationFeatures.flipkart`; Overview "Test connection" saved in `flipkart_connections`; screens show only the current mode's rows; `flipkart:clear-mock` script. SIT merge needs the 4e settings in `.env.sit`.

### 2026-10-29: FKT-PLAN-02 — live listings import, product FSN, suggestions (FIX-2026-10-29-177)
Live client reads listings (search + details); Import listings stores them as PRODUCTION with price, HSN / GST, fulfilment and location stock; `product.fsn` (SQL on Dev/SIT); mapping suggestions with Same FSN and pack hint. Read only.
Live import on dev DB: 287 listings (238 active, 49 inactive), one location `LOCf859…` with 12,363 units; 85 s after batching. 148 active listings look like combos → FKT-PLAN-02b (combo mapping) recommended before stock sync.
