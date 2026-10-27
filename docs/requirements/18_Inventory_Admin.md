# 18 · Inventory Admin Web App (asset_management_frontend_aromazen)

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** Inventory `SIT` branch at `f90d168` (DEV-NEW merged into SIT on 2026-10-27): `src/App.tsx`, `src/config/navigation.ts`, `src/config/integrationFeatures.ts`, `src/config/permissionSet.config.ts`, `src/components/auth/*`, `package.json`; backend `amazon-channel-permission.middleware.ts`; Master.md UI entries.
**Stack:** React, Vite, Tailwind; Firebase hosting (`hosting:sit|uat|prod`).

## 1. Purpose

The internal web app staff use to run Nivaana: catalogue, stock, purchasing, orders, shipping, returns, promotions, customers, channels and access control. The business rules for each screen are in modules 01–14 and 17. This file covers the app as a whole: routes, menu, who may open what, and the UI rules every screen follows.

## 2. Menu (sidebar)

From `src/config/navigation.ts`. Every item is shown to every signed-in user; the menu is **not** filtered by permission. Access is checked when the page opens (section 4).

| Group | Item | Path | Module |
| --- | --- | --- | --- |
| Main | Dashboard | `/dashboard` | 14 |
| Management | Products | `/products` | 02 |
| | Stocks | `/stocks` | 03 |
| | Suppliers | `/suppliers` | 04 |
| | Orders | `/orders` | 08 |
| | In-store Orders | `/instore-orders` | 08 |
| | Purchase Requests | `/purchase-requests` | 04 |
| | Purchase Orders | `/purchase-orders` | 04 |
| | Promotions | `/promotions` | 05 |
| | Coupons | `/coupon-wallet` | 05 |
| Configuration | Roles | `/roles` | 01 |
| | Permission Sets | `/permission-sets` | 01 |
| | Picklists | `/picklists` | 02 |
| | E-com Home Assets | `/ecom-home-promotional-assets` | 12 |
| | Category Images | `/category-images` | 02 |
| | Return Policies | `/return-replacement-policies` | 10 |
| | Customers | `/customers` | 14 |
| | Inventory Users | `/inventory-users` | 01 |
| Channels | All Channels | `/channels` | 09, 11 |
| | Amazon | `/channels/amazon` (only when `integrationFeatures.amazon`) | 11 |

- **ADM-01** "Offers & Deals" (`/offers`) is commented out of the menu and has no route. The page file exists but is not used.
- **ADM-02** **RTO Operations** (`/return-sources?requesttype=rto`) is **not in the menu**. It was added back by FIX-2026-10-09-101 and removed again in commit `7ae5206` (2026-10-12, "Update navigation.ts"). It is now reachable only by URL. **Confirm** whether removing it was intended.

## 3. Feature switches per environment

- **ADM-03** `integrationFeatures` decides whether channel screens are shown:

  | Branch | Amazon | Shipmozo |
  | --- | --- | --- |
  | SIT (current) | always shown | always shown |
  | DEV-NEW | hidden when the build mode is `sit` | always shown |

  In both, the backend switches (`AMAZON_INTEGRATION_ENABLED`, `SHIPMOZO_INTEGRATION_ENABLED`) decide whether the feature works. **Align the two branches before the next release.**
- **ADM-04** When Amazon is off, `/channels/amazon` redirects to `/channels` and `/orders/amazon/:id` redirects to `/orders`.

## 4. Route map and access

There are two guards:
- `ProtectedRoute` requires sign-in for every app page.
- `PermissionProtectedRoute` checks the user's permission set (`usePermissions(objectName)`). It shows **Access Denied** when the permission is missing and sends the user to `/login` when there is no session.

### 4.1 Public (no sign-in)

| Path | Page | Note |
| --- | --- | --- |
| `/` | → `/login` | |
| `/login` | Login | Signed-in users go straight to the dashboard |
| `/register` | Register (create inventory user) | Signed-in users go straight to the dashboard. **Confirm** that self-registration should be public. |
| `/forgot-password` | Forgot password | |
| `/reset-password` | Reset password | |
| `/amazon/callback` | Amazon OAuth return | Module 11 |

### 4.2 Signed-in pages

| Path | Page | Permission object | Needs |
| --- | --- | --- | --- |
| `/dashboard` | Dashboard | `dashboard` | read |
| `/products` | Products list | `product` | read |
| `/products/create` | Product create | `product` | create |
| `/products/:id/edit` | Product detail (Detail, Images, Stock, Platform stock tabs) | `product` | edit |
| `/products/:id/amazon` | Product → Amazon listing editor | `product` | edit |
| `/stocks` | Stocks | `stocks` | read |
| `/suppliers` | Suppliers list | `suppliers` | read |
| `/suppliers/add` | Add supplier | `suppliers` | create |
| `/suppliers/edit/:id` | Edit supplier | `suppliers` | edit |
| `/suppliers/:id` | Supplier detail (Detail, PRs, POs) | `suppliers` | read |
| `/purchase-requests` | PR list | `purchase_requests` | read |
| `/purchase-requests/add` | Add PR | `purchase_requests` | create |
| `/purchase-requests/:id/edit` | Edit / view PR | `purchase_requests` | read (**edit is not checked**) |
| `/purchase-orders` | PO list | `purchase_orders` | read |
| `/purchase-orders/create` | Create PO | `purchase_orders` | create |
| `/purchase-orders/:id/edit` | Edit PO | `purchase_orders` | edit |
| `/purchase-orders/:id/view` | PO detail, Generate PO | `purchase_orders` | read |
| `/orders` | Orders (Nivaana only) | `orders` | read |
| `/orders/:id` | Order detail | `orders` | read |
| `/orders/amazon/:amazonOrderId` | Amazon order detail | `orders` | read (+ Amazon on) |
| `/instore-orders` | In-store order | `orders` | **create** |
| `/promotions` | Promotions | `promotions` | read |
| `/promotions/redemptions/:redemptionId` | Redemption detail | `promotions` | read |
| `/coupon-wallet` | Coupons | `promotions` | read |
| `/coupon-wallet/:id` | Coupon detail | `promotions` | read |
| `/ecom-home-promotional-assets` | E-com Home Assets | `promotions` | read (see ADM-07) |
| `/picklists` | Picklists | `picklist` | read |
| `/category-images` | Category Images | `picklist` | read |
| `/return-replacement-policies` | Return Policies | **none** | sign-in only (see ADM-06) |
| `/return-sources` | Return Sources / RTO Operations | **none** | sign-in only (see ADM-06) |
| `/customers` | Customers | `users` | read |
| `/customers/:id` | Customer 360 | `users` | read |
| `/inventory-users` | Inventory Users | `inventoryusers` | read |
| `/roles` | Roles | `roles` | read |
| `/permission-sets` | Permission sets list | `permissionsets` | read |
| `/permission-sets/create` | Create permission set | `permissionsets` | create |
| `/permission-sets/:id/edit` | Edit permission set | `permissionsets` | edit |
| `/channels` | All channels (Ekart, Shipmozo, Amazon cards) | `channels` | read |
| `/channels/amazon` | Amazon workspace (Overview, Listings / Mappings, Stock Sync, Orders, Fulfilment, Returns, Activity) | `channels` | read (+ Amazon on) |
| `/play` | Empty page | none | **Remove** (see ADM-08) |
| `*` | Not found | | |

- **ADM-05** Buttons inside a page (create, edit, delete, export, import) are shown or enabled with `usePermissions` (used in about 59 files). Permission columns: Read, Create, Edit, Delete, Export, Import, View All, Modify All, Delete All.
- **ADM-06** **Return Policies** and **Return Sources / RTO** have no permission check. Any signed-in user can open them. The backend refuses some actions ("Inventory administrator access required"), but the screens are not protected. Add a `returns` permission object or reuse `orders`.
- **ADM-07** Two objects in the permission set form are never checked:
  - `promotional_assets`: E-com Home Assets checks `promotions` instead
  - `transactions`
  
  `quotes` and `poinvoice` are also never checked by any route. Either use them or remove them from the form.
- **ADM-08** Sample purchase request routes (`/sample-purchase-requests/*`) are **commented out** in `App.tsx`. The pages exist, but users cannot open them. **Confirm** whether this feature is retired (module 04, PUR-15). `/play` renders an empty page and should be removed.

### 4.3 Amazon action permissions (backend)

Amazon screens also need the Amazon channel permissions checked by the backend:

| Area | Permissions |
| --- | --- |
| Listings | `amazon_listing_import`, `amazon_listing_draft`, `amazon_listing_publish` |
| Mapping | `amazon_mapping` |
| Stock and product | `amazon_inventory_sync`, `amazon_product_update` |
| Orders | `amazon_order_sync`, `amazon_shipment_confirmation` |
| Operations | `amazon_retry_failures`, `amazon_export`, `amazon_operations_admin` |

The Inventory UI hides actions the user cannot use. It must not show greyed-out "permission is required" buttons where the action is not relevant (FIX-2026-10-26-164).

## 5. Shared UI rules (every screen)

### 5.1 Lists
- **ADM-09** List pages follow the Products / Orders / Suppliers pattern:
  - themed title and subtitle
  - the search box and filters stay visible while the table loads
  - a table loading state, not a full-page grey shell
  - pagination with the page number clamped
  - "Clear filters" whenever a filter is set (FIX-2026-10-07-74 / 75 / 84)
- **ADM-10** Search runs while typing:
  - 350–400 ms debounce
  - minimum 3 characters, shown as neutral guidance
  - no Search button
  - the first load does not wait for the debounce, so "No records found" never flashes (FIX-2026-10-04-19, FIX-2026-10-07-66)
- **ADM-11** Lists that need **all** rows (picklists, return policies) load every page, never one capped page. The v1 API returns at most 100 rows (FIX-2026-10-07-77 / 78).

### 5.2 Detail pages and loading
- **ADM-12** Detail pages show a **full-page skeleton** shaped like the page (breadcrumb, tabs, buttons, cards) while loading, never a lone spinner. This applies to: Product, Order, Supplier, PR, PO, Permission Set, Customer, Dashboard widgets and Picklists (FIX-2026-10-07-54 … 73).
- **ADM-13** Breadcrumbs and compact places show the product **short name**, with the full name on hover (FIX-2026-10-07-82).

### 5.3 Forms and errors
- **ADM-14** A failed save **keeps the form open with the user's values**. The toast shows the server's `message` (and `details`), reworded into plain field labels. It never shows "Validation failed", raw SQL or Zod text (FIX-2026-10-07-58 / 59 / 60 / 67).
- **ADM-15** Long configuration modals (for example Policy Reason Configuration and Coupon Edit) do not close on an outside click. They ask "Discard unsaved changes?" before closing or switching (FIX-2026-10-07-80, FIX-2026-10-07-86).
- **ADM-16** Confirmations use the shared `Modal`, never `window.confirm`. Example: Mark Damaged shows before → after quantities (FIX-2026-10-07-57).
- **ADM-17** Bulk actions report partial success clearly. Example: "500 of 800 stock items were added …" (FIX-2026-10-07-60).

### 5.4 Labels and data
- **ADM-18** Labels come from picklists (for example "Incense & Rituals"), never raw stored values (FIX-2026-10-05-32).
- **ADM-19** Prices and the order breakdown use the same rules as E-com and Mobile (module 05/06). Dates are shown in IST and stored in UTC.

### 5.5 Configuration and session
- **ADM-20** API base URLs, including the file service, come from `API_CONFIG` per environment and are never hard-coded. Calls to the file service send the user's token (FIX-2026-10-07-62 / 63 / 64).
- **ADM-21** Session: when the access token expires, it should be refreshed through `/v1/auth/refresh`. Only a failed refresh should send the user to `/login`. Amazon credential errors do **not** log the user out (FIX-2026-10-21-129). **Today the two request paths behave differently:**
  - calls made through `useApi` refresh the token
  - the shared fetch helpers in `api.config.ts` clear local storage and go to `/login` on any 401, with no refresh attempt

  Make every request path refresh first.

## 6. Build and release

- **ADM-22** Build modes: `build:sit`, `build:uat`, `build:prod` (Vite modes; output `dist-sit`, `dist-uat`, `dist-prod`).
- **ADM-23** `npm run deploy:<env>` runs `scripts/deploy-guard.mjs` first. It blocks the deploy unless the checked-out branch matches the environment and the working tree is clean (FIX-2026-10-26-161).

## 7. Gaps and items to confirm

1. RTO Operations menu link removed on 2026-10-12 (ADM-02): intended or not?
2. Return Policies and Return Sources have no permission check (ADM-06).
3. Unused permission objects in the form (ADM-07).
4. Sample purchase requests are unreachable and `/play` is empty (ADM-08).
5. `/purchase-requests/:id/edit` checks only read permission.
6. The menu shows every item even when the user has no read access. Decide whether to hide menu items the user cannot open.
7. `/register` is public. Decide whether only admins should create inventory users (through Inventory Users).
8. The Amazon feature switch differs between the DEV-NEW and SIT branches (ADM-03).
9. Token refresh differs between request paths: `api.config.ts` helpers log the user out on any 401 without refreshing (ADM-21).
10. Field-level specs per screen (columns, filters, form fields) are not written. `PRODUCT_FORM_FIELDS.md` exists for products only.

## 8. Source documents

Inventory `README.md`, `APP_ROUTES_REVIEW.md`, `SINGLE_PROJECT_SETUP_GUIDE.md`, `PRODUCT_FORM_FIELDS.md`, `PICKLIST_UI_SUMMARY.md`, `PROMOTION_FORM_ENHANCEMENTS.md`, `rules/Page_Implementation_Guide.md`, `rules/Component_Reference.md`, `rules/UI_enhance_plan.md`, Master.md (all "Inventory" entries).
