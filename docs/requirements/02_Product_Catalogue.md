# 02 · Product Catalogue, Picklists, Tax (HSN/GST) and Category Images

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`product.*`, `picklist.*`, `category-image.*`, `productNaming.ts`, Prisma `Product`, `ProductBundleMap`, `Picklist`, `GstHsnMapping`, `CategoryImage`), Master.md, PLAN-2026-10-26-164.

## 1. Purpose

Maintains the product master that every channel sells from (Nivaana app / web, Amazon, in-store), the picklist values that drive every dropdown, and the category images shown on the storefront.

## 2. Product master

### 2.1 Fields and naming
- **CAT-01** A product has a PUC (product unique code), brand, category → subcategory → sub-subcategory, scent (`fragnancetype`), pack, price, discount, HSN code, GST rate, images (large / medium / small arrays), descriptions (short / full rich text, benefit items) and physical attributes (material, length, thickness, net quantity, burn time, usage, and so on).
- **CAT-02** The product **name is generated** as `<Brand label> - <Remarks>`. Brand and Remarks are required. Remarks can be at most 1,000 characters and the name at most 1,200 characters.
- **CAT-03** A **short name** (`shortname`) is used wherever space is limited: breadcrumbs, the stock modal, Ekart / Shipmozo labels and order lines (FIX-2026-10-06-42, FIX-2026-10-07-82).
- **CAT-04** **ASIN** is optional: 10 letters or digits, saved in upper case, and an empty value clears it. It is used for Amazon mapping (FIX-2026-10-22-140).
- **CAT-05** Admin product search is reactive: 350 ms debounce, minimum 3 characters as guidance, partial match on the backend, and it combines with the Category / Status filters (FIX-2026-10-04-19).

### 2.2 Tax (HSN / GST)
- **CAT-06** HSN code and GST rate are **mandatory on every product**. Values are kept per product, not per category (ARCH-2026-09-30-15). `GET /v1/products/tax-presets` offers optional auto-fill presets from `GstHsnMapping`.
- **CAT-07** Order lines take an **immutable snapshot** of HSN, GST rate and the tax split (CGST / SGST / IGST). Orders, in-store orders and shipments are blocked when a product or line has no valid HSN/GST.

### 2.3 Combo products
- **CAT-08** A combo (`iscombo = true`, `combotype` default `fixed`) is built from single products through `ProductBundleMap` (`requiredqty` per component).
- **CAT-09** Combo rules (400 with plain wording, FIX-2026-10-07-59):
  - A combo needs at least one component.
  - Only a combo product can have combo items.
  - A component cannot itself be a combo.
  - A combo with exactly the same components cannot exist twice.
  - Every component must exist.
- **CAT-10** `POST /v1/products/validate-combo` pre-checks the components (409 on conflict).
- **CAT-11** A combo's sellable quantity comes from its components: the minimum over components of (available ÷ required qty). Its own top-level stock stays 0 (a virtual SKU) (FIX-2026-10-05-21).
- **CAT-12** **Scent rule (PLAN-2026-10-26-164, agreed, not built yet):**
  - Single products: Scent is optional in every subcategory.
  - Combos in a subcategory with Scent options: Scent is mandatory and components are found by Scent.
  - Combos in a subcategory without Scent options: Scent is hidden and components are chosen by product search (name / PUC).

### 2.4 Stock status shown on the product
- **CAT-13** The product's quantities are recalculated from its stock rows: total, sold, e-com published, damaged, and available = e-com published − ordered.
- **CAT-14** `productstatus` is derived from that available quantity:
  - `in_stock` when more than 5
  - `low_stock` when 1–5
  - `out_of_stock` when 0, or when there are no active stocks

### 2.5 Images
- **CAT-15** Images are uploaded through the file service (`/product/images/:productid`) by button or drag-and-drop (FIX-2026-10-07-81).
- **CAT-16** Images can be re-ordered (`PUT /:id/rearrange-images`); a re-order must contain exactly the same URLs. Images can be deleted per size array (`DELETE /:id/image-urls`).

### 2.6 Channel views
- **CAT-17** `GET /v1/products/platform/:platform` returns the products published on a channel. `/platform/nivapp/home` returns the ranked home rails (Best Sellers by Nivaana sold qty, New Arrivals, Best of Nivaana, Flavours, Category slides) (FIX-2026-10-05-22).
- **CAT-18** Storefront listing filters run in the database (`filterMode=storefront`): category, subcategory, flavour, collection, search, price range, and sort, including `bestselling` (FIX-2026-10-05-24 / -26).
- **CAT-19** Bulk create / update is available through `POST /upsert` and `/upsert-with-file` (Excel).

## 3. Picklists

- **CAT-20** Every dropdown value (category, subcategory, sub-subcategory, scent, brand, pack, statuses, and so on) is a `Picklist` row: object, field name, label, value, controlling field / value (dependency), parent, sort order, active.
- **CAT-21** Admins edit picklists in bulk (`PUT /v2/picklists/bulk`). A new item needs a label, value, object and field name, and an update needs a positive integer id.
- **CAT-22** Screens must load picklists through **v2**. v1 is capped at 100 rows per page, which once hid 12 subcategories (FIX-2026-10-07-78).
- **CAT-23** The labels shown come from the picklist, not the stored value. For example, "Incense & Rituals" is shown, not "Incense Rituals" (FIX-2026-10-05-32).

## 4. Category images

- **CAT-24** Each category or subcategory picklist row can have one managed image (JPEG / PNG / WebP, **≤ 5 MB**, not empty), with alt text and a thumbnail, and can be shown or hidden on the storefront (FEATURE-2026-10-01-16).
- **CAT-25** The Inventory page has Show / Category / Level filters and grouped rows (FIX-2026-10-07-84). The storefront uses only active images and falls back to a shared image.

## 5. Inventory screens

Products (list, detail tabs: Detail, Images, Stock, Platform stock), Picklists (grouped / flat), Category Images, Promotional Assets (E-com home).

## 6. Gaps and items to confirm

- PLAN-164 (Scent optional / combo without Scent) is approved but not built.
- The `discount` and `pricing_markup` tables exist, but no requirement says how the markup is used. Confirm or remove.
- `combotype` supports `fixed` only in practice. Confirm whether "flexible" combos are planned.

## 7. Source documents

`docs/Fix_After_Sep30/2026-09-30-product-level-hsn-gst-architecture-and-migration.md`, `2026-10-01-category-images-…md`, `2026-10-05-ecom-combo-product-stock-and-cart-parity.md`, `2026-10-05-ecom-home-catalog-api.md`, `2026-10-26-product-scent-optional-and-combo-mapping-plan.md`; Inventory `PRODUCT_FORM_FIELDS.md`, `SCENT_FIELD_LOGIC_LOCATIONS.md`.
