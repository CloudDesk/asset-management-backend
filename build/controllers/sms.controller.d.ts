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
}
//# sourceMappingURL=sms.controller.d.ts.map