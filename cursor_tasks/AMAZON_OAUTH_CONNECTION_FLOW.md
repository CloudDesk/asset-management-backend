# Amazon SP-API OAuth Connection Flow
## Industry-Standard Implementation Guide

**Version:** 1.0  
**Date:** January 2025  
**Use Case:** Dynamic OAuth connection for multiple sellers

---

## ✅ Your Approach is CORRECT!

Your described flow follows **industry-standard OAuth 2.0 best practices**. Here's the complete flow with clarifications:

---

## 🔄 Complete OAuth Flow (Step-by-Step)

### **Step 1: User Initiates Connection (Frontend)**

```
User clicks "Connect Amazon" button
  ↓
Frontend calls: POST /v1/amazon/auth/initiate
```

**Frontend Code:**
```typescript
const handleConnectAmazon = async () => {
  try {
    // Call backend to get OAuth URL
    const response = await axios.post('/v1/amazon/auth/initiate', {
      redirectUri: window.location.origin + '/amazon/callback',
      state: generateRandomState() // For security
    });
    
    // Redirect user to Amazon OAuth page
    window.location.href = response.data.authorizationUrl;
  } catch (error) {
    console.error('Failed to initiate Amazon connection:', error);
  }
};
```

---

### **Step 2: Backend Generates OAuth URL (Backend)**

**Backend Endpoint:**
```typescript
// POST /v1/amazon/auth/initiate
POST /v1/amazon/auth/initiate
Body: {
  redirectUri: "https://yourapp.com/amazon/callback",
  state: "random-state-string"
}

Response: {
  authorizationUrl: "https://sellercentral.amazon.in/apps/authorize/consent?application_id=...&state=...&redirect_uri=..."
}
```

**Backend Implementation:**
```typescript
// controllers/amazon.controller.ts
initiateOAuth = asyncHandler(async (request: FastifyRequest<{
  Body: { redirectUri: string; state?: string }
}>, reply: FastifyReply) => {
  const { redirectUri, state } = request.body;
  const userId = request.user.id; // From your auth middleware
  
  // Generate OAuth URL
  const authorizationUrl = this.amazonService.generateOAuthUrl({
    redirectUri,
    state: state || generateRandomState(),
    userId // Store state-user mapping for security
  });
  
  return reply.send({
    success: true,
    authorizationUrl
  });
});
```

---

### **Step 3: User Approves on Amazon (Amazon OAuth Page)**

```
User is redirected to Amazon Seller Central
  ↓
User logs into their Amazon Seller account
  ↓
User reviews permissions and clicks "Authorize"
  ↓
Amazon redirects back to your app with authorization code
```

**Amazon Redirects To:**
```
https://yourapp.com/amazon/callback?
  code=AUTHORIZATION_CODE&
  state=RANDOM_STATE
```

---

### **Step 4: Frontend Receives Authorization Code**

**Frontend Callback Page:**
```typescript
// pages/amazon/callback.tsx or app/amazon/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

export default function AmazonCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      
      if (error) {
        // Handle error
        console.error('Amazon authorization error:', error);
        router.push('/amazon/connect?error=' + error);
        return;
      }
      
      if (!code) {
        console.error('No authorization code received');
        router.push('/amazon/connect?error=no_code');
        return;
      }
      
      try {
        // Send authorization code to backend
        const response = await axios.post('/v1/amazon/auth/callback', {
          code,
          state
        });
        
        // Success! Redirect to success page
        router.push('/amazon/connect?success=true');
      } catch (error) {
        console.error('Failed to exchange code:', error);
        router.push('/amazon/connect?error=exchange_failed');
      }
    };
    
    handleCallback();
  }, [searchParams, router]);
  
  return (
    <div className="container">
      <h1>Connecting to Amazon...</h1>
      <p>Please wait while we complete the connection.</p>
    </div>
  );
}
```

---

### **Step 5: Backend Exchanges Code for Refresh Token**

**Backend Endpoint:**
```typescript
// POST /v1/amazon/auth/callback
POST /v1/amazon/auth/callback
Body: {
  code: "AUTHORIZATION_CODE",
  state: "RANDOM_STATE"
}

Response: {
  success: true,
  message: "Amazon account connected successfully"
}
```

**Backend Implementation:**
```typescript
// controllers/amazon.controller.ts
handleOAuthCallback = asyncHandler(async (request: FastifyRequest<{
  Body: { code: string; state: string }
}>, reply: FastifyReply) => {
  const { code, state } = request.body;
  const userId = request.user.id; // From your auth middleware
  
  // Verify state (security check)
  if (!this.amazonService.verifyState(state, userId)) {
    return reply.code(400).send({
      success: false,
      message: 'Invalid state parameter'
    });
  }
  
  // Exchange authorization code for refresh token
  const refreshToken = await this.amazonService.exchangeCodeForRefreshToken({
    code,
    redirectUri: process.env.AMAZON_REDIRECT_URI
  });
  
  // Store refresh token in database (NOT cache - needs persistence!)
  await this.userService.storeAmazonRefreshToken(userId, refreshToken);
  
  // Optionally: Get seller ID and store it
  const sellerInfo = await this.amazonService.getSellerInfo(refreshToken);
  await this.userService.storeAmazonSellerId(userId, sellerInfo.sellerId);
  
  return reply.send({
    success: true,
    message: 'Amazon account connected successfully'
  });
});
```

---

### **Step 6: Store Refresh Token (Database, NOT Cache!)**

**⚠️ CRITICAL: Store in Database, NOT Cache!**

**Why Database:**
- ✅ **Persistence:** Refresh tokens must survive server restarts
- ✅ **Security:** Database is more secure than cache
- ✅ **Multi-instance:** Works with multiple server instances
- ✅ **Backup:** Can be backed up and restored

**Database Schema:**
```sql
-- Add to your users table or create separate table
CREATE TABLE amazon_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  seller_id VARCHAR(255) NOT NULL,
  refresh_token TEXT NOT NULL, -- Encrypted!
  marketplace_id VARCHAR(50) DEFAULT 'A21TJRUUN4KGV',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, seller_id)
);
```

**Service Implementation:**
```typescript
// services/user.service.ts
async storeAmazonRefreshToken(userId: number, refreshToken: string) {
  // Encrypt refresh token before storing
  const encryptedToken = this.encrypt(refreshToken);
  
  await this.prisma.amazonConnection.upsert({
    where: { userId },
    update: {
      refreshToken: encryptedToken,
      updatedAt: new Date()
    },
    create: {
      userId,
      refreshToken: encryptedToken,
      marketplaceId: 'A21TJRUUN4KGV'
    }
  });
}

async getAmazonRefreshToken(userId: number): Promise<string | null> {
  const connection = await this.prisma.amazonConnection.findUnique({
    where: { userId }
  });
  
  if (!connection) return null;
  
  // Decrypt refresh token
  return this.decrypt(connection.refreshToken);
}
```

---

### **Step 7: Use Refresh Token for API Calls**

**Updated Amazon Service:**
```typescript
// services/amazon.service.ts
export class AmazonService {
  // Cache access tokens (short-lived, can be in memory/cache)
  private accessTokenCache = new Map<string, { token: string; expiresAt: number }>();
  
  /**
   * Get access token for a user (auto-refreshes if needed)
   */
  async getAccessTokenForUser(userId: number): Promise<string> {
    // Get refresh token from database
    const refreshToken = await this.userService.getAmazonRefreshToken(userId);
    
    if (!refreshToken) {
      throw new Error('Amazon account not connected');
    }
    
    // Check cache for valid access token
    const cached = this.accessTokenCache.get(userId.toString());
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }
    
    // Refresh access token
    const accessToken = await this.refreshAccessToken(refreshToken);
    
    // Cache access token (1 hour expiry)
    this.accessTokenCache.set(userId.toString(), {
      token: accessToken,
      expiresAt: Date.now() + (55 * 60 * 1000) // 55 minutes (refresh before expiry)
    });
    
    return accessToken;
  }
  
  /**
   * Make API call for a specific user
   */
  async callSpApiForUser(
    userId: number,
    method: string,
    path: string,
    queryParams?: Record<string, any>,
    body?: any
  ): Promise<any> {
    // Get access token for this user
    const accessToken = await this.getAccessTokenForUser(userId);
    
    // Make API call with user's access token
    return this.callSpApi(method, path, queryParams, body, accessToken);
  }
}
```

---

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: User Clicks "Connect Amazon" (Frontend)            │
├─────────────────────────────────────────────────────────────┤
│ Frontend → POST /v1/amazon/auth/initiate                     │
│ Backend → Returns OAuth URL                                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Redirect to Amazon (Frontend)                       │
├─────────────────────────────────────────────────────────────┤
│ window.location.href = authorizationUrl                     │
│ User sees Amazon Seller Central login page                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: User Approves (Amazon)                              │
├─────────────────────────────────────────────────────────────┤
│ User logs in and clicks "Authorize"                        │
│ Amazon redirects: /amazon/callback?code=XXX&state=YYY       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Frontend Receives Code                              │
├─────────────────────────────────────────────────────────────┤
│ Frontend → POST /v1/amazon/auth/callback                   │
│ Body: { code, state }                                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Backend Exchanges Code (Backend)                    │
├─────────────────────────────────────────────────────────────┤
│ Backend → POST https://api.amazon.com/auth/o2/token        │
│ Body: { grant_type: "authorization_code", code, ... }       │
│ Response: { refresh_token: "..." }                          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Store Refresh Token (Database)                      │
├─────────────────────────────────────────────────────────────┤
│ Backend → Store encrypted refresh_token in database         │
│ Table: amazon_connections                                   │
│ Key: user_id                                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 7: Future API Calls                                    │
├─────────────────────────────────────────────────────────────┤
│ Frontend → GET /v1/amazon/products                          │
│ Backend → Get refresh_token from database (by user_id)     │
│ Backend → Exchange refresh_token for access_token (cached) │
│ Backend → Make SP-API call with access_token                │
│ Backend → Return data to Frontend                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Token Types Clarification

### **1. Authorization Code (Temporary)**
- **What:** Code returned by Amazon after user approval
- **Lifetime:** ~10 minutes
- **Usage:** Exchange for refresh token (one-time)
- **Storage:** Not stored (used immediately)

### **2. Refresh Token (Long-lived)**
- **What:** Token used to get new access tokens
- **Lifetime:** Months/years (until revoked)
- **Usage:** Get access tokens automatically
- **Storage:** ✅ **Database (encrypted)** - NOT cache!

### **3. Access Token (Short-lived)**
- **What:** Token used for actual API calls
- **Lifetime:** 1 hour
- **Usage:** Include in SP-API requests
- **Storage:** ✅ **Cache/Memory** - Can be cached

---

## ✅ Best Practices (Industry Standard)

### **1. Token Storage:**

| Token Type | Storage Location | Why |
|------------|----------------|-----|
| **Refresh Token** | ✅ **Database (encrypted)** | Long-lived, needs persistence |
| **Access Token** | ✅ **Cache/Memory** | Short-lived, can be regenerated |
| **Authorization Code** | ❌ **Not stored** | Used once, then discarded |

### **2. Security:**

- ✅ **Encrypt refresh tokens** before storing in database
- ✅ **Use HTTPS** for all OAuth redirects
- ✅ **Validate state parameter** to prevent CSRF attacks
- ✅ **Store tokens per user** (not globally)
- ✅ **Rotate refresh tokens** when possible

### **3. Error Handling:**

- ✅ Handle expired refresh tokens (re-connect flow)
- ✅ Handle revoked tokens (re-connect flow)
- ✅ Handle network errors gracefully
- ✅ Log errors for debugging

---

## 🛠️ Implementation Checklist

### **Backend:**

- [ ] Create `POST /v1/amazon/auth/initiate` endpoint
- [ ] Create `POST /v1/amazon/auth/callback` endpoint
- [ ] Add database table for storing refresh tokens
- [ ] Implement token encryption/decryption
- [ ] Update Amazon service to use user-specific tokens
- [ ] Add state validation for security
- [ ] Handle token refresh errors

### **Frontend:**

- [ ] Create "Connect Amazon" button component
- [ ] Create OAuth callback page (`/amazon/callback`)
- [ ] Handle OAuth errors
- [ ] Show connection status
- [ ] Add "Disconnect" functionality

---

## 📝 Updated Backend Routes

```typescript
// routes/amazon.route.ts

// OAuth Flow Routes
fastify.post('/auth/initiate', {
  schema: {
    description: 'Initiate Amazon OAuth connection',
    tags: ['Amazon SP-API'],
    body: {
      type: 'object',
      properties: {
        redirectUri: { type: 'string' },
        state: { type: 'string' }
      },
      required: ['redirectUri']
    }
  }
}, amazonController.initiateOAuth.bind(amazonController));

fastify.post('/auth/callback', {
  schema: {
    description: 'Handle Amazon OAuth callback',
    tags: ['Amazon SP-API'],
    body: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        state: { type: 'string' }
      },
      required: ['code', 'state']
    }
  }
}, amazonController.handleOAuthCallback.bind(amazonController));

// Existing API routes (now user-specific)
fastify.get('/products', {
  // ... existing schema
}, amazonController.getProducts.bind(amazonController));
```

---

## 🎯 Summary

**Your approach is ✅ CORRECT and follows industry standards!**

**Key Points:**
1. ✅ OAuth flow is correct
2. ✅ Store **refresh token** in **database** (not cache)
3. ✅ Cache **access tokens** in memory (short-lived)
4. ✅ Use refresh token to get access tokens automatically
5. ✅ Store tokens per user (multi-tenant support)

**What to implement:**
1. OAuth initiation endpoint
2. OAuth callback endpoint
3. Database storage for refresh tokens
4. User-specific token management
5. Frontend OAuth flow

---

**Document Version:** 1.0  
**Last Updated:** January 2025

