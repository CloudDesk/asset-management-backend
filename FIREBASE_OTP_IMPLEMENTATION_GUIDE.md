# Firebase OTP Implementation Guide

## 📋 Overview
Complete guide to implement Firebase Phone OTP authentication for mobile login, replacing the hardcoded 1234 OTP system.

## 🔑 How Firebase Phone OTP Works

### Important Concept:
**Firebase Phone OTP is a CLIENT-SIDE operation, not server-side!**

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Client     │         │   Firebase   │         │   Backend    │
│   (Mobile)   │         │   Auth       │         │   Server     │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                        │
       │  1. Send Phone Number  │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │  2. Firebase sends OTP │                        │
       │<───────────────────────│                        │
       │      (SMS to phone)    │                        │
       │                        │                        │
       │  3. User enters OTP    │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │  4. Firebase verifies  │                        │
       │     and returns        │                        │
       │     ID Token           │                        │
       │<───────────────────────│                        │
       │                        │                        │
       │  5. Send ID Token to Backend                    │
       │────────────────────────────────────────────────>│
       │                        │                        │
       │                        │  6. Backend verifies   │
       │                        │<───────────────────────│
       │                        │     ID token with      │
       │                        │     Firebase Admin     │
       │                        │                        │
       │  7. Create/Get User & Return Session Token      │
       │<────────────────────────────────────────────────│
```

## 🔧 Step-by-Step Implementation

### Step 1: Configure Firebase Environment Variables

Add to your `.env` file:

```bash
# Firebase Admin SDK
FIREBASE_PROJECT_ID=docblitz-437213
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-f22m7@docblitz-437213.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCKbqcbej0iPrwQ\nANxjEsq9XJfppz5+TNsEhkDIMxcXmhBfTmAB4kMBSiTYSD7OcYp+iuvSl1VE10fL\noFF6fKh9qnSbrNldEIjd2LO42yoGFFCEASakm/vfINUY4uqJnlJM3xLUqjtwkOM6\n8x38Vby3iBsXZTNTkcvFQwEzNgfLEoEdefqIoBffBWe9ggUINR2zLN1obq/q5Ndi\n4ZdWvPbk/gJJp5fLd5lIYVZin003ZhXA4zDtcPFwjCNhKgL7FOXIwzs/vHfSIQOX\nzdfY2pwaRcX6DANKzmM5cwdaj5kfrNsJMpQf1w0Hy7gYDJj+pcCaSEqySpNb94K0\nKuXIRr3rAgMBAAECggEARBlGBHrgOwnwetDpmaVDbd7wbkVTNU96iKHAmZukdvxX\npILKMPMM8kP2lx0HJIhvUGvnsYu3qytaSr39hwtu2Y7yWSixLxp0semqE7xg0mfI\n6f8k8uI3B98/ZUQvi26CXwV33n01y1zDI5s4e4rz0LdYWGx00N4Oh2Y8X2RrdgZV\njJFhE/2w445l4kueIs9Fhtnjc3GyK4CsvfGo39uvOIavsYewsBPkunfb4SKX5p6h\nPOKjZnh3KSVGDeT3Su6VqPfmmjeJwIJC20Dr1yYhkxH9u5oGKYA7mg0HEoPFflrW\nTELUnQJz7/Q5e/9In+UTNsonDVEgtLS0ofeRYiFh+QKBgQDBYluyT0FBgcIZThB/\nQFHwBLiZx7mMkWxPDeOGDUgY7Kj53IgvWn0JyA4hTHGTHBtMAGlpyTmOUze2JFf3\nPXBycN9pAq76iaXc1KylW4GSooV2NRHEnoFew0ZCVxb+QLGOBwtdBG+ADDciGdf9\nOgkyB4l6UGPRZ7DEv2hK6lohEwKBgQC3QVGGgs6CsUuyMfSkTAf47WRMGQOT/irc\nI8ocHygY1fZO4JNVp+ETq0+EJqO/VG6nHnMIuco7KCAh64FC0Dx300o01epdUWf5\n27ISegdj6MXV+OcgNHNgpDWVJ8jaMCjQoGVT0EAdQnj4FsqVw3Zp3XOI4LoMTprg\nqruNCnDiyQKBgQCM5KByNRQSKfvEe//A9pe8C3SDdeRV6c3Dexb9n8ebgTFLecUu\n2vqmmb7Ru+QzjhLFOLeUfysT6sV4StpcI8M9XccntvDNUGQrlDeE8jphH0+lY9zi\nJ6mR5SvXQaRa8b9q/u7kgkrKPBwfGD0pHZN9g8hB+TgAZU+AyQOvMTchSQKBgB4Z\n55dNszg6gTGTDRlTt9eGvvvU/AZ6MHYalt9Jqt9xfdT1BJ6ERe9iK1yMsEcESmy/\nDqw3QGW5MJYBxijAZb5VAZJuNOIBNjAPi0+HpeEeYijEisp6cx1Du911PIPCd2HV\nhu9efLmRqqctrzcsdS3sh0bLiyPsYXpX8Ri4x1QpAoGBALos/uLbzP6ddjSPq7FR\ngZ7ry2rNqnjncLy0bvBgh3Skv7gtDEJNkh+SEQVCsqwWIRN8VOoGJJOg+CaBrJsT\nV7sXE0G6cdNyq1GpLmm4wOYrwY+QEwfh4vskS8AkJtsqRTygRiuSV83UuVbzoLhS\nbGd+D7cCxLkmMG5C5iJxRBFG\n-----END PRIVATE KEY-----\n"
```

**Note:** Copy the entire private key from `docblitz-437213-firebase-adminsdk-f22m7-ca8f4ecf76.json` and keep the `\n` characters.

### Step 2: Add Firebase Config to env.ts

Update `src/config/env.ts` to include Firebase variables:

```typescript
export const env = {
  // ... existing variables
  
  // Firebase Admin SDK
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
};
```

### Step 3: Update mobile-auth Route to Use Firebase

Replace the hardcoded OTP system with Firebase ID token verification:

```typescript
// src/routes/mobile-auth.route.ts

import { FirebaseOTPService } from '../services/firebase-otp.service.js';

export async function mobileAuthRoutes(fastify: FastifyInstance) {
  const usersService = new UsersService();
  const firebaseOTPService = new FirebaseOTPService();
  
  // NEW: Firebase OTP Login - Step 1: Verify Firebase ID Token
  fastify.post('/firebase-login', {
    schema: {
      description: 'Login with Firebase OTP - Step 1: Verify Firebase ID token and create/get user',
      tags: ['Mobile Authentication'],
      body: {
        type: 'object',
        required: ['idToken'],
        properties: {
          idToken: {
            type: 'string',
            description: 'Firebase ID token obtained after OTP verification on client side',
            minLength: 1
          }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    usermobilenumber: { type: 'number' },
                    firstname: { type: 'string' },
                    lastname: { type: 'string' },
                    useremail: { type: 'string' }
                  },
                  additionalProperties: true
                },
                token: { type: 'string' },
                isNewUser: { type: 'boolean' }
              }
            },
            message: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { idToken } = request.body as { idToken: string };
    
    try {
      // 1. Verify Firebase ID token
      const decodedToken = await firebaseOTPService.verifyFirebaseToken(idToken);
      
      // 2. Extract phone number from Firebase token
      const firebasePhoneNumber = decodedToken.phone_number;
      
      if (!firebasePhoneNumber) {
        return reply.code(400).send({
          success: false,
          message: 'Phone number not found in Firebase token',
          details: 'Firebase token must contain a valid phone number',
          statusCode: 400
        });
      }
      
      // 3. Convert Firebase phone number (+919876543210) to number (9876543210)
      const phoneNumber = parseInt(firebasePhoneNumber.replace(/^\+91/, '').replace(/^\+/, ''));
      
      logger.info({ 
        firebaseUid: decodedToken.uid,
        phoneNumber,
        ip: request.ip 
      }, 'Firebase token verified, processing user login');
      
      // 4. Check if user exists
      let user = await usersService.findByMobileNumber(phoneNumber);
      let isNewUser = false;
      
      if (!user) {
        // Create new user
        logger.info({ phoneNumber }, 'Creating new user from Firebase authentication');
        
        const newUserData = {
          usermobilenumber: phoneNumber,
          firstname: 'User',
          useremail: decodedToken.email || undefined,
          createddate: Date.now(),
          modifieddate: Date.now()
        };
        
        user = await usersService.create(newUserData);
        isNewUser = true;
        
        logger.info({ 
          userId: user.id,
          phoneNumber 
        }, 'New user created from Firebase authentication');
      }
      
      // 5. Generate session token
      const sessionToken = await usersService.generateSessionToken(user);
      
      // 6. Sanitize user data
      const sanitizedUser = {
        id: user.id,
        usermobilenumber: user.usermobilenumber,
        firstname: user.firstname,
        lastname: user.lastname,
        useremail: user.useremail,
        gender: user.gender,
        gstnumber: user.gstnumber,
        isbusinessuser: user.isbusinessuser
      };
      
      logger.info({ 
        userId: user.id,
        phoneNumber,
        isNewUser,
        ip: request.ip 
      }, 'User authenticated successfully via Firebase OTP');
      
      const message = isNewUser 
        ? 'New account created and authenticated successfully' 
        : 'Authentication successful';
      
      const response = createSuccessResponse(message, {
        user: sanitizedUser,
        token: sessionToken,
        isNewUser
      });
      
      return reply.code(200).send(response);
      
    } catch (error: any) {
      logger.error({ error, ip: request.ip }, 'Error during Firebase authentication');
      
      return reply.code(401).send({
        success: false,
        message: 'Authentication failed',
        details: error.message || 'Invalid or expired Firebase token',
        statusCode: 401
      });
    }
  }));
  
  // Keep existing routes for backward compatibility
  // ...existing /request-otp and /verify-otp routes
}
```

## 📱 Client-Side Implementation (Mobile App)

### React Native / Expo Example:

```typescript
import auth from '@react-native-firebase/auth';

// Step 1: Send OTP
async function sendOTP(phoneNumber: string) {
  try {
    // Phone number must be in E.164 format (+919876543210)
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    
    // Save confirmation for verification
    return confirmation;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
}

// Step 2: Verify OTP
async function verifyOTP(confirmation, otpCode: string) {
  try {
    // Verify the OTP code
    const userCredential = await confirmation.confirm(otpCode);
    
    // Get Firebase ID token
    const idToken = await userCredential.user.getIdToken();
    
    // Step 3: Send ID token to backend
    const response = await fetch('http://your-backend-url/v1/mobile-auth/firebase-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: idToken
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Save session token
      await AsyncStorage.setItem('session_token', result.data.token);
      
      // Navigate to home screen
      return result.data;
    } else {
      throw new Error(result.message);
    }
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
}

// Usage:
async function loginWithOTP() {
  const phoneNumber = '+919876543210'; // User input
  
  try {
    // Send OTP
    const confirmation = await sendOTP(phoneNumber);
    
    // Show OTP input screen
    const otpCode = '123456'; // User enters OTP
    
    // Verify OTP and login
    const userData = await verifyOTP(confirmation, otpCode);
    
    console.log('Logged in:', userData);
  } catch (error) {
    console.error('Login failed:', error);
  }
}
```

## 🔐 How OTP-to-Mobile Number Mapping Works

### The Magic: Firebase Manages It!

**You don't need to manage OTP-to-mobile-number mapping manually!**

Here's how Firebase handles it:

1. **Client sends phone number to Firebase** → Firebase stores it internally
2. **Firebase sends OTP to that phone number** → OTP is linked to that phone number in Firebase's system
3. **User enters OTP** → Client sends OTP to Firebase
4. **Firebase verifies OTP** → Checks if OTP matches the phone number
5. **Firebase returns ID Token** → ID Token contains:
   ```json
   {
     "uid": "firebase-user-id",
     "phone_number": "+919876543210",
     "iat": 1234567890,
     "exp": 1234571490,
     // ...other claims
   }
   ```

6. **Your backend verifies ID Token** → Extracts phone number from token
7. **Your backend creates/finds user** → Uses phone number from token

### Complete Flow with OTP Mapping:

```
┌─────────────────┐
│ Client          │
│ Phone: +91-9876 │
└────────┬────────┘
         │
         │ 1. auth().signInWithPhoneNumber('+919876543210')
         ▼
┌─────────────────┐
│ Firebase Auth   │
│ Maps: +91-9876  │
│   → OTP: 123456 │  ← Firebase internally stores this mapping
└────────┬────────┘
         │
         │ 2. SMS: OTP is 123456
         ▼
┌─────────────────┐
│ User's Phone    │
│ Receives: 123456│
└────────┬────────┘
         │
         │ 3. User enters: 123456
         ▼
┌─────────────────┐
│ Client          │
│ confirmation.   │
│ confirm('123456')│
└────────┬────────┘
         │
         │ 4. Sends OTP to Firebase
         ▼
┌─────────────────┐
│ Firebase Auth   │
│ Verifies:       │
│ OTP matches     │
│ phone +91-9876? │
│ ✅ Yes!         │
└────────┬────────┘
         │
         │ 5. Returns ID Token with phone_number claim
         ▼
┌─────────────────┐
│ Client          │
│ getIdToken()    │
└────────┬────────┘
         │
         │ 6. POST /v1/mobile-auth/firebase-login
         │    { idToken: "eyJhbGc..." }
         ▼
┌─────────────────┐
│ Your Backend    │
│ Verifies token  │
│ Extracts phone: │
│ +919876543210   │
│ Creates/Gets    │
│ User            │
└─────────────────┘
```

## 🎯 Backend API Endpoints

### Existing Firebase Endpoints (Already Implemented):

1. **POST /v1/firebase-otp/send** - Acknowledge OTP send (optional)
2. **POST /v1/firebase-otp/verify** - Verify Firebase ID token (optional)
3. **POST /v1/firebase-otp/session** - Create session from Firebase token
4. **POST /v1/firebase-otp/logout** - Logout

### New Mobile-Auth Endpoint (To Implement):

5. **POST /v1/mobile-auth/firebase-login** - Complete authentication with user creation

## 📋 Implementation Checklist

### Backend Setup:
- [ ] Add Firebase environment variables to `.env`
- [ ] Update `src/config/env.ts` with Firebase config
- [ ] Restart server to load Firebase Admin SDK
- [ ] Add `/mobile-auth/firebase-login` endpoint
- [ ] Test endpoint with mock Firebase ID token

### Mobile App Setup:
- [ ] Install Firebase SDK (`@react-native-firebase/app`, `@react-native-firebase/auth`)
- [ ] Configure Firebase project in app (google-services.json / GoogleService-Info.plist)
- [ ] Enable Phone Auth in Firebase Console
- [ ] Implement OTP send function
- [ ] Implement OTP verify function
- [ ] Implement backend authentication call
- [ ] Test end-to-end flow

### Firebase Console Setup:
- [x] Authentication → Sign-in method → Phone enabled
- [ ] Add authorized domains for production
- [ ] Configure reCAPTCHA (for web)
- [ ] Monitor usage quotas

## 🔍 Debugging & Testing

### Test Firebase ID Token Verification:

```bash
# Get a Firebase ID token from mobile app, then test:
curl -X POST http://localhost:5600/v1/mobile-auth/firebase-login \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
  }'
```

### Check Firebase Admin Initialization:

```bash
# Server logs should show:
# "Firebase Admin initialized successfully"
```

## 🚨 Common Issues & Solutions

### Issue 1: "Firebase credentials not provided"
**Solution:** Add all three Firebase env variables and restart server

### Issue 2: "Invalid Firebase token"
**Solution:** 
- Check token is fresh (not expired)
- Verify Firebase project ID matches
- Ensure phone auth is enabled in Firebase Console

### Issue 3: "Phone number not found in token"
**Solution:** 
- Ensure user completed OTP verification on client
- Check ID token was obtained AFTER OTP confirmation

### Issue 4: Phone number format mismatch
**Solution:** 
- Firebase uses E.164 format (+919876543210)
- Backend stores as number (9876543210)
- Convert properly when extracting from token

## 📊 Comparison: Old vs New System

| Feature | Old System (Hardcoded) | New System (Firebase) |
|---------|------------------------|----------------------|
| OTP Generation | Server (1234 hardcoded) | Firebase (random 6-digit) |
| OTP Delivery | None (logs only) | Firebase (real SMS) |
| OTP Storage | In-memory Map | Firebase manages |
| OTP Verification | Server checks Map | Firebase verifies |
| Security | ❌ Low (static OTP) | ✅ High (random + expiry) |
| SMS Cost | ✅ Free | ⚠️ Firebase SMS charges |
| Scalability | ❌ Limited | ✅ Highly scalable |
| Multi-device | ❌ Not supported | ✅ Supported |

## 🎉 Advantages of Firebase OTP

1. **Real SMS Delivery** - Users receive actual OTP messages
2. **Security** - Random OTPs with automatic expiry
3. **Rate Limiting** - Firebase handles abuse prevention
4. **Global Coverage** - Works in most countries
5. **Scalability** - Firebase handles millions of requests
6. **Multi-platform** - Works on iOS, Android, Web
7. **No OTP Storage** - Firebase manages everything
8. **Token-based** - Secure ID tokens with claims

## 📚 Additional Resources

- [Firebase Phone Auth Documentation](https://firebase.google.com/docs/auth/android/phone-auth)
- [Firebase Admin SDK Reference](https://firebase.google.com/docs/reference/admin/node)
- [E.164 Phone Number Format](https://www.twilio.com/docs/glossary/what-e164)

---

## 🚀 Quick Start Command

```bash
# 1. Add Firebase env variables to .env
# 2. Restart server
npm run dev

# 3. Test health check
curl http://localhost:5600/health

# 4. Server should log: "Firebase Admin initialized successfully"
```

