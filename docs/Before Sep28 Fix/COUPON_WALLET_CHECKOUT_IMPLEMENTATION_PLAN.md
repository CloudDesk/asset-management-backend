# Coupon and Wallet Checkout — Approved Business and Implementation Plan

**Prepared:** 27 September 2026

**Status:** Development Phases 1–5 implemented locally; Phase 1 migration deployment and the full Web/Mobile manual balance matrix remain pending

**Applications:** Asset Management Backend, Inventory/Admin, Nivaana Ecom Web, Vibrant Life/Nivaana Mobile

**Related master handover:** [PROMOTION_DISCOUNT_CAP_HANDOVER.md](./PROMOTION_DISCOUNT_CAP_HANDOVER.md)

## Implementation progress

### Phase 1 — Implemented locally on 27 September 2026

Completed in `asset-management-backend`:

- Standalone coupon create/update schemas accept omitted delivery/stacking fields and normalize legacy input to `delivery_channel = "all"` and `stackable = false`.
- `CouponWalletService` enforces the same constants independently of client payloads.
- Shared coupon-use state policy now distinguishes available, scheduled, reserved, claimed, redeemed, expired, inactive, and revoked states.
- Duplicate claim responses are normalized to `COUPON_ALREADY_CLAIMED`; prior direct redemption uses `COUPON_ALREADY_REDEEMED`.
- Wallet claim uses an atomic lock that excludes already used coupons and coupons with an active direct-checkout reservation.
- If another action wins after validation, claim re-reads current state and returns the correct state error.
- Added an idempotent migration that normalizes existing standalone assignments/promotions.
- Added a read-only policy audit command: `npm run coupons:policy:audit`.
- Added policy, normalization, duplicate-claim, reservation, and concurrency tests.

Read-only database audit before applying the migration:

```text
standalone assignments:               18
delivery channel all:                 13
delivery channel web:                  2
delivery channel mobile:               2
delivery channel print:                1
non-compliant assignment channels:     5
non-compliant promotion policies:     11
unclaimed assignments:                 6
claimed assignments:                  12
```

The audit made no database changes. The migration file must be applied through the normal deployment process before the existing records are normalized.

Verification:

```text
Backend tests:       278/278 passed
Focused Phase 1:      15/15 passed
TypeScript build:     passed
Prisma validation:    passed
```

Not part of Phase 1 (current status noted):

- source-aware wallet allocation — completed with Phase 4;
- Inventory/Admin field hiding — completed in Phase 3;
- Ecom integration — completed in Phase 4;
- Mobile integration — completed in Phase 5;
- post-implementation manual balance matrix.

### Phase 2 — Implemented locally on 27 September 2026

Completed in `asset-management-backend`:

- Added authenticated `POST /v1/coupon-wallet/checkout/quote` for one directly entered standalone coupon.
- Quote validation covers customer ownership/account state, standalone coupon identity, channel, assignment/promotion lifecycle and dates, claimed/redeemed/reserved states, minimum merchandise subtotal, assignment/campaign/per-user limits, and configured budget.
- Direct coupon discount is calculated as `min(face value, merchandise remaining after promotions)` and never reduces shipping.
- Added `direct_coupon_discount` to the authoritative checkout pricing snapshot while retaining promotion and shipping allocations separately.
- `POST /v1/phonepe/initiate` accepts only `{ direct_coupon: { code } }`; it does not accept or trust a client coupon amount.
- Payment initiation verifies the authenticated customer matches `transaction.userId`, recalculates the coupon against authoritative product prices and promotion results, atomically reserves the assignment, and records the allocation in transaction data.
- Direct redemption is created only during successful idempotent order reconciliation. It records order, customer, assignment, promotion, voucher code, merchant transaction and the actual capped amount.
- Repeated callback/status reconciliation returns the existing redemption for the same order instead of consuming twice.
- Existing wallet-release paths now also release an unconsumed direct-coupon reservation on initiation failure, failed/cancelled payment, status failure, and lock cleanup.
- Order header/line financial allocation includes the direct coupon merchandise amount; promotion redemption reconciliation still sees promotion-only amounts and is not double counted.
- The standalone coupon automatic-promotion exclusion was not changed.

Phase 2 files:

- `src/services/direct-coupon-checkout.service.ts`
- `src/services/direct-coupon-checkout.service.test.ts`
- `src/schemas/coupon-wallet.schema.ts`
- `src/controllers/coupon-wallet.controller.ts`
- `src/routes/coupon-wallet.route.ts`
- `src/utils/checkoutPricing.ts`
- `src/utils/checkoutPricing.test.ts`
- `src/controllers/phonepe.controller.ts`
- `src/routes/phonepe.route.ts`

Phase 2 focused verification:

```text
Focused Phase 1 + Phase 2 tests: 45/45 passed
Full backend tests:                  286/286 passed
TypeScript build:                  passed
Prisma validation:                  passed
```

The direct-coupon contract is consumed by Ecom Web in Phase 4 and Mobile in Phase 5.

## 1. Outcome and customer experience

This plan is valid for the intended business rules and is designed to keep the customer experience simple:

- A customer can either enter an assigned coupon directly at checkout or add it to the Nivaana wallet for later use.
- The same coupon can provide value only once. It cannot be used directly and also converted into wallet credit.
- Automatic promotions continue to work without customer action.
- A customer-entered coupon is honoured before promotional wallet credit is consumed.
- Promotional discounts never spill into shipping.
- Shipping remains payable unless a shipping-specific promotion, such as `FREE_SHIPPING`, reduces it.
- The UI shows separate Promotion, Coupon, Wallet credit, Shipping, and Total values so the customer can understand the calculation.
- Technical configuration such as delivery channel and stacking is hidden from the standalone coupon form because it should not require an Admin decision.

The customer-facing mental model is:

```text
Offers are applied automatically.
Optionally enter one coupon code.
Optionally use available wallet balance.
Pay the remaining merchandise and shipping amount.
```

## 2. Approved business rules

### 2.1 Coupon creation and availability

For standalone Coupon Wallet coupons:

- New coupons are available on both Ecom Web and Mobile.
- Backend value is always `delivery_channel = "all"`.
- Inventory/Admin must hide **Publish / delivery**.
- Inventory/Admin must hide **Allow stacking**.
- The backend owns these values and must not trust a legacy client to override them.
- Existing standalone coupons with `web`, `mobile`, or `print` must be audited and migrated or normalized to `all`; hiding the field alone is insufficient.
- These rules apply only to the standalone Coupon Wallet module. Do not remove channel or stacking configuration from the general Promotions module.

### 2.2 Coupon use modes are mutually exclusive

An issued coupon assignment can follow only one successful path:

```text
AVAILABLE
  ├─ Direct checkout redemption → REDEEMED
  └─ Add to wallet             → CLAIMED → PARTIALLY_USED / USED
```

Rules:

- If already claimed into wallet, direct checkout use is rejected.
- If already directly redeemed, wallet claim is rejected.
- Preview/check does not consume or reserve the coupon.
- Double-clicking Claim does not create a second credit.
- Concurrent Web and Mobile claims allow only one success.
- Concurrent direct redemption and wallet claim allow only one final success.
- Payment failure or cancellation must not permanently consume a directly entered coupon.
- Payment reconciliation must remain idempotent: one successful payment produces at most one coupon redemption and one order.

Existing claim protection must be retained:

- `CouponWalletService.validateCouponForClaim()` status validation.
- Atomic conditional `updateMany()` in `CouponWalletService.claimCoupon()`.
- Unique database constraint on `wallet_credits.assignment_id`.

### 2.3 Calculation sequence

Approved customer-value sequence:

```text
1. Product/catalogue pricing
2. Eligible automatic and selected promotions
3. One directly entered coupon
4. Eligible promotional wallet credits
5. Shipping after shipping-specific promotions
6. Final payable amount
```

The direct coupon must run before promotional wallet credit. Running wallet first can consume all remaining merchandise value and make the coupon intentionally entered by the customer appear useless.

Authoritative formula:

```text
remaining_merchandise = max(
  0,
  merchandise_subtotal
  - merchandise_promotion_discount
  - direct_coupon_discount
  - promotional_wallet_discount
)

shipping_payable = max(
  0,
  shipping_amount
  - shipping_specific_discount
)

final_payable = remaining_merchandise + shipping_payable
```

Invariants:

```text
promotion + direct coupon + promotional wallet <= merchandise subtotal
shipping-specific discount <= shipping amount
final payable >= 0
```

Example:

```text
Merchandise subtotal           ₹80
Automatic 10% promotion        -₹8
Direct ₹100 coupon             -₹72  (capped to remaining merchandise)
Promotional wallet              ₹0
Standard shipping             +₹150
Final payable                  ₹150
```

### 2.4 Shipping rule

- Fixed, percentage, product, cart, code-entry coupon, and promotional wallet benefits are merchandise-only.
- They must not reduce or offset shipping in any case.
- Only a shipping-specific promotion such as `FREE_SHIPPING` may reduce shipping.
- If merchandise becomes ₹0 and free shipping is not eligible, standard ₹150 shipping remains payable.
- If merchandise and shipping both become ₹0, retain the existing internal order-completion flow and do not send ₹0 to PhonePe.

### 2.5 Promotional credit versus refund credit

The wallet contains different sources and they must not be treated as identical without an explicit business decision:

- `source_type = coupon`: promotional value; merchandise-only.
- `source_type = cancellation_refund` or `return_refund`: customer refund value.

Approved safe implementation rule:

- Restrict coupon-sourced promotional credits to remaining merchandise.
- Preserve the current refund-credit behaviour until the business explicitly decides whether refund money can pay shipping.

Do not globally cap all wallet sources to merchandise, because that could prevent a customer from using their own refund balance for shipping.

### 2.6 Direct coupon count

Initial implementation supports one directly entered coupon code per order.

The order may still contain:

- multiple compatible automatic promotions;
- one direct coupon;
- multiple eligible wallet-credit allocations;
- one or more shipping-specific benefits where existing promotion compatibility permits them.

Supporting multiple directly entered codes is intentionally deferred. It would require a code list, removal controls, deterministic ordering, independent reservation state, and clearer customer messaging.

### 2.7 Minimum-cart conditions

Each coupon or coupon-sourced wallet credit independently checks its own `minimum_cart_amount` against the original eligible merchandise subtotal.

Do not:

- include shipping in the minimum-cart base;
- use the highest minimum as a combined threshold;
- re-evaluate the minimum against the subtotal left after another discount.

Example:

```text
Original merchandise subtotal: ₹120
Coupon A minimum:               ₹100 → eligible
Coupon B minimum:               ₹150 → not eligible
```

Wallet credits continue to be consumed in the established expiry-first order, but only credits that independently satisfy their minimum are eligible.

## 3. Existing implementation relevant to this plan

### 3.1 Backend coupon claim

Primary files:

- `asset-management-backend/src/services/coupon-wallet.service.ts`
- `asset-management-backend/src/schemas/coupon-wallet.schema.ts`
- `asset-management-backend/src/controllers/coupon-wallet.controller.ts`
- `asset-management-backend/src/routes/coupon-wallet.route.ts`
- `asset-management-backend/prisma/schema.prisma`

Current APIs:

- `GET /v1/coupon-wallet/me`
- `GET /v1/coupon-wallet/me/activity`
- `POST /v1/coupon-wallet/preview`
- `POST /v1/coupon-wallet/claim`
- `POST /v1/coupon-wallet/discount/quote`
- Inventory/Admin coupon CRUD under `/v1/coupon-wallet/admin/*`

Current duplicate-claim protection is correct and must not be weakened.

### 3.2 Promotion evaluation

Primary file:

- `asset-management-backend/src/services/promotion-evaluation.service.ts`

`isStandaloneWalletCoupon()` currently excludes standalone private wallet coupons from general automatic promotion evaluation. Retain that exclusion. A private assigned coupon must not appear as a public/automatic promotion.

Direct use must be explicit through a coupon checkout path, not by removing this exclusion globally.

### 3.3 Wallet redemption

Primary file:

- `asset-management-backend/src/services/wallet-redemption.service.ts`

Current quote logic calculates:

```ts
Math.min(eligibleBalance, payableAmount)
```

The current checkout caller may pass a payable amount that includes shipping. That allows wallet value to consume shipping. The implementation must allocate by wallet-credit source and separate merchandise capacity from any permitted refund-credit capacity.

### 3.4 Payment and authoritative pricing

Primary files:

- `asset-management-backend/src/controllers/phonepe.controller.ts`
- `asset-management-backend/src/utils/checkoutPricing.ts`
- payment/order creation and promotion redemption services reached by PhonePe completion and reconciliation

The existing server-authoritative pricing, `CHECKOUT_TOTAL_CHANGED`, ₹0 internal completion, stock locking, PhonePe reconciliation, and idempotent order creation must remain intact.

## 4. Detailed implementation plan

### Phase 1 — Backend coupon policy and state model

1. Update create/update schemas so standalone clients do not have to send `delivery_channel` or `stackable`.
2. Normalize all newly created/updated standalone coupons to the approved backend values.
3. Audit existing standalone assignments by channel and state.
4. Add a migration or controlled SQL update for eligible existing standalone assignments to `delivery_channel = "all"`.
5. Add direct-redemption state checks shared by claim and checkout validation.
6. Normalize duplicate-use errors so both clients can present one friendly message.
7. Add concurrency tests for claim versus claim and claim versus direct redemption.

Expected backend files:

- `src/schemas/coupon-wallet.schema.ts`
- `src/services/coupon-wallet.service.ts`
- `src/controllers/coupon-wallet.controller.ts`
- `src/routes/coupon-wallet.route.ts`
- `prisma/schema.prisma` and/or a new Prisma migration if direct-reservation persistence requires it

### Phase 2 — Direct coupon checkout and authoritative pricing

1. Introduce an explicit direct-coupon checkout quote/apply contract.
2. Require authenticated customer ownership.
3. Validate promotion/assignment state, dates, minimum cart, usage, prior claim, and prior redemption.
4. Calculate the direct discount as:

```text
min(coupon face value, merchandise remaining after promotions)
```

5. Return a structured allocation distinct from promotion and wallet totals.
6. Revalidate/reserve during payment initiation; never trust client discount values.
7. Consume only after successful internal/external order completion.
8. Release or leave usable after failed/cancelled payment.
9. Make callback/status/reconciliation repeated execution idempotent.
10. Record the exact order, customer, coupon assignment, and applied amount.

Do not make standalone wallet coupons automatic by removing `isStandaloneWalletCoupon()` filtering.

### Phase 3 — Inventory/Admin UI — Implemented locally on 27 September 2026

Completed in `asset_management_frontend_aromazen`:

- Removed **Publish / delivery** from standalone Coupon Wallet create and edit forms.
- Removed **Allow stacking** from standalone Coupon Wallet create and edit forms.
- Removed delivery-channel presentation from standalone coupon details.
- Removed `delivery_channel` and `stackable` from the standalone coupon create/update request types and payload construction.
- Retained assignment, customer/group, value, dates, minimum cart, dispatched order reference, and lifecycle status fields.
- Did not change the general Promotions create/update UI or its channel/stacking configuration.
- The response model still accepts the backend's policy fields for compatibility; they are no longer presented as Admin choices.

Phase 3 files:

- `asset_management_frontend_aromazen/src/pages/couponWallet/CouponWalletPage.tsx`
- `asset_management_frontend_aromazen/src/services/couponWalletService.ts`

Verification:

```text
Inventory TypeScript + Vite production build: passed
Standalone Coupon Wallet configurable-field search: no remaining channel/stacking controls or payload references
```

The backend remains authoritative and normalizes every standalone coupon to `delivery_channel = "all"` and `stackable = false`, including requests from older clients.

### Phase 4 — Ecom Web and source-aware wallet allocation — Implemented locally on 27 September 2026

Primary files:

- `Nivaana-Ecom-Web/src/pages/Wallet.tsx`
- `Nivaana-Ecom-Web/src/pages/Cart.tsx`
- `Nivaana-Ecom-Web/src/pages/Checkout.tsx`
- `Nivaana-Ecom-Web/src/services/couponWalletService.ts`
- `Nivaana-Ecom-Web/src/services/paymentService.ts`

Completed Ecom changes:

- Wallet page retains preview then Add to Wallet.
- Direct coupon entry is intentionally available only in Checkout. Cart Step 1 shows automatic/click-to-apply offers plus guidance to apply personal coupon codes at checkout; its obsolete legacy `/promotions/evaluate` voucher-entry path was removed.
- Checkout coupon entry uses direct checkout evaluation, not wallet claim.
- Only one direct code may be active.
- Summary displays Promotion, Coupon, Wallet credit, Shipping, and Total separately.
- Wallet quote uses the correct remaining merchandise capacity.
- Payment remains disabled while the authoritative recalculation is incomplete.
- Preserve cart-to-checkout values during loading to avoid confusing value flashes.
- Map already claimed/redeemed, inactive, expired, future, wrong-customer, and minimum-cart errors to friendly messages.

The direct checkout input sends only `{ direct_coupon: { code } }`; the client never submits a trusted coupon amount. The payment request amount is the authoritative client preview after promotions and the direct coupon but before wallet credit, matching the backend contract. General cart promotions and **Add to Wallet** remain separate flows.

Required backend support completed with this phase:

- `POST /v1/coupon-wallet/discount/quote` accepts optional `merchandise_payable` and `shipping_payable` capacity.
- Coupon-sourced wallet credit is merchandise-only.
- Cancellation/return-refund credit preserves its existing ability to cover merchandise first and then shipping.
- Expiry-first allocation, reservation idempotency, release, cancellation reversal, and old callers without source capacity remain supported.
- PhonePe reservation uses the authoritative checkout snapshot's merchandise and shipping capacities rather than client-derived allocation.
- Source allocation details are returned by source-aware quotes for auditability.

Phase 4 backend files:

- `asset-management-backend/src/schemas/coupon-wallet.schema.ts`
- `asset-management-backend/src/controllers/coupon-wallet.controller.ts`
- `asset-management-backend/src/services/wallet-redemption.service.ts`
- `asset-management-backend/src/controllers/phonepe.controller.ts`
- `asset-management-backend/src/utils/walletRedemptionPolicy.test.ts`

Phase 4 Ecom files:

- `Nivaana-Ecom-Web/src/pages/Wallet.tsx`
- `Nivaana-Ecom-Web/src/pages/Cart.tsx`
- `Nivaana-Ecom-Web/src/pages/Checkout.tsx`
- `Nivaana-Ecom-Web/src/services/couponWalletService.ts`
- `Nivaana-Ecom-Web/src/services/paymentService.ts`

Automated verification:

```text
Backend full tests:                         291/291 passed
Backend TypeScript build:                  passed
Backend Prisma validation:                 passed
Ecom TypeScript + Vite production build:   passed
Ecom targeted ESLint:                      0 errors (existing hook warnings only)
Ecom/backend git diff whitespace check:    passed
```

Manual SIT confirmation of direct coupon and mixed wallet-source scenarios is still pending. No deployment was performed in this phase.

### Phase 5 — Mobile — Implemented locally on 28 September 2026

Primary files:

- `Vibrant-Life-mobile-app/src/api/services/couponWalletService.ts`
- `Vibrant-Life-mobile-app/src/screens/wallet/WalletScreen.tsx`
- `Vibrant-Life-mobile-app/src/screens/cart/CartScreen.tsx`
- `Vibrant-Life-mobile-app/src/screens/cart/steps/PaymentStep.tsx`
- `Vibrant-Life-mobile-app/src/screens/cart/components/CartSummary.tsx`
- Mobile payment request service/hook used by `CartScreen`

Completed Mobile changes:

- Direct coupon and Add to Wallet are separate actions.
- One direct coupon per order.
- Checkout code entry calls `POST /v1/coupon-wallet/checkout/quote` with `channel: "mobile"`; it no longer routes a typed standalone coupon through the general promotion evaluator.
- Payment sends only `direct_coupon: { code }`; Mobile never submits a trusted coupon discount amount.
- Direct coupon is capped by the merchandise amount remaining after product/general promotions and cannot reduce shipping.
- Wallet quote sends authoritative merchandise/shipping capacity to `POST /v1/coupon-wallet/discount/quote`.
- Coupon-sourced wallet credit cannot reduce shipping; applicable wallet amount is displayed before the customer applies it.
- Summary shows Promotion, Coupon, Wallet credit, Shipping, and final Total separately; the displayed cart amount includes the direct coupon reduction.
- Payment is disabled while promotions, coupon, or wallet pricing is being confirmed.
- Direct coupon failures (ownership, lifecycle, claim/redemption, minimum cart, limits, budget, reservation, and quote changes) use customer-friendly messages.
- Wallet claim maps the already-redeemed state to a clear customer message.
- Successful internal and external order paths clear direct-coupon state with existing cart/evaluation cleanup.
- The PhonePe pending-order amount now stores the final external payable after coupon and wallet.

Phase 5 files:

- `Vibrant-Life-mobile-app/src/api/services/couponWalletService.ts`
- `Vibrant-Life-mobile-app/src/api/services/paymentService.ts`
- `Vibrant-Life-mobile-app/src/screens/wallet/WalletScreen.tsx`
- `Vibrant-Life-mobile-app/src/screens/cart/CartScreen.tsx`
- `Vibrant-Life-mobile-app/src/screens/cart/steps/PaymentStep.tsx`
- `Vibrant-Life-mobile-app/src/screens/cart/components/CartSummary.tsx`

Automated verification:

```text
Mobile TypeScript (`npx tsc --noEmit`): passed
Mobile Jest suite:                       1/1 passed
Mobile git diff whitespace check:       passed
```

Must preserve:

- `payment_channel: "mobile"`;
- PhonePe deep link to `nivaana://Main/ProfileTab/MyOrders`;
- verified `pendingOrder` reconciliation;
- cart clearance only after confirmed order success;
- internal ₹0 order completion without PhonePe.

These existing behaviours remain intact in the Phase 5 implementation. Manual device/SIT confirmation is still required for success, failed, cancelled, pending, direct-coupon, mixed-wallet-source, and ₹0 checkout paths.

## 5. Customer-facing UX specification

### Wallet page

- Input label: **Add coupon to wallet**.
- Preview explains amount, minimum purchase, and expiry.
- Confirmation button: **Add ₹X to Wallet**.
- Claimed code message: **This coupon has already been added to your wallet.**
- Directly redeemed code message: **This coupon has already been used.**

### Checkout

- Input label: **Have a coupon code?**
- Applying the code does not add it to wallet.
- Applied card shows name, saved amount, and Remove action.
- Wallet remains a separate explicit Apply/Remove control.
- If the coupon consumes all remaining merchandise, explain that shipping is still payable unless free shipping applies.
- Never show the same coupon simultaneously as a direct applied coupon and spendable wallet credit.

### Cart Step 1

- Continue showing automatic and click-to-apply promotions, estimated savings, and free-shipping effects.
- Do not render a second coupon-code input.
- Authenticated message: **Have a coupon code? Apply it securely at checkout.**
- Guest message: **Have a coupon code? Sign in and apply it securely at checkout.**
- The authoritative direct-coupon quote remains in Checkout and is revalidated again during payment initiation.

### Order summary

Recommended order:

```text
Items total
Promotion
Coupon
Wallet credit
Shipping
Total
```

Hide zero-value rows after calculation completes. During recalculation, show one compact calculation state rather than separate repeated loading messages.

## 6. Risks and controls

| Risk | Required control |
|---|---|
| Same coupon used directly and in wallet | Shared assignment-state validation plus transaction/DB uniqueness |
| Wallet consumes value before entered coupon | Direct coupon is allocated before promotional wallet |
| Coupon/wallet reduces shipping | Separate merchandise and shipping balances enforced on backend |
| Existing channel-restricted coupons remain hidden but restricted | Audit and migrate existing standalone assignments |
| Refund wallet behaviour breaks | Allocate by `source_type`; do not globally treat refund credit as promotional credit |
| Client submits stale values | Preserve authoritative server repricing and 409 response |
| Payment succeeds but first order creation fails | Preserve existing reconciliation and idempotent creation |
| Failed payment consumes coupon | Reserve then consume only on successful order; release/retry safely |
| Web and Mobile behave differently | Use one backend contract and execute the same mandatory test matrix on both |

## 7. Post-implementation test matrix

Development Phases 1–5 are complete, so the full cross-client manual matrix can now begin after the Backend migration and matching application builds are deployed to SIT. Backend policy, pricing, concurrency, reservation, and idempotency tests are automated; client end-to-end cases remain manual. Record client, customer, coupon assignment ID, evaluation ID, merchant transaction ID, order ID, request/response, and pass/fail evidence.

### Configuration and claim

- Create coupon without channel/stacking fields; verify backend stores approved defaults.
- Update coupon without channel/stacking fields.
- Verify coupon appears on Web and Mobile.
- Claim once, then claim again on the same client.
- Claim on Web, then claim on Mobile.
- Simultaneous Web/Mobile claim.
- Directly redeem, then attempt wallet claim.
- Claim into wallet, then attempt direct redemption.

### Pricing

- No promotion/coupon/wallet: merchandise plus ₹150 shipping.
- Fixed promotion only.
- Percentage promotion only.
- Multiple compatible promotions.
- Direct coupon only.
- Coupon larger than merchandise.
- Promotion plus direct coupon.
- Promotion plus wallet.
- Promotion plus coupon plus wallet.
- Wallet larger than remaining merchandise.
- Merchandise becomes ₹0 while ₹150 shipping remains.
- Free shipping makes shipping ₹0 without changing merchandise allocation.
- Fully discounted ₹0 final order completes internally.

### Minimums and wallet sources

- One wallet credit below its minimum.
- Exactly at minimum.
- Above minimum.
- Two credits with different minimums; independently include only the eligible one(s).
- Partially used credit.
- Expired credit.
- Coupon credit plus cancellation/return refund credit.
- Confirm promotional credit cannot offset shipping.
- Confirm refund credit follows the explicitly preserved business behaviour.

### Payment and persistence

- PhonePe success.
- PhonePe customer cancellation.
- PhonePe failure.
- Payment pending then later success reconciliation.
- Duplicate callback/status polling.
- Promotion/coupon expires or reaches usage limit before payment.
- Quantity or price changes after quote.
- Verify order header, order lines, shipping, direct coupon redemption, wallet reservations/consumption, promotion redemption, and budget usage.
- Verify failed/cancelled payment creates no successful order and permanently consumes no coupon/wallet value.

### Navigation

- Ecom success redirects to `/checkout/confirmation` with latest order.
- Mobile success deep-links to My Orders and refreshes the latest order.
- Mobile cart clears only after verified success.
- Failure/cancellation retains cart for retry.

## 8. Do not change

- Do not allow merchandise discounts to consume shipping.
- Do not make private standalone coupons automatic promotions.
- Do not trust frontend totals or discount amounts.
- Do not send ₹0 to PhonePe.
- Do not remove payment reconciliation or duplicate-order protection.
- Do not change Ecom confirmation or Mobile My Orders return navigation.
- Do not change general Promotion stacking/channel configuration as part of standalone Coupon Wallet simplification.
- Do not change refund-credit shipping behaviour without a separate confirmed business rule.
- Do not reset or discard existing dirty-worktree changes.

## 9. Start/continuation instructions

Before deployment/manual verification:

1. Read this document and `PROMOTION_DISCOUNT_CAP_HANDOVER.md` completely.
2. Inspect current branches, worktree status, and targeted diffs in all four repositories.
3. Audit existing standalone coupon counts by `delivery_channel`, claimed state, redemption state, and wallet-credit state.
4. Confirm the database migration strategy before hiding Admin fields.
5. Preserve and rerun the existing promotion/pricing/payment/wallet tests.

Completed development order:

1. Backend state and pricing contract.
2. Backend automated positive, negative, concurrency, and idempotency tests.
3. Inventory/Admin simplification.
4. Ecom integration.
5. Mobile integration.
6. Full Web and Mobile manual matrix.

Do not begin balance-scenario sign-off until backend authority and both client integrations are complete. After implementation, update this file with exact modified functions, migrations, test commands, test results, order IDs, and any approved deviations from this plan.
