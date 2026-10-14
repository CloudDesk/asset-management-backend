import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../models/prisma.js';
import { AmazonOperationsService } from './amazon-operations.service.js';
import { amazonProductionWriteGuardService } from './amazon-production-write-guard.service.js';
import { amazonApiTelemetryService } from './amazon-api-telemetry.service.js';
import { amazonNotificationSubscriptionService } from './amazon-notification-subscription.service.js';

test('overview counts current listings including inactive items but excludes deleted history', async (t) => {
  const stub = (target: any, name: string, implementation: any) => {
    const original = target[name];
    target[name] = implementation;
    t.after(() => { target[name] = original; });
  };
  const service = new AmazonOperationsService();
  const rows = [
    { sellerId: 'SELLER', marketplaceId: 'MARKET', listingStatus: 'BUYABLE', mappingStatus: 'MAPPED' },
    { sellerId: 'SELLER', marketplaceId: 'MARKET', listingStatus: 'SUPPRESSED', mappingStatus: 'UNMAPPED' },
    { sellerId: 'SELLER', marketplaceId: 'MARKET', listingStatus: 'deleted', mappingStatus: 'UNMAPPED' },
    { sellerId: 'OTHER', marketplaceId: 'MARKET', listingStatus: 'BUYABLE', mappingStatus: 'UNMAPPED' },
  ];
  stub(prisma.marketplaceListing, 'count', async ({ where }: any) => rows.filter(row =>
    row.sellerId === where.sellerId && row.marketplaceId === where.marketplaceId
    && !(where.NOT?.listingStatus && row.listingStatus.toUpperCase().includes('DELETED'))
    && (!where.mappingStatus || row.mappingStatus !== where.mappingStatus.not)).length);
  stub(prisma.amazonOperationsSetting, 'findUnique', async () => null);
  stub(prisma.channelSyncLog, 'findFirst', async () => null);
  stub(prisma.amazonOrderImportJob, 'findFirst', async () => null);
  stub(prisma.amazonOrderNotification, 'findFirst', async () => null);
  for (const model of [prisma.amazonMarketplaceOrder, prisma.amazonOrderFulfillmentException,
    prisma.amazonRetryJob, prisma.amazonConnection]) stub(model, 'count', async () => 0);
  stub(prisma.amazonRetryJob, 'findMany', async () => []);
  stub(service, 'activity', async () => []);
  stub(service, 'failures', async () => []);
  stub(amazonProductionWriteGuardService, 'status', async () => ({ effectiveEnabled: false }));
  stub(amazonApiTelemetryService, 'health', async () => ({}));
  stub(amazonNotificationSubscriptionService, 'status', async () => []);
  const result = await service.dashboard({ sellerId: 'SELLER', marketplaceId: 'MARKET', source: 'ENVIRONMENT_FALLBACK', client: {} as any });
  assert.equal(result.counts.listings, 2);
  assert.equal(result.counts.unmappedListings, 1);
});
