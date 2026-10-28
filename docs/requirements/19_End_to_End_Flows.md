# 19 · End-to-End Flows — Buy-to-Stock and Order-to-Delivery

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` code:
- `stock.service.ts`, `platformStock.service.ts` (`updatePlatformStockQuantities`, `recalculatePlatformStockQuantities`)
- `phonepe.controller.ts` (lock ~L1170–1235, convert ~L5640–5700 and L6990, release ~L1995–2030)
- `orders.service.ts` (`autoSelectStocks` L1445, `allocateStockToOrderlines` L1567, `updateStockForDispatch`, `markReadyForDispatch` L1987, `markShipped` L2162, `cancelOrder` L4290, `cancelOrderBeforeReadyForDispatch` L5077, `cancelOrderAfterReadyForDispatch` L5279)
- `instore-order.service.ts`, `purchaseorder` / `poinvoice` services

This file shows **what happens at each step and how every quantity changes**. The rules for each module are in files 03, 04, 06, 07, 08, 09 and 10.

## 0. The three quantity layers

| Layer | Where | What it holds |
| --- | --- | --- |
| **Stock row** | `stock` (one row per physical unit) | `stockstatus` (available / sold / damaged …), `ecompublish`, `platform`, and once sold: `orderid`, `orderlinenumber`, `solddate`. Also `poid`, `supplierid`, `batchno`. |
| **Platform stock** | `platformstock` (one row per product × platform) | `totalqty`, `ecomqty`, `orderedqty`, `lockqty`, `soldqty`, `damagedqty`, `availableqty` |
| **Product totals** | `product` | `quantity`, `ecompublishedquantity`, `orderedquantity`, `soldquantity`, `damagedquantity`, `availablequantity`, `productstatus` |

**What each platform-stock quantity means:**
- `totalqty` = all active stock rows for the product and platform
- `ecomqty` = rows that are **available and e-com published** (sold and damaged rows are not counted)
- `soldqty` = sold rows; `damagedqty` = damaged rows
- `orderedqty` = units paid for but not yet allocated at Ready for Dispatch (owned by the order flow)
- `lockqty` = units held while a customer is paying (owned by the payment flow)
- **`availableqty = ecomqty − orderedqty − lockqty`**: what the website and app can still sell

**Product status** (from available): more than 5 → `in_stock`; 1–5 → `low_stock`; 0 → `out_of_stock`.

---

# Part A — Buy-to-Stock

```
Supplier ─► Purchase Request ─► Quotes ─► Purchase Order ─► Generate PO PDF
                (approve/reject)              │
                                              ├─► Supplier invoice (PO invoice) ─► PO status updated
                                              └─► Goods arrive ─► Bulk Add Stock / Import (with PO id) ─► stock available
```

| # | Step | Who / where | What happens | Quantity change |
| --- | --- | --- | --- | --- |
| A1 | **Supplier** set up | Inventory → Suppliers | Supplier saved with a unique code, GST, address, and type local or import | — |
| A2 | **Purchase request** raised | Inventory → Purchase Requests → Add | PR saved with status **"In Progress"**, the supplier, line data and a PR number | — |
| A3 | **Quotes** attached | PR detail | Supplier quote files uploaded against the PR number; notes kept per quote | — |
| A4 | **PR approved / rejected** | PR detail (`PUT /purchaserequests/:id/approve` or `reject`) | PR status changes. **No PO is created automatically.** | — |
| A5 | **Purchase order** created | Inventory → Purchase Orders → Create | PO saved with the buyer / invoice-to / deliver-to parties, a supplier snapshot, products, tax, totals, payment terms and the PR number | — |
| A6 | **Generate PO** | PO detail | The file service builds the PDF from the `.docx` template, then calls back `PUT /v1/purchaseorders/:id` (with the user's token) to save the PDF URL | — |
| A7 | **Supplier invoice** | PO detail → invoices (`/v1/poinvoices`) | Invoice number, amount, balance, due date, transport charges, customs fields for imports. The PO's purchase-order status is updated. | — |
| A8 | **Goods arrive → stock added** | Inventory → Stocks → **Bulk Add Stock** (or Excel import) | One **stock row per unit**: PUC, platform, batch no, **PO id and supplier id (optional)**, serial number / SKU, `ecompublish` flag, status `available`. Up to 10,000 units per save, written in batches of 500. | Stock rows **+N**, `available`. Platform stock: `totalqty +N`, and `ecomqty +N` only if `ecompublish = true`. Then `availableqty = ecomqty − orderedqty − lockqty`. Product totals are recounted from the stock rows. |
| A9 | **Publish to e-com** (if added unpublished) | Stock edit (`ecompublish` true) | The unit becomes sellable online | Platform stock is recounted: `ecomqty +1`, `availableqty +1` |
| A10 | **Move to another channel** | Stock edit (platform change) | Transfer between platforms | Old platform's quantities go down and the new platform's go up (transfer operation) |
| A11 | **Mark damaged** | Stocks → Mark as Damaged | **Blocked (409)** if the platform has `orderedqty + lockqty > 0` and `availableqty < 1` | Status `damaged`. Platform stock recount: `ecomqty −1` (if it was published), `damagedqty +1`, `availableqty` recalculated. |

### Buy-to-Stock decision (2026-10-28)
**The current flow above is the approved requirement; no change is planned** (module 04, PUR-16 – PUR-20):
- **No goods-receipt step.** Stock is added through Bulk Add / Import with an optional PO id. Received units are not compared with PO quantities.
- **PR → PO is manual.** There are no approval levels, and a PO does not need an approved PR.
- PO and invoice statuses come from picklists, with no fixed transition rules.

---

# Part B — Order-to-Delivery (website / app order)

```
Cart ─► Checkout quote ─► Pay (lock) ─► Payment success (order created, lock→ordered)
     ─► Ready for Dispatch (stock units allocated, ordered→SOLD) ─► Create shipment (Ekart/Shipmozo/Manual)
     ─► Mark shipped ─► in transit ─► out for delivery ─► Delivered
                                   └─► RTO (courier returns it) ─► RTO record ─► warehouse ─► restock per inspection
```

Example used in the table: product **P**, platform `nivapp`, starting with `ecomqty 10, orderedqty 0, lockqty 0, soldqty 0` → `availableqty 10`. The customer buys **2**. (`soldqty` starts at 0 so that the two formulas in Finding 1 give the same numbers. With earlier sales, the payment steps B3–B4 write a lower `availableqty`.)

| # | Step | Trigger | What happens | Stock rows | Platform stock (`nivapp`) | Order status |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | **Add to cart** | Customer | Cart row (`iscart`). Unavailable items block checkout. | — | — (read only) | — |
| B2 | **Checkout quote** | Cart / Checkout | V2 promotion evaluation saved (expires in 15 min). Coupon and wallet are quoted. Shipping is ₹150 unless Free Shipping applies. | — | — | — |
| B3 | **Pay → lock** | `POST /v1/phonepe/initiate` or `/create-sdk-order` | Checks prices, promotion, coupon and wallet. Checks **`product.availablequantity ≥ qty`** and **platform `availableqty ≥ qty`** under `SELECT … FOR UPDATE`. Saves the transaction. Reserves wallet credit for 15 min. Schedules a Cloud Task (120 s) to release the lock. | — | `lockqty +2` → 2; `availableqty −2` → **8**. **Product row unchanged.** | (no order yet) |
| B4a | **Payment success** | PhonePe webhook / callback / status check | `createOrderAfterPayment`: creates the order and order lines (prices, discounts, HSN/GST snapshot), redeems promotions, coupon and wallet, clears the cart, sends notifications | — (no unit chosen yet) | `lockqty −2` → 0; `orderedqty +2` → 2; `availableqty` unchanged → **8**. **Product:** `orderedquantity +2`, `availablequantity −2`, status recalculated. | `order_placed` / `payment_completed` |
| B4b | **Payment failed / abandoned** | Cloud Task `cleanup-lock`, or failure callback | Checks the payment status first. The wallet reservation is reversed. | — | `lockqty −2` → 0; `availableqty +2` → **10**. Product row unchanged. | `payment_failed` (if recorded) |
| B5 | **Packed** (optional) | Inventory | Status only | — | — | `packed` |
| B6 | **Ready for Dispatch** | Inventory → Order detail (`PATCH /orders/:id/ready-for-dispatch`) | **Physical units are allocated to the order lines** (see B6 rules). Order lines → `ready_for_dispatch`. | 2 rows → **`sold`**, with `orderid`, `orderlinenumber` and `solddate` set | `orderedqty −2` → 0; `soldqty +2` → 2; `ecomqty −2` (published units) → 8; `availableqty = 8 − 0 − 0` → **8** | `ready_for_dispatch` |
| B7 | **Create shipment** | Order detail → Create Shipment: Ekart (pickup warehouse chosen) / Shipmozo / Manual | Courier booked; AWB, vendor, label and tracking link saved. Every line needs an HSN/GST snapshot. | — | — | stays `ready_for_dispatch` |
| B8 | **Mark shipped** | Order detail (`PATCH /orders/:id/mark-shipped`) | Needs a `tracking_id`. Blocked for cancelled or returned orders. | — | — | `shipped` |
| B9 | **In transit → Out for delivery → Delivered** | Ekart webhook / Sync Ekart Tracking; Shipmozo Cloud Scheduler (5 min) / webhook / manual sync; manual status update | Status history and dates (UTC); push and email to the customer | — | — | `in_transit` → `out_for_delivery` → `delivered` |
| B10 | **COD paid** (COD orders only) | Inventory | Only after `delivered` | — | — | `cod_payment_received` |

### B6 rules — how units are allocated at Ready for Dispatch
1. **The admin can choose units** per order line:
   - specific `stock_ids`, or
   - `skus`, or
   - a **batch filter** (batch no / supplier / PO)
2. **Otherwise the system chooses** (`autoSelectStocks`): platform `nivapp`, `stockstatus = available`, **`ecompublish = true` only**, **oldest first (FIFO by `createddate`)**, as many as the line quantity.
3. **Combo products:** units are allocated for each **component**, quantity × `requiredqty`. Only automatic selection is allowed for components. Every component unit must be available and published. Component platform stock and products are updated, not the combo itself.
4. **Not enough units:** the whole step fails, with nothing saved — "Insufficient available stock: Need X, Found Y" (with batch details when a filter was used).
5. All of this runs in one database transaction with the status change.

---

# Part C — Cancellation, return and RTO (stock side)

| # | Event | Allowed when | Stock rows | Platform stock / product | Money |
| --- | --- | --- | --- | --- | --- |
| C1 | **Cancel before Ready for Dispatch** | Status `order_placed`, `payment_completed`, `order_confirmed` or `packed` | — (none allocated yet) | `orderedqty −qty`, `availableqty +qty` | Refund preview, then refund (wallet / original sources) |
| C2 | **Cancel at Ready for Dispatch** | Status `ready_for_dispatch` | Allocated rows go back to **`available`**; `orderid` / `orderlinenumber` are cleared | `soldqty −qty`; `ecomqty +` (published units); `availableqty = ecomqty − orderedqty − lockqty`; product sold quantity reversed (components for combos) | Same. A courier shipment, if any, is cancelled first. |
| C3 | Cancel after shipped | **Not allowed** for customers or the order cancel | — | — | Use return or RTO |
| C4 | **Courier cancels the shipment** (Ekart portal / Shipmozo) | `shipped` / `in_transit` / `out_for_delivery` | No change (units stay `sold` to this order) | No change | Order goes back to `ready_for_dispatch`; AWB moved to history; re-ship allowed |
| C5 | **RTO** (courier returns the parcel) | Courier reports `rto_initiated` / `rto_delivered` | RTO record per line, created automatically; the unit is restocked only after warehouse verification | As inspection decides | Refund if prepaid (per policy) |
| C6 | **Customer return / replacement** | After `delivered`, within the reason / policy window | **Receiving changes nothing.** Inspection decides: restock to available, damaged, quarantine or on hold. | Recount on the restock action | Refund = paid share; credit note; replacement shipped |

Lock order and timing for cancel (FIX-2026-10-09-103): the order row is locked (`FOR UPDATE`), the cancel is saved, and **only then** is stock given back, once. If giving the stock back fails, the cancel is kept and an error is logged for manual correction.

---

# Part D — In-store order (immediate sale)

| # | Step | What happens | Stock rows | Platform stock / product | Order status |
| --- | --- | --- | --- | --- | --- |
| D1 | Pick customer (by mobile) and products | Inventory → In-store Orders | — | — | — |
| D2 | Save with cash / card / UPI | Checks selling price, HSN/GST, combo components; manual discount ≤ subtotal; unique checkout reference | Units allocated from `nivapp`: **unpublished units first** (`ecompublish = false`), then published; oldest first; marked **`sold`** at once | Product and platform totals recounted from the stock rows (sold up; published units leave `ecomqty`) | **`delivered`** at once; invoice uses the store pincode |

---

# Part E — Amazon orders (stock side)

| Type | Stock effect |
| --- | --- |
| FBA | None. Amazon's stock is read only. |
| Easy Ship | Stock is marked sold when Amazon reports **Shipped**. |
| Self Ship | Same as a website order from B7 on: Ship now (Ekart / Shipmozo / Manual) and delivery tracking. |

Stock sync pushes `availableqty ÷ pack size` to one mapped listing per product (module 11).

---

## Older payment documents vs current code (checked 2026-10-27)

`PHONEPE_COMPLETE_IMPLEMENTATION_GUIDE.md` (last changed 2025-10-08) and `PHONEPE_BACKEND_FEATURES_FOR_REACT_NATIVE.md` (last changed 2025-10-14) are a year older than the code. Their quantity sections are **out of date**; use this file instead.

| Point | Old document says | Code does today | Verdict |
| --- | --- | --- | --- |
| Lock release time | 15 minutes (RN doc: "Auto-release after 15 minutes") | `LOCK_CLEANUP_DELAY_SECONDS` = **120 s** (code default, `.env`, `.env.sit`, `.env.uat`; the code comment says "changed from 15 minutes") | ❌ Old doc wrong |
| Platform stock check | `actualAvailable = availableqty − lockqty` (Complete Guide) | Checks `availableqty ≥ qty` directly; `availableqty` already excludes locks | ❌ Old doc wrong (would double-count locks) |
| When the platform stock changes | All at once **after** payment: `availableqty −q`, `lockqty +q`, `orderedqty +q` (Complete Guide "AFTER Payment") | **At initiate:** `lockqty +q`, `availableqty −q`. **After success:** `lockqty −q`, `orderedqty +q`, `availableqty` unchanged. **On failure / timeout:** `lockqty −q`, `availableqty +q`. | ❌ Old doc wrong. Leaving `lockqty` raised after payment would hold stock forever. |
| Product row | `orderedquantity +q`, `availablequantity −q` after payment | Same: only on success (`updateProductQuantitiesAfterOrder`), never at lock | ✅ Matches |
| Product status thresholds | ≤0 out of stock, 1–5 low, >5 in stock | Same | ✅ Matches |
| Product quantity check at initiate | `product.availablequantity ≥ qty` | Same (`INSUFFICIENT_PRODUCT_QUANTITY`) | ✅ Matches |
| Callback step "Convert Lock Qty to Available Qty" (RN doc diagram) | Lock goes back to available on success | Lock becomes **ordered** on success | ❌ Old doc wording wrong |
| COD | `lockqty` reset to 0, converted to order | Lock and convert happen in the same request | ✅ Matches |
| What is not covered at all | Ready for Dispatch allocation, sold quantity, `ecomqty`, cancel / return reversal | Parts B6, C and D above | ⚠️ Missing in old docs |

Both guides now carry a "Superseded" note at the top. `docs/phonepe/payment-flow-and-operations.md` §2 said "`platformStock.availableqty - lockqty`"; it was corrected on 2026-10-27 to match the code.

## Findings while tracing the code (to fix or confirm)

1. **Two different formulas for available quantity.**
   - **Stock recount**, Ready for Dispatch and the documented rule use: `ecomqty − orderedqty − lockqty`.
   - **Payment lock, lock release and lock → order conversion** (`phonepe.controller.ts` ~L1219, ~L2010, ~L5690, ~L6326) use: `ecomqty − orderedqty − soldqty − lockqty`.

   Because `ecomqty` already excludes sold units, the payment path **subtracts sold units twice**.

   Example: `ecomqty 10, soldqty 5`, lock 1 → the payment path writes `availableqty 4` instead of 9. The storefront can then show the product as low or out of stock until the next recount or Ready for Dispatch puts it back.

   **Needs a dev check and a fix:** use one shared formula.
2. ~~No goods receipt~~: accepted as the current flow (decision 2026-10-28, Part A).
3. Automatic allocation always uses platform `nivapp`; the code notes "can be enhanced to use order's platform". This is fine while only website and app orders go through Ready for Dispatch. Confirm before Self Ship Amazon orders use the same path.
4. Manual unit selection is not supported for combo components.
5. **The product row does not reflect locks.** `product.availablequantity` drops only when the order is created, so for up to 120 s during payment the product total is higher than the platform's available quantity. This is harmless today, because the payment check also uses the platform row, but screens that read `product.availablequantity` can briefly show more stock than can be sold.
