export type NivaanaShipmentStatus =
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'rto_initiated'
  | 'rto_delivered';

export type ShipmozoShipmentEventStatus =
  | NivaanaShipmentStatus
  | 'cancelled'
  | 'pickup_pending'
  | 'pickup_failed'
  | 'undelivered'
  | 'delivery_failed'
  | 'ndr'
  | 'lost'
  | 'damaged';

const VALID_TRANSITIONS: Record<string, NivaanaShipmentStatus[]> = {
  ready_for_dispatch: ['shipped', 'in_transit', 'out_for_delivery', 'delivered', 'rto_initiated'],
  shipped: ['in_transit', 'out_for_delivery', 'delivered', 'rto_initiated'],
  in_transit: ['out_for_delivery', 'delivered', 'rto_initiated'],
  out_for_delivery: ['delivered', 'rto_initiated'],
  rto_initiated: ['rto_delivered']
};

export function canApplyShipmozoStatus(currentStatus: string, nextStatus: NivaanaShipmentStatus): boolean {
  const current = currentStatus.toLowerCase().trim();
  return current === nextStatus || Boolean(VALID_TRANSITIONS[current]?.includes(nextStatus));
}

export function mapShipmozoStatus(status?: string | null): NivaanaShipmentStatus | null {
  if (!status) return null;
  const normalized = status.toLowerCase().trim().replace(/[_\-\s]+/g, ' ');

  if (normalized.includes('rto') && (normalized.includes('deliver') || normalized.includes('received'))) {
    return 'rto_delivered';
  }
  if (normalized.includes('rto') || normalized.includes('return to origin')) {
    return 'rto_initiated';
  }
  if (normalized.includes('out for delivery') || normalized === 'ofd') {
    return 'out_for_delivery';
  }
  if (
    normalized.includes('undelivered') ||
    normalized.includes('not delivered') ||
    normalized.includes('delivery failed')
  ) {
    return null;
  }
  if (normalized.includes('delivered')) {
    return 'delivered';
  }
  if (
    normalized.includes('in transit') ||
    normalized.includes('intransit') ||
    normalized.includes('at hub') ||
    normalized.includes('dispatched')
  ) {
    return 'in_transit';
  }
  if (
    normalized.includes('picked up') ||
    normalized.includes('pickup done') ||
    normalized === 'shipped'
  ) {
    return 'shipped';
  }
  return null;
}

export function mapShipmozoEventStatus(status?: string | null): ShipmozoShipmentEventStatus | null {
  if (!status) return null;
  const normalized = status.toLowerCase().trim().replace(/[_\-\s]+/g, ' ');

  if (normalized.includes('pickup') && (normalized.includes('fail') || normalized.includes('cancel'))) {
    return 'pickup_failed';
  }
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('pickup pending') || normalized.includes('awaiting pickup')) return 'pickup_pending';
  if (normalized === 'ndr' || normalized.includes('non delivery report')) return 'ndr';
  if (normalized.includes('undelivered') || normalized.includes('not delivered')) return 'undelivered';
  if (normalized.includes('delivery failed') || normalized.includes('failed delivery')) return 'delivery_failed';
  if (normalized.includes('lost')) return 'lost';
  if (normalized.includes('damaged')) return 'damaged';
  return mapShipmozoStatus(status);
}

function findStatus(value: unknown, depth = 0): string | null {
  if (!value || depth > 4) return null;
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const status = findStatus(value[index], depth + 1);
      if (status) return status;
    }
    return null;
  }
  if (typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const keys = ['current_status', 'shipment_status', 'latest_status', 'status', 'scan_status'];
  for (const key of keys) {
    if (typeof record[key] === 'string' && String(record[key]).trim()) {
      return String(record[key]).trim();
    }
  }
  const containers = ['data', 'track', 'tracking', 'shipment', 'scans', 'history', 'activities'];
  for (const key of containers) {
    const status = findStatus(record[key], depth + 1);
    if (status) return status;
  }
  return null;
}

export function normalizeShipmozoTracking(tracking: unknown) {
  const currentStatus = findStatus(tracking);
  const orderStatus = findNamedStatus(tracking, ['order_status']);
  // Shipmozo may report order_status=CANCELLED while current_status remains
  // Pickup Pending. Cancellation is the authoritative terminal logistics event.
  const providerStatus = mapShipmozoEventStatus(orderStatus) === 'cancelled'
    ? orderStatus
    : currentStatus || orderStatus;
  const eventStatus = mapShipmozoEventStatus(providerStatus);
  return {
    provider_status: providerStatus,
    system_status: mapShipmozoStatus(providerStatus),
    event_status: eventStatus,
    is_exception: Boolean(eventStatus && !mapShipmozoStatus(providerStatus)),
    is_provider_cancelled: eventStatus === 'cancelled',
    provider: 'SHIPMOZO' as const
  };
}

function findNamedStatus(value: unknown, keys: string[], depth = 0): string | null {
  if (!value || depth > 4) return null;
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const status = findNamedStatus(value[index], keys, depth + 1);
      if (status) return status;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === 'string' && String(record[key]).trim()) return String(record[key]).trim();
  }
  for (const nested of Object.values(record)) {
    const status = findNamedStatus(nested, keys, depth + 1);
    if (status) return status;
  }
  return null;
}

export function extractShipmozoWebhookAwb(value: unknown, depth = 0): string | null {
  if (!value || depth > 5) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const awb = extractShipmozoWebhookAwb(item, depth + 1);
      if (awb) return awb;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of ['awb_number', 'awb', 'awbNumber', 'tracking_id', 'tracking_number']) {
    const candidate = String(record[key] || '').trim();
    if (candidate) return candidate;
  }
  for (const nested of Object.values(record)) {
    const awb = extractShipmozoWebhookAwb(nested, depth + 1);
    if (awb) return awb;
  }
  return null;
}
