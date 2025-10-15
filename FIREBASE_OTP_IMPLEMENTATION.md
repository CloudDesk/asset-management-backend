# Firebase Phone OTP Authentication Implementation

## Overview

This implementation adds Firebase Phone (SMS) OTP authentication to your Fastify backend. Users can sign in using their phone number via OTP, and receive a JWT-based session for accessing protected resources.

## Architecture

### Components

1. **Firebase Admin Plugin** (`src/plugins/firebase.ts`)
   - Initializes Firebase Admin SDK
   - Decorates Fastify instance with Firebase admin
   - Handles graceful shutdown

2. **JWT Service** (`src/utils/jwt.ts`)
   - Creates and verifies app session tokens
   - HMAC-SHA256 based JWT implementation
   - 24-hour token expiry (configurable)

3. **Firebase OTP Service** (`src/services/firebase-otp.service.ts`)
   - Validates phone numbers (E.164 format)
   - Verifies Firebase ID tokens
   - Creates app sessions
   - Rate limiting for security

4. **Firebase OTP Controller** (`src/controllers/firebase-otp.controller.ts`)
   - Handles route logic
   - Manages cookies for web clients
   - Implements rate limiting

5. **Firebase OTP Routes** (`src/routes/firebase-otp.route.ts`)
   - Defines API endpoints
   - Applies schemas for validation

## Environment Variables

Add these to your `.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"

# JWT Secret for app sessions
APP_JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Environment
NODE_ENV=development
```

### Firebase Setup

1. **Enable Phone Authentication**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Navigate to Authentication → Sign-in method
   - Enable "Phone" provider

2. **Generate Service Account**
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
   - Extract values for environment variables:
     - `project_id` → `FIREBASE_PROJECT_ID`
     - `client_email` → `FIREBASE_CLIENT_EMAIL`
     - `private_key` → `FIREBASE_PRIVATE_KEY`

3. **Configure Authorized Domains**
   - Go to Authentication → Settings → Authorized domains
   - Add your web/app domains (e.g., `localhost`, `yourdomain.com`)

## API Endpoints

All endpoints are prefixed with `/v1/firebase-otp`

### 1. POST `/v1/firebase-otp/send`

**Purpose:** Acknowledge OTP send request (actual sending happens on client-side)

**Request:**
```json
{
  "phoneNumber": "+919876543210"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP send request acknowledged",
  "data": {
    "status": "otp_sent",
    "phoneNumber": "+919876543210"
  }
}
```

**Rate Limit:** 10 attempts per 15 minutes per IP/phone combination

---

### 2. POST `/v1/firebase-otp/verify` (Optional)

**Purpose:** Verify Firebase ID token validity

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Firebase token verified",
  "data": {
    "status": "firebase_verified",
    "uid": "firebase-user-id",
    "phone": "+919876543210"
  }
}
```

---

### 3. POST `/v1/firebase-otp/session`

**Purpose:** Exchange Firebase ID token for app session

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Session created successfully",
  "data": {
    "ok": true,
    "uid": "firebase-user-id",
    "phone": "+919876543210",
    "email": "user@example.com",
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Side Effects:**
- Sets `firebase_session` HTTP-only cookie
- Cookie settings:
  - `httpOnly: true`
  - `secure: true` (production only)
  - `sameSite: 'lax'`
  - `maxAge: 24 hours`

**Rate Limit:** 10 attempts per 15 minutes per IP

---

### 4. POST `/v1/firebase-otp/logout`

**Purpose:** Destroy app session

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": {
    "ok": true
  }
}
```

**Side Effects:**
- Clears `firebase_session` cookie

---

### 5. GET `/v1/firebase-otp/me`

**Purpose:** Get current authenticated user

**Authentication:** Required (cookie or Bearer token)

**Response (200):**
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "uid": "firebase-user-id",
      "phone": "+919876543210",
      "email": "user@example.com",
      "iat": 1706234567,
      "exp": 1706320967
    }
  }
}
```

## Client Integration Flow

### Web Client (Using Firebase JavaScript SDK)

```javascript
// 1. Import Firebase
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber 
} from 'firebase/auth';

// 2. Initialize Firebase
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ... other config
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 3. Set up reCAPTCHA
window.recaptchaVerifier = new RecaptchaVerifier(
  'recaptcha-container', 
  {
    size: 'invisible',
    callback: (response) => {
      console.log('reCAPTCHA solved');
    }
  }, 
  auth
);

// 4. Send OTP
async function sendOTP(phoneNumber) {
  const appVerifier = window.recaptchaVerifier;
  
  try {
    // Notify backend (optional)
    await fetch('/v1/firebase-otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber })
    });
    
    // Send OTP via Firebase
    const confirmationResult = await signInWithPhoneNumber(
      auth, 
      phoneNumber, 
      appVerifier
    );
    
    // Store confirmation result
    window.confirmationResult = confirmationResult;
    console.log('OTP sent successfully');
  } catch (error) {
    console.error('Error sending OTP:', error);
  }
}

// 5. Verify OTP and create session
async function verifyOTP(code) {
  try {
    // Confirm OTP code
    const result = await window.confirmationResult.confirm(code);
    const user = result.user;
    
    // Get Firebase ID token
    const idToken = await user.getIdToken();
    
    // Exchange for app session
    const response = await fetch('/v1/firebase-otp/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      credentials: 'include' // Important for cookies
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Logged in:', data.data);
      // Cookie is automatically set
      // Token can be stored for API calls
      localStorage.setItem('authToken', data.data.token);
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
  }
}

// 6. Make authenticated requests
async function getProfile() {
  const response = await fetch('/v1/firebase-otp/me', {
    credentials: 'include' // Use cookie
    // OR use Bearer token:
    // headers: {
    //   'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    // }
  });
  
  const data = await response.json();
  console.log('User profile:', data.data.user);
}

// 7. Logout
async function logout() {
  await fetch('/v1/firebase-otp/logout', {
    method: 'POST',
    credentials: 'include'
  });
  
  localStorage.removeItem('authToken');
  console.log('Logged out');
}
```

### Android Client (Using Firebase Android SDK)

```kotlin
// 1. Initialize Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.auth.PhoneAuthOptions
import java.util.concurrent.TimeUnit

// 2. Send OTP
private fun sendOTP(phoneNumber: String) {
    val options = PhoneAuthOptions.newBuilder(FirebaseAuth.getInstance())
        .setPhoneNumber(phoneNumber)
        .setTimeout(60L, TimeUnit.SECONDS)
        .setActivity(this)
        .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
            override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                // Auto-verification (SMS Retriever API)
                signInWithCredential(credential)
            }
            
            override fun onCodeSent(
                verificationId: String,
                token: PhoneAuthProvider.ForceResendingToken
            ) {
                // Save verification ID for manual verification
                this@Activity.verificationId = verificationId
            }
            
            override fun onVerificationFailed(e: FirebaseException) {
                Log.e("OTP", "Verification failed", e)
            }
        })
        .build()
    
    PhoneAuthProvider.verifyPhoneNumber(options)
}

// 3. Verify OTP manually
private fun verifyOTP(code: String) {
    val credential = PhoneAuthProvider.getCredential(verificationId, code)
    signInWithCredential(credential)
}

// 4. Sign in and get token
private fun signInWithCredential(credential: PhoneAuthCredential) {
    FirebaseAuth.getInstance().signInWithCredential(credential)
        .addOnCompleteListener { task ->
            if (task.isSuccessful) {
                task.result?.user?.getIdToken(false)?.addOnCompleteListener { tokenTask ->
                    val idToken = tokenTask.result?.token
                    createSession(idToken)
                }
            }
        }
}

// 5. Create app session
private suspend fun createSession(idToken: String?) {
    val response = apiService.createSession(SessionRequest(idToken))
    if (response.isSuccessful) {
        val sessionData = response.body()?.data
        // Store token for API calls
        sharedPreferences.edit()
            .putString("authToken", sessionData?.token)
            .apply()
    }
}
```

## Security Features

### 1. Rate Limiting

- **OTP Send:** 10 attempts per 15 minutes per IP/phone
- **Session Creation:** 10 attempts per 15 minutes per IP
- Prevents brute force attacks
- Automatic cleanup after time window

### 2. Token Security

- **Firebase ID Token:** Verified server-side using Firebase Admin
- **App Session Token:** HMAC-SHA256 signed JWT
- **Cookie Security:**
  - HTTP-only (prevents XSS)
  - Secure flag in production (HTTPS only)
  - SameSite protection (CSRF prevention)

### 3. Input Validation

- Phone numbers validated against E.164 format
- Schema validation on all endpoints
- Sanitized error messages (no information leakage)

### 4. Token Expiry

- Firebase tokens: Verified for expiration
- App tokens: 24-hour expiry (configurable)
- Expired tokens rejected with clear error messages

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Invalid phone number",
  "details": "Phone number must be in E.164 format (e.g., +1234567890)",
  "statusCode": 400
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Invalid or expired token",
  "details": "Firebase token has expired",
  "statusCode": 401
}
```

**429 Too Many Requests:**
```json
{
  "success": false,
  "message": "Too many OTP requests",
  "details": "Please try again later",
  "statusCode": 429,
  "retryAfter": 900
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Failed to create session",
  "details": "An error occurred while creating your session",
  "statusCode": 500
}
```

## Testing

### Manual Testing with cURL

```bash
# 1. Send OTP (acknowledgment only)
curl -X POST http://localhost:3000/v1/firebase-otp/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210"}'

# 2. Create session (after getting idToken from client)
curl -X POST http://localhost:3000/v1/firebase-otp/session \
  -H "Content-Type: application/json" \
  -d '{"idToken": "YOUR_FIREBASE_ID_TOKEN"}' \
  -c cookies.txt

# 3. Get current user (using cookie)
curl -X GET http://localhost:3000/v1/firebase-otp/me \
  -b cookies.txt

# 4. Get current user (using Bearer token)
curl -X GET http://localhost:3000/v1/firebase-otp/me \
  -H "Authorization: Bearer YOUR_APP_TOKEN"

# 5. Logout
curl -X POST http://localhost:3000/v1/firebase-otp/logout \
  -b cookies.txt
```

## Production Checklist

- [ ] Set strong `APP_JWT_SECRET` (at least 32 random characters)
- [ ] Configure Firebase authorized domains
- [ ] Enable Firebase App Check (recommended)
- [ ] Set up monitoring and logging
- [ ] Configure CORS for your domains
- [ ] Enable HTTPS (required for cookies to work properly)
- [ ] Set up rate limiting at infrastructure level (e.g., nginx, cloud load balancer)
- [ ] Review Firebase quota limits and pricing
- [ ] Implement user data persistence (link Firebase UID to your user model)
- [ ] Add refresh token mechanism for long-lived sessions
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Configure proper log rotation and retention

## Integration with Existing User System

To link Firebase authentication with your existing user model:

```typescript
// In your Firebase OTP service
async linkFirebaseToUser(uid: string, phone: string): Promise<User> {
  // Check if user exists with this phone
  let user = await prisma.inventoryUsers.findFirst({
    where: { usersphonenumber: phone }
  });
  
  if (!user) {
    // Create new user
    user = await prisma.inventoryUsers.create({
      data: {
        usersphonenumber: phone,
        firebaseuid: uid,
        // ... other required fields
      }
    });
  } else {
    // Link Firebase UID to existing user
    user = await prisma.inventoryUsers.update({
      where: { id: user.id },
      data: { firebaseuid: uid }
    });
  }
  
  return user;
}
```

## Swagger Documentation

All endpoints are automatically documented in Swagger UI at:
- Development: `http://localhost:3000/docs`
- Production: `https://your-domain.com/docs`

Navigate to "Firebase Authentication" tag to see all endpoints with interactive testing.

## Troubleshooting

### Issue: Firebase not initializing

**Solution:** Verify environment variables are set correctly, especially `FIREBASE_PRIVATE_KEY` with proper newlines.

### Issue: reCAPTCHA not working on web

**Solution:** 
- Add your domain to Firebase Authorized domains
- Check browser console for reCAPTCHA errors
- Verify reCAPTCHA container exists in DOM

### Issue: Cookies not being set

**Solution:**
- Ensure `credentials: 'include'` is set in fetch requests
- Verify CORS is configured to allow credentials
- Check that domain matches (localhost vs 127.0.0.1)
- Ensure HTTPS in production

### Issue: Token expired errors

**Solution:**
- Implement token refresh logic
- Reduce session duration if needed
- Clear old cookies/tokens

## Additional Resources

- [Firebase Phone Auth Documentation](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Fastify Cookie Plugin](https://github.com/fastify/fastify-cookie)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

## Support

For issues or questions:
1. Check Swagger documentation at `/docs`
2. Review server logs for detailed error messages
3. Verify Firebase Console for quota and configuration
4. Check this documentation for common solutions



