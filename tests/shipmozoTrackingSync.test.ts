import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { statusAfterCourierCancellation } from '../src/utils/shipmozo-status.ts';
import { prisma } from '../src/models/prisma.ts';
import { shipmozoService } from '../src/services/shipmozo.service.ts';
import { customerEmailNotificationService } from '../src/services/customer-email-notification.service.ts';
import { ShipmozoTrackingSyncService } from '../src/services/shipmozo-tracking-sync.service.ts';

test('courier cancellation reverts only in-flight shipment statuses', () => {
  for (const status of ['shipped', 'in_transit', 'out_for_delivery', 'IN_TRANSIT']) {
    assert.equal(statusAfterCourierCancellation(status), 'ready_for_dispatch', status);
  }
  for (const status of ['ready_for_dispatch', 'delivered', 'cancelled', 'returned', 'rto_initiated', 'rto_delivered', '', null]) {
    assert.equal(statusAfterCourierCancellation(status), null, String(status));
  }
});

type Captured = { orderUpdate?: any; lineUpdates: any[]; operation?: any };

function stubDb(order: Record<string, any>, captured: Captured) {
  const tx = {
    orders: { update: async (args: any) => { captured.orderUpdate = args; } },
    orderline: { update: async (args: any) => { captured.lineUpdates.push(args); } },
    shipmozoOperation: {
      findFirst: async () => ({ id: 9 }),
      update: async (args: any) => { captured.operation = args; },
      create: async (args: any) => { captured.operation = args; }
    }
  };
  replaceOnPrisma('orders', { findUnique: async () => order });
  replaceOnPrisma('$transaction', async (fn: (db: typeof tx) => Promise<unknown>) => fn(tx));
}

// Prisma model delegates are not plain methods, so swap the properties and
// put the originals back after each test.
const restores: Array<() => void> = [];
function replaceOnPrisma(key: string, value: unknown) {
  const target = prisma as unknown as Record<string, unknown>;
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  restores.push(() => {
    if (original) Object.defineProperty(target, key, original);
    else delete target[key];
  });
}
function restoreAll() {
  mock.restoreAll();
  while (restores.length) restores.pop()!();
}

function orderInStatus(orderstatus: string) {
  return {
    id: 188,
    orderid: 'NIVAANA-0000000419',
    orderstatus,
    vendor: 'SHIPMOZO',
    tracking_id: '153291464091366',
    public_tracking_link: 'https://track.example/153291464091366',
    shipdate: 111,
    barcodes: {},
    status_history: [{ new_status: orderstatus, is_active: true }],
    orderline: [
      { id: 1, orderstatus, status_history: [], shipdate: 111 },
      { id: 2, orderstatus: 'cancelled', status_history: [], shipdate: null }
    ]
  };
}

const cancelledTracking = { data: { order_status: 'CANCELLED', current_status: 'Pickup Pending' } };

test('Shipmozo cancellation of an in-transit order moves it back to ready_for_dispatch', async (t) => {
  t.after(restoreAll);
  const captured: Captured = { lineUpdates: [] };
  stubDb(orderInStatus('in_transit'), captured);
  mock.method(shipmozoService, 'trackOrder', async () => cancelledTracking);
  const emails = mock.method(customerEmailNotificationService, 'queueOrderEmail', () => undefined);

  const result = await new ShipmozoTrackingSyncService().syncOrder(188);

  const data = captured.orderUpdate.data;
  assert.equal(data.orderstatus, 'ready_for_dispatch');
  assert.equal(data.tracking_id, null);
  assert.equal(data.vendor, null);
  assert.equal(data.public_tracking_link, null);
  assert.equal(data.shipdate, null);
  const active = data.status_history.at(-1);
  assert.equal(active.previous_status, 'in_transit');
  assert.equal(active.new_status, 'ready_for_dispatch');
  assert.equal(active.reason, 'courier_shipment_cancelled');
  assert.equal(data.status_history.filter((entry: any) => entry.is_active).length, 1);
  assert.equal(data.barcodes.cancellation.status, 'confirmed');

  const [activeLine, cancelledLine] = captured.lineUpdates;
  assert.equal(activeLine.data.orderstatus, 'ready_for_dispatch');
  assert.equal(activeLine.data.tracking_id, null);
  assert.equal(activeLine.data.shipdate, null);
  assert.equal('orderstatus' in cancelledLine.data, false, 'cancelled line keeps its status');
  assert.equal(cancelledLine.data.tracking_id, null);

  assert.equal(captured.operation.data.stage, 'shipment_cancelled');
  assert.equal(captured.operation.data.nextSyncAt, null);
  assert.equal(result.applied_status, 'ready_for_dispatch');
  assert.equal(result.reverted_to_ready_for_dispatch, true);
  assert.equal(emails.mock.callCount(), 0, 'no shipment email for a revert');
});

test('Shipmozo cancellation of a ready_for_dispatch order only clears the shipment', async (t) => {
  t.after(restoreAll);
  const captured: Captured = { lineUpdates: [] };
  stubDb(orderInStatus('ready_for_dispatch'), captured);
  mock.method(shipmozoService, 'trackOrder', async () => cancelledTracking);
  mock.method(customerEmailNotificationService, 'queueOrderEmail', () => undefined);

  const result = await new ShipmozoTrackingSyncService().syncOrder(188);

  assert.equal('orderstatus' in captured.orderUpdate.data, false);
  assert.equal(captured.orderUpdate.data.tracking_id, null);
  assert.equal('shipdate' in captured.orderUpdate.data, false);
  assert.equal(result.reverted_to_ready_for_dispatch, false);
});

test('normal tracking update still advances in_transit to out_for_delivery', async (t) => {
  t.after(restoreAll);
  const captured: Captured = { lineUpdates: [] };
  stubDb(orderInStatus('in_transit'), captured);
  mock.method(shipmozoService, 'trackOrder', async () => ({ data: { current_status: 'Out For Delivery' } }));
  mock.method(customerEmailNotificationService, 'queueOrderEmail', () => undefined);

  const result = await new ShipmozoTrackingSyncService().syncOrder(188);

  assert.equal(captured.orderUpdate.data.orderstatus, 'out_for_delivery');
  assert.equal(captured.orderUpdate.data.tracking_id, undefined, 'shipment is kept');
  const recheckMs = Number(captured.operation.data.nextSyncAt) - Date.now();
  assert.ok(recheckMs > 9 * 60_000 && recheckMs <= 10 * 60_000, `next check in ~10 min, got ${recheckMs} ms`);
  assert.equal(result.reverted_to_ready_for_dispatch, false);
});
