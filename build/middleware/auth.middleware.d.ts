import { FastifyRequest, FastifyReply } from 'fastify';
export interface AuthenticatedRequest extends FastifyRequest {
    user?: {
        id: number;
        useremail: string;
        role?: string;
        firstname?: string;
        lastname?: string;
        roleId?: number;
        userType?: 'inventory' | 'ecommerce';
    };
}
/**
 * Global authentication middleware for all protected routes
 * This middleware ensures that ALL routes using it require authentication
 */
export declare function requireAuthentication(request: AuthenticatedRequest, reply: FastifyReply): Promise<void>;
/**
 * Authentication middleware for inventory users (alias for backward compatibility)
 */
export declare const authenticateInventoryUser: typeof requireAuthentication;
/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export declare function optionalAuthentication(request: AuthenticatedRequest, reply: FastifyReply): Promise<void>;
/**
 * Role-based authorization middleware
 */
export declare function requireRole(allowedRoles: string[]): (request: AuthenticatedRequest, reply: FastifyReply) => Promise<void>;
/**
 * Middleware to require admin role
 */
export declare const requireAdmin: (request: AuthenticatedRequest, reply: FastifyReply) => Promise<void>;
/**
 * Middleware to require manager role or higher
 */
export declare const requireManager: (request: AuthenticatedRequest, reply: FastifyReply) => Promise<void>;
/**
 * Self-authorization middleware - user can only access their own resources
 */
export declare function requireSelfOrAdmin(request: AuthenticatedRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map