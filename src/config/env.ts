import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Firebase Configuration
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, 'FIREBASE_CLIENT_EMAIL is required'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),

  // JWT Secret for app sessions
  APP_JWT_SECRET: z.string().default('your-secret-key-change-this-in-production'),

  // Twilio Configuration (required for OTP SMS)
  TWILIO_ACCOUNT_SID: z.string().min(1, 'TWILIO_ACCOUNT_SID is required'),
  TWILIO_AUTH_TOKEN: z.string().min(1, 'TWILIO_AUTH_TOKEN is required'),
  TWILIO_PHONE_NUMBER: z.string().min(1, 'TWILIO_PHONE_NUMBER is required'),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

  // Redis Configuration (required for OTP storage)
  // Use either REDIS_URL or REDIS_HOST+REDIS_PORT+REDIS_PASSWORD
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_USERNAME: z.string().optional().default('default'),
  
  // Optional OTP Configuration (has defaults)
  OTP_EXPIRY_SECONDS: z.string().optional().default('60'),
  OTP_MAX_ATTEMPTS: z.string().optional().default('3'),
  RATE_LIMIT_SEND_MAX: z.string().optional().default('3'),
  RATE_LIMIT_SEND_WINDOW: z.string().optional().default('900'),
  RATE_LIMIT_VERIFY_MAX: z.string().optional().default('5'),
  RATE_LIMIT_VERIFY_WINDOW: z.string().optional().default('3600'),
  BLOCK_DURATION: z.string().optional().default('3600'),

});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>; 