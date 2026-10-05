# Ecom Combo Product Stock and Cart Parity

**Date:** 2026-10-05  
**Status:** ✅ Implemented and Build Verified  
**Repository:** `Nivaana-Ecom-Web`  
**Branch / Commit:** `DEV-NEW` / `6d896940dae4deec42c88c9210235ef615635d38`

---

## 1. Objective

Align Ecom Web combo-product availability and Add to Cart behavior with the working Mobile implementation, without changing Backend inventory ownership, cart APIs, payment validation, product pricing, discounts, or product data.

---

## 2. Original Issue

Combo products are virtual SKUs. Their own top-level stock can intentionally remain at zero and their top-level status can remain `out_of_stock` because the actual saleable quantity is derived from the component products.

Mobile already followed this component-based rule, while Ecom Web used the combo's top-level quantity/status. As a result, a combo whose components were available could be displayed as unavailable on Web.

The listing-card Add to Cart action also reused an existing cart quantity instead of increasing it by one for an authenticated customer.

---

## 3. Final Stock Behavior

### 3.1 Regular products

Regular products use the Nivapp platform quantity first:

```text
platformStock.availableqty
  → availablequantity
  → ecompublishedquantity
  → quantity
```

The existing regular-product `productstatus === "out_of_stock"` check remains active.

### 3.2 Combo products

For every component:

```text
component capacity = floor(component available quantity / component required quantity)
```

The combo's saleable quantity is the minimum capacity across all components:

```text
combo available quantity = min(all component capacities)
```

Component availability uses `component.platformStock.availableqty`, with `component.availablequantity` as a compatibility fallback.

If component data is missing, a required quantity is invalid, or any component has insufficient stock, the combo is unavailable. The combo's own top-level zero quantity/status is not used to override valid component availability.

---

## 4. Cart Behavior

For an authenticated user, each listing-card Add to Cart click now increments the existing cart-line quantity by one.

This remains a UI/cart update only. No additional Backend stock validation was added to every click. The existing payment-initiation validation remains the authoritative protection against stale or concurrent stock changes.

Wishlist behavior and existing cart/wishlist APIs remain unchanged.

---

## 5. Product Contract Added to Ecom

The Ecom `Product` type now supports the existing Backend combo response:

- `iscombo`
- `combotype`
- `components`
- `platformStock`
- component `requiredqty`
- component `platformStock.availableqty`

No Backend response shape or database schema was changed.

---

## 6. Coverage

The shared stock helpers are consumed across the product experience, preserving the same availability calculation for:

- Home product cards
- Product listings
- Product details
- Related and recently viewed products
- Wishlist
- Cart
- Checkout

Future lightweight Home or listing APIs must continue returning combo component quantities; otherwise the Web cannot calculate virtual combo availability correctly.

---

## 7. Files Modified

### Ecom Web

- `Nivaana-Ecom-Web/src/lib/stock.ts`
- `Nivaana-Ecom-Web/src/types/index.ts`
- `Nivaana-Ecom-Web/src/components/ProductCard.tsx`

### Backend and Mobile

- No code changes were required.
- The Web implementation follows the existing Mobile/component-inventory pattern.

---

## 8. Compatibility and Safety

- Product price and discount calculations are unchanged.
- Ratings and product images are unchanged.
- Regular-product availability behavior is preserved.
- Backend inventory writes are unchanged.
- Cart and wishlist request contracts are unchanged.
- Payment initiation remains the final authoritative stock validation point.
- No database schema or stored data was changed.

---

## 9. Verification

- Confirmed the implementation is present on Ecom `DEV-NEW` in commit `6d89694` (`Combo fix`).
- TypeScript and Vite production build passed on 2026-10-05.
- Combo stock is calculated from component capacity.
- A combo's intentional top-level `out_of_stock` value no longer incorrectly blocks an available combo.
- Listing Add to Cart increments an authenticated user's existing cart quantity by one.

