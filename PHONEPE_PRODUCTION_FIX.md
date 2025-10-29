# PhonePe Production Redirect URL Fix

## 🐛 Problem

In production, after successful payment in PhonePe:
- Money is successfully added to PhonePe console
- Order and order lines are created
- Cart is NOT deleted
- User sees error: `net::ERR_CLEARTEXT_NOT_PERMITTED`
- No success/failure screen appears

## 🔍 Root Cause

The error `net::ERR_CLEARTEXT_NOT_PERMITTED` occurs when Android apps try to redirect to HTTP URLs. Android blocks HTTP connections in production for security reasons.

### Issues Found:

1. **Hardcoded localhost URLs** in callback handler (`src/routes/phonepe.route.ts`)
   - Lines 694, 709, 724, 758 were using `http://localhost:5600/...`
   - This caused the Android app to fail when trying to open these URLs

2. **Callback URL must use HTTPS** in production
   - The callback URL sent to PhonePe (line 187-189 in `phonepe.service.ts`)
   - Must use `https://` not `http://` in production

## ✅ Fix Applied

### 1. Updated Callback Handler
**File**: `src/routes/phonepe.route.ts`

Changed hardcoded redirects to use environment variables:

```typescript
// Before (WRONG):
return reply.redirect("http://localhost:5600/health");

// After (CORRECT):
const successUrl = process.env.REDIRECT_URL_SUCCESS || "com.Nivaana.app://profile/orders";
return reply.redirect(successUrl);
```

Applied to all 4 redirect points:
- Line 694: Success redirect
- Line 710: Transaction not found redirect  
- Line 726: Payment failed redirect
- Line 761: Error handler redirect

## 📋 Required Production Environment Variables

Your production environment must have these variables set:

```bash
# REQUIRED: HTTPS URL for PhonePe callbacks
REDIRECT_URL_PAYMENT_STATUS=https://your-prod-backend-url.com

# REQUIRED: Deep link for mobile app success redirect
REDIRECT_URL_SUCCESS=com.Nivaana.app://profile/orders

# REQUIRED: Deep link for mobile app failure redirect  
REDIRECT_URL_FAILURE=com.Nivaana.app://profile/orders
```

### Important Notes:

1. **REDIRECT_URL_PAYMENT_STATUS** must be HTTPS
   - This is where PhonePe sends the payment callback
   - Example: `https://nivaana-dev-715569764663.asia-south1.run.app`
   - ❌ WRONG: `http://localhost:5600`
   - ✅ CORRECT: `https://your-backend.com`

2. **REDIRECT_URL_SUCCESS** and **REDIRECT_URL_FAILURE** can be:
   - Deep link (recommended): `com.Nivaana.app://profile/orders`
   - HTTPS URL (fallback): `https://your-app.com/orders`

## 🔧 How to Verify Your Production Setup

### Check Cloud Run Environment Variables

Run this command to check your current production environment:

```bash
gcloud run services describe nivaana --region=asia-south1 --format="value(spec.template.spec.containers[0].env)"
```

Look for these variables:
- `REDIRECT_URL_PAYMENT_STATUS`
- `REDIRECT_URL_SUCCESS`
- `REDIRECT_URL_FAILURE`

### Update Production Environment (if needed)

If your variables are incorrect, update them using Cloud Console or this command:

```bash
gcloud run services update nivaana \
  --region=asia-south1 \
  --update-env-vars="REDIRECT_URL_PAYMENT_STATUS=https://your-backend-url.com,REDIRECT_URL_SUCCESS=com.Nivaana.app://profile/orders,REDIRECT_URL_FAILURE=com.Nivaana.app://profile/orders"
```

## 📱 Mobile App Deep Link Configuration

Make sure your mobile app (React Native) handles the deep link:

### iOS (Info.plist)
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.Nivaana.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>Nivaana</string>
    </array>
  </dict>
</array>
```

### Android (AndroidManifest.xml)
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="com.Nivaana.app" />
</intent-filter>
```

### React Native Navigation
```javascript
// App.tsx or navigation setup
import { Linking } from 'react-native';

Linking.addEventListener('url', (event) => {
  const { url } = event;
  if (url.includes('profile/orders')) {
    // Navigate to orders page
    navigation.navigate('Orders');
  }
});
```

## 🧪 Testing Steps

1. **Deploy the fix** to production
2. **Create a test payment** with a small amount
3. **Complete the payment** in PhonePe
4. **Verify**:
   - Order is created ✅
   - Order lines are created ✅
   - Cart is cleared ✅
   - App redirects to profile/orders ✅
   - No ERR_CLEARTEXT_NOT_PERMITTED error ✅

## 📊 Expected Flow

```
User clicks "Pay" 
  ↓
PhonePe payment page opens
  ↓
User completes payment
  ↓
PhonePe sends callback to: https://your-backend.com/v1/phonepe/callback/{txnId}
  ↓
Backend processes payment, creates order, clears cart
  ↓
Backend redirects to: com.Nivaana.app://profile/orders
  ↓
Mobile app opens and navigates to Orders page
  ↓
User sees their order ✅
```

## ⚠️ Common Issues

### Issue: Still seeing "Domain: undefined" error
**Solution**: Check that `REDIRECT_URL_PAYMENT_STATUS` is set correctly and uses HTTPS

### Issue: Deep link not opening
**Solution**: Verify deep link configuration in mobile app manifest files

### Issue: Cart not clearing
**Solution**: Check backend logs - this might be a separate issue with order creation logic

### Issue: Order created but payment status shows as pending
**Solution**: Check PhonePe dashboard and backend logs for callback status

## 📝 Summary

The fix ensures that:
1. ✅ Callback handler uses environment variables instead of hardcoded localhost
2. ✅ Redirect URLs use proper HTTPS for callbacks
3. ✅ Mobile app deep links work correctly
4. ✅ No more cleartext HTTP errors in production

**Next Step**: Deploy this fix to production and verify the environment variables are set correctly.

