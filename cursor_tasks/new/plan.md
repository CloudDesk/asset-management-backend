PART 1: CURRENT IMPLEMENTATION (AS-IS)
1️⃣ Core Inventory Model (Today)
Tables
Product (Master SKU)

Represents a sellable SKU

Used for:

Quantity calculation

E-commerce visibility

Order allocation logic

Key fields:

quantity

availablequantity

orderedquantity

soldquantity

ecompublishedquantity

productstatus

Stock (Physical Item)

Represents one physical unit

Linked to exactly one product

Tracks real-world movement

Key fields:

stockstatus (available, sold, damaged)

ecompublish

platform

puc

orderid, orderlinenumber

PlatformStock (Platform-wise Aggregation)

Represents inventory view per platform

Used for:

Locking during checkout

Platform-specific availability

Key fields:

availableqty

lockqty

orderedqty

soldqty

totalqty

platformstatus

2️⃣ Current Stock Flow (Single Product)
➕ Stock Created

stock row inserted

product.quantity, ecompublishedquantity recalculated

platformstock.totalqty updated

🛒 Order Initiate

platformstock.lockqty += qty

platformstock.availableqty -= qty

💳 Payment Callback

platformstock.lockqty -= qty

platformstock.orderedqty += qty

product.orderedquantity += qty

product.availablequantity recalculated

📦 Dispatch

stock.stockstatus = 'sold'

platformstock.orderedqty -= qty

platformstock.soldqty += qty

product.soldquantity += qty

✅ This flow is correct and solid

3️⃣ Current Combo Implementation (Problem Area)
❌ What You Do Today

Combo product is created

Physical stocks are pre-bundled

Example: Vanilla + Black Oudh wrapped together

Treated as one stock

❌ Problems
Problem	Why it hurts
Stock rigidity	Cannot unbundle
Shortage mismatch	One SKU out → combo breaks
Manual correction	High operational cost
No scalability	Hard to add new combos
Inventory waste	Locked physical units
🟩 PART 2: PROPOSED IMPLEMENTATION (TO-BE)
🎯 Core Principle (Most Important)

Only single products have physical stock.
Combo products are virtual and derived.

4️⃣ What Stays the Same (Very Important)

✔️ Product table structure
✔️ Stock table structure
✔️ PlatformStock table
✔️ Order lifecycle (initiate → callback → dispatch)
✔️ Quantity formulas for single products

👉 Zero breaking changes to your stable system

5️⃣ What Changes (Combo Support)
➕ New Table: product_bundle_map
product_bundle_map
------------------
id
bundle_product_id      -- combo SKU
component_product_id   -- single SKU
required_qty           -- quantity needed per combo
is_active
createddate


This table defines the recipe of a combo.

6️⃣ Combo Product Definition
Product Table

Add 2 flags (recommended):

field	purpose
is_combo	true / false
combo_type	fixed, dynamic (optional)
For combo products:

No stock rows

No physical inventory

Visibility controlled via derived quantity

7️⃣ Combo Quantity Calculation (Key Change)
Rule (Universal)
combo_available =
MIN(
  component.availablequantity / required_qty
)

Examples
Pack of 2 (Different)
Vanilla	Black Oudh
10	8

➡️ Combo available = 8

Pack of 3 (Same)
Vanilla
10

➡️ Combo available = 3

Mixed Combo
Product	Qty
Vanilla	2
Oudh	1

➡️ Combo available = MIN(10/2, 5/1) = 5

8️⃣ Order Flow – Combo Product
🛒 Order Initiate

When user orders 1 combo:

For each component:

platformstock.lockqty += required_qty

Combo product:

No stock

One orderline

💳 Payment Callback

For each component:

platformstock.lockqty -= required_qty

platformstock.orderedqty += required_qty

product.orderedquantity += required_qty

📦 Dispatch

For each component:

Allocate real stock rows

stock.stockstatus = 'sold'

platformstock.soldqty += required_qty

product.soldquantity += required_qty

9️⃣ Cancellation / Failure Handling
Scenario	Action
Payment failed	Release component lockqty
Order cancelled before dispatch	Reduce orderedqty
Partial cancel	Reduce per component
Return	Reverse sold → available (if allowed)
🔟 PlatformStock Handling for Combo

Two approaches (choose one):

✅ Recommended (Simple)

Do NOT maintain platformstock for combo

Calculate combo availability at API level

⚠️ Optional (If platform requires)

Create platformstock rows for combo

Values are derived, not stock-based

1️⃣1️⃣ Reporting & Analytics

Sales reports:

Combo → orderline

Actual consumption → component products

Inventory reports:

Only single products matter

1️⃣2️⃣ Migration Plan (Safe)

Stop creating stock for combo products

Create product_bundle_map

Mark existing combos as is_combo = true

Update order flow to explode combo → components

Keep old data untouched

🔥 Final Recommendation (Strong & Clear)

Do NOT treat combos as physical inventory.
Use a recipe-based virtual inventory model.

This is:

Industry standard

Scalable

Operationally safe

Compatible with Amazon / Flipkart

Fully aligned with your current system