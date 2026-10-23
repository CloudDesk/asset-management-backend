import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../models/prisma.js';
import { AmazonOrderFulfillmentService } from './amazon-order-fulfillment.service.js';
import { amazonProductionWriteGuardService } from './amazon-production-write-guard.service.js';
import { amazonOrderRoutingService } from './amazon-order-routing.service.js';
import { AmazonAuthorizationError } from './amazon-lwa-token.service.js';
import { AmazonSpApiError } from './amazon-production-listings.client.js';

test('shipment confirmation claims once and preserves uncertain or accepted outcomes', async () => {
  const originals: Array<() => void> = [];
  function replace(target: any, key: string, value: any) {
    const old = target[key]; target[key] = value; originals.push(() => { target[key] = old; });
  }
  let state: any;
  const reset = () => { state = { id: 2n, orderId: 1n, workflowStatus: 'SHIPPED_INTERNAL',
    amazonConfirmationStatus: 'PENDING', trackingNumber: 'TRACK', courierCode: 'Other',
    shippingDate: new Date(), shippingMethod: 'Standard' }; };
  reset();
  const service = new AmazonOrderFulfillmentService();
  const scope: any = { sellerId: 'SELLER', marketplaceId: 'MARKET', client: {} };
  let calls = 0;
  try {
    replace(prisma.amazonMarketplaceOrder, 'findFirst', async () => ({ id: 1n,
      amazonOrderId: 'ORDER', marketplaceId: 'MARKET', fulfilmentType: 'MFN',
      fulfillment: { ...state }, items: [] }));
    replace(prisma.amazonOrderFulfillment, 'updateMany', async ({ where, data }: any) => {
      if (!where.workflowStatus.in.includes(state.workflowStatus)) return { count: 0 };
      Object.assign(state, data); return { count: 1 };
    });
    replace(prisma.amazonOrderFulfillment, 'findUnique', async () => ({ ...state }));
    replace(prisma.amazonOrderFulfillment, 'update', async ({ data }: any) => { Object.assign(state, data); return { ...state }; });
    replace(prisma.amazonOrderFulfillmentAudit, 'create', async () => ({}));
    replace(prisma.amazonOrderFulfillmentException, 'create', async () => ({}));
    replace(prisma, '$transaction', async (work: any) => typeof work === 'function' ? work(prisma) : Promise.all(work));
    replace(amazonProductionWriteGuardService, 'status', async () => ({ effectiveEnabled: true }));
    replace(amazonOrderRoutingService, 'assertStockReservationReadyForShipment', async () => {});
    replace(amazonOrderRoutingService, 'finalizeReservationsAsSold', async () => {});
    scope.client.confirmShipment = async () => { ++calls; await new Promise((resolve) => setTimeout(resolve, 10)); };
    const results = await Promise.allSettled([service.confirmToAmazon('1', scope, {}), service.confirmToAmazon('1', scope, {})]);
    assert.equal(calls, 1);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(state.workflowStatus, 'AMAZON_CONFIRMED');
    await service.confirmToAmazon('1', scope, {});
    assert.equal(calls, 1);

    reset();
    scope.client.confirmShipment = async () => { ++calls; throw new Error('timeout'); };
    await assert.rejects(() => service.confirmToAmazon('1', scope, {}), /timeout/);
    assert.equal(state.workflowStatus, 'AMAZON_CONFIRMATION_UNKNOWN');
    const beforeRetry = calls;
    await assert.rejects(() => service.confirmToAmazon('1', scope, {}));
    assert.equal(calls, beforeRetry);

    reset();
    scope.client.confirmShipment = async () => { ++calls; throw new AmazonAuthorizationError(); };
    await assert.rejects(() => service.confirmToAmazon('1', scope, {}), AmazonAuthorizationError);
    assert.equal(state.workflowStatus, 'AMAZON_CONFIRMATION_FAILED');
    assert.equal(state.amazonConfirmationStatus, 'FAILED');
    scope.client.confirmShipment = async () => { ++calls; throw new AmazonSpApiError('Token service unavailable', 502, 'AMAZON_WRITE_NOT_SENT'); };
    await assert.rejects(() => service.confirmToAmazon('1', scope, {}), /Token service unavailable/);
    assert.equal(state.workflowStatus, 'AMAZON_CONFIRMATION_FAILED');
    const rejectedCalls = calls;
    scope.client.confirmShipment = async () => { ++calls; };
    await service.confirmToAmazon('1', scope, {});
    assert.equal(calls, rejectedCalls + 1);
    assert.equal(state.workflowStatus, 'AMAZON_CONFIRMED');

    reset();
    scope.client.confirmShipment = async () => { ++calls; };
    replace(amazonOrderRoutingService, 'finalizeReservationsAsSold', async () => { throw new Error('local failure'); });
    await assert.rejects(() => service.confirmToAmazon('1', scope, {}), /local failure/);
    assert.equal(state.amazonConfirmationStatus, 'CONFIRMED');
    const acceptedCalls = calls;
    replace(amazonOrderRoutingService, 'finalizeReservationsAsSold', async () => {});
    await service.confirmToAmazon('1', scope, {});
    assert.equal(calls, acceptedCalls);
    assert.equal(state.workflowStatus, 'AMAZON_CONFIRMED');
  } finally { originals.reverse().forEach((restore) => restore()); }
});
