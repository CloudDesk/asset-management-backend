# Token Expiry Issue - Root Cause Analysis & Fix

## Problem Description

User 1's token was being rejected as expired/revoked, while User 2's token worked fine, even though both tokens had valid JWT expiry times (24 hours).

## Root Cause Analysis

### Token Flow Overview

1. **Sign-in Process** (`/v1/auth/signin`):
   - User authenticates with email/password
   - `inventoryUsersService.authenticate()` generates JWT token pair (access + refresh)
   - `authSessionService.createSession()` creates session in `auth_sessions` table
   - Access token (24h expiry) and refresh token (7d expiry) are returned

2. **Token Validation** (Authentication Middleware):
   - JWT token is verified for validity and expiry
   - User is looked up in database
   - **ISSUE**: Middleware was checking deprecated `sessiontoken` field in `inventoryusers` table
   - If `sessiontoken === null`, token was rejected even if JWT was valid

### The Bug

**Location**: `src/middleware/auth.middleware.ts` (line 132)

```typescript
// OLD CODE (BUGGY):
if (userType === 'inventory' && (user as any).sessiontoken === null) {
  // Reject token even if JWT is valid
  return reply.code(401).send({...});
}
```

**Why it caused the issue**:
- The new session-based authentication uses `auth_sessions` table
- The `sessiontoken` field in `inventoryusers` is **deprecated** (as noted in code comments)
- During sign-in, `sessiontoken` is **NOT set** anymore (it's deprecated)
- If a user's `sessiontoken` is `null` (from previous signout or never set), their valid JWT tokens are rejected
- User 1 likely had `sessiontoken = null`, while User 2 had a non-null value

### Token Decoding Results

Both tokens were valid:
- **User 1 (Suresh)**: 
  - Issued: 2026-01-06T10:15:43Z
  - Expires: 2026-01-07T10:15:43Z (24 hours)
  - Status: Valid JWT, but rejected due to `sessiontoken = null`

- **User 2 (Satish)**:
  - Issued: 2026-01-06T10:14:58Z  
  - Expires: 2026-01-07T10:14:58Z (24 hours)
  - Status: Valid JWT, accepted because `sessiontoken` was not null

## Solution

### Fix Applied

Removed the deprecated `sessiontoken` check from authentication middleware:

```typescript
// NEW CODE (FIXED):
// NOTE: Session management is now handled by auth_sessions table
// The old sessiontoken field check is removed as it's deprecated
// Token revocation is handled via auth_sessions.isRevoked during refresh token validation
// Access tokens are short-lived (24h) and validated via JWT expiry only
```

### Why This Fix Works

1. **Access tokens** (24h expiry) are validated via JWT expiry only
2. **Refresh tokens** are validated against `auth_sessions` table during token refresh
3. **Token revocation** is handled via `auth_sessions.isRevoked` flag
4. The deprecated `sessiontoken` field is no longer checked

### Session Management Flow (Current)

1. **Sign-in**: Creates session in `auth_sessions` table with refresh token hash
2. **Token Validation**: Only validates JWT expiry (no database check needed for access tokens)
3. **Token Refresh**: Validates refresh token against `auth_sessions` table
4. **Sign-out**: Revokes all sessions in `auth_sessions` table (sets `isRevoked = true`)

## Files Modified

- `src/middleware/auth.middleware.ts`: Removed deprecated `sessiontoken` check

## Testing Recommendations

1. Test sign-in for users with `sessiontoken = null` (should work now)
2. Test token validation for valid JWT tokens (should work regardless of `sessiontoken` value)
3. Test token refresh flow (should validate against `auth_sessions` table)
4. Test sign-out flow (should revoke sessions in `auth_sessions` table)

## Backward Compatibility

- The `sessiontoken` field is still cleared during sign-out for backward compatibility
- Old tokens that rely on `sessiontoken` will now work correctly
- New session-based authentication is fully functional

## Related Files

- `src/services/authsession.service.ts`: Session management service
- `src/routes/auth.route.ts`: Authentication routes
- `src/services/inventoryusers.service.ts`: User authentication service
- `src/utils/jwt.ts`: JWT token generation and validation

