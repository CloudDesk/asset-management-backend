# 🔐 Mobile Authentication System - Deep Analysis

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Route Architecture](#route-architecture)
3. [Authentication Flow](#authentication-flow)
4. [OTP Service & Redis Storage](#otp-service--redis-storage)
5. [SMS Services](#sms-services)
6. [Rate Limiting Mechanisms](#rate-limiting-mechanisms)
7. [User Service Integration](#user-service-integration)
8. [Security Features](#security-features)
9. [Error Handling](#error-handling)
10. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Overview

The mobile authentication system implements a **passwordless OTP-based authentication** flow supporting two SMS providers:
- **Twilio** (primary routes: `/request-otp`, `/verify-otp`)
- **Exotel** (routes: `/exotel/request-otp`, `/exotel/verify-otp`)

### Key Components
- **Routes**: `mobile-auth.route.ts` (4 main OTP endpoints)
- **OTP Service**: `otp.service.ts` (Redis-based OTP management)
- **SMS Services**: `twilioSms.service.ts`, `exotelSms.service.ts`
- **User Service**: `users.service.ts` (user CRUD operations)
- **Auth Utils**: `utils/auth.ts` (rate limiting, token generation)
- **Redis Client**: `config/redis.ts` (singleton Redis connection)

---

## Route Architecture

### 1. POST `/v1/mobile-auth/request-otp` (Twilio)
**Purpose**: Request OTP for mobile number using Twilio SMS

**Request Schema**:
```typescript
{
  usermobilenumber: number (10-11 digits, 1000000000-99999999999),
  verifyOnly?: boolean (default: false) // For delete account flow
}
```

**Response (200)**:
```typescript
{
  success: boolean,
  data: {
    mobileNumber: number,
    otpSent: boolean,
    expiresIn: 60,
    canResendAfter: 30,
    isNewUser: boolean
  },
  message: string
}
```

**Error Responses**:
- `404`: User not found (when `verifyOnly=true`)
- `429`: Rate limited
- `500`: SMS sending failed

---

### 2. POST `/v1/mobile-auth/verify-otp` (Twilio)
**Purpose**: Verify OTP and authenticate user

**Request Schema**:
```typescript
{
  usermobilenumber: number,
  otp: number | string (6 digits)
}
```

**Response (200)**:
```typescript
{
  success: boolean,
  data: {
    user: {
      id, useremail, usermobilenumber, firstname, lastname, 
      gender, gstnumber, isbusinessuser, ...
    },
    token: string (64-char hex),
    isNewUser: boolean
  },
  message: string
}
```

**Error Responses**:
- `400`: Invalid OTP format
- `401`: Invalid/expired OTP
- `429`: Rate limited
- `500`: User creation failed

---

### 3. POST `/v1/mobile-auth/exotel/request-otp` (Exotel)
**Purpose**: Request OTP using Exotel SMS (same flow as Twilio)

**Differences from Twilio**:
- Uses Exotel API with DLT template support
- Supports template-based OTP messages (DLT compliance)
- Same request/response structure

---

### 4. POST `/v1/mobile-auth/exotel/verify-otp` (Exotel)
**Purpose**: Verify OTP using Exotel (same flow as Twilio)

---

## Authentication Flow

### Request OTP Flow (Step 1)

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /request-otp
       │ { usermobilenumber, verifyOnly? }
       ▼
┌─────────────────────────────────────┐
│  mobile-auth.route.ts               │
│  ────────────────────────────────   │
│  1. Rate Limit Check                │
│     (authRateLimit.isRateLimited)   │
│  2. Find User by Mobile              │
│     (usersService.findByMobileNumber)│
│  3. Verify-Only Mode Check          │
│  4. Generate & Store OTP            │
│     (otpService.generateAndStoreOtp) │
│  5. Send SMS                        │
│     (twilioSmsService.sendOtp)      │
│  6. Clear Rate Limits               │
└──────┬──────────────────────────────┘
       │
       ├─► Redis: Store OTP
       ├─► Redis: Rate Limit Counters
       └─► Twilio/Exotel: Send SMS
```

**Detailed Steps**:

1. **Rate Limiting Check** (Line 110-127)
   - Identifier: `${request.ip}-${usermobilenumber}`
   - Uses in-memory `AuthRateLimit` class
   - Max: 5 attempts per 15 minutes
   - Returns `429` if exceeded

2. **User Existence Check** (Line 131)
   - `usersService.findByMobileNumber(usermobilenumber)`
   - Queries database for existing user
   - Returns `null` if not found

3. **Verify-Only Mode** (Line 134-151)
   - If `verifyOnly=true` and user doesn't exist → `404`
   - Used for delete account verification flow
   - Prevents OTP generation for non-existent users

4. **OTP Generation** (Line 166)
   - Converts mobile to E.164: `+91${usermobilenumber}`
   - Calls `otpService.generateAndStoreOtp(phoneNumberString)`
   - Handles Redis storage, rate limits, cooldowns

5. **SMS Sending** (Line 191)
   - Twilio: `twilioSmsService.sendOtp(phoneNumberString, otpMessage)`
   - Exotel: `exotelSmsService.sendOtp(phoneNumberString, otpMessage, otpCode)`
   - If SMS fails → deletes OTP from Redis (Line 195)

6. **Success Response** (Line 228-238)
   - Returns OTP sent confirmation
   - Includes `isNewUser` flag (user not created yet!)

---

### Verify OTP Flow (Step 2)

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /verify-otp
       │ { usermobilenumber, otp }
       ▼
┌─────────────────────────────────────┐
│  mobile-auth.route.ts               │
│  ────────────────────────────────   │
│  1. OTP Format Validation           │
│  2. Rate Limit Check                │
│  3. Verify OTP in Redis             │
│     (otpService.verifyOtp)          │
│  4. Find/Create User                │
│     (usersService.findByMobileNumber)│
│     (usersService.create)           │
│  5. Generate Session Token           │
│     (generateSessionToken)           │
│  6. Sanitize User Data              │
│     (sanitizeUserData)              │
└──────┬──────────────────────────────┘
       │
       ├─► Redis: Verify & Delete OTP
       └─► Database: Create User (if new)
```

**Detailed Steps**:

1. **OTP Validation** (Line 344-373)
   - Checks if OTP is provided
   - Validates length (exactly 6 digits)
   - Validates format (only digits: `/^\d{6}$/`)
   - Returns `400` on validation failure

2. **Rate Limiting** (Line 376-392)
   - Same identifier: `${request.ip}-${usermobilenumber}`
   - Returns `429` if rate limited

3. **OTP Verification** (Line 397)
   - `otpService.verifyOtp(phoneNumberString, otpString)`
   - Uses constant-time comparison (timing-safe)
   - Checks expiry, attempts, rate limits
   - Returns `401` if invalid/expired

4. **User Creation** (Line 425-457)
   - **Critical**: User is created **AFTER** OTP verification
   - If user doesn't exist:
     ```typescript
     {
       usermobilenumber: usermobilenumber,
       firstname: "User",
       createddate: Date.now(),
       modifieddate: Date.now()
     }
     ```
   - Sets `isNewUser = true`
   - Returns `500` if creation fails

5. **Session Token** (Line 463)
   - `generateSessionToken()` → 64-char hex string
   - Generated using `crypto.randomBytes(32)`

6. **Response** (Line 476-487)
   - Returns sanitized user data (no password/tokens)
   - Includes `isNewUser` flag
   - Returns session token

---

## OTP Service & Redis Storage

### OTP Service (`otp.service.ts`)

**Configuration** (Environment Variables):
```typescript
OTP_EXPIRY_SECONDS = 60        // OTP validity
OTP_MAX_ATTEMPTS = 3           // Max verification attempts per OTP
RATE_LIMIT_SEND_MAX = 3        // Max OTP requests
RATE_LIMIT_SEND_WINDOW = 900   // 15 minutes
RATE_LIMIT_VERIFY_MAX = 5      // Max failed verifications
RATE_LIMIT_VERIFY_WINDOW = 3600 // 1 hour
BLOCK_DURATION = 3600          // 1 hour block
```

### Redis Key Patterns

#### 1. OTP Storage
```
Key: otp:+919344715431
Value: {
  "otp": "123456",
  "attempts": 0,
  "createdAt": 1699123456789,
  "expiresAt": 1699123516789,
  "phoneNumber": "+919344715431"
}
TTL: 60 seconds (OTP_EXPIRY_SECONDS)
```

**Operations**:
- `generateAndStoreOtp()`: Creates OTP, stores in Redis with TTL
- `verifyOtp()`: Retrieves, validates, deletes on success
- `deleteOtp()`: Manual cleanup

#### 2. Send Rate Limit
```
Key: rate:send:+919344715431
Value: "2" (count as string)
TTL: 900 seconds (15 minutes)
```

**Purpose**: Prevents OTP spam (max 3 requests per 15 minutes)

**Operations**:
- `checkSendRateLimit()`: Checks if limit exceeded
- `incrementSendRateLimit()`: Increments counter, sets TTL on first increment

#### 3. Verify Rate Limit
```
Key: rate:verify:+919344715431
Value: "3" (failed attempts count)
TTL: 3600 seconds (1 hour)
```

**Purpose**: Prevents brute-force attacks (max 5 failed attempts per hour)

**Operations**:
- `checkVerifyRateLimit()`: Checks limit, blocks phone if exceeded
- `incrementVerifyRateLimit()`: Increments on failed verification

#### 4. Block Status
```
Key: blocked:+919344715431
Value: "Too many failed OTP verification attempts"
TTL: 3600 seconds (1 hour)
```

**Purpose**: Temporary block for suspicious activity

**Operations**:
- `isBlocked()`: Checks if phone is blocked
- `blockPhoneNumber()`: Sets block with reason and duration

#### 5. Resend Cooldown
```
Key: resend:cooldown:+919344715431
Value: "1"
TTL: 30 seconds
```

**Purpose**: Prevents immediate OTP resend (30-second cooldown)

**Operations**:
- `checkResendCooldown()`: Checks if cooldown active
- `setResendCooldown()`: Sets 30-second cooldown

---

### OTP Generation Process

```typescript
async generateAndStoreOtp(phoneNumber: string): Promise<OtpGenerateResult>
```

**Flow**:
1. **Block Check** (Line 260-272)
   - Checks if phone is blocked
   - Returns error if blocked

2. **Send Rate Limit** (Line 275-286)
   - Checks `rate:send:{phoneNumber}`
   - Returns `429` if exceeded

3. **Resend Cooldown** (Line 289-300)
   - Checks `resend:cooldown:{phoneNumber}`
   - Returns error if cooldown active

4. **Generate OTP** (Line 303)
   - Uses `crypto.randomInt(0, 10^6)`
   - Pads to 6 digits with leading zeros
   - Cryptographically secure

5. **Store in Redis** (Line 308-317)
   - Key: `otp:{phoneNumber}`
   - Value: JSON stringified `OtpData`
   - TTL: 60 seconds

6. **Update Rate Limits** (Line 320-323)
   - Increments send rate limit
   - Sets resend cooldown

---

### OTP Verification Process

```typescript
async verifyOtp(phoneNumber: string, inputOtp: string): Promise<OtpVerifyResult>
```

**Flow**:
1. **Block Check** (Line 352-361)
   - Returns error if blocked

2. **Verify Rate Limit** (Line 364-373)
   - Checks failed attempts limit
   - Blocks phone if exceeded

3. **Fetch OTP** (Line 376-387)
   - Gets `otp:{phoneNumber}` from Redis
   - Returns error if not found/expired

4. **Expiry Check** (Line 392-401)
   - Compares `Date.now()` with `expiresAt`
   - Deletes OTP if expired

5. **Attempts Check** (Line 404-414)
   - Checks `attempts >= OTP_MAX_ATTEMPTS`
   - Deletes OTP if exceeded

6. **OTP Comparison** (Line 417-420)
   - **Security Critical**: Uses `crypto.timingSafeEqual()`
   - Prevents timing attacks
   - Compares `Buffer.from(otpData.otp)` with `Buffer.from(inputOtp)`

7. **Success Path** (Line 422-436)
   - Deletes OTP from Redis
   - Clears verify rate limit
   - Returns `verified: true`

8. **Failure Path** (Line 438-463)
   - Increments `attempts` counter
   - Updates Redis with new attempts
   - Increments verify rate limit
   - Returns error with `attemptsRemaining`

---

## SMS Services

### Twilio SMS Service (`twilioSms.service.ts`)

**Configuration**:
```typescript
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER (optional)
TWILIO_MESSAGING_SERVICE_SID (preferred)
```

**Method**: `sendOtp(phoneNumber: string, message: string)`

**Flow**:
1. **Phone Number Formatting** (Line 70-84)
   - Removes non-digit characters
   - Adds `+91` if 10 digits
   - Handles various formats (0-prefixed, 91-prefixed, etc.)

2. **Message Options** (Line 89-101)
   - Uses `messagingServiceSid` if available (preferred)
   - Falls back to `from` phone number
   - Sets `body` and `to`

3. **Send SMS** (Line 103)
   - `this.client.messages.create(messageOptions)`
   - Returns Twilio message SID

4. **Response** (Line 111-113)
   ```typescript
   {
     success: true,
     messageId: twilioResponse.sid,
     status: twilioResponse.status
   }
   ```

---

### Exotel SMS Service (`exotelSms.service.ts`)

**Configuration**:
```typescript
EXOTEL_ACCOUNT_SID
EXOTEL_API_KEY
EXOTEL_API_TOKEN
EXOTEL_SENDER_ID
EXOTEL_SUBDOMAIN (optional, default: 'api')
EXOTEL_DLT_TEMPLATE_ID (optional, for DLT compliance)
```

**Method**: `sendOtp(phoneNumber: string, message: string, otpCode?: string)`

**Key Differences from Twilio**:
1. **DLT Template Support** (Line 162-200)
   - If `EXOTEL_DLT_TEMPLATE_ID` is configured:
     - Uses DLT template instead of custom message
     - Replaces `{#var#}` placeholder with OTP
     - Complies with Indian DLT regulations
   - Falls back to custom message if template fails

2. **API Format** (Line 157-160)
   ```typescript
   {
     From: EXOTEL_SENDER_ID,
     To: formattedNumber,
     Body?: message,  // Only if no DLT template
     DltTemplateId?: EXOTEL_DLT_TEMPLATE_ID,
     DltTemplateVariables?: { var: otpCode }
   }
   ```

3. **Authentication** (Line 68-69)
   - Basic Auth: `Basic ${Buffer.from(apiKey:apiToken).toString('base64')}`

4. **API Endpoint** (Line 60)
   - `https://{subdomain}.exotel.com/v1/Accounts/{accountSid}/Sms/send`

---

## Rate Limiting Mechanisms

### Two-Layer Rate Limiting

#### 1. Application-Level (In-Memory)
**Location**: `utils/auth.ts` - `AuthRateLimit` class

**Purpose**: Quick check before expensive operations

**Configuration**:
```typescript
maxAttempts: 5
windowMs: 15 * 60 * 1000  // 15 minutes
```

**Identifier**: `${request.ip}-${usermobilenumber}`

**Methods**:
- `isRateLimited(identifier)`: Checks if rate limited
- `recordAttempt(identifier)`: Records failed attempt
- `clearAttempts(identifier)`: Clears on success
- `getRemainingAttempts(identifier)`: Returns remaining count

**Storage**: In-memory `Map<string, { count, lastAttempt }>`

**Limitations**:
- Lost on server restart
- Not shared across instances (if multiple servers)
- Used as first-line defense

---

#### 2. Redis-Level (Persistent)
**Location**: `otp.service.ts`

**Purpose**: Persistent, distributed rate limiting

**Rate Limits**:

| Type | Key Pattern | Max | Window | Action |
|------|-------------|-----|--------|--------|
| Send OTP | `rate:send:{phone}` | 3 | 15 min | Block request |
| Verify OTP | `rate:verify:{phone}` | 5 | 1 hour | Block phone |
| Resend | `resend:cooldown:{phone}` | - | 30 sec | Block request |
| Block | `blocked:{phone}` | - | 1 hour | Block all operations |

**Advantages**:
- Persists across restarts
- Shared across instances
- More granular control
- Automatic expiry via TTL

---

### Rate Limiting Flow

```
Request OTP:
  └─► Application Rate Limit Check (fast)
      └─► Redis Send Rate Limit Check
          └─► Redis Resend Cooldown Check
              └─► Generate OTP

Verify OTP:
  └─► Application Rate Limit Check
      └─► Redis Block Check
          └─► Redis Verify Rate Limit Check
              └─► Verify OTP
                  └─► On Failure: Increment Verify Rate Limit
                      └─► If Exceeded: Block Phone
```

---

## User Service Integration

### User Service (`users.service.ts`)

**Key Methods**:

#### 1. `findByMobileNumber(mobileNumber: number)`
**Location**: Line 101-124

**Implementation**:
```typescript
const users = await dynamicFindManyWithFilters(
  'users', 
  { usermobilenumber: mobileNumber }, 
  { skip: 0, take: 1, useAllColumns: true }
);
return users.data?.[0] || null;
```

**Purpose**: Find existing user by mobile number

---

#### 2. `create(data: CreateUsersInput)`
**Location**: Line 126-154

**Implementation**:
```typescript
// Hash password if provided
if (userData.userpassword) {
  userData.userpassword = await hashPassword(userData.userpassword);
}

// Add timestamps
userData = {
  ...userData,
  createddate: Date.now(),
  modifieddate: Date.now()
};

const user = await dynamicCreate('users', userData);
```

**Purpose**: Create new user account

**Used in OTP Flow**:
- Called **AFTER** successful OTP verification
- Creates user with minimal data:
  ```typescript
  {
    usermobilenumber: usermobilenumber,
    firstname: "User",
    createddate: Date.now(),
    modifieddate: Date.now()
  }
  ```

---

### User Creation Strategy

**Important**: Users are **NOT** created during OTP request!

**Flow**:
1. **Request OTP**: User may or may not exist
2. **OTP Sent**: `isNewUser` flag indicates if user will be new
3. **Verify OTP**: User is created **only if**:
   - OTP verification succeeds
   - User doesn't exist

**Benefits**:
- Prevents account creation for invalid phone numbers
- Ensures phone number is verified before account creation
- Reduces database pollution from failed attempts

---

## Security Features

### 1. OTP Security

#### Generation
- **Cryptographically Secure**: Uses `crypto.randomInt()`
- **6-Digit Numeric**: `000000` to `999999`
- **No Predictability**: No sequential or pattern-based generation

#### Storage
- **Redis with TTL**: Auto-expires after 60 seconds
- **JSON Structure**: Stores attempts, timestamps, expiry
- **No Plaintext in Logs**: Phone numbers masked in logs

#### Verification
- **Constant-Time Comparison**: `crypto.timingSafeEqual()`
- **Prevents Timing Attacks**: Response time doesn't reveal OTP validity
- **Attempt Limiting**: Max 3 attempts per OTP
- **Auto-Delete**: OTP deleted on success or max attempts

---

### 2. Rate Limiting Security

#### Multi-Layer Protection
- **Application-Level**: Fast in-memory check
- **Redis-Level**: Persistent, distributed limits
- **Per-Phone Limits**: Prevents phone-specific attacks
- **Per-IP Limits**: Prevents IP-based attacks

#### Blocking Mechanism
- **Automatic Blocking**: After 5 failed verifications
- **Temporary Block**: 1-hour duration
- **Clear on Success**: Blocks cleared on successful auth

---

### 3. Data Security

#### Phone Number Formatting
- **E.164 Format**: `+919344715431`
- **Consistent Storage**: Same format in Redis and database
- **Validation**: 10-11 digit validation in schema

#### User Data Sanitization
- **No Sensitive Data**: Passwords, tokens removed from responses
- **Sanitize Function**: `sanitizeUserData(user)`
- **Removes**: `userpassword`, `resetToken`, `resetTokenExpires`, `sessionToken`

#### Session Tokens
- **64-Char Hex**: `crypto.randomBytes(32).toString('hex')`
- **Cryptographically Secure**: Unpredictable
- **No Expiry in Code**: (May be handled elsewhere)

---

### 4. Error Handling Security

#### No Information Leakage
- **Generic Error Messages**: Don't reveal if user exists
- **Masked Phone Numbers**: In logs: `+91****5431`
- **No OTP in Responses**: OTP never returned to client
- **No Stack Traces**: Errors sanitized before response

---

## Error Handling

### Error Response Structure

```typescript
{
  success: false,
  message: string,        // User-friendly message
  details: string,        // Additional context
  statusCode: number,     // HTTP status code
  remainingAttempts?: number,  // For rate limiting
  attemptsRemaining?: number,  // For OTP verification
  canResend?: boolean     // Whether new OTP can be requested
}
```

### Error Scenarios

#### Request OTP Errors

| Status | Scenario | Message |
|--------|----------|---------|
| 404 | User not found (verifyOnly=true) | "User not found" |
| 429 | Rate limited | "Too many OTP requests" |
| 400 | OTP generation failed | "Failed to generate OTP" |
| 500 | SMS sending failed | "Failed to send OTP" |

#### Verify OTP Errors

| Status | Scenario | Message |
|--------|----------|---------|
| 400 | Invalid OTP format | "OTP must be exactly 6 digits" |
| 401 | Invalid/expired OTP | "Invalid or expired OTP" |
| 429 | Rate limited | "Too many verification attempts" |
| 500 | User creation failed | "OTP verified but failed to create account" |

### Error Recovery

#### Automatic Cleanup
- **SMS Failure**: OTP deleted from Redis (Line 195, 669)
- **OTP Expiry**: Auto-deleted by Redis TTL
- **Max Attempts**: OTP deleted, new OTP can be requested

#### Retry Logic
- **Rate Limited**: `Retry-After` header provided
- **Cooldown**: Wait time included in error message
- **Blocked**: Block duration in error response

---

## Data Flow Diagrams

### Complete Request OTP Flow

```
Client Request
    │
    ├─► Fastify Route Handler
    │   │
    │   ├─► Rate Limit Check (In-Memory)
    │   │   └─► AuthRateLimit.isRateLimited()
    │   │
    │   ├─► User Lookup
    │   │   └─► usersService.findByMobileNumber()
    │   │       └─► Database Query
    │   │
    │   ├─► Verify-Only Check
    │   │   └─► Return 404 if user not found
    │   │
    │   ├─► OTP Generation
    │   │   └─► otpService.generateAndStoreOtp()
    │   │       │
    │   │       ├─► Block Check (Redis)
    │   │       ├─► Send Rate Limit (Redis)
    │   │       ├─► Resend Cooldown (Redis)
    │   │       ├─► Generate OTP (crypto.randomInt)
    │   │       ├─► Store OTP (Redis: otp:{phone})
    │   │       ├─► Increment Rate Limit (Redis)
    │   │       └─► Set Cooldown (Redis)
    │   │
    │   ├─► SMS Sending
    │   │   └─► twilioSmsService.sendOtp()
    │   │       └─► Twilio API Call
    │   │
    │   └─► Response
    │       └─► Success/Error Response
    │
    └─► Client Response
```

### Complete Verify OTP Flow

```
Client Request
    │
    ├─► Fastify Route Handler
    │   │
    │   ├─► OTP Format Validation
    │   │   └─► Length, Format Checks
    │   │
    │   ├─► Rate Limit Check (In-Memory)
    │   │   └─► AuthRateLimit.isRateLimited()
    │   │
    │   ├─► OTP Verification
    │   │   └─► otpService.verifyOtp()
    │   │       │
    │   │       ├─► Block Check (Redis)
    │   │       ├─► Verify Rate Limit (Redis)
    │   │       ├─► Fetch OTP (Redis: otp:{phone})
    │   │       ├─► Expiry Check
    │   │       ├─► Attempts Check
    │   │       ├─► OTP Comparison (timingSafeEqual)
    │   │       ├─► Delete OTP (Redis) [on success]
    │   │       └─► Increment Rate Limit (Redis) [on failure]
    │   │
    │   ├─► User Lookup/Creation
    │   │   └─► usersService.findByMobileNumber()
    │   │       └─► If not found:
    │   │           └─► usersService.create()
    │   │               └─► Database Insert
    │   │
    │   ├─► Token Generation
    │   │   └─► generateSessionToken()
    │   │       └─► crypto.randomBytes(32)
    │   │
    │   ├─► Data Sanitization
    │   │   └─► sanitizeUserData()
    │   │
    │   └─► Response
    │       └─► User Data + Token
    │
    └─► Client Response
```

---

## Redis Data Structure Summary

### All Redis Keys Used

| Key Pattern | Purpose | TTL | Example |
|-------------|---------|-----|---------|
| `otp:{phone}` | Store OTP data | 60s | `otp:+919344715431` |
| `rate:send:{phone}` | Send rate limit counter | 900s | `rate:send:+919344715431` |
| `rate:verify:{phone}` | Verify rate limit counter | 3600s | `rate:verify:+919344715431` |
| `blocked:{phone}` | Block status | 3600s | `blocked:+919344715431` |
| `resend:cooldown:{phone}` | Resend cooldown | 30s | `resend:cooldown:+919344715431` |

### Redis Operations

| Operation | Method | Key Pattern |
|-----------|--------|-------------|
| SET with TTL | `setEx()` | OTP, Rate Limits, Blocks, Cooldowns |
| GET | `get()` | All keys |
| DELETE | `del()` | OTP (on success/expiry) |
| INCREMENT | `incr()` | Rate limit counters |
| TTL | `ttl()` | Check remaining time |
| EXPIRE | `expire()` | Set TTL on existing key |

---

## Key Design Decisions

### 1. User Creation After OTP Verification
**Decision**: Users are created **after** OTP verification, not during request.

**Rationale**:
- Ensures phone number is verified
- Prevents database pollution
- Better security posture

### 2. Dual Rate Limiting
**Decision**: Both in-memory and Redis rate limiting.

**Rationale**:
- In-memory: Fast, first-line defense
- Redis: Persistent, distributed, granular

### 3. Constant-Time OTP Comparison
**Decision**: Uses `crypto.timingSafeEqual()` instead of `===`.

**Rationale**:
- Prevents timing attacks
- Security best practice
- No performance impact for 6-digit comparison

### 4. OTP Auto-Expiry
**Decision**: OTP expires after 60 seconds via Redis TTL.

**Rationale**:
- Automatic cleanup
- No manual expiry checks needed
- Reduces Redis memory usage

### 5. Two SMS Providers
**Decision**: Separate routes for Twilio and Exotel.

**Rationale**:
- Provider flexibility
- DLT compliance (Exotel)
- Fallback options
- Different use cases

---

## Performance Considerations

### Redis Operations
- **Minimal Round Trips**: Batched operations where possible
- **TTL-Based Expiry**: No manual cleanup needed
- **Lazy Connection**: Redis client initialized on demand

### Database Operations
- **Single Query**: `findByMobileNumber` uses indexed lookup
- **Minimal Fields**: Only necessary fields in user creation
- **No N+1 Queries**: Direct queries, no joins

### SMS Operations
- **Async**: SMS sending doesn't block response
- **Error Handling**: OTP cleanup on SMS failure
- **Retry Logic**: Handled by SMS service providers

---

## Testing Considerations

### Unit Tests Needed
- OTP generation and storage
- OTP verification (success/failure paths)
- Rate limiting logic
- Phone number formatting
- Error handling

### Integration Tests Needed
- End-to-end OTP flow
- Redis connection and operations
- SMS service integration
- User creation flow
- Rate limiting enforcement

### Security Tests Needed
- Timing attack prevention
- Rate limit bypass attempts
- OTP brute-force attempts
- Phone number validation
- Block mechanism

---

## Future Enhancements

### Potential Improvements
1. **OTP Resend Endpoint**: Dedicated resend with cooldown
2. **OTP Verification Retry**: Better retry logic
3. **Multi-Factor Auth**: Combine OTP with other factors
4. **SMS Delivery Status**: Webhook for delivery confirmation
5. **Analytics**: Track OTP success rates, delivery times
6. **Custom OTP Length**: Configurable OTP length
7. **OTP Templates**: Customizable SMS templates
8. **International Support**: Multiple country codes

---

## Conclusion

The mobile authentication system is a **well-architected, secure, and scalable** solution for passwordless authentication. Key strengths:

✅ **Security**: Multi-layer rate limiting, constant-time comparison, secure token generation  
✅ **Scalability**: Redis-based storage, distributed rate limiting  
✅ **Reliability**: Error handling, automatic cleanup, SMS failure recovery  
✅ **Flexibility**: Dual SMS providers, configurable limits  
✅ **User Experience**: Clear error messages, retry mechanisms  

The system follows security best practices and is production-ready with proper monitoring and logging.

