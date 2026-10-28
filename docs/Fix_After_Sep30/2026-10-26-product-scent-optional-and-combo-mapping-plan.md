# Product Form — Scent Optional, Combo Mapping by Product + Quantity (Plan)

**ID:** PLAN-2026-10-26-164
**Date:** 2026-10-26 (revised 2026-10-28)
**Status:** 📝 Analysed and agreed / not implemented yet
**Scope:** Nivaana Inventory combos only (Product → Create → **Is Combo Pack**). Amazon auto-created combos (`amazonComboPlan.ts`) are not changed.
**Repositories to change:** `asset_management_frontend_aromazen` (admin / Inventory). Backend: **no required change**; two small optional checks in §4.6. Database, Ecom web and mobile app: **no change** (checked, see §5).

> **Revision 2026-10-28:** the "Scent mode / Search mode" split (rev. 2026-10-26) is replaced by **one mapping flow for every combo**: Scent is optional, components are picked by product search from any subcategory, and each product can have a **quantity > 1** (open decision #3 answered: **yes**). Order-flow impact re-verified on Dev with a real combo order (§5.5).

---

## 1. Goal

1. **Single product (not a combo):** the **Scent** field (`fragnancetype`) becomes **optional** in every subcategory.
2. **Combo product (every combo-enabled subcategory):**
   - Scent is **not required** and is **not used** to find components.
   - The user maps components with a **product search** (name / PUC, **any subcategory**) and sets a **quantity per product**.
   - The **total quantity must equal the pack**. Examples:
     - Pack of 2 = **A × 2** (one product), or A × 1 + B × 1
     - Pack of 3 = **A × 2 + B × 1**, or A + B + C
   - The combo's `fragnancetype` is **filled automatically** from the components' scents (for storefront filters).
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

### 2.2 Combo depends fully on Scent

How the form builds a combo today (`ProductForm.tsx:1394-1535`):

1. User ticks **Is Combo Pack**, picks a **Pack** (e.g. Pack of 2) and picks **Scents** equal to the pack count.
2. For each Scent the form calls `GET /v1/products?subcategory=<same subcategory>&fragnancetype=<scent>` and drops combos.
3. Only when scents count = pack count do products load and the **Map Combo Components** popup opens.
4. In the popup the user picks **one product per Scent**, **quantity fixed at 1**, total products = pack count (`ComboComponentMappingModal.tsx:254-258`, `matchesPackRequirement = selectedCount === requiredCount`); `POST /v1/products/validate-combo` checks them.
5. **Submit** is hidden until components are mapped (`ProductForm.tsx:1650-1655`).

So:
- With no Scent options: nothing to select → no products fetched → no Map link → **no Submit button** (screenshot case: Gift Collections → Luxury Gifts, Pack of 2, Scent "No options available").
- A combo of **the same product twice** (A × 2) or **A × 2 + B × 1** cannot be made: one product per Scent, and the pack rule counts products, not quantity.
- Only the **same subcategory** is searched, so a gift combo (1 incense + 1 wardrobe sachet) cannot find its products.

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

### 2.4 Hidden catch in the mapping popup

`ComboComponentMappingModal.tsx:158-205` (`handleProductToggle`) allows **one product per Scent** — selecting a second product with the same Scent unselects the first. Products are grouped by `product.fragnancetype || ''`, so all products **without** a Scent fall in one blank group → only **one** could ever be selected. The new flow must not use this rule.

### 2.5 Existing combos (Dev, 2026-10-28)

| id | PUC | Subcategory | `fragnancetype` | Pack | Components (qty) |
|---|---|---|---|---|---|
| 78 | — | incense_sticks | kasturi,kesar_chandan | pack_of_2 | 2 × qty 1 |
| 79 | NIV-0079 | incense_sticks | paradise_garden,floral_valley | pack_of_2 | 2 × qty 1 |
| 84 | NIV-0084 | incense_sticks | floral_valley,royal_sandal | pack_of_2 | 2 × qty 1 |
| 85 | NIV-0085 | incense_sticks | royal_sandal,floral_valley,spiritual_harmony | pack_of_3 | 3 × qty 1 |
| 87 | AUO-0087 | incense_sticks | kesar_chandan,kasturi | pack_of_2 | 2 × qty 1 |
| 94 | NIV-0094 | dhoop_sticks | **null** | pack_of_2 | 2 × qty 1 |

All existing combos have quantity 1 per component. Combo 94 already has no Scent, so it is not listed under any Scent filter / Flavours tile — the same will happen to new combos unless `fragnancetype` is auto-filled (§4.2).

---

## 3. Agreed behaviour (after the change)

| Case | Scent field | How components are chosen | Rules |
|---|---|---|---|
| **Single product**, any subcategory | Shown when the subcategory has Scent options; **optional** | — | If scents are picked, count must equal the pack count (Pack of 2 → 0 or 2) |
| **Combo**, any combo-enabled subcategory | **Hidden while creating** (not required); filled automatically from the components on save | **Product search** by name / PUC from **any** subcategory; pick products; set **quantity** per product | See rules below |
| **Edit** an existing combo | Read-only (as today) | View mapped components read-only (as today) | No change (backend ignores `components` on update) |

**Combo rules:**

| # | Rule | Where enforced | Why |
|---|---|---|---|
| R1 | Components must be **single** products (not a combo) | Backend (exists) + popup hides combos | `product.service.ts:1038` |
| R2 | **Each product only once** per combo — to add more of it, raise its quantity | Popup (new) + optional backend check (§4.6) | DB unique `(bundleproductid, componentproductid)` — a second row fails half-way through create |
| R3 | Quantity per product **≥ 1** | Popup + backend (exists, `min(1)`) | `product.schema.ts:113` |
| R4 | **Sum of quantities = pack count** (Pack of 3 → A × 2 + B × 1 ✅, A × 1 + B × 1 ❌) | Popup (changed) | Pack is shown to customers and drives the Gift Sets listing |
| R5 | Only **active, e-commerce-published** products with stock should be offered | Popup filter + optional backend check (§4.6) | Dispatch auto-picks only `ecompublish = true` stock (`orders.service.ts:1661-1668`); otherwise the order stops at Ready for Dispatch |
| R6 | No other combo with **the same products and quantities** | Backend (exists, `findExistingComboByComponents`) | A × 2 + B × 1 and A × 1 + B × 2 count as **different** combos (correct) |
| R7 | One product with quantity = pack is allowed (A × 2 for Pack of 2) | Popup (new) | Backend already accepts a single component |

Pack values available (picklist, Dev 2026-10-28): `single`, `pack_of_2`, `pack_of_3`, `pack_of_4`, `pack_of_5`, `pack_of_6`, `pack_of_9`, `pack_of_12`. A combo total that is not one of these (e.g. 7) cannot be saved — the user picks the pack first, so R4 covers it.

---

## 4. Changes — where and what

### 4.1 Validation — `src/config/productValidation.ts`

| Line | Today | Change |
|---|---|---|
| 46-61 (base `incense` schema, exported as `defaultValidationSchema`, not imported anywhere) | `fragnancetype` `.required(...)` + non-empty + pack-match | Make optional; keep pack-match only when a value is given |
| 133-170 `getValidationSchema()` | Required when the subcategory has options; optional otherwise | **Never required.** Single: keep `pack-match` when a value is given. **Combo: skip `pack-match`** — the auto-filled Scent list has one entry per *distinct* scent, so A × 2 (Pack of 2) gives 1 scent and must still pass. |

### 4.2 Form — `src/components/products/ProductForm.tsx`

| Line | Today | Change |
|---|---|---|
| 167-184 `comboSupportedTaxonomyValues` / `isComboSupported` | Hard-coded 9 subcategories | Keep the 9 (all become usable). Adding more is a business decision (§7). |
| 246-258 (field config, `required: optionsForSubcategory.length > 0`) | `*` when options exist | `required: false` |
| 604-635 (Scent render / required) | Shown if options exist or subcategory is combo-enabled; `required` when combo ticked | **Combo ticked → hide Scent** (fixes the "No options available" dead end). Single → show only when options exist, optional. |
| 893-930 (Map / View Combo Components link) | Needs `fragranceList.length === packCount` | Show **Map Combo Components** whenever combo is ticked, a pack is picked and it is create mode. View link unchanged. |
| 1394-1576 (`fetchComponentProducts` effect) | Fetches by Scent in the same subcategory; resets mapping when Scent is empty | **Remove the Scent fetch for create mode** — the popup searches itself. Keep the read-only branch (edit mode builds products from `existingProduct.components`). Reset mapped components only when combo is unticked or the pack changes. |
| 1330-1340 (submit payload) | Sends `components` when mapped | Send `components` as `[{ productid, requiredqty }]` (one row per product). **Auto-fill** before submit: `fragnancetype` = distinct component scents joined by `,` (skip blanks; null if none; ≤ 255 chars); `numberofitems` = total quantity (optional, field exists on `product`). |
| Name / short name | Built from Scent picks | When Scent is auto-filled the existing name builder keeps working (e.g. "Combo Kasturi,Kesar Chandan"). Check the generated name for gift combos without scents — user can still edit Remarks/Name. |
| 1630-1655 (Submit hidden until mapped) | Hidden if combo and no components | No change. |

### 4.3 Mapping popup — `src/components/products/ComboComponentMappingModal.tsx`

| Area | Change |
|---|---|
| Props (18-28) | Drop the Scent-grouped `componentProducts` input for create mode; keep `existingComponents` + `readOnly` for edit |
| Search UI | Debounced search box → `productService.getProducts({ searchtext, page, limit })` from **all** subcategories. Show name, PUC, subcategory, Scent, available stock. **Hide** `iscombo` products, inactive / unpublished products (R5) and products with 0 available stock (or show them disabled with "Out of stock") |
| Selection (158-205) | **Remove the one-per-Scent rule.** Picking a product adds a row with qty 1; picking an already-added product **raises its qty** instead of adding a row (R2). Each row has a qty stepper (min 1) and a remove button |
| Pack check (254-258) | `matchesPackRequirement = selectedCount === requiredCount` → **`totalRequiredQty === requiredCount`** (`totalRequiredQty` already exists at 255). Show "Selected 2 of 3 items" using the total quantity |
| Confirm (216-250) | Unchanged: `requiredqty >= 1`, then `POST /v1/products/validate-combo` (exists, not a combo, no duplicate combo) |
| Stock hint (new, optional) | Show "Combo stock: min(available ÷ qty)" so the user sees e.g. 141 A with qty 2 → 70 combos |
| Messages (253-263, 354, 498) | Remove "No products found for the selected fragrance(s)"; use "No products match your search" |
| Read-only view (edit) | Unchanged (already shows "Qty: {requiredqty}") |

### 4.4 Other frontend files — checked, no change needed

| File | Why no change |
|---|---|
| `src/components/products/ProductCreate.tsx:132-134` | Already sends `undefined` when Scent is empty |
| `src/components/common/DynamicForm/DynamicFormField.tsx:150-160, 190, 285-290` | Picklist filtered by subcategory; "(0/2 selected)" text only when the field is shown |
| `src/components/products/ProductDetail.tsx:541-553, 652-715` | Shows Scent only when present; component list already shows `requiredqty` |
| `src/pages/orders/OrderDetailPage.tsx:2504-2562`, `OrderItemSection.tsx:253`, `OrderItemModal.tsx:303` | Already show "Qty per combo: {requiredqty}" and "Total components per combo" |
| `src/components/amazon/AmazonComboStockNote.tsx` | Already shows `÷ requiredQty` / `× requiredQty` |
| `src/utils/productSaveError.ts:15` | Label only |
| `src/services/productService.ts:25-26` | Filter only when given |
| `src/config/productFields.ts:4, 236-245` | Not used / already `required: false` |

### 4.5 Documentation

| File | Change |
|---|---|
| `asset_management_frontend_aromazen/PRODUCT_FORM_FIELDS.md` (lines 19, 48, 58, 68, 149, 159, 169, 177, 190-239) | Scent optional for single, hidden for combo (auto-filled); combo = product search + quantity, total = pack |
| `docs/requirements/02_Product_Catalogue.md` | Combo rules R1-R7 |
| `docs/Fix_After_Sep30/Master.md` | Row for this plan; update status when implemented |

### 4.6 Backend — optional hardening (recommended, not required)

The backend already accepts this flow as-is (§5.1). These two checks only protect against bad payloads from any client:

| # | File | Change | Why |
|---|---|---|---|
| B1 | `src/services/product.service.ts:997-1045` (create) and `validateComboComponents` (~1995) | Reject the **same `productid` twice** in `components` with a clear `ValidationError` ("Each product can be added once — change its quantity instead") | Today the 2nd `productbundlemap` insert hits the unique key **after** the combo product row is created → combo with partial components |
| B2 | Same | Reject components whose `productstatus` is inactive (and optionally not e-commerce published) | Avoid combos that can be paid for but not dispatched |
| B3 | `src/services/product.service.ts:1055-1110` | Create the product and its `productbundlemap` rows in **one transaction** | Today a failure between the two leaves a combo with no / partial components (existing risk, not new) |

No schema change, no migration for B1-B3.

---

## 5. Impact analysis (verified 2026-10-26, order flow re-verified 2026-10-28)

### 5.1 Backend code — Scent and combo creation

| Place | What it does | Affected? |
|---|---|---|
| `prisma/schema.prisma:21` | `fragnancetype String? @db.VarChar(255)` | No (nullable) |
| `prisma/schema.prisma:86-103` `ProductBundleMap` | `bundleproductid`, `componentproductid`, `requiredqty Int @default(1)`, unique `(bundle, component)` | No — already stores any product + any qty |
| `src/schemas/product.schema.ts:50, 113, 133, 208, 281` | Scent `.optional()`; `requiredqty` `int().min(1)` | No |
| `src/routes/product.route.ts:1740-1760, 2025-2107` | `components[]` with `requiredqty` `minimum: 1`; `POST /v1/products/validate-combo` | No |
| `src/services/product.service.ts:989-1050` (create combo) | ≥ 1 component, each exists, none is a combo, no duplicate combo — **Scent and pack not used** | No (see §4.6 for optional checks) |
| `src/services/product.service.ts:1892-1985` (`findExistingComboByComponents`) | Compares product + qty | No |
| `src/services/product.service.ts:1178-1205` (update) | Silently ignores `components`, `iscombo`, `combotype` | No (combos stay non-editable) |
| `src/services/product.service.ts:677-691` (Home "Flavours"), `src/utils/storefrontListingFilters.ts:129` | Read comma-separated `fragnancetype` | No — but needs the auto-fill (§4.2) for new combos to appear under Scent filters |
| `src/utils/storefrontListingFilters.ts:150-156` (Gift Sets) | `pack` contains "pack" **or** name contains "combo" | No — pack is always set (R4) |
| `src/services/analytics.service.ts` | Excludes combos (`iscombo: false`) | No |

### 5.2 Database — triggers, functions, constraints, views

| Check | Dev / SIT | UAT | Prod |
|---|---|---|---|
| Column `product.fragnancetype` | Nullable, no default | Same | Same |
| NOT NULL / CHECK constraint on Scent | None | None | None |
| `update_searchtext_trigger` | Only one that reads Scent; `COALESCE(...,'')` — empty is safe | Same | Same |
| `productbundlemap.requiredqty` | `int`, default 1, no upper limit | Same | Same |

**Result:** no migration or SQL (nothing to add to `RELEASE_SCRIPTS_CHECKLIST.md`).

### 5.3 Storefront and mobile — combo stock with quantity > 1

All already compute combo stock as **min over components of `floor(available ÷ requiredqty)`**:

| Place | Line |
|---|---|
| `Nivaana-Ecom-Web/src/lib/stock.ts` | 5-20 |
| `Vibrant-Life-mobile-app/src/screens/products/ProductListScreen.tsx` | 92-102 |
| `Vibrant-Life-mobile-app/src/screens/products/ProductDetailScreen.tsx` | 82-92 |
| `Vibrant-Life-mobile-app/src/screens/cart/CartScreen.tsx` | 55-65 |
| `Vibrant-Life-mobile-app/src/api/services/cartWishlistService.ts` (add-to-cart check) | 327-338 |

Example: A has 141 available, combo = A × 2 → shows **70**.

### 5.4 Order / stock flow — every step multiplies `requiredqty × packs ordered`

| Step | Code | Qty > 1 safe? |
|---|---|---|
| PhonePe lock / deduct / release | `phonepe.controller.ts:584, 6955, 7260, 7344, 7488` | ✅ `requiredQty * requestedQuantity` |
| Ready for Dispatch (auto-pick component stock) | `orders.service.ts:1633-1690` | ✅ `totalNeeded = requiredQty * orderline.quantity` |
| Stock-count check | `orders.service.ts:1706, 1716, 1799-1806` | ✅ runs only for **non-component** lines, so 10 units against an orderline qty of 5 is fine |
| Cancel / return reversal | `orders.service.ts:5134, 5385` | ✅ `componentRequiredQty * quantity` |
| In-store order | `instore-order.service.ts:345` | ✅ `component.requiredqty * item.quantity` |
| Amazon reservation / routing / return | `amazon-combo-stock.service.ts:44`, `amazon-order-routing.service.ts:175-185`, `amazon-return.service.ts:366` | ✅ `Math.max(1, requiredqty)` |
| Amazon combo mapping match | `amazon-combo-mapping.service.ts:50` | ✅ exact product + qty match |

### 5.5 Real example — combo 87 on Dev (read-only, 2026-10-28)

**Stored:**

| Table | Row |
|---|---|
| `product` | id 87, AUO-0087 "AUORA - Auora Combo", `iscombo` true, `combotype` fixed, `fragnancetype` `kesar_chandan,kasturi`, `pack` `pack_of_2`, quantity 0 |
| `platformstock` (nivapp) | id 87 → all quantities 0 (combo has no stock of its own) |
| `productbundlemap` | (87, 7 NIV-0007 Kesar Chandan, qty 1), (87, 66 NIV-0066 Kasturi, qty 1) |

**Order:** orderline 300 / `ordline-0000000565` / NIVAANA-0000000419, quantity **5**, status `in_transit` (payment_completed → ready_for_dispatch → shipped → in_transit).

**Stock moved:** 10 `stock` rows set to `sold` on `ordline-0000000565` — **5 × NIV-0007 + 5 × NIV-0066** (= qty 1 × 5 packs each).

**Same order with the new flow**, combo = NIV-0007 × 2 + NIV-0066 × 1 (Pack of 3), 5 packs → **10 × NIV-0007 + 5 × NIV-0066**. Same code path, no change.

### 5.6 Side effects to accept

- A product **without** Scent does not appear under any Home "Flavours" tile or Scent filter, and searching by a Scent name does not find it. New combos avoid this through the auto-filled `fragnancetype`; a combo whose components have no Scent (e.g. dhoop) behaves like combo 94 today.
- A combo's auto-filled Scent may not be in its own subcategory's Scent picklist (e.g. a Luxury Gifts combo with `kesar_chandan`). Storefront filters read the raw value, so it still works; edit mode shows it read-only.
- **Shipping weight:** `product` has no weight field — the weight sent to Shipmozo / Ekart is entered at shipping time. Inventory users must enter the **packed combo weight** (A × 2 is about twice A).
- **Amazon overlap:** an Amazon "pack of 2 of the same scent" listing is today mapped to the **single product with units per listing** (`AmazonComboStockNote` `unitsPerListing`). After this change an A × 2 Nivaana combo is a second way to model the same thing. Rule: Amazon same-product packs keep using units per listing; Nivaana A × 2 combos are for Nivaana web / app. The Amazon auto-planner still only builds combos of ≥ 2 different products with qty 1 (`amazonComboPlan.ts:192, 201`) — not changed.
- **Web return / replacement** (`return-request.service.ts`) has no combo / component handling (existing gap, not caused by this change) — check separately before combos with qty > 1 go live.

---

## 6. Test cases

| # | Case | Expected |
|---|---|---|
| TC-01 | Incense Sticks, single, Pack = Single, no Scent | Saves; Scent empty; no `*` on Scent |
| TC-02 | Incense Sticks, single, Pack of 2, 1 Scent | Error "Number of fragrances must match the pack size" |
| TC-03 | Incense Sticks, single, Pack of 2, 2 Scents | Saves with both Scents |
| TC-04 | Decor (no Scent options), single | Scent field hidden; saves |
| TC-05 | Incense Sticks, combo, Pack of 2 | Scent hidden; **Map Combo Components** shown without picking Scent |
| TC-06 | Incense Sticks combo, Pack of 2: Kesar Chandan × 1 + Kasturi × 1 | Saves; `fragnancetype` = `kesar_chandan,kasturi`; 2 bundle rows, qty 1 each |
| TC-07 | Incense Sticks combo, Pack of 2: **Kesar Chandan × 2** | Saves; 1 bundle row, qty 2; `fragnancetype` = `kesar_chandan`; storefront stock = floor(A ÷ 2) |
| TC-08 | Pack of 3: **A × 2 + B × 1** | Saves; 2 bundle rows (2, 1) |
| TC-09 | Pack of 3: A × 1 + B × 1 (total 2) | Confirm disabled; "Selected 2 of 3 items" |
| TC-10 | Pack of 2: A × 2 + B × 1 (total 3) | Confirm disabled |
| TC-11 | Pick A, then pick A again | Qty of A becomes 2; still one row |
| TC-12 | Luxury Gifts combo, search "Kasturi" | Finds incense products from other subcategories; combos and inactive / unpublished products not listed |
| TC-13 | Same products + same qtys as an existing combo | validate-combo error "A combo with the same products already exists" |
| TC-14 | A × 2 + B × 1 when A × 1 + B × 2 exists | Allowed (different combo) |
| TC-15 | Edit existing combo (87) / new qty-2 combo | Opens read-only; View Combo Components shows "Qty: 2" |
| TC-16 | Web order, A × 2 combo, quantity 3 | Payment locks 6 A; Ready for Dispatch picks 6 A stock rows; status flow completes |
| TC-17 | Cancel that order before dispatch | 6 A released (lock / ordered qty back) |
| TC-18 | In-store order, A × 2 + B × 1 combo, quantity 2 | Allocates 4 A + 2 B |
| TC-19 | Ecom web + mobile: list, product page, cart for TC-07 / TC-08 combos | Stock = min(floor(stock ÷ qty)); appears under Gift Sets and its Scent filter |
| TC-20 | Existing combos 78-94 | Unchanged: list, cart, order, dispatch |

---

## 7. Open decisions

| # | Question | Decision / default |
|---|---|---|
| 1 | Add `fragrance_oils` and `air_fresheners` to the combo list? | Default: No — keep the 9 |
| 2 | Limit the product search to some categories? | Default: all active, published single products |
| 3 | Allow quantity > 1 per product (A × 2, A × 2 + B × 1)? | **✅ Yes (agreed 2026-10-28)** — total quantity = pack |
| 4 | Allow mixed subcategories in one combo (e.g. incense + dhoop)? Which subcategory / HSN / GST does the combo get? | Default: allowed; combo keeps the subcategory and HSN / GST entered on the form (as today) |
| 5 | Do the optional backend checks B1-B3 (§4.6) in the same release? | Recommended: B1 + B2 yes, B3 when convenient |
| 6 | Amazon same-product packs: units per listing vs Nivaana A × 2 combo | Default: Amazon keeps units per listing (§5.6) |

---

## 8. Release notes

- Admin / Inventory frontend required; backend only if B1-B3 are taken. Path: `DEV-NEW` → `SIT` → `UAT` → `Prod`.
- No migration, no env change.
- Before UAT / Prod: check that the `pack` picklist has the same values (`single`, `pack_of_2` … `pack_of_6`, `pack_of_9`, `pack_of_12`) on that environment.
- Existing combos need no data change.
