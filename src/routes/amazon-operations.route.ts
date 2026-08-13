import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthenticatedRequest, requireAuthentication } from '../middleware/auth.middleware.js';
import { requireAmazonChannelPermission, requireAmazonOperationalCapability } from '../middleware/amazon-channel-permission.middleware.js';
import { amazonListingScopeService } from '../services/amazon-listing-scope.service.js';
import { amazonOperationsService } from '../services/amazon-operations.service.js';
import { amazonNotificationSubscriptionService } from '../services/amazon-notification-subscription.service.js';
import { createSuccessResponse } from '../utils/errorHandler.js';

const scopeFor = (request: FastifyRequest) => {
  const user = (request as AuthenticatedRequest).user;
  return amazonListingScopeService.resolve(user?.id, user?.userType);
};
const actorFor = (request: FastifyRequest) => {
  const user = (request as AuthenticatedRequest).user;
  return {
    ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
    ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
  };
};
const fail = (reply: FastifyReply, error: unknown) => {
  const item = error as { statusCode?: number; code?: string; message?: string };
  return reply.code(item.statusCode || 400).send({ success: false, message: item.message || 'Amazon operations request failed', code: item.code || 'AMAZON_OPERATIONS_REQUEST_FAILED' });
};

export async function amazonOperationsRoutes(fastify: FastifyInstance) {
  const read = [requireAuthentication, requireAmazonChannelPermission(['read'])];

  fastify.get('/', { preHandler: read, schema: { tags: ['Amazon Operations'], security: [{ bearerAuth: [] }] } }, async (request, reply) => {
    try {
      reply.header('Cache-Control', 'no-store');
      const scope = await scopeFor(request);
      return reply.send(createSuccessResponse('Amazon operations dashboard retrieved', await amazonOperationsService.dashboard(scope, (request as AuthenticatedRequest).user?.id)));
    } catch (error) { return fail(reply, error); }
  });

  fastify.get('/activity', { preHandler: read, schema: { tags: ['Amazon Operations'], security: [{ bearerAuth: [] }], querystring: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } }, additionalProperties: false } } }, async (request, reply) => {
    try {
      const scope = await scopeFor(request);
      const limit = Number((request.query as { limit?: number }).limit || 50);
      return reply.send(createSuccessResponse('Amazon activity retrieved', await amazonOperationsService.activity(scope, limit)));
    } catch (error) { return fail(reply, error); }
  });

  fastify.get('/failures', { preHandler: read, schema: { tags: ['Amazon Operations'], security: [{ bearerAuth: [] }], querystring: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } }, additionalProperties: false } } }, async (request, reply) => {
    try {
      const scope = await scopeFor(request);
      const limit = Number((request.query as { limit?: number }).limit || 50);
      return reply.send(createSuccessResponse('Amazon failed operations retrieved', await amazonOperationsService.failures(scope, limit)));
    } catch (error) { return fail(reply, error); }
  });

  fastify.post('/writes/pause', { preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_operations_admin')], schema: { tags: ['Amazon Operations'], security: [{ bearerAuth: [] }], body: { type: 'object', required: ['confirmed', 'reason'], properties: { confirmed: { type: 'boolean', const: true }, reason: { type: 'string', minLength: 3, maxLength: 500 } }, additionalProperties: false } } }, async (request, reply) => {
    try {
      const scope = await scopeFor(request);
      const body = request.body as { reason: string };
      return reply.send(createSuccessResponse('Amazon production writes paused', await amazonOperationsService.setPaused(scope, true, body.reason, actorFor(request))));
    } catch (error) { return fail(reply, error); }
  });

  fastify.post('/writes/resume', { preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_operations_admin')], schema: { tags: ['Amazon Operations'], security: [{ bearerAuth: [] }], body: { type: 'object', required: ['confirmed', 'reason'], properties: { confirmed: { type: 'boolean', const: true }, reason: { type: 'string', minLength: 3, maxLength: 500 } }, additionalProperties: false } } }, async (request, reply) => {
    try {
      const scope = await scopeFor(request);
      const body = request.body as { reason: string };
      return reply.send(createSuccessResponse('Amazon production write pause removed; environment switch still applies', await amazonOperationsService.setPaused(scope, false, body.reason, actorFor(request))));
    } catch (error) { return fail(reply, error); }
  });

  fastify.post('/retries', { preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_retry_failures')], schema: { tags: ['Amazon Operations'], security: [{ bearerAuth: [] }], body: { type: 'object', required: ['type', 'resourceId'], properties: { type: { type: 'string', enum: ['ORDER_IMPORT', 'INVENTORY_SYNC', 'FULFILLMENT_EXCEPTION'] }, resourceId: { type: 'string', pattern: '^\\d+$' }, listingId: { type: 'string', pattern: '^\\d+$' }, orderId: { type: 'string', pattern: '^\\d+$' } }, additionalProperties: false } } }, async (request, reply) => {
    try {
      const scope = await scopeFor(request);
      return reply.code(202).send(createSuccessResponse('Amazon retry queued', await amazonOperationsService.enqueueRetry(scope, request.body as any, actorFor(request))));
    } catch (error) { return fail(reply, error); }
  });

  fastify.post('/retries/:jobId/run', { preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_retry_failures')], schema: { tags: ['Amazon Operations'], security: [{ bearerAuth: [] }], params: { type: 'object', required: ['jobId'], properties: { jobId: { type: 'string', pattern: '^\\d+$' } } } } }, async (request, reply) => {
    try {
      const scope = await scopeFor(request);
      return reply.send(createSuccessResponse('Amazon retry processed', await amazonOperationsService.runRetry(scope, (request.params as { jobId: string }).jobId)));
    } catch (error) { return fail(reply, error); }
  });

  fastify.post('/notifications/configure', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_operations_admin')],
    schema: {
      tags: ['Amazon Operations'], security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['confirmed'], properties: { confirmed: { type: 'boolean', const: true } }, additionalProperties: false },
    },
  }, async (request, reply) => {
    try {
      const scope = await scopeFor(request);
      return reply.send(createSuccessResponse('Amazon notification subscriptions processed', await amazonNotificationSubscriptionService.configure(scope, actorFor(request))));
    } catch (error) { return fail(reply, error); }
  });

  fastify.post('/notifications/refresh', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_operations_admin')],
    schema: { tags: ['Amazon Operations'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    try {
      const scope = await scopeFor(request);
      return reply.send(createSuccessResponse('Amazon notification subscription status refreshed', await amazonNotificationSubscriptionService.refresh(scope, actorFor(request))));
    } catch (error) { return fail(reply, error); }
  });

  fastify.get('/export', { preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_export')], schema: { tags: ['Amazon Operations'], security: [{ bearerAuth: [] }], querystring: { type: 'object', required: ['type'], properties: { type: { type: 'string', enum: ['listings', 'mappings', 'inventory', 'orders'] } }, additionalProperties: false } } }, async (request, reply) => {
    try {
      const scope = await scopeFor(request);
      const type = (request.query as { type: string }).type;
      const body = await amazonOperationsService.export(scope, type);
      return reply.type('text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="amazon-${type}-${new Date().toISOString().slice(0, 10)}.csv"`).send(body);
    } catch (error) { return fail(reply, error); }
  });
}
