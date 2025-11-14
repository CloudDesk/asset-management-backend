# SP-API Integration Plan: Product and Order Management

This document outlines the implementation status of Amazon Selling Partner API (SP-API) integration for managing authentication, retrieving orders and product data, and performing listing management actions.

## 📋 Current Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 0: Setup & Registration** | ✅ **Completed** | Registered as private developer, created SP-API app, received LWA credentials |
| **Phase 1: Authentication & Access Token** | ✅ **Implemented** | OAuth token exchange flow working. Using official Amazon JavaScript SDK. |
| **Phase 2: Product Operations (Read)** | ✅ **COMPLETED** | Using official SDK for catalog search and product retrieval |
| **Phase 3: Order Operations (Read)** | ✅ **COMPLETED** | Using official SDK for order retrieval |
| **Phase 4: Product Operations (Write - Update Inventory)** | ✅ **COMPLETED** | Using official SDK for updating inventory quantities |

## 🎯 Integration Approach

**Decision:** Using the **Official Amazon JavaScript SDK** for all SP-API operations.

**SDK Package:** `@amazon-sp-api-release/amazon-sp-api-sdk-js`

**Benefits:**
- Automatic authentication and token management
- Automatic request signing (no manual header/token passing)
- Type-safe API clients for each SP-API service
- Built-in error handling and retry logic
- Official support and documentation

**Installation:**
```bash
npm install @amazon-sp-api-release/amazon-sp-api-sdk-js
```

**SDK Documentation:**
- [Official SDK Documentation](https://developer-docs.amazon.com/sp-api/docs/automate-your-sp-api-calls-using-javascript-sdk-for-node-js)
- [API Reference](https://developer-docs.amazon.com/sp-api/reference)

---

## ✅ Phase 0: Setup & Registration

### Status: **COMPLETED**

**What You Have Done:**
1. ✅ Registered as a **private developer** in Amazon Seller Central (India)
2. ✅ Created your SP-API application via Partner Network
3. ✅ Received credentials after app approval:
   - LWA Client ID (`amzn1.application-oa2-client.xxxxx`)
   - LWA Client Secret
   - Refresh Token (`Atzr|IQEB...`)
4. ✅ Successfully implemented OAuth token exchange flow using Node.js/TypeScript

**Environment Variables Configured:**
```env
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
AMAZON_REFRESH_TOKEN=Atzr|IQEB...
AMAZON_ENVIRONMENT=SANDBOX  # or PRODUCTION
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV  # India marketplace
AMAZON_SP_API_BASE_URL=https://sellingpartnerapi-eu.amazon.com
```

---

## ✅ Phase 1: Authentication & Access Token

### Current Status: **✅ COMPLETED - Using Official SDK**

**Decision:** Using the official Amazon JavaScript SDK (`@sp-api-sdk/auth`) which handles all authentication and signing automatically.

**Package Installed:** `@sp-api-sdk/auth@2.2.14`

### SDK Setup

**Installation:**
```bash
npm install @sp-api-sdk/auth
```

**✅ Installed:** `@sp-api-sdk/auth@2.2.14`

**SDK Initialization:**
```typescript
import { SellingPartnerApiAuth } from '@sp-api-sdk/auth';
import { ListingsItemsApiClient } from '@sp-api-sdk/listings-items-api-2020-09-01';
import { OrdersApiClient } from '@sp-api-sdk/orders-api-v0';

// Initialize authentication
const auth = new SellingPartnerApiAuth({
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
});

// Initialize API clients (SDK handles all authentication automatically)
const listingsClient = new ListingsItemsApiClient({
  auth,
  region: 'in', // For India marketplace
});

const ordersClient = new OrdersApiClient({
  auth,
  region: 'in',
});
```

**Benefits:**
- ✅ Automatic token refresh (no manual token management)
- ✅ Automatic request signing (no manual header/token passing)
- ✅ Type-safe API clients
- ✅ Built-in error handling
- ✅ Official support and documentation

### Current Implementation

**Route:** `GET /v1/amazon/auth/token`

**Description:** Get current access token (for testing/verification purposes). The SDK handles token management automatically for all API calls.

| Route | Method | Description | Status |
|------|--------|-------------|--------|
| **Get Access Token** | `GET /v1/amazon/auth/token` | Get current access token (auto-refreshes if needed) | ✅ **Implemented** |
| **Get Account Details** | `GET /v1/amazon/auth/account` | Get seller account details (business type, selling plan, marketplace participations, contact info) | ✅ **Implemented** |
| **Get Authenticated Seller ID** | `GET /v1/amazon/auth/authenticated-seller-id` | Get the authenticated seller ID from environment variable | ✅ **Implemented** |

**Example Usage:**
```bash
# Get access token (for verification)
GET /v1/amazon/auth/token

# Response:
{
  "success": true,
  "message": "Access token retrieved successfully",
  "data": {
    "accessToken": "Atza|IQEB...",
    "expiresIn": 3600,
    "note": "Token is automatically refreshed 1 minute before expiry"}
  }

# Get account details
GET /v1/amazon/auth/account

# Response includes:
# - marketplaceParticipationList: List of marketplaces
# - businessType: Type of business (PRIVATE_LIMITED, INDIVIDUAL, etc.)
# - sellingPlan: PROFESSIONAL or INDIVIDUAL
# - business: Business details (optional)
# - primaryContact: Contact information (optional)
```

**Note:** For actual API calls, use the SDK clients directly - they handle authentication automatically.

### ✅ Implementation Status

**Service Updated:** `src/services/amazon.service.ts` now uses `@sp-api-sdk/auth`

**Key Changes:**
- ✅ Replaced manual axios calls with `SellingPartnerApiAuth` from SDK
- ✅ SDK automatically handles token refresh and caching
- ✅ No manual token expiry management needed
- ✅ Backward compatible - `getAccessToken()` method still works

**How It Works:**
1. SDK initializes with credentials from environment variables
2. `getAccessToken()` calls SDK's `getAccessToken()` method
3. SDK automatically refreshes tokens when needed
4. SDK handles all token caching internally

**Testing:**
```bash
# Test the token endpoint
GET /v1/amazon/auth/token

# Should return:
{
  "success": true,
  "message": "Access token retrieved successfully",
  "data": {
    "accessToken": "Atza|...",
    "expiresIn": 3600,
    "note": "Token is automatically refreshed 1 minute before expiry"
  }
}
```

### Getting Your Seller ID

**How to Find Your Seller ID:**

1. **From Amazon Product URL (Easiest):**
   - Visit any of your product pages on Amazon (e.g., `https://www.amazon.in/sp?seller=APCBEZW09ZM60`)
   - The `seller=` parameter in the URL is your Seller ID (e.g., `APCBEZW09ZM60`)

2. **From Seller Central:**
   - Log in to [Seller Central (India)](https://sellercentral.amazon.in/)
   - Go to **Settings** → **Account Info**
   - Look for **Merchant Token** or **Seller ID** (usually starts with "A" followed by numbers)

3. **Using SDK (Sellers API):**
   ```typescript
   import { SellersApiClient } from '@sp-api-sdk/sellers-api-v1';
   
   const sellersClient = new SellersApiClient({
     auth,
     region: 'in',
   });
   
   const response = await sellersClient.getMarketplaceParticipations();
   // Seller ID is in the response
   ```

**Note:** You'll need your Seller ID for Listings Items API calls (create/update products).

---

## ✅ Phase 2: Product Operations (Read)

### Status: **✅ COMPLETED - Using Official SDK**

**Packages Installed:**
- `@sp-api-sdk/listings-items-api-2021-08-01`
- `@sp-api-sdk/catalog-items-api-2020-12-01`

**Your Requirements:**
- ✅ Fetch product listings from Amazon
- ✅ Search catalog items
- ✅ Get product details by SKU or ASIN

### ✅ Implementation Status

**Service Updated:** `src/services/amazon.service.ts` now includes product read operations

**Key Features:**
- ✅ SDK automatically handles access token - **NO manual storage needed**
- ✅ All API clients share the same auth instance
- ✅ Token is cached internally by SDK
- ✅ Automatic token refresh when needed

### 📝 About Access Token Storage

**Important:** You do NOT need to store the access token manually!

**How It Works:**
1. The SDK's `SellingPartnerApiAuth` instance caches the access token internally
2. All API clients (Listings, Catalog, etc.) share the same auth instance
3. When you make API calls, the SDK automatically:
   - Uses the cached token if it's still valid
   - Refreshes the token if it's expired or about to expire
   - Adds the token to request headers automatically

**Example:**
```typescript
// Service creates auth instance once
const auth = new SellingPartnerApiAuth({ ... });

// All clients share the same auth instance
const listingsClient = new ListingsItemsApiClient({ auth, region: 'eu' });
const catalogClient = new CatalogItemsApiClient({ auth, region: 'eu' });

// SDK automatically handles token for all calls
await listingsClient.getListingsItem({ ... }); // Token added automatically
await catalogClient.searchCatalogItems({ ... }); // Same token, refreshed if needed
```

### Implemented Routes

| Route | Method | Description | Status |
|-------|--------|-------------|--------|
| **Get All Listings** | `GET /v1/amazon/listings/:sellerId` | Get all listings items for a seller (all products). Add `&includeInventory=true` to get fulfillment method and quantity. | ✅ Implemented |
| **Get Listing by SKU** | `GET /v1/amazon/listings/:sellerId/:sku` | Get seller's listing item by SKU | ✅ Implemented |
| **Search Listings** | `GET /v1/amazon/listings/:sellerId/search` | Search seller's own listings with filters | ✅ Implemented |
| **Search Catalog** | `GET /v1/amazon/catalog/search` | Search Amazon catalog items | ✅ Implemented |
| **Get Catalog Item** | `GET /v1/amazon/catalog/items/:asin` | Get catalog item by ASIN | ✅ Implemented |
| **Get Inventory Summaries** | `GET /v1/amazon/inventory/summaries` | Get FBA inventory summaries for SKUs (detailed FBA inventory data) | ✅ Implemented |

### Example Usage

**1. Get All Listings (All Products):**
```bash
# Get all products for a seller
GET /v1/amazon/listings/APCBEZW09ZM60?marketplaceId=A21TJRUUN4KGV

# With pagination
GET /v1/amazon/listings/APCBEZW09ZM60?marketplaceId=A21TJRUUN4KGV&pageSize=50&pageToken=nextPageToken
```

**2. Get Listing Item by SKU:**
```bash
GET /v1/amazon/listings/APCBEZW09ZM60/NH-94PT-UFLF?marketplaceId=A21TJRUUN4KGV
```

**3. Search Listings Items (with filters):**
```bash
GET /v1/amazon/listings/APCBEZW09ZM60/search?keywords=laptop&marketplaceId=A21TJRUUN4KGV
```

**4. Search Catalog Items:**
```bash
GET /v1/amazon/catalog/search?keywords=laptop,computer&marketplaceIds=A21TJRUUN4KGV&pageSize=20
```

**5. Get Catalog Item by ASIN:**
```bash
GET /v1/amazon/catalog/items/B08WJ81ZS1?marketplaceIds=A21TJRUUN4KGV&includedData=summaries,attributes
```

**6. Get All Listings with Inventory Information:**
```bash
# Get all listings with fulfillment method and quantity
GET /v1/amazon/listings/APCBEZW09ZM60?marketplaceId=A21TJRUUN4KGV&includeInventory=true

# With pagination
GET /v1/amazon/listings/APCBEZW09ZM60?marketplaceId=A21TJRUUN4KGV&includeInventory=true&pageSize=50&pageToken=nextPageToken
```

**Response includes inventory data:**
```json
{
  "success": true,
  "message": "All listings items retrieved successfully",
  "data": {
    "items": [
      {
        "sku": "NH-94PT-UFLF",
        "inventory": {
          "fulfilledBy": "MFN",
          "quantity": 50,
          "fulfillmentChannelCode": "DEFAULT"
        },
        "summaries": [...]
      }
    ]
  }
}
```

### 📦 Inventory Information

**Fulfillment Methods Explained:**

- **MFN (Merchant Fulfilled Network):** Products are fulfilled by the seller (you). You store inventory in your own warehouse, pack and ship orders yourself, and handle customer service.
  - `fulfilledBy: "MFN"`
  - `fulfillmentChannelCode: "DEFAULT"` (or similar merchant codes)
  - `quantity`: Available inventory quantity from your listings (managed by you)

- **AFN (Amazon Fulfilled Network / FBA):** Products are fulfilled by Amazon (FBA - Fulfillment by Amazon). You send inventory to Amazon's fulfillment centers, and Amazon stores, packs, and ships orders for you.
  - `fulfilledBy: "AFN"`
  - `fulfillmentChannelCode: "AMAZON_NA"`, `"AMAZON_EU"`, `"AMAZON_IN"`, etc. (varies by region)
  - `quantity`: Available inventory quantity in Amazon's fulfillment centers

**Inventory Data Structure:**
```json
{
  "inventory": {
    "fulfilledBy": "MFN" | "AFN",  // Fulfillment method
    "quantity": 50,                  // Available quantity
    "fulfillmentChannelCode": "DEFAULT" | "AMAZON_NA" | "AMAZON_EU" | "AMAZON_IN" | etc.
  }
}
```

**How It Works:**
- When `includeInventory=true` is added to the listings endpoint, the API:
  1. Requests `fulfillmentAvailability` data from the Listings API
  2. Extracts fulfillment method and quantity from each product's fulfillment availability
  3. Adds an `inventory` object to each product item in the response

**Note:** 
- Inventory data comes from the Listings API's `fulfillmentAvailability` field
- This works for both MFN and AFN products
- For AFN products, you can also use the FBA Inventory API (`/v1/amazon/inventory/summaries`) for more detailed inventory breakdowns (fulfillable, reserved, unfulfillable quantities)

**SDK Reference:**
- [Listings Items API v2021-08-01](https://developer-docs.amazon.com/sp-api/reference/listings-items-v2021-08-01)
- [Catalog Items API v2020-12-01](https://developer-docs.amazon.com/sp-api/reference/catalog-items-v2020-12-01)

---

## ✅ Phase 3: Order Operations (Read)

### Status: **✅ COMPLETED - Using Official SDK**

**Package Installed:**
- `@sp-api-sdk/orders-api-v0`

**Your Requirements:**
- ✅ Fetch live orders from Amazon to sync/manage with your app
- ✅ Get order details and order items

### ✅ Implementation Status

**Service Updated:** `src/services/amazon.service.ts` now includes order read operations

**Key Features:**
- ✅ SDK automatically handles access token - **NO manual storage needed**
- ✅ All API clients share the same auth instance
- ✅ Token is cached internally by SDK
- ✅ Automatic token refresh when needed
- ✅ Supports pagination with `nextToken`
- ✅ Multiple filter options (date range, status, fulfillment channel, etc.)

### Implemented Routes

| Route | Method | Description | Status |
|-------|--------|-------------|--------|
| **Get Orders** | `GET /v1/amazon/orders` | Get list of orders with optional filters | ✅ Implemented |
| **Get Order** | `GET /v1/amazon/orders/:orderId` | Get order details by Order ID | ✅ Implemented |
| **Get Order Items** | `GET /v1/amazon/orders/:orderId/items` | Get items for a specific order | ✅ Implemented |

### Example Usage

**1. Get All Orders (with date filter):**
```bash
# Get orders created after a specific date
GET /v1/amazon/orders?marketplaceIds=A21TJRUUN4KGV&createdAfter=2025-01-01T00:00:00Z

# Get orders with pagination
GET /v1/amazon/orders?marketplaceIds=A21TJRUUN4KGV&createdAfter=2025-01-01T00:00:00Z&nextToken=...
```

**2. Get Orders with Filters:**
```bash
# Get unshipped orders
GET /v1/amazon/orders?marketplaceIds=A21TJRUUN4KGV&orderStatuses=Unshipped

# Get orders by fulfillment channel
GET /v1/amazon/orders?marketplaceIds=A21TJRUUN4KGV&fulfillmentChannels=MFN

# Get orders updated in last 7 days
GET /v1/amazon/orders?marketplaceIds=A21TJRUUN4KGV&lastUpdatedAfter=2025-11-06T00:00:00Z
```

**3. Get Order by ID:**
```bash
GET /v1/amazon/orders/123-4567890-1234567
```

**4. Get Order Items:**
```bash
GET /v1/amazon/orders/123-4567890-1234567/items

# With pagination
GET /v1/amazon/orders/123-4567890-1234567/items?nextToken=...
```

**SDK Reference:**
- [Orders API v0](https://developer-docs.amazon.com/sp-api/reference/orders-v0)

---

## ✅ Phase 4: Product Operations (Write - Update Inventory)

### Status: **✅ COMPLETED - Using Official SDK**

**Package Installed:**
- `@sp-api-sdk/listings-items-api-2021-08-01` (already installed for Phase 2)

**Your Requirements:**
- ✅ Update inventory quantities by SKU
- ✅ Support both additive and absolute update modes
- ✅ Automatic current quantity retrieval for additive updates

### ✅ Implementation Status

**Service Updated:** `src/services/amazon.service.ts` now includes inventory update operations

**Key Features:**
- ✅ Update inventory quantity by SKU
- ✅ **Additive Mode (Default):** Adds to existing quantity (e.g., current 50 + 10 = 60)
- ✅ **Absolute Mode:** Sets exact quantity (e.g., set to 100)
- ✅ Supports negative quantities for subtraction (additive mode)
- ✅ Automatically fetches current quantity before updating
- ✅ Works for both MFN and FBA products

### Implemented Routes

| Route | Method | Description | Status |
|-------|--------|-------------|--------|
| **Update Inventory Quantity** | `PATCH /v1/amazon/listings/:sellerId/:sku/inventory` | Update inventory quantity for a product by SKU. Supports additive (add to existing) and absolute (set exact) modes. | ✅ Implemented |

### Example Usage

**1. Additive Update (Add 10 to existing quantity - Default):**
```bash
PATCH /v1/amazon/listings/APCBEZW09ZM60/NH-94PT-UFLF/inventory
Content-Type: application/json

{
  "quantity": 10,
  "updateMode": "additive"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory quantity updated successfully",
  "data": {
    "sku": "NH-94PT-UFLF",
    "quantity": 60,
    "updateMode": "additive",
    "previousQuantity": 50,
    "fulfillmentChannelCode": "DEFAULT"
  }
}
```

**2. Subtract Quantity (Additive with negative):**
```bash
PATCH /v1/amazon/listings/APCBEZW09ZM60/NH-94PT-UFLF/inventory

{
  "quantity": -5,
  "updateMode": "additive"
}
```
Result: If current is 50, new quantity is 45

**3. Absolute Update (Set exact quantity):**
```bash
PATCH /v1/amazon/listings/APCBEZW09ZM60/NH-94PT-UFLF/inventory

{
  "quantity": 100,
  "updateMode": "absolute"
}
```
Result: Quantity becomes exactly 100

**4. Update with Custom Fulfillment Channel:**
```bash
PATCH /v1/amazon/listings/APCBEZW09ZM60/NH-94PT-UFLF/inventory

{
  "quantity": 10,
  "updateMode": "additive",
  "fulfillmentChannelCode": "AMAZON_IN",
  "marketplaceId": "A21TJRUUN4KGV"
}
```

### Request Body Parameters

- `quantity` (required): Number to add/subtract (additive) or set (absolute). Can be negative for subtraction.
- `updateMode` (optional): `"additive"` (default) or `"absolute"`
  - `"additive"`: Adds to existing quantity (current + quantity = new)
  - `"absolute"`: Sets exact quantity
- `marketplaceId` (optional): Marketplace ID (default: A21TJRUUN4KGV for India)
- `fulfillmentChannelCode` (optional): `"DEFAULT"` for MFN (default) or `"AMAZON_IN"`, `"AMAZON_NA"`, `"AMAZON_EU"` for FBA

### How It Works

1. **Additive Mode (Default):**
   - Fetches current quantity from Amazon using `fulfillmentAvailability`
   - Calculates: `finalQuantity = currentQuantity + quantity`
   - Updates Amazon with the new quantity
   - Returns both final and previous quantities

2. **Absolute Mode:**
   - Sets quantity to the exact value provided
   - No need to fetch current quantity

3. **Error Handling:**
   - If current quantity cannot be fetched in additive mode, falls back to absolute update
   - Validates SKU exists before updating
   - Returns detailed error messages

**SDK Reference:**
- [Listings Items API v2021-08-01](https://developer-docs.amazon.com/sp-api/reference/listings-items-v2021-08-01)

---

## 🔄 Additional Features (To Be Implemented)

### Shipment Confirmation

**Status:** **TO BE IMPLEMENTED WITH SDK**

**Example: Confirm Shipment**
```typescript
import { OrdersApiClient } from '@sp-api-sdk/orders-api-v0';

const ordersClient = new OrdersApiClient({
  auth,
  region: 'in',
});

// Confirm shipment for an order
const response = await ordersClient.confirmShipment({
  orderId: '123-4567890-1234567',
  body: {
    packageDetail: {
      packageReferenceId: 'REF-123',
      carrierCode: 'BlueDart',
      shippingMethod: 'Standard',
      trackingNumber: 'TRACK123456',
      shipDate: '2025-01-15T10:00:00Z',
    },
  },
});

console.log(response.data);
```

**SDK Reference:**
- [Orders API v0 - confirmShipment](https://developer-docs.amazon.com/sp-api/reference/orders-v0#confirmshipment)

---

## 📝 Key Takeaways and Next Steps

### ✅ What's Completed:
1. **Registration & Setup:** ✅ Registered as private developer, created SP-API app, received credentials
2. **Authentication:** ✅ OAuth token exchange flow working
3. **SDK Decision:** ✅ Decided to use official Amazon JavaScript SDK
4. **Token Management:** ✅ Basic token endpoint implemented (SDK will handle this automatically)

### 🔄 What's Next (Implementation Plan):
1. **Install SDK:** `npm install @amazon-sp-api-release/amazon-sp-api-sdk-js`
2. **Implement Product Read Operations:** Using `@sp-api-sdk/listings-items-api-2021-08-01` and `@sp-api-sdk/catalog-items-api-2020-12-01`
3. **Implement Order Read Operations:** Using `@sp-api-sdk/orders-api-v0`
4. **Implement Product Create/Update:** Using `@sp-api-sdk/listings-items-api-2021-08-01` with Product Type Definitions API
5. **Implement Inventory Updates:** Using `@sp-api-sdk/listings-items-api-2021-08-01` PATCH operations
6. **Implement Shipment Confirmation:** Using `@sp-api-sdk/orders-api-v0`

### 🔑 SDK Benefits:
- ✅ **Automatic Authentication:** SDK handles all token refresh and management
- ✅ **Automatic Signing:** No manual header/token passing required
- ✅ **Type Safety:** TypeScript support with full type definitions
- ✅ **Error Handling:** Built-in retry logic and error handling
- ✅ **Official Support:** Maintained by Amazon with official documentation

### 📊 Implementation Strategy:
- **Use SDK for All Operations:** All SP-API calls should use the official SDK
- **Product Type Definitions First:** Before creating products, use Product Type Definitions API to get schemas
- **Bulk Operations:** For large-scale updates, consider Feeds API (future enhancement)

### 📚 Important Resources:
- [Official SDK Documentation](https://developer-docs.amazon.com/sp-api/docs/automate-your-sp-api-calls-using-javascript-sdk-for-node-js)
- [API Reference](https://developer-docs.amazon.com/sp-api/reference)
- [Product Type Definitions API](https://developer-docs.amazon.com/sp-api/reference/product-type-definitions-v2020-09-01)

---

## 🔧 Environment Configuration

### Required Environment Variables

These environment variables are **required** for the Amazon SP-API integration using the official SDK:

```env
# Amazon LWA (Login with Amazon) - Required for SDK Authentication
# These credentials are obtained from Amazon Seller Central after app approval
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
AMAZON_REFRESH_TOKEN=Atzr|IQEB...  # Obtained during app authorization
```

**How to Get These Credentials:**
1. Register as a developer in [Amazon Seller Central](https://sellercentral.amazon.in/)
2. Create an SP-API application via Partner Network
3. After app approval, you'll receive:
   - **Client ID:** Starts with `amzn1.application-oa2-client.`
   - **Client Secret:** A long alphanumeric string
   - **Refresh Token:** Starts with `Atzr|` (obtained after authorizing the app)

### Optional Environment Variables

These variables have defaults but can be customized:

```env
# SP-API Environment Configuration
AMAZON_ENVIRONMENT=SANDBOX  # or PRODUCTION (default: SANDBOX)
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV  # India marketplace (default: A21TJRUUN4KGV)
AMAZON_SELLER_CENTRAL_URL=https://sellercentral.amazon.in  # Default: India Seller Central

# OAuth Redirect URI (for future OAuth flow - not currently used)
AMAZON_REDIRECT_URI=https://api.nivaana.in/v1/amazon/auth/callback
```

**Notes:**
- **AMAZON_ENVIRONMENT:** Use `SANDBOX` for testing, `PRODUCTION` for live operations
- **AMAZON_MARKETPLACE_ID:** 
  - `A21TJRUUN4KGV` = India (default)
  - `ATVPDKIKX0DER` = United States
  - `A1PA6795UKMFR9` = Germany
  - [Full list of marketplace IDs](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids)
- **AMAZON_SP_API_BASE_URL:** Not needed when using SDK - SDK automatically determines the correct base URL based on region
- **AMAZON_REGION:** Not needed when using SDK - SDK uses region parameter in client initialization (e.g., `region: 'in'`)

### SDK Configuration

When using the official SDK, you initialize clients with the region directly:

```typescript
import { SellingPartnerApiAuth } from '@sp-api-sdk/auth';
import { ListingsItemsApiClient } from '@sp-api-sdk/listings-items-api-2021-08-01';

// SDK automatically handles base URL based on region
const auth = new SellingPartnerApiAuth({
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
});

// Region codes: 'na' (North America), 'eu' (Europe), 'fe' (Far East), 'in' (India)
const listingsClient = new ListingsItemsApiClient({
  auth,
  region: 'in', // For India marketplace
});
```

**Region Codes:**
- `'in'` - India (uses `sellingpartnerapi-eu.amazon.com`)
- `'na'` - North America (US, Canada, Mexico)
- `'eu'` - Europe (UK, Germany, France, Italy, Spain, etc.)
- `'fe'` - Far East (Japan, Australia, Singapore, etc.)

**⚠️ Important Notes:**
- **AWS Credentials NOT Required:** AWS IAM & SigV4 signing were completely removed from SP-API as of October 2, 2023. The SDK handles all authentication automatically.
- **No Manual Token Management:** The SDK automatically refreshes access tokens - you don't need to manage tokens manually.
- **No Base URL Configuration:** The SDK automatically determines the correct SP-API base URL based on the region parameter.

---

## 📖 API Documentation

All implemented routes are documented in:
- **Routes:** `src/routes/amazon.route.ts`
- **Controller:** `src/controllers/amazon.controller.ts`
- **Service:** `src/services/amazon.service.ts`

**Documentation Files:**
- **API Routes Reference:** `cursor_tasks/AMAZON_API_ROUTES.md` - Complete list of all routes
- **Authentication Explained:** `cursor_tasks/AMAZON_AUTHENTICATION_EXPLAINED.md` - How SDK handles tokens automatically
- **SDK Packages Explanation:** `cursor_tasks/AMAZON_SDK_PACKAGES_EXPLANATION.md` - Why we use modular packages
- **OAuth Flow Guide:** `cursor_tasks/AMAZON_SP_API_INTEGRATION_GUIDE.md` - Detailed OAuth setup



#amazon

AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
AMAZON_REFRESH_TOKEN=Atzr|IQEB...
AMAZON_ENVIRONMENT= SANDBOX
AMAZON_MARKETPLACE_ID =A21TJRUUN4KGV
AMAZON_REGION=eu-west-1
AMAZON_SELLER_CENTRAL_URL=https://sellercentral.amazon.in


--

Implemented routes
Get all listings (all products):
   GET /v1/amazon/listings/{sellerId}?marketplaceId=A21TJRUUN4KGV&pageSize=50
   
   # With inventory information (fulfillment method and quantity):
   GET /v1/amazon/listings/{sellerId}?marketplaceId=A21TJRUUN4KGV&includeInventory=true

Get listing by SKU:
   GET /v1/amazon/listings/{sellerId}/{sku}?marketplaceId=A21TJRUUN4KGV

Search listings (with filters):
   GET /v1/amazon/listings/{sellerId}/search?keywords=laptop&marketplaceId=A21TJRUUN4KGV

Search catalog:
   GET /v1/amazon/catalog/search?keywords=laptop,computer&marketplaceIds=A21TJRUUN4KGV

Get catalog item by ASIN:
   GET /v1/amazon/catalog/items/{asin}?marketplaceIds=A21TJRUUN4KGV

Get inventory summaries (FBA inventory):
   GET /v1/amazon/inventory/summaries?marketplaceIds=A21TJRUUN4KGV&sellerSkus=SKU1,SKU2

Update inventory quantity (additive or absolute):
   PATCH /v1/amazon/listings/{sellerId}/{sku}/inventory
   Body: { "quantity": 10, "updateMode": "additive" }

