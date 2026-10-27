# 08 · Orders, Order Lines, In-store Orders, Cancellation and Fulfilment

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`orders.*`, `orderline.*`, `instore-order.*`, `enhanced-order-creation.service.ts`, `shipment-cancellation.service.ts`), CR1, CR2, Inventory `rules/orderfullfilment*.md`, Master.md.

## 1. Purpose

Covers an order's life from placement to delivery or cancellation, for the Nivaana website and app, in-store sales and marketplace orders shown in Inventory.

## 2. Order types and channels

| Type | Created by | Payment | Stock source |
| --- | --- | --- | --- |
| Website / app order | Customer checkout | PhonePe (or COD) | `nivapp` platform stock |
| In-store order (`order_type = instore`) | Inventory user | Cash / card / UPI | `nivapp` stock, **non-published first** (`ecompublish = false`), then published |
| Amazon order | Amazon import (module 11) | Amazon | Amazon platform stock |

## 3. Order statuses

`order_placed` → `payment_completed` / `order_confirmed` → `packed` → `ready_for_dispatch` → `shipped` → `in_transit` → `out_for_delivery` → `delivered`.

Other statuses:
- **Payment:** `payment_failed`.
- **Cancellation:** `cancelled`, `partially_cancelled`, `cancelled_refund_processing`, `cancelled_refunded`, `cancelled_completed`.
- **Return-to-origin:** `rto_initiated` → `rto_delivered` (terminal).
- **Returns:** `returned`, `partially_returned`.
- **COD:** `cod_payment_received` (after delivered).

- **ORD-01** Each status change is recorded in `status_history`, with the matching date (`readytodispatchdate`, `dispatcheddate`, `delivereddate`, `cancelleddate`, and so on) stored in **UTC epoch** (FIX-2026-10-08-87).
- **ORD-02** Shipment status updates allow only: shipped (from ready_for_dispatch, once a tracking id and vendor exist), in_transit, out_for_delivery, delivered, rto_initiated, rto_delivered, cod_payment_received. `rto_delivered` is allowed only after `rto_initiated`.
- **ORD-03** The order's effective status becomes `partially_returned` when completed returns cover only some of its units (FIX-2026-10-09-102).

## 4. Order creation

- **ORD-04** Online orders are created only after payment succeeds (module 07). Each line stores:
  - product name, short name and category
  - list price, product / promotion / manual discount, paid amount
  - shipping share
  - HSN / GST snapshot
  - promotion ids, free-item flag, parent line
- **ORD-05** Order numbers follow the format `NIVAANA-00000000NNN`. Order details can be looked up by id or order number.
- **ORD-06** **In-store order** (`POST /v1/instore-orders`, CR1 "immediate sale"):
  - the admin picks or creates a customer by mobile, adds products, sets an optional manual discount (not more than the merchandise subtotal) and the payment method
  - each checkout reference can be used once
  - stock is allocated and marked Sold at once, the order is saved as `delivered`, and the invoice uses the store pincode
  - combos need active components; every product needs a selling price and HSN/GST
- **To confirm:** CR1 "dispatch later" mode is specified but not built. In-store orders are always immediate sales today.

## 5. Fulfilment (Inventory)

- **ORD-07** The Inventory order detail runs these steps:
  1. **Ready for dispatch** (`PATCH /:id/ready-for-dispatch`). Physical stock units are **allocated** to each order line in the same transaction:
     - either units the admin chooses (`stock_ids`, `skus`, or a batch / supplier / PO filter)
     - or automatically: `nivapp`, `available`, `ecompublish = true`, oldest first (FIFO)
     - combos are allocated per component (quantity × `requiredqty`, automatic only)
     - allocated units become **`sold`** (order id, order line number, sold date), and on platform stock `orderedqty → soldqty` and `ecomqty −`
     - not enough units → the step fails with "Insufficient available stock: Need X, Found Y" and nothing is saved
  2. **Create shipment** with Ekart or Shipmozo (module 09), or **Manual ship** (`/manual-ship`: vendor and tracking typed in). This needs an HSN/GST snapshot on every line.
  3. **Mark shipped**. This needs a `tracking_id` and is blocked for cancelled or returned orders.
  4. status updates until delivered

  The full quantity changes per step are in [19_End_to_End_Flows.md](19_End_to_End_Flows.md) Part B.
- **ORD-08** The Ekart / Shipmozo label uses the product short name. Labels are stored by the file service and their download / print times are recorded.
- **ORD-09** Re-shipping after a courier cancel is allowed. Cancelled AWBs are kept in the order's AWB history (FIX-2026-10-13-110 … 112).
- **ORD-10** Customer-facing apps show **Track** only while the order is on its way, and show the return deadline on delivered items (FIX-2026-10-08-88).

## 6. Cancellation

- **ORD-11** A customer or admin can cancel the **whole order** while it is in `order_placed`, `payment_completed`, `order_confirmed`, `packed` or `ready_for_dispatch` (`POST /v1/orders/:id/cancel`). Mobile cancels the whole order too (FIX-2026-10-09-94).
- **ORD-12** Cancel locks the order row (`FOR UPDATE`). Stock is given back **after** the cancel is committed, and only once (FIX-2026-10-09-103).
- **ORD-13** If a courier shipment exists, it is cancelled with the courier first (Ekart / Shipmozo). A refund follows (module 07).
- **ORD-14** Line-level cancel (`PATCH /v1/orderlines/:id/cancel`) uses the same status rule. Customer apps do not offer it.

## 7. Marketplace orders in Inventory (CR2)

- **ORD-15** The Orders page shows **Nivaana orders only**. Amazon orders have their own Amazon order hub and detail page (FIX-2026-10-22-157). Amazon Self Ship orders use the same shipment buttons (module 11).

## 8. Access

- **ORD-16** Customers read only their own orders (404 otherwise). Inventory users read all orders.

## 9. Screens

- **Inventory:** Orders, Order Detail (summary, price breakdown, items, invoice, shipment, status history, menu actions), In-store Orders.
- **E-com:** Orders (10 per page, infinite scroll), order detail.
- **Mobile:** My Orders (grouped), Order Detail, Track Order, Cancel.

## 10. Gaps and items to confirm

- The CR1 "dispatch later" mode is not built (see ORD-06).
- The status list is spread over code and picklists. Confirm the final list and labels shown to customers.
- `ORDER_FLOW_EXAMPLES.md`, `ORDER_CANCELLATION_ANALYSIS.md` and `CUSTOMER_CANCELLATION_GUIDE.md` are older than FIX-2026-10-09-103. This file supersedes them.

## 11. Source documents

`CR1_OFFLINE_ORDERS_INVENTORY_PLAN.md`, `CR2_MARKETPLACE_ORDER_ACTIONS_AND_SHIPMENT_PLAN.md`, `ORDER_ORDERLINE_CALCULATION_GUIDE.md`, `READY_FOR_DISPATCH_API_DOCUMENTATION.md`, Inventory `rules/orderfullfilment.md`, `rules/orderfullfilment_status.md`.
