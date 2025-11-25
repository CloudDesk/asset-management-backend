import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';
import { PermissionSetService } from '../services/permissionset.service.js';
import { getDbTableName } from './permissionMapper.js';

const permissionSetService = new PermissionSetService();

export interface PermissionContext {
  object: string;
  action: string;
  resourceid?: string;
  resourceownerid?: number;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  inheritedFrom?: string;
  scope?: {
    viewall: boolean;
    modifyall: boolean;
    deleteall: boolean;
  };
}

/**
 * Permission object structure (from JSONB)
 */
interface PermissionObject {
  object: string;
  read?: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  export?: boolean;
  import?: boolean;
  approve?: boolean;
  reject?: boolean;
  viewall?: boolean;
  modifyall?: boolean;
  deleteall?: boolean;
  accesslevel?: 'all' | 'own' | 'subordinates';
  customactions?: Record<string, boolean>;
}

/**
 * Get permission set for an inventory user
 * Uses selection logic: active set for role → parent role → system default
 */
async function getPermissionSetForUser(userid: number): Promise<any> {
  try {
    // Get inventory user with roleid
    const inventoryUser = await (prisma as any).inventoryusers.findUnique({
      where: { id: userid },
      select: {
        id: true,
        roleid: true
      }
    });

    if (!inventoryUser || !inventoryUser.roleid) {
      logger.debug({ userid }, 'User has no role assigned');
      return null;
    }

    const roleId = inventoryUser.roleid.toString();

    // Get the user's actual role directly from roles table
    const userRole = await (prisma as any).role.findUnique({
      where: { id: inventoryUser.roleid },
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        parentroleid: true
      }
    });

    if (!userRole) {
      logger.warn({ userid, roleid: inventoryUser.roleid }, 'User role not found in roles table');
      return null;
    }

    // Use PermissionSetService to get permission set (handles parent role and system default)
    const permissionSet = await permissionSetService.getPermissionSetForRole(roleId, true);

    if (!permissionSet) {
      logger.debug({ userid, roleId }, 'No permission set found for role');
      return null;
    }

    // Always return the user's actual role, not the role from permission set
    // (permission set might be from parent role or system default)
    return {
      permissionSet,
      role: userRole // User's actual role from inventoryusers.roleid
    };
  } catch (error) {
    logger.error({ error, userid }, 'Error getting permission set for user');
    return null;
  }
}

/**
 * Check if action is allowed in permission object
 */
function checkAction(permission: PermissionObject, action: string): boolean {
  switch (action) {
    case 'read': return permission.read === true;
    case 'create': return permission.create === true;
    case 'edit': return permission.edit === true;
    case 'delete': return permission.delete === true;
    case 'export': return permission.export === true;
    case 'import': return permission.import === true;
    case 'approve': return permission.approve === true;
    case 'reject': return permission.reject === true;
    default:
      return permission.customactions?.[action] === true;
  }
}

/**
 * Check if user has permission for an action on an object
 * Implements both Layer 1 and Layer 2 security
 * 
 * @param userid - Inventory user ID
 * @param object - Object name (frontend format, e.g., "products")
 * @param action - Action to check (read, create, edit, delete, etc.)
 * @param context - Optional context (resourceid, resourceownerid)
 * @returns PermissionResult with allowed status and details
 */
export async function checkPermission(
  userid: number,
  object: string,
  action: string,
  context?: PermissionContext
): Promise<PermissionResult> {
  try {
    logger.debug({ userid, object, action, context }, 'Checking permission');

    // Get permission set for user
    const userPermissionData = await getPermissionSetForUser(userid);

    if (!userPermissionData || !userPermissionData.permissionSet) {
      return {
        allowed: false,
        reason: 'User has no role or permission set assigned'
      };
    }

    const { permissionSet, role } = userPermissionData;

    // Parse permissions from JSONB
    const permissions = permissionSet.permissions as PermissionObject[];

    if (!Array.isArray(permissions)) {
      return {
        allowed: false,
        reason: 'Invalid permission set structure'
      };
    }

    // Convert frontend object name to DB table name for lookup
    const dbObjectName = getDbTableName(object);
    
    // Find permission for this object (check both frontend name and DB name)
    const permission = permissions.find(p => 
      p.object === object || p.object === dbObjectName
    );

    if (!permission) {
      return {
        allowed: false,
        reason: `No permission found for object '${object}'`
      };
    }

    // LAYER 2: Check object-level permission
    const hasObjectPermission = checkAction(permission, action);
    if (!hasObjectPermission) {
      return {
        allowed: false,
        reason: `Action '${action}' not allowed for object '${object}'`
      };
    }

    // LAYER 2: Check record-level permission (if record owner provided)
    if (context?.resourceownerid !== undefined) {
      const isOwner = userid === context.resourceownerid;

      if (isOwner) {
        // Owner: Basic permission is enough
        return {
          allowed: true,
          inheritedFrom: role?.name || 'Unknown',
          scope: {
            viewall: permission.viewall === true,
            modifyall: permission.modifyall === true,
            deleteall: permission.deleteall === true
          }
        };
      } else {
        // Non-owner: Check cross-ownership permissions
        switch (action) {
          case 'read':
            if (!permission.viewall) {
              return {
                allowed: false,
                reason: 'Cannot view records owned by others (viewall: false)'
              };
            }
            break;
          case 'edit':
            if (!permission.modifyall) {
              return {
                allowed: false,
                reason: 'Cannot modify records owned by others (modifyall: false)'
              };
            }
            break;
          case 'delete':
            if (!permission.deleteall) {
              return {
                allowed: false,
                reason: 'Cannot delete records owned by others (deleteall: false)'
              };
            }
            break;
        }
      }
    }

    return {
      allowed: true,
      inheritedFrom: role?.name || 'Unknown',
      scope: {
        viewall: permission.viewall === true,
        modifyall: permission.modifyall === true,
        deleteall: permission.deleteall === true
      }
    };
  } catch (error) {
    logger.error({ error, userid, object, action }, 'Error checking permission');
    return {
      allowed: false,
      reason: 'Error checking permission'
    };
  }
}

/**
 * Get all permissions for a user (for frontend)
 * Returns permissions in a format suitable for frontend consumption
 * 
 * @param userid - Inventory user ID
 * @returns Object with role info and permissions map
 */
export async function getUserPermissions(userid: number): Promise<{
  role: {
    id: number;
    name: string;
    code: string;
    level: number;
  } | null;
  permissions: Record<string, PermissionObject>;
}> {
  try {
    logger.debug({ userid }, 'Getting user permissions');

    // Get permission set for user
    const userPermissionData = await getPermissionSetForUser(userid);

    if (!userPermissionData || !userPermissionData.permissionSet) {
      logger.debug({ userid }, 'No permission set found for user');
      return {
        role: null,
        permissions: {}
      };
    }

    const { permissionSet, role: userRole } = userPermissionData;

    // Parse permissions from JSONB
    const permissionsArray = permissionSet.permissions as PermissionObject[];

    if (!Array.isArray(permissionsArray)) {
      logger.warn({ userid }, 'Invalid permission set structure');
      return {
        role: userRole ? {
          id: userRole.id,
          name: userRole.name,
          code: userRole.code,
          level: (userRole as any).level || 0
        } : null,
        permissions: {}
      };
    }

    // IMPORTANT: Get full role details from database using the user's actual roleid
    // The permission set might be from a parent role or system default,
    // but we always want to return the user's actual role
    // Re-fetch the user to ensure we have the correct roleid
    const currentUser = await (prisma as any).inventoryusers.findUnique({
      where: { id: userid },
      select: {
        roleid: true
      }
    });

    let fullRole = null;
    if (currentUser && currentUser.roleid) {
      const roleDetails = await (prisma as any).role.findUnique({
        where: { id: currentUser.roleid },
        select: {
          id: true,
          name: true,
          code: true,
          level: true,
          description: true,
          isactive: true
        }
      });
      
      if (roleDetails) {
        fullRole = {
          id: roleDetails.id,
          name: roleDetails.name,
          code: roleDetails.code,
          level: roleDetails.level || 0
        };
        logger.debug({ userid, roleId: roleDetails.id, roleName: roleDetails.name }, 'Using user\'s actual role from inventoryusers.roleid');
      } else {
        logger.warn({ userid, roleid: currentUser.roleid }, 'Role not found in roles table');
      }
    } else {
      logger.warn({ userid }, 'User has no roleid assigned');
    }

    // Convert to frontend-friendly format
    // Keep frontend object names (don't convert to DB names)
    const permissions: Record<string, PermissionObject> = {};

    for (const perm of permissionsArray) {
      // Use the object name as-is (should be frontend format)
      // If it's DB format, we'll keep it (frontend can handle both)
      const objectKey = perm.object.toLowerCase();
      
      permissions[objectKey] = {
        object: perm.object,
        read: perm.read || false,
        create: perm.create || false,
        edit: perm.edit || false,
        delete: perm.delete || false,
        export: perm.export || false,
        import: perm.import || false,
        approve: perm.approve || false,
        reject: perm.reject || false,
        viewall: perm.viewall || false,
        modifyall: perm.modifyall || false,
        deleteall: perm.deleteall || false,
        accesslevel: perm.accesslevel || 'own',
        customactions: perm.customactions || {}
      };
    }

    return {
      role: fullRole,
      permissions
    };
  } catch (error) {
    logger.error({ error, userid }, 'Error getting user permissions');
    throw error;
  }
}
