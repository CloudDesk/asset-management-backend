# Post-September 30 Fix Tracking Log (Master)

This master log tracks all critical bug fixes, security enhancements, and performance optimizations implemented after September 30, 2026 across the Nivaana platform repositories.

---

## Quick Reference Summary Table

| Fix ID | Date | Category | Summary of What Was Fixed | Status | Detailed Document |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FIX-2026-09-30-01** | 2026-09-30 | **Security & Auth** | Removed `/v1/analytics/*` endpoints from `publicRoutes.ts` to enforce mandatory JWT authentication. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-1-publicly-exposed-analytics-endpoints-authentication--security) |
| **FIX-2026-09-30-02** | 2026-09-30 | **Data Accuracy** | Excluded `sold` and soft-deleted items (`isdeleted = true`) from "Total Stock Items", counting only active available stock. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-2-inflated-total-stock-items-kpi-data-accuracy) |
| **FIX-2026-09-30-03** | 2026-09-30 | **Platform Sync** | Uncommented `platform` param in `InventoryHealthWidget` so dashboard aligns with NIVAPP platform filter. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-3-platform-filter-ignored-by-inventory-health-widget-platform-isolation) |
| **FIX-2026-09-30-04** | 2026-09-30 | **Data Accuracy** | Fixed problem products table to show platform-specific `ps.availableqty` instead of misleading global product quantity. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-4-out-of-stock-products-displayed-conflicting-global-quantities-data-accuracy) |
| **FIX-2026-09-30-05** | 2026-09-30 | **Data Accuracy** | Corrected misleading "SKU Count" chart dataset label to "Available Units" (reflecting unit sums). | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-5-misleading-sku-count-chart-label-data-accuracy) |
| **FIX-2026-09-30-06** | 2026-09-30 | **Data Accuracy** | Added taxonomy filtering to `platformStock.groupBy` so distribution chart respects applied category filters. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-6-unfiltered-platform-distribution-chart-data-accuracy) |
| **FIX-2026-09-30-07** | 2026-09-30 | **Performance** | Replaced in-memory `findMany` + `.filter()` with parallel SQL `COUNT` queries directly in PostgreSQL. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-7-in-memory-filtering-on-entire-platform-inventory-performance) |
| **FIX-2026-09-30-08** | 2026-09-30 | **Consistency** | Excluded combo products (`iscombo: false`) in Category Breakdown to match Inventory Health product counts. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-8-combo-product-count-discrepancy-between-widgets-consistency) |
| **FIX-2026-09-30-09** | 2026-09-30 | **UX Clarity** | Clarified accordion title to indicate sample size vs total problem products: `(Showing {sample} of {total})`. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-9-accordion-sample-count-vs-total-count-confusion-ux-clarity) |
| **FIX-2026-09-30-10** | 2026-09-30 | **Financial Integrity** | Excluded `returned`, `partially_returned`, and `rto_delivered` from net orders revenue calculation. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-10-inconsistent-order-net-revenue-calculations-financial-integrity) |
| **FIX-2026-09-30-11** | 2026-09-30 | **Performance** | Memoized `DEFAULT_ORDERS_FILTERS` in `DashboardPage` to prevent unnecessary component re-renders. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-11-unnecessary-react-re-renders-performance) |
| **FIX-2026-09-30-12** | 2026-09-30 | **Multi-Platform Admin** | Defaulted admin dashboard to Global Multi-Platform mode; separated physical stock into Available (15,719), Sold (708), and Damaged (6); added 3-channel distribution bar chart & channel-level problem stock breakdown. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-12-multi-platform-admin-inventory-health--channel-breakdown) |
| **FIX-2026-09-30-13** | 2026-09-30 | **UX & Data Integrity** | Removed mini channel badges from Low/Out Stock cards and removed desynchronized "Channel Stock" column from problem table, ensuring cards strictly reflect global warehouse counts and table matches actual product available quantity. | ✅ Verified | [2026-09-30 Fix Details](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md#issue-13-eliminated-misleading-channel-stock-chips-and-card-badges) |
| **FIX-2026-09-30-14** | 2026-09-30 | **Dashboard UX & Layout** | Implemented static/sticky page header with backdrop blur; eliminated artificial `maxHeight: calc(100vh - 280px)` and card-level inner scrollbars, allowing natural chart display and unified smooth page scrolling. | ✅ Verified | [2026-09-30 UX Details](2026-09-30-dashboard-ux-scrolling-layout-enhancement.md) |
| **ARCH-2026-09-30-15** | 2026-09-30 | **Tax & Catalog Architecture** | Migrated HSN Code & GST Rate from category mapping to individual product-level values with mandatory validation, optional UI auto-fill presets, and immutable orderline snapshots. Configured DB product data is complete (64/64); final database `NOT NULL` enforcement remains pending. | 🟡 Data Verified / Constraint Pending | [2026-09-30 HSN/GST Architecture](2026-09-30-product-level-hsn-gst-architecture-and-migration.md) |
| **FEATURE-2026-10-01-16** | 2026-10-01 | **Category Images / Storefront** | Added centrally managed category/subcategory images, Inventory Admin preview and upload-review UX, explicit storefront visibility, Ecom consumption of active managed images, and a shared fallback. | ✅ Verified | [2026-10-01 Category Images](2026-10-01-category-images-inventory-and-ecommerce-integration.md) |
| **FEATURE-2026-10-01-17** | 2026-10-01 | **Ecom Product Discovery** | Added compact price-range and sort controls that combine with existing category, subcategory, collection, offer, and search selections while preserving the existing cards and navigation design. | ✅ Verified | [2026-10-01 Ecom Filters](2026-10-01-ecommerce-product-price-and-sort-filters.md) |
| **FIX-2026-10-01-18** | 2026-10-01 | **Promotion Pricing / Mobile Checkout / Order Details** | Established V2 calculation as the promotion single source of truth, replaced ambiguous storefront route names with clear business-action names, bridged automatic and selected manual legacy offers into V2, corrected category/shipping savings, enabled multiple manual stackable offers, and mapped Admin order-line promotion labels from exact saved product adjustments with a legacy fallback. | ✅ Verified | [2026-10-01 Mobile Promotion V2 Parity](2026-10-01-mobile-promotion-v2-parity-and-offers-ui.md) |
| **FIX-2026-10-04-19** | 2026-10-04 | **Inventory Product Search / UX** | Made Admin product search reactive with a 350 ms debounce, removed the Search button, retained combined Category/Status filters and pagination, presented the three-character rule as neutral guidance, and added backend partial matching so queries such as `auo` find `AUORA`. | ✅ Verified | [2026-10-04 Inventory Product Search](2026-10-04-inventory-product-reactive-search.md) |
| **FIX-2026-10-04-20** | 2026-10-04 | **Ecom Promotion Evaluation / Guest UX** | Isolated V2 quote caches by selected manual promotions, added one-time stale-evaluation recovery for Apply/Remove safety, and clarified guest automatic savings without promising unselected manual offers. | ✅ Verified | [Promotion V2 reference](2026-10-01-mobile-promotion-v2-parity-and-offers-ui.md#guest-cart-promotion-presentation) |
| **FIX-2026-10-05-21** | 2026-10-05 | **Ecom Combo Stock / Cart Parity** | Aligned Web combo availability with Mobile by deriving saleable quantity from component stock and required quantities; preserved intentional virtual-SKU top-level zero stock and fixed listing Add to Cart to increment existing quantity. | ✅ Verified | [2026-10-05 Ecom Combo Parity](2026-10-05-ecom-combo-product-stock-and-cart-parity.md) |
| **FIX-2026-10-05-22** | 2026-10-05 | **Ecom Home Performance / Ranking** | Added read-only `GET /v1/products/platform/nivapp/home` that ranks Best Sellers (Nivapp `soldqty`), New Arrivals, Best of Nivaana, Flavours and Category slides in the database across the full catalogue, replacing the Home first-100-products browser sorting. Product cards reuse the listing's shared include, hydration, formatter and schema; Home falls back to the previous logic if the route fails. | 🟡 Implemented / Local Build & Dev Verification Pending | [2026-10-05 Ecom Home Catalog API](2026-10-05-ecom-home-catalog-api.md) |
| **FIX-2026-10-05-23** | 2026-10-05 | **Ecom Home Flavours** | Added four hardcoded Daily Rituals subcategory cards (Fresh Mornings to Peaceful Nights) at the start of the Flavours rail, linking to their subcategory listing with the first product image. Code flag `SHOW_FLAVOUR_OTHERS_CARD` (currently `true`) then shows one **Others** card opening all non-Daily-Rituals products (new storefront `excludeCategory` filter); `false` shows every fragrance card instead. All cards keep the "Flavour" label. Carousel arrows show only when the cards overflow. | 🟡 Implemented / Local Dev Verified | [Home Flavours: Daily Rituals cards](2026-10-05-ecom-home-catalog-api.md#home-flavours-daily-rituals-subcategory-cards) |
| **FIX-2026-10-05-24** | 2026-10-05 | **Ecom Best Sellers Listing / Ranking** | Added `sortBy=bestselling` (Nivapp `platformstock.soldqty`, ranked and paged in the database) and made it the default on `/best-sellers`, so "View products" shows the same order as Home Best Sellers; filters keep this order and 0-sold matching products follow. Added a "Best selling" sort option and removed the browser-side all-platform `soldquantity` sort. | 🟡 Implemented / Local Dev Verified | [Best Sellers listing alignment](2026-10-05-ecom-home-catalog-api.md#best-sellers-listing-alignment) |
| **FIX-2026-10-05-25** | 2026-10-05 | **Ecom Products Infinite Scroll** | Fixed the load-more observer silently detaching when the scroll marker remounted without a loading-state change; the marker is now held in React state so the observer always re-attaches. | 🟡 Implemented / Local Dev Verified | [Products listing: infinite scroll trigger](2026-10-05-ecom-home-catalog-api.md#products-listing-infinite-scroll-trigger) |
| **FIX-2026-10-05-26** | 2026-10-05 | **Ecom Products Listing Performance** | Moved category, subcategory, flavour, collection and search filtering from the browser to the database through opt-in `filterMode=storefront`, preserving the previous matching rules (115-case parity check). Filtered pages now load one page and fetch more on scroll instead of downloading the whole catalogue; the header shows the API total. Existing API filter behaviour for other callers is unchanged. | 🟡 Implemented / Local Dev Verified | [Products listing: backend filtering and paging](2026-10-05-ecom-home-catalog-api.md#products-listing-backend-filtering-and-paging) |
| **FIX-2026-10-05-27** | 2026-10-05 | **Ecom Home Reviews** | "Real Customers, Real Reviews" now pages in fixed steps (3 cards per desktop page, 1 on mobile) without wrapping, so no card repeats; Previous is disabled on the first page and Next on the last. Only 4–5 star reviews with comments are shown. The fallback (used when no such review exists) has 9 unique, natural-sounding reviews with mixed name styles (full names, first names, a few initials) (3 desktop pages) with distinct Home product images. Reviewer names align on one line across cards and pages (four-line text area plus shared grid rows), without truncating text. | 🟡 Implemented / Local Dev Verified | `Nivaana-Ecom-Web/src/pages/Home.tsx` |
| **FIX-2026-10-05-28** | 2026-10-05 | **Ecom Cart / Checkout Offers** | Fixed Checkout disabling every Apply after an offer was removed (the saved selection lost the stackable flag; Checkout now reads it from live offer data and Remove keeps it). Cart and Checkout now share one offer-button rule: combinations are decided by the V2 engine (Apply is disabled only for real blockers or while another apply/remove runs), automatic offers show "Automatic"/"Applied", code-entry offers show "Use code", and non-stackable offers carry a note plus clear messages when they replace other offers or are not applied. Offer buttons no longer flicker (Removing → Applying → grey → Apply): one action-based label with a spinner, no grey flash during background price checks, and no repeat quote request after Apply/Remove. | 🟡 Implemented / Logged-in Dev Verification Pending | `Nivaana-Ecom-Web/src/lib/cartPromotions.ts` |
| **FIX-2026-10-05-29** | 2026-10-05 | **Ecom Checkout Offers Design** | Checkout's Remove button showed in the site's default yellow (same as Pay) and applied offers did not look applied. Applied offers now use a green card with "✓ Applied" and a quiet grey Remove link (same on Cart); yellow is kept for Apply and Pay. The Checkout summary collapses into one line ("5 offers applied · You save Rs. 725" plus the offer names) and a "View / change offers" button that opens the pop-up, keeping Pay close. Totals: the discount line reads "Promotions" when several offers apply (was the first offer's name), and free shipping shows the standard fee struck through before "Free" (Cart already did). A non-stackable offer that is not applied now shows an amber note on its own card instead of a red error banner, and the note clears when the pop-up closes (it previously stayed under the coupon box). | 🟡 Implemented / Logged-in Dev Verification Pending | `Nivaana-Ecom-Web/src/pages/Checkout.tsx` |
| **FIX-2026-10-05-30** | 2026-10-05 | **Promotion V2 Engine / Whole-Order Offers** | A non-stackable cart offer ("Flat 100 On 1299") was applied partially (Rs. 64.24) next to the automatic 10% Incense offer: the engine split it per item and kept only the shares on items no other offer discounted. Whole-order offers (promotion types `FIXED_AMOUNT_OFF_CART` / `PERCENT_OFF_CART`) are now evaluated as one block, applied in full or not at all, and compared with the offers they conflict with by total saving (Option A). | 🟡 Implemented / Dev Verification Pending | `src/services/promotion-v2-engine.ts` |
| **FIX-2026-10-05-31** | 2026-10-05 | **Inventory Promotions List / Type Filter** | The list type filter now uses the create-form types in the same order (admin app). Product, category and subcategory offers share the saved type `PERCENT_OFF_ITEM` / `FIXED_AMOUNT_OFF_ITEM`, so the backend classifies each promotion like the table badge (saved type for free shipping and entire-cart offers, latest V2 rule template otherwise; `OTHER` for older types). Raw saved types still filter as before. | 🟡 Implemented / Dev Verification Pending | `src/utils/promotionListType.ts` |
| **FIX-2026-10-05-32** | 2026-10-05 | **Inventory Promotion Form / Category Names** | The category/subcategory chooser showed stored values ("Incense Rituals", "perfumes") because the V2 facets endpoint returned the product value as the label. It now returns the picklist label ("Incense & Rituals", "Perfumes") while the id stays the stored value, so saving and matching are unchanged. | 🟡 Implemented / Dev Verification Pending | `src/services/promotions-v2.service.ts` |

---

## Chronological Detailed Logs

### [2026-09-30: Product-Level HSN Code and GST Rate Architecture & Migration](2026-09-30-product-level-hsn-gst-architecture-and-migration.md)
* **Summary:** Decouples HSN code and GST rate from category-level mapping to individual product attributes (`product.hsn_code` and `product.gst_rate`). Retains `gst_hsn_mapping` as an auto-fill preset provider. Preserves historic order tax integrity via `orderline` snapshots.
* **Configured DB verification:** All 64 products now contain HSN/GST values. The final migration must still be rerun to enforce `NOT NULL` at the database level.
* **Intentional manual classifications:** `everyday_perfumes` → `3307 / 18%`, `luxury_gifts` → `4202 / 18%`, and `decor` → `4420 / 5%`. These values were written directly to matching products; no `gst_hsn_mapping` rows were created.
* **Preset behavior:** A missing `gst_hsn_mapping` row is valid. It only means a future product will not auto-fill; the admin must enter and verify mandatory product-level HSN/GST values manually.
* **Runtime verification:** Order `NIVAANA-0000000377` has complete orderline snapshots matching its current product values, including product `KRA-0075`, whose `incense_accessories` subcategory intentionally has no mapping preset.
* **SQL Migration Script:** [`scripts/migrations/20260930_add_product_hsn_gst_backfill.sql`](../../scripts/migrations/20260930_add_product_hsn_gst_backfill.sql)
* **Repositories / Files Impacted:**
  - `asset-management-backend/prisma/schema.prisma`
  - `asset-management-backend/src/utils/dynamicDbOperations.ts`
  - `asset-management-backend/src/schemas/product.schema.ts`
  - `asset-management-backend/src/services/product.service.ts`
  - `asset-management-backend/src/services/gst.service.ts`
  - `asset-management-backend/src/services/orders.service.ts`
  - `asset_management_frontend_aromazen/src/types/product.ts`
  - `asset_management_frontend_aromazen/src/components/products/ProductCreate.tsx`
  - `asset_management_frontend_aromazen/src/components/products/ProductDetail.tsx`

### [2026-09-30: Inventory Dashboard & Analytics Security, Accuracy, and Performance Optimization](2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md)
* **Summary:** Addressed public API exposure, inflated physical inventory counts, platform filter mismatches, in-memory filtering performance bottlenecks, and widget synchronization between backend and frontend.
* **Repositories / Files Modified:**
  - `asset-management-backend/src/config/publicRoutes.ts`
  - `asset-management-backend/src/services/analytics.service.ts`
  - `asset-management-backend/src/services/product.service.ts`
  - `asset_management_frontend_aromazen/src/components/dashboard/InventoryHealthWidget.tsx`
  - `asset_management_frontend_aromazen/src/pages/dashboard/DashboardPage.tsx`

### [2026-09-30: Dashboard UX & Scrolling Layout Enhancement](2026-09-30-dashboard-ux-scrolling-layout-enhancement.md)
* **Summary:** Pinned the dashboard header with a sticky backdrop blur effect and removed artificial height constraints to eliminate the "half-struck" cutoffs and nested scroll traps across all widgets.
* **Repositories / Files Modified:**
  - `asset_management_frontend_aromazen/src/pages/dashboard/DashboardPage.tsx`
  - `asset_management_frontend_aromazen/src/components/dashboard/DashboardWidget.tsx`

### [2026-10-01: Category Images — Inventory Admin and Ecom Integration](2026-10-01-category-images-inventory-and-ecommerce-integration.md)
* **Summary:** Added centralized category/subcategory image management across Backend and Inventory Admin, including full image previews, preview-before-upload, explicit storefront visibility, and Ecom consumption of active managed images with a shared fallback.
* **Repositories Impacted:**
  - `asset-management-backend`
  - `asset_management_frontend_aromazen`
  - `Nivaana-Ecom-Web`
  - `vyb-lyf-file-upload`

### [2026-10-01: Ecom Product Price and Sort Filters](2026-10-01-ecommerce-product-price-and-sort-filters.md)
* **Summary:** Added compact price and sort controls to the Products heading. Filters compose with existing taxonomy/search/collection state, persist in URL parameters, and reuse the existing product listing API without changing product cards or category navigation design.
* **Repositories Impacted:**
  - `Nivaana-Ecom-Web`
  - `asset-management-backend`

### [2026-10-01: Mobile Promotion V2 Parity and Offers UI](2026-10-01-mobile-promotion-v2-parity-and-offers-ui.md)
* **Summary:** Replaced Mobile's legacy automatic promotion calculation with the same canonical V2 calculation used by Ecom Web. The API now uses clear route names such as `customer-offers`, `available-offers`, `check-eligibility`, `calculate`, and `evaluations/:id`. This restores category/subcategory/product targeting accuracy, keeps a single checkout evaluation ID, prevents free-shipping savings from being counted twice, supports multiple manual stackable offers, presents automatic/manual offers with the correct actions, and shows targeted promotions only on their exact saved order lines in Admin.
* **Compatibility:** No backend schema, promotion storage format, payment payload field, or order payload data type was changed.
* **Storage ownership:** `orderline` is the immutable source for combined promotion total, payable amount, HSN, and GST values. `promotion_evaluation_adjustments` stores the exact promotion-wise product allocation used by Admin breakdowns. Completed-order evaluations and adjustments must be retained; promotions should be deactivated or archived instead of hard-deleted.
* **Redemption timestamps:** New V2 redemption-history rows use epoch milliseconds. Redemption History normalizes legacy seconds and current milliseconds for sorting, pagination, display, and date filtering without rewriting historical rows. Its type filter matches the seven visible Promotion create types.
* **Admin promotion filters:** Promotions and Redemption History search/filter controls are reactive with a 350 ms debounce and a single Clear action per tab; API and promotion logic remain unchanged.
* **Repositories Impacted:**
  - `Vibrant-Life-mobile-app`
  - `asset-management-backend` (documentation and existing V2 API contract)

### [2026-10-04: Inventory Product Reactive Search](2026-10-04-inventory-product-reactive-search.md)
* **Summary:** Removed the Products page Search button and aligned text search with the existing immediate Category and Status filters. Valid searches apply after a 350 ms debounce, short input shows neutral guidance without calling the API, and the last valid filters remain stable for pagination. Backend product search now combines PostgreSQL full-text search with case-insensitive partial matching so product fragments such as `auo` match `AUORA`.
* **Compatibility:** Reuses `GET /v1/products` and its existing `searchtext`, `category`, `productstatus`, page, and limit parameters. No schema, response shape, or product persistence logic changed.
* **Repositories Impacted:**
  - `asset_management_frontend_aromazen`
  - `asset-management-backend`

### [2026-10-04: Ecom Promotion Evaluation Safety and Guest Offer Guidance](2026-10-01-mobile-promotion-v2-parity-and-offers-ui.md#guest-cart-promotion-presentation)
* **Summary:** Guest Order Summary keeps automatic V2 savings as clearly marked estimates, does not subtract unselected manual promotions, and invites the customer to sign in to view the best eligible offer. Ecom calculation caches now include the normalized selected-promotion set, and an expired/inactive/missing evaluation is recalculated and retried once when removing a manual promotion.
* **Compatibility:** No Backend route, request payload, database schema, promotion-selection rule, or checkout behaviour changed. The Order Summary container and **Login to Checkout** button are unchanged.
* **Verification:** Ecom production build passed. Changed promotion files have no ESLint errors; only the existing Cart hook warnings remain.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### [2026-10-05: Ecom Combo Product Stock and Cart Parity](2026-10-05-ecom-combo-product-stock-and-cart-parity.md)
* **Summary:** Web now follows Mobile's component-inventory pattern for combo products. Combo saleable quantity is the minimum component capacity after dividing each Nivapp component stock by its required quantity. Intentional virtual-SKU top-level zero stock no longer marks a valid combo unavailable, and listing Add to Cart increments an authenticated user's existing quantity by one.
* **Compatibility:** No Backend API, database schema, inventory write, price/discount calculation, wishlist flow, or payment-validation rule changed. Payment initiation remains the authoritative stock check.
* **Verification:** Confirmed on Ecom `DEV-NEW` commit `6d89694`; TypeScript and Vite production build passed.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### [2026-10-05: Ecom Home Catalog API](2026-10-05-ecom-home-catalog-api.md)
* **Summary:** Home sections are now ranked by the Backend across all Nivapp products in one request: Best Sellers by Nivapp `platformstock.soldqty` (10), New Arrivals by `createddate` (10), Best of Nivaana by the existing score on Nivapp sold quantity (8), plus all distinct Flavours and Category slides. The browser no longer downloads 100 products to build these sections.
* **Compatibility:** Additive public read-only route. Listing code was moved into shared helpers without logic changes, so Home and listing return identical product objects (price, discount, `availablequantity`, combo components). No schema, dependency, cache, cart, wishlist, checkout, Mobile or Inventory change. Home falls back to the previous `getProducts(1, 100)` logic if the route fails.
* **Repositories Impacted:**
  - `asset-management-backend`
  - `Nivaana-Ecom-Web`

### [2026-10-05: Ecom Home Flavours — Daily Rituals Cards](2026-10-05-ecom-home-catalog-api.md#home-flavours-daily-rituals-subcategory-cards)
* **Summary:** The Flavours rail keeps its existing design. Its first four cards are the Daily Rituals subcategories (Fresh Mornings, Relaxation & Calm, Dusky Evenings, Peaceful Nights), each opening `/products?category=daily_rituals&subcategory=<value>` with the first product image of that subcategory. Fragrance cards follow alphabetically and still open that fragrance. All cards keep the "Flavour" label.
* **Others flag:** `SHOW_FLAVOUR_OTHERS_CARD` (code constant in `Home.tsx`, currently `true`). `true` = Daily Rituals cards + one **Others** card opening `/products?excludeCategory=daily_rituals&title=Others`; `false` = Daily Rituals cards + every fragrance card.
* **Compatibility:** The four subcategory values are hardcoded in `dailyRitualFlavorSubcategories` (`Home.tsx`) and must be updated if those picklist values are renamed. A subcategory without products shows the default image and an empty listing. The listing API gained an additive storefront `excludeCategory` parameter (products without a category are kept); existing parameters are unchanged.
* **Carousel arrows:** Previous/next arrows render only when the cards overflow the rail; with five cards on desktop they are hidden and the rail aligns with the heading. Mobile swipe is unchanged.
* **Reference:** [screenshot (flag `true`)](images/2026-10-05-home-flavours-daily-rituals-others.webp)
* **Verification:** Local dev: both flag values render correctly; Others opens 71 products (74 minus 3 Daily Rituals) in one request; desktop shows no arrows with five cards, mobile still overflows and swipes. Backend and Ecom TypeScript and ESLint passed.
* **Repositories Impacted:**
  - `asset-management-backend`
  - `Nivaana-Ecom-Web`

### [2026-10-05: Ecom Best Sellers Listing Ranking](2026-10-05-ecom-home-catalog-api.md#best-sellers-listing-alignment)
* **Summary:** The Home Best Sellers "View products" page (`/best-sellers`) previously loaded products newest-first, 40 at a time, and re-sorted only the loaded page by all-platform `soldquantity`, so its order differed from Home. `GET /v1/products/platform/:platform` now accepts `sortBy=bestselling`, ranking by Nivapp `platformstock.soldqty` (then product id) in the database with paging. `/best-sellers` uses it by default; any filter keeps this order, and matching products with 0 sold are listed after those with sales. "Best selling" is also available in the sort menu.
* **Compatibility:** Additive sort value; existing sorts unchanged. No schema change.
* **Verification:** Local dev: first 10 results equal Home Best Sellers; all 74 products returned across pages without duplicates; category and price filters keep the order. Backend and Ecom TypeScript passed.
* **Repositories Impacted:**
  - `asset-management-backend`
  - `Nivaana-Ecom-Web`

### [2026-10-05: Ecom Products Infinite Scroll Trigger](2026-10-05-ecom-home-catalog-api.md#products-listing-infinite-scroll-trigger)
* **Summary:** The load-more observer only re-attached when the query loading state changed, so a remounted scroll marker (for example after a hot reload) could stop further pages loading silently. The marker element is now held in React state and the observer re-attaches whenever it mounts or changes.
* **Compatibility:** Frontend only; no API or UI change.
* **Verification:** Local dev: scrolling loads page 2 on `/products`, including after forcing a hot reload of the page. Ecom TypeScript passed.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### [2026-10-05: Ecom Products Listing — Backend Filtering and Paging](2026-10-05-ecom-home-catalog-api.md#products-listing-backend-filtering-and-paging)
* **Summary:** The Products page sent only sort and price to the API and filtered category, subcategory, flavour, collection and search in the browser, so every filtered view downloaded the whole catalogue. The listing API now accepts opt-in `filterMode=storefront` with `category`, `subcategory`/`subcategoryMatch`, `subsubcategory`/`subsubcategoryMatch`, `collection` (`deals`, `gift-sets`) and `search`, implemented in `src/utils/storefrontListingFilters.ts` with the same matching rules the browser used. Ecom sends all filters, loads further pages only on scroll, and shows the API total ("Showing 38 products").
* **Compatibility:** Without `filterMode`, existing `category`/`subcategory`/`search` behaviour is unchanged (Mobile sends only page and limit). No schema change. On filtered pages the Recently viewed rail and nested sub-subcategory images use the loaded filtered products, so they can show fewer items than before.
* **Verification:** 115 filter combinations matched the previous browser logic exactly (products, order, totals) on the full local catalogue. Local dev: filtered pages make one listing request and load more on scroll. Backend and Ecom TypeScript passed; Ecom ESLint has no errors (one existing hook warning).
* **Repositories Impacted:**
  - `asset-management-backend`
  - `Nivaana-Ecom-Web`

### 2026-10-05: Ecom Home Reviews Paging and Fallback
* **Summary:** The review carousel moved one card per click and wrapped, so with few reviews the same cards reappeared on every "page". It now pages in fixed steps of 3 on desktop and 1 on mobile, stops at the ends (Previous disabled on the first page, Next disabled on the last), and shows only 4–5 star reviews that have a comment. When no such review exists, a fallback of 9 unique reviews is shown (3 desktop pages); three original texts were kept (Julene G., Meera Subramanian, Rohan M.) and six were rewritten in a natural voice. Fallback avatars use distinct Home product images, falling back to static assets.
* **Card alignment:** Reviewer names sit on the same line in every card and on every page. The review text reserves four lines, and on desktop/tablet the three cards share grid rows (CSS subgrid: stars, text, name), so a shorter review no longer pulls its name up. Cards keep their original 350px minimum height. Desktop review text is limited to 10 lines (was 5), so fallback reviews are no longer cut off with "…" at 1024px; mobile keeps the 5-line limit.
* **Compatibility:** Frontend only; no API change. The ratings request is unchanged (`GET /v1/ratings?page=1&limit=12`). Reviews below 4 stars or without a rating are no longer shown on Home.
* **Verification:** Local dev (0 ratings, fallback active): desktop pages 1–3 show 9 unique names with correct button states; mobile steps through 9 unique cards and stops at both ends. Name position measured on all three pages at 1440px (217px from card top, cards 350px), 1024px (281px) and 800px (345px): identical on every page with no truncated text. Ecom TypeScript and ESLint passed.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-05: Ecom Cart and Checkout Offer Parity
* **Issue:** After removing one offer while another stayed applied, Checkout disabled every other Apply button while Cart still allowed them. The saved selection (`nivaana_selected_cart_promotion:<userId>`) was rebuilt on Remove without `stackable`, and Checkout read the flag only from that saved copy; Cart read it from live offer data. Cart and Checkout also used separate copies of the offer-button logic, so automatic and code-entry offers behaved differently (Cart showed Apply, Checkout showed badges) and Checkout showed raw reason codes such as "conflicted with better offer".
* **Fix:**
  - Shared helpers in `src/lib/cartPromotions.ts`: `getOfferActionState` (button state), `resolveAppliedStackable` (live details first, saved copy as fallback), `preserveAppliedStacking` (Remove keeps the flags), `offerCombinationNote`, `describeOfferApplied` / `describeOfferNotApplied`, `promotionReasonCopy`, `PromotionOfferMessageError`.
  - The frontend no longer blocks combinations: the V2 engine keeps whichever set saves more. Apply is disabled only when not signed in, a free-shipping minimum is not met, the offer was already used, pricing is still loading (Checkout), or another apply/remove is running (both pages, prevents overlapping clicks).
  - Automatic offers show "Automatic" (or "Applied"); code-entry offers show "Use code" (entered in the Checkout coupon box) on both pages.
  - Non-stackable offers show "Can't be combined with other offers. We'll keep whichever saves you more." Success names any replaced offers and the extra saving; a rejection explains the comparison, for example "149 Off saves ₹149, but your current offers save ₹299. Remove them to use this offer instead."
* **Offer button flicker (both pages):** Clicking Remove showed "Removing...", then "Applying...", then a grey Apply, then Apply (Apply mirrored it). Causes: the label depended on the card's state instead of the running action; the action waited for extra refreshes (offer list, plus a legacy evaluation call that created an unneeded evaluation); and the quote already returned by Apply/Remove was fetched again, which greyed every Apply while it reloaded. Now the clicked button shows a spinner with "Applying..." or "Removing..." until the action finishes, then switches once to its final state. Other buttons ignore clicks while an action or price re-check runs but keep their look, and the pop-up header shows one "Updating total..." line. The returned quote is reused for 15 seconds (`createSeededQuoteTracker`), and offer-list refreshes run in the background; the legacy evaluation call is skipped for V2.
* **Compatibility:** Frontend only; no API, payload or schema change. Existing saved selections without the flag are handled automatically. All 10 active promotions in the dev database are currently stackable, so the non-stackable path is dormant until such an offer exists.
* **Verification:** 35 checks of the shared rules and messages passed (including busy-not-grey buttons, action-based labels and the quote reuse window) (stale saved flag, Remove keeping flags, every button state, notes, applied/replaced/rejected messages). Ecom TypeScript, ESLint (no new warnings) and production build passed; Cart and Checkout load without errors. Pending: logged-in dev test with user 41's cart, and a non-stackable test offer.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-05: Ecom Checkout Offers Design
* **Issue:** On Checkout, Remove rendered as a filled yellow button because `src/index.css` gives every `<button>` the primary yellow and the button set no background of its own. It competed with the Pay button, and picked offers looked like unapplied ones (only automatic offers had an "Applied" badge). The summary listed every applied offer card above Pay.
* **Fix:**
  - Applied offers: light green card, "✓ Applied" label, and a small grey "Remove" text link (transparent background) on both Checkout and Cart. Pending state shows a spinner with "Removing...".
  - Yellow is used only for Apply and Pay.
  - Checkout summary: one green line, "N offers applied · You save Rs. X", with the applied offer names below, and a "View / change offers (N)" button that opens the pop-up where offers are applied or removed. With no applied offers: "N offers are available for this order" and "View offers (N)".
  - Totals: the promotion line is labelled "Promotion" for one discount offer and "Promotions" for several (shared `promotionDiscountLabel`, also used by Cart), instead of the first offer's name (e.g. "10 Upto 199 -Rs. 575" for four offers). Shipping shows ~~Rs. 150~~ **Free** in green when a free-shipping offer applies, and the plain amount otherwise.
  - "Not applied" feedback: the V2 engine rejects a non-stackable offer with `CONFLICTED_WITH_BETTER_OFFER` and returns both savings; the wording is built on the frontend. It was shown in the shared red error box, which Checkout also renders under the coupon field, so it looked like an error and stayed after closing the pop-up. It now appears as an amber note on that offer's card ("Not applied. Your current offers save you ₹625, more than the ₹100 from this offer. To use this one instead, remove your other offers first."), clears when the pop-up closes or another offer action starts, and the red box is kept for coupon-code errors only. Cart uses the same card note instead of a warning toast.
* **Compatibility:** Frontend only; no logic, API or amount change.
* **Verification:** Ecom TypeScript, ESLint (no new warnings) and production build passed; label rule checked for 4 offers + free shipping (Promotions), 1 offer (Promotion) and free shipping only. The new card and summary markup was rendered inside the running app (real styles) and checked: grey Remove, green applied cards, yellow only on Apply and Pay. Pending: logged-in check with user 41.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-05: Promotion V2 Engine — Whole-Order Offers Applied in Full or Not at All
* **Issue:** With user 41's cart, selecting the non-stackable "Flat 100 On 1299" (ID 77, `FIXED_AMOUNT_OFF_CART`) while the automatic stackable "10% off Incense Rituals" (ID 75) was active applied Flat 100 as Rs. 64.24 (quote `d06e746c…`). Legacy cart offers are bridged into V2 as item-level `MERCHANDISE_DISCOUNT` rules, so `atomicCandidates` split the Rs. 100 proportionally per unit; on the 5 incense items the 10% saved more and won, so only the shares on the 4 other items survived (50.64 + 8.41 + 3.51 + 1.68). The offer was partially combined despite being non-stackable and its amount was confusing. Automatic vs manual was not the cause; any overlapping item offer would do the same.
* **Fix (Option A — best total saving wins, all or nothing):**
  - `PromotionCampaign.appliesToWholeOrder` (optional) marks a whole-order offer; such a candidate is never split per unit.
  - `isWholeOrderPromotionType()` (`src/utils/legacy-promotion-v2.ts`): explicit list `FIXED_AMOUNT_OFF_CART` and `PERCENT_OFF_CART` (Inventory Admin "Fixed Amount Off Entire Cart" / "Percent Off Entire Cart"). Product, category and subcategory templates are saved as `PERCENT_OFF_ITEM` / `FIXED_AMOUNT_OFF_ITEM` and are not flagged; template keys (`PERCENT_OFF_PRODUCTS`, …), `BOGO`, `FREE_PRODUCT`, `FREE_SHIPPING` and the `ENTIRE_CART` scope facet are never matched.
  - `promotions-v2.service.ts` sets the flag for every campaign built from a promotion (legacy bridge, published V2 rule versions and simulate).
* **Impact by configuration:**
  | Case | Before | After |
  | :--- | :--- | :--- |
  | Non-stackable cart offer vs overlapping item offer(s) | Partial cart amount + other offer | Whole comparison: cart offer in full **or** not applied (e.g. Flat 100 Rs. 100 vs 10% Rs. 127 → not applied; vs Rs. 50 → Flat 100 applies in full and replaces it) |
  | Stackable cart offer + stackable item offers (61, 62 today) | Both in full | Unchanged |
  | Stackable cart offer vs **non-stackable** item offer | Partial cart amount + item offer | Whole comparison (honours the item offer's "can't be combined"). No such item offer is configured today |
  | Item-level offers (`*_ITEM`, published V2 rules), BOGO/free product, free shipping | — | Unchanged (no flag; free shipping stays separate and still combines) |
  | Min order value, caps, budgets, usage limits, channels, audiences, auto/manual mode, priority | — | Unchanged |
* **Note:** published V2 rule versions keep their own `stacking.stackable` in `rule_json`; changing the `stackable` column on the promotions table does not update an already-published rule (legacy-bridged offers such as 61, 62, 77 read the column live).
* **Verification:** 7 new engine tests (reported cart reproduced: Flat 100 not applied vs Rs. 127; applied in full vs Rs. 50; stackable cart + stackable item unchanged; still combines with free shipping; `PERCENT_OFF_CART` all-or-nothing; item-level offers unchanged; type detection). Before/after check on the reported cart: Rs. 64.24 → not applied. Full backend suite 328/328 and TypeScript passed. Pending: dev check with user 41.
* **Repository Impacted:**
  - `asset-management-backend`

### 2026-10-05: Inventory Promotions List — Create-Form Type Filter
* **Issue:** The admin app's type filter was changed to the create-form types (`FREE_SHIPPING`, `FIXED_AMOUNT_OFF_CART`, `PERCENT_OFF_CART`, `PERCENT_OFF_SUBCATEGORIES`, `PERCENT_OFF_CATEGORIES`, `PERCENT_OFF_PRODUCTS`, `FIXED_AMOUNT_OFF_PRODUCTS`), but the backend matched the `type` column exactly; product, category and subcategory offers are all saved as `PERCENT_OFF_ITEM` / `FIXED_AMOUNT_OFF_ITEM`, so those four filters returned nothing.
* **Fix:** `src/utils/promotionListType.ts` classifies a promotion by its saved type (free shipping, entire cart) or its latest V2 rule (template, or the same inference as the admin badge), with `OTHER` for BOGO, free product, Buy X / tier templates and older item offers. `promotions.service.ts` applies it in admin mode when a form type is selected; raw saved types still use the column match.
* **Verification:** 5 tests; admin list on dev data — Free Shipping 7, Fixed Amount Off Entire Cart 6, Percent Off Entire Cart 8, Subcategories 1, Categories 4, Selected Products 8, Fixed Amount Off Selected Products 2, `PERCENT_OFF_ITEM` 19 (unchanged). Backend suite and TypeScript passed.
* **Repository Impacted:**
  - `asset-management-backend` (admin filter change committed separately in `asset_management_frontend_aromazen` 659a4e7)

### 2026-10-05: Inventory Promotion Form — Category and Subcategory Names
* **Issue:** "Choose categories" showed "Incense Rituals", "Home Car Fragrance" and "perfumes" although the picklist labels are "Incense & Rituals", "Home & Car Fragrance" and "Perfumes". `getFacets()` collected distinct product `category` / `subcategory` values and used the value as the label; the form only prettifies values containing `_`.
* **How a promotion stores its target:** the picklist **value**, not a numeric id or the label — e.g. promotion 75 rule `qualifier.scope.include = [{ facet: "CATEGORY", values: ["incense_rituals"] }]`, promotion 63 `[{ facet: "SUBCATEGORY", values: ["air_fresheners"] }]`. The `promotions` row keeps `type: PERCENT_OFF_ITEM` and the action; matching compares the rule value with the product value (case-insensitive), so labels never affect pricing.
* **Fix:** `getFacets()` reads active product picklist entries for `category` / `subcategory` and returns `{ id: <stored value>, label: <picklist label> }`; values without a picklist entry keep the value as label.
* **Compatibility:** ids are unchanged, so existing promotions, new saves and matching are unaffected.
* **Admin app:** the rule builder's label helper was renamed `friendly` → `toDisplayLabel` (`PromotionRuleBuilderV2.tsx`); behaviour unchanged.
* **Verification:** facets on dev data — 6 categories and 15 subcategories all return picklist labels with unchanged ids; backend suite and TypeScript passed.
* **Repository Impacted:**
  - `asset-management-backend`
