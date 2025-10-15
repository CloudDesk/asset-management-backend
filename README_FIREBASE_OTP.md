# Firebase Phone OTP Authentication

Complete implementation of Firebase Phone (SMS) OTP authentication for Fastify.

## 🚀 Quick Start

1. **Set up Firebase** (3 minutes)
   ```
   ✓ Enable Phone authentication in Firebase Console
   ✓ Generate service account key
   ✓ Add authorized domains
   ```

2. **Configure environment** (1 minute)
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@...
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   APP_JWT_SECRET=your-secret-key
   ```

3. **Start server** (30 seconds)
   ```bash
   npm run dev
   ```

4. **Test implementation** (30 seconds)
   ```bash
   node test_firebase_otp.cjs
   ```

Done! Your Firebase OTP authentication is ready. 🎉

## 📚 Documentation

| Document | Purpose | Read When |
|----------|---------|-----------|
| **[Setup Guide](./FIREBASE_OTP_SETUP_GUIDE.md)** | Step-by-step setup instructions | First time setup |
| **[Implementation Docs](./FIREBASE_OTP_IMPLEMENTATION.md)** | Complete technical documentation | Understanding the system |
| **[Quick Reference](./FIREBASE_OTP_QUICK_REFERENCE.md)** | Common commands and examples | Daily development |
| **[Verification Checklist](./FIREBASE_OTP_VERIFICATION_CHECKLIST.md)** | Pre-deployment checklist | Before going live |
| **[Implementation Summary](./FIREBASE_OTP_IMPLEMENTATION_SUMMARY.md)** | Overview of what was built | Project overview |

## 🌐 API Endpoints

All endpoints are under `/v1/firebase-otp`:

```
POST   /send      - Acknowledge OTP send request
POST   /verify    - Verify Firebase ID token (optional)
POST   /session   - Exchange token for app session
POST   /logout    - Destroy app session
GET    /me        - Get current authenticated user
```

**Interactive Docs:** http://localhost:3000/docs

## 💻 Usage Examples

### cURL
```bash
# Send OTP acknowledgment
curl -X POST http://localhost:3000/v1/firebase-otp/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210"}'

# Create session (after Firebase OTP verification)
curl -X POST http://localhost:3000/v1/firebase-otp/session \
  -H "Content-Type: application/json" \
  -d '{"idToken": "FIREBASE_ID_TOKEN"}' \
  -c cookies.txt

# Get current user
curl http://localhost:3000/v1/firebase-otp/me -b cookies.txt
```

### JavaScript (Web)
```javascript
// Initialize Firebase
const auth = getAuth(app);

// Send OTP
const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);

// Verify OTP
const result = await confirmation.confirm(code);
const idToken = await result.user.getIdToken();

// Create session
const response = await fetch('/v1/firebase-otp/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken }),
  credentials: 'include'
});
```

## 🔐 Security Features

✅ HTTP-only cookies (XSS protection)
✅ Secure flag in production (HTTPS only)
✅ SameSite protection (CSRF prevention)
✅ Rate limiting (10 attempts per 15 minutes)
✅ Firebase token verification
✅ JWT session tokens (HMAC-SHA256)
✅ Phone validation (E.164 format)
✅ 24-hour token expiry

## 🧪 Testing

```bash
# Run automated tests
node test_firebase_otp.cjs

# Expected output:
# ✓ Passed: 9/9
# Success Rate: 100%
# All tests passed! ✨
```

## 📁 Project Structure

```
src/
├── config/
│   └── env.ts                    # ← Updated (Firebase env vars)
├── controllers/
│   └── firebase-otp.controller.ts # ← New
├── plugins/
│   └── firebase.ts               # ← New (Firebase Admin)
├── routes/
│   ├── firebase-otp.route.ts     # ← New
│   └── index.ts                  # ← Updated (registered routes)
├── schemas/
│   └── firebase-otp.schema.ts    # ← New
├── services/
│   └── firebase-otp.service.ts   # ← New
├── utils/
│   └── jwt.ts                    # ← New (JWT service)
└── server.ts                     # ← Updated (cookie + Firebase)
```

## 🔧 Configuration

### Required Environment Variables
```env
FIREBASE_PROJECT_ID     # From Firebase service account JSON
FIREBASE_CLIENT_EMAIL   # From Firebase service account JSON
FIREBASE_PRIVATE_KEY    # From Firebase service account JSON
APP_JWT_SECRET          # Generate strong random string (32+ chars)
```

### Generate JWT Secret
```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🚨 Troubleshooting

### Server won't start
```bash
# Check environment variables
cat .env | grep FIREBASE
# Verify all three Firebase vars are set
```

### Firebase not initializing
```
Error: Firebase credentials not provided
Solution: Check .env file has all Firebase variables with correct values
```

### reCAPTCHA not working
```
Error: auth/network-request-failed
Solution: Add domain to Firebase Console → Authentication → Authorized domains
```

### Cookies not set
```
Issue: Session cookie not appearing in browser
Solution: Ensure fetch includes credentials: 'include'
```

## 📖 Learn More

- **[Firebase Phone Auth Docs](https://firebase.google.com/docs/auth/web/phone-auth)** - Official Firebase documentation
- **[Fastify](https://www.fastify.io/)** - Fastify framework documentation
- **[JWT Best Practices](https://tools.ietf.org/html/rfc8725)** - Security best practices

## ✅ What's Included

- ✅ Complete backend implementation
- ✅ Firebase Admin integration
- ✅ JWT session management
- ✅ Cookie-based authentication
- ✅ Rate limiting
- ✅ Comprehensive error handling
- ✅ TypeScript support
- ✅ Swagger documentation
- ✅ Automated tests
- ✅ Setup guides
- ✅ Client integration examples

## 🎯 Next Steps

1. **Development**
   - [ ] Set Firebase credentials in `.env`
   - [ ] Test with real phone numbers
   - [ ] Integrate client-side Firebase SDK

2. **Production**
   - [ ] Configure authorized domains
   - [ ] Enable Firebase App Check
   - [ ] Set up monitoring
   - [ ] Review security checklist

3. **Integration**
   - [ ] Link Firebase UID to your user model
   - [ ] Add custom claims for roles
   - [ ] Implement refresh token logic

## 💡 Pro Tips

**Development:**
- Use `+1234567890` format for phone numbers
- Check Firebase Console for test phone numbers
- Monitor rate limits in logs

**Production:**
- Use environment-specific Firebase projects
- Enable Firebase App Check to prevent abuse
- Monitor Firebase quota usage
- Set up alerts for rate limiting triggers

**Security:**
- Never commit `.env` file
- Rotate JWT secret regularly
- Use strong secrets (32+ characters)
- Enable HTTPS in production

## 🤝 Support

**Documentation:** Check the docs folder for detailed guides
**Interactive API:** http://localhost:3000/docs
**Tests:** `node test_firebase_otp.cjs`
**Logs:** Check server console for detailed error messages

## 📊 Status

✅ **Implementation:** Complete
✅ **Testing:** Automated tests included
✅ **Documentation:** Comprehensive guides
✅ **Production Ready:** Security features included

---

**Built with:**
- Fastify 5.x
- Firebase Admin SDK 12.7.0
- TypeScript
- fastify-cookie for session management

**Created:** October 13, 2025
**Status:** Production Ready ✨



