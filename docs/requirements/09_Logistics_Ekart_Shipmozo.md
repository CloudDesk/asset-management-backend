# 09 · Logistics — Ekart and Shipmozo

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`ekart.*`, `shipmozo.*`, `shipmozo-tracking-sync.service.ts`, `shipmozo-operation.service.ts`, `shipmentCancellation.ts`, `shippingCalculator.ts`), Master.md FIX-2026-10-06-40 … FIX-2026-10-27-166, Inventory `rules/EKART.md`.

## 1. Purpose

Books forward shipments for Nivaana orders, reverse pickups for returns, prints labels, and keeps order status in step with the courier.

## 2. Common rules (both couriers)

- **LOG-01** A shipment is created from Inventory Order Detail → Create Shipment, once the order is **ready for dispatch**. Only shippable (not cancelled) lines are sent.
- **LOG-02** Every shipped line must have an HSN/GST snapshot, otherwise the shipment is blocked. Mixed-HSN orders send one item per line (Ekart `items[]`) (FIX-2026-10-06-41).
- **LOG-03** The label shows the product short name. The label PDF is stored through the file service, and its URL, download time and print time are saved on the order.
- **LOG-04** Package size and weight are calculated from product dimensions × pack size (`shippingCalculator.ts`), with defaults when data is missing.
- **LOG-05** A courier cancel, whether made by the admin or reported by the courier, clears the tracking id, vendor and label, and moves `shipped` / `in_transit` / `out_for_delivery` back to `ready_for_dispatch` with a history entry. Cancelled or returned lines keep their status. The cancelled AWB stays in the order's AWB history (FIX-110 / 112 / 119 / 165).
- **LOG-06** A cancel status reported on a delivered, RTO or returned order is recorded in history only. On a cancelled order the status is kept.
- **LOG-07** A customer order cancel also cancels the courier shipment, but only when the whole order is cancelled. A partial cancel keeps the shipment and logs a warning.
- **LOG-08** Courier RTO statuses create RTO records automatically (module 10).
- **LOG-09** Push notifications are sent only on a real status change, never for a courier cancel.
- **LOG-10** Reverse pickups declare **paid amount × returned share**, with a minimum of ₹1 (FIX-2026-10-09-104).

## 3. Ekart

- **LOG-11** Ekart is always enabled.
- **LOG-12** Endpoints:
  - connection status, connect channel
  - pickup addresses (warehouses)
  - forward / reverse shipment, label, rates
  - track by AWB, cancel by AWB (shipment-only cancel)
- **LOG-13** The forward shipment sends the **selected pickup warehouse** as `pickup_location` (FIX-2026-10-06-40). The seller GST TIN comes from `SELLER_GST_TIN`.
- **LOG-14** Reverse shipments need a return reason and the reverse payment mode. The seller details come from the default Ekart address, so the admin does not type them (FIX-2026-10-08-91).
- **LOG-15** Status arrives by **webhook** (`POST /v1/ekart/webhook/track-status`, HMAC checked). **Sync Ekart Tracking** on Order Detail pulls the live status when a webhook was missed (`POST /v1/ekart/orders/:orderId/tracking/sync`) (FIX-2026-10-27-166).

## 4. Shipmozo

- **LOG-16** Shipmozo is enabled per environment with `SHIPMOZO_INTEGRATION_ENABLED`; its routes are not registered when it is off. It is live in SIT, UAT and Prod (FIX-121).
- **LOG-17** Endpoints:
  - connection status, warehouses, countries, return reasons
  - serviceability, rates
  - forward shipment, return order, schedule pickup
  - track, label
  - cancel, operations log
- **LOG-18** Every call is recorded as a `ShipmozoOperation` with an idempotency key, stage, status, AWB, request / response, retries and the last sync. Re-shipping after a cancel retires the old key (FIX-110).
- **LOG-19** Shipmozo return orders need an approved return request.
- **LOG-20** **Tracking sync:**
  - a webhook (`/webhook/track-status`, `SHIPMOZO_WEBHOOK_SECRET`)
  - **GCP Cloud Scheduler** every 5 minutes calls `POST /v1/shipmozo/jobs/tracking-sync` with `SHIPMOZO_SCHEDULER_SECRET`, in batches of `SHIPMOZO_TRACKING_SYNC_BATCH_SIZE`, re-checking each shipment after `SHIPMOZO_TRACKING_RECHECK_MINUTES`
  - manual sync per order / return
  - "Last synced on" is shown in Inventory (FIX-120)
- **LOG-21** In-process node-cron (`SHIPMOZO_TRACKING_SYNC_ENABLED`) is turned off where Cloud Scheduler runs.

## 5. Inventory screens

Channels page (Ekart and Shipmozo cards with Test connection), Order Detail (Create Shipment menu, Cancel shipment, Sync Ekart / Shipmozo Tracking, label print), Return detail (create reverse pickup).

## 6. Gaps and items to confirm

- FIX-165 / 166 (Ekart portal cancel and manual sync) are on DEV-NEW only, not pushed, and SIT tests are pending.
- No courier is chosen automatically (cheapest / fastest). Shipmozo rates are shown, but the admin chooses.

## 7. Source documents

Inventory `rules/EKART.md`, `rules/orderfullfilment*.md`, `SHIPPING_COST_CALCULATION_GUIDE.md`, `SHIPPING_DIMENSIONS_GUIDE.md`, `docs/RELEASE_SCRIPTS_CHECKLIST.md` (scheduler rows), Master.md entries dated 2026-10-06, 2026-10-13, 2026-10-20 and 2026-10-27.
