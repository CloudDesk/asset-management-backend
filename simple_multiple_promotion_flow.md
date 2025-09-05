# Simple Multiple Promotion Flow (Current Schema)

## The Correct Approach - No Schema Changes Needed!

### Frontend Flow

#### Step 1: User Applies Coupon
```javascript
// User clicks "Apply Coupon" for "FLAT20"
const couponResponse = await fetch('/v1/promotions/evaluate', {
  method: 'POST',
  body: JSON.stringify({
    user_id: "24",
    promotion_id: 15, // FLAT20
    cart_items: [...],
    context: {...}
  })
});

const couponData = await couponResponse.json();
// couponData.data.evaluation_id = "eval_123"
```

#### Step 2: Check Automatic Promotions
```javascript
// Check for automatic promotions (free shipping, etc.)
const autoResponse = await fetch('/v1/promotions/evaluate/automatic', {
  method: 'POST',
  body: JSON.stringify({
    user_id: "24",
    cart_items: [...],
    context: {...}
  })
});

const autoData = await autoResponse.json();
// autoData.data.evaluations[0].evaluation_id = "eval_124"
```

#### Step 3: Frontend State
```javascript
const promotionState = {
  userCoupon: {
    evaluation_id: "eval_123",
    promotion_id: 15,
    discount: 120
  },
  automaticPromotions: [
    {
      evaluation_id: "eval_124", 
      promotion_id: 58,
      discount: 30
    }
  ],
  allEvaluationIds: ["eval_123", "eval_124"]
};
```

#### Step 4: Payment Initiation
```javascript
// Send all evaluation IDs to payment
const paymentResponse = await fetch('/v1/phonepe/initiate', {
  method: 'POST',
  body: JSON.stringify({
    mode: "phonepe",
    evaluation_ids: ["eval_123", "eval_124"], // Both evaluation IDs
    transaction: {
      userId: "24",
      amount: 450, // After discounts
      currency: "INR"
    }
  })
});
```

### Backend Processing

#### Current Schema Works Perfectly
```sql
-- Each evaluation creates a separate record
evaluation_id: "eval_123"
user_id: "24"
applied_promotions: [{"promotion_id": 15, "discount_amount": 120}]
original_total: 600
discounted_total: 480
status: "active"

evaluation_id: "eval_124" 
user_id: "24"
applied_promotions: [{"promotion_id": 58, "discount_amount": 30}]
original_total: 600
discounted_total: 570
status: "active"
```

#### PhonePe Controller Handles Multiple IDs
```javascript
// In phonepe.controller.ts
const evaluationsToProcess = [];
if (requestBody.evaluation_id) {
  evaluationsToProcess.push(requestBody.evaluation_id);
}
if (requestBody.evaluation_ids && requestBody.evaluation_ids.length > 0) {
  evaluationsToProcess.push(...requestBody.evaluation_ids);
}

// Validate all evaluations
for (const evaluationId of evaluationsToProcess) {
  const validation = await evaluationService.validateEvaluationForOrder(
    evaluationId, 
    requestBody.transaction.userId
  );
  // Handle validation...
}

// Redeem all promotions
for (const evaluationId of evaluationsToProcess) {
  await redemptionService.redeemPromotion({
    evaluation_id: evaluationId,
    order_id: order.id,
    user_id: requestBody.transaction.userId
  });
}
```

## Why Current Schema is Perfect

1. **Separate Evaluation Records**: Each promotion gets its own evaluation record
2. **JSON Flexibility**: `applied_promotions` can store promotion details
3. **Easy Validation**: Each evaluation can be validated independently
4. **Simple Redemption**: Each evaluation can be redeemed separately
5. **No Schema Changes**: Works with existing database structure

## Summary

You're absolutely right! The flow is:

1. **User applies coupon** → `/evaluate` → Store `evaluation_id` in frontend
2. **Check automatic** → `/evaluate/automatic` → Store `evaluation_id` in frontend  
3. **Payment initiation** → `/phonepe/initiate` with `evaluation_ids: [id1, id2]`

**No schema changes needed!** The current `promotion_evaluations` table with `applied_promotions` JSON array works perfectly for this use case.

I overcomplicated it by trying to add individual promotion tracking. The current approach is simpler and more flexible.
