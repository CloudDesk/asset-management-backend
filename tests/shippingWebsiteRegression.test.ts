import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Fastify from 'fastify';

import { prisma } from '../src/models/prisma.ts';
import { ekartRoutes } from '../src/routes/ekart.route.ts';
import { OrdersService } from '../src/services/orders.service.ts';
import { CustomerNotificationService } from '../src/services/customer-notification.service.ts';
import { ekartService } from '../src/services/ekart.service.ts';
import { shipmozoService } from '../src/services/shipmozo.service.ts';
import { ShipmozoTrackingSyncService } from '../src/services/shipmozo-tracking-sync.service.ts';
import { amazonOrderShippingService } from '../src/services/amazon-order-shipping.service.ts';

// FIX-162 (Amazon Ship now) touched the website Ekart / Shipmozo code. These tests pin the website
// behaviour: website orders are matched first and never reach the Amazon code, and an Amazon
// failure never changes what the website path answered before.

const restores: Array<() => void> = [];
function replace(target: any, key: string, value: unknown) {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  restores.push(() => (original ? Object.defineProperty(target, key, original) : delete target[key]));
}
const restoreAll = () => { while (restores.length) restores.pop()!(); };

async function ekartWebhook(body: Record<string, unknown>) {
  const app = Fastify();
  await app.register(ekartRoutes);
  const raw = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', 'Nivaana-Ekart-Track-Status').update(raw).digest('hex');
  const response = await app.inject({
    method: 'POST', url: '/webhook/track-status', payload: raw,
    headers: { 'content-type': 'application/json', 'x-swift-webhook-hmac': signature },
  });
  await app.close();
  return response;
}

test('Ekart webhook: website order is updated exactly as before and the Amazon code is not used', async () => {
  try {
    const calls: unknown[][] = [];
    let amazonLookups = 0;
    replace(OrdersService.prototype, 'findByTrackingId', async () => ({ id: 5, tracking_id: 'EKW1', vendor: 'EKART' }));
    replace(OrdersService.prototype, 'handleEkartWebhookStatusUpdate', async (...args: unknown[]) => {
      calls.push(args); return { id: 5, orderstatus: 'in_transit', shipment_tracking_status: 'In Transit' };
    });
    replace(CustomerNotificationService.prototype, 'notifyOrderStatus', async () => {});
    replace(amazonOrderShippingService, 'findByAwb', async () => { amazonLookups += 1; return null; });

    const response = await ekartWebhook({ wbn: 'EKW1', status: 'In Transit' });
    assert.equal(response.statusCode, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]![0], 'EKW1');
    assert.equal(calls[0]![1], 'In Transit');
    assert.equal(response.json().data.orderId, 5);
    assert.equal(amazonLookups, 0);
  } finally { restoreAll(); }
});

test('Ekart webhook: unknown AWB still answers 404, also when the Amazon lookup fails', async () => {
  try {
    replace(OrdersService.prototype, 'findByTrackingId', async () => null);
    replace(amazonOrderShippingService, 'findByAwb', async () => null);
    assert.equal((await ekartWebhook({ wbn: 'NOPE', status: 'Delivered' })).statusCode, 404);

    replace(amazonOrderShippingService, 'findByAwb', async () => { throw new Error('column "shippingProvider" does not exist'); });
    assert.equal((await ekartWebhook({ wbn: 'NOPE', status: 'Delivered' })).statusCode, 404);
  } finally { restoreAll(); }
});

test('Ekart webhook: an Amazon AWB updates only the Amazon delivery status', async () => {
  try {
    const applied: any[] = [];
    let websiteUpdates = 0;
    replace(OrdersService.prototype, 'findByTrackingId', async () => null);
    replace(OrdersService.prototype, 'handleEkartWebhookStatusUpdate', async () => { websiteUpdates += 1; });
    replace(amazonOrderShippingService, 'findByAwb', async (provider: string, awb: string) => (provider === 'EKART' && awb === 'EKA1' ? { id: 8n } : null));
    replace(amazonOrderShippingService, 'applyDeliveryStatus', async (id: bigint, update: unknown) => { applied.push({ id, update }); return { changed: true, status: 'in_transit' }; });

    const response = await ekartWebhook({ wbn: 'EKA1', status: 'In Transit' });
    assert.equal(response.statusCode, 200);
    assert.equal(websiteUpdates, 0);
    assert.deepEqual(applied, [{ id: 8n, update: { status: 'in_transit', source: 'EKART', providerStatus: 'In Transit' } }]);
  } finally { restoreAll(); }
});

test('Shipmozo webhook sync: website orders and returns come first; Amazon failure keeps "ignored"', async () => {
  try {
    const service = new ShipmozoTrackingSyncService();
    let amazonLookups = 0;
    replace(amazonOrderShippingService, 'findByAwb', async () => { amazonLookups += 1; throw new Error('db down'); });

    replace(prisma.orders, 'findFirst', async () => ({ id: 3 }));
    replace(service, 'syncOrder', async (id: number) => ({ order_id: id, applied_status: 'delivered' }));
    assert.deepEqual(await service.syncByAwb('SMW1'), { entity: 'order', order_id: 3, applied_status: 'delivered' });

    replace(prisma.orders, 'findFirst', async () => null);
    replace(prisma.returnRequest, 'findFirst', async () => ({ id: 4 }));
    replace(service, 'syncReturn', async (id: number) => ({ return_request_id: id }));
    assert.deepEqual(await service.syncByAwb('SMR1'), { entity: 'return', return_request_id: 4 });
    assert.equal(amazonLookups, 0);

    replace(prisma.returnRequest, 'findFirst', async () => null);
    assert.deepEqual(await service.syncByAwb('NOPE'), { entity: null, tracking_id: 'NOPE', ignored: true, reason: 'tracking_id_not_found' });
    assert.equal(amazonLookups, 1);
  } finally { restoreAll(); }
});

test('Shipmozo scheduled sync: website orders still sync when the Amazon query fails', async () => {
  try {
    const service = new ShipmozoTrackingSyncService();
    const synced: number[] = [];
    replace(prisma.orders, 'findMany', async () => [{ id: 11, orderid: 'NIV-11', tracking_id: 'SM11' }]);
    replace(prisma.shipmozoOperation, 'findMany', async () => []);
    replace(prisma.returnRequest, 'findMany', async () => []);
    replace(prisma.amazonOrderFulfillment, 'findMany', async () => { throw new Error('column "deliveryNextSyncAt" does not exist'); });
    replace(service, 'syncOrder', async (id: number) => { synced.push(id); return { order_id: id }; });

    const result = await service.runBatch(5);
    assert.deepEqual(synced, [11]);
    assert.equal(result.processed, 1);
  } finally { restoreAll(); }
});

test('Shipmozo scheduled sync: Amazon shipments only use what is left after website orders and returns', async () => {
  try {
    const service = new ShipmozoTrackingSyncService();
    let amazonTake: number | undefined;
    replace(prisma.orders, 'findMany', async () => [{ id: 1, orderid: 'A', tracking_id: 'S1' }, { id: 2, orderid: 'B', tracking_id: 'S2' }]);
    replace(prisma.shipmozoOperation, 'findMany', async () => []);
    replace(prisma.returnRequest, 'findMany', async () => []);
    replace(prisma.amazonOrderFulfillment, 'findMany', async (args: any) => { amazonTake = args.take; return []; });
    replace(service, 'syncOrder', async (id: number) => ({ order_id: id }));
    await service.runBatch(2);
    assert.equal(amazonTake, undefined, 'no Amazon query when website orders fill the batch');
    await service.runBatch(5);
    assert.equal(amazonTake, 3);
  } finally { restoreAll(); }
});

test('Ekart booking for a website order still reads the HSN from its orderlines', async () => {
  try {
    const lookedUp: string[] = [];
    replace(OrdersService.prototype, 'findByOrderIdString', async (orderNumber: string) => { lookedUp.push(orderNumber); return null; });
    const payload: any = { seller_name: 'S', seller_address: 'A', seller_gst_tin: '33ABCDE1234F1Z5', order_number: 'NIV-100' };
    await assert.rejects(() => ekartService.createForwardShipment(payload), /order HSN snapshot is unavailable/);
    assert.deepEqual(lookedUp, ['NIV-100']);

    // Amazon passes prepared items: no website order lookup, Ekart gets those items
    const sent: any[] = [];
    replace(ekartService, 'apiRequest', async (_path: string, options: any) => { sent.push(options.data); return { data: { status: true, tracking_id: 'EK9', vendor: 'EKART' } }; });
    const items = [{ product_name: 'Diffuser', sku: 'SKU', quantity: 1, hsn_code: '33074900' }];
    await ekartService.createForwardShipment({ ...payload, order_number: '404-1' }, { items, hsnCode: '33074900' });
    assert.deepEqual(lookedUp, ['NIV-100']);
    assert.equal(sent[0].hsn_code, '33074900');
    assert.deepEqual(sent[0].items, items);
  } finally { restoreAll(); }
});
