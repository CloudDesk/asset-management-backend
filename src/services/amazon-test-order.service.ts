import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';
import { AmazonListingScope } from './amazon-listing-scope.service.js';
import { AmazonOrderImportError } from './amazon-order-import.service.js';
import { amazonOrderFulfillmentService } from './amazon-order-fulfillment.service.js';
import { amazonOrderRoutingService } from './amazon-order-routing.service.js';

const TEST_ORDER_PREFIX = 'TEST-AMZ-';

export const isAmazonTestOrderId = (amazonOrderId: string) =>
  amazonOrderId.startsWith(TEST_ORDER_PREFIX);

export class AmazonTestOrderService {
  private assertDevelopment() {
    if (env.NODE_ENV === 'production') {
      throw new AmazonOrderImportError(
        'Test Amazon orders are unavailable in production',
        404,
        'AMAZON_TEST_ORDER_UNAVAILABLE',
      );
    }
  }

  async create(scope: AmazonListingScope, input: {
    listingId: string;
    quantity: number;
    buyerName: string;
  }) {
    this.assertDevelopment();
    const listing = await prisma.marketplaceListing.findFirst({
      where: {
        id: BigInt(input.listingId),
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        mappingStatus: 'MAPPED',
        productId: { not: null },
        fulfilmentChannel: 'MFN',
      },
      select: {
        id: true,
        sellerSku: true,
        asin: true,
        title: true,
        listingStatus: true,
        fulfilmentChannel: true,
        productId: true,
        unitsPerListing: true,
        price: true,
        currency: true,
      },
    });
    if (!listing || listing.productId === null) {
      throw new AmazonOrderImportError(
        'Select a mapped seller-fulfilled Amazon listing',
        404,
        'AMAZON_TEST_LISTING_NOT_FOUND',
      );
    }
    if (listing.listingStatus.split(',').some((status) => status.trim().toUpperCase() === 'DELETED')) {
      throw new AmazonOrderImportError(
        'Deleted Amazon listings cannot be used for test orders',
        409,
        'AMAZON_TEST_LISTING_DELETED',
      );
    }

    const reservedQuantity = input.quantity * Math.max(1, listing.unitsPerListing);
    const stock = await prisma.platformStock.findFirst({
      where: {
        productid: listing.productId,
        platform: { equals: 'amazon', mode: 'insensitive' },
      },
      select: { availableqty: true },
    });
    if (!stock || stock.availableqty < reservedQuantity) {
      throw new AmazonOrderImportError(
        `Only ${stock?.availableqty ?? 0} Amazon unit(s) are available in Nivaana`,
        409,
        'AMAZON_TEST_ORDER_INSUFFICIENT_STOCK',
      );
    }

    const now = new Date();
    const amazonOrderId = `${TEST_ORDER_PREFIX}${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const fulfilmentType = 'MFN';
    const order = await prisma.amazonMarketplaceOrder.create({
      data: {
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        amazonOrderId,
        purchaseDate: now,
        lastUpdateDate: now,
        orderStatus: 'UNSHIPPED',
        buyerName: input.buyerName,
        fulfilmentType,
        fulfilmentRoute: 'NIVAANA_SHIPPING',
        syncState: 'READY_FOR_NIVAANA',
        hasUnmappedItems: false,
        isCancelled: false,
        buyerRequestedCancellation: false,
        shipByStart: now,
        shipByEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        programs: ['NIVAANA_TEST_ORDER'],
        items: {
          create: {
            amazonOrderItemId: `${amazonOrderId}-1`,
            sellerSku: listing.sellerSku,
            asin: listing.asin,
            title: listing.title,
            quantityOrdered: input.quantity,
            quantityShipped: 0,
            unitPrice: listing.price,
            currency: listing.currency,
            listingId: listing.id,
            productId: listing.productId,
            unitsPerListing: Math.max(1, listing.unitsPerListing),
            mappingStatus: 'MAPPED',
          },
        },
      },
    });

    await amazonOrderRoutingService.reconcile(order.id, { syncAmazonInventory: false });
    await amazonOrderFulfillmentService.reconcile(order.id);
    const created = await prisma.amazonMarketplaceOrder.findUnique({
      where: { id: order.id },
      include: { routeHandoff: true, stockReservations: true, fulfillment: true },
    });
    return {
      id: String(order.id),
      amazonOrderId,
      orderStatus: created?.orderStatus ?? 'UNSHIPPED',
      syncState: created?.syncState ?? null,
      reservedQuantity,
      reservationStatus: created?.stockReservations[0]?.status ?? null,
      fulfillmentStatus: created?.fulfillment?.workflowStatus ?? null,
      contactsAmazon: false,
    };
  }

  async updateStatus(orderId: string, scope: AmazonListingScope, status: 'SHIPPED' | 'CANCELLED') {
    this.assertDevelopment();
    if (!/^\d+$/.test(orderId)) {
      throw new AmazonOrderImportError('Invalid test order ID', 400, 'VALIDATION_ERROR');
    }
    const order = await prisma.amazonMarketplaceOrder.findFirst({
      where: { id: BigInt(orderId), sellerId: scope.sellerId, marketplaceId: scope.marketplaceId },
    });
    if (!order || !isAmazonTestOrderId(order.amazonOrderId)) {
      throw new AmazonOrderImportError('Amazon test order not found', 404, 'AMAZON_TEST_ORDER_NOT_FOUND');
    }
    if (order.orderStatus !== 'UNSHIPPED') {
      throw new AmazonOrderImportError(
        `This test order is already ${order.orderStatus.toLowerCase()}`,
        409,
        'AMAZON_TEST_ORDER_FINAL',
      );
    }

    await prisma.amazonMarketplaceOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: status,
        isCancelled: status === 'CANCELLED',
        lastUpdateDate: new Date(),
      },
    });
    await amazonOrderRoutingService.reconcile(order.id, { syncAmazonInventory: false });
    await amazonOrderFulfillmentService.reconcile(order.id);
    const updated = await prisma.amazonMarketplaceOrder.findUnique({
      where: { id: order.id },
      include: { routeHandoff: true, stockReservations: true, fulfillment: true },
    });
    return {
      id: String(order.id),
      amazonOrderId: order.amazonOrderId,
      orderStatus: updated?.orderStatus ?? status,
      syncState: updated?.syncState ?? null,
      reservationStatus: updated?.stockReservations[0]?.status ?? null,
      fulfillmentStatus: updated?.fulfillment?.workflowStatus ?? null,
      contactsAmazon: false,
    };
  }
}

export const amazonTestOrderService = new AmazonTestOrderService();
