import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger.js';
import { verifyToken } from '../utils/jwt.js';
import { InventoryUsersService } from '../services/inventoryusers.service.js';
import { AuthenticatedRequest } from './auth.middleware.js';

/**
 * Optional Authentication Middleware
 * - If token provided: Verify and attach user to request
 * - If no token: Continue without user (public access)
 * - Use for routes that work for both authenticated and guest users
 */
export async function optionalAuth(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // If no token provided, continue as guest (no user attached)
    if (!token) {
      logger.debug({ 
        url: request.url,
        method: request.method
      }, 'No token provided - continuing as guest user');
      return; // Continue without authentication
    }

    // If token provided, verify it
    try {
      const decoded = verifyToken(token);

      // Try inventoryusers first
      const inventoryUsersService = new InventoryUsersService();
      let user = await inventoryUsersService.findById(decoded.userId.toString());
      let userType: 'inventory' | 'ecommerce' = 'inventory';

      // If not found, try users table
      if (!user) {
        const { UsersService } = await import('../services/users.service.js');
        const usersService = new UsersService();
        const ecommerceUser = await usersService.findById(decoded.userId.toString());
        
        if (ecommerceUser) {
          user = ecommerceUser;
          userType = 'ecommerce';
        }
      }

      if (user) {
        // Attach user to request
        request.user = {
          ...user,
          roleId: decoded.roleId,
          userType,
        };
        
        logger.debug({ 
          userId: user.id, 
          userType,
          endpoint: request.url
        }, 'User authenticated (optional auth)');
      } else {
        logger.debug({ 
          userId: decoded.userId,
          endpoint: request.url
        }, 'Token provided but user not found - continuing as guest');
        // Continue as guest (don't fail)
      }
    } catch (error: any) {
      // Token invalid/expired - continue as guest (don't fail)
      logger.debug({ 
        error: error.message,
        endpoint: request.url
      }, 'Token invalid - continuing as guest user');
      // Don't throw error - just continue without user
    }
  } catch (error) {
    logger.error({ error }, 'Error in optional auth middleware');
    // Don't fail - continue as guest
  }
}

/**
 * Flexible Authentication Middleware
 * Supports both inventoryusers and users tables
 * Same as requireAuthentication but with better user type detection
 */
export async function flexibleAuth(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  // Use the same logic as requireAuthentication
  // This is just an alias for clarity
  const { requireAuthentication } = await import('./auth.middleware.js');
  return requireAuthentication(request, reply);
}

