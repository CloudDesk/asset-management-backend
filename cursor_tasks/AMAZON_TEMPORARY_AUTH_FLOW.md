# Amazon SP-API Temporary Authentication Flow

## 🎯 Your Question

> "If frontend passes refresh_token, seller_id, marketplace_id, will SDK automatically handle token refresh after 1 hour, or do we need to resend refresh_token?"

## ✅ The Answer

**YES, the SDK will automatically handle token refresh!**

Once the SDK is initialized with a `refresh_token`, it:
- ✅ Caches the refresh_token internally
- ✅ Automatically refreshes access tokens when they expire
- ✅ Does NOT need the refresh_token again after initialization
- ✅ Works for the entire session/lifetime of the auth instance

**You only need to pass the refresh_token ONCE per session/user.**

---

## 🔄 How It Works

### Current Flow (Environment Variables)

```
┌─────────────────────────────────────────┐
│  Server Startup                         │
│  ─────────────────────────────────────  │
│  Reads from .env:                      │
│  - AMAZON_REFRESH_TOKEN                 │
│  - AMAZON_CLIENT_ID                     │
│  - AMAZON_CLIENT_SECRET                 │
│  ↓                                      │
│  SDK Initialization (One Time)          │
│  SellingPartnerApiAuth({                │
│    refreshToken: env.AMAZON_REFRESH_TOKEN│
│  })                                     │
│  ↓                                      │
│  Auth instance cached in service        │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  API Calls (Any Time)                   │
│  ─────────────────────────────────────  │
│  SDK automatically:                      │
│  1. Checks cached access token          │
│  2. If expired → uses refresh_token     │
│     to get new access token             │
│  3. Caches new token                    │
│  4. Makes API call                      │
└─────────────────────────────────────────┘
```

### Temporary Flow (Frontend Provides Credentials)

```
┌─────────────────────────────────────────┐
│  Frontend Request                       │
│  ─────────────────────────────────────  │
│  POST /v1/amazon/auth/initialize        │
│  Body: {                                │
│    refreshToken: "Atzr|..."             │
│    // sellerId and marketplaceId from   │
│    // backend environment variables     │
│  }                                      │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  Backend: Initialize SDK                │
│  ─────────────────────────────────────  │
│  Read sellerId from env.AMAZON_SELLER_ID│
│  Read marketplaceId from env            │
│  Create auth instance:                  │
│  SellingPartnerApiAuth({                │
│    refreshToken: request.refreshToken   │
│  })                                     │
│  ↓                                      │
│  Cache auth instance by seller_id      │
│  (Reuse for same seller_id)             │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  Subsequent API Calls                  │
│  ─────────────────────────────────────  │
│  GET /v1/amazon/listings/{sellerId}     │
│  ↓                                      │
│  Backend: Get cached auth for seller_id │
│  ↓                                      │
│  SDK automatically:                     │
│  1. Checks cached access token          │
│  2. If expired → uses refresh_token     │
│     (from initialization) to refresh    │
│  3. Makes API call                      │
│  ✅ NO need to resend refresh_token!    │
└─────────────────────────────────────────┘
```

---

## 💡 Key Points

### 1. **SDK Caches Refresh Token**

When you create a `SellingPartnerApiAuth` instance:

```typescript
const auth = new SellingPartnerApiAuth({
  clientId: '...',
  clientSecret: '...',
  refreshToken: 'Atzr|...',  // ← SDK stores this internally
});
```

The SDK **stores the refresh_token internally** and uses it whenever the access token expires.

### 2. **Automatic Token Refresh**

After initialization, all API calls automatically:

```typescript
// Hour 0: First call
await listingsClient.getListingsItem({ ... });
// SDK: Gets access token using refresh_token, caches it

// Hour 0.5: Second call (token still valid)
await listingsClient.getListingsItem({ ... });
// SDK: Uses cached access token

// Hour 1.1: Third call (token expired)
await listingsClient.getListingsItem({ ... });
// SDK: Automatically calls refresh endpoint with stored refresh_token
//      Gets new access token, caches it, makes API call
//      ✅ You never see this happening!
```

### 3. **No Need to Resend Refresh Token**

Once initialized, the SDK handles everything:
- ✅ Token expiry detection
- ✅ Automatic refresh
- ✅ Token caching
- ✅ Header injection

**You only need to:**
- Pass `refresh_token` **once** when initializing
- Reuse the same auth instance for subsequent calls

---

## 🛠️ Implementation Strategy

### Option 1: Per-Session Auth Instance (Recommended for Temporary Flow)

Create and cache auth instances per seller_id:

```typescript
// Service maintains a map of auth instances
private authInstances: Map<string, SellingPartnerApiAuth> = new Map();

/**
 * Initialize or get auth instance for a seller
 */
getAuthForSeller(
  refreshToken: string,
  sellerId: string,
  clientId?: string,
  clientSecret?: string
): SellingPartnerApiAuth {
  // Check if we already have an auth instance for this seller
  if (this.authInstances.has(sellerId)) {
    return this.authInstances.get(sellerId)!;
  }

  // Create new auth instance
  const auth = new SellingPartnerApiAuth({
    clientId: clientId || env.AMAZON_CLIENT_ID!,
    clientSecret: clientSecret || env.AMAZON_CLIENT_SECRET!,
    refreshToken: refreshToken,
  });

  // Cache it for reuse
  this.authInstances.set(sellerId, auth);
  
  logger.info({ sellerId }, 'Auth instance created and cached for seller');
  
  return auth;
}
```

**Benefits:**
- ✅ Reuses auth instances (efficient)
- ✅ SDK handles token refresh automatically
- ✅ No need to resend refresh_token
- ✅ Works across multiple API calls

### Option 2: Per-Request Auth Instance (Not Recommended)

Create a new auth instance for each request:

```typescript
// Creates new instance every time (inefficient)
const auth = new SellingPartnerApiAuth({
  refreshToken: request.body.refresh_token,
});
```

**Drawbacks:**
- ❌ Creates new instance every time (wasteful)
- ❌ Can't reuse cached access tokens
- ❌ Still works, but less efficient

---

## 📝 Recommended Implementation

### Step 1: Update Service to Support Per-Seller Auth

```typescript
export class AmazonService {
  // Cache auth instances by seller_id
  private authInstances: Map<string, {
    auth: SellingPartnerApiAuth;
    marketplaceId: string;
    lastUsed: Date;
  }> = new Map();

  /**
   * Initialize or get auth instance for a seller
   * Uses sellerId and marketplaceId from environment variables
   * This is called once per seller, then reused
   */
  initializeAuthForSeller(
    refreshToken: string,
    clientId?: string,
    clientSecret?: string
  ): SellingPartnerApiAuth {
    // Get sellerId and marketplaceId from environment variables
    const sellerId = env.AMAZON_SELLER_ID;
    const marketplaceId = env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';

    if (!sellerId) {
      throw new Error(
        'AMAZON_SELLER_ID is not set in environment variables. Please set it in your .env file.'
      );
    }

    // Check if we already have an auth instance for this seller
    const cached = this.authInstances.get(sellerId);
    if (cached) {
      logger.debug({ sellerId }, 'Reusing existing auth instance');
      cached.lastUsed = new Date();
      return cached.auth;
    }

    // Create new auth instance
    const auth = new SellingPartnerApiAuth({
      clientId: clientId || env.AMAZON_CLIENT_ID!,
      clientSecret: clientSecret || env.AMAZON_CLIENT_SECRET!,
      refreshToken: refreshToken,
    });

    // Cache it
    this.authInstances.set(sellerId, {
      auth,
      marketplaceId,
      lastUsed: new Date(),
    });

    logger.info({ sellerId, marketplaceId }, 'Auth instance created and cached for seller');
    
    return auth;
  }

  /**
   * Get listings client for a specific seller
   */
  getListingsClientForSeller(sellerId: string): ListingsItemsApiClient {
    const cached = this.authInstances.get(sellerId);
    if (!cached) {
      throw new Error(`Auth not initialized for seller: ${sellerId}. Call initializeAuthForSeller first.`);
    }

    // Create client with seller-specific auth
    return new ListingsItemsApiClient({
      auth: cached.auth,
      region: this.REGION,
    });
  }
}
```

### Step 2: Create Initialization Route

```typescript
// POST /v1/amazon/auth/initialize
fastify.post('/auth/initialize', {
  schema: {
    description: 'Initialize Amazon SP-API authentication for a seller. SDK will automatically handle token refresh after initialization. sellerId and marketplaceId are read from environment variables (AMAZON_SELLER_ID and AMAZON_MARKETPLACE_ID).',
    tags: ['Amazon SP-API'],
    body: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { 
          type: 'string', 
          description: 'Amazon refresh token (from OAuth flow). This is the only required field from frontend.' 
        },
        clientId: { 
          type: 'string', 
          description: 'Optional: Override default client ID (from AMAZON_CLIENT_ID env var)' 
        },
        clientSecret: { 
          type: 'string', 
          description: 'Optional: Override default client secret (from AMAZON_CLIENT_SECRET env var)' 
        },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              sellerId: { type: 'string', description: 'Seller ID from environment variable' },
              marketplaceId: { type: 'string', description: 'Marketplace ID from environment variable' },
              initialized: { type: 'boolean' },
              note: { type: 'string' },
            },
          },
        },
      },
    },
  },
}, async (request, reply) => {
  const { refreshToken, clientId, clientSecret } = request.body;

  try {
    // Initialize auth - sellerId and marketplaceId come from env
    amazonService.initializeAuthForSeller(
      refreshToken,
      clientId,
      clientSecret
    );

    // Get sellerId and marketplaceId from environment
    const sellerId = env.AMAZON_SELLER_ID || 'Not set in environment';
    const marketplaceId = env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';

    return reply.code(200).send({
      success: true,
      message: 'Authentication initialized successfully',
      data: {
        sellerId,
        marketplaceId,
        initialized: true,
        note: 'SDK will automatically handle token refresh. No need to resend refresh_token. sellerId and marketplaceId are read from environment variables.',
      },
    });
  } catch (error: any) {
    return reply.code(500).send({
      success: false,
      message: 'Failed to initialize authentication',
      details: error.message,
    });
  }
});
```

### Step 3: Update API Methods to Use Seller-Specific Auth

```typescript
/**
 * Get all listings for a seller (using seller-specific auth)
 */
async getAllListingsForSeller(
  sellerId: string,
  marketplaceId?: string,
  includeInventory: boolean = false
): Promise<any> {
  // Get seller-specific listings client
  const client = this.getListingsClientForSeller(sellerId);
  
  // SDK automatically handles token refresh using cached refresh_token
  const response = await client.searchListingsItems({
    sellerId,
    marketplaceIds: [marketplaceId || this.DEFAULT_MARKETPLACE_ID],
    // ... other params
  });

  return response.data;
}
```

---

## ✅ Answer to Your Questions

### Q1: Will API requests fail after 1-hour expiry?

**Answer: NO!** 

Once the SDK is initialized with a `refresh_token`, it automatically:
- Detects when access token expires
- Uses the cached `refresh_token` to get a new access token
- Updates the cached access token
- Makes the API call with the new token

**All of this happens transparently - your API calls will continue to work!**

### Q2: Do we need to resend refresh_token after 1 hour?

**Answer: NO!**

The SDK stores the `refresh_token` internally when you initialize it. You only need to:
1. **Pass `refresh_token` once** when initializing (via `/auth/initialize`)
2. **Reuse the same auth instance** for subsequent API calls
3. **SDK handles everything else automatically**

---

## 🔄 Complete Flow Example

### Frontend Flow

```typescript
// Step 1: Initialize (once per session/user)
// Only refreshToken is required - sellerId and marketplaceId come from backend env
const initResponse = await fetch('/v1/amazon/auth/initialize', {
  method: 'POST',
  body: JSON.stringify({
    refreshToken: 'Atzr|...',
    // sellerId and marketplaceId are read from backend environment variables
  }),
});

// Step 2: Make API calls (no need to resend refresh_token)
// Hour 0: First call
const products1 = await fetch('/v1/amazon/listings/APCBEZW09ZM60');

// Hour 0.5: Second call (token still valid, SDK uses cached token)
const products2 = await fetch('/v1/amazon/listings/APCBEZW09ZM60');

// Hour 1.1: Third call (token expired, SDK automatically refreshes)
const products3 = await fetch('/v1/amazon/listings/APCBEZW09ZM60');
// ✅ All calls work - SDK handles refresh automatically!
```

---

## 🎯 Best Practices

### 1. **Cache Auth Instances**

Don't create a new auth instance for every request. Cache them by `seller_id`:

```typescript
// ✅ Good: Cache and reuse
const auth = getCachedAuth(sellerId) || createNewAuth(sellerId);

// ❌ Bad: Create new instance every time
const auth = new SellingPartnerApiAuth({ refreshToken: ... });
```

### 2. **Session Management**

For temporary flow, you can:
- Cache auth instances in memory (Map)
- Clear cache after session timeout
- Or persist in Redis/database for multi-server setups

### 3. **Error Handling**

Handle refresh token expiration:

```typescript
try {
  await client.getListingsItem({ ... });
} catch (error) {
  if (error.message?.includes('REFRESH_TOKEN_EXPIRED')) {
    // Remove cached auth instance
    authInstances.delete(sellerId);
    // Frontend needs to re-initialize
    throw new Error('REFRESH_TOKEN_EXPIRED');
  }
}
```

---

## 🔄 Auth Instance Lifecycle: Logout & Login

### ❓ Your Question

> "After I pass credentials, get information, logout, and login again - will the Amazon connection still exist?"

### ✅ Answer: **It Depends on Your Implementation**

The behavior depends on how you manage the auth instance lifecycle. Here are the options:

---

### **Option 1: Persist Across Logout/Login (Current Implementation)**

**Behavior:**
- ✅ Auth instances remain in memory after logout
- ✅ Still available after login (if same `seller_id`)
- ✅ No need to re-initialize
- ⚠️ Less secure (auth persists even when user logs out)

**Flow:**
```
1. User logs in → Initializes Amazon auth (seller_id: ABC123)
2. User gets products → Uses cached auth instance
3. User logs out → Auth instance STILL EXISTS in memory
4. User logs in again → Auth instance STILL EXISTS
5. User gets products → Uses existing auth instance (no re-initialization needed)
```

**Implementation:**
```typescript
// Auth instances persist in memory
private authInstances: Map<string, SellingPartnerApiAuth> = new Map();

// On logout - auth instances are NOT cleared
// They remain available for reuse
```

**When to Use:**
- ✅ Multiple users can share same seller account
- ✅ You want convenience over security
- ✅ Temporary flow (until OAuth callback is ready)

---

### **Option 2: Clear on Logout (Recommended for Security)**

**Behavior:**
- ✅ Auth instances cleared when user logs out
- ✅ Must re-initialize on login
- ✅ More secure (no persistent auth after logout)
- ⚠️ Requires re-initialization on each login

**Flow:**
```
1. User logs in → Initializes Amazon auth (seller_id: ABC123)
2. User gets products → Uses cached auth instance
3. User logs out → Auth instance CLEARED from memory
4. User logs in again → Must re-initialize Amazon auth
5. User gets products → Uses newly initialized auth instance
```

**Implementation:**
```typescript
// Add method to clear auth for a seller
clearAuthForSeller(sellerId: string): void {
  this.authInstances.delete(sellerId);
  logger.info({ sellerId }, 'Auth instance cleared for seller');
}

// In logout handler
async logout(userId: number, sellerId?: string) {
  // Clear user session
  await this.signOut(userId);
  
  // Clear Amazon auth if seller_id provided
  if (sellerId) {
    amazonService.clearAuthForSeller(sellerId);
  }
}
```

**When to Use:**
- ✅ Better security (auth cleared on logout)
- ✅ Each login requires fresh initialization
- ✅ Production-ready approach

---

### **Option 3: Store Refresh Token in Database**

**Behavior:**
- ✅ Refresh token stored in database (encrypted)
- ✅ Auth instance created on-demand from database
- ✅ Persists across server restarts
- ✅ Can be cleared on logout

**Flow:**
```
1. User logs in → Stores refresh_token in database
2. User initializes Amazon → Creates auth instance from DB token
3. User gets products → Uses auth instance
4. User logs out → Optionally clear refresh_token from DB
5. User logs in again → Retrieves refresh_token from DB
6. User initializes Amazon → Creates new auth instance
```

**Implementation:**
```typescript
// Store refresh_token in user/seller table
interface Seller {
  id: string;
  sellerId: string;
  refreshToken: string; // Encrypted
  marketplaceId: string;
  userId: number; // Link to user account
}

// Initialize from database
async initializeAuthForSellerFromDB(sellerId: string, userId: number) {
  // Get refresh_token from database
  const seller = await db.seller.findFirst({
    where: { sellerId, userId }
  });
  
  if (!seller) {
    throw new Error('Seller not found');
  }
  
  // Decrypt refresh_token
  const refreshToken = decrypt(seller.refreshToken);
  
  // Initialize auth
  return this.initializeAuthForSeller(
    refreshToken,
    sellerId,
    seller.marketplaceId
  );
}
```

**When to Use:**
- ✅ Production environment
- ✅ Multi-server setup
- ✅ Need persistence across server restarts
- ✅ Proper data management

---

## 📊 Comparison: Lifecycle Options

| Aspect | Option 1: Persist | Option 2: Clear on Logout | Option 3: Database |
|--------|------------------|--------------------------|-------------------|
| **After Logout** | ✅ Still exists | ❌ Cleared | ✅ Stored in DB |
| **After Login** | ✅ Reuse existing | ⚠️ Must re-initialize | ✅ Load from DB |
| **Security** | ⚠️ Less secure | ✅ More secure | ✅ Most secure |
| **Convenience** | ✅ Most convenient | ⚠️ Less convenient | ✅ Convenient |
| **Server Restart** | ❌ Lost | ❌ Lost | ✅ Persists |
| **Multi-Server** | ❌ Not supported | ❌ Not supported | ✅ Supported |
| **Use Case** | Temporary/Dev | Production | Production |

---

## 🎯 Recommended Approach for Your Use Case

### **For Temporary Flow (Until OAuth Callback Ready):**

**Use Option 2: Clear on Logout**

```typescript
// 1. Add clear method to service
export class AmazonService {
  clearAuthForSeller(sellerId: string): void {
    const deleted = this.authInstances.delete(sellerId);
    if (deleted) {
      logger.info({ sellerId }, 'Amazon auth instance cleared');
    }
  }
  
  clearAuthForUser(userId: number): void {
    // If you have user_id → seller_id mapping
    // Clear all auth instances for this user
  }
}

// 2. Update logout route (automatically clears Amazon auth from env)
fastify.post('/auth/signout', {
  preHandler: authenticateInventoryUser,
}, asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
  const userId = request.user!.id;
  
  // Sign out user
  await inventoryUsersService.signOut(userId);
  
  // Clear Amazon auth using sellerId from environment
  const sellerId = env.AMAZON_SELLER_ID;
  if (sellerId) {
    amazonService.clearAuthForSeller(sellerId);
  }
  
  return reply.code(200).send({
    success: true,
    message: 'Sign-out successful. Amazon connection cleared.',
  });
}));

// 3. Add disconnect route (manual disconnect without logout)
fastify.delete('/amazon/auth/disconnect', {
  preHandler: authenticateInventoryUser,
}, asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
  const sellerId = env.AMAZON_SELLER_ID;
  
  if (!sellerId) {
    return reply.code(400).send({
      success: false,
      message: 'AMAZON_SELLER_ID not configured',
    });
  }
  
  const disconnected = amazonService.clearAuthForSeller(sellerId);
  
  return reply.code(200).send({
    success: true,
    message: disconnected 
      ? 'Amazon connection disconnected successfully'
      : 'No Amazon connection found',
    data: { sellerId, disconnected },
  });
}));
```

### **For Production (After OAuth Callback Ready):**

**Use Option 3: Database Storage**

```typescript
// Store refresh_token in database when OAuth callback completes
// Load from database on login
// Clear from database on logout (optional)
```

---

## 🔄 Complete Flow Example: Clear on Logout

### Frontend Flow

```typescript
// Step 1: User logs in
const loginResponse = await fetch('/v1/auth/login', { ... });
const { token } = loginResponse.data;

// Step 2: Initialize Amazon (first time)
// Only refreshToken is required - sellerId and marketplaceId come from backend env
const initResponse = await fetch('/v1/amazon/auth/initialize', {
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    refreshToken: 'Atzr|...',
    // sellerId and marketplaceId are read from backend environment variables
  }),
});

// Step 3: Get products
const products = await fetch('/v1/amazon/listings/APCBEZW09ZM60', {
  headers: { Authorization: `Bearer ${token}` },
});

// Step 4: User logs out (or manually disconnect)
await fetch('/v1/auth/signout', {
  headers: { Authorization: `Bearer ${token}` },
});
// ✅ Amazon auth instance is cleared automatically

// OR manually disconnect without logging out:
await fetch('/v1/amazon/auth/disconnect', {
  headers: { Authorization: `Bearer ${token}` },
  method: 'DELETE',
});
// ✅ Amazon connection disconnected

// Step 5: User logs in again
const loginResponse2 = await fetch('/v1/auth/login', { ... });
const { token: token2 } = loginResponse2.data;

// Step 6: Must re-initialize Amazon
// Only refreshToken is required - sellerId and marketplaceId come from backend env
const initResponse2 = await fetch('/v1/amazon/auth/initialize', {
  headers: { Authorization: `Bearer ${token2}` },
  body: JSON.stringify({
    refreshToken: 'Atzr|...', // Must provide again
    // sellerId and marketplaceId are read from backend environment variables
  }),
});

// Step 7: Get products (works with new auth instance)
const products2 = await fetch('/v1/amazon/listings/APCBEZW09ZM60', {
  headers: { Authorization: `Bearer ${token2}` },
});
```

---

## ✅ Summary: Your Question Answered

### **Q: After logout and login, will Amazon connection still exist?**

**Answer: It depends on your implementation:**

1. **If you DON'T clear on logout (Option 1):**
   - ✅ Yes, connection still exists
   - ✅ No need to re-initialize
   - ⚠️ Less secure

2. **If you DO clear on logout (Option 2 - Recommended):**
   - ❌ No, connection is cleared
   - ⚠️ Must re-initialize on login
   - ✅ More secure

3. **If you use database (Option 3):**
   - ✅ Connection data persists in database
   - ✅ Can be loaded on login
   - ✅ Most secure and production-ready

### **Recommendation:**

For your temporary flow, use **Option 2: Clear on Logout**:
- More secure
- Clean separation between sessions
- Easy to implement
- Can migrate to Option 3 later when OAuth callback is ready

---

## 📊 Comparison: Current vs Temporary Flow

| Aspect | Current (Env) | Temporary (Frontend) |
|--------|---------------|---------------------|
| **Refresh Token Source** | `.env` file | Frontend request body |
| **Seller ID Source** | `.env` file | `.env` file (AMAZON_SELLER_ID) |
| **Marketplace ID Source** | `.env` file | `.env` file (AMAZON_MARKETPLACE_ID) |
| **Initialization** | Server startup | Per seller/user |
| **Token Refresh** | ✅ Automatic | ✅ Automatic |
| **Need to Resend Refresh Token** | ❌ No | ❌ No (after init) |
| **Auth Instance Lifetime** | Server lifetime | Session/user lifetime |
| **Multi-Seller Support** | ❌ Single seller | ❌ Single seller (from env) |

---

## 🚀 Summary

### ✅ What You Get

1. **Pass refresh_token once** when initializing
2. **SDK automatically refreshes** access tokens when they expire
3. **No need to resend refresh_token** after 1 hour
4. **All API calls work seamlessly** - SDK handles everything

### ✅ Implementation Steps

1. Create initialization endpoint (`POST /auth/initialize`)
2. Cache auth instances by `seller_id`
3. Reuse cached auth instances for API calls
4. SDK handles token refresh automatically

### ✅ Key Takeaway

**Once initialized with a refresh_token, the SDK is "set and forget" - it handles all token management automatically!**

---

## 📚 Related Documentation

- **Authentication Explained:** `cursor_tasks/AMAZON_AUTHENTICATION_EXPLAINED.md`
- **API Routes:** `cursor_tasks/AMAZON_API_ROUTES.md`
- **Setup Guide:** `cursor_tasks/Amazon Setup.md`

