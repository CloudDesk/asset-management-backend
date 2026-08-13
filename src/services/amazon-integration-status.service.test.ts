import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAmazonIntegrationStatus } from './amazon-integration-status.service.js';

const completeConfig = {
  clientId: 'client',
  clientSecret: 'secret',
  refreshToken: 'refresh',
  sellerId: 'seller',
  marketplaceId: 'A21TJRUUN4KGV',
  listingImportEnabled: true,
  productionWritesEnabled: true,
  sandboxCredentialSource: 'SANDBOX' as const,
  sandboxClientId: 'sandbox-client',
  sandboxClientSecret: 'sandbox-secret',
  sandboxRefreshToken: 'sandbox-refresh',
  appId: 'amzn1.sellerapps.app.test',
  redirectUri: 'https://example.com/amazon/callback',
  tokenEncryptionKey: Buffer.alloc(32, 1).toString('base64'),
};

test('reports configured production access as read-only during phase 1', () => {
  const status = buildAmazonIntegrationStatus(completeConfig);

  assert.equal(status.production.status, 'CONFIGURED');
  assert.equal(status.production.accessMode, 'READ_ONLY');
  assert.equal(status.production.productionWritesEnabled, false);
  assert.equal(status.production.connectionType, 'ENVIRONMENT_VARIABLES');
  assert.equal(status.oauth.status, 'AVAILABLE');
});

test('reports missing configuration without returning credential values', () => {
  const status = buildAmazonIntegrationStatus({
    ...completeConfig,
    clientSecret: undefined,
    sandboxRefreshToken: undefined,
  });

  assert.equal(status.production.status, 'INCOMPLETE');
  assert.deepEqual(status.production.missingConfiguration, ['client secret']);
  assert.equal(status.sandbox.status, 'INCOMPLETE');
  assert.deepEqual(status.sandbox.missingConfiguration, ['refresh token']);
  assert.equal(JSON.stringify(status).includes('sandbox-secret'), false);
});

test('reports configured but disabled listing imports honestly', () => {
  const status = buildAmazonIntegrationStatus({
    ...completeConfig,
    listingImportEnabled: false,
  });

  assert.equal(status.production.status, 'DISABLED');
  assert.equal(status.production.listingImportEnabled, false);
});
