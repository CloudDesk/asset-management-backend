# 05 · Promotions, Vouchers, Coupons, Customer / Coupon Groups and Wallet

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`promotion-v2-engine.ts`, `promotions-v2.service.ts`, `promotion-*.service.ts`, `coupon-wallet.service.ts`, `wallet-redemption.service.ts`, `direct-coupon-checkout.service.ts`, `couponWalletPolicy.ts`, `checkoutPricing.ts`), PLAN-2026-10-12-107, PLAN-2026-10-15-116, FIX-2026-10-23-160, CR3, CR4, Master.md.

## 1. Purpose

Gives customers discounts in a predictable order on web, mobile and in-store. The **V2 engine is the single source of truth** for every discount amount (FIX-2026-10-01-18).

## 2. Promotion types (fixed list of seven)

| # | Admin label | Scope | Minimum quantity | Priority on an item |
| --- | --- | --- | --- | --- |
| 1 | Fixed Amount Off Selected Products | Selected products | Required, default 1 | 1 (highest) |
| 2 | Percentage Off Selected Products | Selected products | Required, default 1 | 2 |
| 3 | Percentage Off Categories | One or more categories | Required, default 1 | 3 |
| 4 | Percentage Off Subcategories | One or more subcategories | Required, default 1 | 4 |
| 5 | Percent of entire cart value *(was "Percent Off Entire Cart")* | Items with no product promotion | — | 5 |
| 6 | Fixed amount of entire cart value *(was "Fixed Amount Off Entire Cart")* | Full cart value | — | 6 |
| 7 | Free Shipping | Shipping charge | — | Shipping only |

- **PRM-01** No new types are added. Business wording such as "10% off all items" maps to one of the seven (type 5 in this case).
- **PRM-02** Older types (BOGO, Free Product / gift) still exist in the engine for old records and are the only types where *Stackable* changes the result.

## 3. Promotion settings

- **PRM-03** A promotion has:
  - name, description, code (optional), start and end date (end must be after start), timezone
  - status, priority
  - visibility, channel (`applicable_channel`: `all` / `web` / `mobile`)
  - application mode: automatic or click-to-apply
  - max redemptions, per-user limit, budget
  - evaluation expiry (default **15 min**)
  - rules (V2 rule versions: draft → simulate → publish)
- **PRM-04** A promotion cannot be published if it matches no active products. Publishing stores a versioned rule (`PromotionRuleVersion`) with its targets (product / category / subcategory facets).
- **PRM-05** Category and subcategory choices come from the **picklist**, not from product values, so subcategories without products are listed. Product search is paged (FIX-2026-10-15-117).

## 4. Calculation rules (per cart)

- **PRM-06** **Minimum quantity**: if it is not met, the promotion is skipped with `MINIMUM_QUANTITY_NOT_MET` and `remaining`.
  - Selected products: the quantity of **all selected products in the cart is added up**, and once it is met every selected item gets the offer (FIX-2026-10-23-160).
  - Categories / subcategories: the quantity of **all cart items in any of the promotion's categories / subcategories is added up together** (FIX-2026-10-15-118).
- **PRM-07** **Priority**: each item goes to the qualifying product promotion with the highest priority (table above), even if a lower one saves more. Between two of the same type, the bigger saving wins. Stackable on/off does not change this for the seven types.
- **PRM-08** **Percent of entire cart value** applies only to items with no product / category / subcategory promotion actually applied. An item whose promotion misses its minimum does get the cart percent.
- **PRM-09** **Fixed amount of entire cart value** applies to the full cart value.
- **PRM-10** A whole-order offer is applied in full or not at all, never split partially (FIX-2026-10-05-30).
- **PRM-11** Limits:
  - the total discount is never above the cart value
  - no item goes below ₹0
  - shipping is reduced only by Free Shipping
- **PRM-12** **Locked offers**: an offer whose only problem is the minimum quantity stays visible with "Add N more [category] item(s) to get X% / ₹X off". A cart row shows a hint when a better offer is N items away. Offers rejected for other reasons (audience, channel, limit, expiry) stay hidden.
- **PRM-13** Customer-facing apps show no "we'll keep whichever saves more" note for the seven types.

## 5. Evaluation, checkout and redemption

- **PRM-14** The cart is quoted with `POST /v2/promotions/calculate` / `check-eligibility`. The evaluation is saved (`promotion_evaluations`) with the cart signature and expires (default 15 min).
- **PRM-15** Payment start checks that the evaluation still matches the cart. Mismatch errors: `PROMOTION_CART_CHANGED`, `PROMOTION_EVALUATION_NOT_FOUND`, `…_CONFLICT`, `DIRECT_COUPON_QUOTE_CHANGED`.
- **PRM-16** On a paid order the evaluation is redeemed once (`promotion_redemptions`). Redemption counts toward max redemptions, the per-user limit and the budget.
- **PRM-17** Order lines store list price, product discount, promotion discount, promotion id, free-item flag and parent line (for gifts). The price breakdown is the same on Admin, E-com and Mobile (FIX-2026-10-07-52).

## 6. Vouchers, coupons and groups

- **PRM-18** **Vouchers** (`promotion_assignments`) are codes issued under a promotion to a customer or a customer group. They have a usage limit, dates, status and delivery channel. Codes need at least 4 valid characters and must be unique.
- **PRM-19** **Customer groups** (`/v1/customer-groups`) target promotions at a set of customers.
- **PRM-20** **Coupon groups** issue one standalone coupon per member.
- **PRM-21** A **standalone coupon** (Inventory quick coupon):
  - belongs to one customer and is never stackable
  - can be used directly at checkout, or claimed into the wallet
  - is applied after promotions and limited to the remaining merchandise amount, so it never covers shipping
- **PRM-22** Checkout lists the customer's own coupons as "Your coupons" (FIX-2026-10-06-47).
- **PRM-23** Coupon admin statuses: only active / inactive (paused) / revoked are stored. The status shown is derived on each read and has **seven values**:
  - Not used
  - Added to wallet
  - Partly used
  - Fully used
  - Expired
  - Paused
  - Cancelled
- **PRM-24** Revoked coupons cannot be reactivated. Claimed or used coupons cannot be edited.

## 7. Wallet

- **PRM-25** The wallet is a ledger of credits (`wallet_credits`). Each credit has:
  - a source (coupon, refund, admin)
  - original and remaining amount
  - minimum cart amount
  - expiry
- **PRM-26** Checkout uses only credits whose expiry is not past. The wallet pays the amount after promotions and coupons (merchandise plus shipping payable).
- **PRM-27** A checkout **reserves** the quoted wallet amount for **15 minutes** (`wallet_reservations`).
  - Payment success consumes the reservation.
  - Failure or expiry reverses it.
  - A changed balance raises `WALLET_BALANCE_CHANGED` / `WALLET_RESERVATION_CHANGED`.
- **PRM-28** Refunds can go to the wallet (module 07). Cancelling an order gives back wallet credit that is still valid.
- **PRM-29** The wallet row is always visible in mobile and web checkout when the customer has credit (FIX-2026-10-07-51).

## 8. Inventory screens

Promotions (list with type filter in create-form order, form with simple setup per type, redemption detail), Offers, Coupon Wallet (list, detail `/coupon-wallet/:id`, history drawer, print, edit), customer groups (inside Customers).

## 9. Gaps and items to confirm

- PLAN-116 and FIX-160: confirm that SIT, UAT and Prod promotion status matches the release checklist.
- A stored "expired" flag for reporting needs a nightly job (PLAN-08 in `Future_Plans.md`).
- Older promotion documents (`PROMOTION_*`, `STACKABLE_*`, `multiple_promotion_flow_example.md`) describe the V1 behaviour and are **superseded** by this file.

## 10. Source documents

`docs/Fix_After_Sep30/2026-10-12-promotion-priority-and-cart-label-rename-plan.md`, `2026-10-15-promotion-min-quantity-and-type-priority-plan.md`, `2026-10-23-promotion-selected-products-min-qty-hotfix-plan.md`, `2026-10-01-mobile-promotion-v2-parity-and-offers-ui.md`, `CR3_PROMOTION_ENHANCEMENTS_PLAN.md`, `CR4_WALLET_MODULE_PLAN.md`, `docs/Before Sep28 Fix/COUPON_WALLET_CHECKOUT_IMPLEMENTATION_PLAN.md`, `PROMOTION_DISCOUNT_CAP_HANDOVER.md`, Inventory `rules/promotions.md`.
