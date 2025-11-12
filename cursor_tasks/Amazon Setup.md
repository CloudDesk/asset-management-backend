# SP-API Integration Plan: Product and Order Management

This document outlines the implementation status of Amazon Selling Partner API (SP-API) integration for managing authentication, retrieving orders and product data, and performing listing management actions.

## 📋 Current Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1: Authentication & Access Token** | ⚠️ **Pending** | OAuth flow not configured due to redirect URI issues with private app. Manual token setup available. |
| **Phase 2: Product Operations (Read)** | ✅ **Implemented** | Catalog search and product retrieval fully functional |
| **Phase 3: Order Operations (Read)** | ✅ **Implemented** | Order retrieval and order items fully functional |
| **Phase 4: Product Operations (Write)** | ✅ **Partially Implemented** | Inventory updates implemented. Full product create/update pending schema configuration. |

---

## ⚠️ Phase 1: Authentication & Access Token

### Current Status: **PENDING - OAuth Flow Not Configured**

**Issue:** The OAuth redirect URI cannot be configured in the Amazon Seller Portal because the app is currently set as **private** (not public). This prevents the OAuth flow from working properly.

**Workaround:** Manual token setup is available using environment variables.

### Step 1: Manual Token Setup (Current Workaround)

**For now, you can manually obtain and configure tokens:**

1. **Get Refresh Token Manually:**
   - Go to Amazon Seller Central
   - Navigate to your SP-API app
   - Manually authorize and obtain the refresh token
   - Store it in environment variable: `AMAZON_REFRESH_TOKEN`

2. **Environment Variables Required:**
   ```env
   AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
   AMAZON_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
   AMAZON_REFRESH_TOKEN=Atzr|IQEB...  # Manually obtained refresh token
   AMAZON_ENVIRONMENT=SANDBOX  # or PRODUCTION
   AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV  # India marketplace
   AMAZON_SP_API_BASE_URL=https://sellingpartnerapi-eu.amazon.com
   ```

3. **How It Works:**
   - The service automatically refreshes access tokens using the refresh token
   - Access tokens are cached and refreshed 1 minute before expiry (tokens valid for 1 hour)
   - No OAuth flow needed for now

### Step 2: Get Access Token (Current Method)

**Get or refresh access token using manual refresh token:**

| Route | Method | Description | Status |
|------|--------|-------------|--------|
| **Get Access Token** | `GET /v1/amazon/auth/token` | Get current access token (auto-refreshes if needed) | ✅ **Implemented** |

**Example Usage:**
```bash
# Get access token
GET /v1/amazon/auth/token

# Response:
{
  "success": true,
  "message": "Access token retrieved successfully",
  "data": {
    "accessToken": "Atza|IQEB...",
    "expiresIn": 3600,
    "note": "Token is automatically refreshed 1 minute before expiry"
  }
}
```

**How It Works:**
- Uses `AMAZON_REFRESH_TOKEN` from environment variables
- Automatically refreshes token if it's expired or about to expire (1 minute before)
- Access tokens are valid for 1 hour
- Token is cached and reused until refresh is needed

### Step 2.1: Get Seller ID

**Route:** `GET /v1/amazon/auth/seller-info`

**Description:** Get your Amazon Seller ID and marketplace information. This is required to fetch your listed products.

**⚠️ Important Note:** The `marketplaceParticipations` endpoint may not always return `sellerId` in the response. The API will automatically try an alternative method (Fees API) to retrieve it. If both methods fail, you'll need to find it manually.

**Example Usage:**
```bash
# Get seller ID
GET /v1/amazon/auth/seller-info

# Response (if sellerId found):
{
  "success": true,
  "message": "Seller information retrieved successfully",
  "data": {
    "sellerId": "A1234567890",
    "marketplaces": [
      {
        "sellerId": "A1234567890",
        "marketplaceId": "ATVPDKIKX0DER",
        "marketplaceName": "Amazon.com",
        "countryCode": "US",
        "storeName": "BestSellerStore"
      }
    ],
    "fullResponse": { ... }
  }
}

# Response (if sellerId not found):
{
  "success": true,
  "message": "Seller information retrieved successfully",
  "data": {
    "sellerId": null,
    "marketplaces": [ ... ],
    "note": "Seller ID not found. Please find it manually in Seller Central..."
  }
}
```

**How It Works:**
1. First tries to get `sellerId` from `marketplaceParticipations` endpoint
2. If not found, automatically tries `Fees API` as fallback
3. If both fail, returns `null` with instructions to find manually

**Alternative Ways to Find Seller ID (if API doesn't return it):**

1. **In Seller Central (US):**
   - Log in to [Seller Central](https://sellercentral.amazon.com/)
   - Go to **Settings** → **Account Info**
   - Look for **Merchant Token** or **Seller ID** (usually starts with "A" followed by numbers)
   - Or check the URL when viewing your account settings

2. **In Seller Central (India):**
   - Log in to [Seller Central](https://sellercentral.amazon.in/)
   - Go to **Settings** → **Account Info**
   - Look for **Merchant Token** or **Seller ID**

3. **From OAuth Callback:**
   - If you complete OAuth flow, the `selling_partner_id` parameter in the redirect URL contains your Seller ID
   - Example: `https://your-callback-url?selling_partner_id=A1234567890&...`

4. **From Your Refresh Token:**
   - If you obtained the refresh token manually, the seller ID should have been provided during the authorization process

### Step 3: OAuth Flow (To Be Configured Later)

**When the app becomes public or redirect URI is fixed:**

| Step | API & Endpoint | Description | Status |
|------|---------------|-------------|--------|
| 1. OAuth Initiate | `POST /v1/amazon/auth/initiate` | Generate authorization URL for seller | ✅ Implemented (pending redirect URI fix) |
| 2. OAuth Callback | `POST /v1/amazon/auth/callback` | Exchange authorization code for refresh token | ✅ Implemented (pending redirect URI fix) |

**Key Requirements:**
- LWA Client ID & Client Secret: Your application credentials
- Refresh Token: Used to generate new Access Tokens without seller re-authorization
- Access Token: Required in the `x-amz-access-token` header for all SP-API calls

**OAuth Routes (Currently Non-Functional):**
- `POST /v1/amazon/auth/initiate` - Initiate OAuth connection
- `POST /v1/amazon/auth/callback` - Handle OAuth callback

---

## ✅ Phase 2: Product Operations (Read)

### Status: **FULLY IMPLEMENTED**

All product read operations are fully functional and can be used with manual token setup.

### Step 2: Get Products

| API & Endpoint | Description | Status |
|---------------|-------------|--------|
| **Catalog Items API (v2020-12-01): searchCatalogItems** | Returns a list of items and their attributes based on search criteria | ✅ Implemented |
| **Catalog Items API (v2020-12-01): getCatalogItem** | Returns the attributes for a specific item identified by ASIN | ✅ Implemented |

**Implemented Routes:**
- `GET /v1/amazon/products/:sellerId` - Get all products for a seller (Listings Items API)
- `GET /v1/amazon/products/:sellerId/:sku` - Get product by SKU (Listings Items API)
- `GET /v1/amazon/catalog/search` - Search Amazon catalog items (Catalog Items API)
- `GET /v1/amazon/catalog/items/:asin` - Get catalog item by ASIN (Catalog Items API)

**Step-by-Step Guide to Get Your Listed Products:**

1. **Get your Seller ID (choose one method):**

   **Method A: From Amazon URL (Easiest)**
   - Visit any of your product pages on Amazon (e.g., `https://www.amazon.in/sp?seller=APCBEZW09ZM60`)
   - The `seller=` parameter in the URL is your Seller ID (e.g., `APCBEZW09ZM60`)
   - You can also provide it manually to the API:
     ```bash
     GET /v1/amazon/auth/seller-info?sellerId=APCBEZW09ZM60
     ```

   **Method B: From API**
   ```bash
   GET /v1/amazon/auth/seller-info
   ```
   Copy the `sellerId` from the response (e.g., `APCBEZW09ZM60`)

2. **Get your listed products:**
   ```bash
   GET /v1/amazon/products/APCBEZW09ZM60?marketplaceId=A21TJRUUN4KGV
   ```
   Replace `APCBEZW09ZM60` with your actual Seller ID
   
   **⚠️ Note:** If you get "Could not match input arguments" error, it means:
   - The `sellerId` must match the authenticated seller (the seller associated with your refresh token)
   - If your refresh token is for a different seller account, you'll need to use the correct sellerId
   - Alternative: Use Catalog Items API to search for products instead:
     ```bash
     GET /v1/amazon/catalog/search?keywords=your+product+keywords&marketplaceIds=A21TJRUUN4KGV
     ```

3. **Get a specific product by SKU:**
   ```bash
   GET /v1/amazon/products/APCBEZW09ZM60/PROD-SKU-001?marketplaceId=A21TJRUUN4KGV
   ```

**Key Parameters:**
- `marketplaceIds` (Required): List of Amazon marketplace identifiers (e.g., `A21TJRUUN4KGV` for India)
- `keywords` (Required): Comma-delimited list of words or identifiers to search for
- `pageSize` (Optional): Number of results per page (max 20)
- `asin` (Required for getCatalogItem): The Amazon Standard Identification Number (ASIN) of the item

**Example Usage:**
```bash
# Get all products for a seller
GET /v1/amazon/products/A1234567890?marketplaceId=A21TJRUUN4KGV

# Get specific product by SKU
GET /v1/amazon/products/A1234567890/PROD-SKU-001?marketplaceId=A21TJRUUN4KGV
```

---

## ✅ Phase 3: Order Operations (Read)

### Status: **FULLY IMPLEMENTED**

All order read operations are fully functional and can be used with manual token setup.

### Step 3: Get Orders

| API & Endpoint | Description | Status |
|---------------|-------------|--------|
| **Orders API (v0): getOrders** | Returns orders created or updated within a specified time frame | ✅ Implemented |
| **Orders API (v0): getOrderItems** | Returns detailed line item information for a specific order | ✅ Implemented |

**Implemented Routes:**
- `GET /v1/amazon/orders` - Get orders from Amazon
- `GET /v1/amazon/orders/:orderId/items` - Get items for a specific order

**Key Parameters:**
- `MarketplaceIds` (Required): List of Amazon marketplace identifiers
- `CreatedAfter` OR `LastUpdatedAfter` (Required): An ISO 8601 date/time stamp. One of these must be provided
- `MaxResultsPerPage` (Optional): Max 100 results (Default 100)
- `orderId` (Required for getOrderItems): The Amazon-generated order identifier

**Query Parameters:**
- `marketplaceId` (Optional): Marketplace ID (default: `A21TJRUUN4KGV` for India)
- `createdAfter` (Optional): ISO 8601 date string (e.g., `2025-01-01T00:00:00Z`)
- `createdBefore` (Optional): ISO 8601 date string
- `orderStatuses` (Optional): Comma-separated order statuses (e.g., `Unshipped,Shipped`)

**Example Usage:**
```bash
# Get orders created after a specific date
GET /v1/amazon/orders?marketplaceId=A21TJRUUN4KGV&createdAfter=2025-01-01T00:00:00Z

# Get order items
GET /v1/amazon/orders/123-4567890-1234567/items
```

---

## ✅ Phase 4: Product Operations (Write - Create/Update Listings)

### Status: **PARTIALLY IMPLEMENTED**

Inventory updates are functional. Full product create/update requires Product Type Definitions API schema configuration.

### Step 4: Update Inventory

| API & Endpoint | Description | Status |
|---------------|-------------|--------|
| **FBA Inventory API: updateInventory** | Updates inventory quantity for a product | ✅ Implemented |

**Implemented Routes:**
- `PATCH /v1/amazon/inventory/:sellerId/:sku` - Update product inventory

**Request Body:**
```json
{
  "quantity": 100,
  "fulfillmentChannelCode": "DEFAULT"  // Optional, default: "DEFAULT"
}
```

**Example Usage:**
```bash
PATCH /v1/amazon/inventory/A1234567890/PROD-SKU-001
Content-Type: application/json

{
  "quantity": 100
}
```

### Step 5: Create Products (Pending Schema Configuration)

| API & Endpoint | Description | Status |
|---------------|-------------|--------|
| **Listings Items API (v2020-09-01): putListingsItem** | Creates a new or replaces an entire existing listing for a specific Seller SKU | ⚠️ Not Implemented |

**Key Concepts:**
- `sellerId` & `sku` (Path Required): Identifies the listing owner and the product
- Request Body (JSON): Must contain the full product data, adhering to the JSON Schema for the specified `productType`
- This includes facts (title, description), and sales terms (price, quantity)

**Note:** To implement this, you must first use the **Product Type Definitions API** to retrieve the correct JSON Schema required for the specific category/marketplace of your product.

### Step 6: Update Products (Pending Schema Configuration)

| API & Endpoint | Description | Status |
|---------------|-------------|--------|
| **Listings Items API (v2020-09-01): patchListingsItem** | Partially updates a listing, allowing you to modify only specific attributes | ⚠️ Not Implemented |

**Key Concepts:**
- `sellerId` & `sku` (Path Required): Identifies the listing owner and the product
- Request Body (JSON Patch): Uses the JSON Patch format (RFC 6902) to define the changes (e.g., replace operation for price, add for a new quantity)

---

## 🚀 Additional Implemented Features

### Shipment Confirmation

**Status:** ✅ **Implemented**

- `POST /v1/amazon/orders/:orderId/shipment` - Confirm shipment for an order

**Request Body:**
```json
{
  "packageReferenceId": "REF-123",
  "carrierCode": "BlueDart",
  "shippingMethod": "Standard",
  "trackingNumber": "TRACK123456",
  "shipDate": "2025-01-15T10:00:00Z"
}
```

---

## 📝 Key Takeaways and Next Steps

### ✅ What's Working Now:
1. **Product Read Operations:** Fully functional with manual token setup
2. **Order Read Operations:** Fully functional with manual token setup
3. **Inventory Updates:** Fully functional with manual token setup
4. **Shipment Confirmation:** Fully functional with manual token setup
5. **Token Management:** Automatic access token refresh using manual refresh token

### ⚠️ What Needs Configuration:
1. **OAuth Flow:** Redirect URI configuration in Seller Portal (requires app to be public or redirect URI fix)
2. **Product Create/Update:** Requires Product Type Definitions API integration to get JSON schemas
3. **Bulk Operations:** Feeds API integration for bulk updates (recommended for hundreds/thousands of items)

### 🔑 Authorization is Foundational:
- Every request depends on a valid Access Token
- Currently using manual refresh token from environment variables
- OAuth flow will be configured once redirect URI issue is resolved

### 📊 Listing Management Options:
- **Item-by-Item:** Use Listings Items API (current approach for inventory updates)
- **Bulk Updates:** Use Feeds API (`JSON_LISTINGS_FEED` type) - recommended for large-scale operations (not yet implemented)

### 📚 Data Requirements:
- To correctly use Phase 4 (Create/Update), you must first use the **Product Type Definitions API** (not listed but essential) to retrieve the correct JSON Schema required for the specific category/marketplace of your product.

---

## 🔧 Environment Configuration

### Required Environment Variables

```env
# Amazon LWA (OAuth 2.0) - Required for token refresh
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
AMAZON_REFRESH_TOKEN=Atzr|IQEB...  # Manually obtained until OAuth is configured

# SP-API Configuration
AMAZON_ENVIRONMENT=SANDBOX  # or PRODUCTION
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV  # India marketplace
AMAZON_SP_API_BASE_URL=https://sellingpartnerapi-eu.amazon.com
AMAZON_REGION=eu-west-1
AMAZON_SELLER_CENTRAL_URL=https://sellercentral.amazon.in

# OAuth Redirect URI (for future OAuth flow)
AMAZON_REDIRECT_URI=https://api.nivaana.in/v1/amazon/auth/callback
```

### Optional Environment Variables

```env
# AWS Credentials (only needed if using AWS SQS for notifications - optional)
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
```

**⚠️ Important:** AWS credentials are NOT required for basic SP-API integration. AWS IAM & SigV4 signing were completely removed as of October 2, 2023. AWS account is only needed if you want to use AWS SQS for notifications (optional feature).

---

## 📖 API Documentation

All implemented routes are documented in:
- **Routes:** `src/routes/amazon.route.ts`
- **Controller:** `src/controllers/amazon.controller.ts`
- **Service:** `src/services/amazon.service.ts`

For detailed OAuth flow documentation, see: `cursor_tasks/AMAZON_SP_API_INTEGRATION_GUIDE.md`



#amazon

AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
AMAZON_REFRESH_TOKEN=Atzr|IQEB...
AMAZON_ENVIRONMENT= SANDBOX
AMAZON_MARKETPLACE_ID =A21TJRUUN4KGV
AMAZON_REGION=eu-west-1
AMAZON_SELLER_CENTRAL_URL=https://sellercentral.amazon.in
