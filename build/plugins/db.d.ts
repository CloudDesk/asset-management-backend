import { FastifyInstance } from 'fastify';
import { prisma } from '../models/prisma.js';
declare module 'fastify' {
    interface FastifyInstance {
        prisma: typeof prisma;
    }
}
declare function dbPlugin(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof dbPlugin;
export default _default;
//# sourceMappingURL=db.d.ts.map