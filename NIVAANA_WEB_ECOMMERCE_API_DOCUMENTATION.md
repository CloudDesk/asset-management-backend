# Nivaana Web/E-commerce API Documentation

Last analyzed: 2026-06-03

This document covers only the customer-facing Nivaana web/e-commerce API surface used by the existing mobile app flows. Inventory/admin asset-management APIs are intentionally excluded.

## 1. Base URLs

| Environment | Base URL |
| --- | --- |
| Local | `http://localhost:<PORT>` |
| Development | `https://nivaana-dev-715569764663.asia-south1.run.app` |
| Production | `https://nivaana-715569764663.asia-south1.run.app` |

Swagger/OpenAPI UI is available at:

```text
<BASE_URL>/docs
```

Health check:

```http
GET /health
```

## 2. Authentication

Most e-commerce APIs require JWT bearer authentication after OTP login.

Use the access token returned by OTP verification:

```http
Authorization: Bearer <access_token>
```

The backend also supports token query parameters, but the Authorization header is recommended:

```http
?token=<access_token>
```

### Public Customer Routes

These routes do not require a bearer token:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/v1/mobile-auth/request-otp` | Request Exotel OTP |
| `POST` | `/v1/mobile-auth/verify-otp` | Verify OTP and get JWT tokens |
| `GET` | `/v1/products/platform/nivapp` | Public Nivaana app product listing |
| `GET` | `/v1/products/platform/nivapp/counts` | Product category/subcategory counts |
| `GET` | `/v1/products/:productId/platform/:platform` | Product detail with platform stock |
| `GET` | `/v1/promotions` | Public promotions list |
| `GET` | `/v1/ratings` | Ratings list |
| `GET` | `/v1/ratings/product/:productId` | Product ratings |
| `GET` | `/v1/picklists` | Picklist/filter data |
| `GET` | `/health` | API health |

Note: Twilio OTP endpoints exist but are protected by the current public-route configuration. Use the Exotel OTP endpoints for customer web login unless backend auth rules change.

## 3. Common Response Formats

### Success

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Paginated List

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "filters": [],
    "total": 100,
    "filtered": false
  }
}
```

### Error

```json
{
  "success": false,
  "message": "Error message",
  "details": "Detailed explanation",
  "statusCode": 400
}
```

Common error codes:

| Code | Meaning |
| --- | --- |
| `400` | Invalid request or validation error |
| `401` | Missing, invalid, or expired token |
| `404` | Resource not found |
| `409` | Duplicate/conflict |
| `429` | Rate limited, often OTP-related |
| `500` | Server or integration error |

## 4. Recommended Web App Flow

1. Load picklists and public products:
   - `GET /v1/picklists`
   - `GET /v1/products/platform/nivapp`
2. Customer logs in with mobile OTP:
   - `POST /v1/mobile-auth/request-otp`
   - `POST /v1/mobile-auth/verify-otp`
3. Store `token`, `refreshToken`, and `user.id`.
4. Read or mutate cart/wishlist:
   - `GET /v1/carts/user/:userId`
   - `POST /v1/carts/upsert`
5. Manage address:
   - `GET /v1/addresses?userid=<userId>`
   - `POST /v1/addresses`
6. Evaluate promotions before payment:
   - `POST /v1/promotions/offers`
   - `POST /v1/promotions/evaluate`
7. Start payment:
   - `POST /v1/phonepe/initiate` or `POST /v1/phonepe/create-sdk-order`
8. Poll or check order/payment:
   - `GET /v1/phonepe/status/:merchantTransactionId`
   - `GET /v1/orders/user/:userid/details`
   - `GET /v1/orders/:id/track`

## 5. Customer Authentication APIs

### 5.1 Request OTP

```http
POST /v1/mobile-auth/request-otp
Content-Type: application/json
```

Public: yes

Request:

```json
{
  "usermobilenumber": 9344715431
}
```

Optional delete-account verification mode:

```json
{
  "usermobilenumber": 9344715431,
  "verifyOnly": true
}
```

Fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `usermobilenumber` | number | yes | 10-11 digit mobile number |
| `verifyOnly` | boolean | no | If true, backend checks existing user and does not create a new-account flow |

Success response:

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "mobileNumber": 9344715431,
    "otpSent": true,
    "expiresIn": 300,
    "canResendAfter": 60,
    "isNewUser": false
  }
}
```

Notes:

- The Exotel flow uses a 4-digit OTP.
- For normal login/signup, a user is created only after successful OTP verification.
- Rate-limited responses may include `Retry-After` and status `429`.

### 5.2 Verify OTP

```http
POST /v1/mobile-auth/verify-otp
Content-Type: application/json
```

Public: yes

Request:

```json
{
  "usermobilenumber": 9344715431,
  "otp": 1234
}
```

Fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `usermobilenumber` | number | yes | Same mobile number used for OTP request |
| `otp` | number or string | yes | Exactly 4 digits |

Success response:

```json
{
  "success": true,
  "message": "User authenticated successfully",
  "data": {
    "user": {
      "id": 101,
      "usermobilenumber": 9344715431,
      "useremail": null,
      "firstname": null,
      "lastname": null,
      "gender": null,
      "gstnumber": null,
      "isbusinessuser": false
    },
    "token": "<jwt_access_token>",
    "refreshToken": "<jwt_refresh_token>",
    "expiresIn": 86400,
    "isNewUser": false
  }
}
```

Failure examples:

```json
{
  "success": false,
  "message": "Invalid OTP format",
  "details": "OTP must be exactly 4 digits",
  "statusCode": 400
}
```

```json
{
  "success": false,
  "message": "OTP verification failed",
  "details": "Invalid or expired OTP",
  "statusCode": 401,
  "attemptsRemaining": 2,
  "canResend": true
}
```

### 5.3 Legacy Email User Sign In

```http
POST /v1/users/signin
Content-Type: application/json
```

Protected by current smart auth behavior. Prefer OTP login for customer web flows.

Request:

```json
{
  "useremail": "customer@example.com",
  "userpassword": "SecurePassword123!"
}
```

## 6. Product APIs

Use platform `nivapp` for Nivaana web/e-commerce product browsing.

### 6.1 List Products for Nivaana App

```http
GET /v1/products/platform/nivapp
```

Public: yes, for the exact `nivapp` platform route.

Query parameters:

| Parameter | Type | Notes |
| --- | --- | --- |
| `page` | string/number | Page number |
| `limit` | string/number | Items per page |
| `category` | string | Filter by category |
| `subcategory` | string | Filter by subcategory |
| `subsubcategory` | string | Filter by third-level category |
| `brand` | string | Filter by brand |
| `minPrice` | string/number | Minimum price |
| `maxPrice` | string/number | Maximum price |
| `stockStatus` | string | Stock filter |
| `search` | string | Search text |
| `isdealoftheday` | string/boolean | Deal-of-the-day filter |
| `sortBy` | string | Sort field |
| `sortOrder` | string | Sort direction |

Example:

```http
GET /v1/products/platform/nivapp?page=1&limit=20&category=Aroma&minPrice=100&maxPrice=1000&sortBy=price&sortOrder=asc
```

Typical response:

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "name": "Product name",
      "puc": "PUC-001",
      "shortdescription": "Short description",
      "fulldescription": "Full description",
      "category": "Category",
      "subcategory": "Subcategory",
      "brand": "Nivaana",
      "price": 499,
      "discount": 10,
      "averagerating": 4.5,
      "large": ["https://..."],
      "medium": ["https://..."],
      "small": ["https://..."],
      "productstatus": "active",
      "isdealoftheday": false,
      "availablequantity": 10,
      "iscombo": false,
      "combotype": null,
      "components": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "platform": "nivapp",
    "filters": [],
    "total": 1,
    "filtered": false
  },
  "message": "Products retrieved successfully"
}
```

Combo products may include component stock like this:

```json
{
  "iscombo": true,
  "components": [
    {
      "componentproductid": 15,
      "requiredqty": 1,
      "isactive": true,
      "product": {
        "name": "Component product",
        "puc": "PUC-015"
      },
      "platformStock": {
        "availableqty": 8,
        "lockqty": 0,
        "orderedqty": 1,
        "soldqty": 2,
        "platformstatus": "active"
      }
    }
  ]
}
```

### 6.1.1 Product Listing Response Structure

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "name": "Product name",
      "shortdescription": "Short description",
      "fulldescription": "Full description",
      "price": 499,
      "discount": 10,
      "category": "Category",
      "subcategory": "Subcategory",
      "subsubcategory": "Subcategory level 3",
      "large": ["https://..."],
      "medium": ["https://..."],
      "small": ["https://..."],
      "availablequantity": 10,
      "iscombo": false,
      "combotype": null,
      "components": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "platform": "nivapp",
    "filters": [],
    "total": 1,
    "filtered": false
  },
  "message": "Products retrieved successfully"
}
```

Error responses:

```json
{
  "success": false,
  "message": "Invalid request",
  "details": "Error details",
  "statusCode": 400
}
```

```json
{
  "success": false,
  "message": "Internal server error",
  "details": "Error details",
  "statusCode": 500
}
```

### 6.2 Product Counts

```http
GET /v1/products/platform/nivapp/counts
```

Public: yes

Use this for filter/sidebar counts grouped by category and subcategory.

Response:

```json
{
  "success": true,
  "data": {
    "platform": "nivapp",
    "totalProducts": 24,
    "categories": [
      {
        "id": "aroma",
        "label": "Aroma",
        "count": 12,
        "subcategories": [
          {
            "id": "diffuser",
            "label": "Diffuser",
            "count": 6,
            "subsubcategories": [
              {
                "id": "ceramic",
                "label": "Ceramic",
                "count": 3
              }
            ]
          }
        ]
      }
    ]
  },
  "message": "Product counts retrieved successfully"
}
```

### 6.3 Product Detail with Platform Stock

```http
GET /v1/products/:productId/platform/:platform
```

Public: yes

Example:

```http
GET /v1/products/12/platform/nivapp
```

Returns a single product with platform-specific stock data.

Response:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "name": "Product name",
    "price": 499,
    "category": "Category",
    "subcategory": "Subcategory",
    "remarks": "Product remarks",
    "availablequantity": 10,
    "iscombo": false,
    "combotype": null,
    "components": null
  },
  "message": "Product retrieved successfully"
}
```

## 7. Picklist APIs

### 7.1 List Picklists

```http
GET /v1/picklists
```

Public: yes

Query parameters:

| Parameter | Notes |
| --- | --- |
| `page`, `limit` | Pagination |
| `label`, `value` | Filter by picklist label/value |
| `object` | Filter by object/module |
| `fieldname` | Filter by field name |
| `controlledvalue` | Dependent picklist value |
| `controlledfieldname` | Dependent field name |
| `parent` | Parent value |
| `isactive` | Active flag |
| `searchtext` | Search |
| `sortorder` | Sort order |

Typical use:

```http
GET /v1/picklists?object=product&isactive=true
```

## 8. Cart and Wishlist APIs

All cart and wishlist routes require bearer auth.

### 8.1 Get User Cart

```http
GET /v1/carts/user/:userId
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "message": "Cart items retrieved successfully",
  "data": [
    {
      "id": 1,
      "productid": 12,
      "userid": 101,
      "quantity": 2,
      "iscart": true,
      "iswishlist": false,
      "createddate": 1780460000000,
      "modifieddate": 1780460000000
    }
  ]
}
```

### 8.2 Get User Wishlist

```http
GET /v1/carts/wishlist/:userId
Authorization: Bearer <token>
```

### 8.3 Create Cart/Wishlist Item

```http
POST /v1/carts
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "productid": 12,
  "userid": 101,
  "quantity": 2,
  "iscart": true,
  "iswishlist": false
}
```

### 8.4 Upsert Cart/Wishlist Item

```http
POST /v1/carts/upsert
Authorization: Bearer <token>
Content-Type: application/json
```

Use this for add-to-cart, quantity changes, or toggling wishlist state.

Create:

```json
{
  "productid": 12,
  "userid": 101,
  "quantity": 1,
  "iscart": true,
  "iswishlist": false
}
```

Update existing row:

```json
{
  "id": 1,
  "productid": 12,
  "userid": 101,
  "quantity": 3,
  "iscart": true,
  "iswishlist": false
}
```

### 8.5 Update Cart Item

```http
PUT /v1/carts/:id
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "quantity": 3,
  "iscart": true
}
```

### 8.6 Delete Cart Item

```http
DELETE /v1/carts/:id
Authorization: Bearer <token>
```

### 8.7 Clear User Cart

```http
DELETE /v1/carts/user/:userId/clear
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "data": {
    "deletedCount": 3
  }
}
```

## 9. Customer User APIs

Customer user routes require bearer auth unless backend public-route rules are changed.

### 9.1 Get User

```http
GET /v1/users/:id
Authorization: Bearer <token>
```

### 9.2 Update User Profile

```http
PUT /v1/users/:id
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "firstname": "Harish",
  "lastname": "Kumar",
  "useremail": "harish@example.com",
  "gender": "male",
  "gstnumber": "33ABCDE1234F1Z5",
  "isbusinessuser": false,
  "fcmid": "firebase-token"
}
```

### 9.3 Create Guest User

```http
POST /v1/users/guest
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "firstname": "Guest Customer",
  "useremail": "",
  "usermobilenumber": 9344715431
}
```

Required:

| Field | Type |
| --- | --- |
| `firstname` | string |
| `usermobilenumber` | number |

`useremail` is optional and may be an empty string or valid email.

### 9.4 Convert Guest to Registered

```http
POST /v1/users/:id/convert-to-registered
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "useremail": "customer@example.com",
  "userpassword": "SecurePassword123!",
  "lastname": "Customer"
}
```

## 10. Address APIs

All address routes require bearer auth.

### 10.1 List Addresses

```http
GET /v1/addresses?userid=101
Authorization: Bearer <token>
```

Query filters:

| Parameter | Notes |
| --- | --- |
| `userid` | Filter by customer |
| `name` | Receiver name |
| `mobilenumber` | Receiver mobile |
| `pincode` | Pincode |
| `state`, `city` | Location filters |
| `isdefaultaddress` | `true` or `false` |

### 10.2 Get Default Address

```http
GET /v1/addresses/default/:userId
Authorization: Bearer <token>
```

### 10.3 Create Address

```http
POST /v1/addresses
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "userid": 101,
  "name": "Harish",
  "mobilenumber": 9344715431,
  "pincode": 600042,
  "doornumber": "12A",
  "address": "Main road, Velachery",
  "landmark": "Near metro",
  "state": "Tamil Nadu",
  "city": "Chennai",
  "isdefaultaddress": true
}
```

### 10.4 Update Address

```http
PUT /v1/addresses/:id
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "name": "Harish",
  "mobilenumber": 9344715431,
  "pincode": 600042,
  "address": "Updated address",
  "isdefaultaddress": true
}
```

### 10.5 Delete Address

```http
DELETE /v1/addresses/:id
Authorization: Bearer <token>
```

## 11. Promotion APIs

### 11.1 List Promotions

```http
GET /v1/promotions
```

Public: yes

Query parameters:

| Parameter | Notes |
| --- | --- |
| `page`, `limit` | Pagination |
| `search` | Search text |
| `userid` | Optional user context |
| `channel` | `web`, `mobile`, etc. |
| `geo` | Region, usually `IN` |
| `current_date` | Evaluation date |
| `name`, `type`, `code`, `status` | Filters |
| `auto_apply` | Automatic promotion flag |
| `visibility` | `public` or `private` |
| `stackable` | Stackable flag |
| `budget_min`, `budget_max` | Budget filters |
| `discount_type` | Discount type |
| `discount_value_min`, `discount_value_max` | Discount value filters |
| `start_date_after`, `start_date_before` | Date filters |
| `end_date_after`, `end_date_before` | Date filters |

### 11.2 Get Unified Offers

```http
POST /v1/promotions/offers
Authorization: Bearer <token>
Content-Type: application/json
```

Use this to show the best promotion recommendation plus eligible/ineligible offers.

Typical request:

```json
{
  "user_id": "101",
  "cart_data": {
    "items": [
      {
        "product_id": "12",
        "quantity": 2,
        "base_price": 499,
        "product_discount": 50,
        "price": 449,
        "category": "Aroma",
        "subcategory": "Diffuser",
        "name": "Product name"
      }
    ],
    "subtotal": 898,
    "shipping_cost": 40,
    "tax_amount": 0,
    "total": 938
  },
  "context": {
    "channel": "web",
    "geo": "IN",
    "payment_method": "phonepe"
  }
}
```

### 11.3 Evaluate Promotion

```http
POST /v1/promotions/evaluate
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "cart_id": "cart-101",
  "user_id": "101",
  "promotion_id": 5,
  "cart_data": {
    "items": [
      {
        "product_id": "12",
        "quantity": 2,
        "base_price": 499,
        "product_discount": 50,
        "price": 449
      }
    ],
    "subtotal": 898,
    "shipping_cost": 40,
    "tax_amount": 0,
    "total": 938
  },
  "context": {
    "channel": "web",
    "geo": "IN",
    "payment_method": "phonepe"
  }
}
```

Success response:

```json
{
  "success": true,
  "evaluation_id": "eval_123",
  "original_total": 938,
  "discounted_total": 838,
  "total_discount": 100,
  "applied_promotions": [
    {
      "promotion_id": 5,
      "promotion_name": "Flat 100 Off",
      "promotion_type": "FIXED_AMOUNT_OFF_CART",
      "discount_amount": 100,
      "is_auto": false,
      "is_free_shipping": false
    }
  ],
  "ineligible_reasons": [],
  "expires_at": "2026-06-03T12:00:00.000Z"
}
```

### 11.4 Evaluate Automatic Promotions

```http
POST /v1/promotions/evaluate/automatic
Authorization: Bearer <token>
Content-Type: application/json
```

Use this to auto-apply active promotions based on cart content.

### 11.5 Remove Coupon from Evaluation

```http
POST /v1/promotions/evaluate/remove
Authorization: Bearer <token>
Content-Type: application/json
```

Typical request:

```json
{
  "evaluation_id": "eval_123",
  "promotion_id": 5
}
```

### 11.6 Redeem Promotion After Order

```http
POST /v1/promotions/redeem
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "evaluation_id": "eval_123",
  "order_id": "ORD-123456"
}
```

## 12. PhonePe Payment APIs

PhonePe customer payment routes require bearer auth except callbacks/webhooks intended for PhonePe/internal calls.

### 12.1 Generate Transaction ID

```http
GET /v1/phonepe/generate-transaction-id?prefix=TXN
Authorization: Bearer <token>
```

Use this if the frontend needs a backend-generated merchant transaction ID before initiation.

### 12.2 Initiate Payment

```http
POST /v1/phonepe/initiate
Authorization: Bearer <token>
Content-Type: application/json
```

Request schema:

```json
{
  "merchantTransactionId": "TXN123456789",
  "amount": 999.99,
  "name": "Harish Kumar",
  "mobileNumber": "9344715431",
  "userId": 101,
  "productIds": [12, 13],
  "transactionFor": "product_purchase",
  "callbackUrl": "https://example.com/payment/callback"
}
```

Fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `merchantTransactionId` | string | no | Max 35 chars |
| `amount` | number | yes | Greater than 0, max 100000, two decimals max |
| `name` | string | yes | Letters and spaces only |
| `mobileNumber` | string | yes | Exactly 10 digits, cannot start with 0 |
| `userId` | number | yes | Customer user ID |
| `productIds` | number[] | no | Product IDs in transaction |
| `transactionFor` | string | no | Defaults to `product_purchase` |
| `callbackUrl` | string | no | Valid URL |

Success response:

```json
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "merchantTransactionId": "TXN123456789",
    "redirectUrl": "https://...",
    "amount": 999.99,
    "status": "INITIATED"
  },
  "errors": null
}
```

### 12.3 Create SDK Order

```http
POST /v1/phonepe/create-sdk-order
Authorization: Bearer <token>
Content-Type: application/json
```

Use this for mobile SDK style order-token flows. For web checkout, confirm with the payment integration approach whether to use `/initiate` redirect flow or SDK order flow.

### 12.4 Check Payment Status

```http
GET /v1/phonepe/status/:merchantTransactionId
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "message": "Payment status retrieved successfully",
  "data": {
    "merchantTransactionId": "TXN123456789",
    "status": "SUCCESS",
    "success": true,
    "message": "Payment successful",
    "paymentData": {
      "merchantTransactionId": "TXN123456789",
      "transactionId": "PG123",
      "amount": 99999,
      "state": "COMPLETED",
      "responseCode": "SUCCESS",
      "paymentInstrument": {
        "type": "UPI"
      }
    }
  },
  "errors": null
}
```

### 12.5 PhonePe Callback

```http
GET /v1/phonepe/callback/:transactionId
POST /v1/phonepe/callback/:transactionId
```

Public: yes

This is intended for PhonePe redirects/callbacks. The backend checks transaction status, creates orders after successful payment, and updates product quantities/locks.

### 12.6 Refund

```http
POST /v1/phonepe/refund/:merchantTransactionId
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "refundAmount": 499,
  "reason": "Customer cancellation"
}
```

### 12.7 Refund Status

```http
GET /v1/phonepe/refund-status/:refundId
Authorization: Bearer <token>
```

### 12.8 Bulk Payment Status

```http
POST /v1/phonepe/bulk-status
Authorization: Bearer <token>
Content-Type: application/json
```

Use this to fetch multiple transaction statuses in one request.

## 13. Order APIs

Most order APIs are protected. Customer-facing web app usually needs list/details, tracking, and cancellation.

### 13.1 List Orders

```http
GET /v1/orders?userid=101
Authorization: Bearer <token>
```

Query filters:

| Parameter | Notes |
| --- | --- |
| `page`, `limit` | Pagination |
| `userid` | Customer user ID |
| `addressid` | Address ID |
| `orderid` | Human/order number |
| `orderstatus` | Order status |
| `transactionid` | Payment transaction ID |
| `merchanttransactionid` | Merchant transaction ID |
| `ispaymentsucceed` | Payment success flag |

### 13.2 Get Order Details

```http
GET /v1/orders/:id/details
Authorization: Bearer <token>
```

`id` may be database ID or order number.

Response includes:

- `order`
- `orderlines`
- `address`
- status history
- shipment/tracking fields
- tax/GST totals
- invoice URL where available
- refund fields where available

### 13.3 Get User Order Details

```http
GET /v1/orders/user/:userid/details
Authorization: Bearer <token>
```

Use this for a customer's "My Orders" page when detailed orderline/address data is needed.

### 13.4 Track Order

```http
GET /v1/orders/:id/track
Authorization: Bearer <token>
```

`id` may be database ID or order number.

Response:

```json
{
  "success": true,
  "message": "Order tracking retrieved successfully",
  "data": {
    "order_id": 1001,
    "order_number": "ORD-123456",
    "order_status": "shipped",
    "tracking_id": "AWB123",
    "vendor": "EKART",
    "public_tracking_link": "https://...",
    "tracking_available": true,
    "ekart_tracking": {
      "status": "in_transit",
      "current_location": "Chennai",
      "description": "Shipment in transit",
      "estimated_delivery": null,
      "status_history": []
    }
  }
}
```

### 13.5 Cancel Order

```http
POST /v1/orders/:id/cancel
Authorization: Bearer <token>
Content-Type: application/json
```

Use for customer cancellation flows. If payment was online, verify refund behavior with PhonePe refund APIs and backend business rules.

## 14. Orderline APIs

Orderline APIs require bearer auth.

Useful customer-facing endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/v1/orderlines/order/:orderid` | Get orderlines by order |
| `GET` | `/v1/orderlines/:id` | Get one orderline |
| `GET` | `/v1/orderlines/orderlinenumber/:orderlinenumber` | Lookup by orderline number |
| `PATCH` | `/v1/orderlines/:id/cancel` | Cancel individual line item |

## 15. Ratings and Reviews APIs

### 15.1 List Ratings

```http
GET /v1/ratings
```

Public: yes

Query filters:

| Parameter | Notes |
| --- | --- |
| `page`, `limit` | Pagination |
| `userid` | Customer |
| `productid` | Product |
| `orderid` | Order |
| `starrating` | 1-5 |
| `usermail` | Email |
| `orderlineid` | Orderline |
| `createdAfter`, `createdBefore` | Date range |

### 15.2 Product Ratings

```http
GET /v1/ratings/product/:productId
```

Public: yes

### 15.3 Create Rating

```http
POST /v1/ratings
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "userid": 101,
  "productid": 12,
  "orderid": 1001,
  "orderlineid": 5001,
  "starrating": 5,
  "comments": "Loved it",
  "url": ["https://..."],
  "usermail": "customer@example.com"
}
```

### 15.4 Upsert Rating

```http
POST /v1/ratings/upsert
Authorization: Bearer <token>
Content-Type: application/json
```

Use this when the user may be editing an existing review.

## 16. Push Notification APIs

All push notification routes require bearer auth.

### 16.1 Register Device Token

```http
POST /v1/push-notifications/register
Authorization: Bearer <token>
Content-Type: application/json
```

Use after login or when Firebase/APNS token refreshes.

Typical request:

```json
{
  "token": "device-push-token",
  "platform": "web",
  "deviceId": "browser-or-device-id"
}
```

Confirm final payload keys against Swagger before implementation because this route uses its own schema file.

### 16.2 Unregister Device Token

```http
POST /v1/push-notifications/unregister
Authorization: Bearer <token>
Content-Type: application/json
```

Use on logout or notification opt-out.

### 16.3 Test Notification

```http
POST /v1/push-notifications/test
Authorization: Bearer <token>
Content-Type: application/json
```

## 17. E-commerce Integration Checklist

### Product Listing Page

Required APIs:

- `GET /v1/products/platform/nivapp`
- `GET /v1/products/platform/nivapp/counts`
- `GET /v1/picklists`
- `GET /v1/promotions`

### Product Detail Page

Required APIs:

- `GET /v1/products/:productId/platform/nivapp`
- `GET /v1/ratings/product/:productId`
- `POST /v1/carts/upsert` after login

### Login Modal

Required APIs:

- `POST /v1/mobile-auth/request-otp`
- `POST /v1/mobile-auth/verify-otp`

Store:

- `data.user.id`
- `data.token`
- `data.refreshToken`
- `data.expiresIn`

### Cart Page

Required APIs:

- `GET /v1/carts/user/:userId`
- `POST /v1/carts/upsert`
- `PUT /v1/carts/:id`
- `DELETE /v1/carts/:id`
- `POST /v1/promotions/offers`
- `POST /v1/promotions/evaluate`

### Checkout Page

Required APIs:

- `GET /v1/addresses?userid=<userId>`
- `POST /v1/addresses`
- `PUT /v1/addresses/:id`
- `POST /v1/phonepe/initiate`
- `GET /v1/phonepe/status/:merchantTransactionId`

### My Orders Page

Required APIs:

- `GET /v1/orders/user/:userid/details`
- `GET /v1/orders/:id/details`
- `GET /v1/orders/:id/track`
- `POST /v1/orders/:id/cancel`

## 18. Audited GET Response Structures

This section summarizes the actual response envelopes for the GET endpoints used by the web/e-commerce app. Some route schemas allow additional fields, so the listed object fields are the stable documented fields, not an exhaustive database dump.

### 18.1 `GET /health`

```json
{
  "success": true,
  "message": "Health check successful",
  "data": {
    "status": "ok",
    "timestamp": "2026-06-03T00:00:00.000Z",
    "uptime": 123.45,
    "environment": "production"
  },
  "errors": null
}
```

### 18.2 `GET /v1/products/platform/:platform`

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "name": "Product name",
      "shortdescription": "Short description",
      "fulldescription": "Full description",
      "price": 499,
      "discount": 10,
      "category": "Category",
      "subcategory": "Subcategory",
      "subsubcategory": "Subcategory level 3",
      "large": ["https://..."],
      "medium": ["https://..."],
      "small": ["https://..."],
      "availablequantity": 10,
      "iscombo": false,
      "combotype": null,
      "components": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "platform": "nivapp",
    "filters": [],
    "total": 1,
    "filtered": false
  },
  "message": "Products retrieved successfully"
}
```

### 18.3 `GET /v1/products/platform/:platform/counts`

```json
{
  "success": true,
  "data": {
    "platform": "nivapp",
    "totalProducts": 24,
    "categories": [
      {
        "id": "category-id",
        "label": "Category",
        "count": 12,
        "subcategories": [
          {
            "id": "subcategory-id",
            "label": "Subcategory",
            "count": 6,
            "subsubcategories": [
              {
                "id": "subsubcategory-id",
                "label": "Subsubcategory",
                "count": 3
              }
            ]
          }
        ]
      }
    ]
  },
  "message": "Product counts retrieved successfully"
}
```

### 18.4 `GET /v1/products/:id/platform/:platform`

```json
{
  "success": true,
  "data": {
    "id": 12,
    "name": "Product name",
    "price": 499,
    "category": "Category",
    "subcategory": "Subcategory",
    "remarks": "Product remarks",
    "availablequantity": 10,
    "iscombo": false,
    "combotype": null,
    "components": null
  },
  "message": "Product retrieved successfully"
}
```

### 18.5 `GET /v1/picklists`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "label": "Display label",
      "value": "stored_value",
      "object": "product",
      "controlledvalue": null,
      "fieldname": "category",
      "controlledlabel": null,
      "controlledfieldname": null,
      "parent": null,
      "description": "Description",
      "sortorder": 1,
      "isactive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "filters": [],
    "total": 1,
    "filtered": false
  },
  "message": "Picklists retrieved successfully"
}
```

### 18.6 `GET /v1/carts/user/:userId`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "productid": 12,
      "userid": 101,
      "quantity": 2,
      "iscart": true,
      "iswishlist": false,
      "createddate": 1780460000000,
      "modifieddate": 1780460000000
    }
  ],
  "message": "Cart items retrieved successfully"
}
```

### 18.7 `GET /v1/carts/wishlist/:userId`

```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "productid": 12,
      "userid": 101,
      "quantity": 1,
      "iscart": false,
      "iswishlist": true,
      "createddate": 1780460000000,
      "modifieddate": 1780460000000
    }
  ],
  "message": "Wishlist items retrieved successfully"
}
```

### 18.8 `GET /v1/users/:id`

```json
{
  "success": true,
  "data": {
    "id": 101,
    "useremail": "customer@example.com",
    "firstname": "Customer",
    "lastname": "Name",
    "gender": "female",
    "gstnumber": null,
    "isbusinessuser": false,
    "usermobilenumber": 9344715431,
    "fcmid": "firebase-token",
    "createddate": 1780460000000,
    "modifieddate": 1780460000000
  },
  "message": "User retrieved successfully"
}
```

### 18.9 `GET /v1/addresses`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userid": 101,
      "name": "Customer",
      "mobilenumber": 9344715431,
      "pincode": 600042,
      "doornumber": "12A",
      "address": "Street address",
      "landmark": "Near landmark",
      "state": "Tamil Nadu",
      "city": "Chennai",
      "isdefaultaddress": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "filters": ["userid"],
    "total": 1,
    "filtered": true
  }
}
```

### 18.10 `GET /v1/addresses/default/:userId`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userid": 101,
    "name": "Customer",
    "mobilenumber": 9344715431,
    "pincode": 600042,
    "doornumber": "12A",
    "address": "Street address",
    "landmark": "Near landmark",
    "state": "Tamil Nadu",
    "city": "Chennai",
    "isdefaultaddress": true
  },
  "message": "Default address retrieved successfully"
}
```

### 18.11 `GET /v1/promotions`

```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "name": "Flat 100 Off",
      "description": "Promotion description",
      "type": "FIXED_AMOUNT_OFF_CART",
      "code": "SAVE100",
      "auto_apply": false,
      "start_date": 1780460000000,
      "end_date": 1781060000000,
      "status": "active",
      "priority": 1,
      "visibility": "public",
      "max_redemptions": 1000,
      "per_user_limit": 1,
      "stackable": false,
      "budget": 100000,
      "timezone": "Asia/Kolkata",
      "evaluation_expiry_minutes": 15,
      "discount_type": "fixed",
      "discount_value": 100,
      "conditions": [],
      "action": {
        "type": "FIXED_AMOUNT_OFF",
        "value": 100
      },
      "createddate": 1780460000000,
      "modifieddate": 1780460000000
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "filters": [],
    "total": 1,
    "filtered": false,
    "adminMode": false
  },
  "message": "Promotions retrieved successfully"
}
```

### 18.12 `GET /v1/phonepe/generate-transaction-id`

```json
{
  "success": true,
  "message": "Transaction ID generated successfully",
  "data": {
    "merchantTransactionId": "TXN123456789",
    "prefix": "TXN",
    "timestamp": 1780460000000
  }
}
```

### 18.13 `GET /v1/phonepe/status/:merchantTransactionId`

```json
{
  "success": true,
  "message": "Payment status retrieved successfully",
  "data": {
    "merchantTransactionId": "TXN123456789",
    "status": "PAYMENT_SUCCESS",
    "success": true,
    "message": "Payment successful",
    "paymentData": {
      "transactionId": "PG123",
      "amount": 99999,
      "state": "COMPLETED",
      "responseCode": "SUCCESS",
      "paymentInstrument": {
        "type": "UPI"
      }
    }
  }
}
```

Documented status enum:

```text
PAYMENT_INITIATED | PAYMENT_PENDING | PAYMENT_SUCCESS | PAYMENT_ERROR | PAYMENT_DECLINED
```

### 18.14 `GET /v1/phonepe/refund-status/:refundId`

```json
{
  "success": true,
  "message": "Refund status retrieved successfully",
  "data": {
    "refundId": "REFUND123",
    "state": "COMPLETED",
    "amount": 499,
    "errorCode": null,
    "errorMessage": null
  }
}
```

### 18.15 `GET /v1/orders`

```json
{
  "success": true,
  "data": [
    {
      "id": 1001,
      "userid": 101,
      "addressid": 1,
      "orderamount": 938,
      "orderid": "ORD-123456",
      "orderstatus": "placed",
      "quantity": 2,
      "transactionid": "PG123",
      "productamount": 898,
      "discountamount": 100,
      "deliveryfrom": "warehouse",
      "ispaymentsucceed": true,
      "merchanttransactionid": "TXN123456789",
      "productid": [12, 13],
      "createddate": 1780460000000,
      "modifieddate": 1780460000000,
      "username": "Customer Name",
      "useremail": "customer@example.com",
      "usermobilenumber": 9344715431
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "filters": ["userid"],
    "total": 1,
    "filtered": true
  }
}
```

### 18.16 `GET /v1/orders/:id/details`

```json
{
  "success": true,
  "message": "Order details retrieved successfully",
  "data": {
    "order": {
      "id": 1001,
      "orderid": "ORD-123456",
      "orderamount": 938,
      "orderstatus": "placed",
      "quantity": 2,
      "transactionid": "PG123",
      "merchanttransactionid": "TXN123456789",
      "mode": "phonepe",
      "promotion_discount_total": 100,
      "original_total": 1038,
      "shipping_cost": 40,
      "items_total": 898,
      "total_gst_amount": 0,
      "tracking_id": null,
      "vendor": null,
      "order_invoice_url": null,
      "public_tracking_link": null,
      "status_history": []
    },
    "orderlines": [
      {
        "id": 5001,
        "productid": 12,
        "productname": "Product name",
        "productamount": 898,
        "discountamount": 100,
        "orderamount": 798,
        "quantity": 2,
        "orderstatus": "placed",
        "original_price": 499,
        "product_discount_amount": 0,
        "promotion_discount_amount": 100,
        "shipping_cost": 40,
        "gst_rate": 0,
        "total_gst_amount": 0,
        "iscombo": false,
        "components": null,
        "status_history": []
      }
    ],
    "address": {
      "name": "Customer",
      "mobilenumber": "9344715431",
      "doornumber": "12A",
      "address": "Street address",
      "pincode": "600042",
      "state": "Tamil Nadu",
      "city": "Chennai"
    }
  }
}
```

### 18.17 `GET /v1/orders/user/:userid/details`

```json
{
  "success": true,
  "message": "User order details retrieved successfully",
  "data": [
    {
      "order": {
        "id": 1001,
        "orderid": "ORD-123456",
        "orderamount": 938,
        "orderstatus": "placed",
        "createddate": 1780460000000
      },
      "orderlines": [
        {
          "id": 5001,
          "productid": 12,
          "productname": "Product name",
          "quantity": 2,
          "orderamount": 798,
          "orderstatus": "placed"
        }
      ],
      "address": {
        "name": "Customer",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pincode": "600042"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### 18.18 `GET /v1/orders/:id/track`

```json
{
  "success": true,
  "message": "Order tracking retrieved successfully",
  "data": {
    "order_id": 1001,
    "order_number": "ORD-123456",
    "order_status": "shipped",
    "tracking_id": "AWB123",
    "vendor": "EKART",
    "public_tracking_link": "https://...",
    "tracking_available": true,
    "ekart_tracking": {
      "status": "in_transit",
      "current_location": "Chennai",
      "description": "Shipment in transit",
      "estimated_delivery": null,
      "status_history": [],
      "ndr_status": null,
      "ndr_actions": null,
      "attempts": null
    }
  }
}
```

### 18.19 Orderline GET Responses

The web doc lists these orderline GET endpoints:

```http
GET /v1/orderlines/order/:orderid
GET /v1/orderlines/:id
GET /v1/orderlines/orderlinenumber/:orderlinenumber
```

Single orderline response:

```json
{
  "success": true,
  "data": {
    "id": 5001,
    "orderid": 1001,
    "productid": 12,
    "userid": 101,
    "addressid": 1,
    "productamount": 898,
    "discountamount": 100,
    "orderamount": 798,
    "quantity": 2,
    "merchanttransactionid": "TXN123456789",
    "productname": "Product name",
    "productcategory": "Category",
    "orderstatus": "placed",
    "orderlinenumber": "OL-123456",
    "createddate": 1780460000000,
    "modifieddate": 1780460000000
  },
  "message": "Orderline retrieved successfully"
}
```

Orderlines-by-order response:

```json
{
  "success": true,
  "data": [
    {
      "id": 5001,
      "orderid": 1001,
      "productid": 12,
      "quantity": 2,
      "orderamount": 798,
      "orderstatus": "placed",
      "orderlinenumber": "OL-123456"
    }
  ],
  "message": "Orderlines retrieved successfully"
}
```

### 18.20 `GET /v1/ratings`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userid": 101,
      "productid": 12,
      "orderid": 1001,
      "starrating": 5,
      "comments": "Loved it",
      "url": ["https://..."],
      "usermail": "customer@example.com",
      "orderlineid": 5001,
      "createddate": 1780460000000,
      "modifieddate": 1780460000000
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "filters": [],
    "total": 1,
    "filtered": false
  }
}
```

### 18.21 `GET /v1/ratings/product/:productId`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userid": 101,
      "productid": 12,
      "orderid": 1001,
      "starrating": 5,
      "comments": "Loved it",
      "url": ["https://..."],
      "usermail": "customer@example.com",
      "orderlineid": 5001,
      "createddate": 1780460000000,
      "modifieddate": 1780460000000
    }
  ],
  "message": "Ratings retrieved successfully"
}
```

## 19. Implementation Notes and Caveats

- Use `nivapp` as the public product platform for the web storefront.
- Bearer token is required for customer-specific data such as cart, wishlist, addresses, orders, ratings writes, and payment initiation.
- Public product and promotion APIs can be used before login.
- API schemas are often permissive and allow additional fields, but database/service rules may still require valid combinations such as `userid`, `productid`, and `quantity`.
- Timestamps are mostly numeric epoch timestamps in milliseconds unless a specific endpoint returns ISO strings.
- PhonePe callback routes are for payment provider redirects/callbacks. The frontend should not treat them as normal customer API calls.
- For web payment, confirm whether the web app should use PhonePe redirect (`/v1/phonepe/initiate`) or SDK order token (`/v1/phonepe/create-sdk-order`) based on the final PhonePe integration approach.
- Do not expose backend environment variables, deployment scripts, or provider secrets to the frontend.

## 20. Source Files Used for This Documentation

- `src/routes/index.ts`
- `src/config/publicRoutes.ts`
- `src/middleware/smartAuth.middleware.ts`
- `src/middleware/auth.middleware.ts`
- `src/routes/mobile-auth.route.ts`
- `src/routes/product.route.ts`
- `src/routes/cart.route.ts`
- `src/routes/users.route.ts`
- `src/routes/address.route.ts`
- `src/routes/promotions.route.ts`
- `src/routes/phonepe.route.ts`
- `src/routes/orders.route.ts`
- `src/routes/orderline.route.ts`
- `src/routes/rating.route.ts`
- `src/routes/push-notification.route.ts`
- `src/schemas/*.schema.ts`
