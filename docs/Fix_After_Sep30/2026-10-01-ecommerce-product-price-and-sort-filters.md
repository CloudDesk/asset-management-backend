# Ecom Product Price and Sort Filters

**Date:** 2026-10-01  
**Status:** ✅ Implemented and Build Verified  
**Repositories:** `Nivaana-Ecom-Web`, `asset-management-backend`

---

## 1. Objective

Add compact price-range and sorting controls to the Ecom Products page without redesigning product cards, category navigation, or the existing product grid.

The new filters must work both for the complete catalog and in combination with existing category, subcategory, sub-subcategory, collection, offer, and search selections.

---

## 2. Available Filters

### 2.1 Sort Options

| UI option | Backend sort |
| :--- | :--- |
| Newest first | `createddate desc` |
| Price: Low to High | `price asc` |
| Price: High to Low | `price desc` |
| Ratings: High to Low | `averagerating desc` |
| Name: A to Z | `name asc` |
| Name: Z to A | `name desc` |

The Backend adds a stable product ID ordering after the requested sort so pagination does not produce inconsistent ordering when multiple products have the same primary value.

### 2.2 Price Ranges

| UI option | Request boundaries |
| :--- | :--- |
| All prices | No `minPrice` or `maxPrice` |
| Under ₹100 | `maxPrice=99.99` |
| ₹100 – ₹250 | `minPrice=100`, `maxPrice=249.99` |
| ₹250 – ₹500 | `minPrice=250`, `maxPrice=499.99` |
| ₹500 – ₹1000 | `minPrice=500`, `maxPrice=1000` |
| Above ₹1000 | `minPrice=1000.01` |

These non-overlapping boundaries ensure that a product belongs to only one displayed price bucket.

The filter uses the existing product `price` field and does not introduce a new discount-price calculation.

---

## 3. Combined Filtering Behavior

Price and sort are represented by URL parameters:

```text
price=<price-range-key>
sort=<sort-key>
```

Examples:

```text
/products?category=home_car_fragrance&price=250-500&sort=price-asc
/products?category=incense_rituals&subcategory=incense_sticks&sort=name-asc
/products?price=above-1000&sort=rating-desc
```

Behavior rules:

- On the all-products view, price and sort operate across the complete catalog.
- When a category/subcategory is selected, its taxonomy constraint remains active and the new price/sort options are applied together with it.
- Selecting another category or subcategory preserves the active price and explicit sort parameters.
- `Clear` removes only `price` and `sort`; it does not clear the selected category, subcategory, collection, offer, or search.
- Invalid URL filter values safely fall back to `Newest first` and `All prices`.
- Filter values participate in the React Query cache key, so each combination has the correct cached result.
- Infinite pagination uses the same filter values for every subsequent page.
- Existing collection-specific ordering remains active when no explicit sort parameter is selected. An explicit sort overrides collection ordering.

---

## 4. UI Placement

The controls are placed in the Products results heading beside the product count:

- Compact pill-shaped Price control.
- Compact pill-shaped Sort control.
- `Clear` action appears only when price or a non-default sort is active.
- No large filter container or separate filter panel.
- The unnecessary `All products` tag/action was removed.
- Product cards, category chips, product-grid dimensions, and existing visual hierarchy were not redesigned.
- On smaller screens, Price and Sort use a two-column layout and remain touch friendly.

---

## 5. Data Flow

```text
Products URL parameters
  → Products.tsx validates price/sort keys
  → productPlatformService sends minPrice/maxPrice/sortBy/sortOrder
  → Backend filters and sorts platform products
  → Existing category/subcategory/search/collection constraints are applied
  → Product grid renders the combined result
```

The existing product listing endpoint and query parameter model are reused; no new endpoint was introduced.

---

## 6. Files Modified

### Ecom

- `Nivaana-Ecom-Web/src/components/ProductFilters.tsx`
- `Nivaana-Ecom-Web/src/pages/Products.tsx`
- `Nivaana-Ecom-Web/src/services/productPlatformService.ts`

### Backend

- `asset-management-backend/src/services/product.service.ts`

---

## 7. Verification

- Ecom TypeScript and production build: passed.
- Backend TypeScript and production build: passed.
- Price and sort work on the all-products page.
- Price and sort remain active when changing category or subcategory.
- Clear removes only the new filter parameters.
- Product-card and navigation-chip designs remain unchanged.
- Existing linter output is limited to previously present React hook dependency warnings in `Products.tsx`.

