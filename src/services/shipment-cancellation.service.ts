import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { ValidationError } from '../utils/errorHandler.js';
import {
  buildShipmentOnlyCancellationUpdate,
  type ShipmentProvider
} from '../utils/shipmentCancellation.js';

type CancellableOrder = {
  id: number;
  orderid?: string | null;
  orderstatus?: string | null;
  tracking_id?: string | null;
  barcodes?: unknown;
};

type ShipmentCancellationDb = {
  orders: {
    findFirst(args: unknown): Promise<CancellableOrder | null>;
    update(args: unknown): any;
  };
  orderline: {
    updateMany(args: unknown): any;
  };
  $transaction(operations: any[]): Promise<unknown>;
};

/**
 * Cancels only the courier shipment of an order that has not been dispatched.
 * The Nivaana order is not cancelled or refunded: it stays ready_for_dispatch
 * so a new shipment can be created. The courier is called first; when it
 * refuses, nothing changes on our side.
 */
export class ShipmentCancellationService {
  constructor(private readonly db: ShipmentCancellationDb = prisma as unknown as ShipmentCancellationDb) {}

  async cancelShipmentKeepOrder<T>(input: {
    provider: ShipmentProvider;
    trackingId: string;
    cancelWithProvider: (order: CancellableOrder) => Promise<T>;
  }): Promise<{ order: CancellableOrder; providerResponse: T }> {
    const trackingId = String(input.trackingId || '').trim();
    const order = await this.db.orders.findFirst({
      where: {
        tracking_id: trackingId,
        vendor: { equals: input.provider, mode: 'insensitive' }
      }
    });

    if (!order) {
      throw new ValidationError(`No ${input.provider} order has tracking ID ${trackingId}`);
    }
    if (order.orderstatus !== 'ready_for_dispatch') {
      throw new ValidationError(
        `Only shipments of orders in ready_for_dispatch can be cancelled here. Current status: ${order.orderstatus}. Cancel the order instead.`
      );
    }

    const providerResponse = await input.cancelWithProvider(order);

    const timestamp = Date.now();
    await this.db.$transaction([
      this.db.orders.update({
        where: { id: order.id },
        data: buildShipmentOnlyCancellationUpdate({
          barcodes: order.barcodes,
          provider: input.provider,
          trackingId,
          timestamp
        })
      }),
      this.db.orderline.updateMany({
        where: { orderid: order.id },
        data: { tracking_id: null, modifieddate: timestamp }
      })
    ]);

    logger.info(
      { orderId: order.id, orderNumber: order.orderid, provider: input.provider, trackingId },
      'Courier shipment cancelled; order kept ready_for_dispatch for a new shipment'
    );

    return { order, providerResponse };
  }
}

export const shipmentCancellationService = new ShipmentCancellationService();
