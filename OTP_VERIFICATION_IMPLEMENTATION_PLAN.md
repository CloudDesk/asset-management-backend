# 🔐 OTP Verification Implementation Plan

## 📋 Overview

Complete OTP (One-Time Password) verification system using Twilio SMS and Redis for secure, rate-limited authentication.

## 🎯 Requirements

1. ✅ Generate and send OTP via Twilio SMS
2. ✅ Store OTP in Redis with 60-second expiration
3. ✅ Rate limiting to prevent spam/abuse
4. ✅ Verify OTP with phone number
5. ✅ Handle multiple OTP requests from same number
6. ✅ Security best practices

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. Request OTP
       ▼
┌─────────────────────────────────┐
│  POST /v1/sms/send-otp-twilio  │
└──────┬──────────────────────────┘
       │
       ├─► Check Rate Limit (Redis)
       │   - Max 3 attempts per phone/15min
       │   - Block after 5 failed verifications
       │
       ├─► Generate 6-digit OTP
       │   - Cryptographically secure random
       │
       ├─► Send SMS via Twilio
       │
       └─► Store in Redis:
           Key: otp:{phoneNumber}
           Value: {otp, attempts, createdAt}
           TTL: 60 seconds
           
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 2. Verify OTP
       ▼
┌─────────────────────────────┐
│  POST /v1/sms/verify-otp   │
└──────┬────────────────────┘
       │
       ├─► Get from Redis: otp:{phoneNumber}
       │
       ├─► Check attempts (max 3)
       │
       ├─► Compare OTP (constant-time)
       │
       ├─► If valid:
       │   - Delete from Redis
       │   - Return success token
       │
       └─► If invalid:
           - Increment attempts
           - Return error
```

## 📊 Redis Schema

### 1. OTP Storage
```
Key: otp:{phoneNumber}
Value: JSON {
  otp: "123456",
  attempts: 0,
  createdAt: 1234567890,
  expiresAt: 1234567950
}
TTL: 60 seconds
```

### 2. Rate Limiting (Send OTP)
```
Key: rate:send:{phoneNumber}
Value: count (integer)
TTL: 900 seconds (15 minutes)
Limit: 3 requests per 15 minutes
```

### 3. Rate Limiting (Verify OTP)
```
Key: rate:verify:{phoneNumber}
Value: count (integer)
TTL: 3600 seconds (1 hour)
Limit: 5 failed attempts per hour
```

### 4. Block List
```
Key: blocked:{phoneNumber}
Value: reason
TTL: 3600 seconds (1 hour)
```

## 🔒 Security Features

### 1. OTP Generation
- 6-digit numeric code
- Cryptographically secure random
- No sequential or predictable patterns

### 2. Rate Limiting
| Action | Limit | Window | Consequence |
|--------|-------|--------|-------------|
| Send OTP | 3 attempts | 15 minutes | Temporary block |
| Verify OTP | 3 attempts per OTP | 60 seconds | OTP invalidated |
| Failed Verifications | 5 attempts | 1 hour | 1-hour block |

### 3. Validation
- Phone number format validation (E.164)
- OTP length check (6 digits)
- Constant-time comparison (prevent timing attacks)
- Expiration check

### 4. Security Headers
- No OTP in logs (masked)
- No OTP in error messages
- Secure random generation
- Auto-cleanup on expiration

## 🛠️ Implementation Steps

### Step 1: Redis Setup
```typescript
// src/config/redis.ts
- Install redis package
- Configure connection
- Add reconnection logic
- Health check endpoint
```

### Step 2: OTP Service
```typescript
// src/services/otp.service.ts
- generateOtp(): Generate secure 6-digit OTP
- storeOtp(): Store in Redis with expiry
- verifyOtp(): Validate and compare OTP
- checkRateLimit(): Enforce rate limits
- blockPhoneNumber(): Block abusive numbers
```

### Step 3: Update SMS Controller
```typescript
// src/controllers/sms.controller.ts
- Modify sendOtpTwilio to:
  1. Check rate limit
  2. Generate OTP
  3. Store in Redis
  4. Send via Twilio
  5. Return success (no OTP in response)
```

### Step 4: Create Verification Endpoint
```typescript
// src/controllers/sms.controller.ts
- verifyOtp():
  1. Validate input
  2. Check if blocked
  3. Get OTP from Redis
  4. Compare OTP
  5. Check attempts
  6. Return result
```

### Step 5: Schemas
```typescript
// src/schemas/otp.schema.ts
- sendOtpSchema: { phoneNumber }
- verifyOtpSchema: { phoneNumber, otp }
```

### Step 6: Routes
```typescript
// src/routes/sms.route.ts
- POST /v1/sms/send-otp-twilio (existing, modify)
- POST /v1/sms/verify-otp (new)
- POST /v1/sms/resend-otp (new, optional)
```

## 📝 API Endpoints

### 1. Send OTP
```bash
POST /v1/sms/send-otp-twilio

Request:
{
  "phoneNumber": "8825727948"
}

Response (Success):
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phoneNumber": "+918825727948",
    "expiresIn": 60,
    "canResendAfter": 30
  }
}

Response (Rate Limited):
{
  "success": false,
  "message": "Too many OTP requests",
  "details": "Please try again after 10 minutes",
  "retryAfter": 600
}
```

### 2. Verify OTP
```bash
POST /v1/sms/verify-otp

Request:
{
  "phoneNumber": "8825727948",
  "otp": "123456"
}

Response (Success):
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "verified": true,
    "phoneNumber": "+918825727948",
    "token": "jwt_token_here" // Optional: for authentication
  }
}

Response (Invalid OTP):
{
  "success": false,
  "message": "Invalid OTP",
  "details": "The OTP you entered is incorrect",
  "attemptsRemaining": 2
}

Response (Expired):
{
  "success": false,
  "message": "OTP expired",
  "details": "Please request a new OTP",
  "canResend": true
}
```

### 3. Resend OTP (Optional)
```bash
POST /v1/sms/resend-otp

Request:
{
  "phoneNumber": "8825727948"
}

Response: Same as Send OTP
```

## 🎨 Rate Limiting Strategy

### Scenario 1: Normal User
```
Request 1: ✅ OTP sent (expires in 60s)
Request 2 (after 10s): ❌ "Please wait 50 seconds before requesting again"
Request 3 (after 65s): ✅ OTP sent (new OTP)
```

### Scenario 2: Spam Prevention
```
Request 1: ✅ OTP sent
Request 2 (after 65s): ✅ OTP sent
Request 3 (after 130s): ✅ OTP sent
Request 4 (after 195s): ❌ "Rate limit exceeded. Try after 15 minutes"
```

### Scenario 3: Failed Verifications
```
Verify 1: ❌ Wrong OTP (2 attempts left)
Verify 2: ❌ Wrong OTP (1 attempt left)
Verify 3: ❌ Wrong OTP (OTP invalidated)
Verify 4: ❌ "OTP expired. Request new OTP"

After 5 failed verifications in 1 hour:
❌ "Too many failed attempts. Blocked for 1 hour"
```

## 🔄 Flow Diagrams

### Happy Path
```
User                    Backend              Redis               Twilio
 |                         |                    |                    |
 |-- Send OTP Request ---->|                    |                    |
 |                         |-- Check Rate ----->|                    |
 |                         |<-- OK -------------|                    |
 |                         |-- Generate OTP     |                    |
 |                         |-- Store OTP ------>|                    |
 |                         |<-- Stored ---------|                    |
 |                         |-- Send SMS ----------------------->|
 |                         |<-- SMS Sent -----------------------|
 |<-- Success Response ----|                    |                    |
 |                         |                    |                    |
 |-- Verify Request ------>|                    |                    |
 |                         |-- Get OTP -------->|                    |
 |                         |<-- OTP Data -------|                    |
 |                         |-- Compare OTP      |                    |
 |                         |-- Delete OTP ----->|                    |
 |<-- Verified ------------|                    |                    |
```

### Error Path - Rate Limited
```
User                    Backend              Redis
 |                         |                    |
 |-- Send OTP Request ---->|                    |
 |                         |-- Check Rate ----->|
 |                         |<-- Limit Exceeded -|
 |<-- Rate Limited Error --|                    |
```

### Error Path - Invalid OTP
```
User                    Backend              Redis
 |                         |                    |
 |-- Verify (wrong OTP) -->|                    |
 |                         |-- Get OTP -------->|
 |                         |<-- OTP Data -------|
 |                         |-- Compare (FAIL)   |
 |                         |-- Increment Try -->|
 |<-- Invalid OTP Error ---|                    |
```

## 🧪 Testing Scenarios

### Test Case 1: Successful OTP Flow
1. Request OTP for phone number
2. Verify OTP is stored in Redis
3. Check TTL is 60 seconds
4. Verify OTP with correct code
5. Confirm OTP is deleted from Redis

### Test Case 2: OTP Expiration
1. Request OTP
2. Wait 61 seconds
3. Try to verify OTP
4. Should get "OTP expired" error

### Test Case 3: Rate Limiting (Send)
1. Request OTP (success)
2. Immediately request again (should fail)
3. Wait 65 seconds
4. Request OTP (success)
5. Repeat 2 more times
6. 4th request should be rate limited

### Test Case 4: Rate Limiting (Verify)
1. Request OTP
2. Try wrong OTP 3 times
3. Should invalidate OTP
4. Request new OTP
5. Try wrong OTP 2 more times (total 5)
6. Should be blocked for 1 hour

### Test Case 5: Multiple Concurrent Requests
1. Send 5 OTP requests simultaneously
2. Only 1 should succeed
3. Others should be rate limited

### Test Case 6: Phone Number Validation
1. Try invalid phone formats
2. Try empty phone number
3. Try international formats
4. Should validate properly

## 📦 Dependencies

```json
{
  "dependencies": {
    "redis": "^4.6.0",
    "ioredis": "^5.3.0" // Alternative, better TypeScript support
  }
}
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
REDIS_TLS=false

# OTP Configuration
OTP_LENGTH=6
OTP_EXPIRY_SECONDS=60
OTP_MAX_ATTEMPTS=3

# Rate Limiting
RATE_LIMIT_SEND_MAX=3
RATE_LIMIT_SEND_WINDOW=900
RATE_LIMIT_VERIFY_MAX=5
RATE_LIMIT_VERIFY_WINDOW=3600
```

## 🚀 Production Considerations

### 1. Redis High Availability
- Use Redis Cluster or Sentinel
- Configure failover
- Monitor Redis health

### 2. Logging
- Log OTP requests (mask phone numbers)
- Log failed verifications
- Alert on suspicious patterns

### 3. Monitoring
- Track OTP success rate
- Monitor rate limiting hits
- Alert on high failure rates

### 4. Costs
- Twilio SMS costs per message
- Redis hosting costs
- Monitor usage to control costs

### 5. Compliance
- Store minimal data
- Auto-delete after expiry
- Follow GDPR/privacy regulations
- Don't log OTP codes

## 📈 Scalability

### For High Traffic:
1. Use Redis Cluster for horizontal scaling
2. Implement connection pooling
3. Add caching layer
4. Consider message queues for SMS sending
5. Load balance across multiple Twilio numbers

## 🛡️ Security Checklist

- [x] OTP generated securely (crypto.randomInt)
- [x] Rate limiting on send
- [x] Rate limiting on verify
- [x] Auto-expiration (60 seconds)
- [x] Max attempts (3 per OTP)
- [x] Block abusive users
- [x] Constant-time OTP comparison
- [x] No OTP in logs
- [x] No OTP in error messages
- [x] Phone number validation
- [x] HTTPS only (in production)

## 📚 Next Steps

1. Install Redis and configure connection
2. Implement OTP service
3. Update SMS controller
4. Add verification endpoint
5. Create validation schemas
6. Add comprehensive tests
7. Update API documentation
8. Deploy and monitor

## 🔗 References

- Redis TTL: https://redis.io/commands/expire/
- Twilio Best Practices: https://www.twilio.com/docs/verify/api/best-practices
- OWASP OTP Guidelines: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

