# JWT Authentication Implementation Guide

## ✅ Implementation Complete

Your authentication system now uses **JWT (JSON Web Tokens)** instead of random session tokens, following industry best practices.

---

## 🔐 How It Works

### **Token Types:**

1. **Access Token** (JWT)
   - Short-lived: 24 hours (configurable)
   - Used for API requests
   - Contains: `userId`, `email`, `roleId`
   - Stateless (no database lookup needed)
   - Sent in: `Authorization: Bearer <accessToken>`

2. **Refresh Token** (JWT)
   - Long-lived: 7 days (configurable)
   - Used to get new access tokens
   - Stored in database for revocation
   - Sent to: `POST /v1/auth/refresh`

---

## 📋 API Endpoints

### **1. Sign In** - `POST /v1/auth/signin`

**Request:**
```json
{
  "useremail": "user@example.com",
  "userpassword": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "roles": { ... },
    "permissions": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // JWT Access Token
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // JWT Refresh Token
    "expiresIn": 86400  // 24 hours in seconds
  }
}
```

---

### **2. Refresh Token** - `POST /v1/auth/refresh`

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // New Access Token
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // New Refresh Token (if sliding expiry)
    "expiresIn": 86400
  }
}
```

**When to use:**
- Access token expired (401 error)
- Before access token expires (proactive refresh)
- On app resume/foreground

---

### **3. Protected API Calls**

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Example:**
```bash
GET /v1/products
Headers: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response if token expired:**
```json
{
  "success": false,
  "message": "Token has expired",
  "statusCode": 401
}
```

---

## 🔄 Frontend Flow

### **Step 1: Sign In**
```typescript
const response = await fetch('/v1/auth/signin', {
  method: 'POST',
  body: JSON.stringify({ useremail, userpassword })
});

const { token, refreshToken, expiresIn, user, roles, permissions } = response.data;

// Store tokens
localStorage.setItem('accessToken', token);
localStorage.setItem('refreshToken', refreshToken);
localStorage.setItem('tokenExpiry', Date.now() + (expiresIn * 1000));
```

### **Step 2: Make API Calls**
```typescript
const token = localStorage.getItem('accessToken');

const response = await fetch('/v1/products', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

if (response.status === 401) {
  // Token expired - refresh it
  await refreshAccessToken();
}
```

### **Step 3: Refresh Token (When Expired)**
```typescript
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken })
  });
  
  if (response.success) {
    const { token, refreshToken: newRefreshToken, expiresIn } = response.data;
    
    // Update stored tokens
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', newRefreshToken);
    localStorage.setItem('tokenExpiry', Date.now() + (expiresIn * 1000));
    
    return token;
  } else {
    // Refresh token expired - redirect to login
    window.location.href = '/login';
  }
}
```

### **Step 4: Proactive Token Refresh**
```typescript
// Refresh token before it expires (e.g., 5 minutes before)
setInterval(() => {
  const expiry = parseInt(localStorage.getItem('tokenExpiry') || '0');
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  if (expiry - now < fiveMinutes) {
    refreshAccessToken();
  }
}, 60000); // Check every minute
```

---

## ⚙️ Configuration

### **Environment Variables:**

```env
# JWT Secret (REQUIRED - change in production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
# OR use existing:
APP_JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Access Token Expiry (default: 24h)
JWT_ACCESS_TOKEN_EXPIRY=24h  # Options: 1h, 30m, 24h, 7d

# Refresh Token Expiry (default: 7d)
JWT_REFRESH_TOKEN_EXPIRY=7d  # Options: 7d, 30d, 90d

# Sliding Expiry (default: true)
# If true, refresh token expiry extends on each use
JWT_REFRESH_ON_USE=true
```

### **Expiry Format:**
- `s` = seconds (e.g., `60s`)
- `m` = minutes (e.g., `30m`)
- `h` = hours (e.g., `24h`)
- `d` = days (e.g., `7d`)

---

## 🔒 Security Features

### **1. Token Expiry**
- Access tokens expire automatically
- Refresh tokens expire after configured time
- Expired tokens return 401 Unauthorized

### **2. Token Revocation**
- Refresh token stored in database (`inventoryusers.sessiontoken`)
- Setting `sessiontoken = null` revokes all tokens
- On logout, clear `sessiontoken` to invalidate refresh token

### **3. Sliding Expiry** (Optional)
- If `JWT_REFRESH_ON_USE=true`:
  - Each refresh generates new refresh token
  - Extends user session automatically
  - User stays logged in as long as they use the app

### **4. Stateless Authentication**
- Access token verification doesn't require database lookup
- Faster API responses
- Scalable (works across multiple servers)

---

## 🛡️ Middleware Protection

All protected routes automatically:
1. Extract token from `Authorization: Bearer <token>` header
2. Verify JWT signature and expiry
3. Extract `userId` from token payload
4. Fetch user from database
5. Attach user to `request.user`
6. Return 401 if token invalid/expired

**Example:**
```typescript
// Route automatically protected
fastify.get('/products', {
  preHandler: authenticateInventoryUser
}, async (request, reply) => {
  const userId = request.user?.id; // Available from JWT
  // ... your logic
});
```

---

## 📊 Token Structure

### **Access Token Payload:**
```json
{
  "userId": 2,
  "email": "harish@mail.com",
  "roleId": 3,
  "iat": 1763982890,  // Issued at
  "exp": 1764069290,  // Expires at
  "iss": "asset-management-backend",
  "aud": "asset-management-frontend"
}
```

### **JWT Format:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiaGFyaXNoQG1haWwuY29tIiwicm9sZUlkIjozLCJpYXQiOjE3NjM5ODI4OTAsImV4cCI6MTc2NDA2OTI5MCwiaXNzIjoiYXNzZXQtbWFuYWdlbWVudC1iYWNrZW5kIiwiYXVkIjoiYXNzZXQtbWFuYWdlbWVudC1mcm9udGVuZCJ9.signature
```

**Parts:**
1. **Header**: Algorithm and token type
2. **Payload**: User data + expiry
3. **Signature**: Cryptographic signature (prevents tampering)

---

## 🔄 Migration from Old System

### **Old System (Random Tokens):**
- ❌ Random hex string stored in database
- ❌ Database lookup on every request
- ❌ No expiry (manual cleanup needed)
- ❌ Not stateless

### **New System (JWT):**
- ✅ JWT tokens with expiry
- ✅ Stateless (no DB lookup for access token)
- ✅ Automatic expiry
- ✅ Token refresh mechanism
- ✅ Industry standard

---

## 🚀 Best Practices

### **1. Token Storage (Frontend)**
- ✅ Store in `localStorage` or `sessionStorage`
- ✅ Or use httpOnly cookies (more secure)
- ❌ Don't store in global variables (lost on refresh)

### **2. Token Refresh**
- ✅ Refresh before expiry (proactive)
- ✅ Refresh on 401 errors (reactive)
- ✅ Handle refresh failures (redirect to login)

### **3. Security**
- ✅ Use HTTPS in production
- ✅ Change `JWT_SECRET` in production
- ✅ Set appropriate expiry times
- ✅ Revoke tokens on logout

### **4. Error Handling**
```typescript
// Handle token expiry
if (error.status === 401 && error.message.includes('expired')) {
  const newToken = await refreshAccessToken();
  // Retry original request with new token
}
```

---

## 📝 Summary

### **What Changed:**
1. ✅ Signin now returns JWT tokens (access + refresh)
2. ✅ Middleware verifies JWT tokens (not database lookup)
3. ✅ Token expiry automatically enforced
4. ✅ Token refresh endpoint added
5. ✅ Sliding expiry support (optional)

### **Benefits:**
- ✅ **Stateless**: No database lookup for access tokens
- ✅ **Scalable**: Works across multiple servers
- ✅ **Secure**: Automatic expiry + revocation support
- ✅ **Standard**: Industry-standard JWT implementation
- ✅ **Flexible**: Configurable expiry times

### **Next Steps:**
1. Update frontend to use JWT tokens
2. Implement token refresh logic
3. Handle token expiry gracefully
4. Set `JWT_SECRET` in production environment

---

## 🎯 Answer to Your Question

**Q: Which header should be used for `/v1/permissions/user`?**

**A:** Use the `token` (access token) from signin response:

```bash
GET /v1/permissions/user
Headers: {
  "Authorization": "Bearer <token>"
}
```

Where `<token>` is the `token` value from the signin response (the JWT access token).

**Note:** 
- `user.sessiontoken` = refresh token (stored in DB, used for refresh endpoint)
- `token` = access token (used for API requests)

---

**Your authentication system is now production-ready with JWT!** 🎉

