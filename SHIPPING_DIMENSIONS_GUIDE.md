# Shipping Dimensions & Weight Management Guide

## 📋 Overview

This guide explains how product dimensions and weight are managed for Ekart shipping integration.

---

## 🎯 Key Concepts

### 1. **Base Product Data**
- Store **single unit** dimensions and weight at product level
- Dimensions: `shipping_length`, `shipping_width`, `shipping_height` (in cm)
- Weight: `shipping_weight` (in grams)
- Alternative: `packaging_template` (Ekart template name)

### 2. **Pack Size Handling**
- `pack` field: String like "pack of 2", "pack of 3", "Single"
- `numberofitems`: Numeric value (alternative to parsing pack string)
- **Important**: Pack size indicates items **per pack**, not total quantity

### 3. **Calculation at Dispatch Time**
- Dimensions/weight calculated when creating shipment
- Based on:
  - Base product dimensions/weight
  - Pack size (extracted from `pack` or `numberofitems`)
  - Order quantity (number of packs ordered)

---

## 📊 Data Flow

```
Product (Base Data)
├── shipping_length: 10cm (single unit)
├── shipping_width: 8cm (single unit)
├── shipping_height: 5cm (single unit)
├── shipping_weight: 200g (single unit)
├── pack: "pack of 2"
└── numberofitems: 2

Order
├── quantity: 3 (customer ordered 3 packs)
└── product_id: 123

Calculation:
├── Pack size: 2 items per pack
├── Total items: 3 packs × 2 items = 6 items
├── Total weight: 200g × 6 = 1200g
└── Dimensions: Calculated based on 6 items (stacking/grid arrangement)
```

---

## 🔧 Implementation Strategy

### **Option 1: Store Base Dimensions (Recommended)**

**Pros:**
- ✅ Accurate calculations
- ✅ Flexible for different pack sizes
- ✅ Can handle combo packs dynamically
- ✅ Single source of truth

**Cons:**
- ⚠️ Requires initial data entry
- ⚠️ Need to update if product dimensions change

**When to Use:**
- Products have consistent dimensions
- Multiple pack sizes for same product
- Need accurate shipping cost calculations

### **Option 2: Use Packaging Templates**

**Pros:**
- ✅ Quick setup (predefined in Ekart dashboard)
- ✅ No need to store dimensions
- ✅ Ekart handles calculations

**Cons:**
- ⚠️ Less flexible
- ⚠️ May not be accurate for all products
- ⚠️ Need to create templates in Ekart first

**When to Use:**
- Standard packaging sizes
- Quick implementation
- Products fit standard templates

### **Option 3: Hybrid Approach (Best Practice)**

**Strategy:**
1. Store base dimensions for products that need accuracy
2. Use templates for standard products
3. Calculate at dispatch time based on what's available

**Priority:**
1. If `packaging_template` exists → use template
2. Else if dimensions exist → calculate
3. Else → use defaults with warning

---

## 📐 Calculation Logic

### **Single Item**
```
Dimensions: Base dimensions
Weight: Base weight
```

### **Small Quantity (2-4 items)**
```
Strategy: Stack vertically
Length: base_length
Width: base_width
Height: base_height × total_items
Weight: base_weight × total_items
```

### **Medium Quantity (5-8 items)**
```
Strategy: 2×2 grid, stacked
Length: base_length × 2
Width: base_width × 2
Height: base_height × layers
Weight: base_weight × total_items
```

### **Large Quantity (9+ items)**
```
Strategy: 3×3 grid, stacked
Length: base_length × 3
Width: base_width × 3
Height: base_height × layers
Weight: base_weight × total_items
```

---

## 💡 Examples

### Example 1: Single Product, Pack of 2, Quantity 3

**Product Data:**
```json
{
  "shipping_length": 15,
  "shipping_width": 10,
  "shipping_height": 5,
  "shipping_weight": 250,
  "pack": "pack of 2",
  "numberofitems": 2
}
```

**Order:**
- Quantity: 3 packs

**Calculation:**
- Pack size: 2 items
- Total items: 3 × 2 = 6 items
- Total weight: 250g × 6 = 1500g
- Dimensions: 15cm × 10cm × 30cm (stacked vertically)

### Example 2: Combo Pack (Multiple Products)

**Products:**
- Product A: 2 units, 10×8×5cm, 200g each
- Product B: 1 unit, 12×10×6cm, 300g

**Calculation:**
- Total weight: (200×2) + 300 = 700g
- Combined dimensions: 12×10×16cm (largest base, stacked)

---

## 🗄️ Database Schema

### Product Table Fields

```sql
-- Shipping dimensions (single unit, in cm)
shipping_length DECIMAL(10,2),
shipping_width DECIMAL(10,2),
shipping_height DECIMAL(10,2),

-- Shipping weight (single unit, in grams)
shipping_weight DECIMAL(10,2),

-- Ekart packaging template (alternative to dimensions)
packaging_template VARCHAR(255),

-- Pack information (existing fields)
pack VARCHAR(255),              -- "pack of 2", "Single", etc.
numberofitems INT               -- Alternative numeric value
```

---

## 🔄 Usage in Code

### Calculate Shipping for Order

```typescript
import { calculateShippingDimensions } from '../utils/shippingCalculator.js';

// Get product data
const product = await getProduct(productId);

// Prepare shipping data
const shippingData = {
  length: product.shipping_length,
  width: product.shipping_width,
  height: product.shipping_height,
  weight: product.shipping_weight,
  pack: product.pack,
  numberofitems: product.numberofitems,
  packagingTemplate: product.packaging_template
};

// Calculate for order quantity
const result = calculateShippingDimensions(
  shippingData,
  orderQuantity, // e.g., 3 packs
  true // use template if available
);

// Use result for Ekart shipment
const ekartPayload = {
  length: result.length,
  width: result.width,
  height: result.height,
  weight: result.weight,
  templateName: result.templateName // if using template
};
```

---

## ✅ Best Practices

1. **Store Base Data**: Always store single unit dimensions/weight
2. **Calculate at Dispatch**: Don't store calculated values, calculate on-the-fly
3. **Handle Missing Data**: Provide sensible defaults with warnings
4. **Validate Before Shipment**: Check dimensions/weight before creating shipment
5. **Log Calculations**: Keep audit trail of how dimensions were calculated
6. **Update When Needed**: Review and update dimensions if product packaging changes

---

## ⚠️ Important Notes

1. **Pack Size vs Quantity**:
   - `pack: "pack of 2"` means 2 items per pack
   - `quantity: 3` means 3 packs ordered
   - Total items = 3 × 2 = 6 items

2. **Weight Calculation**:
   - Always multiply base weight by total items
   - Include packaging weight if significant (add 50-100g)

3. **Dimension Calculation**:
   - Consider how items are arranged in box
   - Account for packaging material (add 1-2cm padding)
   - Round up to nearest integer

4. **Combo Packs**:
   - Calculate each product separately
   - Combine dimensions (use largest base, stack heights)
   - Sum weights

---

## 🚀 Migration Strategy

### Phase 1: Add Fields
- Add shipping fields to product schema
- Make all fields optional initially

### Phase 2: Data Entry
- Update existing products with dimensions/weight
- Start with high-volume products
- Use templates for standard products

### Phase 3: Integration
- Use calculator in shipment creation
- Monitor and adjust calculations
- Collect feedback from warehouse

### Phase 4: Optimization
- Refine calculation algorithms
- Add product-specific rules
- Automate dimension capture (if possible)

---

## 📝 Summary

**Answer to your questions:**

1. **Do we need dimensions?** ✅ Yes, for accurate shipping costs
2. **Store single or combo?** ✅ Store **single unit** data, calculate combo at dispatch
3. **Pack of 2/3 handling?** ✅ Extract pack size, multiply by quantity
4. **Weight - single or total?** ✅ Store **single unit weight**, calculate total at dispatch

**Recommended Approach:**
- Store base dimensions/weight per product
- Calculate shipping dimensions at dispatch time
- Handle pack sizes automatically
- Support both templates and calculated dimensions

