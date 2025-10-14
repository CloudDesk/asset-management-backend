# PhonePe SDK Token Extraction - Debug Guide

> **Debug logging added to identify why JWT token extraction is failing**

## 🔍 Current Status

**Symptom**: The endpoint is finding and extracting something, but getting error:

- ❌ "Token does not start with 'eyJ'"
- ❌ "Invalid JWT token format"

**This means**: We're extracting the wrong value from the PhonePe response.

---

## 🛠️ Debug Logging Added

I've added comprehensive debug logging at **3 critical points** in the `/v1/phonepe/create-sdk-order` endpoint:

### 1. **PhonePe API Response Debug**

```
=== PHONEPE API RESPONSE DEBUG ===
Full response.data: {
  "success": true,
  "code": "PAYMENT_INITIATED",
  "data": {
    "merchantId": "...",
    "merchantTransactionId": "...",
    "instrumentResponse": {
      "redirectInfo": {
        "url": "https://..."
      }
    }
  }
}
==================================
```

### 2. **Redirect URL Extraction Debug**

```
=== REDIRECT URL EXTRACTION ===
Extracted redirectUrl: https://mercury-uat.phonepe.com/transact/uat_v2?token=eyJ...
redirectUrl type: string
redirectUrl length: 350
================================
```

### 3. **Token Extraction Debug**

```
=== TOKEN EXTRACTION DEBUG ===
Full redirectUrl: https://mercury-uat.phonepe.com/transact/uat_v2?token=eyJhbGciOiJIUzI1NiIs...
All query parameters: { "token": "eyJhbGciOiJIUzI1NiIs..." }
Extracted token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Token length: 287
Token starts with eyJ? true
First 20 chars: eyJhbGciOiJIUzI1N
Last 20 chars: ...xyz123
============================
```

---

## 📊 What to Look For in Logs

### ✅ Success Scenario

If everything is working correctly, you should see:

```
=== TOKEN EXTRACTION DEBUG ===
Full redirectUrl: https://mercury-uat.phonepe.com/transact/uat_v2?token=eyJhbGciOiJIUzI1NiIs...
All query parameters: { "token": "eyJhbGciOiJIUzI1NiIs..." }
Extracted token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Token length: 250-350 (typical JWT length)
Token starts with eyJ? true  ✅
First 20 chars: eyJhbGciOiJIUzI1N
============================

✅ SDK order created successfully with valid JWT token
```

### ❌ Scenario 1: Getting Wrong Parameter

```
=== TOKEN EXTRACTION DEBUG ===
All query parameters: { "merchantId": "M123", "orderId": "ORD456" }
Extracted token: null
Token length: 0
Token starts with eyJ? false
============================
```

**Problem**: The `token` parameter doesn't exist in query params.

**Fix**: Check what parameters ARE in the URL and extract the correct one.

### ❌ Scenario 2: Getting Full URL Instead of Token

```
=== TOKEN EXTRACTION DEBUG ===
Extracted token: https://mercury-uat.phonepe.com/transact/uat_v2?token=eyJ...
Token length: 400
Token starts with eyJ? false (starts with 'https')
First 20 chars: https://mercury-uat
============================
```

**Problem**: We're not parsing the URL correctly.

**Fix**: Already implemented with `url.searchParams.get("token")`.

### ❌ Scenario 3: Getting merchantTransactionId

```
=== TOKEN EXTRACTION DEBUG ===
All query parameters: { "token": "TXN_1760425233419_PZW34O" }
Extracted token: TXN_1760425233419_PZW34O
Token length: 26
Token starts with eyJ? false
First 20 chars: TXN_1760425233419_P
============================
```

**Problem**: PhonePe is returning merchantTransactionId in the `token` parameter.

**Fix**: Need to check if there's a different URL or parameter with the actual JWT.

### ❌ Scenario 4: No redirectUrl in Response

```
=== PHONEPE API RESPONSE DEBUG ===
Full response.data: {
  "success": true,
  "code": "PAYMENT_INITIATED",
  "data": {
    "orderId": "OM123"
    // ❌ No instrumentResponse or redirectInfo
  }
}
==================================

❌ No redirectUrl in PhonePe response
```

**Problem**: PhonePe API isn't returning the payment URL.

**Fix**: Check if using wrong API endpoint or wrong request format.

---

## 🧪 Testing Steps

### 1. **Rebuild and Restart**

```bash
npm run build
npm start
```

### 2. **Make Test Request**

```bash
curl -X POST https://your-api.com/v1/phonepe/create-sdk-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "merchantOrderId": "TEST_DEBUG_123",
    "amount": 100,
    "userId": 1,
    "productIds": [40],
    "redirectUrl": "myapp://payment/callback",
    "transactionFor": "product_purchase"
  }'
```

### 3. **Check Server Logs**

Look for the three debug sections:

```bash
# Watch logs in real-time
tail -f server.log | grep -A 20 "=== PHONEPE API RESPONSE DEBUG ==="
tail -f server.log | grep -A 10 "=== TOKEN EXTRACTION DEBUG ==="
```

Or check console output directly if running in development mode.

---

## 📋 Expected vs Actual Comparison

### Expected (From Working `/v1/phonepe/initiate`)

Your `/v1/phonepe/initiate` endpoint returns:

```json
{
  "redirectUrl": "https://mercury-uat.phonepe.com/transact/uat_v2?token=eyJhbGciOiJIUzI1NiIs..."
}
```

The JWT token extracted from this URL is:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXJjaGFudElkIjoiUEdURVNUUEFZVUFUODYi...
```

**This is exactly what `/v1/phonepe/create-sdk-order` should return as `orderToken`.**

### What We're Currently Getting

Once you run the test, check the logs and compare:

| What We Expect                 | What We're Getting | Status |
| ------------------------------ | ------------------ | ------ |
| redirectUrl contains JWT token | Check logs →       | ❓     |
| Query param named `token`      | Check logs →       | ❓     |
| Token starts with `eyJ`        | Check logs →       | ❓     |
| Token length 200-400 chars     | Check logs →       | ❓     |

---

## 🎯 Next Steps

### Step 1: Run the Test

Make a request to `/v1/phonepe/create-sdk-order` and check the logs.

### Step 2: Share Debug Output

Copy and paste the **three debug sections** from your logs:

1. `=== PHONEPE API RESPONSE DEBUG ===`
2. `=== REDIRECT URL EXTRACTION ===`
3. `=== TOKEN EXTRACTION DEBUG ===`

### Step 3: Analyze Results

Based on the debug output, we can determine:

- ✅ **If PhonePe is returning the redirectUrl correctly**
- ✅ **What query parameters exist in the URL**
- ✅ **What value we're actually extracting**
- ✅ **Why it's not a valid JWT token**

---

## 🔧 Possible Fixes

### Fix 1: Different Query Parameter Name

If logs show:

```
All query parameters: { "authToken": "eyJ...", "orderId": "123" }
```

**Fix**: Change from `get("token")` to `get("authToken")`:

```typescript
jwtToken = url.searchParams.get("authToken"); // Instead of "token"
```

### Fix 2: Token in Different Location

If logs show no `token` in query params, check response structure:

```typescript
// Maybe token is directly in response data
const jwtToken = response.data.data?.token;
// Or in a different nested path
const jwtToken = response.data.data?.paymentToken;
```

### Fix 3: Need Different API Endpoint

If PhonePe isn't returning a payment URL at all, we might need to call a different endpoint specifically for mobile SDK orders.

### Fix 4: URL Encoding Issue

If token looks weird, might be URL-encoded:

```typescript
jwtToken = decodeURIComponent(url.searchParams.get("token") || "");
```

---

## 📞 Comparison with Working Endpoint

Let's compare the two approaches:

### Working: `/v1/phonepe/initiate`

```typescript
// Makes PhonePe API call
const response = await axios.post(
  apiUrl,
  { request: payloadMain },
  { headers }
);

// Extracts redirectUrl
const redirectUrl = response.data.data?.instrumentResponse?.redirectInfo?.url;

// Returns to frontend
return { redirectUrl }; // Frontend extracts token from this URL
```

**Result**: Frontend successfully extracts JWT and uses it ✅

### Broken: `/v1/phonepe/create-sdk-order`

```typescript
// Makes SAME PhonePe API call
const response = await axios.post(
  apiUrl,
  { request: payloadMain },
  { headers }
);

// Extracts SAME redirectUrl
const redirectUrl = response.data.data?.instrumentResponse?.redirectInfo?.url;

// Extracts token from URL
const url = new URL(redirectUrl);
const jwtToken = url.searchParams.get("token");

// Returns token
return { orderToken: jwtToken }; // Should be same JWT as frontend gets
```

**Expected Result**: Should get same JWT token that frontend gets from `/v1/phonepe/initiate` ✅

---

## 🎯 Quick Verification

To quickly verify if our approach is correct, temporarily modify the endpoint to return the raw redirectUrl:

```typescript
// Temporary debug modification
return {
  success: true,
  message: "DEBUG: Returning raw redirectUrl",
  orderToken: redirectUrlFromPhonePe, // Return full URL temporarily
  // Then frontend can manually extract token to verify it's correct
};
```

If the frontend can successfully extract a valid JWT from this URL, then we know the URL is correct and just need to fix our extraction logic.

---

## 📊 Debug Checklist

- [ ] Rebuild backend (`npm run build`)
- [ ] Restart server (`npm start`)
- [ ] Make test request to `/v1/phonepe/create-sdk-order`
- [ ] Check console output for debug logs
- [ ] Copy "=== PHONEPE API RESPONSE DEBUG ===" section
- [ ] Copy "=== REDIRECT URL EXTRACTION ===" section
- [ ] Copy "=== TOKEN EXTRACTION DEBUG ===" section
- [ ] Share debug output for analysis
- [ ] Identify what's different from expected
- [ ] Apply appropriate fix
- [ ] Re-test and verify token starts with `eyJ`

---

## 🎉 Success Criteria

After the fix, you should see:

```
=== TOKEN EXTRACTION DEBUG ===
Full redirectUrl: https://mercury-uat.phonepe.com/transact/uat_v2?token=eyJhbGciOiJIUzI1NiIs...
All query parameters: { "token": "eyJhbGciOiJIUzI1NiIs..." }
Extracted token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Token length: 287
Token starts with eyJ? true  ✅
First 20 chars: eyJhbGciOiJIUzI1N
============================

✅ SDK order created successfully with valid JWT token
```

And the API response:

```json
{
  "success": true,
  "message": "SDK order created successfully",
  "data": {
    "orderToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "orderId": "TEST_DEBUG_123"
  }
}
```

---

**Ready to test!** 🚀

Run the test request and share the debug logs to identify the exact issue.
