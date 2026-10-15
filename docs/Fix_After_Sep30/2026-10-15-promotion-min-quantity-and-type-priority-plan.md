# Promotion Minimum Quantity & Type Priority – Implementation Plan

**Date:** 2026-10-15 · **Owner:** Suresh · **ID:** PLAN-2026-10-15-116 · **Status:** Built and committed 2026-10-15 (DEV-NEW; mobile expo_rn_migrations_v2); web checked in dev; SIT pending. See Master.md PLAN-2026-10-15-116. Builds on PLAN-2026-10-12-107.

## Requirements

1. **Minimum quantity** is required for Percentage Off Categories, Percentage Off Subcategories, Percentage Off Selected Products and Fixed Amount Off Selected Products. Default is 1.
2. **Quantity check.** If the minimum is not met, the promotion is skipped.
   - **Selected products** (percentage and fixed amount): each product's own quantity must reach the minimum. Only the products that reach it get the promotion.
   - **Category:** the quantity of all cart items in that category is added up. Example: Incense minimum 2, Rose Incense × 1 + Jasmine Incense × 1 = 2, so the promotion applies.
   - **Subcategory:** the same as category, added up within the subcategory.
3. **Priority** when an item matches more than one promotion:
   Fixed Amount Off Selected Products → Percentage Off Selected Products → Percentage Off Categories → Percentage Off Subcategories → Percent of entire cart value → Fixed amount of entire cart value.

## BA answers (2026-10-15)

| # | Question | Answer |
| --- | --- | --- |
| 1 | Selected products: total of selected products, or each product on its own? | Each product's own quantity. Products that reach the minimum get the promotion. |
| 2 | Category: add up matching items? Several categories in one promotion? | Add up all items of that category in the cart. With several categories / subcategories in one promotion, all their items are added up together (changed 2026-10-15 after dev test: Havan Cups 1 + Dhoop Sticks 1 = 2). |
| 3 | Subcategory | Same as category. |
| 4 | Subcategory ranked after category | Follow the priority order. |
| 5 | Higher priority wins on the same item even if it saves less? | Yes, follow the priority order. |
| 6 | Same type twice on one item | Should not happen. If it does, follow the order (same type → bigger saving, as today). |
| 7 | Fixed amount of entire cart value | On the full cart value, as today. |
| 8 | Default minimum quantity | 1. Existing promotions keep 1. |
| 9 | Minimum quantity on the cart types too? | No. Only the four product types (confirmed with BA, 2026-10-15). Cart types and Free Shipping are unchanged. |

**Decisions made for this plan**

- **Cart types in the order.** The order's "Percentage of Cart → Percentage of Entire Cart Value" is read as Percent of entire cart value → Fixed amount of entire cart value. This is how it works today (PLAN-107), so there is no change for cart types.
- **Minimum quantity is checked on the whole cart.** An item taken by a higher-priority promotion still counts towards a lower-priority promotion's minimum. Example: Diffuser A × 2 gets Fixed Amount Off Selected Products, and Diffuser B × 1 still gets the Diffusers category promotion because the category has 3 items.
- **Maximum discount and fixed amount** stay one limit for the whole promotion, across all its qualifying items and categories (PLAN-107).
- **Free Shipping** is not in the order. It only touches shipping.

## Confirmed before build (2026-10-15)

**A. Show "Add N more" to the customer when the minimum is not met**

- Today the backend already sends the reason and the missing quantity (`MINIMUM_QUANTITY_NOT_MET`, `details.remaining`) in `/v2/promotions/calculate` and in the eligibility API (`ineligible_promotions`).
- **But web and mobile hide these offers.** Web Cart / Checkout drop them from the offer list and "View all" (`v2MinimumRejectedPromotionIds` in `Cart.tsx` ~1293 and `Checkout.tsx` ~899). Mobile drops them in `applyV2Eligibility` (`promotionOfferEligibility.ts`). The "Add 1 more eligible item(s)" text only appears after the customer taps Apply. Mobile `PromotionV2Panel` has a "Locked offer" view but is not used on the cart screen.
- **Needed:** an offer whose only problem is the minimum quantity stays visible as a locked offer with: **"Add 1 more item to get 25% off"** (amount offers: "to get ₹100 off"). With a category / subcategory it names it: "Add 1 more Incense item to get 25% off". The count comes from the backend (`remaining`), already added up per category.
- The backend adds `benefit_type`, `benefit_value` and `scope_name` to the rejection `details`, so web and mobile build the same text without extra calls.
- Offers rejected for other reasons (audience, channel, usage limit, expired) stay hidden as today.

**B. Stackable / non-stackable does not change the result**

- Backend: between two product promotions, `candidatesConflict` already ignores Stackable; the new priority check runs **before** the best-saving comparison, so Stackable or "best saving" can never put a lower-priority promotion on an item. Cart promotions are added after the product promotions and never compete with them (PLAN-107, TC-N08).
- Stackable still matters only for the old types outside the seven (BOGO, Free Product). No change there.
- **Client fix:** web shows "Can't be combined with other offers. We'll keep whichever saves you more." on non-stackable click-to-apply offers (`offerCombinationNote` in `cartPromotions.ts`). For the seven types this is now wrong; hide the note for them (same check on mobile if shown).
- Tests: each priority case (TC-Q14–Q21) runs twice, Stackable on and off, and gives the same result.

**C. Percent of entire cart value when a product promotion misses its minimum**

- Rule from PLAN-107 stays: an item gets Percent of entire cart value **only when no product / category / subcategory promotion is actually applied to it**. Minimum quantity is part of "applied": if the item's promotion misses its minimum, the item gets Percent of entire cart value.
- Confirmed in code: the cart percent skips only items that the selected product promotions really discount (`productLineKeys` from the winning candidates), so a skipped promotion never blocks the cart percent. The new summed category check and the priority check keep this.
- Also covered: an item that loses on priority is still discounted by the higher-priority promotion, so it does not get the cart percent.

| ID | Scenario | Cart | Active | Expected |
| --- | --- | --- | --- | --- |
| TC-Q29 | Locked offer text, category | Rose × 1 | Q3 | Offer visible as locked: "Add 1 more Incense item to get 25% off". No discount. |
| TC-Q30 | Locked offer text, products | Diffuser A × 1 | Q1 | "Add 1 more item to get ₹100 off". |
| TC-Q31 | Locked offer becomes applied | Rose × 1 → Jasmine added | Q3 | Locked text disappears, ₹75 applied. |
| TC-Q32 | Locked offer on mobile | Rose × 1 | Q3 | Same text as web. |
| TC-Q33 | Minimum missed, cart percent applies | Rose × 1, Candle × 1 | Q3, Q6 | Q3 locked "Add 1 more". Q6 10% of ₹700 = ₹70 (Rose included). |
| TC-Q34 | Minimum met, cart percent skips those items | Rose × 2, Candle × 1 | Q3, Q6 | Rose ₹100. Q6 on Candle only = ₹50. |
| TC-Q35 | Stackable off on all promotions | TC-Q17 cart | Q2, Q5, Q4 (Stackable off) | Same ₹820 as Stackable on. |
| TC-Q36 | No "keep whichever saves more" note | Cart page | Q1–Q5 click-to-apply, Stackable off | Note not shown. |
| TC-Q37 | Cart-row hint, category | Rose × 2 (Incense min 3, 20%), cart 10% active | Q3-like, Q6 | Rose row: "Add 1 more Incense & Rituals item to get 20% off instead of 10%". Gone at qty 3. |
| TC-Q38 | Cart-row hint, products | Diffuser A × 1 | Q2 | Row: "Add 1 more to get 20% off this item". Fixed: "Add 1 more to get ₹100 off". |
| TC-Q39 | Hint hidden by higher priority | Item already has a Selected Products offer applied; category offer locked | Q2 applied, Q5 locked | No hint on that row. |

## How it works today vs needed

| Area | Today (PLAN-107) | Needed |
| --- | --- | --- |
| Minimum quantity field in admin | The simple setup screen for the four types has no quantity field. Every promotion is saved with 1. | Required "Minimum quantity" field, default 1. |
| Selected products minimum | Each product on its own | No change |
| Category / subcategory minimum | Each product on its own (TC-P04: Diffuser A × 1 + Diffuser B × 1 does not meet 2) | Added up per category / subcategory |
| Two product promotions on the same item | Bigger saving wins (TC-N13) | Higher-priority type wins; same type → bigger saving |
| Cart promotions | Percent on items without a product promotion, fixed on full cart | No change |
| Web / mobile | Show the backend's "Add N more eligible item(s)" | No change. The number now comes from the added-up quantity. |

## Calculation order for one cart

1. **Check minimums.** For each product promotion, find its qualifying items: for selected products, each product that reaches the minimum on its own quantity; for category / subcategory, every item in a category / subcategory whose added-up quantity reaches the minimum. Promotions with no qualifying items are skipped with `MINIMUM_QUANTITY_NOT_MET`.
2. **Assign items by priority.** Each item goes to the qualifying promotion with the highest priority: Fixed Amount Off Selected Products (1), Percentage Off Selected Products (2), Percentage Off Categories (3), Percentage Off Subcategories (4). Between two promotions of the same type, the bigger saving wins.
3. **Percent of entire cart value** on the items with no product promotion (as today).
4. **Fixed amount of entire cart value** on the full cart value (as today).
5. **Limits** as today: total never above cart value, no item below ₹0, shipping only reduced by Free Shipping.

## Implementation changes

**Backend (`asset-management-backend`)**

| File | Change |
| --- | --- |
| `src/utils/promotionGroup.ts` | New `getProductPromotionRank(promotion)`: 1 fixed + PRODUCT facet, 2 percent + PRODUCT facet, 3 CATEGORY facet, 4 SUBCATEGORY facet. Uses the scope facet and benefit type, so legacy records get a rank too. Undefined for non-PRODUCT groups. |
| `src/services/promotion-v2-engine.ts` | Add `productRank` to `PromotionCampaign`. In `collect`, keep the per-product minimum check only for PRODUCT-facet promotions; for CATEGORY / SUBCATEGORY add up quantity per category / subcategory (whatever the saved `aggregation`), report the missing quantity per category, and put all qualifying items in one bucket so the fixed amount / maximum discount stays one per promotion. Before `optimise`, drop a product candidate when a higher-ranked product candidate uses the same unit. Same rank keeps today's bigger-saving choice. |
| `src/services/promotions-v2.service.ts` | Set `productRank` in `activeCampaigns` and `simulate`. In `checkEligibility`, evaluate a product promotion card with the higher-ranked product promotions present, so a card that loses on priority does not show a saving. Server-side validation: minimum quantity ≥ 1 for the four types (missing → 1). |
| `tests/promotionV2Engine.test.ts` | Update TC-P04 (category now adds up) and TC-N13 (priority instead of bigger saving). Add the cases below. |

**Admin (`asset_management_frontend_aromazen`)**

| File | Change |
| --- | --- |
| `src/components/promotions/PromotionRuleBuilderV2.tsx` (simple setup, `simpleTargetedDiscount`) | Required "Minimum quantity" field, default 1, whole numbers ≥ 1. Help text: products "Each selected product must have at least this quantity"; category / subcategory "Total quantity of items in the category / subcategory". |
| `src/components/promotions/PromotionForm.tsx` (~line 2088) | Message "Minimum quantity must be at least 1." |
| Promotion list / view | Show the minimum quantity where the rule is summarised (if shown). |

**Backend, extra for the locked offer text**

- `promotion-v2-engine.ts`: add `benefit_type`, `benefit_value` and `scope_name` (category / subcategory name, when one) to `MINIMUM_QUANTITY_NOT_MET` details.

**Storefront (`Nivaana-Ecom-Web`)**

- No calculation change.
- `Cart.tsx` / `Checkout.tsx`: keep minimum-quantity offers in the list as locked offers instead of dropping them.
- `cartPromotions.ts`: locked text "Add N more [Incense] item(s) to get X off"; hide `offerCombinationNote` for the seven types.

**Mobile (`Vibrant-Life-mobile-app`, `expo_rn_migrations_v2`)**

- `promotionOfferEligibility.ts`: keep minimum-quantity offers from `ineligible_promotions` as locked, same text as web.
- Cart / Checkout offer list shows the locked state.

**Process**

- Commit to `DEV-NEW` only. Leave out debug and env files.
- Log in `docs/Fix_After_Sep30/Master.md` under PLAN-2026-10-15-116.
- No migration and no release script. Existing promotions already have minimum quantity 1.

## Test cases

**Test data**

| Product | Category | Subcategory | Price |
| --- | --- | --- | --- |
| Diffuser A | Diffusers | Electric | ₹1,000 |
| Diffuser B | Diffusers | Reed | ₹800 |
| Diffuser C | Diffusers | Reed | ₹600 |
| Rose Incense | Incense | Sticks | ₹200 |
| Jasmine Incense | Incense | Cones | ₹100 |
| Candle | Candles | Jar | ₹500 |

| ID | Type | Setup |
| --- | --- | --- |
| Q1 | Fixed Amount Off Selected Products | ₹100 off Diffuser A, Diffuser B, minimum 2 |
| Q2 | Percentage Off Selected Products | 20% off Diffuser A, Diffuser B, minimum 2 |
| Q3 | Percentage Off Categories | 25% off Incense, minimum 2 |
| Q4 | Percentage Off Subcategories | 40% off Reed, minimum 2 |
| Q5 | Percentage Off Categories | 30% off Diffusers, minimum 2 |
| Q6 | Percent of entire cart value | 10% |
| Q7 | Fixed amount of entire cart value | ₹100 |
| Q8 | Percentage Off Categories | 25% off Incense and Candles, minimum 2 |
| Q9 | Percentage Off Categories | 10% off Diffusers, minimum 1 |
| Q10 | Percentage Off Categories | 30% off Diffusers, minimum 2, maximum discount ₹200 |

**Minimum quantity**

| ID | Scenario | Cart | Active | Expected |
| --- | --- | --- | --- | --- |
| TC-Q01 | Category adds up different products | Rose × 1, Jasmine × 1 | Q3 | Incense qty 2. 25% of ₹300 = ₹75. |
| TC-Q02 | Category below minimum | Rose × 1, Candle × 1 | Q3, Q6 | Q3 skipped, "Add 1 more eligible item(s)". Q6 10% of ₹700 = ₹70. |
| TC-Q03 | Subcategory adds up | Diffuser B × 1, Diffuser C × 1 | Q4 | Reed qty 2. 40% of ₹1,400 = ₹560. |
| TC-Q04 | Subcategory counts only its own items | Diffuser A × 1, Diffuser B × 1 | Q4 | Reed qty 1. Q4 skipped, "Add 1 more". |
| TC-Q05 | Selected products: each product on its own | Diffuser A × 1, Diffuser B × 1 | Q2, Q6 | Neither reaches 2. Q2 skipped. Q6 10% of ₹1,800 = ₹180. |
| TC-Q06 | Selected products: one reaches the minimum | Diffuser A × 2, Diffuser B × 1 | Q2, Q6 | Diffuser A 20% = ₹400. Q6 on Diffuser B = ₹80. Total ₹480. |
| TC-Q07 | Fixed amount on two qualifying products | Diffuser A × 2, Diffuser B × 2 | Q1 | ₹100 once, shared (₹55.56 / ₹44.44). |
| TC-Q08 | Several categories in one promotion are added up together | Rose × 1, Candle × 1 | Q8 | Total 2 meets the minimum: 25% of ₹700 = ₹175. |
| TC-Q09 | Several categories, total met | Rose × 2, Candle × 1 | Q8 | Total 3: 25% on every matching item, ₹225. |
| TC-Q10 | Same product on two cart lines | Rose × 1 + Rose × 1 (two lines) | Q3 | Qty 2. ₹100. |
| TC-Q11 | Quantity change | Rose × 1, then Jasmine added | Q3 | Before: skipped. After: ₹75. |
| TC-Q12 | Maximum discount across the category | Diffuser A × 1, Diffuser B × 1 | Q10 | 30% of ₹1,800 = ₹540, limited to ₹200 for the promotion. |
| TC-Q13 | Updated TC-P04 | Diffuser A × 1, Diffuser B × 1 | P1 (25% Diffusers, min 2), P2 (10% cart) | Diffusers qty 2. P1 ₹450. P2 not applied ("Items in your cart already have their own offer"). |

**Priority**

| ID | Scenario | Cart | Active | Expected |
| --- | --- | --- | --- | --- |
| TC-Q14 | Fixed products beats % products, even if smaller | Diffuser A × 2 | Q1, Q2 | Q1 ₹100. Q2 not applied (would be ₹400). |
| TC-Q15 | % products beats category, even if smaller | Diffuser A × 2 | Q2, Q5 | Q2 ₹400. Q5 not applied (would be ₹600). |
| TC-Q16 | Category beats subcategory, even if smaller | Diffuser B × 1, Diffuser C × 1 | Q5, Q4 | Q5 30% of ₹1,400 = ₹420. Q4 not applied (would be ₹560). |
| TC-Q17 | Mixed: each item goes to its highest-priority promotion | Diffuser A × 2, B × 1, C × 1 | Q2, Q5, Q4 | A: Q2 ₹400. B and C: Q5 ₹420. Q4 not applied. Total ₹820. |
| TC-Q18 | Item taken by higher priority still counts for the minimum | Diffuser A × 2, Diffuser B × 1 | Q1, Q5 | A: Q1 ₹100. Diffusers qty 3 so Q5 qualifies; B: 30% = ₹240. Total ₹340. |
| TC-Q19 | Lower priority applies when higher misses its minimum | Diffuser A × 1, Diffuser B × 1 | Q2, Q5 | Q2 skipped. Q5 30% of ₹1,800 = ₹540. |
| TC-Q20 | Product promotions, then cart promotions | Rose × 2, Candle × 1 | Q3, Q6, Q7 | Rose ₹100. Q6 on Candle = ₹50. Q7 ₹100 on full cart. Total ₹250. |
| TC-Q21 | Same type twice on one item | Diffuser A × 2 | Q5, Q9 | Bigger saving: Q5 ₹600. Q9 not applied. |
| TC-Q22 | Promotion card saving | Diffuser A × 2 | Q1, Q2 | Cart / Checkout card for Q2 shows no saving (Q1 takes the item). Q1 card ₹100. |
| TC-Q23 | Higher priority inactive / expired / other channel | Diffuser A × 2 | Q1 (inactive), Q2 | Q2 ₹400. |
| TC-Q24 | Web and mobile match | TC-Q17 cart | Q2, Q5, Q4 | ₹820 on both. |

**Admin**

| ID | Scenario | Expected |
| --- | --- | --- |
| TC-Q25 | Create any of the four types | Minimum quantity field shown, marked required, default 1. |
| TC-Q26 | Blank, 0 or negative | Save blocked: "Minimum quantity must be at least 1." |
| TC-Q27 | Edit an existing promotion | Loads with 1; saving keeps 1 unless changed. |
| TC-Q28 | Cart types and Free Shipping | No minimum quantity field. |

**Regression:** run all PLAN-107 cases (TC-P01–P19, TC-N01–N19). Only TC-P04 and TC-N13 change expected results (replaced by TC-Q13 and TC-Q14–Q16 / Q21).

## Risks

| Risk | Mitigation |
| --- | --- |
| Category promotions now apply to more carts (added-up quantity) | Before release, run `/v2/promotions/:id/simulate` on sample carts for active category / subcategory promotions with minimum > 1. Today all have 1, so no change for live promotions until admins raise it. |
| A cheaper higher-priority promotion now replaces a bigger one | Expected per BA. Mention in the release note. Only happens when two product promotions overlap. |
| Card saving and final price differ | `checkEligibility` change and TC-Q22. |

## Rollout

1. Build and unit tests on `DEV-NEW` (backend, admin).
2. Dev check on web and mobile with the test data above.
3. SIT, UAT sign-off, prod per `docs/SIT_UAT_PROD_DEPLOYMENT_RUNBOOK.md`. No database script.
