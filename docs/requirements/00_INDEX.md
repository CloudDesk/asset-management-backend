# Nivaana — Requirements by Module (Index)

**Version:** 1.0 · **As of:** 2026-10-27 · **Owner:** Suresh
**Scope:** backend (`asset-management-backend`, branch `DEV-NEW`), Inventory admin (`asset_management_frontend_aromazen`), E-com web (`Nivaana-Ecom-Web`), Mobile app (`Vibrant-Life-mobile-app`), file service (`vyb-lyf-file-upload`).

## How these documents were built

Each module file was written from the **current code** (routes, services, validation messages, Prisma schema, env settings) and the **latest decisions** in `docs/Fix_After_Sep30/Master.md` (FIX / PLAN entries up to FIX-2026-10-27-167), the CR plans, and the module master files.

- Each requirement has an ID (for example `PRM-07`) so it can be quoted in test cases and BA mails.
- Where code and older documents disagree, **these files follow the code and the latest FIX entry**. Older documents are listed under "Source documents" for history only.
- Each file ends with **Gaps and items to confirm**: what the code does but nobody has signed off, or what a plan asks for but is not built.

## Modules

| # | Module | File | Doc status | Key open items |
| --- | --- | --- | --- | --- |
| 01 | Identity, authentication, users, roles, permissions | [01_Identity_Access.md](01_Identity_Access.md) | ✅ Complete (from code) | Password rules; `userhierarchy` unused |
| 02 | Product catalogue, picklists, HSN/GST, combos, category images | [02_Product_Catalogue.md](02_Product_Catalogue.md) | ✅ Complete | PLAN-164 (Scent optional) not built |
| 03 | Inventory, stock, platform stock, stock locking | [03_Inventory_Stock.md](03_Inventory_Stock.md) | ✅ Complete | 101 platform-stock rows to recount |
| 04 | Purchasing: suppliers, PR, quotes, notes, PO, PO invoices, samples | [04_Purchasing.md](04_Purchasing.md) | ✅ Complete (current flow approved 2026-10-28) | Retired service-ticket tables only |
| 05 | Promotions, vouchers, coupons, groups, wallet | [05_Promotions_Coupons_Wallet.md](05_Promotions_Coupons_Wallet.md) | ✅ Complete | Reporting "expired" flag (PLAN-08) |
| 06 | Cart, wishlist, addresses, checkout price | [06_Cart_Checkout_Address.md](06_Cart_Checkout_Address.md) | ✅ Complete | Flat ₹150 shipping final? |
| 07 | Payments (PhonePe / COD), invoices, refunds, credit notes | [07_Payments_Invoices_Refunds.md](07_Payments_Invoices_Refunds.md) | ✅ Complete | COD offered? ₹50 COD charge on policy page |
| 08 | Orders, in-store orders, cancellation, fulfilment | [08_Orders_Fulfilment.md](08_Orders_Fulfilment.md) | ✅ Complete | CR1 "dispatch later" not built |
| 09 | Logistics: Ekart and Shipmozo | [09_Logistics_Ekart_Shipmozo.md](09_Logistics_Ekart_Shipmozo.md) | ✅ Complete | FIX-165 / 166 SIT test pending |
| 10 | Returns, replacement, RTO | [10_Returns_Replacement_RTO.md](10_Returns_Replacement_RTO.md) | ✅ Complete (master: Return Plan) | Reverse courier selection rule |
| 11 | Amazon marketplace | [11_Amazon_Marketplace.md](11_Amazon_Marketplace.md) | ✅ Complete (master: Amazon_Master) | Mapping in Prod, schedulers, secrets |
| 12 | Storefront content, home rails, ratings / reviews | [12_Storefront_Content_Ratings.md](12_Storefront_Content_Ratings.md) | ⚠️ From code only | Review moderation; one rating per line? |
| 13 | Notifications: push, email, SMS | [13_Notifications.md](13_Notifications.md) | ✅ Complete (no SMS notifications; SMS for OTP only, 2026-10-28) | Return-status email; schedule for campaigns; opt-out |
| 14 | Analytics, dashboard, Customer 360 | [14_Analytics_Dashboard_Customers.md](14_Analytics_Dashboard_Customers.md) | ⚠️ From code only | **Reports list**; metric formulas |
| 15 | E-commerce web | [15_Ecom_Web.md](15_Ecom_Web.md) | ✅ Complete | SEO / tracking / accessibility not specified |
| 16 | Mobile app | [16_Mobile_App.md](16_Mobile_App.md) | ✅ Complete | Store release readiness |
| 17 | File and document service | [17_File_Service.md](17_File_Service.md) | ⚠️ From code only | **Most upload routes have no auth** |
| 18 | Inventory admin web app: route map, menu, permission per screen, shared UI rules | [18_Inventory_Admin.md](18_Inventory_Admin.md) | ✅ Complete (from code) | RTO menu removed; return screens unguarded; 401 logout without refresh |
| 20 | **Channel fulfilment flows:** Ekart, Shipmozo and Manual, step by step with courier status mapping, cancel / re-ship / RTO; used by Nivaana orders and Amazon Self Ship | [20_Channel_Fulfilment_Flows.md](20_Channel_Fulfilment_Flows.md) | ✅ Complete (traced in code) | No Ekart scheduler; manual couriers have no tracking sync |
| 21 | **Amazon end-to-end flow:** connect, listings, mapping, stock sync, orders, FBA / Easy Ship / Self Ship, returns, schedulers | [21_Amazon_End_to_End_Flow.md](21_Amazon_End_to_End_Flow.md) | ✅ Complete (traced in code + Amazon master) | Mapping in Prod; schedulers; auto stock push |
| 19 | **End-to-end flows:** Buy-to-Stock, Order-to-Delivery, cancel / return / RTO, in-store, Amazon, with stock allocation and quantity changes per step | [19_End_to_End_Flows.md](19_End_to_End_Flows.md) | ✅ Complete (traced in code) | **Available-qty formula differs in the payment path** |

✅ Complete = requirements written and backed by an existing business decision or plan. ⚠️ From code only = written from what the system does today; needs BA sign-off.

## Cross-module rules (apply everywhere)

- **Single price source:** every discount comes from the backend V2 promotion engine. Admin, web and mobile show the same breakdown.
- **Tax:** HSN and GST are mandatory on every product and are snapshotted on every order line. Nothing ships or invoices without them.
- **Stock:** available = e-com published − ordered − locked, per platform. Stock edits recount; order flows own ordered / locked quantities.
- **Customer data:** a customer sees only their own orders, returns and payments (404 otherwise).
- **Scheduled work:** runs on GCP Cloud Scheduler endpoints with a secret header, not in-process cron (Shipmozo, Amazon).
- **Release:** every migration, script or env change gets a row in `docs/RELEASE_SCRIPTS_CHECKLIST.md`. Frontend deploys pass the deploy guard.

## Questions for the BA (collected from all modules)

1. ~~**Purchasing (04):** approvals, PO statuses, goods receipt.~~ **Answered 2026-10-28:** keep the current flow, no change.
2. ~~**Notifications (13):** which events go to push, email or SMS.~~ **Answered 2026-10-28:** no SMS notifications; SMS is only for OTP, and OTP goes only by SMS. Still open: return-status email, customer opt-out.
3. **Reports (14):** which reports and exports are needed, and the formulas for sales velocity and supply chain.
4. **COD (07):** is COD offered, on which channels, and is the ₹50 charge real?
5. **Shipping (06):** is the flat ₹150 final, or should it depend on weight / zone?
6. **Ratings (12):** moderation before publishing? one rating per order line?
7. **Returns (10):** reverse pickup courier: the same as forward, or the admin's choice?
8. **In-store (08):** is the CR1 "dispatch later" mode still needed?
9. **Inventory access (18):** should the menu hide items the user cannot open? Should `/register` stay public? Should RTO Operations be back in the menu?
10. **Retired features:** service tickets, `revoinvoice`, `servicecostestimation`, `pricing_markup`, `userhierarchy`, Flipkart platform value. Keep or remove?

## Related documents

- Fix and decision log: `docs/Fix_After_Sep30/Master.md`
- Parked work: `docs/Future_Plans.md` (PLAN-xx)
- Amazon: `docs/Amazon/Amazon_Master.md` (AMZ-PLAN-xx)
- Returns: `Nivaana Return & Replacement Plan - Updated.md`
- Code review tracker: `docs/application-review/MASTER_REVIEW.md` (1 of 17 areas done)
- Deployment: `docs/SIT_UAT_PROD_DEPLOYMENT_RUNBOOK.md`, `docs/RELEASE_SCRIPTS_CHECKLIST.md`

## Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-27 | 1.0 | First full set: 17 module files built from code and Master.md up to FIX-2026-10-27-167. |
| 2026-10-27 | 1.1 | Added 18_Inventory_Admin.md (route map, menu, permission per screen, shared UI rules). |
| 2026-10-28 | 1.5 | Added 20_Channel_Fulfilment_Flows.md (Ekart / Shipmozo / Manual, incl. Amazon Self Ship) and 21_Amazon_End_to_End_Flow.md. |
| 2026-10-28 | 1.4 | Decisions recorded: purchasing keeps its current flow (04 PUR-16 – PUR-20; 19 Part A); no SMS notifications, SMS only for OTP and OTP only by SMS (13 NTF-10 and channel matrix; 01 ACC-04). Modules 04 and 13 marked complete. |
| 2026-10-27 | 1.3 | Checked quantity logic against the PhonePe guides (2025). Corrected INV-13/14/15, CRT-15, PAY-02 and the 19 B3–B4 rows; added "Older payment documents vs current code" to 19. |
| 2026-10-27 | 1.2 | Added 19_End_to_End_Flows.md. Corrected INV-16 (stock becomes sold at Ready for Dispatch, not dispatch) and added INV-17 (formula defect). Expanded ORD-07 with stock allocation rules. |
