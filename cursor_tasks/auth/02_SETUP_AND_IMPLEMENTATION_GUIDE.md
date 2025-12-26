# Auth Sessions & Smart Authentication Setup Guide

## 📋 Overview

This guide covers the complete authentication system including:
- **Smart Authentication Middleware** - Automatic route protection with public route whitelisting
- **Session Management** - Secure refresh token handling with Prisma
- **Automated Cleanup** - Session cleanup using node-cron (no pg_cron needed)

---

## 🚀 Quick Start

### Step 1: Install Required Packages

```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

### Step 2: Update Prisma Schema

The `AuthSession` model has been updated to use:
- `Int` ID with auto-increment (instead of UUID)
- `BigInt` timestamps (instead of DateTime)
- Matches existing schema pattern

```prisma
model AuthSession {
  id                Int      @id @default(autoincrement())
  userId            Int
  userType          String   @db.VarChar(20) // 'inventory' or 'ecommerce'
  refreshTokenHash  String   @db.Text
  expiresAt         BigInt   // Unix timestamp in milliseconds
  isRevoked         Boolean  @default(false)
  ipAddress         String?  @db.VarChar(45)
  userAgent         String?  @db.Text
  createddate       BigInt?
  modifieddate      BigInt?
  
  @@index([userId, userType])
  @@index([refreshTokenHash])
  @@map("auth_sessions")
}
```

### Step 3: Generate Prisma Client

```bash
npx prisma generate
```

### Step 4: Create Database Table (Optional - Manual SQL)

If you prefer manual SQL execution instead of Prisma migrations:

```bash
# Run the SQL file
psql -U your_user -d your_database -f cursor_tasks/auth/prisma_auth_sessions.sql
```

Or use Prisma migrations:

```bash
npx prisma migrate dev --name add_auth_sessions_bigint
```

---

## � Smart Authentication System

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Incoming Request                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          Smart Authentication Middleware                     │
│  1. Check if route matches public routes list               │
│  2. If public → Skip authentication                          │
│  3. If protected → Require authentication                    │
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
```

### Files Created

1. **`src/config/publicRoutes.ts`** - Public routes configuration
2. **`src/middleware/smartAuth.middleware.ts`** - Smart authentication middleware
3. **`src/services/authsession.service.ts`** - Session management service
4. **`src/utils/sessionCleanup.ts`** - Automated cleanup scheduler

### Public Routes Configuration

**File**: `src/config/publicRoutes.ts`

Defines all routes accessible without authentication:

```typescript
// E-commerce public routes
export const ECOMMERCE_PUBLIC_ROUTES = [
  'POST /v1/mobile-auth/request-otp',
  'POST /v1/mobile-auth/verify-otp',
  'GET /v1/products/platform/nivapp',  // Only nivapp is public
  'GET /v1/promotions/public',
  'GET /v1/ratings/product/:productId',
  'GET /v1/picklists',
  'GET /v1/health',
];

// Inventory public routes
export const INVENTORY_PUBLIC_ROUTES = [
  'POST /v1/auth/signin',
  'POST /v1/auth/forgot-password',
  'POST /v1/inventoryusers',
  'GET /v1/roles',
  'GET /v1/health',
];
```

**Key Features**:
- ✅ Exact path matching
- ✅ Supports `:param` style parameters
- ✅ Query parameters ignored
- ✅ Platform-specific routes (e.g., only `nivapp` is public, `amazon` requires auth)

### Smart Authentication Middleware

**File**: `src/middleware/smartAuth.middleware.ts`

Automatically determines if routes require authentication:

```typescript
export async function smartAuthentication(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const method = request.method;
  const url = request.url;
  
  // Check if route is public
  if (isPublicRoute(method, url)) {
    return; // Skip authentication
  }
  
  // Protected route - require authentication
  return requireAuthentication(request, reply);
}
```

### Global Route Protection

**File**: `src/routes/index.ts`

Applied to all `/v1` and `/v2` routes:

```typescript
await fastify.register(async function (fastify) {
  // Register all routes...
  await fastify.register(productRoutes, { prefix: '/products' });
  await fastify.register(ordersRoutes, { prefix: '/orders' });
  // ... etc
  
  // Apply smart authentication to ALL routes
  fastify.addHook('preHandler', smartAuthentication);
}, { prefix: '/v1' });

// Also applied to v2
await fastify.register(async function (fastify) {
  await fastify.register(picklistRoutesV2, { prefix: '/picklists' });
  fastify.addHook('preHandler', smartAuthentication);
}, { prefix: '/v2' });
```

**Benefits**:
- ✅ **Secure by default** - All routes protected unless explicitly whitelisted
- ✅ **No manual preHandlers** - Removed from individual route files
- ✅ **Centralized control** - One file (`publicRoutes.ts`) manages all public routes
- ✅ **Easy to maintain** - Add/remove public routes in one place

---

## 🔄 Session Management

### Session Service

**File**: `src/services/authsession.service.ts`

Provides all session operations:
- ✅ Create session
- ✅ Verify refresh token
- ✅ Revoke session
- ✅ Revoke all user sessions
- ✅ Get active sessions
- ✅ Enforce session limits
- ✅ Rotate tokens
- ✅ Cleanup expired sessions

### Usage Examples

#### Creating a Session (During Login)

```typescript
import { authSessionService } from '../services/authsession.service.js';

// After successful authentication
const session = await authSessionService.createSession({
  userId: user.id,
  userType: 'inventory', // or 'ecommerce'
  refreshToken: generatedRefreshToken,
  expiresInDays: 7,
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});
```

#### Verifying Refresh Token

```typescript
const session = await authSessionService.verifyRefreshToken(
  refreshTokenFromRequest,
  'inventory'
);

if (!session) {
  return reply.code(401).send({ message: 'Invalid refresh token' });
}
```

#### Logout (Revoke Session)

```typescript
// Single device logout
await authSessionService.revokeSession(sessionId);

// All devices logout
await authSessionService.revokeAllUserSessions(userId, 'inventory');
```

---

## 🧹 Automated Cleanup

### Cleanup Scheduler

**File**: `src/utils/sessionCleanup.ts`

Uses **node-cron** to automatically clean up expired sessions:

```typescript
// Runs every day at 2:00 AM
cron.schedule('0 2 * * *', async () => {
  await authSessionService.cleanupExpiredSessions();
});
```

### Enable Scheduler

Add to your server initialization:

```typescript
import { scheduleSessionCleanup } from './utils/sessionCleanup.js';

// Start session cleanup scheduler
scheduleSessionCleanup();
```

---

## 📡 HTTP Status Codes & Frontend Handling

### When to Logout User

| Status Code | Logout User? | Reason | Frontend Action |
|-------------|--------------|--------|-----------------|
| **401** | ✅ YES | Token invalid/expired | Clear tokens, redirect to login |
| **429** | ❌ NO | Rate limited | Show error, wait before retry |
| **500** | ❌ NO | Server error | Show error, don't logout |

### Frontend Error Handling

```typescript
async function apiCall(url, options) {
  const response = await fetch(url, options);
  
  switch (response.status) {
    case 401:
      // Token invalid/expired - LOGOUT
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      router.push('/login');
      break;
      
    case 429:
      // Rate limited - SHOW ERROR, DON'T LOGOUT
      showError('Too many requests. Please wait before trying again.');
      break;
      
    case 500:
      // Server error - SHOW ERROR, DON'T LOGOUT
      showError('Server error. Please try again later.');
      break;
  }
}
```

### Why 429 Happens

**429 Too Many Requests** occurs when:
- User makes too many authentication attempts
- Rate limiting protects against brute force attacks
- Token is expired and frontend keeps retrying

**Solution**: Frontend should detect 401 errors immediately and logout, not retry with expired tokens.

---

## 🧪 Testing

### Test Public Routes (No Auth Required)

```bash
# E-commerce - Product browsing (nivapp only)
curl http://localhost:5600/v1/products/platform/nivapp

# E-commerce - Promotions
curl http://localhost:5600/v1/promotions/public

# Inventory - Sign in
curl -X POST http://localhost:5600/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"useremail":"test@test.com","userpassword":"password"}'
```

### Test Protected Routes (Auth Required)

```bash
# Should return 401 without token
curl http://localhost:5600/v1/orders

# Should return 401 (amazon platform requires auth)
curl http://localhost:5600/v1/products/platform/amazon

# Should work with valid token
curl http://localhost:5600/v1/orders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Rate Limiting

```bash
# Make multiple requests quickly to trigger 429
for i in {1..10}; do
  curl http://localhost:5600/v1/stocks
done
```

---

## 📊 Database Queries

### Check Sessions

```sql
-- All active sessions
SELECT id, "userId", "userType", createddate, "expiresAt", "isRevoked"
FROM auth_sessions
WHERE "isRevoked" = false 
  AND "expiresAt" > EXTRACT(EPOCH FROM NOW()) * 1000;

-- Sessions per user
SELECT "userId", "userType", COUNT(*) as session_count
FROM auth_sessions
WHERE "isRevoked" = false
GROUP BY "userId", "userType";

-- Expired sessions
SELECT COUNT(*) FROM auth_sessions 
WHERE "expiresAt" < EXTRACT(EPOCH FROM NOW()) * 1000;
```

---

## 🔒 Security Best Practices

1. **Never log refresh tokens** - They are sensitive credentials
2. **Always hash refresh tokens** - Done automatically by the service
3. **Enforce session limits** - Prevent session bloat
4. **Run cleanup regularly** - Use the scheduler
5. **Track IP and User Agent** - For security auditing
6. **Use HTTPS only** - In production
7. **Secure by default** - All routes protected unless whitelisted

---

## ✅ Implementation Checklist

- [x] Install node-cron
- [x] Update Prisma schema with BigInt timestamps
- [x] Generate Prisma client
- [x] Create public routes configuration
- [x] Implement smart authentication middleware
- [x] Apply smart auth to /v1 and /v2 routes
- [x] Remove manual preHandlers from route files
- [x] Create session service
- [x] Create cleanup scheduler
- [x] Test public routes
- [x] Test protected routes
- [x] Document frontend error handling

---

## 🚨 Rate Limiting System

### Overview

The system implements **two separate rate limiters** to protect against brute force attacks while maintaining good user experience:

1. **Protected Route Rate Limiter** - 15-minute window
2. **OTP Route Rate Limiter** - 2-minute window (faster recovery)

---

### 1️⃣ Protected Route Rate Limiting

**Configuration**: `src/utils/auth.ts`

```typescript
// 5 attempts in 15 minutes for protected routes
export const authRateLimit = new AuthRateLimit(5, 15 * 60 * 1000);
```

**Where Applied**: `src/middleware/auth.middleware.ts`

**Identifier**: `IP + Token`

**Example**: `"127.0.0.1-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`

#### When It Triggers:

```
1. User → GET /v1/stocks (protected route)
2. Smart Auth → Not in public list → Require authentication
3. Auth Middleware → Extract token from header
4. Rate Limit Check → identifier = "IP-Token"
5. Token Verification → FAILS (expired/invalid)
6. Record Failed Attempt → count++
7. After 5 failures → Return 429 for 15 minutes
```

#### Response:

```json
{
  "success": false,
  "message": "Too many authentication attempts",
  "details": "Please try again later",
  "statusCode": 429,
  "remainingAttempts": 0,
  "retryAfter": 900
}
```

---

### 2️⃣ OTP Route Rate Limiting

**Configuration**: `src/utils/auth.ts`

```typescript
// 5 attempts in 2 minutes for OTP routes (faster recovery)
export const otpRateLimit = new AuthRateLimit(5, 2 * 60 * 1000);
```

**Where Applied**: `src/routes/mobile-auth.route.ts`

**Identifier**: `IP + Mobile Number`

**Example**: `"127.0.0.1-9876543210"`

#### Routes Affected:

```typescript
POST /v1/mobile-auth/request-otp  // ✅ Public but rate limited (2 min)
POST /v1/mobile-auth/verify-otp   // ✅ Public but rate limited (2 min)
```

#### When It Triggers:

**request-otp**:
```
1. User → POST /v1/mobile-auth/request-otp
2. Smart Auth → Public route → Skip auth middleware
3. Route Handler → Check otpRateLimit
4. User not found → Record failed attempt
5. After 5 failures → Return 429 for 2 minutes
```

**verify-otp**:
```
1. User → POST /v1/mobile-auth/verify-otp
2. Smart Auth → Public route → Skip auth middleware
3. Route Handler → Check otpRateLimit
4. OTP invalid/expired → Record failed attempt
5. After 5 failures → Return 429 for 2 minutes
```

#### Response:

```json
{
  "success": false,
  "message": "Too many OTP requests",
  "details": "Please try again later",
  "statusCode": 429,
  "remainingAttempts": 0
}
```

---

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Request to Backend                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  Smart Authentication │
                │  Check Public Routes  │
                └───────────┬───────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
    ┌──────────────┐              ┌──────────────────┐
    │   PUBLIC     │              │    PROTECTED     │
    │   ROUTES     │              │     ROUTES       │
    └──────┬───────┘              └────────┬─────────┘
           │                               │
           │                               ▼
           │                    ┌──────────────────────┐
           │                    │ Auth Middleware      │
           │                    │ Rate Limit Check     │
           │                    │ (IP + Token)         │
           │                    │ 15-minute window     │
           │                    └──────────┬───────────┘
           │                               │
           │                    ┌──────────┴──────────┐
           │                    │                     │
           │                    ▼                     ▼
           │             ┌─────────────┐      ┌─────────────┐
           │             │ Valid Token │      │Invalid Token│
           │             │ → Success   │      │ → 401/429   │
           │             └─────────────┘      └─────────────┘
           │
           ▼
    ┌──────────────────────┐
    │ OTP Routes Have      │
    │ Their Own Rate Limit │
    │ (IP + Mobile)        │
    │ 2-minute window      │
    └──────────┬───────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌─────────────┐    ┌─────────────┐
│ Valid OTP   │    │ Invalid OTP │
│ → Success   │    │ → 429       │
└─────────────┘    └─────────────┘
```

---

### Summary Table

| Route Type | Rate Limiter | Identifier | Max Attempts | Window | Error Message |
|------------|--------------|------------|--------------|--------|---------------|
| **Protected Routes** (e.g., `/v1/stocks`) | `authRateLimit` | `IP + Token` | 5 | 15 min | "Too many authentication attempts" |
| **OTP request-otp** | `otpRateLimit` | `IP + Mobile` | 5 | **2 min** | "Too many OTP requests" |
| **OTP verify-otp** | `otpRateLimit` | `IP + Mobile` | 5 | **2 min** | "Too many OTP requests" |
| **Other Public Routes** (e.g., `/v1/products/platform/nivapp`) | None | N/A | N/A | N/A | N/A |

---

### Why Different Windows?

**Protected Routes (15 minutes)**:
- Longer window for security
- Prevents token brute forcing
- User can wait or get new token

**OTP Routes (2 minutes)**:
- Shorter window for better UX
- Users may mistype OTP
- Faster recovery for legitimate users
- Still prevents brute force attacks

---

### Troubleshooting 429 Errors

#### Issue: Users Getting 429 on Protected Routes

**Cause**: Frontend using expired token and retrying

**Solution**:
```typescript
// Frontend should detect 401 and logout immediately
if (response.status === 401) {
  localStorage.removeItem('token');
  router.push('/login');
  // DON'T retry with same token!
}
```

#### Issue: Users Getting 429 on OTP Routes

**Cause**: Multiple failed OTP attempts

**Solution**:
- Wait 2 minutes before allowing retry
- Show countdown timer to user
- Provide clear error message

```typescript
if (response.status === 429) {
  const retryAfter = 120; // 2 minutes
  showError(`Too many attempts. Please wait ${retryAfter} seconds.`);
  startCountdown(retryAfter);
}
```

---

## 🎯 Key Improvements

### Before
- ❌ Manual `preHandler` on each route
- ❌ Inconsistent route protection
- ❌ Hard to maintain
- ❌ Easy to forget authentication on new routes
- ❌ Single rate limit for all routes

### After
- ✅ Automatic route protection
- ✅ Centralized public routes list
- ✅ Secure by default
- ✅ Easy to maintain
- ✅ New routes automatically protected
- ✅ Separate rate limiters for different use cases
- ✅ Better user experience with shorter OTP window

---

**Ready to go!** 🚀 Your authentication system is now fully implemented with smart authentication, session management, and intelligent rate limiting.

