# CR 5 - Return and Replacement Module

## Objective

Create a structured Return and Replacement flow for Nivaana orders.

The solution should cover:

- category-based return/replacement policy.
- customer-initiated return/replacement requests.
- delivery-partner/RTO return flows.
- manual inspection by Authorized Admin/Inventory user.
- inventory closure.
- refund closure.
- wallet refund option.
- invoice/GST handling.
- partial item return/cancellation handling.

This CR mainly impacts:

- `Server` backend.
- `Inventory` admin/inspection UI.
- `Ecom` customer order UI.
- order/orderline status flow.
- stock/product/platformStock quantity updates.
- invoice/GST document handling.
- wallet module integration.

## Existing System Notes

Current system already has some related concepts:

- `orders.orderstatus`
- `orderline.orderstatus`
- return/cancel status values such as `returned`, `rto_initiated`, `rto_delivered`, `cancelled`.
- refund status flow for cancelled orders.
- Ekart reverse shipment schema/service pieces.
- orderline-level cancellation service logic exists, but the route is currently commented out.

Current gap:

- no dedicated return/replacement request entity.
- no category-based return/replacement policy module.
- no authorized inspection workflow.
- no explicit GST reversal calculation/credit-note flow.
- no item-level return approval/refund closure model.

## Recommended Solution Shape

Implement the CR in four parts:

```text
Policy
  -> Request
  -> Authorized Inspection
  -> Financial / Inventory Closure
```

## Part 1 - Return and Replacement Policy

Create one centralized Return and Replacement Policy configuration screen.

Policy is category/subcategory/sub-subcategory based for this CR.

Example:

```text
Category: Incense Sticks

Customer Return:
  Return Allowed: Yes
  Replacement Allowed: Yes

Return Window: 7 days
Replacement Window: 7 days

Allowed Refund Methods:
  Original Payment Method
  Wallet

Product-Level Policy Override:
  Phase 2, not included in current estimation
```

Current scope:

```text
Category/subcategory/sub-subcategory policy is included.
Product-level policy override is Phase 2 and excluded from current estimation.
```

Example policy matrix:

```text
Incense       -> Return: Yes | Replacement: Yes | 7 days
Candles       -> Return: Yes | Replacement: Yes | 7 days
Personal Care -> Return: No  | Replacement: Yes | 3 days
```

Eligibility check:

```text
Order Item
  -> Product Category
  -> Applicable Return Policy
  -> Return / Replacement eligibility
```

Policy should control eligibility only. It should not store operational inspection reasons/statuses.

## Part 2 - Return Sources

Returns can start from two different sources.

### Customer-Initiated Return/Replacement

Customer selects an order item and raises return/replacement request.

Example reasons:

```text
Wrongly Ordered       -> Return
Wrong Item Received   -> Return / Replacement
Damaged Product       -> Return / Replacement
```

Recommended approach:

- keep a master reason list.
- map each reason to allowed resolution.
- use category policy to decide whether return/replacement is generally allowed.
- do not over-configure every reason by every category in phase 1.

Customer request should be item-level/orderline-level, not only full order-level.

### Delivery-Partner Initiated Return

These are not normal customer returns. Treat them as delivery failure/RTO.

Flow:

```text
Out For Delivery
  -> Delivery Failed
  -> RTO Initiated
  -> Returned to Warehouse
```

Example reasons:

```text
Customer unreachable
Wrong address
Customer refused
Delivery attempt failed
```

These reasons should come from logistics partner where possible.

RTO should have a separate operational path from customer return.

## Part 3 - Return Verification

Inventory should not update automatically when return is merely received.

Important rule:

```text
Return Received != Stock Increased
```

Inspection flow:

```text
Return Initiated
  -> Product In Transit
  -> Received
  -> Manual Inspection by Authorized Admin/Inventory user
```

Authorized Admin/Inventory user chooses item condition:

```text
Resellable
Damaged
Incorrect Product
Other
```

### Resellable

```text
Manual inspection approved
  -> Restock approved
  -> Available stock increases
```

### Damaged

```text
Manual inspection approved
  -> Mark as damaged
  -> Damaged stock increases
```

### Incorrect Product

```text
Manual inspection
  -> mark exception
  -> Authorized Admin/Inventory user resolution required
```

## Part 4 - Financial and Inventory Closure

After authorized inspection and return approval, system must complete:

- stock handling.
- refund method.
- invoice/GST handling.
- final return status.

Refund methods:

```text
Wallet
Original Payment Method / External
```

### Wallet Refund

```text
Return Approved
  -> Credit amount to Wallet
  -> Wallet transaction created
  -> Refund completed
```

Wallet module should own wallet balance and transaction history.

### External Refund

If payment gateway/API supports automated refund:

```text
Initiate Refund
  -> Payment Gateway
  -> Success
  -> Mark Refunded
```

If refund is handled manually:

```text
Admin processes refund externally
  -> Enter transaction/reference ID
  -> Mark Refunded
```

Refund amount must be calculated from the actual amount paid for the returned line item.

It must consider:

- product price at order time.
- product discount.
- allocated promotion discount.
- shipping allocation if refundable.
- tax/GST treatment.

Do not use current product price for refund calculation.

## GST Reversal Requirement

Client requirement:

```text
Return Product Received at Warehouse
  -> Manual Verification
  -> Return Approved
  -> Calculate actual refund amount
  -> Process refund through wallet/original payment/manual method
  -> GST Reversal Required?
       -> Yes: Create Credit Note / GST Adjustment
       -> No: Skip GST Adjustment
  -> Return Financial Process Completed
```

Important clarification:

```text
Customer refund and GST reversal are separate concerns.
```

The customer receives the approved refund amount whether GST reversal is selected as `Yes` or `No`.

`GST Reversal = Yes` controls whether Nivaana creates a Credit Note/GST adjustment record for Finance and GST reporting.

`GST Reversal = No` means the return/refund continues, but no GST adjustment or GST credit note is created.

Authoritative decision rule:

```text
Valid original orderline.gst_rate -> GST Reversal Required = Yes
Null/missing original orderline.gst_rate -> GST Reversal Required = No
```

Do not ask customer to decide GST reversal.

Finance/Admin should see the calculated value during financial closure, but should not need to manually decide Yes/No in the normal flow.

Recommended scope:

```text
GST reversal should be captured per returned orderline/item.
```

This supports partial returns.

Example:

```text
Original Order:
Product A Rs. 500
Product B Rs. 300 -> Returned
Product C Rs. 200

Product B original orderline gst_rate: 18%
GST Reversal Required for Product B: Yes

Result:
Reverse/adjust only Product B.
Product A and Product C remain unaffected.
```

### GST-Inclusive Price Handling

Nivaana product prices are GST-inclusive.

GST rate and HSN code come from the product category/subcategory/sub-subcategory configuration at the time of sale.

Examples:

```text
Incense Sticks: GST 5%
Car Fresheners: GST 18%
```

For return/refund calculation and GST adjustment, use the original invoice/orderline tax values.

Do not use the latest product/category GST configuration because GST rates or product mapping may have changed after the original sale.

Example:

```text
Selling price including GST: Rs. 100
GST Rate: 5%

Taxable Value: Rs. 95.24 approx.
GST Component: Rs. 4.76 approx.
Total: Rs. 100
```

The exact calculation should come from original invoice values where available.

### Invoice Handling

Do not edit the original invoice.

Recommended approach:

```text
Original invoice remains unchanged.
Create Revised/Override Invoice representation where required.
Create Credit Note/GST Adjustment only when GST Reversal = Yes.
```

For full return:

```text
Original invoice remains unchanged.
If GST Reversal = Yes, create full Credit Note/GST Adjustment.
If GST Reversal = No, do not create GST Credit Note.
Invoice may be marked Fully Returned or Fully Credited based on existing invoice status convention.
```

For partial return:

```text
Original invoice remains unchanged.
Maintain Revised/Override Invoice representation for remaining active items.
If GST Reversal = Yes, create item-level Credit Note/GST Adjustment only for returned items.
If GST Reversal = No, skip GST Credit Note.
```

Original invoice information must remain available for audit and historical tracking.

Partial return example:

```text
Original Invoice: INV-001

Incense Stick x 2       Rs. 200
Car Freshener x 2       Rs. 200

Original Invoice Total: Rs. 400

Returned:
Incense Stick x 1       Rs. 100

Remaining active items:
Incense Stick x 1       Rs. 100
Car Freshener x 2       Rs. 200

Revised/Override Invoice Amount: Rs. 300
```

Conceptual invoice records:

```text
Original Invoice
INV-001
Version 1
Amount: Rs. 400

Partial Return
  -> Revised/Override Invoice
     INV-001
     Version 2
     Amount: Rs. 300
```

If `GST Reversal = Yes`, also create:

```text
Credit Note: CN-001
Parent Invoice: INV-001
Returned Amount: Rs. 100
GST Rate: 5%
GST Adjustment: Rs. 4.76 approx.
```

If `GST Reversal = No`:

```text
Customer Refund: Rs. 100
Revised/Override Invoice Amount: Rs. 300
GST Credit Note: Not generated
```

### Credit Note / GST Adjustment Handling

When `GST Reversal = Yes`:

```text
Return Approved
  -> Customer refund is processed
  -> Credit Note/GST Adjustment record is created
  -> Credit Note is linked to original parent invoice
  -> Returned line items are captured
  -> Taxable value and GST amount are captured
  -> Credit Note is available for Finance reporting/export
```

The Credit Note record should not imply that Nivaana directly files GST returns. Direct GST portal/accounting integration is not part of this CR.

Recommended Credit Note fields:

```text
credit_note_number
credit_note_date
parent_invoice_id
parent_invoice_number
order_id
return_request_id
customer_id
returned_orderline_id
product_id
product_name
hsn_code
returned_quantity
original_paid_amount
taxable_value
gst_rate
gst_amount
total_credit_amount
gst_reversal_status
reason
created_by
createddate
```

If CGST/SGST/IGST are already stored separately in the invoice flow, include those values in the Credit Note and export.

For invoices with products under different GST rates, Credit Note data must be line-level.

One original invoice may have multiple partial return Credit Notes:

```text
INV-001
  -> CN-001 first partial return
  -> CN-002 second partial return
```

Total credited amount must not exceed the eligible invoiced amount.

### Finance Export

Finance should be able to export Credit Note/GST Adjustment records to Excel.

Recommended export fields:

```text
Credit Note Number
Credit Note Date
Original Invoice Number
Original Invoice Date
Order Number
Customer Details
Product
HSN Code
Returned Quantity
Taxable Value
GST Rate
GST Amount
Total Credit Amount
Return Reason
```

This export is for Finance GST/accounting reference. GST filing integration is not included in this CR.

## Replacement Flow

Replacement is not the same as refund.

Customer request:

```text
Customer selects item
  -> chooses Replacement
  -> reason selected
  -> policy eligibility checked
  -> request created
```

Authorized inspection:

```text
Returned item received
  -> inspection approved by Authorized Admin/Inventory user
  -> replacement approved
```

Replacement closure:

```text
Create replacement shipment/orderline
  -> allocate replacement stock
  -> dispatch replacement
  -> close replacement request
```

Implementation assumption:

- create a dedicated replacement request/shipment linked to original orderline.
- do not mutate original orderline amount.

## Partial Cancellation vs Return

Partial cancellation happens before shipment/fulfillment.

Partial return happens after delivery/customer receives product.

Example partial cancellation:

```text
Order:
Product A Rs. 500
Product B Rs. 300
Product C Rs. 200

Before shipment, Product B is cancelled.

Product A -> Active
Product B -> Cancelled
Product C -> Active
```

If invoice has not been generated:

```text
Generate invoice only for active items.
```

If invoice has already been generated:

```text
Original invoice remains unchanged.
Create adjustment/credit document for cancelled item if required.
```

Existing note:

- Server has order-level cancel exposed.
- Server has orderline cancellation service/controller logic.
- `PATCH /v1/orderlines/:id/cancel` route is currently commented out and must be enabled/fixed if item-level cancellation is part of this CR.

## Recommended Data Model

### return_replacement_policies

```text
id
category
subcategory
subsubcategory
product_id               // nullable, optional override
return_allowed
replacement_allowed
return_window_days
replacement_window_days
allowed_refund_methods   // JSON: wallet, original_payment
status
createddate
modifieddate
```

### return_requests

```text
id
request_number
order_id
orderline_id
customer_id
request_type             // return, replacement
source                   // customer, delivery_partner, admin
reason
requested_quantity
status
createddate
modifieddate
```

Recommended statuses:

```text
requested
approved
rejected
pickup_created
in_transit
received_at_warehouse
inspection_pending
inspection_approved
inspection_rejected
refund_pending
refund_completed
replacement_pending
replacement_shipped
completed
cancelled
```

### return_inspections

```text
id
return_request_id
inspected_by_inventory_user_id
received_quantity
approved_quantity
rejected_quantity
condition                // resellable, damaged, incorrect_product, other
inspection_notes
restock_action           // available, damaged, quarantine, none
createddate
modifieddate
```

### return_financial_closures

```text
id
return_request_id
refund_method            // wallet, original_payment, external_manual, none
refund_amount
gst_reversal_required
gst_reversal_status      // not_required, pending, completed, failed
invoice_adjustment_status // not_required, pending, completed, failed
revised_invoice_id
credit_note_url
credit_note_number
wallet_transaction_id
external_refund_reference
status
createddate
modifieddate
```

### return_credit_notes

Required when `GST Reversal = Yes`.

```text
id
credit_note_number
credit_note_date
parent_invoice_id
parent_invoice_number
order_id
return_request_id
customer_id
status                  // draft, completed, cancelled
total_credit_amount
total_taxable_value
total_gst_amount
created_by
createddate
modifieddate
```

### return_credit_note_lines

Required because one return can include products with different GST rates.

```text
id
credit_note_id
returned_orderline_id
product_id
product_name
hsn_code
returned_quantity
original_paid_amount
taxable_value
gst_rate
gst_amount
cgst_amount             // if existing invoice flow stores this separately
sgst_amount             // if existing invoice flow stores this separately
igst_amount             // if existing invoice flow stores this separately
total_credit_amount
reason
createddate
modifieddate
```

## API Proposal

### Policy

```http
GET /v1/return-policies
POST /v1/return-policies
PUT /v1/return-policies/:id
DELETE /v1/return-policies/:id
```

### Customer Return/Replacement

```http
POST /v1/returns
GET /v1/returns/:id
GET /v1/orders/:id/return-eligibility
```

### Inventory/Admin

```http
PATCH /v1/returns/:id/approve
PATCH /v1/returns/:id/reject
PATCH /v1/returns/:id/received
PATCH /v1/returns/:id/inspection
PATCH /v1/returns/:id/financial-closure
GET /v1/returns/:id/credit-note
GET /v1/returns/credit-notes/export
```

### RTO

```http
POST /v1/returns/rto
PATCH /v1/returns/:id/rto-received
```

## Backend Files To Add

Server:

- `src/routes/returns.route.ts`
- `src/controllers/returns.controller.ts`
- `src/services/returns.service.ts`
- `src/schemas/returns.schema.ts`

Prisma:

- add return/replacement policy table.
- add return request table.
- add return inspection table.
- add financial closure table.
- add return credit note table.
- add return credit note line table.

Route registration:

- update `src/routes/index.ts`

Existing integrations:

- `orders.service.ts`
- `orderline.service.ts`
- `stock.service.ts`
- `platformStock.service.ts`
- invoice/GST service.
- Revised/Override Invoice logic.
- wallet service.
- Ekart reverse shipment service if logistics pickup is needed.

## Inventory UI Changes

Add:

- Return and Replacement Policy screen.
- Return Requests list.
- Return Request detail.
- Authorized inspection form.
- Financial closure form.
- GST reversal Yes/No calculated display.
- Credit note/reversal document status.

Authorized inspection form should include:

```text
Received Quantity
Condition
Approved Quantity
Restock Action
Notes
```

Finance/Admin closure form should include:

```text
Refund Method
Refund Amount
GST Reversal Required: Yes/No calculated from returned orderline gst_rate
Credit Note / Adjustment Reference
Revised/Override Invoice Reference
External Refund Reference
Wallet Transaction Reference
```

Finance export should include:

```text
Credit Note Number
Credit Note Date
Original Invoice Number
Original Invoice Date
Order Number
Customer Details
Product
HSN Code
Returned Quantity
Taxable Value
GST Rate
GST Amount
Total Credit Amount
Return Reason
```

## Ecom App Changes

Customer should be able to:

- view return/replacement eligibility per order item.
- raise return request.
- raise replacement request.
- select reason.
- view request status.

Do not expose GST reversal choices to customer.

## Inventory and Stock Rules

Inventory should update only after manual inspection approval by an Authorized Admin/Inventory user.

Important stock rule:

```text
Return received does not change stock.
Only manual inspection approval triggers restock or damaged-stock allocation.
```

If restock action is available:

```text
available stock increases.
product/platform available quantity increases.
```

If restock action is damaged:

```text
damaged stock increases or damaged status is recorded.
available quantity should not increase.
```

If inspection rejected:

```text
no stock increase.
refund should not proceed unless admin override exists.
```

## Test Cases

### Policy

- category return allowed.
- category return denied.
- replacement allowed with shorter window.
- return window expired.

### Customer Request

- customer can return eligible item.
- customer cannot return ineligible category.
- customer cannot return after window.
- customer can request replacement where allowed.
- duplicate return request for same quantity is prevented.

### Authorized Inspection

- received return does not update stock.
- approved resellable return updates available stock only after manual inspection approval.
- approved damaged return updates damaged stock only after manual inspection approval.
- damaged return does not update available stock.
- inspection rejected prevents refund.

### Refund

- wallet refund creates wallet transaction.
- external refund stores reference.
- refund amount uses original orderline amount and discounts.

### GST

- returned orderline with valid `gst_rate` sets GST reversal required to Yes.
- returned orderline with null/missing `gst_rate` sets GST reversal required to No.
- GST reversal Yes creates item-level credit/reversal document.
- GST reversal No skips GST Credit Note and continues refund.
- calculated GST reversal value does not change approved customer refund amount.
- partial return reverses only returned item.
- original invoice remains unchanged.
- partial return creates/updates Revised/Override Invoice representation for remaining active items.
- Credit Note is linked to parent/original invoice.
- multiple partial returns can create multiple Credit Notes for the same original invoice.
- total credited amount cannot exceed eligible invoiced amount.
- Finance Excel export includes Credit Note line-level GST details.

### Replacement

- replacement request creates replacement shipment/order process.
- replacement consumes new stock.
- original orderline remains audit-safe.

### Partial Cancellation

- item-level cancel works before shipment.
- parent order becomes partially cancelled when only some items cancel.
- full order becomes cancelled when all items cancel.
- invoice behavior depends on invoice already generated or not.

## Implementation Assumptions

1. Return/replacement policy is category/subcategory/sub-subcategory based in this CR.
2. Product-level return/replacement policy override is Phase 2 and excluded from current estimation.
3. Customer return reasons use a master reason list mapped to allowed resolution.
4. Delivery-partner RTO uses the same return module with a separate RTO operational path.
5. Credit Note/GST Adjustment records are generated by the system when GST Reversal Required = Yes.
6. Replacement uses a dedicated replacement request/shipment linked to the original orderline.
7. Refund methods supported for this CR are wallet and original/external payment.
8. Item-level cancellation route should be re-enabled/fixed if partial cancellation is included in this CR.
9. Partial return invoice adjustment uses the Revised/Override Invoice approach.

## Recommended Implementation Sequence

1. Add return/replacement policy model and APIs.
2. Add return eligibility API.
3. Add return request model and customer/admin creation API.
4. Add received and authorized inspection flow.
5. Add stock update logic only after manual inspection approval.
6. Add financial closure with refund method and calculated GST reversal Yes/No.
7. Integrate Wallet refund credit.
8. Integrate Revised/Override Invoice flow for partial returns.
9. Integrate system-generated Credit Note/GST Adjustment records.
10. Add Finance Credit Note Excel export.
11. Add dedicated replacement request/shipment handling.
12. Re-enable/fix item-level cancellation if partial cancellation is included.
13. Build Inventory UI.
14. Build Ecom customer return/replacement UI.
15. Add tests for policy, request, inspection, stock, refund, GST, replacement, and partial cancellation.
