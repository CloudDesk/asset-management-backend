# Firebase Phone OTP - Setup Guide

## Quick Start

This guide will help you set up Firebase Phone OTP authentication in 5 minutes.

## Prerequisites

- Node.js 16+ installed
- Firebase account
- Existing Fastify project

## Step 1: Firebase Console Setup (3 minutes)

### 1.1 Enable Phone Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Phone** provider
5. Click **Enable** and **Save**

### 1.2 Generate Service Account Key

1. Go to **Project Settings** (gear icon) → **Service Accounts**
2. Click **Generate new private key**
3. Click **Generate key** - a JSON file will download
4. Keep this file safe - you'll need it for environment variables

### 1.3 Add Authorized Domains

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add your domains:
   - For development: `localhost` (should already be there)
   - For production: `yourdomain.com`, `www.yourdomain.com`, etc.

## Step 2: Environment Variables (1 minute)

Create or update your `.env` file with the following variables:

```env
# Database (existing)
DATABASE_URL="your-existing-database-url"
PORT=3000
NODE_ENV=development

# Firebase Configuration - NEW
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"

# JWT Secret - NEW
APP_JWT_SECRET=generate-a-strong-random-string-here
```

### Where to get these values:

Open the downloaded JSON file from Step 1.2:

```json
{
  "project_id": "your-project-id",           // → FIREBASE_PROJECT_ID
  "client_email": "firebase-adminsdk...",    // → FIREBASE_CLIENT_EMAIL
  "private_key": "-----BEGIN PRIVATE KEY..." // → FIREBASE_PRIVATE_KEY
}
```

**Important:** For `FIREBASE_PRIVATE_KEY`, copy the entire value including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`. The `\n` characters must be preserved.

### Generate JWT Secret

Use one of these methods to generate a strong secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32

# Using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

## Step 3: Install Dependencies (Already Done)

The required dependencies are already in your project:
- ✅ `firebase-admin` - Already installed
- ✅ `fastify-cookie` - Already installed

## Step 4: Start the Server (30 seconds)

```bash
npm run dev
```

You should see:
```
🚀 Server running at http://localhost:3000
📚 API Documentation available at http://localhost:3000/docs
```

## Step 5: Test the API (30 seconds)

### Option A: Using Swagger UI (Recommended)

1. Open `http://localhost:3000/docs` in your browser
2. Find **Firebase Authentication** section
3. Try the **POST /v1/firebase-otp/send** endpoint
4. Enter a test phone number in E.164 format (e.g., `+919876543210`)

### Option B: Using cURL

```bash
curl -X POST http://localhost:3000/v1/firebase-otp/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210"}'
```

Expected response:
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

## Step 6: Client-Side Integration

### For Web (HTML + JavaScript)

Create a simple test page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Firebase Phone Auth Test</title>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
</head>
<body>
  <h1>Firebase Phone OTP Test</h1>
  
  <div id="recaptcha-container"></div>
  
  <div>
    <input type="tel" id="phone" placeholder="+919876543210" />
    <button onclick="sendOTP()">Send OTP</button>
  </div>
  
  <div id="otp-section" style="display:none">
    <input type="text" id="otp" placeholder="Enter OTP" />
    <button onclick="verifyOTP()">Verify</button>
  </div>
  
  <div id="profile-section" style="display:none">
    <button onclick="getProfile()">Get Profile</button>
    <button onclick="logout()">Logout</button>
    <pre id="user-info"></pre>
  </div>

  <script>
    // Initialize Firebase
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID"
    };
    
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    
    // Set up reCAPTCHA
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      'recaptcha-container',
      { size: 'invisible' }
    );
    
    // Send OTP
    async function sendOTP() {
      const phone = document.getElementById('phone').value;
      const appVerifier = window.recaptchaVerifier;
      
      try {
        // Notify backend
        await fetch('http://localhost:3000/v1/firebase-otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phone })
        });
        
        // Send via Firebase
        window.confirmationResult = await auth.signInWithPhoneNumber(
          phone,
          appVerifier
        );
        
        document.getElementById('otp-section').style.display = 'block';
        alert('OTP sent!');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
    
    // Verify OTP
    async function verifyOTP() {
      const code = document.getElementById('otp').value;
      
      try {
        const result = await window.confirmationResult.confirm(code);
        const idToken = await result.user.getIdToken();
        
        // Create session
        const response = await fetch('http://localhost:3000/v1/firebase-otp/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
          localStorage.setItem('authToken', data.data.token);
          document.getElementById('otp-section').style.display = 'none';
          document.getElementById('profile-section').style.display = 'block';
          alert('Logged in successfully!');
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
    
    // Get profile
    async function getProfile() {
      const response = await fetch('http://localhost:3000/v1/firebase-otp/me', {
        credentials: 'include'
      });
      
      const data = await response.json();
      document.getElementById('user-info').textContent = 
        JSON.stringify(data.data.user, null, 2);
    }
    
    // Logout
    async function logout() {
      await fetch('http://localhost:3000/v1/firebase-otp/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      localStorage.removeItem('authToken');
      location.reload();
    }
  </script>
</body>
</html>
```

**Get your Firebase config:**
1. Firebase Console → Project Settings → General
2. Scroll to "Your apps" section
3. Click "Add app" → Web (if not already added)
4. Copy the `firebaseConfig` object

### For React

```bash
npm install firebase
```

```jsx
import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { useState } from 'react';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function PhoneAuth() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [user, setUser] = useState(null);

  const sendOTP = async () => {
    const recaptchaVerifier = new RecaptchaVerifier(
      'recaptcha-container',
      { size: 'invisible' },
      auth
    );
    
    try {
      const result = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
      setConfirmationResult(result);
      alert('OTP sent!');
    } catch (error) {
      console.error(error);
    }
  };

  const verifyOTP = async () => {
    try {
      const result = await confirmationResult.confirm(otp);
      const idToken = await result.user.getIdToken();
      
      const response = await fetch('http://localhost:3000/v1/firebase-otp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        credentials: 'include'
      });
      
      const data = await response.json();
      setUser(data.data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <div id="recaptcha-container"></div>
      {!confirmationResult ? (
        <div>
          <input 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+919876543210" 
          />
          <button onClick={sendOTP}>Send OTP</button>
        </div>
      ) : (
        <div>
          <input 
            value={otp} 
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP" 
          />
          <button onClick={verifyOTP}>Verify</button>
        </div>
      )}
      {user && <pre>{JSON.stringify(user, null, 2)}</pre>}
    </div>
  );
}

export default PhoneAuth;
```

## Troubleshooting

### Error: "Firebase credentials not provided"

**Solution:** Make sure all three Firebase environment variables are set in `.env`:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`  
- `FIREBASE_PRIVATE_KEY`

Restart the server after adding them.

### Error: "auth/invalid-phone-number"

**Solution:** Phone number must be in E.164 format (e.g., `+919876543210`, `+14155552671`)

### Error: "auth/too-many-requests"

**Solution:** Firebase has rate limits. Wait a few minutes and try again.

### reCAPTCHA not showing on web

**Solution:**
1. Check browser console for errors
2. Verify domain is in Firebase Authorized domains
3. Make sure container element exists: `<div id="recaptcha-container"></div>`

### Cookies not working in development

**Solution:**
- Use `http://localhost:3000` not `http://127.0.0.1:3000`
- Make sure `credentials: 'include'` is set in fetch
- Check CORS settings allow credentials

## Production Deployment

### 1. Update Environment Variables

Set these in your production environment:
```env
NODE_ENV=production
APP_JWT_SECRET=<strong-production-secret>
FIREBASE_PROJECT_ID=<your-project-id>
FIREBASE_CLIENT_EMAIL=<your-service-account-email>
FIREBASE_PRIVATE_KEY=<your-private-key>
```

### 2. Configure Authorized Domains

Add your production domain to Firebase Console → Authentication → Authorized domains

### 3. Enable HTTPS

Cookies with `secure: true` flag only work over HTTPS in production.

### 4. Set up Firebase App Check (Recommended)

Protects your backend from abuse:
1. Firebase Console → App Check
2. Enable for your web/mobile apps
3. Configure reCAPTCHA Enterprise or other provider

## Next Steps

- ✅ **Working?** Congratulations! Your Firebase OTP auth is ready.
- 📖 Read [FIREBASE_OTP_IMPLEMENTATION.md](./FIREBASE_OTP_IMPLEMENTATION.md) for detailed API documentation
- 🔐 Review security best practices
- 🎨 Customize the UI for your brand
- 📱 Test on mobile devices
- 🚀 Deploy to production

## Support

- Check `/docs` endpoint for interactive API documentation
- Review server logs for detailed error messages
- Consult [Firebase Documentation](https://firebase.google.com/docs/auth)

## Need Help?

Common issues:
1. ❌ Server not starting → Check `.env` file syntax
2. ❌ Firebase init failed → Verify service account JSON values
3. ❌ OTP not sending → Check Firebase quota in console
4. ❌ Token invalid → Ensure clocks are synchronized
5. ❌ CORS errors → Update CORS settings in `server.ts`



