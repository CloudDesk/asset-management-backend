# Amazon SP-API Implementation Status
## Progress Report: Steps 1-3

**Version:** 1.0  
**Date:** January 2025  
**Status:** Steps 1-3 Completed ✅

---

## 📊 Implementation Summary

| Step | Status | Description | Files Modified |
|------|--------|-------------|----------------|
| **Step 1** | ✅ **COMPLETED** | Database schema for Amazon connections | `prisma/schema.prisma` |
| **Step 2** | ✅ **COMPLETED** | OAuth methods in AmazonService | `src/services/amazon.service.ts` |
| **Step 3** | ✅ **COMPLETED** | User-specific token support | `src/services/amazon.service.ts` |
| **Step 4** | ⏳ **PENDING** | UserService methods for token storage | `src/services/users.service.ts` |
| **Step 5** | ⏳ **PENDING** | OAuth controller methods | `src/controllers/amazon.controller.ts` |
| **Step 6** | ⏳ **PENDING** | OAuth routes | `src/routes/amazon.route.ts` |
| **Step 7** | ⏳ **PENDING** | Update existing controller methods | `src/controllers/amazon.controller.ts` |
| **Step 8** | ⏳ **PENDING** | Token encryption utilities | `src/utils/encryption.util.ts` |

---

## ✅ Step 1: Database Schema (COMPLETED)

### **What Was Implemented:**

1. **Prisma Schema Updated:**
   - Added `AmazonConnection` model to `prisma/schema.prisma`
   - Fields: `id`, `userId`, `userType`, `sellerId`, `refreshToken`, `marketplaceId`, `createdAt`, `updatedAt`
   - Unique constraint: `(userId, sellerId, userType)`
   - Indexes: `(userId, userType)`, `sellerId`
   - Relations to `inventoryusers` and `users` models

2. **SQL Table Created:**
   - Table: `amazon_connections`
   - User manually created the table using provided SQL

### **Database Schema:**
```prisma
model AmazonConnection {
  id            Int      @id @default(autoincrement())
  userId        Int
  userType      String   @default("inventoryusers") @db.VarChar(50)
  sellerId      String   @db.VarChar(255)
  refreshToken  String   @db.Text // Encrypted
  marketplaceId String   @default("A21TJRUUN4KGV") @db.VarChar(50)
  createdAt     BigInt?
  updatedAt     BigInt?
  
  @@unique([userId, sellerId, userType])
  @@index([userId, userType])
  @@index([sellerId])
  @@map("amazon_connections")
}
```

### **Files Modified:**
- ✅ `prisma/schema.prisma` - Added AmazonConnection model and relations

### **Deliverable Status:**
✅ **COMPLETE** - Database table ready to store refresh tokens

---

## ✅ Step 2: OAuth Methods (COMPLETED)

### **What Was Implemented:**

1. **OAuth URL Generation:**
   - `generateOAuthUrl()` - Generates Amazon OAuth authorization URL
   - Stores state with userId for CSRF protection (10-minute expiration)
   - Configurable Seller Central URL

2. **State Verification:**
   - `verifyState()` - Validates state parameter (CSRF protection)
   - Checks expiration, verifies userId match
   - One-time use (deleted after verification)

3. **Code Exchange:**
   - `exchangeCodeForRefreshToken()` - Exchanges authorization code for refresh token
   - Handles `invalid_grant` errors
   - Gets seller ID from access token (with fallback)

4. **Helper Methods:**
   - `generateRandomState()` - Generates cryptographically secure random state
   - `getSellerIdFromToken()` - Gets seller ID from access token
   - `cleanupExpiredStates()` - Cleans up expired states

5. **State Storage:**
   - In-memory Map with expiration tracking
   - Automatic cleanup of expired states

### **Methods Added:**
```typescript
// OAuth Flow Methods
generateOAuthUrl(params: { redirectUri, state, userId }): string
verifyState(state: string, userId: number): boolean
exchangeCodeForRefreshToken(params: { code, redirectUri }): Promise<{ refreshToken, sellerId }>
generateRandomState(): string
private getSellerIdFromToken(accessToken: string): Promise<string>
private cleanupExpiredStates(): void
```

### **Environment Variables Added:**
- ✅ `AMAZON_SELLER_CENTRAL_URL` (default: `https://sellercentral.amazon.in`)
- ✅ `AMAZON_REDIRECT_URI` (optional)

### **Files Modified:**
- ✅ `src/services/amazon.service.ts` - Added OAuth methods
- ✅ `src/config/env.ts` - Added environment variables

### **Deliverable Status:**
✅ **COMPLETE** - OAuth URL generation and code exchange functionality

---

## ✅ Step 3: User-Specific Token Support (COMPLETED)

### **What Was Implemented:**

1. **User-Specific Access Token Management:**
   - `getAccessTokenForUser(userId, refreshToken)` - Gets/refreshes access token for a user
   - User-specific access token cache (Map<userId, { token, expiresAt }>)
   - Auto-refresh 5 minutes before expiry (55-minute cache)

2. **Token Refresh:**
   - `refreshAccessTokenForUser(refreshToken)` - Refreshes access token using provided refresh token
   - Handles `invalid_grant` error (returns `REFRESH_TOKEN_EXPIRED`)
   - Updated legacy `refreshAccessToken()` to use new method

3. **User-Specific API Calls:**
   - `callSpApiForUser(userId, refreshToken, config)` - Makes SP-API calls for a specific user
   - Automatically handles token refresh
   - Proper error handling with `REFRESH_TOKEN_EXPIRED` detection

4. **Convenience Methods:**
   - `getProductsForUser()` - Get products for a user
   - `getOrdersForUser()` - Get orders for a user
   - `updateInventoryForUser()` - Update inventory for a user

5. **Cache Management:**
   - `clearUserTokenCache(userId)` - Clears access token cache for a user

### **Methods Added:**
```typescript
// User-Specific Token Methods
async getAccessTokenForUser(userId: number, refreshToken: string): Promise<string>
async refreshAccessTokenForUser(refreshToken: string): Promise<string>
async callSpApiForUser<T>(userId: number, refreshToken: string, config: AxiosRequestConfig): Promise<T>
async getProductsForUser(userId, refreshToken, sellerId, marketplaceId?): Promise<any>
async getOrdersForUser(userId, refreshToken, marketplaceId?, createdAfter?, createdBefore?, orderStatuses?): Promise<any>
async updateInventoryForUser(userId, refreshToken, sellerId, sku, quantity, fulfillmentChannelCode?): Promise<any>
clearUserTokenCache(userId: number): void
```

### **Backward Compatibility:**
- ✅ Legacy `getAccessToken()` still works (uses env variable)
- ✅ Legacy `refreshAccessToken()` still works (uses env variable)
- ✅ Existing methods (`getProducts()`, `getOrders()`, etc.) still work
- ✅ New user-specific methods available for multi-user support

### **Files Modified:**
- ✅ `src/services/amazon.service.ts` - Added user-specific token methods

### **Deliverable Status:**
✅ **COMPLETE** - Service supports both single-token (env) and multi-user token flows

---

## 📋 Reference: Master Guide Mapping

### **From `AMAZON_COMPLETE_INTEGRATION_GUIDE.md`:**

#### **PHASE 1: Initial OAuth Connection**
- ✅ **Step 2:** Backend generates OAuth URL → `generateOAuthUrl()` ✅
- ✅ **Step 5:** Backend exchanges code for refresh token → `exchangeCodeForRefreshToken()` ✅
- ⏳ **Step 6:** Store refresh token in database → **Step 4 (PENDING)**

#### **PHASE 2: Data Access**
- ✅ **Step 2:** Backend gets refresh token & access token → `getAccessTokenForUser()` ✅
- ✅ **Step 3:** Backend makes SP-API calls → `callSpApiForUser()` ✅
- ⏳ **Step 1:** Backend gets refresh token from database → **Step 4 (PENDING)**

#### **PHASE 3: Token Refresh & Re-connection**
- ✅ Token refresh logic → `refreshAccessTokenForUser()` ✅
- ✅ `invalid_grant` error handling → Returns `REFRESH_TOKEN_EXPIRED` ✅
- ⏳ Database retrieval of refresh token → **Step 4 (PENDING)**

---

## 🎯 What's Next: Step 4

### **Step 4: Create UserService Methods for Token Storage**

**What Needs to Be Implemented:**

1. **Token Storage Methods:**
   - `storeAmazonRefreshToken(userId, refreshToken, sellerId, userType?)` - Store/update refresh token
   - `getAmazonRefreshToken(userId, userType?)` - Get refresh token (decrypted)
   - `getAmazonConnection(userId, userType?)` - Get full connection data
   - `deleteAmazonConnection(userId, userType?)` - Delete connection (disconnect)

2. **Token Encryption/Decryption:**
   - Encrypt refresh token before storing
   - Decrypt refresh token when retrieving
   - Use encryption utility (Step 8) or simple implementation

3. **Database Operations:**
   - Use Prisma to interact with `amazon_connections` table
   - Handle both `inventoryusers` and `users` user types
   - Upsert logic (create or update)

**Files to Create/Modify:**
- `src/services/users.service.ts` - Add Amazon connection methods
- OR create `src/services/amazon-user.service.ts` - New service for Amazon user operations

**Deliverable:**
- Methods to securely store and retrieve refresh tokens from database

---

## 📝 Implementation Notes

### **Current Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│ AmazonService (Steps 2-3 Complete)                      │
├─────────────────────────────────────────────────────────┤
│ ✅ OAuth Methods                                        │
│   - generateOAuthUrl()                                  │
│   - verifyState()                                        │
│   - exchangeCodeForRefreshToken()                        │
│                                                          │
│ ✅ User-Specific Token Methods                           │
│   - getAccessTokenForUser()                              │
│   - refreshAccessTokenForUser()                         │
│   - callSpApiForUser()                                   │
│                                                          │
│ ✅ Legacy Methods (Backward Compatible)                 │
│   - getAccessToken()                                     │
│   - refreshAccessToken()                                 │
│   - getProducts(), getOrders(), etc.                    │
└─────────────────────────────────────────────────────────┘
                        ↓ (needs)
┌─────────────────────────────────────────────────────────┐
│ UserService (Step 4 - PENDING)                          │
├─────────────────────────────────────────────────────────┤
│ ⏳ storeAmazonRefreshToken()                              │
│ ⏳ getAmazonRefreshToken()                               │
│ ⏳ getAmazonConnection()                                 │
│ ⏳ deleteAmazonConnection()                              │
└─────────────────────────────────────────────────────────┘
                        ↓ (uses)
┌─────────────────────────────────────────────────────────┐
│ Database: amazon_connections (Step 1 - COMPLETE)         │
└─────────────────────────────────────────────────────────┘
```

### **Token Flow (Current Implementation):**

```
User Request
  ↓
Controller (Step 5 - PENDING)
  ↓
UserService.getAmazonRefreshToken() (Step 4 - PENDING)
  ↓
AmazonService.getAccessTokenForUser(userId, refreshToken) ✅
  ↓
AmazonService.callSpApiForUser() ✅
  ↓
Amazon SP-API
```

### **OAuth Flow (Current Implementation):**

```
Frontend: Connect Amazon
  ↓
Controller.initiateOAuth() (Step 5 - PENDING)
  ↓
AmazonService.generateOAuthUrl() ✅
  ↓
Amazon Seller Central
  ↓
Frontend: Callback with code
  ↓
Controller.handleOAuthCallback() (Step 5 - PENDING)
  ↓
AmazonService.exchangeCodeForRefreshToken() ✅
  ↓
UserService.storeAmazonRefreshToken() (Step 4 - PENDING)
  ↓
Database: amazon_connections ✅
```

---

## 🔑 Key Implementation Details

### **1. State Management:**
- **Storage:** In-memory Map (can be moved to Redis later)
- **Expiration:** 10 minutes
- **Cleanup:** Automatic on each `generateOAuthUrl()` call

### **2. Access Token Caching:**
- **Storage:** In-memory Map per user
- **Expiration:** 55 minutes (refresh before 1-hour expiry)
- **Key:** `userId.toString()`
- **Value:** `{ token: string, expiresAt: number }`

### **3. Error Handling:**
- **`REFRESH_TOKEN_EXPIRED`:** Thrown when Amazon returns `invalid_grant`
- **Propagated:** Through `callSpApiForUser()` to controllers
- **Handling:** Controllers should return 401 with `requiresReconnect: true`

### **4. Backward Compatibility:**
- All existing methods still work
- Legacy methods use environment variables
- New methods accept refresh token as parameter
- Both flows can coexist

---

## ✅ Testing Checklist (For Steps 1-3)

### **Step 1: Database**
- [x] Table created in database
- [x] Schema matches Prisma model
- [x] Indexes created
- [x] Unique constraint working

### **Step 2: OAuth Methods**
- [ ] `generateOAuthUrl()` generates valid URL
- [ ] State parameter stored correctly
- [ ] `verifyState()` validates correctly
- [ ] `exchangeCodeForRefreshToken()` exchanges code (requires actual OAuth flow)
- [ ] Error handling works (`invalid_grant` detection)

### **Step 3: User-Specific Tokens**
- [ ] `getAccessTokenForUser()` caches tokens correctly
- [ ] `refreshAccessTokenForUser()` refreshes tokens
- [ ] `callSpApiForUser()` makes API calls
- [ ] `REFRESH_TOKEN_EXPIRED` error thrown correctly
- [ ] Cache expiration works (55 minutes)
- [ ] `clearUserTokenCache()` clears cache

---

## 📚 Related Documentation

- **Master Guide:** `cursor_tasks/AMAZON_COMPLETE_INTEGRATION_GUIDE.md`
- **Implementation Plan:** `cursor_tasks/AMAZON_OAUTH_IMPLEMENTATION_PLAN.md`
- **Service File:** `src/services/amazon.service.ts`
- **Schema File:** `prisma/schema.prisma`

---

## 🚀 Next Steps

1. **Step 4:** Implement UserService methods for token storage
2. **Step 5:** Add OAuth controller methods
3. **Step 6:** Add OAuth routes
4. **Step 7:** Update existing controller methods
5. **Step 8:** Add token encryption utilities

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Steps 1-3 Complete ✅

