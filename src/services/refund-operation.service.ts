import { Prisma, PrismaClient } from '@prisma/client';
import { ValidationError } from '../utils/errorHandler.js';
import {
  calculateCancellationRefundBreakdown,
  calculateReturnRefundBreakdown,
  isRefundWalletSourceExpired,
} from '../utils/refund-allocation.js';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));
const nowMillis = () => BigInt(Date.now());

export type RefundDestination = 'original_sources' | 'wallet';

export interface InitiateCancellationRefundInput {
  destination: RefundDestination;
  consent_accepted?: boolean | undefined;
  consent_channel?: 'call' | 'whatsapp' | 'email' | 'support_ticket' | 'in_app' | 'other' | undefined;
  consent_reference?: string | undefined;
  consent_notes?: string | undefined;
  admin_user_id: number;
}

export interface InitiateReturnRefundInput extends InitiateCancellationRefundInput {
  approved_amount: number;
  return_request_id: number;
  resolution_action_id: number;
  return_request_number?: string | null;
}

interface WalletSourceAllocation {
  reservationId: number;
  creditId: number;
  couponCode: string | null;
  couponName: string | null;
  amount: number;
  expiresAt: number | null;
  expired: boolean;
  reservationStatus: string;
}

export class RefundOperationService {
  private prisma = new PrismaClient();

  private async getOrder(orderId: number) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new ValidationError('ORDER_NOT_FOUND');
    return order;
  }

  private async getWalletSources(orderId: number): Promise<WalletSourceAllocation[]> {
    const reservations = await this.prisma.wallet_reservations.findMany({
      where: { order_id: orderId, status: { in: ['consumed', 'reversed'] } },
      include: {
        credit: {
          include: {
            assignment: { include: { promotion: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    const currentSeconds = Number(nowSeconds());
    return reservations.map((reservation: any) => {
      const expiresAt = reservation.credit?.expires_at ? Number(reservation.credit.expires_at) : null;
      return {
        reservationId: reservation.id,
        creditId: reservation.wallet_credit_id,
        couponCode: reservation.credit?.assignment?.voucher_code || null,
        couponName: reservation.credit?.assignment?.promotion?.name || reservation.credit?.label || null,
        amount: money(Number(reservation.amount)),
        expiresAt,
        expired: isRefundWalletSourceExpired(expiresAt, currentSeconds),
        reservationStatus: reservation.status,
      };
    });
  }

  async previewCancellation(orderId: number) {
    const order = await this.getOrder(orderId);
    const allowedStatuses = ['cancelled', 'cancelled_refund_processing', 'cancelled_refunded'];
    if (!order.orderstatus || !allowedStatuses.includes(order.orderstatus)) {
      throw new ValidationError(
        'CANCELLATION_REFUND_NOT_READY',
        `Cancellation refund is available only after cancellation is confirmed. Current status: ${order.orderstatus || 'unknown'}`,
      );
    }

    const walletSources = await this.getWalletSources(orderId);
    const totals = calculateCancellationRefundBreakdown(
      order.ispaymentsucceed && String(order.mode || '').toLowerCase() !== 'cod'
        ? Number(order.orderamount || 0)
        : 0,
      walletSources,
      Number(nowSeconds()),
    );
    const { originalWalletAmount, eligibleWalletAmount, expiredWalletAmount, onlineAmount, approvedAmount } = totals;

    return {
      order_id: order.id,
      order_number: order.orderid,
      order_status: order.orderstatus,
      payment_mode: order.mode,
      approved_amount: approvedAmount,
      original_wallet_amount: originalWalletAmount,
      eligible_wallet_amount: eligibleWalletAmount,
      expired_wallet_amount: expiredWalletAmount,
      online_amount: onlineAmount,
      original_sources: {
        wallet_credit_amount: eligibleWalletAmount,
        phonepe_refund_amount: onlineAmount,
        expired_not_restored_amount: expiredWalletAmount,
        customer_receives_amount: money(eligibleWalletAmount + onlineAmount),
      },
      wallet: {
        restored_coupon_amount: eligibleWalletAmount,
        non_expiring_refund_credit_amount: onlineAmount,
        expired_not_restored_amount: expiredWalletAmount,
        customer_receives_amount: money(eligibleWalletAmount + onlineAmount),
        consent_required: onlineAmount > 0,
      },
      wallet_sources: walletSources.map((source) => ({
        reservation_id: source.reservationId,
        credit_id: Number(source.creditId),
        coupon_code: source.couponCode,
        coupon_name: source.couponName,
        amount: source.amount,
        expires_at: source.expiresAt,
        status: source.expired ? 'skipped_expired' : 'eligible_for_restoration',
      })),
    };
  }

  async initiateCancellationRefund(orderId: number, input: InitiateCancellationRefundInput) {
    const order = await this.getOrder(orderId);
    if (!order.userid) throw new ValidationError('ORDER_CUSTOMER_UNAVAILABLE');
    const preview = await this.previewCancellation(orderId);
    if (input.destination === 'wallet' && preview.online_amount > 0) {
      if (!input.consent_accepted || !input.consent_channel) {
        throw new ValidationError(
          'CUSTOMER_CONSENT_REQUIRED',
          'Customer consent and consent channel are required before converting online payment into wallet credit',
        );
      }
    }

    const existing = await (this.prisma as any).refundOperation.findUnique({
      where: { idempotencyKey: `cancellation:${orderId}` },
    });
    if (existing) {
      if (existing.destination !== input.destination) {
        throw new ValidationError(
          'REFUND_ALREADY_INITIATED',
          `This cancellation refund was already initiated using ${String(existing.destination).replace(/_/g, ' ')}`,
        );
      }
      return existing;
    }

    const walletSources = await this.getWalletSources(orderId);
    const timestamp = nowMillis();
    const operationNumber = `CRF-${orderId}-${Date.now()}`;
    const operation = await this.prisma.$transaction(async (database: any) => {
      const created = await database.refundOperation.create({
        data: {
          operationNumber,
          idempotencyKey: `cancellation:${orderId}`,
          orderId,
          customerId: Number(order.userid),
          triggerType: 'cancellation',
          destination: input.destination,
          approvedAmount: new Prisma.Decimal(preview.approved_amount),
          originalWalletAmount: new Prisma.Decimal(preview.original_wallet_amount),
          eligibleWalletAmount: new Prisma.Decimal(preview.eligible_wallet_amount),
          expiredWalletAmount: new Prisma.Decimal(preview.expired_wallet_amount),
          onlineAmount: new Prisma.Decimal(preview.online_amount),
          nonExpiringWalletAmount: new Prisma.Decimal(input.destination === 'wallet' ? preview.online_amount : 0),
          walletCreditedAmount: new Prisma.Decimal(0),
          phonepeRefundAmount: new Prisma.Decimal(input.destination === 'original_sources' ? preview.online_amount : 0),
          walletStatus: preview.eligible_wallet_amount > 0 || input.destination === 'wallet' ? 'processing' : 'not_required',
          phonepeStatus: input.destination === 'original_sources' && preview.online_amount > 0 ? 'pending' : 'not_required',
          status: 'processing',
          consentAccepted: Boolean(input.consent_accepted),
          consentChannel: input.consent_channel || null,
          consentReference: input.consent_reference || null,
          consentNotes: input.consent_notes || null,
          consentAt: input.consent_accepted ? timestamp : null,
          breakdown: preview,
          createdBy: input.admin_user_id,
          createddate: timestamp,
          modifieddate: timestamp,
        },
      });

      for (const source of walletSources) {
        if (source.expired) {
          await database.refundWalletAllocation.create({
            data: {
              refundOperationId: created.id,
              reservationId: source.reservationId,
              sourceCreditId: source.creditId,
              allocationType: 'coupon_restore',
              amount: new Prisma.Decimal(source.amount),
              status: 'skipped_expired',
              expiresAt: source.expiresAt ? BigInt(source.expiresAt) : null,
              metadata: { reason: 'original_wallet_credit_expired' },
              createddate: timestamp,
              modifieddate: timestamp,
            },
          });
          continue;
        }

        await database.refundWalletAllocation.create({
          data: {
            refundOperationId: created.id,
            reservationId: source.reservationId,
            sourceCreditId: source.creditId,
            targetCreditId: null,
            allocationType: 'coupon_restore',
            amount: new Prisma.Decimal(source.amount),
            status: 'pending',
            expiresAt: source.expiresAt ? BigInt(source.expiresAt) : null,
            metadata: { credit_on_refund_completion: true, reservation_status: source.reservationStatus },
            createddate: timestamp,
            modifieddate: timestamp,
          },
        });
      }

      const hasWalletWork = preview.eligible_wallet_amount > 0 || (input.destination === 'wallet' && preview.online_amount > 0);
      return database.refundOperation.update({
        where: { id: created.id },
        data: {
          walletCreditedAmount: new Prisma.Decimal(0),
          walletStatus: hasWalletWork ? 'pending' : 'not_required',
          status: 'processing',
          completeddate: null,
          modifieddate: timestamp,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return operation;
  }

  async previewReturnRefund(orderId: number, returnRequestId: number, approvedAmount: number) {
    const order = await this.getOrder(orderId);
    const request = await (this.prisma as any).returnRequest.findUnique({
      where: { id: returnRequestId },
      select: { id: true, orderid: true, customerid: true, requestnumber: true },
    });
    if (!request || Number(request.orderid) !== orderId) {
      throw new ValidationError('RETURN_REQUEST_ORDER_MISMATCH');
    }

    const walletSources = await this.getWalletSources(orderId);
    const priorOperations = await (this.prisma as any).refundOperation.findMany({
      where: {
        orderId,
        triggerType: 'return',
        status: { in: ['pending', 'processing', 'completed', 'partial_failed'] },
      },
      select: { id: true, onlineAmount: true },
    });
    const priorOperationIds = priorOperations.map((operation: any) => operation.id);
    const priorAllocations = priorOperationIds.length
      ? await (this.prisma as any).refundWalletAllocation.findMany({
          where: {
            refundOperationId: { in: priorOperationIds },
            allocationType: 'coupon_restore',
            reservationId: { not: null },
          },
          select: { reservationId: true, amount: true },
        })
      : [];
    const usedByReservation = new Map<number, number>();
    for (const allocation of priorAllocations) {
      const reservationId = Number(allocation.reservationId);
      usedByReservation.set(
        reservationId,
        money((usedByReservation.get(reservationId) || 0) + Number(allocation.amount || 0)),
      );
    }
    const availableWalletSources = walletSources.map((source) => ({
      ...source,
      availableAmount: money(Math.max(0, source.amount - (usedByReservation.get(source.reservationId) || 0))),
    }));
    const originalOnlineAmount = order.ispaymentsucceed && String(order.mode || '').toLowerCase() !== 'cod'
      ? Number(order.orderamount || 0)
      : 0;
    const previouslyAllocatedOnline = money(priorOperations.reduce(
      (sum: number, operation: any) => sum + Number(operation.onlineAmount || 0),
      0,
    ));
    const onlineAvailable = money(Math.max(0, originalOnlineAmount - previouslyAllocatedOnline));
    const totals = calculateReturnRefundBreakdown(
      approvedAmount,
      onlineAvailable,
      availableWalletSources,
      Number(nowSeconds()),
    );

    return {
      order_id: order.id,
      order_number: order.orderid,
      return_request_id: returnRequestId,
      return_request_number: request.requestnumber,
      payment_mode: order.mode,
      approved_amount: totals.approvedAmount,
      requested_refund_amount: money(approvedAmount),
      original_wallet_amount: totals.originalWalletAmount,
      eligible_wallet_amount: totals.eligibleWalletAmount,
      expired_wallet_amount: totals.expiredWalletAmount,
      online_amount: totals.onlineAmount,
      original_sources: {
        wallet_credit_amount: totals.eligibleWalletAmount,
        phonepe_refund_amount: totals.onlineAmount,
        expired_not_restored_amount: totals.expiredWalletAmount,
        customer_receives_amount: totals.customerReceivesAmount,
      },
      wallet: {
        restored_coupon_amount: totals.eligibleWalletAmount,
        non_expiring_refund_credit_amount: totals.onlineAmount,
        expired_not_restored_amount: totals.expiredWalletAmount,
        customer_receives_amount: totals.customerReceivesAmount,
        consent_required: totals.onlineAmount > 0,
      },
      wallet_sources: totals.walletAllocations.map((source) => ({
        reservation_id: source.reservationId,
        credit_id: Number(source.creditId),
        coupon_code: source.couponCode,
        coupon_name: source.couponName,
        original_amount: source.amount,
        available_amount: source.availableAmount,
        allocated_amount: source.allocatedAmount,
        expires_at: source.expiresAt,
        status: source.expired ? 'skipped_expired' : 'eligible_for_restoration',
      })),
    };
  }

  async initiateReturnRefund(orderId: number, input: InitiateReturnRefundInput) {
    const order = await this.getOrder(orderId);
    if (!order.userid) throw new ValidationError('ORDER_CUSTOMER_UNAVAILABLE');
    const idempotencyKey = `return:${input.return_request_id}`;
    const existing = await (this.prisma as any).refundOperation.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.destination !== input.destination) {
        throw new ValidationError(
          'REFUND_ALREADY_INITIATED',
          `This return refund was already initiated using ${String(existing.destination).replace(/_/g, ' ')}`,
        );
      }
      return existing;
    }
    const preview = await this.previewReturnRefund(orderId, input.return_request_id, input.approved_amount);
    if (preview.approved_amount !== money(input.approved_amount)) {
      throw new ValidationError(
        'REFUND_EXCEEDS_REMAINING_PAYMENT_SOURCES',
        `Only ${preview.approved_amount} remains refundable across the original payment sources`,
      );
    }
    if (input.destination === 'wallet' && preview.online_amount > 0 && (!input.consent_accepted || !input.consent_channel)) {
      throw new ValidationError(
        'CUSTOMER_CONSENT_REQUIRED',
        'Customer consent and consent channel are required before converting online payment into wallet credit',
      );
    }

    const timestamp = nowMillis();
    const operationNumber = `RRF-${input.return_request_id}-${Date.now()}`;
    const operation = await this.prisma.$transaction(async (database: any) => {
      const created = await database.refundOperation.create({
        data: {
          operationNumber,
          idempotencyKey,
          orderId,
          returnRequestId: input.return_request_id,
          resolutionActionId: input.resolution_action_id,
          customerId: Number(order.userid),
          triggerType: 'return',
          destination: input.destination,
          approvedAmount: new Prisma.Decimal(preview.approved_amount),
          originalWalletAmount: new Prisma.Decimal(preview.original_wallet_amount),
          eligibleWalletAmount: new Prisma.Decimal(preview.eligible_wallet_amount),
          expiredWalletAmount: new Prisma.Decimal(preview.expired_wallet_amount),
          onlineAmount: new Prisma.Decimal(preview.online_amount),
          nonExpiringWalletAmount: new Prisma.Decimal(input.destination === 'wallet' ? preview.online_amount : 0),
          walletCreditedAmount: new Prisma.Decimal(0),
          phonepeRefundAmount: new Prisma.Decimal(input.destination === 'original_sources' ? preview.online_amount : 0),
          walletStatus: preview.eligible_wallet_amount > 0 || input.destination === 'wallet' ? 'processing' : 'not_required',
          phonepeStatus: input.destination === 'original_sources' && preview.online_amount > 0 ? 'pending' : 'not_required',
          status: 'processing',
          consentAccepted: Boolean(input.consent_accepted),
          consentChannel: input.consent_channel || null,
          consentReference: input.consent_reference || null,
          consentNotes: input.consent_notes || null,
          consentAt: input.consent_accepted ? timestamp : null,
          breakdown: preview,
          createdBy: input.admin_user_id,
          createddate: timestamp,
          modifieddate: timestamp,
        },
      });

      let restoredAmount = 0;
      for (const source of preview.wallet_sources) {
        const amount = money(Number(source.allocated_amount || 0));
        if (amount <= 0) continue;
        const expired = source.status === 'skipped_expired';
        await database.refundWalletAllocation.create({
          data: {
            refundOperationId: created.id,
            reservationId: source.reservation_id,
            sourceCreditId: source.credit_id,
            targetCreditId: null,
            allocationType: 'coupon_restore',
            amount: new Prisma.Decimal(amount),
            status: expired ? 'skipped_expired' : 'pending',
            expiresAt: source.expires_at ? BigInt(source.expires_at) : null,
            metadata: expired
              ? { reason: 'original_wallet_credit_expired', partial_return: true }
              : { partial_return: true, credit_on_refund_completion: true },
            createddate: timestamp,
            modifieddate: timestamp,
          },
        });
      }

      let nonExpiringCreditAmount = 0;

      const walletCreditedAmount = money(restoredAmount + nonExpiringCreditAmount);
      const hasWalletWork = preview.eligible_wallet_amount > 0 || (input.destination === 'wallet' && preview.online_amount > 0);
      return database.refundOperation.update({
        where: { id: created.id },
        data: {
          walletCreditedAmount: new Prisma.Decimal(walletCreditedAmount),
          walletStatus: hasWalletWork ? 'pending' : 'not_required',
          status: 'processing',
          completeddate: null,
          modifieddate: timestamp,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return operation;
  }

  async finalizeRefundOperation(operationId: number, markPhonePeCompleted = false, refundReference?: string | null) {
    const timestamp = nowMillis();
    return this.prisma.$transaction(async (database: any) => {
      const operation = await database.refundOperation.findUnique({ where: { id: operationId } });
      if (!operation) throw new ValidationError('REFUND_OPERATION_NOT_FOUND');
      const allocations = await database.refundWalletAllocation.findMany({
        where: { refundOperationId: operationId },
        orderBy: { id: 'asc' },
      });
      let newlyExpiredAmount = 0;

      for (const allocation of allocations) {
        if (allocation.allocationType !== 'coupon_restore' || allocation.status !== 'pending') continue;
        const expired = isRefundWalletSourceExpired(
          allocation.expiresAt ? Number(allocation.expiresAt) : null,
          Number(nowSeconds()),
        );
        if (expired) {
          newlyExpiredAmount = money(newlyExpiredAmount + Number(allocation.amount));
          await database.refundWalletAllocation.update({
            where: { id: allocation.id },
            data: {
              status: 'skipped_expired',
              metadata: { ...(allocation.metadata || {}), reason: 'original_wallet_credit_expired_at_refund_completion' },
              modifieddate: timestamp,
            },
          });
          continue;
        }
        const credit = await database.wallet_credits.findUniqueOrThrow({ where: { id: allocation.sourceCreditId } });
        const nextRemaining = money(Math.min(
          Number(credit.original_amount),
          Number(credit.remaining_amount) + Number(allocation.amount),
        ));
        await database.wallet_credits.update({
          where: { id: credit.id },
          data: {
            remaining_amount: new Prisma.Decimal(nextRemaining),
            status: nextRemaining >= Number(credit.original_amount) ? 'active' : 'partially_used',
            modifieddate: timestamp,
          },
        });
        if (operation.triggerType === 'cancellation' && allocation.reservationId) {
          await database.wallet_reservations.update({
            where: { id: allocation.reservationId },
            data: {
              status: 'reversed',
              reversed_at: timestamp,
              reversal_reason: 'order_cancelled_refund_completed',
              modifieddate: timestamp,
            },
          });
        }
        await database.refundWalletAllocation.update({
          where: { id: allocation.id },
          data: { targetCreditId: credit.id, status: 'completed', modifieddate: timestamp },
        });
      }

      if (operation.destination === 'wallet' && Number(operation.onlineAmount || 0) > 0) {
        const sourceReference = operation.triggerType === 'cancellation'
          ? `cancellation-refund:${operation.id}:online`
          : `return-refund:${operation.returnRequestId}:online`;
        let refundCredit = await database.wallet_credits.findUnique({ where: { source_reference: sourceReference } });
        if (!refundCredit) {
          refundCredit = await database.wallet_credits.create({
            data: {
              customer_id: Number(operation.customerId),
              assignment_id: null,
              source_type: operation.triggerType === 'cancellation' ? 'cancellation_refund' : 'return_refund',
              source_reference: sourceReference,
              label: `${operation.triggerType === 'cancellation' ? 'Cancellation' : 'Return'} refund for ${operation.operationNumber}`,
              source_order_id: Number(operation.orderId),
              source_return_request_id: operation.returnRequestId,
              original_amount: new Prisma.Decimal(operation.onlineAmount),
              remaining_amount: new Prisma.Decimal(operation.onlineAmount),
              minimum_cart_amount: new Prisma.Decimal(0),
              status: 'active',
              expires_at: null,
              createddate: timestamp,
              modifieddate: timestamp,
            },
          });
        }
        const onlineAllocation = allocations.find((item: any) => item.allocationType === 'online_to_wallet');
        if (!onlineAllocation) {
          await database.refundWalletAllocation.create({
            data: {
              refundOperationId: operation.id,
              reservationId: null,
              sourceCreditId: null,
              targetCreditId: refundCredit.id,
              allocationType: 'online_to_wallet',
              amount: new Prisma.Decimal(operation.onlineAmount),
              status: 'completed',
              expiresAt: null,
              metadata: { credited_on_refund_completion: true },
              createddate: timestamp,
              modifieddate: timestamp,
            },
          });
        }
      }

      const completedAllocations = await database.refundWalletAllocation.findMany({
        where: { refundOperationId: operation.id, status: 'completed' },
      });
      const walletCreditedAmount = money(completedAllocations.reduce(
        (sum: number, item: any) => sum + Number(item.amount || 0),
        0,
      ));
      const phonepeStatus = markPhonePeCompleted && Number(operation.phonepeRefundAmount || 0) > 0
        ? 'completed'
        : operation.phonepeStatus;
      const phonepeOkay = operation.destination === 'wallet' || Number(operation.phonepeRefundAmount || 0) <= 0 || phonepeStatus === 'completed';
      const completed = phonepeOkay;
      return database.refundOperation.update({
        where: { id: operation.id },
        data: {
          walletCreditedAmount: new Prisma.Decimal(walletCreditedAmount),
          walletStatus: 'completed',
          phonepeStatus,
          phonepeRefundId: refundReference || operation.phonepeRefundId,
          expiredWalletAmount: new Prisma.Decimal(money(Number(operation.expiredWalletAmount || 0) + newlyExpiredAmount)),
          eligibleWalletAmount: new Prisma.Decimal(Math.max(0, money(Number(operation.eligibleWalletAmount || 0) - newlyExpiredAmount))),
          status: completed ? 'completed' : 'processing',
          failureReason: completed ? null : operation.failureReason,
          completeddate: completed ? timestamp : operation.completeddate,
          modifieddate: timestamp,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async completeReturnRefundOperation(
    returnRequestId: number,
    resolutionActionId: number,
    refundReference?: string | null,
  ) {
    const operation = await (this.prisma as any).refundOperation.findFirst({
      where: { returnRequestId, resolutionActionId },
      orderBy: { id: 'desc' },
    });
    if (!operation) return null;
    if (
      operation.destination === 'original_sources' &&
      Number(operation.phonepeRefundAmount || 0) > 0 &&
      (!refundReference || [operation.operationNumber, `REFUND_${operation.operationNumber}`].includes(refundReference))
    ) {
      throw new ValidationError(
        'EXTERNAL_REFUND_REFERENCE_REQUIRED',
        'Enter the reference from the refund processed outside the application before marking it completed',
      );
    }
    return this.finalizeRefundOperation(operation.id, true, refundReference);
  }

  async listForOrder(orderId: number) {
    return (this.prisma as any).refundOperation.findMany({
      where: { orderId },
      orderBy: { id: 'desc' },
    });
  }

  async reconcilePhonePe(refundId: string, rawStatus: string) {
    const operation = await (this.prisma as any).refundOperation.findFirst({ where: { phonepeRefundId: refundId } });
    if (!operation) return null;
    const normalized = String(rawStatus || '').toLowerCase();
    const completed = ['completed', 'success', 'successful', 'payment_success', 'refund_success'].includes(normalized);
    const failed = ['failed', 'failure', 'error', 'payment_failed', 'refund_failed'].includes(normalized);
    const phonepeStatus = completed ? 'completed' : failed ? 'failed' : 'processing';
    const walletOkay = ['completed', 'not_required'].includes(operation.walletStatus);
    const status = completed && walletOkay ? 'completed' : failed ? (operation.walletCreditedAmount > 0 ? 'partial_failed' : 'failed') : 'processing';
    const updated = await (this.prisma as any).refundOperation.update({
      where: { id: operation.id },
      data: {
        phonepeStatus,
        status,
        completeddate: status === 'completed' ? nowMillis() : operation.completeddate,
        modifieddate: nowMillis(),
      },
    });
    return completed ? this.finalizeRefundOperation(updated.id, true, refundId) : updated;
  }

  async markCancellationRefundCompleted(orderId: number, refundReference?: string | null) {
    const operation = await (this.prisma as any).refundOperation.findFirst({
      where: { orderId, triggerType: 'cancellation', status: { in: ['pending', 'processing', 'partial_failed'] } },
      orderBy: { id: 'desc' },
    });
    if (!operation) return null;
    if (
      operation.destination === 'original_sources' &&
      Number(operation.phonepeRefundAmount || 0) > 0 &&
      !refundReference
    ) {
      throw new ValidationError(
        'EXTERNAL_REFUND_REFERENCE_REQUIRED',
        'Enter the reference from the refund processed outside the application before marking it completed',
      );
    }
    return this.finalizeRefundOperation(operation.id, true, refundReference);
  }
}
