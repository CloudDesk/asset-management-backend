import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logger } from '../config/logger.js';
// Password hashing configuration
const BCRYPT_SALT_ROUNDS = 12; // High security work factor
const RESET_TOKEN_EXPIRES_IN = 15 * 60 * 1000; // 15 minutes in milliseconds
// Password validation rules
export const PASSWORD_RULES = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
};
/**
 * Hash a password using bcrypt with secure salt rounds
 */
export async function hashPassword(password) {
    try {
        logger.debug('Hashing password with bcrypt');
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        return hashedPassword;
    }
    catch (error) {
        logger.error({ error }, 'Error hashing password');
        throw new Error('Failed to hash password');
    }
}
/**
 * Verify a password against its hash
 */
export async function verifyPassword(password, hashedPassword) {
    try {
        logger.debug('Verifying password with bcrypt');
        const isValid = await bcrypt.compare(password, hashedPassword);
        return isValid;
    }
    catch (error) {
        logger.error({ error }, 'Error verifying password');
        throw new Error('Failed to verify password');
    }
}
/**
 * Validate password strength according to security rules
 */
export function validatePassword(password) {
    const errors = [];
    if (password.length < PASSWORD_RULES.minLength) {
        errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters long`);
    }
    if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (PASSWORD_RULES.requireNumbers && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (PASSWORD_RULES.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Generate a secure session token for authentication
 */
export function generateSessionToken() {
    try {
        logger.debug('Generating session token');
        const token = crypto.randomBytes(32).toString('hex');
        return token;
    }
    catch (error) {
        logger.error({ error }, 'Error generating session token');
        throw new Error('Failed to generate session token');
    }
}
/**
 * Generate a secure reset token for password recovery
 */
export function generateResetToken() {
    try {
        logger.debug('Generating password reset token');
        const token = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_IN);
        return { token, hashedToken, expiresAt };
    }
    catch (error) {
        logger.error({ error }, 'Error generating reset token');
        throw new Error('Failed to generate reset token');
    }
}
/**
 * Verify a reset token
 */
export function verifyResetToken(token, hashedToken, expiresAt) {
    try {
        logger.debug('Verifying password reset token');
        // Check if token has expired
        if (new Date() > expiresAt) {
            logger.warn('Reset token has expired');
            return false;
        }
        // Hash the provided token and compare
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const isValid = crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hashedToken));
        return isValid;
    }
    catch (error) {
        logger.error({ error }, 'Error verifying reset token');
        return false;
    }
}
/**
 * Generate a unique username if email-based username already exists
 */
export function generateUniqueUsername(baseUsername, existingUsernames) {
    let username = baseUsername;
    let counter = 1;
    while (existingUsernames.includes(username)) {
        username = `${baseUsername}${counter}`;
        counter++;
    }
    return username;
}
/**
 * Sanitize user data for API responses (remove sensitive fields)
 */
export function sanitizeUserData(user) {
    const { userpassword, resetToken, resetTokenExpires, sessionToken, sessiontoken, // Database field (lowercase)
    resettoken, resettokenexpires, ...sanitizedUser } = user;
    return sanitizedUser;
}
/**
 * Rate limiting helper for authentication attempts
 */
export class AuthRateLimit {
    attempts = new Map();
    maxAttempts;
    windowMs;
    constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
    }
    /**
     * Check if an identifier (email/IP) is rate limited
     */
    isRateLimited(identifier) {
        const attempt = this.attempts.get(identifier);
        if (!attempt) {
            return false;
        }
        const now = new Date();
        const timeDiff = now.getTime() - attempt.lastAttempt.getTime();
        // Reset if window has passed
        if (timeDiff > this.windowMs) {
            this.attempts.delete(identifier);
            return false;
        }
        return attempt.count >= this.maxAttempts;
    }
    /**
     * Record a failed attempt
     */
    recordAttempt(identifier) {
        const now = new Date();
        const attempt = this.attempts.get(identifier);
        if (!attempt) {
            this.attempts.set(identifier, { count: 1, lastAttempt: now });
            return;
        }
        const timeDiff = now.getTime() - attempt.lastAttempt.getTime();
        // Reset if window has passed
        if (timeDiff > this.windowMs) {
            this.attempts.set(identifier, { count: 1, lastAttempt: now });
        }
        else {
            attempt.count++;
            attempt.lastAttempt = now;
        }
    }
    /**
     * Clear attempts for an identifier (on successful login)
     */
    clearAttempts(identifier) {
        this.attempts.delete(identifier);
    }
    /**
     * Get remaining attempts
     */
    getRemainingAttempts(identifier) {
        const attempt = this.attempts.get(identifier);
        if (!attempt) {
            return this.maxAttempts;
        }
        const now = new Date();
        const timeDiff = now.getTime() - attempt.lastAttempt.getTime();
        // Reset if window has passed
        if (timeDiff > this.windowMs) {
            this.attempts.delete(identifier);
            return this.maxAttempts;
        }
        return Math.max(0, this.maxAttempts - attempt.count);
    }
}
// Global rate limiter instance for protected routes (15 minutes)
export const authRateLimit = new AuthRateLimit();
// Separate rate limiter for OTP routes (2 minutes for faster recovery)
export const otpRateLimit = new AuthRateLimit(5, 2 * 60 * 1000); // 5 attempts in 2 minutes
//# sourceMappingURL=auth.js.map