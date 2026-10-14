import assert from 'node:assert/strict';
import test from 'node:test';
import { AmazonConnectionService, AmazonConnectionError } from './amazon-connection.service.js';
import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';

function service(fetchImpl: typeof fetch) {
  return new AmazonConnectionService({ fetchImpl, clientId: 'client-id', clientSecret: 'private-client-secret',
    redirectUri: 'https://inventory.example.com/amazon/callback', sellerCentralUrl: 'https://sellercentral.amazon.in',
    appId: 'test-app', stateSecret: 'test-state-secret',
    tokenCrypto: { decrypt: () => 'private-refresh-token' } as any });
}

test('OAuth rejection preserves the reason and redacts credential material', async () => {
  const instance = service(async () => new Response(JSON.stringify({ error: 'invalid_grant',
    error_description: 'Rejected oauth-code-value with private-client-secret',
  }), { status: 400 }));
  const { state } = instance.initiateOAuth(17, 'inventoryusers');
  await assert.rejects(() => instance.completeOAuth({ userId: 17, userType: 'inventoryusers',
    code: 'oauth-code-value', sellingPartnerId: 'SELLER', state,
  }), (error: unknown) => error instanceof AmazonConnectionError
    && error.message.includes('invalid_grant') && !error.message.includes('private-client-secret')
    && !error.message.includes('oauth-code-value'));
});

test('health checks log the affected account and distinguish an upstream outage', async () => {
  const originalConnection = prisma.amazonConnection.findFirst;
  const originalSync = prisma.channelSyncLog.findFirst;
  const originalWarn = logger.warn;
  const records: any[] = [];
  try {
    prisma.amazonConnection.findFirst = (async () => ({ sellerId: 'SELLER', marketplaceId: 'MARKET',
      refreshToken: 'encrypted', createdAt: null, updatedAt: null })) as any;
    prisma.channelSyncLog.findFirst = (async () => null) as any;
    logger.warn = ((record: any) => records.push(record)) as any;
    const instance = service(async () => new Response(JSON.stringify({ error: 'temporarily_unavailable' }), { status: 503 }));
    const status = await instance.getConnectionStatus(17, 'inventoryusers');
    assert.equal(status?.tokenHealth, 'NEEDS_ATTENTION');
    assert.equal((status as any).healthIssue.code, 'AMAZON_AUTH_TEMPORARILY_UNAVAILABLE');
    assert.equal((status as any).healthIssue.statusCode, 503);
    assert.equal(records[0].userId, 17);
    assert.equal(records[0].sellerId, 'SELLER');
    assert.ok(!JSON.stringify(records).includes('private-refresh-token'));
  } finally {
    prisma.amazonConnection.findFirst = originalConnection;
    prisma.channelSyncLog.findFirst = originalSync;
    logger.warn = originalWarn;
  }
});

test('network failures have a bounded, actionable connection error', async () => {
  const instance = service(async (_input, init) => {
    assert.ok(init?.signal);
    throw new Error('private-client-secret');
  });
  const { state } = instance.initiateOAuth(17, 'inventoryusers');
  await assert.rejects(() => instance.completeOAuth({ userId: 17, userType: 'inventoryusers',
    code: 'oauth-code-value', sellingPartnerId: 'SELLER', state,
  }), (error: unknown) => error instanceof AmazonConnectionError
    && error.code === 'AMAZON_AUTH_NETWORK_ERROR' && error.statusCode === 502
    && !error.message.includes('private-client-secret'));
});
