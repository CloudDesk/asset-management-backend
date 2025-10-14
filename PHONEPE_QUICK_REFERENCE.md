# PhonePe Integration - Quick Reference Guide

> **Quick reference for React Native developers integrating with PhonePe backend**

## 🚀 Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
# If using PhonePe React Native SDK (optional)
npm install @phonepe/react-native-phonepe-sdk

# For HTTP requests
npm install axios
# or use fetch (built-in)
```

### 2. Configure Environment

```javascript
// config.js
export const API_CONFIG = {
  BASE_URL: "https://api.yourapp.com",
  PHONEPE_BASE: "/v1/phonepe",
  TIMEOUT: 30000,
};
```

### 3. Create API Service

```javascript
// services/phonepe.js
import axios from "axios";
import { API_CONFIG } from "../config";

const phonepeAPI = axios.create({
  baseURL: API_CONFIG.BASE_URL + API_CONFIG.PHONEPE_BASE,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token interceptor
phonepeAPI.interceptors.request.use((config) => {
  const token = getUserToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default phonepeAPI;
```

---

## 📡 Common API Calls

### Payment Initiation

```javascript
// Method 1: PhonePe Online Payment
const initiatePhonePePayment = async (cartItems, total) => {
  try {
    const response = await phonepeAPI.post("/initiate", {
      mode: "phonepe",
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
        amount: total,
        mobilenumber: currentUser.mobile,
        name: currentUser.name,
        productid: cartItems.map((i) => i.productId),
        transactionfor: "product",
        userId: currentUser.id,
      },
    });

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Payment failed");
  }
};

// Method 2: Cash on Delivery
const initiateCOD = async (cartItems, total) => {
  const response = await phonepeAPI.post("/initiate", {
    mode: "cod",
    // ... same order and transaction structure
  });
  return response.data;
};
```

### Check Payment Status

```javascript
const checkPaymentStatus = async (transactionId) => {
  const response = await phonepeAPI.get(`/status/${transactionId}`);
  return response.data;
};
```

### Get Transaction History

```javascript
const getTransactionHistory = async (userId, page = 1, limit = 10) => {
  const response = await phonepeAPI.get(
    `/user/${userId}/transactions?page=${page}&limit=${limit}`
  );
  return response.data;
};
```

### Create SDK Order (Mobile App Integration)

```javascript
const createSdkOrder = async (orderData) => {
  const response = await phonepeAPI.post("/create-sdk-order", {
    merchantOrderId: "ORDER_123",
    amount: 950.0,
    redirectUrl: "myapp://payment/callback",
    userId: 789,
    productIds: [456],
    transactionFor: "product_purchase",
  });
  return response.data;
};
```

**Response**:

```json
{
  "success": true,
  "message": "SDK order created successfully",
  "data": {
    "orderToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // JWT token
    "orderId": "ORDER_123"
  }
}
```

**Important**: The `orderToken` is a JWT token extracted from PhonePe's response, not the `orderId`. Use this token with the React Native SDK.

### Request Refund

```javascript
const requestRefund = async (transactionId, amount, reason) => {
  const response = await phonepeAPI.post(`/refund/${transactionId}`, {
    refundAmount: amount,
    reason: reason,
  });
  return response.data;
};
```

---

## 🔄 Complete Payment Flow (Copy-Paste Ready)

```javascript
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, Linking } from "react-native";
import phonepeAPI from "./services/phonepe";

const CheckoutScreen = ({ cartItems, total, navigation }) => {
  const [loading, setLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);

  // STEP 1: Initiate Payment
  const handlePayment = async (mode = "phonepe") => {
    setLoading(true);

    try {
      // Call backend
      const result = await phonepeAPI.post("/initiate", {
        mode,
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
          amount: total,
          mobilenumber: currentUser.mobile,
          name: currentUser.name,
          productid: cartItems.map((i) => i.productId),
          transactionfor: "product",
          userId: currentUser.id,
        },
      });

      const { data } = result;

      if (mode === "phonepe" && data.redirectUrl) {
        // STEP 2: Open PhonePe payment page
        await Linking.openURL(data.redirectUrl);

        // STEP 3: Start polling for status
        startStatusPolling(data.merchantTransactionId);
      } else if (mode === "cod") {
        // COD success
        handlePaymentSuccess(data);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Poll for payment status
  const startStatusPolling = (transactionId) => {
    let attempts = 0;
    const maxAttempts = 30;

    const interval = setInterval(async () => {
      attempts++;

      try {
        const result = await phonepeAPI.get(`/status/${transactionId}`);
        const { data } = result;

        if (data.status === "PAYMENT_SUCCESS") {
          clearInterval(interval);
          handlePaymentSuccess(data);
        } else if (data.status === "PAYMENT_FAILED") {
          clearInterval(interval);
          handlePaymentFailure(data);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          handleTimeout();
        }
      } catch (error) {
        console.error("Status check failed:", error);
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          handleError(error);
        }
      }
    }, 10000); // Poll every 10 seconds

    setPollingInterval(interval);
  };

  // STEP 3: Handle Success
  const handlePaymentSuccess = (data) => {
    clearInterval(pollingInterval);

    Alert.alert(
      "Payment Successful!",
      `Your order has been placed successfully.`,
      [
        {
          text: "View Order",
          onPress: () =>
            navigation.navigate("OrderDetails", {
              orderId: data.orderId,
            }),
        },
      ]
    );

    // Clear cart
    clearCart();
  };

  // STEP 4: Handle Failure
  const handlePaymentFailure = (data) => {
    clearInterval(pollingInterval);

    Alert.alert(
      "Payment Failed",
      data.message || "Your payment could not be processed.",
      [
        { text: "Try Again", onPress: () => handlePayment() },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // STEP 5: Handle Timeout
  const handleTimeout = () => {
    Alert.alert(
      "Payment Timeout",
      "Payment verification is taking longer than expected. Please check order history.",
      [
        {
          text: "Check Orders",
          onPress: () => navigation.navigate("Orders"),
        },
        { text: "OK", style: "cancel" },
      ]
    );
  };

  const handleError = (error) => {
    Alert.alert("Error", "Failed to verify payment status");
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => handlePayment("phonepe")}
        disabled={loading}
      >
        <Text>Pay with PhonePe</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => handlePayment("cod")} disabled={loading}>
        <Text>Cash on Delivery</Text>
      </TouchableOpacity>
    </View>
  );
};

export default CheckoutScreen;
```

---

## 🎯 Common Patterns

### Pattern 1: Loading States

```javascript
const [paymentState, setPaymentState] = useState({
  status: "idle", // idle, initiating, processing, success, failed
  message: "",
  loading: false,
});

const statusMessages = {
  idle: "",
  initiating: "Preparing payment...",
  processing: "Processing your payment...",
  verifying: "Verifying payment status...",
  success: "Payment successful!",
  failed: "Payment failed",
};
```

### Pattern 2: Error Handling

```javascript
const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error
    const { status, data } = error.response;

    switch (status) {
      case 400:
        Alert.alert("Invalid Request", data.message);
        break;
      case 404:
        Alert.alert("Not Found", "Transaction not found");
        break;
      case 500:
        Alert.alert("Server Error", "Please try again later");
        break;
      default:
        Alert.alert("Error", data.message || "Something went wrong");
    }
  } else if (error.request) {
    // Network error
    Alert.alert("Network Error", "Please check your internet connection");
  } else {
    // Other error
    Alert.alert("Error", error.message);
  }
};
```

### Pattern 3: Retry Logic

```javascript
const retryPayment = async (fn, maxRetries = 3, delay = 2000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

// Usage
try {
  const result = await retryPayment(() =>
    phonepeAPI.post("/initiate", paymentData)
  );
} catch (error) {
  handleAPIError(error);
}
```

### Pattern 4: Deep Link Handling

```javascript
// App.js or root navigator
import { Linking } from "react-native";

useEffect(() => {
  // Handle deep link when app is opened
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink(url);
  });

  // Handle deep link when app is already open
  const subscription = Linking.addEventListener("url", (event) => {
    handleDeepLink(event.url);
  });

  return () => subscription.remove();
}, []);

const handleDeepLink = (url) => {
  // myapp://payment/callback?transactionId=TXN_123&status=success
  if (url.includes("payment/callback")) {
    const params = parseQueryParams(url);
    if (params.transactionId) {
      // Verify with backend
      verifyPayment(params.transactionId);
    }
  }
};
```

---

## 📱 Screen Examples

### Payment Screen

```javascript
const PaymentScreen = ({ route, navigation }) => {
  const { cartItems, total } = route.params;

  return (
    <SafeAreaView>
      <ScrollView>
        {/* Order Summary */}
        <View style={styles.summary}>
          <Text>Order Total: ₹{total}</Text>
          <Text>{cartItems.length} items</Text>
        </View>

        {/* Payment Options */}
        <View style={styles.paymentMethods}>
          <PaymentButton
            title="PhonePe / UPI"
            subtitle="Pay using UPI, Cards, Net Banking"
            onPress={() => handlePayment("phonepe")}
            icon="phonepe"
          />

          <PaymentButton
            title="Cash on Delivery"
            subtitle="Pay when you receive"
            onPress={() => handlePayment("cod")}
            icon="cash"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
```

### Order History Screen

```javascript
const OrderHistoryScreen = () => {
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const result = await phonepeAPI.get(
        `/user/${userId}/transactions?page=${page}&limit=10`
      );
      setTransactions((prev) => [...prev, ...result.data.data]);
    } catch (error) {
      Alert.alert("Error", "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [page]);

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <TransactionCard transaction={item} />}
      onEndReached={() => setPage((p) => p + 1)}
      onEndReachedThreshold={0.5}
      ListFooterComponent={loading && <ActivityIndicator />}
    />
  );
};
```

---

## 🛠️ Utility Functions

### Amount Formatter

```javascript
const formatAmount = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

// Usage
<Text>{formatAmount(950.5)}</Text>; // ₹950.50
```

### Transaction ID Generator

```javascript
const generateTransactionId = async (prefix = "TXN") => {
  const response = await phonepeAPI.get(
    `/generate-transaction-id?prefix=${prefix}`
  );
  return response.data.merchantTransactionId;
};
```

### Status Checker

```javascript
const isPaymentComplete = (status) => {
  return ["PAYMENT_SUCCESS", "COD_ORDER_CREATED"].includes(status);
};

const isPaymentFailed = (status) => {
  return ["PAYMENT_FAILED", "TRANSACTION_NOT_FOUND", "EXPIRED"].includes(
    status
  );
};

const isPaymentPending = (status) => {
  return ["INITIATED", "PAYMENT_PENDING", "PAYMENT_INITIATED"].includes(status);
};
```

---

## 🎨 UI Components

### Payment Button Component

```javascript
const PaymentButton = ({ title, subtitle, icon, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.paymentButton, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
  >
    <View style={styles.iconContainer}>
      <Icon name={icon} size={24} />
    </View>
    <View style={styles.textContainer}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
    <Icon name="chevron-right" size={20} />
  </TouchableOpacity>
);
```

### Transaction Card Component

```javascript
const TransactionCard = ({ transaction }) => (
  <TouchableOpacity style={styles.card}>
    <View style={styles.header}>
      <Text style={styles.id}>{transaction.merchanttransactionid}</Text>
      <StatusBadge status={transaction.status} />
    </View>
    <Text style={styles.amount}>{formatAmount(transaction.amount)}</Text>
    <Text style={styles.date}>{formatDate(transaction.createddate)}</Text>
  </TouchableOpacity>
);
```

### Status Badge Component

```javascript
const StatusBadge = ({ status }) => {
  const colors = {
    SUCCESS: "#4CAF50",
    FAILED: "#F44336",
    PENDING: "#FF9800",
    EXPIRED: "#9E9E9E",
  };

  return (
    <View style={[styles.badge, { backgroundColor: colors[status] }]}>
      <Text style={styles.badgeText}>{status}</Text>
    </View>
  );
};
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ DON'T

```javascript
// Don't hardcode API URLs
const API_URL = "https://myapp.com/v1/phonepe";

// Don't store sensitive data
AsyncStorage.setItem("payment_token", token);

// Don't expose user credentials
const payment = {
  password: user.password, // NEVER
  cardCVV: "123", // NEVER
};

// Don't forget error handling
const result = await phonepeAPI.post("/initiate", data);
// No try-catch - RISKY!
```

### ✅ DO

```javascript
// Use environment config
import { API_CONFIG } from "../config";

// Store only transaction references
AsyncStorage.setItem("transaction_id", transactionId);

// Only send necessary data
const payment = {
  userId: user.id,
  amount: total,
  // Backend handles sensitive operations
};

// Always handle errors
try {
  const result = await phonepeAPI.post("/initiate", data);
} catch (error) {
  handleAPIError(error);
}
```

---

## 🔍 Debugging Tips

### 1. Check Network Calls

```javascript
// Add logging interceptor
phonepeAPI.interceptors.request.use((config) => {
  console.log("API Request:", {
    url: config.url,
    method: config.method,
    data: config.data,
  });
  return config;
});

phonepeAPI.interceptors.response.use(
  (response) => {
    console.log("API Response:", response.data);
    return response;
  },
  (error) => {
    console.error("API Error:", error.response?.data);
    return Promise.reject(error);
  }
);
```

### 2. Test Payment Status

```javascript
// Test status polling
const testStatusCheck = async (transactionId) => {
  const result = await phonepeAPI.get(`/status/${transactionId}`);
  console.log("Payment Status:", result.data);
};
```

### 3. Monitor Payment Flow

```javascript
const logPaymentStep = (step, data) => {
  console.log(`[Payment Flow] ${step}:`, {
    timestamp: new Date().toISOString(),
    data,
  });
};

// Usage
logPaymentStep("INITIATED", { transactionId });
logPaymentStep("REDIRECTING", { url: redirectUrl });
logPaymentStep("POLLING_STARTED", { transactionId });
```

---

## 📊 Performance Tips

### 1. Debounce Button Clicks

```javascript
const [isProcessing, setIsProcessing] = useState(false);

const handlePayment = async () => {
  if (isProcessing) return; // Prevent double-click

  setIsProcessing(true);
  try {
    await initiatePayment();
  } finally {
    setIsProcessing(false);
  }
};
```

### 2. Cache Transaction History

```javascript
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "transactions_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedTransactions = async () => {
  const cached = await AsyncStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }
  return null;
};
```

### 3. Optimize Polling

```javascript
const pollWithBackoff = async (transactionId) => {
  const delays = [5, 10, 15, 20, 30]; // Increasing delays

  for (const delay of delays) {
    await sleep(delay * 1000);
    const status = await checkStatus(transactionId);
    if (isPaymentComplete(status) || isPaymentFailed(status)) {
      return status;
    }
  }
};
```

---

## 🎓 Cheat Sheet

### Quick Reference Table

| Task           | Endpoint                     | Method |
| -------------- | ---------------------------- | ------ |
| Start payment  | `/initiate`                  | POST   |
| Check status   | `/status/:txnId`             | GET    |
| Get history    | `/user/:userId/transactions` | GET    |
| Request refund | `/refund/:txnId`             | POST   |
| Get stats      | `/stats?userId=:userId`      | GET    |
| Bulk status    | `/bulk-status`               | POST   |
| Generate ID    | `/generate-transaction-id`   | GET    |
| Health check   | `/health`                    | GET    |

### Status Codes

| Status                  | Meaning                              |
| ----------------------- | ------------------------------------ |
| `INITIATED`             | Payment started, waiting for user    |
| `PAYMENT_PENDING`       | User is completing payment           |
| `PAYMENT_SUCCESS`       | Payment completed successfully       |
| `PAYMENT_FAILED`        | Payment failed                       |
| `COD_ORDER_CREATED`     | COD order created                    |
| `TRANSACTION_NOT_FOUND` | Transaction expired or not found     |
| `EXPIRED`               | Transaction expired (15 min timeout) |

### Error Codes

| Code | Meaning      | Action                |
| ---- | ------------ | --------------------- |
| 400  | Bad request  | Check request format  |
| 404  | Not found    | Verify transaction ID |
| 500  | Server error | Retry later           |

---

## ✅ Final Checklist

Before going live:

- [ ] Environment variables configured
- [ ] API authentication working
- [ ] Payment flow tested
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Deep linking configured
- [ ] Status polling implemented
- [ ] Timeout handling added
- [ ] Analytics tracking added
- [ ] User feedback messages added

---

**🎉 You're ready to integrate!**

For detailed documentation, see: `PHONEPE_BACKEND_FEATURES_FOR_REACT_NATIVE.md`
