# Amazon SP-API Integration - Complete Frontend & Backend Flow

## 📋 Overview

This guide covers the complete integration flow for Amazon SP-API, including both Frontend (FE) and Backend (BE) implementation steps.

---

## 🎯 Complete Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIAL SETUP (One-Time)                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Backend Setup:                                               │
│    ✅ Create Amazon Solution Provider Portal account            │
│    ✅ Create Sandbox App                                         │
│    ✅ Get LWA Credentials (Client ID, Secret)                    │
│    ✅ Setup AWS Account & IAM Role                               │
│    ✅ Get Refresh Token                                          │
│    ✅ Configure Environment Variables                            │
│                                                                  │
│ 2. Backend Implementation:                                       │
│    ✅ Amazon Service (Authentication, API calls)                 │
│    ✅ Amazon Controller (Request handlers)                       │
│    ✅ Amazon Routes (API endpoints)                              │
│                                                                  │
│ 3. Frontend Setup:                                               │
│    ✅ Configure API base URL                                     │
│    ✅ Create Amazon sync UI components                           │
└─────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                    USER FLOW (Runtime)                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. User clicks "Sync with Amazon" button                        │
│ 2. Frontend calls Backend API                                   │
│ 3. Backend authenticates with Amazon (uses refresh token)        │
│ 4. Backend makes SP-API calls                                   │
│ 5. Backend returns data to Frontend                             │
│ 6. Frontend displays results                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication & Token Management

### **Important: No User Login Required!**

**Key Points:**
- ✅ **No user login needed** - Authentication is handled server-side
- ✅ **Refresh Token is stored in Backend** - Never exposed to Frontend
- ✅ **Access Tokens are auto-refreshed** - Backend handles token management
- ✅ **Frontend only needs API endpoints** - No Amazon credentials needed

### **Token Flow:**

```
┌─────────────┐
│   Backend   │
│             │
│ Refresh     │ ────► Amazon LWA ────► Access Token (1 hour)
│ Token       │       (Server-side)     (Auto-refreshed)
│ (Stored in  │
│  .env)      │
└─────────────┘
      │
      │ Uses Access Token for API calls
      ▼
┌─────────────┐
│ Amazon SP-  │
│ API         │
└─────────────┘
```

---

## 🖥️ Backend Implementation Steps

### **Step 1: Environment Variables Setup**

Add to your `.env` file:

```env
# Amazon SP-API Credentials (Get from Solution Provider Portal)
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=your_client_secret_here
AMAZON_REFRESH_TOKEN=your_refresh_token_here
AMAZON_ENVIRONMENT=SANDBOX  # or PRODUCTION
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV  # Fixed for India

# AWS Credentials (For SigV4 signing)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AMAZON_REGION=eu-west-1

# Optional: Custom base URL
AMAZON_SP_API_BASE_URL=https://sandbox.sellingpartnerapi-eu.amazon.com
```

### **Step 2: Backend API Endpoints (Already Created)**

Your backend now has these endpoints:

```
GET    /v1/amazon/products/:sellerId              - Get product list
GET    /v1/amazon/products/:sellerId/:sku         - Get product by SKU
PATCH  /v1/amazon/inventory/:sellerId/:sku        - Update inventory
GET    /v1/amazon/orders                          - Get orders
GET    /v1/amazon/orders/:orderId/items           - Get order items
POST   /v1/amazon/orders/:orderId/shipment        - Confirm shipment
```

### **Step 3: Backend Authentication Flow**

The backend automatically:
1. ✅ Uses refresh token to get access token
2. ✅ Caches access token (refreshes before expiry)
3. ✅ Signs requests with AWS SigV4
4. ✅ Handles all authentication internally

**No additional authentication needed from Frontend!**

---

## 🎨 Frontend Implementation Steps

### **Step 1: Create API Service/Client**

Create a service to call your backend API:

```typescript
// services/amazonApi.service.ts
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class AmazonApiService {
  private baseURL = `${API_BASE_URL}/v1/amazon`;

  // Get product list
  async getProducts(sellerId: string, marketplaceId?: string) {
    const params = marketplaceId ? { marketplaceId } : {};
    const response = await axios.get(`${this.baseURL}/products/${sellerId}`, { params });
    return response.data;
  }

  // Get product by SKU
  async getProductBySku(sellerId: string, sku: string, marketplaceId?: string) {
    const params = marketplaceId ? { marketplaceId } : {};
    const response = await axios.get(`${this.baseURL}/products/${sellerId}/${sku}`, { params });
    return response.data;
  }

  // Update inventory
  async updateInventory(sellerId: string, sku: string, quantity: number) {
    const response = await axios.patch(
      `${this.baseURL}/inventory/${sellerId}/${sku}`,
      { quantity }
    );
    return response.data;
  }

  // Get orders
  async getOrders(filters?: {
    marketplaceId?: string;
    createdAfter?: string;
    createdBefore?: string;
    orderStatuses?: string;
  }) {
    const response = await axios.get(`${this.baseURL}/orders`, { params: filters });
    return response.data;
  }

  // Get order items
  async getOrderItems(orderId: string) {
    const response = await axios.get(`${this.baseURL}/orders/${orderId}/items`);
    return response.data;
  }

  // Confirm shipment
  async confirmShipment(
    orderId: string,
    shipmentData: {
      packageReferenceId: string;
      carrierCode: string;
      shippingMethod: string;
      trackingNumber: string;
      shipDate: string;
    }
  ) {
    const response = await axios.post(
      `${this.baseURL}/orders/${orderId}/shipment`,
      shipmentData
    );
    return response.data;
  }
}

export const amazonApiService = new AmazonApiService();
```

### **Step 2: Create Sync Component**

```typescript
// components/AmazonSyncButton.tsx
'use client';

import { useState } from 'react';
import { amazonApiService } from '@/services/amazonApi.service';

interface AmazonSyncButtonProps {
  sellerId: string;
  onSyncComplete?: (data: any) => void;
}

export function AmazonSyncButton({ sellerId, onSyncComplete }: AmazonSyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Example: Sync products
      const products = await amazonApiService.getProducts(sellerId);
      
      setSuccess(true);
      onSyncComplete?.(products);
      
      // You can also sync orders, inventory, etc.
      // const orders = await amazonApiService.getOrders({
      //   createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      // });
      
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sync with Amazon');
      console.error('Amazon sync error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="amazon-sync-container">
      <button
        onClick={handleSync}
        disabled={loading}
        className="sync-button"
      >
        {loading ? 'Syncing...' : 'Sync with Amazon'}
      </button>

      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          Successfully synced with Amazon!
        </div>
      )}
    </div>
  );
}
```

### **Step 3: Create Sync Page/View**

```typescript
// pages/amazon-sync.tsx or app/amazon-sync/page.tsx
import { AmazonSyncButton } from '@/components/AmazonSyncButton';
import { useState } from 'react';

export default function AmazonSyncPage() {
  const [syncData, setSyncData] = useState<any>(null);
  const sellerId = 'ATESTSELLER123'; // Get from your app config or user settings

  return (
    <div className="container">
      <h1>Amazon Integration</h1>
      
      <div className="sync-section">
        <h2>Sync Products</h2>
        <AmazonSyncButton 
          sellerId={sellerId}
          onSyncComplete={(data) => setSyncData(data)}
        />
      </div>

      {syncData && (
        <div className="sync-results">
          <h3>Sync Results</h3>
          <pre>{JSON.stringify(syncData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

---

## 🔄 Complete User Flow

### **Scenario: User Clicks "Sync with Amazon"**

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: User Action (Frontend)                              │
├─────────────────────────────────────────────────────────────┤
│ User clicks "Sync with Amazon" button                       │
│                                                              │
│ Frontend Component:                                          │
│ - Shows loading state                                        │
│ - Calls: amazonApiService.getProducts(sellerId)              │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: API Request (Frontend → Backend)                    │
├─────────────────────────────────────────────────────────────┤
│ HTTP Request:                                                │
│ GET /v1/amazon/products/ATESTSELLER123                       │
│                                                              │
│ Headers:                                                     │
│ - Authorization: Bearer <your-app-token> (if needed)        │
│ - Content-Type: application/json                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Backend Processing                                   │
├─────────────────────────────────────────────────────────────┤
│ AmazonController.getProducts()                               │
│   ↓                                                          │
│ AmazonService.getProducts()                                  │
│   ↓                                                          │
│ 1. Check cached access token                                 │
│ 2. If expired, refresh using refresh token                  │
│ 3. Sign request with AWS SigV4                              │
│ 4. Make API call to Amazon SP-API                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Amazon SP-API Response                              │
├─────────────────────────────────────────────────────────────┤
│ Amazon returns product data                                 │
│                                                              │
│ Backend:                                                     │
│ - Formats response                                           │
│ - Returns to Frontend                                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Frontend Display                                     │
├─────────────────────────────────────────────────────────────┤
│ Frontend receives response:                                 │
│ {                                                            │
│   success: true,                                             │
│   message: "Products retrieved successfully",                │
│   data: { ...products... }                                  │
│ }                                                            │
│                                                              │
│ Frontend:                                                    │
│ - Updates UI with products                                  │
│ - Shows success message                                      │
│ - Hides loading state                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Considerations

### **What Frontend Needs:**
- ✅ **API Base URL** - Your backend URL
- ✅ **Seller ID** - Can be stored in app config or user settings
- ✅ **Your App's Authentication** - If your backend requires user auth

### **What Frontend Should NOT Have:**
- ❌ **Amazon Client ID** - Backend only
- ❌ **Amazon Client Secret** - Backend only
- ❌ **Amazon Refresh Token** - Backend only
- ❌ **AWS Access Keys** - Backend only
- ❌ **Access Tokens** - Backend handles internally

### **Backend Security:**
- ✅ Store all secrets in `.env` file
- ✅ Never commit `.env` to Git
- ✅ Use environment variables in production
- ✅ Rotate credentials regularly

---

## 📝 Frontend Implementation Checklist

### **Setup:**
- [ ] Create API service/client for Amazon endpoints
- [ ] Configure API base URL (environment variable)
- [ ] Get Seller ID (from config or user settings)

### **UI Components:**
- [ ] Create "Sync with Amazon" button component
- [ ] Create loading states
- [ ] Create error handling UI
- [ ] Create success message UI
- [ ] Create data display components

### **Features:**
- [ ] Sync Products
- [ ] Sync Orders
- [ ] Update Inventory
- [ ] View Order Details
- [ ] Confirm Shipments

### **Error Handling:**
- [ ] Handle network errors
- [ ] Handle API errors
- [ ] Show user-friendly error messages
- [ ] Log errors for debugging

---

## 📝 Backend Implementation Checklist

### **Setup (Already Done):**
- [x] Amazon Service created
- [x] Amazon Controller created
- [x] Amazon Routes created
- [x] Environment variables configured

### **Configuration:**
- [ ] Add Amazon credentials to `.env`
- [ ] Add AWS credentials to `.env`
- [ ] Test authentication flow
- [ ] Test API endpoints

### **Testing:**
- [ ] Test GET products endpoint
- [ ] Test GET product by SKU
- [ ] Test PATCH inventory
- [ ] Test GET orders
- [ ] Test GET order items
- [ ] Test POST shipment confirmation

---

## 🧪 Testing Flow

### **1. Test Backend Directly:**

```bash
# Test get products
curl -X GET "http://localhost:8080/v1/amazon/products/ATESTSELLER123"

# Test get orders
curl -X GET "http://localhost:8080/v1/amazon/orders?createdAfter=2025-01-01T00:00:00Z"

# Test update inventory
curl -X PATCH "http://localhost:8080/v1/amazon/inventory/ATESTSELLER123/TEST-SKU-001" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 100}'
```

### **2. Test from Frontend:**

```typescript
// In your frontend component
const testSync = async () => {
  try {
    const products = await amazonApiService.getProducts('ATESTSELLER123');
    console.log('Products:', products);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## 🚀 Quick Start Guide

### **For Backend Developers:**

1. **Add credentials to `.env`:**
   ```env
   AMAZON_CLIENT_ID=your_client_id
   AMAZON_CLIENT_SECRET=your_client_secret
   AMAZON_REFRESH_TOKEN=your_refresh_token
   AWS_ACCESS_KEY_ID=your_aws_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret
   ```

2. **Test endpoints:**
   - Use Swagger UI at `/docs`
   - Or use curl/Postman

3. **Deploy:**
   - Ensure all env variables are set in production
   - Test endpoints after deployment

### **For Frontend Developers:**

1. **Create API service:**
   - Copy the `amazonApiService` code above
   - Configure API base URL

2. **Create sync component:**
   - Copy the `AmazonSyncButton` component
   - Customize UI as needed

3. **Integrate:**
   - Add sync button to your pages
   - Handle responses and errors
   - Display synced data

---

## 📚 API Endpoints Reference

### **Base URL:**
```
http://localhost:8080/v1/amazon  (Development)
https://your-api.com/v1/amazon   (Production)
```

### **Endpoints:**

| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| GET | `/products/:sellerId` | Get all products | `sellerId`, `marketplaceId?` |
| GET | `/products/:sellerId/:sku` | Get product by SKU | `sellerId`, `sku`, `marketplaceId?` |
| PATCH | `/inventory/:sellerId/:sku` | Update inventory | `sellerId`, `sku`, `body: {quantity, fulfillmentChannelCode?}` |
| GET | `/orders` | Get orders | `marketplaceId?`, `createdAfter?`, `createdBefore?`, `orderStatuses?` |
| GET | `/orders/:orderId/items` | Get order items | `orderId` |
| POST | `/orders/:orderId/shipment` | Confirm shipment | `orderId`, `body: {packageReferenceId, carrierCode, shippingMethod, trackingNumber, shipDate}` |

---

## ⚠️ Important Notes

1. **No User Login Required:**
   - Amazon authentication is handled server-side
   - Frontend doesn't need Amazon credentials
   - Backend uses refresh token automatically

2. **Token Management:**
   - Access tokens are cached and auto-refreshed
   - Refresh token is stored securely in backend
   - No token management needed in frontend

3. **Seller ID:**
   - Can be stored in app config
   - Or retrieved from user settings
   - For sandbox: Use `ATESTSELLER123`
   - For production: Get from NIVAANA

4. **Error Handling:**
   - Backend handles Amazon API errors
   - Frontend should handle network errors
   - Show user-friendly error messages

---

## 🎯 Next Steps

1. **Backend:**
   - Add credentials to `.env`
   - Test all endpoints
   - Deploy to production

2. **Frontend:**
   - Create API service
   - Create sync components
   - Integrate into your app

3. **Testing:**
   - Test sync flow end-to-end
   - Test error scenarios
   - Test with real data (production)

---

**Document Version:** 1.0  
**Last Updated:** January 2025

