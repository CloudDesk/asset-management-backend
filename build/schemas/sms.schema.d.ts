import { z } from 'zod';
export declare const sendOtpSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    phoneNumber: string;
}, {
    message: string;
    phoneNumber: string;
}>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
//# sourceMappingURL=sms.schema.d.ts.map