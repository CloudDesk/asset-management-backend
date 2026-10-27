# 11 · Amazon Marketplace Integration

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** `docs/Amazon/Amazon_Master.md` (updated 2026-10-23), `Amazon_Order_Fulfillment.md`, `Amazon_Changes_2026-10.md`, backend `amazon-*` services and routes, Master.md FIX-2026-10-21-124 … FIX-2026-10-27-167.

> **Master design and runbook:** `docs/Amazon/Amazon_Master.md`. It holds the open items (AMZ-PLAN-xx), the environment table, the deploy runbook and the decision log. This file lists the business requirements only.

## 1. Purpose

Connects the one live Nivaana Amazon seller account (India marketplace) to Nivaana:
- read listings, orders and returns
- map Amazon listings to Nivaana products
- push stock
- fulfil Self Ship and Easy Ship orders from Inventory

## 2. Connection and safety

- **AMZ-01** The integration is on only when `AMAZON_INTEGRATION_ENABLED` is set. Inventory shows the Amazon UI per environment (currently hidden on SIT).
- **AMZ-02** Credentials:
  - the server account from env (LWA client id / secret / refresh token / seller id)
  - or a user's own OAuth connection ("Authorize Seller Account"; restricted, opens in a new tab)
  - tokens are stored encrypted
- **AMZ-03** **Reads never change Amazon.** Every write passes the write guard:
  - writes include stock quantity, price, listing edit, shipment confirmation and Easy Ship
  - the guard needs `AMAZON_PRODUCTION_WRITES_ENABLED=true`, `AMAZON_ENVIRONMENT=PRODUCTION`, and no emergency pause
- **AMZ-04** Connection status is real: Test connection asks Amazon for a token and shows the last import results. A "disconnected / sync failing since …" alert shows on Amazon tabs and the Dashboard (FIX-131 / 142).
- **AMZ-05** Scheduled order sync **backs off** while credentials are rejected (15 → 30 → 60 … up to 360 min). Any success resets it (FIX-136).
- **AMZ-06** Each Amazon action needs its own channel permission (view, mapping, sync, writes).

## 3. Listings and mapping

- **AMZ-07** Listings are imported from Amazon (`Get latest listings`, Cloud Scheduler `listing-sync`). Incomplete (unpriced) listings are counted like Seller Central does (FIX-146). Screens show how fresh the data is ("Updated 14:37 · 33 min ago").
- **AMZ-08** An admin maps each listing to one Nivaana product and pack size. Suggestions:
  - use key words, coverage and same ASIN
  - require a minimum score of 25 and show at most 4
  - search products 25 per page
- **AMZ-09** Mapping changes Nivaana data only, never stock. Mapping history shows user names and PUCs. Bulk map is hidden (FIX-150).
- **AMZ-10** Mappings live per database. `npm run amazon:mappings -- export|import <env>` moves them between environments, with a dry run first.
- **AMZ-11** Listing edits (price / offer) and new-listing publish drafts have preview → apply and are guarded by the env switches (`AMAZON_LISTING_EDIT_ENABLED`, `AMAZON_LISTING_CREATION_ENABLED`).

## 4. Stock sync

- **AMZ-12** Only **mapped, seller-fulfilled** listings sync (FBM / Self Ship, Easy Ship). FBA stock stays managed by Amazon and is read-only.
- **AMZ-13** Target quantity comes from Nivaana stock for the mapped product ÷ pack size. A product can have only **one** automatically synced listing, so stock is never oversold (409 `AMAZON_AUTOMATIC_ALREADY_SET`, FIX-141).
- **AMZ-14** The Stock Sync tab shows Nivaana stock, target, Amazon quantity, difference and mode. A send is previewed, then sent. The dialog re-checks Amazon while an update is pending. History lists real sends with user names.
- **AMZ-15** Automatic stock push stays off (`AMAZON_AUTO_SYNC_ENABLED=false`) until AMZ-PLAN-24 is done.

## 5. Orders and fulfilment

- **AMZ-16** Orders are imported every 15 minutes (Cloud Scheduler `order-sync`) or on demand. Test orders (`TEST-AMZ-…`) are excluded from counts.
- **AMZ-17** Order items are matched to products through the mapping. Unmapped items show "Need mapping"; orders with no items show "Items missing".
- **AMZ-18** Fulfilment by type (client decision, 2026-10-26):
  - **FBA:** sync only.
  - **Easy Ship** (most orders): Amazon picks up. Nivaana marks stock sold when Amazon reports Shipped. The page shows "Pack and book pickup" and then "Packed, pickup booked".
  - **Self Ship:** works like a website order. **Ship now** books Ekart, Shipmozo or a manual shipment, then shipment confirmation is sent to Amazon and delivery status is tracked in Nivaana (FIX-162).
- **AMZ-19** Ship now needs the buyer address: name, mobile, address, pincode, city and state are required and checked (FIX-163). Amazon does not give Nivaana buyer PII, so the team pastes the address in (AMZ-PLAN-26).
- **AMZ-20** Amazon orders appear only in the Amazon order hub. The Nivaana Orders page excludes them.

## 6. Returns

- **AMZ-21** Amazon returns are imported from the Reports API by the Cloud Scheduler `return-sync` job (one short step per run), and recorded as `AmazonReturnEvent` (FIX-143).

## 7. Operations

- **AMZ-22** The Operations area has:
  - Overview: real orders only, and listings counted like Seller Central
  - Activity: real events with names
  - failures, retry queue, write pause / resume, export
- **AMZ-23** Scheduled jobs (`/api/channels/amazon/jobs/order-sync | listing-sync | retry-queue | return-sync`) are called by GCP Cloud Scheduler with `x-scheduler-secret`. In-process node-cron stays off.

## 8. Open items (from Amazon_Master.md)

| ID | Item |
| --- | --- |
| AMZ-PLAN-02 | SIT on the Prod account read-only: decided, not started. |
| AMZ-PLAN-08 | 171 of 172 listings are unmapped; mapping work is needed in Prod. |
| AMZ-PLAN-09 | Real-time notifications (SQS / EventBridge) are not set up. |
| AMZ-PLAN-24 | Automatic stock push go-live checklist. |
| — | UAT / Prod GCP secrets still hold the old LWA secret (FIX-130 fixed local only). |
| — | Cloud Scheduler jobs are not created yet for SIT / UAT / Prod. |
| — | FIX-162 is pushed to DEV-NEW. FIX-163 is local. UAT / Prod need SQL first. |

## 9. Source documents

`docs/Amazon/Amazon_Master.md`, `Amazon_Order_Fulfillment.md`, `Amazon_Changes_2026-10.md`, `AMAZON_INTEGRATION_UX_PRODUCTION_ROADMAP.md`, `AMAZON_LISTING_CREATION_FROM_NIVAANA_BACKEND_PLAN.md`, Inventory `AMAZON_INTEGRATION_INVENTORY_UX_PHASES.md`, `rules/Amazon_Integration.md`.
