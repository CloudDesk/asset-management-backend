import { Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';

/**
 * AMZ-PLAN-28: an Amazon sale moves physical stock units, like a website order at Ready for Dispatch
 * (INV-16). A shipped seller-fulfilled order marks the oldest available, e-com published Amazon units of
 * the product 'sold' and links them to the stock reservation (stock."amazonReservationId"); a return puts
 * the same units back to 'available' or marks them 'damaged'. Without this the next stock-in or recount
 * brought sold units back, because the counters are rebuilt from the unit rows.
 *
 * The link column is added by scripts/migrations/20261028_amazon_sold_stock_units.sql and is deliberately
 * not in the Prisma Stock model (a missing column must not break the Stocks screens). Every query here is
 * raw SQL; when the column is missing, nothing is marked and the caller keeps the old counter-only result.
 */

type Tx = Prisma.TransactionClient;

export const MIGRATION_MISSING_NOTE = 'Stock units not marked: database migration 20261028_amazon_sold_stock_units.sql has not run';

/** Raw SQL for the stock unit rows; tests replace these methods */
export const amazonStockUnitStore = {
  async linkColumnReady(tx: Tx): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'stock' AND column_name = 'amazonReservationId'
      ) AS ready`;
    return rows[0]?.ready === true;
  },

  /** Oldest available, e-com published Amazon units of the product; locked, skipping units another order holds */
  async pickAvailable(tx: Tx, puc: string, quantity: number): Promise<bigint[]> {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM stock
       WHERE puc = ${puc}
         AND LOWER(platform) = 'amazon'
         AND LOWER(stockstatus) = 'available'
         AND ecompublish = true
         AND COALESCE(isdeleted, false) = false
         AND COALESCE(isarchive, false) = false
       ORDER BY createddate ASC NULLS LAST, id ASC
       LIMIT ${quantity}
       FOR UPDATE SKIP LOCKED`;
    return rows.map((row) => BigInt(row.id));
  },

  async markSold(tx: Tx, ids: bigint[], input: { reservationId: bigint; soldAt: bigint; note: string }): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      UPDATE stock
         SET stockstatus = 'sold',
             solddate = ${input.soldAt},
             "amazonReservationId" = ${input.reservationId},
             description = CASE WHEN COALESCE(description, '') = '' THEN ${input.note} ELSE description || ' | ' || ${input.note} END,
             modifieddate = ${BigInt(Date.now())}
       WHERE id = ANY(${ids}::bigint[]) AND LOWER(stockstatus) = 'available'
       RETURNING id`;
    return rows.length;
  },

  /** Sold units of a return: first those linked to the order's reservations, then (sold before AMZ-PLAN-28) unlinked sold Amazon units */
  async pickSoldForReturn(tx: Tx, puc: string, reservationIds: bigint[], quantity: number): Promise<{ linked: bigint[]; unlinked: bigint[] }> {
    const linked = reservationIds.length === 0 ? [] : (await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM stock
       WHERE "amazonReservationId" = ANY(${reservationIds}::bigint[]) AND LOWER(stockstatus) = 'sold'
       ORDER BY solddate DESC NULLS LAST, id DESC
       LIMIT ${quantity}
       FOR UPDATE`).map((row) => BigInt(row.id));
    const rest = quantity - linked.length;
    const unlinked = rest <= 0 ? [] : (await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM stock
       WHERE puc = ${puc}
         AND LOWER(platform) = 'amazon'
         AND LOWER(stockstatus) = 'sold'
         AND "amazonReservationId" IS NULL
         AND COALESCE(isdeleted, false) = false
         AND COALESCE(isarchive, false) = false
       ORDER BY solddate DESC NULLS LAST, id DESC
       LIMIT ${rest}
       FOR UPDATE SKIP LOCKED`).map((row) => BigInt(row.id));
    return { linked, unlinked };
  },

  async markReturned(tx: Tx, ids: bigint[], to: 'available' | 'damaged', note: string): Promise<number> {
    if (ids.length === 0) return 0;
    const restock = to === 'available';
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      UPDATE stock
         SET stockstatus = ${to},
             ecompublish = CASE WHEN ${restock} THEN true ELSE ecompublish END,
             solddate = CASE WHEN ${restock} THEN NULL ELSE solddate END,
             "amazonReservationId" = CASE WHEN ${restock} THEN NULL ELSE "amazonReservationId" END,
             description = CASE WHEN COALESCE(description, '') = '' THEN ${note} ELSE description || ' | ' || ${note} END,
             modifieddate = ${BigInt(Date.now())}
       WHERE id = ANY(${ids}::bigint[]) AND LOWER(stockstatus) = 'sold'
       RETURNING id`;
    return rows.length;
  },
};

export type AmazonUnitResult = {
  /** Units moved */
  moved: number;
  /** Units the order needed but no unit row could be found for */
  missing: number;
  /** Set when units could not be marked at all (migration missing) or some were missing */
  note: string | null;
};

const ready = async (tx: Tx) => {
  const ok = await amazonStockUnitStore.linkColumnReady(tx);
  if (!ok) logger.warn({ plan: 'AMZ-PLAN-28' }, MIGRATION_MISSING_NOTE);
  return ok;
};

/**
 * Shipped Amazon order line (one reservation; a combo has one per component): mark `quantity` units sold.
 * Throws when a picked unit changed under us, so the caller's transaction rolls back and is retried.
 */
export async function sellAmazonUnits(tx: Tx, input: {
  reservationId: bigint;
  puc: string;
  quantity: number;
  amazonOrderId: string;
  soldAt?: Date;
}): Promise<AmazonUnitResult> {
  if (input.quantity <= 0) return { moved: 0, missing: 0, note: null };
  if (!(await ready(tx))) return { moved: 0, missing: 0, note: MIGRATION_MISSING_NOTE };
  const ids = await amazonStockUnitStore.pickAvailable(tx, input.puc, input.quantity);
  const moved = await amazonStockUnitStore.markSold(tx, ids, {
    reservationId: input.reservationId,
    soldAt: BigInt((input.soldAt ?? new Date()).getTime()),
    note: `Sold on Amazon order ${input.amazonOrderId}`,
  });
  if (moved !== ids.length) throw new Error(`Amazon stock units of ${input.puc} changed while selling; try again`);
  const missing = input.quantity - moved;
  return {
    moved,
    missing,
    note: missing > 0
      ? `${missing} of ${input.quantity} unit(s) of ${input.puc} had no available Amazon stock row to mark sold; correct the Amazon stock rows`
      : null,
  };
}

/** Received Amazon return of one product (a combo: called per component): units back to available, or damaged */
export async function returnAmazonUnits(tx: Tx, input: {
  orderId: bigint | null;
  productId: bigint;
  puc: string;
  quantity: number;
  to: 'available' | 'damaged';
  amazonOrderId: string;
}): Promise<AmazonUnitResult> {
  if (input.quantity <= 0) return { moved: 0, missing: 0, note: null };
  if (!(await ready(tx))) return { moved: 0, missing: 0, note: MIGRATION_MISSING_NOTE };
  const reservationIds = input.orderId === null ? [] : (await tx.amazonOrderStockReservation.findMany({
    where: { orderId: input.orderId, productId: input.productId, inventoryOwnership: 'SELLER', status: 'SOLD' },
    select: { id: true },
  })).map((row) => row.id);
  const { linked, unlinked } = await amazonStockUnitStore.pickSoldForReturn(tx, input.puc, reservationIds, input.quantity);
  const ids = [...linked, ...unlinked];
  const moved = await amazonStockUnitStore.markReturned(tx, ids, input.to,
    `${input.to === 'available' ? 'Returned' : 'Returned damaged'} — Amazon order ${input.amazonOrderId}`);
  if (moved !== ids.length) throw new Error(`Amazon stock units of ${input.puc} changed while receiving the return; try again`);
  const missing = input.quantity - moved;
  return {
    moved,
    missing,
    note: missing > 0
      ? `${missing} of ${input.quantity} returned unit(s) of ${input.puc} have no sold Amazon stock row; add them with Add Stock`
      : null,
  };
}
