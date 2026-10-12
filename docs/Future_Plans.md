# Nivaana — Future Plans (Parked Items)

Items analysed and agreed but deliberately parked. Each entry has enough context to pick up later without the original conversation. When an item is implemented, log it in `Fix_After_Sep30/Master.md` and mark it **Done** here.

| ID | Parked on | Area | Summary | Priority | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PLAN-01** | 2026-10-06 | Mobile App / PhonePe | UPI app handoff fails silently when the app is missing or not visible to Android | High (before prod release of the app) | Parked |
| **PLAN-02** | 2026-10-06 | Backend / Security | Address API has no ownership check | High | Parked (task chip created) |
| **PLAN-03** | 2026-10-06 | Mobile App / Promotions | Deals page shows offers the customer has already used up | Medium | Parked (awaiting BA mail) |
| **PLAN-04** | 2026-10-06 | Ecom Web / PhonePe | Limit iframe checkout to Meta in-app browsers | Low | Parked (decided: keep as is) |
| **PLAN-05** | 2026-10-06 | Backend / PhonePe | Server-side guard against a second payment while one is pending | Medium | Parked |
| **PLAN-06** | 2026-10-07 | Inventory / Stock | Protect unallocated customer-order demand before marking stock damaged or transferring it | High | Partly done (damage check: FIX-2026-10-07-57); transfer check parked |

---

## PLAN-01: Mobile App — PhonePe/UPI App Handoff

**Found:** 2026-10-06 while testing the mobile app on SIT (PhonePe sandbox, `mercury-uat`).

**Symptom:** In the app's payment WebView the customer taps **PhonePe** (or another UPI app). PhonePe's page shows "Confirming Payment" and never moves. After 120s the Cloud Task (`cleanupExpiredLock`) sees `PENDING`, releases stock locks, and the transaction later expires. No order, no money taken. Example: transactions 233–235 (user 73).

**Root cause of the observed case:** the tester's phone did not have the PhonePe app installed. The app does not tell the customer.

**Code path:** `Vibrant-Life-mobile-app/src/components/EnhancedPaymentWebView.tsx`
- `EXTERNAL_PAYMENT_SCHEMES = ["phonepe://", "upi://", "intent://"]` links are intercepted in `onShouldStartLoadWithRequest` (added 2026-04-30, commit `e9906ec1` "Fix iOS payment WebView handoff").
- `openExternalUrl` calls `Linking.canOpenURL(url)`; when it returns false it **returns silently** (a warning only in dev builds). PhonePe's page keeps waiting.

**Related risks (affect real customers, not only missing apps):**
1. **Android 11+ package visibility:** `canOpenURL` returns false for apps not declared in `<queries>`. The manifest's UPI entries (`com.phonepe.app`, `com.phonepe.simulator`, `net.one97.paytm`, `com.google.android.apps.nbu.paisa.user`, `in.amazon.mShop.android.shopping`, schemes `phonepe`, `phonepe-preprod`, `upi`) were removed on 2025-06-18 (commit `e171df09`). Today `<queries>` only has `https`, so an installed PhonePe/GPay may also be treated as "not installed".
2. **`intent://` links:** PhonePe's page on Android often uses `intent://…#Intent;scheme=…;package=…;S.browser_fallback_url=…;end`. `canOpenURL` cannot resolve these, so they always fail the check.

**Evidence that it is device/method dependent, not a regression:** mobile successes on 2026-09-25/26 (users 33, 41) and 2026-10-01 (user 41); stuck on 2026-09-30 (user 74), 2026-10-05 (user 49), 2026-10-06 (user 73). Web payments were unaffected (3 successes for user 73 on 2026-10-06).

**Agreed fix (mobile app only, no backend change):**
1. **Clear message when the app can't be opened:** show "PhonePe app is not installed on this phone. Please choose another payment option." and reload the PhonePe page (same token/session) so the customer returns to the payment options. No new transaction.
2. **Restore app visibility:** add `<queries>` for schemes `upi`, `phonepe`, `tez`, `paytmmp` and packages `com.phonepe.app`, `com.google.android.apps.nbu.paisa.user`, `net.one97.paytm` through the Expo config plugin `plugins/phonepe-plugin.js` (so prebuild does not drop them). iOS: same schemes in `LSApplicationQueriesSchemes`.
3. **Handle `intent://`:** parse the intent URL; open the target scheme/package directly; else use `S.browser_fallback_url`; else show the message from step 1.

**Release notes:** needs a new native build (manifest/Info.plist changes cannot ship over the air). Test on a real Android phone with and without PhonePe installed, and on iOS. In sandbox, UPI-app payments need PhonePe's simulator app; use the sandbox test card for general testing.

**Repo/branch:** `Vibrant-Life-mobile-app`, branch `expo_rn_migrations_v2`.

---

## PLAN-02: Backend — Address API Ownership Check

`src/controllers/address.controller.ts` (`getAddresses`, `getAddress`, update/delete) never checks the caller. Any signed-in customer can call `GET /v1/addresses?userid=<other>` or `/v1/addresses/:id` and read another customer's name, mobile and address.

**Fix:** same rule as `orders.controller.ts` `getOrderSummaryByUserId`: 401 without user; inventory users read any; e-commerce customers only their own (`userid` / `address.userid` must equal `authUser.id`); otherwise 403. Check callers first: Ecom `addressService.ts`, mobile address service, Inventory `CustomerDetailPage.tsx` (inventory user, `?userid=`), guest checkout.

A ready-to-run task ("Restrict address API to own addresses") was created in the 2026-10-06 session.

---

## PLAN-03: Mobile App — Deals Page Shows Used-Up Offers

`Vibrant-Life-mobile-app/src/api/services/promotionService.ts` (`getPromotions`, ~lines 69–95) merges `/promotions/customer-offers` with `/promotions/public` for signed-in users. `/customer-offers` already includes public offers and removes those the customer cannot use (per-customer limit reached, budget/redemption cap, channel, segment). `/public` does not, so the merge re-adds used-up offers. Example: user 45 sees #63 (limit 1 per customer, already used) on mobile but not on web.

**Fix:** signed-in → `/customer-offers` only; guests → `/public`. Optional backend: in `getPublicPromotions` filter expired offers before applying `limit`.

Related open question sent to the BA (2026-10-06): how promotions should be grouped/shown on Web Account → Promotions vs Mobile Deals (used-up offers, guests, grouping, not-eligible offers, apply action).

---

## PLAN-04: Ecom Web — PhonePe Iframe Only for Meta In-App Browsers

Current: `VITE_PHONEPE_IFRAME_CHECKOUT` enables the iframe PayPage for **all** web visitors (FIX-2026-10-06-44). PhonePe's docs do not cover mobile webviews/UPI app switching inside the iframe.

**Option (not chosen for now):** a three-value flag (`off` / `meta` / `all`); `meta` uses the iframe only when the user agent is Instagram/Facebook (`Instagram`, `FBAN`/`FBAV`, `FB_IAB`), keeping the proven full-page redirect elsewhere.

**Before production either way:** SIT tests through real Instagram/Facebook links on Android and iOS — UPI app payment, closing without paying, card with bank OTP page.

---

## PLAN-05: Backend — Guard Against a Second Payment While One Is Pending

The backend accepts a new PhonePe payment while an earlier one for the same customer/cart is still pending. Today only the Ecom frontend prompts ("Previous payment still processing — Wait / Pay again", FIX-2026-10-06-44). If the first payment completes late and the customer paid again, two orders and two charges are possible.

**Option:** in `/v1/phonepe/initiate`, check the customer's latest `INITIATED`/pending transaction (e.g. within the PhonePe expiry window); query PhonePe status; if success → return the existing order; if still pending → return a clear error code the web and app can show. Must not block legitimate retries after a confirmed failure/expiry.

---

## PLAN-06: Inventory — Protect Customer Orders During Damage and Stock Transfer

**Business risk:** A paid or confirmed customer order may not yet have physical stock allocated because the order has not reached packing / ready for dispatch. Those units still appear as `Available`. An admin can therefore mark them as `Damaged` or transfer them out, leaving insufficient stock when the warehouse later tries to fulfil the existing orders.

**Example:** A product has 10 available units and open customer orders require 8 units. Although all 10 stock rows still show `Available`, only 2 units are genuinely free after protecting order demand.

- Marking 2 units as damaged leaves 8 units, so all existing orders can still be delivered. Allow the action after showing an informational warning.
- Marking 3 units as damaged leaves 7 units against demand of 8, creating a shortage of 1. Block the action.
- Apply the same check before transferring stock. Evaluate stock that will remain in the source fulfilment pool after the transfer; stock at the destination counts only if that destination is eligible to fulfil the affected orders.

### Status (2026-10-07)

**Done — damage check (FIX-2026-10-07-57):** marking a stock `Damaged` is blocked on the backend (409) when its platform has `orderedqty + lockqty > 0` and `availableqty < 1`, using the stored `platformstock` values. `GET /v1/stocks/:id/damage-check` feeds the Inventory dialog (blocked view with Close / Bulk Add Stock; confirm view with before → after quantities). Applies to all stock, including in-store stock.

**Still parked:**
1. **Transfer-time check:** run the same protection before a platform/location transfer (`StockService.update` with a platform change → `transferStockBetweenPlatforms`). Block when the source platform has `orderedqty + lockqty > 0` and moving the stock leaves `availableqty < 1` there; show the same style of dialog in the transfer UI.
2. **Race protection:** today's damage check and update are separate steps. Lock the `platformstock` row (`SELECT … FOR UPDATE`) and check inside the same transaction as the status change / transfer.
3. **Bulk changes / import:** check the combined effect of bulk status changes and transfers, not one row at a time.
4. **Platformstock recount review:** a dry run of `scripts/recount-platform-stock.ts` (FIX-2026-10-07-56) shows 101 rows where stored quantities differ from a recount (e.g. product 44 / nivapp availableqty 120 vs 150). Review the order and marketplace flows before any bulk apply.
5. The fuller allocation-based rule below (unallocated demand, location/batch eligibility, privileged override) remains the target design.

### Required availability check

Before an admin changes an `Available` stock item to a non-fulfillable status (for example `Damaged`, `On Hold`, or `Quarantine`) or transfers it out of the eligible fulfilment pool, calculate:

```text
remaining fulfillable stock = current eligible available stock - quantity affected by this action
unallocated order demand   = active customer-order quantity not already backed by allocated stock
surplus / shortage         = remaining fulfillable stock - unallocated order demand
```

The calculation must use the same product/PUC, platform, location, batch, expiry, and other eligibility rules used by ready-for-dispatch allocation. Count only active demand that the business must still fulfil; exclude cancelled, failed, expired, fully refunded, and already completed orderlines. Do not double-count units already reserved or mapped to an order.

This validation must run on the backend inside the same transaction as the status change or transfer. A frontend-only warning is not sufficient because stock or order demand can change concurrently.

### Admin warning and blocking behaviour

Show the impact before final confirmation, using exact quantities rather than a generic warning:

> 10 units are currently available. Open customer orders still require 8 unallocated units. This action affects 2 units and leaves 8, so all current orders can still be fulfilled. Only 0 uncommitted units will remain. Continue?

If the action would create a shortage, do not offer a normal confirmation path:

> Cannot update this stock. The change would leave 7 fulfillable units for 8 units required by open customer orders, causing a shortage of 1. Allocate replacement stock, reduce the transfer quantity, or resolve the affected order first.

The warning should also identify the affected product/PUC, source location, action (`Damaged` or `Transfer`), affected quantity, remaining stock, protected order demand, and resulting surplus or shortage. Where practical, provide a link or drill-down to the affected orders.

### Enforcement rules

1. **Safe with remaining coverage:** allow only after explicit admin confirmation; record the calculated impact in the audit log.
2. **Would cause a shortage:** block by default. Do not permit a simple warning override.
3. **Privileged exception, if the business later requires one:** use a separate permission and require a reason; list the affected orders and create an operational alert. Never silently override.
4. **Bulk changes/transfers:** validate the combined effect atomically, not one row at a time.
5. **Race protection:** lock or otherwise serialize the relevant availability/demand records, recalculate immediately before commit, and return a clear conflict response if the figures changed.

### Acceptance scenarios

- 10 available, 8 unallocated order demand, damage 2 → warn and allow after confirmation; remaining surplus 0.
- 10 available, 8 unallocated order demand, damage 3 → block; shortage 1.
- 10 available at Location A, 8 Location-A order demand, transfer 2 from A to an ineligible Location B → warn and allow after confirmation; remaining surplus 0.
- Same transfer with quantity 3 → block; shortage 1.
- Two admins act at the same time → at most one action succeeds if both together would reduce stock below protected demand.
- Cancelled or already allocated orderlines do not inflate unallocated demand.

---

## PLAN-07: Inventory — Stock Summary Modal: Filter Chip, Totals and Platform Breakdown

**Status:** Parked 2026-10-07, waiting for business decision (item #3 of the UI enhancement list).

**Findings** (`StockSummaryModal.tsx`, `stock.controller.ts` → `stock.service.ts#getSummaryByPuc`):

1. **"Filtered by 1 condition" chip:** counts the stock-list query filters. On the product page the only filter is the product's own `puc`, so it always shows "1 condition". The summary ignores every other filter (Status, Platform…), so with extra filters the chip claims "N conditions" while the numbers are still whole-product. Proposed: remove the chip.
2. **Platform Quantity counts sold rows:** card Total = non-sold rows; platform row Quantity = `COUNT(*)` (incl. sold). Seen on dev: Total 28, Nivapp 30 (2 sold). Proposed: exclude sold, same as Total.
3. **Mixed sources:** platform Ordered / Sold / E-com / Damaged come from `platformstock` counters, Quantity from `stock` rows; cards come from `stock` rows + `product.orderedquantity`. Counter drift makes rows disagree with cards. Proposed: derive platform rows from `stock` rows (keep Ordered from counter).
4. **Total composition:** Total includes damaged / quarantine / on_hold; no cards for quarantine / on_hold; "Available" counts only e-com published rows, so available-but-unpublished stock is in Total but not Available. Decide: (a) Total = sellable only, show Damaged / Quarantine / On hold separately, or (b) keep Total = all non-sold and show a breakdown line.
5. **E-com published includes Amazon / Flipkart stock (open question):** UAT product 96 (NIV-0096): all 50 stock rows `available` + `ecompublish = true` (Amazon 10, Flipkart 15, Nivapp 25), so E-com Published 50 and Available 48 (50 − 2 ordered on Nivapp). Numbers match the data; confirm whether marketplace stock should be e-com published / count toward website availability.

---

## PLAN-08: Backend — Scheduled Jobs on Cloud Run: Coupon Expiry Job + Reliable Scheduling

**Status:** Parked 2026-10-07 (user: "safest solution needed, do later"). Not needed for correctness today.

**Coupon / wallet expiry:** status is derived on every read from the dates (admin list, customer wallet, customer overview) and checkout only uses credits with `expires_at ≥ now`, so expired coupons are always shown and enforced correctly. The stored columns (`promotion_assignments.status`, `wallet_credits.status`) stay `active` / `partially_used` after expiry — only reports / exports / raw SQL would see stale values.

**Planned job:** protected endpoint `POST /v1/internal/jobs/coupon-expiry` that sets `status = 'expired'` where `end_date` / `expires_at` < now and status is still active / partially_used (idempotent, safe to run twice). Triggered by **GCP Cloud Scheduler** (`5 0 * * *`, Asia/Kolkata) with OIDC service-account auth or a secret header; one job per environment. Do **not** write during GET requests.

**Why not node-cron in the app:** the backend is deployed on Cloud Run with default settings (`gcloud run deploy nivaana … --memory 512Mi`, no `--min-instances`, CPU throttled outside requests). An in-process cron can miss runs when no instance is up, stall when CPU is throttled, and run once per instance when scaled out. Cloud Scheduler gives one call per schedule, retries and run logs.

**Related risk to review at the same time:** existing in-process schedulers use node-cron / timers inside Cloud Run (`utils/shipmozoTrackingScheduler.ts`, `services/amazon-order-scheduler.service.ts`, `amazon-listing-scheduler.service.ts`, `amazon-retry-scheduler.service.ts`, `amazon-return-scheduler.service.ts`, `utils/sessionCleanup.ts`). Confirm whether they actually run in SIT / UAT / PROD (logs), and either move them to Cloud Scheduler endpoints or deploy with `--min-instances=1 --no-cpu-throttling`.
