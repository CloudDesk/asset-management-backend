import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  shipmozoPushOrderSchema,
  shipmozoRateSchema,
  shipmozoReturnOrderSchema,
  shipmozoSchedulePickupSchema,
  shipmozoServiceabilitySchema,
} from '../src/schemas/shipmozo.schema.ts';
import {
  canApplyShipmozoStatus,
  extractShipmozoWebhookAwb,
  mapShipmozoEventStatus,
  mapShipmozoStatus,
  normalizeShipmozoTracking
} from '../src/utils/shipmozo-status.ts';
import {
  extractShipmozoOrderId,
  normalizeShipmozoRetryStage,
  SHIPMOZO_OPERATION_STAGES
} from '../src/utils/shipmozo-workflow.ts';
import {
  buildShipmozoPublicTrackingUrl,
  buildShipmozoPushOrderPayload
} from '../src/services/shipmozo.service.ts';

const validOrder = {
  order_id: 'NIV-1001',
  order_date: '2026-08-12',
  consignee_name: 'Test Customer',
  consignee_phone: '9876543210',
  consignee_email: 'customer@example.com',
  consignee_address_line_one: '12 Test Street',
  consignee_pin_code: '560001',
  consignee_city: 'Bengaluru',
  consignee_state: 'Karnataka',
  product_detail: [{
    name: 'Incense',
    sku_number: 'SKU-1',
    quantity: 1,
    unit_price: 250,
  }],
  payment_type: 'PREPAID',
  weight: 500,
  length: 20,
  width: 10,
  height: 8,
  warehouse_id: 'WH-1',
};

test('accepts a valid prepaid Shipmozo order and applies safe defaults', () => {
  const parsed = shipmozoPushOrderSchema.parse(validOrder);
  assert.equal(parsed.assignment_mode, undefined);
  assert.equal(parsed.cod_amount, 0);
  assert.equal(parsed.product_detail[0]?.discount, 0);
});

test('allows Shipmozo to use its account default pickup location', () => {
  const { warehouse_id: _warehouseId, ...orderWithoutWarehouse } = validOrder;
  const parsed = shipmozoPushOrderSchema.parse(orderWithoutWarehouse);
  assert.equal(parsed.warehouse_id, undefined);
});

test('requires a positive COD amount for COD shipments', () => {
  const result = shipmozoPushOrderSchema.safeParse({
    ...validOrder,
    payment_type: 'COD',
    cod_amount: 0,
  });
  assert.equal(result.success, false);
});

test('requires courier_id for manual assignment', () => {
  const result = shipmozoPushOrderSchema.safeParse({
    ...validOrder,
    assignment_mode: 'MANUAL',
  });
  assert.equal(result.success, false);
});

test('validates Indian serviceability pincodes', () => {
  assert.equal(shipmozoServiceabilitySchema.safeParse({
    pickup_pincode: '560001',
    delivery_pincode: '110001',
  }).success, true);
  assert.equal(shipmozoServiceabilitySchema.safeParse({
    pickup_pincode: '56001',
    delivery_pincode: '110001',
  }).success, false);
});

test('coerces numeric rate inputs from API form payloads', () => {
  const parsed = shipmozoRateSchema.parse({
    pickup_pincode: '560001',
    delivery_pincode: '110001',
    payment_type: 'PREPAID',
    order_amount: '1000',
    weight: '500',
    dimensions: [{ no_of_box: '1', length: '20', width: '10', height: '8' }],
  });
  assert.equal(parsed.order_amount, 1000);
  assert.equal(parsed.weight, 500);
});

test('validates and defaults Shipmozo return orders', () => {
  const parsed = shipmozoReturnOrderSchema.parse({
    order_id: 'RETURN-NIV-1001-1',
    order_date: '2026-08-12',
    pickup_name: 'Test Customer',
    pickup_phone: '9876543210',
    pickup_address_line_one: '12 Test Street',
    pickup_pin_code: '560001',
    pickup_city: 'Bengaluru',
    pickup_state: 'Karnataka',
    product_detail: [{ name: 'Incense', sku_number: 'SKU-1', quantity: 1, unit_price: 250 }],
    weight: 500,
    length: 20,
    width: 10,
    height: 8,
    return_reason_id: '4',
    customer_request: 'REFUND',
  });
  assert.equal(parsed.payment_type, 'PREPAID');
  assert.equal(parsed.schedule_pickup, false);
});

test('validates standalone pickup requests and coerces return request IDs', () => {
  const parsed = shipmozoSchedulePickupSchema.parse({
    order_id: 'RETURN-NIV-1001-1',
    return_request_id: '42',
  });
  assert.equal(parsed.return_request_id, 42);
});

test('normalizes common Shipmozo tracking statuses without changing unknown statuses', () => {
  assert.equal(mapShipmozoStatus('Picked Up'), 'shipped');
  assert.equal(mapShipmozoStatus('In Transit'), 'in_transit');
  assert.equal(mapShipmozoStatus('Out For Delivery'), 'out_for_delivery');
  assert.equal(mapShipmozoStatus('RTO Delivered'), 'rto_delivered');
  assert.equal(mapShipmozoStatus('Undelivered'), null);
  assert.equal(mapShipmozoStatus('Manifest Generated'), null);

  assert.deepEqual(normalizeShipmozoTracking({
    data: { tracking: { current_status: 'Delivered' } }
  }), {
    provider_status: 'Delivered',
    system_status: 'delivered',
    event_status: 'delivered',
    is_exception: false,
    is_provider_cancelled: false,
    provider: 'SHIPMOZO'
  });
});

test('builds the supported Shipmozo customer tracking URL from an AWB', () => {
  assert.equal(
    buildShipmozoPublicTrackingUrl('153291463400264'),
    'https://app.shipmozo.com/track-order?awb=153291463400264'
  );
  assert.equal(buildShipmozoPublicTrackingUrl(''), '');
});

test('classifies Shipmozo logistics exceptions without promoting them to order lifecycle statuses', () => {
  assert.equal(mapShipmozoEventStatus('Pickup Pending'), 'pickup_pending');
  assert.equal(mapShipmozoEventStatus('Pickup Failed'), 'pickup_failed');
  assert.equal(mapShipmozoEventStatus('Pickup Cancelled'), 'pickup_failed');
  assert.equal(mapShipmozoEventStatus('Undelivered'), 'undelivered');
  assert.equal(mapShipmozoEventStatus('Delivery Failed'), 'delivery_failed');
  assert.equal(mapShipmozoEventStatus('NDR'), 'ndr');
  assert.equal(mapShipmozoEventStatus('Shipment Lost'), 'lost');
  assert.equal(mapShipmozoEventStatus('Package Damaged'), 'damaged');
  for (const status of ['Pickup Pending', 'Pickup Failed', 'Undelivered', 'Delivery Failed', 'NDR', 'Lost', 'Damaged']) {
    assert.equal(mapShipmozoStatus(status), null);
  }
});

test('prioritizes Shipmozo cancellation over stale pickup status and extracts webhook AWB variants', () => {
  const normalized = normalizeShipmozoTracking({
    awb_number: '153291463400264',
    order_status: 'CANCELLED',
    current_status: 'Pickup Pending'
  });
  assert.equal(normalized.provider_status, 'CANCELLED');
  assert.equal(normalized.event_status, 'cancelled');
  assert.equal(normalized.system_status, null);
  assert.equal(normalized.is_provider_cancelled, true);
  assert.equal(extractShipmozoWebhookAwb({ data: { tracking_number: '153291463400264' } }), '153291463400264');
});

test('allows forward shipment progress and blocks stale tracking regression', () => {
  assert.equal(canApplyShipmozoStatus('ready_for_dispatch', 'in_transit'), true);
  assert.equal(canApplyShipmozoStatus('shipped', 'delivered'), true);
  assert.equal(canApplyShipmozoStatus('delivered', 'in_transit'), false);
  assert.equal(canApplyShipmozoStatus('out_for_delivery', 'shipped'), false);
  assert.equal(canApplyShipmozoStatus('rto_initiated', 'rto_delivered'), true);
});

test('ships with a persistent operation ledger migration', () => {
  const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(
    resolve('prisma/migrations/20260812120000_add_shipmozo_operations/migration.sql'),
    'utf8'
  );

  assert.match(schema, /model ShipmozoOperation/);
  assert.match(schema, /idempotencyKey\s+String\s+@unique/);
  assert.match(schema, /nextSyncAt\s+BigInt\?/);
  assert.match(migration, /CREATE TABLE "shipmozo_operations"/);
  assert.match(migration, /REFERENCES "orders"\("id"\) ON DELETE SET NULL/);
  assert.match(migration, /REFERENCES "return_requests"\("id"\) ON DELETE SET NULL/);
  assert.match(migration, /shipmozo_operations_status_next_sync_at_idx/);
});

test('extracts and preserves the Shipmozo internal order ID', () => {
  assert.equal(extractShipmozoOrderId({ order_id: 45678, reference_id: 'REF-1' }), '45678');
  assert.equal(extractShipmozoOrderId({
    shipmozo_order_id: '45678',
    push_order: { order_id: 'ignored-fallback' }
  }), '45678');
  assert.equal(extractShipmozoOrderId({ push_order: { order_id: 'nested-123' } }), 'nested-123');
});

test('normalizes the Shipmozo push-order wire payload without workflow-only fields', () => {
  const parsed = shipmozoPushOrderSchema.parse({
    ...validOrder,
    consignee_phone: 9994824573,
    consignee_alternate_phone: 9994824573,
    consignee_pin_code: 600119,
    shipping_charges: '40',
    cod_amount: '',
    assignment_mode: 'AUTO',
    schedule_pickup: true
  });
  const {
    assignment_mode: _assignmentMode,
    courier_id: _courierId,
    schedule_pickup: _schedulePickup,
    ...providerInput
  } = parsed;
  const outbound = buildShipmozoPushOrderPayload(providerInput);

  assert.equal(outbound.consignee_phone, '9994824573');
  assert.equal(outbound.consignee_alternate_phone, '9994824573');
  assert.equal(outbound.consignee_pin_code, '600119');
  assert.equal(outbound.cod_amount, '');
  assert.equal(outbound.shipping_charges, '40');
  assert.equal(outbound.weight, '500');
  assert.equal((outbound.product_detail as Array<Record<string, unknown>>)[0]?.discount, 0);
  assert.equal('assignment_mode' in outbound, false);
  assert.equal('schedule_pickup' in outbound, false);
});

test('normalizes legacy growing failure stages to bounded retry stages', () => {
  assert.equal(
    normalizeShipmozoRetryStage('initialized_failed_failed_failed_failed_failed'),
    SHIPMOZO_OPERATION_STAGES.pushOrderFailed
  );
  assert.equal(
    normalizeShipmozoRetryStage('order_pushed_failed_failed'),
    SHIPMOZO_OPERATION_STAGES.courierAssignmentFailed
  );
  assert.ok(Object.values(SHIPMOZO_OPERATION_STAGES).every((stage) => stage.length <= 50));
});

test('forward workflow uses exact order lookup and the provider order ID downstream', () => {
  const ordersService = readFileSync(resolve('src/services/orders.service.ts'), 'utf8');
  const controller = readFileSync(resolve('src/controllers/shipmozo.controller.ts'), 'utf8');
  const operationService = readFileSync(resolve('src/services/shipmozo-operation.service.ts'), 'utf8');

  assert.match(ordersService, /prisma\.orders\.findUnique\(\{ where: \{ orderid: orderIdString \} \}\)/);
  assert.match(controller, /autoAssignOrder\(shipmozoOrderId\)/);
  assert.match(controller, /schedulePickup\(shipmozoOrderId\)/);
  assert.doesNotMatch(controller, /`\$\{currentStage\}_failed`/);
  assert.match(operationService, /status: \{ in: \['pending', 'failed'\] \}/);
});

test('customer cancellation persists Shipmozo confirmation and failure outcomes', () => {
  const ordersService = readFileSync(resolve('src/services/orders.service.ts'), 'utf8');

  assert.match(ordersService, /private async cancelProviderShipment/);
  assert.match(ordersService, /shipmozoService\.cancelOrder\(providerOrderId, trackingId\)/);
  assert.match(ordersService, /status: 'confirmed'/);
  assert.match(ordersService, /status: 'failed'/);
  assert.match(ordersService, /stage: 'shipment_cancelled'/);
  assert.match(ordersService, /stage: 'cancellation_failed'/);
  assert.match(ordersService, /return await this\.cancelProviderShipment\(updatedOrder\)/);
});

test('cancelled Shipmozo bookings release the order for a new shipment without cancelling the order', () => {
  const controller = readFileSync(resolve('src/controllers/shipmozo.controller.ts'), 'utf8');
  const trackingSync = readFileSync(resolve('src/services/shipmozo-tracking-sync.service.ts'), 'utf8');

  for (const source of [controller, trackingSync]) {
    assert.match(source, /tracking_id: null/);
    assert.match(source, /vendor: null/);
    assert.match(source, /shipment_created_at: null/);
    assert.match(source, /label_url: null/);
  }
  assert.doesNotMatch(trackingSync, /providerCancelled[\s\S]{0,100}orderstatus: ['"]cancelled['"]/);
});
