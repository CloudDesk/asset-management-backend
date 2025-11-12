import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Firebase Configuration
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, 'FIREBASE_CLIENT_EMAIL is required'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),

  // JWT Secret for app sessions
  APP_JWT_SECRET: z.string().default('your-secret-key-change-this-in-production'),

  // Twilio Configuration (required for OTP SMS - kept for backward compatibility)
  TWILIO_ACCOUNT_SID: z.string().min(1, 'TWILIO_ACCOUNT_SID is required'),
  TWILIO_AUTH_TOKEN: z.string().min(1, 'TWILIO_AUTH_TOKEN is required'),
  TWILIO_PHONE_NUMBER: z.string().min(1, 'TWILIO_PHONE_NUMBER is required'),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

  // Exotel Configuration (required for OTP SMS migration)
  EXOTEL_ACCOUNT_SID: z.string().min(1, 'EXOTEL_ACCOUNT_SID is required'),
  EXOTEL_API_KEY: z.string().min(1, 'EXOTEL_API_KEY is required'),
  EXOTEL_API_TOKEN: z.string().min(1, 'EXOTEL_API_TOKEN is required'),
  EXOTEL_SUBDOMAIN: z.string().optional().default('api'),
  EXOTEL_SENDER_ID: z.string().min(1, 'EXOTEL_SENDER_ID is required'),
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
  
  // Amazon SP-API Configuration
  // Required for basic SP-API operations (manual token setup)
  AMAZON_CLIENT_ID: z.string().optional().describe('Amazon LWA Client ID (amzn1.application-oa2-client.xxxxx)'),
  AMAZON_CLIENT_SECRET: z.string().optional().describe('Amazon LWA Client Secret'),
  AMAZON_REFRESH_TOKEN: z.string().optional().describe('Amazon Refresh Token (manually obtained until OAuth is configured)'),
  
  // SP-API Environment Configuration
  AMAZON_ENVIRONMENT: z.enum(['SANDBOX', 'PRODUCTION']).optional().default('SANDBOX').describe('Amazon SP-API environment: SANDBOX or PRODUCTION'),
  AMAZON_MARKETPLACE_ID: z.string().optional().default('A21TJRUUN4KGV').describe('Amazon Marketplace ID (default: A21TJRUUN4KGV for India)'),
  AMAZON_SP_API_BASE_URL: z.string().optional().describe('Amazon SP-API base URL (auto-determined by environment if not provided)'),
  AMAZON_SELLER_CENTRAL_URL: z.string().optional().default('https://sellercentral.amazon.in').describe('Amazon Seller Central URL (default: India)'),
  
  // OAuth Configuration (for future OAuth flow)
  AMAZON_REDIRECT_URI: z.string().optional().describe('OAuth redirect URI (must match registered URI in Seller Portal)'),

});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>; 