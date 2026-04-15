import fp from 'fastify-plugin';
import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';
async function dbPlugin(fastify) {
    // Register Prisma instance
    fastify.decorate('prisma', prisma);
    // Add graceful shutdown
    fastify.addHook('onClose', async () => {
        logger.info('Disconnecting from database...');
        await prisma.$disconnect();
        logger.info('Database disconnected successfully');
    });
    // Test database connection on startup
    try {
        await prisma.$connect();
        // Test with a simple query
        await prisma.$queryRaw `SELECT 1`;
        logger.info('✅ Database connected and tested successfully');
        fastify.log.info('Database plugin registered successfully');
    }
    catch (error) {
        logger.error({ error }, '❌ Failed to connect to database');
        fastify.log.error('Failed to connect to database:', error);
        // Keep the process alive so Cloud Run can finish startup and surface the real DB error in logs.
        // Prisma will reconnect when requests hit the database again.
    }
}
export default fp(dbPlugin, {
    name: 'db',
});
//# sourceMappingURL=db.js.map