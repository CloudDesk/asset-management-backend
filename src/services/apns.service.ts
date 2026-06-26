import { connect, constants as http2Constants } from 'node:http2';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { normalizePemPrivateKey } from '../utils/privateKey.js';

type ApnsPushPayload = {
  title: string;
  body: string;
  data?: Record<string, string> | undefined;
};

type ApnsSendResult = {
  sent: number;
  failed: number;
  invalidTokens: string[];
};

type ApnsResponse = {
  success: boolean;
  statusCode: number;
  reason?: string | undefined;
  invalidToken: boolean;
  trySandbox: boolean;
};

const APNS_PRODUCTION_URL = 'https://api.push.apple.com';
const APNS_SANDBOX_URL = 'https://api.sandbox.push.apple.com';
const APNS_JWT_LIFETIME_SECONDS = 50 * 60;
const INVALID_APNS_REASONS = new Set([
  'BadDeviceToken',
  'DeviceTokenNotForTopic',
  'Unregistered',
]);

export class ApnsService {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  isConfigured(): boolean {
    return Boolean(
      (env.APNS_AUTH_KEY || env.APNS_AUTH_KEY_PATH) &&
      env.APNS_KEY_ID &&
      env.APNS_TEAM_ID &&
      env.APNS_BUNDLE_ID
    );
  }

  async sendToTokens(tokens: string[], payload: ApnsPushPayload): Promise<ApnsSendResult> {
    if (tokens.length === 0) {
      return { sent: 0, failed: 0, invalidTokens: [] };
    }

    if (!this.isConfigured()) {
      throw new Error('APNs is not configured');
    }

    const authToken = this.getAuthToken();
    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (const token of tokens) {
      const productionResponse = await this.sendSingle({
        token,
        payload,
        authToken,
        baseUrl: APNS_PRODUCTION_URL,
      });

      if (productionResponse.success) {
        sent += 1;
        continue;
      }

      if (productionResponse.trySandbox) {
        const sandboxResponse = await this.sendSingle({
          token,
          payload,
          authToken,
          baseUrl: APNS_SANDBOX_URL,
        });

        if (sandboxResponse.success) {
          sent += 1;
          continue;
        }

        failed += 1;
        if (sandboxResponse.invalidToken) {
          invalidTokens.push(token);
        }
        continue;
      }

      failed += 1;
      if (productionResponse.invalidToken) {
        invalidTokens.push(token);
      }
    }

    return { sent, failed, invalidTokens };
  }

  private getAuthToken(): string {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (this.cachedToken && this.cachedToken.expiresAt > nowSeconds + 60) {
      return this.cachedToken.token;
    }

    const authKey = env.APNS_AUTH_KEY;
    const authKeyPath = env.APNS_AUTH_KEY_PATH;
    const keyId = env.APNS_KEY_ID;
    const teamId = env.APNS_TEAM_ID;

    if ((!authKey && !authKeyPath) || !keyId || !teamId) {
      throw new Error('Missing APNs authentication credentials');
    }
    const privateKey = authKey
      ? normalizePemPrivateKey(authKey)
      : normalizePemPrivateKey(
          fs.readFileSync(
            path.isAbsolute(authKeyPath as string)
              ? (authKeyPath as string)
              : path.resolve(process.cwd(), authKeyPath as string),
            'utf8'
          )
        );
    const token = jwt.sign(
      {},
      privateKey,
      {
        algorithm: 'ES256',
        issuer: teamId,
        header: {
          alg: 'ES256',
          kid: keyId,
        },
      }
    );

    this.cachedToken = {
      token,
      expiresAt: nowSeconds + APNS_JWT_LIFETIME_SECONDS,
    };

    return token;
  }

  private buildPayload(payload: ApnsPushPayload) {
    return JSON.stringify({
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: 'default',
      },
      ...(payload.data || {}),
    });
  }

  private async sendSingle({
    token,
    payload,
    authToken,
    baseUrl,
  }: {
    token: string;
    payload: ApnsPushPayload;
    authToken: string;
    baseUrl: string;
  }): Promise<ApnsResponse> {
    const topic = env.APNS_BUNDLE_ID;
    if (!topic) {
      throw new Error('APNS_BUNDLE_ID is not configured');
    }

    const body = this.buildPayload(payload);
    const session = connect(baseUrl);

    try {
      return await new Promise<ApnsResponse>((resolve, reject) => {
        session.on('error', (error) => {
          reject(error);
        });

        const request = session.request({
          [http2Constants.HTTP2_HEADER_SCHEME]: 'https',
          [http2Constants.HTTP2_HEADER_METHOD]: 'POST',
          [http2Constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
          authorization: `bearer ${authToken}`,
          'apns-topic': topic,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'content-type': 'application/json',
        });

        let responseBody = '';
        let statusCode = 0;

        request.setEncoding('utf8');

        request.on('response', (headers) => {
          statusCode = Number(headers[http2Constants.HTTP2_HEADER_STATUS] || 0);
        });

        request.on('data', (chunk) => {
          responseBody += chunk;
        });

        request.on('error', (error) => {
          reject(error);
        });

        request.on('end', () => {
          let reason: string | undefined;

          if (responseBody) {
            try {
              const parsed = JSON.parse(responseBody) as { reason?: string };
              reason = parsed.reason;
            } catch (error) {
              logger.warn({ error, responseBody }, 'Unable to parse APNs response body');
            }
          }

          const invalidToken = Boolean(reason && INVALID_APNS_REASONS.has(reason));
          const trySandbox = statusCode === 400 && reason === 'BadDeviceToken' && baseUrl === APNS_PRODUCTION_URL;

          if (statusCode >= 200 && statusCode < 300) {
            resolve({
              success: true,
              statusCode,
              invalidToken: false,
              trySandbox: false,
            });
            return;
          }

          logger.warn(
            { tokenSuffix: token.slice(-8), statusCode, reason, baseUrl },
            'APNs notification send failed'
          );

          resolve({
            success: false,
            statusCode,
            reason,
            invalidToken,
            trySandbox,
          });
        });

        request.end(body);
      });
    } finally {
      session.close();
    }
  }
}
