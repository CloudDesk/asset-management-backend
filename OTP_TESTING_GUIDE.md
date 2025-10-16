# 🧪 OTP Verification System - Testing Guide

## 📋 Overview

Comprehensive testing guide for the OTP (One-Time Password) verification system with Redis storage, Twilio SMS, and rate limiting.

## 🚀 Prerequisites

### 1. Redis Setup
```bash
# Install Redis (macOS)
brew install redis

# Start Redis
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:latest
```

### 2. Environment Variables
Add to your `.env` file:
```bash
# Redis
REDIS_URL=redis://localhost:6379

# Twilio (get from https://console.twilio.com/)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# OTP Configuration (optional - defaults provided)
OTP_EXPIRY_SECONDS=60
OTP_MAX_ATTEMPTS=3
RATE_LIMIT_SEND_MAX=3
RATE_LIMIT_SEND_WINDOW=900
RATE_LIMIT_VERIFY_MAX=5
RATE_LIMIT_VERIFY_WINDOW=3600
```

### 3. Start the Server
```bash
npm run dev
```

Server should start on port 5600: [[memory:2680131]]

---

## 🎯 Test Scenarios

### Test 1: Successful OTP Flow (Happy Path)

#### Step 1: Send OTP
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "phoneNumber": "8825727948"
}'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phoneNumber": "+918825727948",
    "expiresIn": 60,
    "canResendAfter": 30,
    "sentAt": "2024-10-15T12:00:00.000Z"
  },
  "errors": null
}
```

**What Happens:**
- Generates 6-digit OTP
- Stores in Redis with 60-second TTL
- Sends SMS via Twilio
- Returns success (OTP NOT included in response)

#### Step 2: Check SMS
Check your phone for SMS:
```
Your verification code is: 123456. Valid for 60 seconds. Do not share this code.
```

#### Step 3: Verify OTP
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/verify-otp' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "phoneNumber": "8825727948",
  "otp": "123456"
}'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "verified": true,
    "phoneNumber": "+918825727948"
  },
  "errors": null
}
```

**What Happens:**
- Validates OTP using constant-time comparison
- Deletes OTP from Redis
- Clears failed verification rate limits
- Returns success

---

### Test 2: Invalid OTP

#### Step 1: Send OTP
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```

#### Step 2: Verify with Wrong OTP
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/verify-otp' \
  -H 'Content-Type: application/json' \
  -d '{
  "phoneNumber": "8825727948",
  "otp": "999999"
}'
```

**Expected Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Invalid OTP. Please try again.",
  "attemptsRemaining": 2,
  "canResend": false,
  "statusCode": 400
}
```

#### Step 3: Try Again (2nd Attempt)
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/verify-otp' \
  -H 'Content-Type: application/json' \
  -d '{
  "phoneNumber": "8825727948",
  "otp": "999999"
}'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Invalid OTP. Please try again.",
  "attemptsRemaining": 1,
  "canResend": false,
  "statusCode": 400
}
```

#### Step 4: Try Again (3rd Attempt - Last)
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/verify-otp' \
  -H 'Content-Type: application/json' \
  -d '{
  "phoneNumber": "8825727948",
  "otp": "999999"
}'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Invalid OTP. Please try again.",
  "attemptsRemaining": 0,
  "canResend": true,
  "statusCode": 400
}
```

**What Happens:**
- After 3 failed attempts, OTP is invalidated
- User must request a new OTP

---

### Test 3: OTP Expiration (60 Seconds)

#### Step 1: Send OTP
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```

#### Step 2: Wait 61 Seconds
```bash
sleep 61
```

#### Step 3: Try to Verify
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/verify-otp' \
  -H 'Content-Type: application/json' \
  -d '{
  "phoneNumber": "8825727948",
  "otp": "123456"
}'
```

**Expected Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "OTP not found or has expired. Please request a new OTP.",
  "canResend": true,
  "statusCode": 400
}
```

**What Happens:**
- Redis TTL expires after 60 seconds
- OTP is automatically deleted
- User must request new OTP

---

### Test 4: Rate Limiting - Send OTP

#### Step 1: Send OTP (1st Request)
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```
**Response:** ✅ Success

#### Step 2: Try Immediately (Should Fail - Resend Cooldown)
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```

**Expected Response (429 Too Many Requests):**
```json
{
  "success": false,
  "message": "Failed to generate OTP",
  "details": "Please wait 30 seconds before requesting a new OTP",
  "statusCode": 429
}
```

#### Step 3: Wait 31 Seconds and Try Again
```bash
sleep 31

curl -X 'POST' \
  'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```
**Response:** ✅ Success (2nd request)

#### Step 4: Wait 31 Seconds and Send 3rd Time
```bash
sleep 31

curl -X 'POST' \
  'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```
**Response:** ✅ Success (3rd request - LAST allowed)

#### Step 5: Wait 31 Seconds and Try 4th Time (Should Fail)
```bash
sleep 31

curl -X 'POST' \
  'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```

**Expected Response (429 Too Many Requests):**
```json
{
  "success": false,
  "message": "Failed to generate OTP",
  "details": "Too many OTP requests. Please try again later.",
  "statusCode": 429
}
```

**Rate Limit Summary:**
- **Limit:** 3 OTP requests per 15 minutes
- **Cooldown:** 30 seconds between each request
- **Window:** 900 seconds (15 minutes)

---

### Test 5: Rate Limiting - Failed Verifications

#### Scenario: 5 Failed Verification Attempts

Repeat this 5 times with wrong OTP:

```bash
# Request OTP
curl -X 'POST' \
  'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'

# Try wrong OTP 3 times (will invalidate this OTP)
curl -X 'POST' \
  'http://localhost:5600/v1/sms/verify-otp' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948", "otp": "999999"}'

# Wait 31 seconds and repeat...
```

After 5 failed verifications in 1 hour:

**Expected Response (429):**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Too many failed verification attempts. Account temporarily blocked.",
  "canResend": false,
  "statusCode": 429
}
```

**What Happens:**
- Phone number is blocked for 1 hour
- Cannot send or verify OTP during this time
- Protects against brute force attacks

---

### Test 6: Resend OTP

#### Step 1: Send OTP
```bash
curl -X 'POST' \
  'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```

#### Step 2: Resend OTP (after 30 seconds)
```bash
sleep 31

curl -X 'POST' \
  'http://localhost:5600/v1/sms/resend-otp' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "OTP resent successfully",
  "data": {
    "phoneNumber": "+918825727948",
    "expiresIn": 60,
    "canResendAfter": 30,
    "sentAt": "2024-10-15T12:05:00.000Z"
  },
  "errors": null
}
```

**What Happens:**
- Old OTP is deleted
- New OTP is generated
- New SMS is sent
- New 60-second timer starts

---

## 🔍 Redis Debugging

### View Redis Keys
```bash
redis-cli

# List all OTP-related keys
KEYS otp:*
KEYS rate:*
KEYS blocked:*
KEYS resend:*

# Get specific OTP data
GET otp:+918825727948

# Check TTL (Time To Live)
TTL otp:+918825727948

# View rate limit counter
GET rate:send:+918825727948

# Check if blocked
GET blocked:+918825727948

# Exit
EXIT
```

### Clear All OTP Data (For Testing)
```bash
redis-cli

# Delete all keys
FLUSHALL

# Or delete specific phone number
DEL otp:+918825727948
DEL rate:send:+918825727948
DEL rate:verify:+918825727948
DEL blocked:+918825727948
DEL resend:cooldown:+918825727948
```

---

## 📱 Testing with Different Phone Numbers

### Indian Numbers
```bash
# With country code
curl -X 'POST' 'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "+918825727948"}'

# Without country code (auto-adds +91)
curl -X 'POST' 'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```

### International Numbers
```bash
# US number
curl -X 'POST' 'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "+12025551234"}'

# UK number
curl -X 'POST' 'http://localhost:5600/v1/sms/send-otp-with-storage' \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "+447700900123"}'
```

---

## 🧪 Automated Test Script

Create `test_otp_flow.sh`:

```bash
#!/bin/bash

PHONE="8825727948"
BASE_URL="http://localhost:5600/v1/sms"

echo "🧪 Testing OTP Flow"
echo "==================="

echo "\n1️⃣  Sending OTP..."
RESPONSE=$(curl -s -X 'POST' "$BASE_URL/send-otp-with-storage" \
  -H 'Content-Type: application/json' \
  -d "{\"phoneNumber\": \"$PHONE\"}")

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo "✅ OTP sent successfully"
else
  echo "❌ Failed to send OTP"
  exit 1
fi

echo "\n2️⃣  Waiting for OTP (check your phone)..."
read -p "Enter OTP: " OTP

echo "\n3️⃣  Verifying OTP..."
VERIFY_RESPONSE=$(curl -s -X 'POST' "$BASE_URL/verify-otp" \
  -H 'Content-Type: application/json' \
  -d "{\"phoneNumber\": \"$PHONE\", \"otp\": \"$OTP\"}")

echo "$VERIFY_RESPONSE" | jq '.'

if echo "$VERIFY_RESPONSE" | jq -e '.data.verified == true' > /dev/null; then
  echo "✅ OTP verified successfully"
else
  echo "❌ OTP verification failed"
  exit 1
fi

echo "\n🎉 All tests passed!"
```

Run it:
```bash
chmod +x test_otp_flow.sh
./test_otp_flow.sh
```

---

## 📊 Monitoring & Logging

### View Logs
```bash
# Watch server logs
npm run dev

# Logs will show:
# - OTP generation (phone masked)
# - SMS sending
# - Verification attempts
# - Rate limiting
# - Blocks/errors
```

### Example Log Output
```
{"level":"info","msg":"OTP send request with storage received","phoneNumber":"+91****7948"}
{"level":"info","msg":"OTP generated and stored","phoneNumber":"+91****7948","expiresIn":60}
{"level":"info","msg":"OTP sent successfully via Twilio with Redis storage","phoneNumber":"+918825727948","messageId":"SM..."}
{"level":"info","msg":"OTP verification request received","phoneNumber":"+918825727948"}
{"level":"info","msg":"OTP verified successfully","phoneNumber":"+91****7948"}
```

---

## ⚠️ Troubleshooting

### Issue: Redis Connection Failed
```
Error: Redis client is not connected
```

**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# Should return: PONG

# If not running, start Redis
redis-server
```

### Issue: Twilio Authentication Failed
```
Error: Failed to send SMS via Twilio
Details: Authenticate
```

**Solution:**
- Update Twilio credentials in `src/services/twilioSms.service.ts`
- Get valid credentials from https://console.twilio.com/

### Issue: Phone Number Not Receiving SMS (Trial Account)
```
Error: Permission to send an SMS has not been enabled
```

**Solution:**
- Verify recipient phone number at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
- Or upgrade to paid Twilio account

### Issue: OTP Always Expired
```
Error: OTP not found or has expired
```

**Solution:**
- Check Redis TTL: `redis-cli TTL otp:+918825727948`
- Verify OTP_EXPIRY_SECONDS in `.env` (default: 60)
- Make sure server time is correct

---

## 🎯 Production Checklist

Before deploying to production:

- [  ] Valid Twilio credentials configured
- [ ] Redis configured with persistence (RDB/AOF)
- [ ] REDIS_URL environment variable set
- [ ] Rate limits adjusted for production traffic
- [ ] Monitoring/alerts configured
- [ ] Phone number validation tested
- [ ] Security review completed
- [ ] Load testing performed
- [ ] Backup/failover Redis instance
- [ ] SSL/TLS enabled for Redis connection

---

## 📚 API Reference

### POST `/v1/sms/send-otp-with-storage`
Send OTP with Redis storage

**Request:**
```json
{
  "phoneNumber": "8825727948"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phoneNumber": "+918825727948",
    "expiresIn": 60,
    "canResendAfter": 30,
    "sentAt": "2024-10-15T12:00:00.000Z"
  }
}
```

### POST `/v1/sms/verify-otp`
Verify OTP code

**Request:**
```json
{
  "phoneNumber": "8825727948",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "verified": true,
    "phoneNumber": "+918825727948"
  }
}
```

### POST `/v1/sms/resend-otp`
Resend OTP

**Request:**
```json
{
  "phoneNumber": "8825727948"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP resent successfully",
  "data": {
    "phoneNumber": "+918825727948",
    "expiresIn": 60,
    "canResendAfter": 30,
    "sentAt": "2024-10-15T12:05:00.000Z"
  }
}
```

---

## 🔗 Related Documentation

- [OTP Implementation Plan](./OTP_VERIFICATION_IMPLEMENTATION_PLAN.md)
- [Twilio API Documentation](https://www.twilio.com/docs/sms/api)
- [Redis Documentation](https://redis.io/docs/)

---

**Happy Testing! 🎉**

