# **Functional Specification – Promotion Module (v3 - Complete)**
## **1. Purpose**
To provide a centralized system for managing, evaluating, and applying promotions across the e-commerce app. It must support guest and identified users with different scopes of offers, and ensure deterministic, performant, and auditable outcomes at scale.
## **2. Core Concepts**
- **Immutable Evaluation:** Every call to the evaluation engine for a specific cart and user context returns a unique evaluation\_id. This ID represents a non-modifiable "quote" of all applicable promotions, discounts, and the final price at that moment. This ID is used for final redemption to prevent race conditions and ensure consistency.
- **Detailed Application Breakdown:** The system will not just return a total discount. The evaluation response will provide a detailed breakdown, specifying which promotion was applied to which line item(s), the discount amount per item, and the final calculated price for each.
- **Clear Ineligibility Reasons:** When a user-entered coupon or an automatic promotion cannot be applied, the API response will include a structured reason (e.g., "Minimum spend not met," "Coupon expired," "Not applicable to items in cart"). This is critical for a transparent user experience.
## **3. User Scenarios**
### **3.1 Guest User**
- **Objective:** See relevant, non-personalized offers that encourage browsing and conversion.
- **Scenario:**
  - Upon launching the app, the user sees general banners for site-wide campaigns (e.g., "Summer Sale: Up to 30% Off").
  - While browsing a product listing page for shirts, the user sees a badge on certain items indicating "15% Off Applied at Checkout."
  - The user adds an item to the cart but does not see any account-specific offers like "First Order Discount."
### **3.2 Identified User**
- **Objective:** Receive a personalized and rewarding experience that leverages their profile, loyalty status, and shopping history.
- **Scenario:**
  - A "Gold Tier" loyalty member logs in and sees a personalized banner: "Gold Member Exclusive: Free Shipping On All Orders."
  - They add items to their cart and navigate to the cart page. The system automatically applies a "10% Off for Gold Members" promotion.
  - The user enters a coupon code WELCOME15 for their first order. The system adds this discount if it's stackable or shows an ineligibility message if it's not.
  - At checkout, after selecting their co-branded credit card, a new message appears: "Get 5% cashback when you pay with your XYZ Card."
## **4. Data Entities**
- **Promotion:**
  - id, name, description
  - type: (Enum: PERCENT\_OFF\_ITEM, FIXED\_AMOUNT\_OFF\_ITEM, BOGO, PERCENT\_OFF\_CART, FIXED\_AMOUNT\_OFF\_CART, FREE\_SHIPPING)
  - priority: (Integer for resolving conflicts, lower number = higher priority)
  - is\_stackable: (Boolean)
  - budget: (Total monetary value or total # of redemptions)
  - schedule: (start\_date, end\_date, timezone)
  - conditions: (Array of Condition objects)
  - action: (Action object)
- **Condition:** A structured object defining the predicate for eligibility.
  - *Example:* { "attribute": "cart.total\_value", "operator": "GTE", "value": 500 }
  - *Example:* { "attribute": "user.segment", "operator": "IN", "value": ["loyalty\_tier\_gold"] }
- **Action:** Defines the promotional benefit.
  - *Example:* { "type": "PERCENT\_OFF", "value": 15 }
  - *Example:* { "type": "FREE\_SHIPPING", "value": true }
- **EvaluationResult:** The structured response from an evaluation request.
  - evaluation\_id: (UUID)
  - original\_total: (Price)
  - discounted\_total: (Price)
  - applied\_promotions: (Array of Application objects)
  - ineligible\_coupons: (Array of objects with coupon\_code and reason)
- **Application:** Details how a single promotion was applied.
  - promotion\_id, promotion\_name
  - discount\_amount: (Total discount from this promotion)
  - affected\_line\_item\_ids: (Array of item IDs this applies to)
- **Coupon:** code, promotion\_id, usage\_limit\_per\_user, total\_usage\_limit.
- **Redemption:** id, order\_id, user\_id, promotion\_id, evaluation\_id, discount\_amount, redeemed\_at.
## **5. APIs**
### **GET /promotions/active**
- **Purpose:** Fetch general, non-contextual promotions for display (e.g., banners).
- **Params:** channel, geo, scope=banner
- **Response:** Array of simplified promotion objects.
### **POST /evaluate**
- **Purpose:** The core evaluation endpoint. Calculates all applicable promotions for a given context and returns a unique evaluation\_id.
- **Request Body:**\
  {\
  `  `"context": { "channel": "mobile\_app", "geo": "US" },\
  `  `"user": { "user\_id": "user-123", "segment\_flags": ["first\_order", "loyalty\_tier\_gold"] },\
  `  `"cart": {\
  `    `"line\_items": [\
  `      `{ "id": "li-1", "sku": "SKU001", "quantity": 1, "price": 100 },\
  `      `{ "id": "li-2", "sku": "SKU002", "quantity": 2, "price": 50 }\
  `    `],\
  `    `"applied\_coupon\_codes": ["SUMMER20"]\
  `  `},\
  `  `"payment\_method": "credit\_card"\
  }
- **Response Body (200 OK):** An EvaluationResult object.\
  {\
  `  `"evaluation\_id": "eval-abc-123-xyz-789",\
  `  `"original\_total": 200.00,\
  `  `"discounted\_total": 170.00,\
  `  `"applied\_promotions": [\
  `    `{\
  `      `"promotion\_id": "promo-456", "promotion\_name": "Loyalty Gold 10% Off",\
  `      `"discount\_amount": 20.00, "affected\_line\_item\_ids": ["li-1", "li-2"]\
  `    `},\
  `    `{\
  `      `"promotion\_id": "promo-789", "promotion\_name": "Free Shipping",\
  `      `"discount\_amount": 10.00, "affected\_line\_item\_ids": []\
  `    `}\
  `  `],\
  `  `"ineligible\_coupons": [\
  `    `{ "coupon\_code": "SUMMER20", "reason": "This coupon cannot be combined with other offers." }\
  `  `]\
  }
### **POST /redeem**
- **Purpose:** Finalizes and redeems a specific evaluation. This is an idempotent and atomic operation.
- **Request Body:**\
  {\
  `  `"evaluation\_id": "eval-abc-123-xyz-789",\
  `  `"order\_id": "order-def-456"\
  }
- **Response Body (200 OK):** A Redemption object confirming success.
- **Response Body (409 Conflict):** If the evaluation is expired, has already been redeemed, or if a limited-use promotion's budget was exhausted since evaluation.
## **6. Rules & Constraints**
- **Stacking:**
  - A maximum of one cart-level discount can be applied. The one with the highest priority is chosen.
  - Item-level discounts stack only if both promotions are marked as is\_stackable.
  - FREE\_SHIPPING promotions stack with all other types.
- **Idempotency:** All /redeem calls using the same evaluation\_id will return the original success response without creating a new redemption record.
## **7. Edge Cases**
- **Evaluation Expiry:** An evaluation\_id is valid for 15 minutes to prevent users from holding onto a quote indefinitely.
- **Redemption Failure:** If the /redeem call fails due to API timeouts, the client must retry with the same evaluation\_id. The idempotency key prevents double redemption.
- **Concurrency on Limited Budgets:** The /redeem operation must use an atomic transaction (e.g., DECREMENT IF count > 0) to claim a limited-use promotion, preventing over-redemption.
- **Proration on Returns:** The EvaluationResult provides the per-item discount allocation. This data must be stored with the order to correctly calculate refunds on partial returns.
## **8. Performance & Scalability**
- **8.1 Caching:**
  - Active, general promotions (per channel + geo) will be cached in Redis with a 5-minute TTL.
  - User segment flags will be cached per user session.
- **8.2 Targeting & Indexing:**
  - Promotions will be pre-indexed by applicable identifiers (SKU, category ID) for rapid lookup.
  - Rule conditions will be pre-compiled at promotion publish time to minimize runtime evaluation overhead.
- **8.3 Service Level Agreements (SLAs):**
  - GET /promotions/active: P99 latency < 50ms.
  - POST /evaluate: P95 latency < 150ms.
  - POST /redeem: P99 latency < 100ms.
## **9. Non-Functional Requirements**
- **9.1 Security:** All promotion validations must occur server-side. The /redeem endpoint must be protected against replay attacks and CSRF.
- **9.2 Observability:**
  - All evaluate and redeem calls, their inputs, and their outputs will be logged.
  - Metrics (latency, error rates, redemption counts) for each endpoint will be exported to a monitoring dashboard.
- **9.3 Auditability:** Any change to a promotion's configuration (e.g., budget, schedule, conditions) must be recorded in an audit log, tracking the user, timestamp, and the change delta.
- **9.4 Internationalization (i18n):** Promotion text (name, description, denial reasons) must be localizable and served based on user preference or Accept-Language headers.
- **9.5 Compliance:** Each promotion must specify if the discount is applied pre-tax or post-tax, to be handled according to regional regulations.

—————-


## **🛒 Promotion & Order Flow – Clarifications**
### **1. Flow Explanation**
1. **Promotion Creation**
- Promotions are defined in the system with **conditions** (eligibility rules) and **actions** (discounts or benefits).
- Example: *Flat ₹100 off on cart value ≥ ₹1000*, *10% off for loyalty gold members*, *Free shipping with XYZ credit card*.
- Each promotion has attributes like type, stackability, budget, and validity period.
1. **Cart Page (Evaluation Step)**
- When a user adds products to the cart and applies a coupon (if any), the system calls **POST /evaluate**.
- The request includes:
- Cart details (items, price, quantity).
- User context (guest vs identified, loyalty tier, first-order flag, etc.).
- Applied coupon codes.
- The response contains:
- A unique **evaluation\_id** – this represents an immutable snapshot of the discounts at that moment.
- A detailed discount breakdown (which promo applied, to which line items, and discount per item).
- Ineligible coupons with structured reasons (e.g., *"Minimum spend not met"*, *"Coupon expired"*).
- Final cart totals (original vs discounted).
1. **Place Order (Frontend → Backend)**
- When the user proceeds to checkout and clicks *Place Order*, the frontend sends:
- Cart + payment details.
- The previously obtained evaluation\_id.
- This ensures that the backend can link the order to the exact evaluation snapshot the user saw.
1. **Backend Order Service**
- **Step 1:** Create an **Order record** in the database with state = *pending*.
- This reserves the order\_id but does not confirm payment or discount yet.
- **Step 2:** Call **POST /redeem** with { evaluation\_id, order\_id }.
- This step ensures atomicity and prevents fraud because only the backend is allowed to finalize promotions.
- **Step 3 (Success case):**
- If /redeem succeeds, promotions are officially bound to that order.
- The order is marked as *confirmed*.
- Promotions are applied, budgets decremented, and discounts finalized.
- **Step 4 (Failure case):**
- If /redeem fails (because evaluation expired, already redeemed, or budget exhausted), the backend rolls back the pending order.
- User is informed that the promotion is no longer valid, and they must re-checkout with updated discounts.
### **2. Doubts & Detailed Explanations**
#### **Doubt 1: What does *"promotions are locked"* mean?**
- **It does not mean global blocking of a promotion.**
- Instead, locking happens at two levels:
1. **Evaluation Lock:**
- Once redeemed, the evaluation\_id is tied to one specific order\_id.
- It cannot be reused for another order, even by the same user.
1. **Budget Lock (for limited-use promos):**
- If a promotion has a limited budget (e.g., *first 5000 redemptions only*), then /redeem decrements that budget.
- Example: If 100 redemptions remain and one order redeems successfully, now only 99 remain.
- If budget is already 0, /redeem fails.
- **Other users can still use the promotion** as long as there is budget left. Locking is scoped to the redemption event, not the entire promotion.
#### **Doubt 2: What if multiple users redeem at the same time?**
- This is a **race condition** scenario. To handle it:
- The /redeem service must be implemented with **atomic DB or cache operations**.
- Example approaches:
- **SQL row lock:** UPDATE promotions SET budget = budget - 1 WHERE id = ? AND budget > 0;
- Only succeeds if budget > 0.
- **Redis atomic command:** DECR with condition check.
- This guarantees that if two users try to redeem the last available promo simultaneously:
- One succeeds (budget decremented).
- The other fails (budget already 0).
- On **failure**, the backend cancels the pending order and notifies the user to refresh and re-check promotions.
### **3. Key Takeaways**
- **/evaluate**:
- Calculates all applicable promotions and discounts.
- Provides immutable evaluation\_id representing a snapshot of discounts.
- User sees exactly what they will pay if they place the order within 15 minutes.
- **/redeem**:
- Final step that binds the evaluation to the order.
- Ensures no double-redemption.
- Atomically decrements budgets for limited-use promotions.
- Guarantees fairness when multiple users redeem at once.
- **Locking Mechanism**:
- Lock is per **evaluation\_id + order\_id** (not global).
- For budgeted promotions, redeem decrements the available count.
- Other users can still use the promotion until budget is exhausted.

