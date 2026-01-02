import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import multipart, { ajvFilePlugin } from '@fastify/multipart';
import fastifyCookie from 'fastify-cookie';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import loggerPlugin from './plugins/logger.js';
import dbPlugin from './plugins/db.js';
// import firebasePlugin from './plugins/firebase.js';
import swaggerPlugin from './plugins/swagger.js';
import { routes } from './routes/index.js';
import { errorHandler, createErrorResponse } from './utils/errorHandler.js';
export async function buildServer() {
    const fastify = Fastify({
        logger: true, // Use default logger instead of passing pino instance
        disableRequestLogging: true, // We'll handle this in our logger plugin
        ajv: {
            plugins: [ajvFilePlugin],
        },
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
    // Register multipart support and expose files/fields on request.body for schema validation
    await fastify.register(multipart, {
        attachFieldsToBody: true,
    });
    // Register cookie support for session management
    // @ts-expect-error - fastify-cookie type definitions mismatch with Fastify v5
    await fastify.register(fastifyCookie);
    // Register database plugin
    await fastify.register(dbPlugin);
    // Register Firebase Admin plugin
    // await fastify.register(firebasePlugin);
    // Register Swagger documentation (development and production)
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'production') {
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
        const response = createErrorResponse('Route not found', `The endpoint ${request.method} ${request.url} does not exist`, 404);
        return reply.code(404).send(response);
    });
    return fastify;
}
//# sourceMappingURL=server.js.map