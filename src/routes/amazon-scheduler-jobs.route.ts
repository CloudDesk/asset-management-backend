import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { amazonSchedulerJobsService } from '../services/amazon-scheduler-jobs.service.js';
import { createSuccessResponse } from '../utils/errorHandler.js';

// No login: Cloud Scheduler calls these with the x-scheduler-secret header (AMAZON_SCHEDULER_SECRET)
const requireSchedulerSecret = async (request: FastifyRequest, reply: FastifyReply) => {
  const configuredSecret = env.AMAZON_SCHEDULER_SECRET;
  if (!configuredSecret) {
    logger.error('Amazon scheduler job called before AMAZON_SCHEDULER_SECRET was configured');
    return reply.code(503).send({ success: false, message: 'Scheduler job is not configured', statusCode: 503 });
  }
  const providedSecret = Buffer.from(String(request.headers['x-scheduler-secret'] || '').trim());
  const expectedSecret = Buffer.from(configuredSecret);
  if (providedSecret.length !== expectedSecret.length || !timingSafeEqual(providedSecret, expectedSecret)) {
    logger.warn({ secretProvided: providedSecret.length > 0, url: request.url }, 'Rejected Amazon scheduler job with invalid secret');
    return reply.code(401).send({ success: false, message: 'Invalid scheduler secret', statusCode: 401 });
  }
};

const successResponse = {
  type: 'object',
  additionalProperties: true,
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {},
  },
};

const jobSchema = (description: string) => ({
  tags: ['Amazon Scheduler Jobs'],
  description,
  headers: { type: 'object', properties: { 'x-scheduler-secret': { type: 'string' } } },
  response: { 200: successResponse },
});

export async function amazonSchedulerJobsRoutes(fastify: FastifyInstance) {
  fastify.post('/order-sync', {
    preHandler: requireSchedulerSecret,
    schema: jobSchema('Cloud Scheduler job: import recent Amazon orders and wait for the result (x-scheduler-secret required)'),
  }, async (_request, reply) => {
    const result = await amazonSchedulerJobsService.runOrderSync();
    logger.info({ scopes: result.scopes, failed: result.failed }, 'Scheduled Amazon order sync completed (Cloud Scheduler)');
    return reply.send(createSuccessResponse('Amazon order sync completed', result));
  });

  fastify.post('/listing-sync', {
    preHandler: requireSchedulerSecret,
    schema: jobSchema('Cloud Scheduler job: import Amazon listings for every configured seller (x-scheduler-secret required)'),
  }, async (_request, reply) => {
    const result = await amazonSchedulerJobsService.runListingSync();
    logger.info(result, 'Scheduled Amazon listing sync completed (Cloud Scheduler)');
    return reply.send(createSuccessResponse('Amazon listing sync completed', result));
  });

  fastify.post('/retry-queue', {
    preHandler: requireSchedulerSecret,
    schema: jobSchema('Cloud Scheduler job: run due Amazon retry jobs (x-scheduler-secret required)'),
  }, async (_request, reply) => {
    const result = await amazonSchedulerJobsService.runRetryQueue();
    logger.info(result, 'Scheduled Amazon retry queue completed (Cloud Scheduler)');
    return reply.send(createSuccessResponse('Amazon retry queue completed', result));
  });

  fastify.post('/return-sync', {
    preHandler: requireSchedulerSecret,
    schema: jobSchema('Cloud Scheduler job: one step of the Amazon returns import — request or collect the FBA / FBM return reports (x-scheduler-secret required)'),
  }, async (_request, reply) => {
    const result = await amazonSchedulerJobsService.runReturnSync();
    logger.info({ steps: result.steps, failed: result.failed }, 'Scheduled Amazon return import step completed (Cloud Scheduler)');
    return reply.send(createSuccessResponse('Amazon return import step completed', result));
  });
}
