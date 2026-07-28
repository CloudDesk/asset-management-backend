# CR 1 - Offline Orders in Inventory

## Objective

Support in-store/offline sales from the Inventory application. Admin users should be able to create an offline order from Inventory, allocate stock from the `Nivapp` platform, choose whether the sale is completed immediately or dispatched later, and generate an invoice for the order.

This CR mainly impacts:

- `Inventory` frontend
- `Server` backend
- `orders`
- `orderline`
- `stock`
- `product`
- `platformStock`
- invoice generation flow

## Business Requirement

Inventory admins need to create orders for in-store sales. Stock should be selected from the `Nivapp` platform using this priority:

1. Use available `Nivapp` stock where `ecompublish = false`.
2. If not enough quantity is available, use available `Nivapp` stock where `ecompublish = true`.
3. If total available stock is still less than requested quantity, reject the order.

The admin must choose which fulfillment flow applies to the offline order:

- Immediate sale
- Dispatch later

Both flows must be supported.

## Fulfillment Modes

### Mode 1 - Immediate Sale

Use this mode when the customer buys in store and receives the product immediately.

Expected behavior:

- Create `orders` record.
- Create one or more `orderline` records.
- Allocate physical `stock` records from `Nivapp`.
- Mark allocated stock as `Sold`.
- Map allocated stock to the order using `orderid` and `orderlinenumber`.
- Set `solddate`.
- Increase sold quantity.
- Decrease available quantity.
- Reduce e-commerce published quantity if any consumed stock had `ecompublish = true`.
- Generate invoice immediately.
- No shipment creation is required.

Recommended order status:

- `offline_completed`, or
- `delivered`, if the existing order status model requires a known delivered state.

Recommended stock status:

- `Sold`

### Mode 2 - Dispatch Later

Use this mode when the admin creates the offline order now, but delivery/dispatch will be handled later by the business.

Expected behavior at order creation:

- Create `orders` record.
- Create one or more `orderline` records.
- Allocate/reserve physical `stock` records from `Nivapp`.
- Mark allocated stock as `ordered`.
- Map allocated stock to the order using `orderid` and `orderlinenumber`.
- Increase ordered quantity.
- Decrease available quantity.
- Reduce e-commerce published availability if any consumed stock had `ecompublish = true`.
- Mark invoice as pending.
- No third-party shipment creation is required at this stage.

Recommended order status:

- `offline_confirmed`, or
- `ready_to_dispatch`, if the existing order status model requires a known dispatch state.

Recommended stock status:

- `ordered`

Expected behavior at final dispatch/completion:

- Update order status to dispatched/completed.
- Change allocated stock from `ordered` to `Sold`.
- Decrease ordered quantity.
- Increase sold quantity.
- Set `solddate`.
- Keep stock mapped to the same `orderid` and `orderlinenumber`.
- Generate invoice at dispatch/completion.

## Proposed Backend API

Add a dedicated offline order endpoint instead of overloading PhonePe/COD payment flow.

```http
POST /v1/orders/offline
```

Example request for immediate sale:

```json
{
  "fulfillmentMode": "immediate_sale",
  "paymentMode": "cash",
  "invoiceRequired": true,
  "customer": {
    "name": "Walk-in Customer",
    "phone": "9999999999"
  },
  "items": [
    {
      "productid": 31,
      "puc": "PUC001",
      "quantity": 2,
      "unitPrice": 1200
    }
  ]
}
```

Example request for dispatch later:

```json
{
  "fulfillmentMode": "dispatch_later",
  "paymentMode": "cash",
  "invoiceRequired": true,
  "customer": {
    "name": "Walk-in Customer",
    "phone": "9999999999"
  },
  "items": [
    {
      "productid": 31,
      "puc": "PUC001",
      "quantity": 2,
      "unitPrice": 1200
    }
  ]
}
```

Recommended response:

```json
{
  "success": true,
  "message": "Offline order created successfully",
  "data": {
    "order": {},
    "orderlines": [],
    "allocatedStocks": [],
    "invoice": {
      "status": "generated",
      "url": "https://..."
    }
  }
}
```

## Backend Flow

The complete offline order creation flow must run inside a database transaction.

### Step 1 - Validate Request

Validate:

- `fulfillmentMode` is `immediate_sale` or `dispatch_later`.
- `items` is not empty.
- Each item has `productid` or `puc`.
- Each item has `quantity > 0`.
- Product exists.
- Product is active/sellable, if product status rules exist.
- Payment mode is valid for offline order.

### Step 2 - Allocate Stock

For each requested item:

1. Find available physical stock from `stock`.
2. Filter by:
   - `platform = Nivapp`
   - `stockstatus = available` or equivalent existing available value
   - matching `puc`
   - not deleted
   - not archived
3. Sort priority:
   - first `ecompublish = false`
   - then `ecompublish = true`
4. Select exactly the requested quantity.
5. If requested quantity cannot be fulfilled, fail the whole order before creating records.

Important:

- Allocation must lock selected rows or otherwise prevent another order from selecting the same stock at the same time.
- Do not allocate from Amazon, Flipkart, or other platforms.
- Do not allocate unavailable, sold, ordered, deleted, or archived stock.

### Step 3 - Create Order

Create an `orders` record with offline-specific markers.

Recommended fields:

- `orderid`
- `orderstatus`
- `quantity`
- `orderamount`
- `productamount`
- `discountamount`
- `mode = offline`
- `ispaymentsucceed = true` for paid offline orders
- `deliveryfrom = Nivapp`
- `createddate`
- `modifieddate`

If the current schema does not have a dedicated offline marker, use an existing passthrough field only if the database supports it. Otherwise add a planned DB field such as `ordersource` or `ordertype`.

Recommended new fields if database change is allowed:

- `ordersource`: `ecom`, `offline`, `admin`
- `fulfillmentmode`: `immediate_sale`, `dispatch_later`
- `paymentmode`: `cash`, `upi`, `card`, `other`
- `invoiceurl`

### Step 4 - Create Orderlines

Create one `orderline` per product item.

Each orderline should include:

- order reference
- generated `orderlinenumber`
- `productid`
- product name/category snapshot if existing flow expects it
- quantity
- unit price
- discount
- total line amount
- status aligned with fulfillment mode

### Step 5 - Update Allocated Stock

For immediate sale:

- `stockstatus = Sold`
- `orderid = created order id/order number`
- `orderlinenumber = matching orderline number`
- `solddate = current timestamp`
- `modifieddate = current timestamp`

For dispatch later:

- `stockstatus = ordered`
- `orderid = created order id/order number`
- `orderlinenumber = matching orderline number`
- `modifieddate = current timestamp`
- `solddate` remains empty until completion

### Step 6 - Update Product Quantities

The `product` aggregate quantities must remain consistent with physical stock.

Immediate sale expected change:

- available quantity decreases by allocated quantity.
- sold quantity increases by allocated quantity.
- e-commerce published quantity decreases by the number of allocated stocks where `ecompublish = true`.
- total quantity should not change.

Dispatch later expected change:

- available quantity decreases by allocated quantity.
- ordered quantity increases by allocated quantity.
- e-commerce published quantity decreases by the number of allocated stocks where `ecompublish = true`.
- sold quantity does not change yet.
- total quantity should not change.

Dispatch later completion expected change:

- ordered quantity decreases by completed quantity.
- sold quantity increases by completed quantity.
- available quantity should not change again.
- total quantity should not change.

### Step 7 - Update PlatformStock Quantities

The `platformStock` record for `Nivapp` must be updated consistently.

Immediate sale expected change:

- `availableqty` decreases.
- `soldqty` increases.
- `ecomqty` decreases only for allocated `ecompublish = true` stocks.
- `orderedqty` does not increase.
- `lockqty` should not be used for offline order creation.
- `totalqty` should not change.

Dispatch later expected change:

- `availableqty` decreases.
- `orderedqty` increases.
- `ecomqty` decreases only for allocated `ecompublish = true` stocks.
- `soldqty` does not increase yet.
- `lockqty` should not be used for offline order creation.
- `totalqty` should not change.

Dispatch later completion expected change:

- `orderedqty` decreases.
- `soldqty` increases.
- `availableqty` should not decrease again.
- `ecomqty` should not decrease again.
- `totalqty` should not change.

### Step 8 - Invoice

Offline orders require invoices.

Implementation rule:

- Immediate sale should generate invoice immediately.
- Dispatch later should generate invoice at dispatch/completion.

The invoice payload must support offline orders where shipment data may not exist.

## Inventory Frontend Flow

Add an offline order creation UI in Inventory.

Recommended screen behavior:

1. Admin opens Offline Order page.
2. Admin selects fulfillment mode:
   - Immediate Sale
   - Dispatch Later
3. Admin searches/selects products.
4. Admin enters quantity.
5. UI shows available `Nivapp` quantity.
6. Admin enters customer/payment details.
7. Admin submits order.
8. UI shows created order and invoice status.

The UI should not perform final stock allocation logic. It can show availability, but the backend must be the authority because concurrency can change stock before submission.

## Key Files To Update

Server:

- `src/routes/orders.route.ts`
- `src/controllers/orders.controller.ts`
- `src/services/orders.service.ts`
- `src/schemas/orders.schema.ts`
- `src/services/stock.service.ts`
- `src/services/platformStock.service.ts`
- invoice-related service/controller used by existing invoice flow

Inventory:

- `src/pages/orders`
- `src/components/orders`
- `src/services`
- `src/types/order.ts`
- navigation/sidebar route configuration

## Important Implementation Considerations

### Transaction Safety

Order creation, orderline creation, stock allocation, quantity updates, and invoice metadata update must not leave partial data.

Minimum required behavior:

- If stock allocation fails, no order should be created.
- If orderline creation fails, stock should not be consumed.
- If stock update fails, order should not remain created as successful.
- If invoice generation fails after the order is created, order should clearly show invoice failure/pending status.

### Race Condition Prevention

Two admins should not be able to sell the same stock at the same time.

The implementation should use one of:

- database row locking,
- atomic update with status condition,
- serializable transaction,
- or a retry-safe allocation pattern.

### E-Commerce Published Stock

Offline order allocation can consume `ecompublish = true` stock only after `ecompublish = false` stock is exhausted.

When this happens:

- published quantity must be reduced.
- e-commerce product availability must reflect the reduced stock.
- platform stock status should be recalculated.

### Shipment Handling

Offline orders may not require third-party shipment.

The system should support:

- no shipment,
- manually handled shipment,
- optional future shipment creation.

Do not make offline order creation dependent on Ekart/Amazon shipment creation.

### Cancellation And Return

Cancellation behavior must be defined before implementation is complete.

Recommended behavior:

- If immediate sale is cancelled before final handover, selected stock may move from `Sold` back to `available`.
- If dispatch later order is cancelled before dispatch, selected stock should move from `ordered` back to `available`.
- Quantities must reverse accordingly.
- If invoice was already generated, cancellation should produce cancellation metadata or credit-note handling depending on accounting requirement.

### Status Values

Current code uses mixed casing in some places, such as `available`, `Available`, `sold`, and `Sold`.

Before implementation, normalize expected comparisons to case-insensitive logic, or define exact values and update all touched code paths consistently.

## Test Cases

### Immediate Sale

- Create offline immediate order using only `ecompublish = false` stock.
- Create offline immediate order using fallback `ecompublish = true` stock.
- Create offline immediate order using mixed false and true stock.
- Verify stock rows are marked `Sold`.
- Verify product sold quantity increased.
- Verify product available quantity decreased.
- Verify platformStock `Nivapp.soldqty` increased.
- Verify `ecomqty` decreased only for consumed published stock.
- Verify invoice generated.

### Dispatch Later

- Create offline dispatch-later order using only `ecompublish = false` stock.
- Create offline dispatch-later order using fallback `ecompublish = true` stock.
- Verify stock rows are marked `ordered`.
- Verify product ordered quantity increased.
- Verify product available quantity decreased.
- Verify platformStock `Nivapp.orderedqty` increased.
- Verify dispatch/completion changes stock from `ordered` to `Sold`.
- Verify completion decreases ordered quantity and increases sold quantity.

### Failure Cases

- Requested quantity exceeds available `Nivapp` stock.
- Product does not exist.
- Product exists but has no available Nivapp stock.
- Concurrent requests try to allocate the same final stock item.
- Invoice generation fails.
- Invalid fulfillment mode.

## Open Decisions

These decisions should be confirmed before development starts:

1. Exact order statuses for immediate sale and dispatch later.
2. Whether offline customer details use existing `users`/`customers` tables or are stored as order snapshot fields.
3. Whether offline orders require payment status and payment reference.
4. Whether cancellation/return is included in CR 1 or handled as a later CR.
5. Whether new database fields are allowed for `ordersource`, `fulfillmentmode`, `paymentmode`, and `invoiceurl`.

## Recommended Implementation Sequence

1. Confirm open decisions.
2. Add backend schema for offline order request.
3. Add `OrdersService.createOfflineOrder`.
4. Implement transaction-safe stock allocation.
5. Implement quantity transition helpers for immediate sale and dispatch later.
6. Add route/controller endpoint.
7. Add invoice integration.
8. Add Inventory service method.
9. Add Inventory offline order UI.
10. Add tests for allocation, quantity updates, invoice behavior, and failure cases.
