# Return & Replacement — Flow, Gaps and Fix Tracker

Source scope: *Nivaana Return & Replacement Implementation Plan* (prepared ~Aug 2026). Fix details live in [Master.md](Master.md).

Last updated: 2026-10-08

---

## 1. Major Flow

### 1.1 Eligibility (Customer app / Ecom)
- Return / Replace option is shown **only when applicable**, otherwise hidden.
- Policy is matched on the product hierarchy, most specific first: **Sub-subcategory → Subcategory → Category** (no product-level policy).
- Checks: Return / Replacement allowed, window (days from delivery date), remaining eligible quantity
  (`ordered − returned − replaced − active requests`). No duplicate active request for the same quantity.

### 1.2 Request
- Customer picks order item, quantity, type (Return / Replacement), reason, remarks.
- Each **reason** has its own rules: required evidence (photos / unboxing video), raise-within time, allowed resolutions,
  approval mode (`evidence_first` or `pickup_first`).
- Admin reviews the evidence and **approves / rejects** the request.

### 1.3 Reverse Pickup
- On approval a reverse shipment is created, linked to order, order item and request.
- **Return:** pickup only.
- **Replacement:** pickup of the original item; replacement goes out **after** warehouse verification (plan).
  Code also has replacement stock reservation and a `resolutionTiming` setting — confirm with team whether any reason ships before verification.

### 1.4 Warehouse Verification (always manual)
- Receiving at the warehouse never changes stock automatically.
- **Accepted – resellable:** available stock + approved quantity.
- **Accepted – damaged:** damaged stock + quantity, available unchanged.
- **Rejected:** no refund, no replacement, no stock change, customer notified, item **On Hold**.

### 1.5 Resolution
- **Return → Refund**
  - Amount = what the customer actually paid for the item × returned quantity (after product / promotion discounts).
  - **Shipping is not refunded.** Fully discounted item → **₹0 refund** (FIX-2026-10-08-90).
  - Mixed payment is refunded in the **same proportion** as paid (wallet vs PhonePe).
  - Destination: original sources (wallet coupons restored + PhonePe refund) or wallet (online part → wallet needs customer consent).
  - Manual / external refund: admin records the reference.
- **Replacement → Shipment**
  - Stock allocated from inventory, replacement shipment linked to the original order / item / request.
  - Stock unavailable → refund fallback if configured (`stockUnavailableResolution`), else manual review.
- **Promotional gift:** linked gift must be returned (`RETURN_GIFT`) or its value is deducted (`DEDUCT_GIFT_VALUE`).

### 1.6 Invoice / GST
- Full cancel / full return → invoice cancelled status.
- Partial → override invoice for remaining items.
- Credit note only when the original item has a GST rate; refund amount does not depend on GST. Finance Excel export.

### 1.7 RTO (Delivery Partner Return)
- Separate from customer returns: no request, no reverse shipment.
- RTO received → manual verification → resellable / damaged stock → admin handles refund manually.

### 1.8 Cancellation (before shipment)
- Cancellation refund works at **order level** (one refund operation per order).
- **Requirement (2026-10-08):** cancel all items in one go as a single transaction (one cancellation, one refund).
  Verified 2026-10-09: Ecom, mobile My Orders and mobile Order Detail (after FIX-2026-10-09-94) all use whole-order cancel; item-level cancel is disabled on the backend.

---

## 2. Gaps / Open Decisions

| # | Gap | Status |
|---|-----|--------|
| G1 | Plan has "Accepted for Pickup" but no approval status in the status chains | Code has `requestReviewStatus` — confirm in UI |
| G2 | Rejected end state (On Hold → Closed / returned to customer) not defined | Open (plan clarification 3) |
| G3 | Replacement with no stock — wait or convert to refund | Code has refund fallback setting — confirm business rule (clarification 4) |
| G4 | Reverse pickup charge bearer | Code fixed to `nivaana`, no deduction — confirm (clarification 2) |
| G5 | Auto vs manual reverse shipment creation, which logistics provider | Open (clarification 1) |
| G6 | Replacement shipment invoice / delivery challan | Not covered in plan |
| G7 | Can a replaced unit be returned / replaced again; window start | Not covered in plan |
| G8 | Customer withdrawing a request before pickup | Not covered in plan |
| G9 | Return quantity picker — tester returned 1 of 2 units without noticing (order 167) | 🟡 FIX-2026-10-09-95 — Ecom/mobile default to all remaining units; mobile gets a picker |
| G10 | "Return all" for the whole order | 🟡 FIX-2026-10-09-106 |
| G11 | Cancel all applicable items as a single transaction | 🟡 Verified: only whole-order cancel exists (item cancel route disabled). Mobile order detail used the disabled item route — fixed in FIX-2026-10-09-94 |
| G12 | Plan says policy at Category / Subcategory / **Sub-subcategory**; code `scopekey` is only `category|subcategory` | Sub-subcategory level not implemented — confirm if needed |
| G13 | Partially returned order showed "Refund completed" | 🟡 FIX-2026-10-09-102 — `partially_returned`; web Return button now stays for remaining units |
| G14 | `orders.cancelleddate` stored +5:30 | ✅ Root cause already fixed by FIX-2026-10-08-87 (trigger live on dev, migration applied); new cancels correct. ⏳ 17 old cancelled orders still +5:30 — backfill SQL `backfill_cancelleddate_utc.sql` ready to run manually |
| G15 | Ekart reverse pickup declared value | 🟡 FIX-2026-10-09-104 — paid × returned share, min ₹1 |
| G16 | RTO, invoice cancel / override, credit note, Finance Excel export | 🟡 Checked 2026-10-09: invoice override and export amounts fixed (FIX-2026-10-09-99); credit notes created with HSN/GST; see G19, G20 |
| G17 | Cancel lock / stock outside transaction | 🟡 FIX-2026-10-09-103 |
| G18 | Mobile dead code cleanup | 🟡 FIX-2026-10-09-105 |
| G19 | Order-time GST is on the pre-discount price (order 167 line 252: paid ₹95, taxable ₹114.29 + GST ₹5.71 = ₹120). Invoices and credit notes carry it | **Finance decision** — should GST be on the discounted value? |
| G20 | RTO was built but unreachable (0 records) | 🟡 FIX-2026-10-09-100 (Shipmozo courier RTO auto-creates records) + FIX-2026-10-09-101 ("RTO Operations" menu link restored for manual Create RTO) |
| G21 | Order 167 invoice adjustments still store original 33 / remaining 285 | ⏳ Repair script ready (auto mode blocked the DB write) — run `repair_order167_invoice_adjustments.ts` manually |


### 2.1 Current Code Behaviour for Open Decisions (to confirm with business)

| Gap | What the code does today (2026-10-09) | Business to confirm |
|-----|---------------------------------------|---------------------|
| G2 Rejected item | Inspection with rejected qty > 0, approved 0 and restock action "none" sets restock action **`on_hold`**; status `inspection_rejected`; no refund / replacement, no stock change. No flow to close it, return it to the customer, or dispose of it. | Keep On Hold? Ship back to customer (who pays)? Dispose after N days? |
| G3 Replacement, no stock | Per reason rule `stockUnavailableResolution`. If set to **`refund`**, admin can close the replacement as a refund (`stock_fallback_applied`); otherwise the preview recommends **`manual_review`** and admin decides. Customer notification on fallback is on by default. | Default for each reason: wait for stock or refund? |
| G4 Reverse shipping charge | Always **borne by Nivaana** (`reverseShippingChargeBearer: 'nivaana'`), never deducted from refunds, for every reason including "Wrongly Ordered". | Charge customer for "Wrongly Ordered"? If yes, deduct from refund? |
| G5 Reverse pickup creation | **Manual by admin** after approval (`autoCreatePickup: false`): either create the Ekart reverse shipment from the Pickup form or enter an AWB + vendor by hand. Reason rule sets the order: `evidence_first` (approve on evidence, then pickup) or `pickup_first`. | Keep manual, or auto-create on approval? Ekart only, or the original forward courier? |

---

## 3. Team Issues — Fix Status

Status: 🟡 Implemented / Dev verification pending · ✅ Verified · ⚪ Not a bug · 🅿️ Parked · ⏳ To do

| Team # | Issue | Status | Fix |
|--------|-------|--------|-----|
| 4 | Fully discounted item (paid only shipping) showed ₹50 refundable | 🟡 | FIX-2026-10-08-90 — refund ₹0, closes without refund op / credit note |
| 12 | Order 167: ₹347 wallet + ₹33 paid, only ₹260.25 back to wallet | ⚪ | 3 of 4 units returned (line 253 qty 2, 1 returned). ₹285 → ₹260.25 wallet + ₹24.75 PhonePe — correct |
| 5 | "Return all" button, single approval and pickup | 🟡 | FIX-2026-10-09-106 — group request (one reason / resolution / evidence), admin approve / reject / one pickup for the group; refund and inspection per item. **Run migration first** |
| 10 | Seller details captured on return pickup shipment | 🟡 | FIX-2026-10-08-91 — removed from pickup form; backend uses Ekart warehouse address + `SELLER_GST_TIN` |
| 7 | Deactivated policy cannot be reactivated ("already exists") | 🟡 | FIX-2026-10-08-92 — creating a deactivated scope reactivates the same policy; Edit → Active toggle already worked |
| 6 | Wallet order cancelled, reverts after hard refresh (Web) | 🟡 | Not reproduced; hardening done in FIX-2026-10-09-103 (real lock, stock after commit, web shows saved status when unconfirmed) |
| 9 | Limit number of return images | 🟡 | FIX-2026-10-08-93 — max 5 photos per request (videos not counted), backend env `RETURN_EVIDENCE_MAX_PHOTOS` |
| 8 | Current page number not distinguishable in pagination | ✅ | Fixed outside this session; confirmed by screenshot 2026-10-08 (current page shown dark filled) |

---

## 4. Test Checklist

Filled in as fixes land; tested together after all bugs are fixed.

| Fix | Steps | Expected |
|-----|-------|----------|
| #4 | Inventory → Return Sources → request 26 (order 168) → close as refund | Amount ₹0, status Refund Completed, no refund operation, no credit note |
| #4 | Close any normal paid return (e.g. ₹95 line) | Refund amount unchanged |
| #10 | Inventory → Return Sources → approved request → Pickup → tick "Create reverse shipment with EKART" | No seller fields shown; reverse shipment created with tracking ID |
| #7 | Deactivate a policy → Create policy for the same category/subcategory | Same policy becomes Active with new values, no "already exists" |
| #7 | Create policy for a category that already has an active policy | "Policy already exists" |
| #9 | Ecom: raise return → select 7 photos at once | First 5 kept, message "You can upload up to 5 photos." |
| #9 | Mobile: add photos one by one | 6th attempt shows "Photo Limit Reached" |
| G11 | Mobile → Order Detail of a `payment_completed` multi-item order → Cancel Order | All items cancelled, wallet restored, order shows Cancelled |
| G9 | Ecom and mobile: return a line with qty 2 | Quantity starts at 2 ("up to 2" / "of 2"); set 1 → after request, 1 unit still returnable |

## 5. Web vs Mobile Alignment (checked 2026-10-09 — all aligned)

| Area | Web (Ecom) | Mobile | Aligned |
|------|-----------|--------|---------|
| Return / Replace shown only when eligible | Yes | Yes (Order Detail, `itemEligibility.eligible`) | ✅ |
| Return deadline label | Yes | Yes | ✅ (FIX-2026-10-08-88) |
| Quantity | Defaults to all remaining, "up to N" | Defaults to all remaining, −/+ picker | ✅ (FIX-2026-10-09-95) |
| Reason → resolution | Choose Return/Replace first, reasons filtered | Reason, then resolution; type from resolution | ✅ same payload |
| Package opened rule | `openedpackageallowed` | `openedpackageallowed` | ✅ |
| Evidence minimums | `evidencerules` minimum | `evidencerules` minimum | ✅ (FIX-2026-10-09-96) |
| Photo limit | 5 | 5 | ✅ (FIX-2026-10-08-93) |
| Photo / video size | 8 MB / 60 MB | 8 MB / 60 MB | ✅ (FIX-2026-10-09-97) |
| Multi-select photos | Yes | Yes (up to remaining limit) | ✅ (FIX-2026-10-09-97) |
| Cancel | Whole order | Whole order (list + detail) | ✅ (FIX-2026-10-09-94) |
| Evidence checklist | From `evidencerules` (Required xN) | From `evidencerules` (Required xN) | ✅ (FIX-2026-10-09-97) |
| Choosing Return vs Replace | Return / Replace buttons first, reasons filtered | One button; reason, then resolution (only eligible ones) | ✅ same result and payload |
| Replacement status labels | By request type | By request type | ✅ (FIX-2026-10-09-98) |
| Replacement Delivered shown as finished | Yes | Yes | ✅ (FIX-2026-10-09-98) |
| G20 | Shipmozo order moves to RTO (courier) → tracking sync | Inventory Return Sources shows an RTO record per item (RTO Initiated → RTO Received); stock unchanged until verification |
| G13 | Web: open order 167 | Status "Partially Returned"; Return offered for the 1 remaining unit of product 57 |
| #6 / G17 | Cancel a wallet `payment_completed` order on web, hard refresh; cancel a `ready_for_dispatch` order; double-click cancel | Stays Cancelled; wallet restored; stock restored exactly once |
| #5 | Apply migration; delivered order with 2+ items → web/mobile "Return all items" → Inventory approve all → one pickup → inspect each → refund each | One group number on all requests; one AWB on all; per-item refunds and credit notes |
