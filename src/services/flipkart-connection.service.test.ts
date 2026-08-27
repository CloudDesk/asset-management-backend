import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FlipkartConnectionError,
  FlipkartConnectionService,
} from './flipkart-connection.service.js';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

test('authenticates and discovers seller ID without requiring it in configuration', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const service = new FlipkartConnectionService({
    appId: 'app-id',
    appSecret: 'app-secret',
    apiBaseUrl: 'https://api.flipkart.test',
    fetchImpl: (async (input, init) => {
      calls.push({ url: String(input), init });
      if (String(input).includes('/oauth-service/oauth/token')) {
        return jsonResponse({ access_token: 'access-token', token_type: 'bearer', expires_in: 3600, scope: 'Seller_Api' });
      }
      return jsonResponse({ listingData: [{ sellerId: 'seller-123' }] });
    }) as typeof fetch,
  });

  const result = await service.testConnection();

  assert.equal(result.connected, true);
  assert.equal(result.sellerId, 'seller-123');
  assert.equal(result.sellerIdSource, 'LISTING_DISCOVERY');
  assert.equal(result.inventoryWritesEnabled, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.init?.headers && (calls[1].init.headers as Record<string, string>).Authorization, 'Bearer access-token');
  assert.equal(
    Buffer.from(((calls[0]?.init?.headers as Record<string, string>).Authorization).replace('Basic ', ''), 'base64').toString(),
    'app-id:app-secret'
  );
});

test('connects successfully when the account has no discoverable listings', async () => {
  let calls = 0;
  const service = new FlipkartConnectionService({
    appId: 'app-id',
    appSecret: 'app-secret',
    apiBaseUrl: 'https://api.flipkart.test',
    fetchImpl: (async (input) => {
      calls += 1;
      return String(input).includes('/oauth-service/oauth/token')
        ? jsonResponse({ access_token: 'access-token', expires_in: 3600 })
        : jsonResponse({ listingData: [] });
    }) as typeof fetch,
  });

  const result = await service.testConnection();
  assert.equal(result.connected, true);
  assert.equal(result.sellerId, null);
  assert.equal(result.sellerIdSource, 'NOT_DISCOVERED');
  assert.equal(calls, 6);
});

test('does not expose credentials in configuration status', () => {
  const service = new FlipkartConnectionService({ appId: 'private-id', appSecret: 'private-secret' });
  const status = service.configurationStatus();
  assert.equal(status.status, 'CONFIGURED');
  assert.equal(JSON.stringify(status).includes('private-secret'), false);
  assert.equal(status.sellerIdRequired, false);
});

test('returns a safe authentication error for rejected credentials', async () => {
  const service = new FlipkartConnectionService({
    appId: 'bad-id',
    appSecret: 'bad-secret',
    fetchImpl: (async () => jsonResponse({ error: 'invalid_client' }, 401)) as typeof fetch,
  });

  await assert.rejects(
    service.testConnection(),
    (error: unknown) => error instanceof FlipkartConnectionError
      && error.statusCode === 401
      && error.code === 'FLIPKART_AUTHENTICATION_FAILED'
      && !error.message.includes('bad-secret')
  );
});
