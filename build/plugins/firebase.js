import fp from 'fastify-plugin';
import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'node:fs';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
function parseServiceAccountFromJson(rawJson) {
    const serviceAccount = JSON.parse(rawJson);
    return {
        projectId: serviceAccount.project_id || serviceAccount.projectId,
        clientEmail: serviceAccount.client_email || serviceAccount.clientEmail,
        privateKey: serviceAccount.private_key || serviceAccount.privateKey,
    };
}
function buildServiceAccountCredential(clientEmail, privateKey, projectId) {
    return cert({
        ...(projectId ? { projectId } : {}),
        clientEmail,
        privateKey: privateKey
            .replace(/\\\r?\n/g, '\n')
            .replace(/\\n/g, '\n')
            .trim(),
    });
}
export function initializeFirebaseAdmin() {
    if (getApps().length > 0) {
        const app = getApps()[0];
        if (!app) {
            return null;
        }
        return { app, messaging: getMessaging(app) };
    }
    try {
        let credential;
        let projectId = env.FIREBASE_PROJECT_ID;
        if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            const serviceAccount = parseServiceAccountFromJson(env.FIREBASE_SERVICE_ACCOUNT_JSON);
            credential = buildServiceAccountCredential(serviceAccount.clientEmail, serviceAccount.privateKey, serviceAccount.projectId);
            projectId = projectId || serviceAccount.projectId;
        }
        else if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
            credential = buildServiceAccountCredential(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY, projectId);
        }
        else if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
            const serviceAccount = parseServiceAccountFromJson(fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
            credential = buildServiceAccountCredential(serviceAccount.clientEmail, serviceAccount.privateKey, serviceAccount.projectId);
            projectId = projectId || serviceAccount.projectId;
        }
        else if (env.GOOGLE_APPLICATION_CREDENTIALS || env.GCP_PROJECT_ID) {
            credential = applicationDefault();
            projectId = projectId || env.GCP_PROJECT_ID;
        }
        if (!credential) {
            logger.warn('Firebase Admin credentials are not configured; push sends will be disabled.');
            return null;
        }
        const app = initializeApp({
            credential,
            ...(projectId ? { projectId } : {}),
        });
        logger.info({ projectId }, 'Firebase Admin initialized for push notifications');
        return { app, messaging: getMessaging(app) };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Firebase Admin initialization error';
        logger.error({ message }, 'Failed to initialize Firebase Admin');
        throw error;
    }
}
async function firebasePlugin(fastify, _options) {
    const firebase = initializeFirebaseAdmin();
    fastify.decorate('firebase', firebase);
}
export default fp(firebasePlugin, {
    name: 'firebase-admin',
});
//# sourceMappingURL=firebase.js.map