import { Prisma, PrismaClient } from '@prisma/client';
import { ValidationError } from '../utils/errorHandler.js';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

interface WalletPricingCapacity {
  merchandisePayable: number;
  shippingPayable: number;
}

interface WalletCreditAllocation {
  wallet_credit_id: number;
  source_type: string;
  amount: number;
  merchandise_amount: number;
  shipping_amount: number;
}

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

  private allocateCredits(
    credits: Array<{
      id: number;
      source_type?: string | null;
      remaining_amount: Prisma.Decimal | number;
      reservations: Array<{ amount: Prisma.Decimal | number }>;
    }>,
    payableAmount: number,
    capacity?: WalletPricingCapacity,
  ) {
    let merchandiseOutstanding = money(capacity?.merchandisePayable ?? payableAmount);
    let shippingOutstanding = money(capacity?.shippingPayable ?? 0);
    let legacyOutstanding = money(payableAmount);
    const sourceAware = Boolean(capacity);
    const allocations: WalletCreditAllocation[] = [];
    let eligibleBalance = 0;

    for (const credit of credits) {
      const reserved = credit.reservations.reduce(
        (sum, reservation) => sum + Number(reservation.amount),
        0,
      );
      const available = money(Math.max(Number(credit.remaining_amount) - reserved, 0));
      eligibleBalance = money(eligibleBalance + available);
      if (available <= 0) continue;

      const sourceType = String(credit.source_type || 'coupon');
      if (!sourceAware) {
        const amount = money(Math.min(available, legacyOutstanding));
        if (amount > 0) {
          allocations.push({
            wallet_credit_id: credit.id,
            source_type: sourceType,
            amount,
            merchandise_amount: amount,
            shipping_amount: 0,
          });
          legacyOutstanding = money(legacyOutstanding - amount);
        }
        continue;
      }

      const isRefundCredit = sourceType === 'cancellation_refund' || sourceType === 'return_refund';
      const maximum = isRefundCredit
        ? merchandiseOutstanding + shippingOutstanding
        : merchandiseOutstanding;
      const amount = money(Math.min(available, maximum));
      if (amount <= 0) continue;

      const merchandiseAmount = money(Math.min(amount, merchandiseOutstanding));
      const shippingAmount = money(amount - merchandiseAmount);
      allocations.push({
        wallet_credit_id: credit.id,
        source_type: sourceType,
        amount,
        merchandise_amount: merchandiseAmount,
        shipping_amount: shippingAmount,
      });
      merchandiseOutstanding = money(merchandiseOutstanding - merchandiseAmount);
      shippingOutstanding = money(shippingOutstanding - shippingAmount);
    }

    return {
      eligible_balance: eligibleBalance,
      discount_amount: money(allocations.reduce((sum, allocation) => sum + allocation.amount, 0)),
      merchandise_discount_amount: money(
        allocations.reduce((sum, allocation) => sum + allocation.merchandise_amount, 0),
      ),
      shipping_discount_amount: money(
        allocations.reduce((sum, allocation) => sum + allocation.shipping_amount, 0),
      ),
      allocations,
    };
  }

  async quote(
    customerId: number,
    eligibilityBase: number,
    payableAmount: number,
    capacity?: WalletPricingCapacity,
  ) {
    if (!Number.isFinite(eligibilityBase) || eligibilityBase < 0 || !Number.isFinite(payableAmount) || payableAmount < 0) {
      throw new ValidationError('INVALID_WALLET_QUOTE_AMOUNTS');
    }
    if (capacity && (
      !Number.isFinite(capacity.merchandisePayable) || capacity.merchandisePayable < 0 ||
      !Number.isFinite(capacity.shippingPayable) || capacity.shippingPayable < 0 ||
      money(capacity.merchandisePayable + capacity.shippingPayable) !== money(payableAmount)
    )) throw new ValidationError('INVALID_WALLET_QUOTE_CAPACITY');
    await this.releaseExpired(this.prisma);
    const credits = await this.eligibleCredits(this.prisma, customerId, eligibilityBase);
    const quote = this.allocateCredits(credits, payableAmount, capacity);
    return capacity
      ? quote
      : {
          eligible_balance: quote.eligible_balance,
          discount_amount: quote.discount_amount,
        };
  }

  async reserve(
    customerId: number,
    merchantTransactionId: string,
    eligibilityBase: number,
    merchandisePayable: number,
    shippingPayable = 0,
  ) {
    const payableAmount = money(merchandisePayable + shippingPayable);
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
      const quote = this.allocateCredits(credits, payableAmount, {
        merchandisePayable,
        shippingPayable,
      });
      const now = BigInt(Date.now());
      const expiresAt = BigInt(Date.now() + 15 * 60 * 1000);

      for (const allocation of quote.allocations) {
        await database.wallet_reservations.create({
          data: {
            customer_id: customerId,
            wallet_credit_id: allocation.wallet_credit_id,
            merchant_transaction_id: merchantTransactionId,
            amount: new Prisma.Decimal(allocation.amount),
            status: 'reserved',
            expires_at: expiresAt,
            createddate: now,
            modifieddate: now,
          },
        });
      }
      return quote;
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
