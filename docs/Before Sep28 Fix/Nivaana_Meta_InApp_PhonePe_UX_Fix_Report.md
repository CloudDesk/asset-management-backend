# Nivaana Meta In-App Browser PhonePe Return UX Fix

**Prepared:** 22 September 2026  
**Status:** Proposed implementation and validation plan  
**Primary scope:** Nivaana E-commerce Web opened from Instagram/Facebook  
**Repositories reviewed:** Backend, E-commerce Web, Mobile App, Inventory/In-store

## 1. Executive summary

PhonePe payment and server-side order creation are now working correctly. The remaining problem is a customer-experience issue that primarily affects customers who open `nivaana.in` through an Instagram or Facebook advertisement.

After a successful payment, some customers remain on PhonePe's hosted success screen inside the Meta In-App Browser. The screen displays "Payment successful" and "Redirecting back to merchant's website", but it does not automatically return to Nivaana's `/payments` page.

The recommended fix is to use PhonePe's officially supported **iframe PayPage** for the E-commerce Web. This keeps the Nivaana page open underneath the PhonePe checkout and allows Nivaana to regain UI control when PhonePe reports that the transaction has concluded. Nivaana must then verify the payment through the backend and navigate to `/payments`.

The implementation must be scoped only to the E-commerce Web. The Mobile App, Mobile WebView fallback, Inventory/In-store screens, webhook reconciliation and Cloud Task reconciliation must retain their existing behavior.

## 2. Problem statement

### Observed customer flow

```text
Instagram/Facebook advertisement
        ↓
Nivaana Web inside Meta In-App Browser
        ↓
Customer checks out
        ↓
Nivaana redirects the whole page to PhonePe
        ↓
Customer completes payment successfully
        ↓
PhonePe success screen remains visible
        ↓
Automatic return to Nivaana does not occur
```

The PhonePe page provides a manual **Go to merchant's page** action, but requiring the customer to discover and tap that action is not an acceptable primary experience.

### Expected flow

```text
Payment succeeds
        ↓
Customer returns to Nivaana automatically
        ↓
Nivaana displays payment reconciliation progress
        ↓
Nivaana displays the completed payment/order
        ↓
Customer can navigate to the corresponding order
```

## 3. What is already fixed

The payment/order integrity problem has already been addressed in the backend.

### Server-side order reconciliation

When PhonePe reports `PAYMENT_SUCCESS`, the backend can now:

1. Mark the transaction successful.
2. Check whether an order already exists for the merchant transaction ID.
3. Create the missing order when necessary.
4. Reuse the existing order when another process already created it.
5. Consume applicable wallet redemption.
6. Reconcile inventory quantities.
7. Clear only the cart records that were purchased by that transaction.

### Available recovery triggers

Order reconciliation can be triggered by:

- PhonePe's server-to-server webhook.
- The authenticated `/v1/phonepe/status/:merchantTransactionId` endpoint.
- The delayed Cloud Task created when payment starts.
- The payment-return callback when the customer successfully returns.

### Idempotency

Webhook, browser status checking and Cloud Tasks can run concurrently. The merchant transaction ID and database uniqueness checks ensure that these concurrent attempts resolve to one order instead of producing duplicate orders.

### Result

The customer may close the PhonePe page, close the browser or lose network connectivity after payment. The backend should still create the order after receiving or independently confirming `PAYMENT_SUCCESS`.

The remaining issue is therefore **return navigation and customer feedback**, not payment capture or order creation.

## 4. Confirmed current Web behavior

The E-commerce Web initiates PhonePe using:

```text
POST /v1/phonepe/initiate
```

It sends a storefront return URL similar to:

```text
https://nivaana.in/payments
```

The backend builds a self-contained PhonePe return URL containing:

```text
payment=<status>
merchantTransactionId=<Nivaana merchant transaction ID>
```

When `/payments` loads with a merchant transaction ID, the Web App calls:

```text
GET /v1/phonepe/status/:merchantTransactionId
```

The Payments page then refreshes cart, order, wallet, transaction and payment-history information. It also provides a link to the matching order.

For the affected Meta In-App Browser flows, the important failure is that the browser remains on PhonePe's domain. The Nivaana Payments page therefore does not load and cannot run the status request.

## 5. Root cause

### Primary cause

The current Web flow uses a full-page redirect:

```text
Nivaana page → PhonePe hosted page → expected return to Nivaana
```

After the full-page navigation, Nivaana no longer controls the active page. Only PhonePe and the host browser can initiate the return navigation.

Meta's Instagram/Facebook In-App Browser can delay, suppress or fail the automatic navigation from the PhonePe hosted success page. Nivaana JavaScript cannot fix the page while the active origin is `phonepe.com`.

### What is not the root cause

It is not accurate to state that Nivaana's backend never provided a merchant transaction ID in the return URL. The backend return-URL builder was already designed to append the ID.

It is also not accurate to treat browser-local state as the authoritative payment record. Browser storage was a fallback in the earlier frontend flow, but payment success and order creation must be determined by the backend.

### Local storage consideration

The E-commerce Web currently stores its access token, refresh token and customer information in `localStorage`.

Local storage normally remains available when the same Instagram webview returns to the exact same Nivaana origin. It is not guaranteed if PhonePe or the operating system opens:

- A new Instagram webview.
- Chrome or Safari.
- Another isolated browser partition.
- A different Nivaana origin such as `www.nivaana.in` instead of `nivaana.in`.

The customer being able to log in and reach Checkout demonstrates that storage was available in the original Instagram webview. The risk is continuity after leaving that context.

## 6. Recommended solution: PhonePe iframe PayPage

PhonePe's official Website Standard Checkout documentation recommends iframe mode. The PhonePe PayPage opens within the merchant website instead of replacing the entire page.

Official reference:

- [PhonePe — Invoke iframe PayPage](https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/invoke-iframe-paypage)
- [PhonePe — Website integration steps](https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/integration-steps)

### Proposed E-commerce Web flow

```text
Nivaana Checkout remains loaded in Instagram
        ↓
Backend creates PhonePe checkout session
        ↓
Frontend receives PhonePe token/redirect URL
        ↓
PhonePe PayPage opens in an iframe overlay
        ↓
Customer completes or cancels payment
        ↓
PhonePe iframe callback returns CONCLUDED or USER_CANCEL
        ↓
Nivaana verifies the transaction with the backend
        ↓
Nivaana navigates to /payments with merchantTransactionId
```

### Important callback rule

`CONCLUDED` must not be interpreted directly as `PAYMENT_SUCCESS`.

It means the PhonePe checkout reached a terminal state. Nivaana must call the backend status endpoint and use the backend/PhonePe status as the source of truth.

Conceptual browser integration:

```ts
window.PhonePeCheckout.transact({
  tokenUrl: phonePeRedirectUrl,
  type: "IFRAME",
  callback: async (result) => {
    if (result === "USER_CANCEL") {
      // Close the payment UI and keep the customer on Checkout.
      return;
    }

    if (result === "CONCLUDED") {
      // Verify payment through the backend.
      // Navigate to /payments with merchantTransactionId.
    }
  },
});
```

### Expected benefit

- Nivaana's original page remains active.
- The original customer session remains in the same webview.
- The customer does not depend on a full-page PhonePe-to-Nivaana return.
- Nivaana controls progress, error and completion messages after the iframe closes.
- The storefront can navigate directly to `/payments` after backend verification.

## 7. Required Web implementation

### 7.1 Load the official PhonePe Checkout script

The E-commerce Web must load PhonePe's supported checkout script over HTTPS. Script loading must be handled once and must expose a clear failure state.

Do not log the complete PhonePe token URL because it may contain sensitive session information.

### 7.2 Identify the caller explicitly

The E-commerce Web payment request should identify its channel, for example:

```json
{
  "mode": "phonepe",
  "clientChannel": "ecom_web",
  "returnUrl": "https://nivaana.in/payments"
}
```

This field should be validated server-side against known values. It must not be used to weaken authentication or select an arbitrary return origin.

### 7.3 Open iframe checkout only for E-commerce Web

When the backend returns the PhonePe URL:

1. Disable repeated payment submission.
2. Confirm the PhonePe Checkout script is available.
3. Open the URL with `type: "IFRAME"`.
4. Keep the Checkout component and transaction ID in memory.
5. Do not clear the cart until the backend confirms or creates the order.

### 7.4 Handle `USER_CANCEL`

When the callback is `USER_CANCEL`:

- Close the payment overlay.
- Keep the customer on Checkout.
- Display a neutral cancellation message.
- Allow retry only after checking the current status when necessary.
- Do not immediately mark the payment failed if its final state is unknown.

### 7.5 Handle `CONCLUDED`

When the callback is `CONCLUDED`:

1. Display "Confirming your payment and order...".
2. Call `/v1/phonepe/status/:merchantTransactionId`.
3. If the payment is successful and the order exists, navigate to:

   ```text
   /payments?payment=success&merchantTransactionId=<id>
   ```

4. If payment is pending, continue controlled status polling.
5. If reconciliation is temporarily processing, continue polling without a short browser timeout.
6. If payment failed, show a clear failure message and retain retry/recovery options.

### 7.6 Avoid a fixed short timeout

Order reconciliation may take longer than an ordinary frontend request. The UI should use visible progress and bounded polling with backoff rather than declaring failure after a few seconds.

The browser does not need to remain open for order creation. Polling is only for presenting the result.

## 8. Redirect fallback

Iframe checkout may fail to initialize on a particular browser or device. The existing full-page redirect must remain available as a fallback.

Fallback flow:

```text
Iframe script unavailable or iframe initialization fails
        ↓
Use existing PhonePe full-page redirect
        ↓
PhonePe attempts return to Nivaana
```

Before using the fallback, the customer may be shown:

> After completing payment, tap "Go to merchant's page" if you are not returned automatically. Your order will still be created securely after payment confirmation.

The fallback must not retry or create another transaction automatically after an uncertain result.

## 9. Backend callback redirect as defence-in-depth

A backend return endpoint can still improve observability and compatibility:

```text
PhonePe
   ↓
/v1/phonepe/callback/:transactionId
   ↓ HTTP 302 GET
https://nivaana.in/payments?payment=...&merchantTransactionId=...
```

Benefits:

- Cloud Run logs show whether PhonePe attempted the browser return.
- Both GET and POST gateway returns can be normalized.
- The backend can verify and append the transaction ID.
- The final storefront navigation is a normal GET.
- Only allowlisted storefront origins can be used.

Limitation:

This does not solve the case where PhonePe or Instagram never starts the return navigation. If the callback URL is never requested, an HTTP 302 response cannot execute. Therefore, it is useful defence-in-depth, but iframe checkout is the stronger UX solution.

## 10. Authentication and customer ownership

### Same webview

Iframe checkout keeps the Nivaana page and storage context alive. The customer should remain logged in because the storefront itself was not replaced.

### Missing session fallback

If the session is missing when `/payments` is opened:

1. The protected route sends the customer to OTP Login.
2. The complete Payments URL, including its query parameters, is preserved as the return target.
3. After OTP verification, the customer returns to the Payments page.
4. The backend verifies the transaction against the authenticated customer.

### Security requirements

- A merchant transaction ID must never authenticate a customer.
- Never put access tokens or refresh tokens in the return URL.
- Payment/order details must only be returned when the authenticated customer owns the transaction/order.
- Return origins must be server-side allowlisted.
- Production must consistently use one canonical origin, preferably `https://nivaana.in`.
- Avoid mixing `nivaana.in`, `www.nivaana.in`, Cloud Run frontend URLs and SIT URLs.

## 11. Impact on other applications

### E-commerce Web

**Changed:** Yes.

- Use iframe PayPage when `clientChannel` is `ecom_web`.
- Handle `CONCLUDED` and `USER_CANCEL`.
- Verify status and navigate to `/payments`.
- Retain redirect fallback.

### Mobile App

**Changed:** No.

The currently active Mobile payment implementation uses the WebView flow through `/v1/phonepe/initiate`. Native PhonePe SDK logic exists in the repository but is explicitly disabled.

Mobile must retain its current return handling and must not receive the E-commerce Web iframe behavior.

The Mobile App is protected from app closure/network loss because the backend stores the transaction and order snapshot, receives the webhook and runs Cloud Task reconciliation.

Important future requirement: do not enable the currently inactive `/v1/phonepe/create-sdk-order` native SDK flow until it stores the complete order snapshot and uses the same webhook/task reconciliation guarantees.

### Inventory/In-store

**Changed:** No.

The reviewed Inventory application does not initiate this customer PhonePe checkout. It displays orders/payment information and supports operational/refund workflows. No Inventory routes or screens should be changed for this UX fix.

### Shared backend reconciliation

**Changed:** No functional removal.

The following must remain shared across Web and Mobile:

- Webhook signature validation.
- Transaction status updates.
- Missing-order reconciliation.
- Idempotency and duplicate prevention.
- Cloud Task fallback.
- Purchased-cart cleanup.
- Inventory reconciliation.

## 12. Failure-scenario behavior

| Scenario | Expected system behavior | Expected customer behavior |
|---|---|---|
| Payment succeeds; iframe callback works | Backend confirms/creates order | Navigate to Payments and show order |
| Payment succeeds; customer closes browser/app | Webhook or Cloud Task creates order | Order visible on next login/open |
| Customer loses network after paying | Server-to-server webhook creates order | App/site shows order after connectivity returns |
| Webhook is delayed | Scheduled Cloud Task checks PhonePe and reconciles | Payments page shows processing until confirmed |
| Webhook and status API race | Idempotency returns the same order | One order only |
| Iframe cannot load | Use full-page redirect fallback | Customer may need "Go to merchant's page" |
| PhonePe returns `USER_CANCEL` | Verify uncertain status when necessary; do not create false success | Customer remains on Checkout |
| PhonePe returns `CONCLUDED` but payment failed | Status endpoint reports failure | Show clear failure state |
| Session is missing on return | Require OTP and resume Payments URL | Customer logs in and sees owned transaction/order |
| Customer retries while first payment is uncertain | Prevent blind duplicate payment; check status first | Show confirmation/progress message |

## 13. Observability requirements

Log structured, non-sensitive events for:

- Payment initiated.
- Client channel (`ecom_web`, mobile, etc.).
- Merchant transaction ID.
- Iframe initialization attempted/succeeded/failed.
- Iframe callback result (`CONCLUDED` or `USER_CANCEL`).
- Status API requested.
- Webhook received and validated.
- Reconciliation task created.
- Order created versus already existing.
- Browser callback endpoint reached.
- Final storefront redirect issued.

Do not log:

- Access or refresh tokens.
- Complete PhonePe checkout token URLs.
- Webhook passwords.
- Full authentication headers.
- Unnecessary personal customer data.

Recommended monitoring metrics:

- Successful payments with orders.
- Successful payments without orders after the reconciliation window.
- Time from payment success to order creation.
- Iframe initialization failure rate.
- `CONCLUDED` callback to Payments navigation rate.
- Full-page redirect fallback rate.
- Meta In-App Browser return success rate.

## 14. SIT test plan

### Required environments

- Instagram In-App Browser on Android.
- Instagram In-App Browser on iOS.
- Facebook In-App Browser on Android.
- Facebook In-App Browser on iOS.
- Android Chrome.
- iOS Safari.
- Desktop Chrome/Safari as regression checks.
- Nivaana Mobile App payment WebView as a non-regression check.

### Payment-result tests

1. Successful PhonePe payment.
2. Failed payment.
3. User cancellation.
4. Pending payment that later succeeds.
5. Pending payment that later fails/expires.
6. Payment success followed immediately by closing the browser/app.
7. Payment success followed by network disconnection.
8. Duplicate status checks and repeated webhook delivery.

### Session tests

1. Logged-in customer remains logged in after iframe completion.
2. Correct customer ID owns the resulting order.
3. A different authenticated customer cannot view the transaction/order.
4. Missing/expired session goes through OTP and resumes the exact Payments URL.
5. Production canonical origin remains identical before and after payment.

### Cart and promotion tests

1. Purchased cart rows are removed after successful order creation.
2. Items added after payment initiation are not removed.
3. Failed/cancelled payments do not clear valid cart items prematurely.
4. Applied promotions are reconciled once.
5. Wallet usage is consumed once on success and released on failure.

### Regression tests

1. Mobile App WebView payment completes normally.
2. Closing Mobile App after successful payment still creates the order.
3. Inventory/In-store order screens remain unchanged.
4. Refund workflows remain unchanged.
5. Normal Web checkout outside Meta browsers remains functional.

## 15. Rollout plan

### Phase 1: SIT

1. Implement the E-commerce Web iframe integration behind a feature flag.
2. Keep full-page redirect fallback enabled.
3. Deploy Backend SIT without changing Mobile or Inventory routes.
4. Deploy E-commerce Web SIT.
5. Test through real Instagram/Facebook links, not only by typing the SIT URL into Chrome.
6. Verify webhook, status, reconciliation and order records.
7. Review Cloud Run logs for callback and status events.

Suggested feature flag:

```text
VITE_PHONEPE_IFRAME_CHECKOUT=true
```

### Phase 2: Production controlled release

1. Deploy backend compatibility first.
2. Deploy E-commerce Web with the iframe flag disabled.
3. Enable for controlled traffic or an agreed testing window.
4. Place a real low-value order from an Instagram advertisement.
5. Confirm payment, order, inventory, cart and Payments-page navigation.
6. Monitor fallback and iframe-error rates.
7. Expand to all E-commerce Web traffic after validation.

### Rollback

If iframe mode causes checkout failures:

1. Disable `VITE_PHONEPE_IFRAME_CHECKOUT`.
2. Restore the existing full-page redirect behavior.
3. Keep webhook and Cloud Task reconciliation enabled.
4. No payment/order data migration should be required.

## 16. Acceptance criteria

The fix is complete when all of the following are true:

1. A customer can start payment from Nivaana inside Instagram/Facebook.
2. Nivaana remains loaded while PhonePe checkout is displayed.
3. After payment conclusion, Nivaana regains control without relying on a PhonePe full-page return.
4. Nivaana verifies payment through the backend.
5. Successful payments navigate to `/payments`.
6. The corresponding payment and order are visible.
7. The customer can navigate from Payments to the matching order.
8. Closing the browser/app after payment does not prevent order creation.
9. A customer network failure after payment does not prevent order creation.
10. Duplicate webhook/status/task execution creates only one order.
11. Mobile App behavior remains unchanged.
12. Inventory/In-store behavior remains unchanged.
13. Full-page redirect remains available when iframe initialization is unavailable.

## 17. Known limitations

- Instagram/Facebook controls the In-App Browser and may change its behavior.
- UPI app switching may behave differently across device manufacturers and operating-system versions.
- Iframe mode must be tested with every payment instrument enabled for the merchant.
- A completely new external browser context cannot inherit Instagram's `localStorage` session.
- No browser-return mechanism can replace webhook/status verification.

## 18. Final recommendation

Implement PhonePe iframe checkout only for the E-commerce Web, protected by a feature flag and backed by the existing full-page redirect fallback.

Keep the current server-side webhook and Cloud Task reconciliation unchanged. They are responsible for payment/order integrity. Treat iframe completion and the Payments page only as the customer-facing presentation layer.

The target architecture is:

```text
Payment and order correctness → Backend webhook/status/Cloud Task
Customer return experience    → E-commerce Web iframe and Payments page
Mobile return experience      → Existing Mobile WebView/native handling
Inventory operations          → Existing Inventory workflows
```

This separation resolves the Meta In-App Browser UX problem without making Mobile App or In-store behavior dependent on the Web implementation.
