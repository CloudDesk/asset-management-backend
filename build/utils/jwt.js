import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
// JWT Configuration
const JWT_SECRET = (process.env.JWT_SECRET || env.APP_JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
const JWT_ACCESS_TOKEN_EXPIRY = (process.env.JWT_ACCESS_TOKEN_EXPIRY || env.JWT_ACCESS_TOKEN_EXPIRY || '24h'); // 24 hours
const JWT_REFRESH_TOKEN_EXPIRY = (process.env.JWT_REFRESH_TOKEN_EXPIRY || env.JWT_REFRESH_TOKEN_EXPIRY || '7d'); // 7 days
const JWT_REFRESH_ON_USE = (process.env.JWT_REFRESH_ON_USE || env.JWT_REFRESH_ON_USE || 'true') === 'true'; // Extend expiry on each API call
/**
 * Generate JWT access token
 * Short-lived token for API requests
 */
export function generateAccessToken(payload) {
    try {
        const tokenPayload = {
            userId: payload.userId,
            email: payload.email,
        };
        if (payload.roleId !== undefined) {
            tokenPayload.roleId = payload.roleId;
        }
        if (payload.userType !== undefined) {
            tokenPayload.userType = payload.userType;
        }
        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: JWT_ACCESS_TOKEN_EXPIRY,
            issuer: 'asset-management-backend',
            audience: 'asset-management-frontend',
        });
        logger.debug({ userId: payload.userId, email: payload.email, userType: payload.userType }, 'Access token generated');
        return token;
    }
    catch (error) {
        logger.error({ error, payload }, 'Error generating access token');
        throw new Error('Failed to generate access token');
    }
}
/**
 * Generate JWT refresh token
 * Long-lived token for refreshing access tokens
 */
export function generateRefreshToken(payload) {
    try {
        const tokenPayload = {
            userId: payload.userId,
            email: payload.email,
        };
        if (payload.roleId !== undefined) {
            tokenPayload.roleId = payload.roleId;
        }
        if (payload.userType !== undefined) {
            tokenPayload.userType = payload.userType;
        }
        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: JWT_REFRESH_TOKEN_EXPIRY,
            issuer: 'asset-management-backend',
            audience: 'asset-management-frontend',
        });
        logger.debug({ userId: payload.userId, userType: payload.userType }, 'Refresh token generated');
        return token;
    }
    catch (error) {
        logger.error({ error, payload }, 'Error generating refresh token');
        throw new Error('Failed to generate refresh token');
    }
}
/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload) {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    // Calculate expiry in seconds
    const expiresIn = parseExpiryToSeconds(JWT_ACCESS_TOKEN_EXPIRY || '24h');
    return {
        accessToken,
        refreshToken,
        expiresIn,
    };
}
/**
 * Verify and decode JWT token
 * Returns decoded payload or throws error
 */
export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: 'asset-management-backend',
            audience: 'asset-management-frontend',
        });
        logger.debug({ userId: decoded.userId }, 'Token verified successfully');
        return decoded;
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            logger.warn({ expiredAt: error.expiredAt }, 'Token has expired');
            throw new Error('Token has expired');
        }
        else if (error.name === 'JsonWebTokenError') {
            logger.warn({ error: error.message }, 'Invalid token');
            throw new Error('Invalid token');
        }
        else {
            logger.error({ error }, 'Error verifying token');
            throw new Error('Token verification failed');
        }
    }
}
/**
 * Refresh access token (generate new access token from refresh token)
 * Optionally extends refresh token expiry if JWT_REFRESH_ON_USE is true
 */
export function refreshAccessToken(refreshToken) {
    try {
        // Verify refresh token
        const decoded = verifyToken(refreshToken);
        // Generate new access token
        const newAccessToken = generateAccessToken({
            userId: decoded.userId,
            email: decoded.email,
            roleId: decoded.roleId,
        });
        // Optionally generate new refresh token (sliding expiry)
        let newRefreshToken = refreshToken;
        if (JWT_REFRESH_ON_USE) {
            newRefreshToken = generateRefreshToken({
                userId: decoded.userId,
                email: decoded.email,
                roleId: decoded.roleId,
            });
            logger.debug({ userId: decoded.userId }, 'Refresh token extended (sliding expiry)');
        }
        const expiresIn = parseExpiryToSeconds(JWT_ACCESS_TOKEN_EXPIRY || '24h');
        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn,
        };
    }
    catch (error) {
        logger.error({ error }, 'Error refreshing access token');
        throw error;
    }
}
/**
 * Get token expiry time in seconds
 */
function parseExpiryToSeconds(expiry) {
    if (!expiry) {
        return 24 * 60 * 60; // Default 24 hours
    }
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
        // Default to 24 hours if format is invalid
        return 24 * 60 * 60;
    }
    const value = parseInt(match[1] || '24', 10);
    const unit = match[2] || 'h';
    switch (unit) {
        case 's':
            return value;
        case 'm':
            return value * 60;
        case 'h':
            return value * 60 * 60;
        case 'd':
            return value * 24 * 60 * 60;
        default:
            return 24 * 60 * 60;
    }
}
/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token) {
    try {
        return jwt.decode(token);
    }
    catch (error) {
        logger.error({ error }, 'Error decoding token');
        return null;
    }
}
//# sourceMappingURL=jwt.js.map