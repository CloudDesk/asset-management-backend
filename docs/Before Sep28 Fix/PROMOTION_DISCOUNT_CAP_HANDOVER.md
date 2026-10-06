# Promotion Discount Cap and Checkout Pricing — AI Developer Handover

**Prepared:** 26 September 2026
**Purpose:** Continue the promotion/discount cap implementation and Phase 4 verification without losing the technical and business context established during the current work.
**Current scope:** Backend, Nivaana Ecom Web, and Vibrant Life/Nivaana Mobile. Inventory promotion configuration is relevant context but is not the main implementation surface for this defect.

## Current status at a glance

- The approved standalone coupon/direct-checkout/wallet business rules and implementation sequence are documented separately in [COUPON_WALLET_CHECKOUT_IMPLEMENTATION_PLAN.md](./COUPON_WALLET_CHECKOUT_IMPLEMENTATION_PLAN.md). Development Phases 1–5 are implemented locally across Backend, Inventory/Admin, Ecom, and Mobile. The Phase 1 migration is not yet deployed and the Phase 6 cross-client manual balance matrix remains pending.
- The reported issue is valid: monetary promotion value could historically exceed the merchandise/cart subtotal and the excess could effectively reduce shipping.
- Phases 1–3 of the agreed fix have been implemented in the current working trees.
- The backend now calculates authoritative checkout pricing and separates merchandise and shipping balances.
- Ecom and Mobile handle server total changes and zero-external-payment orders.
- Relevant automated tests pass. The latest verification completed with **268/268 backend tests**, including **26/26 promotion V2 engine tests**.
- Backend TypeScript compilation, Prisma validation, and the Ecom production build pass.
- Manual smoke testing has created Ecom order **132** and Mobile order **133**; their exact promotion/coupon composition was not independently extracted. Later testing created orders **134–139**. Orders **136 (Ecom)**, **137 (Mobile)**, **138 (Mobile)**, and **139 (Ecom)** were inspected directly and their authoritative totals, free-shipping threshold behavior, and redemption rows are documented in section 7.3.
- Phase 4 remains the exhaustive manual scenario matrix described below.
- A later, separate V2/legacy evaluation cancellation defect was found during manual testing and has also been fixed in the current working tree.
- A later multi-line V2 allocation defect was reproduced and fixed: an oversized fixed discount such as ₹100 against two ₹40 lines was incorrectly applied as ₹70 instead of the capped ₹80.
- Order 136 redemption rows exist, but a separate seconds-versus-milliseconds timestamp mismatch currently hides them from a date-filtered Inventory redemption-history view. That display/filter issue remains pending.
- A mobile post-payment cart retention defect was found during Order 138 testing and has been fixed: PhonePe deep linking directly to `MyOrders` bypassed screen completion callbacks, and `PersistentCartContext.clearCart()` previously omitted local AsyncStorage clearance on server success, causing `syncWithServer()` to resurrect purchased items. Fixed in `PersistentCartContext.tsx` and `MyOrdersScreen.tsx`.

---

## 1. Issue Summary

### 1.1 Confirmed issue

The combined monetary discount from stacked promotions (including code-entry promotions/coupon-like promotion rules) could become greater than the merchandise subtotal.

Historical failing example observed in Ecom:

```text
Merchandise/cart subtotal:       ₹80
Displayed promotion discount:   ₹88
Standard shipping:             ₹150
Displayed payable total:       ₹142
```

The ₹8 overflow from merchandise discounts was effectively subtracted from shipping:

```text
₹80 + ₹150 - ₹88 = ₹142
```

That behavior is incorrect. A merchandise/cart/item promotion must never consume the shipping balance.

### 1.2 Required behavior

Use independent balances:

```text
merchandise_discount <= merchandise_subtotal
shipping_discount    <= shipping_amount

merchandise_payable = merchandise_subtotal - merchandise_discount
shipping_payable    = shipping_amount - shipping_discount
payable_before_wallet = merchandise_payable + shipping_payable
```

Business interpretation:

- `merchandise_subtotal` is merchandise value after the product's normal/catalogue discount; shipping is not part of it.
- Fixed, percentage, line-item, BOGO-as-discount, and code-entry promotional discounts share the merchandise balance.
- Standard shipping is currently ₹150.
- Shipping remains ₹150 unless an eligible shipping-specific promotion reduces it.
- Only `FREE_SHIPPING`/shipping adjustments may reduce shipping.
- A free-shipping promotion must not consume merchandise balance.
- Coupon wallet credit is applied after the promotion calculation and must not exceed the remaining post-promotion payable amount.
- An order covered completely by merchandise promotions plus a valid free-shipping promotion, or by wallet credit after promotions, must complete internally without sending a ₹0 payment to PhonePe.

### 1.3 Where the issue occurred

The risk existed in several places rather than one UI expression:

1. Legacy promotion evaluation could add multiple promotion amounts without a shared merchandise cap.
2. V2 candidates were calculated independently; compatible candidates could nominally overlap the same finite line value.
3. The client-calculated transaction amount was previously trusted too far into payment initiation.
4. Order and order-line allocation needed a final safeguard against negative line values.
5. Wallet/coupon credit needed to use the post-promotion payable amount rather than an uncapped or stale client amount.

### 1.4 Related but separate issue discovered during Phase 4

For a ₹80 cart with no applicable promotion and ₹150 shipping, checkout returned:

```json
{
  "success": false,
  "statusCode": 500,
  "message": "Promotion evaluation has expired",
  "details": "Promotion evaluation has expired"
}
```

The evaluation was not actually expired. Database/log evidence for evaluation `2c1b294b-dec8-4550-a126-0991e9f27a60` showed:

```text
created_at:   2026-09-26T02:54:04Z
expires_at:   2026-09-26T03:09:04Z
cancelled at: 2026-09-26T02:54:15.234Z
```

A concurrent legacy automatic-evaluation request cancelled the new V2 quote. The V2 validator combined “inactive” and “expired” into the same generic error and therefore returned a misleading 500. The current working tree contains the fix described in section 5.5.

---

## 2. Existing Flow and Logic

## 2.1 Repositories and active branches

| Application | Directory | Branch observed |
|---|---|---|
| Backend | `asset-management-backend` | `DEV-NEW` |
| Ecom Web | `Nivaana-Ecom-Web` | `DEV-NEW` |
| Mobile | `Vibrant-Life-mobile-app` | `expo_rn_migrations_v2` |
| Inventory | `asset_management_frontend_aromazen` | Not changed as part of this defect |

All repositories currently contain uncommitted work. Do not reset, discard, or broadly overwrite changes.

## 2.2 Ecom cart and checkout flow

Primary files:

- `Nivaana-Ecom-Web/src/pages/Cart.tsx`
- `Nivaana-Ecom-Web/src/pages/Checkout.tsx`
- `Nivaana-Ecom-Web/src/services/promotionService.ts`
- `Nivaana-Ecom-Web/src/services/paymentService.ts`
- `Nivaana-Ecom-Web/src/services/apiService.ts`

Relevant APIs:

- `POST /v2/promotions/quote`
- `POST /v2/promotions/eligibility`
- `POST /v2/promotions/quote/:evaluationId/validate`
- `POST /v2/promotions/quote/:evaluationId/select`
- `DELETE /v2/promotions/quote/:evaluationId/selection/:promotionId`
- `POST /v2/promotions/quote/:evaluationId/select-gift`
- `POST /v1/phonepe/initiate`
- `GET /v1/phonepe/status/:merchantTransactionId`
- Coupon wallet quoting is exposed through `POST /v1/coupon-wallet/discount/quote`.

Cart behavior:

1. Product rows are converted to V2 cart items containing cart-record ID, product ID, and quantity.
2. Guest cart calls `POST /v2/promotions/quote` with `preview_only: true`.
3. Guest preview can display eligible public offers but is informational; it is not persisted as a checkout-ready evaluation.
4. Authenticated cart gets a persisted V2 evaluation.
5. V2 is the canonical quote. The legacy automatic evaluator is now used only if the V2 request fails.
6. A V2 quote with no applied benefit is used for display totals, but its evaluation is not validated or attached to payment.
7. Cart validation leads to `/checkout`.

Checkout behavior:

1. Checkout requotes against the authenticated customer and current cart.
2. UI displays V2 separated totals:
   - merchandise discount from non-shipping adjustments;
   - shipping saving from `FREE_SHIPPING` adjustments;
   - auto-added gifts are not treated as merchandise discounts.
3. Checkout submits `evaluation_ids` only when the V2 quote contains an applied promotion/adjustment.
4. Ecom calls `/v1/phonepe/initiate` with:
   - `payment_channel: "ecom"`;
   - `returnUrl: <origin>/checkout/confirmation`;
   - order items;
   - pre-wallet checkout amount;
   - shipping amount;
   - optional evaluation ID;
   - optional wallet request.
5. A `409 CHECKOUT_TOTAL_CHANGED` invalidates promotion, wallet, and cart queries and asks the user to review the refreshed total.
6. If the backend has already created an internally funded order, Ecom goes directly to confirmation instead of opening PhonePe.
7. Otherwise Ecom redirects to PhonePe using `window.location.replace(redirectUrl)`.

## 2.3 Mobile flow

Primary files:

- `Vibrant-Life-mobile-app/src/api/services/paymentService.ts`
- `Vibrant-Life-mobile-app/src/screens/cart/CartScreen.tsx`
- `Vibrant-Life-mobile-app/src/screens/cart/CheckoutScreen.tsx`
- `Vibrant-Life-mobile-app/src/screens/cart/hooks/useCartPayment.ts`

Mobile submits `payment_channel: "mobile"` in its current payment flow and may submit `evaluation_ids`. The intended PhonePe return remains:

```text
nivaana://Main/ProfileTab/MyOrders
```

After a successful PhonePe return, My Orders should refresh and fetch the latest orders. If promotions or wallet already cover the complete order, the backend returns a successful created order without a PhonePe redirect; Mobile clears pending/cart state and navigates to My Orders.

Mobile now recognizes `CHECKOUT_TOTAL_CHANGED` and asks the customer to review the recalculated total.

## 2.4 Backend promotion evaluation flow

Primary V2 files:

- `asset-management-backend/src/routes/promotions-v2.route.ts`
- `asset-management-backend/src/controllers/promotions-v2.controller.ts`
- `asset-management-backend/src/services/promotions-v2.service.ts`
- `asset-management-backend/src/services/promotion-v2-engine.ts`
- `asset-management-backend/src/schemas/promotions-v2.schema.ts`

Primary legacy files:

- `asset-management-backend/src/services/promotion-evaluation.service.ts`
- `asset-management-backend/src/utils/promotionDiscountCap.ts`

V2 service flow:

1. Validate `PromotionQuoteRequestSchema`.
2. Hydrate current product price, stock, category/subcategory and catalogue version from the server.
3. Load published V2 rules and bridge unmigrated legacy automatic offers when required.
4. Apply active/date/channel/audience/assignment/usage/budget rules.
5. Evaluate candidates using `evaluatePromotionQuote()`.
6. Optimise compatible candidates.
7. Run `capSelectedCandidates()` so compatible merchandise candidates share finite per-line balances and shipping adjustments share only the shipping balance.
8. Return separated paise totals and persist non-preview evaluations.

V2 quote fields important to checkout:

```text
merchandise_subtotal
merchandise_discount_total
merchandise_payable
shipping_amount
shipping_discount_total
shipping_payable
gift_savings_total
discount_total
payable_total
adjustments
applied_promotions
evaluation_id
expires_at
```

Legacy flow now routes combined promotion arrays through `capLegacyMerchandisePromotions()` before persisting totals.

## 2.5 Backend payment/order flow

Primary files:

- `asset-management-backend/src/routes/phonepe.route.ts`
- `asset-management-backend/src/controllers/phonepe.controller.ts`
- `asset-management-backend/src/services/phonepe.service.ts`
- `asset-management-backend/src/utils/checkoutPricing.ts`
- `asset-management-backend/src/services/wallet-redemption.service.ts`

Important functions:

- `PhonePeController.resolveAuthoritativeCheckoutPricing()`
- `calculateCheckoutPricing()`
- `checkoutCartQuantitiesMatch()`
- `checkoutAmountsMatch()`
- `uniqueCheckoutEvaluationIds()`
- `PhonePeController.completeWithoutExternalPayment()`

Authoritative payment flow:

1. Validate evaluation ownership, state, expiry, current promotion configuration, usage limits and cart signature/content.
2. Load current product price and product discount from the database.
3. Calculate merchandise subtotal as `(product.price - product.discount) × quantity` using current server data.
4. Reconstruct authoritative pricing from the V2 quote snapshot or capped legacy applied promotions.
5. Compare the submitted pre-wallet amount with `payable_before_wallet` at paise precision.
6. If mismatched, return `409 CHECKOUT_TOTAL_CHANGED`; do not initiate payment with a stale amount.
7. Replace client amount, shipping cost and wallet eligibility base with server-calculated values.
8. Lock stock.
9. If promotions cover the entire checkout, create the order internally using mode `promotion`.
10. Otherwise quote/reserve wallet credit against the post-promotion payable amount.
11. If wallet covers the remainder, create the order internally using mode `wallet`.
12. Otherwise send only the remaining amount to PhonePe.
13. Store `checkout_pricing` in transaction data and use it during order/order-line creation.
14. Retain a final order-line safeguard: a promotion discount cannot make an order line negative.

## 2.6 Promotion rules that must continue to apply

Verified from current code:

- Promotion status must be `active`.
- Current date must be inside optional start/end boundaries.
- Channel eligibility is enforced.
- Public guest preview hides non-public promotions.
- Non-automatic promotions require explicit selection or matching code.
- Active customer/customer-group/anyone assignments are enforced when assignments exist.
- `max_redemptions` is enforced when configured.
- `per_user_limit` is enforced for authenticated customers when configured.
- Budget is unlimited when `null`, zero, or otherwise non-positive in current V2 logic.
- A positive budget uses recorded `promotion_redemptions.discount_amount` to determine remaining budget.
- A candidate whose saving exceeds remaining budget is rejected with `BUDGET_EXHAUSTED`; the engine does not partially apply it.
- Free-shipping saving counts as the campaign saving for budget comparison.
- `null` max-redemption/per-user limits mean unlimited.
- A configured limit introduced later must be enforced against existing redemption history.
- Stackability/conflict rules still determine which candidates may coexist before the cap allocation.
- Cart/qualifying/order-total value qualification intentionally excludes shipping. Existing tests cover `CART_SUBTOTAL` and `ORDER_TOTAL` behavior.
- Product targeting, category/subcategory targeting, tiers, per-product quantity, gifts and BOGO behavior remain supported.

---

## 3. Root Cause and Investigation

## 3.1 Root cause of discount overflow

The calculation previously mixed independent concepts:

- Individual promotion calculations could each be valid by themselves.
- After stacking, no single shared finite merchandise balance consistently capped their combined value.
- Some total formulas treated the complete order total (merchandise plus shipping) as the discountable pool.
- A stale client total could continue toward payment without being reconstructed authoritatively from current products and evaluations.

Therefore, stacked merchandise promotions could exceed merchandise value and consume shipping mathematically.

## 3.2 Related edge cases found

- More than one promotion can apply to one order and to overlapping order lines.
- Duplicate evaluation IDs must not double the discount.
- More than one distinct evaluation ID is ambiguous and is rejected by authoritative pricing.
- The quoted cart and payment cart may contain repeated rows for the same product; quantities must be aggregated before comparison.
- V2 auto-added gifts have customer value but must not be counted as a cash reduction of merchandise payable.
- `FREE_ITEM` with fulfilment `DISCOUNT_EXISTING` does reduce merchandise payable.
- Currency fractions require paise-level rounding and exact allocation.
- A completely discounted merchandise subtotal still owes standard shipping unless free shipping applies.
- A completely covered checkout must not be sent to PhonePe with amount zero.
- Wallet/coupon credit must be capped at the remaining payable amount.

## 3.3 V2 evaluation cancellation investigation

Log and DB analysis established:

- `POST /v2/promotions/quote` returned 200 with a 15-minute expiry.
- The quote had zero applied promotions and one rejected candidate for the ₹80 scenario.
- Ecom also initiated the legacy automatic evaluator.
- `PromotionEvaluationService.createAutomaticEvaluation()` called `cancelAllActiveEvaluationsForUser()` and cancelled every active row for the customer, including the V2 row.
- Later `POST /v2/promotions/quote/:id/validate` encountered a cancelled row.
- `PromotionsV2Service.requoteEvaluation()` reported inactive and expired through one generic error, producing a misleading 500.

The fix preserves V2 evaluations during legacy cleanup, avoids concurrent legacy evaluation unless V2 fails, and avoids carrying a zero-benefit evaluation into checkout.

## 3.4 PhonePe UAT red network requests

During successful Ecom payment, Chrome showed red `details`, `batch`, and `validate` requests on the hosted PhonePe UAT page. Evidence:

- Request host was `api-preprod.phonepe.com`.
- Page host was `mercury-uat.phonepe.com`.
- Initiator was PhonePe's `service-core...js` bundle.
- PhonePe `pay` and `status` calls returned 200.
- Payment succeeded and the Nivaana order was created.
- No corresponding Nivaana server failures were present.

Conclusion: these were provider-hosted UAT UI/telemetry/payment-method requests, not Nivaana API failures. Do not change Nivaana code solely to remove those requests. Escalate only if PhonePe `pay`/`status`, redirect, payment completion, or order creation fails.

## 3.5 Root cause of the multi-line ₹100 → ₹70 allocation defect

The shared merchandise cap itself was working, but `allocateAmount()` used two different bases:

- `remainder` was correctly capped to the eligible subtotal;
- proportional allocation for non-final lines incorrectly continued to use the original, oversized promotion amount.

Confirmed failing example:

```text
Eligible lines:       ₹40 + ₹40 = ₹80
Fixed promotion:      ₹100
Capped remainder:     ₹80

Old first allocation: ₹100 × ₹40 / ₹80 = ₹50
Old final allocation: remaining ₹30
Later line cap:        ₹50 became ₹40
Recorded total:        ₹40 + ₹30 = ₹70
```

The ₹10 removed from the first line was never redistributed. With the stackable 10% promotion active, the same defect produced ₹70 from `NIV 100` plus ₹4 from the percentage promotion, for a total of ₹74.

The fix uses the capped `distributableTotal` for both proportional allocation and remainder handling, and independently caps each adjustment to its line value. The corrected result is:

```text
Merchandise subtotal: ₹80
NIV 100:             -₹80
Shipping:             ₹150
Final payable:        ₹150
```

When `NIV 100` and 10% are both active and stackable, the current best-customer-value strategy applies `NIV 100` for ₹80. The 10% candidate receives ₹0 because no merchandise balance remains, so it is not returned as an applied promotion.

## 3.6 Priority behavior confirmed

Promotion allocation is currently **best customer saving first**, not admin-priority first:

1. larger candidate saving;
2. higher numeric priority only when savings tie;
3. promotion ID as the final deterministic tie-breaker.

## 3.7 Mobile post-payment cart retention and zombie sync defect

During manual verification of mobile order 138, the payment succeeded, the order was confirmed, and the app navigated to `MyOrders`, but the purchased items remained in the mobile cart.

Investigation established a dual-mechanism root cause:

1. **Deep Link Bypass:** PhonePe's return URL on mobile is `nivaana://Main/ProfileTab/MyOrders`. When the return occurred, React Navigation's global deep-link handler in `AppNavigator.tsx` caught the URL and navigated the user directly to `MyOrdersScreen`. This bypassed the in-screen payment WebView completion handler (`completeSuccessFlow` / `useCartPayment.handleSuccessfulPayment`), so `clearCart()` was never called from the payment screen.
2. **Local Storage Leak & Zombie Sync:** In `PersistentCartContext.tsx`, `clearCart()` was previously structured so that `localStorageService.clearCart()` was executed only in the `catch` block (when the server failed). On server success, local storage (`@vibrant_life_cart`) retained the cart items. When the app resumed or came to foreground, `AppState` triggered `checkAndSyncIfNeeded() -> syncWithServer()`. Finding the items in local storage but missing from the database (since PhonePe order creation had already deleted them), `syncWithServer()` assumed they were new offline items and re-added them to the server cart via `cartWishlistService.addToCart()`.

Database logs confirmed that right after order 138 deleted cart IDs `473, 474, 475`, the mobile app re-inserted the purchased products back into the server cart as new IDs `479, 480`.

---

## 4. Implementation Plan and Rationale

> **Related next scope:** Before changing standalone coupon, direct-code, or wallet behaviour, read [COUPON_WALLET_CHECKOUT_IMPLEMENTATION_PLAN.md](./COUPON_WALLET_CHECKOUT_IMPLEMENTATION_PLAN.md). It defines the approved customer-facing rules, source-aware wallet treatment, affected modules, implementation phases, and the balance scenarios to run after implementation.

The agreed implementation was split into four phases.

### Phase 1 — Cap promotion evaluation

- Add a reusable legacy cap that consumes a finite merchandise balance.
- Add a V2 post-optimisation allocation pass with per-line merchandise balances and a separate shipping balance.
- Keep promotion breakdown allocations consistent with capped totals.
- Preserve free-product and free-shipping non-monetary behavior.

Why: preventing overflow at evaluation time keeps UI, persisted evaluations and later redemption data internally consistent.

### Phase 2 — Make backend checkout authoritative

- Reprice merchandise using current database products.
- Reconstruct totals from the persisted evaluation rather than accepting client arithmetic.
- Validate cart quantities and shipping snapshot.
- Block stale totals with a structured 409 response.
- Apply wallet only after promotion pricing.
- Complete zero-payment orders without PhonePe.
- Persist authoritative pricing into transaction and order creation.

Why: frontend caps alone are not a security or accounting boundary. Both Ecom and Mobile must pass through one server authority.

### Phase 3 — Integrate Ecom and Mobile

- Handle `CHECKOUT_TOTAL_CHANGED` and refresh/recover instead of paying stale totals.
- Handle backend-completed `promotion` or `wallet` orders without opening PhonePe.
- Preserve each client's existing successful navigation behavior.

Why: server rejection is only useful if clients recover clearly and do not create confusing payment behavior.

### Phase 4 — Manual end-to-end verification

- Execute the full matrix in section 7/8 against the deployed SIT versions of Backend, Ecom and Mobile.
- Verify UI totals, submitted payload, backend transaction snapshot, order header, order lines, redemptions, wallet entries and navigation.

Why: automated arithmetic coverage cannot prove deployed promotion configuration, browser/app state, PhonePe UAT behavior, or database persistence across all four apps.

---

## 5. Implementation Completed

## 5.1 Legacy promotion cap

New files:

- `asset-management-backend/src/utils/promotionDiscountCap.ts`
- `asset-management-backend/src/utils/promotionDiscountCap.test.ts`

Key behavior:

- `capLegacyMerchandisePromotions()` maintains a shared remaining merchandise value.
- Shipping promotions are preserved outside that balance.
- Monetary overflow is capped; a promotion with no remaining monetary value is removed.
- `FREE_PRODUCT` with zero cash value remains present as a non-monetary benefit.
- Proportional line breakdowns are recalculated to match the capped total exactly at cent precision.
- `sumLegacyMerchandiseDiscounts()` excludes shipping promotions.

Integrated into `asset-management-backend/src/services/promotion-evaluation.service.ts` for:

- general legacy discount calculations;
- adding/updating manual promotions;
- automatic evaluation creation;
- recombining manual and automatic promotions;
- code-entry/coupon promotion updates;
- persisted evaluation totals and breakdowns.

## 5.2 V2 cap and separated totals

Modified:

- `asset-management-backend/src/services/promotion-v2-engine.ts`
- `asset-management-backend/tests/promotionV2Engine.test.ts`

Key logic:

- `capSelectedCandidates()` runs after compatibility optimisation.
- Merchandise adjustments consume the remaining balance of their affected cart/product line.
- Shipping adjustments consume only `remainingShipping`.
- Auto-added gifts are retained without reducing merchandise payable.
- Public quote response exposes separated merchandise/shipping totals.
- Qualification metrics `CART_SUBTOTAL` and `ORDER_TOTAL` exclude shipping.
- Positive configured budget is checked against the complete candidate saving; insufficient budget rejects the campaign.
- `allocateAmount()` now derives all proportional allocations from the already capped `distributableTotal`, rather than the original oversized benefit value.
- Each allocated line amount is capped to both the remaining distributable amount and that line's value.
- This fixes oversized fixed promotions across multiple cart lines without changing ordinary below-subtotal proportional allocation.
- For an ₹80 two-line cart, a ₹100 fixed offer now applies exactly ₹80; standard ₹150 shipping remains independent.

New regression coverage specifically verifies:

- ₹100 fixed discount against two separate ₹40 lines applies ₹40 + ₹40;
- ₹100 plus a stackable 10% offer cannot exceed the ₹80 merchandise subtotal;
- only `NIV 100` remains applied when it consumes the complete merchandise balance;
- a normal ₹50 discount across ₹30 and ₹50 lines remains proportionally allocated as ₹18.75 and ₹31.25;
- shipping is not consumed by merchandise discount overflow.

## 5.3 Authoritative checkout pricing

New files:

- `asset-management-backend/src/utils/checkoutPricing.ts`
- `asset-management-backend/src/utils/checkoutPricing.test.ts`

Modified:

- `asset-management-backend/src/controllers/phonepe.controller.ts`
- `asset-management-backend/src/routes/phonepe.route.ts`
- wallet tests in `src/utils/walletRedemptionPolicy.test.ts` and `src/utils/walletCancellation.test.ts`

Key logic:

- `STANDARD_CHECKOUT_SHIPPING_AMOUNT = 150`.
- No evaluation means current merchandise plus ₹150 shipping.
- Duplicate references to the same evaluation are deduplicated.
- Multiple distinct evaluation IDs produce `PROMOTION_EVALUATION_CONFLICT`.
- Evaluation cart product quantities must match payment order quantities.
- V2 merchandise and shipping snapshots must match the server's current subtotal/shipping.
- Legacy promotions are deduplicated and capped.
- Submitted pre-wallet amount must match authoritative amount to the paise.
- Mismatch response is `409 CHECKOUT_TOTAL_CHANGED` with submitted, expected and pricing values.
- Wallet eligibility base becomes authoritative merchandise subtotal.
- Wallet is capped to the remaining post-promotion payable amount.
- Promotion-only and wallet-only orders use `completeWithoutExternalPayment()`.
- Transaction data stores `checkout_pricing` for later order creation.
- Order creation uses that snapshot and retains a line-level non-negative safeguard.
- Route schema accepts transaction amount zero only for internally covered checkouts.

## 5.4 Ecom and Mobile integration

Ecom modified:

- `Nivaana-Ecom-Web/src/pages/Cart.tsx`
- `Nivaana-Ecom-Web/src/pages/Checkout.tsx`
- `Nivaana-Ecom-Web/src/services/apiService.ts`
- `Nivaana-Ecom-Web/src/services/paymentService.ts`

Implemented:

- Structured 409 error fields.
- Pricing/internal-payment response typing.
- Checkout query invalidation and user message for total changes.
- Direct confirmation for backend-created orders.
- V2 canonical quote with legacy evaluator fallback only when V2 errors.
- No validation/payment attachment for zero-benefit V2 evaluations.

Mobile modified:

- `Vibrant-Life-mobile-app/src/api/services/paymentService.ts`
- `Vibrant-Life-mobile-app/src/screens/cart/CartScreen.tsx`
- `Vibrant-Life-mobile-app/src/screens/cart/CheckoutScreen.tsx`
- `Vibrant-Life-mobile-app/src/screens/cart/hooks/useCartPayment.ts`

Implemented:

- `evaluation_ids` and authoritative pricing/internal-mode response typing.
- `CHECKOUT_TOTAL_CHANGED` messaging/recovery.
- Promotion-covered and wallet-covered orders navigate to My Orders without opening the PhonePe WebView.

The current changes in Mobile `src/api/config.ts`, `package.json`, and `package-lock.json` are not established as part of this promotion-cap defect. Treat them as separate/pre-existing work unless proven otherwise.

## 5.5 V2/legacy evaluation coexistence fix

New files:

- `asset-management-backend/src/utils/promotionEvaluationVersion.ts`
- `asset-management-backend/src/utils/promotionEvaluationVersion.test.ts`

Modified:

- `asset-management-backend/src/services/promotion-evaluation.service.ts`
- `asset-management-backend/src/services/promotions-v2.service.ts`
- Ecom `Cart.tsx` and `Checkout.tsx`

Implemented:

- Legacy automatic cleanup can preserve evaluations whose context has `schema_version: 2`.
- Legacy automatic creation now calls cleanup with `{ preserveV2: true }`.
- V2 inactive evaluation returns status 409 with code `PROMOTION_EVALUATION_INACTIVE`.
- V2 true expiry returns status 409 with code `PROMOTION_EVALUATION_EXPIRED`.
- Ecom does not run legacy automatic evaluation in parallel with a working V2 quote.
- Ecom does not validate or attach zero-benefit quotes and clears a stale stored V2 evaluation ID.

## 5.7 Mobile post-payment cart clearance fix

Modified:

- `Vibrant-Life-mobile-app/src/contexts/PersistentCartContext.tsx`
- `Vibrant-Life-mobile-app/src/screens/profile/MyOrdersScreen.tsx`

Implemented:

- `PersistentCartContext.clearCart()` now unconditionally clears both `localStorageService` (AsyncStorage `@vibrant_life_cart`) and in-memory `cartItems` state, regardless of whether the server call succeeded or was offline. This eliminates the storage leak where local storage retained deleted cart items on the happy path.
- `MyOrdersScreen` now hooks into `useFocusEffect` to inspect `AsyncStorage.getItem("pendingOrder")`. The sentinel only proves that PhonePe was opened, so the screen calls `GET /v1/phonepe/status/:merchantTransactionId` before changing the cart.
- The cart is cleared only when the backend reports `PAYMENT_SUCCESS` and confirms order reconciliation with an order ID and status `success` or `already_exists`; My Orders is then refreshed so the reconciled order appears immediately.
- Explicit failed, declined, cancelled, expired, or transaction-not-found results remove only the stale `pendingOrder` sentinel and retain the cart for retry. Pending, unknown, and network-error results retain both the cart and sentinel for later reconciliation.
- An in-flight guard prevents duplicate reconciliation calls if focus effects are recreated while the first status request is running.
- This surgical fix specifically resolves the post-checkout deep link flow without modifying guest cart migration on login or long-term cart storage for authenticated browsing.
- Mobile TypeScript compilation (`npx tsc --noEmit`) passes with 0 errors.

## 5.8 Fully discounted ₹0 checkout submission & payment timeout resilience

Modified:

- `Nivaana-Ecom-Web/src/pages/Checkout.tsx`
- `Nivaana-Ecom-Web/src/services/apiService.ts`
- `Nivaana-Ecom-Web/src/services/paymentService.ts`
- `Vibrant-Life-mobile-app/src/api/services/paymentService.ts`
- `Vibrant-Life-mobile-app/src/utils/paymentHandler.ts`

Implemented:

- **₹0 Checkout Submission**:
  - Web `Checkout.tsx`: Updated payment button disable condition from `finalCheckoutTotal <= 0` to `finalCheckoutTotal < 0`, properly allowing ₹0 orders covered by 100% promotion + free shipping or wallet balance to be submitted.
  - Mobile `paymentService.ts` & `paymentHandler.ts`: Relaxed input validation from `amount > 0` to `amount >= 0` so internal ₹0 orders proceed cleanly to the backend without throwing validation errors.
  - Verified with Orders 140 (Web) and 141 (Mobile), which completed internally with `mode: 'promotion'`, `orderamount: 0`, and zero PhonePe redirection.
- **Client Payment Timeout Resilience**:
  - `apiService.ts` in Ecom Web previously had a fixed 20-second timeout. With heavy backend transaction logic (orderlines, GST calculation, stock deduction, and email dispatch), local orders took ~35s, causing false client aborts.
  - Added `configOverrides?: Partial<AxiosRequestConfig>` support across `apiService.request`, `get`, `post`, `put`, `delete`.
  - Configured `paymentService.initiate` with an explicit 120-second timeout override to ensure checkout transactions finish reliably.
  - Successfully verified with Web Order 142.

## 5.9 Ecom Web Login UI & OTP Rate-Limiting Cooldown Resilience

Modified:

- `Nivaana-Ecom-Web/src/pages/Login.tsx`
- `Nivaana-Ecom-Web/src/services/apiService.ts`

Implemented:

- **Mobile App Aligned Layout**:
  - Enter OTP field is displayed cleanly adjacent to / below the mobile number field in Step 2.
  - Replaced the separate back navigation link with an elegant inline "Change" button directly inside the mobile field.
  - Preserved requirement that Name is strictly mandatory (`*`, required) only when `requiresName` is true.
  - Displayed Email ID as explicitly `(Optional)` only when `requiresEmail` is true.
  - Enforced a responsive, non-scrollable viewport (`h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden`) keeping the card, inputs, and buttons within view across mobile, tablet, and desktop screens without vertical scrolling.
- **OTP Cooldown & Rate Limiting (HTTP 429)**:
  - Extracted `retryAfter` from API responses in `apiService.ts` (body `retryAfter`, header `Retry-After`, and message text regex matching seconds/minutes).
  - Added live 1-second countdown timer for resend cooldown.
  - On Step 1: Submit button displays `Wait Xs before resending` (disabled) while cooldown is active.
  - On Step 2: Next to the "Enter OTP" label, displays `Resend in Xs` during cooldown, then switches to an active `Resend OTP` button.
  - **Per-Mobile Cooldown Tracking (`cooldownMobile`)**: Cooldown is strictly scoped to the mobile number that requested the OTP. If the user edits or changes to a different mobile number (e.g. from `8942598239` to `8942598231`), the button immediately unlocks to "Send OTP".
  - **Live Dynamic Countdown & Auto-Clear**: The cooldown error message displays live remaining seconds (`Please wait Xs before requesting a new OTP`) and automatically disappears as soon as the timer reaches 0 or the mobile number changes, avoiding stale error messages.

## 5.10 Still pending

- Complete the Phase 4 manual matrix in section 8 on deployed SIT builds.
- Independently inspect orders 132 and 133, their transaction snapshots, order-line promotion allocation, shipping fields, promotion redemptions and wallet activity. Only successful creation was confirmed by the user. Orders 136–142 have been fully inspected.
- Confirm whether generated backend `build/**` changes should be committed in this repository's deployment workflow. The TypeScript build updated many tracked build artifacts.
- Review noisy modified `debug_*.txt` files before committing. They are generated/debug output and are not part of the logical fix.
- Deploy/restart the backend containing the latest `allocateAmount()` fix, then manually repeat the ₹80 multi-line `NIV 100` scenario through Ecom. Existing persisted evaluations retain their old snapshots and are not retroactively rewritten.
- Fix or normalize the V2 redemption timestamp unit used by Inventory history. Order 136/139 rows use epoch seconds while the Inventory date filter expects epoch milliseconds.
- Hide the Priority control in the Inventory promotion create/update UI if it is still visible. Do not delete backend/database priority support.

---

## 6. Test Scenario Catalogue

The following is the required functional matrix, including automated and pending manual cases.

### 6.1 Base and positive cases

| ID | Scenario | Expected result |
|---|---|---|
| P01 | ₹80 merchandise, no promotion | Merchandise ₹80, shipping ₹150, payable ₹230 |
| P02 | ₹100 merchandise, ₹40 fixed promotion | Merchandise payable ₹60, shipping ₹150, payable ₹210 |
| P03 | ₹100 merchandise, 10% promotion | Merchandise discount ₹10; shipping unchanged |
| P04 | Eligible free shipping only | Merchandise unchanged; shipping discount ₹150; shipping payable ₹0 |
| P05 | Full ₹80 merchandise discount, no free shipping | Merchandise payable ₹0; shipping payable ₹150 |
| P06 | Full merchandise discount plus eligible free shipping | Payable ₹0; internal promotion order; no PhonePe |
| P07 | Partial promotion plus partial wallet | Wallet applies only to remaining payable; PhonePe gets final positive remainder |
| P08 | Wallet covers all remaining payable | Internal wallet order; no PhonePe |

### 6.2 Overflow and stacking cases

| ID | Scenario | Expected result |
|---|---|---|
| S01 | ₹80 cart, fixed ₹100 promotion | Applied merchandise discount capped at ₹80; shipping remains ₹150 |
| S02 | ₹80 cart, fixed ₹100 + 10% percentage | `NIV 100` applies ₹80 under current best-value ordering; 10% receives ₹0 and is not shown as applied; shipping remains ₹150 |
| S03 | ₹80 cart, ₹60 + ₹50 + ₹8 stacked | Applied totals become ₹60 + ₹20; third monetary benefit not applied |
| S04 | Same promotion/evaluation ID repeated | Applied once only |
| S05 | Two distinct evaluation IDs | Reject as `PROMOTION_EVALUATION_CONFLICT` |
| S06 | Compatible promotions on different products | Each consumes only its affected line balance |
| S07 | Overlapping category/product promotions | Best-value/priority allocation is deterministic; no line becomes negative |
| S08 | Non-stackable conflict | Existing optimiser/conflict rule remains authoritative |

### 6.3 Coupon and wallet cases

| ID | Scenario | Expected result |
|---|---|---|
| C01 | Code-entry promotion plus auto promotion exceeds subtotal | Both share merchandise cap |
| C02 | Coupon-wallet credit exceeds remaining payable | Quote/reservation capped to remaining payable |
| C03 | Promotion exhausts merchandise but shipping remains | Wallet may cover remaining shipping if wallet policy permits; merchandise promotions cannot |
| C04 | Expired wallet credit | Excluded/rejected according to wallet policy |
| C05 | Wallet balance changes after quote | Consumption rejected and customer must refresh |
| C06 | Wallet reservation expires | Consumption rejected |
| C07 | Cancelled wallet-funded order | Credit restored once to valid original source; repeated cancellation is idempotent |
| C08 | Promotion + coupon + wallet in the same checkout | Combine all merchandise promotions/coupons subject to the merchandise-subtotal cap, then apply wallet only to the remaining payable amount; shipping remains unchanged unless a shipping-specific promotion applies |
| C09 | Promotion + coupon fully consume merchandise, wallet covers shipping | Merchandise discounts stop at merchandise subtotal; wallet may cover the remaining shipping only when wallet policy permits; no discount overflow is converted into shipping discount or wallet credit |

### 6.4 Shipping cases

| ID | Scenario | Expected result |
|---|---|---|
| SH01 | Free shipping threshold ₹100, cart ₹80 | Not eligible; shipping ₹150 |
| SH02 | Free shipping threshold ₹100, cart exactly ₹100 | Eligible if all other rules pass |
| SH03 | Cart over threshold before promotions | Qualification uses merchandise subtotal, never merchandise plus shipping |
| SH04 | Merchandise discount later reduces payable below threshold | Use the engine's established qualification order; do not invent a new post-discount threshold rule |
| SH05 | Oversized shipping adjustment | Cap to shipping amount |
| SH06 | Free shipping with full merchandise discount | Both balances independently reach zero |
| SH07 | Shipping included in cart condition input | Must not help unlock merchandise/order-value promotion |

### 6.5 Cart/evaluation integrity and negative cases

| ID | Scenario | Expected result |
|---|---|---|
| N01 | Quantity changes after quote | `PROMOTION_CART_CHANGED` or `CHECKOUT_TOTAL_CHANGED`; no payment |
| N02 | Product changes after quote | Reject stale evaluation |
| N03 | Current product price changes | Server recalculates and returns `CHECKOUT_TOTAL_CHANGED` |
| N04 | Submitted amount differs by ₹0.01 | Return 409 |
| N05 | Missing evaluation ID | Reject when an ID was submitted but not found |
| N06 | Cancelled V2 evaluation | 409 inactive, not generic 500 |
| N07 | Truly expired V2 evaluation | 409 expired; refresh/requote |
| N08 | Legacy evaluation created while V2 is active | Must not cancel V2 |
| N09 | Zero-benefit V2 quote | Display standard total; do not validate or attach evaluation to payment |
| N10 | Invalid negative discount data | Treat as zero; do not create a negative payable |
| N11 | Zero merchandise subtotal | Monetary promotion cannot create credit or reduce shipping |
| N12 | Stock validation/locking failure | No payment; evaluation/locks handled according to existing rollback behavior |

### 6.6 Budget, usage and eligibility cases

| ID | Scenario | Expected result |
|---|---|---|
| L01 | Budget null/0, limits null | Unlimited subject to normal eligibility |
| L02 | Positive budget exactly equals required saving | Promotion applies |
| L03 | Remaining budget below required saving | Reject `BUDGET_EXHAUSTED`; no partial application |
| L04 | Free-shipping saving exceeds remaining budget | Reject campaign |
| L05 | `max_redemptions` reached | Reject `USAGE_LIMIT_REACHED` |
| L06 | `per_user_limit` reached | Reject for that customer |
| L07 | Admin adds a lower limit after historical usage already exceeds it | Subsequent use rejected; historical orders unchanged |
| L08 | Wrong channel | Reject `CHANNEL_NOT_ELIGIBLE` |
| L09 | Customer/group assignment mismatch | Reject `CUSTOMER_NOT_ELIGIBLE` |
| L10 | Guest previews public authenticated offer | Informational only; authenticate and re-evaluate before checkout |

### 6.7 Gift and boundary cases

- Auto-added free gift must not reduce cash merchandise payable.
- `DISCOUNT_EXISTING` free-item adjustment must consume merchandise balance.
- BOGO paid/free quantities and repetition caps must remain correct.
- Fractional amounts must round to paise.
- Proportional line allocation must sum exactly to the capped promotion total.
- Cart with repeated rows for the same product must compare correctly after quantity aggregation.
- More than 100 active candidates must preserve deterministic best-value selection.

### 6.8 PhonePe payment outcome cases

| ID | Scenario | Expected result |
|---|---|---|
| PP01 | Positive payable and successful PhonePe payment | Exactly one successful transaction and one order are created; pricing snapshot, order totals, lines, shipping, promotion redemption and wallet consumption reconcile |
| PP02 | PhonePe payment fails | No successful order is created from the failed transaction; promotions, limits, budget and wallet must not be permanently consumed; the client shows a recoverable failure state |
| PP03 | Customer cancels PhonePe payment | No successful order is created; reserved wallet value is released/restored exactly once where applicable; retry remains possible without duplicate consumption |
| PP04 | PhonePe remains pending or return is interrupted | Do not create a duplicate order; status reconciliation remains authoritative and a later success produces at most one order |
| PP05 | Successful callback/status is delivered more than once | Processing is idempotent: one transaction result, one order, one set of redemptions and one wallet consumption |
| PP06 | Payment succeeds but client redirect is interrupted | Server-side order remains valid; Ecom/Mobile can recover by refreshing payment/order status without initiating another charge |

### 6.9 Mandatory client coverage matrix

The following scenarios must be executed end-to-end on **both Ecom and Mobile**. Backend unit coverage alone is not sufficient for Phase 4 completion.

| Required scenario | Ecom | Mobile |
|---|---:|---:|
| Normal order without promotions | Required | Required |
| Fixed promotion | Required | Required |
| Percentage promotion | Required | Required |
| Multiple promotions | Required | Required |
| Promotion + coupon | Required | Required |
| Promotion + coupon + wallet | Required | Required |
| Discounts attempting to exceed merchandise subtotal | Required | Required |
| Free shipping below threshold | Required | Required |
| Free shipping exactly at threshold | Required | Required |
| Free shipping above threshold | Required | Required |
| Wallet partially covers payable | Required | Required |
| Wallet fully covers payable | Required | Required |
| Fully discounted ₹0 order | Required | Required |
| Quantity changes after evaluation | Required | Required |
| Promotion expires before payment | Required | Required |
| Promotion reaches budget/overall/per-user limit before payment | Required | Required |
| Successful PhonePe payment | Required | Required |
| Failed PhonePe payment | Required | Required |
| Cancelled PhonePe payment | Required | Required |
| Persisted order/header/line/shipping/wallet/redemption reconciliation | Required | Required |
| Post-payment destination | Checkout confirmation | My Orders, refreshed with latest order |

For every row, record the evaluation ID, merchant transaction ID when applicable, order ID, request/response totals, expected result, actual result and pass/fail status. A row is not complete merely because the UI looks correct.

---

## 7. Testing Already Performed

## 7.1 Automated backend verification

Command:

```bash
cd asset-management-backend
npm test
```

Result:

```text
tests: 268
pass: 268
fail: 0
```

The focused promotion command also passed:

```bash
npx tsx --test tests/promotionV2Engine.test.ts
```

```text
tests: 26
pass: 26
fail: 0
```

Relevant passing coverage includes:

- stacked V2 merchandise cap;
- free shipping separate from fully discounted merchandise;
- legacy free shipping plus merchandise promotion;
- shipping excluded from value qualification;
- fixed discount scoped to selected products;
- overlapping candidate allocation;
- budget insufficient/exact boundary;
- deterministic ordering and 100+ promotions;
- standard shipping with no promotion;
- legacy and V2 oversized independent caps;
- stale cart/shipping rejection;
- duplicate evaluation ID handling;
- paise-level submitted-amount comparison;
- free-gift cash-treatment distinction;
- wallet post-promotion cap, reservation expiry and balance changes;
- cancellation restoration/idempotency;
- V2 context recognition and legacy cleanup preserving V2 rows.
- oversized fixed promotion across multiple separate cart lines;
- stacked oversized fixed plus percentage promotion capped to the merchandise subtotal;
- normal below-subtotal proportional allocation remains unchanged.

## 7.2 Build/schema verification

Backend:

```bash
npm run build -- --pretty false
npx prisma validate
```

Both passed.

Ecom:

```bash
npm run build
```

Passed TypeScript and Vite production build. Vite emitted only the existing large-chunk warning; it did not fail.

Mobile:

```bash
cd Vibrant-Life-mobile-app
npx tsc --noEmit
```

Passed TypeScript check with 0 errors.

## 7.3 Manual observations and results

| Scenario | Input/evidence | Expected | Actual | Status |
|---|---|---|---|---|
| Historical overflow reproduction | Cart ₹80, promotion ₹88, shipping ₹150 | Promotion capped to ₹80; payable ₹150 | Old UI showed ₹142 | **Fail before fix / defect confirmed** |
| No applicable free shipping | Cart ₹80; only active offer was free shipping over threshold | Shipping ₹150; total ₹230; no offer applied | Cart UI showed ₹80 + ₹150 = ₹230 | **Pass display** |
| No-benefit checkout, first attempt | Same ₹80 scenario | Checkout continues without promotion | Misleading 500 “Promotion evaluation has expired” | **Fail; separate defect found** |
| V2 expiry investigation | Evaluation timestamps and DB status | Evaluation active for 15 minutes | Legacy request cancelled it after ~11 seconds | **Root cause confirmed** |
| Ecom order placement after current work | User reported order ID 132 | Successful single order | Order created | **Pass smoke test** |
| Mobile order placement after current work | User reported order ID 133 | Successful single order | Order created | **Pass smoke test** |
| PhonePe hosted UAT network | Red provider `details`/`batch`/`validate`; `pay` and `status` 200 | Payment/order unaffected | Payment succeeded and order created | **Pass; provider noise, no Nivaana failure** |
| Ecom order 136 | Internal ID 136 / `NIVAANA-0000000367`; merchandise ₹598; promotion ₹159.80; free shipping ₹150 | Order and three redemptions persisted | Order is `payment_completed`; three redemption rows exist for ₹59.80, ₹100 and ₹150 | **Pass persistence; Inventory date-filter display pending** |
| Mobile order 137 | Internal ID 137 / `NIVAANA-0000000368`; merchandise ₹299; promotion ₹129.90; free shipping ₹150 | Order and three redemptions persisted | Order is `payment_completed`; three redemption rows exist for ₹100, ₹29.90 and ₹150 | **Pass** |
| Oversized fixed V2 unit case | Two ₹40 lines; `NIV 100`; ₹150 shipping | Promotion ₹80; payable ₹150 | Automated quote produced promotion ₹80 and payable ₹150 | **Pass automated; deployed manual retest pending** |
| Oversized fixed plus percentage V2 unit case | Two ₹40 lines; `NIV 100` plus stackable 10%; ₹150 shipping | Combined merchandise discount ₹80; only positive applied benefit shown | Automated quote applied only `NIV 100` for ₹80; payable ₹150 | **Pass automated; deployed manual retest pending** |
| Mobile order 138 (Above-threshold Free Shipping) | Internal ID 138 / `NIVAANA-0000000369`; cart ₹110; `NIV 100` + Free Shipping | Merchandise ₹110 - ₹100 = ₹10; shipping ₹150 - ₹150 = ₹0; payable ₹10 | Paid ₹10 via PhonePe; order lines reconciled (4.55+4.55+0.90=10); redemptions recorded for ₹100 & ₹150 | **Pass pricing/order; cart clearance bug found & fixed** |
| Ecom order 139 (Above-threshold Free Shipping) | Internal ID 139 / `NIVAANA-0000000370`; cart ₹110; `NIV 100` + Free Shipping | Merchandise ₹110 - ₹100 = ₹10; shipping ₹150 - ₹150 = ₹0; payable ₹10 | Paid ₹10 via PhonePe; order lines reconciled (0.90+4.50+4.60=10); redemptions recorded for ₹100 & ₹150 | **Pass; cart cleared cleanly** |
| Mobile post-payment cart retention fix | Deep link return to `MyOrdersScreen` with `pendingOrder` sentinel | Confirm backend payment/order outcome; clear cart only for a successfully reconciled order; retain cart for pending/failure/cancellation | Unconditional local storage clear in `PersistentCartContext.clearCart()` + status-verified `MyOrdersScreen` focus handler | **Fixed in working tree; manual success/failure/pending verification required** |
| Fully discounted ₹0 checkout client submission fix | Payable ₹0 due to promotions covering merchandise + free shipping | Button enabled and request submitted to PhonePe initiate; backend completes order internally without gateway | Web `Checkout.tsx` disabled check updated (`finalCheckoutTotal < 0`); Mobile `paymentService.ts` & `paymentHandler.ts` validation updated to allow `amount === 0` | **Fixed in working tree** |
| Fully discounted ₹0 test (Web order 140 & Mobile order 141) | Internal ID 140 (Web) & 141 (Mobile); cart ₹100; `NIV 100` + Free Shipping | Merchandise ₹100 - ₹100 = ₹0; shipping ₹150 - ₹150 = ₹0; payable ₹0 | Orders created with `mode: 'promotion'`, `orderamount: 0`, and redemptions for ₹100 & ₹150; completed without external PhonePe call | **Pass** |
| Web order 142 payment initiate timeout resilience | Internal ID 142 (Web) took ~35s locally due to orderlines/GST/stock updates; Web client 20s timeout triggered before response arrived | Web client should wait for server finalization without aborting | Added `configOverrides` to `apiService.ts` and set 120s timeout exclusively for `paymentService.initiate` | **Fixed in working tree** |
| Web Login UI layout & non-scrollable screen | Form with mobile, OTP, name, email on desktop/mobile screens | Form fits in visible area without vertical scrolling; Enter OTP beside/below mobile; inline Change button | Implemented `h-[calc(100dvh-4rem)] overflow-hidden`, compact grid, and inline Change button | **Pass** |
| Web Login OTP resend cooldown & rate-limit handling | User requests OTP repeatedly within 60s cooldown; backend returns HTTP 429 | Live countdown timer (`Resend in Xs` / `Wait Xs before resending`); submit disabled during cooldown; unlocks immediately if mobile number changed; message auto-clears on expiry | Implemented per-mobile cooldown `cooldownMobile`, live `resendTimer` interval, and dynamic `displayMessage` auto-clear in `Login.tsx` | **Pass** |

Order 136 redemption-history finding:

- The rows are not missing from the database.
- V2 checkout stored `redeemed_at` as epoch seconds (`1790423402`).
- Mobile/legacy order 137 stored epoch milliseconds (`1790423615132`).
- Inventory date filtering and sorting use milliseconds without normalization.
- Consequently, filtering from `26/09/2026` excludes order 136 as though its redemption date were in 1970.

Unknown/not verified from the manual report:

- Exact promotion IDs, coupon assignment, wallet contribution, shipping value and transaction pricing snapshots for orders 132 and 133.
- Whether every scenario in section 6 has been executed end-to-end on both clients.
- Whether Inventory redemption history and order detail allocation display these two orders exactly as expected.

---

## 8. Pending Phase 4 Testing

Run the following before declaring the work fully complete:

1. Execute the complete mandatory client matrix in section 6.9 on deployed SIT for both Ecom `DEV-NEW` and Mobile `expo_rn_migrations_v2`. Do not limit client testing to a smaller smoke-test subset.
2. At minimum, map each execution back to P01-P08, S01-S08, C01-C09, SH01-SH07, N01-N12, L01-L10 and PP01-PP06 as applicable. Backend-only cases may remain automated where they cannot be reliably induced through a client, but every customer-visible outcome in section 6.9 must be demonstrated on both clients.
3. For each placed order verify in the database/API:
   - transaction amount sent to PhonePe;
   - `transactiondata.checkout_pricing`;
   - `orders.orderamount`/shipping/promotion totals;
   - sum of order-line merchandise discounts;
   - sum of order-line shipping allocation;
   - no negative order-line amount;
   - promotion redemption amount and budget consumption;
   - wallet reservation/consumption amount;
   - exactly one order for one successful transaction.
4. Verify stale cart/price produces 409 and neither client proceeds to PhonePe.
5. Verify a genuinely expired evaluation refreshes cleanly and is not shown as a server 500.
6. Verify a fresh V2 quote remains active even if any legacy recommendation/offer endpoint is called.
7. Verify a zero-benefit quote does not appear in the payment payload's `evaluation_ids`.
8. Verify free-shipping threshold with ₹99.99, exactly ₹100, and ₹100.01 if the configured rule uses ₹100.
9. Verify configured budget boundary and usage limits using new test promotions, so existing redemption history does not make the results ambiguous.
10. Verify promotion-only, wallet-only and promotion + coupon + wallet orders navigate correctly:
    - Ecom → checkout confirmation;
    - Mobile → My Orders with refresh.
11. Verify PhonePe UAT with a positive remainder for successful, failed and customer-cancelled outcomes. Ignore provider-internal red telemetry requests only when their host/initiator is PhonePe and the authoritative `pay`/`status`, return navigation and resulting order state are correct.
12. Verify failure and cancellation do not create a successful order, consume promotion usage/budget, or permanently consume wallet credit. Verify retry and repeated callback/status handling are idempotent.
13. After deploying the latest backend, repeat the exact ₹80 two-product test with only `NIV 100` active. Expect promotion ₹80, merchandise payable ₹0, shipping ₹150 and final payable ₹150.
14. Repeat with `NIV 100` and the stackable 10% promotion active. Expect the combined merchandise discount to remain ₹80 and only promotions with a positive allocated saving to appear as applied.
15. Verify Inventory redemption history for a newly created Web/V2 order after timestamp normalization; test with and without a date filter and compare against Mobile history.

Special attention:

- Clear/refresh the cart between scenarios to avoid stale selected-promotion session state.
- Record evaluation ID, merchant transaction ID and order ID for each test.
- For failed/cancelled attempts where no order should exist, explicitly record `order ID: none` and verify that absence through the backend/database rather than assuming it from the screen.
- Use server logs and transaction snapshots, not UI alone, to validate authoritative values.
- Test exact boundary values and one-paise differences.

---

## 9. Important Context / Do Not Change

1. **Do not allow shipping into the merchandise discount pool in any case.**
2. **Do not reduce ₹150 shipping because merchandise promotions overflowed.** Only a shipping-specific promotion may do that.
3. **Do not trust the frontend transaction total as authoritative.** Preserve server repricing and the 409 mismatch boundary.
4. **Do not apply wallet before promotion checkout pricing.** Wallet must be capped against post-promotion payable.
5. **Do not send a zero amount to PhonePe.** Preserve internal `promotion`/`wallet` completion.
6. **Do not count auto-added gift list value as cash merchandise discount.**
7. **Do not re-enable the legacy automatic evaluator in parallel with a successful V2 quote.** It previously cancelled the V2 evaluation.
8. **Do not persist or submit guest preview evaluations as authenticated checkout authority.** Re-evaluate after login.
9. **Do not attach a zero-benefit evaluation to payment.** Standard checkout does not need one.
10. **Do not alter tax breakdown logic as part of this issue.** Tax display/calculation was explicitly retained in earlier order-detail work and is outside this defect unless a separate verified tax inconsistency is found.
11. **Do not change payment return behavior unnecessarily.** Ecom returns to checkout confirmation; Mobile returns to My Orders through the Nivaana deep link.
12. **Do not interpret PhonePe UAT hosted-page telemetry/CORS errors as backend failures without checking host, initiator, `pay`, `status`, redirect and order result.**
13. **Do not reset dirty worktrees.** There are unrelated and generated changes, especially backend `build/**`, `debug_*.txt`, Mobile dependency/config files, and prior payment work.
14. No new SQL migration was required for the cap or the V2 cancellation fix.
15. **Do not change promotion allocation to admin-priority order without a separate business decision.** Current behavior is best-customer-value first; priority is only a tie-breaker and higher numeric values currently win ties.
16. **Do not retroactively rewrite completed order pricing when fixing quote allocation.** Existing orders/evaluations are historical records; new quotes must use the corrected engine.

Known limitations/dependencies:

- Current standard shipping is hard-coded in authoritative checkout pricing as ₹150. A future configurable shipping service must replace this in one authoritative server location and update quote snapshots/tests together.
- V2 evaluation expiry is 15 minutes by engine default.
- Legacy evaluations/redemptions commonly use epoch milliseconds while V2 rows use epoch seconds. Evaluation validation handles units in relevant paths, but Inventory redemption-history filtering currently does not normalize `redeemed_at`; this is a confirmed pending defect.
- The current deployment contains a legacy-to-V2 bridge for unmigrated automatic promotions. Remove it only after verifying complete migration.

---

## 10. Continuation Instructions for the Next AI Developer

### First actions

1. Read this document completely.
2. Confirm the current branches:

```bash
git -C asset-management-backend branch --show-current
git -C Nivaana-Ecom-Web branch --show-current
git -C Vibrant-Life-mobile-app branch --show-current
```

Expected at handover time: Backend/Ecom `DEV-NEW`, Mobile `expo_rn_migrations_v2`.

3. Inspect all worktrees with `git status --short` and targeted `git diff`. Do not discard anything.
4. Verify the deployed SIT commit actually includes the source changes in sections 5.1–5.5. Local success does not prove deployment.
5. Re-run automated verification before changing logic:

```bash
cd asset-management-backend
npm test
npm run build -- --pretty false
npx prisma validate

cd ../Nivaana-Ecom-Web
npm run build
```

6. Determine and run the Mobile repository's established typecheck/test command without changing dependencies merely to make the check run.

### What to verify before any further code changes

- Reproduce the intended ₹80 + ₹150 no-promotion case on deployed SIT.
- Inspect the browser/app payment payload and confirm no zero-benefit evaluation ID is submitted.
- Inspect the server response pricing and confirm merchandise/shipping separation.
- Test one overflowing stacked promotion scenario and one eligible free-shipping scenario.
- Confirm the overflowing fixed promotion test is using a newly created V2 quote after the backend restart/deployment; do not reuse an old persisted quote snapshot.
- Check transaction and order persistence, not only the rendered total.
- Confirm whether a failure is from Nivaana or the hosted PhonePe domain before modifying code.

### Remaining work

- Continue the approved standalone coupon and wallet checkout plan in `COUPON_WALLET_CHECKOUT_IMPLEMENTATION_PLAN.md` from Phase 6 manual verification. Development Phases 1–5 (backend coupon policy, direct checkout coupon contract, standalone Coupon Wallet Admin simplification, source-aware wallet allocation, Ecom integration, and Mobile integration) are implemented locally. The Phase 1 migration must still be deployed; do not treat the full Web/Mobile balance matrix as complete.
- Ecom Cart Step 1 no longer exposes the obsolete voucher code form that called `/v1/promotions/evaluate`. It continues to show cart offers and estimated savings, with coupon-code guidance directing guests/authenticated customers to Checkout. The working `/v1/coupon-wallet/checkout/quote` direct-coupon flow remains in Checkout and payment initiation remains authoritative.
- Complete and record Phase 4 manual results from section 8.
- Resolve and verify the Inventory redemption timestamp-unit mismatch so Web/V2 redemptions such as order 136 appear under the correct date.
- Hide Inventory's Priority field while retaining backend support, unless the business first defines a new priority-first allocation rule.
- Investigate only scenarios that still fail after confirming the deployed versions.
- If a failure remains, preserve the central invariant by fixing the earliest incorrect source while retaining the server-authoritative safeguard.
- Update this document with exact promotion IDs, request/response payloads, merchant transaction IDs, order IDs and pass/fail evidence for each new test.

### Definition of done

This issue is complete only when:

- no monetary promotion/coupon combination can exceed merchandise subtotal;
- no merchandise discount can reduce shipping;
- free shipping affects only shipping;
- wallet affects only the remaining payable amount;
- stale client totals are blocked;
- zero-payable orders complete without PhonePe;
- Ecom and Mobile both recover from total changes;
- persisted order header, order lines, redemption and wallet records reconcile exactly;
- the full Phase 4 matrix passes on deployed SIT.
