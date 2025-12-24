# Combo Pack + PhonePe Implementation Status (Backend)

This document summarizes what is already implemented for **Combo Packs** and confirms that the **PhonePe payment flow is implemented**, with direct references to the current backend code.

---

## ✅ 1) Database Schema (Implemented)

- **`product.iscombo` flag**: Added on `Product` model (`prisma/schema.prisma`)
- **`productbundlemap` table**: Implemented as `ProductBundleMap` model (`prisma/schema.prisma`)
  - Fields include `bundleproductid`, `componentproductid`, `requiredqty`, `isactive`
  - Relation wiring is present from `Product` ↔ `ProductBundleMap`

Primary reference:
- `prisma/schema.prisma` (models `Product`, `ProductBundleMap`, and `PlatformStock`)

---

## ✅ 2) Product Display (API provides combo + component stock) (Implemented)

The backend exposes product APIs that include **combo component metadata** and (for **nivapp**) **component platform stock** so the client can display combo packs and calculate availability.

### Routes (Backend)

- **GET** `/v1/products/platform/:platform`
- **GET** `/v1/products/:id/platform/:platform`

Reference:
- `src/routes/product.route.ts` (platform routes + response schema includes `iscombo`, `combotype`, and `components[].platformStock.lockqty/availableqty/orderedqty`)

### Service behavior (Backend)

- For combo products (`iscombo === true`), the service fetches `productBundleMap` components and attaches:
  - `components[]` (component product + requiredqty + isactive)
  - `components[].platformStock` for **platform = `nivapp`** (includes `availableqty`, `lockqty`, etc.)

References:
- `src/services/product.service.ts`
  - `findManyForPlatform(...)` (attaches combo `components` + `components[].platformStock`)
  - `findByIdForPlatform(...)` (attaches combo `components` + `components[].platformStock`)

---

## ✅ 3) Add-to-Cart Validation Support (Backend supports FE validation) (Implemented)

The **mobile app/frontend** can validate combo availability using the data returned by the above product APIs:

- **Actual available per component**: `actualAvailable = platformStock.availableqty - platformStock.lockqty`
- **Combo packs possible per component**: `floor(actualAvailable / requiredqty)`
- **Final combo availability**: `min(...)` across all components

Backend references (what enables this):
- `src/routes/product.route.ts` (schema includes `components[].requiredqty` and `components[].platformStock.lockqty/availableqty`)
- `src/services/product.service.ts` (populates `components[]` and `components[].platformStock` for combos)

---

## ✅ 4) PhonePe Payment Flow (including combo handling) (Implemented)

The PhonePe payment flow is implemented end-to-end:

- **Initiate** → validate + lock stock + create transaction
- **Callback** → payment status + create order + convert locks to order
- **Cleanup task** (optional) → release locks if payment not completed

Below is the **clear combo-specific explanation** of what the backend is doing today.

### 4.0) Core concept (Combo vs Components)

- **Combo product (`product.iscombo = true`)**:
  - Used as the *sellable SKU* (orderline will contain this product id)
  - Inventory is not directly tracked on the combo row
- **Component products** (from `productbundlemap` / `productBundleMap`):
  - These are the real inventory items
  - Stock operations happen on these component products

Primary code references:
- `src/controllers/phonepe.controller.ts`:
  - `initiatePayment`
  - `lockComboComponents`
  - `updateProductQuantitiesAfterOrder`
  - `convertComboComponentLocksToOrders`
  - `cleanupExpiredLock`
- `src/routes/phonepe.route.ts`:
  - callback handler (`/callback/:transactionId`, around ~448–902)

---

### 4.1) INITIATE (POST `/v1/phonepe/initiate`) — Combo flow

**Where**: `PhonePeController.initiatePayment`

#### A) Validation (combo component check)

For each order item:

- Read `product.iscombo`
- If it’s a **combo**:
  - Fetch components: `productBundleMap` where `bundleproductid = comboProductId` and `isactive = true`
  - For each component:
    - Compute: `totalNeeded = requiredqty × comboQuantity`
    - Read component `platformstock` (platform = `nivapp`)
    - Compute: `actualAvailable = availableqty - lockqty`
    - Validate: `actualAvailable >= totalNeeded`
  - If any component fails → **initiate fails** (no stock lock, no PhonePe call)

#### B) Locking (reserve stock before payment)

After validation passes, stock is locked inside a transaction:

- For combo items, we call: `lockComboComponents(tx, comboProductId, comboQuantity, orderItem)`
- For each component, we acquire a row lock (`SELECT ... FOR UPDATE`) and update `platformstock`:
  - **`availableqty ↓`** by `totalNeeded`
  - **`lockqty ↑`** by `totalNeeded`
  - `orderedqty` unchanged

#### C) Store original payload (used later in callback)

We save the entire payload into:

- `transaction.transactiondata.originalPayload`

This is what the callback uses later.

---

### 4.2) CALLBACK (ALL `/v1/phonepe/callback/:transactionId`) — Combo flow

**Where**: `src/routes/phonepe.route.ts` (callback handler) + controller methods.

#### A) Payment status + idempotency

- Callback checks existing transaction status (avoid duplicate processing)
- Then checks PhonePe status

#### B) Order creation (orderline uses combo product id)

- On success it calls `phonePeController.createOrderAfterPayment(...)`
- For combos, the created **orderline uses the combo product id** (the purchased SKU)

#### C) Convert locks to orders (inventory conversion on components)

After order creation, callback updates quantities using:

- `PhonePeController.updateProductQuantitiesAfterOrder(...)`

If the order item’s product is combo (`iscombo === true`), it calls:

- `convertComboComponentLocksToOrders(comboProductId, comboQuantity, ...)`

For each component:

- Compute: `totalNeeded = requiredqty × comboQuantity`
- Convert lock → order:
  - **PlatformStock (component)**:
    - `availableqty` = **NO CHANGE** (already reduced during initiate)
    - **`lockqty ↓`**
    - **`orderedqty ↑`**
  - **Product (component)**:
    - **`orderedquantity ↑`**
    - **`availablequantity ↓`**

So after a successful combo payment:

- **Component platformstock**: lock is consumed into ordered
- **Component product**: orderedquantity increases, availablequantity decreases

---

### 4.3) CLEANUP TASK (POST `/v1/phonepe/cleanup-lock`) — current behavior

**Where**: `PhonePeController.cleanupExpiredLock`

If PhonePe status is not successful (pending/failed/cancelled/expired):

- Reads `transaction.transactiondata.originalPayload.order[]`
- For each order item it tries to release:
  - **`platformstock.lockqty ↓`**
  - **`platformstock.availableqty ↑`**
- Marks transaction status as `EXPIRED`

#### ⚠️ Important note for combos (cleanup limitation)

Today cleanup iterates order items and looks up `platformstock` using `item.productid`.

- For combo orders, `item.productid` is the **combo product id**
- Combo products usually **do not** have their own `platformstock` row (components do)

So cleanup may **skip releasing component locks for combo orders** unless enhanced to:

- Detect combo items, fetch components from `productBundleMap`, and release component locks using `requiredqty × comboQuantity`.


