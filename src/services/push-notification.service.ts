import { Prisma } from '@prisma/client';
import { getApps } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { initializeFirebaseAdmin } from '../plugins/firebase.js';
import { ApnsService } from './apns.service.js';
import {
  RegisterPushTokenInput,
  SendTestPushInput,
  UnregisterPushTokenInput,
} from '../schemas/push-notification.schema.js';

type PushUser = {
  id: number;
  userType?: 'inventory' | 'ecommerce';
};

type PushDeviceRow = {
  id: number;
  userid: number | null;
  inventoryuserid: number | null;
  usertype: string;
  token: string;
  platform: string;
  provider: string;
  deviceid: string | null;
  appversion: string | null;
  buildnumber: string | null;
  permissionstatus: string | null;
  isactive: boolean;
  failurecount: number;
  createddate: bigint | number | null;
  modifieddate: bigint | number | null;
  lastseenat: bigint | number | null;
  disabledat: bigint | number | null;
};

type PushTarget = {
  token: string;
  provider: string;
  platform: string;
};

type SendPushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  url?: string;
};

const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

function stringifyData(
  data?: Record<string, string | number | boolean>,
  url?: string
): Record<string, string> {
  const normalizedData: Record<string, string> = {};

  Object.entries(data || {}).forEach(([key, value]) => {
    normalizedData[key] = String(value);
  });

  if (url) {
    normalizedData.url = url;
  }

  return normalizedData;
}

export class PushNotificationService {
  private apnsService = new ApnsService();

  async registerDeviceToken(user: PushUser, input: RegisterPushTokenInput) {
    const now = Date.now();
    const userType = user.userType || 'ecommerce';
    const userId = userType === 'ecommerce' ? user.id : null;
    const inventoryUserId = userType === 'inventory' ? user.id : null;

    const rows = await prisma.$queryRaw<PushDeviceRow[]>`
      INSERT INTO "push_devices" (
        "userid",
        "inventoryuserid",
        "usertype",
        "token",
        "platform",
        "provider",
        "deviceid",
        "appversion",
        "buildnumber",
        "permissionstatus",
        "isactive",
        "createddate",
        "modifieddate",
        "lastseenat",
        "disabledat",
        "failurecount"
      )
      VALUES (
        ${userId},
        ${inventoryUserId},
        ${userType},
        ${input.token},
        ${input.platform},
        ${input.provider},
        ${input.deviceId ?? null},
        ${input.appVersion ?? null},
        ${input.buildNumber ?? null},
        ${input.permissionStatus ?? null},
        TRUE,
        ${now},
        ${now},
        ${now},
        NULL,
        0
      )
      ON CONFLICT ("token") DO UPDATE SET
        "userid" = EXCLUDED."userid",
        "inventoryuserid" = EXCLUDED."inventoryuserid",
        "usertype" = EXCLUDED."usertype",
        "platform" = EXCLUDED."platform",
        "provider" = EXCLUDED."provider",
        "deviceid" = EXCLUDED."deviceid",
        "appversion" = EXCLUDED."appversion",
        "buildnumber" = EXCLUDED."buildnumber",
        "permissionstatus" = EXCLUDED."permissionstatus",
        "isactive" = TRUE,
        "modifieddate" = EXCLUDED."modifieddate",
        "lastseenat" = EXCLUDED."lastseenat",
        "disabledat" = NULL,
        "failurecount" = 0
      RETURNING *
    `;

    if (input.provider === 'fcm') {
      await this.updateLegacyFcmId(user, input.token);
    }

    logger.info(
      { userId: user.id, userType, platform: input.platform, provider: input.provider },
      'Push token registered'
    );

    return rows[0] || null;
  }

  async unregisterDeviceToken(user: PushUser, input: UnregisterPushTokenInput) {
    const now = Date.now();
    const userType = user.userType || 'ecommerce';
    const userIdColumn = userType === 'ecommerce' ? 'userid' : 'inventoryuserid';
    const predicates = [
      Prisma.sql`"usertype" = ${userType}`,
      Prisma.sql`${Prisma.raw(`"${userIdColumn}"`)} = ${user.id}`,
    ];

    if (input.token) {
      predicates.push(Prisma.sql`"token" = ${input.token}`);
    }

    if (input.deviceId) {
      predicates.push(Prisma.sql`"deviceid" = ${input.deviceId}`);
    }

    const whereClause = Prisma.join(predicates, ' AND ');

    const rows = await prisma.$queryRaw<PushDeviceRow[]>(
      Prisma.sql`
        UPDATE "push_devices"
        SET "isactive" = FALSE,
            "disabledat" = ${now},
            "modifieddate" = ${now}
        WHERE ${whereClause}
        RETURNING *
      `
    );

    if (input.token) {
      await this.clearLegacyFcmId(user, input.token);
    }

    logger.info(
      { userId: user.id, userType, disabledCount: rows.length },
      'Push token unregistered'
    );

    return { disabledCount: rows.length };
  }

  async sendTestNotification(user: PushUser, input: SendTestPushInput) {
    const userType = user.userType || 'ecommerce';
    const targets = await this.getActiveTargetsForUser(user);

    if (targets.length === 0) {
      return {
        sent: 0,
        failed: 0,
        invalidTokens: 0,
        message: 'No active push devices registered for this user',
      };
    }

    const result = await this.sendToTargets(targets, {
      title: input.title,
      body: input.body,
      data: stringifyData(input.data, input.url),
    });

    logger.info(
      { userId: user.id, userType, tokenCount: targets.length, result },
      'Test push notification sent'
    );

    return result;
  }

  async sendToUser(user: PushUser, payload: SendPushPayload) {
    const targets = await this.getActiveTargetsForUser(user);
    return this.sendToTargets(targets, payload);
  }

  private async getActiveTargetsForUser(user: PushUser): Promise<PushTarget[]> {
    const userType = user.userType || 'ecommerce';
    const userIdColumn = userType === 'ecommerce' ? 'userid' : 'inventoryuserid';

    const rows = await prisma.$queryRaw<PushTarget[]>(
      Prisma.sql`
        SELECT "token", "provider", "platform"
        FROM "push_devices"
        WHERE "usertype" = ${userType}
          AND ${Prisma.raw(`"${userIdColumn}"`)} = ${user.id}
          AND "isactive" = TRUE
      `
    );

    return rows.filter((row) => Boolean(row.token));
  }

  private async sendToTargets(targets: PushTarget[], payload: SendPushPayload) {
    if (targets.length === 0) {
      return { sent: 0, failed: 0, invalidTokens: 0 };
    }

    const payloadData = payload.url
      ? {
          ...(payload.data || {}),
          url: payload.url,
        }
      : (payload.data || {});

    const fcmTokens = targets
      .filter((target) => target.provider === 'fcm')
      .map((target) => target.token);
    const apnsTokens = targets
      .filter((target) => target.provider === 'apns')
      .map((target) => target.token);

    logger.info(
      {
        title: payload.title,
        body: payload.body,
        url: payload.url,
        payloadData,
        targetCount: targets.length,
        fcmCount: fcmTokens.length,
        apnsCount: apnsTokens.length,
      },
      'Sending push notification payload'
    );

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    if (fcmTokens.length > 0) {
      const fcmResult = await this.sendFcmTokens(fcmTokens, {
        ...payload,
        data: payloadData,
      });
      sent += fcmResult.sent;
      failed += fcmResult.failed;
      invalidTokens.push(...fcmResult.invalidTokens);
    }

    if (apnsTokens.length > 0) {
      const apnsResult = await this.apnsService.sendToTokens(apnsTokens, {
        title: payload.title,
        body: payload.body,
        data: payloadData,
      });
      sent += apnsResult.sent;
      failed += apnsResult.failed;
      invalidTokens.push(...apnsResult.invalidTokens);
    }

    if (invalidTokens.length > 0) {
      await this.disableInvalidTokens(invalidTokens);
    }

    return {
      sent,
      failed,
      invalidTokens: invalidTokens.length,
    };
  }

  private async sendFcmTokens(tokens: string[], payload: SendPushPayload) {
    const firebase = initializeFirebaseAdmin();
    const app = firebase?.app || getApps()[0];

    if (!app) {
      throw new Error('Firebase Admin is not configured');
    }

    const messaging = firebase?.messaging || getMessaging(app);
    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (let index = 0; index < tokens.length; index += 500) {
      const tokenChunk = tokens.slice(index, index + 500);
      const message: MulticastMessage = {
        tokens: tokenChunk,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            clickAction: 'OPEN_APP',
          },
        },
      };

      const response = await messaging.sendEachForMulticast(message);
      sent += response.successCount;
      failed += response.failureCount;

      response.responses.forEach((sendResponse, responseIndex) => {
        const token = tokenChunk[responseIndex];
        if (!sendResponse.success && token) {
          const errorCode = sendResponse.error?.code;
          if (errorCode && INVALID_TOKEN_ERROR_CODES.has(errorCode)) {
            invalidTokens.push(token);
          }
        }
      });
    }

    return {
      sent,
      failed,
      invalidTokens,
    };
  }

  private async disableInvalidTokens(tokens: string[]) {
    const now = Date.now();

    await prisma.$executeRaw`
      UPDATE "push_devices"
      SET "isactive" = FALSE,
          "disabledat" = ${now},
          "modifieddate" = ${now},
          "failurecount" = "failurecount" + 1
      WHERE "token" IN (${Prisma.join(tokens)})
    `;
  }

  private async updateLegacyFcmId(user: PushUser, token: string) {
    if ((user.userType || 'ecommerce') === 'inventory') {
      await prisma.$executeRaw`
        UPDATE "inventoryusers"
        SET "fcmid" = ${token}, "modifieddate" = ${Date.now()}
        WHERE "id" = ${user.id}
      `;
      return;
    }

    await prisma.$executeRaw`
      UPDATE "users"
      SET "fcmid" = ${token}, "modifieddate" = ${Date.now()}
      WHERE "id" = ${user.id}
    `;
  }

  private async clearLegacyFcmId(user: PushUser, token: string) {
    if ((user.userType || 'ecommerce') === 'inventory') {
      await prisma.$executeRaw`
        UPDATE "inventoryusers"
        SET "fcmid" = NULL, "modifieddate" = ${Date.now()}
        WHERE "id" = ${user.id} AND "fcmid" = ${token}
      `;
      return;
    }

    await prisma.$executeRaw`
      UPDATE "users"
      SET "fcmid" = NULL, "modifieddate" = ${Date.now()}
      WHERE "id" = ${user.id} AND "fcmid" = ${token}
    `;
  }
}
