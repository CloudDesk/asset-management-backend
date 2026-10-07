import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { errorHandler } from '../utils/errorHandler.js';
import { roleRoutes } from './role.route.js';

// Fastify drops properties not listed in a response schema. Error schemas that
// omit message/details turn { success, message, details } into { success: false }.
test('every role error response schema keeps message and details', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  const missing: string[] = [];
  app.addHook('onRoute', (route) => {
    const responses = (route.schema?.response ?? {}) as Record<string, any>;
    for (const [code, schema] of Object.entries(responses)) {
      if (!/^[45]\d\d$/.test(code)) continue;
      const props = schema?.properties ?? {};
      if (!props.message || !props.details) missing.push(`${route.method} ${route.url} ${code}`);
    }
  });
  await app.register(roleRoutes, { prefix: '/v1/roles' });
  await app.ready();
  assert.deepEqual(missing, []);
});

test('create role validation error reaches the client with message and details', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  app.setErrorHandler(errorHandler);
  await app.register(roleRoutes, { prefix: '/v1/roles' });

  const response = await app.inject({
    method: 'POST',
    url: '/v1/roles',
    payload: { name: 'Bad Code Role', code: 'System-Admin', level: 10 },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.success, false);
  assert.ok(body.message, `message missing from ${response.body}`);
  assert.match(`${body.message} ${body.details ?? ''}`, /lowercase letters, numbers and underscores/);
});
