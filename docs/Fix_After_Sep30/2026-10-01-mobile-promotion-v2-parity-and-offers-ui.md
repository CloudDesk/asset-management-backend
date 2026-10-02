# Mobile Promotion V2 Parity and Offers UI

**Date:** 2026-10-01  
**Applications:** Mobile App, Backend Promotion APIs, Ecom reference flow  
**Status:** Verified locally

---

## Single Source of Truth: Promotion Combination Rules

This section is the authoritative reference for promotion behaviour in Backend, Ecom Web, and Mobile. `POST /v2/promotions/calculate` makes the final eligibility, combination, savings, and payable-total decision. Frontends must display that result and must not calculate a different promotion combination locally.

### Storefront route contract

The storefront routes use business-action names so their purpose is clear without knowing internal promotion-engine terminology.

| Purpose | Route | Consumer |
| :--- | :--- | :--- |
| Public promotion catalogue | `GET /v1/promotions/public` | Ecom and Mobile |
| Customer/group-assigned offers and vouchers | `GET /v1/promotions/customer-offers` | Signed-in Ecom and Mobile |
| Available, eligible, and ineligible cart-offer catalogue | `POST /v1/promotions/available-offers` | Ecom and Mobile |
| Check candidate promotions individually | `POST /v2/promotions/check-eligibility` | Ecom |
| Calculate the authoritative cart promotion result | `POST /v2/promotions/calculate` | Ecom and Mobile |
| Add a manual promotion to an existing evaluation | `POST /v2/promotions/evaluations/:evaluationId/promotions` | Supported V2 operation |
| Remove a manual promotion and recalculate | `DELETE /v2/promotions/evaluations/:evaluationId/promotions/:promotionId` | Ecom |
| Choose a gift product and recalculate | `POST /v2/promotions/evaluations/:evaluationId/gifts` | Supported V2 operation |
| Validate an evaluation before checkout | `POST /v2/promotions/evaluations/:evaluationId/validate` | Ecom; payment backend also validates |
| Create payment/order with the evaluation ID | `POST /v1/phonepe/initiate` | Ecom and Mobile |

`available-offers` supplies the UI catalogue. `calculate` alone owns final discounts, stacking, shipping savings, applied promotions, and payable total.

The following development-only route names were removed on 2026-10-01 and have no compatibility aliases:

| Removed | Replacement |
| :--- | :--- |
| `GET /v1/promotions/mine` | `GET /v1/promotions/customer-offers` |
| `POST /v1/promotions/offers` | `POST /v1/promotions/available-offers` |
| `POST /v2/promotions/eligibility` | `POST /v2/promotions/check-eligibility` |
| `POST /v2/promotions/quote` | `POST /v2/promotions/calculate` |
| `POST /v2/promotions/quote/:evaluationId/select` | `POST /v2/promotions/evaluations/:evaluationId/promotions` |
| `DELETE /v2/promotions/quote/:evaluationId/selection/:promotionId` | `DELETE /v2/promotions/evaluations/:evaluationId/promotions/:promotionId` |
| `POST /v2/promotions/quote/:evaluationId/select-gift` | `POST /v2/promotions/evaluations/:evaluationId/gifts` |
| `POST /v2/promotions/quote/:evaluationId/validate` | `POST /v2/promotions/evaluations/:evaluationId/validate` |

### Simple configuration meaning

| Configuration | Meaning |
| :--- | :--- |
| **Auto Apply = Yes** | The promotion is automatically included for evaluation. The customer does not apply or remove it. |
| **Auto Apply = No** | The promotion enters evaluation only after the customer selects it or enters its code. The customer can remove it. |
| **Combine with other promotions = Yes** (`stackable = true`) | It may share the same eligible item with another promotion only when the other promotion also allows combining. |
| **Combine with other promotions = No** (`stackable = false`) | On an overlapping eligible item, the engine chooses this promotion or the compatible alternative that gives the greater total saving. |

Auto/manual controls **how a promotion enters the calculation**. Stackable/non-stackable controls **whether overlapping discount adjustments can coexist**. These are independent settings.

### Combination policy

1. All eligible stackable promotions can apply together.
2. If a non-stackable promotion overlaps another merchandise discount on the same product unit, both cannot discount that unit.
3. The engine selects the compatible set with the greatest total customer saving.
4. A non-stackable selected-product promotion does not remove valid discounts from unrelated products.
5. Eligible free shipping is a separate shipping benefit and can remain with either stackable or non-stackable merchandise discounts.
6. Savings are capped so a merchandise line or shipping charge cannot be discounted below zero.
7. Priority is only a tie-breaker when compatible choices produce the same saving; it does not override a better customer saving.

### Current acquisition campaign configuration

| Promotion | Application | Combination |
| :--- | :--- | :--- |
| Free shipping over ₹500 | Automatic | Stackable |
| 10% off the cart | Automatic | Stackable |
| ₹100 off the cart | Automatic | Stackable |
| 25% off selected product/category/subcategory | Automatic | Stackable |

When eligible, these promotions are evaluated together and displayed as automatically applied. The customer cannot remove them individually.

### ₹200 selected-product scenario

Suppose the current stackable promotions provide `₹150` of discount on Product A and a `₹200` non-stackable promotion also targets Product A.

The result is:

- Product A receives the better compatible `₹200` discount instead of the overlapping `₹150` adjustments.
- Eligible discounts on Product B and other unrelated products continue.
- Eligible free shipping continues.
- The final calculation may therefore contain `₹200 on Product A + discounts on other products + free shipping`.

The non-stackable promotion does **not** remove every promotion from the complete cart. It replaces only incompatible adjustments on the same eligible product units.

Its application mode changes only the customer interaction:

| ₹200 promotion configuration | Customer experience |
| :--- | :--- |
| **Non-stackable + Automatic** | V2 evaluates it immediately, applies the best compatible result, and shows **APPLIED** with no Remove action. |
| **Non-stackable + Manual** | It initially shows **APPLY**. After selection, V2 compares it with the current combination. If applied, it shows **REMOVE**. |

### Storefront UI contract

Both Ecom Web and Mobile follow the same UI rules:

| Quote/offer state | Required UI |
| :--- | :--- |
| Automatically applied | **APPLIED**, locked; no Remove action |
| Manually applied | **REMOVE** |
| Eligible manual offer not applied | **APPLY** |
| Multiple manual stackable offers | Each can be applied; the UI must not disable the next offer merely because one manual offer is active |
| Incompatible or lower-value selection | V2 rejects or excludes it; show the backend result/message and keep the authoritative applied combination |

No additional promotion configuration is required for the current campaign. The existing **Combine with other promotions** toggle is the `stackable` configuration and remains the single admin control.

---

## Objective

Align Mobile promotion calculation and display with the Ecom Web flow while preserving the existing checkout payload shape, backend database schema, and payment flow.

The Mobile app now uses the canonical V2 promotion calculation for applied discounts. The V1 available-offers route remains only the catalogue of manually selectable offers.

## Root Cause

Ecom Web already calculates promotions through:

```text
POST /v2/promotions/calculate
```

Mobile was using the legacy automatic evaluation flow:

```text
POST /v1/promotions/evaluate/automatic
```

The legacy evaluator did not preserve the newer category/subcategory targeting semantics. Its item-eligibility path treated every cart line as eligible, so a category promotion could be calculated against the complete cart.

Example from the reported cart:

- Incorrect Mobile category discount: `₹322.50` (10% of the complete `₹3,225` cart)
- Correct Web/V2 category discount: `₹30.00` (10% of the eligible `₹300` category items)

This was a route/evaluator mismatch, not a difference in the cart contents.

## Canonical Route and Data Ownership

### Applied promotion pricing

Mobile now uses `POST /v2/promotions/calculate` as the source of truth for:

- promotion eligibility;
- category, subcategory, and product targeting;
- stacking decisions;
- item and shipping adjustments;
- original and payable totals;
- applied promotion savings; and
- the checkout evaluation ID.

The Mobile request uses `schema_version: 2` and `channel: "mobile"`. V2 monetary values are sent and received in paise and are converted to rupees only for the existing Mobile UI models.

### Offer catalogue

Mobile retains `POST /v1/promotions/available-offers` only to load manual offers that a customer may choose. That response must not be used to calculate checkout totals.

The final Mobile offer list combines:

1. promotions already applied by the V2 calculation; and
2. eligible manual offers returned by the catalogue route.

Duplicate promotion IDs are removed before rendering.

### Legacy cart/free-shipping bridge

Free Shipping, Percent Off Entire Cart, and Fixed Amount Off Entire Cart records created without a published V2 rule are converted in memory and evaluated by the canonical V2 engine.

- Automatic legacy records are included automatically.
- Explicitly selected manual legacy records are included through `selected_promotion_ids`.
- Web and Mobile receive the same V2 calculation response.
- Mobile does not call the legacy evaluator as a fallback.
- Ecom's older sequential fallback remains only for compatibility with a backend version that does not yet contain this bridge; with the updated backend, a valid selected legacy promotion succeeds in V2 and the fallback is not called.

The in-memory bridge uses rule version `0`; persisted adjustment rows intentionally have no promotion-rule-version foreign key. The promotion identity and V2 evaluation remain authoritative.

## Why the Evaluation Is Still Required

The promotion evaluation is required even when promotions are automatically applied. It provides a server-authoritative snapshot that checkout can validate and redeem.

It protects the checkout flow by recording or validating:

- the customer and cart associated with the calculation;
- product IDs and quantities;
- the exact applied rules and adjustments;
- the authoritative payable total;
- evaluation expiry;
- rule/version consistency;
- promotion usage, budget, and redemption limits; and
- protection against reusing a stale or unrelated calculation.

One V2 calculation contains all automatic and manually selected promotions. Mobile therefore sends one evaluation ID using the existing checkout contract:

```json
{
  "evaluation_ids": ["<v2-evaluation-id>"]
}
```

The payload field and data type are unchanged. If no promotion is applied, no promotion evaluation ID is required.

## Automatic and Manual Promotion Behaviour

Automatic and manual are application modes, not different discount calculations. The same discount type can exist as separate automatic, click-to-apply, or coupon-code promotions.

| Promotion state | Mobile action |
| :--- | :--- |
| Automatically applied | Show **APPLIED**; customer cannot remove it |
| Manually applied | Show **REMOVE** |
| Eligible manual offer not applied | Show **APPLY** |
| Not eligible for the current cart | Do not show it as an available offer |

The offer sheet title is **Offers for your cart**, because it can contain both automatic applied promotions and manual offers—not coupon codes alone.

Removing a manual promotion requests a fresh V2 calculation without that selected promotion. Automatically applied promotions remain controlled by the server and are re-applied when still eligible.

Ecom Web and Mobile allow another manual offer to be selected while a manual stackable offer is active. The V2 engine—not a frontend blanket restriction—decides whether the resulting selection is compatible.

## Total Savings Correction

The V2 original/payable difference already includes both product discounts and shipping savings.

Mobile previously displayed the free-shipping saving and then excluded it from the sum used to reconcile evaluation savings. The remaining amount was rendered again as **Additional promotion**, double-counting shipping in the UI.

The reconciliation now includes every displayed promotion saving, including free shipping, before calculating any unmatched remainder.

For the reported cart, the correct display is:

| Applied promotion | Saving |
| :--- | ---: |
| Free Shipping | ₹150.00 |
| Fixed Amount Off | ₹100.00 |
| Percent Off Entire Cart | ₹322.50 |
| Category Percentage Off | ₹30.00 |
| **Total savings** | **₹602.50** |

There must be no additional duplicate `₹150.00` row.

## Compatibility and Scope

The change is limited to Mobile promotion evaluation and presentation.

- No backend database schema was changed.
- No promotion storage format was changed.
- No payment or order payload field was changed.
- Checkout continues to receive `evaluation_ids` in the same array format.
- Coupon-code entry, wallet behaviour, and payment-method logic remain separate and unchanged.
- The V1 offers route remains available for the manual offer catalogue.
- Ecom Web continues to use the same canonical V2 calculation route.

The legacy automatic evaluator must not be reintroduced as the source of truth for Mobile totals.

## Order-Line Promotion Breakdown

The Admin order detail response uses persisted V2 adjustment rows as the source of truth for each order line's named promotion breakdown.

- Category, subcategory, selected-product percentage, and selected-product fixed discounts appear only on the order lines whose product IDs are present in the saved adjustments.
- Cart-wide discounts appear on each line only for the exact amount saved against that product.
- Multiple saved adjustments for the same product, including a quantity greater than one, are combined into that product's single order line.
- Free shipping remains an order-level saving and is never allocated to a merchandise order line.
- Each displayed line breakdown is capped by the line's persisted `promotion_discount_amount`, preventing a negative displayed payable amount.
- V2 mapping is pre-indexed by product ID, adjustment ID, and promotion ID. It adds no database query and processes the fetched data in one pass.
- Old orders without usable product-targeted adjustment rows retain the existing proportional display fallback. No migration or historical data rewrite is required.

Example for Order `150`: the `10% off Incense Rituals Category` promotion is shown only for products `75` and `76`. Products `71` and `27` retain their exact cart-wide promotion shares but do not show the Incense category promotion.

Wallet credit remains a payment allocation after promotions. It is not a promotion adjustment and is not included in the order-line promotion breakdown.

### Storage ownership contract

The order line stores the authoritative financial totals required after checkout. It intentionally does not duplicate a variable-length list of individual promotions.

| Stored location | Authoritative data |
| :--- | :--- |
| `orderline` | Product/list amount, product discount total, combined promotion discount total, final payable amount, HSN/GST snapshot, taxable amount, and GST components |
| `promotion_evaluation_adjustments` | Exact promotion ID, product ID, adjustment type, affected quantity, and the amount contributed by that promotion to that product |
| Order-level promotion data | Shipping promotion savings and the complete applied-promotion summary |
| Wallet records | Wallet payment allocation; never part of merchandise promotion allocation |

For example, an order line may persist `promotion_discount_amount = 366.82` and `orderamount = 2433.18`. Its saved adjustments separately explain that total as `86.82` from a fixed-cart promotion plus `280.00` from a percentage-cart promotion. The Admin response joins these already-persisted values; it does not recalculate checkout pricing.

Operational flows use the immutable order/order-line snapshot:

- dispatch and shipment integrations use the saved order and order-line amounts;
- invoices and GST use the saved order-line HSN, GST rate, taxable amount, tax components, and payable amount; and
- the adjustment rows are used only when an exact promotion-name-wise historical breakdown is required.

Promotion evaluations and their adjustment rows linked to completed orders must be retained. Promotions should be deactivated or archived rather than hard-deleted. Deleting an evaluation or promotion can cascade-delete its adjustment rows and remove the exact historical promotion-name split; the order-line totals, payable amount, dispatch, invoice, and GST snapshots remain intact, but the UI would have to use the legacy proportional fallback.

### Redemption-history timestamp contract

All newly created V2 `promotion_redemptions` rows store `redeemed_at`, `createddate`, and `modifieddate` as 13-digit epoch milliseconds. The Admin Redemption History read path normalizes both legacy 10-digit seconds and current 13-digit milliseconds before chronological pagination and response formatting. Date filters query both timestamp units, so historical rows remain searchable by their actual calendar date. The V2 evaluation-expiry timestamp remains independent and continues using its existing seconds contract.

This is a backward-compatible read correction and a forward-only write correction. Existing redemption rows are not rewritten or migrated. The Redemption History promotion-type filter uses the same seven visible types as the Promotion create module.

## Files Updated

### Mobile App

- `src/api/services/promotionService.ts`
- `src/hooks/usePromotions.ts`
- `src/screens/cart/CartScreen.tsx`
- `src/screens/cart/hooks/useCartPromotions.ts`
- `src/screens/cart/steps/PaymentStep.tsx`
- `src/screens/cart/components/CouponCard.tsx`

The Mobile payment offer carousel and **Offers for your cart** modal no longer disable every remaining manual offer after the first manual selection. This enables multiple manual stackable promotions while preserving V2 conflict handling for non-stackable offers.

### Backend

- `src/services/promotions-v2.service.ts`
- `src/services/orders.service.ts`
- `src/utils/order-cost-breakdown.ts`
- `src/utils/order-cost-breakdown.test.ts`

The backend V2 calculation bridges explicitly selected legacy promotions as well as automatic legacy promotions, removing the previous Mobile manual-apply gap for legacy cart and free-shipping records. Order detail responses map the already-saved V2 product adjustments to their exact order lines while preserving the old-order fallback.

## Verification Completed

- Full Backend regression suite: 310/310 tests passed
- Order cost-breakdown scenarios: 12/12 tests passed
- Redemption timestamp write and mixed-history read contracts: 6/6 tests passed
- Backend TypeScript validation: `npx tsc --noEmit --pretty false` — passed
- Mobile TypeScript validation: `npx tsc --noEmit --pretty false` — passed
- Mobile Jest: `npm test -- --runInBand --passWithNoTests` — 1/1 passed
- Patch whitespace validation: `git diff --check` — passed

## Regression Checklist

- [ ] An automatic category promotion discounts only eligible category products.
- [ ] Subcategory and selected-product promotions discount only their eligible lines.
- [ ] Automatically applied promotions show **APPLIED** and no remove action.
- [ ] Eligible manual promotions show **APPLY**.
- [ ] Manually applied promotions show **REMOVE** and can be removed.
- [ ] A second manual stackable promotion remains selectable and can be applied.
- [ ] Selecting an incompatible manual promotion leaves the V2-authoritative combination intact.
- [ ] A non-stackable selected-product offer replaces only conflicting item-level adjustments, not unrelated product discounts.
- [ ] Eligible free shipping remains with merchandise promotions.
- [ ] Free-shipping savings are displayed exactly once.
- [ ] Total savings equals the sum of the visible applied promotion savings.
- [ ] A cart change triggers a fresh V2 calculation.
- [ ] Checkout sends only the current V2 evaluation ID.
- [ ] The backend accepts the evaluation and confirms the calculated payable total.
- [ ] A manual legacy cart/free-shipping promotion selected by ID is evaluated through V2 on both Web and Mobile.

## Related Reference

Admin promotion-form UI simplification is documented separately in:

`asset_management_frontend_aromazen/docs/PROMOTION_FORM_UI_SIMPLIFICATION_2026-10-01.md`
