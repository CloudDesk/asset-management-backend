# PhonePe Pending-Payment Guard — Wrong "Previous Order" Confirmation (Fix)

**Fix ID:** FIX-2026-10-06-48 (follow-up to FIX-2026-10-06-44)
**Date:** 2026-10-06
**Repository:** `Nivaana-Ecom-Web` (frontend only, no backend change)
**Applies when:** `VITE_PHONEPE_IFRAME_CHECKOUT=true` (Local, SIT, UAT today; Production planned)
**Status:** 🟡 Implemented / SIT Verification Pending — must be verified before the iframe flag is enabled in Production

---

## 1. Background: why a "pending-payment guard" exists

With the PhonePe **iframe** checkout (FIX-44), the customer pays inside a PhonePe window on top of Nivaana's Checkout page. The customer can **close** that window before paying (`USER_CANCEL`). PhonePe may then still report the payment as **pending**, because the customer might complete it a moment later in their UPI app.

If the customer clicked **Pay** again immediately, a second payment would start and, if the first one also completed, they would be **charged twice** (two orders).

To prevent that, FIX-44 added a guard on Checkout:

1. Remember the transaction ID of the payment (`sessionStorage`, per customer, 30 minutes).
2. Quietly re-check it every 5 seconds for 2 minutes (the Cloud Task window). If it succeeds, open its confirmation.
3. On the next **Pay** click, check it first:
   - success → open that payment's confirmation (no new payment),
   - failed → start the new payment,
   - still pending → show **"Previous payment still processing" — Wait / Pay again**.

---

## 2. The bug

FIX-44 saved the transaction ID **as soon as the PhonePe window opened**, for **every** payment, and **never cleared it after a normal successful payment** (`CONCLUDED`). The confirmation page did not clear it either.

So after a successful order, the "pending" entry stayed in the browser for up to 30 minutes, pointing at an order that was already **paid and finished**.

### Example (step by step)

| Time | What the customer does | What the code did (before the fix) |
|---|---|---|
| 10:00 | Places **Order A** (₹500), pays in the PhonePe iframe — success | Saved `TXN_A` when PhonePe opened. `CONCLUDED` → confirmation of Order A. **`TXN_A` left in storage.** |
| 10:15 | Same browser tab: adds new items, opens Checkout for **Order B** (₹300) | Checkout reads `TXN_A` as a "pending payment" and shows the amber "Payment window closed…" notice (wrongly). |
| 10:15 | Clicks **Pay ₹300 securely** | Guard checks `TXN_A` first → PhonePe: **success** (Order A was paid) → opens **Order A's confirmation**. **No payment is started for Order B.** |
| 10:15 (alternative) | Does nothing for 5 seconds | Background check finds `TXN_A` successful → opens **Order A's confirmation automatically**. |

**What the customer sees:** a "payment successful / order confirmed" page — but it is the **old** Order A. They may believe Order B was placed. Order B's items are still in the cart.

**What did *not* happen:** no double charge, no wrong order created, Order A unchanged. After the redirect the stale entry is cleared, so going back to Checkout and clicking Pay again places Order B normally.

**Why it was rare:** it needs all three — iframe checkout ON, **two orders within 30 minutes in the same browser tab**, and the first one paid through the iframe.

---

## 3. The fix

| # | Change | File |
|---|---|---|
| 1 | **Do not save the transaction when PhonePe opens.** Opening a new payment also clears any earlier pending entry. | `src/pages/Checkout.tsx` |
| 2 | **Save it only when the window was closed and the status is still pending** (the one case the guard exists for). A normal success (`CONCLUDED`) never leaves anything behind. | `src/pages/Checkout.tsx` |
| 3 | **Confirmation page clears it** once that payment's outcome is known (success or failure) and the saved ID matches. Double safety. | `src/pages/CheckoutConfirmation.tsx` |
| 4 | **New storage key** `nivaana-phonepe-pending-v2-<userId>`, so entries written by the earlier version (which may point to completed orders) are ignored after deployment. | `src/services/phonePeCheckoutService.ts` |

Unchanged: the 5-second background check, the "Wait / Pay again" prompt, the 30-minute limit, per-customer separation, and all server-side order creation (webhook, status endpoint, Cloud Task).

### Same example after the fix

| Time | Customer | Code (after the fix) |
|---|---|---|
| 10:00 | Pays Order A — success | Nothing saved. Confirmation of Order A. |
| 10:15 | Opens Checkout for Order B | No pending entry, no amber notice. |
| 10:15 | Clicks **Pay ₹300** | New PhonePe payment `TXN_B` starts → Order B is placed normally. |

---

## 4. Behaviour in every case (after the fix)

| Scenario | Stored? | Result |
|---|---|---|
| Customer pays normally (`CONCLUDED`) | No | Confirmation of this payment. Next order works normally. |
| Customer closes the window, payment **failed/cancelled** | No | Stays on Checkout: "Payment was cancelled. You can try again." |
| Customer closes the window, payment **still pending** | **Yes** | Stays on Checkout with the amber notice. Re-checked every 5s for 2 min. |
| …then completes it in the UPI app | Cleared when success is seen | Confirmation of **that** payment opens (correct order). |
| …then clicks Pay again while still pending | Kept | "Previous payment still processing" — **Wait** (default) or **Pay again**. |
| …chooses **Pay again** | Cleared | New payment starts. |
| Customer intentionally orders the **same items twice** | No | Both orders go through as separate payments and orders (allowed). |
| Iframe cannot load → full-page redirect fallback | No | Unchanged redirect flow. |
| Customer refreshes while the PhonePe window is open | No | Guard not available for that payment (rare); server-side order creation still protects the payment. |
| Old entry from the previous version in the browser | Ignored (new key) | No wrong redirect after deployment. |

---

## 5. Verification

Done (2026-10-06):
- Ecom TypeScript, ESLint (no errors) and production build passed.
- Storage helpers checked in the running dev app: old-version entry ignored; save/read/clear; entry older than 30 minutes ignored and removed; customers isolated.

To do on SIT (iframe flag ON), then UAT:
1. **The reported bug:** pay Order A → success; in the same tab within 30 min place Order B and click Pay → a **new** PhonePe payment must open (not Order A's confirmation). Also wait 10s on Checkout before paying → no automatic redirect.
2. Close PhonePe without paying → stay on Checkout, amber notice shown.
3. Close PhonePe, then pay in the UPI app → within 2 min the confirmation of **that** payment opens.
4. Close PhonePe, click Pay immediately → "Wait / Pay again" prompt.
5. Payment fails → "Payment was cancelled", retry works.
6. Normal success → DevTools › Application › Session Storage: no `nivaana-phonepe-pending-v2-*` entry.

## 6. Release order

1. `DEV-NEW` → **SIT**: run the six checks above (plus real Instagram/Facebook links on Android and iOS — see `docs/Future_Plans.md` PLAN-04).
2. **UAT**: repeat once.
3. **Production**: deploy, then enable `VITE_PHONEPE_IFRAME_CHECKOUT=true` only after SIT and UAT pass; place one small real order on day one.

Until this fix is deployed to SIT/UAT, testers who see an old order's confirmation should go back to Cart/Checkout and click Pay again (the stale entry is cleared after the first redirect), or test in a new tab.
