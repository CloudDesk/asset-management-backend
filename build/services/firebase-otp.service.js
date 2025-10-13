import admin from 'firebase-admin';
import { logger } from '../config/logger.js';
import { jwtService } from '../utils/jwt.js';
import { AuthRateLimit } from '../utils/auth.js';
/**
 * Rate limiter for Firebase OTP operations
 */
const firebaseOTPRateLimit = new AuthRateLimit(10, 15 * 60 * 1000); // 10 attempts per 15 minutes
/**
 * Firebase OTP Service
 * Handles Firebase phone authentication business logic
 */
export class FirebaseOTPService {
    /**
     * Validate phone number format (E.164)
     */
    validatePhoneNumber(phoneNumber) {
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        return e164Regex.test(phoneNumber);
    }
    /**
     * Check rate limiting for phone number/IP
     */
    checkRateLimit(identifier) {
        const isLimited = firebaseOTPRateLimit.isRateLimited(identifier);
        const remainingAttempts = firebaseOTPRateLimit.getRemainingAttempts(identifier);
        return { isLimited, remainingAttempts };
    }
    /**
     * Record an OTP attempt
     */
    recordAttempt(identifier) {
        firebaseOTPRateLimit.recordAttempt(identifier);
    }
    /**
     * Clear rate limit attempts (on successful auth)
     */
    clearAttempts(identifier) {
        firebaseOTPRateLimit.clearAttempts(identifier);
    }
    /**
     * Verify Firebase ID token
     * Returns decoded token with user information
     */
    async verifyFirebaseToken(idToken) {
        try {
            logger.debug('Verifying Firebase ID token');
            // Verify the token with Firebase Admin
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            logger.info({
                uid: decodedToken.uid,
                phone: decodedToken.phone_number,
            }, 'Firebase ID token verified successfully');
            return decodedToken;
        }
        catch (error) {
            logger.error({ error }, 'Error verifying Firebase ID token');
            if (error instanceof Error) {
                if (error.message.includes('expired')) {
                    throw new Error('Firebase token has expired');
                }
                if (error.message.includes('invalid')) {
                    throw new Error('Invalid Firebase token');
                }
            }
            throw new Error('Failed to verify Firebase token');
        }
    }
    /**
     * Create application session from Firebase token
     * Returns JWT token and user data
     */
    async createSession(idToken) {
        try {
            // Verify Firebase token
            const decodedToken = await this.verifyFirebaseToken(idToken);
            // Extract user information
            const uid = decodedToken.uid;
            const phone = decodedToken.phone_number || '';
            const email = decodedToken.email;
            if (!phone) {
                throw new Error('Phone number not found in Firebase token');
            }
            // Create app session JWT with conditional email
            const jwtPayload = { uid, phone };
            if (email) {
                jwtPayload.email = email;
            }
            const token = jwtService.sign(jwtPayload);
            logger.info({ uid, phone, email }, 'Session created successfully');
            const sessionData = {
                ok: true,
                uid,
                phone,
                token,
            };
            if (email) {
                sessionData.email = email;
            }
            return sessionData;
        }
        catch (error) {
            logger.error({ error }, 'Error creating session');
            throw error;
        }
    }
    /**
     * Verify app session token
     * Returns decoded user data
     */
    verifySession(token) {
        try {
            const decoded = jwtService.verify(token);
            logger.debug({ uid: decoded.uid, phone: decoded.phone }, 'Session verified');
            return decoded;
        }
        catch (error) {
            logger.error({ error }, 'Error verifying session');
            throw error;
        }
    }
    /**
     * Get user from Firebase by UID
     */
    async getUserByUID(uid) {
        try {
            const userRecord = await admin.auth().getUser(uid);
            logger.debug({ uid, phone: userRecord.phoneNumber }, 'User retrieved from Firebase');
            return userRecord;
        }
        catch (error) {
            logger.error({ error, uid }, 'Error getting user from Firebase');
            throw new Error('User not found');
        }
    }
    /**
     * Optional: Create or update custom user claims in Firebase
     */
    async setCustomClaims(uid, claims) {
        try {
            await admin.auth().setCustomUserClaims(uid, claims);
            logger.info({ uid, claims }, 'Custom claims set for user');
        }
        catch (error) {
            logger.error({ error, uid }, 'Error setting custom claims');
            throw new Error('Failed to set custom claims');
        }
    }
    /**
     * Optional: Revoke Firebase refresh tokens (for logout)
     */
    async revokeRefreshTokens(uid) {
        try {
            await admin.auth().revokeRefreshTokens(uid);
            logger.info({ uid }, 'Refresh tokens revoked for user');
        }
        catch (error) {
            logger.error({ error, uid }, 'Error revoking refresh tokens');
            // Don't throw - this is optional cleanup
        }
    }
}
//# sourceMappingURL=firebase-otp.service.js.map