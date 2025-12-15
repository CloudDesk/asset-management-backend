# Combo Pack Implementation - Clear Explanation

## 📖 What is "Component"?

**Component** = Individual products that make up a combo pack

### Example:
```
Combo Pack: "Vanilla + Sandal Combo"
├── Component 1: Vanilla (productid: 10)
└── Component 2: Sandal (productid: 15)
```

**In Simple Terms:**
- **Combo Pack** = The bundle product (what customer sees and orders)
- **Components** = The individual products inside the combo (Vanilla, Sandal, etc.)

---

## ✅ Current Single Product Logic (CONFIRMED)

### 🔒 **Order Initiate** (`POST /v1/phonepe/initiate`)

**What Happens:**
```typescript
// PlatformStock changes
availableqty = availableqty - orderQuantity  // DECREASES
lockqty = lockqty + orderQuantity            // INCREASES
orderedqty = orderedqty                     // NO CHANGE
soldqty = soldqty                           // NO CHANGE

// Product table
// NO CHANGES (updated in callback)
```

**Example:**
```
Before Initiate:
PlatformStock (Vanilla, nivapp):
  availableqty: 5
  lockqty: 0
  orderedqty: 0

User orders 2 Vanilla → Initiate:
PlatformStock (Vanilla, nivapp):
  availableqty: 5 - 2 = 3    ✅ DECREASED
  lockqty: 0 + 2 = 2          ✅ INCREASED
  orderedqty: 0               ➡️ NO CHANGE
```

---

### 💳 **Payment Callback** (`POST /v1/phonepe/callback/:transactionId`)

**What Happens:**
```typescript
// PlatformStock changes
availableqty = availableqty                 // NO CHANGE (already reduced)
lockqty = lockqty - orderQuantity          // DECREASES (reset)
orderedqty = orderedqty + orderQuantity   // INCREASES
soldqty = soldqty                         // NO CHANGE

// Product changes
availablequantity = availablequantity - orderQuantity  // DECREASES
orderedquantity = orderedquantity + orderQuantity      // INCREASES
soldquantity = soldquantity                            // NO CHANGE
```

**Example (Continuing from Initiate):**
```
After Callback (Payment Success):
PlatformStock (Vanilla, nivapp):
  availableqty: 3               ➡️ NO CHANGE (already reduced)
  lockqty: 2 - 2 = 0            ✅ DECREASED (reset)
  orderedqty: 0 + 2 = 2         ✅ INCREASED

Product (Vanilla):
  availablequantity: 10 - 2 = 8   ✅ DECREASED
  orderedquantity: 0 + 2 = 2       ✅ INCREASED
  soldquantity: 0                  ➡️ NO CHANGE
```

---

### 🚚 **Dispatch** (`PATCH /v1/orders/:id/ready-for-dispatch`)

**What Happens:**
```typescript
// Stock changes
stockstatus = 'available' → 'sold'  // CHANGED
orderid = order.orderid             // SET
orderlinenumber = orderline.orderlinenumber  // SET

// PlatformStock changes
availableqty = availableqty        // NO CHANGE
lockqty = lockqty                  // NO CHANGE
orderedqty = orderedqty - dispatchQuantity  // DECREASES
soldqty = soldqty + dispatchQuantity         // INCREASES

// Product changes
availablequantity = availablequantity        // NO CHANGE
orderedquantity = orderedquantity - dispatchQuantity  // DECREASES
soldquantity = soldquantity + dispatchQuantity       // INCREASES
```

**Example (Continuing from Callback):**
```
After Dispatch:
PlatformStock (Vanilla, nivapp):
  availableqty: 3               ➡️ NO CHANGE
  lockqty: 0                    ➡️ NO CHANGE
  orderedqty: 2 - 2 = 0         ✅ DECREASED
  soldqty: 0 + 2 = 2            ✅ INCREASED

Product (Vanilla):
  availablequantity: 8          ➡️ NO CHANGE
  orderedquantity: 2 - 2 = 0    ✅ DECREASED
  soldquantity: 0 + 2 = 2       ✅ INCREASED

Stock records:
  2 stock records → stockstatus = 'sold'
```

---

## 🎁 Combo Pack Logic (How It Should Work)

### Your Example:
```
Combo Pack: "Vanilla + Sandal Combo" (productid: 100, iscombo: true)
├── Component 1: Vanilla (productid: 10, requiredqty: 1)
└── Component 2: Sandal (productid: 15, requiredqty: 1)

Current Stock:
- Vanilla (productid: 10): PlatformStock.availableqty = 5
- Sandal (productid: 15): PlatformStock.availableqty = 1
```

**Combo Availability Calculation:**
```
combo_available = MIN(
  Vanilla.availableqty / requiredqty,    // 5 / 1 = 5
  Sandal.availableqty / requiredqty       // 1 / 1 = 1
)
= MIN(5, 1) = 1 combo pack available ✅
```

**Yes, you're correct!** Minimum order qty for combo is **1 combo pack** (which needs 1 Vanilla + 1 Sandal)

---

### 🔒 **Combo Order Initiate**

**When user orders 1 combo pack:**

**Step 1: Validate Availability**
```typescript
// Check if all components have enough stock
Vanilla: availableqty (5) - lockqty (0) = 5 available ✅ (need 1)
Sandal: availableqty (1) - lockqty (0) = 1 available ✅ (need 1)

// Combo available = MIN(5/1, 1/1) = 1 ✅
// User orders 1 combo → VALID
```

**Step 2: Lock Components (NOT combo itself)**
```typescript
// Lock Vanilla component
PlatformStock (Vanilla, nivapp):
  availableqty: 5 - 1 = 4    ✅ DECREASED
  lockqty: 0 + 1 = 1         ✅ INCREASED

// Lock Sandal component
PlatformStock (Sandal, nivapp):
  availableqty: 1 - 1 = 0    ✅ DECREASED
  lockqty: 0 + 1 = 1         ✅ INCREASED

// Combo Product (productid: 100)
// NO CHANGES (combo has no physical stock)
```

**Result After Initiate:**
```
Vanilla (productid: 10):
  PlatformStock.availableqty: 4
  PlatformStock.lockqty: 1

Sandal (productid: 15):
  PlatformStock.availableqty: 0
  PlatformStock.lockqty: 1

Combo Pack (productid: 100):
  NO PlatformStock record (virtual product)
  NO changes
```

---

### 💳 **Combo Payment Callback**

**When payment succeeds:**

**Step 1: Convert Component Locks to Orders**
```typescript
// Vanilla component
PlatformStock (Vanilla, nivapp):
  availableqty: 4            ➡️ NO CHANGE (already reduced)
  lockqty: 1 - 1 = 0         ✅ DECREASED (reset)
  orderedqty: 0 + 1 = 1      ✅ INCREASED

Product (Vanilla):
  availablequantity: 10 - 1 = 9   ✅ DECREASED
  orderedquantity: 0 + 1 = 1      ✅ INCREASED

// Sandal component
PlatformStock (Sandal, nivapp):
  availableqty: 0            ➡️ NO CHANGE
  lockqty: 1 - 1 = 0         ✅ DECREASED (reset)
  orderedqty: 0 + 1 = 1      ✅ INCREASED

Product (Sandal):
  availablequantity: 5 - 1 = 4    ✅ DECREASED
  orderedquantity: 0 + 1 = 1      ✅ INCREASED

// Combo Product (productid: 100)
// NO CHANGES (virtual product, no physical stock)
```

**Result After Callback:**
```
Vanilla:
  PlatformStock.orderedqty: 1
  Product.orderedquantity: 1
  Product.availablequantity: 9

Sandal:
  PlatformStock.orderedqty: 1
  Product.orderedquantity: 1
  Product.availablequantity: 4

Combo Pack:
  NO changes (virtual)
```

---

### 🚚 **Combo Dispatch**

**When order is ready for dispatch:**

**Step 1: Allocate Component Stocks**
```typescript
// Allocate 1 Vanilla stock
Stock (Vanilla):
  stockstatus: 'available' → 'sold'  ✅
  orderid: order.orderid
  orderlinenumber: orderline.orderlinenumber

// Allocate 1 Sandal stock
Stock (Sandal):
  stockstatus: 'available' → 'sold'  ✅
  orderid: order.orderid
  orderlinenumber: orderline.orderlinenumber (SAME as Vanilla)
```

**Step 2: Update Component Quantities**
```typescript
// Vanilla component
PlatformStock (Vanilla, nivapp):
  orderedqty: 1 - 1 = 0      ✅ DECREASED
  soldqty: 0 + 1 = 1         ✅ INCREASED

Product (Vanilla):
  orderedquantity: 1 - 1 = 0    ✅ DECREASED
  soldquantity: 0 + 1 = 1       ✅ INCREASED

// Sandal component
PlatformStock (Sandal, nivapp):
  orderedqty: 1 - 1 = 0      ✅ DECREASED
  soldqty: 0 + 1 = 1         ✅ INCREASED

Product (Sandal):
  orderedquantity: 1 - 1 = 0    ✅ DECREASED
  soldquantity: 0 + 1 = 1      ✅ INCREASED

// Combo Product
// NO CHANGES (virtual product)
```

**Result After Dispatch:**
```
Vanilla:
  PlatformStock.soldqty: 1
  Product.soldquantity: 1
  1 Stock record → stockstatus = 'sold'

Sandal:
  PlatformStock.soldqty: 1
  Product.soldquantity: 1
  1 Stock record → stockstatus = 'sold'

Combo Pack:
  NO changes (virtual)
  Orderline shows: productid: 100, quantity: 1 (1 combo pack)
```

---

## 📊 Complete Flow Comparison

### Single Product Flow:
```
Order 2 Vanilla:
  Initiate:   lockqty: 0 → 2, availableqty: 5 → 3
  Callback:   lockqty: 2 → 0, orderedqty: 0 → 2, availablequantity: 10 → 8
  Dispatch:   orderedqty: 2 → 0, soldqty: 0 → 2, soldquantity: 0 → 2
```

### Combo Pack Flow:
```
Order 1 Combo (Vanilla + Sandal):
  Initiate:
    Vanilla:   lockqty: 0 → 1, availableqty: 5 → 4
    Sandal:    lockqty: 0 → 1, availableqty: 1 → 0
    Combo:     NO CHANGES
  
  Callback:
    Vanilla:   lockqty: 1 → 0, orderedqty: 0 → 1, availablequantity: 10 → 9
    Sandal:    lockqty: 1 → 0, orderedqty: 0 → 1, availablequantity: 5 → 4
    Combo:     NO CHANGES
  
  Dispatch:
    Vanilla:   orderedqty: 1 → 0, soldqty: 0 → 1, soldquantity: 0 → 1
    Sandal:    orderedqty: 1 → 0, soldqty: 0 → 1, soldquantity: 0 → 1
    Combo:     NO CHANGES
```

---

## 🎯 Key Points

1. **Component = Individual products in combo** (Vanilla, Sandal)
2. **Combo = Virtual product** (no physical stock, no PlatformStock)
3. **Combo availability = MIN of component availabilities**
4. **Combo order = Lock/Order/Dispatch ALL components together**
5. **Single product logic stays the same** (no changes needed)

---

## ❓ FAQ: Combo Pack Mapping Table Design

### Question: How to handle multiple quantities of same component?

**Example Scenario:**
```
Combo Product: "Vanilla + Strawberry Combo"
- Product 1 (Vanilla): 2 units required
- Product 2 (Strawberry): 1 unit required
```

**❌ WRONG Approach: Duplicate Rows**
```sql
-- DON'T DO THIS
productbundlemap:
| bundleproductid | componentproductid |
|-----------------|-------------------|
| 100 (combo)     | 10 (vanilla)       |
| 100 (combo)     | 10 (vanilla)       |  -- Duplicate row
| 100 (combo)     | 15 (strawberry)    |
```

**Problems with duplicate rows:**
- ❌ Hard to update quantities (need to delete/add rows)
- ❌ Difficult to query (need COUNT or GROUP BY)
- ❌ Error-prone (easy to add/remove wrong number of rows)
- ❌ No clear way to see "how many" of each component

**✅ CORRECT Approach: Use `requiredqty` Column**
```sql
-- DO THIS
CREATE TABLE productbundlemap (
  id BIGINT PRIMARY KEY,
  bundleproductid BIGINT,      -- Combo product ID (e.g., 100)
  componentproductid BIGINT,    -- Component product ID (e.g., 10, 15)
  requiredqty INT,               -- Quantity needed per combo (e.g., 2, 1)
  isactive BOOLEAN DEFAULT true,
  createddate BIGINT,
  modifieddate BIGINT,
  UNIQUE(bundleproductid, componentproductid)  -- Prevent duplicates
);

-- Example Data:
| bundleproductid | componentproductid | requiredqty |
|-----------------|-------------------|-------------|
| 100 (combo)     | 10 (vanilla)       | 2           |
| 100 (combo)     | 15 (strawberry)    | 1           |
```

**Benefits of `requiredqty` column:**
- ✅ Easy to update (just change the number)
- ✅ Simple queries (direct SELECT)
- ✅ Clear and readable
- ✅ Prevents duplicates with UNIQUE constraint
- ✅ Easy to calculate total needed: `requiredqty * combo_quantity`

**Complete SQL Schema:**
```sql
CREATE TABLE productbundlemap (
  id BIGSERIAL PRIMARY KEY,
  bundleproductid BIGINT NOT NULL,      -- Combo product ID
  componentproductid BIGINT NOT NULL,    -- Component product ID
  requiredqty INT NOT NULL DEFAULT 1,    -- Quantity needed per combo
  isactive BOOLEAN DEFAULT true,
  createddate BIGINT,
  modifieddate BIGINT,
  
  -- Prevent duplicate entries
  UNIQUE(bundleproductid, componentproductid),
  
  -- Foreign keys
  FOREIGN KEY (bundleproductid) REFERENCES product(id),
  FOREIGN KEY (componentproductid) REFERENCES product(id)
);

-- Example: Combo with Vanilla (2x) + Strawberry (1x)
INSERT INTO productbundlemap (bundleproductid, componentproductid, requiredqty)
VALUES
  (100, 10, 2),  -- Combo 100 needs 2x Product 10 (Vanilla)
  (100, 15, 1);  -- Combo 100 needs 1x Product 15 (Strawberry)
```

**Example Usage in Code:**
```typescript
// Get all components for a combo
const components = await prisma.productBundleMap.findMany({
  where: { 
    bundleproductid: 100,
    isactive: true 
  }
});

// Result:
// [
//   { componentproductid: 10, requiredqty: 2 },  // Need 2 Vanilla
//   { componentproductid: 15, requiredqty: 1 }  // Need 1 Strawberry
// ]

// When user orders 3 combos:
const comboQuantity = 3;
for (const component of components) {
  const totalNeeded = component.requiredqty * comboQuantity;
  
  // For 3 combos:
  // Vanilla: 2 * 3 = 6 units needed
  // Strawberry: 1 * 3 = 3 units needed
  
  // Lock stock for this component
  await lockComponentStock(component.componentproductid, totalNeeded);
}
```

**Why This is Better:**
1. ✅ **Single source of truth** - One row per component
2. ✅ **Easy updates** - Change `requiredqty` from 2 to 3 without deleting rows
3. ✅ **Simple queries** - No need for COUNT or GROUP BY
4. ✅ **Prevents errors** - UNIQUE constraint prevents accidental duplicates
5. ✅ **Scalable** - Works for any quantity (1, 2, 10, 100+)

**✅ YES - Each component can have different `requiredqty`:**
```sql
-- Example: Combo with different quantities
| bundleproductid | componentproductid | requiredqty |
|-----------------|-------------------|-------------|
| 100 (combo)     | 10 (Vanilla)       | 2           |  ← 2 units needed
| 100 (combo)     | 15 (Strawberry)    | 1           |  ← 1 unit needed
| 100 (combo)     | 20 (Rose)          | 3           |  ← 3 units needed
```

Each component has its own `requiredqty` value - they can all be different!

---

## 📋 Database Schema Changes Required

### 1. Product Table - New Columns

**Add these columns to existing `product` table:**

```sql
-- Migration: Add combo support columns to product table
ALTER TABLE product 
ADD COLUMN iscombo BOOLEAN DEFAULT false,
ADD COLUMN combotype VARCHAR(50) DEFAULT 'fixed';  -- ✅ All combos are fixed for now

-- Add index for faster queries
CREATE INDEX idx_product_iscombo ON product(iscombo) WHERE iscombo = true;
```

**Prisma Schema Update:**
```prisma
model Product {
  // ... existing fields ...
  
  // ✅ NEW: Combo Pack Support
  iscombo    Boolean?  @default(false)
  combotype  String?   @default("fixed") @db.VarChar(50)  // For now: Always "fixed" (not changeable)
  
  // ✅ NEW: Combo Pack Relations
  bundleproducts        ProductBundleMap[] @relation("BundleProducts")
  componentproducts     ProductBundleMap[] @relation("ComponentProducts")
  
  // ... rest of fields ...
}
```

**Note:** 
- Prisma field names use **all lowercase** without underscores (`iscombo`, `combotype`) - matches existing schema style
  - Examples from your schema: `shortdescription`, `orderedquantity`, `soldquantity`, `isdealoftheday`, `ecompublishedquantity`
- Database column names also use **all lowercase** without underscores (`iscombo`, `combotype`) - no mapping needed
- In code, access as: `product.iscombo`, `product.combotype`

**Column Descriptions:**
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `iscombo` | `BOOLEAN` | `false` | `true` = combo product, `false` = single product |
| `combotype` | `VARCHAR(50)` | `"fixed"` | **For now: Always `"fixed"`** - Components cannot be changed after creation |

**✅ Current Implementation: All combos are FIXED (not changeable)**

**📖 Understanding `combotype` Field:**

### `combotype = "fixed"` (Recommended for Most Cases)

**Purpose:** Components are **permanent and cannot be changed** after combo is created.

**Characteristics:**
- ✅ Components are **locked** once combo is created
- ✅ Cannot add/remove components after creation
- ✅ Cannot change `required_qty` after creation
- ✅ **Simpler to manage** - no need to handle component changes
- ✅ **Safer** - prevents breaking existing orders

**Use Cases:**
- Pre-defined gift sets (e.g., "Vanilla + Strawberry Combo" - always these 2)
- Fixed bundles (e.g., "3-Pack Vanilla" - always 3 Vanilla)
- Standard combo packs that don't change

**Example:**
```sql
-- Fixed combo: Vanilla + Strawberry (always the same)
INSERT INTO product (name, iscombo, combotype) 
VALUES ('Vanilla + Strawberry Combo', true, 'fixed');

-- Components never change
INSERT INTO productbundlemap (bundleproductid, componentproductid, requiredqty)
VALUES
  (100, 10, 1),  -- Always 1 Vanilla
  (100, 15, 1);  -- Always 1 Strawberry
```

**Business Rule:**
- If combo has orders → **Cannot modify** components
- If combo has no orders → Can delete and recreate with new components

---

### `combotype = "dynamic"` (Advanced Use Case)

**Purpose:** Components can be **changed or customized** even after combo is created.

**Characteristics:**
- ⚠️ Components can be **added/removed** after creation
- ⚠️ `required_qty` can be **updated** after creation
- ⚠️ More **complex to manage** - need to handle existing orders
- ⚠️ **Risk of breaking orders** if components change while orders exist

**Use Cases:**
- Build-your-own bundles (customer selects components)
- Seasonal combos (components change based on season)
- Promotional combos (components change based on promotions)
- **Note:** This is **NOT recommended** for your current use case

**Example:**
```sql
-- Dynamic combo: Seasonal Gift Set (components can change)
INSERT INTO product (name, iscombo, combotype) 
VALUES ('Seasonal Gift Set', true, 'dynamic');

-- Components can be updated later
-- Summer: Vanilla + Strawberry
-- Winter: Vanilla + Rose + Oudh
```

**Business Rule:**
- Must check for **existing orders** before modifying components
- If orders exist → **Block modification** or handle migration
- Complex logic required to handle component changes

---

### Recommendation: Use `"fixed"` for Your Use Case

**For your current implementation, use `combotype = "fixed"`:**

**Reasons:**
1. ✅ **Simpler implementation** - no need to handle component changes
2. ✅ **Safer** - prevents accidental breaking of existing orders
3. ✅ **Matches your use case** - combo packs are pre-defined
4. ✅ **Easier to test** - predictable behavior
5. ✅ **Better performance** - no need to check for component changes

**Default Behavior:**
```typescript
// When creating combo product
const comboProduct = {
  name: "Vanilla + Strawberry Combo",
  iscombo: true,
  combotype: "fixed",  // ✅ Use "fixed" by default
  // ... other fields
};
```

**If `combotype` is `NULL`:**
- Treat as `"fixed"` (default behavior)
- Components cannot be changed after creation

---

### When to Use `"dynamic"` (Future Enhancement)

**Only use `"dynamic"` if you need:**
- Customer-customizable bundles
- Seasonal component changes
- Promotional component swaps
- **AND** you have logic to handle existing orders

**Implementation Requirements for Dynamic:**
- ✅ Check for existing orders before component changes
- ✅ Block changes if orders exist (or handle migration)
- ✅ Version history of component changes
- ✅ Complex validation logic

**✅ Current Implementation Decision:**
- **All combos are `"fixed"`** - Components cannot be changed after creation
- Set `combotype = "fixed"` when creating combo products
- No need to support `"dynamic"` combos for now
- If `combotype` is `NULL`, treat as `"fixed"` (default behavior)

---

### 2. New Table: `productbundlemap`

**Create new table to map combo products to their components:**

```sql
-- Migration: Create productbundlemap table
CREATE TABLE productbundlemap (
  id BIGSERIAL PRIMARY KEY,
  bundleproductid BIGINT NOT NULL,      -- Combo product ID (references product.id)
  componentproductid BIGINT NOT NULL,    -- Component product ID (references product.id)
  requiredqty INT NOT NULL DEFAULT 1,    -- Quantity needed per combo
  isactive BOOLEAN DEFAULT true,
  createddate BIGINT,
  modifieddate BIGINT,
  
  -- Prevent duplicate entries (same component in same combo)
  CONSTRAINT unique_bundle_component UNIQUE(bundleproductid, componentproductid),
  
  -- Foreign keys
  CONSTRAINT fk_bundle_product FOREIGN KEY (bundleproductid) 
    REFERENCES product(id) ON DELETE CASCADE,
  CONSTRAINT fk_component_product FOREIGN KEY (componentproductid) 
    REFERENCES product(id) ON DELETE RESTRICT
);

-- Indexes for faster queries
CREATE INDEX idx_bundleproductid ON productbundlemap(bundleproductid);
CREATE INDEX idx_componentproductid ON productbundlemap(componentproductid);
CREATE INDEX idx_bundle_active ON productbundlemap(bundleproductid, isactive) 
  WHERE isactive = true;
```

**Prisma Schema Update:**
```prisma
model ProductBundleMap {
  id                  BigInt   @id @default(autoincrement()) @db.BigInt
  bundleproductid     BigInt   @db.BigInt
  componentproductid  BigInt   @db.BigInt
  requiredqty         Int      @default(1)
  isactive            Boolean  @default(true)
  createddate         BigInt?
  modifieddate        BigInt?

  // Relations
  bundleproduct       Product  @relation("BundleProducts", fields: [bundleproductid], references: [id], onDelete: Cascade)
  componentproduct    Product  @relation("ComponentProducts", fields: [componentproductid], references: [id], onDelete: Restrict)

  @@unique([bundleproductid, componentproductid], name: "unique_bundle_component")
  @@index([bundleproductid])
  @@index([componentproductid])
  @@map("productbundlemap")
}
```

**Update Product Model to include relations:**
```prisma
model Product {
  // ... existing fields ...
  
  // ✅ NEW: Combo Pack Relations
  bundleproducts      ProductBundleMap[] @relation("BundleProducts")
  componentproducts   ProductBundleMap[] @relation("ComponentProducts")
}
```

**Note:**
- Prisma field names use **all lowercase** without underscores (`bundleproductid`, `componentproductid`, `requiredqty`, `isactive`) - matches existing schema style
- Database column names also use **all lowercase** without underscores (`bundleproductid`, `componentproductid`, `requiredqty`, `isactive`) - no mapping needed
- In code, access as: `productBundleMap.bundleproductid`, `productBundleMap.componentproductid`, `productBundleMap.requiredqty`

**Table Structure:**
| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | `BIGSERIAL` | Primary key | Auto-increment |
| `bundleproductid` | `BIGINT` | Combo product ID | `100` (combo product) |
| `componentproductid` | `BIGINT` | Component product ID | `10` (Vanilla), `15` (Strawberry) |
| `requiredqty` | `INT` | Quantity needed per combo | `2` (need 2 Vanilla), `1` (need 1 Strawberry) |
| `isactive` | `BOOLEAN` | Active flag | `true` (active), `false` (inactive) |
| `createddate` | `BIGINT` | Creation timestamp | Epoch milliseconds |
| `modifieddate` | `BIGINT` | Last modified timestamp | Epoch milliseconds |

**Example Data:**
```sql
-- Combo Product ID: 100
-- Components: Vanilla (ID: 10, need 2) + Strawberry (ID: 15, need 1)

INSERT INTO productbundlemap (bundleproductid, componentproductid, requiredqty, isactive, createddate, modifieddate)
VALUES
  (100, 10, 2, true, 1701234567890, 1701234567890),  -- Combo 100 needs 2x Vanilla
  (100, 15, 1, true, 1701234567890, 1701234567890);  -- Combo 100 needs 1x Strawberry
```

---

## ✅ Implementation Checklist

### For Combo Pack Support:

1. **Database:**
   - ✅ Add `iscombo` column to Product table (default: `false`)
   - ✅ Add `combotype` column to Product table (optional, default: `NULL`)
   - ✅ Create `productbundlemap` table with `requiredqty` column (NOT duplicate rows)

2. **Order Initiate:**
   - ✅ Detect if product is combo (`iscombo = true`)
   - ✅ Get components from `productbundlemap`
   - ✅ Validate ALL components have enough stock
   - ✅ Lock ALL components atomically (transaction)

3. **Order Callback:**
   - ✅ Convert ALL component locks to orders
   - ✅ Update ALL component Product quantities
   - ✅ Combo product: NO updates

4. **Order Dispatch:**
   - ✅ Allocate stocks for ALL components
   - ✅ Update ALL component PlatformStock and Product quantities
   - ✅ Combo product: NO updates

5. **Availability Calculation:**
   - ✅ Calculate combo availability dynamically
   - ✅ Formula: `MIN(component.availableqty / requiredqty)`

---

## 🏗️ Complete Implementation Skeleton Overview

### Phase 1: Product Creation (Combo Type)

**When:** Admin creates a new combo product

```typescript
// POST /v1/products
// Request Body for Combo Product:
{
  "name": "Vanilla + Strawberry Combo",
  "iscombo": true,              // ✅ NEW FLAG - Set to true for combo products
  "combotype": "fixed",         // Optional: "fixed" | "dynamic" (default: "fixed")
  "price": 299.99,
  "category": "Combo Packs",
  // ... other product fields (shortdescription, fulldescription, etc.)
  
  // ✅ NEW: Component list (REQUIRED if iscombo is true)
  "components": [
    {
      "productid": 10,          // Component product ID (Vanilla)
      "requiredqty": 2          // Quantity needed per combo (minimum: 1)
    },
    {
      "productid": 15,          // Component product ID (Strawberry)
      "requiredqty": 1          // Quantity needed per combo
    }
  ]
}

// Implementation Flow:
// 1. Validate components exist and are not combo products
// 2. Create product with iscombo=true, quantity=0, availablequantity=0
// 3. Create default PlatformStock entries (for all platforms)
// 4. Create productbundlemap entries for each component
// 5. Return created product
```

**API Request Example:**
```json
POST /v1/products
Content-Type: application/json

{
  "name": "Vanilla + Strawberry Combo",
  "iscombo": true,
  "combotype": "fixed",
  "price": 299.99,
  "category": "Combo Packs",
  "shortdescription": "A perfect combination of Vanilla and Strawberry",
  "components": [
    {
      "productid": 10,
      "requiredqty": 2
    },
    {
      "productid": 15,
      "requiredqty": 1
    }
  ]
}
```

**Validation Rules:**
- ✅ If `iscombo` is `true`, `components` array is **REQUIRED**
- ✅ `components` array must have at least 1 component
- ✅ Each component must have valid `productid` (must exist in database)
- ✅ Component products **cannot** be combo products (only single products can be components)
- ✅ `requiredqty` must be at least 1 for each component
- ✅ Combo products automatically get `quantity=0`, `availablequantity=0`, `ecompublishedquantity=0`

**Database Changes:**
- ✅ `product` table: New row with `iscombo = true`
- ✅ `platformstock` table: Default entries for all platforms (amazon, flipkart, nivapp)
- ✅ `productbundlemap` table: Multiple rows (one per component)

---

### Phase 2: Display in E-Commerce (Availability Calculation)

**When:** Frontend requests product list or product details

```typescript
// GET /v1/products/:id or GET /v1/products
async getProductWithAvailability(productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId }
  });

  // Check if combo product
  if (product.iscombo) {
    // ✅ Calculate combo availability dynamically
    const availability = await calculateComboAvailability(productId, 'nivapp');
    
    return {
      ...product,
      availablequantity: availability,        // Calculated
      ecompublishedquantity: availability,    // Calculated
      productstatus: calculateStatus(availability),
      // Components info (optional, for display)
      components: await getComboComponents(productId)
    };
  } else {
    // Single product - return as-is
    return product;
  }
}

// ✅ NEW FUNCTION: Calculate combo availability
async function calculateComboAvailability(
  comboProductId: number, 
  platform: string = 'nivapp'
): Promise<number> {
  // Step 1: Get all components with required quantities
  const components = await prisma.productBundleMap.findMany({
    where: {
      bundleproductid: comboProductId,
      isactive: true
    }
  });

  if (components.length === 0) {
    return 0; // No components = not available
  }

  // Step 2: For each component, calculate how many combos can be made
  const comboAvailabilities: number[] = [];

  for (const component of components) {
    // Get component's platform stock
    const platformStock = await prisma.platformStock.findUnique({
      where: {
        productid_platform: {
          productid: BigInt(component.componentproductid),
          platform: platform
        }
      }
    });

    if (!platformStock) {
      return 0; // Component not on this platform = not available
    }

    // Calculate available stock (excluding locked)
    const availableStock = platformStock.availableqty - platformStock.lockqty;
    
    // Calculate how many combos can be made from this component
    // Formula: availableStock / requiredqty
    const combosFromThisComponent = Math.floor(availableStock / component.requiredqty);
    
    comboAvailabilities.push(combosFromThisComponent);
  }

  // Step 3: Combo availability = MIN of all components
  // (Limited by the component with least availability)
  return Math.min(...comboAvailabilities);
}

// Example Calculation:
// Vanilla (productid: 10): availableqty = 10, requiredqty = 2
//   → Can make: 10 / 2 = 5 combos
// Strawberry (productid: 15): availableqty = 3, requiredqty = 1
//   → Can make: 3 / 1 = 3 combos
// Result: MIN(5, 3) = 3 combos available ✅

// ✅ YES - "3 combos available" means you can order 3 units of the combo product
// This is the maximum quantity of combo packs that can be ordered
// Limited by the component with least availability (Strawberry in this case)
```

**API Response Example:**
```json
{
  "id": 100,
  "name": "Vanilla + Strawberry Combo",
  "iscombo": true,
  "availablequantity": 3,        // ✅ Calculated dynamically
                                  // ✅ This means: User can order 3 combo packs
                                  // ✅ Maximum order quantity = 3
  "ecompublishedquantity": 3,    // ✅ Calculated dynamically
  "productstatus": "low_stock",
  "components": [
    { "productid": 10, "name": "Vanilla", "requiredqty": 2, "available": 10 },
    { "productid": 15, "name": "Strawberry", "requiredqty": 1, "available": 3 }
  ]
}
```

**✅ Clarification:**
- `availablequantity: 3` = **User can order 3 combo packs**
- This is the **maximum quantity** that can be ordered
- Limited by Strawberry (only 3 available, need 1 per combo = max 3 combos)
- If user tries to order 4 combos → **Error: "Only 3 combo(s) available"**

---

### Phase 3: Add to Cart

**When:** User adds combo product to cart

```typescript
// POST /v1/cart/add
async addToCart(userId: number, productId: number, quantity: number) {
  const product = await getProduct(productId);

  if (product.iscombo) {
    // ✅ Validate combo availability before adding to cart
    const available = await calculateComboAvailability(productId, 'nivapp');
    
    if (available < quantity) {
      throw new Error(`Only ${available} combo(s) available`);
    }

    // Add to cart (same as single product)
    return await cartService.addItem({
      userid: userId,
      productid: productId,
      quantity: quantity,
      iscombo: true  // Flag for later processing
    });
  } else {
    // Single product flow (existing logic)
    return await cartService.addItem({
      userid: userId,
      productid: productId,
      quantity: quantity
    });
  }
}
```

**Validation:**
- ✅ Check combo availability before allowing add to cart
- ✅ Show error if insufficient stock

---

### Phase 4: Place Order (Order Initiate)

**When:** User initiates payment (PhonePe/COD)

```typescript
// POST /v1/phonepe/initiate
async initiatePayment(requestBody) {
  for (const orderItem of requestBody.order) {
    const product = await getProduct(orderItem.productid);

    if (product.iscombo) {
      // ✅ COMBO LOGIC: Lock ALL components
      await lockComboComponents(product.id, orderItem.quantity);
    } else {
      // ✅ SINGLE PRODUCT: Existing logic
      await lockSingleProduct(product.id, orderItem.quantity);
    }
  }
}

// ✅ NEW FUNCTION: Lock combo components
async function lockComboComponents(
  comboProductId: number, 
  comboQuantity: number
) {
  // Step 1: Get all components
  const components = await prisma.productBundleMap.findMany({
    where: {
      bundleproductid: comboProductId,
      isactive: true
    }
  });

  // Step 2: Validate ALL components have enough stock
  for (const component of components) {
    const totalNeeded = component.requiredqty * comboQuantity;
    
    const platformStock = await prisma.platformStock.findUnique({
      where: {
        productid_platform: {
          productid: BigInt(component.componentproductid),
          platform: 'nivapp'
        }
      }
    });

    const available = platformStock.availableqty - platformStock.lockqty;
    
    if (available < totalNeeded) {
      throw new Error(
        `Insufficient stock for component ${component.componentproductid}. ` +
        `Need ${totalNeeded}, available ${available}`
      );
    }
  }

  // Step 3: Lock ALL components atomically (transaction)
  await prisma.$transaction(async (tx) => {
    for (const component of components) {
      const totalNeeded = component.requiredqty * comboQuantity;
      
      // Use SELECT FOR UPDATE for row-level locking
      const platformStock = await tx.platformStock.findUnique({
        where: {
          productid_platform: {
            productid: BigInt(component.componentproductid),
            platform: 'nivapp'
          }
        }
      });

      const newAvailableQty = platformStock.availableqty - totalNeeded;
      const newLockQty = platformStock.lockqty + totalNeeded;

      await tx.platformStock.update({
        where: {
          productid_platform: {
            productid: BigInt(component.componentproductid),
            platform: 'nivapp'
          }
        },
        data: {
          availableqty: newAvailableQty,  // DECREASES
          lockqty: newLockQty,            // INCREASES
          modifieddate: BigInt(Date.now())
        }
      });
    }
  });
}

// Example: User orders 2 combos
// Vanilla (requiredqty: 2): Need 2 * 2 = 4 units → Lock 4
// Strawberry (requiredqty: 1): Need 1 * 2 = 2 units → Lock 2

// ✅ IMPORTANT: Calculation Formula
// totalNeeded = component.requiredqty * comboQuantity
// 
// Example 1: Combo (Vanilla: 1, Strawberry: 1), Order 2 combos
//   Vanilla: 1 * 2 = 2 units needed → lockqty +2
//   Strawberry: 1 * 2 = 2 units needed → lockqty +2
//
// Example 2: Combo (Vanilla: 2, Strawberry: 1), Order 2 combos  
//   Vanilla: 2 * 2 = 4 units needed → lockqty +4
//   Strawberry: 1 * 2 = 2 units needed → lockqty +2
```

**What Happens:**
- ✅ Validate ALL components have enough stock
- ✅ Lock ALL components atomically (transaction)
- ✅ If ANY component fails → Rollback all locks

**Quantity Update Example:**
```
Combo: Vanilla (requiredqty: 1) + Strawberry (requiredqty: 1)
User orders: 2 combos

BEFORE Order Initiate:
Vanilla PlatformStock:
  availableqty: 10
  lockqty: 0
  orderedqty: 5

Strawberry PlatformStock:
  availableqty: 5
  lockqty: 0
  orderedqty: 2

AFTER Order Initiate (Locking):
Vanilla PlatformStock:
  availableqty: 10 - 2 = 8    ✅ DECREASED (2 units locked)
  lockqty: 0 + 2 = 2          ✅ INCREASED (2 units locked)
  orderedqty: 5               ➡️ NO CHANGE

Strawberry PlatformStock:
  availableqty: 5 - 2 = 3     ✅ DECREASED (2 units locked)
  lockqty: 0 + 2 = 2         ✅ INCREASED (2 units locked)
  orderedqty: 2               ➡️ NO CHANGE

Calculation:
- Vanilla: requiredqty (1) * comboQuantity (2) = 2 units
- Strawberry: requiredqty (1) * comboQuantity (2) = 2 units
```

---

### Phase 5: Payment Callback (Order Confirmation)

**When:** Payment succeeds (PhonePe callback or COD order created)

```typescript
// POST /v1/phonepe/callback/:transactionId
async updateProductQuantitiesAfterOrder(orderItems) {
  for (const orderItem of orderItems) {
    const product = await getProduct(orderItem.productid);

    if (product.iscombo) {
      // ✅ COMBO LOGIC: Convert component locks to orders
      await convertComboLocksToOrders(product.id, orderItem.quantity);
    } else {
      // ✅ SINGLE PRODUCT: Existing logic
      await convertSingleProductLockToOrder(product.id, orderItem.quantity);
    }
  }
}

// ✅ NEW FUNCTION: Convert combo component locks to orders
async function convertComboLocksToOrders(
  comboProductId: number,
  comboQuantity: number
) {
  const components = await prisma.productBundleMap.findMany({
    where: {
      bundleproductid: comboProductId,
      isactive: true
    }
  });

  for (const component of components) {
    const totalNeeded = component.requiredqty * comboQuantity;
    
    // Get platform stock
    const platformStock = await prisma.platformStock.findUnique({
      where: {
        productid_platform: {
          productid: BigInt(component.componentproductid),
          platform: 'nivapp'
        }
      }
    });

    // Convert lock to order
    const newLockQty = platformStock.lockqty - totalNeeded;
    const newOrderedQty = platformStock.orderedqty + totalNeeded;

    await prisma.platformStock.update({
      where: {
        productid_platform: {
          productid: BigInt(component.componentproductid),
          platform: 'nivapp'
        }
      },
      data: {
        lockqty: newLockQty,      // DECREASES
        orderedqty: newOrderedQty, // INCREASES
        // availableqty: NO CHANGE (already reduced)
        modifieddate: BigInt(Date.now())
      }
    });

    // Update component Product table
    const componentProduct = await prisma.product.findUnique({
      where: { id: component.componentproductid }
    });

    await prisma.product.update({
      where: { id: component.componentproductid },
      data: {
        orderedquantity: componentProduct.orderedquantity + totalNeeded,
        availablequantity: componentProduct.availablequantity - totalNeeded,
        modifieddate: BigInt(Date.now())
      }
    });
  }

  // Combo product itself: NO UPDATES (virtual product)
}
```

**What Happens:**
- ✅ Convert ALL component locks to orders
- ✅ Update ALL component Product quantities
- ✅ Combo product: NO changes (virtual)

**Quantity Update Example (Continuing from Initiate):**
```
AFTER Payment Callback (Lock → Order Conversion):
Vanilla PlatformStock:
  availableqty: 8             ➡️ NO CHANGE (already reduced)
  lockqty: 2 - 2 = 0         ✅ DECREASED (unlocked)
  orderedqty: 5 + 2 = 7      ✅ INCREASED (+2 units)

Vanilla Product:
  availablequantity: 10 - 2 = 8   ✅ DECREASED
  orderedquantity: 5 + 2 = 7      ✅ INCREASED

Strawberry PlatformStock:
  availableqty: 3             ➡️ NO CHANGE (already reduced)
  lockqty: 2 - 2 = 0         ✅ DECREASED (unlocked)
  orderedqty: 2 + 2 = 4      ✅ INCREASED (+2 units)

Strawberry Product:
  availablequantity: 5 - 2 = 3   ✅ DECREASED
  orderedquantity: 2 + 2 = 4     ✅ INCREASED

✅ YES - When you order 2 combos:
   - Vanilla lockqty: +2 (initiate), then -2 (callback)
   - Vanilla orderedqty: +2 (callback)
   - Strawberry lockqty: +2 (initiate), then -2 (callback)
   - Strawberry orderedqty: +2 (callback)
```

---

### Phase 6: Order Dispatch (Ready for Dispatch)

**When:** Warehouse marks order as ready for dispatch

```typescript
// PATCH /v1/orders/:id/ready-for-dispatch
async markReadyForDispatch(orderId: number) {
  const orderlines = await getOrderlines(orderId);

  for (const orderline of orderlines) {
    const product = await getProduct(orderline.productid);

    if (product.iscombo) {
      // ✅ COMBO LOGIC: Allocate component stocks
      await allocateComboStocks(orderline.id, product.id, orderline.quantity);
    } else {
      // ✅ SINGLE PRODUCT: Existing logic
      await allocateSingleProductStocks(orderline.id, product.id, orderline.quantity);
    }
  }
}

// ✅ NEW FUNCTION: Allocate combo component stocks
async function allocateComboStocks(
  orderlineId: number,
  comboProductId: number,
  comboQuantity: number
) {
  const components = await prisma.productBundleMap.findMany({
    where: {
      bundleproductid: comboProductId,
      isactive: true
    }
  });

  const orderline = await prisma.orderline.findUnique({
    where: { id: orderlineId }
  });

  for (const component of components) {
    const totalNeeded = component.requiredqty * comboQuantity;
    
    // Get component product to find puc
    const componentProduct = await prisma.product.findUnique({
      where: { id: component.componentproductid }
    });
    
    // Get available stocks for this component
    const availableStocks = await prisma.stock.findMany({
      where: {
        puc: componentProduct.puc,
        stockstatus: 'available',
        platform: 'nivapp',
        orderid: null  // Not already allocated
      },
      take: totalNeeded
    });

    if (availableStocks.length < totalNeeded) {
      throw new Error(`Insufficient stock for component ${component.componentproductid}`);
    }

    // Mark stocks as sold
    for (const stock of availableStocks) {
      await prisma.stock.update({
        where: { id: stock.id },
        data: {
          stockstatus: 'sold',
          orderid: orderline.orderid,
          orderlinenumber: orderline.orderlinenumber,
          solddate: BigInt(Date.now()),
          modifieddate: BigInt(Date.now())
        }
      });
    }

    // Update component PlatformStock
    const platformStock = await prisma.platformStock.findUnique({
      where: {
        productid_platform: {
          productid: BigInt(component.componentproductid),
          platform: 'nivapp'
        }
      }
    });

    await prisma.platformStock.update({
      where: {
        productid_platform: {
          productid: BigInt(component.componentproductid),
          platform: 'nivapp'
        }
      },
      data: {
        orderedqty: platformStock.orderedqty - totalNeeded,  // DECREASES
        soldqty: platformStock.soldqty + totalNeeded,        // INCREASES
        modifieddate: BigInt(Date.now())
      }
    });

    // Update component Product
    await prisma.product.update({
      where: { id: component.componentproductid },
      data: {
        orderedquantity: componentProduct.orderedquantity - totalNeeded,
        soldquantity: componentProduct.soldquantity + totalNeeded,
        modifieddate: BigInt(Date.now())
      }
    });
  }

  // Combo product itself: NO UPDATES (virtual)
}
```

**What Happens:**
- ✅ Allocate stocks for ALL components
- ✅ Update ALL component PlatformStock and Product quantities
- ✅ Combo product: NO changes (virtual)

---

## 📊 Complete Flow Summary

| Phase | Single Product | Combo Product |
|-------|---------------|---------------|
| **Product Creation** | Create product | Create product + `productbundlemap` entries |
| **Display (E-Commerce)** | Show `availablequantity` | Calculate `MIN(components)` dynamically |
| **Add to Cart** | Validate single product stock | Validate ALL components stock |
| **Order Initiate** | Lock single product | Lock ALL components atomically |
| **Payment Callback** | Convert lock → order | Convert ALL component locks → orders |
| **Order Dispatch** | Allocate single product stocks | Allocate ALL component stocks |

---

## 🔑 Key Points

1. ✅ **`requiredqty` is per component** - Each component can have different quantity
2. ✅ **Combo availability = MIN of all components** - Limited by scarcest component
3. ✅ **All operations are atomic** - Lock/Order/Dispatch ALL components together
4. ✅ **Combo product itself never changes** - Only components are updated
5. ✅ **Single product logic unchanged** - Combo logic is separate code path

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-15

