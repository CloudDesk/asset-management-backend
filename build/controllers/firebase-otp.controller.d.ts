import { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Firebase OTP Controller
 * Handles route logic for Firebase phone authentication
 */
export declare class FirebaseOTPController {
    private service;
    constructor();
    /**
     * POST /firebase-otp/send
     * Acknowledge OTP send request
     * Note: Actual OTP sending happens on client-side via Firebase Client SDK
     */
    sendOTP(request: FastifyRequest<{
        Body: {
            phoneNumber: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * POST /firebase-otp/verify
     * Verify Firebase ID token (optional intermediate step)
     */
    verifyOTP(request: FastifyRequest<{
        Body: {
            idToken: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * POST /firebase-otp/session
     * Exchange Firebase ID token for application session
     */
    createSession(request: FastifyRequest<{
        Body: {
            idToken: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * POST /firebase-otp/logout
     * Destroy application session
     */
    logout(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    /**
     * POST /firebase-otp/verify-recaptcha
     * Verify reCAPTCHA Enterprise token
     */
    verifyRecaptcha(request: FastifyRequest<{
        Body: {
            token: string;
            action: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * GET /firebase-otp/me
     * Get current authenticated user
     */
    getCurrentUser(request: FastifyRequest, reply: FastifyReply): Promise<void>;
}
//# sourceMappingURL=firebase-otp.controller.d.ts.map