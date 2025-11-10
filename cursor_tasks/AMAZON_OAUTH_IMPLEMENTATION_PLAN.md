# Amazon SP-API OAuth Implementation Plan
## Step-by-Step Breakdown

**Version:** 1.0  
**Date:** January 2025  
**Status:** Implementation in Progress

---

## 📋 Implementation Overview

This plan breaks down the OAuth integration into manageable steps, implementing one at a time.

---

## 🎯 Complete Task List

### **Phase 1: Database Setup** ✅ Step 1 (In Progress)

#### **Step 1: Create Database Schema for Amazon Connections**
- [x] Add `AmazonConnection` model to Prisma schema
- [ ] Run Prisma migration
- [ ] Generate Prisma client

**Files to Modify:**
- `prisma/schema.prisma` - Add AmazonConnection model

**Deliverable:** Database table ready to store refresh tokens

---

### **Phase 2: OAuth Service Methods**

#### **Step 2: Add OAuth Methods to AmazonService**
- [ ] Add `generateOAuthUrl()` method
- [ ] Add `exchangeCodeForRefreshToken()` method
- [ ] Add `verifyState()` method (CSRF protection)
- [ ] Add state storage (in-memory Map or Redis)

**Files to Modify:**
- `src/services/amazon.service.ts`

**Deliverable:** OAuth URL generation and code exchange functionality

---

#### **Step 3: Update AmazonService for User-Specific Tokens**
- [ ] Add `getAccessTokenForUser(userId)` method
- [ ] Add user-specific access token cache (Map<userId, token>)
- [ ] Update `refreshAccessToken()` to accept refresh token parameter
- [ ] Add `callSpApiForUser()` method
- [ ] Update existing methods to support both old (env) and new (user-specific) flows

**Files to Modify:**
- `src/services/amazon.service.ts`

**Deliverable:** Service supports both single-token (env) and multi-user token flows

---

### **Phase 3: User Service Methods**

#### **Step 4: Create UserService Methods for Token Storage**
- [ ] Add `storeAmazonRefreshToken(userId, refreshToken, sellerId)` method
- [ ] Add `getAmazonRefreshToken(userId)` method
- [ ] Add `getAmazonConnection(userId)` method
- [ ] Add token encryption/decryption utilities
- [ ] Add `deleteAmazonConnection(userId)` method (for disconnect)

**Files to Create/Modify:**
- `src/services/users.service.ts` (or create new `src/services/amazon-user.service.ts`)

**Deliverable:** Methods to securely store and retrieve refresh tokens

---

### **Phase 4: OAuth Controller Methods**

#### **Step 5: Add OAuth Controller Methods**
- [ ] Add `initiateOAuth()` method
- [ ] Add `handleOAuthCallback()` method
- [ ] Add error handling for expired tokens
- [ ] Add validation for state parameter

**Files to Modify:**
- `src/controllers/amazon.controller.ts`

**Deliverable:** Controller methods for OAuth flow

---

### **Phase 5: OAuth Routes**

#### **Step 6: Add OAuth Routes**
- [ ] Add `POST /v1/amazon/auth/initiate` route
- [ ] Add `POST /v1/amazon/auth/callback` route
- [ ] Add route schemas (request/response validation)
- [ ] Ensure routes are protected (require authentication)

**Files to Modify:**
- `src/routes/amazon.route.ts`

**Deliverable:** OAuth endpoints accessible via API

---

### **Phase 6: Update Existing Methods**

#### **Step 7: Update Existing Controller Methods**
- [ ] Update `getProducts()` to use user-specific tokens
- [ ] Update `getOrders()` to use user-specific tokens
- [ ] Update `updateInventory()` to use user-specific tokens
- [ ] Update all other methods to use user-specific tokens
- [ ] Add error handling for missing connections
- [ ] Add error handling for expired refresh tokens

**Files to Modify:**
- `src/controllers/amazon.controller.ts`
- `src/services/amazon.service.ts`

**Deliverable:** All existing endpoints work with user-specific tokens

---

### **Phase 7: Token Encryption**

#### **Step 8: Add Token Encryption Utilities**
- [ ] Create encryption utility (using crypto or library)
- [ ] Add encryption key to environment variables
- [ ] Implement encrypt/decrypt functions
- [ ] Update UserService to use encryption

**Files to Create:**
- `src/utils/encryption.util.ts` (or similar)

**Files to Modify:**
- `src/config/env.ts` - Add encryption key
- `src/services/users.service.ts` - Use encryption

**Deliverable:** Refresh tokens encrypted at rest

---

### **Phase 8: Testing & Validation**

#### **Step 9: Testing**
- [ ] Test OAuth initiation flow
- [ ] Test OAuth callback flow
- [ ] Test token storage and retrieval
- [ ] Test user-specific API calls
- [ ] Test token refresh mechanism
- [ ] Test expired token handling
- [ ] Test error scenarios

**Deliverable:** All flows tested and working

---

## 🚀 Implementation Order

```
Step 1: Database Schema ✅ (In Progress)
  ↓
Step 2: OAuth Service Methods
  ↓
Step 3: User-Specific Token Support
  ↓
Step 4: UserService Token Methods
  ↓
Step 5: OAuth Controller Methods
  ↓
Step 6: OAuth Routes
  ↓
Step 7: Update Existing Methods
  ↓
Step 8: Token Encryption
  ↓
Step 9: Testing
```

---

## 📝 Detailed Step 1: Database Schema

### **What We're Adding:**

```prisma
model AmazonConnection {
  id            Int      @id @default(autoincrement())
  userId        Int      // References inventoryusers.id or users.id
  sellerId      String   @db.VarChar(255)
  refreshToken  String   @db.Text // Encrypted
  marketplaceId String   @default("A21TJRUUN4KGV") @db.VarChar(50)
  createdAt     BigInt?
  updatedAt     BigInt?
  
  @@unique([userId, sellerId])
  @@index([userId])
  @@map("amazon_connections")
}
```

### **Why:**
- Store refresh tokens per user
- Store seller ID for API calls
- Support multiple sellers per user (future)
- Track connection metadata

---

## ✅ Next Steps After Step 1

1. **Step 2:** Add OAuth URL generation
2. **Step 3:** Add user-specific token methods
3. **Step 4:** Add token storage methods
4. **Step 5:** Add controller methods
5. **Step 6:** Add routes

---

**Document Version:** 1.0  
**Last Updated:** January 2025

