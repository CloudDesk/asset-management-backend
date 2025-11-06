# Twilio OTP Routes - Complete Analysis

## Overview

This document provides an in-depth analysis of the two Twilio OTP authentication routes:
1. **POST `/v1/mobile-auth/request-otp`** - Generate and send OTP
2. **POST `/v1/mobile-auth/verify-otp`** - Verify OTP and authenticate user

The implementation uses:
- **Redis** for OTP storage and rate limiting
- **Twilio SMS API** for sending OTP messages
- **Fastify** web framework
- **Multi-layer rate limiting** (in-memory + Redis-based)

---

## Route 1: Request OTP (`/request-otp`)

### Purpose
Generate a 6-digit OTP, store it in Redis, and send it via SMS to the user's mobile number.

### Complete Flow

#### Step 1: Rate Limiting Check (In-Memory)
```
Identifier: `${request.ip}-${usermobilenumber}`
Max Attempts: 5 per 15 minutes (configurable)
```
- Checks if IP+mobile combo has exceeded attempts
- Returns `429 Too Many Requests` if rate limited
- Uses `AuthRateLimit` class (in-memory Map-based)

**Code Location:** ```184:287:src/routes/mobile-auth.route.ts```

#### Step 2: User Existence Check
- Queries database using `usersService.findByMobileNumber(usermobilenumber)`
- **Special Mode:** If `verifyOnly=true` and user doesn't exist → returns `404`
  - Used for delete account flow (verify user exists before deletion)
- Tracks `isNewUser = !user` for later reference
- **Important:** User is NOT created at this stage

**Code Location:** ```289:321:src/routes/mobile-auth.route.ts```

#### Step 3: OTP Generation & Redis Storage
Calls `otpService.generateAndStoreOtp(phoneNumberString)` which:

1. **Block Check:** Verifies phone not blocked (Redis key: `blocked:+91{mobile}`)
2. **Send Rate Limit Check:** 
   - Redis key: `rate:send:+91{mobile}`
   - Max: 3 requests per 15 minutes (RATE_LIMIT_SEND_MAX=3, RATE_LIMIT_SEND_WINDOW=900s)
3. **Resend Cooldown Check:**
   - Redis key: `resend:cooldown:+91{mobile}`
   - Must wait 30 seconds between requests
4. **Generate Secure OTP:**
   - Uses `crypto.randomInt()` for cryptographically secure random 6-digit OTP
   - OTP format: `000000` to `999999` (padded)
5. **Store in Redis:**
   - Key: `otp:+91{mobile}`
   - Value: JSON stringified `OtpData` object
   - TTL: 60 seconds (OTP_EXPIRY_SECONDS)
   - Structure:
     ```json
     {
       "otp": "123456",
       "attempts": 0,
       "createdAt": 1699123456789,
       "expiresAt": 1699123516789,
       "phoneNumber": "+919344715431"
     }
     ```
6. **Increment Rate Limits:**
   - Increments send rate limit counter
   - Sets 30-second resend cooldown

**Code Location:** ```257:343:src/services/otp.service.ts```

#### Step 4: Send SMS via Twilio
Calls `twilioSmsService.sendOtp(phoneNumberString, otpMessage)`:

1. **Phone Number Formatting:**
   - Ensures country code (+91) is present
   - Removes non-digit characters
   - Handles various formats: `9344715431`, `09123456789`, `+91934...`, etc.
2. **Message Construction:**
   ```
   "Your verification code is: {otp}. Valid for 60 seconds. Do not share this code."
   ```
3. **Twilio API Call:**
   - Uses Twilio Messaging Service SID (if available) OR phone number as sender
   - Sends SMS via `client.messages.create()`
   - Returns message SID on success
4. **Error Handling:**
   - If SMS fails → deletes OTP from Redis immediately
   - Returns `500 Internal Server Error`

**Code Location:** ```65:148:src/services/twilioSms.service.ts```

#### Step 5: Success Response
- Clears in-memory rate limiting for this identifier
- Returns success with metadata

**Code Location:** ```369:396:src/routes/mobile-auth.route.ts```

### Request Example

```json
POST /v1/mobile-auth/request-otp
Content-Type: application/json

{
  "usermobilenumber": 9344715431,
  "verifyOnly": false
}
```

**Alternative Request (Delete Account Flow):**
```json
{
  "usermobilenumber": 9344715431,
  "verifyOnly": true
}
```

### Success Response (200)

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "mobileNumber": 9344715431,
    "otpSent": true,
    "expiresIn": 60,
    "canResendAfter": 30,
    "isNewUser": false
  }
}
```

**Response for New User:**
```json
{
  "success": true,
  "message": "New account created and OTP sent successfully",
  "data": {
    "mobileNumber": 9344715431,
    "otpSent": true,
    "expiresIn": 60,
    "canResendAfter": 30,
    "isNewUser": true
  }
}
```

### Error Responses

#### 429 Too Many Requests (Rate Limited)
```json
{
  "success": false,
  "message": "Too many OTP requests",
  "details": "Please try again later",
  "statusCode": 429,
  "remainingAttempts": 2
}
```

#### 404 Not Found (verifyOnly=true, user doesn't exist)
```json
{
  "success": false,
  "message": "User not found",
  "details": "No account exists with this mobile number.",
  "statusCode": 404,
  "remainingAttempts": 4
}
```

#### 500 Internal Server Error (SMS Failed)
```json
{
  "success": false,
  "message": "Failed to send OTP",
  "details": "Could not send SMS",
  "statusCode": 500
}
```

---

## Route 2: Verify OTP (`/verify-otp`)

### Purpose
Verify the OTP code entered by user, create user account if new, and return authentication token.

### Complete Flow

#### Step 1: Input Validation
- Checks if OTP is provided (not `undefined` or `null`)
- Validates OTP format:
  - Must be exactly 6 digits
  - Must contain only numeric characters
  - Converts to string for Redis comparison

**Code Location:** ```503:532:src/routes/mobile-auth.route.ts```

#### Step 2: Rate Limiting Check (In-Memory)
- Same identifier format: `${request.ip}-${usermobilenumber}`
- Returns `429` if rate limited

**Code Location:** ```534:551:src/routes/mobile-auth.route.ts```

#### Step 3: OTP Verification (Redis)
Calls `otpService.verifyOtp(phoneNumberString, otpString)`:

1. **Block Check:** Verifies phone not blocked
2. **Verify Rate Limit Check:**
   - Redis key: `rate:verify:+91{mobile}`
   - Max: 5 failed attempts per hour (RATE_LIMIT_VERIFY_MAX=5, RATE_LIMIT_VERIFY_WINDOW=3600s)
   - If exceeded → phone number is **blocked for 1 hour**
3. **Fetch OTP from Redis:**
   - Key: `otp:+91{mobile}`
   - If not found → expired or never generated
4. **Expiry Check:**
   - Compares `Date.now()` with `otpData.expiresAt`
   - If expired → delete OTP, return error
5. **Attempts Check:**
   - Max attempts: 3 per OTP (OTP_MAX_ATTEMPTS=3)
   - If exceeded → delete OTP, return error
6. **OTP Comparison (Security-Critical):**
   - Uses `crypto.timingSafeEqual()` to prevent timing attacks
   - Compares `Buffer.from(otpData.otp)` with `Buffer.from(inputOtp)`
   - **Timing-safe comparison** prevents attackers from guessing OTP based on response time
7. **On Success:**
   - Delete OTP from Redis
   - Clear verify rate limit
   - Return verified=true
8. **On Failure:**
   - Increment attempts counter
   - Update OTP data in Redis with new attempts count
   - Increment verify rate limit counter
   - Return error with attempts remaining

**Code Location:** ```349:473:src/services/otp.service.ts```

#### Step 4: User Creation or Retrieval
After successful OTP verification:

1. **Check User Existence:**
   - Query database using `usersService.findByMobileNumber(usermobilenumber)`
2. **Create User if New:**
   - Only creates user **AFTER** OTP verification succeeds
   - New user data:
     ```typescript
     {
       usermobilenumber: usermobilenumber,
       firstname: "User",
       createddate: Date.now(),
       modifieddate: Date.now()
     }
     ```
   - Sets `isNewUser = true`
   - If creation fails → returns `500` error

**Code Location:** ```583:616:src/routes/mobile-auth.route.ts```

#### Step 5: Generate Session Token
- Uses `generateSessionToken()` from `utils/auth.ts`
- Generates 32-byte cryptographically secure random token
- Format: 64-character hexadecimal string

**Code Location:** ```81:90:src/utils/auth.ts```

#### Step 6: Sanitize & Return User Data
- Removes sensitive fields: `userpassword`, `resetToken`, `resetTokenExpires`, `sessionToken`
- Returns sanitized user object with token

**Code Location:** ```151:154:src/utils/auth.ts```

### Request Example

```json
POST /v1/mobile-auth/verify-otp
Content-Type: application/json

{
  "usermobilenumber": 9344715431,
  "otp": "123456"
}
```

**Note:** OTP can be sent as number or string. The route accepts both.

### Success Response (200)

```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": 123,
      "useremail": "user@example.com",
      "usermobilenumber": 9344715431,
      "firstname": "John",
      "lastname": "Doe",
      "gender": "male",
      "gstnumber": null,
      "isbusinessuser": false
    },
    "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
    "isNewUser": false
  }
}
```

**Response for New User:**
```json
{
  "success": true,
  "message": "Account created and authenticated successfully",
  "data": {
    "user": {
      "id": 456,
      "usermobilenumber": 9344715431,
      "firstname": "User",
      "lastname": null,
      "useremail": null
    },
    "token": "f2e1d0c9b8a7z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1",
    "isNewUser": true
  }
}
```

### Error Responses

#### 400 Bad Request (Missing/Invalid OTP)
```json
{
  "success": false,
  "message": "OTP is required",
  "details": "Please enter the 6-digit OTP you received",
  "statusCode": 400
}
```

```json
{
  "success": false,
  "message": "Invalid OTP format",
  "details": "OTP must be exactly 6 digits",
  "statusCode": 400
}
```

#### 401 Unauthorized (Invalid OTP)
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Invalid or expired OTP",
  "statusCode": 401,
  "remainingAttempts": 2,
  "attemptsRemaining": 2,
  "canResend": false
}
```

#### 429 Too Many Requests (Rate Limited or Blocked)
```json
{
  "success": false,
  "message": "Too many verification attempts",
  "details": "Please try again later",
  "statusCode": 429,
  "remainingAttempts": 0
}
```

```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Too many failed verification attempts. Account temporarily blocked.",
  "statusCode": 429,
  "remainingAttempts": 0,
  "canResend": false
}
```

---

## Related Services & Components

### 1. OTP Service (`otp.service.ts`)
**Responsibilities:**
- Generate cryptographically secure OTPs
- Store/retrieve OTPs from Redis
- Manage rate limiting (send and verify)
- Block phone numbers after excessive failures
- Enforce resend cooldown periods
- Validate OTPs with timing-safe comparison

**Key Methods:**
- `generateAndStoreOtp(phoneNumber)` - Generate and store OTP
- `verifyOtp(phoneNumber, inputOtp)` - Verify OTP with security checks
- `isBlocked(phoneNumber)` - Check if phone is blocked
- `blockPhoneNumber(phoneNumber, reason, duration)` - Block phone number
- `checkSendRateLimit(phoneNumber)` - Check send rate limit
- `checkVerifyRateLimit(phoneNumber)` - Check verify rate limit
- `deleteOtp(phoneNumber)` - Cleanup OTP from Redis

**Redis Key Patterns:**
- `otp:+91{mobile}` - OTP data (TTL: 60 seconds)
- `rate:send:+91{mobile}` - Send rate limit counter (TTL: 900 seconds)
- `rate:verify:+91{mobile}` - Verify rate limit counter (TTL: 3600 seconds)
- `blocked:+91{mobile}` - Block status (TTL: 3600 seconds)
- `resend:cooldown:+91{mobile}` - Resend cooldown (TTL: 30 seconds)

### 2. Twilio SMS Service (`twilioSms.service.ts`)
**Responsibilities:**
- Format phone numbers for international SMS
- Send SMS via Twilio API
- Handle Twilio API errors
- Validate Twilio credentials at startup

**Key Methods:**
- `sendOtp(phoneNumber, message)` - Send SMS via Twilio
- `checkAccountBalance()` - Check Twilio account balance
- `getAccountInfo()` - Get Twilio account information

**Configuration:**
- Uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Optional: `TWILIO_MESSAGING_SERVICE_SID` (preferred over phone number)

### 3. Users Service (`users.service.ts`)
**Responsibilities:**
- Query users by mobile number
- Create new user accounts
- Store session tokens

**Key Methods:**
- `findByMobileNumber(mobileNumber)` - Find user by mobile number
- `create(userData)` - Create new user account

### 4. Auth Utilities (`utils/auth.ts`)
**Responsibilities:**
- Generate session tokens
- Sanitize user data (remove sensitive fields)
- In-memory rate limiting (IP+mobile combo)

**Key Methods:**
- `generateSessionToken()` - Generate 64-char hex token
- `sanitizeUserData(user)` - Remove password/token fields
- `AuthRateLimit` class - In-memory rate limiting

---

## Data Handling

### Phone Number Format Conversion

**Input Format:** `9344715431` (10-digit number)
**Storage Format:** `+919344715431` (E.164 international format)

**Conversion Logic:**
```typescript
const phoneNumberString = `+91${usermobilenumber}`;
```

### Redis Data Structures

#### OTP Storage
```
Key: otp:+919344715431
Value (JSON): {
  "otp": "123456",
  "attempts": 0,
  "createdAt": 1699123456789,
  "expiresAt": 1699123516789,
  "phoneNumber": "+919344715431"
}
TTL: 60 seconds
```

#### Rate Limit Counters
```
Key: rate:send:+919344715431
Value: "2" (number as string)
TTL: 900 seconds (15 minutes)

Key: rate:verify:+919344715431
Value: "1" (number as string)
TTL: 3600 seconds (1 hour)
```

#### Block Status
```
Key: blocked:+919344715431
Value: "Too many failed verification attempts"
TTL: 3600 seconds (1 hour)
```

#### Resend Cooldown
```
Key: resend:cooldown:+919344715431
Value: "1"
TTL: 30 seconds
```

### Session Token Format
```
Type: Hexadecimal string
Length: 64 characters
Generation: crypto.randomBytes(32).toString('hex')
Example: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
```

---

## Security Aspects

### 1. Multi-Layer Rate Limiting

#### Layer 1: In-Memory Rate Limiting
- **Purpose:** Quick protection against brute force attempts
- **Scope:** IP address + mobile number combination
- **Limit:** 5 attempts per 15 minutes
- **Storage:** In-memory Map (per-instance, not shared across servers)

#### Layer 2: Redis-Based Send Rate Limiting
- **Purpose:** Prevent OTP spam
- **Scope:** Phone number
- **Limit:** 3 OTP requests per 15 minutes
- **Storage:** Redis (shared across all instances)
- **Penalty:** Must wait 30 seconds before requesting another OTP (resend cooldown)

#### Layer 3: Redis-Based Verify Rate Limiting
- **Purpose:** Prevent brute force OTP guessing
- **Scope:** Phone number
- **Limit:** 5 failed verification attempts per hour
- **Storage:** Redis (shared across all instances)
- **Penalty:** Phone number blocked for 1 hour after limit exceeded

### 2. OTP Security Features

#### Cryptographically Secure Generation
- Uses `crypto.randomInt()` instead of `Math.random()`
- Ensures uniform distribution and unpredictability

#### Timing-Safe Comparison
- Uses `crypto.timingSafeEqual()` to prevent timing attacks
- Compares OTPs in constant time regardless of matching position
- Prevents attackers from guessing OTP based on response time

#### Limited Attempts
- Each OTP can be attempted **3 times maximum**
- After 3 failed attempts, OTP is deleted and user must request new one

#### Short Expiry Time
- OTP expires in **60 seconds**
- Reduces window of attack if OTP is intercepted

#### One-Time Use
- OTP is deleted immediately after successful verification
- Cannot be reused even if still valid

### 3. Phone Number Blocking

**Triggers:**
- 5 failed OTP verification attempts within 1 hour

**Duration:**
- 1 hour block (configurable via `BLOCK_DURATION` env var)

**Recovery:**
- Automatic unblocking after TTL expires
- Admin can manually clear blocks using `clearAllLimits()`

### 4. User Account Creation Security

**Delayed Creation:**
- User account is **NOT created** when requesting OTP
- Account is created **only after** successful OTP verification
- Prevents database pollution with unverified phone numbers

**Verification Flow:**
```
Request OTP → OTP Generated → OTP Sent → User Enters OTP → 
OTP Verified → User Created → Token Generated
```

### 5. Data Sanitization

**User Data Sanitization:**
- Removes sensitive fields before sending to client:
  - `userpassword`
  - `resetToken`
  - `resetTokenExpires`
  - `sessionToken`

**Logging:**
- Phone numbers are masked in logs: `+91****5431`
- Prevents sensitive data leakage in log files

### 6. Input Validation

**OTP Validation:**
- Must be exactly 6 digits
- Must contain only numeric characters
- Cannot be null or undefined

**Mobile Number Validation:**
- Must be between 10-11 digits
- Validated via JSON schema (Fastify)

### 7. Error Message Security

**Generic Error Messages:**
- Does not reveal whether phone number exists in database (except in `verifyOnly` mode)
- Does not reveal OTP format or generation details
- Does not leak internal system information

### 8. Session Token Security

**Token Generation:**
- 32 bytes of cryptographically secure random data
- Converted to 64-character hexadecimal string
- High entropy (256 bits)

**Token Storage:**
- Stored in database user record
- Must be included in subsequent authenticated requests
- Used for session validation

---

## Configuration & Environment Variables

### OTP Service Configuration
```env
OTP_LENGTH=6                           # OTP digit count
OTP_EXPIRY_SECONDS=60                  # OTP validity period
OTP_MAX_ATTEMPTS=3                     # Max attempts per OTP
RATE_LIMIT_SEND_MAX=3                  # Max OTP requests per window
RATE_LIMIT_SEND_WINDOW=900             # Send rate limit window (15 min)
RATE_LIMIT_VERIFY_MAX=5                # Max failed verifications per window
RATE_LIMIT_VERIFY_WINDOW=3600          # Verify rate limit window (1 hour)
BLOCK_DURATION=3600                    # Phone blocking duration (1 hour)
```

### Twilio Configuration
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Optional
```

### Rate Limiting Configuration (In-Memory)
```typescript
// In utils/auth.ts
maxAttempts: 5
windowMs: 15 * 60 * 1000  // 15 minutes
```

---

## Flow Diagrams

### Request OTP Flow
```
Client
  ↓
POST /v1/mobile-auth/request-otp
  ↓
Rate Limit Check (In-Memory)
  ├─→ Blocked? → 429 Response
  └─→ Allowed → Continue
  ↓
User Existence Check (Database)
  ├─→ verifyOnly=true & !user? → 404 Response
  └─→ Continue
  ↓
OTP Service: generateAndStoreOtp()
  ├─→ Block Check (Redis)
  ├─→ Send Rate Limit Check (Redis)
  ├─→ Resend Cooldown Check (Redis)
  ├─→ Generate Secure OTP
  ├─→ Store OTP in Redis (TTL: 60s)
  └─→ Set Rate Limits/Cooldowns
  ↓
Twilio SMS Service: sendOtp()
  ├─→ Format Phone Number
  ├─→ Construct Message
  ├─→ Send via Twilio API
  └─→ SMS Failed? → Delete OTP, Return 500
  ↓
Success Response (200)
```

### Verify OTP Flow
```
Client
  ↓
POST /v1/mobile-auth/verify-otp
  ↓
Input Validation
  ├─→ Missing OTP? → 400 Response
  ├─→ Invalid Format? → 400 Response
  └─→ Valid → Continue
  ↓
Rate Limit Check (In-Memory)
  ├─→ Blocked? → 429 Response
  └─→ Allowed → Continue
  ↓
OTP Service: verifyOtp()
  ├─→ Block Check (Redis)
  ├─→ Verify Rate Limit Check (Redis)
  ├─→ Fetch OTP from Redis
  ├─→ Expiry Check
  ├─→ Attempts Check (max 3)
  ├─→ Timing-Safe OTP Comparison
  │   ├─→ Match? → Delete OTP, Clear Rate Limits
  │   └─→ Mismatch? → Increment Attempts, Return Error
  └─→ Return Verification Result
  ↓
OTP Verification Failed? → 401/429 Response
  ↓
OTP Verified Successfully
  ↓
User Existence Check (Database)
  ├─→ User Exists? → Use Existing User
  └─→ User Missing? → Create New User
  ↓
Generate Session Token
  ↓
Sanitize User Data
  ↓
Success Response (200) with User + Token
```

---

## Best Practices Implemented

1. ✅ **Never store OTP in plain text in database** - Only in Redis
2. ✅ **Delete OTP immediately after successful verification**
3. ✅ **Use timing-safe comparison** - Prevents timing attacks
4. ✅ **Multi-layer rate limiting** - In-memory + Redis
5. ✅ **Short OTP expiry** - 60 seconds
6. ✅ **Limited attempts per OTP** - 3 attempts max
7. ✅ **Phone number blocking** - After excessive failures
8. ✅ **Delayed user creation** - Only after OTP verification
9. ✅ **Data sanitization** - Remove sensitive fields from responses
10. ✅ **Cryptographically secure generation** - Uses crypto.randomInt()
11. ✅ **Generic error messages** - Don't leak system information
12. ✅ **Resend cooldown** - Prevent OTP spam
13. ✅ **Comprehensive logging** - For debugging and monitoring
14. ✅ **Input validation** - Strict format checking
15. ✅ **Error recovery** - Clean up OTP if SMS fails

---

## Common Issues & Troubleshooting

### Issue: OTP Not Received
**Possible Causes:**
1. Twilio credentials invalid
2. Phone number format incorrect
3. Twilio account balance low
4. Phone number blocked by Twilio (spam/reporting)

**Debug Steps:**
1. Check Twilio account balance
2. Verify phone number formatting in logs
3. Check Twilio error messages in response
4. Verify Redis OTP storage

### Issue: "Too many requests" Error
**Possible Causes:**
1. Rate limit exceeded (3 requests per 15 min)
2. Resend cooldown active (30 seconds)
3. Phone number blocked (1 hour)

**Solutions:**
1. Wait for rate limit window to expire
2. Wait for resend cooldown (30 seconds)
3. Wait for block duration (1 hour) or clear via admin

### Issue: "Invalid OTP" After Correct Entry
**Possible Causes:**
1. OTP expired (60 seconds passed)
2. OTP already used (one-time use)
3. Wrong phone number used for verification
4. Multiple OTPs generated (only latest is valid)

**Solutions:**
1. Request new OTP
2. Ensure correct phone number matches
3. Wait for previous OTP to expire before requesting new one

---

## Performance Considerations

### Redis Operations
- **OTP Storage:** O(1) GET/SET operations
- **TTL Auto-Cleanup:** Automatic expiry removes old OTPs
- **Rate Limit Counters:** O(1) INCR operations with auto-expiry

### Database Operations
- **User Lookup:** Single indexed query by mobile number
- **User Creation:** Single INSERT operation
- **No unnecessary queries**

### Twilio API
- **Async SMS sending:** Non-blocking, returns immediately
- **Retry logic:** Not implemented (returns error if fails)
- **Rate limits:** Subject to Twilio account limits

---

## Future Enhancements

1. **OTP Resend Endpoint:** Dedicated endpoint to resend OTP
2. **SMS Delivery Verification:** Webhook to track SMS delivery status
3. **Multiple OTP Providers:** Fallback to Infobip if Twilio fails
4. **OTP Templates:** Configurable SMS message templates
5. **Analytics:** Track OTP success/failure rates
6. **Admin Dashboard:** View/manage blocked phone numbers
7. **Rate Limit Tuning:** Per-country rate limits
8. **OTP Length Configuration:** Configurable OTP length (4/6/8 digits)

---

## Related Files

- `src/routes/mobile-auth.route.ts` - Route definitions
- `src/services/otp.service.ts` - OTP generation and verification logic
- `src/services/twilioSms.service.ts` - Twilio SMS integration
- `src/services/users.service.ts` - User database operations
- `src/utils/auth.ts` - Authentication utilities
- `src/config/redis.js` - Redis client configuration

---

**Last Updated:** Based on codebase analysis of mobile-auth routes

