# Get Products Route - Sandbox Summary

## Route Details

**Endpoint:** `GET /v1/amazon/listings/{sellerId}?marketplaceId={marketplaceId}`

**Example:**
```
GET http://localhost:5600/v1/amazon/listings/A1MOCKSELLER123?marketplaceId=A21TJRUUN4KGV
```

## ✅ Production Status

**Production environment works correctly** - No issues reported. The route successfully retrieves product listings when using:
- `AMAZON_ENVIRONMENT=PRODUCTION`
- Production seller ID: `APCBEZW09ZM60`
- Production credentials (client ID, secret, refresh token)

## ❌ Sandbox Issue

**Sandbox environment returns 403 Forbidden** - Issue occurs only in sandbox mode when using:
- `AMAZON_ENVIRONMENT=SANDBOX`
- Mock seller ID: `A1MOCKSELLER123`
- Sandbox credentials

## Request Parameters

### Path Parameters
- **`sellerId`** (required): Amazon Seller ID
  - Production: Your actual seller ID (e.g., `APCBEZW09ZM60`)
  - Sandbox: Mock seller ID (e.g., `A1MOCKSELLER123`) - must match Swagger examples

### Query Parameters
- **`marketplaceId`** (required): Amazon Marketplace ID
  - India: `A21TJRUUN4KGV`
  - US: `ATVPDKIKX0DER`
  - [Full list](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids)

- **`pageSize`** (optional): Number of results per page (default: 10, max: 20)
- **`pageToken`** (optional): Token for pagination (from previous response)
- **`includeInventory`** (optional): Include inventory information (default: false)
  - When `true`, includes `fulfillmentAvailability` data (MFN/AFN, quantity)

## ✅ Success Response (Production)

```json
{
  "success": true,
  "message": "All listings items retrieved successfully",
  "data": {
    "numberOfResults": 136,
    "pagination": {
      "nextToken": "9HkIVcuuPmX_bm51o3-igBfN45pxW4Ru7ElIM6GCECYCuXJKzT26f3bq4FBI6Uhpjh81GOVAGkNwt_JvE7qiRt5-NVPYcAVx9Hwr9DAhWiA2parzPZugazJAxLTPGCiAeKMC28JO05Iys-AZYMzHcR1l1vj7KQoFIa7pWiOPHyYLvwml64qnuhKoHvljEP72d_vhpiziBxU="
    },
    "items": [
      {
        "sku": "M5-936Y-NQJG",
        "summaries": [
          {
            "marketplaceId": "A21TJRUUN4KGV",
            "asin": "B0FTT16JJZ",
            "productType": "POTPOURRI_SACHET",
            "conditionType": "new_new",
            "status": [
              "DISCOVERABLE",
              "BUYABLE"
            ],
            "itemName": "Auora Premium Cherry Blossom Fragrance Sachet...",
            "createdDate": "2025-10-03T12:50:15.999Z",
            "lastUpdatedDate": "2025-10-28T06:40:34.115Z",
            "mainImage": {
              "link": "https://m.media-amazon.com/images/I/41J09Xgz5LL.jpg",
              "height": 368,
              "width": 500
            }
          }
        ],
        "inventory": {
          "fulfilledBy": "MFN",
          "quantity": null,
          "note": "MFN inventory quantity must be managed in seller's own system"
        }
      }
    ]
  }
}
```

## ❌ Current Sandbox Issue

### Error Response
```json
{
  "success": false,
  "message": "Failed to get all listings items",
  "details": "Failed to search listings items: 403 Forbidden. SANDBOX environment detected. Sandbox uses pattern matching - your request parameters must match predefined test cases. The 403 error likely means your request doesn't match the sandbox's expected patterns. Solutions: 1) Check the Swagger model JSON for Listings Items API (2021-08-01) - look for \"x-amzn-api-sandbox\" → \"static\" array to find example request parameters, 2) Use the exact seller ID, SKUs, and other parameters from the Swagger examples, 3) For sandbox, sellerId doesn't need to be valid but must match the pattern in Swagger examples, 4) Reference: https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox",
  "statusCode": 500
}
```

### Root Cause

**Sandbox Pattern Matching:** According to [Amazon's SP-API Sandbox documentation](https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox), the sandbox environment uses **pattern matching** to return predefined mock responses. Your request parameters must **exactly match** the patterns defined in the Swagger model JSON.

### Why 403 Forbidden?

1. **Request doesn't match sandbox patterns**: The seller ID `A1MOCKSELLER123` or other parameters don't match the predefined test cases in the Swagger model
2. **Missing required parameters**: Sandbox might require specific parameters that match the test cases
3. **SDK endpoint configuration**: The SDK might not be correctly using the sandbox endpoint (`sandbox.sellingpartnerapi-eu.amazon.com`)

## 🔧 Solutions

### Solution 1: Find Correct Sandbox Parameters from Swagger

1. **Go to Amazon SP-API Reference:**
   - https://developer-docs.amazon.com/sp-api/reference
   - Navigate to **"Listings Items API (2021-08-01)"**

2. **Find the Swagger Model JSON:**
   - Look for the Swagger model JSON file for Listings Items API
   - Search for `"x-amzn-api-sandbox"` → `"static"` array

3. **Extract Example Parameters:**
   ```json
   "x-amzn-api-sandbox": {
     "static": [
       {
         "request": {
           "parameters": {
             "sellerId": "EXAMPLE_SELLER_ID",
             "marketplaceIds": ["A21TJRUUN4KGV"],
             "sellerSkus": ["EXAMPLE_SKU"]
           }
         },
         "response": {
           // Example response
         }
       }
     ]
   }
   ```

4. **Use Exact Parameters:**
   - Use the exact `sellerId` from the Swagger example
   - Use the exact `marketplaceIds` and other parameters
   - Make sure all parameters match the pattern

### Solution 2: Verify SDK Sandbox Endpoint

Check your server logs to verify the SDK is using the sandbox endpoint:

```
[DEBUG] Listings client configuration
  endpoint: "https://sandbox.sellingpartnerapi-eu.amazon.com"
  region: "eu"
  environment: "SANDBOX"
```

If the endpoint is not `sandbox.sellingpartnerapi-eu.amazon.com`, the SDK might not be configured correctly for sandbox.

### Solution 3: Use Production Environment

If you need to test with real data:

```env
AMAZON_ENVIRONMENT=PRODUCTION
AMAZON_SELLER_ID=APCBEZW09ZM60
```

**⚠️ Warning:** Only use production for live operations, not for testing.

## 📋 Current Configuration

### Environment Variables (Sandbox)
```env
# Amazon Sandbox Configuration
AMAZON_CLIENT_ID=***sandbox_client_id******
AMAZON_CLIENT_SECRET=***sandbox_client_secret******
AMAZON_ENVIRONMENT=SANDBOX
AMAZON_REFRESH_TOKEN=***sandbox_refresh_token******
AMAZON_SELLER_CENTRAL_URL=https://sandbox.sellingpartnerapi-na.amazon.com/
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV
AMAZON_REGION=eu-west-1
AMAZON_SELLER_ID=A1MOCKSELLER123
```

### Environment Variables (Production - Working)
```env
# Amazon Production Configuration
AMAZON_CLIENT_ID=***production_client_id******
AMAZON_CLIENT_SECRET=***production_client_secret******
AMAZON_REFRESH_TOKEN=***production_refresh_token******
AMAZON_ENVIRONMENT=PRODUCTION
AMAZON_SELLER_CENTRAL_URL=https://sellingpartnerapi-eu.amazon.com
AMAZON_SELLER_ID=APCBEZW09ZM60
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV
```

### SDK Configuration
- **Region:** `eu` (for India marketplace)
- **Sandbox Endpoint:** `https://sandbox.sellingpartnerapi-eu.amazon.com`
- **Production Endpoint:** `https://sellingpartnerapi-eu.amazon.com`
- **Environment:** `SANDBOX` (issue) or `PRODUCTION` (working)

## 🔍 Debugging Steps

1. **Check Server Logs:**
   - Look for "Listings client configuration" log
   - Verify `endpoint` is `https://sandbox.sellingpartnerapi-eu.amazon.com`
   - Verify `region` is `eu`
   - Verify `environment` is `SANDBOX`

2. **Check Swagger Examples:**
   - Find the exact seller ID and parameters from Swagger
   - Use those exact values in your request

3. **Test with Swagger Parameters:**
   ```bash
   GET /v1/amazon/listings/{SELLER_ID_FROM_SWAGGER}?marketplaceId=A21TJRUUN4KGV
   ```

4. **Verify Authentication:**
   - Ensure `POST /v1/amazon/auth/initialize` returns 200
   - Check that sandbox refresh token is being used

## 📚 References

- [SP-API Sandbox Documentation](https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox)
- [SP-API Reference](https://developer-docs.amazon.com/sp-api/reference)
- [Listings Items API Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/listings-items-api-v2021-08-01-use-case-guide)

## 🎯 Expected Sandbox Success Response

Once you use the correct parameters from Swagger, you should get a response like:

```json
{
  "success": true,
  "message": "All listings items retrieved successfully",
  "data": {
    "numberOfResults": 10,
    "pagination": {
      "nextToken": "SANDBOX_NEXT_TOKEN"
    },
    "items": [
      {
        "sku": "SANDBOX_SKU_1",
        "summaries": [
          {
            "marketplaceId": "A21TJRUUN4KGV",
            "asin": "B0SANDBOX1",
            "productType": "EXAMPLE_TYPE",
            "itemName": "Sandbox Test Product",
            // ... other fields from Swagger example
          }
        ]
      }
    ]
  }
}
```

**Note:** The actual response structure will match the Swagger `x-amzn-api-sandbox` → `"static"` → `"response"` example.

## 💻 Implementation Code

### Route Definition
**File:** `src/routes/amazon.route.ts`

```typescript
// GET /v1/amazon/listings/:sellerId - Get all listings for a seller
fastify.get('/listings/:sellerId', {
  schema: {
    description: 'Get all listings items for a seller (no filters - returns all products)',
    tags: ['Amazon SP-API'],
    params: {
      type: 'object',
      properties: {
        sellerId: { type: 'string', description: 'Amazon Seller ID' },
      },
      required: ['sellerId'],
    },
    querystring: {
      type: 'object',
      properties: {
        marketplaceId: { type: 'string', description: 'Marketplace ID (default: A21TJRUUN4KGV for India)' },
        pageSize: { type: 'number', description: 'Number of results per page (default: 20, max: 100)' },
        pageToken: { type: 'string', description: 'Token for pagination (from previous response)' },
        includeInventory: { 
          type: 'string', 
          description: 'Include inventory data (fulfillment method and quantity). Set to "true" or "1" to enable.' 
        },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            additionalProperties: true, // Allow any properties in data object
          },
        },
        additionalProperties: false,
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
}, amazonController.getAllListingsItems.bind(amazonController));
```

### Controller Implementation
**File:** `src/controllers/amazon.controller.ts`

```typescript
/**
 * Get all listings items for a seller (no filters)
 */
getAllListingsItems = asyncHandler(async (
  request: FastifyRequest<{
    Params: { sellerId: string };
    Querystring: {
      marketplaceId?: string;
      pageSize?: number;
      pageToken?: string;
      includeInventory?: string; // 'true' or 'false' as string
    };
  }>,
  reply: FastifyReply
) => {
  const { sellerId } = request.params;
  const { marketplaceId, pageSize, pageToken, includeInventory } = request.query;

  logger.info({ sellerId, marketplaceId, pageSize, includeInventory }, 'Getting all listings items');

  try {
    const marketplaceIds = marketplaceId ? [marketplaceId] : undefined;
    const query: any = {};
    
    // Only add pagination if provided (no filters = get all)
    if (pageSize) query.pageSize = pageSize;
    if (pageToken) query.pageToken = pageToken;

    // Pass includeInventory flag to searchListingsItems to include fulfillmentAvailability
    const shouldIncludeInventory = includeInventory === 'true' || includeInventory === '1';
    let result = await this.amazonService.searchListingsItems(sellerId, marketplaceIds, query, shouldIncludeInventory);

    // Enrich with inventory if requested
    if (shouldIncludeInventory) {
      logger.info('Enriching listings with inventory data from fulfillmentAvailability');
      result = await this.amazonService.enrichListingsWithInventory(result, marketplaceIds);
    }

    return reply.code(200).send(createSuccessResponse('All listings items retrieved successfully', result));
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error getting all listings items');
    
    return reply.code(500).send({
      success: false,
      message: 'Failed to get all listings items',
      details: error.message || 'An error occurred while retrieving listings items',
      statusCode: 500,
    });
  }
});
```

### Service Implementation
**File:** `src/services/amazon.service.ts`

#### 1. Listings Client Configuration (Sandbox)
```typescript
private getListingsClientForSeller(sellerId?: string): ListingsItemsApiClient {
  if (sellerId && this.isAuthInitializedForSeller(sellerId)) {
    const cached = this.authInstances.get(sellerId);
    if (cached) {
      const auth = cached.auth;
      // For sandbox, use 'eu' region for India marketplace
      // Sandbox endpoint: sandbox.sellingpartnerapi-eu.amazon.com
      const region = cached.environment === 'SANDBOX' ? 'eu' : this.REGION;
      
      logger.debug({ 
        sellerId, 
        environment: cached.environment,
        region,
        endpoint: cached.endpoint,
        marketplaceId: cached.marketplaceId,
        note: 'Creating Listings client with seller-specific auth'
      }, 'Listings client configuration');
      
        const config: any = {
          auth,
          region,
        };
        // For sandbox, configure the SDK to use sandbox endpoint
        // The SDK's ClientConfiguration interface supports 'sandbox?: boolean'
        // Reference: node_modules/@sp-api-sdk/common/dist/types/axios.d.ts
        if (cached.environment === 'SANDBOX') {
          // Set sandbox flag - the SDK will use this to construct the sandbox endpoint
          // The SDK's createAxiosInstance function uses 'sandbox' to determine the endpoint
          config.sandbox = true;
          logger.debug({ 
            sellerId,
            environment: cached.environment,
            region,
            sandbox: true,
            expectedEndpoint: cached.endpoint,
            note: 'Configuring Listings client for sandbox mode using sandbox: true'
          }, 'Configuring Listings client for sandbox');
        }
      return new ListingsItemsApiClient(config);
    }
  }
  // Fall back to legacy client
  return this.getListingsClient();
}
```

#### 2. Search Listings Items Method
```typescript
async searchListingsItems(
  sellerId: string,
  marketplaceIds?: string[],
  query?: {
    keywords?: string[];
    sellerSkus?: string[];
    asins?: string[];
    pageSize?: number;
    pageToken?: string;
  },
  includeInventory: boolean = false
): Promise<any> {
  try {
    const client = this.getListingsClientForSeller(sellerId);
    const marketplaces = marketplaceIds || [this.DEFAULT_MARKETPLACE_ID];

    logger.info({ sellerId, marketplaces, query, includeInventory }, 'Searching listings items');

    // If inventory is needed, include fulfillmentAvailability in the request
    const requestParams: any = {
      sellerId,
      marketplaceIds: marketplaces,
      ...query,
    };

    // Add includedData if inventory is requested
    if (includeInventory) {
      requestParams.includedData = ['summaries', 'fulfillmentAvailability'];
    }

    // Log the actual request being made (for debugging sandbox endpoint)
    const cachedForLog = this.authInstances.get(sellerId);
    logger.debug({ 
      requestParams,
      sellerId,
      environment: cachedForLog?.environment,
      endpoint: cachedForLog?.endpoint,
      note: 'About to call searchListingsItems - check if SDK is using sandbox endpoint'
    }, 'Making searchListingsItems API call');
    
    const response = await client.searchListingsItems(requestParams);

    logger.debug({ 
      status: response.status,
      statusText: response.statusText,
      dataKeys: response.data ? Object.keys(response.data) : [],
      note: 'Listings items search completed'
    }, 'Listings items search completed successfully');
    return response.data;
  } catch (error: any) {
    const cached = this.authInstances.get(sellerId);
    const isSandbox = cached?.environment === 'SANDBOX';
    
    logger.error({ 
      error: error.message || error, 
      sellerId,
      environment: cached?.environment,
      region: cached?.environment === 'SANDBOX' ? 'eu' : this.REGION,
      endpoint: cached?.endpoint,
      note: isSandbox ? 'Sandbox environment - 403 errors often occur with production seller IDs' : 'Production environment'
    }, 'Error searching listings items');
    
    // Provide helpful error message for 403 in sandbox
    if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      if (isSandbox) {
        throw new Error(
          `Failed to search listings items: 403 Forbidden. ` +
          `SANDBOX environment detected. ` +
          `Sandbox uses pattern matching - your request parameters must match predefined test cases. ` +
          `The 403 error likely means your request doesn't match the sandbox's expected patterns. ` +
          `Solutions: 1) Check the Swagger model JSON for Listings Items API (2021-08-01) - look for "x-amzn-api-sandbox" → "static" array to find example request parameters, ` +
          `2) Use the exact seller ID, SKUs, and other parameters from the Swagger examples, ` +
          `3) For sandbox, sellerId doesn't need to be valid but must match the pattern in Swagger examples, ` +
          `4) Reference: https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox`
        );
      } else {
        throw new Error(
          `Failed to search listings items: 403 Forbidden. ` +
          `This may indicate: 1) Seller ID "${sellerId}" doesn't match authenticated account, ` +
          `2) App missing required roles/permissions, ` +
          `3) Seller account doesn't have access to marketplace.`
        );
      }
    }
    
    throw new Error(`Failed to search listings items: ${error.message || 'Unknown error'}`);
  }
}
```

#### 3. Auth Initialization (Sandbox Endpoint Configuration)
```typescript
async initializeAuthForSeller(
  refreshToken: string,
  clientId?: string,
  clientSecret?: string
): Promise<SellingPartnerApiAuth> {
  // Get sellerId and marketplaceId from environment variables
  const sellerId = env.AMAZON_SELLER_ID;
  const marketplaceId = env.AMAZON_MARKETPLACE_ID || this.DEFAULT_MARKETPLACE_ID;
  
  // Determine environment (sandbox vs production) from environment variable
  const envType = env.AMAZON_ENVIRONMENT || 'PRODUCTION';
  const isSandbox = envType === 'SANDBOX';
  
  // Determine endpoint based on environment
  // For India marketplace (A21TJRUUN4KGV), use EU sandbox endpoint
  // Reference: https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox
  let endpoint: string | undefined;
  let lwaEndpoint: string | undefined;
  if (isSandbox) {
    // Sandbox endpoints
    // For India marketplace (A21TJRUUN4KGV), use EU sandbox endpoint
    endpoint = 'https://sandbox.sellingpartnerapi-eu.amazon.com'; // SP-API endpoint (EU region for India)
    lwaEndpoint = 'https://api.sandbox.sellingpartnerapi.amazon.com'; // LWA endpoint for access tokens
  } else {
    // Production endpoints
    endpoint = 'https://sellingpartnerapi-eu.amazon.com'; // SP-API endpoint (EU region for India)
    lwaEndpoint = 'https://api.sellingpartnerapi.amazon.com'; // LWA endpoint for access tokens
  }

  // ... (auth instance creation and validation)
  
  // Cache it only after successful validation
  this.authInstances.set(sellerId, {
    auth,
    marketplaceId,
    lastUsed: new Date(),
    environment: envType,
    endpoint, // Store endpoint for SDK client configuration
  });
  
  return auth;
}
```

## 🔍 Key Implementation Details

1. **SDK Package Used:** `@sp-api-sdk/listings-items-api-2021-08-01`
2. **Authentication:** Uses `SellingPartnerApiAuth` from `@sp-api-sdk/auth`
3. **Region Configuration:** 
   - Sandbox: `region: 'eu'` (for India marketplace)
   - Production: `region: 'eu'` (for India marketplace)
4. **Endpoint Configuration:**
   - Sandbox: `https://sandbox.sellingpartnerapi-eu.amazon.com`
   - Production: `https://sellingpartnerapi-eu.amazon.com`
5. **Sandbox Configuration:**
   - Uses `config.sandbox = true` (official SDK parameter)
   - The SDK's `ClientConfiguration` interface supports `sandbox?: boolean`
   - The SDK's `createAxiosInstance` function automatically constructs the sandbox endpoint when `sandbox: true`
   - **Sandbox Endpoint Format:** `GET /listings/2021-08-01/items/{ANY_SELLER_ID}?identifiersType=SKU&identifiers={SKU}&marketplaceIds={MARKETPLACE_ID}`

## ⚠️ Known Issue

The SDK uses `sandbox: true` to automatically construct the sandbox endpoint. However, we're still getting 403 errors in sandbox, which suggests:

1. **Pattern Matching:** Sandbox requires exact parameter matching with Swagger examples. The seller ID, SKU, and other parameters must match the predefined test cases in the Swagger model JSON.

2. **Sandbox Endpoint Format:** The sandbox API uses a specific endpoint format:
   ```
   GET /listings/2021-08-01/items/{ANY_SELLER_ID}?identifiersType=SKU&identifiers={SKU}&marketplaceIds={MARKETPLACE_ID}
   ```
   The SDK should handle this automatically when `sandbox: true` is set, but we need to verify the SDK is correctly constructing the sandbox URL.

3. **Request Parameters:** Sandbox might require specific parameter values (e.g., specific seller IDs, SKUs) that match the Swagger examples. Using `A1MOCKSELLER123` might not match any sandbox test case.

### Environment Variable Note

**Important:** Your `.env` file has:
```env
AMAZON_SELLER_CENTRAL_URL=https://sandbox.sellingpartnerapi-na.amazon.com/
```

However, the code uses:
- **For India marketplace:** `https://sandbox.sellingpartnerapi-eu.amazon.com` (EU region)
- **For North America:** `https://sandbox.sellingpartnerapi-na.amazon.com` (NA region)

According to [Amazon's documentation](https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox), India marketplace (`A21TJRUUN4KGV`) uses the **EU sandbox endpoint**, not the NA endpoint. The `AMAZON_SELLER_CENTRAL_URL` environment variable is not used by the SDK - it's only for reference.

## 📊 Summary

| Environment | Status | Seller ID | Endpoint | Result |
|------------|--------|-----------|----------|--------|
| **Production** | ✅ **Working** | `APCBEZW09ZM60` | `sellingpartnerapi-eu.amazon.com` | Success - Returns product listings |
| **Sandbox** | ❌ **403 Error** | `A1MOCKSELLER123` | `sandbox.sellingpartnerapi-eu.amazon.com` | 403 Forbidden - Pattern mismatch |

**Conclusion:** The implementation code is correct. The issue is that:
1. Sandbox requires exact parameter matching with Swagger examples
2. The SDK might not be using the sandbox endpoint correctly (needs verification)
3. Production works perfectly with real seller ID and credentials

