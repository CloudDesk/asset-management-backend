Smart Authentication Implementation Walkthrough
Overview
Successfully implemented a unified authentication strategy for both E-commerce and Inventory applications using a public route whitelist pattern. This provides centralized route protection without requiring manual preHandler configuration on each route.

What Was Implemented
1. Public Routes Configuration
File: 
src/config/publicRoutes.ts

Created a centralized configuration file that defines all public routes for both applications:

E-commerce Public Routes (10 routes):

Authentication: POST /v1/mobile-auth/request-otp, POST /v1/mobile-auth/verify-otp
Product Browsing: GET /v1/products/platform/:platform, GET /v1/products/platform/:platform/counts, GET /v1/products/:productId/platform/:platform
Promotions: GET /v1/promotions/public, GET /v1/promotions/active
Ratings: GET /v1/ratings/product/:productId
Picklists: GET /v1/picklists
Health: GET /v1/health, GET /health
Inventory Public Routes (5 routes):

Authentication: POST /v1/auth/signin, POST /v1/auth/forgot-password
User Management: POST /v1/inventoryusers
Roles: GET /v1/roles
Health: GET /v1/health, GET /health
Key Features:

Exact path matching with support for :param style parameters
Query parameters are ignored for matching
Deduplication of common routes (health check)
Type-safe route matching utilities
2. Smart Authentication Middleware
File: 
src/middleware/smartAuth.middleware.ts

Created middleware that automatically determines if routes require authentication:

export async function smartAuthentication(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const method = request.method;
  const url = request.url;
  // Check if this route is in the public routes list
  const isPublic = isPublicRoute(method, url);
  if (isPublic) {
    // Public route - skip authentication
    return;
  }
  // Protected route - require authentication
  return requireAuthentication(request, reply);
}
How It Works:

Extracts HTTP method and URL from request
Checks if route matches any public route pattern
If public → Skip authentication, continue to handler
If protected → Require authentication via existing 
requireAuthentication
 middleware
3. Global Route Protection
File: 
src/routes/index.ts

Updated route registration to apply smart authentication globally:

await fastify.register(async function (fastify) {
  // Apply smart authentication to ALL /v1 routes
  fastify.addHook('preHandler', smartAuthentication);
  
  // All route registrations...
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(mobileAuthRoutes, { prefix: '/mobile-auth' });
  await fastify.register(productRoutes, { prefix: '/products' });
  // ... etc
}, { prefix: '/v1' });
Benefits:

✅ Single addHook call protects all routes
✅ No manual preHandler needed on individual routes
✅ New routes are protected by default
✅ Easy to add/remove public routes
Files Created
/src/config/publicRoutes.ts
 - Public routes configuration
/src/middleware/smartAuth.middleware.ts
 - Smart authentication middleware
/test-auth-routes.sh
 - Automated testing script
Files Modified
/src/routes/index.ts
 - Applied smart authentication globally
How to Test
Step 1: Restart the Server
IMPORTANT

The server needs to be restarted to apply the changes.

# Stop the current server (Ctrl+C in the terminal running npm run dev)
# Then restart:
npm run dev
Step 2: Run Automated Tests
# Make the test script executable
chmod +x test-auth-routes.sh
# Run the tests
./test-auth-routes.sh
The test script will verify:

✅ All E-commerce public routes are accessible without authentication
✅ All Inventory public routes are accessible without authentication
✅ All other routes require authentication (return 401 without token)
Step 3: Manual Testing
Test Public Routes (should work without token):

# E-commerce - Product browsing
curl http://localhost:3000/v1/products/platform/ecommerce
# E-commerce - Promotions
curl http://localhost:3000/v1/promotions/public
# Inventory - Sign in
curl -X POST http://localhost:3000/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"useremail":"test@test.com","userpassword":"password"}'
# Inventory - Roles
curl http://localhost:3000/v1/roles?limit=1000&isactive=true
Test Protected Routes (should return 401 without token):

# Should return 401
curl http://localhost:3000/v1/orders
curl http://localhost:3000/v1/products
curl http://localhost:3000/v1/carts
Test Protected Routes with Token (should work):

# First, get a token by signing in
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"useremail":"your@email.com","userpassword":"yourpassword"}' \
  | jq -r '.data.token')
# Then use the token
curl http://localhost:3000/v1/orders \
  -H "Authorization: Bearer $TOKEN"
Architecture Diagram
┌─────────────────────────────────────────────────────────────┐
│                     Incoming Request                         │
│              (E-commerce or Inventory Frontend)              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          Smart Authentication Middleware                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Extract method + URL                               │  │
│  │ 2. Check against publicRoutes.ts                      │  │
│  │ 3. If public → Skip auth                              │  │
│  │ 4. If protected → Require auth                        │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
        ┌──────────────┐        ┌──────────────┐
        │   Public     │        │  Protected   │
        │   Routes     │        │   Routes     │
        │ (No Auth)    │        │ (Auth Req'd) │
        └──────────────┘        └──────────────┘
                │                       │
                │                       ▼
                │               ┌──────────────┐
                │               │ Verify Token │
                │               │ (JWT + DB)   │
                │               └──────────────┘
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ Route Handler│
                    └──────────────┘
Security Benefits
🔒 Secure by Default
New routes automatically require authentication unless explicitly added to public routes list
Prevents accidental exposure of sensitive endpoints
Clear audit trail of all public endpoints
🎯 Centralized Control
All public routes defined in one file
Easy to review and update
Security team can audit a single file
✅ Type Safety
TypeScript ensures route patterns are strings
Compile-time checks for configuration errors
Runtime validation of route matching
Troubleshooting
Server Not Starting
If the server doesn't start after the changes:

Check for TypeScript errors:

npx tsc --noEmit
Check for runtime errors:

npm run dev
# Look for error messages in the console
Verify imports:

Ensure 
smartAuth.middleware.ts
 imports correctly
Ensure 
publicRoutes.ts
 exports are correct
Routes Not Protected
If routes that should be protected are accessible without auth:

Check route pattern matching:

Verify the route path in 
publicRoutes.ts
Check for typos in method or path
Ensure :param syntax is correct
Check middleware application:

Verify 
smartAuthentication
 is applied in 
index.ts
Ensure no individual routes override with their own preHandler
Public Routes Requiring Auth
If public routes are returning 401:

Check route is in public list:

Verify route exists in ECOMMERCE_PUBLIC_ROUTES or INVENTORY_PUBLIC_ROUTES
Check method matches (GET vs POST)
Check path matches exactly
Check path parameter matching:

Ensure :param syntax is used for dynamic segments
Example: /v1/products/:productId/platform/:platform