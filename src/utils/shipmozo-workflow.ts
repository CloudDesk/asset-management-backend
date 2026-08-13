export const SHIPMOZO_OPERATION_STAGES = {
  initialized: 'initialized',
  orderPushed: 'order_pushed',
  courierAssigned: 'courier_assigned',
  pickupScheduled: 'pickup_scheduled',
  shipmentPersisted: 'shipment_persisted',
  pushOrderFailed: 'push_order_failed',
  courierAssignmentFailed: 'courier_assignment_failed',
  pickupSchedulingFailed: 'pickup_scheduling_failed',
  shipmentPersistenceFailed: 'shipment_persistence_failed',
  pushReturnFailed: 'push_return_failed',
  returnPushed: 'return_pushed',
  returnPersisted: 'return_persisted',
  awaitingPickup: 'awaiting_pickup'
} as const;

const knownStages = new Set<string>(Object.values(SHIPMOZO_OPERATION_STAGES));

export function normalizeShipmozoRetryStage(stage: string): string {
  if (knownStages.has(stage)) return stage;
  if (stage.startsWith('order_pushed')) return SHIPMOZO_OPERATION_STAGES.courierAssignmentFailed;
  if (stage.startsWith('courier_assigned')) return SHIPMOZO_OPERATION_STAGES.pickupSchedulingFailed;
  if (stage.startsWith('pickup_scheduled')) return SHIPMOZO_OPERATION_STAGES.shipmentPersistenceFailed;
  return SHIPMOZO_OPERATION_STAGES.pushOrderFailed;
}

export function extractShipmozoOrderId(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const direct = record.shipmozo_order_id ?? record.order_id;
  if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct).trim();
  return extractShipmozoOrderId(record.push_order);
}

export function asShipmozoWorkflowData(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}
