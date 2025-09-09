import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import loggerPlugin from './plugins/logger.js';
import dbPlugin from './plugins/db.js';
import swaggerPlugin from './plugins/swagger.js';
import { routes } from './routes/index.js';
import { errorHandler, createErrorResponse } from './utils/errorHandler.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: true, // Use default logger instead of passing pino instance
    disableRequestLogging: true, // We'll handle this in our logger plugin
  });
  console.log('test');

  // Register logger plugin first
  await fastify.register(loggerPlugin);

  // Register CORS - Allow all origins
  await fastify.register(cors, {
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
  });

  // Register form body parser
  await fastify.register(formbody);

  // Register multipart support
  await fastify.register(multipart);

  // Register database plugin
  await fastify.register(dbPlugin);

  // Register Swagger documentation (only in development)
  if (env.NODE_ENV === 'development') {
    await fastify.register(swaggerPlugin);
  }

  // Register simplified error handler for any uncaught errors
  fastify.setErrorHandler(errorHandler);

  // Register routes
  await fastify.register(routes);

  // 404 handler
  fastify.setNotFoundHandler(async (request, reply) => {
    logger.warn({
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
    }, 'Route not found');
    
    const response = createErrorResponse(
      'Route not found',
      `The endpoint ${request.method} ${request.url} does not exist`,
      404
    );
    
    return reply.code(404).send(response);
  });

  return fastify;
} 