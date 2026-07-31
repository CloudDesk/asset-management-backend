# Nivaana Return & Replacement Module

## Updated Implementation Plan and Progress Report

**Report date:** 31 July 2026  
**Source:** Updated Return & Replacement implementation plan and repository inspection  
**Current estimated completion:** **57% overall**  
**Backend foundation:** approximately **78% complete**  
**End-to-end customer-ready flow:** approximately **30% complete**

> Completion values are weighted engineering estimates based on code present in the repository, reachable UI flows, missing integrations, and verification results. They are not effort-spent percentages.

---

## 1. Executive Summary

Nivaana has a solid backend foundation for return and replacement processing. The repository already contains:

- Category and Subcategory policy configuration.
- Policy CRUD APIs and order-item eligibility evaluation.
- Predefined customer and delivery-partner reason rules.
- All six required customer reasons.
- Reason-specific evidence and deadline validation.
- Item-level and quantity-level request creation.
- Evidence upload and evidence review.
- Admin approval and rejection.
- Pickup preparation metadata.
- Warehouse receipt.
- Authorized warehouse inspection APIs.
- Stock reallocation after completed inspection.
- RTO request and status handling.
- Inventory admin screens for policy management and return operations.

The module is not yet end-to-end complete. The largest remaining items are:

- Remove Sub-subcategory from the implementation because the business hierarchy is only Category and Subcategory.
- Build the customer mobile return/replacement experience against the new APIs.
- Build the reason-rule editor in the Inventory application.
- Build the warehouse inspection UI.
- Connect pickup preparation to the real Ekart reverse-shipment API.
- Implement refund, replacement shipment, missing-item shipment, and partial-refund closure.
- Implement return-related invoice adjustment and Credit Note/GST records.
- Add automated tests and resolve the current Server TypeScript release gate.

---

## 2. Confirmed Business Decisions

### 2.1 Policy hierarchy

Only these levels are supported:

1. Subcategory policy.
2. Category policy.

When both match, the Subcategory policy takes priority. Sub-subcategory is not part of this module.

### 2.2 Reason mapping

Every active Return & Replacement Policy automatically receives all active predefined customer-facing reason rules:

- Wrong Product.
- Damaged Product.
- Missing Product.
- Defective Product.
- Leakage / Broken Bottle.
- Changed Mind.

Because all reasons apply to all policies, a separate policy-to-reason mapping table is not currently required. The reason master can be applied globally after category-policy eligibility succeeds.

If Nivaana later needs to disable a specific reason for a category, a policy-reason mapping or override table can be added in Phase 2.

### 2.3 Policy responsibility

The Category/Subcategory policy controls general eligibility:

- Return allowed.
- Replacement allowed.
- Return window in days.
- Replacement window in days.
- Allowed refund methods.
- Active/inactive status.

### 2.4 Reason-rule responsibility

The selected reason controls:

- Allowed outcomes.
- Reason-specific deadline.
- Required and optional evidence.
- Whether an opened package is eligible.
- Evidence-first or pickup-first approval.
- Whether pickup is required.
- Reverse-shipping charge responsibility.
- Resolution timing.
- Replacement-stock-unavailable fallback.

### 2.5 Reverse pickup, charges, rejection, and stock fallback

The following operational decisions are confirmed:

- An authorized Admin manually triggers reverse pickup after review/approval; approval alone must not create a pickup automatically.
- Nivaana bears all reverse-shipping charges. Nothing is deducted from the customer's refund.
- If warehouse inspection rejects a returned product, stop the refund/replacement, notify the customer, and retain the product in On Hold inventory.
- If replacement stock is unavailable for Wrong Product, Damaged Product, Defective Product, or Leakage / Broken Bottle, convert the outcome to refund and notify the customer.

---

## 3. Reason-Specific Policy Matrix

| Reason | Deadline | Evidence | Allowed outcomes | Pickup | Processing timing |
|---|---:|---|---|---|---|
| Wrong Product | Applicable policy window | Product photo | Replacement or refund | Required | After warehouse verification |
| Damaged Product | Within 48 hours of delivery | Product photo required; package photo optional; unboxing video optional | Replacement; refund if replacement stock is unavailable | Required where physical return is required | Evidence approval, followed by warehouse verification where required |
| Missing Product | Applicable policy window | Product/package photos | Ship missing item, partial refund, or complete return | Only when the approved outcome is Complete Return | After team verification |
| Defective Product | Applicable policy window | Product photo and defect video required | Replacement or refund | Required | After evidence approval and warehouse inspection |
| Leakage / Broken Bottle | Applicable policy window | Product photo and video required | Replacement or refund | Required where physical return is required | After verification |
| Changed Mind | Applicable policy window | Photos of the unopened packaged product | Complete return and refund | Required | Reject when opened; approve evidence before pickup |

### Common rule

At least one photo is required for all customer return, replacement, and refund claims. A reason can impose stricter evidence requirements.

---

## 4. Recommended Configuration Contract

Core fields that are queried and validated frequently should remain typed database columns. JSON should only be used for a validated nested rule contract or future extensibility.

Example reason configuration:

```json
{
  "schemaVersion": 1,
  "raiseWithinHours": 48,
  "evidence": [
    {
      "type": "product_photo",
      "required": true,
      "minimum": 1
    },
    {
      "type": "package_photo",
      "required": false
    },
    {
      "type": "unboxing_video",
      "required": false
    }
  ],
  "allowedResolutions": [
    "replacement",
    "refund"
  ],
  "approvalMode": "evidence_first",
  "resolutionTiming": "after_warehouse_verification",
  "pickup": {
    "required": true,
    "triggerMode": "manual_admin",
    "chargeBearer": "nivaana",
    "deductChargeFromRefund": false
  },
  "stockUnavailableResolution": "refund",
  "notifyCustomerOnStockFallback": true
}
```

### Required additions to the present model

The current reason-rule model already covers most of this structure. Add or clarify:

- `schema_version`.
- `raise_within_hours` as the clearer replacement for `minimumraisewindowhours`.
- Exact evidence type and minimum count.
- `resolution_timing`.
- `stock_unavailable_resolution`.
- Pickup trigger mode and charge bearer.
- Customer notification behavior for rejection and stock fallback.
- Conditional pickup by resolution.
- A version or rule snapshot stored on each return request.

---

## 5. Customer Return and Replacement Request

### 5.1 Eligibility

A request can be raised only when:

1. The order item belongs to the signed-in customer.
2. The item has been delivered.
3. A Category or Subcategory policy exists.
4. The policy permits at least one applicable outcome.
5. The policy window is still active.
6. The reason-specific deadline is still active.
7. Remaining eligible quantity is greater than zero.
8. The selected outcome is allowed for the selected reason.
9. Required package-condition and evidence rules are satisfied.

### 5.2 Customer input

The request captures:

- Order item.
- Requested quantity.
- Selected reason.
- Requested outcome.
- Package-opened state where applicable.
- Additional remarks.
- Product, package, unboxing, or defect evidence.

### 5.3 Quantity protection

The system must prevent the total of active, returned, or replaced quantities from exceeding the originally purchased quantity.

Example:

```text
Ordered quantity:            5
Already returned:            1
Active replacement request:  1
Remaining eligible quantity: 3
```

Duplicate active requests against the same remaining quantity must be blocked.

---

## 6. Reason Workflows

### 6.1 Wrong Product

```text
Delivered order item
  -> Customer selects Wrong Product
  -> Customer selects Replacement or Refund
  -> Product photo uploaded
  -> Request approved
  -> Nivaana initiates pickup
  -> Customer keeps product intact
  -> Product received at warehouse
  -> Authorized inspection
  -> Replacement shipment created or refund processed
  -> Request completed
```

### 6.2 Damaged Product

```text
Delivered order item
  -> Claim raised within 48 hours
  -> Product photo uploaded
  -> Package photo optional
  -> Unboxing video optional
  -> Evidence reviewed
  -> Request approved
  -> Pickup and inspection where physical return is required
  -> Replacement stock checked
      -> Stock available: replacement shipment
      -> Stock unavailable: refund processing
  -> Request completed
```

### 6.3 Missing Product

```text
Delivered order item
  -> Customer selects Missing Product
  -> Photos uploaded
  -> Team verifies claim
  -> Approved outcome selected
      -> Ship missing item
      -> Partial refund
      -> Complete return
  -> Pickup only for Complete Return
  -> Request completed
```

### 6.4 Defective Product

```text
Delivered order item
  -> Product photo uploaded
  -> Defect video uploaded
  -> Evidence approved
  -> Pickup initiated
  -> Warehouse inspection
  -> Replacement or refund
  -> Request completed
```

### 6.5 Leakage / Broken Bottle

```text
Delivered order item
  -> Product photo uploaded
  -> Video uploaded
  -> Evidence verified
  -> Pickup where physical return is required
  -> Replacement or refund
  -> Request completed
```

### 6.6 Changed Mind

```text
Delivered order item
  -> Customer selects Changed Mind
  -> Package-opened check
      -> Opened: request rejected
      -> Unopened: packaged-product photos required
  -> Evidence approved
  -> Pickup initiated
  -> Warehouse verification
  -> Refund processed
  -> Request completed
```

---

## 7. Reverse Shipment and Pickup

Pickup eligibility is reason- and resolution-driven.

### 7.1 Confirmed operating rule

- Reverse pickup is **not created automatically** when a request is approved.
- After request review/approval, an authorized Admin must manually trigger the reverse shipment.
- The UI must show the pickup action only when the applicable reason and selected resolution require a physical return.
- Nivaana bears the reverse-shipping charge for every supported reason, including customer-side reasons such as Changed Mind/Wrongly Ordered.
- No reverse-shipping charge is deducted from the customer refund and no separate charge is collected from the customer.
- The Admin action and resulting pickup details must be recorded for audit.

- Wrong Product: pickup required.
- Damaged Product: pickup where physical return is required.
- Missing Product: pickup only for Complete Return.
- Defective Product: pickup required.
- Leakage / Broken Bottle: pickup where physical return is required.
- Changed Mind: pickup required after unopened-package evidence approval.

Expected operational flow:

```text
Approved request
  -> Pickup prepared
  -> Reverse shipment created
  -> Product collected
  -> In transit
  -> Received at warehouse
  -> Inspection pending
```

The return request must retain:

- Original order and order item.
- Logistics provider.
- Reverse tracking ID/AWB.
- Pickup creator.
- Pickup preparation date.
- Reverse-shipping charge bearer, fixed to `nivaana` for the current business policy.
- Reverse-shipping amount, when supplied by the logistics provider.
- Confirmation that no pickup charge was deducted from the customer refund.

The specific logistics-provider selection rule—original forward provider versus any configured reverse-logistics provider—remains an integration configuration decision. It must not block the Admin from preparing the pickup record.

---

## 8. Warehouse Receipt, Inspection, and Stock

Receiving a returned product must not automatically restore available inventory.

### 8.1 Warehouse receipt

Record:

- Received quantity.
- Apparent condition.
- Warehouse location.
- Receipt remarks.
- Received by.
- Received date.

### 8.2 Authorized inspection

An Inventory user verifies:

- Product identity.
- Received quantity.
- Approved quantity.
- Rejected quantity.
- Product condition.
- Whether the request is acceptable.
- Restock action.
- Inspection notes.

### 8.3 Stock action

| Condition | Restock action | Inventory result |
|---|---|---|
| Resellable | Available | Available stock increases by approved quantity |
| Damaged/non-resellable | Damaged | Damaged stock increases; available stock does not increase |
| Needs investigation | Quarantine | Quantity moves to quarantine |
| Rejected/invalid | None | No automatic inventory increase |

Stock updates must occur only after authorized inspection completes for the full received quantity.

### 8.4 Rejected-return handling

When the warehouse rejects the returned product because it is opened, used, incorrect, or otherwise ineligible:

1. Stop the refund or replacement workflow.
2. Notify the customer with the rejection reason.
3. Move or retain the physical quantity in **On Hold** inventory.
4. Do not return the product to the customer automatically.
5. Record the warehouse location, rejected quantity, rejection reason, inspector, and inspection timestamp.
6. Allow only an authorized Admin to decide a later manual disposition, if required.

`On Hold` must be treated as unavailable inventory and must not increase sellable stock.

---

## 9. Refund Processing

Refund processing applies to an approved refund outcome, not only to requests originally labelled as Return.

```text
Approved outcome
  -> Refund amount calculated from actual item payment
  -> Product and promotional discounts allocated correctly
  -> Refund method selected
  -> Refund initiated
  -> Transaction/reference captured
  -> Refund completed
  -> Request completed
```

Supported methods:

- Wallet credit.
- Original payment integration where supported.
- External/manual refund with payment reference.

Required refund data:

- Gross item amount.
- Allocated discounts.
- Net amount paid.
- Quantity refunded.
- Refund method.
- Refund status.
- Gateway/manual transaction reference.
- Initiated and completed dates.
- Processed by.

---

## 10. Replacement and Missing-Item Fulfilment

### 10.1 Replacement

```text
Inspection approved
  -> Replacement stock checked
  -> Replacement quantity allocated
  -> Replacement order/shipment linked to original order item
  -> Shipment dispatched
  -> Replacement delivered
  -> Request completed
```

For Wrong Product, Damaged Product, Defective Product, and Leakage / Broken Bottle, unavailable replacement stock must automatically move the request to the refund-processing path and notify the customer. The request must not remain indefinitely in `Replacement Pending`.

The transition must retain an audit record containing:

- Original requested outcome: Replacement.
- Conversion reason: Replacement stock unavailable.
- Converted outcome: Refund.
- Conversion timestamp and actor/system source.
- Customer notification status.

### 10.2 Missing-item shipment

The missing-item shipment must be linked to the original order, order item, and return request without treating it as a new customer purchase.

### 10.3 Partial refund

Partial refund must use the missing quantity and actual amount allocated to that quantity. It must not refund the complete order line unless the complete quantity is missing.

---

## 11. Delivery Partner Return / RTO

RTO is separate from a customer return request.

```text
Forward delivery failed
  -> Delivery partner initiates RTO
  -> RTO in transit
  -> RTO received at warehouse
  -> Authorized inspection
  -> Stock action
  -> Applicable refund handling
  -> RTO closed
```

No separate customer pickup should be created for RTO. Existing forward-shipment tracking should drive the return-to-origin lifecycle.

---

## 12. Invoice, Credit Note, and GST Handling

### Full return

- Retain the original invoice for audit.
- Mark complete return/cancellation status.
- Create the applicable Credit Note/GST adjustment when the original order item contains a valid GST rate.

### Partial return

- Retain the original invoice.
- Generate a revised/override invoice for active items.
- Generate a Credit Note for the returned portion when GST reversal applies.

### Credit Note data

- Credit Note number and date.
- Original invoice number.
- Order and return reference.
- Returned product and quantity.
- HSN code.
- Original GST rate.
- Taxable value.
- GST amount.
- Total credit amount.

The customer refund amount remains independent of whether GST reversal is available. Direct GST portal filing remains outside the current scope.

---

## 13. Status Model

### Customer return/refund

```text
requested
evidence_pending
evidence_approved / evidence_rejected
approved / rejected
pickup_prepared
pickup_created
in_transit
received_at_warehouse
inspection_pending
inspection_approved / inspection_rejected
refund_pending
refund_completed
completed
```

### Replacement

```text
requested
evidence_pending
evidence_approved / evidence_rejected
approved / rejected
pickup_prepared
pickup_created
in_transit
received_at_warehouse
inspection_pending
inspection_approved / inspection_rejected
replacement_pending
replacement_shipped
replacement_delivered
completed
```

### Missing item

```text
requested
evidence_pending
evidence_approved / evidence_rejected
approved / rejected
missing_item_pending
missing_item_shipped
completed
```

### RTO

```text
delivery_failed
rto_initiated
rto_in_transit
rto_received
warehouse_verification
closed
```

---

## 14. Current Implementation Evidence

### 14.1 Database and migrations — Mostly complete

Implemented:

- `return_replacement_policies`.
- `return_reason_rules`.
- `return_requests`.
- `return_request_attachments`.
- `return_inspections`.
- Evidence-review fields.
- Request-review fields.
- Pickup-preparation fields.
- Warehouse-receipt fields.
- Inspection indexes and constraints.

Evidence:

- [`prisma/schema.prisma`](prisma/schema.prisma)
- [`prisma/migrations/20260729000000_add_return_replacement_policies/migration.sql`](prisma/migrations/20260729000000_add_return_replacement_policies/migration.sql)
- [`prisma/migrations/20260730000000_add_return_sources/migration.sql`](prisma/migrations/20260730000000_add_return_sources/migration.sql)
- [`prisma/migrations/20260730050000_add_return_inspections/migration.sql`](prisma/migrations/20260730050000_add_return_inspections/migration.sql)

Remaining:

- Remove `subsubcategory` from the return-policy model and migration path.
- Add reason configuration version/snapshot fields.
- Add resolution timing and stock-unavailable fallback fields.
- Add refund, replacement fulfilment, and financial closure entities.

### 14.2 Policy APIs — Mostly complete

Implemented:

- List, read, create, update, upsert, and delete policy.
- Most-specific policy selection.
- Eligibility checks by order line, product, or category.
- Return/replacement day-window validation.

Evidence:

- [`src/routes/return-replacement-policy.route.ts`](src/routes/return-replacement-policy.route.ts)
- [`src/services/return-replacement-policy.service.ts`](src/services/return-replacement-policy.service.ts)

Remaining:

- Remove Sub-subcategory inputs, responses, matching, and indexes.
- Prefer stable taxonomy IDs if category names can change.
- Add policy versioning or immutable request snapshots.

### 14.3 Reason rules — Mostly complete

Implemented:

- All six customer reasons.
- Delivery-partner RTO reasons.
- Allowed resolutions.
- 48-hour damaged-product deadline.
- Photo/video/package/unboxing requirements.
- Opened-package restriction.
- Pickup and evidence-first settings.
- Create, update, list, read, and default-upsert APIs.

Evidence:

- [`src/services/return-reason-rule.service.ts`](src/services/return-reason-rule.service.ts)
- [`src/routes/return-reason-rule.route.ts`](src/routes/return-reason-rule.route.ts)
- [`src/schemas/return-source.schema.ts`](src/schemas/return-source.schema.ts)

Remaining:

- Build the reason-rule editor in Inventory.
- Rename `minimumraisewindowhours` to `raiseWithinHours`/`maximumraisewindowhours`.
- Require exact evidence types and minimum counts.
- Add `resolutionTiming` and `stockUnavailableResolution`.
- Set Changed Mind to evidence-first before pickup.

### 14.4 Eligibility and request APIs — Mostly complete

Implemented:

- Ownership validation.
- Delivered-item validation.
- Policy and reason-rule evaluation.
- Remaining-quantity calculation.
- Allowed reasons and allowed outcomes returned per order item.
- Customer request creation.
- Evidence validation.
- Duplicate/over-quantity protection.

Evidence:

- [`src/services/return-request.service.ts`](src/services/return-request.service.ts)
- [`src/routes/orders.route.ts`](src/routes/orders.route.ts)
- [`src/routes/return-request.route.ts`](src/routes/return-request.route.ts)

Remaining:

- Validate the compatibility of `requesttype` and `requestedresolution`.
- A required product photo must not be satisfied only by a package photo.
- Save a snapshot of the applied policy/reason configuration on the request.
- Add idempotency protection for submission and financial actions.

### 14.5 Evidence handling — Mostly complete

Implemented:

- Multipart evidence upload.
- Evidence attachment to a request.
- Image/video/PDF MIME validation.
- File-size validation.
- Evidence review approval/rejection.
- Required-evidence revalidation before approval.

Remaining:

- Customer UI integration.
- Evidence thumbnails/video preview and safer access rules.
- Exact per-type minimum counts.
- Malware/content scanning if required for production.

### 14.6 Inventory policy UI — Mostly complete

Implemented:

- Policy list.
- Create/edit/delete.
- Category and Subcategory coverage.
- Missing-policy indicators.
- Return/replacement window and refund-method controls.
- Eligibility test support.

Evidence:

- [`../Inventory/src/pages/returnReplacementPolicies/ReturnReplacementPoliciesPage.tsx`](../Inventory/src/pages/returnReplacementPolicies/ReturnReplacementPoliciesPage.tsx)

Remaining:

- Remove all `subsubcategory` form, type, filtering, and payload fields.
- Show that all active reasons are automatically applied.
- Link to the reason-rule editor.
- Avoid permanent deletion when historical policy use exists; prefer inactive/archived.

### 14.7 Inventory return operations UI — Partially complete

Implemented:

- Request listing and details.
- Evidence display and review.
- Admin approve/reject.
- Pickup preparation.
- Warehouse receipt.
- RTO creation and status handling.

Evidence:

- [`../Inventory/src/pages/returnSources/ReturnSourcesPage.tsx`](../Inventory/src/pages/returnSources/ReturnSourcesPage.tsx)
- [`../Inventory/src/services/returnSourceService.ts`](../Inventory/src/services/returnSourceService.ts)

Remaining:

- Warehouse inspection form and inspection history UI.
- Refund processing UI.
- Replacement fulfilment UI.
- Missing-item shipment and partial-refund UI.
- Credit Note and finance export UI.
- Better action gating by status and reason.

### 14.8 Warehouse inspection and stock backend — Substantially complete

Implemented:

- Authorized Inventory-user checks.
- Received/approved/rejected quantity validation.
- Multiple inspection passes with cumulative totals.
- Resellable, damaged, quarantine, and no-stock actions.
- Stock changes only after full inspection.
- Inspection history loading.

Remaining:

- Add an explicit On Hold stock action/state for warehouse-rejected returns.
- Trigger customer notification when an inspection rejects the return.
- Inventory inspection UI.
- Automated tests for partial inspection and concurrency.
- Confirm stock movement audit records and transactional idempotency under retry.

### 14.9 Reverse logistics — Early implementation

Implemented:

- Pickup metadata and charge responsibility.
- Manual tracking/provider storage.
- Admin pickup-preparation action, consistent with the confirmed manually triggered workflow.
- Ekart reverse-shipment API exists separately.

Not yet implemented:

- The Admin-triggered return flow does not yet call the real Ekart reverse-shipment service.
- The existing `auto_create_pickup` field should be removed or deprecated because automatic pickup is not the confirmed workflow.
- No carrier webhook/status synchronization for the new return request.
- No retry/idempotency handling for pickup creation.
- Reverse-shipping responsibility must be fixed to Nivaana and excluded from refund deductions.

### 14.10 Refund and replacement closure — Not substantially implemented

The return request service stops after inspection approval/rejection. It does not yet:

- Calculate and persist the refund amount.
- Credit the wallet.
- Call the original-payment refund flow.
- Record external refund completion.
- Allocate and create a replacement shipment.
- Create a missing-item shipment.
- Process a partial refund.
- Move the request through financial/fulfilment completion statuses.

### 14.11 Invoice and Credit Note — Planned, not implemented for returns

Existing order-cancellation refund behavior does not complete the return-specific invoice requirements. The return module still needs:

- Revised/override invoice generation for partial returns.
- Credit Note/GST adjustment records.
- Return-to-original-invoice linkage.
- Finance Excel export.

### 14.12 Customer mobile application — Not integrated

The current [`../Ecom/src/screens/profile/ReturnProductScreen.tsx`](../Ecom/src/screens/profile/ReturnProductScreen.tsx) uses:

- A hard-coded, outdated reason list.
- Photos marked optional.
- No video evidence.
- No eligibility API.
- No allowed-outcome selection.
- No quantity selection tied to remaining eligibility.
- No package-opened validation.
- A simulated submission using `setTimeout` instead of the return API.

This screen must be replaced or refactored to use the implemented backend contract.

### 14.13 Customer web application — Not implemented

The web application currently contains a Return Policy information page but no customer return-request workflow connected to the new APIs.

### 14.14 Automated tests and build verification — Incomplete

Repository inspection found no dedicated automated tests for policy, reason validation, request creation, evidence, inspection, pickup, refund, or replacement.

Verification performed for this report:

- Prisma schema validation: passed.
- Inventory TypeScript check: passed.
- Ecom TypeScript check: passed.
- Server TypeScript check: failed because the generated Prisma client is missing unrelated promotion-assignment/customer-group fields. No return-module TypeScript error appeared in that output, but the Server build remains a release blocker until the Prisma client/schema mismatch is resolved.

---

## 15. Completion Dashboard

| Workstream | Weight | Estimated completion | Weighted contribution | Status |
|---|---:|---:|---:|---|
| Requirements and architecture | 5% | 90% | 4.5% | Mostly complete |
| Database and migrations | 10% | 80% | 8.0% | Mostly complete |
| Policy and reason-rule backend | 15% | 80% | 12.0% | Mostly complete |
| Eligibility, requests, and evidence backend | 15% | 80% | 12.0% | Mostly complete |
| Inventory operations UI | 10% | 60% | 6.0% | Partial |
| Warehouse inspection and stock | 10% | 70% | 7.0% | Backend strong; UI missing |
| RTO handling | 5% | 60% | 3.0% | Partial |
| Reverse-logistics integration | 10% | 20% | 2.0% | Early |
| Refund/replacement/finance closure | 10% | 10% | 1.0% | Mostly pending |
| Customer mobile/web experience | 7% | 10% | 0.7% | Mostly pending |
| Automated tests and release readiness | 3% | 10% | 0.3% | Mostly pending |
| **Total** | **100%** |  | **56.5%, rounded to 57%** | **In progress** |

### Completion interpretation

- **Backend foundation:** approximately 78%.
- **Inventory/admin usability:** approximately 60%.
- **Customer-facing request flow:** approximately 10%.
- **Logistics and financial closure:** approximately 15%.
- **Overall weighted completion:** approximately 57%.

---

## 16. Recommended Next Work

### Priority 0 — Align the implementation with confirmed scope

- [ ] Remove Sub-subcategory from the return policy Prisma model.
- [ ] Add a safe migration that removes or ignores the existing `subsubcategory` policy column.
- [ ] Remove Sub-subcategory from policy schemas, routes, services, eligibility responses, Inventory types, and UI.
- [ ] Update the older `CR5_RETURN_REPLACEMENT_MODULE_PLAN.md` assumptions to Category/Subcategory only.
- [ ] Confirm global reasons are the intended long-term model; no join table is required while every policy uses every reason.

### Priority 1 — Harden the rule contract

- [ ] Rename `minimumraisewindowhours` to a maximum/within-hours name.
- [ ] Add exact evidence type and minimum-count validation.
- [ ] Add `resolutionTiming`.
- [ ] Add `stockUnavailableResolution`.
- [ ] Default `stockUnavailableResolution` to `refund` for Wrong Product, Damaged Product, Defective Product, and Leakage / Broken Bottle.
- [ ] Make pickup conditional by reason and resolution.
- [ ] Set Changed Mind to evidence-first approval.
- [ ] Add request snapshots/versioning for policy and reason rules.
- [ ] Validate `requesttype` against `requestedresolution`.
- [ ] Prefer deactivation over deleting historically used policies/reasons.

### Priority 2 — Complete the Inventory application

- [ ] Build Return Reason Rules management UI.
- [ ] Build warehouse inspection form.
- [ ] Add On Hold inventory handling for rejected returned products.
- [ ] Notify the customer when warehouse inspection rejects a return.
- [ ] Display cumulative inspection history and remaining quantity.
- [ ] Add refund action and status UI.
- [ ] Add replacement allocation/shipment UI.
- [ ] Add missing-item shipment and partial-refund UI.
- [ ] Add finance/Credit Note export UI.

### Priority 3 — Build the customer flow

- [ ] Call `GET /v1/orders/:id/return-eligibility` from the order details screen.
- [ ] Show only eligible order items.
- [ ] Show the six API-driven reason options.
- [ ] Show only outcomes allowed for the selected reason and policy.
- [ ] Add eligible quantity selection.
- [ ] Ask whether the package is opened when required.
- [ ] Dynamically render mandatory/optional photo and video inputs.
- [ ] Upload evidence before request submission.
- [ ] Submit to `POST /v1/returns`.
- [ ] Add request history, status timeline, and rejection details.
- [ ] Add retry/idempotency behavior.

### Priority 4 — Connect real reverse logistics

- [x] Confirm pickup execution: authorized Admin manually triggers it after review/approval.
- [ ] Confirm original carrier versus configured carrier selection.
- [ ] Connect the Admin pickup action to Ekart reverse-shipment creation.
- [ ] Save reverse AWB and provider.
- [ ] Add carrier webhook/status synchronization.
- [ ] Add retries and idempotency keys.
- [ ] Fix the charge bearer to Nivaana for all reasons and prevent pickup-charge deduction from refunds.
- [ ] Remove or deprecate automatic-pickup configuration and behavior.

### Priority 5 — Implement financial and fulfilment closure

- [ ] Add refund calculation using actual paid value and allocated discounts.
- [ ] Add wallet refund.
- [ ] Add original-payment refund integration.
- [ ] Add manual/external refund reference capture.
- [ ] Add replacement stock reservation and shipment creation.
- [ ] Add automatic refund conversion and customer notification when replacement stock is unavailable for Wrong Product, Damaged Product, Defective Product, and Leakage / Broken Bottle.
- [ ] Add missing-item shipment.
- [ ] Add partial refund.
- [ ] Add completion status transitions and notifications.

### Priority 6 — Invoice, Credit Note, and finance

- [ ] Implement full-return invoice status handling.
- [ ] Implement partial-return revised/override invoice.
- [ ] Create Credit Note/GST adjustment records when applicable.
- [ ] Link Credit Note to original invoice and return request.
- [ ] Add Finance Excel export.

### Priority 7 — Tests and release readiness

- [ ] Generate/synchronize the Prisma client and fix the current Server TypeScript build gate.
- [ ] Add policy-priority tests.
- [ ] Add all six reason-rule tests.
- [ ] Add 48-hour boundary tests.
- [ ] Add exact evidence requirement tests.
- [ ] Add opened-package Changed Mind tests.
- [ ] Add quantity and duplicate-request tests.
- [ ] Add evidence review and admin decision tests.
- [ ] Add pickup integration tests.
- [ ] Add partial and complete inspection tests.
- [ ] Add stock action and concurrency tests.
- [ ] Add refund, replacement, missing-item, partial-refund, invoice, and Credit Note tests.
- [ ] Add end-to-end customer-to-warehouse-to-closure tests.

---

## 17. Business Decision Register

### 17.1 Confirmed decisions

| Topic | Confirmed decision | Implementation consequence |
|---|---|---|
| Reverse pickup execution | Admin manually triggers the reverse shipment after review/approval | Do not auto-create pickup on approval; provide an authorized Admin action and audit it |
| Reverse-shipping charges | Nivaana bears the charge | Never deduct the pickup charge from the refund and never collect it separately from the customer |
| Warehouse-rejected product | Notify customer and retain the product in On Hold inventory | Stop refund/replacement; keep stock unavailable; record rejection and location |
| Replacement stock unavailable | Convert replacement to refund and notify customer | Applies to Wrong Product, Damaged Product, Defective Product, and Leakage / Broken Bottle |

### 17.2 Remaining integration choice

The logistics-provider selection strategy still needs configuration before live reverse-shipment integration:

- Reuse the provider from the original forward delivery; or
- Allow Admin to select any active configured reverse-logistics provider.

This does not change the confirmed manual Admin trigger. Until the selection rule is confirmed, the implementation should store the provider as an explicit pickup field rather than silently assuming one.

---

## 18. Definition of Done

The module is complete only when all of the following are demonstrated in SIT/UAT:

- [ ] Category/Subcategory policy priority works.
- [ ] All six reasons are returned for eligible policies.
- [ ] Each reason shows the correct outcomes and evidence.
- [ ] Damaged claims are rejected after 48 hours.
- [ ] Changed Mind is rejected when the package is opened.
- [ ] Missing Product creates pickup only for Complete Return.
- [ ] Evidence files upload and are reviewable.
- [ ] Customers cannot exceed eligible quantity.
- [ ] Admin can approve/reject requests.
- [ ] Authorized Admin can manually create the real reverse pickup and track it.
- [ ] Warehouse receipt and inspection work.
- [ ] Stock moves only after authorized inspection.
- [ ] A warehouse-rejected product is held in unavailable On Hold inventory and the customer is notified.
- [ ] Refunds complete through wallet/original/manual methods.
- [ ] Replacement and missing-item shipments are linked and tracked.
- [ ] Wrong Product, Damaged Product, Defective Product, and Leakage / Broken Bottle replacements fall back to refund with customer notification when stock is unavailable.
- [ ] Partial refund uses the correct amount.
- [ ] Invoice/Credit Note behavior is correct.
- [ ] Customer and Admin status timelines match backend state.
- [ ] Automated tests cover happy paths, failures, retries, and concurrency.
- [ ] Server, Inventory, Ecom, and Ecom-Web release builds pass.

---

## 19. Final Recommendation

Continue with the current two-layer design:

1. Category/Subcategory policy for general eligibility.
2. Global predefined reason rules for reason-specific behavior.

Do not add a policy-reason mapping table while every policy uses every reason. First remove Sub-subcategory and complete the rule contract. Then prioritize the customer flow, real reverse shipment, inspection UI, and financial/replacement closure. Those items convert the existing backend foundation into a production-ready end-to-end module.
