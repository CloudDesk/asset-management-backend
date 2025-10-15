# Firebase Phone Authentication Setup Steps

## Step 1: Enable Phone Authentication

1. Go to: https://console.firebase.google.com/project/docblitz-437213/authentication/providers
2. Click on **"Phone"** provider
3. Click **"Enable"** toggle
4. Click **"Save"**

## Step 2: Configure Authorized Domains

1. Go to: https://console.firebase.google.com/project/docblitz-437213/authentication/settings
2. Scroll to **"Authorized domains"** section
3. Add these domains:
   - `localhost` (for development)
   - `127.0.0.1` (alternative localhost)
   - Your production domain (when ready)

## Step 3: Configure reCAPTCHA (if needed)

If you still get errors, you might need to configure reCAPTCHA:

1. Go to: https://console.firebase.google.com/project/docblitz-437213/authentication/providers
2. Click on **"Phone"** provider
3. Under **"reCAPTCHA Enterprise"**, configure if needed

## Step 4: Test Phone Numbers (Optional - for development)

1. In Firebase Console → Authentication → Phone provider
2. Scroll to **"Phone numbers for testing"**
3. Add your phone number: `+918825727948`
4. Add a test code like: `123456`
5. This allows testing without real SMS

## Step 5: Check Firebase Usage/Quotas

1. Go to: https://console.firebase.google.com/project/docblitz-437213/usage
2. Check if you have SMS quota remaining
3. Free tier includes limited SMS sends

## Common Issues & Solutions

### Issue: "auth/internal-error"
- **Solution**: Enable Phone Authentication in Firebase Console

### Issue: "auth/unauthorized-domain"
- **Solution**: Add your domain to Authorized domains

### Issue: "auth/too-many-requests"
- **Solution**: Wait a few minutes or check quota limits

### Issue: reCAPTCHA not loading
- **Solution**: Check browser console for network errors


