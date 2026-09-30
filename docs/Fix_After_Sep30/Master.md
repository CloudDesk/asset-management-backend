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
