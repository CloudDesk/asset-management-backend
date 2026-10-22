# Amazon integration — what changed, 21–22 Oct 2026 (before → after)

One place to see how the Amazon integration looked before this round of work and what it looks like now.
Per-fix details stay in [`Fix_After_Sep30/Master.md`](../Fix_After_Sep30/Master.md) (FIX-2026-10-21-124 … FIX-2026-10-22-158)
and the running log in [`Amazon_Master.md`](Amazon_Master.md) section 8. Branch: `DEV-NEW` in both repos, **committed locally, not pushed**.

**Repositories:** backend `asset-management-backend`, Inventory `asset_management_frontend_aromazen`.
**Safety net:** UI before the redesign is on branch `backup/amazon-ui-before-redesign-2026-10-21` (Inventory, pushed).

---

## 1. Starting point (21 Oct morning)

| Area | State |
| --- | --- |
| Branches | Amazon work on `amazon-ui-port` (Inventory) and `Amazon/Feature` (backend); merged into `DEV-NEW` after a backup branch |
| Amazon connection | **Broken since 14 Oct 13:00 UTC**: Amazon rejected the app credentials (`invalid_client`); every import failed every 15 minutes (1,102 failed order import jobs), unnoticed for a week |
| Data (dev DB) | 172 listings, **0 mapped**; 495 orders, last import 14 Oct |
| Scheduling | node-cron inside the backend (unreliable on Cloud Run, also ran on every developer laptop against the shared dev DB) |
| Environment | 43 Amazon env variables incl. an unused sandbox app (sandbox secrets committed in `.env.sit` / `.env.uat`) |
| UI | Amazon pages in a different style from the rest of Inventory; duplicated Channels entry in the sidebar; Settings / Developer tools / "Recommended next action" on the Amazon page; many technical words |

---

## 2. Before → after, by area

### 2.1 Connection and credentials
| Before | After | Fix |
| --- | --- | --- |
| Credentials rejected since 14 Oct; no alert | New LWA client secret + refresh token in local `.env`; 172 listings imported, 46 missed orders caught up | 130 |
| Channels / Overview showed "Environment configured" (only checked that values exist) | Live check: Connected / Connected · sync failing / Connection failed (since …) / Amazon unreachable / Not configured / Disabled, with Amazon's reason; button **Test connection** | 131, 149 |
| A failed run kept "Needs attention" on even after Amazon worked again | Failures followed by a successful run of the same kind are resolved | 132 |
| Scheduled order sync failed every 15 min while credentials were rejected (744 failed jobs in the outage) | Backs off 15 → 30 → 60 … ≤ 360 min after repeated credential failures (manual sync never blocked); replay: 744 → 35 | 136 |
| Nobody saw failures outside the Overview card | Red / amber **"Amazon disconnected / sync failing since …"** alert on every Amazon tab and on the Dashboard | 142 |
| "Authorize Seller Account" (per-user OAuth) on the page | Hidden: everyone uses the shared account from env; Disconnect kept for earlier authorizations | 142 |
| Sandbox app, sandbox routes, Developer tools panel, 8 unused env variables | Removed (env 43 → 35); outside `AMAZON_ENVIRONMENT=PRODUCTION` stock is never sent | 137 |

### 2.2 Scheduling (backend)
| Before | After | Fix |
| --- | --- | --- |
| node-cron only | Cloud Scheduler endpoints with `x-scheduler-secret`: `POST /api/channels/amazon/jobs/order-sync`, `/listing-sync`, `/retry-queue`, `/return-sync`; node-cron stays behind its env switches | 124, 143 |
| Returns import polled up to 5 min in one request | `/return-sync` does one quick step per call (request report / collect when ready) | 143 |
| A listing import cut off by a server restart stayed "Running" forever | Runs still RUNNING after 30 min are closed as "Interrupted" on startup and before each import | 156 |

### 2.3 Amazon Operations page (layout)
| Before | After | Fix |
| --- | --- | --- |
| Own colours, large header blocks, Settings tab, Developer tools, "Recommended next action" | Nivaana theme, title + subtitle, tabs **Overview · Mappings · Stock Sync · Orders · Fulfillment · Activity** | UI 21 Oct |
| Full-width "Amazon data as of …" bar on Mappings / Stock Sync | Small line at the end of the tab bar: "Updated 14:37 · 33 min ago" (amber after 12 h, red when the refresh failed) | 133, 147 |

### 2.4 Overview tab
| Before | After | Fix |
| --- | --- | --- |
| Tiles Listings 172 · Unmapped 171 · Orders 521 · Exceptions · Retry queue | **Listings 171** (+1 incomplete) · **Unmapped 170** · **Amazon orders 518** · **Orders needing attention** (red, opens Activity) — matches Seller Central | 145, 146, 149 |
| 3 Nivaana test orders counted as Amazon orders | Test orders (`TEST-AMZ-…`) excluded | 145 |
| A listing with no price (`NIV_CIH_PACK`) counted, Seller Central does not | Counted separately as "Incomplete (no price yet)" | 146 |
| Retry queue tile (technical) | Moved to Activity | 145 |

### 2.5 Mappings tab
| Before | After | Fix |
| --- | --- | --- |
| Title / description block, Identifiers column, `INR 1599`, raw statuses (`DISCOVERABLE,BUYABLE`) | One toolbar row; SKU \| ASIN under the title; `₹1,599`; status only when something is wrong; icon buttons Details / Map / Edit / Remove | UI 21 Oct |
| Search only on Enter; filters reloaded silently; icon-only clear button; "Refresh" | Search after 3 characters while typing; table dims while loading; **Clear filters** link; **Get latest listings** | 148, 149 |
| Mapping dialog: suggestions cut at 30 unordered candidates, list always open, "units per listing" | All suggestions scored (brand / filler words ignored, rare words weigh more, max 4, min score 25); autocomplete search with paging; **Pack size** | 125, 126 |
| No warning when a product is already mapped to other listings | Warning lists the other SKUs and the shared-stock risk | 127 |
| Mapping history showed user IDs | Names and product codes ("None → KRA-0049 · by Harish Raja") | 128 |
| No ASIN on Nivaana products | Optional **Amazon ASIN** on products (create / edit / detail); same ASIN = HIGH suggestion ("Same ASIN") | 140 |
| Bulk map (one product + one pack size for many listings) | Hidden (`BULK_MAPPING_ENABLED = false`) — each listing is its own product / pack | 150 |
| Listings without a price shown like any other | **Incomplete** badge and filter "Incomplete (no price)" | 146 |
| Opening Mappings for one SKU from elsewhere: not possible | `?tab=mappings&q=<SKU>` opens it already searched (used by "Map listing" on the order page) | 158 |

### 2.6 Stock Sync tab and dialog
| Before | After | Fix |
| --- | --- | --- |
| Table showed Amazon qty only; mapping filter (All / Unmapped / Mapped / Conflict) | Columns Amazon qty · **Nivaana stock** · **Target** · **Difference** · **Last sent**; mapped listings only | 134, 151 |
| Generic 500 "Amazon request failed" | Amazon's own error and `AMAZON_*` code | 129 |
| Off / Manual / Automatic choice (first a switch, then cards) — confused users; "Sync stock now" only worked on Manual | Choice removed: **Sync stock now** works for any mapped self-ship listing when writes are on; automatic sending parked (AMZ-PLAN-24) | 151 |
| Several self-ship listings of one product could all sync automatically (oversell) | Only one Automatic listing per product; dialog warns about listings sharing the stock | 141 |
| History filled with a "Preview" row on every dialog open, no names | Only real sends: "Amazon 29 → 5 · Synced by Harish Raja · Confirmed · Today, 16:28" | 151 |
| After Sync, the open dialog kept "Amazon is updating" and the old number | Re-checks Amazon every 20 s while waiting; "Amazon updated" or "has not applied the update" after 15 min | 152 |
| "Preview stock (N)" bulk send with checkboxes | Hidden (`BULK_STOCK_SYNC_ENABLED = false`) — one listing at a time | 151 |
| Listings without a price could be sent | Refused: "Set a price in Seller Central first" | 146 |
| **First live send:** 22 Oct 16:28 IST, KRAFT-PARROTPAIR-HOMEDECOR 29 → 5, accepted and applied by Amazon | — | test |

### 2.7 Orders (Amazon Operations → Orders, Orders module, order page)
| Before | After | Fix |
| --- | --- | --- |
| Amazon orders in 3 places: Amazon Operations → Orders (summary), Orders → Amazon → Overview, Orders → Amazon → Orders | **One place:** Amazon Operations → Orders = overview tiles + the full list on one page | 153, 157, 158 |
| Orders module had Nivaana / Amazon / Flipkart tabs (Flipkart = "not configured" placeholder) | Orders module lists **Nivaana orders only**, with an "Amazon orders →" link; old `/orders?tab=amazon` links redirect | 157 |
| Order list: own style, Apply button, monospace IDs, repeated status, "Amazon-managed", Test order + unlabelled refresh + big "Import all order history" | Mappings-style toolbar (search while typing, filters apply at once, Clear filters, one 🔄), columns Order · Purchased · Units · Amount · Amazon status · Shipping · In Nivaana, row opens the order | 157 |
| Tiles: total, last-sync counts, "Need mapping from last sync", schedule, trigger | Amazon orders · Waiting to ship · **Need mapping (all-time)** · Last import | 153 |
| "Import all order history" on daily screens, no confirmation | Activity → **Import all orders again** (admins, explained, confirmation) | 157 |
| Order page: "Nivaana status: Amazon Easy Ship" for every Easy Ship order, Courier / Tracking "Not assigned" on shipped Easy Ship orders, Easy Ship 3×, total 2×, long dates | One Amazon and one Nivaana badge (real state), Shipping / Ship by / Tracking tiles that are always true, **Next step** line with its link (e.g. **Map listing**), actions only when needed, short dates | 158 |
| Orders with **no items** (235 from the July full-history import) shown as "Easy Ship ready" or "Needs mapping" | **Items missing** everywhere (import, routing, list, queue, order page) | 156 |

### 2.8 Fulfillment tab
| Before | After | Fix |
| --- | --- | --- |
| The same full order list again, opened on FBM / Self Ship → only the 3 test orders (all real orders are Easy Ship) | **Work queue:** only orders still to ship, soonest ship-by first; tiles To ship · Due in 24 hours · Late; each row's **Next step** button (Book pickup / Pickup booked / Pick / Pack / Add tracking / Confirm to Amazon / Link listing / Items missing); "Nothing to ship right now" | 154 |

### 2.9 Activity tab
| Before | After | Fix |
| --- | --- | --- |
| Duplicate counts, connection and schedules; real-time updates table (all "Not configured"); request capacity; "Sync orders now" | Hidden (on Overview, or not set up) | 155 |
| "Recent activity" filled by 15-minute imports and per-listing import rows; no names; stock sends missing | **Needs attention** first (failures + Retry); **Recent activity** = one line for automatic imports + real events with who (stock sent, mappings, imports); **Export reports**; admins: **Import all orders again**, **Stock updates to Amazon** (On / Paused / Off on this server, Pause / Resume with reason) | 155, 157 |

### 2.10 Channels page and other
| Before | After | Fix |
| --- | --- | --- |
| Channels listed twice in the sidebar; Amazon / Flipkart / Ekart as separate blocks | One Channels entry; accordion rows incl. new **Shipmozo** row (config + live check) | UI 21 Oct |
| Shipmozo expired login ignored | Logs out on 401 like Ekart | 138 |
| Operations API returned internal error text | Amazon / validation errors pass through; anything else a generic 500 | 135 |
| Inventory Amazon files had type / lint errors | Fixed | 138 |

### 2.11 Release tooling and data moves
| Before | After | Fix |
| --- | --- | --- |
| SQL scripts run by hand per DB, no record | `npm run db:sql -- <sit\|uat\|prod>` (status by default, `--apply`, Prod needs `--confirm=NIVAANA_PROD_SQL`, checks the DB name, records runs in `release_ops.sql_script_log`) | 139 |
| — | `scripts/migrations/20261022_add_product_asin.sql` (nullable `product.asin` + index) — **applied on SIT 22 Oct** | 139, 140 |
| Mappings exist only in the DB they were made in | `npm run amazon:mappings -- export <env>` / `import <env> --file=…` (dry run, then `--apply --confirm=NIVAANA_AMAZON_MAPPINGS`), matched by seller SKU + PUC | 144 |

---

## 3. Removed or hidden (and where it went)

| Removed / hidden | Why | Where now / how to bring back |
| --- | --- | --- |
| Settings tab, Developer tools, Recommended next action | Duplicated or developer-only | Folded into Overview |
| Sandbox feature + 8 env variables | No real data; separate unused app | Deleted (FIX-137) |
| Authorize Seller Account | Shared account only | Hidden; Disconnect kept |
| Bulk map, Preview stock (bulk) | One listing at a time is safer | `BULK_MAPPING_ENABLED`, `BULK_STOCK_SYNC_ENABLED` |
| Off / Manual / Automatic choice | Confusing; automatic not wanted yet | AMZ-PLAN-24 |
| Retry queue tile, duplicate counts, real-time updates table, request capacity, "Sync orders now" | Duplicates / not configured / technical | Activity (retries), Overview (counts) |
| Orders → Amazon tab, Overview / Orders sub-tabs, Flipkart tab | Three places for the same orders; Flipkart not connected | Amazon Operations → Orders |
| Test order button on lists | Development tool | Still on the order page for test orders (local only) |
| "Import all order history" on daily screens | Rare repair action | Activity → Import all orders again (admin) |
| Mode-change history rows | Only real sends matter | Not recorded |

---

## 4. Decisions taken (21–22 Oct)

| Decision | Fix / plan |
| --- | --- |
| Scheduled Amazon work runs on GCP Cloud Scheduler; node-cron only behind env switches | 124 |
| One live Amazon account for all environments; writes only from Prod (one controlled single-listing test on UAT allowed) | Amazon_Master 1a |
| Stock split: only one Automatic listing per product (option a) | 141 |
| Alerts: in-app banner only (no email) | 142 |
| Authorize Seller Account hidden | 142 |
| Bulk map and bulk stock send hidden | 150, 151 |
| No per-listing sync mode on screen; automatic sending parked | 151, AMZ-PLAN-24 |
| Listings without a price count as "Incomplete", like Seller Central | 146 |
| Amazon orders live only in Amazon Operations → Orders; Orders module = Nivaana orders | 157, 158 |

---

## 5. Commits (DEV-NEW, local, not pushed)

| Backend | Inventory | Fixes |
| --- | --- | --- |
| `76546ec` | `a575922` | 124–129 + UI redesign |
| `87aab77` | `16d3d80` | 130–132 |
| `ff24126` | `3d8da3a` | 133–140 |
| `2b7e6ba` | `a3fb483` | 141–144 |
| `3a933b0` | `1b132ab` | 145 |
| `ad309e7` | `ece2373` | 146 |
| `fe9cc6e` (docs) | `21bf29e` | 147–150 |
| `3ffffb3` | `9d82a74` | 151 |
| `cf23666` | `350db43` | 152 |
| `8cef62e` (docs) | `d7889f8` | 153 |
| `121215b` (docs) | `621bbc7` | 154 |
| `7690c76` | `3112991` | 155 |
| `975808a` | `e146c36` | 156–157 |
| `a4e873d` (docs) | `32b1d68` | 158 |
| `a579bf3` "env update" (made by the user: `.env.sit`, `.env.uat`) | — | — |

Backend tests at the end: 543 pass. Inventory: no new type or lint errors (94 old type errors elsewhere).

---

## 6. Where things stand (22 Oct evening)

| Item | Local / dev DB (shared with SIT) | SIT | UAT | Prod |
| --- | --- | --- | --- | --- |
| Amazon credentials | **Working** (new secret + refresh token in `.env`) | old GCP secret | old GCP secret | old GCP secret |
| `AMAZON_INTEGRATION_ENABLED` | on (default) | off | off | — |
| Writes (`AMAZON_ENVIRONMENT` + `AMAZON_PRODUCTION_WRITES_ENABLED`) | **on — for the stock test; switch back to `SANDBOX` / `"false"`** | off | off | PRODUCTION |
| `AMAZON_ORDER_AUTO_SYNC_ENABLED` (node-cron) | **on — should be `"false"` on a laptop** | off | off | — |
| ASIN SQL (`20261022_add_product_asin.sql`) | ✅ applied | ✅ (same DB) | ⬜ | ⬜ |
| Cloud Scheduler jobs | — | ⬜ | ⬜ | ⬜ |
| Listings / mappings | 172 (171 priced + 1 incomplete), 1 mapped (KRA-0049) | same DB | own DB | own DB |
| Orders | 518 real; 235 without items (fix: Activity → Import all orders again) | same DB | own DB | own DB |

---

## 7. Still open

| What | Who | Ref |
| --- | --- | --- |
| Rotate the Amazon secrets that were pasted in chat (client secret, refresh token, token encryption key) and put the new ones in GCP for SIT / UAT / Prod | User (Seller Central + GCP) | P1, P14 |
| Delete or rotate the old sandbox app in Seller Central | User | P14 |
| Create Cloud Scheduler jobs (order-sync, listing-sync, retry-queue, return-sync) per environment | User (GCP) | P3, RELEASE_SCRIPTS_CHECKLIST 4e |
| Run `npm run db:sql -- uat` / `prod` before deploying the backend there | User | Release checklist 4b |
| Run Activity → Import all orders again once per DB (fills the 235 orders without items) | User | FIX-156 |
| Map the 170 priced listings (on Prod, or map on UAT and move with `amazon:mappings`) | Business | D3, D7 |
| Set correct Nivaana "amazon" stock before any sync (e.g. KRA-0049: Nivaana 5 vs Amazon 29; Amazon now shows 5 after the test) | Business | D6 |
| Switch SIT / UAT Amazon on (read-only) when wanted | User | P11 |
| Real-time notifications (AWS SQS / EventBridge) | Later | P6 |
| Automatic stock sending | Later | AMZ-PLAN-24 |
| Missing features: Easy Ship cancellation, document download, listing disable, … | Later | U7 |
| Split the large Amazon component files | Later | U11 |
| Push `DEV-NEW` and promote to SIT → UAT → Prod | User | — |
