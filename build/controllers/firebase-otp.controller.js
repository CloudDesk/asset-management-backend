import { FirebaseOTPService } from '../services/firebase-otp.service.js';
import { recaptchaEnterpriseService } from '../services/recaptcha-enterprise.service.js';
import { logger } from '../config/logger.js';
import { createSuccessResponse } from '../utils/errorHandler.js';
import { env } from '../config/env.js';
/**
 * Firebase OTP Controller
 * Handles route logic for Firebase phone authentication
 */
export class FirebaseOTPController {
    service;
    constructor() {
        this.service = new FirebaseOTPService();
    }
    /**
     * POST /firebase-otp/send
     * Acknowledge OTP send request
     * Note: Actual OTP sending happens on client-side via Firebase Client SDK
     */
    async sendOTP(request, reply) {
        const { phoneNumber } = request.body;
        // Validate phone number format
        if (!this.service.validatePhoneNumber(phoneNumber)) {
            logger.warn({ phoneNumber, ip: request.ip }, 'Invalid phone number format');
            reply.code(400).send({
                success: false,
                message: 'Invalid phone number',
                details: 'Phone number must be in E.164 format (e.g., +1234567890)',
                statusCode: 400,
            });
            return;
        }
        // Rate limiting check
        const identifier = `otp-send-${request.ip}-${phoneNumber}`;
        const { isLimited, remainingAttempts } = this.service.checkRateLimit(identifier);
        if (isLimited) {
            logger.warn({
                phoneNumber,
                ip: request.ip,
                remainingAttempts
            }, 'OTP send rate limited');
            reply.code(429).send({
                success: false,
                message: 'Too many OTP requests',
                details: 'Please try again later',
                statusCode: 429,
                retryAfter: 900, // 15 minutes
            });
            return;
        }
        // Record attempt
        this.service.recordAttempt(identifier);
        logger.info({ phoneNumber, ip: request.ip }, 'OTP send request acknowledged');
        const response = createSuccessResponse('OTP send request acknowledged', {
            status: 'otp_sent',
            phoneNumber,
        });
        reply.code(200).send(response);
    }
    /**
     * POST /firebase-otp/verify
     * Verify Firebase ID token (optional intermediate step)
     */
    async verifyOTP(request, reply) {
        const { idToken } = request.body;
        try {
            // Verify Firebase token
            const decodedToken = await this.service.verifyFirebaseToken(idToken);
            logger.info({
                uid: decodedToken.uid,
                phone: decodedToken.phone_number,
                ip: request.ip
            }, 'Firebase token verified');
            const response = createSuccessResponse('Firebase token verified', {
                status: 'firebase_verified',
                uid: decodedToken.uid,
                phone: decodedToken.phone_number,
            });
            reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error, ip: request.ip }, 'Error verifying Firebase token');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            reply.code(401).send({
                success: false,
                message: 'Invalid or expired token',
                details: errorMessage,
                statusCode: 401,
            });
        }
    }
    /**
     * POST /firebase-otp/session
     * Exchange Firebase ID token for application session
     */
    async createSession(request, reply) {
        const { idToken } = request.body;
        // Rate limiting check
        const identifier = `session-create-${request.ip}`;
        const { isLimited, remainingAttempts } = this.service.checkRateLimit(identifier);
        if (isLimited) {
            logger.warn({
                ip: request.ip,
                remainingAttempts
            }, 'Session creation rate limited');
            reply.code(429).send({
                success: false,
                message: 'Too many session creation attempts',
                details: 'Please try again later',
                statusCode: 429,
            });
            return;
        }
        try {
            // Create session
            const sessionData = await this.service.createSession(idToken);
            // Clear rate limiting on success
            this.service.clearAttempts(identifier);
            // Set HTTP-only cookie for web clients
            const isProduction = env.NODE_ENV === 'production';
            reply.setCookie('firebase_session', sessionData.token, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'lax' : 'lax',
                maxAge: 24 * 60 * 60, // 24 hours
                path: '/',
            });
            logger.info({
                uid: sessionData.uid,
                phone: sessionData.phone,
                ip: request.ip
            }, 'Session created successfully');
            const response = createSuccessResponse('Session created successfully', sessionData);
            reply.code(200).send(response);
        }
        catch (error) {
            // Record failed attempt
            this.service.recordAttempt(identifier);
            logger.error({ error, ip: request.ip }, 'Error creating session');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            reply.code(401).send({
                success: false,
                message: 'Failed to create session',
                details: errorMessage,
                statusCode: 401,
            });
        }
    }
    /**
     * POST /firebase-otp/logout
     * Destroy application session
     */
    async logout(request, reply) {
        try {
            // Clear session cookie
            reply.clearCookie('firebase_session', {
                path: '/',
            });
            logger.info({ ip: request.ip }, 'User logged out successfully');
            const response = createSuccessResponse('Logged out successfully', {
                ok: true,
            });
            reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error, ip: request.ip }, 'Error during logout');
            reply.code(500).send({
                success: false,
                message: 'Logout failed',
                details: 'An error occurred during logout',
                statusCode: 500,
            });
        }
    }
    /**
     * POST /firebase-otp/verify-recaptcha
     * Verify reCAPTCHA Enterprise token
     */
    async verifyRecaptcha(request, reply) {
        const { token, action } = request.body;
        try {
            // Verify reCAPTCHA token
            const result = await recaptchaEnterpriseService.verifyActionToken(token, action);
            if (result.success) {
                logger.info({
                    action,
                    score: result.score,
                    ip: request.ip
                }, 'reCAPTCHA Enterprise verification successful');
                const response = createSuccessResponse('reCAPTCHA verification successful', {
                    verified: true,
                    score: result.score,
                    action,
                });
                reply.code(200).send(response);
            }
            else {
                logger.warn({
                    action,
                    message: result.message,
                    ip: request.ip
                }, 'reCAPTCHA Enterprise verification failed');
                reply.code(400).send({
                    success: false,
                    message: 'reCAPTCHA verification failed',
                    details: result.message,
                    statusCode: 400,
                });
            }
        }
        catch (error) {
            logger.error({ error, ip: request.ip }, 'Error verifying reCAPTCHA token');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            reply.code(500).send({
                success: false,
                message: 'reCAPTCHA verification error',
                details: errorMessage,
                statusCode: 500,
            });
        }
    }
    /**
     * GET /firebase-otp/me
     * Get current authenticated user
     */
    async getCurrentUser(request, reply) {
        try {
            // Get token from cookie or Authorization header
            const cookieToken = request.cookies?.firebase_session;
            const authHeader = request.headers.authorization;
            const bearerToken = authHeader?.startsWith('Bearer ')
                ? authHeader.substring(7)
                : undefined;
            const token = cookieToken || bearerToken;
            if (!token) {
                reply.code(401).send({
                    success: false,
                    message: 'Not authenticated',
                    details: 'No session token found',
                    statusCode: 401,
                });
                return;
            }
            // Verify session token
            const user = this.service.verifySession(token);
            logger.debug({
                uid: user.uid,
                phone: user.phone,
                ip: request.ip
            }, 'User information retrieved');
            const response = createSuccessResponse('User retrieved successfully', {
                user,
            });
            reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error, ip: request.ip }, 'Error getting current user');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            reply.code(401).send({
                success: false,
                message: 'Invalid session',
                details: errorMessage,
                statusCode: 401,
            });
        }
    }
}
//# sourceMappingURL=firebase-otp.controller.js.map