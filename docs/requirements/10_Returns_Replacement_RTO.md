# 10 · Returns, Replacement and RTO

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`return-request.*`, `return-replacement-policy.*`, `return-reason-rule.*`, `return-policy-reason-rule.service.ts`, `invoice-adjustment.service.ts`, `refund-operation.service.ts`, Prisma `Return*`), `Nivaana Return & Replacement Plan - Updated.md`, `docs/Fix_After_Sep30/Return_Replacement_Flow_Tracker.md`, Master.md 2026-10-07 … 2026-10-09.

> **Master design:** `Nivaana Return & Replacement Plan - Updated.md` (1,277 lines) is still the full specification. This file is the short, current requirement list and records the changes made after that plan.

## 1. Purpose

Lets customers return or replace delivered items under category rules, lets the team verify the item and evidence, and closes each request with stock, refund, replacement and GST paperwork. It also handles return-to-origin (RTO) parcels.

## 2. Policies

- **RET-01** A policy is set per **category** or **subcategory**. The subcategory policy wins when both exist.
- **RET-02** A policy stores:
  - return allowed and return window (days)
  - replacement allowed and replacement window (days)
  - allowed refund methods
  - notes and active flag
- **RET-03** Every policy owns **six reason rules**: Wrong Product, Damaged Product, Missing Product, Defective Product, Leakage / Broken Bottle, Changed Mind.
  - They are copied from the reason master when the policy is created, then edited per policy.
  - Changes are versioned and apply only to new requests.
- **RET-04** Re-creating a deactivated scope reactivates the policy (FIX-2026-10-08-92). Policies are created only from "No Policy" rows in Inventory (FIX-2026-10-07-76).
- **RET-05** Each reason rule sets:
  - the raise-within hours
  - required evidence: photos, video, package photo, unboxing video (minimum counts in `evidencerules`)
  - whether an opened package is allowed
  - pickup required, approval mode (evidence first / pickup first), allowed resolutions
  - fallback when stock is unavailable
  - who pays reverse shipping

## 3. Master defaults per reason

| Reason | Deadline | Evidence | Outcomes | Pickup |
| --- | --- | --- | --- | --- |
| Wrong Product | Policy window | Product photo | Replacement or refund | Required |
| Damaged Product | **48 h** after delivery | Product photo; package photo and unboxing video optional | Replacement; refund if no stock | Where physical return is needed |
| Missing Product | Policy window | Product / package photos | Ship missing item, partial refund, or complete return | Only for complete return |
| Defective Product | Policy window | Product photo + defect video | Replacement or refund | Required |
| Leakage / Broken Bottle | Policy window | Photo + video | Replacement or refund | Where physical return is needed |
| Changed Mind | Policy window | Photos of the unopened package | Return and refund; rejected if opened | Required |

At least one photo is always required.

## 4. Customer request

- **RET-06** A request can be raised **only after delivery** and within the reason or policy deadline. Return / Replace is shown only when it applies.
- **RET-07** Eligible quantity = ordered − returned − replaced − in active requests. The form defaults to all returnable units (FIX-2026-10-09-95).
- **RET-08** **Return / Replace all items** creates one grouped request (`groupnumber`) for orders with two or more eligible items: one reason, resolution and evidence (FIX-2026-10-09-106).
- **RET-09** Evidence limits (web, mobile and backend are the same):
  - at most **5 photos** per request (`RETURN_EVIDENCE_MAX_PHOTOS`)
  - photo ≤ **8 MB**, video ≤ **60 MB**
  - minimum counts per reason (FIX-93 / 96 / 97)
- **RET-10** Promotional gifts cannot be returned on their own. Returning the paid item requires returning its gift.
- **RET-11** The customer's request and its status labels read the same on web and mobile, prefixed Return / Replacement (FIX-2026-10-09-98).

## 5. Admin processing

The steps run in this order (`PATCH /v1/returns/:id/…` or `/group/:groupNumber/…`):

1. **Evidence review:** approve or reject (`evidence_pending` → `evidence_approved` / `evidence_rejected`).
2. **Request approve / reject.**
3. **Pickup preparation**, then the reverse shipment is created **manually by the admin** (Ekart or Shipmozo). Nivaana bears the reverse-shipping charge.
4. **Received** at the warehouse (quantity, condition, remarks). Receiving never changes stock by itself.
5. **Inspection:** approved / rejected quantity, condition, restock action (restock to available, damaged, quarantine or on hold).
6. **Resolution:**
   - refund (module 07)
   - replacement (new shipment; turns into a refund if stock is unavailable)
   - missing-item shipment
   - partial refund
7. **Credit note** and invoice adjustment for refunds.

- **RET-12** An inspection-rejected product stays **On Hold**, and the customer is notified. There is no refund or replacement.
- **RET-13** The refund is the paid line amount × the returned share. A fully discounted item refunds ₹0 (FIX-2026-10-08-90).
- **RET-14** Every status change is written to `ReturnStatusTimeline` with the actor. The request keeps an immutable snapshot of the policy and reason rule.
- **RET-15** The order shows `partially_returned` when only some units are returned (FIX-2026-10-09-102).

## 6. RTO (return to origin)

- **RET-16** A courier `rto_initiated` / `rto_delivered` status creates or advances an RTO record per order line automatically (reason `delivery_failed`) (FIX-2026-10-09-100). Admins can also create RTO records manually under **Orders → RTO Operations** (`/return-sources?requesttype=rto`).
- **RET-17** RTO statuses: `rto_initiated` → `rto_in_transit` → `rto_received` / `rto_received_at_warehouse` → `rto_warehouse_verified` → `rto_closed`.

## 7. Request statuses (main)

- **Request:** `requested`, then `evidence_pending` / `evidence_approved` / `evidence_rejected`, `approved` / `rejected`.
- **Pickup:** `pickup_prepared`, `pickup_created`, `in_transit`, `received`.
- **Inspection:** `inspection_pending`, `inspection_approved` / `inspection_rejected`.
- **Refund:** `refund_pending`, `refund_progress`, `refund_completed` / `refund_failed`.
- **Replacement:** `replacement_pending`, `replacement_shipped`, `replacement_delivered`.
- **Missing item:** `missing_item_pending`, `missing_item_shipped`.
- **Closing:** `completed`, `closed`.

## 8. Inventory screens

Return & Replacement Policies (list with Show / Level filters, grouped rows, Reason Configuration modal with an unsaved-changes guard), Return Sources (customer returns and RTO operations), Return detail (evidence, pickup, receive, inspection, resolution, credit note), operations summary, credit-note export.

## 9. Gaps and items to confirm

- **Reverse-logistics provider rule is still open:** either reuse the forward courier or let the admin pick any provider.
- The completion dashboard in the master plan (48%) and the tracker (last updated 2026-10-08) are out of date. Re-baseline them after the 2026-10-09 fixes.
- The master plan supports only category / subcategory policies, but the tracker mentions sub-subcategory. Code uses category and subcategory only. Correct the tracker.

## 10. Source documents

`Nivaana Return & Replacement Plan - Updated.md`, `CR5_RETURN_REPLACEMENT_MODULE_PLAN.md`, `docs/Fix_After_Sep30/Return_Replacement_Flow_Tracker.md`, `docs/RETURN_REPLACEMENT_INVENTORY_QUANTITY_FLOW.md`, Inventory `docs/ORDER_RETURNS_INTEGRATION_REFERENCE.md`.
