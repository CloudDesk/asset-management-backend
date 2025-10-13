# 📱 SMS API Quick Reference

## Endpoint
```
POST http://localhost:5600/v1/sms/send-otp
```

## Request
```json
{
  "phoneNumber": "8825727948",
  "message": "Your OTP is 123456"
}
```

## Response
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "data": {
    "phoneNumber": "8825727948",
    "messageId": "4603370296827950989956",
    "status": "PENDING_ACCEPTED",
    "sentAt": "2025-10-13T06:30:29.890Z"
  }
}
```

## Test Command
```bash
node test_sms_otp.cjs
```

## Swagger Docs
```
http://localhost:5600/docs
```

## Files Created
- ✅ `src/routes/sms.route.ts`
- ✅ `src/controllers/sms.controller.ts`
- ✅ `src/services/sms.service.ts`
- ✅ `src/schemas/sms.schema.ts`
- ✅ `test_sms_otp.cjs`

## Test Results
- ✅ Message 1: ID `4603370296827950989956` - PENDING_ACCEPTED
- ✅ Message 2: ID `4603370636597950412183` - PENDING_ACCEPTED

## Status
**WORKING & TESTED** ✅

