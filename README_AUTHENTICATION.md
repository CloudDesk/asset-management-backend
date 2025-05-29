# 🔐 Complete Authentication System Documentation

## Overview

This Asset Management API now features a **production-ready authentication system** with comprehensive security features, token-based authentication, and complete API protection.

## 🚀 Quick Start

### 1. **Start the Server**
```bash
npm run build
npm start
```

### 2. **Access Documentation**
- **API Documentation**: http://localhost:5600/docs
- **Health Check**: http://localhost:5600/health
- **API Base URL**: http://localhost:5600/v1

### 3. **Test Authentication**
```bash
node test_complete_auth.js
```

## 🔑 Authentication Methods

### Method 1: Bearer Token (Recommended)
```bash
curl -X GET http://localhost:5600/v1/inventoryusers \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Method 2: Query Parameter
```bash
curl -X GET "http://localhost:5600/v1/inventoryusers?token=YOUR_TOKEN_HERE"
```

## 📋 Authentication Flow

### 1. **User Registration**
```bash
POST /v1/auth/register
{
  "useremail": "user@example.com",
  "userpassword": "SecurePassword123!",
  "firstname": "John",
  "lastname": "Doe",
  "role": "admin",
  "location": "Warehouse A"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "useremail": "user@example.com", ... },
    "token": "your-session-token-here"
  },
  "message": "Registration successful"
}
```

### 2. **User Sign In**
```bash
POST /v1/auth/signin
{
  "useremail": "user@example.com",
  "userpassword": "SecurePassword123!"
}
```

### 3. **Use Token for Protected Endpoints**
All endpoints except `/health` and `/auth/*` require authentication.

## 🛡️ Security Features

### ✅ **Implemented Security Measures**

1. **Password Security**
   - bcrypt hashing with salt rounds
   - Minimum 8 character requirement
   - Secure password validation

2. **Session Management**
   - Secure token generation (64-character hex)
   - Database-stored session tokens
   - Token invalidation on sign out
   - Session expiration handling

3. **Rate Limiting**
   - Brute force attack prevention
   - IP-based rate limiting
   - Configurable attempt limits
   - Automatic lockout periods

4. **Authentication Middleware**
   - Global route protection
   - Comprehensive error handling
   - Detailed authentication logs
   - Multiple authentication methods

5. **API Security**
   - All endpoints protected by default
   - Public endpoints explicitly defined
   - Comprehensive error responses
   - Security headers implementation

## 🔧 API Endpoints

### **Public Endpoints** (No Authentication Required)
- `GET /health` - Health check
- `POST /v1/auth/register` - User registration
- `POST /v1/auth/signin` - User sign in
- `POST /v1/auth/forgot-password` - Password reset initiation
- `POST /v1/auth/reset-password` - Password reset completion

### **Protected Endpoints** (Authentication Required)
- `GET /v1/auth/me` - Get current user info
- `POST /v1/auth/signout` - Sign out user
- `POST /v1/auth/update-password` - Update password
- `GET /v1/inventoryusers` - List inventory users
- `GET /v1/products` - List products
- `GET /v1/stocks` - List stocks
- `GET /v1/notes` - List notes
- `GET /v1/users` - List users
- All other CRUD operations

## 📚 Swagger Documentation

### **Interactive API Documentation**
Visit http://localhost:5600/docs for:

- **Step-by-step authentication guide**
- **Interactive API testing**
- **Request/response examples**
- **Authentication method explanations**
- **Error code documentation**

### **Key Documentation Features**
- 🔒 Authentication requirements clearly marked
- 📝 Comprehensive examples for all endpoints
- 🚀 Quick start guide with copy-paste examples
- 🔧 Multiple programming language examples
- ⚡ Real-time API testing interface

## 🧪 Testing

### **Comprehensive Test Suite**
```bash
node test_complete_auth.js
```

**Tests Include:**
- ✅ Health check (public endpoint)
- ✅ Protected endpoint access control
- ✅ User registration with immediate authentication
- ✅ Bearer token authentication
- ✅ Query parameter authentication
- ✅ Multiple protected endpoints
- ✅ User information retrieval
- ✅ Password update functionality
- ✅ Secure sign out with token invalidation
- ✅ Sign in with updated credentials
- ✅ Token invalidation verification

### **Manual Testing Examples**

#### Register a New User
```bash
curl -X POST http://localhost:5600/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "useremail": "test@example.com",
    "userpassword": "TestPassword123!",
    "firstname": "Test",
    "lastname": "User"
  }'
```

#### Sign In
```bash
curl -X POST http://localhost:5600/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "useremail": "test@example.com",
    "userpassword": "TestPassword123!"
  }'
```

#### Access Protected Endpoint
```bash
curl -X GET http://localhost:5600/v1/inventoryusers \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🔒 Error Handling

### **Authentication Errors**

#### 401 Unauthorized - No Token
```json
{
  "success": false,
  "message": "Authentication required",
  "details": "Please provide a valid Bearer token in the Authorization header or as a query parameter",
  "statusCode": 401,
  "authenticationRequired": true,
  "authenticationMethods": [
    "Bearer token in Authorization header",
    "Token query parameter (?token=YOUR_TOKEN)"
  ]
}
```

#### 401 Unauthorized - Invalid Token
```json
{
  "success": false,
  "message": "Invalid authentication token",
  "details": "The provided token is not valid, has expired, or the user has been signed out",
  "statusCode": 401,
  "tokenStatus": "invalid_or_expired",
  "suggestion": "Please sign in again to get a new token"
}
```

#### 429 Rate Limited
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

## 🏗️ Implementation Details

### **Database Schema Updates**
Added authentication fields to `inventoryusers` table:
- `sessiontoken` - Stores active session tokens
- `resettoken` - Stores password reset tokens
- `resettokenexpires` - Reset token expiration timestamp

### **Middleware Architecture**
- **Global Authentication Middleware**: Applied to all protected routes
- **Rate Limiting Middleware**: Prevents brute force attacks
- **Error Handling Middleware**: Comprehensive error responses
- **Logging Middleware**: Detailed authentication logs

### **Security Configuration**
- **Password Hashing**: bcrypt with 12 salt rounds
- **Token Generation**: Cryptographically secure random tokens
- **Session Management**: Database-stored tokens with invalidation
- **Rate Limiting**: 5 attempts per 15 minutes per IP/email

## 🚀 Production Considerations

### **Environment Variables**
Ensure these are properly configured:
- `DATABASE_URL` - Database connection string
- `NODE_ENV` - Set to 'production' for production
- `PORT` - Server port (default: 5600)

### **Security Recommendations**
1. **Use HTTPS in production**
2. **Configure proper CORS settings**
3. **Set up proper logging and monitoring**
4. **Implement token expiration policies**
5. **Regular security audits**
6. **Database connection security**

### **Performance Optimization**
- Database indexing on authentication fields
- Connection pooling configuration
- Rate limiting optimization
- Caching strategies for user sessions

## 📞 Support

For questions or issues:
1. Check the Swagger documentation at `/docs`
2. Run the test suite: `node test_complete_auth.js`
3. Review server logs for detailed error information
4. Ensure database connectivity and proper environment configuration

---

**🎉 Your Asset Management API is now production-ready with enterprise-grade authentication!** 