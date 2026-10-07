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
| **FIX-2026-10-05-33** | 2026-10-05 | **Ecom Mobile Number Autofill** | Choosing a saved number such as "+91 99948 24573" filled "9199948245" (country code kept, last two digits lost) on Login, Checkout and Saved Addresses. A shared `normalizeIndianMobileInput` now removes a leading +91/91 or 0 before keeping 10 digits; Login asks the browser for the national number (`tel-national`). Mobile numbers must now be 10 digits starting with 6–9 on Login, address save and payment. | 🟡 Implemented / Dev Verification Pending | `Nivaana-Ecom-Web/src/lib/phone.ts` |
| **FIX-2026-10-05-34** | 2026-10-05 | **Ecom Address Form Design** | Checkout and Saved Addresses now share one modern address form (`src/components/AddressForm.tsx`): labels above rounded inputs, Contact details / Address sections, +91 mobile prefix, inline field errors, pinned Save/Cancel bar, single column on phones. Same fields and saved payload; "Locality" relabelled "House / Flat / Building no." (still `doornumber`); unsaved Alternate Phone and Home/Work removed from the UI. | 🟡 Implemented / Logged-in Dev Verification Pending | `Nivaana-Ecom-Web/src/components/AddressForm.tsx` |
| **FIX-2026-10-05-35** | 2026-10-05 | **Ecom Wishlist Description** | The wishlist card printed `shortdescription` as plain text, so its HTML tags showed ("<p>• Premium…</p>"). It now renders through the same sanitised `RichTextContent` as Product Details, compact, clamped to two lines with a fixed max height so the card never grows. Card actions restyled: price (with struck-through MRP and saving) and actions share one bottom row; Add to Cart uses the theme primary, Remove is a neutral icon button that turns red on hover. | 🟡 Implemented / Dev Verification Pending | `Nivaana-Ecom-Web/src/pages/Wishlist.tsx` |
| **FIX-2026-10-06-36** | 2026-10-06 | **Ecom Product Listing Loading State** | Changing category/subcategory showed "Showing 0 products" and a plain spinner. The count is now a shimmer placeholder while loading, the grid shows product-card skeletons (badge, heart, title, rating, price, cart button) with a staggered shimmer, next pages append skeleton cards instead of a spinner, and real cards fade in. Also fixed the shared `Skeleton`, which rendered transparent site-wide. | 🟡 Implemented / Dev Verification Pending | `Nivaana-Ecom-Web/src/components/ProductCardSkeleton.tsx` |
| **FIX-2026-10-06-37** | 2026-10-06 | **Ecom Order History Paging / Summary** | Web Orders loaded only the first 10 orders (no page/limit sent) and computed its summary cards from them, counting cancelled orders in "Total spent". Orders now load 10 at a time on scroll (with a Load more fallback and skeletons), deep links load pages until the order is found, and the cards use a new `GET /v1/orders/user/:userid/summary` (own orders only for customers): total, active, cancelled, and total spent = paid on non-cancelled orders minus completed return refunds. Mobile already paged correctly. | 🟡 Implemented / Logged-in Dev Verification Pending | `src/services/orders.service.ts` |
| **FIX-2026-10-06-38** | 2026-10-06 | **Ecom Account Pages Layout Consistency** | The 9 account pages (My Account, Cart, Wishlist, Orders, Payments, Promotions, Wallet, Saved Addresses, Delete My Account) used different widths, paddings, title styles and spacing; Cart had no breadcrumb, Promotions used its own background and width, Wallet an icon title, Delete a centred card title. All now share `AccountPageHeader` (breadcrumb, title, subtitle, optional action) and one layout (`max-w-6xl`, `px-4 py-8 sm:px-6`, 32px below the header). No logic change. | 🟡 Implemented / Logged-in Dev Verification Pending | `Nivaana-Ecom-Web/src/components/AccountPageHeader.tsx` |
| **FIX-2026-10-06-39** | 2026-10-06 | **Ecom Payments Page / Payment Data Access** | Payments showed "Not available from order API" for every transaction ID (the details API response schema dropped `transactionid`/`merchanttransactionid`), loaded only the first 10 orders, listed non-payment orders, and sat in a narrow box-in-a-box layout. The details API now returns both IDs; customers can read only their own order details and transactions (403 otherwise). Payments shows one full-width card per payment (Transaction ID, Paid on, Payment method, Paid/Refunded badges) with infinite scroll and a "Load more payments" fallback. | 🟡 Implemented / Logged-in Dev Verification Pending | `Nivaana-Ecom-Web/src/pages/Payments.tsx` |
| **FIX-2026-10-06-40** | 2026-10-06 | **Inventory EKART Forward Shipment / Pickup Warehouse** | The Create EKART Shipment modal sent the chosen seller address only as `seller_name`/`seller_address` text (label/invoice), never `pickup_location`, so EKART always booked pickup from the account default warehouse. The form now sends `pickup_location` and `return_location` = selected alias; the forward route schema declares both and the service logs the pickup alias sent. | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/components/orders/EkartShipmentForm.tsx` |
| **FIX-2026-10-06-41** | 2026-10-06 | **EKART Forward Shipment / Mixed-HSN Orders** | Orders whose lines had more than one HSN were blocked ("EKART shipment requires one HSN code…"). The forward shipment now sends EKART `items[]` (one entry per shippable orderline: name, product `puc` as SKU, quantity, taxable value, HSN, CGST/SGST/IGST from the orderline snapshot) in the same single `package/create` call; top-level `hsn_code` = HSN with the highest taxable value. Missing/invalid HSN/GST snapshot check kept. | 🟡 Implemented / Dev Verification Pending | `asset-management-backend/src/services/ekart.service.ts` |
| **FIX-2026-10-06-42** | 2026-10-06 | **EKART / Shipmozo Label Product Names** | The EKART label "Product" cell (from `products_desc`) printed full product names. It now uses the orderline `productshortname`, falling back to `productname`. The Inventory order details API response schema dropped `productshortname`, so it is now declared; Shipmozo's form already preferred the short name and now receives it too (intended). | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/components/orders/EkartShipmentForm.tsx` |
| **FIX-2026-10-06-43** | 2026-10-06 | **Ecom Promotions / Free Shipping Eligibility** | Cart and Checkout could show free shipping (or another offer) as applied for a cart that was not eligible, because totals merged saved selections and legacy backend free-shipping records into the live V2 quote. Totals now use only the live V2 quote; offers V2 rejects for minimum value/quantity are not listed as eligible; rule details are kept for ineligible offers. | 🟡 Implemented / Dev Verification Pending | `Nivaana-Ecom-Web/src/pages/Cart.tsx` |
| **FIX-2026-10-06-44** | 2026-10-06 | **Ecom PhonePe Iframe Checkout (Meta In-App Browser)** | Customers from Instagram/Facebook could stay on PhonePe's success screen after paying. Web now opens PhonePe's iframe PayPage (flag `VITE_PHONEPE_IFRAME_CHECKOUT`, full-page redirect fallback); `CONCLUDED` is verified on the confirmation page. Closing the window keeps the customer on Checkout: pending payments are re-checked for 2 minutes and checked again before a new payment ("Wait / Pay again"). Order creation stays server-side. | 🟡 Implemented / SIT Verification Pending | [Plan](../Before%20Sep28%20Fix/Nivaana_Meta_InApp_PhonePe_UX_Fix_Report.md) |
| **FIX-2026-10-06-45** | 2026-10-06 | **Ecom Cart — Block Checkout for Unavailable Items** | Cart showed "out of stock" on an item but still let the customer go to Checkout, where payment was blocked. Cart now uses the same stock rule as Checkout (out of stock, or quantity above available stock): it shows "N item(s) unavailable. Remove or save for later to continue" and disables Checkout / Login to Checkout. Totals and offers unchanged. | 🟡 Implemented / Dev Verified (guest) | `Nivaana-Ecom-Web/src/pages/Cart.tsx` |
| **FEATURE-2026-10-06-46** | 2026-10-06 | **Inventory Customer 360 Detail Page** | Customers opened a profile-only modal. Clicking a customer now opens `/customers/:id`: header (contact, customer since, business/GST, groups, first/last order), key figures (orders, revenue, average order value, returns, promotion savings, wallet balance) and tabs: Overview (top categories, most bought products, promotions used), Orders (paged, links to order), Wallet & Coupons (each coupon once with its wallet credit; refund credits), Addresses. New read-only `GET /v1/users/:id/overview` (Inventory only). | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/pages/customers/CustomerDetailPage.tsx` |
| **FIX-2026-10-06-47** | 2026-10-06 | **Ecom Checkout — Show Customer's Coupons** | Coupons created for a customer (Inventory quick coupons) never appear in Checkout Offers by design, so customers had to find them under Profile → Coupons. Checkout now lists "Your coupons" (issued, not added to the wallet, promotion still active) under "Have a coupon code?" with an Apply button that uses the existing coupon-code flow; Cart says "You have N coupon(s). Apply at checkout." Wallet coupons stay with the wallet Apply. No backend change. | 🟡 Implemented / Dev Verification Pending | `Nivaana-Ecom-Web/src/pages/Checkout.tsx` |
| **FIX-2026-10-06-48** | 2026-10-06 | **Ecom PhonePe Pending-Payment Guard** | Follow-up to FIX-44: the transaction was saved when PhonePe opened and never cleared after a normal success, so a second order within 30 min in the same tab could open the previous order's confirmation instead of starting a payment (no double charge). Now saved only when the window is closed while the payment is still pending; the confirmation page clears it once the outcome is known; new storage key ignores old entries. | 🟡 Implemented / SIT Verification Pending | [2026-10-06 PhonePe Pending Guard](2026-10-06-phonepe-pending-payment-guard-fix.md) |
| **FIX-2026-10-06-49** | 2026-10-06 | **Mobile Offers — V2 Eligibility Parity** | Mobile Payment step listed catalogue offers that V2 would not apply (target products not in cart) with legacy savings that ignored caps/targets (e.g. "Air Fresheners upto 199 — Save ₹393"); Apply then failed with "not eligible". Mobile now filters offers through `POST /v2/promotions/check-eligibility` like Ecom, shows the V2 saving, and explains a non-applied offer with the Ecom wording. | 🟡 Implemented / Device Verification Pending | `Vibrant-Life-mobile-app/src/hooks/usePromotions.ts` |
| **FIX-2026-10-07-50** | 2026-10-07 | **Mobile Payment Step — Offers Layout and Customer Coupons** | The Payment step showed the same offers three times (swipe cards, "Additional Offers", View All). It now shows the applied summary and a "N more offers available" line, with every offer under the header link "View all offers (N)". Under "Have a coupon code?" it lists the customer's coupons not yet in the wallet ("YOUR COUPONS") with Apply / "Applying…", using the existing coupon-code flow (Ecom FIX-47 parity). Wallet option unchanged (shown when a usable balance exists). | 🟡 Implemented / Device Verification Pending | `Vibrant-Life-mobile-app/src/screens/cart/steps/PaymentStep.tsx` |
| **FIX-2026-10-07-51** | 2026-10-07 | **Mobile Payment Step — Wallet Row Always Visible** | Customer 74 has ₹100 wallet credit and the backend quote for the cart returns ₹100, yet mobile showed no wallet (web did). Mobile rendered the wallet row only when the per-order wallet quote succeeded with a balance and hid it silently on any error. The row now shows whenever the customer has a wallet balance, with "available for this order", the reason it can't be used, or "Couldn't check…" + Retry; the error is logged ("Wallet quote failed"). | 🟡 Implemented / Device Verification Pending | `Vibrant-Life-mobile-app/src/screens/cart/steps/PaymentStep.tsx` |
| **FIX-2026-10-07-52** | 2026-10-07 | **Order Price Breakdown — Same on Admin, Ecom, Mobile** | Order 163 (NIVAANA-0000000394): paid ₹1,537 = ₹2,049 − product ₹84 − 149 Off ₹149 − 10 Upto 199 ₹180 − Bonanza coupon ₹99, shipping ₹150 waived. Admin hid the product discount and subtracted free shipping; Ecom counted free shipping in "Total discount"; Mobile hid the coupon (summary didn't add up) and listed no offer names. All three now read `cost_breakdown`: items total, product discount, each offer/coupon with code, Shipping struck → Free (offer name), total paid, "You saved ₹662 (incl. ₹150 free shipping)". | 🟡 Implemented / Verification Pending | `Vibrant-Life-mobile-app/src/components/orders/GroupedOrderCard.tsx` |
| **FIX-2026-10-07-53** | 2026-10-07 | **Ecom Wishlist — Skeleton Until Product Details Load** | Wishlist cards briefly showed "Product #id", the fallback image and Rs. 0 before switching to the real name/image/price. The skeleton waited only for the wishlist rows, not the product list the cards are built from. It now stays until both have loaded (logged-in and guest), sized to the item count; the subtitle reads "Loading saved items…" instead of "0 saved items". Out-of-stock cards: the red banner that replaced the description is gone; Add to Cart is replaced by a non-clickable "Out of Stock" label (red on light red) and the image is dimmed. | 🟡 Implemented / Dev Verification Pending | `Nivaana-Ecom-Web/src/pages/Wishlist.tsx` |
| **FIX-2026-10-07-54** | 2026-10-07 | **Inventory Dashboard — Loading Skeletons** | After login the three dashboard widgets showed only a title and a small centred spinner, so the cards were short and the area below sat empty, then the page jumped when data arrived. Each widget now shows a skeleton shaped like its loaded content: Orders (Order Metrics row, Status Breakdown bar chart, date line), Category Breakdown (breadcrumb, doughnut with legend on the right, total), Inventory Health (6 KPI tiles, pie + bar chart, Products row). Same card style and colours; no data change. | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/components/dashboard/DashboardSkeletons.tsx` |
| **FIX-2026-10-07-55** | 2026-10-07 | **Inventory Product Detail — Full-Page Loading Skeleton** | Opening a product showed only a small spinner at the top of an empty page. It now shows a skeleton of the whole page: breadcrumb and status badge, the tab bar, and the Detail card (Edit button, name fields, info grid, benefits/description, inventory summary). Opening with `?tab=stock` / `purchase-requests` / `image` shows a table-style card instead. Uses the dashboard skeleton block (moved to shared `SkeletonBone`). | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/components/products/ProductDetailSkeleton.tsx` |
| **FIX-2026-10-07-56** | 2026-10-07 | **Inventory Stock / Platform Stock Damaged Sync** | Marking a stock Damaged updated `product` but not `platformstock` (product 82 / nivapp: ecomqty stayed 12, availableqty 2, damagedqty 0; should be 11 / 1 / 1). The stock update and delete paths applied hand-calculated changes that only knew `available`↔`sold` and compared lowercase values, while stock rows store `Available`/`Sold`/`Damaged`, so nothing was written. `updatePlatformStockQuantities` now recounts from stock rows (`recalculatePlatformStockQuantities`, already used by returns) for update and delete; `orderedqty`/`lockqty` unchanged. Recount script added; applied to product 82 only (101 other rows differ; under review). | 🟡 Implemented / Dev Verification Pending | `src/services/platformStock.service.ts` |
| **FIX-2026-10-07-57** | 2026-10-07 | **Inventory Stock — Block Damage When Orders Need It** | Admin could mark stock Damaged while pending orders needed it (product 82: 10 ordered, 0 available), leaving orders undeliverable. Backend now blocks the change (409) when the stock's platform has `orderedqty + lockqty > 0` and `availableqty < 1`, using the stored platformstock values; new `GET /v1/stocks/:id/damage-check`. Inventory replaces the browser confirm with a dialog: blocked state (numbers, Close / Bulk Add Stock) or confirm state (Available and Damaged before → after, out-of-stock note); after Confirm the backend checks again. Mark as Damaged is hidden for already damaged stock. | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/components/stocks/MarkDamagedModal.tsx` |
| **FIX-2026-10-07-58** | 2026-10-07 | **Inventory Supplier — Duplicate Code on Create / Update** | Create with an existing supplier code (`00001`) showed the error but the Add Supplier form closed and the entries were lost. Update with another supplier's code returned "Internal server error" (500). Both now stay on the form with the entered values and show "Supplier code '00001' is already in use. Please enter a different supplier code. Each supplier needs its own code." (400). Keeping a supplier's own code on update still works. | 🟡 Implemented / Dev Verification Pending | `src/services/supplier.service.ts` |
| **FIX-2026-10-07-59** | 2026-10-07 | **Inventory Product — Clear Save Error Messages** | Product create/update already kept the form open on failure, but the messages were unclear: schema errors showed only "Validation failed"; combo and HSN/GST rules came back as 500 ("An unexpected error occurred" in production) with technical wording; any database error on update showed "Failed to update product - no valid fields provided". The toast now lists each problem in plain words (e.g. "Please check: Material must be 255 characters or fewer."), business rules return 400 with a short next step, and database errors on save read "This product already exists." / "Some of the text entered is too long." | 🟡 Implemented / Dev Verification Pending | `src/services/product.service.ts` |
| **FIX-2026-10-07-60** | 2026-10-07 | **Inventory Bulk Add Stock — Clear Errors, No Double Save** | The modal already stayed open on failure, but: a 207 (records failed) always showed "Bulk import failed" with the reason dropped; above 500 units an earlier batch could save while a later one failed, so retrying added the saved units again; request checks read "body/0/instances must be <= 10000"; a failed product/platform-stock totals update still showed success. Now: plain reason in the toast, "500 of 800 stock items were added…" with the list refreshed and quantity lowered to the remainder, "Quantity can be at most 10,000." / "Batch number must be 255 characters or fewer.", quantity max and batch number length limited in the form, and a warning when totals were not updated. | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/components/stocks/StocksList.tsx` |
| **FIX-2026-10-07-61** | 2026-10-07 | **Inventory Roles — Clear Create / Update Errors** | Creating role `system_admin` again returned "Role with code 'system_admin' already exists" as a 500, and the toast showed only "Failed to create role" because Inventory read `error` instead of `message`. The form already stayed open with its values. Role rules now return 400 with plain wording ("Role code 'system_admin' is already in use. Please enter a different role code.", name in use, level 1 or higher, system roles can't be turned off), form-rule messages are reworded, and the toast shows the server message ("Please check: …" for form rules). | 🟡 Implemented / Dev Verification Pending | `src/services/role.service.ts` |
| **FIX-2026-10-07-61** | 2026-10-07 | **Inventory Order Detail — Full-Page Loading Skeleton** | Opening an order showed a spinner on an empty page. It now shows a skeleton of the whole page: breadcrumb, action buttons and status badge; Order Summary (order number/date, total, 5 info tiles, price breakdown); Order Items, Invoice, Delivery Address and Payment cards on the left; Order Timeline on the right. Uses the shared `SkeletonBone` and the page's card styles. | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/pages/orders/OrderDetailSkeleton.tsx` |
| **FIX-2026-10-07-62** | 2026-10-07 | **Inventory Purchase Order — Generate PO URL from Config** | `PurchaseOrderDetailPage` called a hardcoded Cloud Run URL (`https://nivfiles-…run.app/generate-document/po`) for Generate PO, so every environment hit the same file service. It now uses `${API_CONFIG.BASE_URL_UPLOADS}${API_CONFIG.ENDPOINTS.PURCHASE_ORDERS.generatePO}` (new `generatePO: "/generate-document/po"`) and `API_METHODS.POST`, the same pattern as Generate PR and Quotes. | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/pages/purchaseOrders/PurchaseOrderDetailPage.tsx` |
| **FIX-2026-10-07-63** | 2026-10-07 | **Inventory Register — User Create URL from Config** | `RegisterPage` built its request from `import.meta.env.VITE_API_BASE_URL` with a `localhost:5600` fallback and a hardcoded `/v1/inventoryusers` path, bypassing the shared config. It now uses `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.INVENTORY_USERS.create}` and `API_METHODS.POST`. Same endpoint, no behaviour change. | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/pages/auth/RegisterPage.tsx` |
| **FIX-2026-10-07-64** | 2026-10-07 | **Inventory Purchase Order — Generate PO Sends Auth Token** | Generate PO returned 404 although the PDF was created. Admin posted to the file service without an `Authorization` header; the file service forwards that header on its `PUT /v1/purchaseorders/:id` callback to the backend, which returned 401 "Authentication required", and the file service reports any callback failure as 404. `handleGeneratePO` now sends `getApiHeaders(true)` (Content-Type + `Bearer` token from `authToken`), as Generate PR already does. | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/pages/purchaseOrders/PurchaseOrderDetailPage.tsx` |
| **FIX-2026-10-07-65** | 2026-10-07 | **Inventory Purchase Request / Purchase Order Detail — Loading Skeleton** | Opening a purchase request or purchase order showed a spinner (PO: spinner + "Loading...") on an empty page. Both now show a skeleton of the whole page: breadcrumb and status badge, the two tabs, action buttons, the two-column details, and the items table (PR 2 columns, PO 4 columns + Additional Information). Opening with `?tab=quotes` / `?tab=invoices` shows a list-table card. One shared component on `SkeletonBone`. | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/components/common/PurchaseDetailSkeleton.tsx` |
| **FIX-2026-10-07-66** | 2026-10-07 | **Inventory Promotions List — "No promotions found" Flash on Load** | Opening Promotions showed "No promotions found" for ~350 ms, then the loader, then the list. The first fetch waited behind the 350 ms search debounce, and the list hook started with `loading = false`, so the empty state rendered before any request. The first load now runs immediately (debounce kept for search/filter typing) and the list starts in the loading state, so the table skeleton shows until the API returns. | 🟡 Implemented / Dev Verification Pending | `asset_management_frontend_aromazen/src/pages/promotions/PromotionsPage.tsx` |

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

### 2026-10-05: Ecom Mobile Number Autofill
* **Issue:** Mobile fields kept the first 10 digits of the input. Browser autofill and paste supply "+91 99948 24573" (or "099948 24573"), so the field became "9199948245": the 91 stayed and the last two digits were dropped. Affected: Login mobile, Checkout address mobile and alternate phone, Saved Addresses mobile and alternate phone.
* **Fix:** `src/lib/phone.ts` `normalizeIndianMobileInput`: digits only; 12 digits starting with 91 → drop 91; 11 digits starting with 0 → drop 0; then the first 10 digits. Typing is unchanged (the field never exceeds 10 digits), and a real number starting with 91 (e.g. 9198765432) is kept. Login uses `autoComplete="tel-national"`.
* **Validation:** `isValidIndianMobile` (`^[6-9]\d{9}$`) is checked when requesting an OTP (Login), saving an address (Checkout, Saved Addresses; pincode now has its own message) and starting payment. Payment uses `canonicalIndianMobile`, which strips +91/0 from older saved addresses but never truncates, so malformed numbers stay invalid. The inputs deliberately have no `maxLength={10}` (the browser would cut autofilled "+919994824573" before normalising); the normaliser enforces 10 digits. The alternate phone field on Checkout/Saved Addresses is not saved or submitted, so it is only normalised.
* **Verification:** 13 input cases passed (+91 with/without spaces or dashes, 91 prefix, leading 0, plain, partial, extra digit). Login page in the browser: "+919994824573" → 9994824573, "+91 99946 26003" → 9994626003, "098765 43210" → 9876543210, typing stops at 10 digits. Validation: 12 cases (6/7/8/9 accepted; 0–5 starts, short, long, spaced rejected) and canonical cases passed; Login blocked 1234567890, 5994824573 and 99948 with "Please enter a valid 10-digit mobile number." and sent no OTP request. Ecom TypeScript and build passed (Login's two existing `any` lint errors unchanged).
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-05: Ecom Address Form Design (Checkout and Saved Addresses)
* **Issue:** The address form looked dated (square boxes with labels inside, the title repeated inside the modal, ungrouped fields, plain browser controls, actions only at the end of a scrolling form) and existed as two slightly different copies in `Checkout.tsx` and `SavedAddresses.tsx`. Alternate Phone and Address Type (Home/Work) were shown but never saved, and "Locality" was stored in `doornumber`.
* **Fix:**
  - One shared `AddressForm` (`src/components/AddressForm.tsx`) used by both pages; same theme tokens, no new colours.
  - Sections "Contact details" (Full name, Mobile number with a fixed +91 prefix) and "Address" (Pincode, City / District, State with a custom chevron, House / Flat / Building no., Area and street, Landmark optional), then a "Make this my default address" row.
  - Labels above 44px rounded inputs, soft focus ring, inline errors under each field (name, valid Indian mobile, 6-digit pincode not starting with 0, city, state, house/flat, area) before submit; page-level checks remain.
  - Save/Cancel bar pinned to the bottom of the modal (`AddressFormModal` body now `min-h-0` with no bottom padding so the bar sits flush); Cancel sets its own background because global CSS makes every `<button>` yellow. Modal titles in sentence case ("Add new address" / "Edit address").
  - Browser autofill hints: name, tel-national, postal-code, address-level1/2, address-line1/2.
  - New addresses prefill Full name from the signed-in profile (first + last name) only when the profile has a name; it stays editable. Saved Addresses did not prefill before, and Checkout lost the name after "Add new address" or closing the form. Edit keeps the address's own saved name.
* **Data:** field names and payload unchanged. "Locality" is relabelled "House / Flat / Building no." because `doornumber` is shown first in every address line (Saved Addresses, Checkout, Orders, Order Confirmation, admin Order Details, Ekart/Shipmozo labels). Alternate Phone and Home/Work were removed from the UI (option A) because they were never saved.
* **Verification:** Rendered the real modal and form inside the running app with sample data: desktop two/three-column layout, inline errors for an invalid mobile and empty area (submit blocked), action bar flush at the bottom while scrolling, phone (375px) bottom sheet with no horizontal scroll. Ecom TypeScript, ESLint (no new issues) and production build passed. Pending: logged-in add/edit on Checkout and Saved Addresses.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-05: Ecom Wishlist Description Rendering
* **Issue:** Wishlist cards showed `shortdescription` as plain text; the field is stored as HTML (17 of 74 products contain markup), so tags such as `<p>` appeared and bullets ran together.
* **Fix:** The card keeps binding `shortdescription` and renders it with `RichTextContent` (DOMPurify-sanitised, same allowed tags as Product Details). Paragraph and list spacing is removed for the card, and the text is clamped to two lines with an ellipsis plus `max-h-12` so the container cannot expand.
* **Card layout:** The price moved from an absolute top-right badge into a bottom row (final price, struck-through MRP and "Save Rs. X" in `--color-danger`, as on product cards). Add to Cart uses the theme primary (`--color-primary`, as the product card's add button; icon only on phones); Remove is a white bordered icon button in the muted colour that turns red only on hover. On phones the actions wrap under the price.
* **Data note:** Product 68's short name is "Blissful Rose – Dhoop Cones | 100g" while the product is the Butter Bliss bathing bar (Personal Care / Bath & Body); to be corrected in Inventory Admin.
* **Verification:** Rendered the real component with product 68's HTML, a long bold list and plain text at 560px and 230px widths: HTML shown without tags, two-line ellipsis, height capped at 48px, short text unaffected. Ecom TypeScript, ESLint and build passed.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-06: Ecom Product Listing Loading State
* **Issue:** While a new category/subcategory/filter loaded, the header showed "Showing 0 products" (fallback to the empty loaded list) and the grid showed a plain spinner; loading the next page showed another spinner. The shared `Skeleton` (`bg-[var(--color-border)]/70`) rendered transparent because Tailwind 3 cannot apply an opacity modifier to a CSS-variable colour, so skeletons on Home, Product Details and the new listing appeared as empty boxes.
* **Fix (no logic change):**
  - `Skeleton` uses a new `.skeleton-shimmer` utility (neutral `--color-border` block with a sweeping light band, `--shimmer-delay` for staggering, disabled for reduced motion).
  - `ProductCardSkeleton` / `ProductGridSkeleton` mirror the listing card (same size, badge pill, wishlist circle, two-line name, rating, price/MRP, cart button) with a staggered wave; the listing shows 10 while loading and appends 5 while the next page loads.
  - The "Showing N products" line is replaced by a shimmer pill while loading.
  - Real cards fade up on arrival (`.listing-fade-in`, `backwards` fill so the card hover lift is unaffected).
* **Verification:** Category switch observed in the browser: skeleton header and grid during loading, then "Showing N products" (no "0" flash); fade-in animation applied to real cards; skeleton blocks render with colour and shimmer. Ecom TypeScript, ESLint (no new issues) and build passed.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-06: Ecom Order History Paging and Summary
* **Issue:** The Web Orders page called `GET /v1/orders/user/:userid/details` without `page`/`limit`, so the backend default (page 1, limit 10) applied and older orders could never be seen. The summary cards were computed from those 10 orders, and "Total spent" included cancelled orders (e.g. Rs. 2,000 shown when Rs. 1,000 of it was cancelled). `/orders?orderId=` links from Order Confirmation and Payments could not open an order outside the first 10. Mobile (`MyOrdersScreen`) already pages with `FlatList onEndReached` and backend status filters; no change needed.
* **Backend:** `GET /v1/orders/user/:userid/summary` → `{ total_orders, active_orders, cancelled_orders, total_spent }`. Replacement orders are excluded (as the storefront hides them); cancelled = status containing "cancel"; total spent = `orderamount + wallet_discount_total` on non-cancelled orders minus completed return refunds (`refund_operations.status = 'completed'` with a return request). Customers can read only their own summary (403 otherwise, 401 without a session); inventory users can read any.
* **Ecom:** `useInfiniteQuery` (10 per page, newest first) under the existing `["orders", userId]` key prefix so post-cancel/payment invalidations still refresh it; duplicates from shifted page boundaries are dropped; IntersectionObserver loads the next page with order skeletons and a "Load more orders" fallback; a deep-linked order keeps loading pages until found; summary cards read the new endpoint.
* **Security note:** the existing `/orders/user/:userid/details` does not check that a customer requests their own user ID; raised as a separate task.
* **Verification:** Summary matched an independent per-order calculation for the 6 users with the most orders (e.g. user 41: Rs. 12,497.40 → Rs. 12,089.40 after removing Rs. 400 cancelled and Rs. 8 return refund). Access rules: own 200, other customer 403, inventory 200, no session 401, invalid id 400. Paging for user 41: 30 orders over 3 pages, all unique. Backend suite 333/333 and TypeScript; Ecom TypeScript, ESLint (no new issues) and build passed. Pending: logged-in check on Web Orders.
* **Repositories Impacted:**
  - `asset-management-backend`
  - `Nivaana-Ecom-Web`

### 2026-10-06: Ecom Account Pages Layout Consistency
* **Issue:** Pages reached from the account menu looked uneven: widths ranged from `max-w-4xl` to `max-w-7xl`, top padding from `py-8` to `py-12`, Cart had no breadcrumb, Wishlist's breadcrumb differed, Promotions used its own `#f6f7fb` background with the banner as the page title, Wallet had an icon title, Delete My Account showed a centred title inside its card, and the gap between title and content varied (16–32px). Signed-out screens used different padding again.
* **Fix (layout only, no logic change):**
  - New `components/AccountPageHeader.tsx`: breadcrumb (omitted on My Account), `text-3xl` title, muted subtitle and an optional right-side action (Cart "Go to Wishlist" on phones, Saved Addresses "Add Address").
  - New `lib/accountLayout.ts`: `ACCOUNT_PAGE_MAIN` (`min-h-screen bg-[var(--color-surface)] px-4 py-8 sm:px-6`) and `ACCOUNT_PAGE_CONTAINER` (`mx-auto max-w-6xl`), used by all 9 pages including their signed-out states.
  - First content block below the header uses `mt-8` everywhere.
  - Cart / Wishlist subtitles pluralise counts ("1 item", "3 saved items").
  - Promotions: standard header; the offers banner sits below it with an `h2`.
  - Payments content kept at `max-w-4xl` inside the shared container; Delete My Account form is a centred `max-w-2xl` card (success screen unchanged).
  - The title/breadcrumb is not made sticky: the site navbar is already fixed (~110px), and a second sticky bar would take too much height on phones.
* **Verification:** Signed out in the browser, Cart, Wishlist and Delete My Account titles align at the same position with breadcrumbs. Ecom TypeScript, ESLint (no new issues) and build passed. Pending: logged-in check of Orders, Payments, Account, Promotions, Wallet and Saved Addresses.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-06: Ecom Payments Page and Payment Data Access
* **Issue:**
  - Every row showed "Transaction: Not available from order API". The orders table has `transactionid` (e.g. `NIVAANA-TRAN-00815`) and `merchanttransactionid` (e.g. `TXN_1790877836877_4VT8Q2`) for all paid orders, and the service returns them, but the `GET /v1/orders/user/:userid/details` response schema did not list them, so Fastify removed them. The page's fallback (matching `/transactions/user/:id` by amount within 1 hour) also failed: transaction `createddate` is about 5.5 hours after the order's, and that list is sorted oldest first (first 50 only).
  - Only the first 10 orders were requested (no `page`/`limit`).
  - All orders were listed as payments (replacement orders and uncollected COD included).
  - Layout: a narrow `max-w-4xl` card holding a second bordered list, a repeated "Payment History" heading, a spinner, a separate status line, and two large yellow buttons per row.
  - `GET /v1/orders/user/:userid/details` and `GET /v1/transactions/user/:userId` did not check that a customer requested their own user ID.
* **Backend:**
  - Details response schema adds `transactionid` and `merchanttransactionid` (additive).
  - Both endpoints: customers may read only their own data (403), inventory users any (200), no session 401 — same rule as the order summary endpoint.
* **Ecom:**
  - Payments loads orders 10 per page with `useInfiniteQuery` (key `["payments", userId, "history"]`: a new key so a cached plain-query result cannot reach the infinite query, still under the `["payments", userId]` prefix that existing invalidations use), an IntersectionObserver, card skeletons, and a "Load more payments" fallback; duplicates across page boundaries are dropped.
  - Shows only payment records: excludes replacement orders, shows COD only once cash is collected, and otherwise requires `ispaymentsucceed`.
  - One full-width card per payment, styled like Orders: order number (links to the order), Paid badge, Refunded or Order cancelled badge, amount; Transaction ID (`merchanttransactionid`), Paid on, Payment method; a "View order" button (and the order number) opens Orders with that order expanded, loading older pages until it is found; "Details" opens the reference, order status, item total, discount, shipping, GST, wallet/online split, refund and items.
  - Removed: the transactions list request and amount/time matching, the per-row Refresh status button, and the repeated heading, spinner and nested box. The return-from-gateway status check is unchanged.
  - `PaymentsSkeleton` updated to the card layout.
* **Delete My Account:** the form card is centred (`mx-auto`).
* **Verification:** In-process API check for user 41: details return both IDs on all 10 orders of page 1; 30 orders over 3 pages, all unique. Details: other customer 403, inventory 200, no session 401; transactions: own 200, other customer 403, inventory 200, no session 401. Backend 333/333 tests and TypeScript; Ecom TypeScript, ESLint and build passed. Pending: logged-in check on Web Payments after restarting the backend. Mobile only calls the details endpoint with the signed-in user's own ID.
* **Repositories Impacted:**
  - `asset-management-backend`
  - `Nivaana-Ecom-Web`

### 2026-10-06: Inventory EKART Forward Shipment — Selected Pickup Warehouse
* **Issue:** In Order Details → Create Shipment → EKART, the Seller Address dropdown lists the EKART-registered addresses, but the form turned the selection into `seller_name` (alias) and `seller_address` (text) only. EKART uses those for the label/invoice; the physical pickup warehouse comes from `pickup_location.name`. With no `pickup_location`, EKART used the account default warehouse whatever address was selected. The backend passed the payload through without adding one. (Return flow in `return-request.service.ts` already sent both locations.)
* **Fix:**
  - Inventory `EkartShipmentForm.tsx`: payload adds `pickup_location: { name: <selected alias> }` and `return_location: { name: <selected alias> }`; types updated there and in `OrderDetailPage.tsx` `handleEkartShipmentSubmit`.
  - Backend `ekart.route.ts`: `/shipments/forward` body schema declares `pickup_location` / `return_location` (`{ name: string }`). Not strictly required (Fastify's default Ajv `removeAdditional: true` only strips when `additionalProperties: false`), but documents and validates the field. Zod schema already accepted both.
  - Backend `ekart.service.ts`: "Step 3: Final payload prepared" log now includes `pickupLocation` / `returnLocation` (or "EKART default warehouse" when absent).
* **Compatibility:** Additive. Clients that omit `pickup_location` behave as before (EKART default). Alias must match an EKART-registered address; the dropdown is sourced from EKART `getAddresses`, so it does.
* **Known gap (not changed):** Seller GST TIN is prefilled from `VITE_DEFAULT_SELLER_GST_TIN` (BE fallback `SELLER_GST_TIN`), not per address; a warehouse in another state needs its GSTIN entered manually.
* **Verification:** Backend and Inventory TypeScript passed. Fastify inject check confirmed `pickup_location` reaches the handler. Pending: create a dev EKART shipment with a non-default address and confirm the pickup warehouse in the EKART dashboard and the Step 3 log.
* **Repositories Impacted:**
  - `asset_management_frontend_aromazen`
  - `asset-management-backend`

### 2026-10-06: EKART Forward Shipment — Mixed-HSN Orders via items[]
* **Issue:** `createForwardShipment` blocked any order whose shippable orderlines had more than one HSN (`ARCH-2026-09-30-15` assumed EKART accepts one HSN). Order `NIVAANA-0000000384` (6 lines; HSN 33074900, 33074100, 4202, 73733) failed with a 500. EKART's official `package/create` payload has an `items[]` array with per-item `hsn_code` and CGST/SGST/IGST, inside the same single package (one shipment, one tracking ID; `mps` stays unset/false).
* **Fix (`ekart.service.ts`, `createForwardShipment` only):**
  - Removed the one-HSN block. The check that every shippable line has a valid HSN and GST rate snapshot is unchanged.
  - Builds `items[]` from shippable orderlines (cancelled/returned excluded): `product_name` (productname → productshortname), `sku` (product `puc`, fallback productid), `quantity`, `taxable_value` (orderline `taxable_amount`; fallback `orderamount / (1 + gst_rate/100)`, same formula as `gst.service`), `hsn_code`, `cgst/sgst/igst_tax_value` from the orderline snapshot. Only fields from EKART's official `package_item` schema (`/api/docs#operation/create_shipment`, spec `public_api_yamls/EKART/spec.yaml`) are sent: per-item `length/height/breadth/weight` are omitted (optional; spec requires > 0 when sent), and lines with taxable value below ₹1 (free items) are sent without `taxable_value`/tax fields (spec minimum 1). Package-level dimensions/weight unchanged.
  - `CreateShipmentPayload.items` type aligned with the spec (only `product_name` required); type-only, return flow unchanged.
  - Top-level `hsn_code` = HSN with the highest summed taxable value (first line wins a tie); single-HSN orders send the same HSN as before.
  - Derived log adds `topLevelHsnCode`, `itemCount`, `itemHsnCodes`. No FE, schema, reverse/return-flow or DB change.
* **Compatibility:** Single-HSN orders: same top-level payload plus `items[]`. Return flow already sends `items[]`.
* **Verification:** Dry run on `NIVAANA-0000000384` with the EKART API call stubbed (nothing sent, no charge): 6 items, SKUs AUO-0018/NIV-0047/NIV-0056/NIV-0071/KRA-0075/NIV-0055, top-level HSN `4202` (Luxe Haven, ₹1,435.27), item taxable sum ₹2,324.07 = top-level `taxable_amount`; item GST sum ₹346.04 vs `tax_value` ₹346.03 (per-line rounding). Every item checked against the spec: no extra keys, no out-of-range values; `pickup_location`/`return_location` sent as `{ name: alias }` per the spec's Autofill section. Backend TypeScript and tests 333/333 passed. Pending: one real dev shipment and a check of the EKART response/e-way bill details.
* **Open data point:** `KRA-0075` HSN `73733` is 5 digits (HSN is 4/6/8); confirm with the accountant before shipping if EKART rejects it.
* **Repository Impacted:**
  - `asset-management-backend`

### 2026-10-06: EKART / Shipmozo Label Product Names (Short Name)
* **Issue:** The EKART label is generated by EKART (`/v1/package/label`); its "Product" cell is our `products_desc` text plus EKART's own " - (Qty: <quantity>)". The Inventory form built `products_desc` from the full `productname`. The short name could not be used because `GET /v1/orders/:id/details` returned `productshortname` from the service but its response schema did not declare it, so Fastify removed it. For the same reason `ShipmozoShipmentForm` (`productshortname || productname`) always fell back to the full name.
* **Fix:**
  - Backend `orders.route.ts`: `/:id/details` orderline response schema declares `productshortname` (additive).
  - Inventory `EkartShipmentForm.tsx` `getProductsDesc`: `productshortname?.trim() || productname || "Product"`.
  - Shipmozo now receives short names through its existing fallback (confirmed as wanted).
  - Unchanged: EKART `items[].product_name` (full name, short name fallback); the invoice PDF already used the short name (`orders.service.ts` `markShipped`).
* **Verification:** Order `NIVAANA-0000000384` label text would be "Incense Accessories (Qty: 1), Luxe Haven (Qty: 1), Premium Incense Combo - MEDITATION & MINDFULNESS COLLECTION (Qty: 1), ALL-IN-ONE Pack - Premium Incense - 12 Fragrances - 120 Sticks (Qty: 1), Opium Vibe- Air Freshener- 100 ml (Qty: 1), Vanilla- Wardrobe Fragrance (Qty: 1)". Backend and Inventory TypeScript passed; backend tests 333/333. Note: `KRA-0075` short name is "Incense Accessories" (reads like a category); review product data.
* **Repositories Impacted:**
  - `asset-management-backend`
  - `asset_management_frontend_aromazen`

### 2026-10-06: Ecom Promotions — Free Shipping Shown for Ineligible Carts
* **Issue:** Cart and Checkout built `appliedPromotionsForTotals` from the live V2 quote plus saved V2 selections and legacy backend free-shipping records. Those records can describe an older, higher-value cart, so free shipping (or another offer) showed as applied when the current cart was not eligible.
* **Fix (`Cart.tsx`, `Checkout.tsx`):**
  - When a V2 quote is used, totals use only `liveV2AppliedPromotions`.
  - Offers in the V2 quote's `rejected_candidates` with `MINIMUM_VALUE_NOT_MET` / `MINIMUM_QUANTITY_NOT_MET` are removed from the eligible list.
  - `promotionDetailsById` is built from all raw candidates so thresholds can be enforced for compact applied records.
  - Cart: a legacy backend-applied free-shipping record only counts as applied when no V2 quote is in use.
* **Verification:** Tested locally by the developer. Ecom TypeScript and production build passed. Pending: dev check that free shipping shows when eligible and not when below the minimum, in Cart and Checkout.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web` (commit `609cee5`)

### 2026-10-06: Ecom PhonePe Iframe Checkout for Meta In-App Browsers
* **Issue:** From Instagram/Facebook ads, some customers stayed on PhonePe's hosted success screen after paying because the Meta in-app browser did not return to Nivaana after the full-page redirect. Payment and order creation were already correct server-side (see plan).
* **Fix (`Nivaana-Ecom-Web`, frontend only):**
  - `phonePeCheckoutService.ts`: loads PhonePe `checkout.js` once (`VITE_PHONEPE_CHECKOUT_SCRIPT_URL`; SIT `mercury-stg` with SANDBOX backend, prod `mercury` with PRODUCTION backend), opens the token URL with `type: "IFRAME"`; a failed script tag is removed so a retry reloads it.
  - Checkout: behind `VITE_PHONEPE_IFRAME_CHECKOUT` (prod `false`, SIT `true`). If the script or iframe fails, the existing full-page redirect is used with the same transaction. Pay button disabled while the iframe is open.
  - `CONCLUDED` → confirmation page, which verifies status with the backend (never treated as success by itself).
  - Window closed (`USER_CANCEL`): status checked once. Success → confirmation. Failed → "Payment was cancelled". Pending or status error → stay on Checkout with a persistent notice; re-checked every 5s for 2 minutes (the 120s Cloud Task window) and the confirmation opens if it succeeds.
  - The open transaction is kept per customer in `sessionStorage` (30 min). The next Pay click checks it first: success → confirmation, failed → new payment, still pending → "Previous payment still processing" with **Wait** (default) / **Pay again**.
  - `getStatus` timeout 120s (status can reconcile the order). Confirmation page: status-request errors show "delayed" instead of "failure", new "Loading your order" state, long product names wrap.
* **Unchanged:** Backend (webhook, status endpoint, `cleanupExpiredLock` Cloud Task at `LOCK_CLEANUP_DELAY_SECONDS=120`, order reconciliation), Mobile App, Inventory.
* **Known limits:** No backend guard against a second payment while one is pending (only the frontend prompt). A retry within 120s on very low stock may be refused until the first lock is released. Not yet done from the plan: backend `clientChannel`, iframe observability logs.
* **Env (not committed):** `.env.sit` sets the flag `true` and the staging script and points `VITE_API_BASE_URL` to the dev Cloud Run URL; `.env.production` sets the flag `false` and the production script. Without them the flag is off.
* **Verification:** Iframe success flow tested locally by the developer. Ecom TypeScript, ESLint (no errors) and production build passed. Pending: cancel flow (close without paying; close then pay in UPI app), and SIT tests through real Instagram/Facebook links on Android and iOS per the plan.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web` (commits `49bb330`, `4d38ee5`)

### 2026-10-06: Ecom Cart — Block Checkout for Unavailable Items
* **Issue:** When another customer bought the last unit, the Cart showed "This item is out of stock…" on the item, but the Checkout button only waited for offer validation/pricing and still opened Checkout. Checkout then blocked payment (`checkoutStockIssues`). The Order Summary and offers also still counted the unavailable item.
* **Fix (`Cart.tsx`):**
  - `cartStockIssueCount`: items that are out of stock (`isOutOfStock`) or above available stock (`getAvailableStock`), the same rule and product data (`getProducts(1, 100)`) Checkout uses, so Cart blocks only where Checkout already blocks.
  - Above the button: "1 item is unavailable. Remove it or save it for later to continue." (plural for more).
  - Checkout button and guest "Login to Checkout" are disabled while such items remain.
* **Not changed (intentional):** Totals, offers and promotion inputs (`promotionRows`, cart signature). Excluding unavailable items there would change the cart signature, clear saved offers (`Cart.tsx` signature effect) and diverge from Checkout's quote; Checkout and the backend already block payment.
* **Verification:** Guest cart on local dev: out-of-stock product #76 + in-stock #77 → message shown and Login to Checkout disabled; only #77 → no message, enabled. Ecom TypeScript, ESLint (no errors) and production build passed. Pending: logged-in check.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-06: Inventory Customer 360 Detail Page
* **Before:** Customers list → eye icon → modal with profile fields only (name, email, mobile, gender, GST, business user, dates).
* **Inventory app:**
  - New route `/customers/:id` (`users: read`, same as the list). Row click and the eye icon open it; the modal was removed.
  - Header: name, ID, mobile, email, customer since, business/GST badge, customer-group badges, first and last order dates.
  - Key figures: Orders (with cancelled), Revenue, Average order value, Returns (return/replacement requests), Promotion savings, Wallet balance.
  - Tabs (each loads on first open): **Overview** (top 5 categories by revenue, top 5 products by quantity, promotions used with codes, times and savings); **Orders** (existing `GET /v1/orders/user/:userid/details`, 10 per page: order, date, status, items, paid incl. wallet, discount, promotions/coupons from line breakdown, payment mode; row opens `/orders/:id`); **Wallet & Coupons** (existing `GET /v1/coupon-wallet/admin/coupons?customer_id=`; a coupon added to the wallet appears once with its credit, so there is a single source; refund credits listed separately); **Addresses** (existing `GET /v1/addresses?userid=`).
* **Backend:** New `GET /v1/users/:id/overview` (`customer-overview.service.ts`; 401 without token, 403 unless inventory user). Read-only; no schema change.
  - Order totals reuse `OrdersService.getOrderSummaryByUserId` (FIX-37): revenue = paid (online + wallet) on non-cancelled orders minus completed return refunds; replacement orders excluded. Average order value = revenue / non-cancelled orders.
  - Top categories/products: orderlines of non-cancelled orders, excluding cancelled/returned lines and free items.
  - Promotions used: `promotion_redemptions` joined to the customer's non-cancelled orders (`order_id` holds the order number or, for older rows, the numeric id).
  - Wallet balance: same spendable rule as the customer wallet (active/partially used, not expired, minus live reservations). Matches `getCustomerWallet` for customers 41, 45, 54, 73.
* **Verification:** Overview for customers 41, 73 and a non-existent ID (empty figures) in 0.1–1.1s; route 401 with no/invalid token; backend tests 333/333; Inventory root TypeScript, ESLint and production build passed. Pending: signed-in visual check in the Inventory app.
* **Found while building (separate task):** the address API has no ownership check (any signed-in customer can read another customer's addresses).
* **Repositories Impacted:**
  - `asset-management-backend`
  - `asset_management_frontend_aromazen`

### 2026-10-06: Ecom Checkout — Show the Customer's Coupons
* **Issue:** A coupon created for one customer in Inventory (standalone "quick coupon", e.g. `NV-883055E9AD80`) is deliberately excluded from Checkout Offers (`promotions.service.ts` skips private standalone coupons; they are meant to become wallet credit). Customers could only use it by typing the code or by adding it to the wallet from Profile → Coupons, and Checkout never told them they had one.
* **Fix (`Nivaana-Ecom-Web`, frontend only):**
  - Checkout: under "Have a coupon code?", a **Your coupons (N)** list with amount, code, minimum cart and **Apply**. Apply sets the code and runs the existing direct-coupon flow (`/coupon-wallet/checkout/quote`, `direct_coupon` on payment), so ownership, channel, limits and minimum-cart checks are unchanged.
  - Cart: the coupon hint reads "You have N coupon(s). Apply at checkout." when the customer has such coupons.
  - Source: existing `GET /v1/coupon-wallet/me` (`available_coupons`), same React Query key as the navbar wallet badge (no extra request).
  - `isUsableUnclaimedCoupon` (couponWalletService): status `available`, not in the wallet, has a code, and the coupon's promotion is `active`.
  - Coupons already in the wallet are not listed (they are used through the wallet Apply), so each coupon appears in one place. The Offers list (promotion engine) is untouched.
  - Apply on a listed coupon shows "Applying…" (spinner) until the discount is confirmed; other Apply buttons are disabled meanwhile.
  - **Applied coupon survives navigation/refresh:** the code is saved per customer in `sessionStorage` (`lib/directCouponSelection.ts`, tab-scoped) on Apply and restored when Checkout opens; it is re-quoted by the backend, and if no longer valid it is dropped with the reason. Cleared on Remove, on a quote/payment coupon error, and as soon as a payment starts (the coupon is then reserved/consumed).
* **Coupon validity times (confirmed):** Inventory sends Valid from as 00:00:00.000 IST and Valid until as 23:59:59.999 IST of the chosen dates (`couponDateBoundaryIso`), stored as Unix seconds; a coupon is "scheduled" before start and "expired" only when `end_date < now`, so it is usable through 23:59:59 IST of the last day. Empty Valid until = no expiry (allowed by design).
* **Data note:** the wallet status reflects only the assignment. 6 of 12 unclaimed coupons belong to promotions set to `inactive` (e.g. promotion #57 for `NV-883055E9AD80`, deactivated 2026-10-01); the wallet/Inventory show them as "Available" but checkout and wallet claim reject them (`COUPON_INACTIVE`). The checkout list hides them.
* **Verification:** All 7 unclaimed customer coupons checked against the read-only direct-coupon quote: the 6 listed (customers 73, 74) quote OK (₹49–₹100), the hidden one (customer 41) fails `COUPON_INACTIVE`. Ecom TypeScript, ESLint (no errors) and production build passed. Pending: logged-in check on Cart/Checkout.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### [2026-10-06: Ecom PhonePe Pending-Payment Guard — Wrong Previous-Order Confirmation](2026-10-06-phonepe-pending-payment-guard-fix.md)
* **Issue:** Rarely, clicking "Pay securely" (or waiting 5s on Checkout) opened the confirmation of an earlier order instead of starting a new payment. Cause: FIX-44 saved the PhonePe transaction in `sessionStorage` when the iframe opened and never cleared it after a normal success (`CONCLUDED`); the duplicate-payment guard then treated the completed transaction as pending for 30 minutes. No double charge or wrong order; the new order was simply not placed.
* **Fix (frontend only):** save only when the iframe is closed and status is still pending; clear any earlier entry when a new payment opens; confirmation page clears a matching entry once success/failure is known; storage key changed to `nivaana-phonepe-pending-v2-<userId>` so old entries are ignored.
* **Verification:** TypeScript, ESLint, build; storage helper checks in the dev app. Pending SIT/UAT scenarios (see detailed document). Must pass before enabling the iframe flag in Production.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-06: Mobile Offers — V2 Eligibility Parity with Ecom
* **Issue:** On mobile Checkout → Payment, "Additional Offers" (and best/eligible coupons) came straight from the legacy `POST /v1/promotions/available-offers`, whose estimate (`calculatePromotions`/`calculatePotentialDiscount`) does not understand V2 rule targets and caps. Example cart (Opulent Living, Butter Bliss, Coconut Soap): mobile offered HAVEN801 "Save ₹966", "20% Off Upto 199 on Air Fresheners — Save ₹393", Extra 10% Haven, 5% Opium Vibe, 10% Rose Bliss; Apply runs the V2 quote, which rejected them → "This offer is not eligible for the current cart". Ecom already filtered through `/v2/promotions/check-eligibility` (FIX-18 moved mobile apply/pricing to V2, but not the list filter).
* **Fix (Mobile app):**
  - `promotionService.checkEligibility` → `POST /v2/promotions/check-eligibility` (channel `mobile`).
  - `usePromotions.fetchRecommendedPromotion`: after loading offers, V2-versioned offers are kept only if V2 says eligible and show the V2 saving; non-versioned offers keep the legacy result; best coupon re-picked if filtered; if the check fails, the catalogue is shown as before.
  - `applyPromotionV2`: when V2 does not apply a selected offer, the message is the real reason (`rejected_candidates`) or "Not applied. Your current offers save you ₹X, more than the ₹Y from this offer…" (same as Ecom `describeOfferNotApplied`).
  - Helpers in `src/utils/promotionOfferEligibility.ts`. No backend change.
* **Verification:** V2 eligibility for the example cart (products 72, 68, 77): eligible 10 Upto 199 (₹180, matches Ecom), Free Shipping; hidden 63, 68, 75, 78, 79, 80 (`NO_ELIGIBLE_PRODUCTS`). Mobile TypeScript 0 errors; ESLint clean. Pending: device test and a new app build.
* **Repository Impacted:**
  - `Vibrant-Life-mobile-app` (branch `expo_rn_migrations_v2`)

### 2026-10-07: Mobile Payment Step — Offers Layout and Customer Coupons
* **Issue:** The Payment step repeated offers in three places: "Coupon for you" swipe cards (applied + best + eligible + stackable), an "Additional Offers" list (stackable again) and the View All sheet. Customer coupons issued from Inventory were not shown (same gap as Ecom before FIX-47).
* **Fix (Mobile app, UI only):**
  - "Coupon for you": applied-promotions summary + a line "N more offers available. Tap View all offers to apply them." The header link is renamed **"View all offers (N)"** and opens the existing full sheet (applied offers with Remove, others with Apply). N = number of offers in that sheet (`cartPromotionOffers`, applied automatic offers such as Free Shipping included), matching Ecom's "View / change offers (N)". Swipe cards and the "Additional Offers" section removed (those offers are in the sheet).
  - "Have a coupon code?": **YOUR COUPONS (N)** list (issued, not in the wallet, promotion active — `isUsableUnclaimedCoupon`, same rule as Ecom) from `GET /coupon-wallet/me?channel=mobile`, loaded when the Payment step opens. Apply sets the code and uses the existing direct-coupon flow; the clicked button shows "Applying…".
  - Wallet: unchanged — shown when the customer has a usable wallet balance, with Apply/Remove.
* **Verification:** Mobile TypeScript 0 errors; ESLint clean. Pending: device test and a new app build.
* **Repository Impacted:**
  - `Vibrant-Life-mobile-app` (branch `expo_rn_migrations_v2`)

### 2026-10-07: Mobile Payment Step — Wallet Row Always Visible
* **Issue:** Web Checkout showed "Wallet balance Rs. 100 — Apply" for customer 74 (Manikandan, credit from coupon `NV-D538467D6A40`, no expiry, no minimum); the mobile Payment step showed nothing. Backend check with the mobile figures (items ₹1,100, payable ₹951, free shipping): `eligible_balance` 100, `discount_amount` 100 — backend correct; wallet code unchanged since 2026-09-29 and present on SIT. Mobile rendered the row only when `walletQuote.eligible_balance > 0` and its `.catch` set the quote to null, so any failed/skipped per-order quote hid the wallet without a message.
* **Fix (Mobile app):**
  - `CartScreen`: keeps the customer's total wallet balance from `GET /coupon-wallet/me` (already loaded for "Your coupons"); records the wallet-quote error (`console.warn("Wallet quote failed", status, message)`); Retry re-runs the quote.
  - `PaymentStep`: wallet row shown when the order quote **or** the wallet balance is above 0. Sub-text: "Checking wallet for this order…", "₹X available for this order" (+ Apply/Remove), the reason it cannot be used, or "Couldn't check your wallet for this order." with **Retry**.
* **Verification:** Mobile TypeScript 0 errors; ESLint clean. Pending: device test as customer 74; if "Couldn't check…" appears, the Metro log line "Wallet quote failed" gives the HTTP status/message for root cause.
* **Repository Impacted:**
  - `Vibrant-Life-mobile-app`

### 2026-10-07: Order Price Breakdown — Same on Admin, Ecom and Mobile
* **Example (order 163, `NIVAANA-0000000394`):** original ₹2,049; product discount ₹84 (Butter Bliss 149→65); 149 Off ₹149; 10 Upto 199 ₹180; Bonanza coupon `NV-7D064E052104` ₹99; shipping ₹150 waived by Free Shipping (`shipping_cost` 0); paid ₹1,537. Backend `cost_breakdown` (orders `/:id/details` and `/user/:userid/details`) already has all of this: `product_discount` 84, per-offer `merchandise_discount` / `shipping_discount`, `total_discount` 662 (incl. shipping), `final_payable_amount` 1,537. No backend change.
* **Issues:**
  - Admin: product discount computed as `discountamount − cost_breakdown.promotion_discount` = 512 − 578 (promotion_discount includes shipping and coupon) → hidden; Free Shipping subtracted (−₹150) though shipping was never added → rows summed to ₹1,471.
  - Ecom: "Free Shipping · Shipping −₹150" row and "Total discount −₹662" (incl. shipping) with "Delivery charges: Free" → 2,049 − 662 ≠ 1,537.
  - Mobile: summary "Promotional Discount −₹329" (promotions only) + product −₹84 but "Total Savings −₹512" (coupon ₹99 hidden); no offer names; item "Promotion Discount" included the coupon share.
* **Fix (same rule everywhere):** Items total → Product discount → one row per offer/coupon with its code (merchandise + free-item amount) → Shipping: struck original price → Free (or charged amount), with the free-shipping offer name; never subtracted → Total paid → "You saved ₹X (incl. ₹Y free shipping)".
  - Admin `OrderDetailPage.tsx`: product discount from `cost_breakdown.product_discount`; offer rows exclude shipping; Shipping row with strike/Free; "Customer saved" note.
  - Ecom `Orders.tsx`: no shipping offer row; "Total discount" = items only (`total_discount − shipping_discount`); Delivery charges with strike/Free and offer name; "You saved" note.
  - Mobile `orderGrouping.ts` / `GroupedOrderCard.tsx`: summary built from `cost_breakdown` (offer rows, shipping saved); "Total Savings" row replaced by a "You saved" note under Grand Total; item label "Offers & Coupons". Legacy orders without a breakdown keep the old rows.
* **Follow-up (order 164, `NIVAANA-0000000395`: 11 × ₹100, free shipping, ₹100 wallet credit, ₹1,000 PhonePe):**
  - Ecom showed an extra "Promotion discount −₹150": the fallback row (used when no item offers exist) took `promotion_discount`, which includes the free shipping already on the Delivery row. It now uses `promotion_discount − shipping_discount` (hidden when 0).
  - Wallet deduction label is **"Wallet"** on all three (Admin was "Coupon", Ecom "Coupons", Mobile "Wallet credit"), with the coupon/refund source name in brackets when known; Ecom now shows the Wallet row even when no source name is available (previously hidden, breaking the arithmetic).
  - Mobile showed Grand Total ₹1,100 (PhonePe + wallet) with a separate "Payment breakdown", unlike Admin/Ecom. Mobile now shows a "Wallet credit −₹100" row and Grand Total = amount paid (`orderamount`, ₹1,000), also on the card header; the duplicate Payment breakdown box was removed.
* **Verification:** Mobile summary builder on order 163's API data: 2,049 − 84 − 149 − 180 − 99 + 0 = 1,537; You saved 662 (incl. 150). Order 164: 1,100 − 0 + 0 − 100 (wallet) = 1,000; Ecom fallback row not shown. Admin/Ecom/Mobile TypeScript and builds pass; Ecom lint findings in `Orders.tsx` pre-existing (same 9 on HEAD).
* **Repositories Impacted:**
  - `asset_management_frontend_aromazen`
  - `Nivaana-Ecom-Web`
  - `Vibrant-Life-mobile-app`

### 2026-10-07: Ecom Wishlist — Skeleton Until Product Details Load
* **Issue:** `/wishlist` runs two queries: the wishlist rows (`cartService.getWishlist`) and the product list (`platformProductService.getProducts(1, 100)`) used for each card's name, image and price. The skeleton covered only the wishlist query, so cards rendered while products were still loading and showed the `Product #<id>` name, the fallback image and Rs. 0, then changed to the real data.
* **Fix (Ecom):** `Wishlist.tsx` shows the skeleton while the wishlist query is loading (logged in) **or** while the product list is loading and there are saved items (logged in and guest). Skeleton count = item count (max 6, default 4). Subtitle shows "Loading saved items…" while the wishlist loads. `Product #<id>` now appears only when the product really is missing from the catalogue.
* **Follow-up — out-of-stock cards:** the full-width "This item is currently out of stock." banner pushed the description out of the card and sat next to a faded Add to Cart button. Now the description stays; Add to Cart is replaced by a non-clickable "Out of Stock" label (red text on light red, no button styling); the image is dimmed and greyed (`opacity-50 grayscale`); Remove is unchanged.
* **Compatibility:** UI only; no API change.
* **Verification:** Ecom TypeScript 0 errors; ESLint clean on `Wishlist.tsx`. Pending: dev check with network throttling, logged in and as guest; out-of-stock card on desktop and mobile widths.
* **Note:** The page still fetches 100 products to build the cards; fetching only the wishlisted products would cut the wait itself.
* **Repository Impacted:**
  - `Nivaana-Ecom-Web`

### 2026-10-07: Inventory Dashboard — Loading Skeletons
* **Issue:** `DashboardWidget` rendered only a spinner while loading. The widgets were a fraction of their final height, leaving most of the page empty, and the layout jumped when the data loaded.
* **Fix (Inventory):**
  - New `components/dashboard/DashboardSkeletons.tsx`: `OrdersWidgetSkeleton`, `CategoryBreakdownSkeleton`, `InventoryHealthSkeleton`, each matching its widget's real layout and heights (`h-80` / `h-72` charts, `min-h-[85px]` KPI tiles), using the brand-blue tints and borders the widgets already use, with `animate-pulse`.
  - `DashboardWidget.tsx`: optional `skeleton` prop shown while loading; widgets without it keep the spinner.
  - `OrdersWidget`, `CategoryBreakdownWidget`, `InventoryHealthWidget` pass their skeleton.
* **Compatibility:** UI only; no API or data change. Error state unchanged.
* **Verification:** TypeScript (`tsconfig.app.json`) no errors in dashboard files. Pending: dev check after login (desktop and narrow widths, network throttling).
* **Repository Impacted:**
  - `asset_management_frontend_aromazen`

### 2026-10-07: Inventory Product Detail — Full-Page Loading Skeleton
* **Issue:** `ProductDetail` returned a 32px spinner in an `h-64` box while the product loaded, so the page was blank and then jumped to the full layout.
* **Fix (Inventory):**
  - New `components/common/SkeletonBone.tsx`: the brand-blue skeleton block from the dashboard skeletons, now shared; `DashboardSkeletons.tsx` uses it.
  - New `components/products/ProductDetailSkeleton.tsx`: breadcrumb + status badge, tab bar (same glass card), and the active tab's card. Detail tab: Edit Product button row, Product Name / Short Name, two-column info grid, Benefits cards and description lines, 6-column Inventory Summary. Stock / Purchase Requests / Image: header + table rows.
  - `ProductDetail.tsx`: loading state renders `ProductDetailSkeleton`, choosing the tab from `?tab=` in the URL.
* **Compatibility:** UI only; no API change. Error / not-found state unchanged.
* **Verification:** TypeScript (`tsconfig.app.json`) and ESLint clean on changed files. Pending: dev check opening a product from Products (and with `?tab=stock`), with network throttling.
* **Repository Impacted:**
  - `asset_management_frontend_aromazen`

### 2026-10-07: Platform Stock Not Updated When Stock Is Marked Damaged
* **Issue:** Admin marked a stock of product 82 (`NIV-0082`) as Damaged. `product` updated correctly (ecompublishedquantity 11, orderedquantity 10, availablequantity 1), but `platformstock` (nivapp) kept ecomqty 12, availableqty 2, damagedqty 0, so the app could sell one more unit than exists.
* **Root cause:** `StockService.update()` refreshes `product` with `updateStockTotals` (recounts stock rows, case-insensitive, handles Damaged) but refreshes `platformstock` with `updatePlatformStockQuantities(..., 'update')`, which applied per-change deltas. Those deltas only handled `available`↔`sold` and compared lowercase strings, while stock rows store `Available` / `Sold` / `Damaged`. Every change was 0, so the method returned early without writing. `damagedqty` was never touched there. The `'delete'` branch had the same case-sensitivity problem. Return inspection was not affected because it already calls `recalculatePlatformStockQuantities`.
* **Fix (Backend):** In `updatePlatformStockQuantities`, `update` and `delete` operations now call `recalculatePlatformStockQuantities(productId, platform)`, which recounts totalqty, ecomqty, soldqty and damagedqty from active stock rows and sets availableqty = ecomqty − orderedqty − lockqty. `orderedqty` and `lockqty` are kept as they are. `create` and `transfer` are unchanged.
* **Compatibility:** No API, schema or order-flow change. Order place/dispatch/cancel and return/replacement keep their existing orderedqty/soldqty handling.
* **Data repair:** New one-off script `scripts/recount-platform-stock.ts` applies the same recount rules (dry run by default; `--product=`, `--platform=`, `--apply --confirm=NIVAANA_RECOUNT_PLATFORM_STOCK`; skips combo products and rows with no active stocks unless `--include-empty`). Applied 2026-10-07 to product 82 / nivapp only (DB `centerbeam.proxy.rlwy.net`): ecomqty 12 → 11, damagedqty 0 → 1, availableqty 2 → 1; a re-run shows no difference.
* **Open finding:** A dry run over all products shows 101 platformstock rows that differ from a recount (e.g. nivapp `totalqty` missing sold rows, marketplace `ecomqty` not reduced for sold stock, nivapp `availableqty` differing from ecomqty − orderedqty − lockqty, such as product 44: 120 vs 150). Not applied. Since update/delete now recount, these rows will also change on their next stock edit. Review the order/marketplace flows that maintain platformstock before a bulk apply.
* **Verification:** TypeScript: no new errors (the only error, `product.controller.ts` `gst_rate`, is pre-existing). Pending: in dev, mark an Available + e-com stock as Damaged and back, and delete a stock; confirm `platformstock` ecomqty / availableqty / damagedqty match `product`.
* **Repository Impacted:**
  - `asset-management-backend`

### 2026-10-07: Block Marking Stock as Damaged When Pending Orders Need It
* **Issue:** Admin could mark a stock Damaged while customers' orders were waiting for it. Product 82 / nivapp had 10 units ordered (not dispatched) and 0 available, yet damage was still allowed, so the orders could no longer be fully delivered. The Inventory screen used a plain browser `window.confirm`.
* **Rule:** Marking a stock Damaged is blocked when its platform has `orderedqty + lockqty > 0` (orders waiting to be delivered, or units held while customers complete payment) and `availableqty < 1`. Uses the stored `platformstock` values maintained by the order, dispatch, cancel and return flows (no recount). Applies to all stock, including in-store stock (ecompublish = false). With no pending orders or locks it is always allowed. Damaged → Available is never blocked. Sold stock cannot be marked Damaged.
* **Fix (Backend):**
  - `StockService.getDamageCheck()` returns allowed / message and current and resulting quantities (available, ordered, lock, damaged, out-of-stock flag).
  - `StockService.update()` runs the check whenever `stockstatus` changes to damaged (covers the Mark as Damaged button, Edit Stock form and direct API calls); `PUT /v1/stocks/:id` returns **409** with the check in `data`.
  - New `GET /v1/stocks/:id/damage-check` (read only).
* **Fix (Inventory):**
  - New `components/stocks/MarkDamagedModal.tsx` (shared `Modal`, glassy) replaces `window.confirm` in `StocksList`. It loads the check when opened. Blocked: reason, ordered / in payment / available / damaged, **Close** and **Bulk Add Stock** (opens the Bulk Add Stock form, same as the header button). Allowed: Available and Damaged before → after, amber note when the product goes out of stock on that platform, **Cancel** / **Mark as Damaged**. A 409 on confirm (an order arrived meanwhile) switches the dialog to the blocked state.
  - Mark as Damaged icon hidden for stock that is already damaged.
  - `stockService.getDamageCheck`, `stockService.markStockDamaged`, `StockDamageCheck` type, `STOCKS.damageCheck` endpoint.
* **Known limit:** The check and the update are separate steps (no row lock), so an order placed in the same instant could still slip through. Rare for manual admin actions.
* **Verification:** Read-only run of `getDamageCheck` for product 82 / nivapp stock 18239: blocked with "10 unit(s) ordered and waiting to be delivered, and 0 available on nivapp…". Backend `tsc`: no new errors. Inventory `tsc` / ESLint: no new errors (existing `StockImportModal` unused-variable and `stockService` `any` findings unchanged). Pending: dev check of the blocked and allowed dialogs after login.
* **Repositories Impacted:**
  - `asset-management-backend`
  - `asset_management_frontend_aromazen`

### 2026-10-07: Supplier Duplicate Code — Form Stays Open With a Clear Message
* **Issue:**
  - Create: saving with an existing supplier code (`00001`) showed "Duplicate suppliercode: '00001' already exists. Please use a unique value." but Add Supplier then went back to the list, so the entered values were lost.
  - Update: changing a supplier's code to one used by another supplier returned "Internal server error" (500).
* **Root cause:**
  - Inventory `AddSupplier` called `navigate("/suppliers")` after `createSupplier` without checking the result. `useApi.makeRequest` shows the error toast and returns `null` instead of throwing, so the page always navigated away.
  - Backend `dynamicUpdate` (shared) runs a raw SQL UPDATE; the unique-constraint error was caught and turned into `null`, and `SupplierService.update` then threw a generic `Error('Failed to update supplier…')` → 500.
* **Fix (Backend):** `SupplierService.assertSupplierCodeAvailable()` looks up the code in `supplier` (excluding the supplier being edited) before create and update, and throws a `ValidationError` (400): "Supplier code '<code>' is already in use." / "Please enter a different supplier code. Each supplier needs its own code." The shared `dynamicUpdate` / `dynamicCreate` and the shared DB error parser are unchanged, so other modules are not affected.
* **Fix (Inventory):** `AddSupplier` navigates only when the response is successful; on error it stays on the form (Formik keeps the values) and the toast shows the message. `EditSupplier` already stayed on the page on failure; it now receives the clear 400 message.
* **Compatibility:** Successful create / update unchanged. Keeping a supplier's own code on update is allowed. Other supplier validations unchanged. Known limit: two saves of the same code at the same instant can still hit the DB constraint (create then shows the older generic duplicate message; update a 500).
* **Verification:** New `src/services/supplier.service.test.ts` (5 tests) pass. Read-only run against the local DB: create `00001` → 400 with the new message; update supplier 4 → `00001` → 400; update supplier 3 (owner) keeping `00001` → allowed. Backend and Inventory `tsc`: no new errors. Pending: dev UI check after login (Add Supplier with `00001`; Edit another supplier to `00001`).
* **Repositories Impacted:**
  - `asset-management-backend`
  - `asset_management_frontend_aromazen`

### 2026-10-07: Product Create / Update — Clear Error Messages on Failed Save
* **Review finding:** On a failed save, Product Create stays on the form and Product Edit stays in edit mode, so nothing the user typed is lost. The toast text was the problem:
  - Backend schema errors return message "Validation failed" with the field list in `details`; Inventory `productService` showed only `message`.
  - Combo rules and the HSN/GST check on update threw plain `Error`s, which the shared error handler returns as 500 ("An unexpected error occurred" when `NODE_ENV=production`) with technical wording ("components array", "iscombo", product IDs).
  - `dynamicUpdate` (shared) turns any database error into `null`, so product update answered "Failed to update product - no valid fields provided" (500) whatever the cause.
* **Fix (Backend):**
  - `ProductService` combo and HSN/GST checks throw `ValidationError` (400) with plain wording plus a next step in `details` (e.g. "Please add at least one product to this combo.", "HSN code and GST rate are required.").
  - New `toFriendlyProductSaveError()` in `product.service.ts` rewords database errors on create/update: duplicate → "This product already exists."; value too long → "Some of the text entered is too long." Other errors pass through unchanged.
  - `dynamicUpdate` takes an optional `{ throwOnError }`; only `ProductService.update` sets it. All other callers keep returning `null` on error.
* **Fix (Inventory):** New `utils/productSaveError.ts` builds the toast text from `message` + `details`. "Validation failed" becomes "Please check: …" with field labels instead of column names and Zod's default wording rewritten (e.g. "Material must be 255 characters or fewer", "Price has an invalid value"). Used by `productService.createProduct` / `updateProduct`.
* **Compatibility:** Successful create/update unchanged. Status code changes from 500 to 400 for the combo and HSN/GST rules. The combo pre-check endpoint (`validateComboComponents`, 409) is unchanged. No other module's error handling changes.
* **Verification:** Backend `src/services/product.service.errors.test.ts` (4) pass. Inventory `tests/productSaveError.test.ts` (5) pass (`node --test --experimental-strip-types`). Live check against the local DB: update with a 300-character material → 400 "Some of the text entered is too long." (was 500 "no valid fields provided"); the product row was unchanged. Backend `tsc`: only the existing `gst_rate` error. Inventory `tsc`: 99 errors before and after (all existing). Pending: dev UI check after login (create without HSN, combo without items, overlong field on edit).
* **Repositories Impacted:**
  - `asset-management-backend`
  - `asset_management_frontend_aromazen`

### 2026-10-07: Bulk Add Stock — Clear Error Messages and No Double Save on Retry
* **Review finding:** Bulk Add Stock (the only stock create path in Inventory; there is no stock edit) closes only on success, so entered values were not lost. Problems:
  - `POST /v1/stocks/bulk-insert` answers **207** when any record fails. `response.ok` is true, `success` is false and there is no `error`, so the toast always read "Bulk import failed"; `failures[].error` (raw text such as "Batch database-level bulk insert failed: Invalid `prisma.$queryRawUnsafe()`…") was ignored.
  - Records are inserted in batches of 500. Above 500 units an earlier batch can be saved while a later one fails; the list was not refreshed and the quantity stayed the same, so Save again added the saved units twice.
  - Fastify request checks reached the user as written, e.g. "body/0/instances must be <= 10000"; the form had no maximum quantity or batch number length.
  - When stock rows saved but the product / platform-stock totals update failed, the response still had `success: true` and the user saw a success message.
* **Fix (Backend):**
  - New `src/utils/stockBulkErrors.ts`: `toFriendlyStockInsertError()` (duplicate / too long / product not found / fallback) and `formatBulkStockValidationError()` (form labels: "Quantity can be at most 10,000.", "Batch number must be 255 characters or fewer.", "Platform is required.").
  - `stock.route.ts`: `schemaErrorFormatter` on `/bulk-insert` only (other routes unchanged).
  - `StockService.createBulkDirect`: `failures[].error` uses the friendly text; the raw error is logged (first 5 per batch). Response shape and 201/207 codes unchanged.
* **Fix (Inventory):**
  - New `utils/bulkStockResult.ts` turns the bulk result into success / partial / failed with the message to show.
  - `StocksList`: failed → error toast with the reason, form stays open. Partial → list refreshed, warning "500 of 800 stock items were added. … The quantity has been changed to 300 so you can add the rest.", form stays open. Success → "N stock items added successfully.", or a warning when product / platform totals were not updated.
  - `StockForm`: quantity `max` 10,000 with message "Quantity can be at most 10,000"; batch number `maxLength` 255; `onSubmit` may return `{ remainingQuantity }` to lower the quantity after a partial save.
* **Compatibility:** Successful bulk add unchanged (toast text reworded). No change to how stock, product or platform-stock rows are written. Stock import (`StockImportModal`) does not use this flow.
* **Verification:** Backend `src/utils/stockBulkErrors.test.ts` (3, including a Fastify inject through the real `errorHandler`) pass. Inventory `tests/bulkStockResult.test.ts` (5) pass. Local server (port 5600), requests rejected by the body check before anything is saved: quantity 20000 → 400 "Quantity can be at most 10,000."; 300-character batch number → "Batch number must be 255 characters or fewer."; no platform → "Platform is required."; empty list → "Please add the stock details before saving." Backend `tsc`: only the existing `gst_rate` error. Inventory `tsc`: 99 before and after (all existing); ESLint: only the existing `StocksList` hook warnings. Pending: dev UI check after login (normal bulk add; quantity above 10,000; partial save is hard to force manually).
* **Repositories Impacted:**
  - `asset-management-backend`
  - `asset_management_frontend_aromazen`

### 2026-10-07: Inventory Order Detail — Full-Page Loading Skeleton
* **Issue:** `OrderDetailPage` returned a 48px spinner in an `h-64` box while the order loaded, so the page was blank and then jumped to the full layout.
* **Fix (Inventory):**
  - New `pages/orders/OrderDetailSkeleton.tsx` (built on the shared `components/common/SkeletonBone`): breadcrumb + action buttons + status badge; Order Summary card (title/date, order total, 5 quick-info tiles, breakdown rows and total); `lg:grid-cols-3` layout with Order Items (2 item cards), Invoice row, Delivery Address and Payment cards on the left, and the Order Timeline (6 steps) on the right.
  - `OrderDetailPage.tsx`: loading state renders `OrderDetailSkeleton`.
* **Compatibility:** UI only; no API change. Access-denied and not-found states unchanged.
* **Verification:** TypeScript (`tsconfig.app.json`) and ESLint clean on changed files. Pending: dev check opening an order from Orders with network throttling (desktop and narrow widths).
* **Repository Impacted:**
  - `asset_management_frontend_aromazen`

### 2026-10-07: Inventory Purchase Order — Generate PO URL from Config
* **Issue:** `PurchaseOrderDetailPage.handleGeneratePO` posted to a hardcoded `https://nivfiles-374914445110.us-central1.run.app/generate-document/po`, ignoring `VITE_API_BASE_URL_UPLOADS`, so dev/SIT/UAT/prod all used the same file service.
* **Fix (Inventory):**
  - `config/api.config.ts`: `PURCHASE_ORDERS.generatePO: "/generate-document/po"`.
  - `PurchaseOrderDetailPage.tsx`: URL is `${API_CONFIG.BASE_URL_UPLOADS}${API_CONFIG.ENDPOINTS.PURCHASE_ORDERS.generatePO}`, method `API_METHODS.POST` (same as `EditPurchaseRequestPage` Generate PR and `CreateQuoteModal`).
* **Compatibility:** Payload and response handling unchanged. `VITE_API_BASE_URL_UPLOADS` is set in `.env`, `.env.development`, `.env.sit`, `.env.uat` and `.env.prod`; the request now goes to that environment's file service.
* **Verification:** No `nivfiles-` URLs remain in Inventory `src`. `tsc`: no errors in the changed files. Pending: dev check of Generate PO (request URL in Network tab, PDF opens).
* **Repository Impacted:**
  - `asset_management_frontend_aromazen`

### 2026-10-07: Inventory Register — User Create URL from Config
* **Issue:** A hardcoded-URL check of Inventory `src` (after FIX-2026-10-07-62) found `RegisterPage` was the only API call building its URL outside `API_CONFIG`: `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5600"}/v1/inventoryusers` with method `"POST"`.
* **Fix (Inventory):** `RegisterPage.tsx` uses `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.INVENTORY_USERS.create}` and `API_METHODS.POST`, importing from `config/api.config`.
* **Compatibility:** Resolves to the same URL (`API_CONFIG.BASE_URL` reads the same env var with the same fallback). Payload and response handling unchanged.
* **Verification:** No API calls with hardcoded hosts or literal paths remain in Inventory `src`; remaining `http(s)://` strings are config fallbacks, CDN scripts/styles, and form placeholders. `tsc`: no errors in the changed file. Pending: dev check of registration (request URL in Network tab).
* **Repository Impacted:**
  - `asset_management_frontend_aromazen`

### 2026-10-07: Inventory Purchase Order — Generate PO Sends Auth Token
* **Issue:** Generate PO from local Admin (local backend, SIT file service `nivfiles-dev`) failed with 404. The route `POST /generate-document/po` exists and the PDF was uploaded to `niv-po-deve`, but the file service's callback `PUT https://nivaana-dev-…/v1/purchaseorders/1` had no `Authorization` header (Admin's fetch sent only `Content-Type`) and the backend returned 401. `fileupload.controller.ts` catches callback errors and replies 404, hiding the 401. Not an environment issue: local and SIT backends share the JWT secret and `assetmanagement_dev` database.
* **Fix (Inventory):** `PurchaseOrderDetailPage.handleGeneratePO` uses `headers: getApiHeaders(true)` (existing helper in `config/api.config.ts`: `Content-Type: application/json` + `Authorization: Bearer <authToken>`), matching `EditPurchaseRequestPage` Generate PR.
* **Compatibility:** Payload, URL, method and response handling unchanged. File service unchanged (it already forwards the header).
* **Verification:** `tsc` and ESLint clean on the changed file. Pending: dev check of Generate PO (request has `Authorization` header, PDF opens, PO `fileurl` saved).
* **Follow-up (not done):** file service `fileupload.controller.ts` returns 404 for every callback failure; it should pass through the upstream status.
* **Repository Impacted:**
  - `asset_management_frontend_aromazen`

### 2026-10-07: Inventory Purchase Request / Purchase Order Detail — Loading Skeleton
* **Issue:** `EditPurchaseRequestPage` (`/purchase-requests/:id/edit`, the PR detail view) returned a spinner in an `h-64` box; `PurchaseOrderDetailPage` returned a spinner with "Loading..." text. Both pages were blank and then jumped to the full layout.
* **Fix (Inventory):**
  - New `components/common/PurchaseDetailSkeleton.tsx` (built on `SkeletonBone`): breadcrumb + status badge (inside a card for PO, as on the real page), two-tab bar, then the active tab's card. Details: action buttons, two columns of 5 label/value fields, Items/Products table (`tableColumns`), optional Additional Information (PO). Quotes/Invoices tab: header + list table.
  - `EditPurchaseRequestPage.tsx`: `<PurchaseDetailSkeleton variant={quotes ? "list" : "details"} tableColumns={2} />`.
  - `PurchaseOrderDetailPage.tsx`: `<PurchaseDetailSkeleton variant={invoices ? "list" : "details"} tableColumns={4} showAdditionalInfo headerInCard />`.
* **Compatibility:** UI only; no API change. Error / access-denied states unchanged.
* **Verification:** TypeScript (`tsconfig.app.json`) and ESLint clean on changed files (2 TS errors pre-exist in `CreatePurchaseOrderPage.tsx` and `CreateSamplePurchaseRequestPage.tsx`, untouched). Pending: dev check opening a PR and a PO (and with `?tab=quotes` / `?tab=invoices`) with network throttling.
* **Repository Impacted:**
  - `asset_management_frontend_aromazen`

### 2026-10-07: Inventory Promotions List — "No promotions found" Flash on Load
* **Issue:** On opening `/promotions`, the empty state ("No promotions found") showed first, then the loader, then the list. Cause (frontend only, not API latency):
  - The list effect wrapped every fetch, including the first, in a 350 ms `setTimeout` (debounce for search typing), so the first request started 350 ms late.
  - `usePromotions` initialised `loading` to `false`; the page renders the empty state when `promotions.length === 0 && !loading`, so before the first fetch it could not tell "not fetched yet" from "no promotions".
* **Fix (Inventory):**
  - `PromotionsPage.tsx`: the first promotions load runs with no delay (`hasLoadedPromotionsRef`); later search/filter changes keep the 350 ms debounce.
  - `usePromotions.ts`: `loading` starts as `true` (hook used only by `PromotionsPage`; `loading` drives only the promotions list), so the table skeleton shows until the first response; "No promotions found" appears only after an empty result.
* **Compatibility:** UI only; no API change. Redemption History tab unchanged.
* **Verification:** No new TypeScript or ESLint findings on changed lines (existing TS errors at `PromotionsPage.tsx` 469/759 and `usePromotions.ts` 235, and 2 lint warnings, pre-exist on HEAD). Pending: dev check opening Promotions (skeleton → list, no empty-state flash), search typing still debounced, empty search result still shows "No promotions found".
* **Repository Impacted:**
  - `asset_management_frontend_aromazen`

### 2026-10-07: Roles — Server Error Message Shown in the Toast, 400 for Role Rules
* **Issue:** Roles page → Create Role with code `system_admin` (already exists). The API returned `{ message: "Role with code 'system_admin' already exists", statusCode: 500 }` and the toast read "Failed to create role / Failed to create role". Update had the same problem. The form stayed open and kept its values (no change needed there).
* **Root cause:**
  - Inventory `roleService.createRole` / `updateRole` read `errorData.error`; the backend sends `message`, so the generic fallback was always shown.
  - `RoleService.create` / `update` / `previewLevelChange` threw plain `Error`s, which the shared error handler returns as 500 ("An unexpected error occurred" when `NODE_ENV=production`).
  - Role schema messages were technical ("Code must be lowercase alphanumeric with underscores only…"); name and description length had Zod's default text.
* **Fix (Backend):**
  - `role.service.ts`: `roleErrors` (`ValidationError`, 400): "Role code '<code>' is already in use." / "Role name '<name>' is already in use." (+ "Please enter a different …"), "Level must be 1 or higher.", "System roles can't be turned off." (+ "You can't deactivate a system role or change it to a regular role."). Used in create, update and level preview.
  - `role.schema.ts`: "Role code can only use lowercase letters, numbers and underscores (e.g. super_admin).", "Role code is required.", "Role code must be 50 characters or fewer.", "Role name is required.", "Role name must be 100 characters or fewer.", "Description must be 500 characters or fewer.", "Level must be 1 or higher."
* **Fix (Inventory):**
  - New shared `utils/apiErrorMessage.ts` (`getApiErrorMessage`): message + details, with "Validation failed" turned into "Please check: …" using form labels. The product formatter from FIX-59 moved here; `productSaveError.ts` now only holds product labels (same output; product tests unchanged and passing).
  - `roleService.createRole` / `updateRole` use it with role labels.
* **Compatibility:** Successful create/update unchanged. Status 500 → 400 for these role rules. Role not found still 404. No other module's backend errors change.
* **Verification:** Backend `src/services/role.service.errors.test.ts` (3) pass. Inventory `tests/roleSaveError.test.ts` (4) and `tests/productSaveError.test.ts` (5) pass. Live run against the local DB (each fails its duplicate check before any write): create with code `system_admin` → 400 "Role code 'system_admin' is already in use."; update role 2 (`admin`) to `system_admin` → same 400; role 2 unchanged and no test role created. Backend `tsc`: only the existing `gst_rate` error. Inventory `tsc`: 99 before and after (all existing); ESLint clean on changed files. Pending: dev UI check on the Roles page (create `system_admin`; edit another role to `system_admin`).
* **Follow-up (regression found in dev test):** After the change to 400, the API answered only `{ "success": false }`. `role.route.ts` declared 400/404/500 response schemas with only `success` and `error`; Fastify removes properties not in a response schema, so `message` / `details` were dropped (the old 500 path was not affected). All 9 error schemas in `role.route.ts` (list, get, create, update, delete, level preview) now also declare `message`, `details`, `statusCode`. New `src/routes/role.route.test.ts` checks every role error schema and a real POST through the 400 schema; it fails on the previous file with `{"success":false}`. End-to-end on the local DB through the role routes + error handler: `POST /v1/roles` with `system_admin` and `PUT /v1/roles/2` with `system_admin` → 400 `{"success":false,"message":"Role code 'system_admin' is already in use.","details":"Please enter a different role code.","statusCode":400}`; role 2 unchanged. Supplier and product create/update have no such schema (only their list/count GET error schemas omit `message`; not changed).
* **Repositories Impacted:**
  - `asset-management-backend`
  - `asset_management_frontend_aromazen`
