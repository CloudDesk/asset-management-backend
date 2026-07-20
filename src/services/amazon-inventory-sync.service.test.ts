import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AmazonInventorySyncContext,
  AmazonInventorySyncService,
  AmazonSandboxInventoryClient,
} from './amazon-inventory-sync.service.js';
import { SandboxInventoryResult } from './amazon-sandbox-inventory.service.js';

const context = (targetQuantity: number): AmazonInventorySyncContext => ({
  platformStockId: '1',
  productId: '98',
  platform: 'amazon',
  sellerSku: 'OTH-0098',
  productName: 'OTHER - Incense sticks - First Rains',
  targetQuantity,
});

class FakeAmazonClient implements AmazonSandboxInventoryClient {
  quantity: number | null;
  calls: string[] = [];

  constructor(quantity: number | null) {
    this.quantity = quantity;
  }

  async getInventorySummaries(_nextToken?: string, sellerSku?: string): Promise<SandboxInventoryResult> {
    this.calls.push('get');
    return {
      environment: 'SANDBOX',
      marketplaceId: 'A21TJRUUN4KGV',
      nextToken: null,
      items: this.quantity === null ? [] : [{
        asin: 'sandbox-asin',
        fnSku: 'sandbox-fnsku',
        sellerSku: sellerSku ?? 'OTH-0098',
        productName: 'Test product',
        condition: 'NEW',
        fulfillableQuantity: this.quantity,
        reservedQuantity: 0,
        pendingCustomerOrderQuantity: 0,
        totalQuantity: this.quantity,
      }],
    };
  }

  async createInventoryItem(): Promise<void> {
    this.calls.push('create');
    this.quantity = 0;
  }

  async addInventory(_sellerSku: string, quantity: number): Promise<void> {
    this.calls.push(`add:${quantity}`);
    this.quantity = (this.quantity ?? 0) + quantity;
  }

  async depleteInventory(_sellerSku: string, quantity: number): Promise<void> {
    this.calls.push(`deplete:${quantity}`);
    this.quantity = Math.max(0, (this.quantity ?? 0) - quantity);
  }
}

const serviceFor = (client: AmazonSandboxInventoryClient, targetQuantity: number) =>
  new AmazonInventorySyncService({
    client,
    enabled: true,
    environment: 'SANDBOX',
    loadContext: async () => context(targetQuantity),
  });

test('creates a missing sandbox item and publishes its target quantity', async () => {
  const client = new FakeAmazonClient(null);
  const result = await serviceFor(client, 7).syncPlatformStockById('1');

  assert.equal(result.action, 'CREATED');
  assert.equal(client.quantity, 7);
  assert.deepEqual(client.calls, ['get', 'create', 'add:7']);
});

test('adds only the difference when Nivaana quantity increases', async () => {
  const client = new FakeAmazonClient(3);
  const result = await serviceFor(client, 8).syncPlatformStockById('1');

  assert.equal(result.action, 'INCREASED');
  assert.equal(client.quantity, 8);
  assert.deepEqual(client.calls, ['get', 'add:5']);
});

test('uses sandbox fulfillment to consume only the difference on decrease', async () => {
  const client = new FakeAmazonClient(8);
  const result = await serviceFor(client, 2).syncPlatformStockById('1');

  assert.equal(result.action, 'DECREASED');
  assert.equal(client.quantity, 2);
  assert.deepEqual(client.calls, ['get', 'deplete:6']);
});

test('does not mutate Amazon when the quantities already match', async () => {
  const client = new FakeAmazonClient(4);
  const result = await serviceFor(client, 4).syncPlatformStockById('1');

  assert.equal(result.action, 'UNCHANGED');
  assert.deepEqual(client.calls, ['get']);
});

test('skips all external calls when automatic sync is disabled', async () => {
  const client = new FakeAmazonClient(1);
  const service = new AmazonInventorySyncService({
    client,
    enabled: false,
    environment: 'SANDBOX',
    loadContext: async () => context(5),
  });

  const result = await service.syncPlatformStockById('1');
  assert.equal(result.status, 'SKIPPED');
  assert.deepEqual(client.calls, []);
});

test('does not use sandbox mutations when configured for production', async () => {
  const client = new FakeAmazonClient(1);
  const service = new AmazonInventorySyncService({
    client,
    enabled: true,
    environment: 'PRODUCTION',
    loadContext: async () => context(5),
  });

  const result = await service.syncPlatformStockById('1');
  assert.equal(result.status, 'SKIPPED');
  assert.deepEqual(client.calls, []);
});
