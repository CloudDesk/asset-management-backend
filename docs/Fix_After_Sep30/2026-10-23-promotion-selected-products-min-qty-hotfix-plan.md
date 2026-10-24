# Promotion — Selected Products Minimum Quantity Added Up (Hotfix Plan)

**ID:** FIX-2026-10-23-160
**Date:** 2026-10-23
**Builds on:** PLAN-2026-10-15-116 (minimum quantity and type priority), FIX-2026-10-15-118 (several categories / subcategories added up)
**Status:** 🟡 Implemented on `Hotfix/promo-selected-products-min-qty` (backend, admin) / local verified on SIT DB / not committed yet.
**Release path:** hotfix branch from `PROD` (the code is already live), not through `DEV-NEW` → `SIT` → `UAT` (those carry unreleased Amazon work).

---

## 1. Issue (found on UAT)

Promotion set up in admin (Edit Promotion → Percentage Off Selected Products):

| Field | Value |
|---|---|
| Selected products | NIVAANA Smart Scent Waterless Aroma Diffuser; AUORA Wardrobe Fragrance – Cool Aqua; AUORA Wardrobe Fragrance – Cherry Blossom (3 selected) |
| Minimum quantity | 2 |
| Discount | 25% |
| Maximum discount | none |

Other active offers: FESTIVE SALE 10% OFF (Percent of entire cart value), NIV100 (₹100 off cart), Free Shipping over ₹500.

UAT cart: Diffuser × 1 (₹2,800) + Cool Aqua × 1 (₹70) = ₹2,870.

| | UAT shows | Expected by the user |
|---|---|---|
| 25% selected products | not applied; Cool Aqua row: "Add 1 more to get 25% off this item instead of 10%" | applied: 25% of ₹2,870 = ₹717.50 |
| FESTIVE 10% | ₹287 | not applied (every item has a product offer) |
| NIV100 | ₹100 | ₹100 |
| Promotions total | ₹387 | ₹817.50 |
| Total | ₹2,483 | ₹2,052.50 |

Expected rule from the user: among the selected products, **any combination** whose total quantity reaches the minimum qualifies — 2 different products × 1, or one product × 2.

## 2. Root cause

Not a calculation bug: UAT follows the PLAN-116 rule exactly.

- PLAN-116 Q&A row 19: *"Selected products: total of selected products, or each product on its own? → Each product's own quantity."* Test cases TC-Q05 / TC-Q06 check this.
- `asset-management-backend/src/services/promotion-v2-engine.ts`:
  - `summedQuantityFacet()` returns `undefined` for a `PRODUCT` scope, so the minimum is checked in a per-product loop (`quantities` map → `missed(quantity, [productId])` per product).
  - Category / subcategory return `CATEGORY` / `SUBCATEGORY` and are added up across all selected values (FIX-118).
- Admin help text says the same: "Each selected product must have at least this quantity in the cart." (`asset_management_frontend_aromazen/src/components/promotions/PromotionRuleBuilderV2.tsx`).

So the requirement (PLAN-116 decision) changes; the code follows it.

## 3. Analysis — the same cart on all three scopes (current code)

Engine run locally with the UAT cart, 25% / minimum 2 + FESTIVE 10% + NIV100 (scratch script, not committed):

| Cart | Selected products | Category | Subcategory |
|---|---|---|---|
| Diffuser × 1 + Aqua × 1 | 10% ₹287 + ₹100 = **₹387** | 25% ₹717.50 + ₹100 = **₹817.50** | **₹817.50** |
| Diffuser × 2 + Aqua × 1 | 25% on Diffuser ₹1,400 + 10% on Aqua ₹7 + ₹100 = **₹1,507** | 25% on all ₹1,417.50 + ₹100 = **₹1,517.50** | **₹1,517.50** |
| Diffuser × 1 + Aqua × 2 | 25% on Aqua ₹35 + 10% on Diffuser ₹280 + ₹100 = **₹415** | ₹735 + ₹100 = **₹835** | **₹835** |

- **Category / subcategory:** already add up quantity across all selected values — work as the user expects. No change.
- **Selected products:** only a single product reaching the minimum on its own qualifies; other selected products in the cart get the cart percent instead.

## 4. Issues

| # | Issue | Where | Cause |
|---|---|---|---|
| 1 | Selected products: a combination of different selected products (Diffuser × 1 + Aqua × 1) does not meet the minimum | Backend engine | Per-product minimum (PLAN-116 rule) |
| 2 | Selected products: when one product meets the minimum (Diffuser × 2 + Aqua × 1), the other selected products do not get the offer (Aqua gets 10% instead of 25%) | Backend engine | Same cause as #1 |
| 3 | "Add 1 more" cart-row hint shows only on Cool Aqua, not on the Diffuser row | Ecom `Nivaana-Ecom-Web/src/lib/cartPromotions.ts` `lockedMinimumQuantityOffers` (likely also mobile) | Per-product check returns one `MINIMUM_QUANTITY_NOT_MET` entry per product; the web keys missed offers by promotion id in a `Map`, so the last entry wins. Not confirmed against UAT data. |
| 4 | Admin help text describes the old rule | Admin `PromotionRuleBuilderV2.tsx` | Text from PLAN-116 |

Issues 1 and 2 have one root cause and one fix. Issue 3 goes away with the same fix (one missed entry per promotion), so no web / mobile code change is needed.

## 5. Decision needed

| Question | Current (PLAN-116) | Proposed |
|---|---|---|
| Selected products: total of selected products, or each product on its own? | Each product on its own | **Total quantity of all selected products in the cart** (same as category / subcategory) |

Recommendation: proposed rule. The admin picks several products and a minimum, which customers read as "any N from these"; all three scopes then behave the same.

⚠️ Behaviour change: once deployed, **every live Percentage Off / Fixed Amount Off Selected Products promotion** with minimum ≥ 2 counts the total quantity. Tell the client before the Prod deploy.

## 6. Fix scope (after confirmation)

| Repo | File | Change |
|---|---|---|
| `asset-management-backend` | `src/services/promotion-v2-engine.ts` | `summedQuantityFacet()` returns `PRODUCT` for a product scope, so the minimum is checked on the total quantity of selected products; every selected item in the cart gets the offer once met. One locked entry per promotion; `scope_name: 'eligible'` when more than one product is selected ("Add 1 more eligible item to get 25% off"); one selected product keeps "Add 1 more to get 25% off this item". Comments updated. |
| `asset-management-backend` | `tests/promotionV2Engine.test.ts` | TC-Q05 / TC-Q06 new expected results; TC-Q17 / Q24 / Q35 new totals; TC-Q18 / Q19 carts changed to keep what they test (section 6a); per-product-metric test also adds up products; new: UAT cart (Diffuser × 1 + Aqua × 1 → 25%, cart percent nothing; 2 + 1 → 25% on all) and one locked entry per promotion (`scope_name: 'eligible'`; one selected product → no scope name). |
| `asset_management_frontend_aromazen` | `src/components/promotions/PromotionRuleBuilderV2.tsx` | Help text: "Total quantity of the selected products in the cart." |
| `asset-management-backend` | `docs/Fix_After_Sep30/2026-10-15-promotion-min-quantity-and-type-priority-plan.md` | Q&A row 19 and TC-Q05 / Q06 marked changed by FIX-160. |
| — | `Nivaana-Ecom-Web`, `Vibrant-Life-mobile-app` | No change (they read `scope_name` from the backend). |

### 6a. Side-effects of the priority rule (found by the tests)

Priority (Fixed Amount Off Selected Products → Percentage Off Selected Products → Categories → Subcategories, "even if smaller", PLAN-116) is unchanged. Because more items now qualify for selected-products promotions, they now take items that used to go to a category / subcategory promotion:

| Cart (test data) | Before | After | Note |
|---|---|---|---|
| Diffuser A × 2 + B × 1 + C × 1; 20% selected A, B; 30% Diffusers category; 40% Reed subcategory | A 20% ₹400 + B, C 30% ₹420 = **₹820** | A, B 20% ₹560 + C 30% ₹180 = **₹740** | B moves to the lower % because selected products rank higher |
| Diffuser A × 2 + B × 1; ₹100 off selected A, B; 30% Diffusers category | ₹100 + B 30% ₹240 = **₹340** | ₹100 on A and B = **₹100** | Fixed amount is one amount for all qualifying items |
| Diffuser A × 1 + B × 1; 20% selected A, B; 30% Diffusers category | 30% ₹540 | 20% ₹360 | Selected products now qualify and win by priority |

Only when a selected-products promotion and a category / subcategory promotion overlap on the same items. Tell the client together with the main change.

No migration, no release script, no env change (row in `docs/RELEASE_SCRIPTS_CHECKLIST.md`: "no scripts").

Unchanged: fixed amount off selected products stays one amount per promotion; maximum discount still capped once; type priority (Fixed Amount Off Selected Products → Percentage Off Selected Products → Categories → Subcategories) unchanged; minimum is still checked on the whole cart (PLAN-116).

## 7. Test cases

| ID | Cart (selected: Diffuser, Cool Aqua, Cherry Blossom; 25%, min 2) + FESTIVE 10% + NIV100 | Expected after fix |
|---|---|---|
| TC-H01 | Diffuser × 1 + Aqua × 1 | 25% ₹717.50 + ₹100; FESTIVE not applied |
| TC-H02 | Diffuser × 2 + Aqua × 1 | 25% on all ₹1,417.50 + ₹100 |
| TC-H03 | Diffuser × 1 + Aqua × 2 | 25% ₹735 + ₹100 |
| TC-H04 | Diffuser × 1 only | 25% locked; Diffuser row "Add 1 more eligible item to get 25% off instead of 10%"; FESTIVE 10% ₹280 + ₹100 |
| TC-H05 | Aqua × 1 + Cherry Blossom × 1 | 25% ₹35 + ₹100 |
| TC-H06 | Diffuser × 1 + a non-selected product × 1 | 25% locked (only 1 selected item); non-selected item not counted |
| TC-H07 | Fixed Amount Off Selected Products ₹100, min 2: Diffuser × 1 + Aqua × 1 | ₹100 once (not per product) |
| TC-H08 | Category and subcategory promotions, same carts as TC-H01–H03 | Unchanged (already added up) |
| TC-H09 | Selected products with min 1 | Unchanged: every selected product gets the percentage |
| TC-H10 | Admin Edit Promotion → Selected products | New help text shown |

## 8. Branch and release plan

Branch state checked 2026-10-23 (`git fetch`):

- `PROD` has 4 commits that `UAT` lacks in both repos (backend: `.env.prod`, Railway backup JSON, merges; admin: FIX-121 Shipmozo in Prod Inventory, `integrationFeatures.ts`). `UAT` has nothing that `PROD` lacks. So the hotfix is cut from **`PROD`** (what is live), not `UAT`.
- PLAN-116 / FIX-118 code is on `PROD` and `UAT`.
- `promotion-v2-engine.ts`, `promotionV2Engine.test.ts` (backend) and `PromotionRuleBuilderV2.tsx` (admin) are **identical** on `PROD`, `UAT`, `SIT` and `DEV-NEW`, so the cherry-picks apply without conflicts. The Amazon work on `DEV-NEW` / `SIT` does not touch these files.

Steps (both repos, same order):

1. Create `Hotfix/promo-selected-products-min-qty` from `origin/PROD` (backend and admin).
2. Fix and test locally with the local env. **Do not commit `.env*` or debug files** — the commits must hold only code, tests and docs, because they are cherry-picked up to Prod.
3. Commit with the message prefix `FIX-2026-10-23-160` (same message on every branch, easy to track). Keep **code + tests** and **docs** in separate commits: `Master.md` on `DEV-NEW` / `SIT` already has FIX-121 – FIX-159 (not on `PROD`), so the docs commit will conflict there — resolve by keeping both sides (FIX-160 row after the last row, log at the end). The code commit applies cleanly.
4. Cherry-pick to **`DEV-NEW`** and **`SIT`**. DEV-NEW is needed too, or the next DEV-NEW → SIT merge leaves DEV-NEW on the old rule. Deploy SIT, test TC-H01–H10. (SIT has Amazon code, so this is a basic check.)
5. Cherry-pick to **`UAT`**, deploy, test TC-H01–H10 on UAT data. UAT = Prod code, so this is the real sign-off.
6. After UAT sign-off and client informed, cherry-pick to **`PROD`** and push. ⚠️ Prod push auto-deploys.
7. Later SIT → UAT → Prod merges: the same change already exists on each branch, so no conflicts expected. Cherry-picks get new commit hashes on each branch; that is normal.

Do not merge `PROD` / `UAT` into `DEV-NEW` (it would bring `.env.prod` and Prod-only changes); cherry-pick only the hotfix commits.

## 9. Status

| Step | Status |
|---|---|
| UAT issue analysed, root cause found | ✅ 2026-10-23 |
| Client / BA confirmation of the new rule | ✅ Go-ahead from the user 2026-10-24 |
| Hotfix branch from PROD, code + tests | ✅ 2026-10-24 — backend, admin (Web: no change; mobile: no change, `expo_rn_migrations_v2`) |
| Local test | ✅ 2026-10-24 (section 10) |
| Commit | ⏳ |
| DEV-NEW + SIT cherry-pick, SIT test | ⏳ |
| UAT cherry-pick, UAT test | ⏳ |
| PROD cherry-pick, deploy | ⏳ |

## 10. Verification (2026-10-24, local, SIT DB `assetmanagement_dev`)

- Backend `npm test`: 456 / 457. The one failure, `productTaxSnapshot.test.ts` "product creation requires HSN and GST fields", fails on `PROD` without this change too (not related). `promotionV2Engine.test.ts` 112 / 112. `tsc` clean.
- Admin: `tsc` 0 errors, eslint clean on `PromotionRuleBuilderV2.tsx`.
- Web / mobile hint helpers (`cartPromotions.ts`, `promotionOfferEligibility.ts`) run on the new locked entry: Diffuser row "Add 1 more eligible item to get 25% off instead of 10%", locked card "Add 1 more eligible item to get 25% off."; one selected product keeps "Add 1 more to get 25% off this item instead of 10%". No code change needed.
- SIT DB, real products through the service's cart loader with the real active cart promotions (FESTIVE SALES 10% OFF #94, NIV100 #77) and an in-memory copy of the UAT promotion (25%, min 2, products 90 Home Diffuser, 22 Cool Aqua, 21 Cherry Blossom; nothing written to the DB):

| Cart | Result |
|---|---|
| Diffuser × 1 (₹1,800) + Cool Aqua × 1 (₹60) | 25% ₹465 + NIV100 ₹100; FESTIVE not applied |
| Diffuser × 2 + Cool Aqua × 1 | 25% ₹915 + NIV100 ₹100 |
| Cool Aqua × 1 + Cherry Blossom × 1 | 25% ₹30 + NIV100 ₹90 |
| Diffuser × 1 only | FESTIVE ₹180 + NIV100 ₹100; 25% locked, "eligible", remaining 1 |

- Real `calculate` (preview only, not saved) with the live SIT promotions: Home Diffuser × 1 → #96 ₹450 + #77 ₹100; Car Diffuser × 1 + Home Diffuser × 1 → #95 ₹500 + #96 ₹450 + #77 ₹100 (unchanged).
- Not checked in the browser (admin form text, web / mobile cart) — do on SIT after deploy (TC-H01 – H10).
