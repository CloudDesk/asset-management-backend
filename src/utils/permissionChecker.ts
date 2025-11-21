/*
import { prisma } from '../models/prisma.js';
import logger from '../config/logger.js';

export interface PermissionContext {
  object: string;
  action: string;
  resourceId?: string;
  resourceOwnerId?: string | number;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  inheritedFrom?: string;
  scope?: {
    viewAll: boolean;
    modifyAll: boolean;
    deleteAll: boolean;
  };
}


export async function checkPermission(
  userId: number,
  object: string,
  action: string,
  context?: PermissionContext
): Promise<PermissionResult> {
  try {
    // Get user's active roles
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        role: {
          include: {
            parentRole: true,
            permissionSets: {
              where: { isActive: true, isDefault: true },
              include: {
                permissions: {
                  where: { object }
                }
              }
            }
          }
        }
      },
      orderBy: {
        role: {
          level: 'asc' // Higher authority first
        }
      }
    });

    if (userRoles.length === 0) {
      return {
        allowed: false,
        reason: 'User has no active roles'
      };
    }

    // Check each role (sorted by level - ascending = higher authority first)
    for (const userRole of userRoles) {
      const role = userRole.role;
      const permissionSet = role.permissionSets[0]; // Get default permission set
      
      if (!permissionSet) {
        // Check parent role if exists
        if (role.parentRole) {
          const parentPermission = await getPermissionForRole(
            role.parentRole.id,
            object
          );
          if (parentPermission && checkAction(parentPermission, action)) {
            return {
              allowed: true,
              inheritedFrom: `parent:${role.parentRole.name}`,
              scope: {
                viewAll: parentPermission.viewAll,
                modifyAll: parentPermission.modifyAll,
                deleteAll: parentPermission.deleteAll
              }
            };
          }
        }
        continue;
      }

      const permission = permissionSet.permissions.find(p => p.object === object);
      
      if (permission && checkAction(permission, action)) {
        // Check scope restrictions
        if (context && !checkScope(permission, action, context)) {
          continue; // Try next role
        }

        return {
          allowed: true,
          inheritedFrom: role.name,
          scope: {
            viewAll: permission.viewAll,
            modifyAll: permission.modifyAll,
            deleteAll: permission.deleteAll
          }
        };
      }
    }

    return {
      allowed: false,
      reason: 'No permission found in role hierarchy'
    };
  } catch (error) {
    logger.error({ error, userId, object, action }, 'Error checking permission');
    return {
      allowed: false,
      reason: 'Error checking permission'
    };
  }
}

export async function getUserPermissions(userId: number): Promise<{
  roles: string[];
  permissions: Record<string, any>;
  fieldPermissions: Record<string, Record<string, any>>;
}> {
  try {
    // Get user's active roles
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        role: {
          include: {
            permissionSets: {
              where: { isActive: true, isDefault: true },
              include: {
                permissions: true,
                fieldPermissions: true
              }
            }
          }
        }
      },
      orderBy: {
        role: {
          level: 'asc'
        }
      }
    });

    const roles: string[] = [];
    const permissions: Record<string, any> = {};
    const fieldPermissions: Record<string, Record<string, any>> = {};

    for (const userRole of userRoles) {
      const role = userRole.role;
      roles.push(role.code);

      const permissionSet = role.permissionSets[0];
      if (!permissionSet) continue;

      // Merge permissions (higher authority wins)
      for (const perm of permissionSet.permissions) {
        if (!permissions[perm.object]) {
          permissions[perm.object] = {};
        }
        
        // Merge with existing (don't override if already true from higher role)
        permissions[perm.object] = {
          read: permissions[perm.object].read || perm.read,
          create: permissions[perm.object].create || perm.create,
          edit: permissions[perm.object].edit || perm.edit,
          delete: permissions[perm.object].delete || perm.delete,
          export: permissions[perm.object].export || perm.export,
          import: permissions[perm.object].import || perm.import,
          approve: permissions[perm.object].approve || perm.approve,
          reject: permissions[perm.object].reject || perm.reject,
          viewAll: permissions[perm.object].viewAll || perm.viewAll,
          modifyAll: permissions[perm.object].modifyAll || perm.modifyAll,
          deleteAll: permissions[perm.object].deleteAll || perm.deleteAll,
          customActions: {
            ...permissions[perm.object].customActions,
            ...(perm.customActions as Record<string, boolean> || {})
          }
        };
      }

      // Merge field permissions
      for (const fieldPerm of permissionSet.fieldPermissions) {
        if (!fieldPermissions[fieldPerm.object]) {
          fieldPermissions[fieldPerm.object] = {};
        }
        
        if (!fieldPermissions[fieldPerm.object][fieldPerm.field]) {
          fieldPermissions[fieldPerm.object][fieldPerm.field] = {};
        }
        
        // Merge (don't override if already allowed from higher role)
        fieldPermissions[fieldPerm.object][fieldPerm.field] = {
          canRead: fieldPermissions[fieldPerm.object][fieldPerm.field].canRead || fieldPerm.canRead,
          canWrite: fieldPermissions[fieldPerm.object][fieldPerm.field].canWrite || fieldPerm.canWrite,
          canView: fieldPermissions[fieldPerm.object][fieldPerm.field].canView || fieldPerm.canView,
          canEdit: fieldPermissions[fieldPerm.object][fieldPerm.field].canEdit || fieldPerm.canEdit,
          maskValue: fieldPermissions[fieldPerm.object][fieldPerm.field].maskValue || fieldPerm.maskValue,
          maskPattern: fieldPermissions[fieldPerm.object][fieldPerm.field].maskPattern || fieldPerm.maskPattern
        };
      }
    }

    return {
      roles: [...new Set(roles)],
      permissions,
      fieldPermissions
    };
  } catch (error) {
    logger.error({ error, userId }, 'Error getting user permissions');
    throw error;
  }
}


function checkAction(permission: any, action: string): boolean {
  switch (action) {
    case 'read': return permission.read;
    case 'create': return permission.create;
    case 'edit': return permission.edit;
    case 'delete': return permission.delete;
    case 'export': return permission.export;
    case 'import': return permission.import;
    case 'approve': return permission.approve;
    case 'reject': return permission.reject;
    default:
      // Check custom actions
      if (permission.customActions) {
        return permission.customActions[action] === true;
      }
      return false;
  }
}

function checkScope(
  permission: any,
  action: string,
  context: PermissionContext
): boolean {
  // If viewAll/modifyAll/deleteAll is true, scope check passes
  if (action === 'read' && permission.viewAll) return true;
  if (action === 'edit' && permission.modifyAll) return true;
  if (action === 'delete' && permission.deleteAll) return true;

  // Otherwise, check if user owns the resource
  if (context.resourceOwnerId) {
    // This will be checked in the route handler
    return true; // Allow, but ownership will be checked separately
  }

  return false;
}

async function getPermissionForRole(
  roleId: string,
  object: string
): Promise<any> {
  const permissionSet = await prisma.permissionSet.findFirst({
    where: {
      roleId,
      isActive: true,
      isDefault: true
    },
    include: {
      permissions: {
        where: { object }
      }
    }
  });

  return permissionSet?.permissions[0] || null;
}

export async function bulkCheckPermissions(
  userId: number,
  checks: Array<{ object: string; action: string }>
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  await Promise.all(
    checks.map(async (check) => {
      const result = await checkPermission(userId, check.object, check.action);
      results[`${check.object}.${check.action}`] = result.allowed;
    })
  );

  return results;
}
*/