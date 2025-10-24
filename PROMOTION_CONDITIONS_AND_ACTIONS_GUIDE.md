
# Promotion Conditions and Actions Guide

**Complete reference for all promotion conditions, actions, and implementations in the system.**

This guide covers:
- ✅ All available condition attributes and operators
- ✅ Cart, user, and product-specific conditions
- ✅ BOGO and FREE_PRODUCT action structures
- ✅ Stock availability validation
- ✅ Frontend integration examples
- ✅ Production-ready features

## **🎯 Current Status**
- ✅ All cart conditions implemented and working
- ✅ All user conditions implemented and working
- ✅ All user segments implemented and working
- ✅ BOGO and FREE_PRODUCT with stock validation
- ✅ Product-specific conditions working
- ✅ Complete promotion system ready for production

## **📊 User Segments Implementation Details**

### **Current User Segments:**
```typescript
// Current segments (promotions.service.ts)
const currentSegments = [
  'authenticated_user',  // All logged-in users
  'new_user',          // Created within 30 days
  'first_order'        // 0 orders
];
```

### **`new_user` Segment Implementation:**
```typescript
// Lines 329-336 in promotions.service.ts
// Check if new user (created within configured days)
const daysSinceCreation = Math.floor(
  (Date.now() - Number(user.createddate)) / (1000 * 60 * 60 * 24)
);

if (daysSinceCreation <= USER_SEGMENT_CONFIG.NEW_USER_DAYS) {
  segments.push('new_user');
}
```

### **Configuration Status:**
- ✅ **Configurable**: 30 days is now **configurable** via `NEW_USER_DAYS` environment variable
- ✅ **Default Value**: Defaults to 30 days if not set
- ✅ **Environment Control**: Can be changed without code modification
- ✅ **Runtime**: Uses `USER_SEGMENT_CONFIG.NEW_USER_DAYS` constant

### **How It Works:**
1. **Get user's `createddate`** from database
2. **Calculate days since creation**: `(current_time - createddate) / (1000 * 60 * 60 * 24)`
3. **Check if ≤ configured days**: If true, add `'new_user'` to segments
4. **Result**: User gets `new_user` segment for first N days after registration (N = `NEW_USER_DAYS`)

### **Example:**
- **User created**: January 1, 2024
- **Current date**: January 15, 2024 (14 days later)
- **NEW_USER_DAYS**: 30 (default)
- **Result**: User has `['authenticated_user', 'new_user']` segments
- **After 30 days**: User only has `['authenticated_user']` segment

### **Configuration Examples:**
```bash
# Set to 7 days for new_user segment
NEW_USER_DAYS=7

# Set to 14 days for new_user segment  
NEW_USER_DAYS=14

# Set to 30 days (default)
NEW_USER_DAYS=30
```

## **✅ All Implemented Conditions**

### **Cart Conditions**
- ✅ **`cart.total_value`** - Cart total (subtotal + shipping + tax)
- ✅ **`cart.item_count`** - Number of items in cart (sum of all quantities)
- ✅ **`cart.category`** - Cart categories array (unique categories from all items)
- ✅ **`cart.items.category`** - Individual item category matching (checks each item)

### **📊 Cart Condition Examples:**

#### **1. `cart.item_count` - Total Items in Cart:**
```json
{
  "value": 3,
  "operator": "GTE",
  "attribute": "cart.item_count"
}
```
**How it works:** Counts total quantity of all items (sum of quantities)
- Cart with 2 items of qty 2 each = 4 total items ✅
- Cart with 1 item of qty 2 = 2 total items ❌

#### **2. `cart.category` - Cart Categories Array:**
```json
{
  "value": ["Electronics", "Books"],
  "operator": "IN",
  "attribute": "cart.category"
}
```
**How it works:** Checks if cart contains ANY of the specified categories
- Cart with ["Electronics", "Clothing"] = ✅ (has "Electronics")
- Cart with ["Books", "Toys"] = ✅ (has "Books")
- Cart with ["Clothing", "Toys"] = ❌ (no match)

#### **3. `cart.items.category` - Individual Item Category Matching:**
```json
{
  "value": ["Electronics", "Books"],
  "operator": "IN",
  "attribute": "cart.items.category"
}
```
**How it works:** Checks each individual item's category
- Item 1: "Electronics" ✅ (matches)
- Item 2: "Clothing" ❌ (no match)
- Item 3: "Books" ✅ (matches)
- **Result:** ✅ Eligible (has matching items)

#### **4. `cart.total_value` - Cart Total Value:**
```json
{
  "value": 100,
  "operator": "GTE",
  "attribute": "cart.total_value"
}
```
**How it works:** Calculates subtotal + shipping + tax
- Subtotal: ₹80, Shipping: ₹20, Tax: ₹10 = ₹110 ✅
- Subtotal: ₹70, Shipping: ₹20, Tax: ₹10 = ₹100 ✅
- Subtotal: ₹60, Shipping: ₹20, Tax: ₹10 = ₹90 ❌

### **❌ Cart Conditions NOT Implemented:**
- ❌ **`cart.order_count`** - Not implemented (this would be user.order_count instead)

### **User Conditions**
- ✅ **`user.order_count`** - User's total order count (from orders table) - **FULLY IMPLEMENTED**
- ✅ **`user.created_date`** - User creation date with full date operators support
- ✅ **`user.segment`** - Basic user segments (authenticated_user, new_user, first_order)

### **📊 User Order Count Implementation:**

#### **How `user.order_count` Works:**
```typescript
// Lines 941-951 in promotions.service.ts
private async getUserOrderCount(userId: string): Promise<number> {
  try {
    const count = await this.prisma.orders.count({
      where: { userid: parseInt(userId) }
    });
    return count;
  } catch (error) {
    logger.warn({ error, userId }, 'Error getting user order count');
    return 0;
  }
}
```

#### **Database Query:**
- **Table**: `orders`
- **Field**: `userid` (matches user ID)
- **Operation**: `COUNT(*)` - counts all orders for the user
- **Error Handling**: Returns `0` if error occurs

#### **Usage Examples:**

**1. New Customer (0 orders):**
```json
{
  "value": 0,
  "operator": "EQ",
  "attribute": "user.order_count"
}
```

**2. Regular Customer (1+ orders):**
```json
{
  "value": 1,
  "operator": "GTE",
  "attribute": "user.order_count"
}
```

**3. VIP Customer (100+ orders):**
```json
{
  "value": 100,
  "operator": "GTE",
  "attribute": "user.order_count"
}
```

**4. Range-based (5-50 orders):**
```json
{
  "value": 5,
  "operator": "GTE",
  "attribute": "user.order_count"
},
{
  "value": 50,
  "operator": "LTE",
  "attribute": "user.order_count"
}
```

### **✅ User Created Date - NOW FULLY IMPLEMENTED:**
The `user.created_date` condition now supports **all date operators**:

#### **📅 Supported Date Operators:**

**1. `DATE_ADD_DAYS` - Add days to user's created date:**
```json
{
  "value": 7,
  "operator": "DATE_ADD_DAYS",
  "attribute": "user.created_date",
  "comparison": "GTE"  // Current date >= (user_created_date + 7 days)
}
```

**2. `DATE_SUBTRACT_DAYS` - Subtract days from current date:**
```json
{
  "value": 7,
  "operator": "DATE_SUBTRACT_DAYS", 
  "attribute": "user.created_date",
  "comparison": "GTE"  // User created date >= (current_date - 7 days)
}
```

**3. Direct Date Comparison:**
```json
{
  "value": "2024-01-01",
  "operator": "GTE",
  "attribute": "user.created_date"
}
```

#### **🔍 Comparison Operators:**
- **`GTE`** - Greater than or equal (>=)
- **`GT`** - Greater than (>)
- **`LTE`** - Less than or equal (<=)
- **`LT`** - Less than (<)
- **`EQ`** - Equal (within 1 day tolerance)

### **⚙️ Configurable User Segments:**
```bash
# Environment variables for configuration
NEW_USER_DAYS=30          # Default: 30 days for new_user segment
FIRST_ORDER_THRESHOLD=0   # Default: 0 orders for first_order segment
```

### **Product-Specific Conditions**
- ✅ **BOGO Promotions** - Uses `action.product_ids` array (NOT in conditions)
- ✅ **FREE_PRODUCT Promotions** - Uses `action.free_product_id` (NOT in conditions)
- ✅ **Item-Level Conditions** - Uses `product.id` in conditions array
- ✅ **Stock Availability Validation** - Both BOGO and FREE_PRODUCT check product and platform stock status

### **✅ Complex Date Conditions - NOW IMPLEMENTED:**

**Example Promotion (ID 67) - NOW WORKS:**
```json
{
  "conditions": [
    {
      "value": ["new_user"],
      "operator": "IN",
      "attribute": "user.segment"
    },
    {
      "value": 7,
      "operator": "DATE_ADD_DAYS",        // ✅ NOW IMPLEMENTED
      "attribute": "user.created_date",
      "comparison": "GTE"                 // ✅ NOW IMPLEMENTED
    },
    {
      "value": 100,
      "operator": "GTE",
      "attribute": "cart.total_value"
    }
  ]
}
```

**What This Condition Means:**
- User must be in `new_user` segment (created within 30 days by default)
- **AND** current date must be >= (user_created_date + 7 days)
- **AND** cart total must be >= 100

**Example Scenarios:**
- **User created**: Jan 1, 2024
- **Current date**: Jan 5, 2024 (4 days later)
- **Result**: ❌ **NOT ELIGIBLE** (4 < 7 days)
- **Current date**: Jan 8, 2024 (7 days later)  
- **Result**: ✅ **ELIGIBLE** (7 >= 7 days)

### **📊 More Date Condition Examples:**

**1. Users created MORE than 7 days ago:**
```json
{
  "value": 7,
  "operator": "DATE_ADD_DAYS",
  "attribute": "user.created_date", 
  "comparison": "GT"  // Current date > (user_created_date + 7 days)
}
```

**2. Users created within last 7 days:**
```json
{
  "value": 7,
  "operator": "DATE_SUBTRACT_DAYS",
  "attribute": "user.created_date",
  "comparison": "GTE"  // User created date >= (current_date - 7 days)
}
```

**3. Users created before specific date:**
```json
{
  "value": "2024-01-01",
  "operator": "LT",
  "attribute": "user.created_date"
}
```

## **🎯 Real-World Example: Promotion ID 67**

**Original Promotion (NOW WORKS):**
```json
{
  "id": 67,
  "name": "New User Welcome - ₹50 OFF (7 Days)",
  "conditions": [
    {
      "value": ["new_user"],
      "operator": "IN",
      "attribute": "user.segment"
    },
    {
      "value": 7,
      "operator": "DATE_ADD_DAYS",
      "attribute": "user.created_date",
      "comparison": "GTE"
    },
    {
      "value": 100,
      "operator": "GTE",
      "attribute": "cart.total_value"
    }
  ],
  "action": {
    "type": "FIXED_AMOUNT_OFF",
    "value": 50
  }
}
```

**What This Promotion Does:**
1. **Target**: Users who registered 7+ days ago but are still "new" (within 30 days)
2. **Logic**: `new_user` segment AND `current_date >= (user_created_date + 7 days)`
3. **Cart**: Minimum ₹100 cart value
4. **Reward**: ₹50 off

**Eligibility Scenarios:**

| User Created | Current Date | Days Since | new_user Segment | 7+ Days Check | Cart ≥ ₹100 | Eligible? |
|-------------|-------------|------------|------------------|---------------|-------------|-----------|
| Jan 1, 2024 | Jan 5, 2024 | 4 days | ✅ Yes | ❌ No (4 < 7) | ✅ Yes | ❌ **NO** |
| Jan 1, 2024 | Jan 8, 2024 | 7 days | ✅ Yes | ✅ Yes (7 ≥ 7) | ✅ Yes | ✅ **YES** |
| Jan 1, 2024 | Jan 15, 2024 | 14 days | ✅ Yes | ✅ Yes (14 ≥ 7) | ✅ Yes | ✅ **YES** |
| Jan 1, 2024 | Feb 1, 2024 | 31 days | ❌ No (>30) | ✅ Yes (31 ≥ 7) | ✅ Yes | ❌ **NO** |

**Key Insight:** This promotion targets users who have been registered for 7+ days but are still considered "new" (within 30 days), perfect for re-engagement campaigns!

## **🚀 Future Enhancements**

### **Advanced User Segments (Not Yet Implemented):**
```typescript
// Additional segments for future implementation
const futureSegments = [
  'frequent_buyer',     // 5+ orders
  'vip_customer',       // ₹10,000+ total spent
  'inactive_user',      // No orders in 90+ days
  'mobile_user',        // Mobile app users
  'web_user',          // Web users  
  'premium_member',    // Subscription users
  'bulk_buyer',        // Large quantity orders
  'seasonal_buyer',    // Seasonal purchase patterns
  'category_loyal',    // Loyal to specific categories
  'price_sensitive',   // Discount-seeking behavior
  'high_value_items'   // Expensive item buyers
];
```

### **Required Database Methods (Future):**
```typescript
// These methods would need to be implemented for advanced segments
private async getUserTotalSpent(userId: string): Promise<number> {
  // Implementation for VIP customer detection
}

private async getUserLastOrderDate(userId: string): Promise<Date | null> {
  // Implementation for inactive user detection
}
```

## **🎯 Available Promotion Routes**

### **✅ Implemented Routes:**
- ✅ **`GET /v1/promotions`** - Get all promotions with pagination and filtering
- ✅ **`GET /v1/promotions/:id`** - Get specific promotion by ID
- ✅ **`POST /v1/promotions`** - Create new promotion
- ✅ **`PUT /v1/promotions/:id`** - Update promotion
- ✅ **`DELETE /v1/promotions/:id`** - Delete promotion
- ✅ **`POST /v1/promotions/offers`** - Get unified promotion offers (best + all eligible/ineligible)
- ✅ **`POST /v1/promotions/evaluate`** - Evaluate promotion or apply manual coupon
- ✅ **`POST /v1/promotions/evaluate/automatic`** - Evaluate automatic promotions
- ✅ **`POST /v1/promotions/evaluate/specific`** - Evaluate specific promotion against user's cart
- ✅ **`POST /v1/promotions/evaluate/remove`** - Remove coupon from evaluation
- ✅ **`GET /v1/promotions/evaluations`** - Get user's active evaluations
- ✅ **`GET /v1/promotions/evaluations/:id`** - Get specific evaluation by ID
- ✅ **`POST /v1/promotions/redeem`** - Redeem promotion after order placement
- ✅ **`GET /v1/promotions/redemptions/order/:orderId`** - Get redemptions for order
- ✅ **`GET /v1/promotions/redemptions/:id`** - Get redemption by ID
- ✅ **`GET /v1/promotions/redemptions/user/:userId`** - Get user's redemptions

## **🎯 Promotion Condition Examples**

### **Cart Conditions:**
```json
{
  "conditions": [
    {
      "attribute": "cart.total_value",
      "operator": "GTE",
      "value": 1000
    },
    {
      "attribute": "cart.item_count",
      "operator": "GTE", 
      "value": 3
    },
    {
      "attribute": "cart.category",
      "operator": "IN",
      "value": ["Home Decor", "Candles"]
    },
    {
      "attribute": "cart.items.category",
      "operator": "IN",
      "value": ["Electronics", "Accessories"]
    }
  ]
}
```

### **User Conditions:**
```json
{
  "conditions": [
    {
      "attribute": "user.order_count",
      "operator": "GTE",
      "value": 3
    },
    {
      "attribute": "user.created_date",
      "operator": "GTE",
      "value": "2024-01-01"
    },
    {
      "attribute": "user.segment",
      "operator": "IN",
      "value": ["new_user", "first_order"]
    }
  ]
}
```

### **BOGO Promotion Example:**
```json
{
  "type": "BOGO",
  "conditions": [
    {
      "attribute": "cart.total_value",
      "operator": "GTE",
      "value": 500
    }
  ],
  "action": {
    "type": "BOGO",
    "product_ids": ["TES-0050", "TES-0051"],
    "buy_quantity": 2,
    "get_quantity": 1,
    "max_free_items": 5
  }
}
```

### **FREE_PRODUCT Promotion Example:**
```json
{
  "type": "FREE_PRODUCT",
  "conditions": [
    {
      "attribute": "user.segment",
      "operator": "IN",
      "value": ["new_user"]
    },
    {
      "attribute": "cart.total_value",
      "operator": "GTE",
      "value": 1000
    }
  ],
  "action": {
    "type": "FREE_PRODUCT",
    "free_product_id": "TES-0052",
    "min_purchase": 1000,
    "max_free_items": 1
  }
}
```

## **🔍 How Product-Specific Conditions Work**

### **❌ NOT in Conditions Array:**
Product-specific targeting for BOGO and FREE_PRODUCT is **NOT** handled through the `conditions` array. Instead, it's handled through the `action` object.

### **✅ Two Ways to Handle Product Targeting:**

#### **1. Action-Based (BOGO & FREE_PRODUCT):**
```json
{
  "type": "BOGO",
  "conditions": [
    {
      "attribute": "cart.total_value",
      "operator": "GTE", 
      "value": 500
    }
  ],
  "action": {
    "type": "BOGO",
    "product_ids": ["TES-0050", "TES-0051"],  // ← Product targeting here
    "buy_quantity": 2,
    "get_quantity": 1
  }
}
```

#### **2. Condition-Based (Item-Level):**
```json
{
  "type": "PERCENT_OFF_ITEM",
  "conditions": [
    {
      "attribute": "product.id",           // ← Product targeting here
      "operator": "IN",
      "value": ["TES-0050", "TES-0051"]
    }
  ],
  "action": {
    "type": "PERCENT_OFF",
    "value": 20
  }
}
```

### **🎯 Key Differences:**

| Method | Used For | Location | Example |
|--------|----------|----------|---------|
| **Action-based** | BOGO, FREE_PRODUCT | `action.product_ids` or `action.free_product_id` | BOGO: Buy 2 get 1 free for specific products |
| **Condition-based** | Other promotions | `conditions[].attribute = "product.id"` | 20% off specific products |

### **💡 Why This Design?**

1. **BOGO/FREE_PRODUCT** need complex logic (buy X get Y) → Better in `action`
2. **Simple discounts** just need product filtering → Better in `conditions`
3. **Separation of concerns** → Eligibility vs. Action logic

## **🔍 Stock Availability Validation**

### **BOGO Stock Check:**
- ✅ Validates each product in `action.product_ids` array
- ✅ Checks `product.productstatus = 'in_stock'`
- ✅ Checks `platformstock.platformstatus = 'in_stock'`
- ✅ Checks `platformstock.availableqty > 0`
- ✅ Platform-specific validation (nivapp vs web)

### **FREE_PRODUCT Stock Check:**
- ✅ Validates `action.free_product_id`
- ✅ Same stock validation as BOGO
- ✅ Returns `null` if free product is out of stock
- ✅ Prevents invalid free product grants

## **📋 Frontend Reference**

### **Available Condition Attributes:**
```typescript
// Cart Conditions
'cart.total_value'     // Number - Cart total amount
'cart.item_count'      // Number - Number of items
'cart.category'        // Array - Cart categories
'cart.items.category'  // Array - Item categories

// User Conditions  
'user.order_count'     // Number - Total orders
'user.created_date'    // Date - User creation date
'user.segment'         // Array - User segments

// Product Conditions (Item-Level)
'product.id'           // Array - Specific product IDs/PUCs

// Operators
'GTE'  // Greater than or equal
'LTE'  // Less than or equal
'IN'   // In array
'EQ'   // Equal
'NE'   // Not equal
```

### **BOGO Action Structure:**
```typescript
{
  "type": "BOGO",
  "product_ids": string[],     // Required - Products eligible for BOGO
  "buy_quantity": number,      // Optional - Default 1
  "get_quantity": number,     // Optional - Default 1  
  "max_free_items": number    // Optional - No limit if not specified
}
```

### **FREE_PRODUCT Action Structure:**
```typescript
{
  "type": "FREE_PRODUCT",
  "free_product_id": string,   // Required - Product to give free
  "min_purchase": number,      // Optional - Minimum cart value
  "max_free_items": number     // Optional - Default 1
}
```

## **🔍 Promotion Visibility: Public vs Private**

### **Purpose of Visibility Field:**
The `visibility` field controls **who can see and use** the promotion:

- ✅ **`public`** - Visible to all users (guest and authenticated)
- ✅ **`private`** - Only visible to authenticated users with specific access

### **How Visibility Works in Each Route:**

#### **1. `/offers` Route:**
- **Guest Users**: Only see `visibility: 'public'` promotions
- **Authenticated Users**: See ALL promotions (both public and private)
- **Code**: Lines 504-509 in promotions.service.ts

#### **2. `/evaluate` Route:**
- **No visibility filtering** - Can evaluate any promotion by ID or code
- **Purpose**: Direct promotion evaluation regardless of visibility
- **Code**: No visibility check in promotion-evaluation.service.ts

#### **3. `/evaluate/automatic` Route:**
- **No visibility filtering** - Processes all `auto_apply: true` promotions
- **Purpose**: Automatic evaluation doesn't consider visibility
- **Code**: Lines 1417-1424 in promotion-evaluation.service.ts

#### **4. `/redeem` Route:**
- **No visibility filtering** - Can redeem any evaluated promotion
- **Purpose**: Redemption is based on evaluation, not visibility

### **📊 Visibility Behavior Summary:**

| Route | Guest Users | Authenticated Users | Private Promotions |
|-------|-------------|-------------------|------------------|
| `/offers` | Only `public` | All promotions | ✅ Visible |
| `/evaluate` | Any promotion | Any promotion | ✅ Can evaluate |
| `/evaluate/automatic` | Any `auto_apply` | Any `auto_apply` | ✅ Auto-evaluated |
| `/redeem` | Any evaluated | Any evaluated | ✅ Can redeem |

### **💡 Key Points:**
1. **Visibility only affects `/offers`** - what promotions are shown to users
2. **Private promotions are NOT skipped** in evaluate/automatic/redeem
3. **Private promotions can be used** if user knows the promotion ID or code
4. **Guest users can still evaluate private promotions** if they have the code

## **✅ Verification: Documentation vs Implementation**

### **✅ Routes Verification:**
All documented routes are **actually implemented** in `src/routes/promotions.route.ts`:
- ✅ 16 routes total (GET, POST, PUT, DELETE)
- ✅ All routes have proper schemas and validation
- ✅ All routes are bound to correct controllers

### **✅ Conditions Verification:**
All documented condition attributes are **actually implemented** in services:

#### **Cart Conditions** (✅ Implemented):
- ✅ `cart.total_value` - Lines 507, 1308 in promotion-evaluation.service.ts
- ✅ `cart.item_count` - Lines 519, 1317 in promotion-evaluation.service.ts  
- ✅ `cart.category` - Lines 531, 1326 in promotion-evaluation.service.ts
- ✅ `cart.items.category` - Lines 780, 1335 in promotions.service.ts

#### **User Conditions** (✅ Implemented):
- ✅ `user.order_count` - Line 474 in promotion-evaluation.service.ts
- ✅ `user.created_date` - Line 462 in promotion-evaluation.service.ts
- ✅ `user.segment` - Line 450 in promotion-evaluation.service.ts

#### **Product Conditions** (✅ Implemented):
- ✅ `product.id` - Line 796 in promotions.service.ts

### **✅ Actions Verification:**
All documented action structures are **actually implemented**:
- ✅ BOGO with `action.product_ids` - Lines 137, 144 in promotion-evaluation.service.ts
- ✅ FREE_PRODUCT with `action.free_product_id` - Lines 177, 196 in promotion-evaluation.service.ts
- ✅ Stock validation for both - Lines 148, 196 in promotion-evaluation.service.ts

### **✅ User Segments Verification:**
All documented user segments are **actually implemented**:
- ✅ `authenticated_user` - Line 321 in promotions.service.ts
- ✅ `new_user` - Lines 328-330 in promotions.service.ts
- ✅ `first_order` - Lines 334-336 in promotions.service.ts

## **📈 Implementation Status**

### **✅ Completed (Production Ready):**
1. ✅ **Cart Conditions** - All cart conditions working
2. ✅ **User Conditions** - All user conditions working  
3. ✅ **Basic User Segments** - `authenticated_user`, `new_user`, `first_order`
4. ✅ **BOGO Promotions** - With stock validation
5. ✅ **FREE_PRODUCT Promotions** - With stock validation
6. ✅ **Stock Availability** - Real-time validation
7. ✅ **Product-Specific Conditions** - Both action-based and condition-based

### **🔄 Future Enhancements:**
1. 🆕 **Advanced User Segments** - VIP, frequent buyers, inactive users
2. 🆕 **User Analytics** - Total spent, last order date tracking
3. 🆕 **Behavioral Segments** - Purchase patterns, category loyalty
4. 🆕 **Channel-Specific Segments** - Mobile vs web user detection

## **✅ Production Ready Summary**

**Fully implemented and tested:**
- ✅ **Cart Conditions**: `total_value`, `item_count`, `category`, `items.category`
- ✅ **User Conditions**: `order_count`, `created_date`, `segment`
- ✅ **Basic User Segments**: `authenticated_user`, `new_user`, `first_order`
- ✅ **BOGO Promotions**: Product ID mapping with stock validation
- ✅ **FREE_PRODUCT Promotions**: Product ID mapping with stock validation
- ✅ **Product-Specific Conditions**: `product.id` for item-level targeting
- ✅ **Stock Validation**: Real-time product and platform stock checks
- ✅ **Platform Support**: nivapp (mobile) and web platform validation

**No additional frontend changes needed** - all product ID mapping and stock validation is handled in the backend promotion system.
