# 21 · Amazon Integration — End-to-End Flow

**Version:** 1.0 · **As of:** 2026-10-28 · **Built from:**
- backend `DEV-NEW` code: `amazon-*` services, `amazonStockTarget.ts`, `amazon-production-inventory.service.ts`, `amazon-order-routing.service.ts`, `amazon-order-shipping.service.ts`, `amazon-return.service.ts`, `amazon-scheduler-jobs.route.ts`
- `docs/Amazon/Amazon_Master.md` (environments, runbook, decisions, AMZ-PLAN-xx)
- `docs/Amazon/Amazon_Order_Fulfillment.md` (client decisions of 2026-10-26)

The rules list is in [11_Amazon_Marketplace.md](11_Amazon_Marketplace.md). This file shows the **flow from start to finish**: what the team does, what runs automatically, and what changes in Nivaana and on Amazon at each step.

```
1 Connect ─► 2 Import listings ─► 3 Map listing → product ─► 4 Stock sync (Nivaana → Amazon)
                                                              │
5 Import orders (every 15 min) ─► 6 Route by type ─┬─ FBA ─────────► read only, sold when Amazon ships
                                                    ├─ Easy Ship ───► pack → Amazon picks up → sold on "Shipped"
                                                    └─ Self Ship ───► Ship now (Ekart/Shipmozo/Manual) → confirm to Amazon → sold
7 Import returns ─► receive at warehouse ─► restock or quarantine
8 Operations: alerts, retries, activity, schedulers
```

---

## Step 0 — Switches per environment

| Switch | Meaning |
| --- | --- |
| `AMAZON_INTEGRATION_ENABLED` | Amazon backend routes exist |
| Inventory `integrationFeatures.amazon` | Amazon screens shown |
| `AMAZON_ENVIRONMENT=PRODUCTION` + `AMAZON_PRODUCTION_WRITES_ENABLED=true` + no emergency pause | **Any write to Amazon** (stock, price, listing edit, Shipped confirmation, Easy Ship) |
| `AMAZON_LISTING_EDIT_ENABLED`, `AMAZON_LISTING_CREATION_ENABLED` | Price / listing edits and new listings |
| `AMAZON_AUTO_SYNC_ENABLED` | Automatic stock push. **Off** until AMZ-PLAN-24. |

There is **one live Amazon seller account** and four databases. The current state per environment is in `Amazon_Master.md` §1. Reads never change Amazon.

---

## Step 1 — Connect

| # | What | Who | Result |
| --- | --- | --- | --- |
| 1.1 | Server account | Env: `AMAZON_CLIENT_ID / SECRET / REFRESH_TOKEN / SELLER_ID` | Used by everyone ("Using server credentials") |
| 1.2 | Optional per-user account | **Authorize Seller Account**: Amazon OAuth in a new tab → `/amazon/callback`; the token is stored encrypted | That user sees that seller's data |
| 1.3 | Check | **Test connection** (`GET /api/channels/amazon/connection-check`) gets a real token and reads the last imports | Badge: Connected / Disconnected / Sync failing |
| 1.4 | Alert | Automatic | "Amazon disconnected / sync failing since …" on Amazon tabs and the Dashboard |

When credentials are rejected (e.g. the LWA secret expired), the scheduled order sync **backs off** 15 → 30 → 60 … 360 min. Any success resets it.

---

## Step 2 — Import listings

| # | What | Who / trigger | Result in Nivaana | On Amazon |
| --- | --- | --- | --- | --- |
| 2.1 | Import all listings (SKU, ASIN, title, price, quantity, status, FBA / FBM) | **Get latest listings**, or Cloud Scheduler `POST /api/channels/amazon/jobs/listing-sync` | `MarketplaceListing` rows, mapping `UNMAPPED` | Nothing |
| 2.2 | Freshness | Automatic | "Updated 14:37 · 33 min ago" in the tab bar | — |
| 2.3 | Counts | Automatic | Unpriced (incomplete) listings counted the way Seller Central counts them | — |

---

## Step 3 — Map listing → Nivaana product

| # | What | Who | Result |
| --- | --- | --- | --- |
| 3.1 | Open Map on a listing | Team (`amazon_mapping`) | Suggestions: key words, same ASIN, minimum score 25, at most 4; product search 25 per page |
| 3.2 | Choose product and **units per listing** (pack size) | Team | Listing → `MAPPED` to the product. **Only Nivaana metadata changes**; no stock moves on either side. |
| 3.3 | Warning | Automatic | Shown if the product is already mapped to other listings |
| 3.4 | History | Automatic | Mapping audit with user name and PUC |
| 3.5 | Move mappings between databases | Developer: `npm run amazon:mappings -- export / import <env>` (dry run first) | Same mappings in SIT / UAT / Prod |

Unmapped SKUs **block** their orders (Step 6).

---

## Step 4 — Stock sync (Nivaana → Amazon)

Applies only to **mapped, seller-fulfilled** listings (Easy Ship / Self Ship). FBA is read-only.

| # | What | Rule |
| --- | --- | --- |
| 4.1 | Source quantity | Nivaana **Amazon platform stock** `availableqty` for the mapped product. A combo uses what its components allow. |
| 4.2 | Target on Amazon | `floor(available ÷ units per listing)` (`calculateAmazonTargetQuantity`) |
| 4.3 | One automatic listing per product | A second automatic listing for the same product is refused (409 `AMAZON_AUTOMATIC_ALREADY_SET`), so stock is never oversold |
| 4.4 | Send | Stock Sync tab: Nivaana stock / target / Amazon quantity / difference → **preview → send** (`amazon_inventory_sync`; write switch on). The dialog re-checks Amazon while the update is pending. |
| 4.5 | History | Only real sends, with user names |
| 4.6 | Automatic push | Off (`AMAZON_AUTO_SYNC_ENABLED=false`) until the AMZ-PLAN-24 checklist is done |

---

## Step 5 — Import orders

| # | What | Trigger | Result |
| --- | --- | --- | --- |
| 5.1 | New and changed orders | Cloud Scheduler `POST /api/channels/amazon/jobs/order-sync` every 15 min (`x-scheduler-secret`), or **Sync orders** | `AmazonMarketplaceOrder` and items saved |
| 5.2 | Item matching | Automatic, through the mapping | Unmapped → "Need mapping"; no items → "Items missing" (re-import fixes it) |
| 5.3 | Test orders | `TEST-AMZ-…` (development only) | Left out of the counts |

---

## Step 6 — Route and fulfil by type

The type comes from Amazon: FBA; FBM with `AMAZON_EASY_SHIP` = Easy Ship; other FBM = Self Ship.

An order is **Blocked** when a SKU is unmapped, there are no items, the type is unknown, or Amazon cancelled it.

### 6A — FBA (Amazon ships)
| # | Step | Stock in Nivaana |
| --- | --- | --- |
| 1 | Order imported, shown read only | — |
| 2 | Amazon reports **Shipped** | Amazon platform stock `soldqty +qty` only (FBA stock is not in our godown) |
| 3 | Team's only job: refill FBA stock when it runs low | — |

### 6B — Easy Ship (most orders; Amazon's agent picks up)
| # | Step | Who | Stock in Nivaana (Amazon platform stock + product) |
| --- | --- | --- | --- |
| 1 | Order imported | Automatic | **Reserved**: `availableqty −qty`, `orderedqty +qty` (product `availablequantity −`, `orderedquantity +`) |
| 2 | Pack | Team | — |
| 3 | **Pack and book pickup**: in Seller Central, or on the Nivaana order page (size / weight → Get handover slots → Schedule handover) | Team | — |
| 4 | Print the Amazon label, hand over to the agent | Team | — |
| 5 | Amazon marks **Shipped** after the pickup scan; the next sync sees it | Automatic | **Sold**: `orderedqty −qty`, `soldqty +qty` (product the same) |
| 6 | Amazon cancels before pickup | Automatic on sync | Reservation **released** (back to available) |

Amazon's API has no "Delivered" status, so **Shipped** is the final stock moment.

### 6C — Self Ship (Ekart / Shipmozo / Manual)
| # | Step | Who | Result |
| --- | --- | --- | --- |
| 1 | Order imported | Automatic | **Reserved** (as in 6B) |
| 2 | **Ship now** → courier, package, payment type, **buyer address typed from Seller Central** (not stored) | Team | Courier booked, AWB saved. The order is locked while booking. |
| 3 | Same click: **confirm Shipped to Amazon** (courier code, AWB, ship date, items) | Automatic | Amazon order **Shipped**; stock **reserved → sold** |
| 4 | Confirmation failed | — | AWB kept; "Amazon confirmation failed" + **Retry** (nothing is booked twice) |
| 5 | Delivery status in Nivaana | Ekart webhook / Shipmozo sync / **Update status** | Shipped → In transit → Out for delivery → Delivered (or RTO). Amazon reads these from the courier. |

The courier steps are the same as website orders: [20_Channel_Fulfilment_Flows.md](20_Channel_Fulfilment_Flows.md) Part 6.

---

## Step 7 — Returns

| # | Step | Who / trigger | Result |
| --- | --- | --- | --- |
| 7.1 | Import returns (Reports API) | Cloud Scheduler `POST /api/channels/amazon/jobs/return-sync`, one short step per run (request report → check → import) | `AmazonReturnEvent` saved; FBM items wait in `AWAITING_RECEIPT` |
| 7.2 | FBA returns | — | Stay with Amazon; they **cannot** restock Nivaana |
| 7.3 | **Receive** an FBM return | Team: quantity received (1 … returned qty) and QC result | Requires the SKU to be mapped. A combo is received as its components. |
| 7.4 | QC = **Restockable** | — | Unit back to **available** on Amazon platform stock; product updated; `RESTOCKED` |
| 7.5 | QC = not restockable | — | Unit → **damaged**; `QUARANTINED` |
| 7.6 | Each return is processed once | — | A second receive → 409 "already processed" |

---

## Step 8 — Operations and schedulers

| Job (Cloud Scheduler → `POST /api/channels/amazon/jobs/…`) | Default frequency | Does |
| --- | --- | --- |
| `order-sync` | every 15 min | Step 5 |
| `listing-sync` | every 6 h | Step 2 |
| `retry-queue` | every 5 min (optional) | Retries failed Amazon writes |
| `return-sync` | every 30 min (optional; one step per run) | Step 7 |

In-process node-cron stays **off**. Cloud Scheduler jobs are **not created yet** for SIT / UAT / Prod (`Amazon_Master.md` §4a).

The Operations area shows:
- Overview: real orders only, and listing counts like Seller Central
- Activity: real events with names
- failures, the retry queue, write pause / resume, export

---

## Open items (from `Amazon_Master.md`)

| ID | Item |
| --- | --- |
| AMZ-PLAN-08 | 171 of 172 listings unmapped; mapping needed in Prod |
| AMZ-PLAN-24 | Automatic stock push go-live |
| AMZ-PLAN-09 | Real-time notifications (SQS / EventBridge) |
| AMZ-PLAN-02 | SIT read-only on the Prod account |
| AMZ-PLAN-26 | Buyer address: no PII role, address typed in by the team |
| — | UAT / Prod LWA secrets still old; Cloud Scheduler jobs to create; FIX-163 local; UAT / Prod SQL first |
| — | Ekart's Amazon courier code not verified (sent as `Other`) |
