# Manual External Sold Update Checklist

Use this checklist when doing a manual stock sold update with [`scripts/external-sold-update.ts`](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/scripts/external-sold-update.ts).

This process is for stock sold on external platforms like Amazon or Flipkart that did not come through the normal order flow.

## Basic Details

- Client name:
- Update date:
- Operator name:
- Excel file name:
- Platform:
- Sold date to use in JSON:

## 1. Pre-Run Checks

- [ ] Confirm you are using the correct database connection in [`scripts/external-sold-update.ts`](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/scripts/external-sold-update.ts).
- [ ] Confirm the update must be done in the intended environment only.
- [ ] Confirm the script command exists in [`package.json`](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/package.json) as `npm run sold:update`.
- [ ] Confirm the client-shared Excel file is the latest final version.
- [ ] Confirm the platform name is correct for every row.
- [ ] Confirm the sold date is correct before preparing JSON.

## 2. Excel Mapping Rules

- [ ] Map every product in the Excel sheet to the correct backend `product id`.
- [ ] If one Excel row contains multiple products, split that row into separate product mappings.
- [ ] If one line item contains multiple products, divide the quantity correctly per product based on the client data.
- [ ] Verify the quantity for each mapped product separately.
- [ ] Do not assume one row means one product.
- [ ] Do not continue until every product name has a confirmed `product id`.

### Mapping Examples

Example 1:

`Nivaana First Rains 10's Pack - 1`

- [ ] Map the single product to one `product id`
- [ ] Quantity should be `1`

Example 2:

`Auora Vanilla, Nishiganda and Cherry Air Freshner - 3 each item 1`

- [ ] Split into 3 separate products
- [ ] Map 3 separate `product id` values
- [ ] Quantity should be `1` for each item

Example 3:

`Auora Cool Aqua - 2, Cherry, Jungle Vibe Air Freshner - 4`

- [ ] Split each product separately
- [ ] `Auora Cool Aqua` quantity should be `2`
- [ ] Verify how the remaining quantity is distributed for `Cherry` and `Jungle Vibe Air Freshner`
- [ ] Confirm the final split with the source Excel/client note before creating JSON

## 3. Prepare the JSON

Prepare the `SOLD_UPDATES` array in this format:

```ts
[
  { id: 123, quantity: 2, platform: 'Amazon', solddate: '3/3/2026' },
  { id: 456, quantity: 1, platform: 'Amazon', solddate: '3/3/2026' }
]
```

Checklist:

- [ ] Each JSON item has the correct `id`
- [ ] Each JSON item has the correct `quantity`
- [ ] Each JSON item has the correct `platform`
- [ ] Each JSON item has the correct `solddate`
- [ ] Repeated product IDs are allowed only if the source data really has multiple sold entries
- [ ] If the same product ID appears multiple times across different platforms, verify each line carefully
- [ ] Review the full JSON once before placing it into the script

## 4. Update the Script

- [ ] Open [`scripts/external-sold-update.ts`](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/scripts/external-sold-update.ts).
- [ ] Replace the `SOLD_UPDATES` value with the prepared JSON.
- [ ] Confirm there are no syntax mistakes.
- [ ] Save the file only after one final review.

## 5. Dry Run

Dry run command:

```bash
npm run sold:update
```

Checklist:

- [ ] Run only the dry run first
- [ ] Do not set `DRY_RUN=false` at this stage
- [ ] Wait for the script to finish fully
- [ ] Capture the generated TXT result file
- [ ] Review the dry run result line by line

## 6. Dry Run Verification

During dry run verification, check every item from the first JSON entry to the last JSON entry.

- [ ] Verify the product ID in the output matches the JSON
- [ ] Verify the platform in the output matches the JSON
- [ ] Verify the sold quantity in the output matches the JSON
- [ ] Verify the before quantity and after quantity are correct
- [ ] Verify repeated product IDs are reducing quantities correctly across all occurrences
- [ ] Verify cross-platform entries are handled correctly
- [ ] Verify the final quantity after the last repeated line item is still correct
- [ ] Confirm this step does not update the database

## 7. Database Validation Before Live Run

- [ ] Check the current DB quantities for the affected products
- [ ] Check the current DB quantities for the affected platform stock rows
- [ ] Confirm the quantity reduction expected from the JSON matches the dry run output
- [ ] Confirm there is enough available quantity before doing the live run
- [ ] Stop if any product, quantity, platform, or stock result does not match

## 8. Live Run

Live run command:

```bash
DRY_RUN=false npm run sold:update
```

Checklist:

- [ ] Run the live command only after dry run and DB validation are fully correct
- [ ] Review the confirmation prompt carefully before proceeding
- [ ] Confirm the server logs are showing the same expected result as the dry run
- [ ] Confirm every item is executed successfully
- [ ] Note how many items were processed
- [ ] Note pass count and fail count from the logs

## 9. Post-Run Verification

- [ ] Check random products from the update set
- [ ] Verify product quantity is reduced correctly
- [ ] Verify platform stock quantity is reduced correctly
- [ ] Verify sold items are marked correctly
- [ ] Verify stock entries look correct for random samples
- [ ] Verify repeated product IDs ended with the correct final quantity
- [ ] Confirm there are no unexpected failures in the server logs

## 10. Final Reporting

Send the final mail with:

- [ ] Client name and update date
- [ ] Excel file reference
- [ ] Dry run TXT result file
- [ ] Final server log summary
- [ ] Total processed count
- [ ] Total passed count
- [ ] Total failed count
- [ ] Any issues, mismatches, or manual observations

## Stop Conditions

Do not proceed to live run if any of the below happens:

- [ ] Database connection is wrong or not confirmed
- [ ] Any product ID mapping is not confirmed
- [ ] Any quantity split is unclear
- [ ] Dry run output does not match expected quantity reduction
- [ ] DB validation does not match dry run
- [ ] Server log shows unexpected errors

## Quick Command Reference

```bash
npm run sold:update
DRY_RUN=false npm run sold:update
```
