import 'dotenv/config';
import { z } from 'zod';
const STATIC_OTP_ENVIRONMENT_MARKERS = ['sit', 'dev', 'development', 'test', 'staging', 'sandbox'];
const REQUIRED_EXOTEL_ENV_VARS = [
    'EXOTEL_ACCOUNT_SID',
    'EXOTEL_API_KEY',
    'EXOTEL_API_TOKEN',
    'EXOTEL_SENDER_ID'
];
const REQUIRED_FIREBASE_PUSH_ENV_VARS = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY'
];
const REQUIRED_APNS_PUSH_ENV_VARS = [
    'APNS_AUTH_KEY',
    'APNS_KEY_ID',
    'APNS_TEAM_ID',
    'APNS_BUNDLE_ID'
];
const DISALLOWED_PRODUCTION_PUSH_PATH_ENV_VARS = [
    'FIREBASE_SERVICE_ACCOUNT_PATH',
    'APNS_AUTH_KEY_PATH'
];
function isStaticOtpEnvironment(data) {
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
        data.STORAGE_BACKEND_URL
    ]
        .filter((value) => Boolean(value))
        .join(' ')
        .toLowerCase();
    return (data.NODE_ENV !== 'production' ||
        STATIC_OTP_ENVIRONMENT_MARKERS.some(marker => environmentSignals.includes(marker)));
}
function validateExotelConfig(data) {
    if (isStaticOtpEnvironment(data)) {
        return;
    }
    const missingVars = REQUIRED_EXOTEL_ENV_VARS.filter((key) => !data[key]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required Exotel environment variables: ${missingVars.join(', ')}. ` +
            'Set them, or configure USER_OTP for a non-production environment.');
    }
}
function getEnvConfigValue(data, key) {
    const value = data[key];
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
}
function validatePrivateKeyEnvValue(key, value) {
    const errors = [];
    const normalizedValue = value
        .replace(/\\\r?\n/g, '\n')
        .replace(/\\n/g, '\n')
        .trim();
    if (value.includes('/n')) {
        errors.push(`${key} contains /n; use escaped newlines as \\n`);
    }
    if (!normalizedValue.includes('\n')) {
        errors.push(`${key} must contain escaped newlines as \\n`);
    }
    if (!normalizedValue.startsWith('-----BEGIN PRIVATE KEY-----') ||
        !normalizedValue.endsWith('-----END PRIVATE KEY-----')) {
        errors.push(`${key} must be a PEM private key`);
    }
    return errors;
}
function validatePushNotificationConfig(data) {
    const isProduction = getEnvConfigValue(data, 'NODE_ENV') === 'production';
    const hasFirebaseDirectConfig = REQUIRED_FIREBASE_PUSH_ENV_VARS.some((key) => Boolean(getEnvConfigValue(data, key)));
    const hasApnsConfig = REQUIRED_APNS_PUSH_ENV_VARS.some((key) => Boolean(getEnvConfigValue(data, key)));
    const missingVars = [];
    const validationErrors = [];
    if (isProduction || hasFirebaseDirectConfig) {
        missingVars.push(...REQUIRED_FIREBASE_PUSH_ENV_VARS.filter((key) => !getEnvConfigValue(data, key)));
    }
    if (isProduction || hasApnsConfig) {
        missingVars.push(...REQUIRED_APNS_PUSH_ENV_VARS.filter((key) => !getEnvConfigValue(data, key)));
    }
    if (isProduction) {
        const pathVars = DISALLOWED_PRODUCTION_PUSH_PATH_ENV_VARS.filter((key) => Boolean(getEnvConfigValue(data, key)));
        if (pathVars.length > 0) {
            validationErrors.push(`Do not use path-based push credential variables in production: ${pathVars.join(', ')}. ` +
                'Use backend-only environment variables or Secret Manager values instead.');
        }
    }
    const firebasePrivateKey = getEnvConfigValue(data, 'FIREBASE_PRIVATE_KEY');
    if (firebasePrivateKey) {
        validationErrors.push(...validatePrivateKeyEnvValue('FIREBASE_PRIVATE_KEY', firebasePrivateKey));
    }
    const apnsAuthKey = getEnvConfigValue(data, 'APNS_AUTH_KEY');
    if (apnsAuthKey) {
        validationErrors.push(...validatePrivateKeyEnvValue('APNS_AUTH_KEY', apnsAuthKey));
    }
    if (missingVars.length > 0) {
        validationErrors.unshift(`Missing required push notification environment variables: ${missingVars.join(', ')}`);
    }
    if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
    }
}
const envSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    PORT: z.string().transform((val) => parseInt(val, 10)).default('8080'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    APP_ENV: z.string().optional(),
    ENVIRONMENT: z.string().optional(),
    DEPLOY_ENV: z.string().optional(),
    STAGE: z.string().optional(),
    K_SERVICE: z.string().optional(),
    // JWT Secret for app sessions
    APP_JWT_SECRET: z.string().default('your-secret-key-change-this-in-production'),
    JWT_SECRET: z.string().optional(), // Alias for APP_JWT_SECRET
    JWT_ACCESS_TOKEN_EXPIRY: z.string().optional().default('24h'), // Access token expiry (e.g., '24h', '1h', '30m')
    JWT_REFRESH_TOKEN_EXPIRY: z.string().optional().default('7d'), // Refresh token expiry (e.g., '7d', '30d')
    JWT_REFRESH_ON_USE: z.string().optional().default('true'), // Extend refresh token on use (sliding expiry)
    // Twilio Configuration (required for OTP SMS - kept for backward compatibility)
    TWILIO_ACCOUNT_SID: z.string().min(1, 'TWILIO_ACCOUNT_SID is required'),
    TWILIO_AUTH_TOKEN: z.string().min(1, 'TWILIO_AUTH_TOKEN is required'),
    TWILIO_PHONE_NUMBER: z.string().min(1, 'TWILIO_PHONE_NUMBER is required'),
    TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
    // Exotel Configuration (required unless SIT/static USER_OTP is enabled)
    EXOTEL_ACCOUNT_SID: z.string().optional(),
    EXOTEL_API_KEY: z.string().optional(),
    EXOTEL_API_TOKEN: z.string().optional(),
    EXOTEL_SUBDOMAIN: z.string().optional().default('api'),
    EXOTEL_SENDER_ID: z.string().optional(),
    EXOTEL_DLT_TEMPLATE_ID: z.string().optional(),
    EXOTEL_ENTITY_ID: z.string().optional(),
    // Redis Configuration (required for OTP storage)
    // Use either REDIS_URL or REDIS_HOST+REDIS_PORT+REDIS_PASSWORD
    REDIS_URL: z.string().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.string().optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_USERNAME: z.string().optional().default('default'),
    REDIS_EMAIL_OTPEXPSEC: z.string().optional().default('300'),
    REDIS_SESSIONEXSEC: z.string().optional().default('3600'),
    // GCP Configuration
    GCP_PROJECT_ID: z.string().optional(),
    GCP_PROJECT_LOCATION: z.string().optional(),
    GCP_PROJECT_QUEUE: z.string().optional(),
    GCP_TASK_URL: z.string().optional(),
    GCP_STORAGE_BUCKET: z.string().optional(),
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
    STORAGE_BACKEND_URL: z.string().optional().default('http://localhost:4500'),
    // Email Configuration
    GMAIL_SERVICE: z.string().optional().default('gmail'),
    GMAIL_HOST: z.string().optional().default('smtp.gmail.com'),
    GMAIL_PORT: z.string().optional().default('465'),
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
    PHONEPE_AUTH_MODE: z.string().optional().default('legacy'),
    PHONEPE_CLIENT_ID: z.string().optional(),
    PHONEPE_CLIENT_SECRET: z.string().optional(),
    PHONEPE_CLIENT_VERSION: z.string().optional().default('1'),
    PHONEPE_OAUTH_URL: z.string().optional(),
    // API Configuration
    API_BASE_URL: z.string().optional(),
    REDIRECT_URL_PAYMENT_STATUS: z.string().optional(),
    REDIRECT_URL_SUCCESS: z.string().optional(),
    REDIRECT_URL_FAILURE: z.string().optional(),
    REDIRECT_INVENTORY_URL: z.string().optional(),
    // Optional OTP Configuration (has defaults)
    OTP_EXPIRY_SECONDS: z.string().optional().default('60'),
    OTP_MAX_ATTEMPTS: z.string().optional().default('3'),
    RATE_LIMIT_SEND_MAX: z.string().optional().default('3'),
    RATE_LIMIT_SEND_WINDOW: z.string().optional().default('900'),
    RATE_LIMIT_VERIFY_MAX: z.string().optional().default('5'),
    RATE_LIMIT_VERIFY_WINDOW: z.string().optional().default('3600'),
    BLOCK_DURATION: z.string().optional().default('3600'),
    USER_OTP: z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), z.string().trim().regex(/^\d{4}$/, 'USER_OTP must be exactly 4 digits').optional()),
    // Amazon SP-API Configuration (Global keys - change values for sandbox/production)
    AMAZON_CLIENT_ID: z.string().optional(),
    AMAZON_CLIENT_SECRET: z.string().optional(),
    AMAZON_REFRESH_TOKEN: z.string().optional(),
    AMAZON_ENVIRONMENT: z.enum(['SANDBOX', 'PRODUCTION']).optional().default('SANDBOX'),
    AMAZON_MARKETPLACE_ID: z.string().optional().default('A21TJRUUN4KGV'), // Fixed for India
    AMAZON_SP_API_BASE_URL: z.string().optional(),
    AMAZON_AWS_IAM_ROLE_ARN: z.string().optional(),
    AMAZON_REGION: z.string().optional().default('eu-west-1'),
    AMAZON_SELLER_CENTRAL_URL: z.string().optional().default('https://sellercentral.amazon.in'),
    AMAZON_REDIRECT_URI: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    // Ekart Logistics Configuration
    EKART_CLIENT_ID: z.string().optional(),
    EKART_USERNAME: z.string().optional(),
    EKART_PASSWORD: z.string().optional(),
    EKART_BASE_URL: z.string().optional().default('https://app.elite.ekartlogistics.in/api'),
    // Seller Information (for EKART shipments)
    SELLER_GST_TIN: z.string().optional(),
    // Warehouse Pincode (fallback if EKART is unavailable)
    WAREHOUSE_PINCODE: z.string().optional(), // 6-digit pincode as fallback
});
const parsedEnv = envSchema.parse(process.env);
validateExotelConfig(parsedEnv);
validatePushNotificationConfig(parsedEnv);
export const env = parsedEnv;
//# sourceMappingURL=env.js.map