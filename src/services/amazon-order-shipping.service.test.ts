import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../models/prisma.js';
import { amazonCarrierFor, isKnownAmazonCarrierCode } from '../utils/amazonCarrier.js';
import { AmazonOrderShippingService } from './amazon-order-shipping.service.js';
import { amazonOrderFulfillmentService } from './amazon-order-fulfillment.service.js';
import { amazonProductionWriteGuardService } from './amazon-production-write-guard.service.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';
import { shipmozoService } from './shipmozo.service.js';
import { shipmozoOperationService } from './shipmozo-operation.service.js';
import { AmazonOrderController } from '../controllers/amazon-order.controller.js';

const originals: Array<() => void> = [];
function replace(target: any, key: string, value: any) {
  const old = target[key]; target[key] = value; originals.push(() => { target[key] = old; });
}
const restoreAll = () => { originals.reverse().forEach((restore) => restore()); originals.length = 0; };

const manualInput = {
  provider: 'MANUAL' as const, weightGrams: 500, lengthCm: 20, widthCm: 15, heightCm: 10, paymentType: 'PREPAID' as const,
  manual: { carrierCode: 'Delhivery', courierName: 'Delhivery', trackingNumber: 'AWB123' },
};
const address = { name: 'Buyer', phone: '9876543210', addressLine1: '1 Street', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' };

/** In-memory order + fulfilment; returns the state and call counters */
function mockOrder(overrides: { amazonOrderId?: string; workflowStatus?: string } = {}) {
  const state: any = {
    fulfillment: { id: 2n, orderId: 1n, workflowStatus: overrides.workflowStatus ?? 'READY_TO_PICK', trackingNumber: null,
      pickedAt: null, packedAt: null, deliveryStatus: null, deliveredAt: null },
    audits: [] as any[], exceptions: [] as any[], updateManyCalls: 0,
  };
  replace(prisma.amazonMarketplaceOrder, 'findFirst', async () => ({
    id: 1n, amazonOrderId: overrides.amazonOrderId ?? '404-1111111-2222222', marketplaceId: 'MARKET',
    purchaseDate: new Date('2026-10-26T00:00:00Z'), fulfilmentType: 'MFN', isCancelled: false, orderStatus: 'UNSHIPPED',
    routeHandoff: { status: 'STOCK_RESERVED', blockedReason: null }, fulfillment: { ...state.fulfillment },
    items: [{ amazonOrderItemId: 'I1', sellerSku: 'SKU-1', title: 'Diffuser', quantityOrdered: 1, unitPrice: 590,
      product: { name: 'Diffuser', shortname: 'Diffuser', puc: 'NIV-1', hsn_code: '33074900', gst_rate: 18, category: 'Aroma' } }],
  }));
  replace(prisma.amazonOrderFulfillment, 'updateMany', async ({ where, data }: any) => {
    state.updateManyCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (!where.workflowStatus.in.includes(state.fulfillment.workflowStatus) || state.fulfillment.trackingNumber) return { count: 0 };
    Object.assign(state.fulfillment, data); return { count: 1 };
  });
  replace(prisma.amazonOrderFulfillment, 'update', async ({ data }: any) => { Object.assign(state.fulfillment, data); return { ...state.fulfillment }; });
  replace(prisma.amazonOrderFulfillment, 'findUnique', async () => ({ ...state.fulfillment }));
  replace(prisma.amazonOrderFulfillmentAudit, 'create', async ({ data }: any) => { state.audits.push(data); return data; });
  replace(prisma.amazonOrderFulfillmentException, 'create', async ({ data }: any) => { state.exceptions.push(data); return data; });
  replace(prisma, '$transaction', async (work: any) => (typeof work === 'function' ? work(prisma) : Promise.all(work)));
  replace(amazonOrderFulfillmentService, 'get', async () => ({ ...state.fulfillment }));
  return state;
}
const scope: any = { sellerId: 'SELLER', marketplaceId: 'MARKET', client: { confirmShipment: async () => {} } };

test('courier names map to Amazon carrier codes, unknown ones to Other + name', () => {
  assert.deepEqual(amazonCarrierFor('Delhivery Surface'), { carrierCode: 'Delhivery', carrierName: 'Delhivery' });
  assert.deepEqual(amazonCarrierFor('BlueDart Air'), { carrierCode: 'Blue Dart', carrierName: 'Blue Dart' });
  assert.deepEqual(amazonCarrierFor('Ekart Logistics'), { carrierCode: 'Other', carrierName: 'Ekart Logistics' });
  assert.equal(isKnownAmazonCarrierCode('DTDC'), true);
  assert.equal(isKnownAmazonCarrierCode('Shipmozo'), false);
});

test('manual Ship now saves the courier once, confirms to Amazon and blocks a second booking', async () => {
  try {
    const state = mockOrder();
    let confirmed = 0;
    replace(amazonProductionWriteGuardService, 'status', async () => ({ effectiveEnabled: true }));
    replace(amazonOrderFulfillmentService, 'shipAndConfirmToAmazon', async () => { confirmed += 1; });
    const service = new AmazonOrderShippingService();
    const results = await Promise.allSettled([
      service.shipNow('1', scope, manualInput, { userId: 7 }),
      service.shipNow('1', scope, manualInput, { userId: 7 }),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    assert.match(rejected.reason.message, /already being shipped/);
    assert.equal(confirmed, 1);
    assert.equal(state.fulfillment.workflowStatus, 'TRACKING_READY');
    assert.equal(state.fulfillment.trackingNumber, 'AWB123');
    assert.equal(state.fulfillment.courierCode, 'Delhivery');
    assert.equal(state.fulfillment.shippingProvider, 'MANUAL');
    assert.equal(state.fulfillment.deliveryStatus, 'shipped');
    assert.equal(state.audits[0].action, 'SHIP_NOW_MANUAL');
    const fulfilled = results.find((result) => result.status === 'fulfilled') as PromiseFulfilledResult<any>;
    assert.equal(fulfilled.value.amazonConfirmed, true);
  } finally { restoreAll(); }
});

test('Ship now stops before booking when Amazon writes are off, and blocks couriers on test orders', async () => {
  try {
    const state = mockOrder();
    replace(amazonProductionWriteGuardService, 'status', async () => ({ effectiveEnabled: false }));
    const service = new AmazonOrderShippingService();
    await assert.rejects(() => service.shipNow('1', scope, manualInput, {}), /Amazon writes are disabled.*Nothing was booked/);
    assert.equal(state.updateManyCalls, 0);

    restoreAll();
    const testState = mockOrder({ amazonOrderId: 'TEST-AMZ-1' });
    await assert.rejects(
      () => service.shipNow('1', scope, { ...manualInput, provider: 'EKART', address }, {}),
      /Test orders can use Manual shipping only/,
    );
    assert.equal(testState.updateManyCalls, 0);
    await assert.rejects(() => service.shipNow('1', scope, { ...manualInput, provider: 'SHIPMOZO' }, {}), /address are required|Test orders/);
  } finally { restoreAll(); }
});

test('a failed courier booking releases the lock and records the error', async () => {
  try {
    const state = mockOrder({ workflowStatus: 'PACKED' });
    replace(amazonProductionWriteGuardService, 'status', async () => ({ effectiveEnabled: true }));
    replace(shipmozoService, 'isConfigured', () => true);
    replace(shipmozoOperationService, 'retireCancelled', async () => {});
    replace(shipmozoOperationService, 'begin', async () => ({ id: 9, stage: 'initialized', providerResponse: null }));
    replace(shipmozoOperationService, 'fail', async () => {});
    replace(shipmozoService, 'pushOrder', async () => { throw new Error('Pincode not serviceable'); });
    const service = new AmazonOrderShippingService();
    await assert.rejects(
      () => service.shipNow('1', scope, { ...manualInput, provider: 'SHIPMOZO', address, manual: undefined }, {}),
      (error: any) => error.statusCode === 502 && /Shipmozo booking failed: Pincode not serviceable/.test(error.message),
    );
    assert.equal(state.fulfillment.workflowStatus, 'PACKED');
    assert.equal(state.fulfillment.trackingNumber, null);
    assert.equal(state.exceptions[0].action, 'SHIP_NOW_SHIPMOZO');
  } finally { restoreAll(); }
});

test('courier booked but Amazon confirmation failed is returned, not thrown', async () => {
  try {
    const state = mockOrder();
    replace(amazonProductionWriteGuardService, 'status', async () => ({ effectiveEnabled: true }));
    replace(amazonOrderFulfillmentService, 'shipAndConfirmToAmazon', async () => { throw new Error('Invalid carrier code'); });
    const result = await new AmazonOrderShippingService().shipNow('1', scope, manualInput, {});
    assert.equal(result.amazonConfirmed, false);
    assert.equal(result.amazonError, 'Invalid carrier code');
    assert.equal(state.fulfillment.trackingNumber, 'AWB123');
  } finally { restoreAll(); }
});

test('courier updates never move delivery status backwards; manual updates may', async () => {
  try {
    const state = mockOrder({ workflowStatus: 'AMAZON_CONFIRMED' });
    Object.assign(state.fulfillment, { trackingNumber: 'AWB123', deliveryStatus: 'in_transit', deliveryNextSyncAt: new Date() });
    const service = new AmazonOrderShippingService();
    const delivered = await service.applyDeliveryStatus(2n, { status: 'delivered', source: 'SHIPMOZO', providerStatus: 'Delivered' });
    assert.equal(delivered.changed, true);
    assert.ok(state.fulfillment.deliveredAt instanceof Date);
    assert.equal(state.fulfillment.deliveryNextSyncAt, null);
    const regress = await service.applyDeliveryStatus(2n, { status: 'in_transit', source: 'EKART', providerStatus: 'In Transit' });
    assert.equal(regress.changed, false);
    assert.equal(state.fulfillment.deliveryStatus, 'delivered');
    const unknown = await service.applyDeliveryStatus(2n, { status: null, source: 'EKART', providerStatus: 'Weird status' });
    assert.equal(unknown.changed, false);
    assert.equal(state.fulfillment.deliveryProviderStatus, 'Weird status');

    await service.updateDeliveryStatusManually('1', scope, { status: 'out_for_delivery', note: 'Wrong scan' }, { userId: 3 });
    assert.equal(state.fulfillment.deliveryStatus, 'out_for_delivery');
    assert.equal(state.fulfillment.deliveredAt, null);
    assert.equal(state.audits.at(-1).details.source, 'MANUAL');
  } finally { restoreAll(); }
});

test('ship-now controller returns 400 with the failing field and keeps service errors readable', async () => {
  try {
    replace(amazonListingScopeService, 'resolve', async () => scope);
    const controller = new AmazonOrderController();
    const reply: any = { statusCode: 0, body: null, code(status: number) { this.statusCode = status; return this; }, send(body: any) { this.body = body; return this; } };
    const request: any = { params: { orderId: '1' }, body: { provider: 'MANUAL', weightGrams: 5 }, user: { id: 1 }, log: { warn() {}, error() {} }, routeOptions: { url: '/x' }, method: 'POST' };
    await controller.shipNow(request, reply);
    assert.equal(reply.statusCode, 400);
    assert.match(reply.body.message, /weightGrams/);

    mockOrder();
    replace(amazonProductionWriteGuardService, 'status', async () => ({ effectiveEnabled: false }));
    request.body = manualInput;
    await controller.shipNow(request, reply);
    assert.equal(reply.statusCode, 409);
    assert.match(reply.body.message, /Nothing was booked/);
  } finally { restoreAll(); }
});
