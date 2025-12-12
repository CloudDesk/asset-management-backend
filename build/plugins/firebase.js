// import { FastifyInstance, FastifyPluginOptions } from 'fastify';
// import fp from 'fastify-plugin';
// import admin from 'firebase-admin';
// import { env } from '../config/env.js';
// import { logger } from '../config/logger.js';
export {};
// /**
//  * Firebase Admin SDK plugin for Fastify
//  * Initializes Firebase Admin and decorates Fastify with the admin instance
//  */
// async function firebasePlugin(
//   fastify: FastifyInstance,
//   options: FastifyPluginOptions
// ): Promise<void> {
//   try {
//     // Check if Firebase is already initialized
//     if (admin.apps.length > 0) {
//       logger.info('Firebase Admin already initialized');
//       fastify.decorate('firebase', admin);
//       return;
//     }
//     // Check if Firebase credentials are provided
//     if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
//       logger.warn('Firebase credentials not provided. Firebase authentication will not be available.');
//       fastify.decorate('firebase', null);
//       return;
//     }
//     // Initialize Firebase Admin
//     const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
//     admin.initializeApp({
//       credential: admin.credential.cert({
//         projectId: env.FIREBASE_PROJECT_ID,
//         clientEmail: env.FIREBASE_CLIENT_EMAIL,
//         privateKey: privateKey,
//       }),
//     });
//     logger.info('Firebase Admin initialized successfully');
//     // Decorate Fastify instance with Firebase Admin
//     fastify.decorate('firebase', admin);
//     // Clean up on server close
//     fastify.addHook('onClose', async () => {
//       try {
//         await admin.app().delete();
//         logger.info('Firebase Admin closed');
//       } catch (error) {
//         logger.error({ error }, 'Error closing Firebase Admin');
//       }
//     });
//   } catch (error) {
//     logger.error({ error }, 'Error initializing Firebase Admin');
//     fastify.decorate('firebase', null);
//   }
// }
// export default fp(firebasePlugin, {
//   name: 'firebase-admin',
// });
// // Extend Fastify type definitions
// declare module 'fastify' {
//   interface FastifyInstance {
//     firebase: typeof admin | null;
//   }
// }
//# sourceMappingURL=firebase.js.map