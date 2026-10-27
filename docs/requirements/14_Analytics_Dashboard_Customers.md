# 14 · Analytics, Dashboard and Customer 360

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`analytics.*`, `customer-overview.service.ts`, `users.route.ts`), `docs/Fix_After_Sep30/2026-09-30-inventory-dashboard-analytics-*.md`, Master.md FIX-2026-09-30-01 … 14, FEATURE-2026-10-06-46.

## 1. Purpose

Gives the team one screen showing stock health, orders and sales, and a full view of each customer.

## 2. Dashboard (Inventory home)

- **ANL-01** All analytics need login (FIX-2026-09-30-01). Endpoints (`/v1/analytics/*`):
  - `inventory-health`
  - `orders`
  - `fulfillment-summary`
  - `sales-velocity`
  - `supply-chain`
- **ANL-02** Filters: category, subcategory, sub-subcategory, platform (`nivapp`, `amazon`, `flipkart`, or all).
- **ANL-03** The default mode is **Global multi-platform**. Physical stock is split into Available, Sold and Damaged. A 3-channel distribution chart and channel-level problem stock are shown.
- **ANL-04** Counting rules:
  - "Total Stock Items" counts only active, available stock: no sold and no soft-deleted rows.
  - The problem-products table uses the platform's available quantity.
  - Combo products are left out of the category breakdown.
  - Charts label units as "Available Units".
- **ANL-05** **Net order revenue excludes** returned, partially returned and `rto_delivered` orders.
- **ANL-06** Counts run as SQL in the database, not in memory. Each widget shows a loading skeleton, and the page header stays fixed while the page scrolls (FIX-2026-10-07-54, FIX-2026-09-30-14).
- **ANL-07** The Amazon connection alert also shows on the Dashboard for users with Amazon access (module 11).

## 3. Customer 360

- **ANL-08** Customers list → `/customers/:id` (`GET /v1/users/:id/overview`) shows:
  - **Header:** contact, customer since, business / GST, groups, first and last order.
  - **Key figures:** orders, revenue, average order value, returns, promotion savings, wallet.
  - **Tabs:** orders, addresses, coupons / wallet, returns.
- **ANL-09** Customer records: name, email, mobile, gender, GST number, business flag, guest flag, active flag.

## 4. Gaps and items to confirm

- **No report or export requirements are written down,** apart from the credit-note export and the Amazon operations export. `reports` is a permission object, but no report screens exist. Confirm the reports needed: sales by period / channel, GST summary, stock valuation, and so on.
- `sales-velocity` and `supply-chain` have no written definition of how they are calculated. Confirm the formulas and thresholds (for example low stock = 1–5, as in CAT-14).
- Review area 13 in `docs/application-review/MASTER_REVIEW.md` has not started.

## 5. Source documents

`docs/Fix_After_Sep30/2026-09-30-inventory-dashboard-analytics-security-accuracy-fix.md`, `2026-09-30-dashboard-ux-scrolling-layout-enhancement.md`, `docs/Docs-K9&Performance/*` (load tests).
