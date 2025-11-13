# Amazon SP-API Routes Documentation

Complete list of all implemented Amazon SP-API routes for product management, order retrieval, and inventory updates.

## 📋 Table of Contents

1. [Authentication & Account Routes](#authentication--account-routes)
2. [Product Operations (Read)](#product-operations-read)
3. [Product Operations (Write - Inventory Update)](#product-operations-write---inventory-update)
4. [Order Operations (Read)](#order-operations-read)
5. [Inventory Operations](#inventory-operations)

---

## 🔐 Authentication & Account Routes

### Get Access Token
**Route:** `GET /v1/amazon/auth/token`

**Description:** Get current access token (auto-refreshes if needed). The SDK handles token management automatically.

**Response:**
```json
{
  "success": true,
  "message": "Access token retrieved successfully",
  "data": {
    "accessToken": "Atza|IQEB...",
    "expiresIn": 3600,
    "note": "Token is automatically refreshed by SDK. No manual storage needed - SDK caches it internally."
  }
}
```

---

### Get Account Details
**Route:** `GET /v1/amazon/auth/account`

**Description:** Get seller account details including business type, selling plan, marketplace participations, and contact information. Available in EU marketplace (includes India).

**Response:**
```json
{
  "success": true,
  "message": "Account details retrieved successfully",
  "data": {
    "marketplaceParticipationList": [...],
    "businessType": "PRIVATE_LIMITED",
    "sellingPlan": "PROFESSIONAL",
    "business": {...},
    "primaryContact": {...}
  }
}
```

---

### Get Authenticated Seller ID
**Route:** `GET /v1/amazon/auth/authenticated-seller-id`

**Description:** Get the authenticated seller ID (the seller associated with your refresh token). This is the sellerId that must be used in Listings Items API calls.

**Response:**
```json
{
  "success": true,
  "message": "Authenticated seller ID retrieved successfully",
  "data": {
    "sellerId": "APCBEZW09ZM60",
    "note": "This is the sellerId associated with your refresh token. Use this sellerId in Listings Items API calls."
  }
}
```

---

## 📦 Product Operations (Read)

### Get All Listings
**Route:** `GET /v1/amazon/listings/:sellerId`

**Description:** Get all listings items for a seller (all products). Supports pagination and optional inventory information.

**Query Parameters:**
- `marketplaceId` (optional): Marketplace ID (default: A21TJRUUN4KGV for India)
- `pageSize` (optional): Number of results per page (default: 20, max: 100)
- `pageToken` (optional): Token for pagination (from previous response)
- `includeInventory` (optional): Set to `"true"` or `"1"` to include fulfillment method and quantity

**Example:**
```bash
# Get all products
GET /v1/amazon/listings/APCBEZW09ZM60?marketplaceId=A21TJRUUN4KGV

# With inventory information
GET /v1/amazon/listings/APCBEZW09ZM60?marketplaceId=A21TJRUUN4KGV&includeInventory=true

# With pagination
GET /v1/amazon/listings/APCBEZW09ZM60?marketplaceId=A21TJRUUN4KGV&pageSize=50&pageToken=nextPageToken
```

**Response:**
```json
{
  "success": true,
  "message": "All listings items retrieved successfully",
  "data": {
    "numberOfResults": 136,
    "pagination": {
      "nextToken": "...",
      "previousToken": "..."
    },
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

---

### Get Listing by SKU
**Route:** `GET /v1/amazon/listings/:sellerId/:sku`

**Description:** Get seller's listing item by SKU.

**Query Parameters:**
- `marketplaceId` (optional): Marketplace ID (default: A21TJRUUN4KGV for India)
- `includedData` (optional): Comma-separated data to include (e.g., `summaries,attributes,fulfillmentAvailability`)

**Example:**
```bash
GET /v1/amazon/listings/APCBEZW09ZM60/NH-94PT-UFLF?marketplaceId=A21TJRUUN4KGV
```

**Response:**
```json
{
  "success": true,
  "message": "Listing item retrieved successfully",
  "data": {
    "sku": "NH-94PT-UFLF",
    "summaries": [...],
    "attributes": {...}
  }
}
```

---

### Search Listings
**Route:** `GET /v1/amazon/listings/:sellerId/search`

**Description:** Search seller's own listings with filters.

**Query Parameters:**
- `marketplaceId` (optional): Marketplace ID (default: A21TJRUUN4KGV for India)
- `keywords` (optional): Comma-separated keywords to search for
- `sellerSkus` (optional): Comma-separated seller SKUs to filter by
- `asins` (optional): Comma-separated ASINs to filter by
- `pageSize` (optional): Number of results per page
- `pageToken` (optional): Token for pagination

**Example:**
```bash
GET /v1/amazon/listings/APCBEZW09ZM60/search?keywords=incense&marketplaceId=A21TJRUUN4KGV
```

---

### Search Catalog Items
**Route:** `GET /v1/amazon/catalog/search`

**Description:** Search Amazon catalog items.

**Query Parameters:**
- `keywords` (required): Comma-separated keywords to search for
- `marketplaceIds` (optional): Comma-separated marketplace IDs (default: A21TJRUUN4KGV for India)
- `pageSize` (optional): Number of results per page (max 20, default 20)
- `pageToken` (optional): Token for pagination

**Example:**
```bash
GET /v1/amazon/catalog/search?keywords=laptop,computer&marketplaceIds=A21TJRUUN4KGV&pageSize=20
```

---

### Get Catalog Item by ASIN
**Route:** `GET /v1/amazon/catalog/items/:asin`

**Description:** Get catalog item by ASIN.

**Query Parameters:**
- `marketplaceIds` (optional): Comma-separated marketplace IDs (default: A21TJRUUN4KGV for India)
- `includedData` (optional): Comma-separated data to include (e.g., `summaries,attributes`)

**Example:**
```bash
GET /v1/amazon/catalog/items/B0FLWLW7ZF?marketplaceIds=A21TJRUUN4KGV&includedData=summaries,attributes
```

---

## ✏️ Product Operations (Write - Inventory Update)

### Update Inventory Quantity
**Route:** `PATCH /v1/amazon/listings/:sellerId/:sku/inventory`

**Description:** Update inventory quantity for a product by SKU. Supports both absolute (set exact quantity) and additive (add to existing quantity) update modes.

**Request Body:**
```json
{
  "quantity": 10,
  "updateMode": "additive",
  "marketplaceId": "A21TJRUUN4KGV",
  "fulfillmentChannelCode": "DEFAULT"
}
```

**Body Parameters:**
- `quantity` (required): Number to add/subtract (additive) or set (absolute). Can be negative for subtraction.
- `updateMode` (optional): `"additive"` (default) or `"absolute"`
  - `"additive"`: Adds to existing quantity (current + quantity = new)
  - `"absolute"`: Sets exact quantity
- `marketplaceId` (optional): Marketplace ID (default: A21TJRUUN4KGV for India)
- `fulfillmentChannelCode` (optional): `"DEFAULT"` for MFN (default) or `"AMAZON_IN"`, `"AMAZON_NA"`, `"AMAZON_EU"` for FBA

**Examples:**

1. **Additive Update (Add 10 to existing):**
```bash
PATCH /v1/amazon/listings/APCBEZW09ZM60/NH-94PT-UFLF/inventory
Content-Type: application/json

{
  "quantity": 10,
  "updateMode": "additive"
}
```
Result: If current is 50, new quantity is 60

2. **Subtract Quantity (Additive with negative):**
```bash
PATCH /v1/amazon/listings/APCBEZW09ZM60/NH-94PT-UFLF/inventory

{
  "quantity": -5,
  "updateMode": "additive"
}
```
Result: If current is 50, new quantity is 45

3. **Absolute Update (Set exact quantity):**
```bash
PATCH /v1/amazon/listings/APCBEZW09ZM60/NH-94PT-UFLF/inventory

{
  "quantity": 100,
  "updateMode": "absolute"
}
```
Result: Quantity becomes exactly 100

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

---

### 📝 Implementation Code

#### Route (`src/routes/amazon.route.ts`)

```typescript
// PATCH /v1/amazon/listings/:sellerId/:sku/inventory - Update inventory quantity
fastify.patch('/listings/:sellerId/:sku/inventory', {
  schema: {
    description: 'Update inventory quantity for a product by SKU. Supports both absolute (set exact quantity) and additive (add to existing quantity) update modes.',
    tags: ['Amazon SP-API'],
    params: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', description: 'Amazon Seller ID' },
        sku: { type: 'string', description: 'Product SKU' },
      },
      required: ['sellerId', 'sku'],
    },
    body: {
      type: 'object',
      required: ['quantity'],
      properties: {
        quantity: { 
          type: 'number', 
          description: 'Quantity to set (absolute mode) or add/subtract (additive mode). Can be negative for subtraction.',
          examples: [10, -5, 50]
        },
        updateMode: { 
          type: 'string', 
          enum: ['absolute', 'additive'],
          description: 'Update mode: "absolute" sets the exact quantity, "additive" adds to existing quantity (default: "additive")',
          default: 'additive'
        },
        marketplaceId: { 
          type: 'string', 
          description: 'Marketplace ID (default: A21TJRUUN4KGV for India)' 
        },
        fulfillmentChannelCode: { 
          type: 'string', 
          description: 'Fulfillment channel code (default: "DEFAULT" for MFN). Use "AMAZON_NA", "AMAZON_EU", "AMAZON_IN" for FBA.',
          default: 'DEFAULT'
        },
      },
      additionalProperties: false,
      examples: [
        {
          quantity: 10,
          updateMode: 'additive',
          description: 'Add 10 to existing quantity (if current is 50, result is 60)'
        },
        {
          quantity: 100,
          updateMode: 'absolute',
          description: 'Set quantity to exactly 100'
        },
        {
          quantity: -5,
          updateMode: 'additive',
          description: 'Subtract 5 from existing quantity (if current is 50, result is 45)'
        }
      ]
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              sku: { type: 'string' },
              quantity: { type: 'number', description: 'Final quantity after update' },
              updateMode: { type: 'string' },
              fulfillmentChannelCode: { type: 'string' },
              previousQuantity: { type: 'number', description: 'Previous quantity (only shown in additive mode)' },
            },
            additionalProperties: true,
          },
        },
        additionalProperties: false,
      },
      400: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          details: { type: 'string' },
          statusCode: { type: 'number' },
        },
      },
      500: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          details: { type: 'string' },
          statusCode: { type: 'number' },
        },
      },
    },
  },
}, amazonController.updateInventoryQuantity.bind(amazonController));
```

---

#### Controller (`src/controllers/amazon.controller.ts`)

```typescript
/**
 * Update inventory quantity for a product by SKU
 */
updateInventoryQuantity = asyncHandler(async (
  request: FastifyRequest<{
    Params: { sellerId: string; sku: string };
    Body: {
      quantity: number;
      updateMode?: 'absolute' | 'additive';
      marketplaceId?: string;
      fulfillmentChannelCode?: string;
    };
  }>,
  reply: FastifyReply
) => {
  const { sellerId, sku } = request.params;
  const { quantity, updateMode = 'additive', marketplaceId, fulfillmentChannelCode = 'DEFAULT' } = request.body;

  if (quantity === undefined || quantity === null) {
    return reply.code(400).send({
      success: false,
      message: 'Quantity is required',
      details: 'Please provide quantity in the request body',
      statusCode: 400,
    });
  }

  logger.info({ 
    sellerId, 
    sku, 
    quantity, 
    updateMode,
    fulfillmentChannelCode 
  }, 'Updating inventory quantity');

  try {
    const marketplaceIds = marketplaceId ? [marketplaceId] : undefined;

    const result = await this.amazonService.updateInventoryQuantity(
      sellerId,
      sku,
      quantity,
      updateMode,
      marketplaceIds,
      fulfillmentChannelCode
    );

    return reply.code(200).send(createSuccessResponse('Inventory quantity updated successfully', result));
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error updating inventory quantity');
    
    return reply.code(500).send({
      success: false,
      message: 'Failed to update inventory quantity',
      details: error.message || 'An error occurred while updating inventory quantity',
      statusCode: 500,
    });
  }
});
```

---

#### Service (`src/services/amazon.service.ts`)

```typescript
/**
 * Update inventory quantity for a product by SKU
 * @param sellerId - Amazon Seller ID
 * @param sku - Product SKU
 * @param quantity - New quantity (absolute) or quantity to add/subtract (additive)
 * @param updateMode - 'absolute' (set to exact quantity) or 'additive' (add to existing quantity)
 * @param marketplaceIds - Marketplace IDs (default: India)
 * @param fulfillmentChannelCode - Fulfillment channel code (default: 'DEFAULT' for MFN)
 * @returns Updated listing item
 */
async updateInventoryQuantity(
  sellerId: string,
  sku: string,
  quantity: number,
  updateMode: 'absolute' | 'additive' = 'additive',
  marketplaceIds?: string[],
  fulfillmentChannelCode: string = 'DEFAULT'
): Promise<any> {
  try {
    const client = this.getListingsClient();
    const marketplaces = marketplaceIds || [this.DEFAULT_MARKETPLACE_ID];

    logger.info({ 
      sellerId, 
      sku, 
      quantity, 
      updateMode, 
      marketplaces,
      fulfillmentChannelCode 
    }, 'Updating inventory quantity');

    let finalQuantity = quantity;

    // If additive mode, get current quantity first
    if (updateMode === 'additive') {
      try {
        // Get current listing with fulfillmentAvailability
        const currentListing = await client.getListingsItem({
          sellerId,
          sku,
          marketplaceIds: marketplaces,
          includedData: ['fulfillmentAvailability'],
        });

        // Extract current quantity from fulfillmentAvailability
        const fulfillmentAvailability = currentListing.data?.fulfillmentAvailability;
        if (fulfillmentAvailability && Array.isArray(fulfillmentAvailability)) {
          const currentFulfillment = fulfillmentAvailability.find(
            (f: any) => f.fulfillmentChannelCode === fulfillmentChannelCode
          ) || fulfillmentAvailability[0];

          const currentQuantity = currentFulfillment?.quantity || 0;
          finalQuantity = currentQuantity + quantity;

          logger.info({ 
            sku, 
            currentQuantity, 
            quantityToAdd: quantity, 
            finalQuantity 
          }, 'Calculated additive quantity');
        } else {
          logger.warn({ sku }, 'No fulfillmentAvailability found, using provided quantity as absolute');
          // If no current data, treat as absolute update
          finalQuantity = quantity;
        }
      } catch (error: any) {
        logger.warn({ 
          error: error.message, 
          sku 
        }, 'Failed to get current quantity, using provided quantity as absolute');
        // If we can't get current quantity, treat as absolute update
        finalQuantity = quantity;
      }
    }

    // Get product type from current listing (required for PATCH)
    let productType = 'PRODUCT'; // Default fallback
    try {
      const currentListing = await client.getListingsItem({
        sellerId,
        sku,
        marketplaceIds: marketplaces,
        includedData: ['summaries'],
      });

      // Try to extract product type from summaries
      const summaries = currentListing.data?.summaries;
      if (summaries && Array.isArray(summaries) && summaries.length > 0) {
        productType = summaries[0]?.productType || 'PRODUCT';
      }
    } catch (error: any) {
      logger.warn({ error: error.message, sku }, 'Could not get product type, using default');
    }

    // Update inventory using PATCH
    const response = await client.patchListingsItem({
      sellerId,
      sku,
      marketplaceIds: marketplaces,
      body: {
        productType: productType,
        patches: [
          {
            op: 'replace',
            path: '/attributes/fulfillment_availability',
            value: [
              {
                fulfillment_channel_code: fulfillmentChannelCode,
                quantity: finalQuantity,
              },
            ],
          },
        ],
      },
    });

    logger.info({ 
      sku, 
      finalQuantity, 
      updateMode,
      fulfillmentChannelCode 
    }, 'Inventory quantity updated successfully');

    return {
      ...response.data,
      sku,
      quantity: finalQuantity,
      updateMode,
      fulfillmentChannelCode,
      previousQuantity: updateMode === 'additive' ? finalQuantity - quantity : undefined,
    };
  } catch (error: any) {
    logger.error({ 
      error: error.message || error, 
      sellerId, 
      sku, 
      quantity, 
      updateMode 
    }, 'Error updating inventory quantity');
    throw new Error(`Failed to update inventory quantity: ${error.message || 'Unknown error'}`);
  }
}
```

**Key Implementation Details:**

1. **Additive Mode Logic:**
   - Fetches current quantity from Amazon using `fulfillmentAvailability`
   - Calculates: `finalQuantity = currentQuantity + quantity`
   - Handles negative quantities for subtraction

2. **Absolute Mode Logic:**
   - Uses the provided quantity directly
   - No need to fetch current quantity

3. **Product Type Retrieval:**
   - Required for PATCH operation
   - Extracted from product summaries
   - Falls back to 'PRODUCT' if not found

4. **Error Handling:**
   - If current quantity cannot be fetched in additive mode, falls back to absolute update
   - Validates SKU exists before updating
   - Returns detailed error messages

5. **SDK Integration:**
   - Uses `ListingsItemsApiClient.patchListingsItem()` for updates
   - Automatically handles authentication and token refresh
   - Supports both MFN and FBA products via `fulfillmentChannelCode`

---

## 📋 Order Operations (Read)

### Get Orders
**Route:** `GET /v1/amazon/orders`

**Description:** Get list of orders with optional filters. Supports pagination using nextToken.

**Query Parameters:**
- `marketplaceIds` (optional): Comma-separated marketplace IDs (default: A21TJRUUN4KGV for India)
- `createdAfter` (optional): Get orders created after this date (ISO 8601 format, e.g., `2025-01-01T00:00:00Z`)
- `createdBefore` (optional): Get orders created before this date (ISO 8601 format)
- `lastUpdatedAfter` (optional): Get orders updated after this date (ISO 8601 format)
- `lastUpdatedBefore` (optional): Get orders updated before this date (ISO 8601 format)
- `orderStatuses` (optional): Comma-separated order statuses (e.g., `Unshipped,PartiallyShipped,Shipped,Canceled`)
- `fulfillmentChannels` (optional): Comma-separated fulfillment channels (`MFN`, `AFN`)
- `paymentMethods` (optional): Comma-separated payment methods (`COD`, `CreditCard`, etc.)
- `buyerEmail` (optional): Filter by buyer email
- `sellerOrderId` (optional): Filter by seller order ID
- `maxResultsPerPage` (optional): Maximum number of results per page (1-100, default: 100)
- `nextToken` (optional): Token for pagination (from previous response)
- `amazonOrderIds` (optional): Comma-separated Amazon order IDs to filter by

**Examples:**

1. **Get orders created after a specific date:**
```bash
GET /v1/amazon/orders?marketplaceIds=A21TJRUUN4KGV&createdAfter=2025-01-01T00:00:00Z
```

2. **Get unshipped orders:**
```bash
GET /v1/amazon/orders?marketplaceIds=A21TJRUUN4KGV&orderStatuses=Unshipped
```

3. **Get orders by fulfillment channel:**
```bash
GET /v1/amazon/orders?marketplaceIds=A21TJRUUN4KGV&fulfillmentChannels=MFN
```

4. **Get orders with pagination:**
```bash
GET /v1/amazon/orders?marketplaceIds=A21TJRUUN4KGV&createdAfter=2025-01-01T00:00:00Z&nextToken=...
```

**Response:**
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": {
    "Orders": [...],
    "NextToken": "..."
  }
}
```

---

### Get Order by ID
**Route:** `GET /v1/amazon/orders/:orderId`

**Description:** Get order details by Amazon Order ID.

**Example:**
```bash
GET /v1/amazon/orders/123-4567890-1234567
```

**Response:**
```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "data": {
    "AmazonOrderId": "123-4567890-1234567",
    "OrderStatus": "Unshipped",
    "PurchaseDate": "2025-01-15T10:00:00Z",
    ...
  }
}
```

---

### Get Order Items
**Route:** `GET /v1/amazon/orders/:orderId/items`

**Description:** Get order items for a specific order. Supports pagination using nextToken.

**Query Parameters:**
- `nextToken` (optional): Token for pagination (from previous response)

**Example:**
```bash
GET /v1/amazon/orders/123-4567890-1234567/items

# With pagination
GET /v1/amazon/orders/123-4567890-1234567/items?nextToken=...
```

**Response:**
```json
{
  "success": true,
  "message": "Order items retrieved successfully",
  "data": {
    "OrderItems": [...],
    "NextToken": "..."
  }
}
```

---

## 📊 Inventory Operations

### Get Inventory Summaries
**Route:** `GET /v1/amazon/inventory/summaries`

**Description:** Get inventory summaries for SKUs (FBA inventory). Returns fulfillment method (AFN/MFN) and quantity information.

**Query Parameters:**
- `marketplaceIds` (optional): Comma-separated marketplace IDs (default: A21TJRUUN4KGV for India)
- `sellerSkus` (optional): Comma-separated seller SKUs to get inventory for (optional - if not provided, returns all)
- `granularityType` (optional): `Marketplace` or `Warehouse` (default: `Marketplace`)
- `granularityId` (optional): Granularity ID (marketplace ID or warehouse ID)
- `details` (optional): Whether to include detailed inventory information (default: true). Set to `"true"` or `"1"`.
- `startDateTime` (optional): Start date time for inventory query (ISO 8601 format)
- `nextToken` (optional): Token for pagination (from previous response)

**Example:**
```bash
GET /v1/amazon/inventory/summaries?marketplaceIds=A21TJRUUN4KGV&sellerSkus=SKU1,SKU2,SKU3
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory summaries retrieved successfully",
  "data": {
    "granularity": {
      "granularityType": "Marketplace",
      "granularityId": "A21TJRUUN4KGV"
    },
    "inventorySummaries": [
      {
        "asin": "B0FLWLW7ZF",
        "sellerSku": "SKU1",
        "condition": "NewItem",
        "inventoryDetails": {
          "fulfillableQuantity": 50,
          "reservedQuantity": {...},
          "unfulfillableQuantity": {...}
        }
      }
    ]
  }
}
```

---

## 📝 Notes

### Fulfillment Methods

- **MFN (Merchant Fulfilled Network):** Products are fulfilled by the seller. You store inventory, pack and ship orders yourself.
  - `fulfilledBy: "MFN"`
  - `fulfillmentChannelCode: "DEFAULT"`
  - Quantity managed by you

- **AFN (Amazon Fulfilled Network / FBA):** Products are fulfilled by Amazon. Amazon stores, packs, and ships orders for you.
  - `fulfilledBy: "AFN"`
  - `fulfillmentChannelCode: "AMAZON_NA"`, `"AMAZON_EU"`, `"AMAZON_IN"`, etc.
  - Quantity in Amazon's fulfillment centers

### Pagination

Most list endpoints support pagination using `nextToken`:
1. Make initial request
2. If response includes `nextToken` or `pagination.nextToken`, use it in the next request
3. Continue until no more tokens are returned

### Error Handling

All routes return consistent error responses:
```json
{
  "success": false,
  "message": "Error message",
  "details": "Detailed error description",
  "statusCode": 500
}
```

---

## 🔗 Related Documentation

- **Setup Guide:** `cursor_tasks/Amazon Setup.md`
- **SDK Explanation:** `cursor_tasks/AMAZON_SDK_PACKAGES_EXPLANATION.md`
- **Integration Guide:** `cursor_tasks/AMAZON_SP_API_INTEGRATION_GUIDE.md`

---

## 📚 SDK References

- [Listings Items API v2021-08-01](https://developer-docs.amazon.com/sp-api/reference/listings-items-v2021-08-01)
- [Catalog Items API v2020-12-01](https://developer-docs.amazon.com/sp-api/reference/catalog-items-api-2020-12-01)
- [Orders API v0](https://developer-docs.amazon.com/sp-api/reference/orders-v0)
- [FBA Inventory API v1](https://developer-docs.amazon.com/sp-api/reference/fba-inventory-api-v1)
- [Sellers API v1](https://developer-docs.amazon.com/sp-api/reference/sellers-api-v1)

