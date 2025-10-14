# PhonePe Backend Features - React Native Integration Guide

> **Complete documentation of PhonePe payment gateway features implemented in the backend for React Native mobile app integration**

## 📋 Table of Contents

- [Overview](#overview)
- [Security Features](#security-features)
- [Backend Architecture](#backend-architecture)
- [API Endpoints](#api-endpoints)
- [Integration Flow](#integration-flow)
- [Request/Response Formats](#requestresponse-formats)
- [Error Handling](#error-handling)
- [Environment Configuration](#environment-configuration)
- [Testing](#testing)
- [Best Practices](#best-practices)

---

## 🎯 Overview

The backend has implemented a **production-ready PhonePe payment gateway integration** with the following capabilities:

### ✅ Core Features Implemented

1. **PhonePe SDK Integration** (`pg-sdk-node` v2.0.2)

   - Official PhonePe SDK for secure payments
   - Automatic fallback to legacy API if SDK fails
   - Industry-standard security practices

2. **Dual Payment Modes**

   - **PhonePe Online Payment**: UPI, Cards, Net Banking, Wallets
   - **Cash on Delivery (COD)**: Order creation without payment

3. **Comprehensive Payment Operations**

   - Payment initiation with stock locking
   - Payment status checking
   - Refund processing
   - Transaction history
   - Bulk status checks

4. **Advanced Features**

   - Promotion/coupon validation and redemption
   - Stock quantity locking during checkout
   - Automatic stock release for abandoned carts (15 minutes)
   - Order creation after successful payment
   - Product quantity updates
   - GCP Cloud Tasks integration for async operations

5. **Security Features**
   - Webhook signature validation
   - Request encryption/checksum verification
   - Transaction status verification
   - Idempotency support

---

## 🔒 Security Features

### 1. **PhonePe SDK Security**

```typescript
// Backend uses official PhonePe SDK with secure credential management
const sdkClient = StandardCheckoutClient.getInstance(
  CLIENT_ID, // From secure environment variables
  CLIENT_SECRET, // Never exposed to frontend
  CLIENT_VERSION,
  Env.PRODUCTION // Sandbox/Production environment
);
```

### 2. **Webhook Signature Validation**

- All webhook callbacks are validated using PhonePe's signature mechanism
- Prevents unauthorized transaction status updates
- Uses SHA256 HMAC verification

### 3. **Checksum Verification**

```typescript
// Backend generates and verifies checksums for all API calls
const checksum = sha256(payload + apiPath + saltKey) + "###" + keyIndex;
```

### 4. **Secure Credential Storage**

- All sensitive credentials stored in environment variables
- Never exposed in API responses
- Separate credentials for sandbox/production

### 5. **Transaction Validation**

- Double verification of payment status before order creation
- Transaction state checks at multiple stages
- Automatic rollback on failures

### 6. **Stock Locking Mechanism**

```typescript
// Prevents overselling during checkout
- Lock stock when payment initiated
- Auto-release after 15 minutes if payment not completed
- Convert locks to orders on successful payment
```

---

## 🏗️ Backend Architecture

### Payment Flow Architecture

```
┌─────────────────┐
│  React Native   │
│   Mobile App    │
└────────┬────────┘
         │
         │ POST /v1/phonepe/initiate
         │
┌────────▼────────────────────────────────────────────┐
│  Backend - PhonePe Controller                       │
│  ┌──────────────────────────────────────────────┐  │
│  │ 1. Validate Request                          │  │
│  │ 2. Validate Promotions/Coupons               │  │
│  │ 3. Lock Stock Quantities                     │  │
│  │ 4. Create Transaction Record                 │  │
│  │ 5. Call PhonePe SDK                          │  │
│  │ 6. Schedule Lock Cleanup Task (15 min)       │  │
│  └──────────────────────────────────────────────┘  │
└────────┬────────────────────────────────────────────┘
         │
         │ Returns: { redirectUrl, transactionId }
         │
┌────────▼────────┐
│   PhonePe SDK   │
│  Payment Page   │
└────────┬────────┘
         │
         │ User completes payment
         │
┌────────▼────────────────────────────────────────────┐
│  Callback URL: /v1/phonepe/callback/:transactionId  │
│  ┌──────────────────────────────────────────────┐  │
│  │ 1. Verify Payment Status                     │  │
│  │ 2. Update Transaction Status                 │  │
│  │ 3. Create Order & Order Lines                │  │
│  │ 4. Redeem Promotions                         │  │
│  │ 5. Update Product Quantities                 │  │
│  │ 6. Convert Lock Qty to Available Qty         │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### SDK vs Legacy Mode

The backend automatically chooses the best method:

| Feature            | SDK Mode (Recommended) | Legacy Mode (Fallback) |
| ------------------ | ---------------------- | ---------------------- |
| **Security**       | ✅ Enhanced with SDK   | ✅ Standard HMAC       |
| **API Calls**      | SDK handles            | Manual HTTP calls      |
| **Error Handling** | SDK exceptions         | HTTP errors            |
| **Maintenance**    | Official updates       | Manual updates         |
| **Fallback**       | Auto to legacy         | N/A                    |

---

## 📡 API Endpoints

### Base URL

```
Production: https://your-domain.com/v1/phonepe
Sandbox: https://your-dev-domain.com/v1/phonepe
```

### 1. **Initiate Payment** 🔥 Most Important

```http
POST /v1/phonepe/initiate
```

**Purpose**: Start a payment transaction (PhonePe or COD)

**Request Body**:

```json
{
  "mode": "phonepe", // "phonepe" or "cod"
  "evaluation_ids": ["eval_123", "eval_456"], // Optional: promotion IDs
  "order": [
    {
      "addressid": 1,
      "cartId": 123,
      "discountamount": 50.0,
      "orderamount": 950.0,
      "productamount": 1000.0,
      "productcategory": "Electronics",
      "productid": 456,
      "productname": "Wireless Mouse",
      "quantity": 2,
      "userid": 789
    }
  ],
  "transaction": {
    "amount": 950.0,
    "mobilenumber": "9876543210",
    "name": "John Doe",
    "productid": [456, 789],
    "transactionfor": "product",
    "userId": 789
  }
}
```

**Success Response (PhonePe Mode)**:

```json
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "merchantTransactionId": "TXN_1704067200000_ABC123",
    "redirectUrl": "https://mercury.phonepe.com/transact/...",
    "amount": 950.0,
    "status": "INITIATED",
    "mode": "phonepe",
    "message": "Redirect user to PhonePe payment page",

    "validation_summary": {
      "promotions_validated": 2,
      "products_validated": 2,
      "stock_validated": 2,
      "all_validations_passed": true
    },

    "promotion_status": {
      "valid_evaluations": ["eval_123"],
      "limit_reached_evaluations": ["eval_456"],
      "action_required": "apply_another_coupon",
      "total_applied": 1,
      "total_attempted": 2
    },

    "stock_locking": {
      "platform": "nivapp",
      "total_products_locked": 2,
      "lock_status": "success",
      "products": [
        {
          "productId": 456,
          "productName": "Wireless Mouse",
          "quantity_locked": 2,
          "before": { "availableqty": 100, "lockqty": 0 },
          "after": { "availableqty": 98, "lockqty": 2 },
          "note": "Stock locked for 15 minutes"
        }
      ],
      "message": "Stock reserved for 15 minutes"
    },

    "next_steps": {
      "phonepe": {
        "action": "redirect_to_payment",
        "redirectUrl": "https://mercury.phonepe.com/...",
        "instructions": "Redirect user to PhonePe payment page",
        "stock_status": "locked_until_payment_complete",
        "lock_duration": "15 minutes"
      }
    }
  }
}
```

**Success Response (COD Mode)**:

```json
{
  "success": true,
  "message": "COD order created successfully",
  "data": {
    "merchantTransactionId": "TXN_1704067200000_ABC123",
    "redirectUrl": null,
    "amount": 950.0,
    "status": "COD_ORDER_CREATED",
    "mode": "cod",
    "message": "Order created successfully",

    "orderData": {
      "orderId": 123,
      "orderid": "ORD_1704067200000",
      "status": "pending",
      "created_at": 1704067200000,
      "order_created": true
    },

    "next_steps": {
      "cod": {
        "action": "show_order_confirmation",
        "order_id": 123,
        "instructions": "Show order confirmation to user",
        "stock_status": "converted_to_order",
        "lockqty_status": "reset_to_0"
      }
    }
  }
}
```

---

### 2. **Check Payment Status**

```http
GET /v1/phonepe/status/:merchantTransactionId
```

**Purpose**: Check current status of a payment

**Response**:

```json
{
  "success": true,
  "message": "Payment status retrieved successfully",
  "data": {
    "merchantTransactionId": "TXN_1704067200000_ABC123",
    "status": "PAYMENT_SUCCESS",
    "success": true,
    "message": "Payment completed successfully",
    "paymentData": {
      "transactionId": "PHONEPE_TXN_789",
      "amount": 95000, // in paise
      "state": "COMPLETED",
      "responseCode": "SUCCESS",
      "paymentInstrument": {
        "type": "UPI",
        "utr": "123456789012"
      }
    }
  }
}
```

---

### 3. **User Transaction History**

```http
GET /v1/phonepe/user/:userId/transactions?page=1&limit=10
```

**Purpose**: Get paginated transaction history for a user

**Response**:

```json
{
  "success": true,
  "message": "Transaction history retrieved successfully",
  "data": {
    "data": [
      {
        "id": 123,
        "merchanttransactionid": "TXN_123",
        "amount": 950.0,
        "status": "SUCCESS",
        "createddate": 1704067200000,
        "productid": [456, 789],
        "transactionfor": "product"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "pageSize": 10,
      "total": 50,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "meta": {
    "userId": 789,
    "page": 1,
    "limit": 10
  }
}
```

---

### 4. **Process Refund**

```http
POST /v1/phonepe/refund/:merchantTransactionId
```

**Request Body**:

```json
{
  "refundAmount": 950.0, // Optional, defaults to full amount
  "reason": "Customer requested cancellation"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Refund initiated successfully",
  "data": {
    "merchantTransactionId": "TXN_1704067200000_ABC123",
    "refundId": "REFUND_TXN_1704067200000_ABC123_1704070800000",
    "refundAmount": 950.0,
    "reason": "Customer requested cancellation",
    "status": "REFUND_INITIATED"
  }
}
```

---

### 5. **Create SDK Order** (Mobile App Integration)

```http
POST /v1/phonepe/create-sdk-order
```

**Purpose**: Create an order token for mobile SDK integration

**Request Body**:

```json
{
  "merchantOrderId": "ORDER_123",
  "amount": 950.0,
  "redirectUrl": "myapp://payment/callback",
  "userId": 789,
  "productIds": [456],
  "transactionFor": "product_purchase"
}
```

**Response**:

```json
{
  "success": true,
  "message": "SDK order created successfully",
  "data": {
    "orderToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "orderId": "ORDER_123"
  }
}
```

**Important**: The `orderToken` is a JWT token extracted from PhonePe's `redirectUrl` query parameter, not the `orderId`. This is required for the React Native SDK to work properly.

**Usage in React Native**:

```javascript
// Use the orderToken with PhonePe React Native SDK
import PhonePe from "@phonepe/react-native-phonepe-sdk";

const result = await PhonePe.startTransaction(orderToken);
```

---

### 6. **Transaction Statistics**

```http
GET /v1/phonepe/stats?userId=789
```

**Response**:

```json
{
  "success": true,
  "message": "Transaction statistics retrieved successfully",
  "data": {
    "totalTransactions": 100,
    "successfulTransactions": 85,
    "failedTransactions": 10,
    "totalAmount": 95000.0,
    "averageAmount": 950.0,
    "successRate": 85.0
  },
  "meta": {
    "userId": 789,
    "generatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

---

### 7. **Bulk Status Check**

```http
POST /v1/phonepe/bulk-status
```

**Request Body**:

```json
{
  "merchantTransactionIds": ["TXN_123", "TXN_456", "TXN_789"]
}
```

**Response**:

```json
{
  "success": true,
  "message": "Bulk status check completed",
  "data": [
    {
      "merchantTransaction": "TXN_123",
      "status": "PAYMENT_SUCCESS",
      "success": true
    },
    {
      "merchantTransaction": "TXN_456",
      "status": "PAYMENT_PENDING",
      "success": false
    }
  ],
  "meta": {
    "totalRequested": 3,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

### 8. **Generate Transaction ID**

```http
GET /v1/phonepe/generate-transaction-id?prefix=ORDER
```

**Response**:

```json
{
  "success": true,
  "message": "Transaction ID generated successfully",
  "data": {
    "merchantTransactionId": "ORDER_1704067200000_ABC123",
    "prefix": "ORDER",
    "timestamp": 1704067200000
  }
}
```

---

### 9. **Health Check**

```http
GET /v1/phonepe/health
```

**Response**:

```json
{
  "success": true,
  "message": "PhonePe service is healthy",
  "data": {
    "service": "PhonePe Payment Gateway",
    "status": "operational",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "version": "2.0.0",
    "environment": "PRODUCTION",
    "configuration": {
      "merchantId": "configured",
      "saltKey": "configured",
      "baseUrl": "https://api.phonepe.com",
      "redirectUrls": {
        "success": "https://your-app.com/success",
        "failure": "https://your-app.com/failure",
        "status": "https://your-app.com/status"
      }
    }
  }
}
```

---

## 🔄 Integration Flow for React Native

### Complete Payment Flow

```javascript
// 1. INITIATE PAYMENT
const initiatePayment = async (orderData) => {
  try {
    const response = await fetch(
      "https://api.yourapp.com/v1/phonepe/initiate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          mode: "phonepe",
          evaluation_ids: selectedPromotions,
          order: cartItems.map((item) => ({
            addressid: selectedAddress.id,
            cartId: item.cartId,
            discountamount: item.discount,
            orderamount: item.total,
            productamount: item.price,
            productcategory: item.category,
            productid: item.productId,
            productname: item.name,
            quantity: item.quantity,
            userid: currentUser.id,
          })),
          transaction: {
            amount: calculateTotal(),
            mobilenumber: currentUser.mobile,
            name: currentUser.name,
            productid: cartItems.map((i) => i.productId),
            transactionfor: "product",
            userId: currentUser.id,
          },
        }),
      }
    );

    const result = await response.json();

    if (result.success && result.data.redirectUrl) {
      // 2. REDIRECT TO PHONEPE
      const transactionId = result.data.merchantTransactionId;
      const paymentUrl = result.data.redirectUrl;

      // Open PhonePe payment page in WebView or Browser
      await openPaymentPage(paymentUrl);

      // 3. START POLLING FOR STATUS
      startStatusPolling(transactionId);
    } else {
      // Handle COD or error
      handlePaymentResponse(result);
    }
  } catch (error) {
    console.error("Payment initiation failed:", error);
    showError("Failed to initiate payment");
  }
};

// 2. POLL PAYMENT STATUS
const pollPaymentStatus = async (transactionId) => {
  const maxAttempts = 30; // Poll for 5 minutes (10 sec intervals)
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;

    try {
      const response = await fetch(
        `https://api.yourapp.com/v1/phonepe/status/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      const result = await response.json();

      if (result.data.status === "PAYMENT_SUCCESS") {
        clearInterval(interval);
        handlePaymentSuccess(result.data);
      } else if (result.data.status === "PAYMENT_FAILED") {
        clearInterval(interval);
        handlePaymentFailure(result.data);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        handlePaymentTimeout();
      }
    } catch (error) {
      console.error("Status check failed:", error);
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        handlePaymentError(error);
      }
    }
  }, 10000); // Check every 10 seconds
};

// 3. HANDLE SUCCESS
const handlePaymentSuccess = (data) => {
  // Show success screen
  navigation.navigate("PaymentSuccess", {
    transactionId: data.merchantTransactionId,
    amount: data.paymentData.amount / 100, // Convert from paise
    orderId: data.orderId,
  });

  // Clear cart
  clearCart();

  // Refresh order history
  refreshOrders();
};

// 4. HANDLE FAILURE
const handlePaymentFailure = (data) => {
  navigation.navigate("PaymentFailure", {
    reason: data.message,
    transactionId: data.merchantTransactionId,
  });
};
```

---

### Alternative: Using PhonePe React Native SDK

```javascript
import PhonePe from "@phonepe/react-native-phonepe-sdk";

// 1. Initialize SDK (once in app lifecycle)
const initializePhonePe = async () => {
  try {
    await PhonePe.initialize({
      merchantId: "YOUR_MERCHANT_ID",
      environment: "PRODUCTION", // or 'SANDBOX'
      enableLogging: __DEV__,
    });
  } catch (error) {
    console.error("PhonePe SDK init failed:", error);
  }
};

// 2. Create order on backend and get token
const initiatePaymentWithSDK = async (orderData) => {
  try {
    // Step 1: Get order token from backend
    const response = await fetch(
      "https://api.yourapp.com/v1/phonepe/create-sdk-order",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          merchantOrderId: generateOrderId(),
          amount: calculateTotal(),
          redirectUrl: "myapp://payment/callback",
          userId: currentUser.id,
          productIds: cartItems.map((i) => i.productId),
          transactionFor: "product_purchase",
        }),
      }
    );

    const result = await response.json();

    if (result.success && result.data.orderToken) {
      // Step 2: Start PhonePe SDK transaction
      const sdkResult = await PhonePe.startTransaction(result.data.orderToken);

      // Step 3: Handle result
      if (sdkResult.status === "SUCCESS") {
        // Verify with backend
        await verifyPayment(result.data.orderId);
      } else if (sdkResult.status === "FAILURE") {
        handlePaymentFailure(sdkResult);
      }
    }
  } catch (error) {
    console.error("SDK payment failed:", error);
  }
};

// 3. Verify payment with backend
const verifyPayment = async (orderId) => {
  const response = await fetch(
    `https://api.yourapp.com/v1/phonepe/status/${orderId}`,
    {
      headers: { Authorization: `Bearer ${userToken}` },
    }
  );

  const result = await response.json();

  if (result.data.status === "PAYMENT_SUCCESS") {
    handlePaymentSuccess(result.data);
  }
};
```

---

## ⚠️ Error Handling

### Common Error Responses

#### 1. **Validation Error (400)**

```json
{
  "success": false,
  "message": "Validation failed",
  "details": "mobileNumber must be a valid 10-digit number",
  "statusCode": 400
}
```

#### 2. **Transaction Not Found (404)**

```json
{
  "success": false,
  "message": "Transaction not found",
  "statusCode": 404
}
```

#### 3. **Payment Failed (400)**

```json
{
  "success": false,
  "message": "Payment initiation failed",
  "error": "Insufficient stock for product XYZ",
  "statusCode": 400
}
```

#### 4. **Server Error (500)**

```json
{
  "success": false,
  "message": "Internal server error",
  "details": "Failed to process payment",
  "statusCode": 500
}
```

### Error Handling in React Native

```javascript
const handleApiCall = async (apiCall) => {
  try {
    const response = await apiCall();
    const result = await response.json();

    if (!result.success) {
      // Handle business logic errors
      switch (result.statusCode) {
        case 400:
          showAlert("Validation Error", result.message);
          break;
        case 404:
          showAlert("Not Found", result.message);
          break;
        case 500:
          showAlert("Server Error", "Please try again later");
          break;
        default:
          showAlert("Error", result.message);
      }
      return null;
    }

    return result.data;
  } catch (error) {
    // Handle network errors
    console.error("API call failed:", error);
    showAlert("Network Error", "Please check your connection");
    return null;
  }
};
```

---

## 🔧 Environment Configuration

### Backend Environment Variables Required

```env
# PhonePe SDK Configuration (Recommended)
PHONEPE_CLIENT_ID=your_client_id_from_phonepe_dashboard
PHONEPE_CLIENT_SECRET=your_client_secret_from_phonepe_dashboard
PHONEPE_CLIENT_VERSION=1
PHONEPE_ENVIRONMENT=PRODUCTION  # or SANDBOX
PHONEPE_USE_SDK=true

# Legacy Configuration (Fallback)
PHONEPE_MERCHANT_ID=your_merchant_id
PHONEPE_SALT_KEY=your_salt_key
PHONEPE_BASE_URL=https://api.phonepe.com/apis/hermes

# Callback URLs
REDIRECT_URL_PAYMENT_STATUS=https://your-backend.com
REDIRECT_URL_SUCCESS=https://your-app.com/payment/success
REDIRECT_URL_FAILURE=https://your-app.com/payment/failure

# GCP Cloud Tasks (for lock cleanup)
GCP_PROJECT_ID=your-gcp-project
GCP_LOCATION=asia-south1
GCP_QUEUE_NAME=phonepe-lock-cleanup
GCP_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
```

### Frontend Environment Variables

```javascript
// .env
API_BASE_URL=https://api.yourapp.com
PHONEPE_MERCHANT_ID=your_merchant_id  // Only for display purposes
```

---

## 🧪 Testing

### Test Credentials (Sandbox)

PhonePe provides test credentials for sandbox testing:

```
Environment: SANDBOX
Test UPI ID: success@ybl (for successful payments)
Test UPI ID: failure@ybl (for failed payments)
Test Card: 4111 1111 1111 1111
```

### Testing Checklist

#### ✅ Payment Initiation

- [ ] Successful payment initiation
- [ ] Invalid product ID
- [ ] Insufficient stock
- [ ] Invalid mobile number format
- [ ] Invalid amount (0 or negative)
- [ ] Missing required fields

#### ✅ Payment Processing

- [ ] Successful payment completion
- [ ] Failed payment
- [ ] Cancelled payment
- [ ] Timeout scenario
- [ ] Network failure during payment

#### ✅ Stock Management

- [ ] Stock locked on initiation
- [ ] Stock released on failure
- [ ] Stock released after 15 minutes timeout
- [ ] Stock converted to order on success

#### ✅ Promotions

- [ ] Valid coupon application
- [ ] Expired coupon
- [ ] Usage limit reached
- [ ] Invalid coupon code
- [ ] Multiple coupons stacking

#### ✅ Refunds

- [ ] Full refund
- [ ] Partial refund
- [ ] Refund for non-existent transaction
- [ ] Refund status check

### Test Scenarios

```javascript
// Test Case 1: Successful Payment
const testSuccessfulPayment = async () => {
  const response = await initiatePayment({
    amount: 100.0,
    productId: 1,
    userId: 1,
    // ... other fields
  });

  expect(response.success).toBe(true);
  expect(response.data.redirectUrl).toBeDefined();
  expect(response.data.status).toBe("INITIATED");
};

// Test Case 2: Insufficient Stock
const testInsufficientStock = async () => {
  const response = await initiatePayment({
    amount: 100.0,
    productId: 999, // Out of stock product
    quantity: 1000,
    // ... other fields
  });

  expect(response.success).toBe(false);
  expect(response.message).toContain("stock");
};

// Test Case 3: COD Order
const testCODOrder = async () => {
  const response = await initiatePayment({
    mode: "cod",
    // ... other fields
  });

  expect(response.success).toBe(true);
  expect(response.data.mode).toBe("cod");
  expect(response.data.orderData).toBeDefined();
};
```

---

## 🎯 Best Practices

### 1. **Transaction ID Generation**

Always use the backend-generated transaction ID:

```javascript
// ❌ DON'T: Generate on frontend
const transactionId = `TXN_${Date.now()}`;

// ✅ DO: Get from backend
const response = await fetch(
  "/v1/phonepe/generate-transaction-id?prefix=ORDER"
);
const { merchantTransactionId } = await response.json();
```

### 2. **Status Polling**

Implement exponential backoff for status polling:

```javascript
const pollWithBackoff = async (transactionId) => {
  const delays = [5, 10, 15, 20, 30]; // seconds

  for (let i = 0; i < delays.length; i++) {
    await sleep(delays[i] * 1000);

    const status = await checkStatus(transactionId);
    if (status.isFinal) return status;
  }
};
```

### 3. **Secure Storage**

Never store sensitive data:

```javascript
// ❌ DON'T: Store in AsyncStorage
AsyncStorage.setItem("payment_token", token);

// ✅ DO: Store only transaction reference
AsyncStorage.setItem("transaction_id", transactionId);
```

### 4. **Error Recovery**

Implement retry logic with limits:

```javascript
const retryPayment = async (attempt = 1) => {
  const maxRetries = 3;

  try {
    return await initiatePayment(orderData);
  } catch (error) {
    if (attempt < maxRetries) {
      await sleep(attempt * 2000); // Exponential backoff
      return retryPayment(attempt + 1);
    }
    throw error;
  }
};
```

### 5. **User Experience**

Show clear loading and status messages:

```javascript
const PaymentScreen = () => {
  const [status, setStatus] = useState("initiating");

  const messages = {
    initiating: "Preparing your payment...",
    locking_stock: "Reserving items in your cart...",
    validating: "Validating promotions...",
    redirecting: "Redirecting to payment page...",
    processing: "Processing payment...",
    creating_order: "Creating your order...",
    success: "Payment successful!",
    failed: "Payment failed",
  };

  return (
    <View>
      <ActivityIndicator />
      <Text>{messages[status]}</Text>
    </View>
  );
};
```

### 6. **Timeout Handling**

Set reasonable timeouts:

```javascript
const PAYMENT_TIMEOUT = 15 * 60 * 1000; // 15 minutes

const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error("Payment timeout")), PAYMENT_TIMEOUT)
);

const paymentPromise = initiatePayment(orderData);

try {
  const result = await Promise.race([paymentPromise, timeoutPromise]);
} catch (error) {
  handleTimeout();
}
```

### 7. **Network State Monitoring**

Check connectivity before payment:

```javascript
import NetInfo from "@react-native-community/netinfo";

const checkConnectivity = async () => {
  const state = await NetInfo.fetch();

  if (!state.isConnected) {
    showAlert("No Internet", "Please check your connection");
    return false;
  }

  return true;
};

const initiatePayment = async (orderData) => {
  if (!(await checkConnectivity())) return;

  // Proceed with payment
};
```

### 8. **Deep Linking**

Handle payment callbacks via deep links:

```javascript
// App.js
import { Linking } from "react-native";

useEffect(() => {
  const handleDeepLink = (event) => {
    const { url } = event;

    // myapp://payment/callback?transactionId=TXN_123&status=success
    if (url.includes("payment/callback")) {
      const params = parseUrl(url);
      handlePaymentCallback(params);
    }
  };

  Linking.addEventListener("url", handleDeepLink);

  return () => {
    Linking.removeEventListener("url", handleDeepLink);
  };
}, []);
```

---

## 📊 Monitoring and Analytics

### Events to Track

```javascript
// Track payment initiation
analytics.logEvent("payment_initiated", {
  amount: orderTotal,
  mode: "phonepe",
  items_count: cartItems.length,
  has_promotions: promotions.length > 0,
});

// Track payment success
analytics.logEvent("payment_success", {
  transaction_id: transactionId,
  amount: orderTotal,
  payment_method: paymentMethod,
});

// Track payment failure
analytics.logEvent("payment_failed", {
  transaction_id: transactionId,
  error_code: errorCode,
  error_message: errorMessage,
});

// Track refund
analytics.logEvent("refund_initiated", {
  transaction_id: transactionId,
  refund_amount: refundAmount,
  reason: refundReason,
});
```

---

## 🔐 Security Checklist

### ✅ Frontend Security

- [ ] Never store API keys in frontend code
- [ ] Use environment variables for configuration
- [ ] Implement SSL pinning for API calls
- [ ] Validate all user inputs before sending to backend
- [ ] Use secure storage for sensitive data
- [ ] Implement certificate validation
- [ ] Obfuscate production builds

### ✅ Backend Security (Already Implemented)

- [x] PhonePe SDK with secure credentials
- [x] Webhook signature validation
- [x] Checksum verification for all API calls
- [x] Environment variable based configuration
- [x] Transaction state verification
- [x] Idempotency support
- [x] Rate limiting on endpoints
- [x] SQL injection prevention
- [x] XSS protection

---

## 📞 Support and Troubleshooting

### Common Issues

#### Issue 1: Payment Stuck in Pending State

**Symptoms**: Payment shows pending even after completion

**Solution**:

```javascript
// 1. Check payment status manually
const status = await fetch(`/v1/phonepe/status/${transactionId}`);

// 2. If backend shows success but frontend doesn't reflect:
// - Clear app cache
// - Sync with backend status

// 3. Implement status sync mechanism
const syncPaymentStatus = async (transactionId) => {
  const backendStatus = await fetchStatusFromBackend(transactionId);
  const localStatus = await getLocalStatus(transactionId);

  if (backendStatus !== localStatus) {
    updateLocalStatus(transactionId, backendStatus);
    notifyUser(backendStatus);
  }
};
```

#### Issue 2: Stock Not Released After Timeout

**Symptoms**: Items remain locked in cart after 15 minutes

**Backend Solution**: GCP Cloud Tasks handles automatic cleanup

**Frontend Solution**:

```javascript
// Poll status after timeout period
const checkLockStatus = async (transactionId) => {
  const status = await fetchStatus(transactionId);

  if (status.status === "EXPIRED") {
    // Stock has been released
    showMessage("Transaction expired. Please try again.");
    clearCart();
  }
};
```

#### Issue 3: Promotion Validation Fails

**Symptoms**: Valid coupon shows as invalid

**Solution**:

```javascript
// 1. Check promotion status before payment
const validatePromotion = async (promotionId) => {
  const response = await fetch(`/v1/promotions/validate/${promotionId}`, {
    method: "POST",
    body: JSON.stringify({
      userId: currentUser.id,
      cartItems: cartItems,
    }),
  });

  return response.json();
};

// 2. Show detailed error to user
if (result.promotion_status.invalid_evaluations.length > 0) {
  showAlert(
    "Coupon Error",
    result.promotion_status.invalid_evaluations[0].reason
  );
}
```

---

## 📝 Complete Example: React Native Payment Component

```javascript
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

const PaymentComponent = ({ cartItems, totalAmount, selectedAddress }) => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("idle");

  const API_BASE = "https://api.yourapp.com/v1/phonepe";

  const initiatePayment = async (mode = "phonepe") => {
    setLoading(true);
    setPaymentStatus("initiating");

    try {
      // Prepare order data
      const orderData = {
        mode,
        evaluation_ids: selectedPromotions,
        order: cartItems.map((item) => ({
          addressid: selectedAddress.id,
          cartId: item.cartId,
          discountamount: item.discount || 0,
          orderamount: item.total,
          productamount: item.price,
          productcategory: item.category,
          productid: item.productId,
          productname: item.name,
          quantity: item.quantity,
          userid: currentUser.id,
        })),
        transaction: {
          amount: totalAmount,
          mobilenumber: currentUser.mobile,
          name: currentUser.name,
          productid: cartItems.map((i) => i.productId),
          transactionfor: "product",
          userId: currentUser.id,
        },
      };

      // Call backend API
      const response = await fetch(`${API_BASE}/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (result.success) {
        if (mode === "phonepe" && result.data.redirectUrl) {
          // Open PhonePe payment page
          await openPaymentUrl(result.data.redirectUrl);

          // Start polling for status
          pollPaymentStatus(result.data.merchantTransactionId);
        } else if (mode === "cod") {
          // COD order created
          handleCODSuccess(result.data);
        }
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Payment initiation failed:", error);
      Alert.alert("Error", error.message);
      setPaymentStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (transactionId) => {
    const maxAttempts = 30;
    let attempts = 0;

    const pollInterval = setInterval(async () => {
      attempts++;

      try {
        const response = await fetch(`${API_BASE}/status/${transactionId}`, {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        });

        const result = await response.json();

        if (result.data.status === "PAYMENT_SUCCESS") {
          clearInterval(pollInterval);
          handlePaymentSuccess(result.data);
        } else if (
          result.data.status === "PAYMENT_FAILED" ||
          result.data.status === "TRANSACTION_NOT_FOUND"
        ) {
          clearInterval(pollInterval);
          handlePaymentFailure(result.data);
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          handlePaymentTimeout();
        }
      } catch (error) {
        console.error("Status check failed:", error);
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          handlePaymentError(error);
        }
      }
    }, 10000);
  };

  const handlePaymentSuccess = (data) => {
    setPaymentStatus("success");

    navigation.navigate("OrderSuccess", {
      transactionId: data.merchantTransactionId,
      amount: data.paymentData?.amount / 100,
      orderId: data.orderId,
    });

    // Clear cart
    clearCart();
  };

  const handlePaymentFailure = (data) => {
    setPaymentStatus("failed");

    Alert.alert(
      "Payment Failed",
      data.message || "Your payment could not be processed.",
      [
        { text: "Try Again", onPress: () => initiatePayment() },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleCODSuccess = (data) => {
    setPaymentStatus("success");

    navigation.navigate("OrderSuccess", {
      orderId: data.orderData.orderId,
      orderIdDisplay: data.orderData.orderid,
      amount: totalAmount,
      mode: "cod",
    });

    clearCart();
  };

  return (
    <View style={styles.container}>
      <View style={styles.paymentOptions}>
        <TouchableOpacity
          style={[styles.paymentButton, styles.phonepeButton]}
          onPress={() => initiatePayment("phonepe")}
          disabled={loading}
        >
          {loading && paymentStatus === "initiating" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Pay with PhonePe</Text>
              <Text style={styles.buttonSubtext}>
                UPI, Cards, Net Banking, Wallets
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.paymentButton, styles.codButton]}
          onPress={() => initiatePayment("cod")}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Cash on Delivery</Text>
          <Text style={styles.buttonSubtext}>
            Pay when you receive your order
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.statusText}>
            {getStatusMessage(paymentStatus)}
          </Text>
        </View>
      )}
    </View>
  );
};

const getStatusMessage = (status) => {
  const messages = {
    idle: "",
    initiating: "Preparing your payment...",
    locking_stock: "Reserving items...",
    redirecting: "Redirecting to payment...",
    processing: "Processing payment...",
    success: "Payment successful!",
    failed: "Payment failed",
  };
  return messages[status] || "";
};

export default PaymentComponent;
```

---

## 🎓 Summary

### What's Implemented in Backend

✅ **PhonePe SDK Integration** (official `pg-sdk-node`)
✅ **Dual Payment Modes** (PhonePe + COD)
✅ **Stock Management** (locking, auto-release)
✅ **Promotion System** (validation, redemption)
✅ **Order Management** (creation, tracking)
✅ **Refund Processing** (full/partial)
✅ **Transaction History** (paginated)
✅ **Webhook Handling** (secure validation)
✅ **GCP Cloud Tasks** (async lock cleanup)
✅ **Security Features** (checksums, signatures)
✅ **Error Handling** (comprehensive)
✅ **Logging & Monitoring** (detailed)

### What Frontend Needs to Do

1. **Call `/initiate` endpoint** with order details
2. **Handle redirect URL** (open in WebView or browser)
3. **Poll `/status` endpoint** to check payment completion
4. **Handle callbacks** (success/failure/timeout)
5. **Update UI** based on payment status
6. **Implement error handling** for network/API failures
7. **Add analytics tracking** for monitoring

### Key Points for React Native Integration

- ✅ Backend is **production-ready** and **secure**
- ✅ All API endpoints are **well-documented**
- ✅ **Automatic fallback** mechanisms in place
- ✅ **Comprehensive error handling** implemented
- ✅ **Stock management** prevents overselling
- ✅ **15-minute timeout** for abandoned carts
- ✅ **Webhook validation** ensures security
- ✅ **SDK integration** follows industry standards

---

## 📚 Additional Resources

### Official Documentation

- [PhonePe API Documentation](https://developer.phonepe.com/v1/docs)
- [PhonePe React Native SDK](https://github.com/phonepe/react-native-phonepe-sdk)
- [PhonePe Test Credentials](https://developer.phonepe.com/v1/docs/test-credentials)

### Internal Documentation

- `PHONEPE_SDK_INTEGRATION.md` - Detailed SDK implementation
- `PHONEPE_QUICK_START.md` - Quick setup guide
- `INTEGRATION_SUMMARY.md` - Integration summary

---

## 🤝 Support

For backend-related issues:

- Check application logs: `server.log`
- Review API responses for error details
- Test in sandbox environment first

For PhonePe-specific issues:

- Contact PhonePe merchant support
- Check PhonePe developer portal
- Verify merchant credentials

---

**Last Updated**: January 2025  
**Backend Version**: 2.0.0  
**PhonePe SDK Version**: 2.0.2  
**API Version**: v1

---

**🎉 Happy Coding!**
