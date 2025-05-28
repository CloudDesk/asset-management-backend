import { FastifyInstance } from 'fastify';
import { Logger } from '../config/logger.js';
declare module 'fastify' {
    interface FastifyInstance {
        logger: Logger;
    }
}
declare function loggerPlugin(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof loggerPlugin;
export default _default;
//# sourceMappingURL=logger.d.ts.map