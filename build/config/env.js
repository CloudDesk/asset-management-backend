import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    PORT: z.string().transform((val) => parseInt(val, 10)).default('3000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});
export const env = envSchema.parse(process.env);
