import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger.js';
import { requireAuthentication, optionalAuthentication, AuthenticatedRequest } from './auth.middleware.js';
import { isPublicRoute } from '../config/publicRoutes.js';

/**
 * Smart Authentication Middleware
 * 
 * This middleware automatically determines if a route requires authentication
 * by checking against the public routes whitelist.
 * 
 * - Public routes: Skip authentication, continue to handler
 * - Protected routes: Require authentication via requireAuthentication middleware
 * 
 * This provides a centralized way to manage route protection without
 * manually adding preHandler to each route.
 */
export async function smartAuthentication(
    request: AuthenticatedRequest,
    reply: FastifyReply
): Promise<void> {
    const method = request.method;
    const url = request.url;

    // Check if this route is in the public routes list
    const isPublic = isPublicRoute(method, url);

    if (isPublic) {
        // Public route - skip authentication
        logger.debug({
            method,
            url,
            ip: request.ip,
        }, 'Public route accessed - authentication skipped');

        return; // Continue without authentication
    }

    // Protected route - require authentication
    logger.debug({
        method,
        url,
        ip: request.ip,
    }, 'Protected route accessed - authentication required');

    return requireAuthentication(request, reply);
}

/**
 * Optional Smart Authentication Middleware
 * 
 * Similar to smartAuthentication, but for routes that benefit from
 * authentication when available but don't strictly require it.
 * 
 * - If token provided: Verify and attach user to request
 * - If no token: Continue without user (guest access)
 */
export async function optionalSmartAuthentication(
    request: AuthenticatedRequest,
    reply: FastifyReply
): Promise<void> {
    const authHeader = request.headers.authorization;

    // If no token provided, continue as guest
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.debug({
            method: request.method,
            url: request.url,
            ip: request.ip,
        }, 'No authentication provided - continuing as guest');
        return;
    }

    // Attach the user for a valid token. Invalid or expired tokens are ignored
    // on guest-capable routes without committing a 401 response.
    await optionalAuthentication(request, reply);
}
