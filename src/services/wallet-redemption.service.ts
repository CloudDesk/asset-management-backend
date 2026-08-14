import { Prisma, PrismaClient } from '@prisma/client';
import { ValidationError } from '../utils/errorHandler.js';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export class WalletRedemptionService {
  private prisma = new PrismaClient();

  private async releaseExpired(database: Prisma.TransactionClient | PrismaClient) {
    await database.wallet_reservations.updateMany({
      where: { status: 'reserved', expires_at: { lte: BigInt(Date.now()) } },
      data: { status: 'released', modifieddate: BigInt(Date.now()) },
    });
  }

  private async eligibleCredits(database: Prisma.TransactionClient | PrismaClient, customerId: number, eligibilityBase: number) {
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const nowMs = BigInt(Date.now());
    return database.wallet_credits.findMany({
      where: {
        customer_id: customerId,
        status: { in: ['active', 'partially_used'] },
        remaining_amount: { gt: 0 },
        minimum_cart_amount: { lte: new Prisma.Decimal(eligibilityBase) },
        OR: [{ expires_at: null }, { expires_at: { gte: nowSeconds } }],
      },
      include: {
        reservations: { where: { status: 'reserved', expires_at: { gt: nowMs } }, select: { amount: true } },
      },
      // Spend credits that expire first. Credits without an expiry are kept
      // until all dated credits have been considered.
      orderBy: [
        { expires_at: { sort: 'asc', nulls: 'last' } },
        { id: 'asc' },
      ],
    });
  }

  async quote(customerId: number, eligibilityBase: number, payableAmount: number) {
    if (!Number.isFinite(eligibilityBase) || eligibilityBase < 0 || !Number.isFinite(payableAmount) || payableAmount < 0) {
      throw new ValidationError('INVALID_WALLET_QUOTE_AMOUNTS');
    }
    await this.releaseExpired(this.prisma);
    const credits = await this.eligibleCredits(this.prisma, customerId, eligibilityBase);
    const eligibleBalance = money(credits.reduce((total, credit) => {
      const reserved = credit.reservations.reduce((sum, reservation) => sum + Number(reservation.amount), 0);
      return total + Math.max(Number(credit.remaining_amount) - reserved, 0);
    }, 0));
    return { eligible_balance: eligibleBalance, discount_amount: money(Math.min(eligibleBalance, payableAmount)) };
  }

  async reserve(customerId: number, merchantTransactionId: string, eligibilityBase: number, payableAmount: number) {
    if (payableAmount <= 0) throw new ValidationError('INVALID_WALLET_PAYABLE_AMOUNT');
    return this.prisma.$transaction(async (database) => {
      await this.releaseExpired(database);
      const existing = await database.wallet_reservations.findMany({
        where: { merchant_transaction_id: merchantTransactionId, status: 'reserved' },
      });
      if (existing.length > 0) {
        return { discount_amount: money(existing.reduce((sum, reservation) => sum + Number(reservation.amount), 0)) };
      }

      const credits = await this.eligibleCredits(database, customerId, eligibilityBase);
      let outstanding = payableAmount;
      let discount = 0;
      const now = BigInt(Date.now());
      const expiresAt = BigInt(Date.now() + 15 * 60 * 1000);

      for (const credit of credits) {
        if (outstanding <= 0) break;
        const reserved = credit.reservations.reduce((sum, reservation) => sum + Number(reservation.amount), 0);
        const available = Math.max(Number(credit.remaining_amount) - reserved, 0);
        const allocation = money(Math.min(available, outstanding));
        if (allocation <= 0) continue;
        await database.wallet_reservations.create({
          data: {
            customer_id: customerId,
            wallet_credit_id: credit.id,
            merchant_transaction_id: merchantTransactionId,
            amount: new Prisma.Decimal(allocation),
            status: 'reserved',
            expires_at: expiresAt,
            createddate: now,
            modifieddate: now,
          },
        });
        discount = money(discount + allocation);
        outstanding = money(outstanding - allocation);
      }
      return { discount_amount: discount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async consume(merchantTransactionId: string, orderId: number, expectedAmount = 0) {
    return this.prisma.$transaction(async (database) => {
      // A checkout reservation authorizes the quoted credit for 15 minutes.
      // Once that window closes it must be quoted again before consumption.
      await this.releaseExpired(database);
      const reservations = await database.wallet_reservations.findMany({
        where: { merchant_transaction_id: merchantTransactionId, status: 'reserved' },
      });
      if (reservations.length === 0) {
        const consumedReservations = await database.wallet_reservations.findMany({
          where: { merchant_transaction_id: merchantTransactionId, status: 'consumed' },
          select: { amount: true },
        });
        const alreadyConsumed = money(consumedReservations.reduce((sum, reservation) => sum + Number(reservation.amount), 0));
        if (expectedAmount > 0 && alreadyConsumed !== money(expectedAmount)) throw new ValidationError('WALLET_RESERVATION_NOT_AVAILABLE');
        return { consumed_amount: alreadyConsumed };
      }
      const reservedTotal = money(reservations.reduce((sum, reservation) => sum + Number(reservation.amount), 0));
      if (expectedAmount > 0 && reservedTotal !== money(expectedAmount)) throw new ValidationError('WALLET_RESERVATION_CHANGED');
      let consumed = 0;
      for (const reservation of reservations) {
        const credit = await database.wallet_credits.findUniqueOrThrow({ where: { id: reservation.wallet_credit_id } });
        const remaining = money(Number(credit.remaining_amount) - Number(reservation.amount));
        if (remaining < 0) throw new ValidationError('WALLET_BALANCE_CHANGED');
        await database.wallet_credits.update({
          where: { id: credit.id },
          data: {
            remaining_amount: new Prisma.Decimal(remaining),
            status: remaining === 0 ? 'used' : 'partially_used',
            modifieddate: BigInt(Date.now()),
          },
        });
        await database.wallet_reservations.update({
          where: { id: reservation.id },
          data: {
            status: 'consumed',
            order_id: orderId,
            consumed_at: BigInt(Date.now()),
            modifieddate: BigInt(Date.now()),
          },
        });
        consumed = money(consumed + Number(reservation.amount));
      }
      return { consumed_amount: consumed };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async release(merchantTransactionId: string) {
    await this.prisma.wallet_reservations.updateMany({
      where: { merchant_transaction_id: merchantTransactionId, status: 'reserved' },
      data: { status: 'released', modifieddate: BigInt(Date.now()) },
    });
  }

  async restoreForCancelledOrder(
    orderId: number,
    database: Prisma.TransactionClient | PrismaClient = this.prisma,
  ) {
    const reservations = await database.wallet_reservations.findMany({
      where: { order_id: orderId, status: 'consumed' },
      orderBy: { id: 'asc' },
    });
    const now = BigInt(Date.now());
    const currentSeconds = BigInt(Math.floor(Date.now() / 1000));
    let restoredAmount = 0;
    let restoredCount = 0;
    let skippedExpiredAmount = 0;
    let skippedExpiredCount = 0;

    for (const reservation of reservations) {
      const credit = await database.wallet_credits.findUniqueOrThrow({
        where: { id: reservation.wallet_credit_id },
      });
      const creditExpired = Boolean(
        credit.expires_at && credit.expires_at < currentSeconds
      );
      // Promotional wallet value keeps its original expiry. An expired source
      // is intentionally left consumed so it never re-enters wallet balance.
      if (creditExpired) {
        skippedExpiredAmount = money(skippedExpiredAmount + Number(reservation.amount));
        skippedExpiredCount += 1;
        continue;
      }

      const reversed = await database.wallet_reservations.updateMany({
        where: { id: reservation.id, status: 'consumed' },
        data: {
          status: 'reversed',
          reversed_at: now,
          reversal_reason: 'order_cancelled',
          modifieddate: now,
        },
      });
      if (reversed.count !== 1) continue;

      const restoredRemaining = money(Math.min(
        Number(credit.original_amount),
        Number(credit.remaining_amount) + Number(reservation.amount),
      ));
      await database.wallet_credits.update({
        where: { id: credit.id },
        data: {
          remaining_amount: new Prisma.Decimal(restoredRemaining),
          status: restoredRemaining >= Number(credit.original_amount)
              ? 'active'
              : 'partially_used',
          modifieddate: now,
        },
      });
      restoredAmount = money(restoredAmount + Number(reservation.amount));
      restoredCount += 1;
    }

    return {
      restored_amount: restoredAmount,
      restored_count: restoredCount,
      skipped_expired_amount: skippedExpiredAmount,
      skipped_expired_count: skippedExpiredCount,
    };
  }
}
