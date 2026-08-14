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

    const response = await this.fetchImpl(AMAZON_LWA_TOKEN_URL, {
      method: 'POST',
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

    if (!response.ok) {
      throw new AmazonAuthorizationError();
    }

    const payload = await response.json() as LwaTokenResponse;
    if (!payload.access_token) {
      throw new AmazonAuthorizationError('Amazon did not return an access token');
    }

    const expiresInSeconds = Math.max(payload.expires_in ?? 3600, 120);
    this.accessToken = payload.access_token;
    this.accessTokenExpiresAt = this.now() + (expiresInSeconds - 60) * 1000;

    return this.accessToken;
  }
}

export const amazonLwaTokenService = new AmazonLwaTokenService();
