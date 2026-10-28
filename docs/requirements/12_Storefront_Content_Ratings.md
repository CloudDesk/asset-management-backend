# 12 · Storefront Content (Home Page Sections, Promotional Assets) and Ratings / Reviews

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`storefront-page-section.*`, `rating.*`, `product.service` home catalog), Inventory `promotionalAssets`, E-com `Home.tsx`, Master.md FIX-2026-10-05-22 … 27.

## 1. Purpose

Lets the team change what the E-com home page shows without a code release, and lets customers rate the products they bought.

## 2. Home page sections

- **STF-01** A section (`StorefrontPageSection`) belongs to a page (default `home`) and has:
  - a section key and type, a name and sort order, an active flag
  - an optional schedule (start / end; the end must be after the start)
  - attributes (JSON: slides, items, media `image` / `video`, fit `cover` / `contain`)
  - a version number
- **STF-02** Updates use **optimistic locking**: saving an older version fails with "Section was modified by another update".
- **STF-03** `GET /v1/storefront-page-sections/homepage-config` returns the active, in-schedule sections in order for E-com. Media is uploaded through `POST /media` (file service `/storefront/media`).
- **STF-04** Inventory screen: **E-com Home Promotional Assets**.

## 3. Home product rails

- **STF-05** `GET /v1/products/platform/nivapp/home` ranks over the whole catalogue in the database:
  - Best Sellers by Nivaana sold quantity
  - New Arrivals
  - Best of Nivaana
  - Flavours
  - Category slides
- **STF-06** The Flavours rail starts with four fixed "Daily Rituals" subcategory cards: Fresh Mornings … Peaceful Nights (FIX-2026-10-05-23).
- **STF-07** "View products" on Best Sellers opens `/best-sellers` sorted by best selling, the same order as Home (FIX-2026-10-05-24).
- **STF-08** Category images come from module 02 (CAT-24).

## 4. Ratings and reviews

- **STF-09** A customer rates a product they ordered:
  - star rating **1–5**, with optional comment and photo
  - linked to the order and order line (`/v1/ratings`, photos via the file service `/uploadrating/images`)
- **STF-10** The product's average and star distribution come from `GET /product/:productId/average` and `/stars`.
- **STF-11** The Home "Real Customers, Real Reviews" rail shows only 4–5 star reviews with comments. It pages in fixed steps (3 per page on desktop, 1 on mobile) with no repeats (FIX-2026-10-05-27).
- **STF-12** Mobile has "Review My Purchases".

## 5. Gaps and items to confirm

- **Review moderation is not built:** there is no approve / hide flow before a review is public. Confirm whether one is needed.
- Can a customer rate the same order line twice? `upsert` exists, but there is no stated rule. Confirm "one rating per order line, editable".
- Confirm which section types the BA expects: carousel, banner, video, tiles, and so on.

## 6. Source documents

`docs/Fix_After_Sep30/2026-10-05-ecom-home-catalog-api.md`, `2026-10-01-category-images-inventory-and-ecommerce-integration.md`, Inventory `promotional_assets_schema.sql`, E-com `PRODUCT_CATEGORY_AUDIT.md`, `Nivaana_Homepage_Image_Aspect_Ratio_Guide.docx`, `Nivaana_Ecommerce_Image_Aspect_Ratio_Spec.docx`.
