# Firebase SMS OTP Authentication API

## Overview

A standalone Firebase SMS authentication API with OTP (One-Time Password) functionality. This implementation:

- ✅ **No Database Dependency** - Uses in-memory storage
- ✅ **Firebase Integration** - Uses Firebase Admin SDK with your service account
- ✅ **Fully Independent** - Works standalone without any other API dependencies
- ✅ **Production Ready** - Includes security features like OTP expiry and attempt limits
- ✅ **Complete Swagger Documentation** - Documented in the API docs

## Features

- **Send OTP**: Generate and send 6-digit OTP to any phone number
- **Verify OTP**: Verify OTP and receive Firebase custom authentication token
- **Statistics**: Monitor active OTPs and configuration
- **Security**: 5-minute OTP expiry, max 3 verification attempts
- **Phone Format**: Auto-formats phone numbers with country code (+91 for India)

## API Endpoints

### 1. Send OTP
**POST** `/v1/firebase-sms/send-otp`

Send an OTP to a phone number.

**Request Body:**
```json
{
  "phoneNumber": "8825727948"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully via Firebase",
  "data": {
    "phoneNumber": "+918825727948",
    "otp": "123456",
    "expiresIn": 5,
    "message": "OTP has been generated. In production, this will be sent via SMS.",
    "sentAt": "2025-10-13T10:30:00.000Z"
  },
  "errors": null
}
```

**Note:** In production, the `otp` field should be removed from the response and only sent via SMS.

---

### 2. Verify OTP
**POST** `/v1/firebase-sms/verify-otp`

Verify OTP and receive Firebase custom token.

**Request Body:**
```json
{
  "phoneNumber": "8825727948",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "phoneNumber": "+918825727948",
    "customToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "message": "Use this custom token to authenticate with Firebase",
    "verifiedAt": "2025-10-13T10:35:00.000Z"
  },
  "errors": null
}
```

**Response (400) - Invalid OTP:**
```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Invalid OTP. 2 attempts remaining.",
  "statusCode": 400
}
```

---

### 3. Get Statistics
**GET** `/v1/firebase-sms/stats`

Get current OTP statistics.

**Response (200):**
```json
{
  "success": true,
  "message": "Firebase OTP statistics",
  "data": {
    "totalActiveOtps": 5,
    "otpExpiryMinutes": 5,
    "maxAttempts": 3
  },
  "errors": null
}
```

## Configuration

The service uses the following configuration (defined in service file):

- **OTP Length**: 6 digits
- **OTP Expiry**: 5 minutes
- **Max Attempts**: 3 attempts per OTP
- **Default Country Code**: +91 (India)
- **Firebase Credentials**: `docblitz-437213-firebase-adminsdk-f22m7-ca8f4ecf76.json`

## Security Features

### 1. OTP Expiry
- OTPs expire after 5 minutes
- Expired OTPs are automatically cleaned up

### 2. Attempt Limiting
- Maximum 3 verification attempts per OTP
- After 3 failed attempts, OTP is invalidated

### 3. One-Time Use
- OTP is immediately deleted after successful verification
- Cannot be reused

## Phone Number Format

The service automatically formats phone numbers:

| Input | Output |
|-------|--------|
| `8825727948` | `+918825727948` |
| `08825727948` | `+918825727948` |
| `918825727948` | `+918825727948` |

## Testing

### Using the Test Script

Run the comprehensive test suite:

```bash
node test_firebase_sms_otp.cjs
```

**With custom phone number:**
```bash
TEST_PHONE_NUMBER=9876543210 node test_firebase_sms_otp.cjs
```

**With custom API URL:**
```bash
API_BASE_URL=https://your-api.com node test_firebase_sms_otp.cjs
```

### Using cURL

**Send OTP:**
```bash
curl -X POST http://localhost:5600/v1/firebase-sms/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "8825727948"}'
```

**Verify OTP:**
```bash
curl -X POST http://localhost:5600/v1/firebase-sms/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "8825727948", "otp": "123456"}'
```

**Get Statistics:**
```bash
curl http://localhost:5600/v1/firebase-sms/stats
```

### Using Swagger UI

1. Start your server: `npm run dev`
2. Open browser: `http://localhost:5600/docs`
3. Navigate to **Firebase SMS** section
4. Test all endpoints interactively

## Integration Guide

### 1. Send OTP to User

```javascript
const response = await fetch('http://localhost:5600/v1/firebase-sms/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phoneNumber: '8825727948' })
});

const data = await response.json();
if (data.success) {
  console.log('OTP sent:', data.data.otp); // Remove in production
}
```

### 2. Verify OTP

```javascript
const response = await fetch('http://localhost:5600/v1/firebase-sms/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    phoneNumber: '8825727948',
    otp: '123456'
  })
});

const data = await response.json();
if (data.success) {
  const customToken = data.data.customToken;
  // Use this token to sign in to Firebase on the client
}
```

### 3. Use Custom Token (Client-side)

```javascript
import { getAuth, signInWithCustomToken } from 'firebase/auth';

const auth = getAuth();
signInWithCustomToken(auth, customToken)
  .then((userCredential) => {
    // User is now authenticated with Firebase
    const user = userCredential.user;
    console.log('Authenticated user:', user.uid);
  })
  .catch((error) => {
    console.error('Authentication error:', error);
  });
```

## Production Deployment

### 1. Remove OTP from Response

In `src/services/firebaseSms.service.ts`, modify the `sendOtp` method to NOT return the OTP:

```typescript
return {
  success: true,
  // otp, // Remove this line in production
  phoneNumber: formattedNumber,
  expiresIn: OTP_EXPIRY_MINUTES,
};
```

### 2. Integrate SMS Gateway

Add your SMS provider (Twilio, Infobip, etc.) in the `sendOtp` method:

```typescript
// After generating OTP, send it via SMS
const message = `Your verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`;

// Example with Twilio
await twilioClient.messages.create({
  body: message,
  to: formattedNumber,
  from: process.env.TWILIO_PHONE_NUMBER
});
```

### 3. Environment Variables

Add to your `.env`:

```env
# Firebase configuration is already in the JSON file
# Add SMS provider credentials if needed
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_phone_number
```

### 4. Security Considerations

- [ ] Enable rate limiting per phone number
- [ ] Add IP-based rate limiting
- [ ] Monitor for abuse patterns
- [ ] Add CAPTCHA for web requests
- [ ] Implement phone number verification
- [ ] Log all OTP activities
- [ ] Set up alerts for unusual patterns

## Error Handling

The API uses standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "details": "Detailed error message",
  "statusCode": 400
}
```

### Common Error Codes

- **400**: Invalid request (bad phone number, invalid OTP format)
- **500**: Server error (Firebase initialization failure, etc.)

### Common Error Messages

- "OTP not found or expired. Please request a new OTP."
- "OTP has expired. Please request a new OTP."
- "Maximum verification attempts exceeded. Please request a new OTP."
- "Invalid OTP. X attempts remaining."

## Files Created

```
src/
├── schemas/
│   └── firebaseSms.schema.ts      # Validation schemas
├── services/
│   └── firebaseSms.service.ts     # Core OTP logic
├── controllers/
│   └── firebaseSms.controller.ts  # Request handlers
└── routes/
    ├── firebaseSms.route.ts       # Route definitions
    └── index.ts                   # Updated with new routes

docblitz-437213-firebase-adminsdk-f22m7-ca8f4ecf76.json  # Firebase credentials
test_firebase_sms_otp.cjs          # Test script
FIREBASE_SMS_OTP_README.md         # This file
```

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ POST /send-otp
       ▼
┌─────────────────┐
│  Firebase SMS   │
│    Route        │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Firebase SMS   │
│   Controller    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐     ┌──────────────┐
│  Firebase SMS   │────▶│  Firebase    │
│    Service      │     │  Admin SDK   │
└──────┬──────────┘     └──────────────┘
       │
       ▼
┌─────────────────┐
│   In-Memory     │
│   OTP Store     │
└─────────────────┘
```

## Support

For issues or questions:
1. Check the Swagger documentation at `/docs`
2. Run the test script to verify setup
3. Check server logs for detailed error messages

## License

This implementation is part of the asset-management-backend project.

