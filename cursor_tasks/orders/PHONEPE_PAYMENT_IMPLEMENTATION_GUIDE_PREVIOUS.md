# PhonePe Payment Flow - Complete Implementation Guide (PREVIOUS - WITHOUT GST)

## 📋 Overview

This document provides a single source of truth for the PhonePe payment integration in the Asset Management Backend. It covers both **payment initiation** and **callback handling**, including all database operations, stock management, promotions, and amount calculations.

**Version**: Previous (Before December 2024) - **WITHOUT GST Calculation**

**⚠️ NOTE**: This version does NOT include GST calculation. For current implementation with GST, see `PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE_CURRENT.md`

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
  order: [                            // Array of order items
    {
      addressid: number,              // Delivery address ID
      cartId: number,                 // Cart item ID
      discountamount: number,         // Total discount on this item
      orderamount: number,            // Final price after discount
      productamount: number,          // Original product price
      productcategory: string,        // Product category
      productid: number,              // Product ID
      productname: string,            // Product name
      quantity: number,               // Quantity ordered
      userid: number                  // User ID
    }
  ],
  transaction: {
    amount: number,                   // Total transaction amount (INR)
    mobilenumber: string,             // 10-digit mobile number
    name: string,                     // Customer name/email
    productid: number[],              // Array of product IDs
    transactionfor: string,           // 'product', 'service', 'subscription', 'donation'
    userId: number                    // User ID
  }
}
```

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
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  5. ENRICH ORDER ITEMS (Per-Line Discount Data)                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  For each item in originalOrderData:                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  // Get from evaluation cart_data                                  │ │
│  │  originalPrice = base_price × quantity                             │ │
│  │  productDiscountAmount = product_discount × quantity               │ │
│  │                                                                    │ │
│  │  // Get from applied_promotions.breakdown                          │ │
│  │  promotionDiscountAmount = breakdown[productId].total_discount     │ │
│  │                                                                    │ │
│  │  // If no breakdown, use pro-rata distribution                     │ │
│  │  promotionDiscountAmount = (promotionTotal × itemAmount) / total   │ │
│  │                                                                    │ │
│  │  // Calculate shipping per item (pro-rata)                         │ │
│  │  shippingCostForItem = (shippingTotal × itemAmount) / total        │ │
│  │                                                                    │ │
│  │  // Final item amounts                                             │ │
│  │  discountamount = productDiscount + promotionDiscount              │ │
│  │  orderamount = productamount - promotionDiscountAmount             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  enrichedOrderItems[] = [                                               │
│    {                                                                    │
│      ...originalItem,                                                   │
│      original_price,                                                    │
│      product_discount_amount,                                           │
│      promotion_discount_amount,                                         │
│      shipping_cost,                                                     │
│      evaluation_id,                                                     │
│      discountamount: recalculated,                                      │
│      orderamount: recalculated                                          │
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
```

**⚠️ NOTE**: In this previous version, there was NO Step 10 (GST Calculation). Order creation ended after Step 9.

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

**⚠️ NOTE**: GST fields (`items_total`, `total_taxable_amount`, `total_cgst_amount`, etc.) were NOT present in this version.

### Orderline Table (orderline)

| Field | Description | Calculation |
|-------|-------------|-------------|
| `original_price` | Base price × quantity | base_price × qty |
| `productamount` | After product discount | original_price - product_discount_amount |
| `product_discount_amount` | Product-level discount | product_discount × qty |
| `promotion_discount_amount` | Coupon discount (pro-rata) | From breakdown or pro-rata |
| `discountamount` | Total item discount | product_discount + promotion_discount |
| `orderamount` | Final item amount | productamount - promotion_discount_amount |
| `shipping_cost` | Pro-rata shipping | (total_shipping × item_amount) / total_amount |

**⚠️ NOTE**: GST fields (`hsn_code`, `gst_rate`, `taxable_amount`, `cgst_amount`, `sgst_amount`, `igst_amount`, `total_gst_amount`) were NOT present in this version.

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

**⚠️ NOTE**: GST Calculation was NOT implemented in this version.

---

## 📚 Related Files

- `src/routes/phonepe.route.ts` - Route definitions
- `src/controllers/phonepe.controller.ts` - Request handling
- `src/services/phonepe.service.ts` - PhonePe API integration
- `src/services/orders.service.ts` - Order creation
- `src/services/orderline.service.ts` - Orderline management
- `src/services/transaction.service.ts` - Transaction records
- `src/services/promotion-evaluation.service.ts` - Promotion validation
- `src/services/promotion-redemption.service.ts` - Promotion redemption
- `src/services/gcpTasks.service.ts` - Lock cleanup tasks

**⚠️ NOTE**: `gst.service.ts` and `ekart.service.ts` were NOT used in this version.

---

*Last Updated: Before December 2024 - WITHOUT GST Calculation*

