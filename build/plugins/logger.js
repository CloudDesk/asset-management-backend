import fp from 'fastify-plugin';
import { logger } from '../config/logger.js';
async function loggerPlugin(fastify) {
    // Register logger instance
    fastify.decorate('logger', logger);
    // Add request logging with timing
    fastify.addHook('onRequest', async (request) => {
        request.log.info({
            method: request.method,
            url: request.url,
            query: request.query,
            userAgent: request.headers['user-agent'],
        }, 'Incoming request');
    });
    // Add response logging with timing
    fastify.addHook('onResponse', async (request, reply) => {
        request.log.info({
            method: request.method,
            url: request.url,
            statusCode: reply.statusCode,
            responseTime: reply.elapsedTime,
        }, `Request completed - ${reply.statusCode} - ${reply.elapsedTime}ms`);
    });
    // Log server startup
    logger.info('Logger plugin registered successfully');
}
export default fp(loggerPlugin, {
    name: 'logger',
});
//# sourceMappingURL=logger.js.map