import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAmazonFbaInventoryNotification } from './amazon-fba-inventory-notification.service.js';
import { AMAZON_NOTIFICATION_DEFINITIONS } from './amazon-notification-subscription.service.js';

test('parses an Amazon FBA inventory availability notification', () => {
  const snapshots = parseAmazonFbaInventoryNotification({
    SellerId: 'SELLER-1',
    FNSKU: 'X001TEST',
    ASIN: 'B0TESTASIN',
    SKU: 'SKU-1',
    FulfillmentInventoryByMarketplace: [{
      MarketplaceId: 'A21TJRUUN4KGV',
      ItemName: 'Test product',
      FulfillmentInventory: {
        InboundQuantityBreakdown: { Working: 2, Shipped: 3, Receiving: 4 },
        Fulfillable: 10,
        Unfulfillable: 1,
        Researching: 2,
        ReservedQuantityBreakdown: {
          WarehouseProcessing: 3,
          WarehouseTransfer: 4,
          PendingCustomerOrder: 5,
        },
        FutureSupplyBuyable: 6,
        PendingCustomerOrderInTransit: 1,
      },
    }],
  });

  assert.equal(snapshots.length, 1);
  assert.deepEqual(snapshots[0], {
    sellerSku: 'SKU-1',
    fnSku: 'X001TEST',
    asin: 'B0TESTASIN',
    marketplaceId: 'A21TJRUUN4KGV',
    itemName: 'Test product',
    fulfillable: 10,
    inboundWorking: 2,
    inboundShipped: 3,
    inboundReceiving: 4,
    unfulfillable: 1,
    researching: 2,
    reservedWarehouseProcessing: 3,
    reservedWarehouseTransfer: 4,
    pendingCustomerOrder: 5,
    futureSupplyBuyable: 6,
    pendingCustomerOrderInTransit: 1,
    reserved: 12,
    inbound: 9,
    total: 25,
  });
});

test('supports normalized camel-case relay payloads', () => {
  const snapshots = parseAmazonFbaInventoryNotification({
    sellerSku: 'SKU-2',
    fulfillmentInventoryByMarketplace: [{
      marketplaceId: 'A21TJRUUN4KGV',
      fulfillmentInventory: {
        fulfillable: 7,
        reservedQuantityBreakdown: { pendingCustomerOrder: 2 },
      },
    }],
  });

  assert.equal(snapshots[0]?.fulfillable, 7);
  assert.equal(snapshots[0]?.pendingCustomerOrder, 2);
});

test('configures FBA inventory changes through the SQS notification destination', () => {
  const definition = AMAZON_NOTIFICATION_DEFINITIONS.find(
    (item) => item.notificationType === 'FBA_INVENTORY_AVAILABILITY_CHANGES'
  );
  assert.equal(definition?.payloadVersion, '1.0');
  assert.equal(definition?.destinationKind, 'SQS');
});

