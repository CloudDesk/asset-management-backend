# 🔥 Firebase Phone Authentication Setup Guide

## STEP 1: Add Test Phone Numbers (IMMEDIATE FIX)

### 1. Go to Firebase Console
- Open: https://console.firebase.google.com/project/docblitz-437213/authentication/providers

### 2. Configure Phone Provider
- Click the **pencil icon** next to "Phone" provider
- Scroll down to **"Phone numbers for testing"** section
- Click **"Add phone number"**

### 3. Add Your Test Number
- **Phone number**: `+918870339850`
- **Verification code**: `123456`
- Click **"Add"**

### 4. Save Changes
- Click **"Save"** at the bottom

## STEP 2: Check Authorized Domains

### 1. Go to Authentication Settings
- Open: https://console.firebase.google.com/project/docblitz-437213/authentication/settings

### 2. Check Authorized Domains
- Scroll to **"Authorized domains"** section
- Make sure these are listed:
  - `localhost` ✅
  - `docblitz-437213.firebaseapp.com` ✅

## STEP 3: Enable reCAPTCHA Enterprise (For Real SMS)

### 1. Go to reCAPTCHA Enterprise
- Open: https://console.cloud.google.com/security/recaptcha?project=docblitz-437213

### 2. Create Site Key
- Click **"Create Key"**
- **Label**: "Firebase Auth"
- **Platform**: Web
- **Domains**: Add `localhost`
- Click **"Create"**

### 3. Configure Firebase
- Go back to Firebase Console → Authentication → Settings
- Find **"reCAPTCHA Enterprise"** section
- Add your site key

## STEP 4: Check Billing (For Real SMS)

### 1. Go to Firebase Usage
- Open: https://console.firebase.google.com/project/docblitz-437213/usage

### 2. Check SMS Quota
- Look for **"Authentication"** section
- Check if you have SMS quota remaining
- Free tier has limited SMS sends

## STEP 5: Test with Real Phone Number

### 1. Use Test Numbers First
- Phone: `+918870339850`
- Code: `123456`

### 2. If Test Works, Try Real Number
- Use your actual phone number
- You should receive real SMS

## TROUBLESHOOTING

### If Still No SMS:
1. **Check Firebase Console logs**
2. **Verify phone number format** (+91xxxxxxxxxx)
3. **Check SMS quota** in Firebase Console
4. **Try different browser** (Chrome Incognito)
5. **Clear browser cache**

### If reCAPTCHA Issues:
1. **Enable reCAPTCHA Enterprise**
2. **Add localhost to authorized domains**
3. **Try test phone numbers first**

## SUCCESS INDICATORS

✅ Test phone number works with code `123456`
✅ Real phone number receives SMS
✅ Backend creates session successfully
✅ `/me` endpoint returns user profile

