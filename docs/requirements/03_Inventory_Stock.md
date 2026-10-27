# 03 · Inventory, Stock, Platform Stock and Stock Locking

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`stock.*`, `platformStock.*`, `stockImport.service.ts`, `gcpTasks.service.ts`, Prisma `Stock`, `PlatformStock`, `locationhistory`), Master.md.

## 1. Purpose

Tracks every physical unit (one `Stock` row per unit), splits sellable quantity per sales channel (`PlatformStock`), and keeps product totals correct while orders, payments, returns and damage change them.

## 2. Stock units

- **INV-01** Each unit is one `Stock` row with:
  - PUC, platform, status, serial number, SKU, batch number
  - supplier, PO, RFID, manufactured / release year
  - `ecompublish` (sellable online), and archive / soft-delete flags
- **INV-02** Stock status values: `available`, `sold`, `damaged`. `ordered`, `on_hold` and `quarantine` are also used by the return / RTO flows. Values are compared case-insensitively.
- **INV-03** **Bulk Add Stock** (`POST /v1/stocks/bulk-insert`) is the only way to create stock in Inventory:
  - quantity (`instances`) 1–10,000; batch number ≤ 255 characters; platform is required
  - rows are saved in batches of 500
  - a partial save returns **207**. The form then lowers the quantity to the units still missing so a retry does not double-save (FIX-2026-10-07-60).
- **INV-04** **Excel import:** `GET /v1/stocks/export`, `POST /import/preview`, `POST /import/commit`. Preview rejects unknown PUCs, PO IDs, supplier IDs, platforms and stock statuses, and files with no header, sheet or rows.
- **INV-05** **RFID:** `POST /rfid-update` and `/bulk-rfid-update` record scans by RFID. Location changes are kept in `locationhistory`.
- **INV-06** **Mark as Damaged** is blocked (**409**) when the stock's platform has `orderedqty + lockqty > 0` and `availableqty < 1`. `GET /v1/stocks/:id/damage-check` shows the result before saving (FIX-2026-10-07-57).
- **INV-07** Changing a stock's platform is a **transfer**. It moves the unit's quantity between the two `PlatformStock` rows.

## 3. Platform stock

- **INV-08** There is one `PlatformStock` row per product and platform. Platforms: `nivapp` (own web and app), `amazon`, `flipkart`, `instore`.
- **INV-09** Quantities: total, e-com published (`ecomqty`), ordered, sold, damaged, locked, and **available = ecomqty − orderedqty − lockqty**.
- **INV-10** A stock edit or delete **recounts** the platform row from its active stock rows. Ordered and locked quantities are kept, because the order and payment flows own them (FIX-2026-10-07-56).
- **INV-11** A platform stock row is created automatically for a new product. `POST /upsert` needs a product id and platform.
- **INV-12** Combo products have no stock rows of their own (see CAT-11).

## 4. Stock locking during payment

- **INV-13** When an online payment starts, two checks run, and both must pass:
  - `product.availablequantity ≥ qty`
  - platform `availableqty ≥ qty`. `availableqty` already excludes locked units, so the check is **not** `availableqty − lockqty`.
  
  Then, under `SELECT … FOR UPDATE`, **platform stock only** changes: `lockqty += qty` and `availableqty` is recalculated (goes down by qty). The `product` row does not change at this step.
- **INV-14** When payment succeeds, the lock becomes an order:
  - platform stock: `lockqty −= qty`, `orderedqty += qty`; `availableqty` stays the same
  - **product**: `orderedquantity += qty`, `availablequantity −= qty`, `productstatus` recalculated
  
  Combos update their components' rows.
- **INV-15** When payment fails or is abandoned, a Cloud Task calls `POST /v1/phonepe/cleanup-lock` after `LOCK_CLEANUP_DELAY_SECONDS`. It is **120 s** in the code default, `.env`, `.env.sit` and `.env.uat`; older documents say 15 minutes. The task checks the payment status first, then releases the lock: `lockqty −= qty`, and `availableqty` goes back up. The product row does not change, because it was never changed at lock.
- **INV-16** **Ready for Dispatch** (not shipping) turns ordered into sold. At that step, physical units are allocated to each order line:
  - either units the admin chooses (stock ids / SKUs / batch filter)
  - or automatically: `nivapp`, available, e-com published, oldest first
  
  Each allocated unit is marked `sold` with the order id, order line number and sold date. On platform stock: `orderedqty −`, `soldqty +`, `ecomqty −`.
  
  Cancelling **before** Ready for Dispatch gives the ordered quantity back. Cancelling **at** Ready for Dispatch puts the allocated units back to `available`. In both cases stock is given back only after the cancel is committed (FIX-2026-10-09-103). Returns and RTO restock according to the inspection result (module 10). Full step-by-step flow: [19_End_to_End_Flows.md](19_End_to_End_Flows.md).
- **INV-17** **Known defect (to fix):** the payment lock, lock release and lock → order steps calculate `availableqty = ecomqty − orderedqty − soldqty − lockqty`. That subtracts sold units a second time, because `ecomqty` already excludes them. Every other step uses `ecomqty − orderedqty − lockqty` (see 19, Finding 1).

## 5. Inventory screens

Stocks (all products; product name shown as the short name), Product → Stock tab (name column hidden), Bulk Add Stock modal, Stock Import modal, Mark Damaged modal, Platform stock tab.

## 6. Known issues and items to confirm

- A dry run on 2026-10-07 found 101 `platformstock` rows that do not match a recount. They have not been repaired; each row corrects itself on its next stock edit. Decide whether to run `scripts/recount-platform-stock.ts --apply` per environment.
- The damage check and the update are not done under a row lock, so a rare race with a new order is possible.
- Flipkart is a platform value, but no Flipkart integration exists.

## 7. Source documents

`STOCK_LOCKQTY_COMPLETE_GUIDE.md`, `README_STOCK_LOCKQTY.md`, `LOCKQTY_FINAL_STATUS.md`, `GCP_LOCK_CLEANUP_IMPLEMENTATION.md`, `STOCK_IMPORT_*`, `STOCK_EXPORT_IMPORT_IMPLEMENTATION.md`, `PRODUCT_PLATFORMSTOCK_AUTO_CREATION.md`, `docs/manual-external-sold-update-checklist.md`, Inventory `stock.md`.
