# Amazon Order Fulfilment — Flow, Current State, Plan

How an Amazon order is handled from the moment it arrives until it is delivered: who does what (Amazon, Nivaana team, courier), what Nivaana can do today, what is missing, and the parked plan.

- **Status:** Parked 2026-10-23. Waiting for client confirmation (questions in section 7) before any build. Plan: AMZ-PLAN-25 in [`Amazon_Master.md`](Amazon_Master.md).
- **Listings today:** mostly **FBM** (seller-fulfilled, stock in our godown); **2 products FBA** (stock in Amazon's warehouse).
- Last updated: 2026-10-23.

---

## 1. The three kinds of Amazon order

Every imported order is routed by how it is fulfilled:

| Kind | Where the stock is | Who ships | Who updates Amazon status | Nivaana team's work |
|---|---|---|---|---|
| **FBA** | Amazon warehouse | Amazon | Amazon | Nothing per order. Only refill FBA stock when low. Nivaana shows the order read-only and counts FBA stock as sold. |
| **FBM — Easy Ship** | Our godown | Amazon's courier picks up | Amazon (after pickup) | Pack, enter package size/weight, choose a pickup slot, print Amazon's label/invoice, hand over. |
| **FBM — Self Ship** | Our godown | We book the courier (e.g. Delhivery) | **We confirm "Shipped" once**; after that Amazon tracks via the courier | Pick, pack, book courier, enter tracking, confirm to Amazon. |

Whether an FBM order is Easy Ship or Self Ship is decided by the seller's settings in Amazon Seller Central, not by Nivaana. **Client must confirm which one they use** (section 7).

An order is **Blocked** (cannot be processed) when: an Amazon SKU is not mapped to a Nivaana product, Amazon sent it without items, the fulfilment type is unknown, or Amazon cancelled it. Unmapped SKUs must be mapped first (AMZ-PLAN-08).

---

## 2. Correct flow — FBM Self Ship (e.g. Delhivery)

| # | Step | Who | Where | Result |
|---|---|---|---|---|
| 1 | Order arrives | Automatic | Amazon → Nivaana (import every 15 min, plus **Refresh** button) | Order saved in Nivaana, stock reserved |
| 2 | Check order | Nivaana team | Amazon order page (`/orders/amazon/<amazonOrderId>`) | Items, quantity, ship-by date reviewed |
| 3 | Pick | Nivaana team | **Create pick task** | Picked |
| 4 | Pack | Nivaana team | **Confirm packed** (weight, size) | Packed |
| 5 | Choose shipping | Nivaana team | **Select shipping** | Shipping method saved |
| 6 | Book courier | Nivaana team | **Delhivery panel (outside Nivaana)** — address copied from Seller Central | AWB / tracking number |
| 7 | Save tracking | Nivaana team | Courier code, courier name, tracking ID, ship date → **Save tracking** | Tracking stored in Nivaana |
| 8 | Mark shipped | Nivaana team | **Mark shipped** | Shipped in Nivaana |
| 9 | **Confirm to Amazon** | Nivaana team | **Confirm shipment to Amazon** | Amazon order becomes **Shipped**; customer gets the "shipped" message with tracking; stock moves from reserved to sold |
| 10 | In transit / Out for delivery / Delivered | **Amazon, automatically** | Amazon reads the courier's tracking | Customer sees live status in the Amazon app |

### Key rules
- **Amazon accepts only one update from the seller: the shipment confirmation** (courier + tracking number + ship date, step 9). There is no Amazon API to push "Out for delivery" or "Delivered". After step 9 Amazon gets these from the courier itself.
- **If step 9 is missed**, Amazon still shows the order as unshipped: the customer sees nothing, the seller gets a late-shipment mark, and account health drops.
- **The courier code must be one Amazon recognises** (for example `Delhivery`). A misspelt or unknown courier means Amazon cannot track the parcel, the customer sees no tracking, and the *Valid Tracking Rate* metric drops.
- **A courier webhook does not update Amazon.** A Delhivery / Shipmozo webhook only updates **Nivaana's own view** (Out for delivery, Delivered, RTO), so the team does not have to open Seller Central to check delivery.

---

## 3. Flow — FBM Easy Ship

1. Order arrives in Nivaana (same as above).
2. Team opens the order, enters package weight and size → **Get handover slots**.
3. Team picks a slot → **Schedule**. Amazon creates the package, label and invoice.
4. Team prints the label, sticks it on the box, and hands it to Amazon's courier at the slot time.
5. Amazon updates every status after that (Shipped → Delivered). No confirm button, no tracking entry.

Reschedule and refresh of the slot are available; cancelling an Easy Ship package is not (AMZ-PLAN-21).

---

## 4. Flow — FBA

1. Customer orders; Amazon picks, packs, ships and delivers.
2. Nivaana imports the order read-only and counts the FBA stock as sold.
3. Team's only job: send fresh stock to the Amazon warehouse when FBA stock is low.

---

## 5. Do we store Amazon orders in Nivaana?

**Yes.** Amazon orders are stored in their own tables (separate from website orders), per database (local/SIT, UAT and Prod each have their own copy).

| What | Table | Stored fields (main) |
|---|---|---|
| Order | `amazon_marketplace_orders` | Amazon order ID, purchase date, Amazon status, buyer name/email, FBA/FBM/Easy Ship, route, ship-by window, cancelled / buyer-requested cancellation |
| Items | `amazon_marketplace_order_items` | Seller SKU, ASIN, title, quantity ordered/shipped, unit price, mapped Nivaana product, pack size |
| Fulfilment | `amazon_order_fulfillments` | Step status, pick/pack times, package weight/size, shipping method, **courier code/name, tracking number, ship date**, invoice/packing slip/label links, Easy Ship slot and package, Amazon confirmation status and time, last error |
| History | `amazon_order_fulfillment_audits` | Who did which step, when, from/to status |
| Errors | `amazon_order_fulfillment_exceptions` | Failed Amazon calls, retry/resolve |
| Stock | `amazon_order_route_handoffs`, `amazon_order_stock_reservations` | Reserved / sold stock per order |
| Returns | `amazon_return_events` | Returns imported from Amazon |

**Not stored:** the customer's **shipping address and phone**, and courier delivery events (Out for delivery, Delivered, RTO).

---

## 6. What we have today vs what is missing

| Feature | Today | Notes |
|---|---|---|
| Automatic order import (15 min) + Refresh button | ✅ | Check `AMAZON_ORDER_AUTO_SYNC_ENABLED=true` and the Cloud Scheduler job per environment (AMZ-PLAN-03) |
| Pick, pack, select shipping | ✅ | |
| Invoice / packing slip / label links | ✅ | Links only; no upload, no download of Amazon documents (AMZ-PLAN-21) |
| Save courier + tracking number | ✅ | Typed by hand; **courier code is free text** |
| Mark shipped + Confirm shipment to Amazon | ✅ | One-click "ship and confirm" also exists in the backend |
| Easy Ship slots, schedule, refresh, reschedule | ✅ | No cancel |
| FBA orders read-only + FBA stock sold count | ✅ | |
| Stock reserved on import, sold on confirm | ✅ | |
| Amazon "Shipped" status comes back on next import | ✅ | |
| Returns import | ✅ | Scheduler not created yet (AMZ-PLAN-05) |
| Retry / resolve failed Amazon calls | ✅ | |
| **Customer shipping address in Nivaana** | ❌ | Amazon gives the address only with a Restricted Data Token (RDT) and the PII role on the app. Today the team copies it from Seller Central. Blocks courier auto-booking. |
| **Courier code as a dropdown** | ❌ | Free text risks Amazon not recognising the courier |
| **Book Delhivery / Shipmozo from the Amazon order** | ❌ | Booked outside Nivaana; tracking typed back in |
| **Courier webhook → Nivaana status (Out for delivery, Delivered, RTO)** | ❌ | Exists for website orders (Shipmozo, Ekart), not for Amazon orders |
| Credentials on GCP | ⚠️ | FIX-130 secrets pending (AMZ-PLAN-01); until done, Prod import and confirm do not work |
| SKU mapping | ⚠️ | Unmapped SKUs block FBM orders (AMZ-PLAN-08) |

---

## 7. Questions for the client (needed before we start)

1. **Easy Ship or Self Ship** for FBM orders? Check Seller Central → Settings → Shipping settings / Easy Ship. If Easy Ship, most of the gaps in section 6 do not matter.
2. If Self Ship: **which couriers** (Delhivery only, or also DTDC, Blue Dart, Ekart, India Post)? Booked directly or through **Shipmozo**?
3. Do they want **Nivaana to book the courier** from the Amazon order (needs the address), or will they keep booking outside Nivaana and type the tracking number?
4. Do they want **delivery status (Out for delivery / Delivered / RTO) inside Nivaana**, or is Seller Central enough?
5. Does the Amazon developer app have (or can it apply for) the **PII / Direct-to-Consumer Shipping role** needed to read buyer addresses?
6. Which Nivaana users may confirm shipments to Amazon?

---

## 8. Plan (AMZ-PLAN-25 — parked until client confirms)

Do these in order; each phase is useful on its own. Skip phases the client does not need.

| Phase | Work | Needed when | Size |
|---|---|---|---|
| 0 | Go-live basics: GCP secrets (AMZ-PLAN-01), order-sync Cloud Scheduler job (AMZ-PLAN-03), map SKUs on Prod (AMZ-PLAN-08), confirm writes switch is on for Prod | Always | Config / business |
| 1 | **Courier dropdown** with Amazon carrier codes (Delhivery, DTDC, Blue Dart, Ekart, India Post, Other + name). Backend rejects unknown codes. | Self Ship | Small |
| 2 | **Fetch shipping address** via RDT (`getOrderAddress` / `getOrderBuyerInfo`), show it on the order page. Store only what is needed, follow Amazon's PII rules (encrypt, delete after the retention period, restrict who can see it). | Self Ship + auto-booking | Medium; needs Amazon role approval first |
| 3 | **Book courier from the Amazon order** (Shipmozo / Delhivery API): creates AWB, fills courier + tracking automatically, then one click "Ship and confirm to Amazon". | Client wants booking in Nivaana | Medium |
| 4 | **Courier webhook for Amazon orders**: reuse the Shipmozo / Delhivery tracking webhook, match by tracking number, store delivery events on the Amazon fulfilment record, show In transit / Out for delivery / Delivered / RTO on the order page and Fulfillment queue. **Nivaana only — never sent to Amazon.** | Client wants delivery status in Nivaana | Medium |
| 5 | RTO handling: when the courier reports RTO, flag the order and prompt stock return. | After phase 4 | Small |

Each phase gets its own FIX number, an entry in `Amazon_Master.md` section 8 and `docs/Fix_After_Sep30/Master.md`, and a release-checklist row for any migration or env change.
