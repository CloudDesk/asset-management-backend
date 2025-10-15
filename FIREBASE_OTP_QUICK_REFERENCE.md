# Firebase Phone OTP - Quick Reference

## API Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/v1/firebase-otp/send` | POST | Acknowledge OTP send | No |
| `/v1/firebase-otp/verify` | POST | Verify Firebase token (optional) | No |
| `/v1/firebase-otp/session` | POST | Create app session | No |
| `/v1/firebase-otp/logout` | POST | Destroy session | No |
| `/v1/firebase-otp/me` | GET | Get current user | Yes |

## Quick Examples

### 1. Send OTP Acknowledgment
```bash
curl -X POST http://localhost:3000/v1/firebase-otp/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210"}'
```

### 2. Create Session
```bash
curl -X POST http://localhost:3000/v1/firebase-otp/session \
  -H "Content-Type: application/json" \
  -d '{"idToken": "YOUR_FIREBASE_ID_TOKEN"}' \
  -c cookies.txt
```

### 3. Get Current User
```bash
# Using cookie
curl http://localhost:3000/v1/firebase-otp/me -b cookies.txt

# Using Bearer token
curl http://localhost:3000/v1/firebase-otp/me \
  -H "Authorization: Bearer YOUR_APP_TOKEN"
```

### 4. Logout
```bash
curl -X POST http://localhost:3000/v1/firebase-otp/logout -b cookies.txt
```

## Environment Variables

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
APP_JWT_SECRET=your-secret-key-32-chars-minimum
NODE_ENV=development
```

## Client-Side Flow

```javascript
// 1. Send OTP via Firebase Client SDK
const confirmationResult = await signInWithPhoneNumber(auth, phone, appVerifier);

// 2. User enters OTP code
const result = await confirmationResult.confirm(code);

// 3. Get Firebase ID token
const idToken = await result.user.getIdToken();

// 4. Exchange for app session
const response = await fetch('/v1/firebase-otp/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken }),
  credentials: 'include'
});

// 5. Use session for protected routes
```

## Phone Number Format

✅ **Valid:** `+919876543210`, `+14155552671`, `+447911123456`
❌ **Invalid:** `9876543210`, `+91-987-654-3210`, `(415) 555-2671`

**Rule:** E.164 format - `+` followed by country code and number (no spaces/dashes)

## Rate Limits

- **OTP Send:** 10 attempts per 15 minutes (per IP + phone)
- **Session Creation:** 10 attempts per 15 minutes (per IP)

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Invalid input | Check phone format, ensure required fields |
| 401 | Invalid/expired token | Get fresh Firebase token, check credentials |
| 429 | Rate limit exceeded | Wait 15 minutes or use different IP/phone |
| 500 | Server error | Check Firebase config, server logs |

## Security Features

✅ **HTTP-only cookies** - XSS protection
✅ **Secure flag (production)** - HTTPS only  
✅ **SameSite protection** - CSRF prevention
✅ **Rate limiting** - Brute force prevention
✅ **Firebase token verification** - Server-side validation
✅ **JWT signing** - HMAC-SHA256
✅ **Token expiry** - 24-hour sessions

## Testing

```bash
# Run automated tests
node test_firebase_otp.cjs

# Expected output: All tests passed! ✨
```

## Troubleshooting

### Firebase not initializing
```
Check: .env file has all Firebase variables
Solution: Verify FIREBASE_PRIVATE_KEY includes \n characters
```

### reCAPTCHA not working
```
Check: Domain in Firebase Authorized domains
Solution: Add localhost or your domain in Firebase Console
```

### Cookies not set
```
Check: credentials: 'include' in fetch
Solution: Ensure CORS allows credentials
```

### Token expired
```
Check: System clock synchronization
Solution: Implement token refresh logic
```

## Production Checklist

- [ ] Strong `APP_JWT_SECRET` (32+ chars)
- [ ] Firebase authorized domains configured
- [ ] HTTPS enabled (required for secure cookies)
- [ ] Rate limiting at infrastructure level
- [ ] Error monitoring (Sentry, etc.)
- [ ] Firebase quota limits reviewed
- [ ] CORS configured for production domains
- [ ] Environment variables secured
- [ ] Logging and monitoring set up

## Documentation Links

- 📘 [Full Implementation Guide](./FIREBASE_OTP_IMPLEMENTATION.md)
- 🚀 [Setup Guide](./FIREBASE_OTP_SETUP_GUIDE.md)
- 📚 [Swagger Docs](http://localhost:3000/docs) (when server running)
- 🔥 [Firebase Console](https://console.firebase.google.com/)

## Common Patterns

### Auto-login after registration
```javascript
// After creating user in your system
const firebaseUser = await auth.currentUser;
const idToken = await firebaseUser.getIdToken();
await createSession(idToken);
```

### Link to existing user
```javascript
// In your service layer
const firebaseUid = decodedToken.uid;
const phone = decodedToken.phone_number;

// Find or create user
let user = await findUserByPhone(phone);
if (!user) {
  user = await createUser({ phone, firebaseUid });
}
```

### Refresh expired sessions
```javascript
// On 401 error
if (response.status === 401) {
  const firebaseUser = auth.currentUser;
  const newIdToken = await firebaseUser.getIdToken(true);
  await createSession(newIdToken);
}
```

## Performance Tips

- Cache Firebase Admin instance (already done in plugin)
- Use connection pooling for database (already done in Prisma)
- Implement Redis for rate limiting in high-traffic scenarios
- Set appropriate cookie maxAge based on usage patterns
- Monitor Firebase quota usage in console

## Need Help?

1. Check server logs for detailed errors
2. Review [Setup Guide](./FIREBASE_OTP_SETUP_GUIDE.md)
3. Test with Swagger UI at `/docs`
4. Run automated tests: `node test_firebase_otp.cjs`
5. Verify Firebase Console settings



