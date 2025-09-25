# Inventory App - Product & Stock Design Overview




## 1. Current Setup

### Product Table
- Stores **master product info**:
  - Name, Category, Subcategory, Fragrance, Price, Discount
  - Pack (Single, 2-pack, etc.)
  - Supplier (currently one per product)
  - Product PO
  - PUC (Product Unique Code) as unique identifier
- Tracks overall quantities:
  - `quantity`, `availableQuantity`, `orderedQuantity`, `soldQuantity`, `ecomPublishedQuantity`
- Product status auto-calculated:
  - **In Stock** → available > 5
  - **Low Stock** → 1–5
  - **Out of Stock** → 0

### Stock Table
- Tracks individual stock units:
  - `stockId` (RFID), `serialNumber`, `batchNo`, `mfgDate`, `releaseDate`
  - `puc` (linked to product)
  - `status`: Available / Sold
- Quantities updated when stock is **inserted, sold, dispatched, or cancelled**

### E-commerce Logic
- Users can add products to cart if `availableQuantity - lockQuantity > 0`
- On checkout:
  - Increase `lockQuantity`
  - On successful payment: finalize order
  - On timeout/payment failure: reduce `lockQuantity`
- Order placement updates:
  - `orderedQuantity` ↑
  - `availableQuantity` ↓
- Dispatch updates:
  - Stock status → Sold
  - `soldQuantity` ↑, `orderedQuantity` ↓
- Cancelled dispatch → revert quantities and stock status

### Special Cases
- Multiple stocks per product are allowed
- Supplier change → new product created (currently)

---

## 2. Client Requirement / Reporting

Client needs to track:
- Product ID, Name, Code, Category, Subcategory, Fragrance, Product PO, Batch No, Price, Brand, Supplier Name, Pack, Supplier Location, Supplier Country, `ecompublish`
- Stock per platform:
  - `Total Stock Qty`
  - `AMZN Stock Qty`, `FKRT Stock Qty`, `NIVAPP Stock Qty`
- Product sold on **NIVAPP, Flipkart, Amazon**

---

## 3. My questions


1. do we show our product like same prodcut based on Fragrance as choosen in the varient like e-com app color choose 

2. do we keep the SELL Price as same for the procust purchase form diff suppliers ,diff PO .

    2.1 current flow is if the supplier changes for the same product we create as diffrent product in the E-com we will dispaly the same product 2 times with different supplier and respetive selling price

3.do you need to manage the quanity based on the platform basis , like when a stock insert we can map that spectifc stock 
to the respective platform 

4. will we go for pack based diffenet product even the same po/supplier 


5. will we keep the selling price and discount is same for all suppliers even the diffrent po/supplier??
if yes i go for map the supplier and PO in the stock , now under one product we keep diffent suppliers stocks and batchId comes

## 3.1 Issues With Current Setup

1. Single `availableQuantity` → cannot manage **per-platform stock** → risk of overselling
2. Supplier per product → if new supplier, need to create new product
3. Product PO tracked only at product level → cannot track multiple POs per product
4. BatchNo in stock, but reporting per PO not accurate

---

## 4. New Design / Chosen Approach

### 4.1 Product Table
- Stores **master product info only**:
  - Name, Category, Subcategory, Fragrance
  - Pack (Single, 2-pack, etc.)
  - Price, Discount (fixed across suppliers)
  - PUC (unique per product variant)
- No supplier or PO stored here
- Overall quantity fields remain:
  - `availableQuantity`, `orderedQuantity`, `soldQuantity`, `ecomPublishedQuantity`

### 4.2 Stock Table
- Tracks **batches / stock units**:
  - `stockId` (RFID), `serialNumber`
  - `batchNo`, `po`, `supplierId`
  - `mfgDate`, `releaseDate`
  - `platforms`: ["Amazon", "Flipkart", "NIVAPP"] → per-platform allocation
  - `status`: Available / Sold
- Updates **overall product quantities** and **per-platform stock** on stock insertion, sale, dispatch, or cancellation

### 4.3 Platform Stock Allocation

Since products are sold across **multiple e-commerce platforms (Amazon, Flipkart, NIVAPP)**, stock must be tracked **per platform**.  

#### Platform-Based Quantities (per product)
- `platformAvailableQty` → How many units are available for each platform  
- `platformOrderedQty` → Units ordered (but not yet dispatched) per platform  
- `platformSoldQty` → Units successfully sold and dispatched per platform  
- `platformTotalQty` → Sum of available + ordered + sold for that platform  

#### Example
```json
platformStock: {
  amazon: {
    availableQty: 40,
    orderedQty: 10,
    soldQty: 50,
    totalQty: 100
  },
  flipkart: {
    availableQty: 30,
    orderedQty: 5,
    soldQty: 20,
    totalQty: 55
  },
  nivapp: {
    availableQty: 20,
    orderedQty: 2,
    soldQty: 10,
    totalQty: 32
  }
}
```

#### Lock Quantity
- **LockQuantity is only for NIVAPP (our own platform)**  
  - When user adds product to cart → reduce available qty temporarily (`lockQty` ↑)  
  - On successful payment → convert to order  
  - On timeout/cancel → release back to available qty  
- **Amazon and Flipkart**: We **do not control locking** → they handle it in their systems.  
  - We only sync stock quantities with them periodically or via APIs  

#### Reporting
- Overall product quantities are still maintained in **Product table**:  
  - `availableQuantity`, `orderedQuantity`, `soldQuantity` (sums across all platforms)  
- Each platform’s contribution is tracked under `platformStock`  

### 4.4 Supplier & PO Handling
- Supplier and PO are tracked **at Stock level** (per batch)
- Same product variant can be procured from multiple suppliers without creating a new product
- Price and discount remain fixed for e-commerce
- Each batch linked to **one PO**, batchNo unique per PO

### 4.5 Pack Size Handling
- Each **pack size** (Single, 2-pack, etc.) is treated as a **separate product variant**
- Optionally, link variants under a **master product** for grouping in e-commerce

---

## 5. Flow Summary

1. **Stock Insertion**
   - Insert stock units → assign **BatchNo, PO, Supplier, Platform**
   - Update:
     - Product overall quantities
     - Platform-specific stock quantities

2. **E-commerce Orders**
   - Check platform-specific available stock
   - Update `lockQuantity` on cart checkout
   - On payment success/failure:
     - Update product overall quantities
     - Update platform stock quantities

3. **Order Fulfillment**
   - Dispatch → stock status = Sold, update sold/ordered quantities
   - Cancellation → revert stock and quantities

---

## 6. Advantages of New Design

- **Supports multiple suppliers and POs per product**
- **Tracks stock per platform**, preventing overselling
- **Batch-level tracking** for reporting and traceability
- **Fixed price and discount** per product variant
- **Flexible pack-size management**
- Compatible with current e-commerce order logic
