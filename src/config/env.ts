import "dotenv/config";
import { z } from "zod";
import { validatePemPrivateKey } from "../utils/privateKey.js";

const STATIC_OTP_ENVIRONMENT_MARKERS = [
  "sit",
  "dev",
  "development",
  "test",
  "staging",
  "sandbox",
];
const REQUIRED_EXOTEL_ENV_VARS = [
  "EXOTEL_ACCOUNT_SID",
  "EXOTEL_API_KEY",
  "EXOTEL_API_TOKEN",
  "EXOTEL_SENDER_ID",
] as const;
const REQUIRED_FIREBASE_DIRECT_PUSH_ENV_VARS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;
const REQUIRED_APNS_IDENTITY_PUSH_ENV_VARS = [
  "APNS_KEY_ID",
  "APNS_TEAM_ID",
  "APNS_BUNDLE_ID",
] as const;
const DISALLOWED_PRODUCTION_PUSH_PATH_ENV_VARS = [
  "FIREBASE_SERVICE_ACCOUNT_PATH",
  "APNS_AUTH_KEY_PATH",
] as const;

type StaticOtpEnvironmentConfig = {
  USER_OTP?: string | undefined;
  NODE_ENV?: string | undefined;
  APP_ENV?: string | undefined;
  ENVIRONMENT?: string | undefined;
  DEPLOY_ENV?: string | undefined;
  STAGE?: string | undefined;
  K_SERVICE?: string | undefined;
  API_BASE_URL?: string | undefined;
  REDIRECT_INVENTORY_URL?: string | undefined;
  GCP_TASK_URL?: string | undefined;
  GCP_PROJECT_QUEUE?: string | undefined;
  STORAGE_BACKEND_URL?: string | undefined;
};

type ExotelEnvironmentConfig = Partial<
  Record<(typeof REQUIRED_EXOTEL_ENV_VARS)[number], string | undefined>
>;

function isStaticOtpEnvironment(data: StaticOtpEnvironmentConfig) {
  if (!data.USER_OTP) {
    return false;
  }

  const environmentSignals = [
    data.NODE_ENV,
    data.APP_ENV,
    data.ENVIRONMENT,
    data.DEPLOY_ENV,
    data.STAGE,
    data.K_SERVICE,
    data.API_BASE_URL,
    data.REDIRECT_INVENTORY_URL,
    data.GCP_TASK_URL,
    data.GCP_PROJECT_QUEUE,
    data.STORAGE_BACKEND_URL,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return (
    data.NODE_ENV !== "production" ||
    STATIC_OTP_ENVIRONMENT_MARKERS.some((marker) =>
      environmentSignals.includes(marker),
    )
  );
}

function validateExotelConfig(
  data: StaticOtpEnvironmentConfig & ExotelEnvironmentConfig,
) {
  if (isStaticOtpEnvironment(data)) {
    return;
  }

  const missingVars = REQUIRED_EXOTEL_ENV_VARS.filter((key) => !data[key]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Exotel environment variables: ${missingVars.join(", ")}. ` +
        "Set them, or configure USER_OTP for a non-production environment.",
    );
  }
}

function getEnvConfigValue(data: object, key: string) {
  const value = (data as Record<string, unknown>)[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function validatePrivateKeyEnvValue(key: string, value: string) {
  const errors: string[] = [];
  const normalizedValue = value
    .replace(/\\\r?\n/g, "\n")
    .replace(/\\n/g, "\n")
    .trim();

  if (value.includes("/n")) {
    errors.push(`${key} contains /n; use escaped newlines as \\n`);
  }

  if (!normalizedValue.includes("\n")) {
    errors.push(`${key} must contain escaped newlines as \\n`);
  }

  if (
    !normalizedValue.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !normalizedValue.endsWith("-----END PRIVATE KEY-----")
  ) {
    errors.push(`${key} must be a PEM private key`);
  }

  return errors;
}

function validatePushNotificationConfig(data: object) {
  const isProduction = getEnvConfigValue(data, 'NODE_ENV') === 'production';
  const hasFirebaseDirectConfig = Boolean(
    getEnvConfigValue(data, 'FIREBASE_CLIENT_EMAIL') ||
    getEnvConfigValue(data, 'FIREBASE_PRIVATE_KEY')
  );
  const hasFirebaseServiceAccountJson = Boolean(getEnvConfigValue(data, 'FIREBASE_SERVICE_ACCOUNT_JSON'));
  const hasFirebaseServiceAccountPath = Boolean(getEnvConfigValue(data, 'FIREBASE_SERVICE_ACCOUNT_PATH'));
  const hasFirebaseDirectCompleteConfig = REQUIRED_FIREBASE_DIRECT_PUSH_ENV_VARS.every((key) =>
    Boolean(getEnvConfigValue(data, key))
  );
  const hasApnsAuthKey = Boolean(getEnvConfigValue(data, 'APNS_AUTH_KEY'));
  const hasApnsAuthKeyPath = Boolean(getEnvConfigValue(data, 'APNS_AUTH_KEY_PATH'));
  const hasApnsIdentityConfig = REQUIRED_APNS_IDENTITY_PUSH_ENV_VARS.some((key) =>
    Boolean(getEnvConfigValue(data, key))
  );

  const missingVars: string[] = [];
  const validationErrors: string[] = [];

  if (isProduction) {
    if (!hasFirebaseServiceAccountJson && !hasFirebaseDirectCompleteConfig) {
      missingVars.push('FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY');
    }
  } else if (hasFirebaseDirectConfig && !hasFirebaseServiceAccountJson && !hasFirebaseServiceAccountPath) {
    missingVars.push(
      ...REQUIRED_FIREBASE_DIRECT_PUSH_ENV_VARS.filter(
        (key) => !getEnvConfigValue(data, key),
      ),
    );
  }

  if (isProduction || hasApnsAuthKey || hasApnsAuthKeyPath || hasApnsIdentityConfig) {
    const hasUsableApnsAuthKey = hasApnsAuthKey || (!isProduction && hasApnsAuthKeyPath);
    if (!hasUsableApnsAuthKey) {
      missingVars.push(isProduction ? 'APNS_AUTH_KEY' : 'APNS_AUTH_KEY or APNS_AUTH_KEY_PATH');
    }
    missingVars.push(
      ...REQUIRED_APNS_IDENTITY_PUSH_ENV_VARS.filter(
        (key) => !getEnvConfigValue(data, key),
      ),
    );
  }

  if (isProduction) {
    const pathVars = DISALLOWED_PRODUCTION_PUSH_PATH_ENV_VARS.filter((key) =>
      Boolean(getEnvConfigValue(data, key)),
    );
    if (pathVars.length > 0) {
      validationErrors.push(
        `Do not use path-based push credential variables in production: ${pathVars.join(", ")}. ` +
          "Use backend-only environment variables or Secret Manager values instead.",
      );
    }
  }

  const firebasePrivateKey = getEnvConfigValue(data, "FIREBASE_PRIVATE_KEY");
  if (firebasePrivateKey) {
    validationErrors.push(
      ...validatePemPrivateKey("FIREBASE_PRIVATE_KEY", firebasePrivateKey),
    );
  }

  const apnsAuthKey = getEnvConfigValue(data, "APNS_AUTH_KEY");
  if (apnsAuthKey) {
    validationErrors.push(
      ...validatePemPrivateKey("APNS_AUTH_KEY", apnsAuthKey),
    );
  }

  if (missingVars.length > 0) {
    validationErrors.unshift(
      `Missing required push notification environment variables: ${missingVars.join(", ")}`,
    );
  }

  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join("; "));
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default("8080"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_ENV: z.string().optional(),
  ENVIRONMENT: z.string().optional(),
  DEPLOY_ENV: z.string().optional(),
  STAGE: z.string().optional(),
  K_SERVICE: z.string().optional(),

  // JWT Secret for app sessions
  APP_JWT_SECRET: z
    .string()
    .default("your-secret-key-change-this-in-production"),
  JWT_SECRET: z.string().optional(), // Alias for APP_JWT_SECRET
  JWT_ACCESS_TOKEN_EXPIRY: z.string().optional().default("24h"), // Access token expiry (e.g., '24h', '1h', '30m')
  JWT_REFRESH_TOKEN_EXPIRY: z.string().optional().default("7d"), // Refresh token expiry (e.g., '7d', '30d')
  JWT_REFRESH_ON_USE: z.string().optional().default("true"), // Extend refresh token on use (sliding expiry)

  // Twilio Configuration (required for OTP SMS - kept for backward compatibility)
  TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID is required"),
  TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN is required"),
  TWILIO_PHONE_NUMBER: z.string().min(1, "TWILIO_PHONE_NUMBER is required"),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

  // Exotel Configuration (required unless SIT/static USER_OTP is enabled)
  EXOTEL_ACCOUNT_SID: z.string().optional(),
  EXOTEL_API_KEY: z.string().optional(),
  EXOTEL_API_TOKEN: z.string().optional(),
  EXOTEL_SUBDOMAIN: z.string().optional().default("api"),
  EXOTEL_SENDER_ID: z.string().optional(),
  EXOTEL_DLT_TEMPLATE_ID: z.string().optional(),
  EXOTEL_ENTITY_ID: z.string().optional(),

  // Redis Configuration (required for OTP storage)
  // Use either REDIS_URL or REDIS_HOST+REDIS_PORT+REDIS_PASSWORD
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_USERNAME: z.string().optional().default("default"),
  REDIS_EMAIL_OTPEXPSEC: z.string().optional().default("300"),
  REDIS_SESSIONEXSEC: z.string().optional().default("3600"),

  // GCP Configuration
  GCP_PROJECT_ID: z.string().optional(),
  GCP_PROJECT_LOCATION: z.string().optional(),
  GCP_PROJECT_QUEUE: z.string().optional(),
  GCP_TASK_URL: z.string().optional(),
  GCP_STORAGE_BUCKET: z.string().optional(),
  CATEGORY_IMAGES_BUCKET: z.string().optional(),
  RETURN_REPLACEMENT_BUCKET: z.string().optional(),
  RETURN_EVIDENCE_BUCKET: z.string().optional(),
  SHIPPING_BUCKET: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  APNS_AUTH_KEY: z.string().optional(),
  APNS_AUTH_KEY_PATH: z.string().optional(),
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_BUNDLE_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  // GCP Storage Backend (server 4500) - for file uploads
  STORAGE_BACKEND_URL: z.string().optional().default("http://localhost:4500"),
  STORAGE_API_KEY: z.string().min(16).optional(),

  // Email Configuration
  GMAIL_SERVICE: z.string().optional().default("gmail"),
  GMAIL_HOST: z.string().optional().default("smtp.gmail.com"),
  GMAIL_PORT: z.string().optional().default("465"),
  GMAIL_AUTH_USER: z.string().optional(),
  GMAIL_AUTH_PASSWORD: z.string().optional(),

  // PostgreSQL Configuration (alternative to DATABASE_URL)
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PORT: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DATABASE: z.string().optional(),
  POSTGRESS_QUERY_API: z.string().optional(),

  // PhonePe Configuration
  PHONEPE_AUTH_MODE: z.string().optional().default("legacy"),
  PHONEPE_CLIENT_ID: z.string().optional(),
  PHONEPE_CLIENT_SECRET: z.string().optional(),
  PHONEPE_CLIENT_VERSION: z.string().optional().default("1"),
  PHONEPE_OAUTH_URL: z.string().optional(),

  // API Configuration
  API_BASE_URL: z.string().optional(),
  REDIRECT_URL_PAYMENT_STATUS: z.string().optional(),
  REDIRECT_URL_SUCCESS: z.string().optional(),
  REDIRECT_URL_FAILURE: z.string().optional(),
  REDIRECT_INVENTORY_URL: z.string().optional(),

  // Optional OTP Configuration (has defaults)
  OTP_EXPIRY_SECONDS: z.string().optional().default("60"),
  OTP_MAX_ATTEMPTS: z.string().optional().default("3"),
  RATE_LIMIT_SEND_MAX: z.string().optional().default("3"),
  RATE_LIMIT_SEND_WINDOW: z.string().optional().default("900"),
  RATE_LIMIT_VERIFY_MAX: z.string().optional().default("5"),
  RATE_LIMIT_VERIFY_WINDOW: z.string().optional().default("3600"),
  BLOCK_DURATION: z.string().optional().default("3600"),
  USER_OTP: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z
      .string()
      .trim()
      .regex(/^\d{4}$/, "USER_OTP must be exactly 4 digits")
      .optional(),
  ),

  // Amazon SP-API Configuration (Global keys - change values for sandbox/production)
  AMAZON_INTEGRATION_ENABLED: z.enum(['true', 'false']).optional().default('true').transform((value) => value === 'true'),
  AMAZON_CLIENT_ID: z.string().optional(),
  AMAZON_CLIENT_SECRET: z.string().optional(),
  AMAZON_SP_API_APP_ID: z.string().optional(),
  AMAZON_OAUTH_VERSION: z.enum(['beta']).optional(),
  AMAZON_REFRESH_TOKEN: z.string().optional(),
  AMAZON_SELLER_ID: z.string().optional(),
  AMAZON_ENVIRONMENT: z.enum(["SANDBOX", "PRODUCTION"]).optional().default("SANDBOX"),
  AMAZON_AUTO_SYNC_ENABLED: z.enum(["true", "false"]).optional().default("false").transform((value) => value === "true"),
  AMAZON_ORDER_AUTO_SYNC_ENABLED: z.enum(["true", "false"]).optional().default("false").transform((value) => value === "true"),
  AMAZON_ORDER_SYNC_CRON: z.string().optional().default("*/15 * * * *"),
  AMAZON_RETURN_AUTO_SYNC_ENABLED: z.enum(["true", "false"]).optional().default("false").transform((value) => value === "true"),
  AMAZON_RETURN_SYNC_CRON: z.string().optional().default("30 2 * * *"),
  AMAZON_LISTING_AUTO_SYNC_ENABLED: z.enum(["true", "false"]).optional().default("false").transform((value) => value === "true"),
  AMAZON_LISTING_SYNC_CRON: z.string().optional().default("0 */6 * * *"),
  AMAZON_RETRY_WORKER_ENABLED: z.enum(["true", "false"]).optional().default("false").transform((value) => value === "true"),
  AMAZON_RETRY_WORKER_CRON: z.string().optional().default("*/5 * * * *"),
  AMAZON_NOTIFICATION_INGEST_SECRET: z.string().trim().min(32).optional(),
  AMAZON_NOTIFICATION_DESTINATION_ID: z.string().trim().optional(),
  AMAZON_NOTIFICATION_SQS_DESTINATION_ID: z.string().trim().optional(),
  AMAZON_NOTIFICATION_EVENTBRIDGE_DESTINATION_ID: z.string().trim().optional(),
  AMAZON_LISTING_IMPORT_ENABLED: z.enum(["true", "false"]).optional().default("false").transform((value) => value === "true"),
  AMAZON_PRODUCTION_WRITES_ENABLED: z.enum(["true", "false"]).optional().default("false").transform((value) => value === "true"),
  // Listing creation remains independently controllable even when other Amazon writes are enabled.
  AMAZON_LISTING_CREATION_ENABLED: z.enum(["true", "false"]).optional().default("false").transform((value) => value === "true"),
  AMAZON_FULL_CATALOG_CREATION_ENABLED: z.enum(["true", "false"]).optional().default("false").transform((value) => value === "true"),
  AMAZON_LISTING_EDIT_ENABLED: z.enum(["true", "false"]).optional().default("false").transform((value) => value === "true"),
  AMAZON_PRODUCTION_SP_API_BASE_URL: z.string().optional().default("https://sellingpartnerapi-eu.amazon.com"),
  AMAZON_LISTING_IMPORT_PAGE_SIZE: z.string().optional().default("20").transform((value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(20, Math.max(1, parsed)) : 20;
  }),
  AMAZON_LISTING_IMPORT_MAX_RETRIES: z.string().optional().default("3").transform((value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(5, Math.max(0, parsed)) : 3;
  }),
  AMAZON_SANDBOX_CREDENTIAL_SOURCE: z.enum(["SANDBOX", "PRODUCTION"]).optional().default("SANDBOX"),
  AMAZON_MARKETPLACE_ID: z.string().optional().default("A21TJRUUN4KGV"), // Fixed for India
  AMAZON_SP_API_BASE_URL: z.string().optional(),
  AMAZON_SANDBOX_CLIENT_ID: z.string().optional(),
  AMAZON_SANDBOX_CLIENT_SECRET: z.string().optional(),
  AMAZON_SANDBOX_REFRESH_TOKEN: z.string().optional(),
  AMAZON_SANDBOX_SP_API_BASE_URL: z.string().optional().default('https://sandbox.sellingpartnerapi-eu.amazon.com'),
  AMAZON_AWS_IAM_ROLE_ARN: z.string().optional(),
  AMAZON_REGION: z.string().optional().default("eu-west-1"),
  AMAZON_SELLER_CENTRAL_URL: z
    .string()
    .optional()
    .default("https://sellercentral.amazon.in"),
  AMAZON_REDIRECT_URI: z.string().optional(),
  AMAZON_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  AMAZON_OAUTH_STATE_TTL_SECONDS: z.string().optional().default('600').transform((value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(900, Math.max(300, parsed)) : 600;
  }),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Ekart Logistics Configuration
  EKART_CLIENT_ID: z.string().optional(),
  EKART_USERNAME: z.string().optional(),
  EKART_PASSWORD: z.string().optional(),
  EKART_BASE_URL: z
    .string()
    .optional()
    .default("https://app.elite.ekartlogistics.in/api"),

  // Shipmozo Logistics Configuration
  // Credentials must only be configured on the backend/secret manager.
  SHIPMOZO_INTEGRATION_ENABLED: z.enum(["true", "false"]).optional().default("true").transform((value) => value === "true"),
  SHIPMOZO_PUBLIC_KEY: z.string().optional(),
  SHIPMOZO_PRIVATE_KEY: z.string().optional(),
  SHIPMOZO_BASE_URL: z.string().optional().default("https://shipping-api.com/app/api/v1"),
  SHIPMOZO_WAREHOUSE_ID: z.string().optional(),
  SHIPMOZO_TRACKING_SYNC_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  SHIPMOZO_TRACKING_SYNC_CRON: z.string().optional().default("*/30 * * * *"),
  SHIPMOZO_TRACKING_SYNC_BATCH_SIZE: z.coerce.number().int().min(1).max(100).optional().default(25),
  SHIPMOZO_WEBHOOK_SECRET: z.string().min(16).optional(),

  // Seller Information (for EKART shipments)
  SELLER_GST_TIN: z.string().optional(),

  // Warehouse Pincode (fallback if EKART is unavailable)
  WAREHOUSE_PINCODE: z.string().optional(), // 6-digit pincode as fallback
});

const parsedEnv = envSchema.parse(process.env);
validateExotelConfig(parsedEnv);
validatePushNotificationConfig(parsedEnv);

export const env = parsedEnv;

export type Env = z.infer<typeof envSchema>;
