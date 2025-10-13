# 🔥 reCAPTCHA Enterprise Setup Guide

## ✅ **COMPLETE IMPLEMENTATION**

Your Firebase Phone OTP authentication is now fully implemented with **reCAPTCHA Enterprise** integration following Google's official documentation!

## 🚀 **What's Been Implemented**

### **Backend (Fastify)**
- ✅ **reCAPTCHA Enterprise Service** (`src/services/recaptcha-enterprise.service.ts`)
- ✅ **New Endpoint** `POST /v1/firebase-otp/verify-recaptcha`
- ✅ **Google Cloud reCAPTCHA Enterprise SDK** integration
- ✅ **Token verification** with risk scoring
- ✅ **Schema validation** for all endpoints

### **Frontend (HTML/JavaScript)**
- ✅ **reCAPTCHA Enterprise JavaScript API** integration
- ✅ **Proper callback function** `onSubmit(token)`
- ✅ **HTML button attributes** as per Google docs
- ✅ **Firebase Phone Auth** with test mode
- ✅ **Complete flow**: reCAPTCHA → Firebase OTP → Session

## 📋 **Setup Steps**

### **Step 1: Firebase Console Configuration**

1. **Enable Phone Authentication**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project: `docblitz-437213`
   - Navigate to **Authentication** → **Sign-in method**
   - Enable **Phone** provider

2. **Configure Test Phone Numbers**
   - In Phone provider settings
   - Add test phone number: `+918870339850`
   - Set test code: `123456`
   - Save changes

3. **Add Authorized Domains**
   - In Authentication → Settings → Authorized domains
   - Add: `localhost`, `127.0.0.1`, your production domain

### **Step 2: reCAPTCHA Enterprise Configuration**

1. **Enable reCAPTCHA Enterprise**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Select project: `docblitz-437213`
   - Navigate to **Security** → **reCAPTCHA Enterprise**
   - Create a new site or use existing

2. **Configure Site Key**
   - Use existing key: `6LcToegrAAAAADC2HsGmZGSn98A9B-565D-DOGok`
   - Ensure it's linked to your Firebase project

3. **Set Up Service Account**
   - Your existing service account should have reCAPTCHA Enterprise permissions
   - If not, add `reCAPTCHA Enterprise Agent` role

### **Step 3: Environment Variables**

Your `.env` file should contain:
```env
FIREBASE_PROJECT_ID=docblitz-437213
FIREBASE_CLIENT_EMAIL=your-service-account@docblitz-437213.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
APP_JWT_SECRET=your-app-jwt-secret
RECAPTCHA_SITE_KEY=6LcToegrAAAAADC2HsGmZGSn98A9B-565D-DOGok
```

## 🧪 **Testing**

### **Test Page: `test_recaptcha_enterprise_correct.html`**

This page implements the **exact Google Cloud reCAPTCHA Enterprise integration**:

1. **Load reCAPTCHA Enterprise API**
   ```html
   <script src="https://www.google.com/recaptcha/enterprise.js?render=6LcToegrAAAAADC2HsGmZGSn98A9B-565D-DOGok"></script>
   ```

2. **Callback Function**
   ```javascript
   window.onSubmit = function(token) {
       console.log('reCAPTCHA Enterprise token received:', token);
       sendOTP(token);
   };
   ```

3. **HTML Button with Attributes**
   ```html
   <button 
       class="g-recaptcha" 
       data-sitekey="6LcToegrAAAAADC2HsGmZGSn98A9B-565D-DOGok" 
       data-callback='onSubmit'
       data-action='send_otp'>
       Send OTP (reCAPTCHA Enterprise)
   </button>
   ```

### **Test Flow**

1. **Click "Send OTP"** → reCAPTCHA Enterprise validates
2. **reCAPTCHA token sent** to backend `/verify-recaptcha`
3. **Backend verifies token** with Google Cloud
4. **Firebase OTP sent** (test mode: no real SMS)
5. **Enter test code** `123456`
6. **Session created** with HTTP-only cookie
7. **Access protected routes** like `/me`

## 🔧 **API Endpoints**

### **New Endpoint: reCAPTCHA Verification**
```bash
POST /v1/firebase-otp/verify-recaptcha
Content-Type: application/json

{
  "token": "recaptcha-enterprise-token",
  "action": "send_otp"
}
```

**Response:**
```json
{
  "success": true,
  "message": "reCAPTCHA verification successful",
  "data": {
    "verified": true,
    "score": 0.9,
    "action": "send_otp"
  }
}
```

### **Existing Endpoints**
- `POST /v1/firebase-otp/send` - Acknowledge OTP request
- `POST /v1/firebase-otp/session` - Create app session
- `GET /v1/firebase-otp/me` - Get user profile
- `POST /v1/firebase-otp/logout` - Destroy session

## 🎯 **Key Features**

### **Security**
- ✅ **reCAPTCHA Enterprise** bot protection
- ✅ **Risk scoring** (0.0 to 1.0)
- ✅ **Action validation** (send_otp)
- ✅ **Rate limiting** on all endpoints
- ✅ **HTTP-only cookies** for sessions
- ✅ **Server-side token verification**

### **Reliability**
- ✅ **Test phone numbers** for development
- ✅ **Fallback error handling**
- ✅ **Comprehensive logging**
- ✅ **Input validation** with schemas
- ✅ **Production-ready** configuration

## 🚨 **Troubleshooting**

### **Common Issues**

1. **"reCAPTCHA verification failed"**
   - Check reCAPTCHA Enterprise site key
   - Verify Google Cloud permissions
   - Ensure service account has reCAPTCHA Enterprise Agent role

2. **"Firebase Phone Auth error"**
   - Verify Phone Authentication is enabled
   - Check test phone numbers are configured
   - Ensure `appVerificationDisabledForTesting = true`

3. **"Token validation failed"**
   - Check Firebase service account credentials
   - Verify `FIREBASE_PROJECT_ID` matches
   - Ensure private key format is correct

### **Debug Steps**

1. **Check server logs** for detailed error messages
2. **Verify environment variables** are loaded correctly
3. **Test backend endpoints** directly with curl
4. **Check Firebase Console** for authentication logs
5. **Review Google Cloud Console** for reCAPTCHA Enterprise logs

## 🎉 **Success Indicators**

When everything is working correctly, you should see:

1. ✅ **reCAPTCHA Enterprise validated successfully!**
2. ✅ **OTP sent successfully!**
3. ✅ **Logged in successfully!**
4. ✅ **Profile loaded successfully!**

## 📚 **Documentation References**

- [reCAPTCHA Enterprise Frontend Integration](https://cloud.google.com/recaptcha-enterprise/docs/integration-types)
- [Firebase Phone Authentication](https://firebase.google.com/docs/auth/web/phone-auth)
- [Google Cloud reCAPTCHA Enterprise](https://cloud.google.com/recaptcha-enterprise/docs)

---

## 🏆 **CONGRATULATIONS!**

You now have a **production-ready Firebase Phone OTP authentication system** with **reCAPTCHA Enterprise** integration following Google's official documentation!

**Next Steps:**
1. Test the complete flow with `test_recaptcha_enterprise_correct.html`
2. Configure production domains in Firebase Console
3. Set up monitoring and logging
4. Deploy to production environment
