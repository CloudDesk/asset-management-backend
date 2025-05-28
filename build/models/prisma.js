import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
const prisma = globalThis.__prisma || new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
if (env.NODE_ENV === 'development') {
    globalThis.__prisma = prisma;
}
export { prisma };
//# sourceMappingURL=prisma.js.map