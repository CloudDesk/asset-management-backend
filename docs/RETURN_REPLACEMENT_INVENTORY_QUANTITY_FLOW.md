# Return and Replacement Inventory Quantity Flow

## 1. Purpose

This document defines the inventory quantity behavior for customer returns and replacements.

It covers:

- The existing normal order, dispatch, and cancellation flow.
- Replacement stock reservation after request approval.
- Returned products inspected as `resellable` or `damaged`.
- System-controlled `on_hold` handling for wrong-item and missing-item parcel exceptions.
- Missing-item claims where no physical item is returned.
- Product, PlatformStock, Stock, and e-commerce quantity changes.
- Required implementation corrections and acceptance tests.

---

## 2. Agreed business outcomes

The warehouse inspection UI has only two selectable outcomes:

1. `resellable`
2. `damaged`

`on_hold` is a system-controlled inventory/investigation action for wrong-item or missing-item parcel exceptions. It is not a third warehouse inspection selection.

A missing-item claim keeps the resolution workflow on hold for investigation, but it does not create a returned Stock movement because no physical unit was received.

| Case | Inventory result |
|---|---|
| Correct product and sellable | Original Stock row becomes `available` |
| Correct product but damaged | Original Stock row becomes `damaged` |
| Wrong or unidentified physical item received | Received physical item becomes `on_hold` |
| Missing item in parcel | Resolution is held for investigation; no inbound Stock status change |

---

## 3. Source of truth

Individual rows in the `stock` table are the inventory source of truth.

`product` and `platformstock` contain aggregate quantities. Their values must be derived from Stock rows plus temporary/confirmed reservation quantities.

Never treat `availablequantity` or `availableqty` as an independent lifetime counter. They represent the quantity currently free for a new order.

---

## 4. Field definitions

### 4.1 Product

| Field | Definition |
|---|---|
| `quantity` | Current warehouse stock excluding Stock rows with `stockstatus = sold` |
| `ecompublishedquantity` | Count of active Stock rows where `stockstatus = available` and `ecompublish = true` |
| `availablequantity` | E-commerce stock currently free for new confirmed orders |
| `orderedquantity` | Confirmed normal-order and replacement quantity waiting for dispatch |
| `soldquantity` | Count of Stock rows currently having `stockstatus = sold` |

Product does not have a payment `lockqty` field.

### 4.2 PlatformStock

| Field | Definition |
|---|---|
| `ecomqty` | Count of active Stock rows for the platform where `stockstatus = available` and `ecompublish = true` |
| `availableqty` | Platform stock currently free for new orders |
| `orderedqty` | Confirmed normal-order and replacement quantity waiting for dispatch |
| `lockqty` | Short-lived payment initiation lock only |
| `soldqty` | Count of platform Stock rows currently having `stockstatus = sold` |
| `totalqty` | Existing platform aggregate; it must not be used to decide sellable availability |

The current PlatformStock recalculation counts every active Stock row in `totalqty`, including sold rows. The current Product recalculation excludes sold rows from `quantity`. These two total fields therefore do not currently have identical semantics.

### 4.3 Condition quantities

There are currently no `damagedqty` or `onholdqty` columns in Product or PlatformStock.

They are derived from Stock rows:

```text
damaged quantity = count(stockstatus = 'damaged')
on-hold quantity = count(stockstatus = 'on_hold')
```

### 4.4 Sold quantity is not lifetime sales

`soldquantity` and `soldqty` represent Stock rows currently outside the warehouse with `stockstatus = sold`.

They are not lifetime sales metrics. Lifetime sales and revenue must be calculated from completed order/orderline records.

---

## 5. Required availability formulas

### 5.1 Product

```text
Product.availablequantity =
    Product.ecompublishedquantity
    - Product.orderedquantity
```

### 5.2 PlatformStock

```text
PlatformStock.availableqty =
    PlatformStock.ecomqty
    - PlatformStock.orderedqty
    - PlatformStock.lockqty
```

All calculated values must be bounded at zero:

```text
available = max(0, calculated value)
```

### 5.3 Why sold quantity must not be subtracted

`ecompublishedquantity` and `ecomqty` already count only Stock rows whose status is `available`.

A `sold` Stock row is already excluded from e-commerce quantity. Subtracting `soldquantity` or `soldqty` again would reduce availability twice.

Incorrect formula:

```text
availableqty = ecomqty - orderedqty - soldqty - lockqty
```

Correct formula:

```text
availableqty = ecomqty - orderedqty - lockqty
```

---

## 6. Example assumptions

Every table below uses the same example:

```text
Initial Stock rows: 5
Order quantity: 1
Replacement quantity: 1
Platform: NIVAPP
All initial units: available and ecompublish = true
```

The `Ecom Qty`, `Available`, `Ordered`, `Sold`, and condition columns below apply to the relevant Product and NIVAPP PlatformStock aggregates.

---

## 7. Existing normal order flow

### 7.1 Initial stock

| Event | Ecom Qty | Available | Lock | Ordered | Sold | Damaged | On Hold |
|---|---:|---:|---:|---:|---:|---:|---:|
| Five units added | 5 | 5 | 0 | 0 | 0 | 0 | 0 |

Stock rows:

```text
5 units: stockstatus = available
5 units: ecompublish = true
```

### 7.2 Payment initiation

The payment initiation lock exists only in PlatformStock.

| Event | Ecom Qty | Available | Lock | Ordered | Sold |
|---|---:|---:|---:|---:|---:|
| Before initiation | 5 | 5 | 0 | 0 | 0 |
| After initiation | 5 | 4 | 1 | 0 | 0 |

PlatformStock changes:

```text
lockqty:      0 -> 1
availableqty: 5 -> 4
ecomqty:      remains 5
orderedqty:   remains 0
soldqty:      remains 0
```

Product quantities remain unchanged during the temporary payment lock. The storefront must use PlatformStock availability during this stage.

### 7.3 Payment success or confirmed COD order

| Event | Ecom Qty | Available | Lock | Ordered | Sold |
|---|---:|---:|---:|---:|---:|
| Payment initiated | 5 | 4 | 1 | 0 | 0 |
| Order confirmed | 5 | 4 | 0 | 1 | 0 |

Changes:

```text
lockqty:      1 -> 0
orderedqty:   0 -> 1
availableqty: remains 4
ecomqty:      remains 5
```

Product changes:

```text
orderedquantity:   0 -> 1
availablequantity: 5 -> 4
```

No Stock row becomes `sold` at order confirmation.

### 7.4 Original order dispatch

| Event | Ecom Qty | Available | Lock | Ordered | Sold |
|---|---:|---:|---:|---:|---:|
| Before dispatch | 5 | 4 | 0 | 1 | 0 |
| After dispatch | 4 | 4 | 0 | 0 | 1 |

Allocated Stock row:

```text
stockstatus:     available -> sold
orderid:         original order ID
orderlinenumber: original orderline number
solddate:        dispatch timestamp
```

Aggregate changes:

```text
ecom quantity: 5 -> 4
ordered:       1 -> 0
sold:          0 -> 1
available:     remains 4
```

### 7.5 Cancellation before dispatch

```text
ordered:       1 -> 0
available:     4 -> 5
ecom quantity: remains 5
sold:          remains 0
```

There is no Stock status change because the unit was not dispatched.

### 7.6 Cancellation after stock was marked sold

If the existing business flow permits this operation, the allocated Stock row returns to `available`:

```text
stockstatus:     sold -> available
ecompublish:     true
orderid:         cleared
orderlinenumber: cleared
solddate:        cleared
```

Aggregate result:

```text
ecom quantity: 4 -> 5
available:     4 -> 5
sold:          1 -> 0
```

---

## 8. Replacement approval and reservation

### 8.1 Required design

An approved replacement must use a durable confirmed reservation.

Do not use `lockqty` for replacement reservation. `lockqty` belongs to short-lived payment initiation and may be cleared by payment timeout/cleanup logic.

Recommended implementation:

1. Create a zero-payment replacement order linked to the ReturnRequest.
2. Create a replacement OrderLine for the approved quantity.
3. Use `orderedquantity` and `orderedqty` as the confirmed replacement reservation bucket.
4. Record the exact reserved Stock allocation or a unique reservation record.
5. Dispatch the replacement through the existing order allocation/dispatch lifecycle.

Suggested linkage:

```text
ReturnRequest
  -> Replacement Order
      -> Replacement OrderLine
          -> Reserved/allocated Stock unit
```

### 8.2 Approval quantity changes

Starting after the original order was dispatched:

| Event | Ecom Qty | Available | Replacement Ordered | Sold | Damaged | On Hold |
|---|---:|---:|---:|---:|---:|---:|
| Original order dispatched | 4 | 4 | 0 | 1 | 0 | 0 |
| Replacement approved and reserved | 4 | 3 | 1 | 1 | 0 | 0 |

Changes:

```text
ordered:       0 -> 1
available:     4 -> 3
ecom quantity: remains 4
sold:          remains 1
lock:          remains 0
```

The individual replacement Stock row may remain `available` until dispatch, but a reservation/allocation must prevent any other order from selecting it.

### 8.3 Atomic approval requirement

The following actions must occur in one database transaction:

1. Lock eligible inventory.
2. Confirm sufficient free quantity.
3. Create the replacement order and orderline.
4. Create the inventory allocation/reservation.
5. Increase ordered quantity.
6. Mark the ReturnRequest approved.

If stock is unavailable, the request must move to the configured fallback/pending-stock flow without partially approving or reserving inventory.

---

## 9. Warehouse receipt rule

Marking a return `received_at_warehouse` records physical receipt but must not decide inventory condition.

```text
received_at_warehouse:
    no Product quantity change
    no PlatformStock quantity change
    no Stock status change
```

Inventory changes occur only after warehouse inspection selects `resellable` or `damaged`. For a wrong-item or missing-item parcel exception, the system holds the resolution for investigation. A received wrong physical item is also recorded as on-hold inventory.

---

## 10. Resellable return flow

### 10.1 Stock change during inspection

The original Stock row allocated to the original order changes as follows:

```text
stockstatus:     sold -> available
ecompublish:     true, after the unit is approved for online resale
orderid:         cleared
orderlinenumber: cleared
solddate:        cleared
```

The quantity example assumes the resellable unit is approved for online publishing.

### 10.2 Complete resellable table

| Event | Ecom Qty | Available | Replacement Ordered | Sold | Damaged | On Hold |
|---|---:|---:|---:|---:|---:|---:|
| Original order dispatched | 4 | 4 | 0 | 1 | 0 | 0 |
| Replacement approved and reserved | 4 | 3 | 1 | 1 | 0 | 0 |
| Return received, not inspected | 4 | 3 | 1 | 1 | 0 | 0 |
| Inspection completed: resellable | 5 | 4 | 1 | 0 | 0 | 0 |
| Replacement dispatched | 4 | 4 | 0 | 1 | 0 | 0 |

### 10.3 Inspection calculation

```text
ecom quantity: 4 -> 5
ordered:       remains 1
sold:          1 -> 0
available:     3 -> 4
```

```text
available = ecom quantity - ordered - lock
available = 5 - 1 - 0
available = 4
```

### 10.4 Replacement dispatch

The reserved replacement Stock row changes:

```text
stockstatus:     available -> sold
orderid:         replacement order ID
orderlinenumber: replacement orderline number
solddate:        dispatch timestamp
```

Aggregates:

```text
ecom quantity: 5 -> 4
ordered:       1 -> 0
sold:          0 -> 1
available:     remains 4
```

### 10.5 Final resellable result

```text
ecom quantity = 4
available     = 4
ordered       = 0
lock          = 0
sold          = 1
damaged       = 0
on hold       = 0
```

---

## 11. Damaged return flow

### 11.1 Stock change during inspection

The original Stock row allocated to the original order changes as follows:

```text
stockstatus:     sold -> damaged
ecompublish:     false
orderid:         cleared
orderlinenumber: cleared
solddate:        cleared
```

`ecompublish` must be false so that the damaged unit cannot be published accidentally.

### 11.2 Complete damaged table

| Event | Ecom Qty | Available | Replacement Ordered | Sold | Damaged | On Hold |
|---|---:|---:|---:|---:|---:|---:|
| Original order dispatched | 4 | 4 | 0 | 1 | 0 | 0 |
| Replacement approved and reserved | 4 | 3 | 1 | 1 | 0 | 0 |
| Return received, not inspected | 4 | 3 | 1 | 1 | 0 | 0 |
| Inspection completed: damaged | 4 | 3 | 1 | 0 | 1 | 0 |
| Replacement dispatched | 3 | 3 | 0 | 1 | 1 | 0 |

### 11.3 Inspection calculation

```text
ecom quantity: remains 4
ordered:       remains 1
sold:          1 -> 0
damaged:       0 -> 1
available:     remains 3
```

The e-commerce quantity does not change when the original Stock row changes from `sold` to `damaged`:

- A sold row is not counted in e-commerce quantity.
- A damaged row is not counted in e-commerce quantity.

```text
available = ecom quantity - ordered - lock
available = 4 - 1 - 0
available = 3
```

### 11.4 Replacement dispatch

```text
replacement Stock: available -> sold
ecom quantity:     4 -> 3
ordered:           1 -> 0
sold:              0 -> 1
damaged:           remains 1
available:         remains 3
```

### 11.5 Final damaged result

```text
ecom quantity = 3
available     = 3
ordered       = 0
lock          = 0
sold          = 1
damaged       = 1
on hold       = 0
```

---

## 12. Wrong or unidentified physical item: On Hold

`on_hold` is not a normal inspection dropdown outcome. It is a system-controlled investigation state for wrong-item or missing-item parcel exceptions. When a wrong or unidentified physical unit is received, that received unit is also recorded as on-hold inventory.

```text
received item stockstatus = on_hold
received item ecompublish = false
```

An on-hold unit must not increase e-commerce quantity or available quantity.

### 12.1 Expected original Stock row identified

If the physically received unit can be verified as the original allocated Stock row but requires investigation:

```text
original Stock: sold -> on_hold
sold:           -1
on hold:        +1
ecom quantity:  no change
available:      no direct increase
```

### 12.2 Completely different or unidentified item received

If the received item is not the original allocated Stock row:

```text
Record the received physical unit as on_hold.
Do not change the original allocated Stock row from sold.
Do not increase e-commerce or available quantity.
```

This prevents the system from incorrectly returning the originally sold product to warehouse inventory.

The replacement reservation must be released or retained according to the final admin decision. The on-hold receipt alone must not automatically dispatch a replacement.

---

## 13. Missing-item claim

A missing-item claim means no physical returned unit was received.

The resolution workflow must remain on hold for investigation until the claim is approved or rejected. This does not require inventing a returned Stock row or changing the original Stock row.

Therefore, there is no inbound inventory movement:

```text
no returned Stock status change
no ecom quantity change
no available quantity change
no damaged quantity change
no on-hold quantity change
```

If a missing-item shipment is approved, reserve the outgoing quantity using the same confirmed-order mechanism:

```text
ordered:   +1
available: -1
```

On missing-item shipment dispatch:

```text
outgoing Stock: available -> sold
ecom quantity:  -1
ordered:        -1
sold:           +1
```

Do not create an on-hold Stock row when no physical item was received.

The distinction is mandatory:

```text
Workflow:  on hold for investigation
Stock row: no inbound movement because no unit was received
```

---

## 14. Replacement cancellation and reservation release

Release a reserved replacement when it will not be dispatched.

Release cases include:

- Customer cancels the replacement before dispatch.
- Admin cancels the replacement before dispatch.
- Return pickup permanently fails.
- Customer does not hand over the return within the allowed SLA.
- Replacement changes to a refund fallback.
- Inspection/admin decision rejects the replacement claim.
- Shipment creation fails before carrier acceptance and the fulfillment is cancelled.

Example before release:

```text
ecom quantity = 4
available     = 3
ordered       = 1
```

After release:

```text
ecom quantity = 4
available     = 4
ordered       = 0
```

No Stock status change is required for the replacement unit because it was never dispatched.

Reservation release must be idempotent. Repeating the cancellation/release request must not increase available quantity more than once.

---

## 15. Replacement shipment failure and RTO

### 15.1 Failure before dispatch/carrier acceptance

If the Stock row is still available and only reserved:

```text
release ordered quantity
increase free availability
do not change sold quantity
```

### 15.2 Replacement already dispatched

Once replacement Stock has changed to `sold`, do not restore it merely because a tracking event failed.

If the replacement shipment physically returns to the warehouse, process that physical unit through warehouse receipt and the same limited inspection choices:

- `resellable`
- `damaged`

If the received parcel contains the wrong/unidentified physical item, route the request and received item to the system-controlled on-hold investigation flow.

---

## 16. Partial quantities

All transitions apply using the actual approved quantity `q`.

Replacement approval:

```text
ordered += q
available -= q
```

Resellable inspection:

```text
ecom quantity += resellable quantity
sold -= resellable quantity
```

Damaged inspection:

```text
damaged += damaged quantity
sold -= damaged quantity
```

Replacement dispatch:

```text
ecom quantity -= dispatched quantity
ordered -= dispatched quantity
sold += dispatched quantity
```

The sum of inspected quantities must not exceed the warehouse received quantity, and the received quantity must not exceed the approved/requested return quantity.

---

## 17. Existing implementation

### 17.1 What already exists

The return inspection implementation already:

- Validates received, approved, and rejected quantities.
- Locates original Stock rows using the original order and orderline.
- Moves approved original Stock rows from `sold` to `available` or `damaged`.
- Moves rejected physical receipts to `on_hold`.
- Clears the original order allocation fields from moved Stock rows.
- Refreshes Product and PlatformStock aggregates after movement.

Relevant implementation:

```text
src/services/return-request.service.ts
```

### 17.2 What does not yet exist

The current request approval method changes the ReturnRequest approval status but does not reserve replacement inventory.

The current resolution flow checks replacement availability and records shipment information, but it does not atomically allocate and consume a replacement Stock row.

This permits a race where two replacement requests can both observe the same last available unit.

### 17.3 Current aggregate formula problem

The current Product and PlatformStock recalculation logic counts only `available + ecompublish` Stock rows as e-commerce quantity, but then subtracts sold quantity again.

The formula must be corrected before the return/replacement aggregates are considered reliable.

Relevant implementations:

```text
src/services/platformStock.service.ts
src/services/product.service.ts
```

### 17.4 Aggregate refresh transaction boundary

The Stock movement is currently performed inside the inspection transaction, while Product and PlatformStock aggregate refresh happens afterward.

If aggregate refresh fails, Stock rows can be correct while cached aggregates remain stale.

The preferred solution is either:

1. Update/recalculate aggregates inside the same transaction, or
2. Commit a durable inventory movement event and retry aggregate projection until successful.

---

## 18. Required implementation changes

### Required change 1: Correct aggregate formulas

```text
Product.availablequantity =
    ecompublishedquantity - orderedquantity
```

```text
PlatformStock.availableqty =
    ecomqty - orderedqty - lockqty
```

### Required change 2: Reserve during replacement approval

In one database transaction:

1. Lock inventory records.
2. Verify free quantity.
3. Create linked replacement order/orderline.
4. Create a unique Stock reservation/allocation.
5. Increase Product and PlatformStock ordered quantities.
6. Approve the ReturnRequest.

### Required change 3: Consume reservation during replacement dispatch

In one database transaction:

1. Load the linked replacement allocation.
2. Confirm it has not already been dispatched or released.
3. Change the reserved Stock row from `available` to `sold`.
4. Add replacement order and orderline references.
5. Reduce ordered quantity.
6. Recalculate e-commerce, available, and sold quantities.
7. Mark the replacement fulfillment dispatched.

### Required change 4: Release reservation for non-dispatch outcomes

In one database transaction:

1. Verify the reservation is active.
2. Mark it released.
3. Reduce ordered quantity.
4. Recalculate free availability.

### Required change 5: Enforce only the agreed outcomes

Warehouse-selectable inspection outcomes:

```text
resellable
damaged
```

System-controlled wrong-item/missing-item investigation state:

```text
on_hold
```

### Required change 6: Apply e-commerce publication state during inspection

For a returned unit approved as resellable for NIVAPP:

```text
stockstatus = available
ecompublish = true
```

For a returned unit inspected as damaged:

```text
stockstatus = damaged
ecompublish = false
```

The current inspection stock update changes `stockstatus` but preserves the previous `ecompublish` value. It must explicitly apply the correct publication state so a damaged unit cannot remain published and a resellable unit can return to the intended e-commerce pool.

Product and PlatformStock availability statuses must be calculated from the final free availability value, not from raw e-commerce quantity before ordered/lock quantities are deducted.

### Required change 7: Preserve identity for wrong-item receipts

Do not move the original sold Stock row to on hold when the received physical item is a different/unidentified unit.

The received item must be recorded separately as on hold, while the original allocated Stock row remains sold until reconciliation establishes otherwise.

Backend schemas, route validation, and frontend controls must reject every warehouse inspection selection other than `resellable` and `damaged`. `on_hold` must be assigned only by the exception-handling logic.

---

## 19. Concurrency and idempotency requirements

Every stock-changing operation must be atomic and safe to repeat.

Required controls:

- Lock eligible inventory while reserving replacement stock.
- Prevent two orders from reserving the same Stock unit.
- Add a unique relationship between ReturnRequest and its replacement fulfillment.
- Prevent duplicate replacement orders for the same approved quantity.
- Prevent approval retry from increasing ordered quantity twice.
- Prevent inspection retry from moving the same original Stock row twice.
- Prevent dispatch retry from consuming two replacement Stock rows.
- Prevent cancellation retry from releasing quantity twice.
- Store inventory movement references in the status timeline/audit metadata.

---

## 20. Verification SQL

### 20.1 Product aggregate

```sql
SELECT
  id,
  puc,
  quantity,
  ecompublishedquantity,
  availablequantity,
  orderedquantity,
  soldquantity
FROM product
WHERE id = :product_id;
```

### 20.2 PlatformStock aggregate

```sql
SELECT
  id,
  productid,
  platform,
  totalqty,
  ecomqty,
  availableqty,
  orderedqty,
  lockqty,
  soldqty
FROM platformstock
WHERE productid = :product_id
  AND platform = 'NIVAPP';
```

### 20.3 Stock status breakdown

```sql
SELECT
  LOWER(stockstatus) AS stock_status,
  ecompublish,
  COUNT(*) AS quantity
FROM stock
WHERE puc = :puc
  AND COALESCE(isdeleted, false) = false
  AND COALESCE(isarchive, false) = false
GROUP BY LOWER(stockstatus), ecompublish
ORDER BY LOWER(stockstatus), ecompublish;
```

### 20.4 Damaged and on-hold quantities

```sql
SELECT
  COUNT(*) FILTER (WHERE LOWER(stockstatus) = 'damaged') AS damaged_quantity,
  COUNT(*) FILTER (WHERE LOWER(stockstatus) = 'on_hold') AS on_hold_quantity
FROM stock
WHERE puc = :puc
  AND COALESCE(isdeleted, false) = false
  AND COALESCE(isarchive, false) = false;
```

### 20.5 Expected availability verification

```sql
SELECT
  platform,
  ecomqty,
  orderedqty,
  COALESCE(lockqty, 0) AS lockqty,
  availableqty AS stored_availableqty,
  GREATEST(0, ecomqty - orderedqty - COALESCE(lockqty, 0)) AS expected_availableqty
FROM platformstock
WHERE productid = :product_id;
```

---

## 21. Acceptance test matrix

### Test 1: Replacement approval

Starting state:

```text
ecom = 4, available = 4, ordered = 0, sold = 1
```

Expected after approval:

```text
ecom = 4, available = 3, ordered = 1, sold = 1
```

### Test 2: Resellable return and replacement dispatch

Expected after inspection:

```text
ecom = 5, available = 4, ordered = 1, sold = 0
```

Expected after replacement dispatch:

```text
ecom = 4, available = 4, ordered = 0, sold = 1, damaged = 0
```

### Test 3: Damaged return and replacement dispatch

Expected after inspection:

```text
ecom = 4, available = 3, ordered = 1, sold = 0, damaged = 1
```

Expected after replacement dispatch:

```text
ecom = 3, available = 3, ordered = 0, sold = 1, damaged = 1
```

### Test 4: Return received but not inspected

Expected:

```text
No Stock status or aggregate quantity change.
```

### Test 5: Wrong physical item received

Expected:

```text
Received physical item is on_hold and ecompublish = false.
Original sold Stock remains sold when the received item does not match it.
No e-commerce or available increase.
```

### Test 6: Missing-item claim

Expected:

```text
Resolution workflow is held while the missing-item claim is investigated.
No inbound Stock movement.
Only the approved outgoing missing-item shipment is reserved and dispatched.
```

### Test 7: Replacement cancellation

Starting state:

```text
ecom = 4, available = 3, ordered = 1
```

Expected after release:

```text
ecom = 4, available = 4, ordered = 0
```

### Test 8: Concurrent approvals with one free unit

Expected:

```text
Only one replacement approval can reserve the unit.
The other request receives the configured unavailable-stock result.
```

### Test 9: Idempotent retry

Expected:

```text
Repeating approval, inspection, dispatch, or cancellation does not apply inventory movement twice.
```

---

## 22. Final expected quantities

### Resellable return with one replacement dispatched

```text
ecom quantity = 4
available     = 4
ordered       = 0
lock          = 0
sold          = 1
damaged       = 0
on hold       = 0
```

### Damaged return with one replacement dispatched

```text
ecom quantity = 3
available     = 3
ordered       = 0
lock          = 0
sold          = 1
damaged       = 1
on hold       = 0
```

### Final decision summary

1. Use `orderedquantity`/`orderedqty` for approved replacement reservation.
2. Do not use `lockqty` for replacement reservation.
3. Change the original Stock row only after warehouse inspection.
4. `resellable` changes the original Stock row from `sold` to `available`.
5. `damaged` changes the original Stock row from `sold` to `damaged` and sets `ecompublish = false`.
6. Use system-controlled `on_hold` for wrong-item and missing-item parcel investigations; it is not a warehouse inspection selection.
7. A missing-item claim holds the resolution workflow but creates no inbound Stock movement because no physical unit was received.
8. Replacement dispatch changes the reserved outgoing Stock row from `available` to `sold`.
9. Calculate availability without subtracting sold quantity.
10. Make approval, inspection, dispatch, and reservation release transactional and idempotent.
