# Amazon Order Fulfilment — Flow, Decisions, Plan

How an Amazon order is handled from the moment it arrives until it is delivered: who does what (Amazon, Nivaana team, courier), what goes to Amazon and what stays in Nivaana, how stock moves, and the build plan.

- **Status:** Client confirmed the fulfilment methods on 2026-10-26 (section 2). Build started 2026-10-26 (AMZ-PLAN-25, FIX-2026-10-26-162). Plan and phase status: section 10.
- **Listings today:** mostly **FBM** (seller-fulfilled, stock in our godown); **2 products FBA** (stock in Amazon's warehouse).
- Related: AMZ-PLAN-25 in [`Amazon_Master.md`](Amazon_Master.md); website order shipping (Ekart, Shipmozo, manual) is reused for Amazon Self Ship.
- Last updated: 2026-10-26.

---

## 1. The three kinds of Amazon order

Every imported order is routed by how it is fulfilled:

| Kind | Where the stock is | Who ships | Who updates Amazon status | Nivaana team's work |
|---|---|---|---|---|
| **A. FBA** | Amazon warehouse | Amazon | Amazon | Nothing per order. Only refill FBA stock when low. Nivaana shows the order read-only and counts FBA stock as sold. |
| **B(i). FBM — Easy Ship** (Amazon Pickup and Delivery) | Our godown | Amazon's agent picks up | Amazon (after pickup) | Pack and hand the parcel to Amazon's agent. Pickup slot in Seller Central or in Nivaana. |
| **B(ii). FBM — Self Ship** | Our godown | We ship through **Ekart, Shipmozo or a manual courier** | **We confirm "Shipped" once** (courier + tracking); after that Amazon tracks via the courier | Pack, **Ship now** in Nivaana (books the courier and confirms to Amazon), hand the parcel to the courier. |

Whether an FBM order is Easy Ship or Self Ship is decided by Amazon (seller settings and the order's programs), not by Nivaana. The import reads it from the order: `programs` contains `AMAZON_EASY_SHIP` → Easy Ship; otherwise merchant-fulfilled → Self Ship.

An order is **Blocked** (cannot be processed) when: an Amazon SKU is not mapped to a Nivaana product, Amazon sent it without items, the fulfilment type is unknown, or Amazon cancelled it. Unmapped SKUs must be mapped first (AMZ-PLAN-08).

---

## 2. Client decisions (2026-10-26)

| Method | Client's answer | What it means for Nivaana |
|---|---|---|
| **A. Fulfilled by Amazon (FBA)** | Amazon handles all fulfilment, including order status. | **No change.** Order sync brings in the order and status; FBA stock is counted as sold when Amazon reports Shipped. Already correct. |
| **B(i). Amazon Pickup and Delivery (Easy Ship)** | Used for most orders. Client sees the order, packs it; Amazon's agent collects and delivers. Order status and stock update on sync. | **No new build.** Stock is reserved when the order arrives and moves to sold when Amazon reports Shipped (after pickup) on the next sync (section 4). Needs the order-sync scheduler on Prod (AMZ-PLAN-03). |
| **B(ii). Self Ship** | Three options, working like website orders: **Manual shipment, Ekart, Shipmozo**. After shipping, status must update; the team must also be able to update status manually; the update must show on the Amazon order. | **New build: Ship now** (section 5). Booking + "Shipped" confirmation to Amazon in one click; delivery status (In transit → Delivered / RTO) from Ekart / Shipmozo webhooks or manual update, shown on the Amazon order in Nivaana. Amazon itself gets only "Shipped" (section 6). |

Other decisions:

- **Buyer address (PII role): not requested now.** The developer profile was approved after a long review; changing it (role or organisation type) starts a new review. Until the **Direct-to-Consumer Shipping (Restricted)** role is approved, the team pastes the buyer's address from Seller Central into the Ship now form (section 7).
- **Stock timing (B(i) and B(ii))**: reserve when the order arrives, sold when it ships (section 4). Not on delivery: Amazon's order API has no Delivered status.

---

## 3. Flow — A. FBA

1. Customer orders; Amazon picks, packs, ships and delivers.
2. Nivaana imports the order read-only (every 15 minutes, plus **Refresh**).
3. When Amazon reports **Shipped**, Nivaana adds the quantity to the Amazon platform stock `soldqty` (FBA stock is not in our godown, so `availableqty` / product stock are not touched).
4. Team's only job: send fresh stock to the Amazon warehouse when FBA stock is low.

---

## 4. Flow — B(i). Easy Ship (Amazon Pickup and Delivery)

| # | Step | Who | Where | Stock in Nivaana |
|---|---|---|---|---|
| 1 | Order arrives | Automatic (sync every 15 min, **Refresh**) | Amazon → Nivaana | **Reserved**: Amazon platform stock `availableqty` − qty, `orderedqty` + qty; product `availablequantity` − qty, `orderedquantity` + qty |
| 2 | Pack | Nivaana team | Godown | — |
| 3 | Pickup slot | Nivaana team | Seller Central, or the order page in Nivaana (package size/weight → **Get handover slots** → **Schedule handover**) | — |
| 4 | Print label, hand over | Nivaana team | Amazon's label / invoice | — |
| 5 | Amazon marks **Shipped** after the pickup scan | Amazon | Amazon | — |
| 6 | Next sync sees **Shipped** | Automatic | Amazon → Nivaana | **Sold**: platform `orderedqty` − qty, `soldqty` + qty; product `orderedquantity` − qty, `soldquantity` + qty |
| 7 | Delivered | Amazon | Amazon app | — (no Delivered status in Amazon's order API) |

If Amazon cancels before pickup, the next sync **releases** the reservation (stock back to available). Returns come in through the returns import (scheduler AMZ-PLAN-05).

**Why "Shipped" is the right moment for sold:** it is the last status Amazon's order API reports (there is no Delivered), the parcel has left our godown, and reserving at order time already stops the same unit being sold on the website before pickup.

Code: `amazon-order-routing.service.ts` (`reserveSellerStock` on import, `finalizeReservationsAsSold` when the status is final, `releaseReservations` on cancel).

---

## 5. Flow — B(ii). Self Ship with Ship now (new, FIX-162)

One **Ship now** button on the Amazon order page (Self Ship orders with reserved stock), with three options — the same three as website orders:

| Option | What Nivaana does | Courier name sent to Amazon |
|---|---|---|
| **Ekart** | Books an Ekart forward shipment (pickup from the chosen Ekart address), gets the AWB | `Other` + "Ekart Logistics" (see note) |
| **Shipmozo** | Pushes the order to Shipmozo, auto-assigns (or uses the chosen) courier, schedules pickup, gets the AWB | The **real courier Shipmozo assigned** (e.g. Delhivery), not "Shipmozo" |
| **Manual** | Saves the courier and tracking number the team booked outside Nivaana | The courier picked from the list (Amazon carrier code), or `Other` + name |

### Steps

| # | Step | Who | Result |
|---|---|---|---|
| 1 | Order arrives | Automatic | Saved in Nivaana, **stock reserved** |
| 2 | Pack | Nivaana team | — |
| 3 | **Ship now** → choose Ekart / Shipmozo / Manual; enter package weight and size; paste the buyer's name, phone and address from Seller Central (Ekart / Shipmozo only); payment type (Prepaid, or COD if Seller Central shows Cash on Delivery) | Nivaana team | Courier booked, AWB saved on the Amazon order |
| 4 | Same click: **confirm shipment to Amazon** (courier + AWB + ship date + items) | Automatic | Amazon order → **Shipped**; customer gets tracking; **stock reserved → sold** |
| 5 | Courier picks up and delivers | Courier | Amazon reads the courier's tracking for the customer |
| 6 | Delivery status in Nivaana | Ekart webhook, Shipmozo webhook + scheduled sync, or **Update status** by the team | Amazon order page shows Shipped → In transit → Out for delivery → Delivered (or RTO) |

### Rules

- **Booking is checked before anything is spent:** mapped Self Ship order, stock reserved, not shipped yet, no AWB yet, Amazon writes switched on (kill switch), Shipmozo enabled in that environment.
- **Where it can run:** Amazon writes are off on local / SIT / UAT (section 1a of `Amazon_Master.md`), so real orders can be shipped only on Prod; elsewhere Ship now stops **before** booking with "Amazon writes are disabled". **Test orders** (`TEST-AMZ-…`, development only) can use **Manual** Ship now: tracking is saved, stock moves reserved → sold and the order becomes Shipped without contacting Amazon, so delivery status can be tested end to end. Ekart / Shipmozo are blocked for test orders (they would book a real courier).
- **One booking per order:** the order is locked while booking (`BOOKING_COURIER`), so a double click cannot book two AWBs. If the courier refuses, the lock is released and the error is shown and recorded.
- **Courier booked but Amazon confirmation failed** (e.g. Amazon rejects the courier name, network error): the AWB stays saved, the order shows **Amazon confirmation failed** with the reason, and the team can **fix the courier name and retry**. Nothing is booked twice.
- **The buyer's address is not stored in Nivaana.** It goes from the form straight to Ekart / Shipmozo (they need it for the label). Only the pincode/city check happens on the courier side.
- **Labels:** Shipmozo and Ekart labels download by AWB from the order page (same endpoints as website orders).
- **Old step-by-step buttons** (pick task, pack, select shipping, save tracking, confirm) stay in the backend; the order page now shows Ship now instead.

**Courier name note (to verify on the first real shipment):** Amazon accepts only courier codes from its own list. Delhivery, Blue Dart, DTDC, Xpressbees, Ecom Express, India Post, Shadowfax and Gati are sent as their codes. Anything else (including Ekart until verified) is sent as `Other` with the courier's name, which Amazon always accepts. If Amazon's list in Seller Central shows Ekart, change one line in `src/utils/amazonCarrier.ts`.

---

## 6. What goes to Amazon, what stays in Nivaana

| Update | Sent to Amazon? | How |
|---|---|---|
| **Shipped** (courier, AWB, ship date, items) | ✅ Yes, once | SP-API `confirmShipment`, in the Ship now click (or Retry) |
| In transit / Out for delivery / Delivered | ❌ No API for sellers | Amazon reads them from the **courier's tracking**, using the AWB we sent. The customer still sees them in the Amazon app. |
| RTO initiated / RTO delivered | ❌ No | Shown in Nivaana. Amazon learns from the courier. |
| Manual status change by the team | ❌ No | Corrects the Nivaana view only. |

So "the status must sync to the Amazon order" is met this way: **Shipped** goes to Amazon from Nivaana; the later statuses reach Amazon through the courier; **all** statuses are shown on the Amazon order page in Nivaana.

---

## 7. Buyer address and the PII role

| | Today (no role) | After Amazon approves the role |
|---|---|---|
| Where the address comes from | Team copies name, phone, address from Seller Central into Ship now | Nivaana fetches it with a Restricted Data Token (`getOrderAddress` / buyer info) and fills the form |
| Stored in Nivaana | No | Only if needed for re-printing, encrypted, deleted 30 days after delivery (Amazon's data rules) |
| Needed for | Ekart / Shipmozo booking | Same |

How to get the role later (when the client agrees to a new review): Solution Provider Portal → Developer Profile → Roles → tick **Direct-to-Consumer Shipping (Restricted)** → answer the data-use and security questions → submit. After approval: Edit App (Nivaana-PROD) → tick the role → save → **authorize the app again** (new refresh token) → update the env file and GCP secret. Keep "No, I will not delegate access to PII". Tracked as AMZ-PLAN-26.

---

## 8. Do we store Amazon orders in Nivaana?

**Yes.** Amazon orders are stored in their own tables (separate from website orders), per database (local/SIT, UAT and Prod each have their own copy).

| What | Table | Stored fields (main) |
|---|---|---|
| Order | `amazon_marketplace_orders` | Amazon order ID, purchase date, Amazon status, buyer name/email, FBA/FBM/Easy Ship, route, ship-by window, cancelled / buyer-requested cancellation |
| Items | `amazon_marketplace_order_items` | Seller SKU, ASIN, title, quantity ordered/shipped, unit price, mapped Nivaana product, pack size |
| Fulfilment | `amazon_order_fulfillments` | Step status, package weight/size, **shipping provider (EKART / SHIPMOZO / MANUAL), Shipmozo order ID, courier code/name, tracking number, tracking link, ship date**, **delivery status, source, courier's own status text, delivered date**, Easy Ship slot and package, Amazon confirmation status and time, last error |
| History | `amazon_order_fulfillment_audits` | Who did which step, when, from/to status (Ship now, delivery status changes included) |
| Errors | `amazon_order_fulfillment_exceptions` | Failed Amazon / courier calls, retry/resolve |
| Stock | `amazon_order_route_handoffs`, `amazon_order_stock_reservations` | Reserved / sold stock per order |
| Shipmozo | `shipmozo_operations` | Booking steps for Amazon Shipmozo shipments (key `amazon-forward:<Amazon order ID>`) |
| Returns | `amazon_return_events` | Returns imported from Amazon |

**Not stored:** the customer's shipping address and phone.

New columns on `amazon_order_fulfillments` come from `scripts/migrations/20261026_add_amazon_ship_now_fields.sql` (release checklist 4b).

---

## 9. Built vs missing

| Feature | Status | Notes |
|---|---|---|
| Automatic order import (15 min) + Refresh | ✅ | Prod needs the Cloud Scheduler job and GCP secrets (AMZ-PLAN-01 / 03) |
| FBA read-only + sold count | ✅ | |
| Easy Ship: reserve on import, sold on Shipped, release on cancel | ✅ | |
| Easy Ship slots, schedule, refresh, reschedule | ✅ | No cancel (AMZ-PLAN-21) |
| **Ship now: Ekart / Shipmozo / Manual + confirm to Amazon** | 🟡 FIX-162 | Section 5 |
| **Courier list with Amazon carrier codes** (manual) | 🟡 FIX-162 | Replaces the free-text courier code |
| **Delivery status from Shipmozo** (webhook + scheduled sync) | 🟡 FIX-162 | Same Shipmozo webhook URL as website orders |
| **Delivery status from Ekart** (webhook) | 🟡 FIX-162 | Same Ekart webhook URL as website orders |
| **Update status manually** | 🟡 FIX-162 | Shipped, In transit, Out for delivery, Delivered, RTO initiated, RTO delivered |
| **Fix courier + retry when Amazon rejects the confirmation** | 🟡 FIX-162 | |
| Label download (Shipmozo / Ekart) | 🟡 FIX-162 | Amazon label endpoint (Ekart PDF / Shipmozo label) |
| **Order page: journey, shipment, stock, timeline** for FBA / Easy Ship / Self Ship | 🟡 FIX-162 | Section 11 |
| Buyer address from Amazon | ❌ | Needs PII role (AMZ-PLAN-26) |
| Cancel a booked courier shipment from the Amazon order | ❌ | Cancel in the Ekart / Shipmozo panel; before Amazon confirmation only |
| RTO → stock back | ❌ | Status shows RTO; stock return is handled through Amazon returns / manual stock adjustment |
| Returns import scheduler | ⚠️ | AMZ-PLAN-05 |

---

## 10. Plan (AMZ-PLAN-25)

| Phase | Work | Status |
|---|---|---|
| 0 | Go-live basics: GCP secrets (AMZ-PLAN-01), order-sync Cloud Scheduler job (AMZ-PLAN-03), map SKUs on Prod (AMZ-PLAN-08), Amazon writes switch on for Prod | ⬜ Needed for A and B(i) on Prod too |
| 1 | **Ship now** for Self Ship: backend `POST /api/channels/amazon/orders/:orderId/fulfillment/ship-now` (Ekart / Shipmozo / Manual), lock while booking, confirm to Amazon in the same call, courier-name mapping; Inventory Ship now form | 🟡 FIX-162 |
| 2 | **Delivery status in Nivaana**: Shipmozo webhook + scheduled sync and Ekart webhook update Amazon fulfilments by AWB; `POST …/fulfillment/delivery-status` for manual updates; shown on the order page with history | 🟡 FIX-162 |
| 3 | **Fix courier and retry**: `POST …/fulfillment/courier` when Amazon confirmation failed, then Retry | 🟡 FIX-162 |
| 4 | Buyer address via RDT once the PII role is approved (AMZ-PLAN-26) | ⏸ Client to decide on a new profile review |
| 5 | RTO → prompt stock return; cancel courier shipment from the Amazon order | ⬜ Later |

Each phase gets an entry in `Amazon_Master.md` and `docs/Fix_After_Sep30/Master.md`, and a release-checklist row for any migration or env change.

### Release steps for FIX-162 (per environment)

1. Run `scripts/migrations/20261026_add_amazon_ship_now_fields.sql` (`npm run db:sql -- <env> --apply`) **before** deploying the backend.
2. Deploy backend, then Inventory.
3. Check Ekart (`SELLER_GST_TIN`, Ekart credentials) and Shipmozo (`SHIPMOZO_INTEGRATION_ENABLED`, warehouse) settings in that environment — the same ones website orders use.
4. First real Self Ship order: use **Manual** or a cheap Shipmozo booking, check that Amazon accepts the courier name and shows tracking to the buyer.

### Test checklist

- Dev test order, Ship now (Manual): tracking saved, stock reserved → sold, order Shipped, Amazon not contacted, audit row.
- Real order on SIT / UAT: Ship now stops before booking ("Amazon writes are disabled"); nothing booked.
- Prod, first real order: Ship now (Manual or Shipmozo) → AWB saved, Amazon confirmation accepted, buyer sees tracking, stock reserved → sold.
- Double click Ship now → one booking only.
- Amazon rejects the courier → order shows the error, fix courier → Retry → confirmed.
- Shipmozo webhook / Ekart webhook for an Amazon AWB → delivery status changes; website orders still update as before.
- Manual Update status → status and history change; nothing is sent to Amazon.
- Easy Ship order: reserved on import, sold after Amazon reports Shipped, released when cancelled.

---

## 11. What the Amazon order page shows (FIX-162)

Top to bottom: header (order, Amazon status, Nivaana status, total; type · buyer · ship-by / Late), **Next step** (one sentence and its link), **order journey**, **Shipment** and **Stock in Nivaana** side by side, **What to do** (actions, only when something can be done), **Items** and **Timeline**.

| Part | FBA | Easy Ship | Self Ship |
|---|---|---|---|
| Journey (who · when) | Order placed (customer) → Shipped by Amazon (Amazon warehouse) → Delivered (Amazon, in Seller Central) | Order placed, stock reserved → Packed, pickup booked (you; in Nivaana or Seller Central) → Picked up by Amazon, stock sold (Amazon agent) → Delivered (Amazon) | Order placed, stock reserved → Shipped, confirmed to Amazon, stock sold (you) → In transit → Out for delivery → Delivered (courier). RTO replaces the last steps: Returning to you → Back at your godown. Amazon not accepting the shipment shows in red. |
| Shipment | Shipped from Amazon warehouse; Amazon status; tracking in Seller Central | Pickup slot and method, package, Amazon tracking and Easy Ship status — still shown after pickup | Provider and courier (and the name sent to Amazon if different), AWB with tracking link, ship date, delivery status with the courier's own wording, package |
| Stock in Nivaana | Per item: "Sold (FBA)" — FBA stock is Amazon's, godown stock does not change | Per item: Reserved → Sold (after pickup) or Released (cancelled), with dates | Same as Easy Ship; Sold when shipped |
| What to do | — | Book / reschedule / refresh the pickup (before pickup) | Ship now; after shipping: Update delivery status, Download label, Fix courier → Confirm (if Amazon rejected) |
| Timeline | Placed, counted as sold, last checked | Placed, stock reserved, pickup slot, stock sold, last checked | Placed, stock reserved, shipped, confirmed to Amazon, stock sold, delivery status, delivered, last checked |

Code: `src/components/amazon/AmazonOrderJourney.tsx`, `src/utils/amazonOrderJourney.ts`, `src/pages/orders/AmazonOrderDetailPage.tsx` (Inventory).
