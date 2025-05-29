# 🔓 Authentication Control Guide

This guide shows you **exactly how to remove authentication** from specific routes or make them optional.

## ✅ **Current Status - What Works**

After our changes, your API now has:

### 🌐 **Public Routes** (No Authentication Required)
- ✅ `GET /health` - Health check
- ✅ `POST /v1/auth/register` - User registration  
- ✅ `POST /v1/auth/signin` - User sign in
- ✅ `POST /v1/auth/forgot-password` - Password reset
- ✅ `GET /v1/products` - **NOW PUBLIC!** 📦
- ✅ `GET /v1/stocks` - **NOW PUBLIC!** 📊

### 🔒 **Protected Routes** (Authentication Required)
- 🔐 `/v1/inventoryusers` - Inventory users
- 🔐 `/v1/picklists` - Picklists
- 🔐 `/v1/suppliers` - Suppliers
- 🔐 `/v1/purchaseorders` - Purchase orders
- 🔐 `/v1/purchaserequests` - Purchase requests
- 🔐 `/v1/quotes` - Quotes
- 🔐 `/v1/notes` - Notes
- 🔐 `/v1/users` - Users

## 🛠️ **How to Make Routes Public**

### **Method 1: Move Routes to Public Scope** (Simplest)

In `src/routes/index.ts`, move routes **outside** the protected scope:

```typescript
// API v1 routes
await fastify.register(async function (fastify) {
  // =====================================================
  // PUBLIC ROUTES (No Authentication Required)
  // =====================================================
  
  // Authentication routes
  await fastify.register(authRoutes, { prefix: '/auth' });

  // Make these routes public by putting them here
  await fastify.register(productRoutes, { prefix: '/products' });
  await fastify.register(stockRoutes, { prefix: '/stocks' });
  await fastify.register(notesRoutes, { prefix: '/notes' }); // ← Add this to make notes public

  // =====================================================
  // PROTECTED ROUTES (Authentication Required)  
  // =====================================================
  await fastify.register(async function (fastify) {
    // Apply authentication middleware to all routes in this scope
    fastify.addHook('preHandler', requireAuthentication);

    // Only protected routes go here
    await fastify.register(inventoryUsersRoutes, { prefix: '/inventoryusers' });
    await fastify.register(supplierRoutes, { prefix: '/suppliers' });
    // ... other protected routes
  });

}, { prefix: '/v1' });
```

### **Method 2: Optional Authentication** (Enhanced Experience)

For routes that work better with authentication but don't require it:

```typescript
import { optionalAuthentication } from '../middleware/auth.middleware.js';

// =====================================================
// OPTIONAL AUTHENTICATION ROUTES
// =====================================================
await fastify.register(async function (fastify) {
  // Apply optional authentication - enhances experience if authenticated
  fastify.addHook('preHandler', optionalAuthentication);

  // These routes work without auth but provide more info if authenticated
  await fastify.register(notesRoutes, { prefix: '/notes' });
  await fastify.register(usersRoutes, { prefix: '/users/info' });
});
```

### **Method 3: Route-Level Control** (Granular)

Control authentication per individual route within a route file:

```typescript
// In your route file (e.g., src/routes/product.route.ts)
import { requireAuthentication, optionalAuthentication } from '../middleware/auth.middleware.js';

export async function productRoutes(fastify: FastifyInstance) {
  // PUBLIC: Anyone can view products
  fastify.get('/', {
    schema: {
      description: 'Get products - No authentication required',
      tags: ['Products - Public'],
    },
  }, productController.getProducts);

  // OPTIONAL: Better experience if authenticated  
  fastify.get('/:id', {
    preHandler: optionalAuthentication,
    schema: {
      description: 'Get product details - Enhanced with authentication',
      tags: ['Products - Optional Auth'],
    },
  }, productController.getProductDetails);

  // PROTECTED: Only authenticated users can create
  fastify.post('/', {
    preHandler: requireAuthentication,
    schema: {
      description: 'Create product - Authentication required',
      tags: ['Products - Protected'],
      security: [{ bearerAuth: [] }],
    },
  }, productController.createProduct);
}
```

## 🧪 **Testing Your Changes**

### **Test Public Routes** (Should work without token)
```bash
# These should work without authentication
curl "http://localhost:5600/v1/products?limit=2"
curl "http://localhost:5600/v1/stocks?limit=2"
curl "http://localhost:5600/health"
```

### **Test Protected Routes** (Should require token)
```bash
# These should return 401 without authentication
curl "http://localhost:5600/v1/inventoryusers"
curl "http://localhost:5600/v1/suppliers"

# These should work with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" "http://localhost:5600/v1/inventoryusers"
```

## 📝 **Quick Examples**

### **Make Notes Public**
```typescript
// In src/routes/index.ts, move this line:
await fastify.register(notesRoutes, { prefix: '/notes' });
// FROM: Inside the protected scope
// TO: Inside the public scope (outside the authentication middleware)
```

### **Make User Profiles Public**
```typescript
// Move this line to public scope:
await fastify.register(usersRoutes, { prefix: '/users' });
```

### **Make Everything Public** (Remove all authentication)
```typescript
// In src/routes/index.ts, put ALL routes in public scope:
await fastify.register(async function (fastify) {
  // All routes public
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(productRoutes, { prefix: '/products' });
  await fastify.register(stockRoutes, { prefix: '/stocks' });
  await fastify.register(inventoryUsersRoutes, { prefix: '/inventoryusers' });
  await fastify.register(supplierRoutes, { prefix: '/suppliers' });
  // ... all other routes
}, { prefix: '/v1' });
```

## ⚠️ **Important Notes**

1. **Restart Required**: After changing routes, you must restart the server:
   ```bash
   npm run build
   npm start
   ```

2. **Security Consideration**: Think carefully about what data should be public
3. **Documentation**: Update your Swagger docs by removing `security: [{ bearerAuth: [] }]` from public routes
4. **Testing**: Always test both authenticated and unauthenticated access

## 🎯 **Ready-to-Use Examples**

### **Scenario 1: E-commerce Style (Public Catalog)**
```typescript
// PUBLIC: Product browsing, basic user info
await fastify.register(productRoutes, { prefix: '/products' });
await fastify.register(stockRoutes, { prefix: '/stocks' });

// PROTECTED: Orders, admin functions  
// (inside protected scope)
await fastify.register(purchaseOrderRoutes, { prefix: '/purchaseorders' });
await fastify.register(inventoryUsersRoutes, { prefix: '/inventoryusers' });
```

### **Scenario 2: Completely Open API**
```typescript
// Put ALL routes in public scope - no authentication required anywhere
```

### **Scenario 3: Mixed Access**
```typescript
// PUBLIC: Basic operations
await fastify.register(productRoutes, { prefix: '/products' });

// OPTIONAL: Enhanced if authenticated
// (use optionalAuthentication middleware)
await fastify.register(notesRoutes, { prefix: '/notes' });

// PROTECTED: Sensitive operations
// (inside protected scope)
await fastify.register(inventoryUsersRoutes, { prefix: '/inventoryusers' });
```

---

**🚀 You now have complete control over which routes require authentication!**

**Current Working Examples:**
- ✅ Products: `curl "http://localhost:5600/v1/products?limit=2"` (Public)
- ✅ Stocks: `curl "http://localhost:5600/v1/stocks?limit=2"` (Public)  
- 🔒 Inventory Users: Requires authentication
- 🔒 Suppliers: Requires authentication 