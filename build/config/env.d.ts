import 'dotenv/config';
import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    DATABASE_URL: z.ZodString;
    PORT: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
}, "strip", z.ZodTypeAny, {
    DATABASE_URL: string;
    PORT: number;
    NODE_ENV: "development" | "production" | "test";
}, {
    DATABASE_URL: string;
    PORT?: string | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
}>;
export declare const env: {
    DATABASE_URL: string;
    PORT: number;
    NODE_ENV: "development" | "production" | "test";
};
export type Env = z.infer<typeof envSchema>;
export {};
//# sourceMappingURL=env.d.ts.map