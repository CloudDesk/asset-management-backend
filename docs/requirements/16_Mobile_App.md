# 16 · Mobile App (Vibrant-Life-mobile-app, "Nivaana")

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** `Vibrant-Life-mobile-app` (`expo_rn_migrations_v2` branch: `src/screens/*`, contexts, `APP_UPDATE_FEATURE.md`, `DEEPLINK_TESTING_GUIDE.md`), Master.md "Mobile" entries.
**Stack:** Expo SDK 55, React Native 0.83; EAS Build and EAS Update (OTA); Android and iOS.

## 1. Purpose

The customer app. It has the same commerce rules as the website (backend modules 01–13) plus device features.

## 2. Screens

| Area | Screens | Requirements (module) |
| --- | --- | --- |
| Auth | Phone login, OTP login, Login | Mobile OTP (01) |
| Home / browse | Home, Categories, Product list, Product detail, Search, Deals for you | Same catalogue and ranking as web (02, 12) |
| Cart | Cart → Stepper (address → offers → payment), Payment status | V2 offers, locked offers, "View all offers (N)", customer coupons, wallet row always visible, PhonePe SDK (05, 06, 07) |
| Orders | My Orders (grouped), Order detail, Track order, Cancel order | Cancel cancels the whole order; "Return / Replace available until …"; timeline from real status dates (08) |
| Returns | Return product, Returns & refunds | Quantity picker; evidence: up to 5 photos ≤ 8 MB, video ≤ 60 MB, per-reason minimums; return / replace all items (10) |
| Account | Profile, Edit profile, Address book, Wallet, Wishlist, Review my purchases, Settings, Policies, Help & support, Contact us, Feedback | (01, 05, 06, 12) |
| Preferences | Fragrance preferences | Customer scent preferences (confirm how they are used) |
| Security | App lock, App lock settings | Device lock (biometric / passcode) before the app opens |

## 3. Device requirements

- **MOB-01** **Push:** register the FCM / APNs token after login and unregister on logout (module 13). Order and return pushes open the related screen.
- **MOB-02** **Deep links** open product, order and payment-return screens. The PhonePe return URL must be in the backend's allowed list.
- **MOB-03** **App updates:**
  - a store update banner ("v1.0.0 → v1.1.0", Update Now)
  - an OTA check through EAS Update when Profile opens
- **MOB-04** **Android 15 / 16 compatibility:** edge-to-edge and target SDK (see `ANDROID_15_16_FINAL_SOLUTION.md`).
- **MOB-05** Behaviour must match the website: offer eligibility, price breakdown, return evidence rules and status labels are the same (FIX-49 / 52 / 96 / 97 / 98).

## 4. Gaps and items to confirm

- **Release readiness** (review area 16) has not started: store listing, privacy labels, crash reporting, minimum OS versions.
- How Fragrance preferences are used (recommendations? offers?) is not specified.
- The repo root holds 70 markdown notes, mostly build fixes. Move the useful ones to `docs/` and archive the rest.
- The legacy COD handler is still in `paymentHandler.ts` and `CartScreen.tsx`; it is commented in the cart. Confirm that COD stays off on mobile.

## 5. Source documents

`APP_UPDATE_FEATURE.md`, `DEEPLINK_TESTING_GUIDE.md`, `ADDRESS_SELECTION_FEATURE.md`, `CART_STOCK_VALIDATION.md`, `CART_EVALUATION_INTEGRATION.md`, `ARCHITECTURE_DIAGRAM.md`, `ANDROID_BUILD_GUIDE.md`, `EAS_UPDATE_GUIDE.md`, `GIT_WORKFLOW.md`.
