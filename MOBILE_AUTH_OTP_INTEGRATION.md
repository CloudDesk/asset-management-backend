# 🔐 Mobile Auth - Redis + Twilio OTP Integration

## ✅ Integration Complete!

Your existing mobile authentication routes have been successfully upgraded with the new Redis + Twilio OTP system.

---

## 📱 What Was Integrated

### **Routes Updated:**
1. **`POST /v1/mobile-auth/request-otp`** - Generate and send OTP
2. **`POST /v1/mobile-auth/verify-otp`** - Verify OTP and authenticate

### **Previous System (Replaced):**
- ❌ Hardcoded 4-digit OTP (1234)
- ❌ In-memory OTP storage
- ❌ No actual SMS sending
- ❌ Manual expiration handling

### **New System (Implemented):**
- ✅ Cryptographically secure 6-digit OTP
- ✅ Redis storage with 60-second auto-expiration
- ✅ Real SMS via Twilio
- ✅ Rate limiting (3 requests per 15 minutes)
- ✅ Resend cooldown (30 seconds)
- ✅ Attempt tracking (3 max per OTP)
- ✅ Phone number blocking (after 5 failed verifications)

---

## 🔄 Flow Diagram

### **IMPORTANT: User Creation Happens AFTER OTP Verification** 🔒

This prevents unverified/abandoned phone numbers in your database.

```
┌──────────────────────────────────────────────────────────┐
│  POST /v1/mobile-auth/request-otp                        │
│  { usermobilenumber: 9994824573, verifyOnly: false }     │
└────────────────────┬─────────────────────────────────────┘
                     │
    ┌────────────────▼────────────────┐
    │  1. Check if user exists        │
    │     - Store result (existing?)  │
    └────────────────┬────────────────┘
                     │
    ┌────────────────▼────────────────┐
    │  2. If verifyOnly = true:       │
    │     - User not found → 404 ❌   │
    │     - User found → Continue ✅  │
    │  If verifyOnly = false:         │
    │     - DON'T create user yet! ⚠️ │
    │     - Just note: isNewUser flag │
    └────────────────┬────────────────┘
                     │
    ┌────────────────▼────────────────┐
    │  3. Generate OTP (Redis)        │
    │     - Crypto-secure 6 digits    │
    │     - Store in Redis (60s TTL)  │
    │     - Rate limit check          │
    └────────────────┬────────────────┘
                     │
    ┌────────────────▼────────────────┐
    │  4. Send SMS via Twilio 📱      │
    │     - "Your code is: 123456"    │
    │     - Valid for 60 seconds      │
    └────────────────┬────────────────┘
                     │
    ┌────────────────▼────────────────┐
    │  5. Return Success              │
    │     - isNewUser: true/false     │
    │     - expiresIn: 60             │
    │     - NO USER CREATED YET! ⚠️   │
    └─────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  POST /v1/mobile-auth/verify-otp                         │
│  { usermobilenumber: 9994824573, otp: 123456 }           │
└────────────────────┬─────────────────────────────────────┘
                     │
    ┌────────────────▼────────────────┐
    │  1. Validate OTP format         │
    │     - Must be 6 digits          │
    └────────────────┬────────────────┘
                     │
    ┌────────────────▼────────────────┐
    │  2. Verify OTP (Redis) FIRST    │
    │     - Check attempts (max 3)    │
    │     - Constant-time comparison  │
    │     - Check expiration          │
    │     - Invalid → STOP ❌         │
    └────────────────┬────────────────┘
                     │ ✅ OTP Valid
    ┌────────────────▼────────────────┐
    │  3. Check if user exists in DB  │
    └────────────────┬────────────────┘
                     │
              ┌──────┴──────┐
              │             │
         Exists?         Not Exists?
              │             │
    ┌─────────▼──────┐   ┌──▼────────────────────┐
    │  Use existing  │   │  CREATE USER NOW! 🎉  │
    │  user from DB  │   │  - Only after OTP ✅  │
    └─────────┬──────┘   │  - Phone verified ✅  │
              │          │  - isNewUser: true    │
              │          └──┬────────────────────┘
              │             │
              └─────┬───────┘
                    │
    ┌───────────────▼────────────────┐
    │  4. Delete OTP from Redis      │
    │     - Clear rate limits        │
    └───────────────┬────────────────┘
                    │
    ┌───────────────▼────────────────┐
    │  5. Generate session token     │
    │     - JWT token for app        │
    └───────────────┬────────────────┘
                    │
    ┌───────────────▼────────────────┐
    │  6. Return user + token        │
    │     - Sanitized user data      │
    │     - Session token            │
    │     - isNewUser flag           │
    └────────────────────────────────┘
```

---

## 🎯 How User Creation Works (IMPROVED SECURITY)

### **🔒 Security Improvement: Verify BEFORE Create**

**Old Approach (Insecure):**
```
User enters number → Create user immediately → Send OTP
Problem: If user abandons, unverified account remains in DB
```

**New Approach (Secure):**
```
User enters number → Send OTP (NO user created) → Verify OTP → Create user
Benefit: Only verified phone numbers get accounts
```

### **Step-by-Step Process:**

#### **Step 1: Request OTP (`/request-otp`)**
```javascript
// What happens:
1. Check if user exists in database
2. If verifyOnly = true AND user not found → Return 404
3. If verifyOnly = false:
   - Note: isNewUser = !userExists
   - Generate OTP in Redis
   - Send SMS
   - Return success (NO user created yet!)
```

**Database State After Request OTP:**
```
User not in DB yet! Only OTP stored in Redis for 60 seconds.
```

#### **Step 2: User Abandons (Doesn't Enter OTP)**
```javascript
// What happens:
- OTP expires in Redis after 60 seconds
- No user created
- Database stays clean ✅
```

#### **Step 3: Verify OTP (`/verify-otp`)**
```javascript
// What happens:
1. Verify OTP from Redis
2. If OTP invalid → Return error, user still not created
3. If OTP valid:
   a. Check if user exists in DB
   b. If NOT exists → CREATE USER NOW (lines 586-614 in mobile-auth.route.ts)
   c. If exists → Use existing user
   d. Generate session token
   e. Return user + token + isNewUser flag
```

**Database State After Verify OTP:**
```
User NOW created in database with verified phone number! ✅
```

### **Code Reference:**

In `src/routes/mobile-auth.route.ts` line 586-614:
```typescript
// Step 2: OTP is valid! Now check if user exists or create new one
let user = await usersService.findByMobileNumber(usermobilenumber);
let isNewUser = false;

if (!user) {
  // Create new user AFTER successful OTP verification
  logger.info({ mobileNumber: usermobilenumber }, 'Creating new verified user after OTP verification');
  
  const newUserData = {
    usermobilenumber: usermobilenumber,
    firstname: `User`,
    createddate: Date.now(),
    modifieddate: Date.now()
  };

  user = await usersService.create(newUserData);
  isNewUser = true;
}
```

### **Benefits:**

✅ **Clean Database** - No unverified users  
✅ **Verified Phone Numbers** - Only real users  
✅ **Security** - Proof of ownership before account creation  
✅ **No Spam** - Can't create accounts with random numbers  
✅ **Better UX** - isNewUser flag tells client if account is new  

---

## 🎯 Key Features

### **1. User Creation Logic** ✅
- User created **ONLY AFTER** successful OTP verification
- Return `isNewUser: true` when account is created
- Prevents database pollution with unverified numbers

### **2. VerifyOnly Mode** ✅
- Used for delete account flow
- If `verifyOnly: true` and user not found → Return 404
- Never creates new user in this mode

### **3. Rate Limiting** ✅
- Uses existing `authRateLimit` system
- Plus new Redis-based rate limiting:
  - 3 OTP requests per 15 minutes
  - 30-second cooldown between requests
  - 5 failed verification attempts → 1-hour block

### **4. Response Format** ✅
- Same structure as before
- Returns user data + session token + isNewUser flag
- Includes all existing fields

---

## 📝 API Usage

### **1. Request OTP (New User Registration)**

```bash
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9999999999
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "mobileNumber": 9999999999,
    "otpSent": true,
    "expiresIn": 60,
    "canResendAfter": 30,
    "isNewUser": true  // ← Indicates this will be a new account
  }
}
```

**⚠️ IMPORTANT: User NOT created yet in database!**

**User receives SMS:**
```
Your verification code is: 123456. Valid for 60 seconds. Do not share this code.
```

**Verify OTP to Create Account:**
```bash
curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9999999999,
    "otp": 123456
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Account created and authenticated successfully",
  "data": {
    "user": {
      "id": 456,  // ← NEW USER ID (just created!)
      "usermobilenumber": 9999999999,
      "firstname": "User",
      "createddate": 1760508832037
    },
    "token": "eyJhbGci...",
    "isNewUser": true  // ← Confirms account was just created
  }
}
```

**✅ NOW user is created in database!**

---

### **2. Request OTP (Existing User Login)**

```bash
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9994824573
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "mobileNumber": 9994824573,
    "otpSent": true,
    "expiresIn": 60,
    "canResendAfter": 30,
    "isNewUser": false  // ← User already exists in DB
  }
}
```

**User receives SMS:**
```
Your verification code is: 456789. Valid for 60 seconds. Do not share this code.
```

**Verify OTP:**
```bash
curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9994824573,
    "otp": 456789
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": 123,  // ← Existing user ID
      "usermobilenumber": 9994824573,
      "firstname": "John",
      "lastname": "Doe"
    },
    "token": "eyJhbGci...",
    "isNewUser": false  // ← User already existed
  }
}
```

---

### **2. Request OTP (Verify Only Mode - for Delete Account)**

```bash
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9994824573,
    "verifyOnly": true
  }'
```

**If user doesn't exist:**
```json
{
  "success": false,
  "message": "User not found",
  "details": "No account exists with this mobile number.",
  "statusCode": 404,
  "remainingAttempts": 4
}
```

---

## 💡 Real-World Examples

### **Example 1: User Abandons Registration**

```bash
# 1. New user requests OTP
POST /v1/mobile-auth/request-otp
{ "usermobilenumber": 9111111111 }

Response: { "success": true, "isNewUser": true }

# 2. User closes app / abandons

# What happens:
# - OTP expires in Redis after 60 seconds ✅
# - NO user created in database ✅
# - Database stays clean ✅

# 3. User tries again later
POST /v1/mobile-auth/request-otp
{ "usermobilenumber": 9111111111 }

# - Still shows isNewUser: true (user still doesn't exist)
# - New OTP sent
# - User can complete registration
```

### **Example 2: Successful New User Registration**

```bash
# 1. Request OTP
POST /v1/mobile-auth/request-otp
{ "usermobilenumber": 9222222222 }

Response: { "isNewUser": true }  # User not in DB yet!

# 2. Verify OTP (within 60 seconds)
POST /v1/mobile-auth/verify-otp
{ "usermobilenumber": 9222222222, "otp": 123456 }

Response: {
  "message": "Account created and authenticated successfully",
  "data": {
    "user": { "id": 789 },  # ← USER CREATED HERE!
    "isNewUser": true
  }
}

# Database now has user with ID 789 ✅
```

### **Example 3: Existing User Login**

```bash
# 1. Request OTP
POST /v1/mobile-auth/request-otp
{ "usermobilenumber": 9994824573 }

Response: { "isNewUser": false }  # User exists in DB

# 2. Verify OTP
POST /v1/mobile-auth/verify-otp
{ "usermobilenumber": 9994824573, "otp": 654321 }

Response: {
  "message": "Authentication successful",
  "data": {
    "user": { "id": 123 },  # ← Existing user
    "isNewUser": false
  }
}

# No new user created, just authenticated ✅
```

---

## 📊 Error Responses

### **Wrong OTP:**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Invalid OTP. Please try again.",
  "statusCode": 401,
  "remainingAttempts": 4,
  "attemptsRemaining": 2,
  "canResend": false
}
```

### **OTP Expired (after 60 seconds):**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "OTP not found or has expired. Please request a new OTP.",
  "statusCode": 401,
  "canResend": true
}
```

### **Too Many Attempts:**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Maximum verification attempts exceeded. Please request a new OTP.",
  "statusCode": 401,
  "attemptsRemaining": 0,
  "canResend": true
}
```

---

## 🔒 Security Features

### **1. OTP Generation**
- **6-digit code** (upgraded from 4-digit)
- **Cryptographically secure** (`crypto.randomInt`)
- **No predictable patterns**

### **2. Rate Limiting**
| Action | Limit | Window | Result |
|--------|-------|--------|--------|
| Send OTP | 3 requests | 15 min | 429 error |
| Resend cooldown | 1 request | 30 sec | Must wait |
| Verify attempts | 3 attempts | Per OTP | OTP invalidated |
| Failed verifications | 5 failures | 1 hour | Phone blocked |

### **3. Data Storage**
- **Redis TTL:** 60 seconds (auto-delete)
- **Constant-time comparison:** Prevents timing attacks
- **Masked logging:** Phone numbers masked in logs
- **No OTP in response:** OTP only sent via SMS (except dev mode)

---

## 🎨 Changes Summary

### **What Changed:**
1. **OTP Length:** 4 digits → 6 digits
2. **OTP Generation:** Hardcoded → Cryptographically secure
3. **Storage:** In-memory → Redis (with TTL)
4. **SMS:** None → Twilio SMS
5. **Rate Limiting:** Basic → Advanced (Redis-based)
6. **Expiration:** Manual → Automatic (Redis TTL)

### **What Stayed the Same:**
1. ✅ User creation logic
2. ✅ `verifyOnly` flag behavior
3. ✅ Response format
4. ✅ Error handling
5. ✅ Session token generation
6. ✅ User data sanitization

---

## 🧪 Complete Testing Scenarios

### **✅ Both Routes Work For:**
1. **Login Flow** - Normal user authentication
2. **Delete Account Flow** - Verify before account deletion

---

### **Test Scenario 1: New User Registration (Login Flow)**

**Initial State:** User with mobile `9111111111` does NOT exist in database

```bash
# Step 1: Request OTP
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9111111111
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "mobileNumber": 9111111111,
    "otpSent": true,
    "expiresIn": 60,
    "canResendAfter": 30,
    "isNewUser": true
  }
}
```

**Check Database:**
```sql
SELECT * FROM users WHERE usermobilenumber = 9111111111;
-- Result: EMPTY (no user yet) ⚠️
```

**Check Redis:**
```bash
redis-cli GET otp:+919111111111
# Result: {"otp":"456789","attempts":0,...}
```

**User receives SMS:** `Your verification code is: 456789. Valid for 60 seconds.`

```bash
# Step 2: Verify OTP (with correct OTP)
curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9111111111,
    "otp": 456789
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Account created and authenticated successfully",
  "data": {
    "user": {
      "id": 789,
      "usermobilenumber": 9111111111,
      "firstname": "User",
      "useremail": null
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXNzaW9uSWQiOiI...",
    "isNewUser": true
  }
}
```

**Check Database Now:**
```sql
SELECT * FROM users WHERE usermobilenumber = 9111111111;
-- Result: User created! ✅
-- id: 789
-- firstname: "User"
-- createddate: 1760508832037
```

**✅ Result:** New user created and authenticated!

---

### **Test Scenario 2: Existing User Login (Login Flow)**

**Initial State:** User with mobile `9994824573` EXISTS in database (id: 123)

```bash
# Step 1: Request OTP
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9994824573
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "mobileNumber": 9994824573,
    "otpSent": true,
    "expiresIn": 60,
    "canResendAfter": 30,
    "isNewUser": false
  }
}
```

**User receives SMS:** `Your verification code is: 123456. Valid for 60 seconds.`

```bash
# Step 2: Verify OTP
curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9994824573,
    "otp": 123456
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": 123,
      "usermobilenumber": 9994824573,
      "firstname": "John",
      "lastname": "Doe",
      "useremail": "john@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isNewUser": false
  }
}
```

**✅ Result:** Existing user authenticated, no new user created!

---

### **Test Scenario 3: User Abandons Registration**

```bash
# Step 1: New user requests OTP
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9222222222}'

# Response: { "isNewUser": true }

# Step 2: User abandons (doesn't enter OTP)
# ... wait 61 seconds ...
```

**Check Database After 61 Seconds:**
```sql
SELECT * FROM users WHERE usermobilenumber = 9222222222;
-- Result: EMPTY ✅ (No user created!)
```

**Check Redis:**
```bash
redis-cli GET otp:+919222222222
# Result: (nil) - Expired and deleted
```

**Step 3: User Tries Again Later**
```bash
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9222222222}'

# Response: { "isNewUser": true } - Still shows as new user!
```

**✅ Result:** Database stays clean, user can try again!

---

### **Test Scenario 4: Delete Account Flow (verifyOnly = true)**

**Initial State:** User with mobile `9344715431` EXISTS in database (id: 456)

```bash
# Step 1: Request OTP with verifyOnly flag
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9344715431,
    "verifyOnly": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully for verification",
  "data": {
    "mobileNumber": 9344715431,
    "otpSent": true,
    "expiresIn": 60,
    "canResendAfter": 30,
    "isNewUser": false
  }
}
```

**User receives SMS:** `Your verification code is: 789012. Valid for 60 seconds.`

```bash
# Step 2: Verify OTP
curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9344715431,
    "otp": 789012
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": 456,
      "usermobilenumber": 9344715431,
      "firstname": "Jane",
      "useremail": "jane@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isNewUser": false
  }
}
```

```bash
# Step 3: Now delete account (using the token)
curl -X POST http://localhost:5600/v1/mobile-auth/delete-account \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGci...' \
  -d '{
    "userid": 456,
    "useremail": "jane@example.com"
  }'
```

**✅ Result:** User verified with OTP, then account deleted!

---

### **Test Scenario 5: Delete Account - User Not Found (verifyOnly)**

**Initial State:** User with mobile `8888888888` does NOT exist

```bash
# Step 1: Try to request OTP with verifyOnly
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 8888888888,
    "verifyOnly": true
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "User not found",
  "details": "No account exists with this mobile number.",
  "statusCode": 404,
  "remainingAttempts": 4
}
```

**✅ Result:** No OTP sent, no user created (verifyOnly protects against creation)

---

### **Test Scenario 6: Wrong OTP (3 Attempts)**

```bash
# Step 1: Request OTP
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9333333333}'

# Real OTP sent: 654321

# Step 2: Attempt 1 - Wrong OTP
curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9333333333, "otp": 111111}'
```

**Response:**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Invalid OTP. Please try again.",
  "statusCode": 401,
  "attemptsRemaining": 2,
  "canResend": false
}
```

```bash
# Step 3: Attempt 2 - Wrong OTP again
curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9333333333, "otp": 222222}'
```

**Response:**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Invalid OTP. Please try again.",
  "statusCode": 401,
  "attemptsRemaining": 1,
  "canResend": false
}
```

```bash
# Step 4: Attempt 3 - Wrong OTP (last attempt)
curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9333333333, "otp": 333333}'
```

**Response:**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Invalid OTP. Please try again.",
  "statusCode": 401,
  "attemptsRemaining": 0,
  "canResend": true
}
```

**Check Redis:**
```bash
redis-cli GET otp:+919333333333
# Result: (nil) - OTP invalidated after 3 failed attempts
```

**✅ Result:** OTP invalidated, user must request new OTP

---

### **Test Scenario 7: OTP Expired**

```bash
# Step 1: Request OTP
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9444444444}'

# Real OTP sent: 567890

# Step 2: Wait 61 seconds
sleep 61

# Step 3: Try to verify expired OTP
curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9444444444, "otp": 567890}'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "OTP not found or has expired. Please request a new OTP.",
  "statusCode": 401,
  "canResend": true
}
```

**Check Database:**
```sql
SELECT * FROM users WHERE usermobilenumber = 9444444444;
-- Result: EMPTY (no user created because OTP expired) ✅
```

**✅ Result:** OTP expired, no user created, request new OTP

---

### **Test Scenario 8: Rate Limiting - Too Many OTP Requests**

```bash
# Request 1
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9555555555}'
# Response: ✅ Success

# Wait 31 seconds
sleep 31

# Request 2
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9555555555}'
# Response: ✅ Success

# Wait 31 seconds
sleep 31

# Request 3
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9555555555}'
# Response: ✅ Success (Last allowed)

# Wait 31 seconds
sleep 31

# Request 4 (Should fail - rate limited)
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9555555555}'
```

**Expected Response (429):**
```json
{
  "success": false,
  "message": "Failed to generate OTP",
  "details": "Too many OTP requests. Please try again later.",
  "statusCode": 429
}
```

**Check Redis:**
```bash
redis-cli GET rate:send:+919555555555
# Result: "3" (reached limit)

redis-cli TTL rate:send:+919555555555
# Result: 720 (12 minutes remaining until reset)
```

**✅ Result:** Rate limited - wait 12 minutes before next request

---

### **Test Scenario 9: Resend Cooldown (Too Fast)**

```bash
# Step 1: Request OTP
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9666666666}'
# Response: ✅ Success

# Step 2: Immediately try to request again (within 30 seconds)
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9666666666}'
```

**Expected Response (429):**
```json
{
  "success": false,
  "message": "Failed to generate OTP",
  "details": "Please wait 28 seconds before requesting a new OTP",
  "statusCode": 429
}
```

**✅ Result:** Must wait 30 seconds between requests

---

### **Test Scenario 10: Multiple Failed Verifications (Account Block)**

```bash
# Round 1: Request OTP, fail 3 times
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -d '{"usermobilenumber": 9777777777}'

curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -d '{"usermobilenumber": 9777777777, "otp": 111111}'
# Attempt 1 failed

curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -d '{"usermobilenumber": 9777777777, "otp": 222222}'
# Attempt 2 failed

curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -d '{"usermobilenumber": 9777777777, "otp": 333333}'
# Attempt 3 failed - OTP invalidated

# Round 2: Request new OTP, fail 2 more times (total 5)
sleep 31
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -d '{"usermobilenumber": 9777777777}'

curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -d '{"usermobilenumber": 9777777777, "otp": 444444}'
# 4th failure

curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -d '{"usermobilenumber": 9777777777, "otp": 555555}'
# 5th failure - BLOCKED!
```

**Expected Response (429):**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Too many failed verification attempts. Account temporarily blocked.",
  "statusCode": 429,
  "canResend": false
}
```

**Try to request OTP again:**
```bash
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -d '{"usermobilenumber": 9777777777}'
```

**Response:**
```json
{
  "success": false,
  "message": "Failed to generate OTP",
  "details": "Too many failed OTP verification attempts",
  "statusCode": 429
}
```

**Check Redis:**
```bash
redis-cli GET blocked:+919777777777
# Result: "Too many failed OTP verification attempts"

redis-cli TTL blocked:+919777777777
# Result: 3540 (59 minutes remaining)
```

**✅ Result:** Phone blocked for 1 hour after 5 failed attempts

---

### **Test Scenario 11: Delete Account - Successful Flow**

**Initial State:** User exists (mobile: 9876543210, id: 999)

```bash
# Step 1: User wants to delete account - request OTP with verifyOnly
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9876543210,
    "verifyOnly": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully for verification",
  "data": {
    "mobileNumber": 9876543210,
    "otpSent": true,
    "expiresIn": 60,
    "canResendAfter": 30,
    "isNewUser": false
  }
}
```

**User receives SMS:** `Your verification code is: 321654. Valid for 60 seconds.`

```bash
# Step 2: Verify OTP
curl -X POST http://localhost:5600/v1/mobile-auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 9876543210,
    "otp": 321654
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": 999,
      "usermobilenumber": 9876543210
    },
    "token": "eyJhbGci...",
    "isNewUser": false
  }
}
```

```bash
# Step 3: Use token to delete account
curl -X POST http://localhost:5600/v1/mobile-auth/delete-account \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGci...' \
  -d '{
    "userid": 999,
    "useremail": "user@example.com"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Account deactivated successfully",
  "data": {
    "userId": 999,
    "email": "user@example.com",
    "isActive": false,
    "emailSent": true
  }
}
```

**✅ Result:** User verified ownership, account deleted!

---

### **Test Scenario 12: Delete Account - User Not Found**

```bash
# Try verifyOnly with non-existent user
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{
    "usermobilenumber": 8000000000,
    "verifyOnly": true
  }'
```

**Expected Response (404):**
```json
{
  "success": false,
  "message": "User not found",
  "details": "No account exists with this mobile number.",
  "statusCode": 404,
  "remainingAttempts": 4
}
```

**Check Database:**
```sql
SELECT * FROM users WHERE usermobilenumber = 8000000000;
-- Result: EMPTY
```

**Check Redis:**
```bash
redis-cli GET otp:+918000000000
# Result: (nil) - No OTP created
```

**✅ Result:** No OTP sent, no user created (secure!)

---

## 📋 Quick Test Reference

| Test Case | Mobile Number | Expected OTP | Expected Result |
|-----------|---------------|--------------|-----------------|
| New user registration | 9111111111 | (random 6-digit) | User created after verify |
| Existing user login | 9994824573 | (random 6-digit) | User authenticated |
| User abandons | 9222222222 | (expires) | No user created ✅ |
| Delete account (exists) | 9876543210 | (random 6-digit) | OTP sent, can delete |
| Delete account (not found) | 8000000000 | (none) | 404 error |
| Wrong OTP 3x | 9333333333 | 654321 | OTP invalidated |
| OTP expired | 9444444444 | (expired) | Must request new |
| Rate limited | 9555555555 | (blocked) | 429 error |
| Too fast resend | 9666666666 | (cooldown) | Wait 30 seconds |
| 5 failed attempts | 9777777777 | (blocked) | Phone blocked 1 hour |

---

## 🎯 Both Routes Support Both Flows

### **Route 1: `/request-otp`**
✅ **Login Flow:** `verifyOnly: false` (default)
✅ **Delete Flow:** `verifyOnly: true`

### **Route 2: `/verify-otp`**
✅ **Login Flow:** Creates user if doesn't exist
✅ **Delete Flow:** Authenticates existing user

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Update Twilio phone number in `twilioSms.service.ts`
- [ ] Verify Redis Cloud credentials in `.env`
- [ ] Update mobile app to accept 6-digit OTP
- [ ] Test with real phone numbers
- [ ] Remove OTP from response in production (line 415 in mobile-auth.route.ts)
- [ ] Configure rate limits for production traffic
- [ ] Set up monitoring/alerts
- [ ] Test verifyOnly mode for delete account flow
- [ ] Verify user creation works AFTER OTP verification
- [ ] Test abandoned registration (user not created)
- [ ] Check session token generation

---

## 📚 Related Documentation

- [OTP Implementation Plan](./OTP_VERIFICATION_IMPLEMENTATION_PLAN.md)
- [OTP Testing Guide](./OTP_TESTING_GUIDE.md)
- [OTP Quick Reference](./OTP_QUICK_REFERENCE.md)
- [Redis Cloud Setup](./REDIS_CLOUD_SETUP.md)

---

## 🎉 Summary

✅ **Integration Complete!**

### **✅ YES - Both Routes Work For Both Flows:**

| Flow | `/request-otp` | `/verify-otp` | Result |
|------|----------------|---------------|--------|
| **Login Flow** | verifyOnly: false (default) | Creates user if new | User authenticated + token |
| **Delete Flow** | verifyOnly: true | Authenticates existing user | Returns token for deletion |

### **Your Mobile Authentication Now Has:**
- ✅ Real SMS via Twilio (6-digit OTP)
- ✅ Redis storage with 60-second auto-expiration
- ✅ Comprehensive rate limiting (3 per 15 min)
- ✅ **User created ONLY after OTP verification** (prevents spam!)
- ✅ Clean database (no unverified numbers)
- ✅ `verifyOnly` mode for delete account flow
- ✅ All existing business logic preserved

### **Security Features:**
- ✅ Cryptographically secure OTP generation
- ✅ Constant-time OTP comparison (anti-timing attack)
- ✅ 3 attempts per OTP
- ✅ 30-second resend cooldown
- ✅ Phone blocking after 5 failed verifications
- ✅ Automatic OTP expiration
- ✅ Phone number ownership verification

**Ready to test!** 🚀

### **Quick Test:**
```bash
# Run automated test script
chmod +x test_mobile_auth_otp.sh
./test_mobile_auth_otp.sh

# Or test manually
curl -X POST http://localhost:5600/v1/mobile-auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"usermobilenumber": 9111111111}'
```

---

## 🎯 Quick Summary

### **When is User Created in Database?**

| Scenario | Request OTP | Verify OTP |
|----------|-------------|------------|
| New User (normal) | ❌ Not created | ✅ **Created here after OTP verified** |
| Existing User | Already exists | Already exists |
| New User (verifyOnly) | ❌ Not created | ❌ Not created (404 error) |

### **Key Points:**

1. **`/request-otp`**: 
   - ✅ Sends SMS with OTP
   - ❌ Does NOT create user
   - Returns `isNewUser: true/false` to indicate status

2. **User Abandons:**
   - OTP expires in 60 seconds
   - No user in database
   - Clean! No garbage data ✅

3. **`/verify-otp`**:
   - ✅ Verifies OTP first
   - ✅ If valid AND user doesn't exist → **CREATE USER NOW**
   - ✅ Returns user data + token + `isNewUser: true`

---

## 🔍 How to Check User Creation

### Check Database Before OTP:
```sql
SELECT * FROM users WHERE usermobilenumber = 9111111111;
-- Returns: Empty (no user)
```

### After `/request-otp`:
```sql
SELECT * FROM users WHERE usermobilenumber = 9111111111;
-- Returns: Empty (still no user!) ⚠️
```

### After `/verify-otp` with valid OTP:
```sql
SELECT * FROM users WHERE usermobilenumber = 9111111111;
-- Returns: User record! ✅
-- id: 789
-- firstname: "User"
-- createddate: 1760508832037
```

---

## ⚠️ Important for Frontend/Mobile App

### **Update Your UI:**

1. **OTP Input Field:** Change from 4 digits → **6 digits**
2. **Message:** Update "Enter 4-digit code" → **"Enter 6-digit code"**
3. **Timer:** Show 60-second countdown
4. **Resend Button:** Enable after 30 seconds

### **Handle `isNewUser` Flag:**

```javascript
// When you get response from /request-otp
if (response.data.isNewUser === true) {
  // Show: "Welcome! We'll create your account after verification"
} else {
  // Show: "Welcome back! Enter the code we just sent"
}

// When you get response from /verify-otp
if (response.data.isNewUser === true) {
  // Show welcome screen for new users
  // Maybe show profile completion form
} else {
  // Navigate to home screen (existing user)
}
```

new user 
{
  "success": true,
  "data": {
    "mobileNumber": 9994824573,
    "otpSent": true,
    "isNewUser": true
  },
  "message": "New account created and OTP sent successfully"
}

verify

{
  "success": true,
  "data": {
    "user": {
      "id": 41,
      "useremail": "",
      "usermobilenumber": 9994824573,
      "firstname": "User",
      "lastname": "",
      "gender": "",
      "gstnumber": "",
      "isbusinessuser": false,
      "createddate": 1760533672,
      "modifieddate": 1760533672,
      "fcmid": null,
      "isguest": false,
      "isactive": true
    },
    "token": "3a386d7396b7c10ecb72a0e4e1f9ef903375ec691e13dc73cb1eccd88aa0da8a",
    "isNewUser": true
  },
  "message": "Account created and authenticated successfully"
}

login 

{
  "success": true,
  "data": {
    "mobileNumber": 9994824573,
    "otpSent": true,
    "isNewUser": false
  },
  "message": "OTP sent successfully"
}

verify response 
{
  "success": true,
  "data": {
    "user": {
      "id": 41,
      "useremail": "",
      "usermobilenumber": 9994824573,
      "firstname": "User",
      "lastname": "",
      "gender": "",
      "gstnumber": "",
      "isbusinessuser": false,
      "createddate": 1760533672,
      "modifieddate": 1760533672,
      "fcmid": null,
      "isguest": false,
      "isactive": true
    },
    "token": "47cc2e5832021babcfde988759a8ff23228e58a72f4c8f852b92cb8b71b986f4",
    "isNewUser": false
  },
  "message": "Authentication successful"
}

-- 
Verify only for the NO account
{
  "usermobilenumber": 9994824577,

"verifyOnly":true
}

{
  "success": false,
  "message": "User not found",
  "details": "No account exists with this mobile number.",
  "statusCode": 404,
  "remainingAttempts": 4
}


---

verify only for correct user 
{
  "usermobilenumber": 9994824577,

"verifyOnly":true
},
{
  "success": true,
  "data": {
    "user": {
      "id": 41,
      "useremail": "",
      "usermobilenumber": 9994824573,
      "firstname": "User",
      "lastname": "",
      "gender": "",
      "gstnumber": "",
      "isbusinessuser": false,
      "createddate": 1760533672,
      "modifieddate": 1760533672,
      "fcmid": null,
      "isguest": false,
      "isactive": true
    },
    "token": "5c558ea1c94bf22ce0b371667dc89892efc7ed338213409e4580f7ca11c87d9a",
    "isNewUser": false
  },
  "message": "Authentication successful"
}

deactivate account response 
{
  "userid": 41,
  "useremail": "user@example.com"
}


{
  "success": true,
  "data": {
    "userId": 41,
    "email": "user@example.com",
    "isActive": false,
    "ordersCount": 0,
    "orderlinesCount": 0,
    "emailSent": true
  },
  "message": "Account deactivated successfully"
}