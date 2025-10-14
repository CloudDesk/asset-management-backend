# PhonePe SDK - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Add Your Credentials

Add these to your `.env` file:

```env
# Your PhonePe Dashboard Credentials
PHONEPE_CLIENT_ID=<your_client_id_from_dashboard>
PHONEPE_CLIENT_SECRET=<your_client_secret_from_dashboard>
PHONEPE_CLIENT_VERSION=1
PHONEPE_ENVIRONMENT=SANDBOX
PHONEPE_USE_SDK=true

# Callback URLs
REDIRECT_URL_PAYMENT_STATUS=http://localhost:3000
REDIRECT_URL_SUCCESS=http://localhost:5600/payment/success
REDIRECT_URL_FAILURE=http://localhost:5600/payment/failure
```

### Step 2: Restart Your Application

```bash
npm run build
npm start
```

### Step 3: Verify Integration

Check your application logs. You should see:

```
✅ PhonePe SDK client initialized successfully
```

### Step 4: Test Payment

Make a test payment request:

```bash
curl -X POST http://localhost:3000/v1/phonepe/initiate-payment \
  -H "Content-Type: application/json" \
  -d '{
    "merchantTransactionId": "TEST_'$(date +%s)'",
    "amount": 100,
    "name": "Test User",
    "mobileNumber": "9999999999",
    "userId": 1,
    "productIds": [1]
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": "Payment initiated successfully",
  "redirectUrl": "https://mercury-uat.phonepe.com/...",
  "transactionId": "TEST_1234567890"
}
```

---

## 📋 Configuration Options

### Use SDK (Recommended)

```env
PHONEPE_CLIENT_ID=your_client_id
PHONEPE_CLIENT_SECRET=your_client_secret
PHONEPE_USE_SDK=true
```

### Use Legacy Method

```env
PHONEPE_USE_SDK=false
# OR don't set CLIENT_ID and CLIENT_SECRET
```

---

## 🔍 How to Check Which Mode is Active

Look at your application logs during startup:

**SDK Mode:**

```json
{
  "msg": "PhonePe SDK client initialized successfully",
  "usingSDK": true
}
```

**Legacy Mode:**

```json
{
  "msg": "Using legacy PhonePe integration",
  "usingSDK": false
}
```

---

## 🎯 Key Features

✅ **No Code Changes** - Your existing API calls work as-is  
✅ **Automatic Fallback** - Falls back to legacy if SDK fails  
✅ **Same Response Format** - All responses match existing format  
✅ **Enhanced Logging** - Better debugging and monitoring

---

## 📝 Example Integration Code

```typescript
import { PhonePeService } from "./services/phonepe.service";

const phonePeService = new PhonePeService();

// Initiate payment (works with both SDK and legacy)
const result = await phonePeService.initiatePayment({
  merchantTransactionId: "TXN_1234567890",
  amount: 100.5,
  name: "John Doe",
  mobileNumber: "9876543210",
  userId: 123,
  productIds: [1, 2, 3],
  transactionFor: "product_purchase",
});

console.log(result);
// {
//   success: true,
//   message: "Payment initiated successfully",
//   redirectUrl: "https://...",
//   transactionId: "TXN_1234567890"
// }
```

---

## 🔧 Troubleshooting

### SDK Not Working?

1. **Check credentials:**

   ```bash
   echo $PHONEPE_CLIENT_ID
   echo $PHONEPE_CLIENT_SECRET
   ```

2. **Check logs:**

   - Look for "PhonePe SDK client initialized"
   - If you see "Using legacy PhonePe integration", SDK is not active

3. **Force legacy mode:**
   ```env
   PHONEPE_USE_SDK=false
   ```

---

## 🌐 Environment-Specific Configuration

### Development/Sandbox

```env
PHONEPE_ENVIRONMENT=SANDBOX
PHONEPE_CLIENT_ID=<sandbox_client_id>
PHONEPE_CLIENT_SECRET=<sandbox_client_secret>
```

### Production

```env
PHONEPE_ENVIRONMENT=PRODUCTION
PHONEPE_CLIENT_ID=<production_client_id>
PHONEPE_CLIENT_SECRET=<production_client_secret>
REDIRECT_URL_PAYMENT_STATUS=https://your-domain.com
```

---

## 📦 What Changed?

### Added

- ✅ PhonePe SDK integration (`pg-sdk-node`)
- ✅ Automatic SDK/legacy mode switching
- ✅ Enhanced configuration options

### Unchanged

- ✅ All API endpoints
- ✅ Request/response formats
- ✅ Payment callback handling
- ✅ Transaction status checking
- ✅ Refund functionality

---

## 📚 Full Documentation

For detailed information, see: [`PHONEPE_SDK_INTEGRATION.md`](./PHONEPE_SDK_INTEGRATION.md)

---

## ✅ That's It!

You're ready to use the new PhonePe SDK integration! 🎉

**Need Help?**

- Check logs: `tail -f server.log`
- Review documentation: `PHONEPE_SDK_INTEGRATION.md`
- Test in sandbox first before going live
