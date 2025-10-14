# PhonePe SDK Integration Guide

## Overview

The PhonePe integration has been updated to use the official **PhonePe SDK (`pg-sdk-node`)** while maintaining full backward compatibility with the legacy implementation. The system automatically chooses between SDK and legacy methods based on available credentials.

## Features

✅ **Seamless Integration** - Uses official PhonePe SDK for improved reliability  
✅ **Backward Compatible** - Falls back to legacy integration if SDK credentials are not provided  
✅ **Zero Breaking Changes** - All existing APIs and response formats remain unchanged  
✅ **Smart Fallback** - Automatically switches to legacy method if SDK initialization fails  
✅ **Enhanced Logging** - Detailed logs for debugging and monitoring

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# ========================================
# PhonePe SDK Configuration (Recommended)
# ========================================

# Get these credentials from your PhonePe Dashboard
PHONEPE_CLIENT_ID=your_client_id_here
PHONEPE_CLIENT_SECRET=your_client_secret_here
PHONEPE_CLIENT_VERSION=1
PHONEPE_ENVIRONMENT=SANDBOX  # Use PRODUCTION for live environment
PHONEPE_USE_SDK=true  # Set to false to force legacy integration

# ========================================
# Legacy Configuration (Fallback)
# ========================================

# Keep these for backward compatibility
PHONEPE_MERCHANT_ID=PGTESTPAYUAT86
PHONEPE_SALT_KEY=96434309-7796-489d-8924-ab56988a6076
PHONEPE_BASE_URL=https://api-preprod.phonepe.com/apis/pg-sandbox

# ========================================
# Redirect URLs
# ========================================

REDIRECT_URL_SUCCESS=http://localhost:5600/payment/success
REDIRECT_URL_FAILURE=http://localhost:5600/payment/failure
REDIRECT_URL_PAYMENT_STATUS=http://localhost:5600
```

### Configuration Priority

The service follows this priority order:

1. **SDK Mode** (if `PHONEPE_CLIENT_ID` and `PHONEPE_CLIENT_SECRET` are provided and `PHONEPE_USE_SDK=true`)

   - Uses official PhonePe SDK
   - Recommended for new integrations
   - Better error handling and type safety

2. **Legacy Mode** (fallback)
   - Uses direct API calls with axios
   - Activated when SDK credentials are missing or `PHONEPE_USE_SDK=false`
   - Maintains existing functionality

## How It Works

### SDK Integration Flow

```
┌─────────────────┐
│  Service Init   │
└────────┬────────┘
         │
         ├── Check SDK credentials?
         │
         ├─── YES ──┐
         │          │
         │   ┌──────▼───────┐
         │   │  Initialize  │
         │   │  SDK Client  │
         │   └──────┬───────┘
         │          │
         │   ┌──────▼────────┐
         │   │ Use SDK.pay() │
         │   └───────────────┘
         │
         └─── NO ───┐
                    │
             ┌──────▼──────────┐
             │  Use Legacy     │
             │  axios calls    │
             └─────────────────┘
```

### Payment Initiation

**SDK Method:**

```typescript
const metaInfo = MetaInfo.builder()
  .udf1(userId.toString())
  .udf2(transactionFor)
  .udf3(productIds.join(","))
  .udf4(name)
  .udf5(mobileNumber)
  .build();

const request = StandardCheckoutPayRequest.builder()
  .merchantOrderId(merchantTransactionId)
  .amount(amountInPaise)
  .redirectUrl(callbackUrl)
  .metaInfo(metaInfo)
  .build();

const response = await sdkClient.pay(request);
```

**Legacy Method:**

```typescript
// Base64 encoded payload + checksum
// Direct axios call to PhonePe API
```

## API Usage

### No Changes Required!

The existing API endpoints and request/response formats remain **exactly the same**:

```typescript
// Same interface as before
interface PhonePePaymentRequest {
  merchantTransactionId: string;
  amount: number;
  name: string;
  mobileNumber: string;
  userId: number;
  productIds?: number[];
  transactionFor?: string;
  callbackUrl?: string;
}

// Same response format
{
  success: boolean;
  message: string;
  redirectUrl?: string;
  transactionId?: string;
  error?: string;
}
```

### Example API Call

```bash
POST /v1/phonepe/initiate-payment
Content-Type: application/json

{
  "merchantTransactionId": "TXN_1234567890",
  "amount": 100.50,
  "name": "John Doe",
  "mobileNumber": "9876543210",
  "userId": 123,
  "productIds": [1, 2, 3],
  "transactionFor": "product_purchase"
}
```

## MetaData Mapping

The SDK's `metaInfo` is populated with your custom fields:

| UDF Field | Maps To        | Description                 |
| --------- | -------------- | --------------------------- |
| udf1      | userId         | User identifier             |
| udf2      | transactionFor | Purpose of transaction      |
| udf3      | productIds     | Comma-separated product IDs |
| udf4      | name           | Customer name               |
| udf5      | mobileNumber   | Customer mobile number      |

## Logging

Enhanced logging helps you understand which integration is being used:

```json
{
  "level": "info",
  "msg": "PhonePe SDK client initialized successfully",
  "environment": "SANDBOX",
  "clientVersion": 1,
  "usingSDK": true
}
```

Or when using legacy:

```json
{
  "level": "info",
  "msg": "Using legacy PhonePe integration",
  "usingSDK": false,
  "reason": "SDK credentials not provided or SDK disabled"
}
```

## Testing

### Testing with SDK (Sandbox)

1. Get test credentials from PhonePe Dashboard
2. Set environment variables:

   ```env
   PHONEPE_CLIENT_ID=<your_test_client_id>
   PHONEPE_CLIENT_SECRET=<your_test_client_secret>
   PHONEPE_ENVIRONMENT=SANDBOX
   PHONEPE_USE_SDK=true
   ```

3. Restart your application
4. Check logs to confirm SDK initialization
5. Make a test payment

### Testing Legacy Mode

1. Set environment variables:

   ```env
   PHONEPE_USE_SDK=false
   # OR simply don't set CLIENT_ID and CLIENT_SECRET
   ```

2. System automatically falls back to legacy integration
3. All existing functionality works as before

## Migration Guide

### For Existing Deployments

**Option 1: Gradual Migration (Recommended)**

1. Deploy the updated code
2. Keep `PHONEPE_USE_SDK=false` or don't set SDK credentials
3. System continues using legacy method
4. When ready, add SDK credentials to switch over

**Option 2: Immediate SDK Adoption**

1. Get PhonePe SDK credentials
2. Add to environment variables
3. Deploy and restart
4. Monitor logs to confirm SDK is being used

### Production Checklist

- [ ] Obtain production PhonePe CLIENT_ID and CLIENT_SECRET
- [ ] Set `PHONEPE_ENVIRONMENT=PRODUCTION`
- [ ] Update redirect URLs to production domains
- [ ] Test payment flow in sandbox first
- [ ] Verify callback handling works correctly
- [ ] Monitor logs after deployment
- [ ] Keep legacy credentials as fallback

## Troubleshooting

### SDK Not Initializing?

**Check:**

1. Are `PHONEPE_CLIENT_ID` and `PHONEPE_CLIENT_SECRET` set correctly?
2. Is `PHONEPE_USE_SDK=true`?
3. Check application logs for initialization errors

**Solution:**

- System automatically falls back to legacy mode if SDK fails
- No downtime or payment failures

### Need to Force Legacy Mode?

Set either:

```env
PHONEPE_USE_SDK=false
```

Or remove SDK credentials entirely.

### Debugging

Enable detailed logging by checking:

```typescript
// Look for these log entries:
- "PhonePe SDK client initialized successfully"
- "Using legacy PhonePe integration"
- "Initiating PhonePe payment" (includes usingSDK: boolean)
```

## Security Notes

🔒 **Important:**

- Never commit `.env` file to version control
- Keep CLIENT_SECRET secure
- Use different credentials for sandbox and production
- Rotate credentials periodically
- Monitor for unauthorized access

## Benefits of SDK Integration

1. **Type Safety** - TypeScript definitions for all SDK methods
2. **Automatic Updates** - Get PhonePe API updates automatically
3. **Better Error Handling** - Standardized error messages
4. **Reduced Maintenance** - No need to maintain checksum logic
5. **Official Support** - Backed by PhonePe team

## Support

For issues or questions:

- **SDK Issues**: [PhonePe Developer Portal](https://developer.phonepe.com/)
- **Integration Issues**: Check application logs
- **Business Queries**: PhonePe merchant support

## Version History

| Version | Date | Changes                                                   |
| ------- | ---- | --------------------------------------------------------- |
| 2.0.0   | 2024 | Added PhonePe SDK integration with backward compatibility |
| 1.0.0   | 2024 | Legacy PhonePe integration                                |

---

**Made with ❤️ for seamless payment integration**
