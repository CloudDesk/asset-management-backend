# PhonePe SDK Integration Guide

This document describes the current PhonePe SDK integration, the fallbacks, and how to operate the `/v1/phonepe/initiate` and `/v1/phonepe/create-sdk-order` flows.

---

## 1. Overview

- Uses the official **PhonePe Node SDK (`pg-sdk-node`)** when credentials are provided.
- Falls back to the proven **legacy REST integration** if the SDK is unavailable or disabled.
- No breaking changes to existing APIs – request/response formats are unchanged.
- Comprehensive logging, checksum validation and webhook signature checks are in place.

---

## 2. Configuration

Add the following environment variables. The service automatically chooses the correct path.

```env
# ========== SDK MODE ==========
PHONEPE_CLIENT_ID=<client_id_from_phonepe>
PHONEPE_CLIENT_SECRET=<client_secret_from_phonepe>
PHONEPE_CLIENT_VERSION=1
PHONEPE_ENVIRONMENT=SANDBOX   # or PRODUCTION
PHONEPE_USE_SDK=true          # set false to force legacy mode

# ========== LEGACY FALLBACK (used when SDK is disabled/missing) ==========
PHONEPE_MERCHANT_ID=PGTESTPAYUAT86
PHONEPE_SALT_KEY=96434309-7796-489d-8924-ab56988a6076
PHONEPE_BASE_URL=https://api-preprod.phonepe.com/apis/pg-sandbox

# ========== REDIRECTS ==========
REDIRECT_URL_SUCCESS=com.Nivaana.app://profile/orders
REDIRECT_URL_FAILURE=com.Nivaana.app://profile/orders
REDIRECT_URL_PAYMENT_STATUS=https://your-backend-url.com
```

**Priority order**

1. SDK mode (when `PHONEPE_CLIENT_ID` && `PHONEPE_CLIENT_SECRET` && `PHONEPE_USE_SDK=true`).
2. Legacy REST mode (automatic fallback).

---

## 3. Payment Initiation Flow

```mermaid
flowchart LR
  A[Client /v1/phonepe/initiate] --> B{Validate promotions & stock}
  B -->|pass| C[Lock platform stock (SELECT FOR UPDATE)]
  C --> D{SDK credentials?}
  D -->|yes| E[SDK pay()]
  D -->|no| F[Legacy REST /pg/v1/pay]
  E --> H[Store transaction]
  F --> H
  H --> I[Return redirectUrl or COD order data]
```

Logging shows whether SDK or legacy mode is used (`usingSDK: true/false`).

---

## 4. `createSdkOrder` Endpoint

The mobile SDK expects a **JWT order token**, not the raw PhonePe order ID. We reuse the initiation flow to guarantee compatibility:

1. Build the payload and checksum (same as `/v1/phonepe/initiate`).
2. Call PhonePe `/pg/v1/pay` directly.
3. Extract `redirectUrl` from the response.
4. Parse the `token` query parameter (JWT) from `redirectUrl`:

```typescript
const url = new URL(redirectUrlFromPhonePe);
const jwtToken = url.searchParams.get("token");
if (!jwtToken || !jwtToken.startsWith("eyJ")) {
  throw new Error("Invalid JWT token returned by PhonePe");
}
```

5. Return the JWT token to the React Native client:

```json
{
  "success": true,
  "message": "SDK order created successfully",
  "data": {
    "orderToken": "eyJhbGciOiJIUzI1..."
  }
}
```

### React Native usage

```javascript
const response = await fetch("/v1/phonepe/create-sdk-order", {...});
const { data: { orderToken } } = await response.json();
const result = await PhonePe.startTransaction(orderToken);
```

---

## 5. Logging & Monitoring

- `PhonePe SDK client initialized successfully` – SDK mode active.
- `Using legacy PhonePe integration` – SDK disabled/missing.
- `JWT token extraction attempt` – shows token presence/length (token contents are not logged).

Suggested metrics:

| Metric | Purpose |
| --- | --- |
| `sdk_mode_active` | Gauges SDK vs legacy usage |
| `phonepe_api_latency_ms` | Monitors external API performance |
| `sdk_order_token_failures` | Alerts on token extraction issues |

---

## 6. Troubleshooting

| Symptom | Action |
| --- | --- |
| SDK not initialising | Verify `PHONEPE_CLIENT_ID/SECRET` and `PHONEPE_USE_SDK`; check logs for initialization errors |
| Legacy path used unexpectedly | Ensure the env vars above are present; restart service |
| `orderToken` missing | Inspect server logs for `JWT token extraction` warnings; confirm PhonePe response contains `redirectUrl` |
| `ERR_CLEARTEXT_NOT_PERMITTED` on mobile | Ensure all redirect URLs use HTTPS or deep links (`com.Nivaana.app://`) |

---

## 7. Security Notes

- No credentials are logged or returned to clients.
- SHA-256 checksum is generated for every request to PhonePe.
- Webhook responses are validated via SDK signature or legacy checksum.
- Transactions are double-checked with PhonePe before order creation.

---

## 8. Deployment Checklist

1. Configure environment variables (above) for each environment.
2. Deploy the backend and restart to pick up env changes.
3. Test both `/v1/phonepe/initiate` and `/v1/phonepe/create-sdk-order` in sandbox.
4. Run the React Native flow and confirm redirect/token handling.
5. Monitor logs for unexpected fallbacks or token extraction errors.

---

## 9. Revision History

| Date | Change |
| --- | --- |
| 2025‑11‑05 | Consolidated SDK documentation and JWT extraction fix |
| 2024‑??‑?? | Initial integration using PhonePe SDK |


