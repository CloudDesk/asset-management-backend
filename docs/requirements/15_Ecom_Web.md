# 15 · E-commerce Web (Nivaana-Ecom-Web)

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** `Nivaana-Ecom-Web` (`SIT` branch: `src/App.tsx` routes, `src/pages/*`, `src/config/company.config.ts`, `scripts/deploy-guard.mjs`), Master.md FIX-2026-10-01-17 … FIX-2026-10-26-161.
**Stack:** React 19, Vite 7, Tailwind; Firebase hosting; deployed with `npm run deploy:sit|uat|prod`.

## 1. Purpose

The customer website: browse, buy, pay, track, return, and manage the account. Business rules live in the backend modules; this file lists **what the website must show and do**.

## 2. Pages

| Route | Page | Main requirements (module) |
| --- | --- | --- |
| `/` | Home | Promotional sections, ranked rails, category images, reviews rail (12) |
| `/products`, `/best-sellers` | Listing | Filters in the database: category / subcategory / flavour / collection / offer / search / price range / sort; infinite scroll; skeletons (02) |
| `/products/:productId` | Product details | Rich text, images, price, combo stock, ratings, Add to Cart / Wishlist (02, 12) |
| `/cart` | Cart | Offers, locked-offer hints, unavailable items block checkout (05, 06) |
| `/checkout`, `/checkout/confirmation` | Checkout | Address form, offers, "Your coupons", wallet row, PhonePe (iframe in Meta in-app browsers), confirmation (06, 07) |
| `/login` | Login | Mobile OTP, number normalisation (01) |
| `/account` | My account | Profile, links to account pages |
| `/orders` | Orders | 10 per page with infinite scroll; summary cards exclude cancelled orders; Track only while on the way; return deadline; return / replace (single or all items) (08, 10) |
| `/payments` | Payments | Payment orders only, with transaction ids (07) |
| `/promotions` | Promotions | Offers and the customer's coupons (05) |
| `/wallet` | Wallet | Balance, credits, history (05) |
| `/wishlist` | Wishlist | Skeleton until product details load; sanitised description (06) |
| `/addresses` | Saved addresses | Shared address form (06) |
| `/delete-my-account` | Delete account | (01) |
| `/about`, `/terms`, `/privacy`, `/shipping`, `/returns`, `/replacement-exchange`, `/cancellation` | Policy pages | Company details from one config file; contact ReachUs@nivaana.in (FIX-122 / 123) |

## 3. General requirements

- **WEB-01** All nine account pages share one layout: width, padding, title style and breadcrumb (FIX-2026-10-06-38).
- **WEB-02** Prices, discounts and the order breakdown match the backend V2 quote and the mobile app (FIX-2026-10-07-52).
- **WEB-03** Loading states use skeletons, not blank spinners.
- **WEB-04** **Deploy guard:** a deploy is blocked unless the branch matches the environment and the checkout is clean (FIX-2026-10-26-161).

## 4. Gaps and items to confirm

- There are no stated requirements for SEO (meta tags, sitemap), analytics / pixel tracking, or accessibility. Confirm what is needed.
- The policy page text (returns window, COD charge, and so on) must match the backend rules in modules 07 and 10. The COD ₹50 line is one known mismatch.
- `NIVAANA_WEB_ECOMMERCE_API_DOCUMENTATION.md` is an API list and older than the V2 promotion routes.

## 5. Source documents

`Nivaana-Ecom-Web/README.md`, `DEPLOYMENT.md`, `PRODUCT_CATEGORY_AUDIT.md`, `NIVAANA_WEB_ECOMMERCE_API_DOCUMENTATION.md`, image aspect-ratio `.docx` specs, Master.md (all "Ecom" entries).
