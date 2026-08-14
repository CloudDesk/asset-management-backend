import assert from 'node:assert/strict';
import test from 'node:test';
import { AmazonConnectionError, AmazonConnectionService } from './amazon-connection.service.js';

const service = (now = 1_700_000_000_000) => new AmazonConnectionService({
  now: () => now,
  appId: 'amzn1.sp.solution.test',
  oauthVersion: 'beta',
  redirectUri: 'https://inventory.example.com/amazon/callback',
  sellerCentralUrl: 'https://sellercentral.amazon.in',
  stateSecret: 'test-state-secret-that-is-not-used-in-production',
  stateTtlSeconds: 600,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  fetchImpl: async () => { throw new Error('fetch must not be reached'); },
});

test('creates an Amazon consent URL with a server-signed state', () => {
  const result = service().initiateOAuth(42, 'inventoryusers');
  const url = new URL(result.authorizationUrl);

  assert.equal(url.origin, 'https://sellercentral.amazon.in');
  assert.equal(url.pathname, '/apps/authorize/consent');
  assert.equal(url.searchParams.get('application_id'), 'amzn1.sp.solution.test');
  assert.equal(url.searchParams.get('state'), result.state);
  assert.equal(url.searchParams.get('version'), 'beta');
  assert.match(result.state, /^[^.]+\.[^.]+$/);
});

test('rejects a tampered OAuth state before token exchange', async () => {
  const amazon = service();
  const { state } = amazon.initiateOAuth(42, 'inventoryusers');

  await assert.rejects(
    amazon.completeOAuth({
      userId: 42,
      userType: 'inventoryusers',
      code: 'oauth-code',
      sellingPartnerId: 'seller-id',
      state: `${state}tampered`,
    }),
    (error: unknown) => error instanceof AmazonConnectionError && error.code === 'AMAZON_OAUTH_STATE_INVALID'
  );
});

test('rejects an expired OAuth state before token exchange', async () => {
  let now = 1_700_000_000_000;
  const amazon = new AmazonConnectionService({
    now: () => now,
    appId: 'app-id',
    redirectUri: 'https://inventory.example.com/amazon/callback',
    stateSecret: 'test-state-secret-that-is-not-used-in-production',
    stateTtlSeconds: 300,
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl: async () => { throw new Error('fetch must not be reached'); },
  });
  const { state } = amazon.initiateOAuth(42, 'inventoryusers');
  now += 301_000;

  await assert.rejects(
    amazon.completeOAuth({
      userId: 42,
      userType: 'inventoryusers',
      code: 'oauth-code',
      sellingPartnerId: 'seller-id',
      state,
    }),
    (error: unknown) => error instanceof AmazonConnectionError && error.code === 'AMAZON_OAUTH_STATE_EXPIRED'
  );
});
