import test from 'node:test';
import assert from 'node:assert/strict';

import {
  completeReturnResolutionSchema,
  createReturnCreditNoteSchema,
  createReturnRequestSchema,
  inspectReturnRequestSchema,
  returnOperationsSummaryQuerySchema,
  updateReturnRefundStatusSchema,
  updateReturnShipmentStatusSchema,
} from '../src/schemas/return-source.schema.ts';

test('requires a selected policy reason, reason code, or reason text for customer return creation', () => {
  const result = createReturnRequestSchema.safeParse({
    orderlineid: 10,
    requesttype: 'return',
    requestedresolution: 'refund',
  });

  assert.equal(result.success, false);
});

test('accepts policy-reason mapped customer return requests', () => {
  const result = createReturnRequestSchema.parse({
    orderlineid: '10',
    requesttype: 'return',
    policyreasonruleid: '42',
    requestedquantity: '2',
    requestedresolution: 'refund',
    attachments: [],
  });

  assert.equal(result.orderlineid, 10);
  assert.equal(result.policyreasonruleid, 42);
  assert.equal(result.requestedquantity, 2);
});

test('enforces refund closure method and partial refund amount', () => {
  assert.equal(
    completeReturnResolutionSchema.safeParse({
      action_type: 'refund',
      status: 'completed',
      amount: 100,
    }).success,
    false
  );
  assert.equal(
    completeReturnResolutionSchema.safeParse({
      action_type: 'partial_refund',
      status: 'completed',
      refund_method: 'manual',
    }).success,
    false
  );
  assert.equal(
    completeReturnResolutionSchema.safeParse({
      action_type: 'partial_refund',
      status: 'completed',
      refund_method: 'manual',
      amount: 0,
    }).success,
    false
  );
});

test('requires tracking or reference for completed replacement and missing-item shipments', () => {
  assert.equal(
    completeReturnResolutionSchema.safeParse({
      action_type: 'replacement_shipment',
      status: 'completed',
    }).success,
    false
  );
  assert.equal(
    completeReturnResolutionSchema.safeParse({
      action_type: 'missing_item_shipment',
      status: 'completed',
      shipment_tracking_id: 'TRK123',
    }).success,
    true
  );
});

test('validates inspection quantities and rejected-stock on hold rules', () => {
  assert.equal(
    inspectReturnRequestSchema.safeParse({
      approvedquantity: 0,
      rejectedquantity: 0,
      condition: 'resellable',
      restockaction: 'none',
    }).success,
    false
  );
  assert.equal(
    inspectReturnRequestSchema.safeParse({
      approvedquantity: 1,
      rejectedquantity: 0,
      condition: 'resellable',
      restockaction: 'available',
    }).success,
    true
  );
  assert.equal(
    inspectReturnRequestSchema.safeParse({
      approvedquantity: 1,
      rejectedquantity: 0,
      condition: 'damaged',
      restockaction: 'on_hold',
    }).success,
    false
  );
});

test('validates credit note creation contract', () => {
  const parsed = createReturnCreditNoteSchema.parse({
    resolution_action_id: '9',
    refund_amount: '1180.25',
    gst_rate: '18',
    status: 'issued',
  });

  assert.equal(parsed.resolution_action_id, 9);
  assert.equal(parsed.refund_amount, 1180.25);
  assert.equal(parsed.status, 'issued');
  assert.equal(createReturnCreditNoteSchema.parse({ refund_amount: 10 }).status, 'draft');
  assert.equal(createReturnCreditNoteSchema.safeParse({ refund_amount: -1 }).success, false);
  assert.equal(createReturnCreditNoteSchema.safeParse({ refund_amount: 10, status: 'void' }).success, false);
});

test('validates outbound return shipment status updates', () => {
  assert.equal(
    updateReturnShipmentStatusSchema.safeParse({
      status: 'delivered',
    }).success,
    false
  );

  const parsed = updateReturnShipmentStatusSchema.parse({
    resolution_action_id: '12',
    status: 'delivered',
    event_time: '1722519000000',
    shipment_tracking_id: 'OUT123',
    shipment_provider: 'EKART',
  });

  assert.equal(parsed.resolution_action_id, 12);
  assert.equal(parsed.status, 'delivered');
  assert.equal(parsed.event_time, 1722519000000);
  assert.equal(parsed.shipment_tracking_id, 'OUT123');
});

test('validates return refund status updates', () => {
  assert.equal(
    updateReturnRefundStatusSchema.safeParse({
      status: 'completed',
    }).success,
    false
  );

  const parsed = updateReturnRefundStatusSchema.parse({
    external_reference: 'REFUND_TXN_123',
    status: 'completed',
    event_time: '1722519000000',
  });

  assert.equal(parsed.external_reference, 'REFUND_TXN_123');
  assert.equal(parsed.status, 'completed');
  assert.equal(parsed.event_time, 1722519000000);
});

test('validates return operations summary filters', () => {
  const parsed = returnOperationsSummaryQuerySchema.parse({
    from: '1722500000',
    to: '1722519000',
    requesttype: 'replacement',
    source: 'customer',
    status: 'replacement_shipped',
  });

  assert.equal(parsed.from, 1722500000);
  assert.equal(parsed.to, 1722519000);
  assert.equal(parsed.requesttype, 'replacement');
  assert.equal(parsed.source, 'customer');
  assert.equal(parsed.status, 'replacement_shipped');
  assert.equal(returnOperationsSummaryQuerySchema.safeParse({ from: 200, to: 100 }).success, false);
});
