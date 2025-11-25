import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';
import { CreateRoleInput, UpdateRoleInput } from '../schemas/role.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
import { 
  dynamicFindManyWithFilters,
  dynamicFindUnique, 
  dynamicCreate, 
  dynamicUpdate, 
  dynamicDelete
} from '../utils/dynamicDbOperations.js';

export class RoleService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting roles findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use direct Prisma query with includes
      const whereClause: any = {};
      
      // Build where clause from filters
      if (filters.name) whereClause.name = { contains: String(filters.name), mode: 'insensitive' };
      if (filters.code) whereClause.code = { contains: String(filters.code), mode: 'insensitive' };
      if (filters.level !== undefined) whereClause.level = parseInt(String(filters.level));
      if (filters.isactive !== undefined) {
        const isactiveValue = Array.isArray(filters.isactive) ? filters.isactive[0] : filters.isactive;
        whereClause.isactive = typeof isactiveValue === 'boolean' ? isactiveValue : String(isactiveValue) === 'true';
      }
      if (filters.issystem !== undefined) {
        const issystemValue = Array.isArray(filters.issystem) ? filters.issystem[0] : filters.issystem;
        whereClause.issystem = typeof issystemValue === 'boolean' ? issystemValue : String(issystemValue) === 'true';
      }
      if (filters.parentroleid) whereClause.parentroleid = parseInt(String(filters.parentroleid));

      // Extract sorting parameters from filters
      const { sortBy, sortOrder, ...actualFilters } = filters;
      
      // Determine sort field and direction
      const sortField = sortBy ? String(sortBy).toLowerCase() : 'level';
      const sortDirection = sortOrder?.toString().toUpperCase() === 'DESC' ? 'desc' : 'asc';
      
      // Validate sort field (only allow id, name, level)
      const allowedSortFields = ['id', 'name', 'level'];
      const finalSortField = allowedSortFields.includes(sortField) ? sortField : 'level';
      
      // Build orderBy object
      const orderBy: any = {};
      orderBy[finalSortField] = sortDirection;

      const [roles, total] = await Promise.all([
        (prisma as any).role.findMany({
          where: whereClause,
          skip,
          take,
          include: {
            permissionsets: {
              where: { isactive: true },
              select: {
                id: true,
                name: true,
                description: true,
                isactive: true,
                isdefault: true
              }
            },
            inventoryusers: {
              select: {
                id: true,
                useremail: true,
                firstname: true,
                lastname: true
              }
            },
            parentrole: {
              select: {
                id: true,
                name: true,
                code: true
              }
            },
            childroles: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          },
          orderBy: orderBy // Dynamic sorting based on query parameters
        }),
        (prisma as any).role.count({ where: whereClause })
      ]);

      logger.info({
        roleCount: roles.length, 
        total,
        filtered: Object.keys(actualFilters).length > 0,
        sortBy: finalSortField,
        sortDirection: sortDirection
      }, 'Roles findMany completed');

      return createPaginationResult(roles, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in roles findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug({ roleId: id }, 'Starting role findById operation');

      const role = await (prisma as any).role.findUnique({
        where: { id: parseInt(id) },
        include: {
          permissionsets: {
            where: { isactive: true },
            select: {
              id: true,
              name: true,
              description: true,
              isactive: true,
              isdefault: true,
              permissions: true
            }
          },
          inventoryusers: {
            select: {
              id: true,
              useremail: true,
              firstname: true,
              lastname: true
            }
          },
          parentrole: {
            select: {
              id: true,
              name: true,
              code: true,
              level: true
            }
          },
          childroles: {
            select: {
              id: true,
              name: true,
              code: true,
              level: true
            }
          }
        }
      });

      if (!role) {
        throw new Error('Role not found');
      }

      logger.debug({ roleId: id }, 'Role findById completed');
      return role;
    } catch (error) {
      logger.error({ error, roleId: id }, 'Error in role findById operation');
      throw error;
    }
  }

  async findByCode(code: string) {
    try {
      logger.debug({ code }, 'Starting role findByCode operation');

      const role = await (prisma as any).role.findUnique({
        where: { code },
        include: {
          permissionsets: {
            where: { isactive: true, isdefault: true },
            take: 1
          }
        }
      });

      logger.debug({ code, found: !!role }, 'Role findByCode completed');
      return role;
    } catch (error) {
      logger.error({ error, code }, 'Error in role findByCode operation');
      throw error;
    }
  }

  async create(data: CreateRoleInput) {
    try {
      logger.info({ data }, 'Starting role create operation');

      // Normalize code to lowercase for case-insensitive uniqueness check
      const normalizedCode = data.code.toLowerCase().trim();

      // Check if code already exists (case-insensitive)
      const existingRole = await (prisma as any).role.findUnique({
        where: { code: normalizedCode }
      });

      if (existingRole) {
        throw new Error(`Role with code '${normalizedCode}' already exists`);
      }

      // Check if name already exists
      const existingName = await (prisma as any).role.findUnique({
        where: { name: data.name }
      });

      if (existingName) {
        throw new Error(`Role with name '${data.name}' already exists`);
      }

      // Handle level uniqueness - find the actual level to use
      // Level must be provided and >= 1 (validated by schema)
      let targetLevel = data.level;
      
      if (!targetLevel || targetLevel < 1) {
        throw new Error('Level must be at least 1');
      }
      
      // Get max level in database (only consider valid levels >= 1)
      const maxLevelRole = await (prisma as any).role.findFirst({
        where: {
          level: {
            gte: 1  // Only consider valid levels
          }
        },
        orderBy: { level: 'desc' },
        select: { level: true }
      });
      
      const maxLevel = maxLevelRole?.level || 0; // 0 means no valid levels exist
      
      // Only adjust if there are valid levels in the database and requested level exceeds max + 1
      // If maxLevel is 0 (no valid roles), allow any level >= 1 as-is
      if (maxLevel >= 1 && targetLevel > maxLevel + 1) {
        targetLevel = maxLevel + 1;
        logger.info({ requestedLevel: data.level, adjustedLevel: targetLevel, maxLevel }, 'Level adjusted to next available');
      } else if (maxLevel === 0 && targetLevel >= 1) {
        // No valid levels exist, allow the requested level as-is (already validated to be >= 1)
        logger.debug({ requestedLevel: data.level, targetLevel }, 'No valid levels exist, using requested level');
      }
      
      // Check if target level already exists
      const existingLevelRole = await (prisma as any).role.findUnique({
        where: { level: targetLevel }
      });

      // If level exists, shift all roles with level >= targetLevel by +1
      if (existingLevelRole) {
        logger.info({ targetLevel }, 'Level conflict detected, shifting existing roles');
        
        // Get all roles with level >= targetLevel, ordered by level descending
        const rolesToShift = await (prisma as any).role.findMany({
          where: {
            level: {
              gte: targetLevel
            }
          },
          orderBy: { level: 'desc' }
        });

        // Shift each role's level by +1 (starting from highest to avoid conflicts)
        for (const roleToShift of rolesToShift) {
          await (prisma as any).role.update({
            where: { id: roleToShift.id },
            data: {
              level: roleToShift.level + 1,
              modifieddate: BigInt(Date.now())
            }
          });
        }
        
        logger.info({ shiftedCount: rolesToShift.length, newLevel: targetLevel }, 'Roles shifted successfully');
      }

      // Set timestamps
      const now = BigInt(Date.now());
      const roleData: any = {
        name: data.name,
        code: normalizedCode, // Use normalized code
        level: targetLevel,
        description: data.description,
        isactive: data.isactive ?? true,
        issystem: data.issystem ?? false,
        createddate: data.createddate || now,
        modifieddate: data.modifieddate || now
      };
      
      // Only include parentroleid if provided
      if (data.parentroleid !== undefined && data.parentroleid !== null) {
        roleData.parentroleid = data.parentroleid;
      }

      const role = await (prisma as any).role.create({
        data: roleData,
        include: {
          permissionsets: true,
          parentrole: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });

      logger.info({ roleId: role.id, level: role.level }, 'Role created successfully');
      return role;
    } catch (error) {
      logger.error({ error, data }, 'Error in role create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdateRoleInput) {
    try {
      logger.info({ roleId: id, data }, 'Starting role update operation');

      // Check if role exists
      const existingRole = await (prisma as any).role.findUnique({
        where: { id: parseInt(id) }
      });

      if (!existingRole) {
        throw new Error('Role not found');
      }

      // Check if code is being updated and if it already exists (case-insensitive)
      let normalizedCode: string | undefined;
      if (data.code) {
        normalizedCode = data.code.toLowerCase().trim();
        if (normalizedCode !== existingRole.code.toLowerCase()) {
          const codeExists = await (prisma as any).role.findUnique({
            where: { code: normalizedCode }
          });
          if (codeExists) {
            throw new Error(`Role with code '${normalizedCode}' already exists`);
          }
        }
      }

      // Check if name is being updated and if it already exists
      if (data.name && data.name !== existingRole.name) {
        const nameExists = await (prisma as any).role.findUnique({
          where: { name: data.name }
        });
        if (nameExists) {
          throw new Error(`Role with name '${data.name}' already exists`);
        }
      }

      // Prevent updating system roles
      if (existingRole.issystem && (data.issystem === false || data.isactive === false)) {
        throw new Error('Cannot deactivate or modify system roles');
      }

      // Handle level uniqueness if level is being updated
      let targetLevel = data.level !== undefined ? data.level : existingRole.level;
      
      // Validate level is at least 1
      if (targetLevel < 1) {
        throw new Error('Level must be at least 1');
      }
      
      // If level is being updated (provided in payload)
      if (data.level !== undefined) {
        // If the existing role has an invalid level (0 or less), always update it
        if (existingRole.level < 1) {
          logger.info({ 
            roleId: id, 
            existingLevel: existingRole.level, 
            newLevel: data.level 
          }, 'Updating role with invalid level to valid level');
        }
        
        // Only do conflict resolution if level is actually changing
        if (data.level !== existingRole.level) {
        // Get max level in database (only consider valid levels >= 1)
        const maxLevelRole = await (prisma as any).role.findFirst({
          where: {
            level: {
              gte: 1  // Only consider valid levels
            }
          },
          orderBy: { level: 'desc' },
          select: { level: true }
        });
        
        const maxLevel = maxLevelRole?.level || 0; // 0 means no valid levels exist
        
        // Only adjust if there are valid levels in the database and requested level exceeds max + 1
        // If maxLevel is 0 (no valid roles), allow any level >= 1 as-is
        if (maxLevel >= 1 && targetLevel > maxLevel + 1) {
          targetLevel = maxLevel + 1;
          logger.info({ requestedLevel: data.level, adjustedLevel: targetLevel, maxLevel }, 'Level adjusted to next available');
        } else if (maxLevel === 0 && targetLevel >= 1) {
          // No valid levels exist, allow the requested level as-is (already validated to be >= 1)
          logger.debug({ requestedLevel: data.level, targetLevel }, 'No valid levels exist, using requested level');
        }
        
        // Check if target level already exists (and it's not the current role)
        const existingLevelRole = await (prisma as any).role.findUnique({
          where: { level: targetLevel }
        });

        // If level exists and it's a different role, shift roles
        if (existingLevelRole && existingLevelRole.id !== existingRole.id) {
          logger.info({ targetLevel, currentLevel: existingRole.level }, 'Level conflict detected, shifting existing roles');
          
          // If moving to a higher level, shift roles from old level to new level
          if (targetLevel > existingRole.level) {
            // Shift roles between old level and new level down by 1
            const rolesToShift = await (prisma as any).role.findMany({
              where: {
                level: {
                  gt: existingRole.level,
                  lte: targetLevel
                },
                id: {
                  not: parseInt(id) // Exclude current role
                }
              },
              orderBy: { level: 'asc' }
            });

            // Shift each role's level down by 1
            for (const roleToShift of rolesToShift) {
              await (prisma as any).role.update({
                where: { id: roleToShift.id },
                data: {
                  level: roleToShift.level - 1,
                  modifieddate: BigInt(Date.now())
                }
              });
            }
          } else {
            // Moving to a lower level, shift roles from new level to old level up by 1
            const rolesToShift = await (prisma as any).role.findMany({
              where: {
                level: {
                  gte: targetLevel,
                  lt: existingRole.level
                },
                id: {
                  not: parseInt(id) // Exclude current role
                }
              },
              orderBy: { level: 'desc' }
            });

            // Shift each role's level up by 1 (starting from highest to avoid conflicts)
            for (const roleToShift of rolesToShift) {
              await (prisma as any).role.update({
                where: { id: roleToShift.id },
                data: {
                  level: roleToShift.level + 1,
                  modifieddate: BigInt(Date.now())
                }
              });
            }
          }
          
          logger.info({ newLevel: targetLevel }, 'Roles shifted successfully');
        }
        }
      } else {
        // Level not provided in update - keep existing level, but validate it
        if (targetLevel < 1) {
          logger.warn({ roleId: id, level: targetLevel }, 'Existing role has invalid level, but no update provided');
        }
      }

      // Set modified timestamp
      const updateData: any = {
        ...data,
        modifieddate: BigInt(Date.now()),
        parentroleid: data.parentroleid !== undefined ? data.parentroleid : existingRole.parentroleid
      };

      // Use normalized code if provided
      if (normalizedCode !== undefined) {
        updateData.code = normalizedCode;
      }

      // Always set level to targetLevel (which is either the provided level or existing level)
      // This ensures level is always set correctly, even if it wasn't in the update payload
      updateData.level = targetLevel;
      
      logger.debug({ 
        roleId: id, 
        targetLevel, 
        providedLevel: data.level, 
        existingLevel: existingRole.level,
        updateDataLevel: updateData.level 
      }, 'Setting level in update data');

      const role = await (prisma as any).role.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          permissionsets: {
            where: { isactive: true }
          },
          parentrole: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          childroles: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });

      logger.info({ roleId: role.id, level: role.level }, 'Role updated successfully');
      return role;
    } catch (error) {
      logger.error({ error, roleId: id, data }, 'Error in role update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      logger.info({ roleId: id }, 'Starting role delete operation');

      const role = await (prisma as any).role.findUnique({
        where: { id: parseInt(id) },
        include: {
          permissionsets: true,
          inventoryusers: true
        }
      });

      if (!role) {
        throw new Error('Role not found');
      }

      // Prevent deleting system roles
      if (role.issystem) {
        throw new Error('Cannot delete system roles');
      }

      // Check if role has users assigned
      if (role.inventoryusers && role.inventoryusers.length > 0) {
        throw new Error(`Cannot delete role: ${role.inventoryusers.length} user(s) are assigned to this role`);
      }

      // Check if role has permission sets
      if (role.permissionsets && role.permissionsets.length > 0) {
        // Soft delete: deactivate instead of hard delete
        const updatedRole = await (prisma as any).role.update({
          where: { id: parseInt(id) },
          data: {
            isactive: false,
            modifieddate: BigInt(Date.now())
          }
        });

        logger.info({ roleId: id }, 'Role deactivated (soft delete)');
        return updatedRole;
      }

      // Hard delete if no dependencies
      await (prisma as any).role.delete({
        where: { id: parseInt(id) }
      });

      logger.info({ roleId: id }, 'Role deleted successfully');
      return { id: parseInt(id), deleted: true };
    } catch (error) {
      logger.error({ error, roleId: id }, 'Error in role delete operation');
      throw error;
    }
  }

  async previewLevelChange(level: number, excludeRoleId?: number) {
    try {
      logger.info({ level, excludeRoleId }, 'Starting level change preview');

      // Validate level
      if (level < 1) {
        throw new Error('Level must be at least 1');
      }

      // Get all roles that would be affected
      const affectedRoles = await (prisma as any).role.findMany({
        where: {
          level: {
            gte: level
          },
          ...(excludeRoleId ? { id: { not: excludeRoleId } } : {})
        },
        select: {
          id: true,
          name: true,
          code: true,
          level: true
        },
        orderBy: { level: 'asc' }
      });

      // Check if level already exists
      const existingRoleAtLevel = await (prisma as any).role.findFirst({
        where: {
          level: level,
          ...(excludeRoleId ? { id: { not: excludeRoleId } } : {})
        },
        select: {
          id: true,
          name: true,
          code: true,
          level: true
        }
      });

      // Calculate new levels for affected roles
      const impact = affectedRoles.map((role: any) => ({
        roleId: role.id,
        roleName: role.name,
        roleCode: role.code,
        currentLevel: role.level,
        newLevel: role.level + 1
      }));

      const result = {
        requestedLevel: level,
        levelExists: !!existingRoleAtLevel,
        existingRoleAtLevel: existingRoleAtLevel ? {
          id: existingRoleAtLevel.id,
          name: existingRoleAtLevel.name,
          code: existingRoleAtLevel.code,
          level: existingRoleAtLevel.level
        } : null,
        affectedRolesCount: affectedRoles.length,
        impact: impact,
        message: existingRoleAtLevel
          ? `Level ${level} is currently assigned to "${existingRoleAtLevel.name}". This role will take Level ${level}, and ${affectedRoles.length} role(s) will be shifted up.`
          : affectedRoles.length > 0
          ? `Level ${level} is available. ${affectedRoles.length} role(s) at or above this level will be shifted up.`
          : `Level ${level} is available and no other roles will be affected.`
      };

      logger.info({ 
        level, 
        affectedCount: affectedRoles.length,
        levelExists: !!existingRoleAtLevel 
      }, 'Level change preview completed');

      return result;
    } catch (error) {
      logger.error({ error, level, excludeRoleId }, 'Error in level change preview');
      throw error;
    }
  }
}

