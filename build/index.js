import { buildServer } from './server.js';
import { env } from './config/env.js';
// Global BigInt serialization fix
BigInt.prototype.toJSON = function () {
    return Number(this);
};
async function start() {
    try {
        const fastify = await buildServer();
        // Start the server
        await fastify.listen({
            port: env.PORT,
            host: '0.0.0.0',
        });
        fastify.log.info(`🚀 Server running at http://localhost:${env.PORT}`);
        fastify.log.info(`📚 API Documentation available at http://localhost:${env.PORT}/docs`);
        // Graceful shutdown
        const signals = ['SIGINT', 'SIGTERM'];
        signals.forEach((signal) => {
            process.on(signal, async () => {
                fastify.log.info(`Received ${signal}, shutting down gracefully...`);
                await fastify.close();
                process.exit(0);
            });
        });
    }
    catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
}
start();
//# sourceMappingURL=index.js.map