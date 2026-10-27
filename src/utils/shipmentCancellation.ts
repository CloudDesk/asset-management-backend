/**
 * Courier shipment cancellation records kept inside `orders.barcodes`.
 *
 * `cancellation` is the latest attempt (read by existing screens and the
 * Shipmozo tracking sync). `shipment_history` keeps every cancelled AWB so a
 * shipment-only cancel and re-ship does not lose the earlier AWB, and new
 * shipment metadata carries the list forward.
 */

export type ShipmentProvider = 'EKART' | 'SHIPMOZO';

export type ShipmentCancellationReason = 'shipment_only' | 'order_cancelled' | 'courier_reported';

export interface ShipmentCancellationEntry {
  provider: string;
  tracking_id: string;
  status: 'confirmed' | 'failed';
  reason: ShipmentCancellationReason;
  confirmation_source?: string;
  requested_at?: number;
  confirmed_at?: number;
  failed_at?: number;
  error?: string;
}

export function asShipmentMetadata(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

export function shipmentHistoryOf(metadata: unknown): ShipmentCancellationEntry[] {
  const history = asShipmentMetadata(metadata).shipment_history;
  return Array.isArray(history) ? history as ShipmentCancellationEntry[] : [];
}

/** Appends a finished cancellation (confirmed or failed) to the AWB history. */
export function withShipmentHistory(metadata: unknown, entry: ShipmentCancellationEntry): Record<string, any> {
  const current = asShipmentMetadata(metadata);
  return {
    ...current,
    shipment_history: [...shipmentHistoryOf(current), entry]
  };
}

/**
 * New shipment metadata replaces `barcodes`; keep the AWB history from the
 * previous value so cancelled shipments stay on record.
 */
export function carryShipmentHistory(previous: unknown, next: unknown): Record<string, any> | null {
  const history = shipmentHistoryOf(previous);
  if (next === null || next === undefined) {
    return history.length ? { shipment_history: history } : null;
  }
  const nextMetadata = asShipmentMetadata(next);
  return history.length ? { ...nextMetadata, shipment_history: history } : nextMetadata;
}

/**
 * True only when this AWB's cancellation is already confirmed. A confirmed
 * cancellation of an earlier AWB (shipment-only cancel, then re-ship) must not
 * stop the current AWB from being cancelled.
 */
export function isShipmentCancellationConfirmed(metadata: unknown, trackingId: string): boolean {
  const awb = String(trackingId || '').trim();
  const current = asShipmentMetadata(metadata);
  const cancellation = asShipmentMetadata(current.cancellation);
  if (cancellation.status === 'confirmed') {
    const cancelledAwb = String(cancellation.tracking_id || '').trim();
    // Records written before the AWB was stored belong to the current shipment.
    if (!cancelledAwb || cancelledAwb === awb) return true;
  }
  return shipmentHistoryOf(current).some((entry) =>
    entry.status === 'confirmed' && String(entry.tracking_id || '').trim() === awb);
}

/** The earlier attempt's fields are reused only when it was for the same AWB. */
export function cancellationForSameAwb(metadata: unknown, trackingId: string): Record<string, any> {
  const cancellation = asShipmentMetadata(asShipmentMetadata(metadata).cancellation);
  return String(cancellation.tracking_id || '').trim() === String(trackingId || '').trim()
    ? cancellation
    : {};
}

/**
 * Order fields that remove the current shipment so a new one can be created.
 * The cancelled AWB is kept in `cancellation` and `shipment_history`; an AWB
 * whose cancellation is already confirmed is not added to the history again.
 */
function buildShipmentRemovalUpdate(input: {
  barcodes: unknown;
  entry: ShipmentCancellationEntry;
  shipmentTrackingStatus: string;
  timestamp: number;
}) {
  const alreadyConfirmed = isShipmentCancellationConfirmed(input.barcodes, input.entry.tracking_id);
  const metadata = alreadyConfirmed
    ? asShipmentMetadata(input.barcodes)
    : withShipmentHistory(input.barcodes, input.entry);
  return {
    tracking_id: null,
    vendor: null,
    public_tracking_link: null,
    shipment_created_at: null,
    label_url: null,
    label_downloaded_at: null,
    label_printed_at: null,
    shipment_tracking_status: input.shipmentTrackingStatus,
    barcodes: {
      ...metadata,
      cancellation: { ...cancellationForSameAwb(input.barcodes, input.entry.tracking_id), ...input.entry }
    },
    modifieddate: input.timestamp
  };
}

/**
 * Order fields for a shipment-only cancel: the order stays as it is (no status,
 * refund or stock change) and only the shipment is removed so a new one can be
 * created. The cancelled AWB is kept in `cancellation` and `shipment_history`.
 */
export function buildShipmentOnlyCancellationUpdate(input: {
  barcodes: unknown;
  provider: ShipmentProvider;
  trackingId: string;
  timestamp: number;
}) {
  return buildShipmentRemovalUpdate({
    barcodes: input.barcodes,
    entry: {
      provider: input.provider,
      tracking_id: input.trackingId,
      status: 'confirmed',
      reason: 'shipment_only',
      confirmation_source: 'cancel_api',
      confirmed_at: input.timestamp
    },
    shipmentTrackingStatus: 'Cancelled',
    timestamp: input.timestamp
  });
}

/**
 * True when a courier tracking status means the shipment itself was cancelled
 * (in the courier portal or by the courier). Pickup cancellations and RTO or
 * return events are not shipment cancellations.
 */
export function isCourierShipmentCancelledStatus(status: string | null | undefined): boolean {
  const normalized = String(status || '').toLowerCase().trim().replace(/[_\-\s]+/g, ' ');
  if (!normalized.includes('cancel')) return false;
  return !/pick ?up|rto|return/.test(normalized);
}

/**
 * Order fields when the courier reports the shipment as cancelled (webhook).
 * The shipment is removed like a shipment-only cancel; on an order we already
 * cancelled this confirms the pending or failed courier cancellation.
 */
export function buildCourierReportedCancellationUpdate(input: {
  barcodes: unknown;
  provider: ShipmentProvider;
  trackingId: string;
  courierStatus: string;
  orderCancelled: boolean;
  timestamp: number;
}) {
  return buildShipmentRemovalUpdate({
    barcodes: input.barcodes,
    entry: {
      provider: input.provider,
      tracking_id: input.trackingId,
      status: 'confirmed',
      reason: input.orderCancelled ? 'order_cancelled' : 'courier_reported',
      confirmation_source: 'webhook',
      confirmed_at: input.timestamp
    },
    shipmentTrackingStatus: input.courierStatus,
    timestamp: input.timestamp
  });
}
