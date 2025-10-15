import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
/**
 * Simple JWT implementation for Firebase OTP session management
 * Using HMAC-SHA256 for signing
 */
export class JWTService {
    secret;
    expiresIn; // in seconds
    constructor(secret, expiresIn = 24 * 60 * 60) {
        this.secret = secret || env.APP_JWT_SECRET;
        this.expiresIn = expiresIn;
    }
    /**
     * Create a session token (JWT) for Firebase authenticated user
     */
    sign(payload) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const jwtPayload = {
                ...payload,
                iat: now,
                exp: now + this.expiresIn,
            };
            // Create header
            const header = {
                alg: 'HS256',
                typ: 'JWT',
            };
            // Encode header and payload
            const encodedHeader = this.base64urlEncode(JSON.stringify(header));
            const encodedPayload = this.base64urlEncode(JSON.stringify(jwtPayload));
            // Create signature
            const signatureInput = `${encodedHeader}.${encodedPayload}`;
            const signature = crypto
                .createHmac('sha256', this.secret)
                .update(signatureInput)
                .digest('base64url');
            // Combine all parts
            const token = `${encodedHeader}.${encodedPayload}.${signature}`;
            logger.debug({ uid: payload.uid, phone: payload.phone }, 'JWT token created');
            return token;
        }
        catch (error) {
            logger.error({ error }, 'Error creating JWT token');
            throw new Error('Failed to create session token');
        }
    }
    /**
     * Verify and decode a JWT token
     */
    verify(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid token format');
            }
            const [encodedHeader, encodedPayload, signature] = parts;
            if (!encodedHeader || !encodedPayload || !signature) {
                throw new Error('Invalid token format: missing parts');
            }
            // Verify signature
            const signatureInput = `${encodedHeader}.${encodedPayload}`;
            const expectedSignature = crypto
                .createHmac('sha256', this.secret)
                .update(signatureInput)
                .digest('base64url');
            if (signature !== expectedSignature) {
                throw new Error('Invalid token signature');
            }
            // Decode payload
            const payload = JSON.parse(this.base64urlDecode(encodedPayload));
            // Check expiration
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp < now) {
                throw new Error('Token has expired');
            }
            logger.debug({ uid: payload.uid, phone: payload.phone }, 'JWT token verified');
            return payload;
        }
        catch (error) {
            logger.error({ error }, 'Error verifying JWT token');
            throw error;
        }
    }
    /**
     * Base64URL encode a string
     */
    base64urlEncode(str) {
        return Buffer.from(str)
            .toString('base64url');
    }
    /**
     * Base64URL decode a string
     */
    base64urlDecode(str) {
        return Buffer.from(str, 'base64url').toString('utf-8');
    }
}
// Global JWT service instance
export const jwtService = new JWTService();
//# sourceMappingURL=jwt.js.map