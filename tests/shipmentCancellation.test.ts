import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildShipmentOnlyCancellationUpdate,
  cancellationForSameAwb,
  carryShipmentHistory,
  isShipmentCancellationConfirmed,
  shipmentHistoryOf,
  withShipmentHistory
} from '../src/utils/shipmentCancellation.ts';
import { retiredShipmozoIdempotencyKey } from '../src/utils/shipmozo-workflow.ts';
import { ShipmentCancellationService } from '../src/services/shipment-cancellation.service.ts';

const firstAwbCancel = {
  provider: 'EKART',
  tracking_id: 'AWB-1',
  status: 'confirmed' as const,
  reason: 'shipment_only' as const,
  confirmed_at: 1
};

test('shipment-only cancel clears the shipment and keeps the cancelled AWB', () => {
  const update = buildShipmentOnlyCancellationUpdate({
    barcodes: { wbn: 'AWB-1' },
    provider: 'EKART',
    trackingId: 'AWB-1',
    timestamp: 100
  });

  assert.equal(update.tracking_id, null);
  assert.equal(update.vendor, null);
  assert.equal(update.public_tracking_link, null);
  assert.equal(update.label_url, null);
  assert.equal(update.shipment_created_at, null);
  assert.equal(update.shipment_tracking_status, 'Cancelled');
  assert.equal(update.barcodes.cancellation.tracking_id, 'AWB-1');
  assert.equal(update.barcodes.cancellation.status, 'confirmed');
  assert.deepEqual(shipmentHistoryOf(update.barcodes).map((entry) => entry.tracking_id), ['AWB-1']);
  assert.equal('orderstatus' in update, false, 'order status must not change');
});

test('new shipment metadata carries the cancelled AWB history', () => {
  const previous = withShipmentHistory({ wbn: 'AWB-1' }, firstAwbCancel);
  const next = carryShipmentHistory(previous, { wbn: 'AWB-2' });

  assert.equal(next?.wbn, 'AWB-2');
  assert.deepEqual(shipmentHistoryOf(next).map((entry) => entry.tracking_id), ['AWB-1']);
  assert.equal(next?.cancellation, undefined, 'old cancellation must not describe the new AWB');
  assert.deepEqual(carryShipmentHistory({ wbn: 'AWB-1' }, { wbn: 'AWB-2' }), { wbn: 'AWB-2' });
  assert.equal(carryShipmentHistory({ wbn: 'AWB-1' }, null), null);
  assert.deepEqual(carryShipmentHistory(previous, null), { shipment_history: [firstAwbCancel] });
});

test('a confirmed cancel of the old AWB does not skip cancelling the new AWB', () => {
  const afterReship = {
    wbn: 'AWB-2',
    cancellation: { provider: 'EKART', status: 'confirmed', tracking_id: 'AWB-1' },
    shipment_history: [firstAwbCancel]
  };

  assert.equal(isShipmentCancellationConfirmed(afterReship, 'AWB-2'), false);
  assert.equal(isShipmentCancellationConfirmed(afterReship, 'AWB-1'), true);
  assert.deepEqual(cancellationForSameAwb(afterReship, 'AWB-2'), {});
  assert.equal(cancellationForSameAwb(afterReship, 'AWB-1').status, 'confirmed');
  // Records written before the AWB was stored still count for the current shipment.
  assert.equal(isShipmentCancellationConfirmed({ cancellation: { status: 'confirmed' } }, 'AWB-9'), true);
  assert.equal(isShipmentCancellationConfirmed({ cancellation: { status: 'failed', tracking_id: 'AWB-2' } }, 'AWB-2'), false);
});

test('retired Shipmozo key frees the order key and fits the column', () => {
  assert.equal(retiredShipmozoIdempotencyKey('forward:NIVAANA-1', 5), 'forward:NIVAANA-1:cancelled:5');
  const long = retiredShipmozoIdempotencyKey(`forward:${'x'.repeat(250)}`, 1760000000000);
  assert.equal(long.length, 200);
  assert.ok(long.endsWith(':cancelled:1760000000000'));
});

function fakeDb(order: Record<string, any> | null) {
  const calls: { orderUpdate?: any; orderlineUpdate?: any; transactions: number } = { transactions: 0 };
  const db = {
    orders: {
      findFirst: async () => order,
      update: (args: any) => {
        calls.orderUpdate = args;
        return args;
      }
    },
    orderline: {
      updateMany: (args: any) => {
        calls.orderlineUpdate = args;
        return args;
      }
    },
    $transaction: async (operations: any[]) => {
      calls.transactions += 1;
      return operations;
    }
  };
  return { db, calls };
}

test('cancel service: courier first, then order and lines cleared, order kept', async () => {
  const { db, calls } = fakeDb({
    id: 7,
    orderid: 'NIVAANA-7',
    orderstatus: 'ready_for_dispatch',
    tracking_id: 'AWB-1',
    barcodes: { wbn: 'AWB-1' }
  });
  let courierCalls = 0;
  const service = new ShipmentCancellationService(db as any);

  const result = await service.cancelShipmentKeepOrder({
    provider: 'EKART',
    trackingId: 'AWB-1',
    cancelWithProvider: async () => {
      courierCalls += 1;
      return { status: true, remark: 'cancelled', tracking_id: 'AWB-1' };
    }
  });

  assert.equal(courierCalls, 1);
  assert.equal(result.providerResponse.remark, 'cancelled');
  assert.equal(calls.transactions, 1);
  assert.equal(calls.orderUpdate.where.id, 7);
  assert.equal(calls.orderUpdate.data.tracking_id, null);
  assert.equal(calls.orderUpdate.data.barcodes.shipment_history[0].tracking_id, 'AWB-1');
  assert.equal(calls.orderUpdate.data.orderstatus, undefined);
  assert.deepEqual(calls.orderlineUpdate.where, { orderid: 7 });
  assert.equal(calls.orderlineUpdate.data.tracking_id, null);
});

test('cancel service: courier refusal changes nothing on our side', async () => {
  const { db, calls } = fakeDb({ id: 7, orderstatus: 'ready_for_dispatch', tracking_id: 'AWB-1' });
  const service = new ShipmentCancellationService(db as any);

  await assert.rejects(
    service.cancelShipmentKeepOrder({
      provider: 'SHIPMOZO',
      trackingId: 'AWB-1',
      cancelWithProvider: async () => {
        throw new Error('Shipmozo order cancellation failed: already picked up');
      }
    }),
    /already picked up/
  );
  assert.equal(calls.transactions, 0);
  assert.equal(calls.orderUpdate, undefined);
});

test('cancel service: refuses dispatched orders and unknown AWBs without calling the courier', async () => {
  let courierCalls = 0;
  const cancelWithProvider = async () => {
    courierCalls += 1;
    return {};
  };

  const shipped = new ShipmentCancellationService(fakeDb({ id: 7, orderstatus: 'shipped', tracking_id: 'AWB-1' }).db as any);
  await assert.rejects(
    shipped.cancelShipmentKeepOrder({ provider: 'EKART', trackingId: 'AWB-1', cancelWithProvider }),
    /ready_for_dispatch/
  );

  const missing = new ShipmentCancellationService(fakeDb(null).db as any);
  await assert.rejects(
    missing.cancelShipmentKeepOrder({ provider: 'EKART', trackingId: 'AWB-X', cancelWithProvider }),
    /No EKART order has tracking ID AWB-X/
  );
  assert.equal(courierCalls, 0);
});
