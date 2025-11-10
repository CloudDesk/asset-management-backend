# Amazon SP-API Complete Integration Guide
## OAuth Connection + Data Access Flow

**Version:** 2.0  
**Date:** January 2025  
**Use Case:** Complete Amazon SP-API integration with OAuth and data access

---

## 📋 Overview

This guide covers the **complete integration flow** for Amazon SP-API:
1. **Initial OAuth Connection** - User connects their Amazon account
2. **Data Access** - Using the connection to fetch/update data
3. **Token Management** - Automatic token refresh
4. **Re-connection** - When refresh token expires

---

## 🎯 Complete Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: INITIAL CONNECTION                  │
├─────────────────────────────────────────────────────────────────┤
│ 1. User clicks "Connect Amazon" (Frontend)                    │
│ 2. Backend generates OAuth URL                                 │
│ 3. User approves on Amazon                                     │
│ 4. Backend gets refresh token                                  │
│ 5. Backend stores refresh token in database                    │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: DATA ACCESS                         │
├─────────────────────────────────────────────────────────────────┤
│ 1. User clicks "Sync with Amazon" (Frontend)                  │
│ 2. Frontend calls Backend API                                  │
│ 3. Backend gets refresh token from database                    │
│ 4. Backend uses refresh token to get access token (cached)     │
│ 5. Backend makes SP-API calls                                 │
│ 6. Backend returns data to Frontend                           │
│ 7. Frontend displays results                                   │
│                                                                 │
│ ⚠️ Access tokens expire in 1 hour but are AUTO-REFRESHED      │
│ ⚠️ Refresh tokens last months/years (rarely expire)           │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 3: TOKEN REFRESH                       │
├─────────────────────────────────────────────────────────────────┤
│ If refresh token expires/revoked:                              │
│ 1. Backend detects expired refresh token                      │
│ 2. Backend returns error to Frontend                          │
│ 3. Frontend shows "Re-connect Amazon" button                  │
│ 4. User goes through OAuth flow again (Phase 1)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 PHASE 1: Initial OAuth Connection

### **Step 1: User Initiates Connection (Frontend)**

**User clicks "Connect Amazon" button**

```typescript
// components/ConnectAmazonButton.tsx
'use client';

import { useState } from 'react';
import axios from 'axios';

export function ConnectAmazonButton() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <button onClick={handleConnect} disabled={loading}>
      {loading ? 'Connecting...' : 'Connect Amazon'}
    </button>
  );
}
```

---

### **Step 2: Backend Generates OAuth URL**

**Backend Endpoint:**
```typescript
// POST /v1/amazon/auth/initiate
POST /v1/amazon/auth/initiate
Body: {
  redirectUri: "https://yourapp.com/amazon/callback",
  state: "random-state-string"
}

Response: {
  success: true,
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

**Amazon Service Method:**
```typescript
// services/amazon.service.ts
generateOAuthUrl(params: {
  redirectUri: string;
  state: string;
  userId: number;
}): string {
  const { redirectUri, state, userId } = params;
  
  // Store state-user mapping (for CSRF protection)
  // State parameter is critical for security - validates the callback
  this.stateStore.set(state, userId);
  
  // Generate OAuth URL
  // Note: Use appropriate Seller Central URL based on marketplace
  // India: sellercentral.amazon.in
  // US: sellercentral.amazon.com
  // EU: sellercentral-europe.amazon.com
  const sellerCentralUrl = env.AMAZON_SELLER_CENTRAL_URL || 'https://sellercentral.amazon.in';
  
  const urlParams = new URLSearchParams({
    application_id: env.AMAZON_CLIENT_ID,
    state: state, // CSRF protection
    redirect_uri: redirectUri,
    version: 'beta'
  });
  
  return `${sellerCentralUrl}/apps/authorize/consent?${urlParams.toString()}`;
}

verifyState(state: string, userId: number): boolean {
  // Verify state parameter matches stored value (CSRF protection)
  const storedUserId = this.stateStore.get(state);
  if (!storedUserId || storedUserId !== userId) {
    return false;
  }
  // Remove used state (one-time use)
  this.stateStore.delete(state);
  return true;
}
```

---

### **Step 3: User Approves on Amazon**

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
  spapi_oauth_code=AUTHORIZATION_CODE&
  selling_partner_id=SELLER_ID&
  state=RANDOM_STATE
```

**⚠️ Important:** Amazon SP-API uses `spapi_oauth_code` (not just `code`) and also returns `selling_partner_id` in the redirect. Your callback handler must check for both parameter names.

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
      // Amazon SP-API uses 'spapi_oauth_code' (not just 'code')
      const code = searchParams.get('spapi_oauth_code') || searchParams.get('code'); // Fallback for compatibility
      const sellingPartnerId = searchParams.get('selling_partner_id');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      
      if (error) {
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
        // Send authorization code and seller ID to backend
        const response = await axios.post('/v1/amazon/auth/callback', {
          code,
          sellingPartnerId, // Amazon provides this in the redirect
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
  code: "AUTHORIZATION_CODE", // or spapi_oauth_code from Amazon
  sellingPartnerId: "SELLER_ID", // Optional: Amazon provides this in redirect
  state: "RANDOM_STATE"
}

Response: {
  success: true,
  message: "Amazon account connected successfully"
}
```

**⚠️ Important:** Amazon SP-API redirect includes:
- `spapi_oauth_code` - The authorization code (not just `code`)
- `selling_partner_id` - The seller's ID (useful to store for API calls)
- `state` - The state parameter you sent

**Backend Implementation:**
```typescript
// controllers/amazon.controller.ts
handleOAuthCallback = asyncHandler(async (request: FastifyRequest<{
  Body: { code: string; sellingPartnerId?: string; state: string }
}>, reply: FastifyReply) => {
  const { code, sellingPartnerId, state } = request.body;
  const userId = request.user.id; // From your auth middleware
  
  // Verify state (security check - protects against CSRF)
  if (!this.amazonService.verifyState(state, userId)) {
    return reply.code(400).send({
      success: false,
      message: 'Invalid state parameter'
    });
  }
  
  // Exchange authorization code for refresh token
  const { refreshToken, sellerId } = await this.amazonService.exchangeCodeForRefreshToken({
    code,
    redirectUri: process.env.AMAZON_REDIRECT_URI
  });
  
  // Use sellerId from Amazon redirect if provided, otherwise from token exchange
  const finalSellerId = sellingPartnerId || sellerId;
  
  // Store refresh token and seller ID in database (NOT cache - needs persistence!)
  await this.userService.storeAmazonRefreshToken(userId, refreshToken, finalSellerId);
  
  return reply.send({
    success: true,
    message: 'Amazon account connected successfully'
  });
});
```

**Amazon Service Method:**
```typescript
// services/amazon.service.ts
async exchangeCodeForRefreshToken(params: {
  code: string;
  redirectUri: string;
}): Promise<{ refreshToken: string; sellerId: string }> {
  try {
    // Exchange authorization code for refresh token
    // Note: Same endpoint for sandbox and production
    const tokenUrl = 'https://api.amazon.com/auth/o2/token';
    
    const response = await axios.post(tokenUrl, {
      grant_type: 'authorization_code',
      code: params.code,
      client_id: env.AMAZON_CLIENT_ID,
      client_secret: env.AMAZON_CLIENT_SECRET,
      redirect_uri: params.redirectUri
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const { refresh_token, access_token } = response.data;
    
    // Get seller ID using the access token (or from redirect parameter)
    const sellerId = await this.getSellerId(access_token);
    
    return {
      refreshToken: refresh_token,
      sellerId
    };
  } catch (error: any) {
    logger.error({ error: error.response?.data || error.message }, 'Error exchanging code for refresh token');
    
    // Check for specific error types
    if (error.response?.data?.error === 'invalid_grant') {
      throw new Error('AUTHORIZATION_CODE_EXPIRED');
    }
    
    throw new Error(`Failed to exchange code: ${error.response?.data?.error_description || error.message}`);
  }
}
```

---

### **Step 6: Store Refresh Token in Database**

**⚠️ CRITICAL: Store in Database, NOT Cache!**

**Why Database:**
- ✅ **Persistence:** Refresh tokens must survive server restarts
- ✅ **Security:** Database is more secure than cache
- ✅ **Multi-instance:** Works with multiple server instances
- ✅ **Backup:** Can be backed up and restored
- ✅ **Seller Mapping:** Store `sellerId`/`sellingPartnerId` to identify which seller account to use for API calls

**Database Schema:**
```sql
-- Create table for storing Amazon connections
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
async storeAmazonRefreshToken(
  userId: number, 
  refreshToken: string, 
  sellerId: string
) {
  // Encrypt refresh token before storing
  const encryptedToken = this.encrypt(refreshToken);
  
  await this.prisma.amazonConnection.upsert({
    where: { userId },
    update: {
      refreshToken: encryptedToken,
      sellerId,
      updatedAt: new Date()
    },
    create: {
      userId,
      sellerId,
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

## 🔄 PHASE 2: Data Access (After Connection)

### **Step 1: User Clicks "Sync with Amazon" (Frontend)**

```typescript
// components/AmazonSyncButton.tsx
'use client';

import { useState } from 'react';
import { amazonApiService } from '@/services/amazonApi.service';

interface AmazonSyncButtonProps {
  sellerId?: string;
  onSyncComplete?: (data: any) => void;
}

export function AmazonSyncButton({ sellerId, onSyncComplete }: AmazonSyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Example: Sync products
      const products = await amazonApiService.getProducts(sellerId);
      
      setSuccess(true);
      onSyncComplete?.(products);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sync with Amazon');
      console.error('Amazon sync error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="amazon-sync-container">
      <button onClick={handleSync} disabled={loading}>
        {loading ? 'Syncing...' : 'Sync with Amazon'}
      </button>
      {error && <div className="error-message">Error: {error}</div>}
      {success && <div className="success-message">Successfully synced!</div>}
    </div>
  );
}
```

**Frontend API Service:**
```typescript
// services/amazonApi.service.ts
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class AmazonApiService {
  private baseURL = `${API_BASE_URL}/v1/amazon`;

  // Get product list
  async getProducts(sellerId?: string, marketplaceId?: string) {
    const params: any = {};
    if (marketplaceId) params.marketplaceId = marketplaceId;
    if (sellerId) params.sellerId = sellerId;
    
    const response = await axios.get(`${this.baseURL}/products`, { params });
    return response.data;
  }

  // Get orders
  async getOrders(filters?: {
    marketplaceId?: string;
    createdAfter?: string;
    createdBefore?: string;
    orderStatuses?: string;
  }) {
    const response = await axios.get(`${this.baseURL}/orders`, { params: filters });
    return response.data;
  }

  // Update inventory
  async updateInventory(sellerId: string, sku: string, quantity: number) {
    const response = await axios.patch(
      `${this.baseURL}/inventory/${sellerId}/${sku}`,
      { quantity }
    );
    return response.data;
  }
}

export const amazonApiService = new AmazonApiService();
```

---

### **Step 2: Backend Gets Refresh Token & Access Token**

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
      throw new Error('Amazon account not connected. Please connect your Amazon account first.');
    }
    
    // Check cache for valid access token
    const cached = this.accessTokenCache.get(userId.toString());
    if (cached && Date.now() < cached.expiresAt) {
      logger.debug('Using cached access token');
      return cached.token;
    }
    
    // Refresh access token using refresh token
    logger.info('Refreshing access token for user', { userId });
    const accessToken = await this.refreshAccessToken(refreshToken);
    
    // Cache access token (55 minutes - refresh before 1 hour expiry)
    this.accessTokenCache.set(userId.toString(), {
      token: accessToken,
      expiresAt: Date.now() + (55 * 60 * 1000) // 55 minutes
    });
    
    return accessToken;
  }
  
  /**
   * Refresh access token using refresh token
   * 
   * Token Endpoint: https://api.amazon.com/auth/o2/token
   * - Same endpoint for sandbox and production
   * - Use grant_type=refresh_token for authorized operations
   * - Use grant_type=client_credentials for grantless operations (not covered here)
   */
  private async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      // Amazon LWA token endpoint (same for sandbox and production)
      const tokenUrl = 'https://api.amazon.com/auth/o2/token';
      
      const response = await axios.post<AmazonAccessTokenResponse>(
        tokenUrl,
        {
          grant_type: 'refresh_token', // For authorized operations
          refresh_token: refreshToken,
          client_id: env.AMAZON_CLIENT_ID,
          client_secret: env.AMAZON_CLIENT_SECRET,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      logger.info('Amazon access token refreshed successfully');
      return response.data.access_token;
    } catch (error: any) {
      logger.error({ error: error.response?.data || error.message }, 'Error refreshing Amazon access token');
      
      // Check if refresh token is expired/revoked
      // Amazon returns 'invalid_grant' (HTTP 400) when refresh token is expired or revoked
      // This is the standard way Amazon indicates token invalidation
      if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
        throw new Error('REFRESH_TOKEN_EXPIRED'); // Special error for expired/revoked refresh token
      }
      
      throw new Error(`Failed to refresh Amazon access token: ${error.response?.data?.error_description || error.message}`);
    }
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

### **Step 3: Backend Makes SP-API Calls**

**Controller Implementation:**
```typescript
// controllers/amazon.controller.ts
getProducts = asyncHandler(async (request: FastifyRequest<{
  Querystring: { sellerId?: string; marketplaceId?: string }
}>, reply: FastifyReply) => {
  const userId = request.user.id; // From your auth middleware
  const { sellerId, marketplaceId } = request.query;
  
  try {
    // Get seller ID from database if not provided
    const connection = await this.userService.getAmazonConnection(userId);
    if (!connection) {
      return reply.code(400).send({
        success: false,
        message: 'Amazon account not connected. Please connect your Amazon account first.'
      });
    }
    
    const finalSellerId = sellerId || connection.sellerId;
    const finalMarketplaceId = marketplaceId || connection.marketplaceId;
    
    // Make SP-API call (automatically handles token refresh)
    const products = await this.amazonService.getListingsItems(
      userId, // Pass userId for user-specific token
      finalSellerId,
      [finalMarketplaceId]
    );
    
    return reply.send({
      success: true,
      message: 'Products retrieved successfully',
      data: products
    });
  } catch (error: any) {
    // Handle expired refresh token
    if (error.message === 'REFRESH_TOKEN_EXPIRED') {
      return reply.code(401).send({
        success: false,
        message: 'Amazon connection expired. Please reconnect your Amazon account.',
        requiresReconnect: true
      });
    }
    
    logger.error({ error: error.message }, 'Error fetching Amazon products');
    return reply.code(500).send({
      success: false,
      message: error.message || 'Failed to fetch products'
    });
  }
});
```

---

## 🔄 PHASE 3: Token Refresh & Re-connection

### **Grantless vs Authorized Operations**

**Important:** Amazon SP-API has two types of operations:

1. **Grantless Operations** (No seller authorization required)
   - Don't require refresh token
   - Use client credentials only
   - Limited scope (e.g., catalog operations, product search)
   - Use `grant_type=client_credentials` for token

2. **Authorized Operations** (Require seller authorization)
   - Require refresh token from seller OAuth
   - Full access to seller's data
   - Orders, inventory, shipments, etc.
   - Use `grant_type=refresh_token` for token

**This guide covers Authorized Operations** (the most common use case). If you need grantless operations, you'll use a different token endpoint with client credentials.

---

## 🔄 PHASE 3: Token Refresh & Re-connection

### **Token Lifecycle:**

```
┌─────────────────────────────────────────────────────────────┐
│ Access Token (Short-lived)                                   │
├─────────────────────────────────────────────────────────────┤
│ Lifetime: 1 hour                                            │
│ Auto-refreshed: Every 55 minutes (before expiry)            │
│ Storage: Cache/Memory                                        │
│ Action: Automatic (no user interaction needed)              │
└─────────────────────────────────────────────────────────────┘
                        ↓ (uses)
┌─────────────────────────────────────────────────────────────┐
│ Refresh Token (Long-lived)                                   │
├─────────────────────────────────────────────────────────────┤
│ Lifetime: Months/years (until revoked)                      │
│ Auto-refreshed: NO (user must re-connect)                  │
│ Storage: Database (encrypted)                               │
│ Action: Manual (user clicks "Re-connect")                   │
└─────────────────────────────────────────────────────────────┘
```

### **When Access Token Expires:**

**✅ Automatic - No User Action Needed**

```
Access Token expires (1 hour)
  ↓
Backend detects expiry (on next API call)
  ↓
Backend uses refresh token to get new access token
  ↓
Backend caches new access token
  ↓
API call continues (user doesn't notice)
```

### **When Refresh Token Expires or is Revoked:**

**⚠️ Manual - User Must Re-connect**

**Important:** Amazon refresh tokens can be:
- **Expired** - After a long period of inactivity
- **Revoked** - Seller can revoke access at any time in Seller Central
- **Invalidated** - If seller changes password or security settings

```
Refresh Token expires/revoked
  ↓
Backend tries to refresh access token
  ↓
Amazon returns error: "invalid_grant" (HTTP 400)
  ↓
Backend detects 'invalid_grant' error
  ↓
Backend returns error to Frontend: "REFRESH_TOKEN_EXPIRED"
  ↓
Frontend shows "Re-connect Amazon" button
  ↓
User goes through OAuth flow again (Phase 1)
```

**⚠️ Critical:** Always treat `invalid_grant` error from LWA token endpoint as requiring re-connection. This is Amazon's standard way of indicating an expired or revoked refresh token.

**Frontend Error Handling:**
```typescript
// components/AmazonSyncButton.tsx
const handleSync = async () => {
  try {
    const products = await amazonApiService.getProducts();
    // Success...
  } catch (err: any) {
    // Check if refresh token expired
    if (err.response?.data?.requiresReconnect) {
      // Show re-connect button
      setShowReconnect(true);
      setError('Your Amazon connection has expired. Please reconnect.');
    } else {
      setError(err.response?.data?.message || 'Failed to sync');
    }
  }
};

// Re-connect button
{showReconnect && (
  <button onClick={handleReconnect}>
    Re-connect Amazon
  </button>
)}
```

---

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: INITIAL CONNECTION                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. User clicks "Connect Amazon"                            │
│ 2. FE → POST /v1/amazon/auth/initiate                       │
│ 3. BE → Returns OAuth URL                                  │
│ 4. FE → Redirects to Amazon                                │
│ 5. User approves on Amazon                                  │
│ 6. Amazon → Redirects with code                             │
│ 7. FE → POST /v1/amazon/auth/callback                       │
│ 8. BE → Exchanges code for refresh_token                    │
│ 9. BE → Stores refresh_token in database                   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: DATA ACCESS (Repeated Many Times)                  │
├─────────────────────────────────────────────────────────────┤
│ 1. User clicks "Sync with Amazon"                          │
│ 2. FE → GET /v1/amazon/products                             │
│ 3. BE → Gets refresh_token from database (by user_id)      │
│ 4. BE → Uses refresh_token to get access_token              │
│    - If access_token cached & valid → use cached           │
│    - If access_token expired → refresh using refresh_token │
│ 5. BE → Makes SP-API call with access_token                │
│ 6. BE → Returns data to FE                                 │
│ 7. FE → Displays results                                   │
│                                                             │
│ ⚠️ Access tokens expire in 1 hour but AUTO-REFRESHED      │
│ ⚠️ This phase repeats until refresh_token expires          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: RE-CONNECTION (When Refresh Token Expires)        │
├─────────────────────────────────────────────────────────────┤
│ 1. Refresh token expires/revoked                            │
│ 2. BE → Tries to refresh access_token                      │
│ 3. Amazon → Returns error: "invalid_grant"                 │
│ 4. BE → Returns error to FE: "REFRESH_TOKEN_EXPIRED"       │
│ 5. FE → Shows "Re-connect Amazon" button                   │
│ 6. User clicks "Re-connect"                                │
│ 7. Go back to PHASE 1 (OAuth flow)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Token Types Summary

| Token Type | Lifetime | Storage | Auto-Refresh | User Action |
|------------|----------|---------|--------------|-------------|
| **Authorization Code** | ~10 min | Not stored | N/A | One-time use |
| **Refresh Token** | Months/years | Database (encrypted) | ❌ No | Re-connect when expired |
| **Access Token** | 1 hour | Cache/Memory | ✅ Yes | Automatic |

---

## ✅ Key Points

1. **Initial Connection (One-time):**
   - User goes through OAuth flow
   - Amazon redirects with `spapi_oauth_code` and `selling_partner_id`
   - Backend exchanges code for refresh token
   - Backend stores refresh token and seller ID in database
   - State parameter used for CSRF protection

2. **Data Access (Repeated):**
   - User clicks "Sync" button
   - Backend gets refresh token and seller ID from database (mapped to user)
   - Backend uses refresh token to get access token (cached if valid)
   - Backend makes SP-API calls with seller-specific data
   - **Access tokens are auto-refreshed** (user doesn't notice)

3. **Re-connection (Rare):**
   - Only when refresh token expires/revoked
   - Amazon returns `invalid_grant` error
   - Backend detects error and returns `REFRESH_TOKEN_EXPIRED`
   - User must go through OAuth flow again
   - Happens months/years after initial connection (or if seller revokes)

4. **Token Endpoint:**
   - Same URL for sandbox and production: `https://api.amazon.com/auth/o2/token`
   - Use `grant_type=authorization_code` to exchange code for tokens
   - Use `grant_type=refresh_token` to refresh access tokens

---

## 🛠️ Implementation Checklist

### **Backend:**

**OAuth Flow:**
- [ ] Create `POST /v1/amazon/auth/initiate` endpoint
- [ ] Create `POST /v1/amazon/auth/callback` endpoint
- [ ] Add database table for storing refresh tokens
- [ ] Implement token encryption/decryption
- [ ] Add state validation for security

**Data Access:**
- [ ] Update Amazon service to use user-specific tokens
- [ ] Implement access token caching
- [ ] Handle token refresh errors
- [ ] Update all API endpoints to use user-specific tokens

**Error Handling:**
- [ ] Detect expired refresh tokens
- [ ] Return proper error codes
- [ ] Log errors for debugging

### **Frontend:**

**OAuth Flow:**
- [ ] Create "Connect Amazon" button component
- [ ] Create OAuth callback page (`/amazon/callback`)
- [ ] Handle OAuth errors

**Data Access:**
- [ ] Create API service for Amazon endpoints
- [ ] Create "Sync with Amazon" button component
- [ ] Handle API errors
- [ ] Display synced data

**Re-connection:**
- [ ] Detect refresh token expiry errors
- [ ] Show "Re-connect Amazon" button
- [ ] Handle re-connection flow

---

## 📝 Backend Routes

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

// Data Access Routes (User-specific)
fastify.get('/products', {
  schema: {
    description: 'Get products from Amazon SP-API',
    tags: ['Amazon SP-API'],
    querystring: {
      type: 'object',
      properties: {
        sellerId: { type: 'string' },
        marketplaceId: { type: 'string' }
      }
    }
  }
}, amazonController.getProducts.bind(amazonController));

fastify.get('/orders', {
  // ... schema
}, amazonController.getOrders.bind(amazonController));

fastify.patch('/inventory/:sellerId/:sku', {
  // ... schema
}, amazonController.updateInventory.bind(amazonController));
```

---

## 🎯 Summary

**Your Understanding is ✅ CORRECT!**

1. **First Connect:** User goes through OAuth → Get refresh token → Store in database
2. **Access Data:** Use refresh token to get access tokens → Make API calls → Auto-refresh access tokens
3. **After Expiry:** If refresh token expires → User re-connects → Get new refresh token

**Key Points:**
- ✅ Refresh tokens stored in **database** (not cache) with seller ID mapping
- ✅ Access tokens cached in **memory** (auto-refreshed)
- ✅ Access tokens expire in 1 hour but **auto-refreshed** (user doesn't notice)
- ✅ Refresh tokens last months/years (rarely expire, but can be revoked by seller)
- ✅ Amazon uses `spapi_oauth_code` and `selling_partner_id` in OAuth redirect
- ✅ State parameter required for CSRF protection
- ✅ `invalid_grant` error from LWA = refresh token expired/revoked (needs re-connect)
- ✅ Token endpoint: `https://api.amazon.com/auth/o2/token` (same for sandbox/production)

---

**Document Version:** 2.0  
**Last Updated:** January 2025

