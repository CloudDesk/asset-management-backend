import { FastifyRequest, FastifyReply } from 'fastify';
export declare class SmsController {
    private smsService;
    private twilioSmsService;
    /**
     * Send OTP SMS to phone number (Infobip)
     * POST /v1/sms/send-otp
     */
    sendOtp: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Send OTP SMS via Twilio
     * POST /v1/sms/send-otp-twilio
     */
    sendOtpTwilio: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Send OTP SMS with fallback (try Twilio if Infobip fails)
     * POST /v1/sms/send-otp-with-fallback
     */
    sendOtpWithFallback: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Send OTP SMS with Redis storage and rate limiting
     * POST /v1/sms/send-otp-with-storage
     */
    sendOtpWithStorage: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Verify OTP
     * POST /v1/sms/verify-otp
     */
    verifyOtp: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Resend OTP
     * POST /v1/sms/resend-otp
     */
    resendOtp: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=sms.controller.d.ts.map