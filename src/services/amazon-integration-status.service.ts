import { env } from '../config/env.js';

export type AmazonIntegrationStatus = {
  production: {
    environment: 'PRODUCTION';
    connectionType: 'ENVIRONMENT_VARIABLES';
    status: 'CONFIGURED' | 'DISABLED' | 'INCOMPLETE';
    sellerId: string | null;
    marketplaceId: string;
    listingImportEnabled: boolean;
    productionWritesEnabled: boolean;
    accessMode: 'READ_ONLY';
    missingConfiguration: string[];
  };
  sandbox: {
    environment: 'SANDBOX';
    connectionType: 'ENVIRONMENT_VARIABLES';
    status: 'CONFIGURED' | 'INCOMPLETE';
    marketplaceId: string;
    credentialSource: 'SANDBOX' | 'PRODUCTION';
    missingConfiguration: string[];
  };
  oauth: {
    status: 'AVAILABLE' | 'NOT_CONFIGURED';
    missingConfiguration: string[];
  };
};

type AmazonStatusConfig = {
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  refreshToken?: string | undefined;
  sellerId?: string | undefined;
  marketplaceId: string;
  listingImportEnabled: boolean;
  productionWritesEnabled: boolean;
  sandboxCredentialSource: 'SANDBOX' | 'PRODUCTION';
  sandboxClientId?: string | undefined;
  sandboxClientSecret?: string | undefined;
  sandboxRefreshToken?: string | undefined;
  appId?: string | undefined;
  redirectUri?: string | undefined;
  tokenEncryptionKey?: string | undefined;
};

const missingKeys = (entries: Array<[string, string | undefined]>) => entries
  .filter(([, value]) => !value?.trim())
  .map(([name]) => name);

export const buildAmazonIntegrationStatus = (
  config: AmazonStatusConfig
): AmazonIntegrationStatus => {
  const productionMissing = missingKeys([
    ['client ID', config.clientId],
    ['client secret', config.clientSecret],
    ['refresh token', config.refreshToken],
    ['seller ID', config.sellerId],
  ]);

  const sandboxCredentials = config.sandboxCredentialSource === 'PRODUCTION'
    ? {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        refreshToken: config.refreshToken,
      }
    : {
        clientId: config.sandboxClientId,
        clientSecret: config.sandboxClientSecret,
        refreshToken: config.sandboxRefreshToken,
      };
  const sandboxMissing = missingKeys([
    ['client ID', sandboxCredentials.clientId],
    ['client secret', sandboxCredentials.clientSecret],
    ['refresh token', sandboxCredentials.refreshToken],
  ]);
  const oauthMissing = missingKeys([
    ['client ID', config.clientId],
    ['client secret', config.clientSecret],
    ['SP-API application ID', config.appId],
    ['OAuth redirect URI', config.redirectUri],
    ['token encryption key', config.tokenEncryptionKey],
  ]);

  return {
    production: {
      environment: 'PRODUCTION',
      connectionType: 'ENVIRONMENT_VARIABLES',
      status: productionMissing.length > 0
        ? 'INCOMPLETE'
        : config.listingImportEnabled
          ? 'CONFIGURED'
          : 'DISABLED',
      sellerId: config.sellerId?.trim() || null,
      marketplaceId: config.marketplaceId,
      listingImportEnabled: config.listingImportEnabled,
      // Phase 1 never advertises write access, even if a deployment flag is set.
      productionWritesEnabled: false,
      accessMode: 'READ_ONLY',
      missingConfiguration: productionMissing,
    },
    sandbox: {
      environment: 'SANDBOX',
      connectionType: 'ENVIRONMENT_VARIABLES',
      status: sandboxMissing.length === 0 ? 'CONFIGURED' : 'INCOMPLETE',
      marketplaceId: config.marketplaceId,
      credentialSource: config.sandboxCredentialSource,
      missingConfiguration: sandboxMissing,
    },
    oauth: {
      status: oauthMissing.length === 0 ? 'AVAILABLE' : 'NOT_CONFIGURED',
      missingConfiguration: oauthMissing,
    },
  };
};

export const getAmazonIntegrationStatus = (): AmazonIntegrationStatus =>
  buildAmazonIntegrationStatus({
    clientId: env.AMAZON_CLIENT_ID,
    clientSecret: env.AMAZON_CLIENT_SECRET,
    refreshToken: env.AMAZON_REFRESH_TOKEN,
    sellerId: env.AMAZON_SELLER_ID,
    marketplaceId: env.AMAZON_MARKETPLACE_ID,
    listingImportEnabled: env.AMAZON_LISTING_IMPORT_ENABLED,
    productionWritesEnabled: env.AMAZON_PRODUCTION_WRITES_ENABLED,
    sandboxCredentialSource: env.AMAZON_SANDBOX_CREDENTIAL_SOURCE,
    sandboxClientId: env.AMAZON_SANDBOX_CLIENT_ID,
    sandboxClientSecret: env.AMAZON_SANDBOX_CLIENT_SECRET,
    sandboxRefreshToken: env.AMAZON_SANDBOX_REFRESH_TOKEN,
    appId: env.AMAZON_SP_API_APP_ID,
    redirectUri: env.AMAZON_REDIRECT_URI,
    tokenEncryptionKey: env.AMAZON_TOKEN_ENCRYPTION_KEY,
  });
