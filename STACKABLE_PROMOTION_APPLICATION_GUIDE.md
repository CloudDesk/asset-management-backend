# Stackable Promotion Application - Robust Solution Guide

## Overview

This guide explains how to apply stackable promotions using the enhanced `/v1/promotions/evaluate` route with the new `application_type` parameter. This approach provides a unified interface for different promotion application scenarios.

## Promotion Stacking Rules

### **Allowed Stacking Combinations**:
✅ **Primary Discount + Stackable Benefits**:
- ✅ One main discount (10% OR 5%, not both)
- ✅ + Free Shipping (stackable,auto)
- ✅ + BOGO offers (stackable)  
- ✅ + Free Products/Gifts (stackable)

### **Not Allowed**:
❌ **Multiple Percentage/Fixed Discounts**:
- ❌ 10% + 5% (conflicting discounts)
- ❌ ₹100 off + ₹50 off (conflicting discounts)

## Enhanced Route: `/v1/promotions/evaluate`

### **New Parameter**: `application_type`

```typescript
application_type: 'manual_coupon' | 'stackable_promotion' | 'preview_only'
```

## Frontend Scenarios & Application Types

| Frontend Action | Route | application_type | Database Impact | Purpose | Real Example |
|----------------|-------|------------------|-----------------|---------|--------------|
| **Select 10% discount promotion** | `/evaluate` | `manual_coupon` | ✅ Updates evaluation | Apply exclusive discount | User clicks "Apply 10% OFF" button |
| **Enter "SAVE20" coupon code** | `/evaluate` | `manual_coupon` | ✅ Updates evaluation | Apply coupon by code | User types code in input field |
| **Add stackable gift/BOGO** | `/evaluate` | `stackable_promotion` | ✅ Updates evaluation | Add additional benefit | User clicks "Add Free Gift" |
| **Preview promotion hover** | `/evaluate` | `preview_only` | ❌ No changes | Show potential savings | User hovers over promotion |
| **Admin testing** | `/evaluate` | `preview_only` | ❌ No changes | Test promotion logic | Admin tests promotion setup |
| **Auto-apply on page load** | `/evaluate/automatic` | N/A | ✅ Creates evaluation | Base evaluation setup | Cart page loads |

## Use Cases & Example Payloads

### **1. Apply Discount Promotion by ID (10% or 5% OFF)**

**Frontend Scenario**: User clicks "Apply" button on a discount promotion from offers list

```json
POST /v1/promotions/evaluate
{
  "application_type": "manual_coupon",
  "evaluation_id": "eval_1758170159519_tj1dntvfd",
  "promotion_id": 56,
  "cart_items": [
    {
      "cart_record_id": "7",
      "product_id": "7", 
      "quantity": 1,
      "base_price": 520,
      "product_discount": 12,
      "price": 508,
      "category": "wellness",
      "subcategory": "essential-oils",
      "name": "Aravi Organic Pure Peppermint Essential Oil"
    }
  ]
}
```

**Expected Behavior**:
- ✅ Replaces any existing manual discount (10% OR 5%, not both)
- ✅ Keeps auto-applied promotions (Free Shipping)
- ✅ Updates `promotion_evaluations` record

---

### **2. Apply Coupon by Code (User Types Code)**

**Frontend Scenario**: User enters "SAVE20" in coupon code input field

```json
POST /v1/promotions/evaluate
{
  "application_type": "manual_coupon",
  "evaluation_id": "eval_1758170159519_tj1dntvfd",
  "code": "SAVE20",
  "cart_items": [
    {
      "cart_record_id": "7",
      "product_id": "7",
      "quantity": 1, 
      "base_price": 520,
      "product_discount": 12,
      "price": 508,
      "category": "wellness",
      "subcategory": "essential-oils",
      "name": "Aravi Organic Pure Peppermint Essential Oil"
    }
  ]
}
```

**Expected Behavior**:
- ✅ Backend finds promotion by code
- ✅ Replaces any existing manual discount
- ✅ Updates `promotion_evaluations` record

---

### **3. Add Stackable Promotion (Free Gift, BOGO)**

**Frontend Scenario**: User clicks "Add" button on stackable promotion (Gift Badge, BOGO offer)

```json
POST /v1/promotions/evaluate
{
  "application_type": "stackable_promotion",
  "evaluation_id": "eval_1758170159519_tj1dntvfd", 
  "promotion_id": 86,
  "cart_items": [
    {
      "cart_record_id": "7",
      "product_id": "7",
      "quantity": 1,
      "base_price": 520,
      "product_discount": 12,
      "price": 508,
      "category": "wellness",
      "subcategory": "essential-oils",
      "name": "Aravi Organic Pure Peppermint Essential Oil"
    }
  ]
}
```

**Expected Behavior**:
- ✅ Adds to existing promotions (doesn't replace)
- ✅ Validates stacking rules (Free Product + Discount = OK)
- ✅ Updates `promotion_evaluations` record

---

### **4. Preview Promotion (Optional - for UI Enhancement)**

**Frontend Scenario**: User hovers over promotion to see potential savings

```json
POST /v1/promotions/evaluate  
{
  "application_type": "preview_only",
  "user_id": "24",
  "promotion_id": 64,
  "cart_items": [
    {
      "cart_record_id": "7",
      "product_id": "7",
      "quantity": 1,
      "base_price": 520, 
      "product_discount": 12,
      "price": 508,
      "category": "wellness",
      "subcategory": "essential-oils",
      "name": "Aravi Organic Pure Peppermint Essential Oil"
    }
  ],
  "context": {
    "channel": "mobile_app",
    "geo": "IN"
  }
}
```

**Expected Behavior**:
- ✅ Calculates potential discount for preview
- ❌ Does NOT update `promotion_evaluations` record
- ✅ Returns calculation results only

## Real-World Complete Example

### **User Journey**: Customer buys wellness products and applies multiple promotions

#### **Initial State**: Cart with ₹508 wellness product

#### **Step 1: Page Load (Auto-Apply)**
```javascript
// Frontend calls automatic evaluation
POST /v1/promotions/evaluate/automatic
{
  "user_id": "24",
  "cart_items": [{"product_id": "7", "price": 508, "category": "wellness", ...}],
  "context": {"channel": "mobile_app", "geo": "IN"}
}

// Response:
{
  "evaluation_id": "eval_1758170159519_tj1dntvfd",
  "applied_promotions": [
    {
      "promotion_id": 58,
      "promotion_name": "Free Shipping Over ₹500",
      "is_auto": true,
      "discount_amount": 0
    }
  ]
}
```

#### **Step 2: Show Available Offers**
```javascript
POST /v1/promotions/offers
{
  "userId": "24",
  "cartItems": [{"productId": "7", "price": 508, "category": "wellness", ...}],
  "mode": "phonepe"
}

// Response:
{
  "bestCoupon": {"name": "20% OFF on Wellness Products", "promotion_id": 56},
  "eligibleCoupons": [
    {"name": "20% OFF on Wellness Products", "promotion_id": 56},
    {"name": "Flash Sale - 25% OFF Everything", "promotion_id": 64}
  ],
  "stackablePromotions": [
    {"name": "Gift Badge", "promotion_id": 86, "type": "FREE_PRODUCT"}
  ],
  "autoAppliedPromotions": [
    {"name": "Free Shipping Over ₹500", "promotion_id": 58}
  ]
}
```

#### **Step 3: Apply Manual Discount (20% OFF)**
```javascript
// User clicks "Apply 20% OFF"
POST /v1/promotions/evaluate
{
  "application_type": "manual_coupon",
  "evaluation_id": "eval_1758170159519_tj1dntvfd",
  "promotion_id": 56,
  "cart_items": [{"product_id": "7", "price": 508, ...}]
}

// Response:
{
  "evaluation_id": "eval_1758170159519_tj1dntvfd",
  "applied_promotions": [
    {"promotion_id": 58, "promotion_name": "Free Shipping", "is_auto": true},
    {"promotion_id": 56, "promotion_name": "20% OFF Wellness", "is_auto": false, "discount_amount": 101.6}
  ],
  "total_discount": 101.6,
  "discounted_total": 406.4
}
```

#### **Step 4: Add Stackable Gift**
```javascript
// User clicks "Add Free Gift"
POST /v1/promotions/evaluate
{
  "application_type": "stackable_promotion",
  "evaluation_id": "eval_1758170159519_tj1dntvfd",
  "promotion_id": 86,
  "cart_items": [{"product_id": "7", "price": 508, ...}]
}

// Response:
{
  "evaluation_id": "eval_1758170159519_tj1dntvfd",
  "applied_promotions": [
    {"promotion_id": 58, "promotion_name": "Free Shipping", "is_auto": true},
    {"promotion_id": 56, "promotion_name": "20% OFF Wellness", "is_auto": false, "discount_amount": 101.6},
    {"promotion_id": 86, "promotion_name": "Gift Badge", "is_auto": false, "discount_amount": 0}
  ],
  "total_discount": 101.6,  // Still same - gifts don't reduce cart total
  "discounted_total": 406.4
}
```

#### **Final Cart State**:
- ✅ **Original Total**: ₹508
- ✅ **Discount Applied**: ₹101.6 (20% OFF)
- ✅ **Final Amount**: ₹406.4
- ✅ **Free Benefits**: Free Shipping + Free Gift Badge
- ✅ **Promotions Applied**: 3 total (1 auto + 1 manual + 1 stackable)

## Frontend Flow Examples

### **Complete User Journey**:

#### **Step 1: Cart Page Load**
```javascript
// Auto-evaluation for cart
const autoEvalResponse = await fetch('/v1/promotions/evaluate/automatic', {
  method: 'POST',
  body: JSON.stringify({
    user_id: "24",
    cart_items: cartItems,
    context: { channel: "mobile_app", geo: "IN" }
  })
});
// Returns: evaluation_id, applied_promotions (auto-applied)
```

#### **Step 2: Show Available Offers**
```javascript
// Get available promotions
const offersResponse = await fetch('/v1/promotions/offers', {
  method: 'POST', 
  body: JSON.stringify({
    userId: "24",
    cartItems: cartItems,
    mode: "phonepe"
  })
});

// Returns:
// - bestCoupon: Best manual discount option
// - eligibleCoupons: All manual discount options  
// - stackablePromotions: Free gifts, BOGO, etc.
// - autoAppliedPromotions: Already applied (Free Shipping)
```

#### **Step 3A: Apply Manual Coupon (Exclusive)**
```javascript
// User clicks "Apply" on 20% OFF coupon
const couponResponse = await fetch('/v1/promotions/evaluate', {
  method: 'POST',
  body: JSON.stringify({
    application_type: "manual_coupon",
    evaluation_id: currentEvaluationId,
    promotion_id: 56, // 20% OFF Wellness
    cart_items: cartItems
  })
});
// Replaces any existing manual discount
```

#### **Step 3B: Add Stackable Promotion (Additional)**
```javascript  
// User clicks "Add" on Free Gift Badge
const stackableResponse = await fetch('/v1/promotions/evaluate', {
  method: 'POST',
  body: JSON.stringify({
    application_type: "stackable_promotion", 
    evaluation_id: currentEvaluationId,
    promotion_id: 86, // Gift Badge
    cart_items: cartItems
  })
});
// Adds to existing promotions without replacing
```

## Service Layer Logic

### **Enhanced Controller Logic**:

```typescript
// src/controllers/promotion-evaluation.controller.ts
evaluatePromotion = async (request, reply) => {
  const { application_type, evaluation_id, promotion_id, user_id, cart_items, context } = request.body;

  switch (application_type) {
    case 'manual_coupon':
      // Apply exclusive manual coupon (replaces existing manual discounts)
      return await this.evaluationService.applyManualCoupon({
        evaluation_id,
        promotion_id, 
        cart_items,
        replace_existing: true  // Replace existing manual coupons
      });

    case 'stackable_promotion':
      // Add stackable promotion (keeps existing promotions)
      return await this.evaluationService.addStackablePromotion({
        evaluation_id,
        promotion_id,
        cart_items,
        validate_stacking: true  // Ensure stacking rules are followed
      });

    case 'new_evaluation':
      // Create new standalone evaluation
      return await this.evaluationService.evaluateSpecificPromotion({
        user_id,
        promotion_id,
        cart_items,
        context
      });
  }
};
```

## Stacking Business Rules

### **Rule Engine**:

```typescript
// Stacking validation logic
const validateStackingRules = (existingPromotions: any[], newPromotion: any): boolean => {
  const existingTypes = existingPromotions.map(p => p.promotion_type);
  const newType = newPromotion.type;

  // Rule 1: Only one percentage/fixed discount allowed
  const discountTypes = ['PERCENT_OFF_CART', 'PERCENT_OFF_ITEM', 'FIXED_AMOUNT_OFF_CART', 'FIXED_AMOUNT_OFF_ITEM'];
  const hasExistingDiscount = existingTypes.some(type => discountTypes.includes(type));
  const isNewDiscount = discountTypes.includes(newType);

  if (hasExistingDiscount && isNewDiscount) {
    return false; // ❌ Cannot stack multiple discounts
  }

  // Rule 2: Allow multiple stackable benefits
  const stackableTypes = ['FREE_SHIPPING', 'FREE_PRODUCT', 'BOGO'];
  if (stackableTypes.includes(newType)) {
    return true; // ✅ Always allow stackable benefits
  }

  return true;
};
```

## Example Response Structures

### **After Manual Coupon Application**:
```json
{
  "success": true,
  "data": {
    "evaluation_id": "eval_1758104355764_rj0mezyn3",
    "applied_promotions": [
      {
        "promotion_id": 58,
        "promotion_name": "Free Shipping Over ₹500", 
        "promotion_type": "FREE_SHIPPING",
        "is_auto": true,
        "discount_amount": 0
      },
      {
        "promotion_id": 56,
        "promotion_name": "20% OFF on Wellness Products",
        "promotion_type": "PERCENT_OFF_ITEM", 
        "is_auto": false,
        "discount_amount": 101.6
      }
    ],
    "total_discount": 101.6,
    "discounted_total": 406.4
  }
}
```

### **After Stackable Addition**:
```json
{
  "success": true,
  "data": {
    "evaluation_id": "eval_1758104355764_rj0mezyn3",
    "applied_promotions": [
      {
        "promotion_id": 58,
        "promotion_name": "Free Shipping Over ₹500",
        "promotion_type": "FREE_SHIPPING", 
        "is_auto": true,
        "discount_amount": 0
      },
      {
        "promotion_id": 56, 
        "promotion_name": "20% OFF on Wellness Products",
        "promotion_type": "PERCENT_OFF_ITEM",
        "is_auto": false,
        "discount_amount": 101.6
      },
      {
        "promotion_id": 86,
        "promotion_name": "Gift Badge",
        "promotion_type": "FREE_PRODUCT",
        "is_auto": false, 
        "discount_amount": 0,
        "free_product_details": {
          "product_id": "BADGE001",
          "estimated_value": 100
        }
      }
    ],
    "total_discount": 101.6,
    "discounted_total": 406.4
  }
}
```

## **Why This Solution is Robust**:

### ✅ **Single Endpoint**:
- One route handles all promotion applications
- Consistent error handling and validation
- Unified response structure

### ✅ **Clear Intent**:
- `application_type` makes the intent explicit
- Different validation rules per type
- Prevents accidental misuse

### ✅ **Business Rules Enforcement**:
- Validates stacking rules automatically
- Prevents conflicting discount applications
- Allows proper stackable combinations

### ✅ **Backward Compatibility**:
- Existing functionality unchanged
- Optional parameter (defaults to existing behavior)
- No breaking changes

This approach provides a **clean, extensible solution** for handling all promotion application scenarios through a single, well-defined interface! 🚀
