import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger.js';
import { sanitizeUserData, authRateLimit } from '../utils/auth.js';
import { InventoryUsersService } from '../services/inventoryusers.service.js';

// Define authenticated request interface
// Supports both inventory and ecommerce users with different field structures
export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: number;
    // Email & Contact - different requirements per user type
    useremail?: string;              // Required for inventory, optional for ecommerce
    usermobilenumber?: number;       // Ecommerce users (BigInt from DB)
    usersphonenumber?: number;       // Inventory users (BigInt from DB)

    // Name fields - both user types have these but different usage
    firstname?: string;
    lastname?: string;

    // Role-based fields - only for inventory users
    role?: string;
    roleId?: number;

    // User type differentiation
    userType?: 'inventory' | 'ecommerce';

    // Additional optional fields
    location?: string;               // Inventory users only
    gender?: string;                 // Ecommerce users only
    gstnumber?: string;              // Ecommerce users only
    isbusinessuser?: boolean;        // Ecommerce users only
  };
}

/**
 * Global authentication middleware for all protected routes
 * This middleware ensures that ALL routes using it require authentication
 */
export async function requireAuthentication(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get token from Authorization header or query parameter
    const authHeader = request.headers.authorization;
    const tokenFromQuery = request.query && typeof request.query === 'object' ?
      (request.query as any).token : undefined;

    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (tokenFromQuery) {
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

    // NOTE: Rate limiting removed from here - it should only apply to login routes
    // Applying rate limiting to every authenticated request blocks legitimate users
    // Rate limiting is handled in auth routes (signin, register, etc.)

    // Verify JWT token
    try {
      const { verifyToken } = await import('../utils/jwt.js');
      const decoded = verifyToken(token);

      // Use userType from token for direct table lookup (optimization)
      // Default to 'inventory' for backward compatibility with old tokens
      const userType = decoded.userType || 'inventory';
      let user = null;

      if (userType === 'inventory') {
        // Lookup in inventoryusers table
        try {
          const inventoryUsersService = new InventoryUsersService();
          user = await inventoryUsersService.findById(decoded.userId.toString());
          logger.debug({ userId: decoded.userId, userType: 'inventory' }, 'User found in inventoryusers table');
        } catch (error) {
          logger.debug({ userId: decoded.userId, userType: 'inventory' }, 'User not found in inventoryusers table');
        }
      } else {
        // Lookup in users table (e-commerce)
        try {
          const { UsersService } = await import('../services/users.service.js');
          const usersService = new UsersService();
          user = await usersService.findById(decoded.userId.toString());
          logger.debug({ userId: decoded.userId, userType: 'ecommerce' }, 'User found in users table');
        } catch (error) {
          logger.debug({ userId: decoded.userId, userType: 'ecommerce' }, 'User not found in users table');
        }
      }

      if (!user) {
        logger.warn({
          userId: decoded.userId,
          userType,
          ip: request.ip,
          userAgent: request.headers['user-agent']
        }, 'Authentication failed: User not found in expected table');

        return reply.code(401).send({
          success: false,
          message: 'Invalid authentication token',
          details: 'User associated with token not found',
          statusCode: 401,
          tokenStatus: 'user_not_found',
          suggestion: 'Please sign in again to get a new token'
        });
      }

      // Check token revocation (only for inventory users - they have sessiontoken field)
      if (userType === 'inventory' && (user as any).sessiontoken === null) {
        logger.warn({
          userId: decoded.userId,
          ip: request.ip
        }, 'Authentication failed: Token revoked (user signed out)');

        return reply.code(401).send({
          success: false,
          message: 'Token has been revoked',
          details: 'This token is no longer valid. Please sign in again',
          statusCode: 401,
          tokenStatus: 'revoked',
          suggestion: 'Please sign in again to get a new token'
        });
      }

      // Attach user data to request (from JWT + DB)
      request.user = {
        ...sanitizeUserData(user),
        roleId: decoded.roleId, // From JWT (undefined for e-commerce users)
        userType, // 'inventory' or 'ecommerce'
      };

      logger.debug({
        userId: user.id,
        email: (user as any).useremail,
        userType,
        roleId: decoded.roleId,
        endpoint: request.url
      }, 'User authenticated successfully with JWT token');

    } catch (error) {
      // Determine if this is a JWT-specific error (expired, invalid, etc.)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isJWTError = errorMessage.includes('jwt') ||
        errorMessage.includes('token') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('malformed');

      if (isJWTError) {
        // JWT verification failed - return 401 (authentication failure)
        logger.warn({
          error: errorMessage,
          token: token.substring(0, 8) + '...',
          endpoint: request.url,
          ip: request.ip
        }, 'JWT verification failed');

        return reply.code(401).send({
          success: false,
          message: 'Invalid or expired token',
          details: 'Your authentication token is invalid or has expired. Please sign in again',
          statusCode: 401,
          tokenStatus: 'invalid_or_expired',
          suggestion: 'Please sign in again to get a new token'
        });
      }

      // Other errors - return 500 (server error)
      logger.error({
        error,
        token: token.substring(0, 8) + '...',
        endpoint: request.url
      }, 'Unexpected error during authentication');

      return reply.code(500).send({
        success: false,
        message: 'Authentication error',
        details: 'An unexpected error occurred while verifying your authentication',
        statusCode: 500,
      });
    }
  } catch (error) {
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
export async function optionalAuthentication(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No authentication provided, continue without user
      return;
    }

    // If authentication is provided, verify it
    await authenticateInventoryUser(request, reply);
  } catch (error) {
    // Log but don't fail the request
    logger.warn({ error }, 'Optional authentication failed');
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(allowedRoles: string[]) {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
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
export async function requireSelfOrAdmin(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({
      success: false,
      message: 'Authentication required',
      statusCode: 401,
    });
  }

  const requestedUserId = parseInt((request.params as any).id);
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