import { logger } from '../config/logger.js';
import { sanitizeUserData, authRateLimit } from '../utils/auth.js';
import { InventoryUsersService } from '../services/inventoryusers.service.js';
/**
 * Global authentication middleware for all protected routes
 * This middleware ensures that ALL routes using it require authentication
 */
export async function requireAuthentication(request, reply) {
    try {
        // Get token from Authorization header or query parameter
        const authHeader = request.headers.authorization;
        const tokenFromQuery = request.query && typeof request.query === 'object' ?
            request.query.token : undefined;
        let token;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        else if (tokenFromQuery) {
            token = tokenFromQuery;
        }
        if (!token) {
            logger.warn({
                ip: request.ip,
                url: request.url,
                method: request.method,
                userAgent: request.headers['user-agent']
            }, 'Authentication failed: No token provided');
            return reply.code(401).send({
                success: false,
                message: 'Authentication required',
                details: 'Please provide a valid Bearer token in the Authorization header or as a query parameter',
                statusCode: 401,
                authenticationRequired: true,
                authenticationMethods: [
                    'Bearer token in Authorization header',
                    'Token query parameter (?token=YOUR_TOKEN)'
                ]
            });
        }
        // Check rate limiting for this token/IP
        const identifier = `${request.ip}-${token}`;
        if (authRateLimit.isRateLimited(identifier)) {
            const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
            logger.warn({
                ip: request.ip,
                identifier,
                remainingAttempts
            }, 'Authentication rate limited');
            return reply.code(429).send({
                success: false,
                message: 'Too many authentication attempts',
                details: 'Please try again later',
                statusCode: 429,
                remainingAttempts,
                retryAfter: 900 // 15 minutes
            });
        }
        const inventoryUsersService = new InventoryUsersService();
        // Find user with this session token
        try {
            const users = await inventoryUsersService.findMany({ sessiontoken: token }, 1, 1);
            if (!users.data || users.data.length === 0) {
                authRateLimit.recordAttempt(identifier);
                logger.warn({
                    token: token.substring(0, 8) + '...',
                    ip: request.ip,
                    userAgent: request.headers['user-agent']
                }, 'Authentication failed: Invalid or expired token');
                return reply.code(401).send({
                    success: false,
                    message: 'Invalid authentication token',
                    details: 'The provided token is not valid, has expired, or the user has been signed out',
                    statusCode: 401,
                    tokenStatus: 'invalid_or_expired',
                    suggestion: 'Please sign in again to get a new token'
                });
            }
            const user = users.data[0];
            // Clear rate limiting on successful authentication
            authRateLimit.clearAttempts(identifier);
            // Attach sanitized user data to request
            request.user = sanitizeUserData(user);
            logger.debug({
                userId: user.id,
                email: user.useremail,
                role: user.role,
                endpoint: request.url
            }, 'User authenticated successfully for protected route');
        }
        catch (error) {
            authRateLimit.recordAttempt(identifier);
            logger.error({ error, token: token.substring(0, 8) + '...', endpoint: request.url }, 'Error during authentication');
            return reply.code(500).send({
                success: false,
                message: 'Authentication error',
                details: 'An error occurred while verifying your authentication',
                statusCode: 500,
            });
        }
    }
    catch (error) {
        logger.error({ error, endpoint: request.url }, 'Unexpected error in authentication middleware');
        return reply.code(500).send({
            success: false,
            message: 'Authentication error',
            details: 'An unexpected error occurred during authentication',
            statusCode: 500,
        });
    }
}
/**
 * Authentication middleware for inventory users (alias for backward compatibility)
 */
export const authenticateInventoryUser = requireAuthentication;
/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export async function optionalAuthentication(request, reply) {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No authentication provided, continue without user
            return;
        }
        // If authentication is provided, verify it
        await authenticateInventoryUser(request, reply);
    }
    catch (error) {
        // Log but don't fail the request
        logger.warn({ error }, 'Optional authentication failed');
    }
}
/**
 * Role-based authorization middleware
 */
export function requireRole(allowedRoles) {
    return async (request, reply) => {
        if (!request.user) {
            logger.warn({
                ip: request.ip,
                url: request.url
            }, 'Authorization failed: User not authenticated');
            return reply.code(401).send({
                success: false,
                message: 'Authentication required',
                details: 'You must be authenticated to access this resource',
                statusCode: 401,
            });
        }
        const userRole = request.user.role;
        if (!userRole || !allowedRoles.includes(userRole)) {
            logger.warn({
                userId: request.user.id,
                userRole,
                allowedRoles,
                url: request.url
            }, 'Authorization failed: Insufficient permissions');
            return reply.code(403).send({
                success: false,
                message: 'Insufficient permissions',
                details: `You need one of the following roles: ${allowedRoles.join(', ')}`,
                statusCode: 403,
            });
        }
        logger.debug({
            userId: request.user.id,
            userRole,
            url: request.url
        }, 'Role authorization successful');
    };
}
/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole(['admin', 'super_admin']);
/**
 * Middleware to require manager role or higher
 */
export const requireManager = requireRole(['manager', 'admin', 'super_admin']);
/**
 * Self-authorization middleware - user can only access their own resources
 */
export async function requireSelfOrAdmin(request, reply) {
    if (!request.user) {
        return reply.code(401).send({
            success: false,
            message: 'Authentication required',
            statusCode: 401,
        });
    }
    const requestedUserId = parseInt(request.params.id);
    const currentUserId = request.user.id;
    const userRole = request.user.role;
    // Allow if user is admin or accessing their own resource
    const isAdmin = userRole && ['admin', 'super_admin'].includes(userRole);
    const isSelf = requestedUserId === currentUserId;
    if (!isAdmin && !isSelf) {
        logger.warn({
            currentUserId,
            requestedUserId,
            userRole
        }, 'Authorization failed: Cannot access other user resources');
        return reply.code(403).send({
            success: false,
            message: 'Access denied',
            details: 'You can only access your own resources',
            statusCode: 403,
        });
    }
    logger.debug({
        currentUserId,
        requestedUserId,
        userRole,
        isAdmin,
        isSelf
    }, 'Self or admin authorization successful');
}
//# sourceMappingURL=auth.middleware.js.map