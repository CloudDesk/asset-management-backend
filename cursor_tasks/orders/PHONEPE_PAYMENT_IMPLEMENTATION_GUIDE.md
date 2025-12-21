# PhonePe Payment Flow - Complete Implementation Guide

## 📋 Overview

This document provides a single source of truth for the PhonePe payment integration in the Asset Management Backend. It covers both **payment initiation** and **callback handling**, including all database operations, stock management, promotions, and amount calculations.

---

## 🏗️ Architecture

### Services Involved

| Service | File | Purpose |
|---------|------|---------|
| `PhonePeService` | `src/services/phonepe.service.ts` | PhonePe SDK/API integration |
| `PhonePeController` | `src/controllers/phonepe.controller.ts` | Request handling & orchestration |
| `TransactionService` | `src/services/transaction.service.ts` | Transaction record management |
| `OrdersService` | `src/services/orders.service.ts` | Order creation & management |
| `OrderlineService` | `src/services/orderline.service.ts` | Orderline CRUD & status updates |
| `PromotionEvaluationService` | `src/services/promotion-evaluation.service.ts` | Coupon/promotion validation |
| `PromotionRedemptionService` | `src/services/promotion-redemption.service.ts` | Coupon redemption |
| `GCP Tasks Service` | `src/services/gcpTasks.service.ts` | Lock cleanup scheduling |

### Database Tables Affected

| Table | Operations |
|-------|------------|
| `transaction` | CREATE, UPDATE |
| `orders` | CREATE |
| `orderline` | CREATE, UPDATE |
| `product` | UPDATE (quantities) |
| `platformstock` | UPDATE (lockqty, orderedqty, availableqty) |
| `promotion_evaluations` | READ, UPDATE |
| `promotion_redemptions` | CREATE |

---

## 📍 Route: POST /v1/phonepe/initiate

### Request Payload Structure

```typescript
{
  mode: 'phonepe' | 'cod',           // Payment mode
  evaluation_ids?: string[],          // Promotion evaluation IDs (optional)
  shippingCost: number,               // Total shipping cost
  taxAmount: number,                  // Total tax amount (if pre-calculated)
  order: [                            // Array of order items
    {
      addressid: number,              // Delivery address ID
      cartId: number,                 // Cart item ID
      discountamount: number,         // ⚠️ PRODUCT discount TOTAL for this line item
      orderamount: number,            // Final price after discount (productamount - discountamount)
      productamount: number,          // ⚠️ ORIGINAL price PER UNIT (before any discounts)
      productcategory: string,        // Product category
      productid: number,              // Product ID
      productname: string,            // Product name
      quantity: number,               // Quantity ordered
      userid: number                  // User ID
    }
  ],
  transaction: {
    amount: number,                   // Total transaction amount (INR, includes shipping)
    mobilenumber: string,             // 10-digit mobile number
    name: string,                     // Customer name/email
    productid: number[],              // Array of product IDs
    transactionfor: string,           // 'product', 'service', 'subscription', 'donation'
    userId: number                    // User ID
  }
}
```

**⚠️ CRITICAL FIELD SEMANTICS:**

- **`order[].productamount`** = ORIGINAL price per unit (before any discounts)
  - Example: Product costs ₹150, send `productamount: 150`
  
- **`order[].discountamount`** = TOTAL product discount for the line item
  - Example: ₹10 off per unit, qty=2 → send `discountamount: 20`
  - Example: ₹10 off, qty=1 → send `discountamount: 10`
  - Example: No discount → send `discountamount: 0`
  
- **`order[].orderamount`** = Final price for line item after product discounts
  - Formula: `(productamount × quantity) - discountamount`
  - Example: ₹150 × 1 - ₹10 = ₹140

- **`transaction.amount`** = Total amount to charge (includes all items + shipping)
  - Formula: `Σ(order[].orderamount) + shippingCost`


---

## 🔄 INITIATE PAYMENT FLOW

### Step-by-Step Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         POST /v1/phonepe/initiate                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: VALIDATE PROMOTIONS (if evaluation_ids provided)              │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Import PromotionEvaluationService                                    │
│  • For each evaluation_id:                                              │
│    - Call validateEvaluationForOrder(evaluationId, userId)              │
│    - Check if expired/cancelled → BLOCK ORDER (400 error)               │
│    - Check if usage limit reached → SKIP this promo, continue order     │
│    - Valid → Add to validEvaluations[]                                  │
│  • Output: validEvaluations[], invalidEvaluations[], limitReached[]     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: VALIDATE PRODUCTS & PLATFORMSTOCK                             │
│  ─────────────────────────────────────────────────────────────────────  │
│  Platform: NIVAPP                                                       │
│  For each order item:                                                   │
│  A. Validate Product:                                                   │
│     - Check product exists in DB                                        │
│     - Check product.availablequantity >= requested quantity             │
│  B. Validate PlatformStock:                                             │
│     - Find platformstock WHERE productid=X AND platform='nivapp'        │
│     - Calculate actualAvailable = availableqty - lockqty                │
│     - Check actualAvailable >= requested quantity                       │
│  • If ANY validation fails → BLOCK ORDER (400 error)                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: LOCK STOCK (Atomic Transaction)                               │
│  ─────────────────────────────────────────────────────────────────────  │
│  Uses: prisma.$transaction with SELECT FOR UPDATE (row-level lock)      │
│                                                                         │
│  For each order item:                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Raw SQL: SELECT * FROM platformstock                            │   │
│  │           WHERE productid = X AND platform = 'nivapp'            │   │
│  │           FOR UPDATE                                              │   │
│  │  (This acquires exclusive row lock - prevents race conditions)   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Then update:                                                           │
│  • availableqty = availableqty - quantity    ← DECREASES               │
│  • lockqty = lockqty + quantity              ← INCREASES               │
│  • orderedqty: NO CHANGE (until callback)                              │
│                                                                         │
│  If ANY lock fails → ROLLBACK all locks (transaction fails)            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: GENERATE TRANSACTION ID                                        │
│  ─────────────────────────────────────────────────────────────────────  │
│  merchantTransactionId = PhonePeService.generateMerchantTransactionId() │
│  Format: TXN_{timestamp}_{random6chars}                                 │
│  Example: TXN_1702123456789_A1B2C3                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 5: CREATE GCP CLOUD TASK (PhonePe mode only)                     │
│  ─────────────────────────────────────────────────────────────────────  │
│  Purpose: Cleanup locked stock if payment not completed                 │
│                                                                         │
│  • Import createLockCleanupTask from gcpTasks.service.js                │
│  • Delay: LOCK_CLEANUP_DELAY_SECONDS (env, default: 120s)               │
│  • Task will call cleanup endpoint after delay                          │
│  • For COD: SKIPPED (order created immediately)                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 6: CALL PHONEPE API OR CREATE COD ORDER                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  IF mode === 'phonepe':                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  phonePeService.initiatePayment({                                  │ │
│  │    merchantTransactionId,                                          │ │
│  │    amount: transaction.amount,                                     │ │
│  │    name: transaction.name,                                         │ │
│  │    mobileNumber: transaction.mobilenumber,                         │ │
│  │    userId: transaction.userId,                                     │ │
│  │    productIds: transaction.productid,                              │ │
│  │    transactionFor: transaction.transactionfor                      │ │
│  │  })                                                                │ │
│  │                                                                    │ │
│  │  SDK Path: StandardCheckoutPayRequest → sdk.pay()                  │ │
│  │  Returns: { success, redirectUrl, transactionId }                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  IF mode === 'cod':                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Create mock success result (no PhonePe call needed)               │ │
│  │  result = { success: true, redirectUrl: null, transactionId }      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 7: STORE TRANSACTION RECORD                                       │
│  ─────────────────────────────────────────────────────────────────────  │
│  Table: transaction                                                     │
│                                                                         │
│  storeTransactionDataWithStatus({                                       │
│    transactionid: merchantTransactionId,                                │
│    merchanttransactionid: merchantTransactionId,                        │
│    userid: userId,                                                      │
│    amount: amount,                                                      │
│    mobilenumber: mobileNumber,                                          │
│    name: name,                                                          │
│    productid: productIds[],                                             │
│    transactionfor: transactionFor,                                      │
│    status: 'INITIATED' | 'COD_INITIATED',                               │
│    transactiondata: {                                                   │
│      status: 'INITIATED' | 'COD_ORDER_CREATED',                         │
│      mode: 'phonepe' | 'cod',                                           │
│      evaluation_ids: validEvaluations[],                                │
│      invalid_evaluations: [],                                           │
│      originalPayload: requestBody,    ← FULL REQUEST STORED             │
│      paymentRequest: paymentRequest,                                    │
│      initiatedAt: timestamp                                             │
│    }                                                                    │
│  })                                                                     │
│                                                                         │
│  ⚠️ IMPORTANT: originalPayload stored for order creation in callback    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 8: FOR COD - CREATE ORDER IMMEDIATELY                            │
│  ─────────────────────────────────────────────────────────────────────  │
│  IF mode === 'cod':                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  A. Call createOrderAfterPayment(transactionId, 'cod', evalIds)    │ │
│  │  B. Update transaction status to 'COD_SUCCESS'                     │ │
│  │  C. Call updateProductQuantitiesAfterOrder()                       │ │
│  │     - Convert lockqty → orderedqty                                 │ │
│  │     - Update Product.orderedquantity                               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  IF mode === 'phonepe':                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Return redirectUrl to frontend                                    │ │
│  │  Order creation happens in CALLBACK                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 9: RETURN RESPONSE                                                │
│  ─────────────────────────────────────────────────────────────────────  │
│  {                                                                      │
│    success: true,                                                       │
│    message: "Payment initiated successfully" | "COD order created",     │
│    data: {                                                              │
│      merchantTransactionId,                                             │
│      redirectUrl: "https://..." | null,                                 │
│      amount,                                                            │
│      status: 'INITIATED' | 'COD_ORDER_CREATED',                         │
│      mode: 'phonepe' | 'cod',                                           │
│      validation_summary: {...},                                         │
│      promotion_status: {...},                                           │
│      stock_locking: { products: [...], lock_status: 'success' },        │
│      orderData: { orderId, orderid, status } (COD only),                │
│      next_steps: { phonepe: {...} | cod: {...} }                        │
│    }                                                                    │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔔 CALLBACK FLOW (PhonePe Mode)

### Route: ALL /v1/phonepe/callback/:transactionId

```
┌────────────────────────────────────────────────────────────────────────┐
│        ALL /v1/phonepe/callback/:transactionId (GET or POST)           │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CHECK EXISTING TRANSACTION STATUS                             │
│  ─────────────────────────────────────────────────────────────────────  │
│  Prevents duplicate processing on page refresh                          │
│                                                                         │
│  const existingTransactions = transactionService.findMany({             │
│    merchanttransactionid: transactionId                                 │
│  })                                                                     │
│                                                                         │
│  IF status === 'EXPIRED' || 'FAILED' || 'CANCELLED':                   │
│    → REJECT immediately, redirect to failure page                       │
│                                                                         │
│  IF status === 'SUCCESS' AND order exists:                              │
│    → IDEMPOTENT: redirect to success page (don't reprocess)             │
│                                                                         │
│  IF status === 'INITIATED':                                             │
│    → Continue processing callback                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: CHECK PAYMENT STATUS WITH PHONEPE                             │
│  ─────────────────────────────────────────────────────────────────────  │
│  phonePeService.checkPaymentStatus(transactionId)                       │
│                                                                         │
│  SDK: sdkClient.getOrderStatus(merchantTransactionId)                   │
│  Legacy: GET /pg/v1/status/{merchantId}/{transactionId}                 │
│                                                                         │
│  Response: { success, code, message, data }                             │
│  code === 'PAYMENT_SUCCESS' → Payment successful                        │
│  code === 'TRANSACTION_NOT_FOUND' → Expired/cancelled                   │
│  Other → Failed                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                │                                       │
                ▼                                       ▼
    ┌─────────────────────────┐           ┌─────────────────────────┐
    │   PAYMENT SUCCESS       │           │   PAYMENT FAILED        │
    │   code = PAYMENT_SUCCESS│           │   code = other          │
    └─────────────────────────┘           └─────────────────────────┘
                │                                       │
                ▼                                       ▼
┌────────────────────────────────────┐   ┌────────────────────────────────┐
│  Update transaction status:        │   │  Update transaction status:    │
│  status = 'SUCCESS'                │   │  status = 'FAILED'/'CANCELLED' │
└────────────────────────────────────┘   └────────────────────────────────┘
                │                                       │
                ▼                                       ▼
┌────────────────────────────────────┐   ┌────────────────────────────────┐
│  STEP 3: CHECK FOR DUPLICATE ORDER │   │  Redirect to FAILURE page      │
│  ───────────────────────────────── │   │  URL from ENV:                 │
│  existingOrders = ordersService    │   │  REDIRECT_URL_FAILURE          │
│    .findMany({                     │   │  Default: com.Nivaana.app://   │
│      merchanttransactionid: txnId  │   │           profile/orders       │
│    })                              │   └────────────────────────────────┘
│                                    │
│  IF order exists:                  │
│    → Skip creation, use existing   │
│    → Update txn as 'already_exists'│
│                                    │
│  ELSE:                             │
│    → Continue to create order      │
└────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: CREATE ORDER (createOrderAfterPayment)                        │
│  ─────────────────────────────────────────────────────────────────────  │
│  See detailed section below                                             │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 5: UPDATE PRODUCT QUANTITIES (updateProductQuantitiesAfterOrder)  │
│  ─────────────────────────────────────────────────────────────────────  │
│  See detailed section below                                             │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ NOTE: GST Calculation happens automatically inside                │
│     ordersService.create() after orderlines are created                │
│     (See Step 10 in ORDER CREATION DETAIL section)                     │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 6: REDIRECT TO SUCCESS PAGE                                       │
│  ─────────────────────────────────────────────────────────────────────  │
│  URL from ENV: REDIRECT_URL_SUCCESS                                     │
│  Default: com.Nivaana.app://profile/orders                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 ORDER CREATION DETAIL (createOrderAfterPayment)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  createOrderAfterPayment(transactionId, mode, evaluationIds)            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. FETCH TRANSACTION DATA                                              │
│  ─────────────────────────────────────────────────────────────────────  │
│  transaction = transactionService.findMany({                            │
│    merchanttransactionid: transactionId                                 │
│  })                                                                     │
│                                                                         │
│  Extract:                                                               │
│  • transaction.userid                                                   │
│  • transaction.amount                                                   │
│  • transaction.productid[]                                              │
│  • transaction.transactiondata.originalPayload.order[]  ← ORDER ITEMS  │
│  • transaction.transactiondata.evaluation_ids[]                         │
│  • transaction.transactiondata.mode                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. VALIDATE PRODUCTS                                                   │
│  ─────────────────────────────────────────────────────────────────────  │
│  validateProductsBatch(productIds)                                      │
│  • Query: prisma.product.findMany({ where: { id: { in: [...] } } })     │
│  • Filter out invalid product IDs                                       │
│  • Log invalid products but continue with valid ones                    │
│  • If NO valid products → THROW ERROR                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. FETCH PROMOTION DATA (if evaluationIds provided)                   │
│  ─────────────────────────────────────────────────────────────────────  │
│  IF primaryEvaluationId exists:                                         │
│    evaluationData = evaluationService.getEvaluation(evaluationId)       │
│                                                                         │
│  Extract from evaluation:                                               │
│  • cart_data[] - Per-item pricing info                                  │
│    - base_price: Original price before any discount                     │
│    - product_discount: Per-unit product discount                        │
│  • applied_promotions[] - Coupon/promotion discounts                    │
│    - discount_amount: Total promotion discount                          │
│    - breakdown[]: Per-product promotion discount                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. CALCULATE ORDER TOTALS                                              │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  FROM EVALUATION cart_data:                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  originalTotal = Σ(base_price × quantity)                          │ │
│  │  productDiscountTotal = Σ(product_discount × quantity)              │ │
│  │  productAmount = originalTotal - productDiscountTotal               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  FROM EVALUATION applied_promotions:                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  promotionDiscountTotal = Σ(promo.discount_amount)                 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  FINAL CALCULATION:                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  discountamount = productDiscountTotal + promotionDiscountTotal    │ │
│  │  orderamount = transaction.amount (from PhonePe)                   │ │
│  │                                                                    │ │
│  │  EXAMPLE:                                                          │ │
│  │  ─────────────────────────────────────────────────────────────     │ │
│  │  base_price:       ₹1000 × 2 = ₹2000                              │ │
│  │  product_discount: ₹100 × 2  = ₹200                               │ │
│  │  promotion:                    ₹150 (15% off coupon)              │ │
│  │  ─────────────────────────────────────────────────────────────     │ │
│  │  originalTotal:        ₹2000                                       │ │
│  │  productDiscountTotal: ₹200                                        │ │
│  │  promotionDiscountTotal: ₹150                                      │ │
│  │  discountamount:       ₹350                                        │ │
│  │  orderamount:          ₹1650                                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  5. ENRICH ORDER ITEMS (Per-Line Discount Data)                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  For each item in originalOrderData:                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  ✅ PATH A: IF evaluationData EXISTS (with promotion/coupon)       │ │
│  │  ────────────────────────────────────────────────────────────────  │ │
│  │  // Get from evaluation cart_data                                  │ │
│  │  originalPrice = base_price (per-unit, NOT multiplied)            │ │
│  │  productDiscountAmount = product_discount × quantity (total)      │ │
│  │  itemProductAmount = (basePrice × quantity) - productDiscount     │ │
│  │                                                                    │ │
│  │  // Get from applied_promotions.breakdown                          │ │
│  │  promotionDiscountAmount = breakdown[productId].total_discount     │ │
│  │                                                                    │ │
│  │  // If no breakdown, use pro-rata distribution                     │ │
│  │  promotionDiscountAmount = (promotionTotal × itemAmount) / total   │ │
│  │  ────────────────────────────────────────────────────────────────  │ │
│  │                                                                    │ │
│  │  ✅ PATH B: ELSE (NO evaluationData - using request values)       │ │
│  │  ────────────────────────────────────────────────────────────────  │ │
│  │  // Extract from request payload                                   │ │
│  │  rawProductAmount = item.productamount  // Original price per unit│ │
│  │  rawDiscountAmount = item.discountamount  // Total product discount│ │
│  │                                                                    │ │
│  │  originalPrice = rawProductAmount  // Per-unit (NOT multiplied)   │ │
│  │  productDiscountAmount = rawDiscountAmount  // Total for line     │ │
│  │  itemProductAmount = (rawProductAmount × qty) - rawDiscountAmount │ │
│  │  promotionDiscountAmount = 0  // No promotion                     │ │
│  │  ────────────────────────────────────────────────────────────────  │ │
│  │                                                                    │ │
│  │  // Calculate shipping per item (pro-rata, after discounts)        │ │
│  │  shippingCostForItem = (shippingTotal × itemAmount) / total        │ │
│  │                                                                    │ │
│  │  // Final item amounts                                             │ │
│  │  productamount = itemProductAmount  // Total after product disc   │ │
│  │  discountamount = productDiscount + promotionDiscount              │ │
│  │  orderamount = productamount - promotionDiscountAmount             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  enrichedOrderItems[] = [                                               │
│    {                                                                    │
│      ...originalItem,                                                   │
│      productamount: itemProductAmount,  // ⚠️ TOTAL after product disc │
│      original_price,                    // ⚠️ PER-UNIT                 │
│      product_discount_amount,           // TOTAL                       │
│      promotion_discount_amount,         // TOTAL                       │
│      shipping_cost,                     // TOTAL (pro-rata)            │
│      evaluation_id,                                                     │
│      discountamount: recalculated,      // TOTAL                       │
│      orderamount: recalculated          // TOTAL (excludes shipping)   │
│    }                                                                    │
│  ]                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  6. CREATE ORDER RECORD                                                 │
│  ─────────────────────────────────────────────────────────────────────  │
│  Table: orders                                                          │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  orderData = {                                                     │ │
│  │    userid,                                                         │ │
│  │    orderid: 'ORDER_{txnId}_{timestamp}',                           │ │
│  │    orderamount: transaction.amount,                                │ │
│  │    orderstatus: 'order_confirmed' (COD) | 'payment_completed',     │ │
│  │    quantity: sum of all orderline quantities,                      │ │
│  │    transactionid: transaction.transactionid,                       │ │
│  │    productamount,                                                  │ │
│  │    discountamount: productDiscount + promotionDiscount,            │ │
│  │    ispaymentsucceed: false (COD) | true (PhonePe),                 │ │
│  │    merchanttransactionid,                                          │ │
│  │    productid: validProductIds[],                                   │ │
│  │    mode: 'phonepe' | 'cod',                                        │ │
│  │    evaluation_id: primaryEvaluationId,                             │ │
│  │    promotion_discount_total: promotionDiscountTotal,               │ │
│  │    original_total: originalTotal,                                  │ │
│  │    shipping_cost,                                                  │ │
│  │    tax_amount,                                                     │ │
│  │    orderItems: enrichedOrderItems[],    ← For orderline creation   │ │
│  │    status_history: [                                               │ │
│  │      {                                                             │ │
│  │        previous_status: 'order_placed',                            │ │
│  │        new_status: 'order_confirmed'|'payment_completed',          │ │
│  │        changed_date: timestamp,                                    │ │
│  │        source: 'system'|'phonepe',                                 │ │
│  │        is_active: true                                             │ │
│  │      }                                                             │ │
│  │    ]                                                               │ │
│  │  }                                                                 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  order = ordersService.create(orderData)                                │
│                                                                         │
│  ⚠️ ordersService.create() AUTOMATICALLY creates orderlines             │
│     using orderItems[] or productid[]                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  7. AUTOMATIC ORDERLINE CREATION (Inside ordersService.create)          │
│  ─────────────────────────────────────────────────────────────────────  │
│  Table: orderline                                                       │
│                                                                         │
│  IF orderItems[] provided → createOrderlinesFromOrderItems()            │
│  ELSE IF productid[] → createOrderlinesForProducts()                    │
│                                                                         │
│  For each item:                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  orderlineData = {                                                 │ │
│  │    orderid: order.id,              // FK to orders                 │ │
│  │    orderlinenumber: auto-generated,                                │ │
│  │    productid,                                                      │ │
│  │    userid,                                                         │ │
│  │    addressid,                                                      │ │
│  │    quantity,                                                       │ │
│  │    productname,                                                    │ │
│  │    productcategory,                                                │ │
│  │    productamount,                                                  │ │
│  │    discountamount,                                                 │ │
│  │    orderamount,                                                    │ │
│  │    original_price,                                                 │ │
│  │    product_discount_amount,                                        │ │
│  │    promotion_discount_amount,                                      │ │
│  │    shipping_cost,                                                  │ │
│  │    evaluation_id,                                                  │ │
│  │    merchanttransactionid,                                          │ │
│  │    orderstatus: 'order_confirmed'|'payment_completed',             │ │
│  │    ordereddate: timestamp,                                         │ │
│  │    status_history: [                                               │ │
│  │      {                                                             │ │
│  │        previous_status: 'order_placed',                            │ │
│  │        new_status: 'order_confirmed'|'payment_completed',          │ │
│  │        changed_date: timestamp,                                    │ │
│  │        source: 'system'|'phonepe',                                 │ │
│  │        is_active: true                                             │ │
│  │      }                                                             │ │
│  │    ]                                                               │ │
│  │  }                                                                 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  8. REDEEM PROMOTIONS (if evaluationIds provided)                       │
│  ─────────────────────────────────────────────────────────────────────  │
│  Table: promotion_redemptions                                           │
│                                                                         │
│  For each evaluationId:                                                 │
│    redemptionService.redeemPromotion({                                  │
│      evaluation_id: evaluationId,                                       │
│      order_id: order.id.toString(),                                     │
│      user_id: transaction.userid.toString()                             │
│    })                                                                   │
│                                                                         │
│  Creates: promotion_redemptions record                                  │
│  Updates: promotion_evaluations.status = 'redeemed'                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  9. UPDATE ORDERLINES WITH PROMOTION DATA                              │
│  ─────────────────────────────────────────────────────────────────────  │
│  Uses Prisma to update each orderline with accurate discount values     │
│                                                                         │
│  For each orderline:                                                    │
│    prisma.orderline.update({                                            │
│      where: { id: orderline.id },                                       │
│      data: {                                                            │
│        evaluation_id,                                                   │
│        original_price,                                                  │
│        product_discount_amount,                                         │
│        promotion_discount_amount,                                       │
│        discountamount,                                                  │
│        productamount,                                                   │
│        orderamount,                                                     │
│        shipping_cost                                                    │
│      }                                                                  │
│    })                                                                   │
│                                                                         │
│  ⚠️ Last orderline gets remainder to ensure totals match exactly        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  10. GST CALCULATION (Automatic - Inside ordersService.create) ⭐ NEW  │
│  ─────────────────────────────────────────────────────────────────────  │
│  Table: orderline, orders                                                │
│                                                                         │
│  After orderlines are created, GST calculation is automatically        │
│  triggered in ordersService.create():                                    │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  gstService.processOrderGst(                                        │ │
│  │    orderId,                                                         │ │
│  │    addressId,                                                       │ │
│  │    orderAmount,                                                     │ │
│  │    shippingCost                                                     │ │
│  │  )                                                                  │ │
│  │                                                                    │ │
│  │  Steps:                                                            │ │
│  │  1. Get warehouse pincode from EKART (or use provided)            │ │
│  │  2. Get delivery pincode from order.addressid                     │ │
│  │  3. Get states from both pincodes using postal API                │ │
│  │  4. Compare states → determine GST type:                          │ │
│  │     - Same state → INTRA-STATE (CGST + SGST)                      │ │
│  │     - Different state → INTER-STATE (IGST)                        │ │
│  │  5. For each orderline:                                            │ │
│  │     - Get product subcategory/subsubcategory                      │ │
│  │     - Lookup GST rate from gst_hsn_mapping                        │ │
│  │     - Validate orderamount (handle quantity): ⭐ NEW             │ │
│  │       * Check if orderamount is per-unit (compare with original_price)│ │
│  │       * If per-unit: multiply by quantity to get total            │ │
│  │       * Otherwise: use orderamount as-is (already total)          │ │
│  │     - Calculate:                                                   │ │
│  │       * taxable_amount = total_orderamount / (1 + gst_rate/100)   │ │
│  │       * total_gst_amount = total_orderamount - taxable_amount     │ │
│  │       * Split: CGST+SGST (INTRA) or IGST (INTER)                  │ │
│  │  6. Update orderlines with GST fields:                             │ │
│  │     - hsn_code, gst_rate, taxable_amount                          │ │
│  │     - cgst_amount, sgst_amount, igst_amount                       │ │
│  │     - total_gst_amount                                             │ │
│  │  7. Aggregate to order level:                                      │ │
│  │     - items_total = orderamount - shipping_cost                   │ │
│  │     - total_taxable_amount = Σ(orderline.taxable_amount)           │ │
│  │     - total_cgst_amount = Σ(orderline.cgst_amount)                 │ │
│  │     - total_sgst_amount = Σ(orderline.sgst_amount)                 │ │
│  │     - total_igst_amount = Σ(orderline.igst_amount)                 │ │
│  │     - total_gst_amount = Σ(orderline.total_gst_amount)             │ │
│  │  8. Update order with GST totals                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ⚠️ GST calculation errors don't fail order creation (graceful)        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 QUANTITY UPDATE FLOW (updateProductQuantitiesAfterOrder)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  updateProductQuantitiesAfterOrder(orderData, orderItems, mode)         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  For each orderItem:                                                    │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  1. GET PLATFORMSTOCK:                                                  │
│     platformStock = prisma.platformStock.findUnique({                   │
│       productid_platform: { productid, platform: 'nivapp' }             │
│     })                                                                  │
│                                                                         │
│  2. CONVERT LOCK TO ORDER:                                              │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  BEFORE (after initiate):                                    │    │
│     │  ─────────────────────────────────────────────────────────   │    │
│     │  availableqty: 10 (reduced during lock)                      │    │
│     │  lockqty:      2  (added during lock)                        │    │
│     │  orderedqty:   5                                             │    │
│     │                                                              │    │
│     │  AFTER (callback):                                           │    │
│     │  ─────────────────────────────────────────────────────────   │    │
│     │  availableqty: 10 (NO CHANGE)                                │    │
│     │  lockqty:      0  (converted to order)                       │    │
│     │  orderedqty:   7  (+2 from lock)                             │    │
│     │                                                              │    │
│     │  FORMULA:                                                    │    │
│     │  quantityToConvert = min(requestedQty, currentLockQty)       │    │
│     │  newLockQty = max(0, currentLockQty - quantityToConvert)     │    │
│     │  newOrderedQty = currentOrderedQty + quantityToConvert       │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  3. UPDATE PLATFORMSTOCK:                                               │
│     prisma.platformStock.update({                                       │
│       where: { productid_platform: {...} },                             │
│       data: {                                                           │
│         availableqty: newAvailableQty,   // NO CHANGE                   │
│         lockqty: newLockQty,             // → 0 (or reduced)            │
│         orderedqty: newOrderedQty,       // + quantityToConvert         │
│         platformstatus: 'in_stock' | 'low_stock' | 'out_of_stock'       │
│       }                                                                 │
│     })                                                                  │
│                                                                         │
│  4. UPDATE PRODUCT:                                                     │
│     prisma.product.update({                                             │
│       where: { id: productId },                                         │
│       data: {                                                           │
│         orderedquantity: current + quantityToConvert                    │
│       }                                                                 │
│     })                                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📈 STATUS FLOW

### Order Status (orders.orderstatus)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ORDER STATUS FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │ order_placed│
    └──────┬──────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌──────────┐  ┌────────────────┐
│ payment  │  │ order_confirmed│  ← COD mode (no payment upfront)
│ _completed│  │                │
└────┬─────┘  └───────┬────────┘
     │                │
     └───────┬────────┘
             │
             ▼
    ┌────────────────────┐
    │ ready_for_dispatch │  ← Inventory packs the box
    └─────────┬──────────┘
              │
              ▼
    ┌───────────────┐
    │    shipped    │  ← EKART label printed, handed to courier
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │   in_transit  │  ← EKART webhook
    └───────┬───────┘
            │
            ▼
    ┌──────────────────┐
    │ out_for_delivery │  ← EKART webhook
    └────────┬─────────┘
             │
             ▼
    ┌───────────────┐
    │   delivered   │  ← EKART webhook
    └───────┬───────┘
            │
            ▼ (COD only)
    ┌────────────────────┐
    │cod_payment_received│  ← Money collected
    └────────────────────┘
```

### Status History Structure

```json
{
  "status_history": [
    {
      "previous_status": "order_placed",
      "new_status": "payment_completed",
      "changed_date": 1702123456789,
      "source": "phonepe",
      "is_active": false
    },
    {
      "previous_status": "payment_completed",
      "new_status": "ready_for_dispatch",
      "changed_date": 1702123556789,
      "source": "inventoryuser",
      "inventory_user_id": 42,
      "is_active": true
    }
  ]
}
```

---

## 💰 AMOUNT FIELDS SUMMARY

### Order Table (orders)

| Field | Description | Calculation |
|-------|-------------|-------------|
| `original_total` | Sum of base prices × quantities | Σ(base_price × qty) |
| `productamount` | After product discounts, before promos | original_total - productDiscountTotal |
| `discountamount` | Total discounts (product + promotion) | productDiscountTotal + promotionDiscountTotal |
| `promotion_discount_total` | Coupon/promotion discounts only | Σ(applied_promotions.discount_amount) |
| `orderamount` | Final amount paid by customer | productamount - promotionDiscountTotal + shipping_cost |
| `shipping_cost` | Shipping charges | From originalPayload |
| `tax_amount` | Tax amount | From originalPayload |
| `items_total` ⭐ | Product-only total (GST base) | orderamount - shipping_cost |
| `total_taxable_amount` | Sum of base amounts | Σ(orderline.taxable_amount) |
| `total_cgst_amount` | Sum of CGST | Σ(orderline.cgst_amount) |
| `total_sgst_amount` | Sum of SGST | Σ(orderline.sgst_amount) |
| `total_igst_amount` | Sum of IGST | Σ(orderline.igst_amount) |
| `total_gst_amount` | Sum of total GST | Σ(orderline.total_gst_amount) |

### Orderline Table (orderline)

| Field | Description | Calculation |
|-------|-------------|-------------|
| `original_price` | Base price per unit (NOT multiplied by quantity) | base_price (per-unit) |
| `productamount` | After product discount | original_price - product_discount_amount |
| `product_discount_amount` | Product-level discount | product_discount × qty |
| `promotion_discount_amount` | Coupon discount (pro-rata) | From breakdown or pro-rata |
| `discountamount` | Total item discount | product_discount + promotion_discount |
| `orderamount` | Final item amount | productamount - promotion_discount_amount |
| `shipping_cost` | Pro-rata shipping | (total_shipping × item_amount) / total_amount |
| `hsn_code` | HSN code | From gst_hsn_mapping (null if not found) |
| `gst_rate` | GST percentage | From gst_hsn_mapping (default: 18%) |
| `taxable_amount` | Base amount without GST | orderamount / (1 + gst_rate/100) |
| `cgst_amount` | Central GST | total_gst / 2 (INTRA-STATE only) |
| `sgst_amount` | State GST | total_gst / 2 (INTRA-STATE only) |
| `igst_amount` | Integrated GST | total_gst (INTER-STATE only) |
| `total_gst_amount` | Total GST | orderamount - taxable_amount |

---

## 🧮 EXAMPLE: Multi-Product Order with Discounts

### Scenario

```
Product 1: ₹500 × 2 qty = ₹1000 (base)
           Product discount: ₹25 per unit
           
Product 2: ₹400 × 1 qty = ₹400 (base)
           Product discount: ₹0

Promotion: Flat ₹500 off (coupon code applied)
```

### Data Sources (from promotion_evaluations)

```typescript
// cart_data (stored during cart evaluation)
cart_data = [
  { product_id: 1, base_price: 500, product_discount: 25, quantity: 2 },
  { product_id: 2, base_price: 400, product_discount: 0,  quantity: 1 }
]

// applied_promotions
applied_promotions = [
  {
    promotion_id: 123,
    discount_amount: 500,    // Total promotion discount
    breakdown: [             // Per-product breakdown (if available)
      { product_id: 1, total_discount: 351.85 },
      { product_id: 2, total_discount: 148.15 }
    ]
  }
]
```

### Step-by-Step Calculation

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CALCULATE ORDER-LEVEL TOTALS                                  │
└─────────────────────────────────────────────────────────────────────────┘

originalTotal = (500 × 2) + (400 × 1) = ₹1400

productDiscountTotal = (25 × 2) + (0 × 1) = ₹50

productAmount = originalTotal - productDiscountTotal
             = 1400 - 50 = ₹1350

promotionDiscountTotal = ₹500 (from applied_promotions)

discountamount = productDiscountTotal + promotionDiscountTotal
              = 50 + 500 = ₹550

orderamount = productAmount - promotionDiscountTotal
           = 1350 - 500 = ₹850


┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: DISTRIBUTE TO ORDERLINES (Pro-rata)                           │
└─────────────────────────────────────────────────────────────────────────┘

Formula: promotion_share = (item_productamount / total_productamount) × promotion_total

───────────────────────────────────────────────────────────────────────────
ORDERLINE 1 (Product 1: ₹500 × 2)
───────────────────────────────────────────────────────────────────────────
original_price          = 500 (PER-UNIT, NOT multiplied) ✅
product_discount_amount = 25 × 2  = ₹50 (TOTAL)
productamount           = (500 × 2) - 50 = ₹950 (TOTAL)

promotion_discount_amount = (950 / 1350) × 500 = ₹351.85 (TOTAL)

discountamount = 50 + 351.85 = ₹401.85 (TOTAL)
orderamount    = 950 - 351.85 = ₹598.15 (TOTAL)

───────────────────────────────────────────────────────────────────────────
ORDERLINE 2 (Product 2: ₹400 × 1)
───────────────────────────────────────────────────────────────────────────
original_price          = 400 (PER-UNIT, NOT multiplied) ✅
product_discount_amount = 0 × 1   = ₹0 (TOTAL)
productamount           = (400 × 1) - 0 = ₹400 (TOTAL)

promotion_discount_amount = (400 / 1350) × 500 = ₹148.15 (TOTAL)

discountamount = 0 + 148.15 = ₹148.15 (TOTAL)
orderamount    = 400 - 148.15 = ₹251.85 (TOTAL)
```

### Final Stored Values

```sql
-- ORDER TABLE
┌─────────────────────────┬──────────┐
│ Field                   │ Value    │
├─────────────────────────┼──────────┤
│ original_total          │ ₹1400.00 │
│ productamount           │ ₹1350.00 │
│ discountamount          │ ₹550.00  │
│ promotion_discount_total│ ₹500.00  │
│ orderamount             │ ₹850.00  │
│ quantity                │ 3        │
└─────────────────────────┴──────────┘

-- ORDERLINE TABLE (Product 1)
┌─────────────────────────────┬──────────┐
│ Field                       │ Value    │
├─────────────────────────────┼──────────┤
│ productid                   │ 1        │
│ quantity                    │ 2        │
│ original_price              │ ₹500.00  │ ✅ PER-UNIT (not multiplied)
│ product_discount_amount     │ ₹50.00   │ ✅ TOTAL
│ promotion_discount_amount   │ ₹351.85  │ ✅ TOTAL
│ productamount               │ ₹950.00  │ ✅ TOTAL
│ discountamount              │ ₹401.85  │ ✅ TOTAL
│ orderamount                 │ ₹598.15  │ ✅ TOTAL
└─────────────────────────────┴──────────┘

-- ORDERLINE TABLE (Product 2)
┌─────────────────────────────┬──────────┐
│ Field                       │ Value    │
├─────────────────────────────┼──────────┤
│ productid                   │ 2        │
│ quantity                    │ 1        │
│ original_price              │ ₹400.00  │ ✅ PER-UNIT (not multiplied)
│ product_discount_amount     │ ₹0.00    │ ✅ TOTAL
│ promotion_discount_amount   │ ₹148.15  │ ✅ TOTAL
│ productamount               │ ₹400.00  │ ✅ TOTAL
│ discountamount              │ ₹148.15  │ ✅ TOTAL
│ orderamount                 │ ₹251.85  │ ✅ TOTAL
└─────────────────────────────┴──────────┘
```

### Verification Checksums

```
⚠️ NOTE: original_price is PER-UNIT, so we multiply by quantity for totals
Σ(original_price × quantity) = (500 × 2) + (400 × 1) = ₹1400 ✅ = order.original_total
Σ(product_discount_amount)   = 50 + 0           = ₹50   ✅
Σ(promotion_discount_amount) = 351.85 + 148.15  = ₹500  ✅ = order.promotion_discount_total
Σ(productamount)             = 950 + 400        = ₹1350 ✅ = order.productamount
Σ(discountamount)            = 401.85 + 148.15  = ₹550  ✅ = order.discountamount
Σ(orderamount)               = 598.15 + 251.85  = ₹850  ✅ = order.orderamount

Cross-check: original_total - discountamount = 1400 - 550 = ₹850 ✅
```

### Visual Flow

```
                    PRODUCT 1                    PRODUCT 2
                    ₹500 × 2                     ₹400 × 1
                       │                            │
                       ▼                            ▼
               ┌───────────────┐            ┌───────────────┐
               │ original_price│            │ original_price│
               │ = ₹500 (per-unit)│         │ = ₹400 (per-unit)│
               └───────┬───────┘            └───────┬───────┘
                       │                            │
                       │ (× quantity for totals)    │
                       ▼                            ▼
               ┌───────────────┐            ┌───────────────┐
               │ Total: ₹1000  │            │ Total: ₹400   │
               │ (500 × 2)     │            │ (400 × 1)     │
               └───────┬───────┘            └───────┬───────┘
                       │                            │
                       ▼                            │
               ┌───────────────┐                    │
               │ Product       │                    │
               │ Discount      │                    │
               │ ₹25×2 = -₹50  │                    │
               └───────┬───────┘                    │
                       │                            │
                       ▼                            ▼
               ┌───────────────┐            ┌───────────────┐
               │ productamount │            │ productamount │
               │ = ₹950        │            │ = ₹400        │
               └───────┬───────┘            └───────┬───────┘
                       │                            │
                       └────────────┬───────────────┘
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │ Total productamount │
                          │ = ₹1350             │
                          └─────────┬───────────┘
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │ PROMO: FLAT ₹500    │
                          │ Pro-rata split:     │
                          │ ─────────────────   │
                          │ P1: 950/1350 × 500  │
                          │   = -₹351.85        │
                          │                     │
                          │ P2: 400/1350 × 500  │
                          │   = -₹148.15        │
                          └─────────────────────┘
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
               ┌───────────────┐         ┌───────────────┐
               │ ORDERLINE 1   │         │ ORDERLINE 2   │
               │ ────────────  │         │ ────────────  │
               │ orig:   ₹500  │ ✅ PER-UNIT│ orig:   ₹400  │ ✅ PER-UNIT
               │ qty:    2     │         │ qty:    1     │
               │ prod:   -₹50  │ ✅ TOTAL│ prod:   -₹0   │ ✅ TOTAL
               │ promo: -₹352  │ ✅ TOTAL│ promo: -₹148  │ ✅ TOTAL
               │ ────────────  │         │ ────────────  │
               │ final: ₹598   │ ✅ TOTAL│ final: ₹252   │ ✅ TOTAL
               └───────────────┘         └───────────────┘
                       │                         │
                       └────────────┬────────────┘
                                    ▼
                          ┌─────────────────────┐
                          │ ORDER TOTAL         │
                          │ ₹598 + ₹252 = ₹850  │
                          └─────────────────────┘
```

### Code Location

```typescript
// phonepe.controller.ts - createOrderAfterPayment()

// Lines ~2471-2485: Calculate order totals
originalTotal = cartItems.reduce((total, item) => {
  return total + (item.base_price * item.quantity);
}, 0);

productDiscountTotal = cartItems.reduce((total, item) => {
  return total + (item.product_discount * item.quantity);
}, 0);

// Lines ~2623-2854: Enrich order items with per-line discounts
enrichedOrderItems = originalOrderData.map((item) => {
  const quantity = parseInt(item.quantity || '1');
  const rawProductAmount = parseFloat(item.productamount || '0');
  
  if (evaluationData) {
    // From evaluation cart_data (most accurate)
    const basePrice = cartItem.base_price; // Per-unit
    const productDiscount = cartItem.product_discount; // Per-unit
    
    originalPrice = basePrice; // ✅ PER-UNIT (not multiplied)
    productDiscountAmount = productDiscount * quantity; // ✅ TOTAL
    itemProductAmount = (basePrice * quantity) - productDiscountAmount; // ✅ TOTAL
    
    // Get promotion discount from breakdown or pro-rata
    promotionDiscountAmount = breakdown?.total_discount || (pro-rata);
  } else {
    // Fallback: productamount is PER-UNIT
    originalPrice = rawProductAmount; // ✅ PER-UNIT
    itemProductAmount = rawProductAmount * quantity; // ✅ TOTAL
    // Pro-rata distribution for discounts
    promotionDiscountAmount = (promotionTotal * itemProductAmount) / totalAmount;
  }
  
  // Calculate final amounts
  const finalOrderAmount = itemProductAmount - promotionDiscountAmount; // ✅ TOTAL
  const shippingCostForItem = (totalShipping * itemProductAmount) / totalProductAmount;
  
  return {
    ...item,
    original_price: originalPrice, // ✅ PER-UNIT
    product_discount_amount: productDiscountAmount, // ✅ TOTAL
    promotion_discount_amount: promotionDiscountAmount, // ✅ TOTAL
    discountamount: productDiscountAmount + promotionDiscountAmount, // ✅ TOTAL
    orderamount: finalOrderAmount, // ✅ TOTAL
    shipping_cost: shippingCostForItem // ✅ TOTAL
  };
});
```

---

## 🧮 EXAMPLE 2: Order WITHOUT Promotion + Shipping Cost

### Scenario

```
Product 1: ₹500 × 2 qty = ₹1000 (base)
           Product discount: ₹25 per unit
           
Product 2: ₹400 × 1 qty = ₹400 (base)
           Product discount: ₹0

Promotion: NONE (no coupon applied)
Shipping:  ₹150
```

### Step-by-Step Calculation

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CALCULATE ORDER-LEVEL TOTALS                                  │
└─────────────────────────────────────────────────────────────────────────┘

originalTotal = (500 × 2) + (400 × 1) = ₹1400

productDiscountTotal = (25 × 2) + (0 × 1) = ₹50

productAmount = originalTotal - productDiscountTotal
             = 1400 - 50 = ₹1350

promotionDiscountTotal = ₹0 (no promotion)

discountamount = productDiscountTotal + promotionDiscountTotal
              = 50 + 0 = ₹50

orderamount = productAmount - promotionDiscountTotal + shippingCost
           = 1350 - 0 + 150 = ₹1500


┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: DISTRIBUTE SHIPPING TO ORDERLINES (Pro-rata)                  │
└─────────────────────────────────────────────────────────────────────────┘

Formula: shipping_share = (item_productamount / total_productamount) × total_shipping

───────────────────────────────────────────────────────────────────────────
ORDERLINE 1 (Product 1: ₹500 × 2)
───────────────────────────────────────────────────────────────────────────
original_price          = 500 (PER-UNIT, NOT multiplied) ✅
product_discount_amount = 25 × 2  = ₹50 (TOTAL)
productamount           = (500 × 2) - 50 = ₹950 (TOTAL)

promotion_discount_amount = ₹0 (no promotion)

shipping_cost = (950 / 1350) × 150 = ₹105.56 (TOTAL)

discountamount = 50 + 0 = ₹50 (TOTAL)
orderamount    = 950 - 0 = ₹950 (TOTAL)

───────────────────────────────────────────────────────────────────────────
ORDERLINE 2 (Product 2: ₹400 × 1)
───────────────────────────────────────────────────────────────────────────
original_price          = 400 (PER-UNIT, NOT multiplied) ✅
product_discount_amount = 0 × 1   = ₹0 (TOTAL)
productamount           = (400 × 1) - 0 = ₹400 (TOTAL)

promotion_discount_amount = ₹0 (no promotion)

shipping_cost = (400 / 1350) × 150 = ₹44.44 (TOTAL)

discountamount = 0 + 0 = ₹0 (TOTAL)
orderamount    = 400 - 0 = ₹400 (TOTAL)
```

### Final Stored Values

```sql
-- ORDER TABLE
┌─────────────────────────┬──────────┐
│ Field                   │ Value    │
├─────────────────────────┼──────────┤
│ original_total          │ ₹1400.00 │
│ productamount           │ ₹1350.00 │
│ discountamount          │ ₹50.00   │
│ promotion_discount_total│ ₹0.00    │
│ shipping_cost           │ ₹150.00  │
│ orderamount             │ ₹1500.00 │
│ quantity                │ 3        │
└─────────────────────────┴──────────┘

-- ORDERLINE TABLE (Product 1)
┌─────────────────────────────┬──────────┐
│ Field                       │ Value    │
├─────────────────────────────┼──────────┤
│ productid                   │ 1        │
│ quantity                    │ 2        │
│ original_price              │ ₹500.00  │ ✅ PER-UNIT (not multiplied)
│ product_discount_amount     │ ₹50.00   │ ✅ TOTAL
│ promotion_discount_amount   │ ₹0.00    │ ✅ TOTAL
│ productamount               │ ₹950.00  │ ✅ TOTAL
│ discountamount              │ ₹50.00   │ ✅ TOTAL
│ orderamount                 │ ₹950.00  │ ✅ TOTAL
│ shipping_cost               │ ₹105.56  │ ✅ TOTAL
└─────────────────────────────┴──────────┘

-- ORDERLINE TABLE (Product 2)
┌─────────────────────────────┬──────────┐
│ Field                       │ Value    │
├─────────────────────────────┼──────────┤
│ productid                   │ 2        │
│ quantity                    │ 1        │
│ original_price              │ ₹400.00  │ ✅ PER-UNIT (not multiplied)
│ product_discount_amount     │ ₹0.00    │ ✅ TOTAL
│ promotion_discount_amount   │ ₹0.00    │ ✅ TOTAL
│ productamount               │ ₹400.00  │ ✅ TOTAL
│ discountamount              │ ₹0.00    │ ✅ TOTAL
│ orderamount                 │ ₹400.00  │ ✅ TOTAL
│ shipping_cost               │ ₹44.44   │ ✅ TOTAL
└─────────────────────────────┴──────────┘
```

### Verification Checksums

```
PRODUCT TOTALS:
⚠️ NOTE: original_price is PER-UNIT, so we multiply by quantity for totals
Σ(original_price × quantity) = (500 × 2) + (400 × 1) = ₹1400 ✅ = order.original_total
Σ(product_discount_amount)   = 50 + 0           = ₹50   ✅
Σ(productamount)             = 950 + 400        = ₹1350 ✅ = order.productamount
Σ(discountamount)            = 50 + 0           = ₹50   ✅ = order.discountamount
Σ(orderamount)               = 950 + 400        = ₹1350 ✅

SHIPPING:
Σ(shipping_cost)             = 105.56 + 44.44   = ₹150  ✅ = order.shipping_cost

FINAL ORDER AMOUNT:
order.orderamount = Σ(orderamount) + shipping_cost
                  = 1350 + 150 = ₹1500 ✅
```

### Visual Flow

```
                    PRODUCT 1                    PRODUCT 2
                    ₹500 × 2                     ₹400 × 1
                       │                            │
                       ▼                            ▼
               ┌───────────────┐            ┌───────────────┐
               │ original_price│            │ original_price│
               │ = ₹500 (per-unit)│         │ = ₹400 (per-unit)│
               └───────┬───────┘            └───────┬───────┘
                       │                            │
                       │ (× quantity for totals)    │
                       ▼                            ▼
               ┌───────────────┐            ┌───────────────┐
               │ Total: ₹1000  │            │ Total: ₹400   │
               │ (500 × 2)     │            │ (400 × 1)     │
               └───────┬───────┘            └───────┬───────┘
                       │                            │
                       ▼                            │
               ┌───────────────┐                    │
               │ Product       │                    │
               │ Discount      │                    │
               │ ₹25×2 = -₹50  │                    │
               └───────┬───────┘                    │
                       │                            │
                       ▼                            ▼
               ┌───────────────┐            ┌───────────────┐
               │ productamount │            │ productamount │
               │ = ₹950        │            │ = ₹400        │
               └───────┬───────┘            └───────┬───────┘
                       │                            │
                       └────────────┬───────────────┘
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │ Total productamount │
                          │ = ₹1350             │
                          └─────────┬───────────┘
                                    │
                                    │ (NO PROMOTION)
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
               ┌───────────────┐         ┌───────────────┐
               │ ORDERLINE 1   │         │ ORDERLINE 2   │
               │ ────────────  │         │ ────────────  │
               │ orig:   ₹500  │ ✅ PER-UNIT│ orig:   ₹400  │ ✅ PER-UNIT
               │ qty:    2     │         │ qty:    1     │
               │ prod:   -₹50  │ ✅ TOTAL│ prod:   -₹0   │ ✅ TOTAL
               │ promo:  -₹0   │ ✅ TOTAL│ promo:  -₹0   │ ✅ TOTAL
               │ ────────────  │         │ ────────────  │
               │ amount: ₹950  │ ✅ TOTAL│ amount: ₹400  │ ✅ TOTAL
               │ ship:   ₹106  │ ✅ TOTAL│ ship:   ₹44   │ ✅ TOTAL
               └───────────────┘         └───────────────┘
                       │                         │
                       └────────────┬────────────┘
                                    ▼
                          ┌─────────────────────┐
                          │ SUBTOTAL: ₹1350     │
                          │ SHIPPING: + ₹150    │
                          │ ─────────────────   │
                          │ ORDER TOTAL: ₹1500  │
                          └─────────────────────┘
```

### Key Differences from Example 1

| Aspect | Example 1 (With Promo) | Example 2 (No Promo) |
|--------|------------------------|----------------------|
| Promotion | ₹500 flat off | None |
| Shipping | Not shown | ₹150 |
| promotion_discount_total | ₹500 | ₹0 |
| orderamount | ₹850 | ₹1500 |
| Shipping distribution | N/A | Pro-rata by productamount |

### Formula Summary

```
WITHOUT PROMOTION:
──────────────────────────────────────────────────────
originalTotal        = Σ(base_price × qty)
productDiscountTotal = Σ(product_discount × qty)
productAmount        = originalTotal - productDiscountTotal
discountamount       = productDiscountTotal  (promo = 0)
orderamount          = productAmount + shipping_cost

Per-Orderline Shipping:
shipping_cost = (item_productamount / total_productamount) × total_shipping
```

---

## 🧮 EXAMPLE 3: FULL COMBINATION (Product Discount + Promotion + Shipping)

### Scenario

```
Product 1: ₹500 × 2 qty = ₹1000 (base)
           Product discount: ₹25 per unit
           
Product 2: ₹400 × 1 qty = ₹400 (base)
           Product discount: ₹0

Promotion: Flat ₹500 off (coupon)
Shipping:  ₹150
```

### Step-by-Step Calculation

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CALCULATE ORDER-LEVEL TOTALS                                  │
└─────────────────────────────────────────────────────────────────────────┘

originalTotal = (500 × 2) + (400 × 1) = ₹1400

productDiscountTotal = (25 × 2) + (0 × 1) = ₹50

productAmount = originalTotal - productDiscountTotal
             = 1400 - 50 = ₹1350

promotionDiscountTotal = ₹500 (from applied_promotions)

discountamount = productDiscountTotal + promotionDiscountTotal
              = 50 + 500 = ₹550

shippingCost = ₹150

orderamount = (productAmount - promotionDiscountTotal) + shippingCost
           = (1350 - 500) + 150 = ₹1000


┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: DISTRIBUTE TO ORDERLINES (Pro-rata)                           │
└─────────────────────────────────────────────────────────────────────────┘

Formulas:
  promotion_share = (item_productamount / total_productamount) × promotion_total
  shipping_share  = (item_productamount / total_productamount) × shipping_total

───────────────────────────────────────────────────────────────────────────
ORDERLINE 1 (Product 1: ₹500 × 2)
───────────────────────────────────────────────────────────────────────────
original_price          = 500 (PER-UNIT, NOT multiplied) ✅
product_discount_amount = 25 × 2  = ₹50 (TOTAL)
productamount           = (500 × 2) - 50 = ₹950 (TOTAL)

Pro-rata factor = 950 / 1350 = 0.7037

promotion_discount_amount = 0.7037 × 500 = ₹351.85 (TOTAL)
shipping_cost             = 0.7037 × 150 = ₹105.56 (TOTAL)

discountamount = 50 + 351.85 = ₹401.85 (TOTAL)
orderamount    = 950 - 351.85 = ₹598.15 (TOTAL)

───────────────────────────────────────────────────────────────────────────
ORDERLINE 2 (Product 2: ₹400 × 1)
───────────────────────────────────────────────────────────────────────────
original_price          = 400 (PER-UNIT, NOT multiplied) ✅
product_discount_amount = 0 × 1   = ₹0 (TOTAL)
productamount           = (400 × 1) - 0 = ₹400 (TOTAL)

Pro-rata factor = 400 / 1350 = 0.2963

promotion_discount_amount = 0.2963 × 500 = ₹148.15 (TOTAL)
shipping_cost             = 0.2963 × 150 = ₹44.44 (TOTAL)

discountamount = 0 + 148.15 = ₹148.15 (TOTAL)
orderamount    = 400 - 148.15 = ₹251.85 (TOTAL)
```

### Final Stored Values

```sql
-- ORDER TABLE
┌─────────────────────────┬──────────┐
│ Field                   │ Value    │
├─────────────────────────┼──────────┤
│ original_total          │ ₹1400.00 │
│ productamount           │ ₹1350.00 │
│ discountamount          │ ₹550.00  │
│ promotion_discount_total│ ₹500.00  │
│ shipping_cost           │ ₹150.00  │
│ orderamount             │ ₹1000.00 │
│ quantity                │ 3        │
└─────────────────────────┴──────────┘

-- ORDERLINE TABLE (Product 1)
┌─────────────────────────────┬──────────┐
│ Field                       │ Value    │
├─────────────────────────────┼──────────┤
│ productid                   │ 1        │
│ quantity                    │ 2        │
│ original_price              │ ₹500.00  │ ✅ PER-UNIT (not multiplied)
│ product_discount_amount     │ ₹50.00   │ ✅ TOTAL
│ promotion_discount_amount   │ ₹351.85  │ ✅ TOTAL
│ productamount               │ ₹950.00  │ ✅ TOTAL
│ discountamount              │ ₹401.85  │ ✅ TOTAL
│ orderamount                 │ ₹598.15  │ ✅ TOTAL
│ shipping_cost               │ ₹105.56  │ ✅ TOTAL
└─────────────────────────────┴──────────┘

-- ORDERLINE TABLE (Product 2)
┌─────────────────────────────┬──────────┐
│ Field                       │ Value    │
├─────────────────────────────┼──────────┤
│ productid                   │ 2        │
│ quantity                    │ 1        │
│ original_price              │ ₹400.00  │ ✅ PER-UNIT (not multiplied)
│ product_discount_amount     │ ₹0.00    │ ✅ TOTAL
│ promotion_discount_amount   │ ₹148.15  │ ✅ TOTAL
│ productamount               │ ₹400.00  │ ✅ TOTAL
│ discountamount              │ ₹148.15  │ ✅ TOTAL
│ orderamount                 │ ₹251.85  │ ✅ TOTAL
│ shipping_cost               │ ₹44.44   │ ✅ TOTAL
└─────────────────────────────┴──────────┘
```

### Verification Checksums

```
PRODUCT TOTALS:
⚠️ NOTE: original_price is PER-UNIT, so we multiply by quantity for totals
Σ(original_price × quantity) = (500 × 2) + (400 × 1) = ₹1400 ✅ = order.original_total
Σ(product_discount_amount)   = 50 + 0           = ₹50   ✅
Σ(productamount)             = 950 + 400        = ₹1350 ✅ = order.productamount

DISCOUNTS:
Σ(promotion_discount_amount) = 351.85 + 148.15  = ₹500  ✅ = order.promotion_discount_total
Σ(discountamount)            = 401.85 + 148.15  = ₹550  ✅ = order.discountamount

AMOUNTS:
Σ(orderamount)               = 598.15 + 251.85  = ₹850  ✅

SHIPPING:
Σ(shipping_cost)             = 105.56 + 44.44   = ₹150  ✅ = order.shipping_cost

FINAL ORDER AMOUNT:
order.orderamount = Σ(orderamount) + shipping_cost
                  = 850 + 150 = ₹1000 ✅
```

### Visual Flow

```
                    PRODUCT 1                    PRODUCT 2
                    ₹500 × 2                     ₹400 × 1
                       │                            │
                       ▼                            ▼
               ┌───────────────┐            ┌───────────────┐
               │ original_price│            │ original_price│
               │ = ₹500 (per-unit)│         │ = ₹400 (per-unit)│
               └───────┬───────┘            └───────┬───────┘
                       │                            │
                       │ (× quantity for totals)    │
                       ▼                            ▼
               ┌───────────────┐            ┌───────────────┐
               │ Total: ₹1000  │            │ Total: ₹400   │
               │ (500 × 2)     │            │ (400 × 1)     │
               └───────┬───────┘            └───────┬───────┘
                       │                            │
                       ▼                            │
               ┌───────────────┐                    │
               │ Product       │                    │
               │ Discount -₹50 │                    │
               └───────┬───────┘                    │
                       │                            │
                       ▼                            ▼
               ┌───────────────┐            ┌───────────────┐
               │ productamount │            │ productamount │
               │ = ₹950        │            │ = ₹400        │
               └───────┬───────┘            └───────┬───────┘
                       │                            │
                       └────────────┬───────────────┘
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │ Total = ₹1350       │
                          └─────────┬───────────┘
                                    │
                       ┌────────────┴────────────┐
                       │                         │
              PRO-RATA │ (950/1350)              │ (400/1350)
                SPLIT  │ = 70.37%                │ = 29.63%
                       │                         │
                       ▼                         ▼
               ┌───────────────┐         ┌───────────────┐
               │ PROMO: -₹352  │         │ PROMO: -₹148  │
               │ SHIP:  +₹106  │         │ SHIP:  +₹44   │
               └───────┬───────┘         └───────┬───────┘
                       │                         │
                       ▼                         ▼
               ┌───────────────┐         ┌───────────────┐
               │ ORDERLINE 1   │         │ ORDERLINE 2   │
               │ ────────────  │         │ ────────────  │
               │ orig:   ₹500  │ ✅ PER-UNIT│ orig:   ₹400  │ ✅ PER-UNIT
               │ qty:    2     │         │ qty:    1     │
               │ amount: ₹598  │ ✅ TOTAL│ amount: ₹252  │ ✅ TOTAL
               │ ship:   ₹106  │ ✅ TOTAL│ ship:   ₹44   │ ✅ TOTAL
               │ ────────────  │         │ ────────────  │
               │ line: ₹704    │         │ line:  ₹296   │
               └───────────────┘         └───────────────┘
                       │                         │
                       └────────────┬────────────┘
                                    ▼
                          ┌─────────────────────┐
                          │ SUBTOTAL:    ₹850   │
                          │ + SHIPPING:  ₹150   │
                          │ ─────────────────   │
                          │ ORDER TOTAL: ₹1000  │
                          └─────────────────────┘
```

### Comparison: All Three Examples

| Field | Ex1 (Promo Only) | Ex2 (Ship Only) | Ex3 (All) |
|-------|------------------|-----------------|-----------|
| original_total | ₹1400 | ₹1400 | ₹1400 |
| product_discount | ₹50 | ₹50 | ₹50 |
| productamount | ₹1350 | ₹1350 | ₹1350 |
| promotion_discount | ₹500 | ₹0 | ₹500 |
| discountamount | ₹550 | ₹50 | ₹550 |
| shipping_cost | ₹0 | ₹150 | ₹150 |
| **orderamount** | **₹850** | **₹1500** | **₹1000** |

### Code Reference

```typescript
// phonepe.controller.ts - Lines 2405-2448

// Calculate pro-rata shipping cost based on product amount
const totalProductAmount = originalOrderData
  .filter((i: any) => validProductIds.includes(i.productid))
  .reduce((sum: number, i: any) => 
    sum + parseFloat(i.productamount?.toString() || '0'), 0
  );

const shippingCostForItem = totalProductAmount > 0
  ? (shippingCost * itemProductAmount) / totalProductAmount
  : 0;

// Recalculate discountamount and orderamount based on enriched values
const totalDiscountAmount = productDiscountAmount + promotionDiscountAmount;
const finalOrderAmount = itemProductAmount - promotionDiscountAmount;

return {
  ...item,
  original_price: originalPrice,
  product_discount_amount: productDiscountAmount,
  promotion_discount_amount: promotionDiscountAmount,
  shipping_cost: shippingCostForItem,
  evaluation_id: primaryEvaluationId,
  discountamount: totalDiscountAmount,
  orderamount: finalOrderAmount
};
```

### Master Formula

```
ORDER-LEVEL:
─────────────────────────────────────────────────────────────────
originalTotal           = Σ(base_price × qty)
productDiscountTotal    = Σ(product_discount × qty)
productAmount           = originalTotal - productDiscountTotal
promotionDiscountTotal  = from promotion_evaluations.applied_promotions
discountamount          = productDiscountTotal + promotionDiscountTotal
orderamount             = (productAmount - promotionDiscountTotal) + shippingCost

ORDERLINE-LEVEL:
─────────────────────────────────────────────────────────────────
// PER-UNIT (stored as-is, NOT multiplied by quantity)
original_price          = base_price (from evaluation) OR productamount (fallback)

// TOTALS (multiplied by quantity)
product_discount_amount = product_discount × quantity
itemProductAmount       = (original_price × quantity) - product_discount_amount
promotion_discount      = (from breakdown) OR (proRataFactor × promotionDiscountTotal)
shipping_cost           = (totalShipping × itemProductAmount) / totalProductAmount
discountamount          = product_discount_amount + promotion_discount_amount
orderamount             = itemProductAmount - promotion_discount_amount

⚠️ CRITICAL RULES:
  1. original_price = PER-UNIT (not multiplied by quantity)
  2. All other amounts = TOTALS (include quantity)
  3. shipping_cost is stored separately (not added to orderamount at line level)
  4. Final = Σ(orderline.orderamount) + Σ(orderline.shipping_cost) = order.orderamount
```

---

## 🔐 STOCK QUANTITY FLOW

### PlatformStock (platform = 'nivapp')

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PLATFORMSTOCK QUANTITY FLOW                         │
└─────────────────────────────────────────────────────────────────────────┘

Initial State:
  availableqty: 100
  lockqty:      0
  orderedqty:   50

After INITIATE (lock 3 items):
  availableqty: 97  (100 - 3)  ← DECREASED
  lockqty:      3   (0 + 3)    ← INCREASED
  orderedqty:   50             ← NO CHANGE

After CALLBACK (convert lock to order):
  availableqty: 97             ← NO CHANGE
  lockqty:      0   (3 - 3)    ← RESET TO 0
  orderedqty:   53  (50 + 3)   ← INCREASED
```

### Product Table

```
After CALLBACK:
  availablequantity: NO CHANGE (already reduced at initiate via platformstock)
  orderedquantity:   +quantity (increased)
```

---

## 🛡️ ERROR HANDLING

### Validation Errors (400)

| Error Code | When | Action |
|------------|------|--------|
| `PROMOTION_EXPIRED_OR_INVALID` | Expired/cancelled promotion | Block order |
| `PRODUCT_NOT_FOUND` | Product doesn't exist | Block order |
| `INSUFFICIENT_PRODUCT_QUANTITY` | Not enough product stock | Block order |
| `PLATFORMSTOCK_NOT_FOUND` | No platformstock record | Block order |
| `INSUFFICIENT_PLATFORMSTOCK` | Not enough platform stock | Block order |
| `STOCK_LOCKING_FAILED` | Failed to lock stock | Block order |
| `PRODUCT_VALIDATION_FAILED` | Multiple products failed | Block order |

### Callback Errors

| Scenario | Action |
|----------|--------|
| Transaction EXPIRED/FAILED/CANCELLED | Redirect to failure page |
| Order already exists (duplicate) | Use existing order, redirect to success |
| PhonePe returns TRANSACTION_NOT_FOUND | Update status CANCELLED, redirect to failure |
| Order creation fails | Log error, redirect to success (payment was successful) |
| Quantity update fails | Log error, don't fail (order already created) |

---

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PHONEPE_CLIENT_ID` | PhonePe SDK Client ID | - |
| `PHONEPE_CLIENT_SECRET` | PhonePe SDK Client Secret | - |
| `PHONEPE_CLIENT_VERSION` | SDK version | 1 |
| `PHONEPE_ENVIRONMENT` | SANDBOX or PRODUCTION | PRODUCTION |
| `PHONEPE_MERCHANT_ID` | Legacy Merchant ID | - |
| `PHONEPE_SALT_KEY` | Legacy Salt Key | - |
| `PHONEPE_BASE_URL` | Legacy API URL | - |
| `REDIRECT_URL_SUCCESS` | Success redirect URL | com.Nivaana.app://profile/orders |
| `REDIRECT_URL_FAILURE` | Failure redirect URL | com.Nivaana.app://profile/orders |
| `REDIRECT_URL_PAYMENT_STATUS` | Callback base URL | https://nivaana...run.app |
| `LOCK_CLEANUP_DELAY_SECONDS` | GCP Task delay | 120 |

---

## 📝 Key Implementation Notes

1. **Stock Locking**: Uses `SELECT FOR UPDATE` in transaction to prevent race conditions
2. **Idempotency**: Callback checks for existing orders before creating new ones
3. **COD vs PhonePe**: COD creates order immediately, PhonePe waits for callback
4. **Status History**: Tracks all status changes with `is_active` flag for current status
5. **Address Extraction**: `addressid` for orders is extracted from the first order item (all items share the same delivery address)
6. **Pro-rata Distribution**: When promotion breakdown not available, discounts distributed by product amount ratio
7. **Negative Prevention**: All quantity calculations use `Math.max(0, ...)` to prevent negatives
8. **Last-Item Adjustment**: Last orderline gets remainder to ensure totals match exactly
9. **GCP Tasks**: Scheduled cleanup if payment not completed within timeout
10. **Orderline Amount Calculation** ⭐: 
    - `original_price` = **PER-UNIT** (base_price, NOT multiplied by quantity)
    - `productamount` = (original_price × quantity) - product_discount_amount (TOTAL)
    - `orderamount` = productamount - promotion_discount_amount (TOTAL)
    - All other amounts are TOTALS (include quantity)
    - See `ORDER_ORDERLINE_FIELDS_MASTER_REFERENCE.md` for complete field definitions
11. **GST Calculation** ⭐: Automatically calculated after orderline creation:
    - Fetches warehouse pincode from EKART API
    - Gets delivery pincode from order address
    - Uses postal API to get states from both pincodes
    - Compares states to determine INTRA-STATE (CGST+SGST) or INTER-STATE (IGST)
    - Calculates GST for each orderline based on product category
    - Updates orderlines and order with GST breakdown
    - Errors don't fail order creation (graceful handling)

---

## 📚 Related Files

- `src/routes/phonepe.route.ts` - Route definitions
- `src/controllers/phonepe.controller.ts` - Request handling
- `src/services/phonepe.service.ts` - PhonePe API integration
- `src/services/orders.service.ts` - Order creation with automatic GST calculation
- `src/services/orderline.service.ts` - Orderline management
- `src/services/transaction.service.ts` - Transaction records
- `src/services/promotion-evaluation.service.ts` - Promotion validation
- `src/services/promotion-redemption.service.ts` - Promotion redemption
- `src/services/gcpTasks.service.ts` - Lock cleanup tasks
- `src/services/gst.service.ts` ⭐ - GST calculation and dynamic state comparison
- `src/services/ekart.service.ts` - EKART API integration (for warehouse address)

---

*Last Updated: 20 December 2024*

1. initiate phonepe

platform stock => availableqty ↓  and lockqty ↑
product. => no change 

2. after callback 

platform stock => availableqty (no change)  and lockqty ↓ and  orderedqty ↑
product. => orderedquantity ↑, availablequantity ↓

3. clean up task (when payment is not successful)

PlatformStock
availableqty ↑ (adds back the released quantity)
lockqty ↓ (subtracts released quantity, floored at 0)
orderedqty unchanged


4. after order ready for dispatch

stock 
  - stockstatus ='sold',update orderlid and orderlinenumber and solddate 

platformstcok
  -orderedqty ↓ ,soldqty ↑, availableqty (no change)

product
  -orderedquantity ↓,soldquantity ↑, availablequantity (no change)

5. after order mark shipped 

orderline 
  -shipdate :current timestamp,ordersttaus:shipped

order
  -shipdate :current timestamp,ordersttaus:shipped,label_printed_at:current timestamp


### 2.1 Orderline Statuses (Actual Item Lifecycle)

| Status | Description | Who Sets | Date Field | Stock Action | Ekart Integration |
|--------|-------------|----------|------------|--------------|-------------------|
| **`order_placed`** | Orderline created; stock reserved | System | `ordereddate` | Reserve stock | - |
| **`payment_completed`** | Payment done (Prepaid), OR COD accepted | System | `paymentcompleteddate` | Convert lock→order | - |
| **`payment_failed`** | Prepaid payment failed | System | `paymentfaileddate` | Release reserved stock | - |
| **`order_confirmed`** | Warehouse accepted orderline | System | `orderconfirmeddate` | None | - |
| **`packed`** | Orderline packed into box | Warehouse | `packeddate` | None | - |
| **`ready_for_dispatch`** | Box ready; manifest generated | Warehouse | `readytodispatchdate` | None | - |
| **`shipped`** | Ekart AWB created | System | `shipdate` | None | ✅ Ekart AWB created |
| **`in_transit`** | Ekart event | Ekart | None | None | ✅ Tracking |
| **`out_for_delivery`** | Ekart event | Ekart | None | None | ✅ Tracking |
| **`delivered`** | Delivered to customer | Ekart | `delivereddate` | None | ✅ Tracking |
| **`cod_payment_received`** | COD payment collected | Ekart | `paymentreceiveddate` | None | ✅ After delivery |
| **`cancellation_requested`** | Cancellation requested (shipped order) | Customer | `cancellationrequesteddate` | None (wait for RTO) | Wait for RTO |
| **`cancelled`** | Orderline cancelled; stock restored | System / Customer | `cancelleddate` | ✅ Restore stock | Optional: Cancel AWB |
| **`return_initiated`** | Customer started return | Customer | `returninitiateddate` | None | Optional Ekart |
| **`returned`** | Reverse shipment delivered | Ekart | `returneddate` | ✅ Restore stock | Reverse AWB |
| **`rto_initiated`** | Delivery failed → Ekart returning | Ekart | None | ✅ Restore stock | Ekart RTO |
| **`rto_delivered`** | RTO item delivered to seller | Ekart | None | None | Ekart RTO |

### 2.2 Order Statuses (Derived, Not Manually Set)

| Status | Meaning |
|--------|---------|
| **`order_placed`** | Order created (all lines placed) |
| **`payment_completed`** | Prepaid done OR COD accepted |
| **`order_confirmed`** | All orderlines confirmed |
| **`packed`** | All orderlines packed in single box |
| **`ready_for_dispatch`** | All orderlines ready |
| **`shipped`** | All orderlines shipped (single AWB) |
| **`in_transit`** | All shipped and in transit |
| **`out_for_delivery`** | All OFD |
| **`delivered`** | All delivered |
| **`cod_payment_received`** | COD payment fully collected |
| **`cancellation_requested`** | Cancellation requested (waiting for RTO) |
| **`partially_cancelled`** | Some orderlines cancelled |
| **`cancelled`** | All orderlines cancelled |
| **`partially_returned`** | Some returned |
| **`returned`** | All returned |
| **`rto_initiated`** | All RTO initiated |
| **`rto_delivered`** | All RTO delivered |

**Important:** Order status is **always derived** from orderline statuses, never manually set.
