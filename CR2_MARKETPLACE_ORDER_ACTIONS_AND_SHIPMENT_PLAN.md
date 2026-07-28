# CR 2 - Marketplace Order Display and Nivaana Shipment Handling

## Objective

Inventory should show Nivaana, Amazon, and Flipkart orders under the Orders module.

Important scope clarification:

```text
Amazon and Flipkart orders are display-only in Inventory for this CR.
They are not stored in our orders table.
They are shown from marketplace/API response data.
No local shipment/status lifecycle should be built for them in this CR.
```

Only Nivaana orders continue to use the existing local order/shipment/status flow.

This CR mainly impacts:

- `Inventory` order list tabs
- `Inventory` order detail page actions
- Amazon order display API/service response
- Flipkart order display API/service response
- Nivaana shipment flow

## Business Requirement

Orders in Inventory will be grouped into tabs:

- Nivaana
- Amazon
- Flipkart

Each tab has different behavior.

### Amazon and Flipkart Orders

For this CR, Amazon and Flipkart orders are simple display-only records in Inventory.

Rules:

- show Amazon/Flipkart order list.
- show Amazon/Flipkart order detail page.
- do not store these orders in our local `orders` table.
- do not create local `orderline` rows.
- do not create local shipment.
- do not allow local status override.
- hide all shipment-related buttons.
- hide ready-for-dispatch, manual shipment, mark shipped, update shipment status, download label, and invoice generation actions.
- show marketplace status as read-only.
- show marketplace fulfillment information if available from the marketplace API.

This CR is not responsible for Amazon/Flipkart fulfillment operations.

### Nivaana Orders

Nivaana orders continue to be fulfilled by Nivaana. The order detail page should expose one shipment action instead of separate carrier-specific primary buttons.

The single shipment action should allow admin to choose:

- Ekart shipment
- Shipmozo shipment

Ekart flow already exists. Shipmozo is currently in development and should be integrated once ready.

## Order Classification

For this CR, classification is mainly a frontend/display concern.

Nivaana orders come from local `/v1/orders`.

Amazon and Flipkart orders come from marketplace/API service responses and are normalized only for display.

Recommended normalized frontend fields:

```text
source:
  nivaana
  amazon
  flipkart

isDisplayOnly:
  true for amazon/flipkart
  false for nivaana
```

Do not add these fields to the local `orders` table for Amazon/Flipkart in this CR, because those orders are not stored locally.

Minimum frontend fields:

```ts
source: "nivaana" | "amazon" | "flipkart";
isDisplayOnly: boolean;
marketplaceOrderId?: string;
marketplaceStatus?: string;
marketplaceFulfillmentType?: string | null;
```

## Source Rules

### Nivaana

Nivaana orders are controlled by Inventory.

Allowed:

- mark ready for dispatch.
- create shipment.
- choose shipment carrier.
- download label when carrier supports label generation.
- mark shipped.
- update shipment status.
- generate invoice.
- cancellation/refund actions, based on current existing status rules.

Shipment action:

- show one button: `Create Shipment`.
- button opens a carrier selection flow.
- admin selects `Ekart` or `Shipmozo`.
- selected carrier opens the matching form/API flow.

### Amazon Orders

Amazon orders are display-only.

Allowed:

- view Amazon order list.
- view Amazon order detail.
- show Amazon status.
- show Amazon fulfillment type, such as FBA/FBM, if API provides it.

Not allowed in this CR:

- local status override.
- local shipment creation.
- local manual shipment.
- local invoice generation.
- local order persistence.

### Flipkart Orders

Flipkart orders are display-only.

Allowed:

- view Flipkart order list.
- view Flipkart order detail.
- show Flipkart status.
- show Flipkart fulfillment data, if API provides it.

Not allowed in this CR:

- local status override.
- local shipment creation.
- local manual shipment.
- local invoice generation.
- local order persistence.

## Inventory UI Flow

### Orders List Page

Current page:

- `Inventory/src/pages/orders/OrdersPage.tsx`

Planned behavior:

- Add source tabs:
  - Nivaana
  - Amazon
  - Flipkart
- Nivaana tab calls existing local order API.
- Amazon tab calls Amazon order API/service.
- Flipkart tab calls Flipkart order API/service.
- Preserve current pagination and filters inside each tab.
- Show marketplace/source badge in rows.

Recommended query:

```http
GET /v1/orders?ordersource=nivaana
GET /v1/amazon/orders
GET /v1/flipkart/orders
```

Amazon/Flipkart responses should be normalized only in frontend/service layer for display. They should not be inserted into local `orders`.

### Order Detail Page

Current page:

- `Inventory/src/pages/orders/OrderDetailPage.tsx`

Current action sources:

- generic actions from `Inventory/src/config/orderActions.config.ts`
- manual shipment kebab actions in `OrderDetailPage.tsx`
- Ekart modal
- manual shipment modal
- manual status update modal
- invoice action

Planned behavior:

1. If source is Nivaana, show existing local order actions.
2. If source is Amazon or Flipkart, render a read-only marketplace detail page.
3. Hide all shipment and status action buttons for Amazon/Flipkart.

Example capability helper:

```ts
function getOrderCapabilities(order: Order) {
  const source = order.source ?? "nivaana";
  const isNivaana = source === "nivaana";
  const isMarketplace = source === "amazon" || source === "flipkart";

  return {
    isReadOnly: isMarketplace,
    canCreateShipment: isNivaana,
    canShowShipmentButtons: isNivaana,
    canOverrideStatus: isNivaana,
  };
}
```

Important:

- For Amazon and Flipkart orders, all shipment buttons must be hidden.
- For Amazon and Flipkart orders, status override must be hidden.
- For Amazon and Flipkart orders, the page is display-only.

## Nivaana Single Shipment Button

Current UI has an Ekart-specific action:

- `create_ekart_shipment`

New UI should expose one button:

```text
Create Shipment
```

Button behavior:

1. Admin clicks `Create Shipment`.
2. Modal opens with carrier choice:
   - Ekart
   - Shipmozo
3. If Ekart selected:
   - open existing `EkartShipmentForm`.
   - call existing `API_CONFIG.ENDPOINTS.EKART.createForwardShipment`.
4. If Shipmozo selected:
   - open Shipmozo form once service is ready.
   - call Shipmozo API endpoint.
5. After success:
   - refresh order detail.
   - show tracking/vendor/label/invoice status.

Recommended action id:

```text
create_shipment
```

Carrier values:

```text
ekart
shipmozo
```

Shipmozo handling while in development:

- show option disabled with clear label only if the business wants visibility.
- or hide Shipmozo until backend endpoint is ready.

Recommended default:

- implement carrier selection structure now.
- enable Ekart.
- keep Shipmozo disabled until API contract is confirmed.

## Backend Scope

For Amazon and Flipkart, this CR should only expose read APIs/service methods needed to show marketplace orders in Inventory.

Do not add marketplace orders into the existing local Nivaana order lifecycle.

Not in scope for Amazon/Flipkart:

- creating rows in local `orders`.
- creating rows in local `orderline`.
- creating local shipments.
- updating local order status.
- overriding marketplace status.
- generating local invoices.

The existing Nivaana order endpoints continue to behave as they do today.

Important implementation rule:

```text
Marketplace display records must not be sent to local Nivaana shipment/status APIs.
```

## Marketplace Action Visibility

For Amazon and Flipkart order detail pages, hide these actions:

- Ready for Dispatch
- Create Shipment
- Create EKART Shipment
- Manual Ship
- Mark as Shipped
- Update Shipment Status
- Download Label
- Generate Invoice
- Manual Status Override

Allowed display-only information:

- marketplace order id.
- marketplace status.
- marketplace fulfillment type, if provided.
- marketplace tracking/invoice link, if provided by Amazon/Flipkart.

If marketplace tracking or invoice data is shown, it must be read-only.

## Invoice Handling

Nivaana orders:

- keep existing invoice generation behavior.
- invoice may be generated after shipment creation or manually.

Amazon/Flipkart orders:

- do not generate a Nivaana invoice in this CR.
- if marketplace invoice URL/data exists, show it as read-only.
- no local invoice storage is required for this CR.

## Data Mapping Requirements

Amazon display response should identify:

- order source = `amazon`
- marketplace order status
- marketplace order id
- marketplace fulfillment type, if available
- marketplace tracking data if available
- marketplace invoice link/data if available

Flipkart display response should identify:

- order source = `flipkart`
- marketplace order status
- marketplace order id
- marketplace fulfillment data, if available
- marketplace tracking data if available
- marketplace invoice link/data if available

## Files Likely Impacted

Inventory:

- `src/pages/orders/OrdersPage.tsx`
- `src/pages/orders/OrderDetailPage.tsx`
- `src/config/orderActions.config.ts`
- `src/config/api.config.ts`
- `src/types/order.ts`
- `src/services/amazonService.ts`
- Flipkart service file, if available/created
- future Shipmozo service file

Server:

- Amazon order display route/controller/service, if not already available
- Flipkart order display route/controller/service, if not already available
- future Shipmozo route/controller/service

## Risks

### Scope Creep Risk

Marketplace orders can look similar to Nivaana orders in the UI, but this CR is only for display.

Mitigation:

- keep Amazon/Flipkart services separate from local Nivaana order mutation APIs.
- do not write Amazon/Flipkart records into local `orders` or `orderline`.
- hide all local lifecycle actions for marketplace orders.

### Missing Fulfillment Type Risk

If Amazon/Flipkart payloads have different field names, the UI can become inconsistent.

Mitigation:

- normalize only the fields needed for display.
- keep marketplace raw/reference fields available for troubleshooting where useful.

### Shipmozo Incomplete Contract Risk

The single shipment button should not block Ekart while Shipmozo is still in development.

Mitigation:

- implement carrier selector with Ekart enabled.
- keep Shipmozo disabled or hidden until endpoint is ready.

## Test Cases

### Nivaana Orders

- Nivaana ready-for-dispatch order shows one `Create Shipment` button.
- Clicking `Create Shipment` allows Ekart selection.
- Ekart selection opens existing Ekart shipment form.
- Shipmozo option is hidden or disabled while API is unavailable.
- Existing Ekart shipment creation still works.
- Existing manual shipment/status behavior still works where intended.

### Amazon FBA

- Order detail shows Amazon source and FBA badge if available.
- No shipment creation buttons are visible.
- No manual shipment actions are visible.
- No status override action is visible.
- No local order/shipment/status API is called for this order.

### Amazon FBM

- Order detail shows Amazon source and FBM badge if available.
- No shipment creation buttons are visible.
- No manual shipment actions are visible.
- No status override action is visible.
- No local order/shipment/status API is called for this order.

### Flipkart Marketplace-Fulfilled

- Order detail shows Flipkart source and marketplace fulfillment data if available.
- Shipment buttons are hidden.
- Status override is hidden.
- No local order/shipment/status API is called for this order.

### Flipkart Seller-Fulfilled

- Order detail shows Flipkart source and seller fulfillment data if available.
- Shipment buttons are hidden.
- Status override is hidden.
- No local order/shipment/status API is called for this order.

## Open Decisions

1. Exact Amazon order display API contract.
2. Exact Flipkart order display API contract.
3. Whether marketplace invoice/tracking links should be shown when the API provides them.
4. Whether Shipmozo should be visible as disabled before backend completion.

## Recommended Implementation Sequence

1. Confirm Amazon/Flipkart display API contracts.
2. Add marketplace tabs in Inventory order list.
3. Add frontend `Order` type fields.
4. Add shared frontend capability helper for read-only marketplace display.
5. Connect Amazon tab to Amazon display service.
6. Connect Flipkart tab to Flipkart display service.
7. Update order detail action visibility.
8. Replace Ekart-specific primary action with single `Create Shipment` action for Nivaana orders.
9. Add carrier selection modal with Ekart enabled and Shipmozo prepared.
10. Add tests for Nivaana shipment flow and Amazon/Flipkart read-only display.
