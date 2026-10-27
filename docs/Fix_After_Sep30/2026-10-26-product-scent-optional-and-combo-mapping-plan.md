# Product Form — Scent Optional for Single Products, Combo Mapping Without Scent (Plan)

**ID:** PLAN-2026-10-26-164
**Date:** 2026-10-26
**Status:** 📝 Analysed and agreed / not implemented yet
**Repositories to change:** `asset_management_frontend_aromazen` only (admin / Inventory). Backend, database, Ecom web and mobile app need **no change** (checked, see §5).

---

## 1. Goal

1. **Single product (not a combo):** the **Scent** field (`fragnancetype`) becomes **optional** in every subcategory.
2. **Combo product:**
   - **Subcategory has Scent options** (e.g. Incense Sticks, Wardrobe Fragrance): Scent stays **mandatory**; components are found by Scent as today.
   - **Subcategory has no Scent options** (e.g. Luxury Gifts, Festival Gifts, Wellness Gifts, Fresh Mornings): Scent is **hidden**, and the user maps components with a **product search** (name / PUC, any subcategory). Today these combos cannot be created at all.
3. Every subcategory on the combo list can create a combo end to end.

---

## 2. The problem today

### 2.1 Scent is "conditionally required"

| Situation | Scent today |
|---|---|
| Subcategory **has** Scent options in the picklist (picklist `parent` = subcategory) | **Required** (`*`, Yup `.required`) |
| Subcategory has **no** Scent options | Optional (hidden unless the subcategory is combo-enabled) |
| **Is Combo Pack** ticked | Shown as required (`*`) in every combo subcategory, even when there are no options |

Scent options per subcategory (dev picklist, 2026-10-26):

| Subcategory | Scent options |
|---|---|
| incense_sticks | 13 |
| fragrance_oils | 11 |
| wardrobe_fragrance | 6 |
| air_fresheners | 3 |
| every other subcategory | none |

SIT / UAT / Prod picklists may differ — check before release (§8).

### 2.2 Combo depends fully on Scent

How the form builds a combo today (`ProductForm.tsx:1394-1535`):

1. User ticks **Is Combo Pack**, picks a **Pack** (e.g. Pack of 2) and picks **Scents** equal to the pack count.
2. For each Scent the form calls `GET /v1/products?subcategory=<same subcategory>&fragnancetype=<scent>` and drops combos.
3. Only when scents count = pack count do products load and the **Map Combo Components** popup opens.
4. In the popup the user picks **one product per Scent**, total = pack count; `POST /v1/products/validate-combo` checks them.
5. **Submit** is hidden until components are mapped (`ProductForm.tsx:1650-1655`).

So with no Scent options: nothing to select → no products fetched → no Map link → **no Submit button**. The user is stuck (screenshot case: Gift Collections → Luxury Gifts, Pack of 2, Is Combo Pack ticked, Scent "No options available").

### 2.3 Combo-enabled subcategories (hard-coded)

`ProductForm.tsx:167-180` (`comboSupportedTaxonomyValues`):

| # | Subcategory | Scent options (dev) | Combo works today? |
|---|---|---|---|
| 1 | incense_sticks | ✅ 13 | ✅ Yes |
| 2 | wardrobe_fragrance | ✅ 6 | ✅ Yes |
| 3 | fresh_mornings | ❌ | ❌ Stuck |
| 4 | relaxation_calm | ❌ | ❌ Stuck |
| 5 | dusky_evenings | ❌ | ❌ Stuck |
| 6 | peaceful_nights | ❌ | ❌ Stuck |
| 7 | festival_gifts | ❌ | ❌ Stuck |
| 8 | wellness_gifts | ❌ | ❌ Stuck |
| 9 | luxury_gifts | ❌ | ❌ Stuck |

Also: gift / mood combos are usually a **mix of products from other subcategories** (e.g. 1 incense + 1 wardrobe sachet). The current lookup searches only inside the **same** subcategory, so even with Scent values a Luxury Gifts combo could not find incense products.

### 2.4 Hidden catch in the mapping popup

`ComboComponentMappingModal.tsx:158-205` (`handleProductToggle`) allows **one product per Scent** — selecting a second product with the same Scent unselects the first. Products are grouped by `product.fragnancetype || ''`, so all products **without** a Scent fall in one blank group → only **one** could ever be selected. Search mode must not use this rule.

---

## 3. Agreed behaviour (after the change)

| Case | Scent field | How components are chosen | Rules |
|---|---|---|---|
| **Single product**, any subcategory | Shown when the subcategory has Scent options; **optional** | — | If scents are picked, count must equal the pack count (Pack of 2 → 0 or 2) |
| **Combo**, subcategory **has** Scent options — *Scent mode* | Shown, **mandatory** | Same as today: auto-find single products by Scent in the same subcategory, one per Scent | Scents = pack count; picked products = pack count |
| **Combo**, subcategory **has no** Scent options — *Search mode* | **Hidden** (not required, not sent) | **New:** search single products by name / PUC from **any** subcategory, pick them, set quantity | Picked products = pack count; combos cannot be picked; no one-per-Scent rule; `validate-combo` must pass |
| **Edit** an existing combo | Read-only (as today) | View mapped components read-only (as today) | No change |

Mode is chosen automatically: **Scent mode** if the selected subcategory has Scent options in the picklist, otherwise **Search mode**.

---

## 4. Changes — where and what

All in `asset_management_frontend_aromazen`.

### 4.1 Validation — `src/config/productValidation.ts`

| Line | Today | Change |
|---|---|---|
| 46-61 (base `incense` schema, exported as `defaultValidationSchema`, not imported anywhere) | `fragnancetype` `.required(...)` + non-empty + pack-match | Make optional; keep pack-match only when a value is given |
| 133-170 `getValidationSchema()` | Required when the subcategory has options; optional otherwise | **Not required for single.** Required only when `iscombo` is true **and** the subcategory has options (Yup `.when('iscombo', ...)`), message "Select scents for this combo". Keep `pack-match` whenever a value is given. Search mode: optional. |

### 4.2 Form — `src/components/products/ProductForm.tsx`

| Line | Today | Change |
|---|---|---|
| 167-184 `comboSupportedTaxonomyValues` / `isComboSupported` | Hard-coded 9 subcategories | Keep the 9 (they become usable). Optional later improvement: add subcategories that have Scent options (e.g. fragrance_oils, air_fresheners) — **business to confirm** (§7). |
| 246-258 (field config, `required: optionsForSubcategory.length > 0`) | `*` when options exist | `required: false` (the combo `*` is handled at 628-635) |
| 604-626 (Scent render / hide) | Shown if options exist **or** subcategory is combo-enabled | Show only if the subcategory **has Scent options**. Hide in Search mode (fixes the "No options available" dead end). |
| 628-635 (`required` for render) | `true` when combo ticked | `true` only when combo ticked **and** options exist |
| New helper (near 182) | — | `comboMode = hasScentOptions ? 'scent' : 'search'` from `groupedOptions["fragnancetype"]` filtered by `parent === subcategory` |
| 893-930 (Map / View Combo Components link) | Needs `fragranceList.length === packCount` | Scent mode: unchanged. Search mode: show **Map Combo Components** whenever combo is ticked (create mode); open the popup in search mode |
| 1394-1576 (`fetchComponentProducts` effect) | Runs only with Scent values; resets otherwise | Scent mode: unchanged. Search mode: do **not** auto-fetch or reset mapped components when Scent is empty; the popup searches itself |
| 1330-1340 (submit payload) | Sends `components` when mapped | No change. In Search mode make sure `fragnancetype` is empty/null (not stale) |
| 1630-1655 (Submit hidden until mapped) | Hidden if combo and no components | No change — works for both modes once mapping is possible |

### 4.3 Mapping popup — `src/components/products/ComboComponentMappingModal.tsx`

| Area | Change |
|---|---|
| Props (18-28) | Add `mode?: 'scent' \| 'search'` (default `'scent'`) |
| Search mode UI | Search box (debounced) → `productService.getProducts({ searchtext / name, page, limit })` from **all** subcategories; show name, PUC, subcategory, stock; drop `iscombo` products and the product being created |
| Selection (158-205) | Scent mode: unchanged (one per Scent). Search mode: no per-Scent rule; max picks = pack count; same product cannot be picked twice |
| Quantity / confirm (216-250) | Same: `requiredqty >= 1`, picks = pack count, then `POST /v1/products/validate-combo` (exists, not a combo, no duplicate combo) |
| Messages (253-263, 498) | "No products found for scent X" stays for Scent mode; Search mode: "No products match your search" |
| Read-only view (edit) | Unchanged |

### 4.4 Other frontend files — checked, no change needed

| File | Why no change |
|---|---|
| `src/components/products/ProductCreate.tsx:132-134` | Already sends `undefined` when Scent is empty |
| `src/components/common/DynamicForm/DynamicFormField.tsx:150-160, 190, 285-290` | Picklist filtered by subcategory; "(0/2 selected)" text only when the field is shown |
| `src/components/products/ProductDetail.tsx:541-553` | Shows Scent only when present |
| `src/utils/productSaveError.ts:15` | Label only |
| `src/services/productService.ts:25-26` | Filter only when given |
| `src/config/productFields.ts:4` `FRAGRANCE_TYPE_SUBCATEGORIES` | Not used anywhere (product name is Brand + Remarks) |
| `src/config/productFields.ts:236-245` | Already `required: false`; set dynamically by the form |

### 4.5 Documentation

| File | Change |
|---|---|
| `asset_management_frontend_aromazen/PRODUCT_FORM_FIELDS.md` (lines 19, 48, 58, 68, 149, 159, 169, 177, 190-239) | "Conditionally required" → optional for single, mandatory for Scent-mode combos, hidden in Search mode; add the two combo modes |
| `docs/Fix_After_Sep30/Master.md` | Row + section for this plan; update status when implemented |

---

## 5. Impact analysis — no change needed (verified 2026-10-26)

### 5.1 Backend code (`asset-management-backend`, every spelling: `fragnancetype`, `fragranceType`, `fragrance_type`, `scent`)

| Place | Use of Scent | Required? |
|---|---|---|
| `prisma/schema.prisma:21` | `fragnancetype String? @db.VarChar(255)` | No (nullable) |
| `src/schemas/product.schema.ts:50, 133, 208, 281` | Zod `.max(255).optional()` (create, update, filters) | No |
| `src/routes/product.route.ts:153, 325, 650, 1604, 1788, 2164, 2338, 2863, 3039` | Fastify query/body/response; `maxLength: 255`, `nullable: true`; not in any `required` list | No |
| `src/services/product.service.ts:991-1040` (create combo) | Checks components exist, not a combo, no duplicate combo — **Scent not used** | No |
| `src/services/product.service.ts:~1999-2040` (`validateComboComponents`, `POST /v1/products/validate-combo`) | Same checks — **Scent not used** | No |
| `src/services/product.service.ts:677-691` (Home "Flavours") | `STRING_TO_ARRAY` + skips blank values | No |
| `src/utils/storefrontListingFilters.ts:19, 63, 129` | Filter only; empty never matches | No |
| `src/utils/dynamicDbOperations.ts:63` | Search uses `COALESCE(fragnancetype,'')` | No |
| `src/config/dynamicFieldConfig.ts:13, 27` | `requiredFields: ['name']` only | No |
| `src/repositories/amazon-listing-publish.repository.ts:24, 698` / `src/services/amazon-listing-publish-draft.service.ts:313` | Copied into the draft snapshot as-is (null allowed) | No |
| `src/utils/legacy-promotion-v2.ts:82` | Old "fragrance/scent" promotion conditions already rejected (out of scope) | Not related |
| `scripts/*` (taxonomy migration, picklist sync, catalogue import, normalize-fragrance-type-dependencies) | One-off scripts; handle null | No |

### 5.2 Database — triggers, functions, constraints, views (read-only queries)

| Check | Dev / SIT (`assetmanagement_dev`) | UAT (`assetmanagement_uat`) | Prod (`railway`) |
|---|---|---|---|
| Column `product.fragnancetype` | Nullable, no default | Nullable, no default | Nullable, no default |
| NOT NULL / CHECK constraint on Scent | None | None | None |
| Views using Scent | None | None | None |
| `set_puc_trigger` → `set_puc()` | Brand + id only | Same | Same |
| `generate_puc()` | Category + subcategory + sequence | Same | Same |
| `set_productstatus_before_insert` → `set_productstatus_out_of_stock()` | Sets `out_of_stock` | Same | Same |
| Created / modified date triggers | Timestamps only (`set_created_date_trigger_product`, `set_modified_date_trigger_product`) | Same functions (`set_epochcreateddate_trigger_product`, `set_epochmodifieddate_trigger_product`) | Same as UAT |
| `update_searchtext_trigger` → `update_searchtext_trigger_function()` | **Only one that reads Scent:** `to_tsvector(COALESCE(NEW.fragnancetype,''))` — empty is safe | Same | Same |
| Products already saved without Scent | 34 | 44 | 44 |

**Result:** no database rule, trigger or function requires Scent. **No migration or SQL** for this plan (nothing to add to `RELEASE_SCRIPTS_CHECKLIST.md`).

### 5.3 Storefront and mobile

| Place | Behaviour with empty Scent |
|---|---|
| `Nivaana-Ecom-Web/src/pages/Home.tsx:596-610` (Flavours) | `fragnancetype?.split` — skipped |
| `Nivaana-Ecom-Web/src/components/Navbar.tsx:118-127` (search) | `.filter(Boolean)` — skipped |
| `Nivaana-Ecom-Web/src/types/index.ts:36` | `string \| null` |
| `Vibrant-Life-mobile-app` (`productService.ts`, `cartWishlistService.ts`, `ProductDetailScreen`, `ProductListScreen`, `CartScreen`, `HomeScreen`) | All use `\|\| null` / `?? null` |

### 5.4 Side effects to accept

- A product without Scent does not appear under any Home "Flavours" tile or Scent filter.
- Searching by a Scent name does not find it (search text has no Scent words).
- Combo stock is calculated from component stock, not Scent — no effect.

---

## 6. Test cases

| # | Case | Expected |
|---|---|---|
| TC-01 | Incense Sticks, single, Pack = Single, no Scent | Saves; Scent empty; no `*` on Scent |
| TC-02 | Incense Sticks, single, Pack of 2, 1 Scent | Error "Number of fragrances must match the pack size" |
| TC-03 | Incense Sticks, single, Pack of 2, 2 Scents | Saves with both Scents |
| TC-04 | Decor (no Scent options), single | Scent field hidden; saves |
| TC-05 | Incense Sticks, combo, Pack of 2, no Scent | Scent `*`; error "Select scents for this combo"; no Submit |
| TC-06 | Incense Sticks, combo, Pack of 2, 2 Scents | Popup opens (Scent mode), pick 1 per Scent, validate-combo passes, saves |
| TC-07 | Luxury Gifts, combo, Pack of 2 | Scent hidden; **Map Combo Components** shown; search "Kasturi" finds incense products from other subcategories; pick 2; saves |
| TC-08 | Luxury Gifts, combo, Pack of 2, pick only 1 | Confirm disabled / message "Select 2 products" |
| TC-09 | Luxury Gifts, combo, search shows a combo product | Combo products not listed (or rejected by validate-combo) |
| TC-10 | Luxury Gifts combo with the same 2 products as an existing combo | validate-combo error "A combo with the same products already exists" |
| TC-11 | Search mode, pick 2 products with no Scent | Both stay selected (no one-per-Scent rule) |
| TC-12 | Edit existing incense combo / new gift combo | Opens read-only; View Combo Components shows mapped products |
| TC-13 | Ecom web + mobile: new gift combo and no-Scent single product | Listed, product page, cart and stock work; not under Flavours |
| TC-14 | Search box in Inventory product list with a no-Scent product | Found by name / brand / PUC |

---

## 7. Open decisions

| # | Question | Default if not answered |
|---|---|---|
| 1 | Add `fragrance_oils` and `air_fresheners` (have Scent options) to the combo list? | No — keep the 9 |
| 2 | Search mode: limit search to some categories (e.g. only single products in Home Fragrance)? | All active single products |
| 3 | Search mode: allow quantity > 1 per product (e.g. 2 × same incense in a Pack of 2)? | Picks = pack count, quantity 1 each (same as Scent mode) |

---

## 8. Release notes

- Frontend only (admin / Inventory). Path: `DEV-NEW` → `SIT` → `UAT` → `Prod`.
- No backend deploy, no migration, no env change.
- Before UAT / Prod: check the Scent picklist parents on that environment (which subcategories have Scent options decide Scent mode vs Search mode).
