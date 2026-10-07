# SIT Picklist Replacement from UAT — Read-only Dry-run

Date: 2026-10-07  
Source: UAT database `assetmanagement_uat`  
Target: SIT database `assetmanagement_dev`

## Scope and safety

This is a read-only analysis. No rows were inserted, updated, or deleted in either database.

The proposed migration copies only the UAT `picklist` dataset into SIT. UAT products, category images, GST/HSN mappings, and other business data are not copied. Existing SIT references must instead be translated from the old SIT picklist ID to the corresponding UAT picklist ID.

The logical matching key used for the dry-run is:

```text
lower(object) + lower(fieldname) + lower(value) + lower(parent)
```

Neither database contains a duplicate for this logical key.

## Summary

| Check | Result |
|---|---:|
| SIT picklist rows | 120 |
| UAT picklist rows | 112 |
| Logical matches | 106 |
| SIT-only/unmatched rows | 14 |
| UAT-only/new rows | 6 |
| Matched rows whose numeric ID changes | 42 |
| Matched rows with non-ID attribute differences | 54 |

The migration cannot be performed as a direct `TRUNCATE` and import. References must be remapped first, and the 14 unmatched SIT rows require a decision.

## Matched-reference remap impact

Among the 42 matched records whose IDs differ between SIT and UAT, the following existing SIT rows require an ID update:

| Referencing table/column | Rows to remap |
|---|---:|
| `category_images.picklistid` | 8 |
| `gst_hsn_mapping.subcategory_id` | 15 |
| `gst_hsn_mapping.subsubcategory_id` | 0 |
| `lovs.source_picklist_id` | 4 |

`category_images` and `gst_hsn_mapping` have database foreign keys to `picklist`. `lovs.source_picklist_id` is also a semantic ID reference even though the current database does not enforce it as a foreign key.

## SIT-only unmatched records

These rows do not have an equivalent logical record in the UAT picklist.

| SIT ID | Field | Value | Parent | Active | Product dependency | Image dependency | GST dependency | Other dependency | Manual decision |
|---:|---|---|---|:---:|---:|---:|---:|---|---|
| 109 | `sub_category` | `fragrances` | — | Yes | 0 | 0 | 0 | `lovs`: 1 | Map or remove LOV |
| 245 | `subcategory` | `sub_category_test_value` | — | No | 0 | 0 | 0 | None | Remove candidate |
| 246 | `subcategory` | `candles&candles` | — | No | 0 | 0 | 0 | None | Remove candidate |
| 247 | `subcategory` | `candle&candle` | `home_car_fragrance` | Yes | 0 | 0 | 0 | None | Remove or map |
| 248 | `category` | `sandal_products` | — | Yes | 0 | 1 | 0 | One child/controlled picklist row (`test`) | Map image/category or remove |
| 249 | `subcategory` | `test` | `sandal_products` | Yes | 0 | 0 | 0 | Parent is SIT-only ID 248 value | Remove or map |
| 250 | `category` | `wellness_&_self_care` | — | Yes | 0 | 1 | 0 | None | Map image/category or remove |
| 251 | `category` | `home_decor` | — | Yes | 0 | 0 | 0 | Runtime code references found | Map or accept compatibility-only code |
| 252 | `category` | `bath_&_body` | — | Yes | 0 | 0 | 0 | None | Remove or map |
| 253 | `category` | `gifting_essentials` | — | Yes | 0 | 0 | 0 | None | Remove or map |
| 254 | `category` | `hair_care` | — | Yes | 0 | 0 | 0 | None | Remove or map |
| 255 | `category` | `beauty_&_cosmetics` | — | Yes | 0 | 0 | 0 | None | Remove or map |
| 256 | `fragnancetype` | `rose_bliss` | `incense_sticks` | Yes | 3 products contain this token | 0 | 0 | None | Replacement fragrance required |
| 257 | `fragnancetype` | `sandalwood_serenity` | `incense_sticks` | Yes | 3 products contain this token | 0 | 0 | None | Replacement fragrance required |

### Existing SIT products requiring a manual fragrance decision

Product fragrance values may be comma-separated. The following four products contain one or both of the unmatched fragrance tokens:

| Product ID | Short name | Current `fragnancetype` | Required decision |
|---:|---|---|---|
| 82 | Rose Bliss | `rose_bliss` | Select a UAT fragrance value |
| 83 | Sandalwood Serenity | `sandalwood_serenity` | Select a UAT fragrance value |
| 84 | Floral & Sandalwood Duo | `rose_bliss,sandalwood_serenity` | Select replacement values for both tokens |
| 85 | Pure Bliss Combo | `sandalwood_serenity,rose_bliss,spiritual_harmony` | Replace the first two tokens; `spiritual_harmony` already exists in UAT |

Two other comma-separated product values were reported by an exact-value validation, but all their individual tokens already exist in UAT and therefore do not require manual mapping:

- Product 78: `kasturi,kesar_chandan`
- Product 79: `paradise_garden,floral_valley`

### Existing SIT category images requiring a manual decision

| Category picklist | Category image ID | Current SIT object | Required decision |
|---|---:|---|---|
| `sandal_products` | 15 | `storefront-taxonomy/category/sandal_products/.../mobile.webp` | Map to a UAT category or remove the DB record; the storage object is not automatically deleted by this migration |
| `wellness_&_self_care` | 17 | `storefront-taxonomy/category/wellness_-_self_care/.../mobile.webp` | Map to a UAT category or remove the DB record; the storage object is not automatically deleted by this migration |

### Existing SIT LOV requiring a manual decision

`lovs.id = 77` points to SIT picklist ID 109 (`product.sub_category = fragrances`). UAT has no logical equivalent with the same field/value/parent key. Choose whether to map it to another UAT picklist row or remove/deactivate this LOV entry.

## UAT-only rows that will be added to SIT

All six are active `product.fragnancetype` values under `fragrance_oils`:

| UAT ID | Value | Label |
|---:|---|---|
| 149 | `evening_in_paris` | Evening In Paris |
| 150 | `velvet_bloom` | Velvet Bloom |
| 151 | `garden_dew` | Garden Dew |
| 152 | `sicilian_lime` | Sicilian Lime |
| 153 | `black_ice` | Black Ice |
| 154 | `rose_rush` | Rose Rush |

## Non-ID data differences

Fifty-four of the 106 logically matched rows differ in one or more of `controlledvalue`, `controlledlabel`, `controlledfieldname`, `sortorder`, or another non-key attribute. Replacing SIT with the exact UAT dataset will intentionally apply those UAT values.

Notable groups include:

- SIT subcategory records currently populate category-related `controlled*` fields, while the matching UAT rows leave them null.
- Several UAT incense fragrance rows use `controlledvalue = premium_incense_sticks`, while SIT uses `incense_sticks`.
- Several UAT wardrobe fragrance rows use `controlledvalue = fragrance_sachets`, while SIT uses `wardrobe_fragrance`.
- Several UAT air-freshener fragrance rows use `controlledvalue = room_fresheners`, while SIT uses `air_fresheners`.
- UAT fragrance-oil rows use `controlledvalue = fragrance_oils`; some SIT rows use `fragrance_blends`.

These are not unmatched rows, but they may change dependent-dropdown behavior. They should be accepted explicitly if UAT is the authoritative picklist source.

## Code-level compatibility references

The value `home_decor` is referenced in active source code even though no current SIT product uses it:

- Backend taxonomy compatibility mapping: `src/utils/productTaxonomy.ts`
- Ecommerce home-page filtering: `Nivaana-Ecom-Web/src/pages/Home.tsx`
- Mobile category icon fallback: `Vibrant-Life-mobile-app/src/screens/categories/CategoriesScreen.tsx`

These references do not block the database migration. They can remain as backward-compatible fallbacks, or be removed in a separate code cleanup after the UAT taxonomy is confirmed.

## Manual mapping sheet

Fill only the rows that must be retained. Use the exact UAT `value` and, where applicable, its parent.

| SIT value | Suggested action | Selected UAT value/parent |
|---|---|---|
| `fragrances` (`sub_category`) | Map or remove LOV 77 | **Pending** |
| `candle&candle` | Remove or map | **Pending** |
| `sandal_products` | Map category and image 15, or remove | **Pending** |
| `test` under `sandal_products` | Remove or map | **Pending** |
| `wellness_&_self_care` | Map category and image 17, or remove | **Pending** |
| `home_decor` | Remove or map | **Pending** |
| `bath_&_body` | Remove or map | **Pending** |
| `gifting_essentials` | Remove or map | **Pending** |
| `hair_care` | Remove or map | **Pending** |
| `beauty_&_cosmetics` | Remove or map | **Pending** |
| `rose_bliss` | Map product fragrance token | **Pending** |
| `sandalwood_serenity` | Map product fragrance token | **Pending** |

The inactive and unused `sub_category_test_value` and `candles&candles` rows are safe removal candidates, subject to final approval.

## Execution plan after manual decisions

1. Take timestamped backups of SIT `picklist`, `category_images`, `gst_hsn_mapping`, `lovs`, and the relevant product taxonomy fields.
2. Import UAT `picklist` into a temporary staging table.
3. Create an explicit old SIT ID to new UAT ID mapping for all 106 logical matches.
4. Apply the approved mappings for the unmatched rows, including product string/token replacements.
5. Remap matched references: 8 category images, 15 GST mappings, and 4 LOV rows.
6. Apply the selected actions for the two unmatched images and one unmatched LOV.
7. Replace the SIT picklist contents with the staged UAT picklist inside one transaction.
8. Reset the SIT picklist sequence to the UAT maximum ID.
9. Validate that there are no orphan references, invalid product taxonomy tokens, or duplicate logical picklist keys.
10. Smoke-test Admin dropdowns/product editing, category images, GST defaults, ecommerce filters, and mobile category navigation.

No execution should begin until the manual mapping sheet is completed.
