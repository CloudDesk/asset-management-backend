import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/models/prisma.ts';
import { OrdersService } from '../src/services/orders.service.ts';
import {
  buildCourierReportedCancellationUpdate,
  isCourierShipmentCancelledStatus,
  shipmentHistoryOf
} from '../src/utils/shipmentCancellation.ts';

test('only shipment cancellations count as an Ekart courier cancel', () => {
  for (const status of ['Cancelled', 'CANCELLED', 'Shipment Cancelled', 'cancelled_by_seller']) {
    assert.equal(isCourierShipmentCancelledStatus(status), true, status);
  }
  for (const status of ['Pickup Cancelled', 'Pick Up Cancelled', 'RTO Cancelled', 'Return Cancelled', 'Delivered', 'Shipped', '', null]) {
    assert.equal(isCourierShipmentCancelledStatus(status), false, String(status));
  }
});

test('courier-reported cancel clears the shipment and keeps the AWB', () => {
  const update = buildCourierReportedCancellationUpdate({
    barcodes: { wbn: 'AWB-1' },
    provider: 'EKART',
    trackingId: 'AWB-1',
    courierStatus: 'Cancelled',
    orderCancelled: false,
    timestamp: 100
  });

  assert.equal(update.tracking_id, null);
  assert.equal(update.vendor, null);
  assert.equal(update.public_tracking_link, null);
  assert.equal(update.label_url, null);
  assert.equal(update.shipment_created_at, null);
  assert.equal(update.shipment_tracking_status, 'Cancelled');
  assert.equal(update.barcodes.cancellation.reason, 'courier_reported');
  assert.equal(update.barcodes.cancellation.confirmation_source, 'webhook');
  assert.deepEqual(shipmentHistoryOf(update.barcodes).map((entry) => entry.tracking_id), ['AWB-1']);
  assert.equal('orderstatus' in update, false);
});

test('courier-reported cancel confirms a pending order cancellation without duplicating history', () => {
  const pending = {
    cancellation: { provider: 'EKART', status: 'pending', tracking_id: 'AWB-1', requested_at: 50 }
  };
  const update = buildCourierReportedCancellationUpdate({
    barcodes: pending,
    provider: 'EKART',
    trackingId: 'AWB-1',
    courierStatus: 'Cancelled',
    orderCancelled: true,
    timestamp: 100
  });
  assert.equal(update.barcodes.cancellation.status, 'confirmed');
  assert.equal(update.barcodes.cancellation.reason, 'order_cancelled');
  assert.equal(update.barcodes.cancellation.requested_at, 50, 'pending attempt details are kept');

  const again = buildCourierReportedCancellationUpdate({
    barcodes: update.barcodes,
    provider: 'EKART',
    trackingId: 'AWB-1',
    courierStatus: 'Cancelled',
    orderCancelled: true,
    timestamp: 200
  });
  assert.equal(shipmentHistoryOf(again.barcodes).length, 1, 'repeat webhook does not add the AWB twice');
});

type Captured = { orderUpdate?: any; lineUpdates: any[] };

// Prisma model delegates are not plain methods, so swap the property and put
// the original back after each test.
const restores: Array<() => void> = [];
function stubTransaction(lines: any[], captured: Captured) {
  const tx = {
    orders: { update: async (args: any) => { captured.orderUpdate = args; } },
    orderline: {
      findMany: async () => lines,
      update: async (args: any) => { captured.lineUpdates.push(args); }
    }
  };
  const target = prisma as unknown as Record<string, unknown>;
  const original = Object.getOwnPropertyDescriptor(target, '$transaction');
  Object.defineProperty(target, '$transaction', {
    value: async (fn: (db: typeof tx) => Promise<unknown>) => fn(tx),
    configurable: true,
    writable: true
  });
  restores.push(() => {
    if (original) Object.defineProperty(target, '$transaction', original);
    else delete target.$transaction;
  });
}
function restoreAll() {
  mock.restoreAll();
  while (restores.length) restores.pop()!();
}

function ekartOrder(orderstatus: string, barcodes: Record<string, unknown> = {}) {
  return {
    id: 501,
    orderid: 'NIVAANA-0000000501',
    orderstatus,
    vendor: 'EKART',
    tracking_id: 'EKART-AWB-1',
    public_tracking_link: 'https://track.example/EKART-AWB-1',
    label_url: 'https://label.example/EKART-AWB-1.pdf',
    shipdate: 111,
    barcodes,
    status_history: [{ new_status: orderstatus, is_active: true }]
  };
}

function serviceFor(order: any) {
  const service = new OrdersService();
  mock.method(service, 'findByTrackingId', async () => order);
  mock.method(service, 'findById', async () => ({ ...order, refreshed: true }));
  return service;
}

test('Ekart portal cancel of a ready_for_dispatch order clears the shipment and keeps the status', async (t) => {
  t.after(restoreAll);
  const captured: Captured = { lineUpdates: [] };
  stubTransaction([{ id: 1, orderstatus: 'ready_for_dispatch', status_history: [] }], captured);
  const service = serviceFor(ekartOrder('ready_for_dispatch'));
  const statusUpdate = mock.method(service, 'updateOrderStatus', async () => undefined);

  await service.handleEkartWebhookStatusUpdate('EKART-AWB-1', 'Cancelled', {});

  const data = captured.orderUpdate.data;
  assert.equal(data.tracking_id, null);
  assert.equal(data.vendor, null);
  assert.equal(data.label_url, null);
  assert.equal(data.shipment_tracking_status, 'Cancelled');
  assert.equal(data.barcodes.cancellation.reason, 'courier_reported');
  assert.equal('orderstatus' in data, false, 'ready_for_dispatch stays as it is');
  assert.equal(captured.lineUpdates[0].data.tracking_id, null);
  assert.equal('orderstatus' in captured.lineUpdates[0].data, false);
  assert.equal(statusUpdate.mock.callCount(), 0);
});

test('Ekart portal cancel of a shipped order moves it back to ready_for_dispatch', async (t) => {
  t.after(restoreAll);
  const captured: Captured = { lineUpdates: [] };
  stubTransaction([
    { id: 1, orderstatus: 'shipped', status_history: [] },
    { id: 2, orderstatus: 'cancelled', status_history: [] }
  ], captured);
  const service = serviceFor(ekartOrder('shipped'));

  await service.handleEkartWebhookStatusUpdate('EKART-AWB-1', 'Shipment Cancelled', {});

  const data = captured.orderUpdate.data;
  assert.equal(data.orderstatus, 'ready_for_dispatch');
  assert.equal(data.shipdate, null);
  assert.equal(data.status_history.at(-1).reason, 'courier_shipment_cancelled');
  assert.equal(data.status_history.at(-1).is_active, true);
  assert.equal(data.status_history[0].is_active, false);
  assert.equal(captured.lineUpdates[0].data.orderstatus, 'ready_for_dispatch');
  assert.equal('orderstatus' in captured.lineUpdates[1].data, false, 'cancelled line keeps its status');
  assert.equal(captured.lineUpdates[1].data.tracking_id, null);
});

test('Ekart cancel webhook confirms the courier cancel of a cancelled order', async (t) => {
  t.after(restoreAll);
  const captured: Captured = { lineUpdates: [] };
  stubTransaction([{ id: 1, orderstatus: 'cancelled', status_history: [] }], captured);
  const service = serviceFor(ekartOrder('cancelled_completed', {
    cancellation: { provider: 'EKART', status: 'failed', tracking_id: 'EKART-AWB-1', requested_at: 50 }
  }));

  await service.handleEkartWebhookStatusUpdate('EKART-AWB-1', 'Cancelled', {});

  const data = captured.orderUpdate.data;
  assert.equal('orderstatus' in data, false, 'cancelled order keeps its status');
  assert.equal(data.tracking_id, null);
  assert.equal(data.barcodes.cancellation.status, 'confirmed');
  assert.equal(data.barcodes.cancellation.reason, 'order_cancelled');
  assert.equal(data.barcodes.cancellation.requested_at, 50);
  assert.equal(captured.lineUpdates[0].data.tracking_id, null);
});

test('Ekart forward status on a cancelled order is recorded without moving the order', async (t) => {
  t.after(restoreAll);
  const service = serviceFor(ekartOrder('cancelled_completed'));
  const statusUpdate = mock.method(service, 'updateOrderStatus', async () => undefined);
  const historyOnly = mock.method(service as any, 'recordEkartWebhookHistoryOnly', async () => ({ id: 501 }));

  await service.handleEkartWebhookStatusUpdate('EKART-AWB-1', 'Shipped', { location: 'Hub' });

  assert.equal(historyOnly.mock.callCount(), 1);
  assert.equal(historyOnly.mock.calls[0].arguments[1], 'Shipped');
  assert.equal(statusUpdate.mock.callCount(), 0, 'order and lines are not moved to shipped');
});
