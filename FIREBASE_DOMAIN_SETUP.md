# Firebase Authorized Domains Setup

## Step 1: Add Authorized Domains

1. Go to: https://console.firebase.google.com/project/docblitz-437213/authentication/settings
2. Scroll down to **"Authorized domains"** section
3. Make sure these domains are listed:
   - `localhost` ✅ (should be there by default)
   - `127.0.0.1` (add this if not present)
   - `docblitz-437213.firebaseapp.com` ✅ (should be there)

## Step 2: Check reCAPTCHA Configuration

1. Go back to: https://console.firebase.google.com/project/docblitz-437213/authentication/providers
2. Click the **pencil icon** next to "Phone" provider
3. Look for **"reCAPTCHA Enterprise"** settings
4. If you see any reCAPTCHA configuration, note it down

## Step 3: Test with Different Browser

Sometimes browser extensions or settings interfere:
- Try Chrome Incognito mode
- Try Firefox
- Clear browser cache

## Step 4: Check Firebase Project Settings

1. Go to: https://console.firebase.google.com/project/docblitz-437213/settings/general
2. Check if there are any billing issues
3. Verify the project is active
