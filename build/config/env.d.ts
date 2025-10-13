import 'dotenv/config';
import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    DATABASE_URL: z.ZodString;
    PORT: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    FIREBASE_PROJECT_ID: z.ZodOptional<z.ZodString>;
    FIREBASE_CLIENT_EMAIL: z.ZodOptional<z.ZodString>;
    FIREBASE_PRIVATE_KEY: z.ZodOptional<z.ZodString>;
    APP_JWT_SECRET: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    DATABASE_URL: string;
    PORT: number;
    NODE_ENV: "development" | "production" | "test";
    APP_JWT_SECRET: string;
    FIREBASE_PROJECT_ID?: string | undefined;
    FIREBASE_CLIENT_EMAIL?: string | undefined;
    FIREBASE_PRIVATE_KEY?: string | undefined;
}, {
    DATABASE_URL: string;
    PORT?: string | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    FIREBASE_PROJECT_ID?: string | undefined;
    FIREBASE_CLIENT_EMAIL?: string | undefined;
    FIREBASE_PRIVATE_KEY?: string | undefined;
    APP_JWT_SECRET?: string | undefined;
}>;
export declare const env: {
    DATABASE_URL: string;
    PORT: number;
    NODE_ENV: "development" | "production" | "test";
    APP_JWT_SECRET: string;
    FIREBASE_PROJECT_ID?: string | undefined;
    FIREBASE_CLIENT_EMAIL?: string | undefined;
    FIREBASE_PRIVATE_KEY?: string | undefined;
};
export type Env = z.infer<typeof envSchema>;
export {};
//# sourceMappingURL=env.d.ts.map