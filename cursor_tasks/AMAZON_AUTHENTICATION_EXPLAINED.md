# Amazon SP-API Authentication Explained

## 🤔 Your Question

> "Do we always need to include an access token? I'm getting responses even though I didn't generate a new token today. How is this happening?"

## ✅ The Answer: **NO, You DON'T Need to Manually Include Access Tokens!**

The **Amazon SP-API SDK handles ALL authentication automatically**. You never need to manually:
- ❌ Include access tokens in API calls
- ❌ Pass tokens in headers
- ❌ Check if tokens are expired
- ❌ Manually refresh tokens
- ❌ Store tokens in your database

---

## 🔄 How It Actually Works

### 1. **SDK Initialization (One-Time Setup)**

When your service starts, the SDK is initialized with your **refresh token** (not access token):

```typescript
// src/services/amazon.service.ts
private getAuth(): SellingPartnerApiAuth {
  if (!this.auth) {
    this.auth = new SellingPartnerApiAuth({
      clientId: env.AMAZON_CLIENT_ID,
      clientSecret: env.AMAZON_CLIENT_SECRET,
      refreshToken: env.AMAZON_REFRESH_TOKEN,  // ← This is the KEY!
    });
  }
  return this.auth;
}
```

**Key Point:** The SDK stores your **refresh token** (which doesn't expire) and uses it to automatically get **access tokens** when needed.

---

### 2. **API Clients Share the Same Auth Instance**

All your API clients (Listings, Orders, Catalog, etc.) share the same auth instance:

```typescript
// All clients use the same auth instance
const listingsClient = new ListingsItemsApiClient({
  auth: this.getAuth(),  // ← Same auth instance
  region: 'eu',
});

const ordersClient = new OrdersApiClient({
  auth: this.getAuth(),  // ← Same auth instance
  region: 'eu',
});
```

---

### 3. **What Happens When You Make an API Call**

When you call any API method, here's what the SDK does **automatically**:

```typescript
// You just call the API - no tokens needed!
const response = await listingsClient.getListingsItem({
  sellerId: 'APCBEZW09ZM60',
  sku: 'NH-94PT-UFLF',
  marketplaceIds: ['A21TJRUUN4KGV'],
});

// Behind the scenes, the SDK:
// 1. Checks if there's a cached access token
// 2. If token exists and is valid → uses it
// 3. If token is expired/missing → automatically calls:
//    POST https://api.amazon.com/auth/o2/token
//    with your refresh_token to get a NEW access token
// 4. Caches the new access token internally
// 5. Adds the token to the request header: x-amz-access-token
// 6. Makes the API call
// 7. Returns the response
```

---

## 🎯 Why Your Swagger Calls Work Without Manual Authorization

### Scenario: You Generated a Token Yesterday

**What You Think Happens:**
1. Yesterday: Generated token (expires in 1 hour)
2. Today: Token expired → Should need new token
3. But: Swagger calls still work! 🤔

**What Actually Happens:**

```
┌─────────────────────────────────────────────────────────┐
│  Your Swagger Request                                    │
│  GET /v1/amazon/listings/APCBEZW09ZM60                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Controller: getAllListingsItems()                      │
│  → Calls: amazonService.searchListingsItems()           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Service: searchListingsItems()                         │
│  → Calls: listingsClient.searchListingsItems()          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  SDK: ListingsItemsApiClient.searchListingsItems()     │
│                                                          │
│  Step 1: Check cached access token                      │
│    → Token expired or missing?                          │
│                                                          │
│  Step 2: Automatically refresh token                    │
│    → Uses refresh_token from env                        │
│    → Calls: POST /auth/o2/token                         │
│    → Gets NEW access token                              │
│    → Caches it internally                               │
│                                                          │
│  Step 3: Add token to request                           │
│    → Header: x-amz-access-token: Atza|NEW_TOKEN...      │
│                                                          │
│  Step 4: Make API call                                   │
│    → GET /listings/2021-08-01/items/...                 │
│                                                          │
│  Step 5: Return response                                 │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Response sent to Swagger                               │
│  (You never see the token refresh happening!)           │
└─────────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ The SDK **automatically refreshes** the token when needed
- ✅ This happens **transparently** - you don't see it
- ✅ No manual authorization needed in Swagger
- ✅ The refresh happens **before** the API call is made

---

## 📊 Token Lifecycle

### Access Token (Short-Lived)
- **Lifetime:** 1 hour (3600 seconds)
- **Purpose:** Used to authenticate SP-API calls
- **Storage:** Cached internally by SDK (in memory)
- **Refresh:** Automatically refreshed by SDK when expired

### Refresh Token (Long-Lived)
- **Lifetime:** Does not expire (unless revoked)
- **Purpose:** Used to get new access tokens
- **Storage:** In your `.env` file (`AMAZON_REFRESH_TOKEN`)
- **Usage:** SDK uses it automatically when access token expires

### Token Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Initial Setup (One Time)                                   │
│  ─────────────────────────────────────────────────────────  │
│  Refresh Token (from .env)                                  │
│  ↓                                                          │
│  SDK Initialization                                         │
│  SellingPartnerApiAuth({ refreshToken: '...' })            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  First API Call                                             │
│  ─────────────────────────────────────────────────────────  │
│  SDK checks: Is there a cached access token?                │
│  → No                                                       │
│  ↓                                                          │
│  SDK automatically calls:                                    │
│  POST /auth/o2/token                                        │
│  { grant_type: 'refresh_token', refresh_token: '...' }     │
│  ↓                                                          │
│  Gets access token (valid for 1 hour)                       │
│  ↓                                                          │
│  Caches token internally                                    │
│  ↓                                                          │
│  Adds token to request header                               │
│  ↓                                                          │
│  Makes API call                                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  Subsequent API Calls (Within 1 Hour)                       │
│  ─────────────────────────────────────────────────────────  │
│  SDK checks: Is there a cached access token?                │
│  → Yes, and it's still valid                                │
│  ↓                                                          │
│  Uses cached token directly                                 │
│  ↓                                                          │
│  Adds token to request header                               │
│  ↓                                                          │
│  Makes API call                                             │
│  (No refresh needed - faster!)                              │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  After 1 Hour (Token Expired)                               │
│  ─────────────────────────────────────────────────────────  │
│  SDK checks: Is there a cached access token?                │
│  → Yes, but it's expired                                   │
│  ↓                                                          │
│  SDK automatically calls:                                    │
│  POST /auth/o2/token                                        │
│  { grant_type: 'refresh_token', refresh_token: '...' }     │
│  ↓                                                          │
│  Gets NEW access token                                      │
│  ↓                                                          │
│  Updates cache with new token                               │
│  ↓                                                          │
│  Adds new token to request header                           │
│  ↓                                                          │
│  Makes API call                                             │
│  (You never notice the refresh happened!)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 How to Verify This is Happening

### Check Your Server Logs

When the SDK refreshes a token, you might see logs like:

```
[INFO] Amazon SP-API SDK authentication initialized
[DEBUG] Amazon access token retrieved successfully (via SDK)
```

### Test Token Refresh

1. **Check current token:**
```bash
GET /v1/amazon/auth/token
```

2. **Wait 1 hour** (or manually expire the token)

3. **Make any API call:**
```bash
GET /v1/amazon/listings/APCBEZW09ZM60
```

4. **Check token again:**
```bash
GET /v1/amazon/auth/token
```

You'll see a **different access token** - proving the SDK refreshed it automatically!

---

## 💡 Key Takeaways

### ✅ What You DON'T Need to Do

1. ❌ **Don't manually include access tokens** in API calls
2. ❌ **Don't check token expiry** before making calls
3. ❌ **Don't manually refresh tokens** when they expire
4. ❌ **Don't store access tokens** in your database
5. ❌ **Don't pass tokens in Swagger** authorization headers

### ✅ What the SDK Does Automatically

1. ✅ **Caches access tokens** internally (in memory)
2. ✅ **Checks token validity** before each API call
3. ✅ **Automatically refreshes** expired tokens using refresh token
4. ✅ **Adds tokens to headers** (`x-amz-access-token`) automatically
5. ✅ **Handles all authentication** transparently

### ✅ What You DO Need

1. ✅ **Refresh Token** in `.env` file (`AMAZON_REFRESH_TOKEN`)
2. ✅ **Client ID** in `.env` file (`AMAZON_CLIENT_ID`)
3. ✅ **Client Secret** in `.env` file (`AMAZON_CLIENT_SECRET`)
4. ✅ **SDK initialized** with these credentials (done automatically)

---

## 🎯 Real-World Example

### Your Swagger Test Flow

```bash
# 1. You call this in Swagger (NO authorization needed)
GET /v1/amazon/listings/APCBEZW09ZM60

# 2. Behind the scenes:
#    - Controller receives request
#    - Service calls: listingsClient.searchListingsItems()
#    - SDK checks: "Do I have a valid access token?"
#    - If expired: SDK automatically calls refresh endpoint
#    - SDK gets new token and caches it
#    - SDK adds token to request: x-amz-access-token: Atza|...
#    - SDK makes API call to Amazon
#    - Amazon validates token and returns data
#    - Response sent back to Swagger

# 3. You see the response (never knowing a token refresh happened!)
```

---

## 🔐 Security Notes

### Why This is Secure

1. **Refresh Token is Secure:**
   - Stored in `.env` file (not in code)
   - Never exposed in API responses
   - Only used server-side

2. **Access Tokens are Short-Lived:**
   - Expire in 1 hour
   - Cached in memory (not persisted)
   - Automatically refreshed when needed

3. **No Manual Token Handling:**
   - Reduces risk of token leakage
   - No tokens in logs (unless you log them)
   - SDK handles all security best practices

---

## 📝 Summary

| Question | Answer |
|----------|--------|
| **Do I need to include access tokens manually?** | ❌ **NO** - SDK handles it automatically |
| **Do I need to refresh tokens manually?** | ❌ **NO** - SDK refreshes automatically |
| **Why do my Swagger calls work without authorization?** | ✅ SDK automatically adds tokens to requests |
| **What happens when token expires?** | ✅ SDK automatically gets a new one using refresh token |
| **Do I need to store access tokens?** | ❌ **NO** - SDK caches them internally |
| **What do I need in .env?** | ✅ Refresh token, Client ID, Client Secret |

---

## 🚀 Bottom Line

**You never need to think about access tokens!**

The SDK is like a **smart assistant** that:
- Remembers your refresh token
- Gets access tokens when needed
- Refreshes them automatically
- Adds them to requests
- Handles everything transparently

**Just make your API calls - the SDK handles the rest!** 🎉

---

## 📚 Related Documentation

- **Setup Guide:** `cursor_tasks/Amazon Setup.md`
- **API Routes:** `cursor_tasks/AMAZON_API_ROUTES.md`
- **SDK Explanation:** `cursor_tasks/AMAZON_SDK_PACKAGES_EXPLANATION.md`

