# 📘 PhonePe Payment Integration - Complete Implementation Guide

**Version**: 2.0 (With PlatformStock & Product Validation)  
**Last Updated**: October 8, 2025  
**Platform**: nivapp  

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Implementation Summary](#implementation-summary)
3. [Validation Flow (Before Payment)](#validation-flow-before-payment)
4. [Update Flow (After Payment)](#update-flow-after-payment)
5. [API Endpoint Details](#api-endpoint-details)
6. [Error Responses](#error-responses)
7. [Success Responses](#success-responses)
8. [Database Schema](#database-schema)
9. [Code Implementation](#code-implementation)
10. [Testing Scenarios](#testing-scenarios)
11. [Troubleshooting](#troubleshooting)

---

## Overview

This document provides complete implementation details for the PhonePe payment integration with comprehensive validation and update logic for the nivapp platform.

### Key Features

✅ **Three-Layer Validation** (Before Payment)
- Promotion/Evaluation validation
- Product availability validation
- PlatformStock availability validation

✅ **Three-Entity Updates** (After Payment)
- Promotion redemption tracking
- PlatformStock quantity management
- Product quantity management

✅ **Smart Error Handling**
- Expired promotions → Block payment
- Limit-reached promotions → Inform user, continue
- Insufficient stock → Block payment with details

---

## Implementation Summary

### ✅ BEFORE Payment (`/v1/phonepe/initiate`) - 3 Validations

#### 1. Promotion Validation ✅
```typescript
Location: src/controllers/phonepe.controller.ts (Lines 62-189)

Validates:
- promotion_evaluation exists
- promotion exists
- status = 'active'
- NOT expired (start_date <= now <= end_date)
- NOT cancelled
- usage limits not exceeded (redemption_count < usage_limit)

Results:
- EXPIRED/CANCELLED → ❌ BLOCK payment (400 error)
- LIMIT REACHED → ⚠️ INFORM user, continue without promotion
- VALID → ✅ Include in order
```

#### 2. Product Validation ✅
```typescript
Location: src/controllers/phonepe.controller.ts (Lines 136-201)

Validates:
- product exists in database
- product.availablequantity >= order quantity

Results:
- NOT FOUND → ❌ BLOCK payment
- INSUFFICIENT → ❌ BLOCK payment
- VALID → ✅ Continue to platformstock check
```

#### 3. PlatformStock Validation ✅
```typescript
Location: src/controllers/phonepe.controller.ts (Lines 203-287)

Validates:
- platformstock exists for (productid, 'nivapp')
- actualAvailable = availableqty - lockqty
- actualAvailable >= order quantity

Results:
- NOT FOUND → ❌ BLOCK payment
- INSUFFICIENT → ❌ BLOCK payment
- VALID → ✅ Proceed to payment
```

---

### ✅ AFTER Payment - 3 Updates

#### 1. Promotion Updates ✅
```typescript
Location: src/controllers/phonepe.controller.ts (Lines 1440-1507)

Updates:
- promotion_evaluations.redeemed = true
- promotion_evaluations.redemption_count += 1
- promotion_evaluations.order_id = order.id
- promotion_evaluations.redeemed_at = now()
- promotion_evaluations.status = 'redeemed'

Creates:
- promotion_redemptions record with full details
```

#### 2. PlatformStock Updates ✅
```typescript
Location: src/controllers/phonepe.controller.ts (Lines 2159-2189)

Updates:
- availableqty -= order quantity
- lockqty += order quantity
- orderedqty += order quantity
- platformstatus = calculate_status(new_availableqty)
- modifieddate = now()

Status Rules:
- availableqty <= 0 → 'out_of_stock'
- availableqty 1-5 → 'low_stock'
- availableqty > 5 → 'in_stock'
```

#### 3. Product Updates ✅
```typescript
Location: src/controllers/phonepe.controller.ts (Lines 2251-2259)

Updates:
- orderedquantity += order quantity
- availablequantity -= order quantity
- productstatus = calculate_status(new_availablequantity)
- modifieddate = now()

Status Rules: Same as platformstatus
```

---

## Validation Flow (Before Payment)

### Complete Flow Diagram

```
POST /v1/phonepe/initiate
    ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Promotion Validation                                   │
│  ────────────────────────────────────────────────────────────   │
│  FOR EACH evaluation_id:                                        │
│                                                                 │
│  ✓ Get promotion_evaluation                                    │
│  ✓ Get associated promotion                                    │
│  ✓ Check promotion.status = 'active'                           │
│  ✓ Validate start_date <= now <= end_date                      │
│  ✓ Check redemption_count < usage_limit                        │
│  ✓ Verify user ownership (if applicable)                       │
│                                                                 │
│  RESULTS:                                                       │
│  ├─ EXPIRED/CANCELLED/NOT_FOUND                                │
│  │  → ❌ BLOCK PAYMENT (400)                                   │
│  │  → Error: "PROMOTION_EXPIRED_OR_INVALID"                    │
│  │  → Action: "remove_this_coupon_and_reapply_valid_coupon"    │
│  │                                                              │
│  ├─ LIMIT REACHED                                              │
│  │  → ⚠️ CONTINUE WITHOUT THIS PROMOTION                       │
│  │  → User informed: "apply_another_coupon"                    │
│  │  → Added to limit_reached_evaluations[]                     │
│  │  → Removed from valid_evaluations[]                         │
│  │                                                              │
│  └─ VALID                                                       │
│     → ✅ Added to valid_evaluations[]                          │
│     → Will be redeemed after payment                           │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2A: Product Validation                                    │
│  ────────────────────────────────────────────────────────────   │
│  FOR EACH product in order:                                     │
│                                                                 │
│  ✓ Find product by productid                                   │
│  ✓ Get product.availablequantity                               │
│  ✓ Compare: availablequantity >= order quantity                │
│                                                                 │
│  RESULTS:                                                       │
│  ├─ PRODUCT NOT FOUND                                          │
│  │  → ❌ BLOCK PAYMENT (400)                                   │
│  │  → Error: "PRODUCT_NOT_FOUND"                               │
│  │                                                              │
│  ├─ INSUFFICIENT QUANTITY                                      │
│  │  → ❌ BLOCK PAYMENT (400)                                   │
│  │  → Error: "INSUFFICIENT_PRODUCT_QUANTITY"                   │
│  │  → Details: Available vs Requested, Shortage                │
│  │                                                              │
│  └─ SUFFICIENT QUANTITY                                        │
│     → ✅ Continue to platformstock check                       │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2B: PlatformStock Validation                              │
│  ────────────────────────────────────────────────────────────   │
│  FOR EACH product in order:                                     │
│                                                                 │
│  ✓ Find platformstock by (productid, 'nivapp')                 │
│  ✓ Get availableqty, lockqty                                   │
│  ✓ Calculate: actualAvailable = availableqty - lockqty         │
│  ✓ Compare: actualAvailable >= order quantity                  │
│                                                                 │
│  RESULTS:                                                       │
│  ├─ PLATFORMSTOCK NOT FOUND                                    │
│  │  → ❌ BLOCK PAYMENT (400)                                   │
│  │  → Error: "PLATFORMSTOCK_NOT_FOUND"                         │
│  │                                                              │
│  ├─ INSUFFICIENT PLATFORMSTOCK                                 │
│  │  → ❌ BLOCK PAYMENT (400)                                   │
│  │  → Error: "INSUFFICIENT_PLATFORMSTOCK"                      │
│  │  → Details: Available, Locked, Requested, Shortage          │
│  │                                                              │
│  └─ SUFFICIENT PLATFORMSTOCK                                   │
│     → ✅ Product fully validated                               │
└─────────────────────────────────────────────────────────────────┘
    ↓
    [All Validations Pass?]
    ↓ YES
    ✅ Initiate Payment
    - PhonePe: Redirect to gateway
    - COD: Create order immediately
```

---

## Update Flow (After Payment)

### Complete Flow Diagram

```
Payment Success Callback Received
    ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Create Order & Orderlines                             │
│  ────────────────────────────────────────────────────────────   │
│  - Validate products exist                                      │
│  - Create order record with promotion data                      │
│  - Create orderlines (automatic) with:                          │
│    • evaluation_id                                              │
│    • original_price                                             │
│    • product_discount_amount                                    │
│    • promotion_discount_amount                                  │
│    • productamount                                              │
│    • discountamount                                             │
│    • orderamount                                                │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Redeem Promotions                                      │
│  ────────────────────────────────────────────────────────────   │
│  FOR EACH valid evaluation_id:                                  │
│                                                                 │
│  UPDATE promotion_evaluations:                                  │
│  {                                                              │
│    redeemed: true,                                              │
│    redemption_count: current + 1,                               │
│    order_id: order.id,                                          │
│    redeemed_at: new Date(),                                     │
│    status: 'redeemed'                                           │
│  }                                                              │
│                                                                 │
│  CREATE promotion_redemptions:                                  │
│  {                                                              │
│    evaluation_id,                                               │
│    order_id,                                                    │
│    user_id,                                                     │
│    promotion_id,                                                │
│    discount_amount,                                             │
│    redeemed_at: new Date(),                                     │
│    status: 'completed'                                          │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Update PlatformStock (nivapp)                          │
│  ────────────────────────────────────────────────────────────   │
│  FOR EACH product in order:                                     │
│                                                                 │
│  GET current platformstock:                                     │
│  {                                                              │
│    availableqty: A,                                             │
│    lockqty: L,                                                  │
│    orderedqty: O                                                │
│  }                                                              │
│                                                                 │
│  VALIDATE (should always pass - validated before payment):      │
│  actualAvailable = A - L                                        │
│  if (actualAvailable < requestedQty) → Error (critical!)        │
│                                                                 │
│  UPDATE platformstock:                                          │
│  {                                                              │
│    availableqty: A - requestedQty,                              │
│    lockqty: L + requestedQty,                                   │
│    orderedqty: O + requestedQty,                                │
│    platformstatus: calculate_status(new_availableqty),          │
│    modifieddate: now()                                          │
│  }                                                              │
│                                                                 │
│  Example:                                                       │
│  Before: {availableqty: 100, lockqty: 20, orderedqty: 30}      │
│  Order:  5 items                                                │
│  After:  {availableqty: 95, lockqty: 25, orderedqty: 35}       │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Update Product (Overall)                              │
│  ────────────────────────────────────────────────────────────   │
│  FOR EACH product in order:                                     │
│                                                                 │
│  GET current product:                                           │
│  {                                                              │
│    orderedquantity: O,                                          │
│    availablequantity: A                                         │
│  }                                                              │
│                                                                 │
│  UPDATE product:                                                │
│  {                                                              │
│    orderedquantity: O + requestedQty,                           │
│    availablequantity: A - requestedQty,                         │
│    productstatus: calculate_status(new_availablequantity),      │
│    modifieddate: now()                                          │
│  }                                                              │
│                                                                 │
│  Example:                                                       │
│  Before: {orderedquantity: 50, availablequantity: 200}         │
│  Order:  5 items                                                │
│  After:  {orderedquantity: 55, availablequantity: 195}         │
└─────────────────────────────────────────────────────────────────┘
    ↓
    ✅ All Updates Complete!
    ✅ Redirect user to success page
```

---

## API Endpoint Details

### POST `/v1/phonepe/initiate`

**Description**: Initiate payment with PhonePe or create COD order

**Request Body**:
```json
{
  "mode": "phonepe" | "cod",
  "evaluation_ids": ["EVAL_001", "EVAL_002"],  // Optional
  "order": [
    {
      "productid": 123,
      "quantity": 5,
      "productname": "Product A",
      "addressid": 1,
      "cartId": 1,
      "discountamount": 50,
      "orderamount": 450,
      "productamount": 500,
      "productcategory": "Category A",
      "userid": 1
    }
  ],
  "transaction": {
    "amount": 450,
    "mobilenumber": "9876543210",
    "name": "John Doe",
    "productid": [123],
    "transactionfor": "product_purchase",
    "userId": 1
  }
}
```

**Validation Process**:
1. Validate promotions (if provided)
2. Validate products exist and have sufficient quantity
3. Validate platformstock exists and has sufficient quantity

**Success Response** (200):
```json
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "merchantTransactionId": "TXN_1728393847219_ABC123",
    "redirectUrl": "https://mercury.phonepe.com/...",
    "amount": 450,
    "status": "INITIATED",
    "mode": "phonepe",
    "message": "Redirect to PhonePe for payment",
    "promotion_status": {
      "valid_evaluations": ["EVAL_001"],
      "limit_reached_evaluations": [],
      "action_required": null,
      "invalid_evaluations": [],
      "total_applied": 1,
      "total_attempted": 1
    }
  }
}
```

**Success with Limit-Reached Promotion** (200):
```json
{
  "success": true,
  "message": "Payment initiated successfully (1 promotion(s) reached usage limit and were not applied)",
  "data": {
    "merchantTransactionId": "TXN_...",
    "redirectUrl": "https://mercury.phonepe.com/...",
    "promotion_status": {
      "valid_evaluations": ["EVAL_002"],
      "limit_reached_evaluations": [
        {
          "evaluation_id": "EVAL_001",
          "reason": "Usage limit reached",
          "status": "limit_reached"
        }
      ],
      "action_required": "apply_another_coupon",
      "total_applied": 1,
      "total_attempted": 2
    },
    "message": "... Note: 1 promotion(s) reached usage limit. Please apply another coupon for discount."
  }
}
```

---

## Error Responses

### 1. Promotion Expired/Invalid

**Status**: 400 Bad Request

```json
{
  "success": false,
  "message": "Promotion validation failed: Promotion has expired",
  "error_code": "PROMOTION_EXPIRED_OR_INVALID",
  "evaluation_id": "EVAL_EXPIRED",
  "reason": "Promotion has expired",
  "action_required": "remove_this_coupon_and_reapply_valid_coupon",
  "invalid_evaluations": [
    {
      "evaluation_id": "EVAL_EXPIRED",
      "reason": "Promotion has expired",
      "status": "expired_or_invalid"
    }
  ],
  "statusCode": 400
}
```

**User Action**: Remove expired coupon and try again

---

### 2. Product Not Found

**Status**: 400 Bad Request

```json
{
  "success": false,
  "message": "Cannot process payment. 1 product(s) have validation issues",
  "error_code": "PRODUCT_VALIDATION_FAILED",
  "platform": "nivapp",
  "validation_errors": [
    {
      "productid": 999,
      "productname": "Unknown Product",
      "quantity": 5,
      "error": "Product not found in database",
      "error_code": "PRODUCT_NOT_FOUND"
    }
  ],
  "action_required": "remove_out_of_stock_items_or_reduce_quantity",
  "statusCode": 400
}
```

**User Action**: Remove invalid product from cart

---

### 3. Insufficient Product Quantity

**Status**: 400 Bad Request

```json
{
  "success": false,
  "message": "Cannot process payment. 1 product(s) have validation issues",
  "error_code": "PRODUCT_VALIDATION_FAILED",
  "platform": "nivapp",
  "validation_errors": [
    {
      "productid": 123,
      "productname": "Product A",
      "puc": "PUC123",
      "quantity": 50,
      "available": 30,
      "shortage": 20,
      "error": "Insufficient overall product quantity. Available: 30, Requested: 50",
      "error_code": "INSUFFICIENT_PRODUCT_QUANTITY"
    }
  ],
  "action_required": "remove_out_of_stock_items_or_reduce_quantity",
  "statusCode": 400
}
```

**User Action**: Reduce quantity to 30 or less

---

### 4. PlatformStock Not Found

**Status**: 400 Bad Request

```json
{
  "success": false,
  "message": "Cannot process payment. 1 product(s) have validation issues",
  "error_code": "PRODUCT_VALIDATION_FAILED",
  "platform": "nivapp",
  "validation_errors": [
    {
      "productid": 123,
      "productname": "Product A",
      "puc": "PUC123",
      "quantity": 5,
      "error": "PlatformStock record not found for product on nivapp platform",
      "error_code": "PLATFORMSTOCK_NOT_FOUND"
    }
  ],
  "action_required": "remove_out_of_stock_items_or_reduce_quantity",
  "statusCode": 400
}
```

**User Action**: Contact admin or choose different product

---

### 5. Insufficient PlatformStock

**Status**: 400 Bad Request

```json
{
  "success": false,
  "message": "Cannot process payment. 1 product(s) have validation issues",
  "error_code": "PRODUCT_VALIDATION_FAILED",
  "platform": "nivapp",
  "validation_errors": [
    {
      "productid": 123,
      "productname": "Product A",
      "puc": "PUC123",
      "quantity": 50,
      "available": 2,
      "availableqty": 100,
      "lockqty": 98,
      "shortage": 48,
      "error": "Insufficient stock on nivapp. Available: 2 (Total: 100, Locked: 98), Requested: 50",
      "error_code": "INSUFFICIENT_PLATFORMSTOCK"
    }
  ],
  "action_required": "remove_out_of_stock_items_or_reduce_quantity",
  "statusCode": 400
}
```

**User Action**: Reduce quantity to 2 or less, or wait for stock

---

## Success Responses

### POST `/v1/phonepe/callback/:transactionId`

**Description**: PhonePe callback after payment completion

**Success Response** (302 Redirect):
- Redirects to success page after updating all entities
- All promotions redeemed
- All platformstock updated
- All product quantities updated

**Response Flow**:
1. Check payment status with PhonePe
2. Update transaction status
3. Create order and orderlines
4. Redeem promotions
5. Update platformstock quantities
6. Update product quantities
7. Redirect to success page

---

## Database Schema

### Table: `promotion_evaluations`

```sql
CREATE TABLE promotion_evaluations (
  evaluation_id VARCHAR(255) PRIMARY KEY,
  promotion_id BIGINT,
  user_id BIGINT,
  cart_data JSON,
  original_total DECIMAL,
  discounted_total DECIMAL,
  applied_promotions JSON,
  redeemed BOOLEAN DEFAULT false,
  redemption_count INT DEFAULT 0,
  order_id BIGINT,
  redeemed_at TIMESTAMP,
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

### Table: `platformstock`

```sql
CREATE TABLE platformstock (
  id BIGSERIAL PRIMARY KEY,
  productid BIGINT NOT NULL,
  platform VARCHAR(100) NOT NULL,
  availableqty INT DEFAULT 0,
  lockqty INT DEFAULT 0,
  orderedqty INT DEFAULT 0,
  soldqty INT DEFAULT 0,
  totalqty INT DEFAULT 0,
  platformstatus VARCHAR(255),
  createddate BIGINT,
  modifieddate BIGINT,
  UNIQUE(productid, platform)
);
```

**Key Fields**:
- `availableqty`: Total available for this platform
- `lockqty`: Quantity locked in carts (nivapp only)
- `orderedqty`: Quantity ordered but not yet dispatched
- `platformstatus`: 'in_stock', 'low_stock', 'out_of_stock'

---

### Table: `product`

```sql
CREATE TABLE product (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(500),
  puc VARCHAR(255) UNIQUE,
  availablequantity INT,
  orderedquantity INT,
  soldquantity INT,
  quantity INT,
  ecompublishedquantity INT,
  productstatus VARCHAR(255),
  createddate BIGINT,
  modifieddate BIGINT
  -- ... other fields
);
```

---

## Code Implementation

### File Structure

```
src/
├── controllers/
│   └── phonepe.controller.ts       # Main implementation
├── services/
│   ├── phonepe.service.ts          # PhonePe API integration
│   ├── promotion-evaluation.service.ts
│   ├── promotion-redemption.service.ts
│   └── transaction.service.ts
└── routes/
    └── phonepe.route.ts            # API routes
```

---

### Key Methods

#### 1. `initiatePayment` (Lines 25-640)

**Responsibilities**:
- Validate promotions
- Validate products
- Validate platformstock
- Initiate PhonePe payment or create COD order

**Code Location**: `src/controllers/phonepe.controller.ts`

---

#### 2. `createOrderAfterPayment` (Lines 1170-1660)

**Responsibilities**:
- Create order record
- Create orderlines
- Redeem valid promotions
- Link evaluation data to order

**Code Location**: `src/controllers/phonepe.controller.ts`

---

#### 3. `updateProductQuantitiesAfterOrder` (Lines 2090-2549)

**Responsibilities**:
- Update platformstock quantities
- Update product quantities
- Update status fields
- Verify updates

**Code Location**: `src/controllers/phonepe.controller.ts`

---

## Testing Scenarios

### Scenario 1: All Validations Pass ✅

**Input**:
```json
{
  "mode": "phonepe",
  "evaluation_ids": ["EVAL_001"],
  "order": [{
    "productid": 123,
    "quantity": 5
  }]
}
```

**Validation Results**:
- Promotion EVAL_001: Valid (5/10 usage)
- Product 123: Available (200 units)
- PlatformStock: Available (80 units actual)

**Outcome**: ✅ Payment proceeds

---

### Scenario 2: Promotion Limit Reached ⚠️

**Input**:
```json
{
  "evaluation_ids": ["EVAL_001", "EVAL_002"]
}
```

**Validation Results**:
- EVAL_001: Limit reached (10/10)
- EVAL_002: Valid (3/10)

**Outcome**: ⚠️ Continues with EVAL_002 only, user informed

---

### Scenario 3: Product Insufficient ❌

**Input**:
```json
{
  "order": [{
    "productid": 123,
    "quantity": 50
  }]
}
```

**Validation Results**:
- Product 123 has only 30 units available

**Outcome**: ❌ Payment blocked

---

### Scenario 4: PlatformStock Insufficient ❌

**Input**:
```json
{
  "order": [{
    "productid": 123,
    "quantity": 50
  }]
}
```

**Validation Results**:
- Product: 200 units available ✓
- PlatformStock: Only 2 units actual (100 total, 98 locked) ✗

**Outcome**: ❌ Payment blocked

---

### Scenario 5: Multiple Products Mixed Results ❌

**Input**:
```json
{
  "order": [
    {"productid": 101, "quantity": 5},  // Valid
    {"productid": 102, "quantity": 50}, // Insufficient
    {"productid": 103, "quantity": 1}   // Valid
  ]
}
```

**Validation Results**:
- Product 101: Valid
- Product 102: Insufficient (only 30 available)
- Product 103: Valid

**Outcome**: ❌ Payment blocked (all products must pass)

---

## Troubleshooting

### Issue 1: "PlatformStock not found"

**Symptom**: Error code `PLATFORMSTOCK_NOT_FOUND`

**Cause**: Product doesn't have platformstock record for nivapp

**Solution**:
```sql
-- Create platformstock record
INSERT INTO platformstock (
  productid, platform, availableqty, orderedqty, 
  soldqty, totalqty, lockqty, platformstatus,
  createddate, modifieddate
)
VALUES (
  123, 'nivapp', 100, 0, 0, 100, 0, 'in_stock',
  EXTRACT(EPOCH FROM NOW()) * 1000,
  EXTRACT(EPOCH FROM NOW()) * 1000
);
```

---

### Issue 2: "Insufficient platformstock" despite having product stock

**Symptom**: Error shows `available: 2` but product has 200 units

**Cause**: High `lockqty` (items locked in other carts)

**Solution**:
- Review and clean up abandoned carts
- Adjust `lockqty` if necessary
- Increase `availableqty` for nivapp platform

```sql
-- Check current state
SELECT productid, platform, availableqty, lockqty, 
       (availableqty - lockqty) as actual_available
FROM platformstock
WHERE productid = 123 AND platform = 'nivapp';

-- Reduce lockqty if carts are abandoned
UPDATE platformstock
SET lockqty = 0,
    modifieddate = EXTRACT(EPOCH FROM NOW()) * 1000
WHERE productid = 123 AND platform = 'nivapp';
```

---

### Issue 3: Promotion limit reached but user wants to use it

**Symptom**: User informed "usage limit reached"

**Cause**: Promotion has been used maximum allowed times

**Solution**: User must:
1. Apply a different coupon code
2. OR wait for admin to increase usage limit
3. OR use a different promotion

**Not a bug** - This is expected behavior

---

### Issue 4: Payment succeeded but quantities not updated

**Symptom**: Order created but stock quantities unchanged

**Cause**: Quantity update failed in callback

**Solution**:
```bash
# Use manual quantity update endpoint
POST /v1/phonepe/orders/:orderId/update-quantities

# Check logs for specific error
grep "Error updating product quantities" server.log
```

---

## Summary Table

### Before Payment Validations

| # | Validation | Checks | Blocks Payment? |
|---|-----------|--------|-----------------|
| 1 | Promotion exists | promotion_evaluation & promotion found | Yes (if not found) |
| 2 | Promotion active | status = 'active' | Yes |
| 3 | Promotion not expired | start_date <= now <= end_date | Yes |
| 4 | Promotion limit | redemption_count < usage_limit | No (informs user) |
| 5 | Product exists | Product record found | Yes |
| 6 | Product quantity | availablequantity >= order qty | Yes |
| 7 | PlatformStock exists | Record for (productid, nivapp) | Yes |
| 8 | PlatformStock quantity | (availableqty - lockqty) >= order qty | Yes |

---

### After Payment Updates

| # | Entity | Fields Updated |
|---|--------|----------------|
| 1 | **promotion_evaluations** | redeemed, redemption_count, order_id, redeemed_at, status |
| 2 | **promotion_redemptions** | New record created with full details |
| 3 | **platformstock** | availableqty-=, lockqty+=, orderedqty+=, platformstatus, modifieddate |
| 4 | **product** | orderedquantity+=, availablequantity-=, productstatus, modifieddate |

---

### User Actions Based on Errors

| Error Code | User Action Required |
|-----------|----------------------|
| `PROMOTION_EXPIRED_OR_INVALID` | Remove expired coupon, apply valid one |
| `PROMOTION_LIMIT_REACHED` | Apply different coupon code |
| `PRODUCT_NOT_FOUND` | Remove invalid product |
| `INSUFFICIENT_PRODUCT_QUANTITY` | Reduce quantity or remove item |
| `PLATFORMSTOCK_NOT_FOUND` | Contact support or choose different product |
| `INSUFFICIENT_PLATFORMSTOCK` | Reduce quantity or wait for restock |

---

## Quick Reference

### Validation Sequence
```
1. Promotions → 2. Products → 3. PlatformStock → 4. Payment
```

### Update Sequence
```
Payment Success → 1. Order → 2. Promotions → 3. PlatformStock → 4. Product
```

### Status Calculation
```javascript
if (availableQty <= 0) return "out_of_stock";
if (availableQty >= 1 && availableQty <= 5) return "low_stock";
return "in_stock";
```

---

## Configuration

### Environment Variables

```env
# PhonePe API
PHONEPE_MERCHANT_ID=PGTESTPAYUAT86
PHONEPE_SALT_KEY=96434309-7796-489d-8924-ab56988a6076
PHONEPE_BASE_URL=https://api-preprod.phonepe.com/apis/pg-sandbox

# Redirect URLs
REDIRECT_URL_SUCCESS=http://localhost:5600/payment/success
REDIRECT_URL_FAILURE=http://localhost:5600/payment/failure
REDIRECT_URL_PAYMENT_STATUS=http://localhost:5600
```

---

## Migration Required

Before deploying, ensure all products have platformstock records:

```sql
-- Create missing platformstock records
INSERT INTO platformstock (
  productid, platform, availableqty, orderedqty,
  soldqty, totalqty, lockqty, platformstatus,
  createddate, modifieddate
)
SELECT 
  p.id,
  'nivapp',
  COALESCE(p.availablequantity, 0),
  COALESCE(p.orderedquantity, 0),
  COALESCE(p.soldquantity, 0),
  COALESCE(p.quantity, 0),
  0,
  CASE 
    WHEN COALESCE(p.availablequantity, 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(p.availablequantity, 0) BETWEEN 1 AND 5 THEN 'low_stock'
    ELSE 'in_stock'
  END,
  EXTRACT(EPOCH FROM NOW()) * 1000,
  EXTRACT(EPOCH FROM NOW()) * 1000
FROM product p
WHERE NOT EXISTS (
  SELECT 1 FROM platformstock ps 
  WHERE ps.productid = p.id AND ps.platform = 'nivapp'
);
```

---

**✅ END OF DOCUMENTATION**

**Version**: 2.0  
**Status**: Production Ready  
**Platform**: nivapp  
**Last Updated**: October 8, 2025

