import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';
import { CreatePermissionSetInput, UpdatePermissionSetInput } from '../schemas/permissionset.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';

export class PermissionSetService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting permission sets findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Build where clause from filters
      const whereClause: any = {};
      
      if (filters.name) whereClause.name = { contains: String(filters.name), mode: 'insensitive' };
      if (filters.roleid) whereClause.roleid = parseInt(String(filters.roleid));
      if (filters.isactive !== undefined) {
        const isactiveValue = Array.isArray(filters.isactive) ? filters.isactive[0] : filters.isactive;
        whereClause.isactive = typeof isactiveValue === 'boolean' ? isactiveValue : String(isactiveValue) === 'true';
      }
      if (filters.isdefault !== undefined) {
        const isdefaultValue = Array.isArray(filters.isdefault) ? filters.isdefault[0] : filters.isdefault;
        whereClause.isdefault = typeof isdefaultValue === 'boolean' ? isdefaultValue : String(isdefaultValue) === 'true';
      }

      const [permissionSets, total] = await Promise.all([
        (prisma as any).permissionset.findMany({
          where: whereClause,
          skip,
          take,
          include: {
            role: {
              select: {
                id: true,
                name: true,
                code: true,
                level: true
              }
            }
          },
          orderBy: { id: 'desc' }
        }),
        (prisma as any).permissionset.count({ where: whereClause })
      ]);

      logger.info({
        permissionSetCount: permissionSets.length, 
        total,
        filtered: Object.keys(filters).length > 0
      }, 'Permission sets findMany completed');

      return createPaginationResult(permissionSets, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in permission sets findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug({ permissionSetId: id }, 'Starting permission set findById operation');

      const permissionSet = await (prisma as any).permissionset.findUnique({
        where: { id: parseInt(id) },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              code: true,
              level: true,
              description: true
            }
          }
        }
      });

      if (!permissionSet) {
        throw new Error('Permission set not found');
      }

      logger.debug({ permissionSetId: id }, 'Permission set findById completed');
      return permissionSet;
    } catch (error) {
      logger.error({ error, permissionSetId: id }, 'Error in permission set findById operation');
      throw error;
    }
  }

  async findByRoleId(roleid: string, activeOnly: boolean = true) {
    try {
      logger.debug({ roleid, activeOnly }, 'Starting permission set findByRoleId operation');

      const whereClause: any = { 
        roleid: parseInt(roleid)
      };

      if (activeOnly) {
        whereClause.isactive = true;
      }

      const permissionSets = await (prisma as any).permissionset.findMany({
        where: whereClause,
        include: {
          role: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        },
        orderBy: [
          { isdefault: 'desc' }, // Default first
          { createddate: 'asc' } // Then by creation date
        ]
      });

      logger.debug({ roleid, count: permissionSets.length, activeOnly }, 'Permission set findByRoleId completed');
      return permissionSets;
    } catch (error) {
      logger.error({ error, roleid }, 'Error in permission set findByRoleId operation');
      throw error;
    }
  }

  /**
   * Get permission set for a role using selection logic:
   * 1. Default active permission set for the role
   * 2. First active permission set for the role
   * 3. Check parent role (if exists) - recursive
   * 4. null if none found
   * 
   * BEST PRACTICE: With "one active per role" enforcement, this should always return
   * the single active permission set for the role (or parent role).
   */
  async getPermissionSetForRole(roleid: string, checkParent: boolean = true): Promise<any> {
    try {
      logger.debug({ roleid, checkParent }, 'Starting getPermissionSetForRole operation');

      // Get role with parent info
      const role = await (prisma as any).role.findUnique({
        where: { id: parseInt(roleid) },
        select: {
          id: true,
          name: true,
          code: true,
          parentroleid: true
        }
      });

      if (!role) {
        logger.debug({ roleid }, 'Role not found');
        return null;
      }

      // Priority 1: Active permission set for this role
      // With "one active per role" enforcement, there should be only one
      const activeSet = await (prisma as any).permissionset.findFirst({
        where: {
          roleid: parseInt(roleid),
          isactive: true
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        },
        orderBy: { createddate: 'asc' } // Oldest first (shouldn't matter with one active per role)
      });

      if (activeSet) {
        logger.debug({ roleid, permissionSetId: activeSet.id }, 'Found active permission set for role');
        return activeSet;
      }

      // Priority 3: Check parent role (if exists and checkParent is true)
      if (checkParent && role.parentroleid) {
        logger.debug({ roleid, parentRoleId: role.parentroleid }, 'No active permission set found, checking parent role');
        const parentSet = await this.getPermissionSetForRole(String(role.parentroleid), true);
        if (parentSet) return parentSet;
      }

      // Priority 4: System-wide default (FALLBACK)
      // isdefault = system-wide default, not per-role
      const systemDefault = await (prisma as any).permissionset.findFirst({
        where: {
          isdefault: true,
          isactive: true
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });

      if (systemDefault) {
        logger.debug({ roleid, systemDefaultId: systemDefault.id }, 'Using system-wide default permission set as fallback');
        return systemDefault;
      }

      logger.debug({ roleid }, 'No active permission set found for role, parent, or system default');
      return null;
    } catch (error) {
      logger.error({ error, roleid }, 'Error in getPermissionSetForRole operation');
      throw error;
    }
  }

  async create(data: CreatePermissionSetInput) {
    try {
      logger.info({ data }, 'Starting permission set create operation');

      // Check if role exists (only if roleid is provided, not null)
      if (data.roleid !== null && data.roleid !== undefined) {
        const role = await (prisma as any).role.findUnique({
          where: { id: data.roleid }
        });

        if (!role) {
          throw new Error(`Role with ID ${data.roleid} not found`);
        }
      }

      // Validation: System default permission set must be active
      if (data.isdefault === true && data.isactive === false) {
        throw new Error('System default permission set must be active');
      }

      // Rule 1: If setting as system default, unset ALL other system defaults (system-wide, not per-role)
      if (data.isdefault === true) {
        await (prisma as any).permissionset.updateMany({
          where: {
            isdefault: true
            // No roleid filter - system default is system-wide
          },
          data: {
            isdefault: false,
            modifieddate: BigInt(Date.now())
          }
        });
        logger.info({ roleid: data.roleid }, 'Unset other system-wide default permission sets');
        // Ensure isActive is true for system default
        data.isactive = true;
      }

      // Rule 2: BEST PRACTICE - Enforce ONE active permission set per role
      // If creating a new active permission set for a role, deactivate all others for that role
      if (data.isactive !== false && data.roleid) { // Only for role-specific sets
        const existingActiveSets = await (prisma as any).permissionset.findMany({
          where: {
            roleid: data.roleid,
            isactive: true
          },
          select: { id: true }
        });

        if (existingActiveSets.length > 0) {
          // Deactivate all existing active sets for this role
          await (prisma as any).permissionset.updateMany({
            where: {
              roleid: data.roleid,
              isactive: true
            },
            data: {
              isactive: false,
              isdefault: false, // Also unset default when deactivating (shouldn't be default anyway)
              modifieddate: BigInt(Date.now())
            }
          });
          logger.info({ 
            roleid: data.roleid, 
            deactivatedCount: existingActiveSets.length 
          }, 'Deactivated existing active permission sets for role (one active per role enforced)');
        }
      }

      // Convert frontend permission object names to DB table names
      const { convertPermissionsToDb } = await import('../utils/permissionMapper.js');
      const convertedPermissions = convertPermissionsToDb(data.permissions);

      // Set timestamps
      const now = BigInt(Date.now());
      const permissionSetData: any = {
        name: data.name,
        description: data.description || null,
        roleid: data.roleid ?? null, // Explicitly set to null if undefined
        isactive: data.isactive ?? true,
        isdefault: data.isdefault ?? false,
        permissions: convertedPermissions, // Use converted permissions with DB table names
        createddate: data.createddate || now,
        modifieddate: data.modifieddate || now
      };

      // Create permission set - don't use include when roleid is null to avoid Prisma validation issues
      const includeRole = data.roleid !== null && data.roleid !== undefined;
      
      let permissionSet: any;
      
      if (includeRole) {
        // When roleid is provided, include the role relation
        permissionSet = await (prisma as any).permissionset.create({
          data: permissionSetData,
          include: {
            role: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        });
      } else {
        // When roleid is null, create without include and manually set role to null
        permissionSet = await (prisma as any).permissionset.create({
          data: permissionSetData
        });
        permissionSet.role = null;
      }

      logger.info({ permissionSetId: permissionSet.id, roleid: data.roleid }, 'Permission set created successfully');
      return permissionSet;
    } catch (error) {
      logger.error({ error, data }, 'Error in permission set create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdatePermissionSetInput) {
    try {
      logger.info({ permissionSetId: id, data }, 'Starting permission set update operation');

      // Check if permission set exists
      const existingPermissionSet = await (prisma as any).permissionset.findUnique({
        where: { id: parseInt(id) }
      });

      if (!existingPermissionSet) {
        throw new Error('Permission set not found');
      }

      // Validation: If roleid is being set to null, isdefault MUST be true
      const finalRoleId = data.roleid !== undefined ? data.roleid : existingPermissionSet.roleid;
      const targetIsDefault = data.isdefault !== undefined ? data.isdefault : existingPermissionSet.isdefault;
      
      if (finalRoleId === null && targetIsDefault !== true) {
        throw new Error('If roleid is null, isdefault must be true (system-wide default).');
      }

      // If roleid is being updated, check if new role exists (only for role-specific sets)
      if (data.roleid !== undefined && data.roleid !== null && data.roleid !== existingPermissionSet.roleid) {
        const role = await (prisma as any).role.findUnique({
          where: { id: data.roleid }
        });
        if (!role) {
          throw new Error(`Role with ID ${data.roleid} not found`);
        }
      }

      // Rule 1: Cannot deactivate if it's the only active set for the role (unless it's system default)
      if (data.isactive === false && existingPermissionSet.roleid) {
        const otherActiveSets = await (prisma as any).permissionset.findMany({
          where: {
            roleid: existingPermissionSet.roleid,
            isactive: true,
            id: {
              not: parseInt(id) // Exclude current permission set
            }
          }
        });

        // If this is the only active set for the role, prevent deactivation
        // (System default can still be used as fallback)
        if (otherActiveSets.length === 0) {
          throw new Error('Cannot deactivate the only active permission set for this role. System default will be used as fallback, but it\'s recommended to have an active set for the role.');
        }
      }

      // Rule 1b: Cannot deactivate system default (system default must stay active)
      if (data.isactive === false && existingPermissionSet.isdefault === true) {
        throw new Error('Cannot deactivate system default permission set. System default must always be active.');
      }

      // Rule 2: System default permission set must be active
      if (data.isdefault === true && data.isactive === false) {
        throw new Error('System default permission set must be active');
      }

      // Rule 3: If setting as system default, unset ALL other system defaults (system-wide)
      if (data.isdefault === true) {
        await (prisma as any).permissionset.updateMany({
          where: {
            isdefault: true,
            id: {
              not: parseInt(id) // Exclude current permission set
            }
          },
          data: {
            isdefault: false,
            modifieddate: BigInt(Date.now())
          }
        });
        logger.info({ permissionSetId: id }, 'Unset other system-wide default permission sets');
        // Force isActive to true for system default
        data.isactive = true;
      }

      // Rule 4: BEST PRACTICE - If activating this permission set for a role, deactivate all others for that role
      // This enforces "one active per role" rule
      if ((data.isactive === true || (data.isactive === undefined && existingPermissionSet.isactive === false)) && existingPermissionSet.roleid) {
        const targetRoleIdForDeactivation = data.roleid || existingPermissionSet.roleid;
        
        // Deactivate all other active sets for this role
        await (prisma as any).permissionset.updateMany({
          where: {
            roleid: targetRoleIdForDeactivation,
            isactive: true,
            id: {
              not: parseInt(id) // Exclude current permission set
            }
          },
          data: {
            isactive: false,
            isdefault: false, // Also unset default when deactivating (shouldn't be default anyway)
            modifieddate: BigInt(Date.now())
          }
        });
        logger.info({ 
          roleid: targetRoleIdForDeactivation, 
          permissionSetId: id 
        }, 'Deactivated other active permission sets (one active per role enforced)');
        
        // Ensure this one is active
        data.isactive = true;
      }

      // Convert frontend permission object names to DB table names (if permissions are being updated)
      let convertedPermissions = data.permissions;
      if (data.permissions) {
        const { convertPermissionsToDb } = await import('../utils/permissionMapper.js');
        convertedPermissions = convertPermissionsToDb(data.permissions);
      }

      // Set modified timestamp
      const updateData: any = {
        ...data,
        ...(convertedPermissions && { permissions: convertedPermissions }), // Use converted permissions if provided
        modifieddate: BigInt(Date.now())
      };

      // Update permission set - don't use include when roleid is null to avoid Prisma validation issues
      const includeRole = finalRoleId !== null && finalRoleId !== undefined;
      
      let permissionSet: any;
      
      if (includeRole) {
        // When roleid is provided, include the role relation
        permissionSet = await (prisma as any).permissionset.update({
          where: { id: parseInt(id) },
          data: updateData,
          include: {
            role: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        });
      } else {
        // When roleid is null, update without include and manually set role to null
        permissionSet = await (prisma as any).permissionset.update({
          where: { id: parseInt(id) },
          data: updateData
        });
        permissionSet.role = null;
      }

      logger.info({ permissionSetId: permissionSet.id }, 'Permission set updated successfully');
      return permissionSet;
    } catch (error) {
      logger.error({ error, permissionSetId: id, data }, 'Error in permission set update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      logger.info({ permissionSetId: id }, 'Starting permission set delete operation');

      const permissionSet = await (prisma as any).permissionset.findUnique({
        where: { id: parseInt(id) }
      });

      if (!permissionSet) {
        throw new Error('Permission set not found');
      }

      // Hard delete (no dependencies to check)
      await (prisma as any).permissionset.delete({
        where: { id: parseInt(id) }
      });

      logger.info({ permissionSetId: id }, 'Permission set deleted successfully');
      return { id: parseInt(id), deleted: true };
    } catch (error) {
      logger.error({ error, permissionSetId: id }, 'Error in permission set delete operation');
      throw error;
    }
  }

  /**
   * Preview the impact of activating a permission set for a role
   * Shows which permission sets would be deactivated (due to "one active per role" enforcement)
   */
  async previewActivation(roleid: string, permissionSetId?: number) {
    try {
      logger.info({ roleid, permissionSetId }, 'Starting permission set activation preview');

      const roleIdInt = parseInt(roleid);

      // Check if role exists
      const role = await (prisma as any).role.findUnique({
        where: { id: roleIdInt },
        select: {
          id: true,
          name: true,
          code: true
        }
      });

      if (!role) {
        throw new Error(`Role with ID ${roleid} not found`);
      }

      // Get all currently active permission sets for this role
      const currentlyActiveSets = await (prisma as any).permissionset.findMany({
        where: {
          roleid: roleIdInt,
          isactive: true,
          ...(permissionSetId ? { id: { not: permissionSetId } } : {}) // Exclude the one being activated if updating
        },
        select: {
          id: true,
          name: true,
          description: true,
          isactive: true,
          isdefault: true,
          createddate: true
        },
        orderBy: { createddate: 'asc' }
      });

      // Get the permission set being activated (if provided)
      let activatingSet: any = null;
      if (permissionSetId) {
        activatingSet = await (prisma as any).permissionset.findUnique({
          where: { id: permissionSetId },
          select: {
            id: true,
            name: true,
            description: true,
            roleid: true,
            isactive: true,
            isdefault: true
          }
        });

        if (!activatingSet) {
          throw new Error(`Permission set with ID ${permissionSetId} not found`);
        }

        // Verify it belongs to the same role (or can be assigned to this role)
        if (activatingSet.roleid && activatingSet.roleid !== roleIdInt) {
          throw new Error(`Permission set ${permissionSetId} belongs to a different role (${activatingSet.roleid}). Cannot activate for role ${roleid}.`);
        }
      }

      // Build impact array
      const impact = currentlyActiveSets.map((set: any) => ({
        permissionSetId: set.id,
        permissionSetName: set.name,
        description: set.description,
        currentStatus: 'active',
        newStatus: 'inactive',
        isDefault: set.isdefault,
        createdDate: set.createddate
      }));

      // Build message
      let message = '';
      if (activatingSet) {
        message = `Activating "${activatingSet.name}" will deactivate ${currentlyActiveSets.length} currently active permission set(s) for role "${role.name}".`;
      } else {
        message = `Activating a new permission set for role "${role.name}" will deactivate ${currentlyActiveSets.length} currently active permission set(s).`;
      }

      if (currentlyActiveSets.length === 0) {
        message = `No currently active permission sets for role "${role.name}". Activating a new permission set will not affect any existing sets.`;
      }

      const result = {
        roleId: roleIdInt,
        roleName: role.name,
        roleCode: role.code,
        activatingPermissionSet: activatingSet ? {
          id: activatingSet.id,
          name: activatingSet.name,
          description: activatingSet.description,
          currentStatus: activatingSet.isactive ? 'active' : 'inactive',
          newStatus: 'active'
        } : null,
        currentlyActiveCount: currentlyActiveSets.length,
        willBeDeactivated: impact,
        impact: impact,
        message: message
      };

      logger.info({ 
        roleid, 
        permissionSetId,
        affectedCount: currentlyActiveSets.length 
      }, 'Permission set activation preview completed');

      return result;
    } catch (error) {
      logger.error({ error, roleid, permissionSetId }, 'Error in permission set activation preview');
      throw error;
    }
  }

  /**
   * Preview the impact of setting a permission set as system-wide default
   * Shows which existing system default would be unset
   */
  async previewSystemDefault(permissionSetId?: number) {
    try {
      logger.info({ permissionSetId }, 'Starting system default preview');

      // Get the permission set being set as system default (if provided)
      let settingAsDefault: any = null;
      if (permissionSetId) {
        settingAsDefault = await (prisma as any).permissionset.findUnique({
          where: { id: permissionSetId },
          select: {
            id: true,
            name: true,
            description: true,
            roleid: true,
            isactive: true,
            isdefault: true
          }
        });

        if (!settingAsDefault) {
          throw new Error(`Permission set with ID ${permissionSetId} not found`);
        }

        // Validation: If roleid is not null, cannot be system default
        if (settingAsDefault.roleid !== null) {
          throw new Error(`Permission set ${permissionSetId} has a roleid (${settingAsDefault.roleid}). System default must have roleid: null.`);
        }
      }

      // Get current system-wide default (if exists)
      const currentSystemDefault = await (prisma as any).permissionset.findFirst({
        where: {
          isdefault: true,
          isactive: true,
          ...(permissionSetId ? { id: { not: permissionSetId } } : {}) // Exclude the one being set as default if updating
        },
        select: {
          id: true,
          name: true,
          description: true,
          roleid: true,
          isactive: true,
          isdefault: true,
          createddate: true
        }
      });

      // Build impact
      const impact = currentSystemDefault ? [{
        permissionSetId: currentSystemDefault.id,
        permissionSetName: currentSystemDefault.name,
        description: currentSystemDefault.description,
        currentStatus: 'system default',
        newStatus: 'not default',
        roleid: currentSystemDefault.roleid,
        isActive: currentSystemDefault.isactive,
        createdDate: currentSystemDefault.createddate
      }] : [];

      // Build message
      let message = '';
      if (settingAsDefault) {
        if (currentSystemDefault) {
          message = `Setting "${settingAsDefault.name}" as system-wide default will unset the current system default "${currentSystemDefault.name}".`;
        } else {
          message = `Setting "${settingAsDefault.name}" as system-wide default. No existing system default to unset.`;
        }
      } else {
        if (currentSystemDefault) {
          message = `Creating a new system-wide default will unset the current system default "${currentSystemDefault.name}".`;
        } else {
          message = `No existing system-wide default. This will be the first system default.`;
        }
      }

      const result = {
        settingAsDefault: settingAsDefault ? {
          id: settingAsDefault.id,
          name: settingAsDefault.name,
          description: settingAsDefault.description,
          roleid: settingAsDefault.roleid,
          currentIsDefault: settingAsDefault.isdefault,
          newIsDefault: true
        } : null,
        currentSystemDefault: currentSystemDefault ? {
          id: currentSystemDefault.id,
          name: currentSystemDefault.name,
          description: currentSystemDefault.description,
          roleid: currentSystemDefault.roleid,
          isactive: currentSystemDefault.isactive
        } : null,
        willBeUnset: impact,
        impact: impact,
        message: message
      };

      logger.info({ 
        permissionSetId,
        hasCurrentDefault: !!currentSystemDefault 
      }, 'System default preview completed');

      return result;
    } catch (error) {
      logger.error({ error, permissionSetId }, 'Error in system default preview');
      throw error;
    }
  }
}

