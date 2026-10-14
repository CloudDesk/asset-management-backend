import assert from 'node:assert/strict';
import test from 'node:test';
import { AmazonSandboxInventoryService } from './amazon-sandbox-inventory.service.js';

test('sandbox shares the LWA cache and exchanges a token once for concurrent requests', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (_input, init) => {
      ++calls;
      assert.ok(init?.signal);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }));
    };
    const sandbox = new AmazonSandboxInventoryService() as any;
    sandbox.getCredentialConfig = () => ({ clientId: 'test-id', clientSecret: 'test-secret', refreshToken: 'test-refresh' });
    assert.deepEqual(await Promise.all([sandbox.getAccessToken(), sandbox.getAccessToken()]), ['test-token', 'test-token']);
    assert.equal(await sandbox.getAccessToken(), 'test-token');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
