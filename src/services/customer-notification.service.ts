import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { PushNotificationService } from './push-notification.service.js';
import { logger } from '../config/logger.js';

type EcommercePushUser = {
  id: number;
  userType: 'ecommerce';
};

type OrderLike = {
  id: number;
  userid: number | null;
  orderid?: string | null;
  orderstatus?: string | null;
  mode?: string | null;
  orderamount?: unknown;
  refund_amount?: unknown;
};

type CartReminderOptions = {
  minInactiveMinutes?: number | undefined;
  maxUsers?: number | undefined;
  dryRun?: boolean | undefined;
};

type PromotionBroadcastInput = {
  title?: string | undefined;
  body?: string | undefined;
  url?: string | undefined;
  userIds?: number[] | undefined;
  promotionId?: number | undefined;
  maxUsers?: number | undefined;
  data?: Record<string, string | number | boolean> | undefined;
};

const ORDER_TRACKING_BASE = 'nivaana://OrderTracking';
const ORDER_DETAIL_BASE = 'nivaana://Main/ProfileTab/OrderDetail';
const MY_ORDERS_URL = 'nivaana://Main/ProfileTab/MyOrders';
const CART_URL = 'nivaana://Main/CartTab/Cart';
const DEALS_URL = 'nivaana://DealsForYou';

export class CustomerNotificationService {
  private pushNotificationService = new PushNotificationService();

  private asPushUser(userId: number | null | undefined): EcommercePushUser | null {
    if (!userId || Number.isNaN(Number(userId))) {
      return null;
    }

    return {
      id: Number(userId),
      userType: 'ecommerce',
    };
  }

  private getOrderTrackingUrl(order: OrderLike): string {
    const orderIdentifier = order.orderid || String(order.id);
    return `${ORDER_TRACKING_BASE}/${encodeURIComponent(orderIdentifier)}`;
  }

  private async getOrderDestination(order: OrderLike): Promise<{
    url: string;
    orderLineId?: number | undefined;
  }> {
    const fallbackUrl = this.getOrderTrackingUrl(order);

    try {
      const firstOrderLine = await prisma.orderline.findFirst({
        where: {
          orderid: order.id,
        },
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          uniqueordderid: true,
        },
      });

      if (!firstOrderLine) {
        return { url: fallbackUrl };
      }

      const orderIdentifier =
        order.orderid || firstOrderLine.uniqueordderid || String(order.id);
      const url = `${ORDER_DETAIL_BASE}/${firstOrderLine.id}?orderId=${encodeURIComponent(orderIdentifier)}`;

      logger.info(
        {
          orderId: order.id,
          orderNumber: orderIdentifier,
          orderLineId: firstOrderLine.id,
          destinationUrl: url,
        },
        'Resolved order push deep link destination'
      );

      return {
        url,
        orderLineId: firstOrderLine.id,
      };
    } catch {
      logger.warn(
        { orderId: order.id, fallbackUrl },
        'Falling back to order tracking deep link destination'
      );
      return { url: fallbackUrl };
    }
  }

  private toAmountLabel(value: unknown): string | null {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return null;
    }

    return `Rs ${numericValue.toFixed(0)}`;
  }

  private stringifyData(
    data?: Record<string, string | number | boolean>
  ): Record<string, string> {
    const normalized: Record<string, string> = {};

    Object.entries(data || {}).forEach(([key, value]) => {
      normalized[key] = String(value);
    });

    return normalized;
  }

  async notifyPaymentSuccess(order: OrderLike) {
    const user = this.asPushUser(order.userid);
    if (!user) return null;
    const destination = await this.getOrderDestination(order);

    return this.pushNotificationService.sendToUser(user, {
      title: 'Payment successful',
      body: `Order ${order.orderid || `#${order.id}`} is confirmed.`,
      url: destination.url,
      data: {
        eventType: 'payment_success',
        orderId: String(order.id),
        orderNumber: order.orderid || String(order.id),
        ...(destination.orderLineId ? { orderLineId: String(destination.orderLineId) } : {}),
      },
    });
  }

  async notifyPaymentFailed(input: {
    userId: number | null | undefined;
    merchantTransactionId?: string | null;
    amount?: unknown;
  }) {
    const user = this.asPushUser(input.userId);
    if (!user) return null;

    const amountLabel = this.toAmountLabel(input.amount);
    const body = amountLabel
      ? `Your payment for ${amountLabel} did not complete. Your cart is still waiting.`
      : 'Your payment did not complete. Your cart is still waiting.';

    return this.pushNotificationService.sendToUser(user, {
      title: 'Payment failed',
      body,
      url: CART_URL,
      data: {
        eventType: 'payment_failed',
        merchantTransactionId: input.merchantTransactionId || '',
      },
    });
  }

  async notifyOrderStatus(order: OrderLike, status?: string | null) {
    const user = this.asPushUser(order.userid);
    if (!user) return null;

    const normalizedStatus = (status || order.orderstatus || '').toLowerCase();
    if (!normalizedStatus) return null;

    const orderNumber = order.orderid || `#${order.id}`;
    let title = 'Order update';
    let body = `Order ${orderNumber} has a new update.`;
    const destination = await this.getOrderDestination(order);
    let url = destination.url;

    switch (normalizedStatus) {
      case 'order_confirmed':
      case 'payment_completed':
        title = 'Order confirmed';
        body = `Order ${orderNumber} has been confirmed.`;
        break;
      case 'ready_for_dispatch':
        title = 'Order being packed';
        body = `Order ${orderNumber} is packed and almost on the way.`;
        break;
      case 'shipped':
        title = 'Order shipped';
        body = `Order ${orderNumber} has been shipped.`;
        break;
      case 'in_transit':
        title = 'Order in transit';
        body = `Order ${orderNumber} is on the way to you.`;
        break;
      case 'out_for_delivery':
        title = 'Out for delivery';
        body = `Order ${orderNumber} is out for delivery today.`;
        break;
      case 'delivered':
        title = 'Order delivered';
        body = `Order ${orderNumber} has been delivered.`;
        break;
      case 'cancelled':
        title = 'Order cancelled';
        body = `Order ${orderNumber} has been cancelled.`;
        url = MY_ORDERS_URL;
        break;
      case 'rto_initiated':
        title = 'Delivery issue';
        body = `Order ${orderNumber} could not be delivered and is being returned.`;
        break;
      case 'rto_delivered':
        title = 'Order returned';
        body = `Order ${orderNumber} has been returned to origin.`;
        url = MY_ORDERS_URL;
        break;
      case 'cancelled_refund_processing':
        title = 'Refund in progress';
        body = `Refund for order ${orderNumber} is being processed.`;
        url = MY_ORDERS_URL;
        break;
      case 'cancelled_refunded':
      case 'cancelled_completed': {
        title = 'Refund completed';
        const refundAmount = this.toAmountLabel(order.refund_amount || order.orderamount);
        body = refundAmount
          ? `Refund of ${refundAmount} for order ${orderNumber} is completed.`
          : `Refund for order ${orderNumber} is completed.`;
        url = MY_ORDERS_URL;
        break;
      }
      default:
        return null;
    }

    return this.pushNotificationService.sendToUser(user, {
      title,
      body,
      url,
      data: {
        eventType: 'order_status_update',
        status: normalizedStatus,
        orderId: String(order.id),
        orderNumber: order.orderid || String(order.id),
        ...(destination.orderLineId ? { orderLineId: String(destination.orderLineId) } : {}),
      },
    });
  }

  async sendAbandonedCartReminders(options: CartReminderOptions = {}) {
    const minInactiveMinutes = Math.max(15, options.minInactiveMinutes || 60);
    const maxUsers = Math.max(1, Math.min(options.maxUsers || 100, 500));
    const cutoff = Date.now() - minInactiveMinutes * 60 * 1000;

    const groupedCarts = await prisma.cart.groupBy({
      by: ['userid'],
      where: {
        iscart: true,
        userid: { not: null },
      },
      _count: {
        _all: true,
      },
      _max: {
        modifieddate: true,
        createddate: true,
      },
      orderBy: {
        userid: 'asc',
      },
      take: maxUsers * 3,
    });

    const candidateUsers = groupedCarts
      .map((row) => {
        const lastActivity = Number(row._max.modifieddate || row._max.createddate || 0);
        return {
          userId: row.userid,
          itemCount: row._count._all,
          lastActivity,
        };
      })
      .filter((row) => row.userId && row.lastActivity > 0 && row.lastActivity <= cutoff)
      .slice(0, maxUsers);

    const delivery = [];

    for (const candidate of candidateUsers) {
      const userId = Number(candidate.userId);
      const recentOrder = await prisma.orders.findFirst({
        where: {
          userid: userId,
          createddate: {
            gte: BigInt(candidate.lastActivity),
          },
        },
        select: { id: true },
      });

      if (recentOrder) {
        delivery.push({
          userId,
          status: 'skipped_recent_order',
          itemCount: candidate.itemCount,
        });
        continue;
      }

      if (options.dryRun) {
        delivery.push({
          userId,
          status: 'dry_run',
          itemCount: candidate.itemCount,
          lastActivity: candidate.lastActivity,
        });
        continue;
      }

      const result = await this.pushNotificationService.sendToUser(
        { id: userId, userType: 'ecommerce' },
        {
          title: 'Items still waiting in your cart',
          body: `You still have ${candidate.itemCount} item${candidate.itemCount > 1 ? 's' : ''} ready to checkout.`,
          url: CART_URL,
          data: {
            eventType: 'cart_abandoned',
            itemCount: String(candidate.itemCount),
            lastActivity: String(candidate.lastActivity),
          },
        }
      );

      delivery.push({
        userId,
        status: 'sent',
        itemCount: candidate.itemCount,
        result,
      });
    }

    return {
      minInactiveMinutes,
      evaluatedUsers: groupedCarts.length,
      candidateUsers: candidateUsers.length,
      delivery,
    };
  }

  async sendPromotionBroadcast(input: PromotionBroadcastInput) {
    const maxUsers = Math.max(1, Math.min(input.maxUsers || 500, 2000));
    let title = input.title?.trim();
    let body = input.body?.trim();
    const campaignData: Record<string, string | number | boolean> = {
      ...(input.data || {}),
    };

    if (input.promotionId) {
      const promotion = await prisma.promotions.findUnique({
        where: { id: input.promotionId },
        select: {
          id: true,
          name: true,
          description: true,
          code: true,
          status: true,
          visibility: true,
        },
      });

      if (promotion) {
        title = title || promotion.name || 'New offer for you';
        body =
          body ||
          promotion.description ||
          (promotion.code
            ? `Offer code ${promotion.code} is live now.`
            : 'A new deal is live now.');
        campaignData.promotionId = promotion.id;
        if (promotion.code) {
          campaignData.promotionCode = promotion.code;
        }
      }
    }

    title = title || 'New deals for you';
    body = body || 'Fresh offers are now live in Nivaana.';

    const targetUserIds = input.userIds?.length
      ? input.userIds
      : (
          await prisma.$queryRaw<{ userid: number | null }[]>(
            Prisma.sql`
              SELECT DISTINCT "userid"
              FROM "push_devices"
              WHERE "isactive" = TRUE
                AND "usertype" = 'ecommerce'
                AND "provider" = 'fcm'
                AND "userid" IS NOT NULL
              ORDER BY "userid" ASC
              LIMIT ${maxUsers}
            `
          )
        )
          .map((row: { userid: number | null }) => row.userid)
          .filter((value: number | null): value is number => typeof value === 'number');

    const delivery = [];

    for (const userId of targetUserIds.slice(0, maxUsers)) {
      const result = await this.pushNotificationService.sendToUser(
        { id: userId, userType: 'ecommerce' },
        {
          title,
          body,
          url: input.url || DEALS_URL,
          data: {
            eventType: 'promotion_campaign',
            ...this.stringifyData(campaignData),
          },
        }
      );

      delivery.push({
        userId,
        result,
      });
    }

    return {
      title,
      body,
      targetUsers: targetUserIds.slice(0, maxUsers).length,
      delivery,
    };
  }
}
