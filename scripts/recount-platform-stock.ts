/// <reference types="node" />

/**
 * One-off recount of platformstock quantities from active stock rows (FIX-2026-10-07-56).
 *
 * Uses the same rules as PlatformStockService.recalculatePlatformStockQuantities:
 *   totalqty     = active stocks for product PUC + platform
 *   ecomqty      = stockstatus 'available' AND ecompublish = true
 *   soldqty      = stockstatus 'sold'
 *   damagedqty   = stockstatus 'damaged'
 *   availableqty = max(0, ecomqty - orderedqty - lockqty)
 *   orderedqty / lockqty are kept as they are.
 *
 * Dry run by default (read only). Combo products are skipped. Rows with no active
 * stocks are only reported unless --include-empty is passed.
 *
 *   npx tsx scripts/recount-platform-stock.ts --product=82 --platform=nivapp
 *   npx tsx scripts/recount-platform-stock.ts --product=82 --platform=nivapp --apply --confirm=NIVAANA_RECOUNT_PLATFORM_STOCK
 *   npx tsx scripts/recount-platform-stock.ts                      (all products, dry run)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY_CONFIRMATION = 'NIVAANA_RECOUNT_PLATFORM_STOCK';

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];

const applyRequested = process.argv.includes('--apply');
const includeEmpty = process.argv.includes('--include-empty');
const confirmation = argValue('confirm');
const productFilter = argValue('product');
const platformFilter = argValue('platform');

type RecountRow = {
  id: bigint;
  productid: bigint;
  puc: string;
  platform: string;
  totalqty: number;
  ecomqty: number;
  soldqty: number;
  damagedqty: number;
  availableqty: number;
  orderedqty: number;
  lockqty: number;
  platformstatus: string | null;
  stock_count: number;
  new_totalqty: number;
  new_ecomqty: number;
  new_soldqty: number;
  new_damagedqty: number;
};

const platformStatus = (availableqty: number) => {
  if (availableqty === 0) return 'out_of_stock';
  if (availableqty > 5) return 'in_stock';
  return 'low_stock';
};

const main = async () => {
  if (applyRequested && confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Apply requires --confirm=${APPLY_CONFIRMATION}.`);
  }
  if (productFilter !== undefined && !/^\d+$/.test(productFilter)) {
    throw new Error('--product must be a numeric product id.');
  }

  const dbHost = (process.env.DATABASE_URL || '').replace(/^.*@/, '').replace(/\/.*$/, '');
  console.log(`Database host: ${dbHost || '(unknown)'}`);
  console.log(`Mode: ${applyRequested ? 'APPLY' : 'DRY RUN'}`);

  const rows = await prisma.$queryRawUnsafe<RecountRow[]>(
    `
    SELECT
      ps."id", ps."productid", p."puc", ps."platform",
      ps."totalqty", ps."ecomqty", ps."soldqty", ps."damagedqty", ps."availableqty",
      ps."orderedqty", COALESCE(ps."lockqty", 0)::int AS "lockqty", ps."platformstatus",
      COUNT(s."id")::int AS "stock_count",
      COUNT(s."id")::int AS "new_totalqty",
      COUNT(s."id") FILTER (WHERE LOWER(s."stockstatus") = 'available' AND s."ecompublish" = true)::int AS "new_ecomqty",
      COUNT(s."id") FILTER (WHERE LOWER(s."stockstatus") = 'sold')::int AS "new_soldqty",
      COUNT(s."id") FILTER (WHERE LOWER(s."stockstatus") = 'damaged')::int AS "new_damagedqty"
    FROM "platformstock" ps
    JOIN "product" p ON p."id" = ps."productid"
    LEFT JOIN "stock" s
      ON s."puc" = p."puc"
     AND s."platform" = ps."platform"
     AND COALESCE(s."isdeleted", false) = false
     AND COALESCE(s."isarchive", false) = false
    WHERE COALESCE(p."iscombo", false) = false
      AND ($1::bigint IS NULL OR ps."productid" = $1::bigint)
      AND ($2::text IS NULL OR ps."platform" = $2::text)
    GROUP BY ps."id", p."puc"
    ORDER BY ps."productid", ps."platform"
    `,
    productFilter ?? null,
    platformFilter ?? null
  );

  const changes: Array<{ row: RecountRow; data: Record<string, number | string> }> = [];
  const skippedEmpty: RecountRow[] = [];

  for (const row of rows) {
    const newAvailable = Math.max(0, row.new_ecomqty - Number(row.orderedqty) - Number(row.lockqty));
    const data = {
      totalqty: row.new_totalqty,
      ecomqty: row.new_ecomqty,
      soldqty: row.new_soldqty,
      damagedqty: row.new_damagedqty,
      availableqty: newAvailable,
      platformstatus: platformStatus(newAvailable),
    };
    const differs =
      row.totalqty !== data.totalqty ||
      row.ecomqty !== data.ecomqty ||
      row.soldqty !== data.soldqty ||
      row.damagedqty !== data.damagedqty ||
      row.availableqty !== data.availableqty ||
      row.platformstatus !== data.platformstatus;
    if (!differs) continue;

    if (row.stock_count === 0 && !includeEmpty) {
      skippedEmpty.push(row);
      continue;
    }
    changes.push({ row, data });
  }

  console.log(`Rows checked: ${rows.length}, need update: ${changes.length}, skipped (no active stocks): ${skippedEmpty.length}`);

  if (changes.length > 0) {
    console.table(
      changes.map(({ row, data }) => ({
        productid: String(row.productid),
        puc: row.puc,
        platform: row.platform,
        ordered: row.orderedqty,
        lock: row.lockqty,
        total: `${row.totalqty} -> ${data.totalqty}`,
        ecom: `${row.ecomqty} -> ${data.ecomqty}`,
        sold: `${row.soldqty} -> ${data.soldqty}`,
        damaged: `${row.damagedqty} -> ${data.damagedqty}`,
        available: `${row.availableqty} -> ${data.availableqty}`,
        status: `${row.platformstatus ?? '-'} -> ${data.platformstatus}`,
      }))
    );
  }
  if (skippedEmpty.length > 0) {
    console.log('Skipped rows with no active stocks (use --include-empty to zero them):');
    console.table(
      skippedEmpty.map((row) => ({
        productid: String(row.productid),
        puc: row.puc,
        platform: row.platform,
        total: row.totalqty,
        ecom: row.ecomqty,
        available: row.availableqty,
      }))
    );
  }

  if (!applyRequested || changes.length === 0) {
    if (!applyRequested && changes.length > 0) {
      console.log(`Dry run only. Re-run with --apply --confirm=${APPLY_CONFIRMATION} to write.`);
    }
    return;
  }

  const now = BigInt(Date.now());
  await prisma.$transaction(
    changes.map(({ row, data }) =>
      prisma.platformStock.update({
        where: { id: row.id },
        data: { ...data, platformstatus: String(data.platformstatus), modifieddate: now },
      })
    )
  );
  console.log(`Updated ${changes.length} platformstock row(s).`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
