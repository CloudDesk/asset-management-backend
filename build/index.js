import { buildServer } from './server.js';
import { env } from './config/env.js';
import { redisClient } from './config/redis.js';
import { ekartAuthService } from './services/ekart-auth.service.js';
// Global BigInt serialization fix
BigInt.prototype.toJSON = function () {
    return Number(this);
};
async function start() {
    try {
        // Initialize Redis connection
        console.log('🔌 Connecting to Redis...');
        await redisClient.connect();
        console.log('✅ Redis connected successfully');
        // Initialize Ekart auth (optional - will auto-connect on first API call if credentials are set)
        if (env.EKART_CLIENT_ID && env.EKART_USERNAME && env.EKART_PASSWORD) {
            try {
                console.log('🔌 Connecting to Ekart API...');
                await ekartAuthService.connect();
                console.log('✅ Ekart API connected successfully');
            }
            catch (error) {
                console.warn('⚠️  Ekart API connection failed (will retry on first API call):', error.message);
            }
        }
        else {
            console.log('ℹ️  Ekart credentials not configured - skipping initial connection');
        }
        const fastify = await buildServer();
        const port = process.env.PORT || env.PORT || 5600;
        await fastify.listen({
            port: Number(port),
            host: '0.0.0.0',
        });
        // Start the server
        // await fastify.listen({
        //  port: env.PORT,
        //  host: '0.0.0.0',
        //});
        fastify.log.info(`🚀 Server running at http://localhost:${env.PORT}`);
        fastify.log.info(`📚 API Documentation available at http://localhost:${env.PORT}/docs`);
        // Graceful shutdown
        const signals = ['SIGINT', 'SIGTERM'];
        signals.forEach((signal) => {
            process.on(signal, async () => {
                fastify.log.info(`Received ${signal}, shutting down gracefully...`);
                // Disconnect Redis
                fastify.log.info('Disconnecting from Redis...');
                await redisClient.disconnect();
                await fastify.close();
                process.exit(0);
            });
        });
    }
    catch (error) {
        console.error('Error starting server:', error);
        // Disconnect Redis on error
        try {
            await redisClient.disconnect();
        }
        catch (redisError) {
            console.error('Error disconnecting from Redis:', redisError);
        }
        process.exit(1);
    }
}
start();
//# sourceMappingURL=index.js.map