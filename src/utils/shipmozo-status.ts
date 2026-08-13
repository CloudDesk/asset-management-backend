export type NivaanaShipmentStatus =
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'rto_initiated'
  | 'rto_delivered';

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
  const providerStatus = findStatus(tracking);
  return {
    provider_status: providerStatus,
    system_status: mapShipmozoStatus(providerStatus),
    provider: 'SHIPMOZO' as const
  };
}
