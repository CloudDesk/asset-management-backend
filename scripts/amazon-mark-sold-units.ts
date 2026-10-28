/**
 * Mark the stock units of Amazon sales that shipped before FIX-2026-10-28-174 (AMZ-PLAN-28 P3).
 *
 * Before FIX-174 a shipped seller-fulfilled Amazon order moved only the platformstock counters
 * (orderedqty −, soldqty +): its unit rows stayed 'available' and ecomqty was not lowered, so the next
 * stock-in or recount brought the sold units back. This script finds SOLD seller reservations with fewer
 * linked units than their quantity and marks the missing ones with the same rule as the live code
 * (oldest available, e-com published Amazon units first; sold date = the reservation's sold date), then
 * lowers ecomqty / product ecompublishedquantity by the units marked. soldqty / orderedqty already moved.
 *
 * Needs scripts/migrations/20261028_amazon_sold_stock_units.sql first (stops otherwise).
 *
 * 1. Dry run (default, changes nothing): what would be marked, per order line
 *      npm run amazon:sold-units -- <sit|uat|prod>
 *    → scripts/dryrun-logs/amazon-sold-units-<env>-<timestamp>.json
 *    Check "unlinked sold units" per product: if the team also recorded these sales with the manual
 *    `npm run sold:update`, their units are already sold — do not apply for those lines.
 * 2. Apply (Prod: take a backup first):
 *      npm run amazon:sold-units -- <env> --apply --confirm=NIVAANA_AMAZON_SOLD_UNITS
 *    Optional --order=<amazonOrderId> to do one order.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ENVIRONMENTS,
  assertExpectedDatabase,
  backendRoot,
  parseEnvName,
  readRawDatabaseUrl,
  type EnvName,
} from './lib/release-environments.js';

const CONFIRMATION = 'NIVAANA_AMAZON_SOLD_UNITS';
const outputDir = path.join(backendRoot, 'scripts/dryrun-logs');

function parseArgs(argv: string[]) {
  const flag = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  return {
    env: parseEnvName(argv.find((arg) => !arg.startsWith('--'))),
    apply: argv.includes('--apply'),
    confirm: flag('confirm'),
    order: flag('order'),
  };
}

// Point Prisma at the chosen database before anything imports the client
async function connect(env: EnvName) {
  process.env.DATABASE_URL = readRawDatabaseUrl(ENVIRONMENTS[env].envFile);
  const { prisma } = await import('../src/models/prisma.js');
  const [row] = await prisma.$queryRawUnsafe<Array<{ db: string }>>('SELECT current_database() AS db');
  const db = row?.db ?? '';
  console.log(`Environment: ${env}  (${ENVIRONMENTS[env].envFile})  →  database: ${db}`);
  assertExpectedDatabase(env, db);
  return { prisma, db };
}

type Line = {
  reservationId: bigint;
  amazonOrderId: string;
  puc: string;
  productId: bigint;
  platformStockId: bigint | null;
  quantity: number;
  linked: number;
  toMark: number;
  soldAt: Date | null;
  availableUnits: number;
  unlinkedSoldUnits: number;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.apply && options.confirm !== CONFIRMATION) throw new Error(`Applying needs --confirm=${CONFIRMATION}`);

  const { prisma, db } = await connect(options.env);
  try {
    const { amazonStockUnitStore, sellAmazonUnits } = await import('../src/services/amazon-stock-units.service.js');
    if (!(await amazonStockUnitStore.linkColumnReady(prisma as any))) {
      throw new Error('stock."amazonReservationId" is missing: run scripts/migrations/20261028_amazon_sold_stock_units.sql on this database first');
    }

    // SOLD seller lines with fewer linked units than their quantity
    const rows = await prisma.$queryRawUnsafe<Array<{
      reservation_id: bigint; amazon_order_id: string; puc: string; product_id: bigint; platform_stock_id: bigint | null;
      quantity: number; linked: number; sold_at: Date | null;
    }>>(
      `SELECT r.id AS reservation_id, o."amazonOrderId" AS amazon_order_id, p.puc, r."productId" AS product_id,
              r."platformStockId" AS platform_stock_id, r.quantity, r."soldAt" AS sold_at,
              (SELECT COUNT(*)::int FROM stock s WHERE s."amazonReservationId" = r.id) AS linked
         FROM amazon_order_stock_reservations r
         JOIN amazon_marketplace_orders o ON o.id = r."orderId"
         JOIN product p ON p.id = r."productId"
        WHERE r.status = 'SOLD' AND r."inventoryOwnership" = 'SELLER'
          AND ($1::text IS NULL OR o."amazonOrderId" = $1)
        ORDER BY r."soldAt" ASC NULLS LAST, r.id ASC`,
      options.order ?? null,
    );
    const lines: Line[] = [];
    for (const row of rows) {
      const toMark = row.quantity - row.linked;
      if (toMark <= 0) continue;
      const [counts] = await prisma.$queryRawUnsafe<Array<{ available: number; unlinked_sold: number }>>(
        `SELECT COUNT(*) FILTER (WHERE LOWER(stockstatus) = 'available' AND ecompublish = true)::int AS available,
                COUNT(*) FILTER (WHERE LOWER(stockstatus) = 'sold' AND "amazonReservationId" IS NULL)::int AS unlinked_sold
           FROM stock
          WHERE puc = $1 AND LOWER(platform) = 'amazon'
            AND COALESCE(isdeleted, false) = false AND COALESCE(isarchive, false) = false`,
        row.puc,
      );
      lines.push({
        reservationId: BigInt(row.reservation_id), amazonOrderId: row.amazon_order_id, puc: row.puc, productId: BigInt(row.product_id),
        platformStockId: row.platform_stock_id === null ? null : BigInt(row.platform_stock_id), quantity: row.quantity,
        linked: row.linked, toMark, soldAt: row.sold_at, availableUnits: counts?.available ?? 0, unlinkedSoldUnits: counts?.unlinked_sold ?? 0,
      });
    }

    console.log(`\nSOLD seller lines checked: ${rows.length}; lines with units to mark: ${lines.length}`);
    for (const line of lines) {
      console.log(`  ${line.amazonOrderId}  ${line.puc.padEnd(10)} sold ${line.soldAt?.toISOString().slice(0, 10) ?? '—'}  `
        + `to mark ${line.toMark} of ${line.quantity}  (available Amazon units ${line.availableUnits}, unlinked sold units ${line.unlinkedSoldUnits})`
        + (line.availableUnits < line.toMark ? '  ⚠ not enough units: the rest will be reported' : ''));
    }

    const results: Array<{ reservationId: string; marked?: number; missing?: number; note?: string | null; error?: string }> = [];
    if (options.apply) {
      const { Prisma } = await import('@prisma/client');
      for (const line of lines) {
        try {
          const outcome = await prisma.$transaction(async (tx) => {
            const units = await sellAmazonUnits(tx, {
              reservationId: line.reservationId, puc: line.puc, quantity: line.toMark,
              amazonOrderId: line.amazonOrderId, soldAt: line.soldAt ?? new Date(),
            });
            if (units.moved > 0 && line.platformStockId !== null) {
              const stock = await tx.platformStock.findUnique({ where: { id: line.platformStockId }, select: { ecomqty: true } });
              await tx.platformStock.update({
                where: { id: line.platformStockId },
                data: { ecomqty: Math.max(0, Number(stock?.ecomqty ?? 0) - units.moved), modifieddate: BigInt(Date.now()) },
              });
            }
            if (units.moved > 0) {
              const product = await tx.product.findUnique({ where: { id: line.productId }, select: { ecompublishedquantity: true } });
              await tx.product.update({
                where: { id: line.productId },
                data: { ecompublishedquantity: Math.max(0, Number(product?.ecompublishedquantity ?? 0) - units.moved), modifieddate: BigInt(Date.now()) },
              });
            }
            if (units.note) {
              await tx.amazonOrderStockReservation.update({ where: { id: line.reservationId }, data: { errorMessage: units.note } });
            }
            return units;
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
          results.push({ reservationId: String(line.reservationId), marked: outcome.moved, missing: outcome.missing, note: outcome.note });
          console.log(`  ✔ ${line.amazonOrderId} ${line.puc}: marked ${outcome.moved}${outcome.missing ? `, missing ${outcome.missing}` : ''}`);
        } catch (error: any) {
          results.push({ reservationId: String(line.reservationId), error: error?.message ?? String(error) });
          console.log(`  ✘ ${line.amazonOrderId} ${line.puc}: ${error?.message ?? error}`);
        }
      }
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const out = path.join(outputDir, `amazon-sold-units-${options.env}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(out, JSON.stringify({ environment: options.env, database: db, applied: options.apply, lines, results },
      (_key, value) => (typeof value === 'bigint' ? String(value) : value), 2));
    const failed = results.filter((result) => result.error).length;
    console.log(`\n${options.apply ? `Done: ${results.length - failed} line(s), failed ${failed}` : `Dry run only — add --apply --confirm=${CONFIRMATION} to mark`}. Log: ${path.relative(backendRoot, out)}`);
    console.log('Afterwards: recount Amazon platform stock (scripts/recount-platform-stock.ts --platform=amazon, dry run first).');
    if (failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
