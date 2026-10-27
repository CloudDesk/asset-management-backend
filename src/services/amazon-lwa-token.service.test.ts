import assert from 'node:assert/strict';
import test from 'node:test';
import { AmazonAuthorizationError, AmazonLwaTokenService, AmazonTokenRequestError } from './amazon-lwa-token.service.js';

const credentials = { clientId: 'test-client-id', clientSecret: 'private-secret', refreshToken: 'private|refresh-token' };
const service = (fetchImpl: typeof fetch) => new AmazonLwaTokenService({ ...credentials, fetchImpl });

test('shared token helper sends the same refresh grant encoding as the previous sandbox implementation', async () => {
  const values = { clientId: 'test-client+id', clientSecret: 'test-secret+/=&', refreshToken: 'test|refresh+/=' };
  const previousBody = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: values.refreshToken,
    client_id: values.clientId, client_secret: values.clientSecret }).toString();
  const instance = new AmazonLwaTokenService({ ...values, fetchImpl: async (url, init) => {
    assert.equal(String(url), 'https://api.amazon.com/auth/o2/token');
    assert.equal(init?.method, 'POST');
    assert.equal(String(init?.body), previousBody);
    assert.equal(new Headers(init?.headers).get('Content-Type'), 'application/x-www-form-urlencoded;charset=UTF-8');
    return new Response(JSON.stringify({ access_token: 'test-access-token', expires_in: 3600 }));
  } });
  assert.equal(await instance.getAccessToken(), 'test-access-token');
});

test('credential rejection preserves the provider reason without exposing secrets', async () => {
  const instance = service(async () => new Response(JSON.stringify({ error: 'invalid_grant',
    error_description: `Rejected ${credentials.refreshToken} ${encodeURIComponent(credentials.refreshToken)} ${credentials.clientSecret}`,
  }), { status: 400 }));
  await assert.rejects(() => instance.getAccessToken(), (error: unknown) => {
    assert.ok(error instanceof AmazonAuthorizationError);
    assert.equal(error.statusCode, 401);
    assert.match(error.message, /invalid_grant/);
    assert.ok(!error.message.includes(credentials.refreshToken));
    assert.ok(!error.message.includes(encodeURIComponent(credentials.refreshToken)));
    assert.ok(!error.message.includes(credentials.clientSecret));
    return true;
  });
});

for (const status of [429, 503]) {
  test(`token endpoint ${status} is temporary and a later attempt can succeed`, async () => {
    let calls = 0;
    const instance = service(async () => ++calls === 1
      ? new Response(JSON.stringify({ error: 'temporarily_unavailable' }), { status })
      : new Response(JSON.stringify({ access_token: 'recovered-token', expires_in: 3600 })));
    await assert.rejects(() => instance.getAccessToken(), (error: unknown) => error instanceof AmazonTokenRequestError
      && !(error instanceof AmazonAuthorizationError) && error.statusCode === status
      && error.code === 'AMAZON_AUTH_TEMPORARILY_UNAVAILABLE');
    assert.equal(await instance.getAccessToken(), 'recovered-token');
    assert.equal(await instance.getAccessToken(), 'recovered-token');
    assert.equal(calls, 2);
  });
}

test('network failures are not credential failures and never expose raw errors', async () => {
  const instance = service(async (_input, init) => {
    assert.ok(init?.signal);
    throw new Error(credentials.clientSecret);
  });
  await assert.rejects(() => instance.getAccessToken(), (error: unknown) => error instanceof AmazonTokenRequestError
    && error.statusCode === 502 && error.code === 'AMAZON_AUTH_NETWORK_ERROR'
    && !error.message.includes(credentials.clientSecret));
});

test('unexpected bad requests retain their status without claiming credentials expired', async () => {
  const instance = service(async () => new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400 }));
  await assert.rejects(() => instance.getAccessToken(), (error: unknown) => error instanceof AmazonTokenRequestError
    && error.statusCode === 400 && error.code === 'AMAZON_AUTH_REQUEST_FAILED');
});

for (const body of ['not-json', 'null', '{"access_token":123}', '{}']) {
  test(`invalid token response ${body} is an upstream response error`, async () => {
    const instance = service(async () => new Response(body));
    await assert.rejects(() => instance.getAccessToken(), (error: unknown) => error instanceof AmazonTokenRequestError
      && error.statusCode === 502 && error.code === 'AMAZON_AUTH_INVALID_RESPONSE');
  });
}
