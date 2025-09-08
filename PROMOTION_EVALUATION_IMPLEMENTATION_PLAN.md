# 🎯 Promotion Evaluation System - Implementation Plan

## 📋 Overview

This document outlines the implementation of the **Promotion Evaluation System** for the e-commerce backend, enabling real-time promotion evaluation against cart data and atomic redemption after order placement.

---

## 🏗️ System Architecture

### **Flow Overview:**
1. **Deals Page** ✅ (Already implemented)
2. **Cart Page** → Apply promotion → Call `/evaluate` 
3. **Order Placement** → Call `/redeem` → Create redemption record

### **Key Components:**
- **Evaluation API**: Real-time promotion evaluation against cart
- **Redemption API**: Atomic redemption after successful order
- **Evaluation Service**: Business logic for promotion evaluation
- **Redemption Service**: Business logic for promotion redemption

---

## 🗄️ Database Schema (Already Implemented)

### **promotion_evaluations Table:**
```sql
- evaluation_id (VARCHAR(36) PRIMARY KEY)
- user_id (VARCHAR(255))
- cart_data (JSONB)
- original_total (DECIMAL(10,2))
- discounted_total (DECIMAL(10,2))
- applied_promotions (JSONB)
- ineligible_coupons (JSONB)
- context (JSONB)
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP)
- status (VARCHAR(50))
```

### **promotion_redemptions Table:**
```sql
- id (VARCHAR(36) PRIMARY KEY)
- evaluation_id (VARCHAR(36) FOREIGN KEY)
- order_id (VARCHAR(255))
- user_id (VARCHAR(255))
- promotion_id (INTEGER FOREIGN KEY)
- discount_amount (DECIMAL(10,2))
- redeemed_at (TIMESTAMP)
- redemption_data (JSONB)
```

---

## 🔧 Backend Implementation Plan

### **Phase 1: API Routes**
1. ✅ **POST `/v1/promotions/evaluate`** - Evaluate promotion against cart
2. ✅ **POST `/v1/promotions/redeem`** - Redeem promotion after order placement
3. ✅ **GET `/v1/promotions/evaluations/:id`** - Get evaluation details
4. ✅ **GET `/v1/promotions/redemptions/:orderId`** - Get redemptions for order

### **Phase 2: Services**
1. ✅ **PromotionEvaluationService** - Core evaluation logic
2. ✅ **PromotionRedemptionService** - Redemption management
3. ✅ **PromotionConditionEvaluator** - Condition evaluation engine
4. ✅ **PromotionDiscountCalculator** - Discount calculation engine

### **Phase 3: Controllers**
1. ✅ **PromotionEvaluationController** - Handle evaluation requests
2. ✅ **PromotionRedemptionController** - Handle redemption requests

---

## 📊 API Specifications

### **1. POST `/v1/promotions/evaluate`**

#### **Request Body:**
```json
{
  "cart_id": "string",
  "user_id": "string", // optional for guest users
  "promotion_id": "number",
  "cart_data": {
    "items": [
      {
        "product_id": "string",
        "quantity": "number",
        "price": "number",
        "category": "string"
      }
    ],
    "subtotal": "number",
    "shipping_cost": "number",
    "tax_amount": "number"
  },
  "context": {
    "channel": "web|mobile|mobile_app",
    "geo": "IN|US|UK",
    "payment_method": "credit_card|cash|upi"
  }
}
```

#### **Response:**
```json
{
  "success": true,
  "evaluation_id": "uuid",
  "original_total": "number",
  "discounted_total": "number",
  "total_discount": "number",
  "applied_promotions": [
    {
      "promotion_id": "number",
      "promotion_name": "string",
      "discount_amount": "number",
      "affected_items": ["product_id1", "product_id2"],
      "discount_breakdown": {
        "item_discounts": [
          {
            "product_id": "string",
            "original_price": "number",
            "discounted_price": "number",
            "discount_amount": "number"
          }
        ],
        "shipping_discount": "number",
        "cart_discount": "number"
      }
    }
  ],
  "ineligible_reasons": [
    {
      "promotion_id": "number",
      "reason": "Minimum spend not met",
      "required_value": "number",
      "current_value": "number"
    }
  ],
  "expires_at": "datetime"
}
```

### **2. POST `/v1/promotions/redeem`**

#### **Request Body:**
```json
{
  "evaluation_id": "uuid",
  "order_id": "string",
  "user_id": "string"
}
```

#### **Response:**
```json
{
  "success": true,
  "redemption_id": "uuid",
  "order_id": "string",
  "total_discount_applied": "number",
  "redemption_details": [
    {
      "promotion_id": "number",
      "discount_amount": "number",
      "redeemed_at": "datetime"
    }
  ]
}
```

---

## 🎯 Promotion Types & Logic

### **1. Cart-Level Discounts**
- **FIXED_AMOUNT_OFF_CART**: Fixed amount off total cart value
- **PERCENT_OFF_CART**: Percentage off total cart value
- **FREE_SHIPPING**: Free shipping on orders

### **2. Item-Level Discounts**
- **FIXED_AMOUNT_OFF_ITEM**: Fixed amount off specific items
- **PERCENT_OFF_ITEM**: Percentage off specific items
- **BOGO**: Buy One Get One Free
- **FREE_PRODUCT**: Free product with purchase

### **3. Condition Types**
- **cart.total_value**: Minimum/maximum cart value
- **cart.item_count**: Minimum/maximum item count
- **cart.category**: Specific category requirements
- **user.segment**: User segment targeting
- **user.created_date**: New user targeting
- **user.order_count**: Order history targeting

---

## 🔄 Evaluation Process

### **Step 1: Validation**
1. Check promotion exists and is active
2. Validate promotion is within date range
3. Check user eligibility (if user_id provided)
4. Verify promotion limits (max_redemptions, per_user_limit)

### **Step 2: Condition Evaluation**
1. Parse promotion conditions
2. Evaluate each condition against cart/user data
3. Determine if promotion is applicable

### **Step 3: Discount Calculation**
1. Calculate discount based on promotion type
2. Apply discount to appropriate items/cart
3. Calculate final totals

### **Step 4: Response Generation**
1. Create evaluation record
2. Generate detailed breakdown
3. Return evaluation result

---

## 🔒 Redemption Process

### **Step 1: Validation**
1. Verify evaluation is still valid
2. Check evaluation hasn't expired
3. Ensure evaluation hasn't been redeemed

### **Step 2: Redemption**
1. Create redemption record
2. Update promotion usage counters
3. Mark evaluation as redeemed

### **Step 3: Confirmation**
1. Return redemption confirmation
2. Provide redemption details

---

## 🚀 Implementation Steps

### **Step 1: Create Services**
- [ ] `PromotionEvaluationService`
- [ ] `PromotionRedemptionService`
- [ ] `PromotionConditionEvaluator`
- [ ] `PromotionDiscountCalculator`

### **Step 2: Create Controllers**
- [ ] `PromotionEvaluationController`
- [ ] `PromotionRedemptionController`

### **Step 3: Create Routes**
- [ ] Add evaluation routes to `promotions.route.ts`
- [ ] Add redemption routes to `promotions.route.ts`

### **Step 4: Create Schemas**
- [ ] `evaluation.schema.ts`
- [ ] `redemption.schema.ts`

### **Step 5: Testing**
- [ ] Unit tests for services
- [ ] Integration tests for APIs
- [ ] End-to-end testing

---

## 📈 Performance Considerations

### **Caching Strategy:**
- Cache active promotions
- Cache user segments
- Cache evaluation results (short-term)

### **Database Optimization:**
- Index on evaluation_id
- Index on user_id + created_at
- Index on order_id

### **Rate Limiting:**
- Limit evaluation requests per user
- Implement evaluation expiry
- Prevent duplicate evaluations

---

## 🔐 Security Considerations

### **Authentication:**
- Optional for guest users
- Required for personalized promotions
- JWT token validation

### **Authorization:**
- User can only evaluate their own cart
- User can only redeem their own evaluations
- Admin access for management

### **Data Validation:**
- Sanitize all inputs
- Validate cart data structure
- Prevent SQL injection

---

## 📝 Error Handling

### **Evaluation Errors:**
- Promotion not found
- Promotion expired
- User not eligible
- Cart data invalid
- Evaluation expired

### **Redemption Errors:**
- Evaluation not found
- Evaluation expired
- Already redeemed
- Order not found
- Insufficient permissions

---

## 🎉 Success Metrics

### **Performance:**
- Evaluation response time < 200ms
- Redemption response time < 100ms
- 99.9% uptime

### **Business:**
- Promotion usage tracking
- Discount amount tracking
- User engagement metrics

---

**This plan provides a comprehensive foundation for implementing the promotion evaluation system!** 🚀
