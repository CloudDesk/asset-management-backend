import { env } from '../config/env.js';

const AMAZON_LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

type FetchLike = typeof fetch;

type LwaTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

export class AmazonAuthorizationError extends Error {
  readonly statusCode = 401;
  readonly code = 'AMAZON_INVALID_AUTHORIZATION';

  constructor(message = 'Amazon authorization is invalid or has expired') {
    super(message);
    this.name = 'AmazonAuthorizationError';
  }
}

export class AmazonTokenRequestError extends Error {
  constructor(message: string, readonly statusCode: number, readonly code: string) {
    super(message);
    this.name = 'AmazonTokenRequestError';
  }
}

export interface AmazonAccessTokenProvider {
  getAccessToken(): Promise<string>;
  invalidate(): void;
}

type AmazonLwaTokenServiceOptions = {
  fetchImpl?: FetchLike;
  now?: () => number;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
};

export class AmazonLwaTokenService implements AmazonAccessTokenProvider {
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly configuredClientId: string | undefined;
  private readonly configuredClientSecret: string | undefined;
  private readonly configuredRefreshToken: string | undefined;
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private pendingExchange: Promise<string> | null = null;

  constructor(options: AmazonLwaTokenServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.configuredClientId = options.clientId;
    this.configuredClientSecret = options.clientSecret;
    this.configuredRefreshToken = options.refreshToken;
  }

  invalidate(): void {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.pendingExchange) {
      this.pendingExchange = this.exchangeRefreshToken().finally(() => {
        this.pendingExchange = null;
      });
    }

    return this.pendingExchange;
  }

  private requiredCredential(name: string, value?: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new AmazonAuthorizationError(`${name} is not configured on the backend`);
    }
    if (/\s/.test(normalized)) throw new AmazonAuthorizationError(`${name} contains invalid whitespace`);
    return normalized;
  }

  private async exchangeRefreshToken(): Promise<string> {
    const clientId = this.requiredCredential(
      'AMAZON_CLIENT_ID',
      this.configuredClientId ?? env.AMAZON_CLIENT_ID
    );
    const clientSecret = this.requiredCredential(
      'AMAZON_CLIENT_SECRET',
      this.configuredClientSecret ?? env.AMAZON_CLIENT_SECRET
    );
    const refreshToken = this.requiredCredential(
      'AMAZON_REFRESH_TOKEN',
      this.configuredRefreshToken ?? env.AMAZON_REFRESH_TOKEN
    );

    let response: Response;
    try {
      response = await this.fetchImpl(AMAZON_LWA_TOKEN_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
    } catch {
      throw new AmazonTokenRequestError('Could not reach Amazon authorization. Try again shortly.',
        502, 'AMAZON_AUTH_NETWORK_ERROR');
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: unknown; error_description?: unknown } | null;
      let detail = [payload?.error, payload?.error_description]
        .filter((value): value is string => typeof value === 'string').join(': ');
      for (const secret of [clientId, clientSecret, refreshToken]) {
        for (const value of [secret, encodeURIComponent(secret), new URLSearchParams({ value: secret }).toString().slice(6)]) {
          if (value.length >= 4) detail = detail.split(value).join('[redacted]');
        }
      }
      detail = detail.slice(0, 500);
      const reason = detail ? ` (${detail})` : '';
      if (response.status === 429 || response.status >= 500) {
        throw new AmazonTokenRequestError(`Amazon authorization is temporarily unavailable. Try again shortly.${reason}`,
          response.status, 'AMAZON_AUTH_TEMPORARILY_UNAVAILABLE');
      }
      if (response.status === 401 || response.status === 403
        || payload?.error === 'invalid_grant' || payload?.error === 'invalid_client') {
        throw new AmazonAuthorizationError(`Amazon rejected the configured credentials. Check the selected credential source and reconnect if needed.${reason}`);
      }
      throw new AmazonTokenRequestError(`Amazon rejected the token request.${reason}`,
        response.status >= 400 && response.status < 600 ? response.status : 502, 'AMAZON_AUTH_REQUEST_FAILED');
    }

    const payload = await response.json().catch(() => null) as LwaTokenResponse | null;
    if (!payload || typeof payload.access_token !== 'string' || !payload.access_token.trim()) {
      throw new AmazonTokenRequestError('Amazon returned an invalid token response. Try again shortly.',
        502, 'AMAZON_AUTH_INVALID_RESPONSE');
    }

    const expiresInSeconds = typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in)
      ? Math.max(payload.expires_in, 120) : 3600;
    this.accessToken = payload.access_token;
    this.accessTokenExpiresAt = this.now() + (expiresInSeconds - 60) * 1000;

    return this.accessToken;
  }
}

export const amazonLwaTokenService = new AmazonLwaTokenService();
