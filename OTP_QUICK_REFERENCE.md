# 🚀 OTP Verification - Quick Reference Card

## 📞 API Endpoints

### 1. Send OTP
```bash
curl -X POST http://localhost:5600/v1/sms/send-otp-with-storage \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```

### 2. Verify OTP
```bash
curl -X POST http://localhost:5600/v1/sms/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948", "otp": "123456"}'
```

### 3. Resend OTP
```bash
curl -X POST http://localhost:5600/v1/sms/resend-otp \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```

---

## ⚙️ Configuration

### Environment Variables (.env)
```bash
REDIS_URL=redis://localhost:6379
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Defaults
- OTP Length: 6 digits
- Expiry: 60 seconds
- Max Attempts: 3 per OTP
- Send Rate Limit: 3 per 15 minutes
- Verify Rate Limit: 5 failures per hour

---

## 🔍 Redis Commands

```bash
# View OTP
redis-cli GET otp:+918825727948

# Check TTL
redis-cli TTL otp:+918825727948

# View Rate Limits
redis-cli GET rate:send:+918825727948
redis-cli GET rate:verify:+918825727948

# Check Block Status
redis-cli GET blocked:+918825727948

# Clear All (Testing)
redis-cli FLUSHALL

# Clear Specific Phone
redis-cli DEL otp:+918825727948 rate:send:+918825727948 rate:verify:+918825727948 blocked:+918825727948
```

---

## 📊 Rate Limits

| Action | Limit | Window | Result |
|--------|-------|--------|--------|
| Send OTP | 3 | 15 min | 429 error |
| Resend | 1 | 30 sec | Cooldown |
| Verify (fail) | 3 | Per OTP | Invalidate |
| Total Fails | 5 | 1 hour | Block |

---

## ⚠️ Quick Troubleshooting

### Redis Not Connected
```bash
redis-server
```

### Twilio Auth Failed
Update credentials in `src/services/twilioSms.service.ts`

### Phone Not Receiving SMS
Verify number at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified

### Clear Rate Limits (Testing)
```bash
redis-cli FLUSHALL
```

---

## 📝 Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid OTP / Expired |
| 429 | Rate Limited |
| 500 | Server Error |

---

## 🔗 Documentation

- [Implementation Plan](./OTP_VERIFICATION_IMPLEMENTATION_PLAN.md)
- [Testing Guide](./OTP_TESTING_GUIDE.md)
- [Full Summary](./OTP_IMPLEMENTATION_SUMMARY.md)

