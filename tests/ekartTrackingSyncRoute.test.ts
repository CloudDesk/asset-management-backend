import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import { OrdersService } from '../src/services/orders.service.ts';
import { CustomerNotificationService } from '../src/services/customer-notification.service.ts';
import { ekartRoutes } from '../src/routes/ekart.route.ts';
import { errorHandler } from '../src/utils/errorHandler.ts';

const before = {
  id: 501,
  orderid: 'NIVAANA-0000000501',
  orderstatus: 'ready_for_dispatch',
  vendor: 'EKART',
  tracking_id: 'EKART-AWB-1'
};

async function postSync(orderId: string) {
  const app = Fastify();
  app.setErrorHandler(errorHandler as any);
  await app.register(ekartRoutes, { prefix: '/ekart' });
  const response = await app.inject({ method: 'POST', url: `/ekart/orders/${orderId}/tracking/sync` });
  await app.close();
  return response;
}

test('sync route returns the summary and pushes only on a real status change', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(OrdersService.prototype, 'findById', async () => before);
  const push = mock.method(CustomerNotificationService.prototype, 'notifyOrderStatus', async () => null);
  const summary = {
    order_id: 501, order_number: 'NIVAANA-0000000501', tracking_id: 'EKART-AWB-1', ekart_status: 'Shipped',
    previous_status: 'ready_for_dispatch', order_status: 'shipped', shipment_cancelled: false, changed: true
  };
  const sync = mock.method(OrdersService.prototype, 'syncEkartTracking', async () => ({ order: { ...before, orderstatus: 'shipped' }, summary }));

  let response = await postSync('501');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, summary);
  assert.equal(push.mock.callCount(), 1);

  sync.mock.mockImplementation(async () => ({
    order: { ...before, tracking_id: null },
    summary: { ...summary, ekart_status: 'Cancelled', order_status: 'ready_for_dispatch', shipment_cancelled: true }
  }));
  response = await postSync('501');
  assert.equal(response.statusCode, 200);
  assert.equal(push.mock.callCount(), 1, 'courier cancel sends no push');

  response = await postSync('abc');
  assert.equal(response.statusCode, 400);
});
