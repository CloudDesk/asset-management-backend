# GST & HSN Code Mapping - Implementation Plan

## 📋 Overview
Store GST rates and HSN codes for orders based on product subcategory and subsubcategory. This mapping needs to be configurable and easily maintainable.

---

## 🔍 IN-DEPTH REVIEW NOTES

### ⚠️ Critical Findings from Code Review:

**1. Product Model Structure (verified from `prisma/schema.prisma`):**
```prisma
model Product {
  subcategory          String?     @db.VarChar(255)  // e.g., 'incense', 'essential_oils'
  subsubcategory       String?     @db.VarChar(255)  // e.g., 'incense_sticks', 'dhoop_sticks'
}
```
- ⚠️ Product stores **STRING VALUES only**, NOT IDs
- ⚠️ Lookup must be by VALUE, not by ID

**2. Picklist Structure (verified):**
- `fieldname='subcategory'` → `incense`, `car_&_room_fresheners`, `essential_oils`, etc.
- `fieldname='subsubcategory'` → `incense_sticks`, `dhoop_sticks`, `havan_cups`, `car_fresheners`, etc.
  - Each subsubcategory has `parent` pointing to subcategory value

**3. Actual Subsubcategory Values in Picklist (from DB):**
| Value | Parent (subcategory) | fieldname |
|-------|---------------------|-----------|
| incense_sticks | incense | subsubcategory |
| dhoop_sticks | incense | subsubcategory |
| havan_cups | incense | subsubcategory |
| car_fresheners | car_&_room_fresheners | subsubcategory |
| room_fresheners | car_&_room_fresheners | subsubcategory |
| fragrance_sachets | car_&_room_fresheners | subsubcategory |

**4. Key Design Decision:**
- Since Product uses STRING values (not IDs), the primary lookup should be by `subcategory_value` / `subsubcategory_value`
- IDs are optional for referential integrity with picklist

---

## 🎯 Requirements
1. Map subcategory/subsubcategory to HSN code and GST rate
2. Support multiple HSN codes for same subcategory (e.g., Diffusers: 85167990 / 70200090)
3. Easy to update when tax rates change
4. Query efficiently during order creation
5. Store calculated GST amounts in orders/orderlines

## ✅ Recommended Solution: **New Table Approach**

### Why New Table (Not JSON)?
- ✅ **Query Performance**: Fast lookups with indexes
- ✅ **Data Integrity**: Foreign key constraints
- ✅ **Maintainability**: Easy to update via admin UI
- ✅ **Scalability**: Supports complex queries and reporting
- ✅ **Relationships**: Can link to picklist table
- ✅ **Audit Trail**: Track changes with createddate/modifieddate
- ✅ **Validation**: Enforce data types and constraints

## 📊 Database Schema

### Table: `gst_hsn_mapping`

**Important**: A record can have EITHER subcategory OR subsubcategory (not both required)
- **Subcategory-level records**: `essential_oils`, `fragrance_blends`, `diffusers`, `bath`, `body`
  - These subcategories have NO subsubcategory children
- **Subsubcategory-level records**: `incense_sticks`, `dhoop_sticks`, `havan_cups`, `car_fresheners`, `room_fresheners`, `fragrance_sachets`
  - These are children of subcategories `incense` and `car_&_room_fresheners`

```sql
CREATE TABLE gst_hsn_mapping (
  id SERIAL PRIMARY KEY,
  subcategory_id INT,  -- FK to picklist.id where fieldname='subcategory'
  subcategory_value VARCHAR(255),  -- Denormalized for quick lookup (e.g., 'essential_oils', 'diffusers')
  subsubcategory_id INT,  -- FK to picklist.id where fieldname='subsubcategory'
  subsubcategory_value VARCHAR(255),  -- Denormalized for quick lookup (e.g., 'incense_sticks', 'dhoop_sticks', 'car_fresheners')
  
  hsn_code VARCHAR(50) NOT NULL,  -- e.g., '33074100', '33074900', '85167990 / 70200090'
  gst_rate DECIMAL(5,2) NOT NULL,  -- e.g., 5.00, 18.00 (as percentage)
  
  description TEXT,  -- Optional description
  isactive BOOLEAN DEFAULT true,
  createddate BIGINT,
  modifieddate BIGINT,
  
  CONSTRAINT fk_subcategory FOREIGN KEY (subcategory_id) REFERENCES picklist(id) ON DELETE SET NULL,
  CONSTRAINT fk_subsubcategory FOREIGN KEY (subsubcategory_id) REFERENCES picklist(id) ON DELETE SET NULL,

 CONSTRAINT chk_subcategory_or_subsubcategory CHECK (
    (subcategory_id IS NOT NULL AND subcategory_value IS NOT NULL AND subsubcategory_id IS NULL AND subsubcategory_value IS NULL) OR 
    (subsubcategory_id IS NOT NULL AND subsubcategory_value IS NOT NULL AND subcategory_id IS NULL AND subcategory_value IS NULL)
  )
);

-- Regular indexes for performance
CREATE INDEX idx_gst_hsn_subcategory ON gst_hsn_mapping(subcategory_value);
CREATE INDEX idx_gst_hsn_subcategory_id ON gst_hsn_mapping(subcategory_id);
CREATE INDEX idx_gst_hsn_subsubcategory ON gst_hsn_mapping(subsubcategory_value);
CREATE INDEX idx_gst_hsn_subsubcategory_id ON gst_hsn_mapping(subsubcategory_id);
CREATE INDEX idx_gst_hsn_active ON gst_hsn_mapping(isactive);

-- Partial unique indexes to prevent duplicates (handles NULLs properly)
-- Prevents duplicate subcategory + hsn_code combinations
CREATE UNIQUE INDEX idx_unique_subcategory_hsn ON gst_hsn_mapping(subcategory_id, hsn_code) 
  WHERE subcategory_id IS NOT NULL AND subsubcategory_id IS NULL;

-- Prevents duplicate subsubcategory + hsn_code combinations
CREATE UNIQUE INDEX idx_unique_subsubcategory_hsn ON gst_hsn_mapping(subsubcategory_id, hsn_code) 
  WHERE subsubcategory_id IS NOT NULL AND subcategory_id IS NULL;

```

### Prisma Schema Addition

```prisma
model GstHsnMapping {
  id                  Int      @id @default(autoincrement())
  
  // Subcategory mapping (for Essential Oils, Fragrance Blends, Diffusers, Bath, Body)
  subcategory_id      Int?
  subcategory_value   String?  @db.VarChar(255)
  
  // Subsubcategory mapping (for Incense sticks, Dhoop sticks, Havan, Car Fresheners, etc.)
  subsubcategory_id   Int?
  subsubcategory_value String? @db.VarChar(255)
  
  // Tax Information
  hsn_code            String   @db.VarChar(50)
  gst_rate            Decimal  @db.Decimal(5, 2)  // e.g., 5.00, 18.00
  description         String?  @db.Text
  isactive            Boolean? @default(true)
  createddate         BigInt?
  modifieddate        BigInt?
  
  // Relations
  subcategory         Picklist? @relation("SubcategoryMapping", fields: [subcategory_id], references: [id], onDelete: SetNull)
  subsubcategory      Picklist? @relation("SubsubcategoryMapping", fields: [subsubcategory_id], references: [id], onDelete: SetNull)
  
  // Note: Unique constraints handled via partial indexes in SQL (see SQL schema above)
  // Prisma doesn't support partial unique indexes directly, so we'll handle uniqueness in application logic
  @@index([subcategory_value])
  @@index([subcategory_id])
  @@index([subsubcategory_value])
  @@index([subsubcategory_id])
  @@index([isactive])
  @@map("gst_hsn_mapping")
}

// ⚠️ UPDATE existing Picklist model to add these relations:
// (Add these 2 lines to the existing Picklist model in schema.prisma)
model Picklist {
  id                  Int     @id @default(autoincrement())
  label               String? @db.VarChar(255)
  value               String? @db.VarChar(255)
  object              String? @db.VarChar(255)
  controlledvalue     String? @db.VarChar(255)
  fieldname           String? @db.VarChar(255)
  controlledlabel     String? @db.VarChar(255)
  controlledfieldname String? @db.VarChar(255)
  parent              String? @db.VarChar(255)
  description         String? @db.VarChar(255)
  sortorder           Int?
  isactive            Boolean? @default(true)
  createddate         BigInt?
  modifieddate        BigInt?

  // ➕ ADD these 2 relation fields:
  gstHsnMappingsAsSubcategory    GstHsnMapping[] @relation("SubcategoryMapping")
  gstHsnMappingsAsSubsubcategory GstHsnMapping[] @relation("SubsubcategoryMapping")

  @@map("picklist")
}

// ⚠️ UPDATE existing Orders model - ADD these GST fields:
model Orders {
  // ... existing fields ...
  
  // ➕ NEW FIELD: Product-only total (for GST calculation base)
  items_total             Decimal?  @db.Decimal(10, 2)  // Σ(orderline.orderamount) = orderamount - shipping_cost
  
  // ➕ GST aggregation fields (sum from all orderlines)
  total_taxable_amount    Decimal?  @db.Decimal(10, 2)  // Sum of orderline.taxable_amount
  total_cgst_amount       Decimal?  @db.Decimal(10, 2)  // Sum of orderline.cgst_amount
  total_sgst_amount       Decimal?  @db.Decimal(10, 2)  // Sum of orderline.sgst_amount
  total_igst_amount       Decimal?  @db.Decimal(10, 2)  // Sum of orderline.igst_amount
  total_gst_amount        Decimal?  @db.Decimal(10, 2)  // Sum of orderline.total_gst_amount
  
  // Note: Verification → total_taxable_amount + total_gst_amount = items_total
  
  @@map("orders")
}

// ⚠️ UPDATE existing Orderline model - ADD these GST fields:
model Orderline {
  // ... existing fields ...
  
  // ➕ GST fields (per orderline)
  hsn_code                String?   @db.VarChar(50)
  gst_rate                Decimal?  @db.Decimal(5, 2)   // e.g., 5.00, 18.00
  taxable_amount          Decimal?  @db.Decimal(10, 2)  // orderamount / (1 + gst_rate/100)
  cgst_amount             Decimal?  @db.Decimal(10, 2)  // if same state
  sgst_amount             Decimal?  @db.Decimal(10, 2)  // if same state
  igst_amount             Decimal?  @db.Decimal(10, 2)  // if different state
  total_gst_amount        Decimal?  @db.Decimal(10, 2)  // cgst + sgst OR igst
  
  // Note: GST is calculated from orderline.orderamount (which EXCLUDES shipping)
  // Verification → taxable_amount + total_gst_amount = orderamount
  
  @@map("orderline")
}
```

## 📝 Initial Data Population

Based on your requirements, records are stored at EITHER subcategory OR subsubcategory level:

### Records with Subsubcategory (subsubcategory_id + subsubcategory_value):

**These records have `subcategory_id = NULL` and `subcategory_value = NULL`:**

| subsubcategory_value | Picklist Query | HSN Code | GST Rate | Parent Subcategory |
|---------------------|----------------|----------|----------|-------------------|
| incense_sticks | `WHERE value='incense_sticks' AND fieldname='subsubcategory'` | 33074100 | 5% | incense |
| dhoop_sticks | `WHERE value='dhoop_sticks' AND fieldname='subsubcategory'` | 33074100 | 5% | incense |
| havan_cups | `WHERE value='havan_cups' AND fieldname='subsubcategory'` | 33074100 | 5% | incense |
| car_fresheners | `WHERE value='car_fresheners' AND fieldname='subsubcategory'` | 33074900 | 18% | car_&_room_fresheners |
| room_fresheners | `WHERE value='room_fresheners' AND fieldname='subsubcategory'` | 33074900 | 18% | car_&_room_fresheners |
| fragrance_sachets | `WHERE value='fragrance_sachets' AND fieldname='subsubcategory'` | 33074900 | 18% | car_&_room_fresheners |

### Records with Subcategory only (subcategory_id + subcategory_value):

**These records have `subsubcategory_id = NULL` and `subsubcategory_value = NULL`:**

| subcategory_value | Picklist Query | HSN Code | GST Rate | Notes |
|------------------|----------------|----------|----------|-------|
| essential_oils | `WHERE value='essential_oils' AND fieldname='subcategory'` | 33012990 | 18% | No subsubcategory |
| fragrance_blends | `WHERE value='fragrance_blends' AND fieldname='subcategory'` | 33074900 | 18% | No subsubcategory |
| diffusers | `WHERE value='diffusers' AND fieldname='subcategory'` | 85167990 | 18% | HSN option 1 |
| diffusers | `WHERE value='diffusers' AND fieldname='subcategory'` | 70200090 | 18% | HSN option 2 |
| bath | `WHERE value='bath' AND fieldname='subcategory'` | 34011190 | 18% | No subsubcategory |
| body | `WHERE value='body' AND fieldname='subcategory'` | 33049990 | 18% | No subsubcategory |

### SQL Insert Script:

```sql
-- Subsubcategory-level records (for products WITH subsubcategory)
INSERT INTO gst_hsn_mapping (subsubcategory_id, subsubcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '33074100', 5.00, 'Incense - 5% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'incense_sticks' AND fieldname = 'subsubcategory';

INSERT INTO gst_hsn_mapping (subsubcategory_id, subsubcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '33074100', 5.00, 'Dhoop - 5% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'dhoop_sticks' AND fieldname = 'subsubcategory';

INSERT INTO gst_hsn_mapping (subsubcategory_id, subsubcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '33074100', 5.00, 'Havan - 5% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'havan_cups' AND fieldname = 'subsubcategory';

INSERT INTO gst_hsn_mapping (subsubcategory_id, subsubcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '33074900', 18.00, 'Car Fresheners - 18% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'car_fresheners' AND fieldname = 'subsubcategory';

INSERT INTO gst_hsn_mapping (subsubcategory_id, subsubcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '33074900', 18.00, 'Room Fresheners - 18% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'room_fresheners' AND fieldname = 'subsubcategory';

INSERT INTO gst_hsn_mapping (subsubcategory_id, subsubcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '33074900', 18.00, 'Fragrance Sachets - 18% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'fragrance_sachets' AND fieldname = 'subsubcategory';

-- Subcategory-level records (for products WITHOUT subsubcategory)
INSERT INTO gst_hsn_mapping (subcategory_id, subcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '33012990', 18.00, 'Essential Oils - 18% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'essential_oils' AND fieldname = 'subcategory';

INSERT INTO gst_hsn_mapping (subcategory_id, subcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '33074900', 18.00, 'Fragrance Blends - 18% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'fragrance_blends' AND fieldname = 'subcategory';

INSERT INTO gst_hsn_mapping (subcategory_id, subcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '85167990', 18.00, 'Diffusers (Electrical) - 18% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'diffusers' AND fieldname = 'subcategory';

INSERT INTO gst_hsn_mapping (subcategory_id, subcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '70200090', 18.00, 'Diffusers (Glass) - 18% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'diffusers' AND fieldname = 'subcategory';

INSERT INTO gst_hsn_mapping (subcategory_id, subcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '34011190', 18.00, 'Bath Care - 18% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'bath' AND fieldname = 'subcategory';

INSERT INTO gst_hsn_mapping (subcategory_id, subcategory_value, hsn_code, gst_rate, description, isactive, createddate, modifieddate)
SELECT id, value, '33049990', 18.00, 'Body Care - 18% GST', true, EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT
FROM picklist WHERE value = 'body' AND fieldname = 'subcategory';
```

**Important Notes:**
- ✅ For subsubcategory records: `subcategory_id = NULL`, `subcategory_value = NULL`
- ✅ For subcategory records: `subsubcategory_id = NULL`, `subsubcategory_value = NULL`
- ✅ For Diffusers with multiple HSN codes, create two separate rows with same `subcategory_id` but different `hsn_code`
- ✅ Each record must have EITHER subcategory OR subsubcategory (enforced by CHECK constraint)
- ⚠️ **Lookup is by VALUE** (e.g., `subsubcategory_value = 'incense_sticks'`), NOT by ID

## 🔄 Order Creation Flow

### 1. When Creating Order/Orderline:

**Important: GST-Inclusive Pricing**
- ✅ **Product prices are GST-inclusive** (price shown to customer includes GST)
- ✅ **GST is calculated on `orderamount` (after discount)**, NOT `productamount` (before discount)
- This follows Indian GST rules: GST is calculated on the **transaction value** (price actually paid by customer)
- Since price is GST-inclusive, we need to **extract GST** from the final price

```
1. Get product's subcategory and subsubcategory
2. Query gst_hsn_mapping table (priority order):
   - Priority 1: Match by subsubcategory_id/subsubcategory_value (if product has subsubcategory)
   - Priority 2: Match by subcategory_id/subcategory_value (fallback to subcategory level)
3. Get HSN code and GST rate
4. Calculate GST amounts (GST-INCLUSIVE pricing):
   - orderamount = final price after discount (GST-inclusive)
   - taxable_amount = orderamount / (1 + gst_rate/100)  [Extract base amount]
   - total_gst_amount = orderamount - taxable_amount  [GST portion]
   - CGST = total_gst_amount / 2 (if same state)
   - SGST = total_gst_amount / 2 (if same state)
   - IGST = total_gst_amount (if different state)
5. Store in orderline:
   - hsn_code
   - gst_rate
   - taxable_amount (base amount without GST)
   - cgst_amount
   - sgst_amount
   - igst_amount
   - total_gst_amount
   - orderamount (GST-inclusive final price)
```

### Example Calculation (GST-Inclusive) - Single Orderline

**Orderline:**
- `productamount` = ₹1000 (original GST-inclusive price)
- `product_discount_amount` = ₹100 (product discount)
- `promotion_discount_amount` = ₹50 (promotion discount)
- `discountamount` = ₹150 (total discount)
- `orderamount` = ₹850 (final GST-inclusive price after discount)

**GST Calculation (18% GST-inclusive):**
- `orderamount` = ₹850 (GST-inclusive final price)
- `gst_rate` = 18%
- `taxable_amount` = ₹850 / (1 + 18/100) = ₹850 / 1.18 = ₹720.34 (base amount without GST)
- `total_gst_amount` = ₹850 - ₹720.34 = ₹129.66 (GST portion)
- `cgst_amount` = ₹129.66 / 2 = ₹64.83 (if same state)
- `sgst_amount` = ₹129.66 / 2 = ₹64.83 (if same state)
- `igst_amount` = ₹129.66 (if different state)

**Final Invoice Breakdown:**
- Subtotal (base amount, excluding GST): ₹720.34
- CGST (9%): ₹64.83
- SGST (9%): ₹64.83
- **Total (GST-inclusive): ₹850.00**

**Verification:**
- ₹720.34 + ₹129.66 = ₹850.00 ✅

---

## 🚨 CRITICAL CLARIFICATION: GST vs Shipping Cost

### Key Points:

1. **GST is calculated AFTER all discounts** (on `orderamount`, not `productamount`)
2. **Shipping cost is SEPARATE from product GST** (not included in `taxable_amount`)
3. **Each orderline has its own GST calculation** based on its `orderamount`
4. **Order-level GST is the SUM of all orderline GST amounts**

### What is `taxable_amount`?

```
taxable_amount = orderamount / (1 + gst_rate/100)

Where:
- orderamount = productamount - promotion_discount_amount
- orderamount is GST-INCLUSIVE (price customer pays for the PRODUCT)
- taxable_amount is the BASE amount (excluding GST)
```

### Shipping Cost Treatment:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SHIPPING COST IS NOT INCLUDED IN PRODUCT GST CALCULATION              │
│  ─────────────────────────────────────────────────────────────────────  │
│  Shipping is a SEPARATE charge with its own GST (if applicable)         │
│  For now: We calculate GST only on product amounts, not shipping        │
└─────────────────────────────────────────────────────────────────────────┘

Option A (Current Implementation - Recommended):
  - Product GST: Calculate on orderline.orderamount
  - Shipping: Stored separately, no GST calculation for now
  - Future: Add shipping_gst_amount if needed

Option B (Alternative):
  - Shipping has 18% GST (courier services SAC 996812)
  - Would need separate shipping_taxable_amount, shipping_gst_amount fields
```

---

## 📊 COMPLETE EXAMPLE: Multi-Product Order with GST

### Scenario (from PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE.md Example 3):

```
Product 1 (Incense Sticks): ₹500 × 2 qty = ₹1000 (GST-inclusive)
  - Product discount: ₹25/unit = ₹50 total
  - GST Rate: 5% (HSN: 33074100)

Product 2 (Essential Oils): ₹400 × 1 qty = ₹400 (GST-inclusive)
  - Product discount: ₹0
  - GST Rate: 18% (HSN: 33012990)

Promotion: Flat ₹500 off (coupon)
Shipping: ₹150 (fixed, order < ₹1000)
```

### Step-by-Step Calculation:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CALCULATE AMOUNTS (from PhonePe flow)                         │
└─────────────────────────────────────────────────────────────────────────┘

ORDERLINE 1 (Product 1 - Incense Sticks, 5% GST):
─────────────────────────────────────────────────
original_price          = ₹1000
product_discount_amount = ₹50
productamount           = ₹950
promotion_discount_amount = (950/1350) × 500 = ₹351.85
orderamount             = 950 - 351.85 = ₹598.15   ← GST calculated on THIS

ORDERLINE 2 (Product 2 - Essential Oils, 18% GST):
─────────────────────────────────────────────────
original_price          = ₹400
product_discount_amount = ₹0
productamount           = ₹400
promotion_discount_amount = (400/1350) × 500 = ₹148.15
orderamount             = 400 - 148.15 = ₹251.85   ← GST calculated on THIS


┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: CALCULATE GST FOR EACH ORDERLINE                              │
└─────────────────────────────────────────────────────────────────────────┘

ORDERLINE 1 GST (5% on ₹598.15):
─────────────────────────────────
hsn_code        = '33074100'
gst_rate        = 5.00
orderamount     = ₹598.15 (GST-inclusive)
taxable_amount  = 598.15 / 1.05 = ₹569.67
total_gst_amount = 598.15 - 569.67 = ₹28.48
cgst_amount     = 28.48 / 2 = ₹14.24 (same state)
sgst_amount     = 28.48 / 2 = ₹14.24 (same state)
igst_amount     = ₹0.00

ORDERLINE 2 GST (18% on ₹251.85):
─────────────────────────────────
hsn_code        = '33012990'
gst_rate        = 18.00
orderamount     = ₹251.85 (GST-inclusive)
taxable_amount  = 251.85 / 1.18 = ₹213.43
total_gst_amount = 251.85 - 213.43 = ₹38.42
cgst_amount     = 38.42 / 2 = ₹19.21 (same state)
sgst_amount     = 38.42 / 2 = ₹19.21 (same state)
igst_amount     = ₹0.00


┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: AGGREGATE TO ORDER LEVEL                                      │
└─────────────────────────────────────────────────────────────────────────┘

ORDER TOTALS:
─────────────────────────────────
total_taxable_amount = 569.67 + 213.43 = ₹783.10
total_cgst_amount    = 14.24 + 19.21   = ₹33.45
total_sgst_amount    = 14.24 + 19.21   = ₹33.45
total_igst_amount    = 0 + 0           = ₹0.00
total_gst_amount     = 28.48 + 38.42   = ₹66.90

Σ(orderamount)       = 598.15 + 251.85 = ₹850.00 (product total)
shipping_cost        = ₹150.00 (NOT in GST calculation)
order.orderamount    = 850 + 150       = ₹1000.00 (final order total)
```

### Verification:

```
PRODUCT GST VERIFICATION:
─────────────────────────────────
total_taxable_amount + total_gst_amount = 783.10 + 66.90 = ₹850.00 ✅
(This equals Σ(orderline.orderamount), NOT order.orderamount which includes shipping)

FULL ORDER BREAKDOWN:
─────────────────────────────────
Product Subtotal (excluding GST): ₹783.10
CGST:                             ₹33.45
SGST:                             ₹33.45
Product Total (GST-inclusive):    ₹850.00
Shipping:                         ₹150.00
─────────────────────────────────
ORDER TOTAL:                      ₹1000.00 ✅
```

### Final Database Values:

```sql
-- ORDERLINE 1 (Incense Sticks - 5% GST)
┌─────────────────────────────┬──────────┐
│ Field                       │ Value    │
├─────────────────────────────┼──────────┤
│ productid                   │ 1        │
│ original_price              │ ₹1000.00 │
│ product_discount_amount     │ ₹50.00   │
│ productamount               │ ₹950.00  │
│ promotion_discount_amount   │ ₹351.85  │
│ discountamount              │ ₹401.85  │
│ orderamount                 │ ₹598.15  │  ← GST calculated on this
│ shipping_cost               │ ₹105.56  │  ← NOT in GST calculation
│ hsn_code                    │ 33074100 │
│ gst_rate                    │ 5.00     │
│ taxable_amount              │ ₹569.67  │  ← Base amount (excl. GST)
│ cgst_amount                 │ ₹14.24   │
│ sgst_amount                 │ ₹14.24   │
│ igst_amount                 │ ₹0.00    │
│ total_gst_amount            │ ₹28.48   │
└─────────────────────────────┴──────────┘

-- ORDERLINE 2 (Essential Oils - 18% GST)
┌─────────────────────────────┬──────────┐
│ Field                       │ Value    │
├─────────────────────────────┼──────────┤
│ productid                   │ 2        │
│ original_price              │ ₹400.00  │
│ product_discount_amount     │ ₹0.00    │
│ productamount               │ ₹400.00  │
│ promotion_discount_amount   │ ₹148.15  │
│ discountamount              │ ₹148.15  │
│ orderamount                 │ ₹251.85  │  ← GST calculated on this
│ shipping_cost               │ ₹44.44   │  ← NOT in GST calculation
│ hsn_code                    │ 33012990 │
│ gst_rate                    │ 18.00    │
│ taxable_amount              │ ₹213.43  │  ← Base amount (excl. GST)
│ cgst_amount                 │ ₹19.21   │
│ sgst_amount                 │ ₹19.21   │
│ igst_amount                 │ ₹0.00    │
│ total_gst_amount            │ ₹38.42   │
└─────────────────────────────┴──────────┘

-- ORDER (Aggregated)
┌─────────────────────────────┬──────────┬─────────────────────────────────────────┐
│ Field                       │ Value    │ Notes                                   │
├─────────────────────────────┼──────────┼─────────────────────────────────────────┤
│ original_total              │ ₹1400.00 │ Before any discounts                    │
│ productamount               │ ₹1350.00 │ After product discount, before promo    │
│ discountamount              │ ₹550.00  │ All discounts (product + promo)         │
│ promotion_discount_total    │ ₹500.00  │ Promo discount only                     │
├─────────────────────────────┼──────────┼─────────────────────────────────────────┤
│ items_total ⭐ NEW          │ ₹850.00  │ Σ(orderline.orderamount) - GST BASE     │
│ shipping_cost               │ ₹150.00  │ Shipping (NOT in GST)                   │
│ orderamount                 │ ₹1000.00 │ items_total + shipping = CUSTOMER PAYS  │
├─────────────────────────────┼──────────┼─────────────────────────────────────────┤
│ total_taxable_amount        │ ₹783.10  │ Σ(orderline.taxable_amount)             │
│ total_cgst_amount           │ ₹33.45   │ Σ(orderline.cgst_amount)                │
│ total_sgst_amount           │ ₹33.45   │ Σ(orderline.sgst_amount)                │
│ total_igst_amount           │ ₹0.00    │ Σ(orderline.igst_amount)                │
│ total_gst_amount            │ ₹66.90   │ Σ(orderline.total_gst_amount)           │
└─────────────────────────────┴──────────┴─────────────────────────────────────────┘

VERIFICATION EQUATIONS:
───────────────────────────────────────────────────────────────────────────
① items_total (₹850) = orderamount (₹1000) - shipping_cost (₹150) ✅
② items_total (₹850) = Σ(orderline.orderamount) = 598.15 + 251.85 ✅
③ total_taxable_amount (₹783.10) + total_gst_amount (₹66.90) = items_total (₹850) ✅
④ orderamount (₹1000) = items_total (₹850) + shipping_cost (₹150) ✅
```

### Key Formulas Summary:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  GST CALCULATION FORMULAS                                               │
└─────────────────────────────────────────────────────────────────────────┘

FOR EACH ORDERLINE:
───────────────────────────────────────────────────────────────────────────
1. Get gst_rate from gst_hsn_mapping (based on subcategory/subsubcategory)
2. taxable_amount = orderamount / (1 + gst_rate/100)
3. total_gst_amount = orderamount - taxable_amount
4. IF same_state:
     cgst_amount = total_gst_amount / 2
     sgst_amount = total_gst_amount / 2
     igst_amount = 0
   ELSE:
     cgst_amount = 0
     sgst_amount = 0
     igst_amount = total_gst_amount

FOR ORDER (AGGREGATE):
───────────────────────────────────────────────────────────────────────────
items_total          = Σ(orderline.orderamount)  ⭐ NEW - GST taxable base
                     = orderamount - shipping_cost

total_taxable_amount = Σ(orderline.taxable_amount)
total_cgst_amount    = Σ(orderline.cgst_amount)
total_sgst_amount    = Σ(orderline.sgst_amount)
total_igst_amount    = Σ(orderline.igst_amount)
total_gst_amount     = Σ(orderline.total_gst_amount)

VERIFICATION EQUATIONS:
───────────────────────────────────────────────────────────────────────────
① items_total = Σ(orderline.orderamount) ✅
② items_total = orderamount - shipping_cost ✅
③ total_taxable_amount + total_gst_amount = items_total ✅
④ orderamount = items_total + shipping_cost ✅

⚠️ IMPORTANT: GST is calculated on items_total, NOT on orderamount!
   orderamount includes shipping, but GST is on products only.
```

### Visual Flow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GST CALCULATION FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

     ┌─────────────────┐
     │ Product Price   │
     │ (GST-inclusive) │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │ Apply Product   │
     │ Discount        │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │ productamount   │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │ Apply Promotion │
     │ Discount        │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │ orderamount     │  ← GST CALCULATED HERE (per orderline)
     │ (GST-inclusive) │
     └────────┬────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌─────────┐        ┌─────────────┐
│taxable  │        │total_gst    │
│_amount  │        │_amount      │
│(base)   │        │             │
└─────────┘        └──────┬──────┘
                          │
                   ┌──────┴──────┐
                   │             │
                   ▼             ▼
              ┌─────────┐   ┌─────────┐
              │ CGST    │   │ SGST    │
              │ (9%)    │   │ (9%)    │  ← If same state
              └─────────┘   └─────────┘
                   OR
              ┌─────────────────┐
              │      IGST       │
              │     (18%)       │  ← If different state
              └─────────────────┘


     ┌─────────────────────────────────────────────────────────────┐
     │  SHIPPING COST IS SEPARATE - NOT PART OF PRODUCT GST       │
     │  ─────────────────────────────────────────────────────────  │
     │  shipping_cost = ₹150 (stored separately)                  │
     │  order.orderamount = Σ(orderline.orderamount) + shipping   │
     │                    = ₹850 + ₹150 = ₹1000                   │
     └─────────────────────────────────────────────────────────────┘
```

### 2. Database Fields to Add:

## 🚨 IMPORTANT: Understanding Current `orderamount` Field

### Current Implementation (from phonepe.controller.ts):

```typescript
// Line 2554 - Order level
orderamount: parseFloat(transaction.amount?.toString() || "0")
// This is transaction.amount from PhonePe = TOTAL customer pays = products + shipping

// Line 2574 - Shipping stored separately
shipping_cost: shippingCost
```

### Current Field Relationships:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CURRENT SCHEMA BREAKDOWN                                               │
└─────────────────────────────────────────────────────────────────────────┘

ORDER LEVEL:
───────────────────────────────────────────────────────────────────────────
orders.orderamount    = transaction.amount (from PhonePe/COD request)
                      = (productAmount - promotionDiscount) + shipping_cost
                      = INCLUDES shipping ⚠️

orders.shipping_cost  = shipping amount (stored separately)
orders.productamount  = original - productDiscount (before promotion)

ORDERLINE LEVEL:
───────────────────────────────────────────────────────────────────────────
orderline.orderamount = productamount - promotion_discount_amount
                      = EXCLUDES shipping ✅ (per-item product price only)

orderline.shipping_cost = pro-rata shipping (stored separately)

RELATIONSHIP:
───────────────────────────────────────────────────────────────────────────
orders.orderamount = Σ(orderline.orderamount) + orders.shipping_cost
       ₹1000      =        ₹850            +        ₹150
```

### Problem for GST Calculation:

```
❌ WRONG: Calculate GST on orders.orderamount (includes shipping)
✅ RIGHT: Calculate GST on Σ(orderline.orderamount) (products only)

GST should NOT include shipping cost!
```

### Solution: Add `items_total` Field for GST Base

We need a new field at order level to store the PRODUCT-ONLY total (excluding shipping):

```
items_total = Σ(orderline.orderamount) = orders.orderamount - orders.shipping_cost
            = The GST taxable base at order level
```

---

**orderline table (GST per line item):**
```sql
ALTER TABLE orderline ADD COLUMN hsn_code VARCHAR(50);
ALTER TABLE orderline ADD COLUMN gst_rate DECIMAL(5,2);
ALTER TABLE orderline ADD COLUMN taxable_amount DECIMAL(10,2);  -- Base amount without GST
ALTER TABLE orderline ADD COLUMN cgst_amount DECIMAL(10,2);     -- CGST amount (if same state)
ALTER TABLE orderline ADD COLUMN sgst_amount DECIMAL(10,2);     -- SGST amount (if same state)
ALTER TABLE orderline ADD COLUMN igst_amount DECIMAL(10,2);     -- IGST amount (if different state)
ALTER TABLE orderline ADD COLUMN total_gst_amount DECIMAL(10,2); -- Total GST (CGST+SGST or IGST)
-- Note: orderamount already exists = GST-inclusive PRODUCT price (NO shipping)
-- GST is calculated FROM orderline.orderamount
```

**orders table (aggregated totals):**
```sql
-- ⚠️ NEW FIELD: Sum of orderline.orderamount (PRODUCT ONLY, excludes shipping)
ALTER TABLE orders ADD COLUMN items_total DECIMAL(10,2);  -- Σ(orderline.orderamount) = orderamount - shipping_cost

-- GST aggregation fields
ALTER TABLE orders ADD COLUMN total_taxable_amount DECIMAL(10,2);  -- Sum of all taxable_amount from orderlines
ALTER TABLE orders ADD COLUMN total_cgst_amount DECIMAL(10,2);     -- Sum of all cgst_amount from orderlines
ALTER TABLE orders ADD COLUMN total_sgst_amount DECIMAL(10,2);     -- Sum of all sgst_amount from orderlines
ALTER TABLE orders ADD COLUMN total_igst_amount DECIMAL(10,2);     -- Sum of all igst_amount from orderlines
ALTER TABLE orders ADD COLUMN total_gst_amount DECIMAL(10,2);      -- Sum of all total_gst_amount from orderlines

-- EXISTING FIELDS (already in schema):
-- orderamount = items_total + shipping_cost (INCLUDES shipping) - final customer pays
-- shipping_cost = shipping charge (separate)
-- productamount = before promotion discounts

-- VERIFICATION:
-- total_taxable_amount + total_gst_amount = items_total (NOT orderamount!)
-- items_total + shipping_cost = orderamount ✅
```

### Field Relationship Summary:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ORDER TABLE FIELD RELATIONSHIPS                                        │
└─────────────────────────────────────────────────────────────────────────┘

original_total (₹1400)          ← Sum of base prices before any discount
        │
        ▼
productamount (₹1350)           ← After product discounts, before promo
        │
        ▼
items_total (₹850) ⭐ NEW       ← Σ(orderline.orderamount) = products after ALL discounts
        │                         THIS is the GST taxable base
        │
        ├── total_taxable_amount (₹783.10) ← Base amount (excl. GST)
        └── total_gst_amount (₹66.90)      ← GST portion
        
        │
        + shipping_cost (₹150)
        │
        ▼
orderamount (₹1000)             ← Final customer pays (products + shipping)


VERIFICATION EQUATIONS:
───────────────────────────────────────────────────────────────────────────
① items_total = Σ(orderline.orderamount)
② items_total = orderamount - shipping_cost
③ total_taxable_amount + total_gst_amount = items_total
④ orderamount = items_total + shipping_cost
```

## 🛠️ Implementation Steps

---

## 🚀 CONFIRMED IMPLEMENTATION PLAN

### ✅ Key Principles (NO changes to existing logic):

1. **`orderamount` stays UNCHANGED** - Still includes shipping, no modification
2. **New field `items_total`** = orderamount - shipping_cost (for GST calculation base)
3. **Only NEW columns are populated** - No changes to existing calculations
4. **Default GST** = 18% with `hsn_code = null` if no mapping found

---

## 📍 CGST/SGST/IGST Logic: Tamil Nadu Check

### Tamil Nadu Pincode Ranges:
```
Tamil Nadu pincodes: 600001 - 643253 (approximately)

Ranges:
- Chennai: 600001 - 600119
- Kancheepuram: 600001 - 603399
- Tiruvallur: 600053 - 602117
- Vellore: 632001 - 635901
- Tiruvannamalai: 604001 - 606901
- Villupuram: 604001 - 607901
- Cuddalore: 607001 - 608901
- Nagapattinam: 609001 - 611901
- Thanjavur: 612001 - 614901
- Tiruvarur: 609001 - 612901
- Pudukkottai: 614001 - 622901
- Trichy: 620001 - 621901
- Karur: 639001 - 639901
- Perambalur: 621001 - 621901
- Ariyalur: 621001 - 621901
- Salem: 636001 - 637901
- Namakkal: 637001 - 638901
- Erode: 638001 - 638901
- Tiruppur: 641001 - 642901
- Coimbatore: 641001 - 642901
- The Nilgiris: 643001 - 643253
- Dindigul: 624001 - 624901
- Madurai: 625001 - 625901
- Theni: 625501 - 625901
- Virudhunagar: 626001 - 626901
- Sivaganga: 623001 - 623901
- Ramanathapuram: 623501 - 623901
- Thoothukudi: 628001 - 628901
- Tirunelveli: 627001 - 628901
- Kanyakumari: 629001 - 629901
```

### Simplified Tamil Nadu Check (Using Range):
```typescript
/**
 * Check if pincode is in Tamil Nadu
 * Tamil Nadu pincodes start with 60, 61, 62, 63, 64
 */
function isTamilNaduPincode(pincode: string | number): boolean {
  const pin = pincode.toString().trim();
  if (pin.length !== 6) return false;
  
  const prefix = parseInt(pin.substring(0, 2));
  // Tamil Nadu pincodes: 60xxxx to 64xxxx
  return prefix >= 60 && prefix <= 64;
}
```

### CGST/SGST/IGST Decision Logic:

```typescript
/**
 * Determine GST type based on delivery address
 * @param addressPincode - Delivery address pincode
 * @returns { isSameState: boolean, cgstRate: number, sgstRate: number, igstRate: number }
 */
function getGstType(addressPincode: string | number, gstRate: number): {
  isSameState: boolean;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_gst_amount: number;
} {
  // Assume seller is in Tamil Nadu
  const isTamilNadu = isTamilNaduPincode(addressPincode);
  
  // Calculate total GST from orderamount (GST-inclusive)
  // This is passed as parameter from orderline calculation
  
  if (isTamilNadu) {
    // Same state (Tamil Nadu) → CGST + SGST
    return {
      isSameState: true,
      cgst_amount: total_gst_amount / 2,
      sgst_amount: total_gst_amount / 2,
      igst_amount: 0,
      total_gst_amount: total_gst_amount
    };
  } else {
    // Different state → IGST
    return {
      isSameState: false,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: total_gst_amount,
      total_gst_amount: total_gst_amount
    };
  }
}
```

---

## 📋 COMPLETE IMPLEMENTATION FLOW

### Step 1: Get Address Pincode
```typescript
// From order.addressid → address.pincode
const address = await prisma.address.findUnique({
  where: { id: order.addressid }
});
const deliveryPincode = address?.pincode || '';
const isTamilNadu = isTamilNaduPincode(deliveryPincode);
```

### Step 2: For Each Orderline - Get GST Mapping
```typescript
// Get product with subcategory/subsubcategory
const product = await prisma.product.findUnique({
  where: { id: orderline.productid },
  select: { subcategory: true, subsubcategory: true }
});

// Lookup GST mapping (priority: subsubcategory first, then subcategory)
let gstMapping = null;

if (product.subsubcategory) {
  // Priority 1: Match by subsubcategory_value
  gstMapping = await prisma.gstHsnMapping.findFirst({
    where: {
      subsubcategory_value: product.subsubcategory,
      subsubcategory_id: { not: null },
      subcategory_id: null,
      isactive: true
    }
  });
}

if (!gstMapping && product.subcategory) {
  // Priority 2: Fallback to subcategory_value
  gstMapping = await prisma.gstHsnMapping.findFirst({
    where: {
      subcategory_value: product.subcategory,
      subcategory_id: { not: null },
      subsubcategory_id: null,
      isactive: true
    }
  });
}

// Default: 18% GST, null HSN if no mapping found
const hsn_code = gstMapping?.hsn_code || null;
const gst_rate = gstMapping ? parseFloat(gstMapping.gst_rate.toString()) : 18.00;
```

### Step 3: Calculate GST Amounts for Orderline
```typescript
// orderline.orderamount is GST-INCLUSIVE and EXCLUDES shipping
const orderamount = parseFloat(orderline.orderamount?.toString() || '0');

// Extract taxable amount (reverse calculation)
const taxable_amount = orderamount / (1 + gst_rate / 100);
const total_gst_amount = orderamount - taxable_amount;

// Split into CGST/SGST or IGST based on Tamil Nadu check
let cgst_amount = 0;
let sgst_amount = 0;
let igst_amount = 0;

if (isTamilNadu) {
  cgst_amount = total_gst_amount / 2;
  sgst_amount = total_gst_amount / 2;
} else {
  igst_amount = total_gst_amount;
}

// Round to 2 decimal places
const roundTo2 = (n: number) => Math.round(n * 100) / 100;

// Update orderline with GST fields
await prisma.orderline.update({
  where: { id: orderline.id },
  data: {
    hsn_code: hsn_code,
    gst_rate: roundTo2(gst_rate),
    taxable_amount: roundTo2(taxable_amount),
    cgst_amount: roundTo2(cgst_amount),
    sgst_amount: roundTo2(sgst_amount),
    igst_amount: roundTo2(igst_amount),
    total_gst_amount: roundTo2(total_gst_amount)
  }
});
```

### Step 4: Aggregate to Order Level
```typescript
// After all orderlines are processed, aggregate to order
const orderlines = await prisma.orderline.findMany({
  where: { orderid: order.id },
  select: {
    orderamount: true,
    taxable_amount: true,
    cgst_amount: true,
    sgst_amount: true,
    igst_amount: true,
    total_gst_amount: true
  }
});

// Calculate order-level GST totals
const items_total = orderlines.reduce((sum, ol) => 
  sum + parseFloat(ol.orderamount?.toString() || '0'), 0);

const total_taxable_amount = orderlines.reduce((sum, ol) => 
  sum + parseFloat(ol.taxable_amount?.toString() || '0'), 0);

const total_cgst_amount = orderlines.reduce((sum, ol) => 
  sum + parseFloat(ol.cgst_amount?.toString() || '0'), 0);

const total_sgst_amount = orderlines.reduce((sum, ol) => 
  sum + parseFloat(ol.sgst_amount?.toString() || '0'), 0);

const total_igst_amount = orderlines.reduce((sum, ol) => 
  sum + parseFloat(ol.igst_amount?.toString() || '0'), 0);

const total_gst_amount = orderlines.reduce((sum, ol) => 
  sum + parseFloat(ol.total_gst_amount?.toString() || '0'), 0);

// Update order with aggregated GST fields
// NOTE: orderamount is NOT changed - stays as is (includes shipping)
await prisma.orders.update({
  where: { id: order.id },
  data: {
    items_total: roundTo2(items_total),  // NEW: product-only total
    total_taxable_amount: roundTo2(total_taxable_amount),
    total_cgst_amount: roundTo2(total_cgst_amount),
    total_sgst_amount: roundTo2(total_sgst_amount),
    total_igst_amount: roundTo2(total_igst_amount),
    total_gst_amount: roundTo2(total_gst_amount)
    // orderamount: NOT MODIFIED - stays unchanged
  }
});
```

---

## 🔄 VERIFICATION EQUATIONS

```
ORDERLINE LEVEL:
───────────────────────────────────────────────────────────────────
taxable_amount + total_gst_amount = orderamount ✅
cgst_amount + sgst_amount + igst_amount = total_gst_amount ✅
(cgst_amount > 0) XOR (igst_amount > 0) ✅ (never both)

ORDER LEVEL:
───────────────────────────────────────────────────────────────────
① items_total = Σ(orderline.orderamount) ✅
② items_total = orderamount - shipping_cost ✅
③ total_taxable_amount + total_gst_amount = items_total ✅
④ orderamount = items_total + shipping_cost ✅ (unchanged)
⑤ total_cgst_amount + total_sgst_amount + total_igst_amount = total_gst_amount ✅
```

---

## 📊 EXAMPLE: Complete Calculation

```
SCENARIO:
─────────────────────────────────────────────────────────────────
Order with 2 products, delivery to Chennai (Tamil Nadu - 600001)
Shipping: ₹150

Product 1 (Incense Sticks - 5% GST):
  orderline.orderamount = ₹598.15

Product 2 (Essential Oils - 18% GST):
  orderline.orderamount = ₹251.85


ORDERLINE 1 (5% GST, Tamil Nadu):
─────────────────────────────────────────────────────────────────
hsn_code        = '33074100'
gst_rate        = 5.00
taxable_amount  = 598.15 / 1.05 = ₹569.67
total_gst_amount = 598.15 - 569.67 = ₹28.48
cgst_amount     = 28.48 / 2 = ₹14.24 ✅ (Tamil Nadu)
sgst_amount     = 28.48 / 2 = ₹14.24 ✅ (Tamil Nadu)
igst_amount     = ₹0.00


ORDERLINE 2 (18% GST, Tamil Nadu):
─────────────────────────────────────────────────────────────────
hsn_code        = '33012990'
gst_rate        = 18.00
taxable_amount  = 251.85 / 1.18 = ₹213.43
total_gst_amount = 251.85 - 213.43 = ₹38.42
cgst_amount     = 38.42 / 2 = ₹19.21 ✅ (Tamil Nadu)
sgst_amount     = 38.42 / 2 = ₹19.21 ✅ (Tamil Nadu)
igst_amount     = ₹0.00


ORDER AGGREGATION:
─────────────────────────────────────────────────────────────────
items_total          = 598.15 + 251.85 = ₹850.00 (NEW field)
shipping_cost        = ₹150.00 (existing, unchanged)
orderamount          = ₹1000.00 (existing, UNCHANGED ✅)

total_taxable_amount = 569.67 + 213.43 = ₹783.10
total_cgst_amount    = 14.24 + 19.21 = ₹33.45
total_sgst_amount    = 14.24 + 19.21 = ₹33.45
total_igst_amount    = 0 + 0 = ₹0.00
total_gst_amount     = 28.48 + 38.42 = ₹66.90

VERIFY: 783.10 + 66.90 = ₹850 = items_total ✅
VERIFY: 850 + 150 = ₹1000 = orderamount ✅ (unchanged)
```

---

## 📊 EXAMPLE: Different State (Delhi - 110001)

```
Same products, but delivery to Delhi (NOT Tamil Nadu - 110001)

ORDERLINE 1 (5% GST, Different State):
─────────────────────────────────────────────────────────────────
taxable_amount  = ₹569.67
total_gst_amount = ₹28.48
cgst_amount     = ₹0.00 ❌ (not Tamil Nadu)
sgst_amount     = ₹0.00 ❌ (not Tamil Nadu)
igst_amount     = ₹28.48 ✅ (IGST for different state)


ORDERLINE 2 (18% GST, Different State):
─────────────────────────────────────────────────────────────────
taxable_amount  = ₹213.43
total_gst_amount = ₹38.42
cgst_amount     = ₹0.00 ❌
sgst_amount     = ₹0.00 ❌
igst_amount     = ₹38.42 ✅


ORDER AGGREGATION:
─────────────────────────────────────────────────────────────────
total_cgst_amount    = 0 + 0 = ₹0.00
total_sgst_amount    = 0 + 0 = ₹0.00
total_igst_amount    = 28.48 + 38.42 = ₹66.90
total_gst_amount     = ₹66.90 (same total, different split)
```

---

### Phase 1: Database Setup
1. ✅ Create `gst_hsn_mapping` table
2. ✅ Add Prisma model
3. ✅ Create migration
4. ✅ Populate initial data

### Phase 2: Service Layer
1. ✅ Create `GstHsnService`:
   - `getGstHsnBySubcategory(subcategory, subsubcategory?)`
   - `getAllMappings()`
   - `createMapping()`
   - `updateMapping()`
   - `deleteMapping()`
   - `calculateGstForOrderline(orderline, isTamilNadu)`
   - `aggregateGstForOrder(orderId)`

### Phase 3: API Endpoints
1. ✅ `GET /v1/gst-hsn/mappings` - List all mappings
2. ✅ `GET /v1/gst-hsn/mapping/:id` - Get specific mapping
3. ✅ `POST /v1/gst-hsn/mapping` - Create new mapping
4. ✅ `PATCH /v1/gst-hsn/mapping/:id` - Update mapping
5. ✅ `DELETE /v1/gst-hsn/mapping/:id` - Delete mapping
6. ✅ `GET /v1/gst-hsn/lookup?subcategory=xxx&subsubcategory=yyy` - Quick lookup

### Phase 4: Order Integration
1. ✅ Update order creation logic to:
   - Fetch product subcategory/subsubcategory
   - Lookup GST/HSN mapping
   - Calculate GST amounts
   - Store in orderline and aggregate in orders

### Phase 5: Admin UI (Future)
1. ✅ CRUD interface for managing mappings
2. ✅ Bulk import/export
3. ✅ Validation and error handling

## 📊 Example Queries

### Get GST/HSN for a product (by subsubcategory):
```sql
-- If product has subsubcategory, lookup by subsubcategory_value
-- (Use the VALUE from Product.subsubcategory, not the label)
SELECT hsn_code, gst_rate 
FROM gst_hsn_mapping 
WHERE subsubcategory_value = 'incense_sticks'  -- Product.subsubcategory value
  AND subsubcategory_id IS NOT NULL
  AND isactive = true;
```

### Get GST/HSN for a product (by subcategory):
```sql
-- If product has only subcategory, lookup by subcategory
SELECT hsn_code, gst_rate 
FROM gst_hsn_mapping 
WHERE subcategory_value = 'essential_oils'
  AND subcategory_id IS NOT NULL
  AND subsubcategory_id IS NULL
  AND isactive = true;
```

### Get all active mappings:
```sql
SELECT 
  ghm.*,
  p.label as subcategory_label
FROM gst_hsn_mapping ghm
LEFT JOIN picklist p ON ghm.subcategory_id = p.id
WHERE ghm.isactive = true
ORDER BY ghm.subcategory_value, ghm.subsubcategory_value;
```

## 🔍 Lookup Logic

**Key Insight**: Product model stores **string values** (`subcategory`, `subsubcategory`), NOT IDs.
Therefore, lookup should be by VALUE primarily.

```typescript
/**
 * Get GST/HSN mapping for a product
 * @param subcategory - Product's subcategory value (e.g., 'incense', 'essential_oils')
 * @param subsubcategory - Product's subsubcategory value (e.g., 'incense_sticks', null)
 * @returns GstHsnMapping or null
 */
async getGstHsnMapping(
  subcategory: string, 
  subsubcategory?: string | null
): Promise<GstHsnMapping | null> {
  
  // Priority 1: If product has subsubcategory, lookup by subsubcategory_value
  if (subsubcategory) {
    const subsubcategoryMapping = await this.prisma.gstHsnMapping.findFirst({
      where: {
        subsubcategory_value: subsubcategory,
        subsubcategory_id: { not: null },  // Ensure it's a subsubcategory record
        subcategory_id: null,              // Not a subcategory record
        isactive: true
      }
    });
    if (subsubcategoryMapping) return subsubcategoryMapping;
  }
  
  // Priority 2: Fallback to subcategory_value lookup
  if (subcategory) {
    const subcategoryMapping = await this.prisma.gstHsnMapping.findFirst({
      where: {
        subcategory_value: subcategory,
        subcategory_id: { not: null },  // Ensure it's a subcategory record
        subsubcategory_id: null,        // Not a subsubcategory record
        isactive: true
      }
    });
    if (subcategoryMapping) return subcategoryMapping;
  }
  
  // Priority 3: No mapping found
  return null;
}

/**
 * Example usage in order creation:
 * 
 * const product = await getProduct(productId);
 * // product.subcategory = 'incense'
 * // product.subsubcategory = 'incense_sticks'
 * 
 * const mapping = await gstHsnService.getGstHsnMapping(
 *   product.subcategory,      // 'incense'
 *   product.subsubcategory    // 'incense_sticks'
 * );
 * 
 * // Returns: { hsn_code: '33074100', gst_rate: 5.00, ... }
 */

/**
 * Calculate GST for an orderline (GST-INCLUSIVE pricing)
 * @param orderamount - Final GST-inclusive price AFTER discount (not productamount)
 * @param gstRate - GST rate from mapping (e.g., 5, 18)
 * @param isSameState - Whether seller and buyer are in same state
 * @returns GST breakdown with taxable amount and GST components
 */
calculateGstAmounts(
  orderamount: number,
  gstRate: number,
  isSameState: boolean
): {
  taxable_amount: number;      // Base amount without GST
  total_gst_amount: number;    // Total GST amount
  cgst_amount: number;         // CGST (if same state)
  sgst_amount: number;         // SGST (if same state)
  igst_amount: number;         // IGST (if different state)
  orderamount: number;         // GST-inclusive final price (for reference)
} {
  // GST-INCLUSIVE: Extract base amount and GST from final price
  // Formula: taxable_amount = orderamount / (1 + gst_rate/100)
  const taxable_amount = orderamount / (1 + gstRate / 100);
  const total_gst_amount = orderamount - taxable_amount;
  
  if (isSameState) {
    // Same state: CGST + SGST (split equally)
    const cgst_amount = total_gst_amount / 2;
    const sgst_amount = total_gst_amount / 2;
    return {
      taxable_amount: Math.round(taxable_amount * 100) / 100,  // Round to 2 decimals
      total_gst_amount: Math.round(total_gst_amount * 100) / 100,
      cgst_amount: Math.round(cgst_amount * 100) / 100,
      sgst_amount: Math.round(sgst_amount * 100) / 100,
      igst_amount: 0,
      orderamount: orderamount
    };
  } else {
    // Different state: IGST (full GST amount)
    return {
      taxable_amount: Math.round(taxable_amount * 100) / 100,
      total_gst_amount: Math.round(total_gst_amount * 100) / 100,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: Math.round(total_gst_amount * 100) / 100,
      orderamount: orderamount
    };
  }
}
```

## ⚠️ Edge Cases to Handle

1. **Multiple HSN codes for same subcategory**: Create multiple rows, use first match or allow selection (e.g., Diffusers: 85167990 vs 70200090)
2. **Missing mapping**: Log warning, use default rate (18%?) or fail gracefully
3. **Rate changes**: Update mapping, existing orders keep old rates (historical data preserved in orderline)
4. **Product has subsubcategory but no mapping**: Fallback to subcategory-level mapping
5. **Product has only subcategory (no subsubcategory)**: Use subcategory-level mapping directly
6. **Inactive mappings**: Filter by `isactive = true`
7. **GST-Inclusive Pricing**: Product prices include GST, so extract GST from `orderamount` using reverse calculation
   - Formula: `taxable_amount = orderamount / (1 + gst_rate/100)`
   - Formula: `total_gst_amount = orderamount - taxable_amount`
8. **GST Calculation Base**: Always use `orderamount` (after discount), never `productamount` (before discount)
9. **Zero/negative orderamount**: Handle gracefully (no GST if orderamount is 0 or negative)
10. **Shipping cost**: Shipping cost may or may not be included in taxable amount (check business rules)
11. **Rounding**: Round all amounts to 2 decimal places to avoid floating point errors
12. **Verification**: Ensure `taxable_amount + total_gst_amount = orderamount` (for GST-inclusive pricing)
13. **Lookup by VALUE**: Since Product stores string values, always lookup by `subsubcategory_value` / `subcategory_value`

## 🎯 Benefits of This Approach

1. **Configurable**: Easy to update via API/admin UI
2. **Maintainable**: Clear structure, easy to understand
3. **Performant**: Indexed lookups, fast queries
4. **Scalable**: Supports future requirements (state-wise GST, date ranges, etc.)
5. **Auditable**: Track changes with timestamps
6. **Type-safe**: Prisma ensures data integrity

## 📅 Migration Path

1. **Week 1**: Create table, populate data, create service
2. **Week 2**: Add API endpoints, test with sample orders
3. **Week 3**: Integrate with order creation flow
4. **Week 4**: Add to orderline/orders tables, update existing logic
5. **Week 5**: Testing, bug fixes, documentation

## 🔄 Alternative: JSON Approach (Not Recommended)

If you want a quick solution, you could store in JSON:

```json
{
  "incense": {
    "Incense sticks": { "hsn": "33074100", "gst": 5 },
    "Dhoop sticks": { "hsn": "33074100", "gst": 5 },
    "Havan": { "hsn": "33074100", "gst": 5 }
  },
  "car_&_room_fresheners": {
    "Car Fresheners": { "hsn": "33074900", "gst": 18 },
    ...
  }
}
```

**But this has drawbacks:**
- ❌ Hard to query
- ❌ No relationships
- ❌ Difficult to maintain
- ❌ No validation
- ❌ Performance issues with large data

## ✅ Recommendation

**Go with the new table approach** - it's the right long-term solution and will save you time in the future.

---

## 📋 Review Summary (Final In-Depth Review)

### ✅ Verified: Orderline.orderamount Structure

**From PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE.md (line 777):**
```
orderline.orderamount = productamount - promotion_discount_amount
                      = Final item amount (EXCLUDES shipping)
```

**Verification with Example 3:**
```
Orderline 1: orderamount = ₹950 - ₹351.85 = ₹598.15 ✅
Orderline 2: orderamount = ₹400 - ₹148.15 = ₹251.85 ✅
Σ(orderline.orderamount) = ₹598.15 + ₹251.85 = ₹850.00 ✅

Order.shipping_cost = ₹150.00
Order.orderamount = Σ(orderline.orderamount) + shipping_cost
                  = ₹850 + ₹150 = ₹1000.00 ✅
```

### ✅ Verified: GST Calculation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ORDERLINE-LEVEL GST (per item)                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                                                           
INPUT:  orderline.orderamount = ₹598.15 (GST-INCLUSIVE, NO shipping)      
        gst_rate = 5%                                                      
                                                                           
OUTPUT: taxable_amount = ₹598.15 / 1.05 = ₹569.67 (base)                  
        total_gst_amount = ₹598.15 - ₹569.67 = ₹28.48                     
        cgst_amount = ₹14.24 (if same state)                              
        sgst_amount = ₹14.24 (if same state)                              


┌─────────────────────────────────────────────────────────────────────────┐
│  ORDER-LEVEL GST (aggregated)                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                                                           
items_total = Σ(orderline.orderamount) = ₹850 (GST taxable base)          
            = order.orderamount - shipping_cost                            
            = ₹1000 - ₹150 = ₹850 ✅                                       
                                                                           
total_taxable_amount = Σ(orderline.taxable_amount) = ₹783.10              
total_gst_amount = Σ(orderline.total_gst_amount) = ₹66.90                 
                                                                           
VERIFY: ₹783.10 + ₹66.90 = ₹850 = items_total ✅                          
```

### Issues Fixed During Review:

| Issue | Before | After |
|-------|--------|-------|
| FK comment for subsubcategory | `fieldname='subcategory'` | `fieldname='subsubcategory'` |
| Subsubcategory values | `Incense sticks`, `Dhoop sticks` | `incense_sticks`, `dhoop_sticks`, `havan_cups` |
| Lookup strategy | By ID (Product doesn't have IDs) | By VALUE (matches Product model) |
| SQL insert script | Missing | Added complete INSERT script |
| Edge case #4 | "Use NULL subsubcategory mapping" | "Fallback to subcategory-level mapping" |
| orderamount confusion | Unclear what includes shipping | Clarified: orderline EXCLUDES, order INCLUDES |
| GST taxable base | On order.orderamount | On items_total (= Σ orderline.orderamount) |

### Key Design Decisions:

1. ✅ **Lookup by VALUE**: Product model stores string values, so primary lookup uses `subsubcategory_value` / `subcategory_value`
2. ✅ **IDs are optional**: `subcategory_id` / `subsubcategory_id` are FK references for data integrity, not for primary lookup
3. ✅ **Either/Or constraint**: Each record has EITHER subcategory OR subsubcategory (enforced by CHECK constraint)
4. ✅ **GST-Inclusive**: Prices include GST, so we extract base amount using reverse calculation
5. ✅ **Multiple HSN codes**: Diffusers has 2 HSN codes (85167990, 70200090) - stored as separate rows
6. ✅ **Orderline.orderamount**: EXCLUDES shipping (only product price after discounts)
7. ✅ **Order.orderamount**: INCLUDES shipping (= items_total + shipping_cost)
8. ✅ **items_total (NEW)**: = Σ(orderline.orderamount) = GST taxable base at order level

### New Fields Summary:

**ORDERLINE (7 new fields):**
| Field | Type | Calculation |
|-------|------|-------------|
| `hsn_code` | VARCHAR(50) | From gst_hsn_mapping |
| `gst_rate` | DECIMAL(5,2) | From gst_hsn_mapping (e.g., 5.00, 18.00) |
| `taxable_amount` | DECIMAL(10,2) | `orderamount / (1 + gst_rate/100)` |
| `cgst_amount` | DECIMAL(10,2) | `total_gst_amount / 2` (same state) |
| `sgst_amount` | DECIMAL(10,2) | `total_gst_amount / 2` (same state) |
| `igst_amount` | DECIMAL(10,2) | `total_gst_amount` (different state) |
| `total_gst_amount` | DECIMAL(10,2) | `orderamount - taxable_amount` |

**ORDER (6 new fields):**
| Field | Type | Calculation |
|-------|------|-------------|
| `items_total` ⭐ | DECIMAL(10,2) | `Σ(orderline.orderamount)` = GST base |
| `total_taxable_amount` | DECIMAL(10,2) | `Σ(orderline.taxable_amount)` |
| `total_cgst_amount` | DECIMAL(10,2) | `Σ(orderline.cgst_amount)` |
| `total_sgst_amount` | DECIMAL(10,2) | `Σ(orderline.sgst_amount)` |
| `total_igst_amount` | DECIMAL(10,2) | `Σ(orderline.igst_amount)` |
| `total_gst_amount` | DECIMAL(10,2) | `Σ(orderline.total_gst_amount)` |

### Verification Equations:

```
ORDERLINE LEVEL:
─────────────────────────────────────────────────────────────────
taxable_amount + total_gst_amount = orderamount ✅

ORDER LEVEL:
─────────────────────────────────────────────────────────────────
① items_total = Σ(orderline.orderamount) ✅
② items_total = orderamount - shipping_cost ✅
③ total_taxable_amount + total_gst_amount = items_total ✅
④ orderamount = items_total + shipping_cost ✅
```

### Ready for Implementation:
- ✅ SQL schema is correct
- ✅ Prisma model is correct
- ✅ Insert script is ready
- ✅ Lookup logic matches Product model
- ✅ GST calculation is correct
- ✅ Orderline.orderamount correctly excludes shipping
- ✅ items_total field added for GST taxable base
- ✅ All verification equations documented

