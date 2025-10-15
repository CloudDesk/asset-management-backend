import { z } from 'zod';
// Schema for sending OTP SMS
export const sendOtpSchema = z.object({
    phoneNumber: z.string()
        .min(10, 'Phone number must be at least 10 digits')
        .max(15, 'Phone number must not exceed 15 digits')
        .regex(/^\d+$/, 'Phone number must contain only digits'),
    message: z.string()
        .min(1, 'Message cannot be empty')
        .max(160, 'Message must not exceed 160 characters'),
});
//# sourceMappingURL=sms.schema.js.map