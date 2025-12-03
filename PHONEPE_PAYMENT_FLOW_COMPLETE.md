# PhonePe Payment Flow - Complete Implementation Guide

**Version 1.0** — Complete End-to-End Technical Documentation  
*Last Updated: December 3, 2025*

## 📋 Table of Contents

1. [Overview](#1-overview)
2. [Payment Initiation Flow](#2-payment-initiation-flow)
3. [Payment Callback Flow](#3-payment-callback-flow)
4. [Database Operations](#4-database-operations)
5. [Stock Management](#5-stock-management)
6. [Promotion Handling](#6-promotion-handling)
7. [Error Handling](#7-error-handling)
8. [Complete Sequence Diagrams](#8-complete-sequence-diagrams)

---

## 1️⃣ Overview

The PhonePe payment integration supports two payment modes:
- **PhonePe**: Online payment via PhonePe gateway
- **COD**: Cash on Delivery (immediate order creation)

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/phonepe/initiate` | POST | Initiate payment or create COD order |
| `/v1/phonepe/callback/:transactionId` | GET/POST | Handle payment callback from PhonePe |
| `/v1/phonepe/status/:merchantTransactionId` | GET | Check payment status |

### Payment Modes

- **PhonePe Mode**: 
  - Stock is locked during initiation
  - User redirected to PhonePe payment page
  - Order created after successful payment callback
  - Lock cleanup scheduled via GCP Cloud Task (if payment fails)

- **COD Mode**:
  - Stock is locked during initiation
  - Order created immediately
  - Stock converted from lock to order immediately
  - No payment gateway involved

---

## 2️⃣ Payment Initiation Flow

**Endpoint:** `POST /v1/phonepe/initiate`

### Request Payload

```json
{
  "mode": "phonepe" | "cod",
  "evaluation_ids": ["eval_123", "eval_456"],  // Optional: Promotion evaluation IDs
  "order": [
    {
      "addressid": 1,
      "cartId": 100,
      "discountamount": 50,
      "orderamount": 450,
      "productamount": 500,
      "productcategory": "Fashion",
      "productid": 123,
      "productname": "Mens Shirt",
      "quantity": 1,
      "userid": 1
    }
  ],
  "transaction": {
    "amount": 450,
    "mobilenumber": "9876543210",
    "name": "John Doe",
    "productid": [123, 456],
    "transactionfor": "product",
    "userId": 1
  }
}
```

### Step-by-Step Flow

#### **Step 1: Promotion/Evaluation Validation** (Lines 69-235)

**Purpose:** Validate all promotion evaluation IDs before processing payment.

**Process:**
1. Loop through each `evaluation_id` in `evaluation_ids` array
2. Call `PromotionEvaluationService.validateEvaluationForOrder()`
3. Categorize results:
   - **Valid Evaluations**: Added to `validEvaluations` array
   - **Invalid Evaluations**: 
     - **Expired/Cancelled**: Block entire order (return 400 error)
     - **Limit Reached**: Continue without this promotion (inform user)
     - **Other Errors**: Continue without this promotion

**Database Operations:**
- Read from `promotionevaluation` table
- Check evaluation status, expiry, usage limits
- Validate user eligibility

**Response Handling:**
- If expired/cancelled promotion found → **Block order** (400 error)
- If limit reached → **Continue** but inform user
- If other errors → **Continue** without promotion

**Code Location:** `src/controllers/phonepe.controller.ts:69-235`

---

#### **Step 2: Product & PlatformStock Validation** (Lines 237-469)

**Purpose:** Validate product availability and platform-specific stock BEFORE locking.

**Process for Each Product:**

**2A. Product Validation:**
1. Query `product` table by `productid`
2. Check if product exists
3. Validate `availablequantity >= requestedQuantity`
4. Check `productstatus` (should be active)

**2B. PlatformStock Validation:**
1. Query `platformstock` table by `productid` + `platform` ("nivapp")
2. Check if `platformstock` record exists
3. Calculate actual available: `availableqty - lockqty`
4. Validate: `actualAvailable >= requestedQuantity`

**Validation Logic:**
```typescript
// Product level
product.availablequantity >= requestedQuantity

// Platform level
platformStock.availableqty - platformStock.lockqty >= requestedQuantity
```

**Error Handling:**
- If any product fails validation → **Block entire payment** (400 error)
- Return detailed error for each failed product

**Database Operations:**
- Read from `product` table
- Read from `platformstock` table
- No writes at this stage

**Code Location:** `src/controllers/phonepe.controller.ts:237-469`

---

#### **Step 3: Stock Locking** (Lines 480-685)

**Purpose:** Lock stock to prevent race conditions and reserve inventory for the order.

**Process:**
1. Use Prisma transaction to ensure atomicity
2. For each product in order:
   - Use `SELECT FOR UPDATE` to acquire row lock (prevents concurrent access)
   - Read current `availableqty` and `lockqty` with fresh data
   - Double-check availability (with row lock)
   - Calculate new quantities:
     ```typescript
     newAvailableQty = currentAvailableQty - requestedQuantity
     newLockQty = currentLockQty + requestedQuantity
     ```
   - Update `platformstock` table:
     ```sql
     UPDATE platformstock
     SET availableqty = newAvailableQty,
         lockqty = newLockQty,
         modifieddate = NOW()
     WHERE productid = ? AND platform = 'nivapp'
     ```

**Database Operations:**
- **Read:** `platformstock` with `SELECT FOR UPDATE` (row lock)
- **Write:** Update `platformstock.availableqty` and `platformstock.lockqty`

**Transaction Safety:**
- All locks happen in a single Prisma transaction
- If any product fails to lock → **Rollback all locks**
- Return 400 error if locking fails

**Lock Results:**
```typescript
{
  productId: 123,
  productName: "Mens Shirt",
  quantity: 1,
  oldAvailableQty: 10,
  newAvailableQty: 9,
  oldLockQty: 0,
  newLockQty: 1,
  success: true
}
```

**Code Location:** `src/controllers/phonepe.controller.ts:480-685`

---

#### **Step 4: GCP Cloud Task Creation (PhonePe Only)** (Lines 697-745)

**Purpose:** Schedule automatic lock cleanup if payment fails or times out.

**Process:**
1. Only for `mode === "phonepe"` (COD doesn't need cleanup)
2. Create GCP Cloud Task with delay (default: 120 seconds)
3. Task will unlock stock if payment doesn't complete

**Configuration:**
- Delay: `LOCK_CLEANUP_DELAY_SECONDS` env var (default: 120 seconds)
- Task endpoint: `/v1/phonepe/unlock/:transactionId`

**Code Location:** `src/controllers/phonepe.controller.ts:697-745`

---

#### **Step 5: Transaction Creation** (Lines 817-861)

**Purpose:** Store transaction data for later order creation.

**Process:**
1. Generate unique `merchantTransactionId`: `TXN_${timestamp}_${random}`
2. Create transaction record in `transaction` table
3. Store complete payload in `transactiondata` JSON field:
   ```json
   {
     "status": "INITIATED" | "COD_INITIATED",
     "mode": "phonepe" | "cod",
     "evaluation_ids": ["valid_eval_1", "valid_eval_2"],
     "invalid_evaluations": [...],
     "limit_reached_evaluations": [...],
     "originalPayload": { /* full request body */ },
     "paymentRequest": { /* PhonePe request data */ },
     "initiatedAt": "2025-12-03T10:00:00Z",
     "phonePeResponses": {
       "initiation": {
         "timestamp": "...",
         "response": { /* PhonePe response */ },
         "status": "INITIATED",
         "redirectUrl": "https://..."
       }
     }
   }
   ```

**Database Operations:**
- **Write:** Insert into `transaction` table
- Fields: `userid`, `amount`, `productid[]`, `merchanttransactionid`, `transactiondata`, `status`

**Transaction Status:**
- PhonePe: `status = "INITIATED"`
- COD: `status = "COD_INITIATED"`

**Code Location:** `src/controllers/phonepe.controller.ts:817-861`

---

#### **Step 6A: PhonePe Payment Initiation** (Lines 759-783)

**Purpose:** Initiate payment with PhonePe gateway (PhonePe mode only).

**Process:**
1. Build PhonePe payment request:
   ```typescript
   {
     merchantTransactionId: "TXN_...",
     amount: 450,
     name: "John Doe",
     mobileNumber: "9876543210",
     userId: 1,
     productIds: [123, 456],
     transactionFor: "product"
   }
   ```
2. Call `PhonePeService.initiatePayment()`
3. PhonePe returns `redirectUrl` for payment page

**PhonePe Service Operations:**
- Uses PhonePe SDK or legacy API
- Creates payment request with PhonePe
- Returns redirect URL

**Response:**
```json
{
  "success": true,
  "redirectUrl": "https://mercury-uat.phonepe.com/...",
  "transactionId": "TXN_..."
}
```

**Code Location:** `src/services/phonepe.service.ts:162-249`

---

#### **Step 6B: COD Order Creation (Immediate)** (Lines 784-1032)

**Purpose:** Create order immediately for COD mode (no payment gateway).

**Process:**
1. Create mock successful result (no PhonePe call needed)
2. Call `createOrderAfterPayment()` immediately
3. Update transaction status to `COD_SUCCESS`
4. Call `updateProductQuantitiesAfterOrder()` to convert locks to orders

**Order Creation Details:**
- See [Section 3: Order Creation](#order-creation-process) for full details
- Happens immediately (no callback needed)

**Stock Conversion:**
- Locked stock converted to ordered stock immediately
- `lockqty` → `orderedqty` conversion happens here

**Code Location:** `src/controllers/phonepe.controller.ts:784-1032`

---

#### **Step 7: Response Preparation** (Lines 1034-1153)

**Purpose:** Build comprehensive response with all validation and locking results.

**Response Structure:**
```json
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "merchantTransactionId": "TXN_...",
    "redirectUrl": "https://...",  // null for COD
    "amount": 450,
    "status": "INITIATED" | "COD_ORDER_CREATED",
    "mode": "phonepe" | "cod",
    
    "validation_summary": {
      "promotions_validated": 2,
      "products_validated": 3,
      "stock_validated": 3,
      "all_validations_passed": true
    },
    
    "promotion_status": {
      "valid_evaluations": ["eval_1"],
      "limit_reached_evaluations": [...],
      "invalid_evaluations": [...],
      "total_applied": 1,
      "total_attempted": 2
    },
    
    "stock_locking": {
      "platform": "nivapp",
      "total_products_locked": 3,
      "lock_status": "success",
      "products": [
        {
          "productId": 123,
          "productName": "Mens Shirt",
          "quantity_locked": 1,
          "before": {
            "availableqty": 10,
            "lockqty": 0
          },
          "after": {
            "availableqty": 9,
            "lockqty": 1
          }
        }
      ]
    },
    
    "orderData": {  // Only for COD
      "orderId": 456,
      "orderid": "ORDER_...",
      "status": "payment_completed",
      "created_at": 1701234567890
    },
    
    "next_steps": {
      "phonepe": {  // Only for PhonePe
        "action": "redirect_to_payment",
        "redirectUrl": "https://...",
        "instructions": "Redirect user to PhonePe payment page",
        "stock_status": "locked_until_payment_complete",
        "lock_duration": "Until payment success/failure"
      },
      "cod": {  // Only for COD
        "action": "show_order_confirmation",
        "order_id": 456,
        "instructions": "Show order confirmation to user",
        "stock_status": "converted_to_order",
        "lockqty_status": "reset_to_0"
      }
    }
  }
}
```

**Code Location:** `src/controllers/phonepe.controller.ts:1034-1153`

---

## 3️⃣ Payment Callback Flow

**Endpoint:** `GET/POST /v1/phonepe/callback/:transactionId`

**Trigger:** PhonePe redirects user to this URL after payment attempt.

### Step-by-Step Flow

#### **Step 1: Transaction Status Pre-Check** (Lines 491-558)

**Purpose:** Prevent duplicate processing and handle edge cases.

**Process:**
1. Query `transaction` table by `merchanttransactionid`
2. Check existing transaction status:
   - **EXPIRED/FAILED/CANCELLED**: Reject immediately → Redirect to failure page
   - **SUCCESS with existing order**: Skip processing (idempotent) → Redirect to success page
   - **INITIATED**: Allow processing (may update to SUCCESS/FAILED)

**Status Decision Matrix:**

| Transaction Status | Order Exists | PhonePe Status | Action | Redirect |
|-------------------|-------------|----------------|--------|----------|
| **EXPIRED** | Any | Any | ❌ Reject Early | Failure Page |
| **FAILED** | Any | Any | ❌ Reject Early | Failure Page |
| **CANCELLED** | Any | Any | ❌ Reject Early | Failure Page |
| **SUCCESS** | ✅ Yes | Any | ✅ Skip (idempotent) | Success Page |
| **SUCCESS** | ❌ No | Any | ✅ Process | Success Page |
| **INITIATED** | Any | SUCCESS | ✅ Process → Create Order | Success Page |
| **INITIATED** | Any | FAILED | ✅ Process → Update Status | Failure Page |

**Code Location:** `src/routes/phonepe.route.ts:491-558`

---

#### **Step 2: PhonePe Payment Status Check** (Lines 560-578)

**Purpose:** Verify actual payment status with PhonePe API.

**Process:**
1. Call `PhonePeService.checkPaymentStatus(transactionId)`
2. PhonePe returns current payment status

**Possible Statuses:**
- `PAYMENT_SUCCESS`: Payment completed successfully
- `PAYMENT_PENDING`: Payment still processing
- `PAYMENT_FAILED`: Payment failed
- `TRANSACTION_NOT_FOUND`: Transaction expired or invalid

**Code Location:** `src/routes/phonepe.route.ts:560-578`

---

#### **Step 3: Transaction Status Update** (Lines 586-594)

**Purpose:** Update transaction status to SUCCESS before order creation.

**Process:**
1. Call `updateTransactionStatus(transactionId, "SUCCESS", paymentStatus)`
2. Updates `transaction.status` column to `"SUCCESS"`
3. Updates `transaction.transactiondata.phonePeResponses.success` with payment details

**Database Operations:**
- **Write:** Update `transaction` table
- Fields: `status`, `transactiondata`, `modifieddate`

**Code Location:** `src/routes/phonepe.route.ts:586-594`

---

#### **Step 4: Duplicate Order Prevention** (Lines 606-676)

**Purpose:** Check if order already exists (prevents duplicates on refresh).

**Process:**
1. Query `orders` table by `merchanttransactionid`
2. If order exists:
   - Use existing `orderId`
   - Skip order creation
   - Mark `orderCreationStatus = "already_exists"`
3. If no order exists:
   - Proceed with order creation

**Code Location:** `src/routes/phonepe.route.ts:606-676`

---

#### **Step 5: Order Creation Process** (Lines 1982-3142)

**Purpose:** Create order and orderline records after successful payment.

**Location:** `src/controllers/phonepe.controller.ts:1982-3142`

##### **5A. Transaction Retrieval** (Lines 1994-2019)

1. Query `transaction` table by `merchanttransactionid`
2. Extract transaction data:
   - `userid`
   - `amount`
   - `productid[]`
   - `transactiondata.originalPayload.order[]`
   - `transactiondata.evaluation_ids[]`

##### **5B. Product Validation** (Lines 2021-2074)

1. Validate all products exist in `product` table
2. Filter valid vs invalid products
3. Block order creation if no valid products

**Database Operations:**
- **Read:** `product` table (batch query)

##### **5C. Order Data Preparation** (Lines 2090-2556)

**Calculate Totals:**
1. **Original Total**: Sum of `base_price * quantity` from cart items
2. **Product Discount Total**: Sum of `product_discount * quantity`
3. **Promotion Discount Total**: From `evaluationData.applied_promotions`
4. **Product Amount**: `originalTotal - productDiscountTotal`
5. **Order Amount**: `productAmount - promotionDiscountTotal`
6. **Shipping Cost**: From `originalPayload.shippingCost`
7. **Tax Amount**: From `originalPayload.taxAmount`

**Enrich Order Items:**
- For each order item, calculate:
  - `original_price`: Base price per item
  - `product_discount_amount`: Product discount for this line
  - `promotion_discount_amount`: Promotion discount for this line
  - `shipping_cost`: Pro-rata shipping for this line
  - Recalculate `discountamount` and `orderamount` per line

**Order Data Structure:**
```typescript
{
  userid: 1,
  orderamount: 450,
  orderid: "ORDER_TXN_123_1701234567890",
  orderstatus: "payment_completed",  // NO order_placed status - created directly with payment_completed
  quantity: 3,  // Sum of all line item quantities
  transactionid: "transaction_db_id",
  productamount: 500,
  discountamount: 50,  // productDiscount + promotionDiscount
  ispaymentsucceed: true,
  merchanttransactionid: "TXN_...",
  productid: [123, 456],  // Valid product IDs
  mode: "phonepe" | "cod",  // Stored from request
  createddate: 1701234567890,
  modifieddate: 1701234567890,
  evaluation_id: "eval_123",  // Primary evaluation ID
  promotion_discount_total: 20,
  original_total: 550,
  shipping_cost: 50,
  tax_amount: 10,
  orderItems: [  // Enriched order items with discount data
    {
      productid: 123,
      quantity: 1,
      productamount: 500,
      discountamount: 50,
      orderamount: 450,
      original_price: 500,
      product_discount_amount: 30,
      promotion_discount_amount: 20,
      shipping_cost: 50,
      evaluation_id: "eval_123"
    }
  ]
}
```

**Important:**
- **NO `order_placed` status**: Orders are created directly with `payment_completed` status
- **Prepaid**: Order created in callback endpoint (`GET /v1/phonepe/callback/:transactionId`)
- **COD**: Order created immediately in initiate endpoint (`POST /v1/phonepe/initiate`)

##### **5D. Order Creation** (Lines 2584-2600)

1. **Direct Service Call**: Calls `this.ordersService.create(orderData)` directly
   - **NOT** using HTTP POST `/v1/orders` endpoint
   - Direct service-to-service call within the same application
   - More efficient (no HTTP overhead, no serialization)
2. OrdersService automatically creates orderlines from `orderItems` array
3. Returns created order with `id` and `orderid`

**Important Note:**
- The POST `/v1/orders` endpoint (`orders.route.ts:226-321`) is a **separate API endpoint** for external clients (frontend, other services)
- PhonePe flow uses **direct service call** (`OrdersService.create()`) for internal operations
- Both use the same `OrdersService.create()` method, but PhonePe bypasses the HTTP layer

**Database Operations:**
- **Write:** Insert into `orders` table
- **Write:** Insert into `orderline` table (automatic, one per product)

**Order Fields:**
- `id`: Auto-generated database ID
- `orderid`: Display order ID (e.g., "ORDER_TXN_123_1701234567890")
- `orderstatus`: "payment_completed" (for both PhonePe and COD - **NO `order_placed` status**)
- `mode`: "phonepe" | "cod" (stored from request)
- `ispaymentsucceed`: true (for both modes currently)
- All financial fields (amounts, discounts, shipping, tax)

**Important Notes:**
- **NO `order_placed` status**: Orders are created directly with `payment_completed` status (no intermediate stage)
- **Prepaid (PhonePe)**: Order created in callback endpoint after payment success
- **COD**: Order created immediately in initiate endpoint (no callback needed)
- **Current Implementation**: Both modes set `orderstatus: "payment_completed"` and `ispaymentsucceed: true`
- **Ideal Implementation**: COD should set `orderstatus: "order_confirmed"` with `ispaymentsucceed: false` (payment pending)

**Orderline Fields (Auto-created):**
- `id`: Auto-generated
- `orderid`: References order.id
- `productid`: Product ID
- `quantity`: Quantity ordered
- `productamount`: Product price after product discounts
- `discountamount`: Total discount (product + promotion)
- `orderamount`: Final amount after all discounts
- `product_discount_amount`: Product-level discount
- `promotion_discount_amount`: Promotion/coupon discount
- `original_price`: Original base price
- `shipping_cost`: Pro-rata shipping
- `evaluation_id`: Promotion evaluation ID

**Code Location:** 
- PhonePe Controller: `src/controllers/phonepe.controller.ts:2584-2600`
- Orders Service: `src/services/orders.service.ts:98-185`
- Orders Route (for external API): `src/routes/orders.route.ts:226-321` (NOT used by PhonePe flow)

##### **5E. Promotion Redemption** (Lines 2603-2697)

**Purpose:** Mark promotions as redeemed after successful order.

**Process:**
1. Loop through `evaluationIds` array
2. For each evaluation:
   - Call `PromotionRedemptionService.redeemPromotion()`
   - Pass: `evaluation_id`, `order_id`, `user_id`
3. Track success/failure for each redemption

**Database Operations:**
- **Write:** Insert into `promotionredemption` table
- Updates promotion usage counts

**Error Handling:**
- If redemption fails → Log error but don't fail order
- Order is already created, redemption is secondary

**Code Location:** `src/controllers/phonepe.controller.ts:2603-2697`

##### **5F. Orderline Promotion Data Update** (Lines 2726-3036)

**Purpose:** Update orderlines with detailed promotion discount breakdown.

**Process:**
1. Retrieve created orderlines from database
2. For each orderline:
   - Calculate `product_discount_amount` from evaluation cart_data
   - Calculate `promotion_discount_amount` from applied_promotions breakdown
   - Distribute promotion discount proportionally if no breakdown
   - Update orderline with:
     - `original_price`
     - `product_discount_amount`
     - `promotion_discount_amount`
     - `discountamount` (sum of both)
     - `orderamount` (recalculated)
     - `shipping_cost`
     - `evaluation_id`

**Database Operations:**
- **Read:** `orderline` table (get created orderlines)
- **Write:** Update `orderline` table with promotion data

**Code Location:** `src/controllers/phonepe.controller.ts:2726-3036`

---

#### **Step 6: Stock Conversion (Lock → Order)** (Lines 687-754)

**Purpose:** Convert locked stock to ordered stock after successful payment.

**Process:**
1. Get orderlines for the created order
2. Convert orderlines to orderItems format:
   ```typescript
   {
     productid: 123,
     quantity: 1,
     productname: "Mens Shirt"
   }
   ```
3. Call `updateProductQuantitiesAfterOrder(order, orderItems, "phonepe")`

**Stock Conversion Details:**
- See [Section 5: Stock Management](#5-stock-management) for full details
- Converts `lockqty` → `orderedqty`
- Updates both `platformstock` and `product` tables

**Code Location:** `src/routes/phonepe.route.ts:687-754`

---

#### **Step 7: Final Transaction Update** (Lines 792-815)

**Purpose:** Update transaction with order creation results.

**Process:**
1. Update `transaction.transactiondata.orderCreation` with:
   ```json
   {
     "status": "success" | "already_exists" | "failed",
     "error": null | "error message",
     "orderId": 456,
     "timestamp": "2025-12-03T10:05:00Z"
   }
   ```
2. Update `transaction.transactiondata.paymentCompleteAt`

**Database Operations:**
- **Write:** Update `transaction` table

**Code Location:** `src/routes/phonepe.route.ts:792-815`

---

#### **Step 8: Redirect Response** (Lines 817-853)

**Purpose:** Redirect user to success/failure page.

**Redirect Logic:**
- **SUCCESS**: Redirect to `REDIRECT_URL_SUCCESS` (default: `com.Nivaana.app://profile/orders`)
- **FAILED**: Redirect to `REDIRECT_URL_FAILURE` (default: `com.Nivaana.app://profile/orders`)

**Code Location:** `src/routes/phonepe.route.ts:817-853`

---

## 4️⃣ Database Operations

### Transaction Table

**Table:** `transaction`

**Operations:**

#### **Create Transaction (Initiation)**
```sql
INSERT INTO transaction (
  userid,
  amount,
  productid,
  merchanttransactionid,
  transactiondata,
  status,
  createddate,
  modifieddate
) VALUES (
  1,
  450,
  ARRAY[123, 456],
  'TXN_1701234567890_abc123',
  '{"status": "INITIATED", "mode": "phonepe", ...}'::jsonb,
  'INITIATED',
  1701234567890,
  1701234567890
);
```

**Fields:**
- `id`: Auto-generated
- `userid`: User ID
- `amount`: Transaction amount
- `productid`: Array of product IDs
- `merchanttransactionid`: Unique transaction ID
- `transactiondata`: Complete JSON payload
- `status`: "INITIATED" | "COD_INITIATED" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED"
- `createddate`: Timestamp
- `modifieddate`: Timestamp

#### **Update Transaction Status (Callback)**
```sql
UPDATE transaction
SET status = 'SUCCESS',
    transactiondata = '{"status": "SUCCESS", "orderCreation": {...}}'::jsonb,
    modifieddate = 1701234567890
WHERE merchanttransactionid = 'TXN_...';
```

---

### Orders Table

**Table:** `orders`

**Operations:**

#### **Create Order (After Payment)**
```sql
INSERT INTO orders (
  userid,
  orderamount,
  orderid,
  orderstatus,
  quantity,
  transactionid,
  productamount,
  discountamount,
  ispaymentsucceed,
  merchanttransactionid,
  productid,
  mode,
  createddate,
  modifieddate,
  evaluation_id,
  promotion_discount_total,
  original_total,
  shipping_cost,
  tax_amount
) VALUES (
  1,
  450,
  'ORDER_TXN_123_1701234567890',
  'payment_completed',
  3,
  'transaction_db_id',
  500,
  50,
  true,
  'TXN_...',
  ARRAY[123, 456],
  'phonepe',
  1701234567890,
  1701234567890,
  'eval_123',
  20,
  550,
  50,
  10
);
```

**Fields:**
- `id`: Auto-generated
- `userid`: User ID
- `orderamount`: Final amount after all discounts
- `orderid`: Display order ID
- `orderstatus`: "payment_completed"
- `quantity`: Sum of all line item quantities
- `transactionid`: Reference to transaction.id
- `productamount`: Amount after product discounts (before promotion)
- `discountamount`: Total discount (product + promotion)
- `ispaymentsucceed`: true
- `merchanttransactionid`: Transaction ID
- `productid`: Array of product IDs
- `mode`: "phonepe" | "cod"
- `evaluation_id`: Primary promotion evaluation ID
- `promotion_discount_total`: Total promotion/coupon discount
- `original_total`: Original total before discounts
- `shipping_cost`: Shipping cost
- `tax_amount`: Tax amount

---

### Orderline Table

**Table:** `orderline`

**Operations:**

#### **Auto-Create Orderlines (During Order Creation)**
```sql
INSERT INTO orderline (
  orderid,
  productid,
  quantity,
  productamount,
  discountamount,
  orderamount,
  productname,
  orderlinenumber,
  createddate,
  modifieddate
) VALUES (
  456,  -- order.id
  123,  -- productid
  1,    -- quantity
  500,  -- productamount
  50,   -- discountamount
  450,  -- orderamount
  'Mens Shirt',
  'OL_001',
  1701234567890,
  1701234567890
);
```

#### **Update Orderline with Promotion Data**
```sql
UPDATE orderline
SET original_price = 500,
    product_discount_amount = 30,
    promotion_discount_amount = 20,
    discountamount = 50,
    orderamount = 450,
    shipping_cost = 50,
    evaluation_id = 'eval_123',
    modifieddate = 1701234567890
WHERE id = 789;
```

**Fields:**
- `id`: Auto-generated
- `orderid`: References `orders.id`
- `productid`: Product ID
- `quantity`: Quantity ordered
- `productamount`: Product price after product discounts
- `discountamount`: Total discount (product + promotion)
- `orderamount`: Final amount after all discounts
- `productname`: Product name
- `orderlinenumber`: Auto-generated line number
- `original_price`: Original base price
- `product_discount_amount`: Product-level discount
- `promotion_discount_amount`: Promotion/coupon discount
- `shipping_cost`: Pro-rata shipping for this line
- `evaluation_id`: Promotion evaluation ID

---

## 5️⃣ Stock Management

### Stock Locking (During Initiation)

**Purpose:** Reserve inventory during payment process.

**Process:**
1. Use `SELECT FOR UPDATE` to acquire row lock
2. Read current `availableqty` and `lockqty`
3. Validate availability: `availableqty - lockqty >= requestedQuantity`
4. Update quantities:
   ```typescript
   newAvailableQty = currentAvailableQty - requestedQuantity
   newLockQty = currentLockQty + requestedQuantity
   ```

**Database Updates:**
```sql
UPDATE platformstock
SET availableqty = newAvailableQty,
    lockqty = newLockQty,
    modifieddate = NOW()
WHERE productid = ? AND platform = 'nivapp';
```

**Code Location:** `src/controllers/phonepe.controller.ts:480-685`

---

### Stock Conversion (After Payment Success)

**Purpose:** Convert locked stock to ordered stock.

**Process:** `updateProductQuantitiesAfterOrder()` (Lines 3709-4220)

**Step 1: PlatformStock Update**
```typescript
// Get current values
currentAvailableQty = platformStock.availableqty  // Already reduced during locking
currentLockQty = platformStock.lockqty  // Contains locked quantity
currentOrderedQty = platformStock.orderedqty

// Convert lock to order
quantityToConvert = Math.min(requestedQuantity, currentLockQty)
newAvailableQty = currentAvailableQty  // NO CHANGE (already reduced)
newLockQty = currentLockQty - quantityToConvert  // UNLOCK
newOrderedQty = currentOrderedQty + quantityToConvert  // CONFIRM ORDER
```

**Database Update:**
```sql
UPDATE platformstock
SET availableqty = newAvailableQty,  -- No change
    lockqty = newLockQty,  -- Decrease (unlock)
    orderedqty = newOrderedQty,  -- Increase (confirm order)
    platformstatus = CASE
      WHEN newAvailableQty <= 0 THEN 'out_of_stock'
      WHEN newAvailableQty <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END,
    modifieddate = NOW()
WHERE productid = ? AND platform = 'nivapp';
```

**Step 2: Product Table Update**
```typescript
// Get current values
currentProductOrderedQuantity = product.orderedquantity
currentProductAvailableQuantity = product.availablequantity

// Update overall product quantities
newProductOrderedQuantity = currentProductOrderedQuantity + requestedQuantity
newProductAvailableQuantity = Math.max(0, currentProductAvailableQuantity - requestedQuantity)
```

**Database Update:**
```sql
UPDATE product
SET orderedquantity = newProductOrderedQuantity,
    availablequantity = newProductAvailableQuantity,
    productstatus = CASE
      WHEN newProductAvailableQuantity <= 0 THEN 'out_of_stock'
      WHEN newProductAvailableQuantity <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END,
    modifieddate = NOW()
WHERE id = ?;
```

**Stock Flow Summary:**

| Stage | PlatformStock.availableqty | PlatformStock.lockqty | PlatformStock.orderedqty | Product.availablequantity | Product.orderedquantity |
|-------|---------------------------|----------------------|-------------------------|---------------------------|------------------------|
| **Initial** | 10 | 0 | 0 | 10 | 0 |
| **After Locking** | 9 | 1 | 0 | 10 | 0 |
| **After Payment** | 9 | 0 | 1 | 9 | 1 |

**Code Location:** `src/controllers/phonepe.controller.ts:3709-4220`

---

### Lock Cleanup (GCP Cloud Task)

**Purpose:** Automatically unlock stock if payment fails or times out.

**Trigger:** GCP Cloud Task scheduled during initiation (PhonePe mode only)

**Process:**
1. Task executes after delay (default: 120 seconds)
2. Checks transaction status
3. If status is still `INITIATED` (payment not completed):
   - Unlock stock: `lockqty → 0`, `availableqty` restored
   - Update transaction status to `EXPIRED`

**Code Location:** `src/services/gcpTasks.service.ts` (lock cleanup handler)

---

## 6️⃣ Promotion Handling

### Promotion Validation (During Initiation)

**Service:** `PromotionEvaluationService.validateEvaluationForOrder()`

**Process:**
1. Query `promotionevaluation` table by `evaluation_id`
2. Validate:
   - Evaluation exists
   - Evaluation not expired
   - Evaluation not cancelled
   - Usage limit not reached
   - User eligible
3. Return validation result

**Database Operations:**
- **Read:** `promotionevaluation` table

**Code Location:** `src/controllers/phonepe.controller.ts:69-235`

---

### Promotion Redemption (After Order Creation)

**Service:** `PromotionRedemptionService.redeemPromotion()`

**Process:**
1. Create redemption record in `promotionredemption` table
2. Update promotion usage counts
3. Link redemption to order and user

**Database Operations:**
- **Write:** Insert into `promotionredemption` table
- **Write:** Update promotion usage counts

**Code Location:** `src/controllers/phonepe.controller.ts:2603-2697`

---

## 7️⃣ Error Handling

### Initiation Errors

**Validation Errors (400):**
- Invalid/expired promotions → Block order
- Product not found → Block order
- Insufficient stock → Block order
- Stock locking failed → Block order

**Payment Errors (400):**
- PhonePe initiation failed → Return error

**Response Format:**
```json
{
  "success": false,
  "message": "Cannot process payment. 1 product(s) have validation issues",
  "error_code": "PRODUCT_VALIDATION_FAILED",
  "validation_errors": [...],
  "statusCode": 400
}
```

---

### Callback Errors

**Transaction Errors:**
- Transaction not found → Redirect to failure
- Transaction already expired/failed → Redirect to failure

**Order Creation Errors:**
- Order creation fails → Log error, redirect to success (payment was successful)
- Stock update fails → Log error, don't fail callback

**Error Logging:**
- All errors logged with full context
- Transaction updated with error details

---

## 8️⃣ Complete Sequence Diagrams

### PhonePe Mode Flow

```
User                    Frontend              Backend              PhonePe              Database
  |                        |                     |                    |                     |
  |--[Initiate Payment]-->|                     |                    |                     |
  |                        |--[POST /initiate]-->|                    |                     |
  |                        |  (mode="phonepe")   |                    |                     |
  |                        |                     |                    |                     |
  |                        |                     |--[1. Validate Promotions]--->[promotionevaluation]
  |                        |                     |<--[Validation Results]--------|
  |                        |                     |                    |                     |
  |                        |                     |--[2. Validate Products]----->[product, platformstock]
  |                        |                     |<--[Validation Results]--------|
  |                        |                     |                    |                     |
  |                        |                     |--[3. Lock Stock]------------->[platformstock]
  |                        |                     |  (SELECT FOR UPDATE)        |
  |                        |                     |<--[Stock Locked]--------------|
  |                        |                     |                    |                     |
  |                        |                     |--[4. Create GCP Task]-------->GCP Cloud Tasks
  |                        |                     |                    |                     |
  |                        |                     |--[5. Create Transaction]----->[transaction]
  |                        |                     |  (status: INITIATED)          |
  |                        |                     |<--[Transaction Created]-------|
  |                        |                     |                    |                     |
  |                        |                     |--[6. Initiate Payment]-------->|
  |                        |                     |                    |--[Payment Request]-->|
  |                        |                     |                    |<--[Redirect URL]-----|
  |                        |<--[200 OK + redirectUrl]--|                    |                     |
  |<--[Redirect URL]--------|                     |                    |                     |
  |                        |                     |                    |                     |
  |--[Open PhonePe Page]-->|                     |                    |                     |
  |                        |                     |                    |                     |
  |--[Complete Payment]--->|                     |                    |                     |
  |                        |                     |                    |                     |
  |<--[Redirect to Callback]                     |                    |                     |
  |                        |                     |                    |                     |
  |--[GET /callback/:id]-->|                    |                    |                     |
  |                        |--[GET /callback]--->|                    |                     |
  |                        |                     |                    |                     |
  |                        |                     |--[1. Check Transaction]----->[transaction]
  |                        |                     |<--[Status: INITIATED]---------|
  |                        |                     |                    |                     |
  |                        |                     |--[2. Check Payment Status]-->|
  |                        |                     |                    |--[Status Check]----->|
  |                        |                     |                    |<--[PAYMENT_SUCCESS]--|
  |                        |                     |                    |                     |
  |                        |                     |--[3. Update Transaction]---->[transaction]
  |                        |                     |  (status: SUCCESS)           |
  |                        |                     |                    |                     |
  |                        |                     |--[4. Check Existing Order]--->[orders]
  |                        |                     |<--[No Order Found]------------|
  |                        |                     |                    |                     |
  |                        |                     |--[5. Create Order]---------->[orders]
  |                        |                     |  (orderstatus: payment_completed) |
  |                        |                     |  (NO order_placed status)     |
  |                        |                     |  (auto-creates orderlines)   |
  |                        |                     |<--[Order Created]-------------|
  |                        |                     |                    |                     |
  |                        |                     |--[6. Redeem Promotions]----->[promotionredemption]
  |                        |                     |                    |                     |
  |                        |                     |--[7. Update Orderlines]------>[orderline]
  |                        |                     |  (promotion data)            |
  |                        |                     |                    |                     |
  |                        |                     |--[8. Convert Stock]--------->[platformstock, product]
  |                        |                     |  (lockqty → orderedqty)      |
  |                        |                     |<--[Stock Converted]-----------|
  |                        |                     |                    |                     |
  |                        |<--[302 Redirect]----|                    |                     |
  |<--[Redirect to Success]|                     |                    |                     |
```

### COD Mode Flow

```
User                    Frontend              Backend              Database
  |                        |                     |                     |
  |--[Create COD Order]-->|                     |                     |
  |                        |--[POST /initiate]-->|                     |
  |                        |  (mode: "cod")      |                     |
  |                        |                     |                     |
  |                        |                     |--[1. Validate Promotions]--->[promotionevaluation]
  |                        |                     |<--[Validation Results]--------|
  |                        |                     |                     |
  |                        |                     |--[2. Validate Products]----->[product, platformstock]
  |                        |                     |<--[Validation Results]--------|
  |                        |                     |                     |
  |                        |                     |--[3. Lock Stock]------------->[platformstock]
  |                        |                     |<--[Stock Locked]--------------|
  |                        |                     |                     |
  |                        |                     |--[4. Create Transaction]---->[transaction]
  |                        |                     |  (status: COD_INITIATED)      |
  |                        |                     |<--[Transaction Created]-------|
  |                        |                     |                     |
  |                        |                     |--[5. Create Order Immediately]-->[orders]
  |                        |                     |  (orderstatus: payment_completed) |
  |                        |                     |  (NO order_placed status)     |
  |                        |                     |  (auto-creates orderlines)   |
  |                        |                     |<--[Order Created]-------------|
  |                        |                     |                     |
  |                        |                     |--[6. Update Transaction]----->[transaction]
  |                        |                     |  (status: COD_SUCCESS)        |
  |                        |                     |                     |
  |                        |                     |--[7. Convert Stock]---------->[platformstock, product]
  |                        |                     |  (lockqty → orderedqty)      |
  |                        |                     |<--[Stock Converted]-----------|
  |                        |                     |                     |
  |                        |<--[200 OK + orderData]|                     |
  |<--[Order Confirmation]|                     |                     |
```

---

## 📊 Complete Data Flow Summary

### PhonePe Mode Timeline

| Time | Action | Database Changes | Status |
|------|--------|------------------|--------|
| T0 | User clicks "Pay" | - | - |
| T1 | Validate promotions | Read `promotionevaluation` | - |
| T2 | Validate products | Read `product`, `platformstock` | - |
| T3 | Lock stock | Update `platformstock` (availableqty↓, lockqty↑) | Stock Locked |
| T4 | Create transaction | Insert `transaction` (status: INITIATED) | Transaction Created |
| T5 | Initiate PhonePe | - | Payment Initiated |
| T6 | User pays on PhonePe | - | Payment Processing |
| T7 | PhonePe callback | - | Callback Received |
| T8 | Update transaction | Update `transaction` (status: SUCCESS) | Payment Confirmed |
| T9 | Create order | Insert `orders`, `orderline` | Order Created |
| T10 | Redeem promotions | Insert `promotionredemption` | Promotions Redeemed |
| T11 | Update orderlines | Update `orderline` (promotion data) | Orderlines Updated |
| T12 | Convert stock | Update `platformstock` (lockqty↓, orderedqty↑), Update `product` | Stock Converted |

### COD Mode Timeline

| Time | Action | Database Changes | Status |
|------|--------|------------------|--------|
| T0 | User clicks "COD" | - | - |
| T1 | Validate promotions | Read `promotionevaluation` | - |
| T2 | Validate products | Read `product`, `platformstock` | - |
| T3 | Lock stock | Update `platformstock` (availableqty↓, lockqty↑) | Stock Locked |
| T4 | Create transaction | Insert `transaction` (status: COD_INITIATED) | Transaction Created |
| T5 | Create order | Insert `orders`, `orderline` | Order Created |
| T6 | Update transaction | Update `transaction` (status: COD_SUCCESS) | Transaction Updated |
| T7 | Convert stock | Update `platformstock` (lockqty↓, orderedqty↑), Update `product` | Stock Converted |

---

## 🔍 Key Implementation Details

### Transaction Data Structure

```typescript
transactiondata: {
  status: "INITIATED" | "COD_INITIATED" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED",
  mode: "phonepe" | "cod",
  evaluation_ids: string[],  // Valid evaluation IDs
  invalid_evaluations: Array<{
    evaluationId: string,
    reason: string,
    type: "limit_reached" | "expired" | "other" | "error"
  }>,
  limit_reached_evaluations: Array<{
    evaluation_id: string,
    reason: string,
    status: "limit_reached"
  }>,
  originalPayload: {
    mode: "phonepe" | "cod",
    order: Array<{...}>,
    transaction: {...},
    evaluation_ids?: string[],
    shippingCost?: number,
    taxAmount?: number,
    cartItems?: Array<{...}>
  },
  paymentRequest: {
    merchantTransactionId: string,
    amount: number,
    name: string,
    mobileNumber: string,
    userId: number,
    productIds: number[],
    transactionFor: string
  },
  initiatedAt: string,  // ISO timestamp
  phonePeResponses: {
    initiation: {
      timestamp: string,
      response: {...},
      status: "INITIATED",
      redirectUrl: string
    },
    success?: {
      timestamp: string,
      response: {...},
      status: "SUCCESS"
    }
  },
  codData?: {
    timestamp: string,
    status: "COD_ORDER_CREATED",
    message: string
  },
  orderCreation?: {
    status: "success" | "already_exists" | "failed",
    error?: string,
    orderId?: number,
    timestamp: string
  },
  paymentCompleteAt?: string
}
```

### Order Data Structure

```typescript
{
  id: number,  // Database ID
  orderid: string,  // Display ID: "ORDER_TXN_123_1701234567890"
  userid: number,
  orderamount: number,  // Final amount after all discounts
  orderstatus: "payment_completed",
  quantity: number,  // Sum of line item quantities
  transactionid: string,  // Reference to transaction.id
  productamount: number,  // Amount after product discounts
  discountamount: number,  // Total discount (product + promotion)
  ispaymentsucceed: true,
  merchanttransactionid: string,
  productid: number[],  // Array of product IDs
  mode: "phonepe" | "cod",
  createddate: number,  // Timestamp
  modifieddate: number,  // Timestamp
  evaluation_id: string,  // Primary evaluation ID
  promotion_discount_total: number,
  original_total: number,
  shipping_cost: number,
  tax_amount: number
}
```

### Orderline Data Structure

```typescript
{
  id: number,
  orderid: number,  // References orders.id
  productid: number,
  quantity: number,
  productname: string,
  orderlinenumber: string,  // Auto-generated: "OL_001"
  productamount: number,  // After product discounts
  discountamount: number,  // Total discount (product + promotion)
  orderamount: number,  // Final amount after all discounts
  original_price: number,  // Original base price
  product_discount_amount: number,  // Product-level discount
  promotion_discount_amount: number,  // Promotion/coupon discount
  shipping_cost: number,  // Pro-rata shipping
  evaluation_id: string,  // Promotion evaluation ID
  createddate: number,
  modifieddate: number
}
```

---

## 🛡️ Safety Mechanisms

### 1. Row Locking (SELECT FOR UPDATE)
- Prevents race conditions during stock locking
- Ensures only one transaction can lock stock at a time
- Second transaction waits and reads fresh data

### 2. Transaction Atomicity
- All stock locks happen in a single Prisma transaction
- If any product fails to lock → Rollback all locks
- Prevents partial locks

### 3. Duplicate Order Prevention
- Check existing order before creating new one
- Prevents duplicate orders on callback refresh
- Idempotent callback handling

### 4. Transaction Status Validation
- Early validation before processing callback
- Reject expired/failed transactions immediately
- Skip processing if order already exists

### 5. Lock Cleanup (GCP Cloud Task)
- Automatic unlock if payment times out
- Prevents stuck locks
- Only for PhonePe mode (COD doesn't need it)

### 6. Stock Validation
- Double validation: Product level + Platform level
- Validation before locking
- Fresh data check during locking (with row lock)

---

## 📝 Important Notes

1. **Stock Locking**: Stock is locked during initiation for BOTH PhonePe and COD modes
2. **COD Immediate Conversion**: COD converts locks to orders immediately (no callback)
3. **PhonePe Delayed Conversion**: PhonePe converts locks to orders after payment callback
4. **Promotion Validation**: Expired/cancelled promotions block entire order
5. **Promotion Redemption**: Happens after order creation (non-blocking)
6. **Orderline Auto-Creation**: Orderlines are automatically created when order is created (via `orderItems` array)
7. **Promotion Data Update**: Orderlines are updated with promotion discount breakdown after creation
8. **Stock Conversion**: Converts `lockqty` → `orderedqty` (doesn't change `availableqty` again)
9. **Error Handling**: Order creation errors don't fail payment callback (payment was successful)
10. **Idempotency**: Callback is idempotent - safe to call multiple times

---

## 🔗 Related Files

- **Routes:** `src/routes/phonepe.route.ts`
- **Controller:** `src/controllers/phonepe.controller.ts`
- **Service:** `src/services/phonepe.service.ts`
- **Schemas:** `src/schemas/phonepe.schema.ts`

---

## 🏗️ Architecture: Direct Service Calls vs HTTP Endpoints

### Order Creation in PhonePe Flow

**PhonePe Payment Flow uses DIRECT SERVICE CALLS:**

```typescript
// PhonePeController (src/controllers/phonepe.controller.ts:22)
public ordersService = new OrdersService();

// Direct service call (line 2585)
const order = await this.ordersService.create(orderData);
```

**Why Direct Service Calls?**
- ✅ **Performance**: No HTTP overhead, no serialization/deserialization
- ✅ **Type Safety**: Direct TypeScript method calls with full type checking
- ✅ **Error Handling**: Direct exception handling, no HTTP status code mapping
- ✅ **Internal Operations**: PhonePe flow is internal to the backend, doesn't need HTTP layer

### POST `/v1/orders` Endpoint

**The HTTP endpoint (`orders.route.ts:226-321`) is for EXTERNAL CLIENTS:**

```typescript
// OrdersController (src/controllers/orders.controller.ts:63-88)
createOrder = asyncHandler(async (request, reply) => {
  const requestBody = request.body;
  if (Array.isArray(requestBody)) {
    const order = await this.ordersService.createFromCartItems(requestBody);
  } else {
    const order = await this.ordersService.create(data);
  }
  return reply.code(201).send(response);
});
```

**When to Use HTTP Endpoint:**
- ✅ Frontend applications making API calls
- ✅ External services/microservices
- ✅ Third-party integrations
- ✅ Manual order creation via API

**When to Use Direct Service (PhonePe Flow):**
- ✅ Internal backend operations
- ✅ Payment callback handlers
- ✅ Background jobs
- ✅ Service-to-service communication within same application

### Summary

| Aspect | PhonePe Flow | POST `/v1/orders` |
|--------|-------------|-------------------|
| **Method** | Direct service call | HTTP POST request |
| **Location** | `PhonePeController.createOrderAfterPayment()` | `OrdersController.createOrder()` |
| **Service Used** | `OrdersService.create()` | `OrdersService.create()` or `createFromCartItems()` |
| **HTTP Overhead** | ❌ None | ✅ Full HTTP stack |
| **Use Case** | Internal payment processing | External API access |
| **Performance** | Faster (direct call) | Slower (HTTP + serialization) |

**Both paths use the same `OrdersService.create()` method, but PhonePe flow bypasses the HTTP layer for better performance.**

---

**For API usage examples, see:** `EKART_API_USAGE.md` and `PHONEPE_QUICK_REFERENCE.md`

