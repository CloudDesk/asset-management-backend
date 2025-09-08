🛒 Promotion Evaluation Flow
This document outlines the promotion evaluation flow for an e-commerce application, covering automatic and manual coupon application, cart changes, coupon removal, and order placement.
1. User Enters Cart Page → Automatic Evaluation
📌 Trigger: Frontend (FE) loads the cart page.
FE Action:

Calls POST /api/promotions/evaluate/automatic with payload:{ userId, cartItems, paymentMethod }



Backend (BE) Flow:

Generate cart_signature = hash(JSON.stringify(cartItems)).
Check for existing active evaluation for (userId, cart_signature):
✅ Found: Return the existing record.
❌ Not Found: Run automatic promotion evaluator:
Match eligible auto promotions (auto_apply=true) against cartData.
Build applied_promotions = [{ …auto promos }].
Create promotion_evaluations record:
evaluation_id
user_id
cart_signature
cart_data
applied_promotions[]
status = active
created_at
expires_at






➡️ Return evaluation_id and applied_promotions[] to FE.

2. User Applies a Coupon (Manual Token)
📌 Trigger: FE when user enters a coupon code or clicks “Apply”.
FE Action:

Calls POST /api/promotions/evaluate with payload:{ evaluationId, promotionId, cartItems }



BE Flow:

Fetch evaluation by evaluationId.
Validate coupon against cart_signature and conditions.
If valid:
Add coupon to applied_promotions[].
Run automatic evaluator again:
Add eligible auto promotions.
Remove invalidated auto promotions (e.g., cart total fell below threshold).
Deduplicate to ensure each promotion_id is unique in the array.


Update evaluation (applied_promotions, created_at, expires_at).


If invalid: Return error.

3. User Removes Coupon
📌 Trigger: FE when user clicks “Remove” on a coupon.
FE Action:

Calls POST /api/promotions/evaluate/remove with payload:{ evaluationId, promotionId }



BE Flow:

Fetch evaluation by evaluationId.
Remove the matching coupon object from applied_promotions[].
Run automatic evaluator again:
Add eligible auto promotions.
Remove auto promotions that no longer qualify.
Deduplicate applied_promotions[].


Update evaluation record.
➡️ Return updated applied_promotions[] to FE.

4. Cart Changes (Add/Remove/Quantity Update)
📌 Trigger: User modifies the cart (e.g., increases quantity, removes product).👉 Not a direct FE API call; handled when FE re-enters the cart page.
FE Action:

Reloads cart page and calls Automatic Evaluation API (Step 1).

BE Flow:

Compare new cart_signature with existing evaluation:
✅ Same signature: Reuse existing evaluation.
❌ Different signature: Mark old evaluation status=cancelled, create a new evaluation.


Run automatic evaluator on updated cart.
➡️ Return new evaluation_id and applied_promotions[] to FE.

Guarantee: Only one active evaluation per (user, cart_signature).
5. Place Order
📌 Trigger: FE submits the order.
FE Action:

Calls POST /api/order/place with payload:{ userId, cartItems, evaluationId }



BE Flow:

Fetch promotion_evaluations by evaluationId.
Validate:
status = active
expires_at >= now()
cart_signature matches final cart
Expiry Validation:
Ensure all promotion_ids in applied_promotions[] have:
expires_at >= now()
status = active


If any expired, remove them and re-run the automatic evaluator.


Usage Limits:
Per User Limit: Query promotion_redemptions count for (userId, promotionId). If >= per_user_limit, reject or auto-remove the promotion.
Global Max Redemptions: Query promotion_redemptions count for promotionId. If >= max_redemptions, reject the promotion.


Budget Exhaustion:
For promotions with a budget_amount (e.g., ₹1,00,000 total discount pool):
Calculate remaining_budget = budget_amount - SUM(discount_amount from promotion_redemptions).
If current cart discount exceeds remaining_budget, reject or cap the discount at the budget.




Concurrent Updates:
Enforce a unique constraint on promotion_evaluations: UNIQUE(user_id, cart_signature, status='active') to prevent multiple active evaluations for the same cart.
Use a transaction to lock the evaluation row (SELECT ... FOR UPDATE):
Check limits and budget atomically.
Deduct budget and increment usage count.
Commit to ensure race conditions are handled.
If another request tries the same evaluation simultaneously, one transaction fails due to the lock/constraint. Return error: “Evaluation already redeemed or invalid”.






If valid:
Apply applied_promotions[] to final pricing.
Insert promotion_redemptions[] for audit/history.
Mark evaluation as redeemed.


If invalid (due to expiry, usage limit, budget exhaustion, or duplicate redemption):
Re-run automatic evaluator on the final cart to return fresh promotions.
FE can display: “Your coupon expired, we applied available discounts.”



🔹 Summary of Guarantees

✅ One active evaluation per (user, cart_signature).
✅ applied_promotions[] is always an array (auto + manual).
✅ Automatic evaluator re-runs on:
Apply coupon
Remove coupon
Cart change
Place order (if validation fails)


✅ No duplicates: Each promotion_id is unique in the array.
✅ Place order always re-validates before redemption.
