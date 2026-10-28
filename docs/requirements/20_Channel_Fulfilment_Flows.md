# 20 · Channel Fulfilment Flows — Ekart, Shipmozo and Manual

**Version:** 1.0 · **As of:** 2026-10-28 · **Built from:** backend `DEV-NEW` code:
- `ekart.controller.ts`, `ekart.service.ts`
- `shipmozo.controller.ts`, `shipmozo-operation.service.ts`, `shipmozo-tracking-sync.service.ts`, `utils/shipmozo-status.ts`
- `orders.service.ts` (`mapEkartWebhookStatusToSystemStatus` L487, `markShipped` L2162, `updateShipmentDetails` L2297 = manual ship, `updateShipmentStatus` L2591, `handleEkartWebhookStatusUpdate` L2876, `syncEkartTracking`)
- `utils/shipmentCancellation.ts`, `amazon-order-shipping.service.ts`
- `docs/Amazon/Amazon_Order_Fulfillment.md` §5

## Scope: which orders use these flows

| Order | Uses this file? | Notes |
| --- | --- | --- |
| **Nivaana website / app order** | ✅ Main flow (Parts 1–5) | Inventory → Order detail |
| **Amazon Self Ship order** | ✅ Same three couriers (Part 6) | Amazon order page → **Ship now**; also confirms "Shipped" to Amazon |
| Amazon Easy Ship | ❌ | Amazon's agent picks up. See [21_Amazon_End_to_End_Flow.md](21_Amazon_End_to_End_Flow.md) |
| Amazon FBA | ❌ | Amazon ships. See 21 |
| In-store order | ❌ | Delivered at the counter. See 19 Part D |

Stock allocation and quantity changes are in [19_End_to_End_Flows.md](19_End_to_End_Flows.md). This file covers the **shipping** side.

---

## Part 1 — Common start (all three couriers)

| # | Step | Where | Rule |
| --- | --- | --- | --- |
| 1 | Order paid | Automatic | Status `order_placed` / `payment_completed` |
| 2 | **Ready for Dispatch** | Order detail → Ready for Dispatch | Stock units are allocated and marked sold (19 B6). Status → `ready_for_dispatch`. |
| 3 | **Create Shipment** menu | Order detail | Offered only in `ready_for_dispatch` and when the order has **no active tracking id**. Choose **Ekart**, **Shipmozo** (only if `SHIPMOZO_INTEGRATION_ENABLED`) or **Manual**. |

Checks before any courier is booked:
- the order has at least one shippable line (not cancelled or returned)
- every shippable line has an **HSN/GST snapshot**

---

## Part 2 — Ekart

| # | Step | Who / API | What is saved | Order status |
| --- | --- | --- | --- | --- |
| E1 | Create EKART Shipment form | Admin: **pickup warehouse** (Ekart address), package size and weight (calculated from product dimensions × pack, editable), payment type | — | `ready_for_dispatch` |
| E2 | Book | `POST /v1/ekart/shipments/forward`. One `items[]` entry per line (short name, PUC, qty, taxable value, HSN, GST), so mixed-HSN orders are allowed. Seller GST TIN comes from `SELLER_GST_TIN`. | `tracking_id` (AWB), `vendor = EKART`, `public_tracking_link` = Ekart track URL, `barcodes` (AWB history), line `tracking_id` | **Stays `ready_for_dispatch`** (no status change) |
| E3 | Label | `POST /v1/ekart/shipments/label`. The PDF is stored by the file service. | `label_url`; download and print times | unchanged |
| E4 | Hand over / mark shipped | Ekart **Picked up** webhook → `shipped`, **or** admin **Mark shipped** (`PATCH /orders/:id/mark-shipped`; needs `tracking_id`; blocked for cancelled / returned orders) | `shipdate`, history | `shipped` |
| E5 | Tracking | **Webhook** `POST /v1/ekart/webhook/track-status` (HMAC). Fallback: **Sync Ekart Tracking** on order detail (`POST /v1/ekart/orders/:orderId/tracking/sync`, FIX-166). There is no scheduler for Ekart. | `shipment_tracking_status`, history, dates; push sent on a real change | see mapping table |
| E6 | Delivered | Webhook `Delivered` | `delivereddate` | `delivered` |

### Ekart status → Nivaana status
Case, spaces, `_` and `-` are ignored when matching.

| Ekart says | Nivaana status |
| --- | --- |
| Shipped, Pick up, Picked up, Pickup | `shipped` |
| In transit | `in_transit` |
| Out for delivery | `out_for_delivery` |
| Delivered | `delivered` |
| COD collected | `cod_payment_received` |
| RTO initiated | `rto_initiated` |
| RTO delivered | `rto_delivered` |
| Any status containing "cancel" (not pickup / RTO / return) | **Courier cancel**: see Part 5 |
| Anything else | Not mapped: kept in `shipment_tracking_status` and history (inactive), order status unchanged |

**Guards:**
- An order that is already delivered, cancelled, returned or RTO is never moved by a later webhook. The status is only noted in history.
- Repeating the same status does nothing.

---

## Part 3 — Shipmozo

Shipmozo is live in SIT, UAT and Prod. Every call is recorded as a `ShipmozoOperation` (idempotency key `forward:<order>`, stage, request / response, retries).

| # | Step | Who / API | Operation stage | What is saved | Order status |
| --- | --- | --- | --- | --- | --- |
| S1 | Create Shipmozo Shipment form | Admin: warehouse, package, optional **rate check** (`/serviceability`, `/rates`), courier = **Auto** or a chosen courier | — | — | `ready_for_dispatch` (required) |
| S2 | Push order | `POST /v1/shipmozo/shipments/forward` → Shipmozo order created | `initialized` → `order_pushed` | Shipmozo internal order id | unchanged |
| S3 | Assign courier | Auto-assign, or the chosen `courier_id` | `courier_assigned` (or `courier_assignment_failed`) | courier name | unchanged |
| S4 | Schedule pickup | In the same request when pickup is requested, or later with `POST /pickups/schedule` | `pickup_scheduled` | **AWB** → `tracking_id`, `vendor = SHIPMOZO`, courier, line `tracking_id`, AWB history | unchanged |
| S5 | Label | `GET /shipments/:awb/label`; stored by the file service | `label_stored` | `label_url` | unchanged |
| S6 | Picked up / tracking | **Cloud Scheduler** every 5 min → `POST /v1/shipmozo/jobs/tracking-sync` (secret header; re-check interval `SHIPMOZO_TRACKING_RECHECK_MINUTES`), **webhook** `/webhook/track-status`, or **Sync Shipmozo Tracking** on order detail. Admin **Mark shipped** also works. | `completed` when final | `last_synced`, history, "Last synced on" in Inventory | see mapping |

A failed step can be **resumed**: the operation keeps the internal order id and continues from the failed stage. Nothing is booked twice.

### Shipmozo status → Nivaana status
Matched as text contains, checked in this order.

| Shipmozo says (contains) | Nivaana status |
| --- | --- |
| "rto" + "deliver" / "received" | `rto_delivered` |
| "rto" or "return to origin" | `rto_initiated` |
| "out for delivery" / "ofd" | `out_for_delivery` |
| "undelivered", "not delivered", "delivery failed" | No status change (event only) |
| "delivered" | `delivered` |
| "in transit", "at hub", "dispatched" | `in_transit` |
| "picked up", "pickup done", "shipped" | `shipped` |
| "cancel" | **Courier cancel**: see Part 5 |
| pickup pending / failed, NDR, lost, damaged | Event recorded only; order unchanged |

**Allowed moves** (anything else is ignored):

| From | Allowed to |
| --- | --- |
| `ready_for_dispatch` | shipped, in_transit, out_for_delivery, delivered, rto_initiated |
| `shipped` | in_transit, out_for_delivery, delivered, rto_initiated |
| `in_transit` | out_for_delivery, delivered, rto_initiated |
| `out_for_delivery` | delivered, rto_initiated |
| `rto_initiated` | rto_delivered |

---

## Part 4 — Manual courier

Use this when the parcel goes with a courier booked outside Nivaana (Delhivery, Shiprocket, local courier …), or when Ekart refused to collect.

| # | Step | Who / API | What is saved | Order status |
| --- | --- | --- | --- | --- |
| M1 | Manual Shipment form | Admin: **vendor name** and **tracking id** (required), public tracking link (optional, generated if empty), "Mark as shipped" tick | — | `ready_for_dispatch` |
| M2 | Save | `PATCH /v1/orders/:id/manual-ship` | `tracking_id`, `vendor`, `public_tracking_link`, history | `shipped` if ticked, otherwise stays `ready_for_dispatch` |
| M3 | Status updates | **Admin only**: `PATCH /v1/orders/:id/shipment-status` with shipped, in_transit, out_for_delivery, delivered, rto_initiated, rto_delivered, cod_payment_received. There is no webhook or sync for manual couriers. | dates and history; push to the customer | as chosen |

**Rules:**
- Allowed only in `ready_for_dispatch` or `shipped`. Blocked for cancelled or returned orders.
- **Switch from Ekart to manual** is allowed before pickup (Ekart did not collect) and after shipped. Switching a non-Ekart vendor after shipped is refused.
- `rto_delivered` is allowed only after `rto_initiated`, and nothing can follow it. `cod_payment_received` is allowed only on COD orders after delivered.
- There is no label; the courier prints its own.

---

## Part 5 — Cancel, re-ship and RTO (all couriers)

| Case | Trigger | Result |
| --- | --- | --- |
| **Admin cancels the shipment only** | Ekart: Cancel Ekart Shipment (`DELETE /ekart/shipments/:awb/cancel`). Shipmozo: Cancel Shipmozo Shipment (`POST /shipmozo/shipments/cancel`). | Courier cancelled. The order's tracking id, vendor and label are cleared, and the AWB moves to the history in `barcodes`. Order stays or returns to **`ready_for_dispatch`**. Stock stays allocated. **Create Shipment is offered again.** |
| **Courier cancels** (Ekart portal / Shipmozo panel) | Ekart cancel webhook or Sync; Shipmozo sync or webhook | Same clearing. `shipped` / `in_transit` / `out_for_delivery` → **`ready_for_dispatch`** with history reason `courier_shipment_cancelled`. No email; no push for a courier cancel. A delivered, RTO or returned order only gets a history note. |
| **Re-ship** | Create Shipment again | Shipmozo retires the old operation key and starts fresh (FIX-110). Ekart books a new AWB. Each AWB is checked separately (FIX-112). |
| **Customer / admin cancels the whole order** | `POST /orders/:id/cancel` (allowed up to `ready_for_dispatch`) | The courier shipment is cancelled first (Ekart or Shipmozo), then the order. A **partial** line cancel keeps the shipment and logs a warning to check the package. |
| **Manual courier cancel** | — | Not tracked. Admin uses Manual ship again with the new AWB, or cancels the order. |
| **RTO** | Courier `rto_initiated` → `rto_delivered` (webhook / sync / admin) | RTO record created per order line (reason `delivery_failed`). Goods are verified at the warehouse before restock (module 10). |

---

## Part 6 — Amazon Self Ship ("Ship now")

The same three couriers, started from the **Amazon order page** instead of the Nivaana order detail.

| # | Step | What is different from Parts 2–4 |
| --- | --- | --- |
| A1 | Order imported, **Amazon platform stock reserved** (`availableqty −`, `orderedqty +`) | There is no Ready for Dispatch step; no stock units are allocated. |
| A2 | **Ship now** → Ekart / Shipmozo / Manual; package size and weight; payment type (Prepaid, or COD if Seller Central shows COD) | **Buyer address is typed in** (Name, Mobile, Address line 1, City, State, Pincode required), copied from Seller Central. It is sent to the courier and **not stored** in Nivaana. |
| A3 | Courier booked | The order is locked while booking (`BOOKING_COURIER`), so a double click cannot book twice. Requires Amazon writes to be on (Prod only). |
| A4 | **Same click: confirm Shipped to Amazon** (`confirmShipment`: courier code, AWB, ship date, items) | Stock **reserved → sold**. Shipmozo sends the real assigned courier; Ekart and other couriers are sent as `Other` + name. If Amazon rejects it, the AWB is kept and the order shows "Amazon confirmation failed" with a **Retry**. |
| A5 | Tracking in Nivaana | Ekart webhook, Shipmozo sync / webhook, or **Update status**. Amazon itself reads later statuses from the courier; only "Shipped" is sent by Nivaana. |

---

## Gaps and items to confirm

- **No Ekart scheduler.** Ekart status depends on webhooks; Sync Ekart Tracking is the manual fallback (FIX-165 / 166 are on DEV-NEW; the SIT test is pending).
- **Manual couriers have no tracking sync.** All later statuses must be set by the admin.
- The courier is always chosen by the admin; there is no automatic cheapest / fastest choice.
- The Ekart courier code for Amazon is not verified yet (sent as `Other`).
