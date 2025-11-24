# Dual Frontend Authentication - Complete Guide

## 🎯 Overview

**One Backend → Two Frontends:**
1. **Inventory Frontend** (`asset-management-frontend`) - Internal users
   - Uses: `inventoryusers` table
   - Auth: JWT tokens with roles & permissions
   - All routes: Protected (require auth)

2. **E-Commerce Frontend** - Public + Authenticated users
   - Uses: `users` table
   - Auth: JWT tokens (no roles/permissions for now)
   - Routes: Mix of public + protected

---

## ✅ Quick Answers

### **Q1: Will same BE work for both frontends?**
**A:** ✅ **YES!** The same backend works perfectly for both:
- ✅ **Same JWT authentication** - Both use JWT tokens
- ✅ **Same middleware** - Supports both user types automatically
- ✅ **Same API endpoints** - One API serves both
- ✅ **Different user tables** - `inventoryusers` vs `users`

### **Q2: Should I remove auth handler for e-commerce?**
**A:** ❌ **NO!** Don't remove it. Use **different middleware** based on route needs:

| Route Type | Middleware | Example |
|------------|-----------|---------|
| **Public** | None | `GET /v1/products` (browse products) |
| **Optional** | `optionalAuth` | `GET /v1/cart` (works for guest or user) |
| **Protected** | `requireAuthentication` | `POST /v1/orders` (must login) |

---

## 🏗️ Architecture

### **System Architecture:**

```
┌─────────────────────────────────────────────────┐
│           BACKEND (Same API)                    │
│  - JWT Authentication                            │
│  - Supports both user types                      │
│  - Flexible auth middleware                     │
└─────────────┬───────────────────┬───────────────┘
              │                   │
              ▼                   ▼
    ┌─────────────────┐  ┌─────────────────┐
    │ Inventory FE    │  │  E-Commerce FE  │
    │ (Internal)      │  │  (Public)      │
    │                 │  │                 │
    │ Uses:           │  │ Uses:           │
    │ inventoryusers  │  │ users           │
    │ + Roles         │  │ (No roles)      │
    │ + Permissions   │  │                 │
    └─────────────────┘  └─────────────────┘
```

### **Authentication Types:**

#### **Type 1: Inventory Users** (Internal)
- **Table**: `inventoryusers`
- **Auth Endpoint**: `POST /v1/auth/signin`
- **Token Type**: JWT with `userId`, `email`, `roleId`
- **Permissions**: Full role-based permissions
- **Use Case**: Admin panel, inventory management

#### **Type 2: E-Commerce Users** (Public)
- **Table**: `users`
- **Auth Endpoint**: `POST /v1/users/signin`
- **Token Type**: JWT with `userId`, `email` (no `roleId`)
- **Permissions**: None (or simple user/guest distinction)
- **Use Case**: Shopping, checkout, orders

---

## 🔐 Authentication Endpoints

### **1. Inventory Users (Internal)**
**Endpoint**: `POST /v1/auth/signin`

**Request:**
```json
{
  "useremail": "admin@company.com",
  "userpassword": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "roles": { "id": 3, "name": "System Admin", ... },
    "permissions": { "products": { ... }, ... },
    "token": "eyJhbGci...",  // JWT Access Token
    "refreshToken": "eyJhbGci...",  // JWT Refresh Token
    "expiresIn": 86400
  }
}
```

**Table**: `inventoryusers`  
**Features**: Roles + Permissions

---

### **2. E-Commerce Users (Public)**
**Endpoint**: `POST /v1/users/signin`

**Request:**
```json
{
  "useremail": "customer@example.com",
  "userpassword": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGci...",  // JWT Access Token
    "refreshToken": "eyJhbGci...",  // JWT Refresh Token
    "expiresIn": 86400
  }
}
```

**Table**: `users`  
**Features**: Simple authentication (no roles/permissions)

---

### **3. Token Refresh (Both User Types)**
**Endpoint**: `POST /v1/auth/refresh`

**Request:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",  // New JWT Access Token
    "refreshToken": "eyJhbGci...",  // New JWT Refresh Token (if sliding expiry)
    "expiresIn": 86400
  }
}
```

---

## 🛡️ Middleware Options

### **1. `requireAuthentication` (Strict - Auth Required)**
**Use for**: Protected routes that MUST have authentication

```typescript
import { requireAuthentication } from '../middleware/auth.middleware.js';

fastify.get('/orders', {
  preHandler: requireAuthentication
}, handler);
```

**Behavior:**
- ✅ Token required in `Authorization: Bearer <token>` header
- ✅ Returns 401 if no token
- ✅ Returns 401 if token invalid/expired
- ✅ Supports both `inventoryusers` and `users` tables
- ✅ Attaches `userType: 'inventory' | 'ecommerce'` to request
- ✅ Attaches user to `request.user`

**Usage in handler:**
```typescript
async (request: AuthenticatedRequest, reply) => {
  // User is guaranteed to be authenticated
  const userId = request.user!.id;
  const userType = request.user!.userType; // 'inventory' or 'ecommerce'
}
```

---

### **2. `optionalAuth` (Flexible - Auth Optional)**
**Use for**: Routes that work for both authenticated and guest users

```typescript
import { optionalAuth } from '../middleware/flexibleAuth.middleware.js';

fastify.get('/cart', {
  preHandler: optionalAuth
}, handler);
```

**Behavior:**
- ✅ Token optional (no error if missing)
- ✅ If token provided: Verifies and attaches user
- ✅ If no token: Continues as guest (no user attached)
- ✅ Supports both user types

**Usage in handler:**
```typescript
async (request: AuthenticatedRequest, reply) => {
  if (request.user) {
    // User is authenticated
    const userId = request.user.id;
    const userType = request.user.userType; // 'inventory' or 'ecommerce'
  } else {
    // Guest user (no authentication)
  }
}
```

---

### **3. No Middleware (Public Routes)**
**Use for**: Completely public routes

```typescript
// No preHandler = public
fastify.get('/products', handler);
```

**Behavior:**
- ✅ No authentication required
- ✅ Anyone can access
- ✅ No user attached to request

---

## 📋 Route Configuration Guide

### **E-Commerce Routes (Public Frontend):**

| Route | Auth Type | Middleware | Reason |
|-------|-----------|-----------|--------|
| `GET /v1/products` | Public | None | Browse products (anyone) |
| `GET /v1/products/:id` | Public | None | View product details (anyone) |
| `GET /v1/promotions` | Public | None | View promotions (anyone) |
| `GET /v1/cart` | Optional | `optionalAuth` | View cart (guest or user) |
| `POST /v1/cart` | Optional | `optionalAuth` | Add to cart (guest or user) |
| `POST /v1/orders` | Required | `requireAuthentication` | Create order (must login) |
| `GET /v1/orders` | Required | `requireAuthentication` | View orders (must login) |
| `PUT /v1/users/:id` | Required | `requireAuthentication` | Update profile (must login) |

**Code Example:**
```typescript
// ✅ PUBLIC - No auth required
fastify.get('/products', productController.getAll);
fastify.get('/products/:id', productController.getById);
fastify.get('/promotions', promotionController.getAll);

// ✅ OPTIONAL AUTH - Works for guest or authenticated users
import { optionalAuth } from '../middleware/flexibleAuth.middleware.js';

fastify.get('/cart', {
  preHandler: optionalAuth  // Auth if token provided, but not required
}, cartController.getCart);

fastify.post('/cart', {
  preHandler: optionalAuth
}, cartController.addToCart);

// ✅ PROTECTED - Auth required
import { requireAuthentication } from '../middleware/auth.middleware.js';

fastify.post('/orders', {
  preHandler: requireAuthentication  // Must have valid token
}, orderController.create);

fastify.get('/orders', {
  preHandler: requireAuthentication
}, orderController.getUserOrders);

fastify.put('/users/:id', {
  preHandler: requireAuthentication
}, usersController.updateUser);
```

---

### **Inventory Routes (Internal Frontend):**

| Route | Auth Type | Middleware | Reason |
|-------|-----------|-----------|--------|
| `GET /v1/products` | Required | `requireAuthentication` | All routes protected |
| `POST /v1/products` | Required | `requireAuthentication` | + Permission check |
| `GET /v1/stocks` | Required | `requireAuthentication` | + Permission check |
| `GET /v1/roles` | Required | `requireAuthentication` | Admin only |

**Code Example:**
```typescript
// ✅ ALL PROTECTED - Auth + Permissions required
import { requireAuthentication } from '../middleware/auth.middleware.js';

fastify.get('/products', {
  preHandler: requireAuthentication
}, productController.getAll);

fastify.post('/products', {
  preHandler: requireAuthentication
}, productController.create);

// Permission check happens in controller/service layer
```

---

## 🔄 How It Works

### **Step 1: User Signs In**

**Inventory User:**
```bash
POST /v1/auth/signin
→ Returns JWT token (with roleId)
```

**E-Commerce User:**
```bash
POST /v1/users/signin
→ Returns JWT token (no roleId)
```

---

### **Step 2: Make API Call**

**Both use same format:**
```bash
GET /v1/products
Headers: {
  "Authorization": "Bearer <token>"
}
```

---

### **Step 3: Middleware Verifies Token**

1. Extracts token from `Authorization` header
2. Verifies JWT signature and expiry
3. Gets `userId` from token payload
4. Tries `inventoryusers` table first
5. If not found, tries `users` table
6. Attaches user to `request.user`
7. Sets `userType: 'inventory' | 'ecommerce'`

---

### **Step 4: Handler Uses User Info**

```typescript
async (request: AuthenticatedRequest, reply) => {
  const user = request.user; // Available if authenticated
  const userType = request.user?.userType; // 'inventory' or 'ecommerce'
  
  if (userType === 'inventory') {
    // Internal user - check permissions
    const hasPermission = await checkPermission(user.id, 'products', 'read');
  } else if (userType === 'ecommerce') {
    // E-commerce user - simple access
  } else {
    // Guest user (optionalAuth, no token)
  }
}
```

---

## 🚀 Usage Examples

### **Example 1: Public Product Listing (E-Commerce)**

```typescript
// No auth required - anyone can browse
fastify.get('/products', async (request, reply) => {
  const products = await productService.findAll();
  return reply.send({ success: true, data: products });
});
```

---

### **Example 2: Optional Auth Cart (E-Commerce)**

```typescript
import { optionalAuth } from '../middleware/flexibleAuth.middleware.js';

fastify.get('/cart', {
  preHandler: optionalAuth
}, async (request: AuthenticatedRequest, reply) => {
  if (request.user) {
    // Authenticated user - get their cart
    const cart = await cartService.getUserCart(request.user.id);
    return reply.send({ success: true, data: cart });
  } else {
    // Guest user - get guest cart (from session/cookie)
    const guestCart = await cartService.getGuestCart(request.cookies?.guestId);
    return reply.send({ success: true, data: guestCart });
  }
});
```

---

### **Example 3: Protected Orders (E-Commerce)**

```typescript
import { requireAuthentication } from '../middleware/auth.middleware.js';

fastify.post('/orders', {
  preHandler: requireAuthentication
}, async (request: AuthenticatedRequest, reply) => {
  // User is guaranteed to be authenticated
  const userId = request.user!.id;
  const userType = request.user!.userType;
  
  // Create order for this user
  const order = await orderService.create(userId, request.body);
  return reply.send({ success: true, data: order });
});
```

---

### **Example 4: Inventory Route (Internal)**

```typescript
import { requireAuthentication } from '../middleware/auth.middleware.js';
import { checkPermission } from '../utils/permissionChecker.js';

fastify.post('/products', {
  preHandler: requireAuthentication
}, async (request: AuthenticatedRequest, reply) => {
  const user = request.user!;
  
  // Check permission (only for inventory users)
  if (user.userType === 'inventory') {
    const hasPermission = await checkPermission(user.id, 'products', 'create');
    if (!hasPermission.allowed) {
      return reply.code(403).send({
        success: false,
        message: 'Permission denied'
      });
    }
  }
  
  // Create product
  const product = await productService.create(request.body, user.id);
  return reply.send({ success: true, data: product });
});
```

---

## ✅ What's Implemented

### **1. Unified JWT Authentication**
- ✅ Both user types use JWT tokens
- ✅ Same token format and expiry
- ✅ Same refresh mechanism
- ✅ Access tokens: Short-lived (24h default)
- ✅ Refresh tokens: Long-lived (7d default)

### **2. Dual User Support**
- ✅ Middleware checks both `inventoryusers` and `users` tables
- ✅ Automatically detects user type
- ✅ Attaches `userType` to request
- ✅ Supports token revocation for inventory users

### **3. Flexible Auth Middleware**
- ✅ `requireAuthentication` - Strict (auth required)
- ✅ `optionalAuth` - Flexible (auth optional)
- ✅ No middleware - Public routes

### **4. Updated Services**
- ✅ `inventoryusers.service.ts` - Uses JWT (already done)
- ✅ `users.service.ts` - Updated to use JWT
- ✅ Both return same token format
- ✅ All authentication methods (email, mobile, OTP) use JWT

---

## 🔒 Security Best Practices

### **1. Route Protection Levels**

| Level | Middleware | Use Case |
|-------|-----------|----------|
| **Public** | None | Browse products, view details |
| **Optional** | `optionalAuth` | Cart, wishlist (guest or user) |
| **Protected** | `requireAuthentication` | Orders, profile, checkout |
| **Admin** | `requireAuthentication` + Permission check | Inventory management |

---

### **2. User Type Detection**

```typescript
// In your handlers
if (request.user?.userType === 'inventory') {
  // Internal user - check permissions
  const hasPermission = await checkPermission(user.id, 'products', 'read');
} else if (request.user?.userType === 'ecommerce') {
  // E-commerce user - simple access
} else {
  // Guest user (optionalAuth, no token)
}
```

---

### **3. Token Security**

- ✅ **Access tokens**: Short-lived (24h) - Stateless verification
- ✅ **Refresh tokens**: Long-lived (7d) - Stored in DB for revocation
- ✅ **Token revocation**: Supported for inventory users (via `sessiontoken` field)
- ✅ **Sliding expiry**: Optional refresh token extension on use

---

## 📝 Files Modified

### **Core Files:**
- ✅ `src/services/users.service.ts` - Updated to JWT
- ✅ `src/services/inventoryusers.service.ts` - Already using JWT
- ✅ `src/middleware/auth.middleware.ts` - Supports both user types
- ✅ `src/middleware/flexibleAuth.middleware.ts` - New optional auth middleware
- ✅ `src/routes/users.route.ts` - Updated schema for JWT tokens
- ✅ `src/routes/auth.route.ts` - JWT token refresh endpoint
- ✅ `src/utils/jwt.ts` - JWT token generation and verification

### **Interface Updates:**
- ✅ `AuthenticatedRequest` interface - Added `userType` and `roleId` fields

---

## 🚀 Quick Reference

### **Auth Endpoints:**
- Inventory: `POST /v1/auth/signin`
- E-Commerce: `POST /v1/users/signin`
- Refresh: `POST /v1/auth/refresh` (both user types)

### **Middleware:**
- `requireAuthentication` - Auth required (import from `auth.middleware.js`)
- `optionalAuth` - Auth optional (import from `flexibleAuth.middleware.js`)
- No middleware - Public route

### **User Types:**
- `inventory` - Internal users (roles + permissions)
- `ecommerce` - Public users (simple auth)
- `undefined` - Guest users (no token)

### **Token Format:**
```typescript
{
  userId: number;
  email: string;
  roleId?: number; // Only for inventory users
  iat: number; // Issued at
  exp: number; // Expires at
}
```

---

## 🎯 Recommended Route Configuration

### **E-Commerce Routes:**

```typescript
// Public routes (no auth)
fastify.get('/products', productController.getAll);
fastify.get('/products/:id', productController.getById);
fastify.get('/promotions', promotionController.getAll);

// Optional auth (better UX if logged in)
fastify.get('/cart', {
  preHandler: optionalAuth
}, cartController.getCart);

fastify.post('/cart', {
  preHandler: optionalAuth
}, cartController.addToCart);

// Protected routes (auth required)
fastify.post('/orders', {
  preHandler: requireAuthentication
}, orderController.create);

fastify.get('/orders', {
  preHandler: requireAuthentication
}, orderController.getUserOrders);
```

---

### **Inventory Routes:**

```typescript
// All routes protected (auth + permissions)
fastify.get('/products', {
  preHandler: requireAuthentication
}, productController.getAll);

fastify.post('/products', {
  preHandler: requireAuthentication
}, productController.create);

// Permission check happens in controller/service
```

---

## 💡 Best Practices

### **For E-Commerce:**

1. **Browse/View** → Public (no middleware)
2. **Cart/Wishlist** → Optional auth (better UX if logged in)
3. **Checkout/Orders** → Required auth (must login)
4. **Profile** → Required auth (must login)

### **For Inventory:**

1. **All routes** → Required auth
2. **Add permission checks** → In controller/service layer
3. **Use `userType` check** → Ensure only inventory users access certain routes

---

## 📊 Summary

### **✅ What Works Now:**

1. ✅ **Unified JWT Auth** - Both user types use JWT
2. ✅ **Dual User Support** - Middleware checks both tables
3. ✅ **Flexible Routes** - Public, optional, or protected
4. ✅ **User Type Detection** - Know which frontend user is from
5. ✅ **Same Backend** - One API serves both frontends
6. ✅ **Token Refresh** - Both user types can refresh tokens
7. ✅ **Security** - Token revocation, expiry, and validation

### **🎯 Next Steps:**

1. ✅ **Configure routes** - Add appropriate middleware to each route
2. ✅ **Test both flows** - Inventory and e-commerce authentication
3. ✅ **Add permission checks** - For inventory routes (if needed)
4. ✅ **Update frontend** - Use new JWT token format

---

## 🔧 Configuration

### **Environment Variables:**

```env
# JWT Configuration
JWT_SECRET=your-secret-key-change-this-in-production
JWT_ACCESS_TOKEN_EXPIRY=24h  # Access token expiry
JWT_REFRESH_TOKEN_EXPIRY=7d  # Refresh token expiry
JWT_REFRESH_ON_USE=true      # Extend refresh token on use
```

### **Token Expiry:**
- **Access Token**: 24 hours (default)
- **Refresh Token**: 7 days (default)
- **Sliding Expiry**: Optional (extends refresh token on each use)

---

**Your backend is now ready to serve both frontends!** 🎉

