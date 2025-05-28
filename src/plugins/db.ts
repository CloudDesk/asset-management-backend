import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}

async function dbPlugin(fastify: FastifyInstance) {
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
    await prisma.$queryRaw`SELECT 1`;
    
    logger.info('✅ Database connected and tested successfully');
    fastify.log.info('Database plugin registered successfully');
  } catch (error) {
    logger.error({ error }, '❌ Failed to connect to database');
    fastify.log.error('Failed to connect to database:', error);
    
    // Exit process if database connection fails
    process.exit(1);
  }
}

export default fp(dbPlugin, {
  name: 'db',
}); 