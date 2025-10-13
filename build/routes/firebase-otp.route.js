import { FirebaseOTPController } from '../controllers/firebase-otp.controller.js';
import { sendOTPSchema, verifyOTPSchema, createSessionSchema, logoutSchema, getCurrentUserSchema, verifyRecaptchaSchema, } from '../schemas/firebase-otp.schema.js';
import { asyncHandler } from '../utils/errorHandler.js';
/**
 * Firebase OTP Authentication Routes
 * Prefix: /v1/firebase-otp
 */
export async function firebaseOTPRoutes(fastify) {
    const controller = new FirebaseOTPController();
    /**
     * POST /v1/firebase-otp/send
     * Acknowledge OTP send request
     */
    fastify.post('/send', {
        schema: sendOTPSchema,
    }, asyncHandler(controller.sendOTP.bind(controller)));
    /**
     * POST /v1/firebase-otp/verify
     * Verify Firebase ID token (optional intermediate step)
     */
    fastify.post('/verify', {
        schema: verifyOTPSchema,
    }, asyncHandler(controller.verifyOTP.bind(controller)));
    /**
     * POST /v1/firebase-otp/session
     * Exchange Firebase ID token for app session
     */
    fastify.post('/session', {
        schema: createSessionSchema,
    }, asyncHandler(controller.createSession.bind(controller)));
    /**
     * POST /v1/firebase-otp/logout
     * Destroy app session
     */
    fastify.post('/logout', {
        schema: logoutSchema,
    }, asyncHandler(controller.logout.bind(controller)));
    /**
     * POST /v1/firebase-otp/verify-recaptcha
     * Verify reCAPTCHA Enterprise token
     */
    fastify.post('/verify-recaptcha', {
        schema: verifyRecaptchaSchema,
    }, asyncHandler(controller.verifyRecaptcha.bind(controller)));
    /**
     * GET /v1/firebase-otp/me
     * Get current authenticated user
     */
    fastify.get('/me', {
        schema: getCurrentUserSchema,
    }, asyncHandler(controller.getCurrentUser.bind(controller)));
}
//# sourceMappingURL=firebase-otp.route.js.map