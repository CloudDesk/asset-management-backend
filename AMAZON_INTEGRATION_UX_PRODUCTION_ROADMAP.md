# Amazon Integration UX And Production Roadmap

## Purpose

This document defines how the Amazon integration should evolve without becoming clumsy for users. The goal is to build a clear Amazon control center where every action is understandable, safe, auditable, and reversible where possible.

The current branch already supports production listing import in read-only mode, manual listing mapping, audit records, and sandbox inventory tooling. The next work should improve the user experience and then add production capabilities in controlled phases.

## Core UX Principles

1. Keep production and sandbox clearly separated.
2. Do not show buttons for actions that are not implemented.
3. Every production write must have preview, confirmation, result status, and audit history.
4. Start with manual actions before automatic actions.
5. Treat FBA inventory as read-only unless Amazon provides an explicit supported flow for the use case.
6. Make failed syncs visible and recoverable.
7. Never assume Amazon SKU and Nivaana PUC are the same; mappings must be explicit.
8. Use plain operational language in the UI, not API terms.

## Proposed Amazon Module Layout

The inventory UI should have one Amazon module with these tabs:

| Tab | Purpose |
| --- | --- |
| Overview | Connection status, marketplace, last import, sync health, and urgent issues. |
| Listings | Imported Amazon listings, listing status, price, quantity, fulfillment type, and search/filter tools. |
| Mappings | Map Amazon SKUs to Nivaana products, review unmapped SKUs, and handle remaps. |
| Stock Sync | Preview, manually sync, enable auto sync, pause sync, and view stock mismatch warnings. |
| Orders | Import and manage Amazon orders after mappings are stable. |
| Fulfillment | Route FBA, Easy Ship, and MFN orders into the correct handling flow. |
| Activity Log | Audit trail for imports, mapping changes, stock syncs, order syncs, and failures. |
| Settings | Connection settings, sync preferences, feature flags, and production safety controls. |

## Amazon Order Type Handling

Amazon orders must not all flow through the same fulfillment path. The integration should classify every imported order before allowing shipping actions.

| Amazon Order Type | Nivaana Handling | Rule |
| --- | --- | --- |
| FBA | Read-only and reconcile only | Amazon fulfills the order. Nivaana should not create custom shipping for it. |
| Easy Ship | Use Amazon Easy Ship workflow | Nivaana can help manage the order, but scheduling, labels, invoices, and handover follow Amazon Easy Ship APIs. |
| MFN / Self Ship / Seller Fulfilled | Use Nivaana shipping workflow | Nivaana can pick, pack, ship through custom shipping, then confirm shipment back to Amazon. |

This distinction is required for a clean user experience. The UI should show the fulfillment type clearly and only show valid actions for that order.

## Updated Phases

### Phase 1: Clean Current Amazon MVP

Goal: Make the existing Amazon work clear, safe, and usable for internal users.

Actions:

| Action Title | Description |
| --- | --- |
| Separate Production And Sandbox | Show production listing tools and sandbox inventory tools in separate areas or tabs. |
| Hide Unimplemented Actions | Remove or disable OAuth, product, order, and inventory buttons until backend support exists. |
| Show Honest Connection State | Display whether the connection is local-only, env-based, sandbox, or real OAuth-backed. |
| Improve Import Result | Show fetched, created, updated, unmapped, inactive, conflicted, and failed counts. |
| Improve Listing Table | Make SKU, ASIN, title, fulfillment type, quantity, price, and mapping status easy to scan. |
| Keep Production Read-Only | Continue allowing import, view, map, and unmap only. No production writes in this phase. |
| Add Friendly States | Add clear loading, empty, permission denied, and error states. |

Outcome:

Users can safely import, view, and map Amazon production listings without confusion.

### Phase 2: Amazon Connection Center

Goal: Replace temporary/manual connection handling with an industry-standard connection flow.

Actions:

| Action Title | Description |
| --- | --- |
| Connect Amazon Account | Seller authorizes Nivaana through Amazon OAuth. |
| Store Connection Securely | Backend stores encrypted refresh tokens by seller, marketplace, and account. |
| Check Connection Status | Backend confirms seller ID, marketplace, token health, and last successful sync. |
| Reconnect Amazon | User can repair expired or revoked authorization. |
| Disconnect Amazon | User can remove the connection and stop sync activity. |
| Show Token Health | UI shows whether Amazon authorization is healthy, expired, or needs attention. |

Backend requirements:

- OAuth initiate and callback routes.
- Encrypted refresh-token storage.
- Server-side access-token generation.
- Per-seller and per-marketplace scoping.
- Reconnect and revoke handling.
- No refresh tokens exposed to the browser.

Outcome:

Normal users no longer handle refresh tokens manually. The UI has a real, trustworthy connection state.

### Phase 3: Listing And Mapping Workspace

Goal: Make listing mapping fast, accurate, and user-friendly before enabling stock/order automation.

Actions:

| Action Title | Description |
| --- | --- |
| Import Listings | Pull Amazon production listings into Nivaana without changing Amazon. |
| View Listing Details | Show Amazon SKU, ASIN, title, status, price, quantity, fulfillment type, and issues. |
| Suggest Product Matches | Suggest likely Nivaana products using SKU, PUC, title, and historical mapping signals. |
| Map Listing | User manually links an Amazon listing to a Nivaana product. |
| Bulk Map Listings | User maps multiple listings in one guided workflow. |
| Edit Mapping | User updates product mapping or units per listing. |
| Confirm Remap | User must explicitly confirm replacement of an existing mapping. |
| Unmap Listing | User removes the product link without changing Amazon or Nivaana inventory. |
| Review Unmapped Queue | User sees all unmapped listings that need action. |
| View Mapping Audit | User sees who mapped/remapped/unmapped each listing and when. |

Outcome:

Users can confidently prepare Amazon SKU mappings before stock or order automation begins.

### Phase 4: Safe Production Stock Sync

Goal: Enable production stock updates safely, starting with manual MFN sync only.

Important rule:

FBA stock should remain read-only. Only MFN or seller-fulfilled listings should be eligible for Nivaana-driven stock publishing.

Actions:

| Action Title | Description |
| --- | --- |
| Preview Stock Sync | Shows the exact Amazon quantity change before publishing. |
| Sync Stock Now | Manually pushes stock for one mapped MFN listing. |
| Enable Auto Sync | Allows future stock changes to sync automatically for selected listings. |
| Pause Sync | Stops automatic stock sync for selected listings. |
| Retry Failed Sync | Re-runs failed stock sync attempts. |
| View Sync History | Shows every stock update attempt, result, error, and actor. |
| Detect Stock Mismatch | Highlights when Nivaana quantity and Amazon quantity differ. |

Production safeguards:

- Global kill switch: `AMAZON_PRODUCTION_WRITES_ENABLED`.
- Per-listing sync mode: `disabled`, `manual`, `automatic`.
- Dry run before first production write.
- Idempotency keys for write operations.
- Retry queue with exponential backoff.
- Rate-limit handling.
- Audit log for every attempted write.
- Permission checks for stock publishing.

Recommended release order:

1. Manual sync for one SKU.
2. Manual bulk sync.
3. Automatic sync for selected listings.
4. Automatic sync by default only after operational confidence.

Outcome:

Stock sync becomes controlled, visible, and safe instead of surprising users.

### Phase 5: Amazon Order Hub

Goal: Import and manage Amazon orders after listing mappings are reliable, then prepare them for the correct fulfillment path.

Actions:

| Action Title | Description |
| --- | --- |
| Import Orders | Pull Amazon orders into Nivaana. |
| View Amazon Orders | Show order status, items, fulfillment type, purchase date, and sync state. |
| Match Order Items | Resolve each Amazon order item through mapped Amazon listings. |
| Flag Unmapped Orders | Show orders that cannot be processed because a SKU is unmapped. |
| Classify Fulfillment Type | Identify whether the order is FBA, Easy Ship, or MFN/Self Ship. |
| Route Order | Send the order to read-only reconciliation, Easy Ship handling, or Nivaana shipping. |
| Reserve Stock | Reserve or deduct stock for MFN/Self Ship orders based on mapped products. |
| Sync Order Status | Keep unshipped, shipped, canceled, and buyer-requested changes updated. |
| Handle Cancellations | Reflect Amazon cancellations and prevent incorrect fulfillment. |

Implementation guidance:

- Use Amazon order notifications for near-real-time updates.
- Keep polling or scheduled imports as a backup mechanism.
- Treat buyer PII carefully and use restricted data access where required.
- Use Amazon order ID uniqueness to prevent duplicate imports.
- Do not expose shipping actions until the order has a valid fulfillment route.

Outcome:

Users can see and prepare Amazon orders in Nivaana without breaking inventory accuracy or choosing the wrong shipping flow.

### Phase 6: Fulfillment Routing And Nivaana Shipping

Goal: Let users fulfill eligible Amazon orders through the right flow, including custom Nivaana shipping for MFN/Self Ship orders.

Fulfillment routing:

| Route | Description |
| --- | --- |
| FBA Reconciliation | Show order and inventory impact as read-only. Amazon owns fulfillment. |
| Easy Ship Handling | Use Amazon Easy Ship APIs for scheduling, labels, invoices, and handover actions. |
| Nivaana Shipping | Use Nivaana's custom pick, pack, courier, tracking, and shipment confirmation flow for MFN/Self Ship orders. |

Actions:

| Action Title | Description |
| --- | --- |
| Create Pick Task | Create a warehouse picking task for mapped MFN/Self Ship order items. |
| Allocate Stock | Reserve or deduct Nivaana inventory for the order based on mapped listing units. |
| Pack Order | Confirm packed items, package details, weight, and dimensions. |
| Select Shipping Method | Choose custom Nivaana shipping, courier, or configured logistics partner. |
| Generate Shipping Documents | Generate invoice, packing slip, and shipping label where applicable. |
| Add Tracking Details | Capture courier name, tracking ID, shipping date, and package details. |
| Mark Shipped In Nivaana | Move the order to shipped state internally. |
| Confirm Shipment To Amazon | Send shipment confirmation and tracking details back to Amazon for MFN/Self Ship orders. |
| Handle Easy Ship Handover | For Easy Ship orders, schedule/reschedule/cancel handover and retrieve Amazon documents. |
| Handle Shipping Failure | Put failed shipments into an exception queue with retry or manual resolution. |

UX requirements:

- Show only actions valid for the fulfillment type.
- Clearly label FBA as read-only.
- Clearly label Easy Ship as Amazon-managed shipping.
- Clearly label MFN/Self Ship as eligible for Nivaana shipping.
- Prevent shipment confirmation if tracking details are incomplete.
- Show SLA warnings for orders approaching ship-by deadlines.
- Keep a complete audit trail of pick, pack, ship, and Amazon confirmation actions.

Outcome:

Users can handle Amazon orders with custom Nivaana shipping where allowed, without accidentally trying to ship FBA or Easy Ship orders through the wrong path.

### Phase 7: Product And Offer Updates

Goal: Allow Amazon listing updates only after mappings, stock sync, and orders are stable.

Recommended starting scope:

Start with offer updates first: price, quantity, handling time, and availability.

Actions:

| Action Title | Description |
| --- | --- |
| Validate Listing Update | Preview Amazon validation errors before saving. |
| Update Price | Push price changes to Amazon for selected listings. |
| Update Availability | Push availability or quantity-related offer fields where supported. |
| Update Handling Time | Push fulfillment handling time where applicable. |
| Update Product Content | Update title, bullets, description, images, or attributes only with schema validation. |
| Review Amazon Issues | Show listing validation issues and required fixes. |
| Disable Listing | Disable or delete a listing only with explicit permission and confirmation. |

Important note:

Amazon product content is schema-driven and strict. Product/content updates should use Amazon Product Type Definitions and validation previews before submitting changes.

Outcome:

Users can safely update Amazon offers and, later, product content with validation before production changes.

### Phase 8: Operations And Automation

Goal: Make the integration reliable for daily operations.

Actions:

| Action Title | Description |
| --- | --- |
| Activity Log | Central timeline of imports, mappings, syncs, orders, writes, and errors. |
| Failed Sync Inbox | Dedicated queue for Amazon issues needing human action. |
| Scheduled Imports | Automatically import listings/orders on a controlled schedule. |
| Notification Setup | Subscribe to relevant Amazon events such as order changes and listing issues. |
| Retry Queue | Automatically retry eligible failures with backoff. |
| Admin Permissions | Separate permissions for import, map, stock sync, order sync, shipment confirmation, and product updates. |
| Production Kill Switch | Stop all production writes immediately if needed. |
| Health Dashboard | Show last successful sync, failures, rate-limit status, and connection health. |
| Export Reports | Export listing, mapping, stock sync, and order sync data. |

Outcome:

The integration becomes a dependable operations tool, not just an API connector.

## Simple Roadmap Order

1. Clean current MVP.
2. Build real Amazon connection center.
3. Polish listing import and mapping workspace.
4. Add manual MFN stock sync.
5. Add automatic MFN stock sync.
6. Add Amazon order import and order status sync.
7. Add fulfillment routing by order type.
8. Add custom Nivaana shipping for MFN/Self Ship orders.
9. Add Easy Ship handling for Easy Ship orders.
10. Add shipment confirmation back to Amazon.
11. Add offer updates.
12. Add product content updates.
13. Add operations automation and alerts.

## Production Safety Checklist

Before enabling any production write, confirm:

- The seller connection is stored securely.
- The target listing is mapped to a Nivaana product.
- The listing is MFN or otherwise eligible for Nivaana-driven stock updates.
- The order fulfillment type is known before any shipping action is shown.
- FBA orders are protected from custom Nivaana shipping actions.
- Easy Ship orders use Easy Ship-specific actions, labels, and handover flows.
- The user has permission for the action.
- The UI shows a preview of the exact change.
- The backend writes an audit record.
- There is a retry and failure recovery path.
- There is a global kill switch.
- The change can be traced back to user, listing, product, and timestamp.

## Recommended Near-Term Backend Work

1. Add real Amazon OAuth initiate and callback routes.
2. Encrypt and persist seller refresh tokens.
3. Add `GET /v1/amazon/connection`.
4. Add sync log APIs for listing import and mapping audit.
5. Add production write abstraction with writes disabled by default.
6. Add manual MFN stock sync dry-run endpoint.
7. Add manual MFN stock sync execute endpoint.
8. Add Amazon order import tables and APIs.
9. Add fulfillment routing service for FBA, Easy Ship, and MFN/Self Ship.
10. Add Nivaana shipping workflow APIs for MFN/Self Ship Amazon orders.
11. Add Amazon shipment confirmation adapter.
12. Add Easy Ship adapter for scheduling, labels, invoices, and handover.

## Recommended Near-Term Inventory Work

1. Convert Amazon accordion into a tabbed Amazon workspace.
2. Split sandbox tools away from production tools.
3. Remove unimplemented buttons or mark them as coming later outside the primary workflow.
4. Add import history and last import summary.
5. Add unmapped listings queue.
6. Add mapping confidence suggestions.
7. Add read-only production status labels until writes are enabled.
8. Add order hub with fulfillment-type badges.
9. Add fulfillment routing view.
10. Add Nivaana shipping actions only for MFN/Self Ship orders.
11. Add Easy Ship actions only for Easy Ship orders.
12. Add FBA read-only/reconciliation state.
13. Add shipment exception inbox.

## Official Amazon SP-API References

- SP-API connection and access tokens: https://developer-docs.amazon/sp-api/docs/connecting-to-the-selling-partner-api
- Listings management guide: https://developer-docs.amazon.com/sp-api/docs/manage-product-listings-guide
- Listings validation preview: https://developer-docs.amazon.com/sp-api/docs/preview-errors-before-partially-updating-a-listing
- Orders API: https://developer-docs.amazon/sp-api/docs/orders-api
- Shipment confirmation: https://developer-docs.amazon.com/sp-api/reference/confirmshipment
- Easy Ship API: https://developer-docs.amazon.com/sp-api/docs/easy-ship-api
- Notifications API: https://developer-docs.amazon.com/sp-api/docs/notifications-api
