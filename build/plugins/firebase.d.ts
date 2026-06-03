import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { App } from 'firebase-admin/app';
import { Messaging } from 'firebase-admin/messaging';
export type FirebaseAdminContext = {
    app: App;
    messaging: Messaging;
};
export declare function initializeFirebaseAdmin(): FirebaseAdminContext | null;
declare function firebasePlugin(fastify: FastifyInstance, _options: FastifyPluginOptions): Promise<void>;
declare const _default: typeof firebasePlugin;
export default _default;
declare module 'fastify' {
    interface FastifyInstance {
        firebase: FirebaseAdminContext | null;
    }
}
//# sourceMappingURL=firebase.d.ts.map