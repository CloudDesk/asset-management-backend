import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import admin from 'firebase-admin';
/**
 * Firebase Admin SDK plugin for Fastify
 * Initializes Firebase Admin and decorates Fastify with the admin instance
 */
declare function firebasePlugin(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void>;
declare const _default: typeof firebasePlugin;
export default _default;
declare module 'fastify' {
    interface FastifyInstance {
        firebase: typeof admin | null;
    }
}
//# sourceMappingURL=firebase.d.ts.map