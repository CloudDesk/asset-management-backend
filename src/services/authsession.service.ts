import { PrismaClient, AuthSession } from '@prisma/client';
import { createHash } from 'crypto';
import { logger } from '../config/logger.js';

const prisma = new PrismaClient();

export interface CreateSessionParams {
    userId: number;
    userType: 'inventory' | 'ecommerce';
    refreshToken: string; // Plain text refresh token (will be hashed)
    expiresInDays: number; // 7 for inventory, 90 for ecommerce
    ipAddress?: string;
    userAgent?: string;
}

export interface SessionCleanupResult {
    deletedCount: number;
    deletedExpired: number;
    deletedRevoked: number;
}

export class AuthSessionService {
    /**
     * Hash a refresh token using SHA-256
     */
    private hashRefreshToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    /**
     * Create a new authentication session
     */
    async createSession(params: CreateSessionParams): Promise<AuthSession> {
        const { userId, userType, refreshToken, expiresInDays, ipAddress, userAgent } = params;

        // Calculate expiry timestamp in milliseconds (BigInt)
        const now = Date.now();
        const expiresAt = BigInt(now + (expiresInDays * 24 * 60 * 60 * 1000));

        const session = await prisma.authSession.create({
            data: {
                userId,
                userType,
                refreshTokenHash: this.hashRefreshToken(refreshToken),
                expiresAt,
                ipAddress: ipAddress || null,
                userAgent: userAgent || null,
            },
        });

        logger.info({
            sessionId: session.id,
            userId,
            userType,
            expiresAt: expiresAt.toString(),
        }, 'Created new auth session');

        return session;
    }

    /**
     * Verify and retrieve a session by refresh token
     */
    async verifyRefreshToken(
        refreshToken: string,
        userType: 'inventory' | 'ecommerce'
    ): Promise<AuthSession | null> {
        const tokenHash = this.hashRefreshToken(refreshToken);
        const now = BigInt(Date.now());

        const session = await prisma.authSession.findFirst({
            where: {
                refreshTokenHash: tokenHash,
                userType,
                isRevoked: false,
                expiresAt: {
                    gt: now, // Greater than now = not expired
                },
            },
        });

        if (!session) {
            logger.warn({ userType }, 'Refresh token verification failed: Session not found or expired');
            return null;
        }

        logger.debug({ sessionId: session.id, userId: session.userId }, 'Refresh token verified successfully');
        return session;
    }

    /**
     * Revoke a specific session by ID
     */
    async revokeSession(sessionId: number): Promise<void> {
        await prisma.authSession.update({
            where: { id: sessionId },
            data: { isRevoked: true },
        });

        logger.info({ sessionId }, 'Session revoked');
    }

    /**
     * Revoke all sessions for a user (logout from all devices)
     */
    async revokeAllUserSessions(userId: number, userType: 'inventory' | 'ecommerce'): Promise<number> {
        const result = await prisma.authSession.updateMany({
            where: {
                userId,
                userType,
                isRevoked: false,
            },
            data: {
                isRevoked: true,
            },
        });

        logger.info({
            userId,
            userType,
            revokedCount: result.count,
        }, 'Revoked all user sessions');

        return result.count;
    }

    /**
     * Get active session count for a user
     */
    async getActiveSessionCount(userId: number, userType: 'inventory' | 'ecommerce'): Promise<number> {
        const now = BigInt(Date.now());
        const count = await prisma.authSession.count({
            where: {
                userId,
                userType,
                isRevoked: false,
                expiresAt: {
                    gt: now,
                },
            },
        });

        return count;
    }

    /**
     * Get all active sessions for a user
     */
    async getUserActiveSessions(userId: number, userType: 'inventory' | 'ecommerce'): Promise<AuthSession[]> {
        const now = BigInt(Date.now());
        const sessions = await prisma.authSession.findMany({
            where: {
                userId,
                userType,
                isRevoked: false,
                expiresAt: {
                    gt: now,
                },
            },
            orderBy: {
                createddate: 'desc',
            },
        });

        return sessions;
    }

    /**
     * Enforce session limit per user (keep only N most recent sessions)
     */
    async enforceSessionLimit(
        userId: number,
        userType: 'inventory' | 'ecommerce',
        maxSessions: number = 5
    ): Promise<number> {
        // Get all active sessions ordered by creation date (newest first)
        const sessions = await this.getUserActiveSessions(userId, userType);

        if (sessions.length <= maxSessions) {
            return 0; // No sessions to revoke
        }

        // Get sessions to revoke (oldest ones beyond the limit)
        const sessionsToRevoke = sessions.slice(maxSessions);
        const sessionIds = sessionsToRevoke.map(s => s.id);

        // Revoke old sessions
        const result = await prisma.authSession.updateMany({
            where: {
                id: { in: sessionIds },
            },
            data: {
                isRevoked: true,
            },
        });

        logger.info({
            userId,
            userType,
            revokedCount: result.count,
            maxSessions,
        }, 'Enforced session limit');

        return result.count;
    }

    /**
     * Clean up expired and old revoked sessions
     * This replaces the need for pg_cron
     */
    async cleanupExpiredSessions(): Promise<SessionCleanupResult> {
        const now = BigInt(Date.now());
        const thirtyDaysAgo = BigInt(Date.now() - (30 * 24 * 60 * 60 * 1000));

        // Delete expired sessions
        const expiredResult = await prisma.authSession.deleteMany({
            where: {
                expiresAt: {
                    lt: now, // Less than now = expired
                },
            },
        });

        // Delete revoked sessions older than 30 days
        const revokedResult = await prisma.authSession.deleteMany({
            where: {
                isRevoked: true,
                modifieddate: {
                    lt: thirtyDaysAgo,
                },
            },
        });

        const result: SessionCleanupResult = {
            deletedCount: expiredResult.count + revokedResult.count,
            deletedExpired: expiredResult.count,
            deletedRevoked: revokedResult.count,
        };

        logger.info(result, 'Cleaned up expired auth sessions');

        return result;
    }

    /**
     * Update session's last activity (IP and user agent)
     */
    async updateSessionActivity(
        sessionId: number,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        const updateData: any = {};
        if (ipAddress !== undefined) updateData.ipAddress = ipAddress;
        if (userAgent !== undefined) updateData.userAgent = userAgent;

        await prisma.authSession.update({
            where: { id: sessionId },
            data: updateData,
        });
    }

    /**
     * Rotate refresh token (delete old, create new)
     * Used during token refresh to prevent replay attacks
     */
    async rotateRefreshToken(
        oldRefreshToken: string,
        newRefreshToken: string,
        userType: 'inventory' | 'ecommerce',
        expiresInDays: number,
        ipAddress?: string,
        userAgent?: string
    ): Promise<AuthSession | null> {
        // Verify old token exists and is valid
        const oldSession = await this.verifyRefreshToken(oldRefreshToken, userType);

        if (!oldSession) {
            return null;
        }

        // Revoke old session
        await this.revokeSession(oldSession.id);

        // Create new session
        const newSession = await this.createSession({
            userId: oldSession.userId,
            userType: oldSession.userType as 'inventory' | 'ecommerce',
            refreshToken: newRefreshToken,
            expiresInDays,
            ...(ipAddress && { ipAddress }),
            ...(userAgent && { userAgent }),
            ...(!ipAddress && oldSession.ipAddress && { ipAddress: oldSession.ipAddress }),
            ...(!userAgent && oldSession.userAgent && { userAgent: oldSession.userAgent }),
        });

        logger.info({
            oldSessionId: oldSession.id,
            newSessionId: newSession.id,
            userId: oldSession.userId,
        }, 'Rotated refresh token');

        return newSession;
    }

    /**
     * Get session by ID
     */
    async getSessionById(sessionId: number): Promise<AuthSession | null> {
        return await prisma.authSession.findUnique({
            where: { id: sessionId },
        });
    }

    /**
     * Get recent session activity for security auditing
     */
    async getRecentSessionActivity(userId: number, userType: 'inventory' | 'ecommerce', limit: number = 10) {
        return await prisma.authSession.findMany({
            where: {
                userId,
                userType,
            },
            orderBy: {
                createddate: 'desc',
            },
            take: limit,
            select: {
                id: true,
                createddate: true,
                ipAddress: true,
                userAgent: true,
                isRevoked: true,
                expiresAt: true,
            },
        });
    }
}

// Singleton instance
export const authSessionService = new AuthSessionService();
