import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
const prisma = globalThis.__prisma || new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Error handling
    errorFormat: 'pretty',
    // Transaction timeout settings
    transactionOptions: {
        maxWait: 10000, // 10 seconds - max time to wait for transaction to start
        timeout: 90000, // 90 seconds - max time transaction can run
    }
});
// Add connection error handling and retry logic
// @ts-ignore - Prisma middleware types are not fully compatible with strict mode
prisma.$use(async (params, next) => {
    const maxRetries = 3;
    let retries = 0;
    while (retries < maxRetries) {
        try {
            return await next(params);
        }
        catch (error) {
            retries++;
            // Check if it's a connection error that should be retried
            if (retries < maxRetries &&
                (error.code === 'P1001' || // Can't reach database server
                    error.code === 'P1017' || // Server has closed the connection
                    error.message?.includes("Can't reach database server") ||
                    error.message?.includes("Connection terminated") ||
                    error.message?.includes("connect timeout"))) {
                console.warn(`Database connection attempt ${retries} failed, retrying...`, {
                    error: error.message,
                    code: error.code,
                    model: params.model,
                    action: params.action
                });
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, retries - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            // If it's not a retry-able error or we've exhausted retries, throw the error
            throw error;
        }
    }
});
// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('Received SIGINT, gracefully shutting down Prisma client...');
    await prisma.$disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, gracefully shutting down Prisma client...');
    await prisma.$disconnect();
    process.exit(0);
});
// Log successful connection on startup
if (env.NODE_ENV === 'development') {
    prisma.$connect()
        .then(() => {
        console.log('✅ Database connected successfully');
    })
        .catch((error) => {
        console.error('❌ Database connection failed:', error.message);
    });
    globalThis.__prisma = prisma;
}
export { prisma };
//# sourceMappingURL=prisma.js.map