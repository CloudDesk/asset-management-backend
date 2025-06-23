import { prisma } from '../models/prisma.js';
import { Prisma } from '@prisma/client';
import { 
  CreatePromotionalAssetInput, 
  UpdatePromotionalAssetInput 
} from '../schemas/promotional-assets.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { logger } from '../config/logger.js';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errorHandler.js';
import { convertBigIntToNumber } from '../utils/dynamicDbOperations.js';

export class PromotionalAssetsService {
  private async auditLog(
    assetId: number,
    action: 'create' | 'update' | 'delete',
    changedBy: string,
    changes: Record<string, any>
  ) {
    try {
      await prisma.asset_audit_logs.create({
        data: {
          asset_id: assetId,
          action,
          changed_by: changedBy,
          changes,
          createddate: BigInt(Date.now())
        }
      });
    } catch (error) {
      logger.error({ error, assetId, action }, 'Failed to create audit log');
      // Don't throw - audit logging shouldn't break the main operation
    }
  }

  async findMany(
    filters: Record<string, any>,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      const { skip, take } = getPrismaSkipTake(page, limit);
      
      // Build where clause
      const where: Prisma.promotional_assetsWhereInput = {};
      
      if (filters.type) {
        // Handle both single type and array of types
        let types = filters.type;
        
        // Handle comma-separated values in string format
        if (typeof types === 'string' && types.includes(',')) {
          types = types.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
        
        // Validate type values
        const validTypes = ['banner', 'featured_ad', 'popup', 'carousel'];
        
        if (Array.isArray(types)) {
          const invalidTypes = types.filter(t => !validTypes.includes(t));
          if (invalidTypes.length > 0) {
            throw new ValidationError(`Invalid asset types: ${invalidTypes.join(', ')}. Must be one of: ${validTypes.join(', ')}`);
          }
          where.type = { in: types };
        } else {
          if (!validTypes.includes(types)) {
            throw new ValidationError(`Invalid asset type: ${types}. Must be one of: ${validTypes.join(', ')}`);
          }
          where.type = types;
        }
      }
      
      if (filters.placement) {
        where.placement = { contains: filters.placement, mode: 'insensitive' };
      }
      
      if (filters.is_active !== undefined) {
        const isActive = filters.is_active;
        if (typeof isActive === 'string') {
          const lowerValue = isActive.toLowerCase();
          if (['true', '1', 'yes', 'on'].includes(lowerValue)) {
            where.is_active = true;
          } else if (['false', '0', 'no', 'off'].includes(lowerValue)) {
            where.is_active = false;
          } else {
            throw new ValidationError(`Invalid is_active value: ${isActive}. Must be true/false, 1/0, yes/no, or on/off`);
          }
        } else {
          where.is_active = Boolean(isActive);
        }
      }
      
      
      
      // Priority filtering - handle single value or range
      if (filters.priority !== undefined) {
        const priority = parseInt(filters.priority);
        if (isNaN(priority)) {
          throw new ValidationError('Priority must be a valid number');
        }
        where.priority = priority;
      } else if (filters.priority_min !== undefined || filters.priority_max !== undefined) {
        const priorityFilter: Prisma.IntFilter = {};
        
        if (filters.priority_min !== undefined) {
          const minPriority = parseInt(filters.priority_min);
          if (isNaN(minPriority)) {
            throw new ValidationError('Priority min must be a valid number');
          }
          priorityFilter.gte = minPriority;
        }
        
        if (filters.priority_max !== undefined) {
          const maxPriority = parseInt(filters.priority_max);
          if (isNaN(maxPriority)) {
            throw new ValidationError('Priority max must be a valid number');
          }
          priorityFilter.lte = maxPriority;
        }
        
        where.priority = priorityFilter;
      }

      // Title search filtering
      if (filters.title) {
        where.title = { contains: filters.title, mode: 'insensitive' };
      }
      
      // Content search filtering (JSONB search)
      if (filters.content_search) {
        where.content = {
          string_contains: filters.content_search
        };
      }

      // Enhanced schedule filtering
      const andConditions: Prisma.promotional_assetsWhereInput[] = [];
      
      if (filters.schedule_active === 'true') {
        const now = new Date();
        andConditions.push({
          OR: [{ schedule_start: null }, { schedule_start: { lte: now } }]
        });
        andConditions.push({
          OR: [{ schedule_end: null }, { schedule_end: { gte: now } }]
        });
      }
      
      if (filters.schedule_start) {
        try {
          const startDate = new Date(filters.schedule_start);
          if (isNaN(startDate.getTime())) {
            throw new ValidationError('Invalid schedule_start date format');
          }
          andConditions.push({
            OR: [{ schedule_start: null }, { schedule_start: { lte: startDate } }]
          });
        } catch (error) {
          throw new ValidationError('Invalid schedule_start date format');
        }
      }
      
      if (filters.schedule_end) {
        try {
          const endDate = new Date(filters.schedule_end);
          if (isNaN(endDate.getTime())) {
            throw new ValidationError('Invalid schedule_end date format');
          }
          andConditions.push({
            OR: [{ schedule_end: null }, { schedule_end: { gte: endDate } }]
          });
        } catch (error) {
          throw new ValidationError('Invalid schedule_end date format');
        }
      }
      
      if (andConditions.length > 0) {
        if (where.AND) {
          where.AND = Array.isArray(where.AND) ? [...where.AND, ...andConditions] : [where.AND, ...andConditions];
        } else {
          where.AND = andConditions;
        }
      }

      const [data, total] = await Promise.all([
        prisma.promotional_assets.findMany({
          where,
          skip,
          take,
          orderBy: [
            { priority: 'desc' },
            { createddate: 'desc' }
          ]
        }),
        prisma.promotional_assets.count({ where })
      ]);

      // Convert BigInt to number for JSON serialization
      const formattedData = data.map(asset => convertBigIntToNumber(asset));

      return createPaginationResult(formattedData, total, page, limit);
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error, 
        filters, 
        page, 
        limit 
      }, 'Error in promotional assets findMany');
      throw new DatabaseError('Failed to retrieve promotional assets');
    }
  }

  async findById(id: number) {
    try {
      const asset = await prisma.promotional_assets.findUnique({
        where: { id }
      });

      if (!asset) {
        throw new NotFoundError('Promotional asset not found');
      }

      return convertBigIntToNumber(asset);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error({ error, id }, 'Error in promotional asset findById');
      throw new DatabaseError('Failed to retrieve promotional asset');
    }
  }

  async create(data: CreatePromotionalAssetInput, userId: string) {
    try {
      // Validate schedule dates
      if (data.schedule_start && data.schedule_end) {
        const start = new Date(data.schedule_start);
        const end = new Date(data.schedule_end);
        if (start >= end) {
          throw new ValidationError('Schedule end must be after schedule start');
        }
      }

      const asset = await prisma.$transaction(async (tx) => {
        const newAsset = await tx.promotional_assets.create({
          data: {
            ...data,
            schedule_start: data.schedule_start ? new Date(data.schedule_start) : null,
            schedule_end: data.schedule_end ? new Date(data.schedule_end) : null,
          }
        });

        // Create audit log
        await tx.asset_audit_logs.create({
          data: {
            asset_id: newAsset.id,
            action: 'create',
            changed_by: userId,
            changes: { created: convertBigIntToNumber(newAsset) },
            createddate: BigInt(Date.now())
          }
        });

        return newAsset;
      });

      logger.info({ assetId: asset.id, userId }, 'Promotional asset created successfully');
      return convertBigIntToNumber(asset);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error({ 
        error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error, 
        data, 
        userId 
      }, 'Error creating promotional asset');
      throw new DatabaseError('Failed to create promotional asset');
    }
  }

  async update(id: number, data: UpdatePromotionalAssetInput, userId: string) {
    try {
      const existingAsset = await this.findById(id);
      
      // Optimistic concurrency check
      if (data.version && existingAsset.version !== data.version) {
        throw new ValidationError(
          'Asset has been modified by another user. Please refresh and try again.',
          'Concurrency conflict detected'
        );
      }

      // Remove version from update data
      const { version, ...updateData } = data;

      const updatedAsset = await prisma.$transaction(async (tx) => {
        const updated = await tx.promotional_assets.update({
          where: { id },
          data: {
            ...updateData,
            schedule_start: updateData.schedule_start ? new Date(updateData.schedule_start) : undefined,
            schedule_end: updateData.schedule_end ? new Date(updateData.schedule_end) : undefined,
            version: { increment: 1 }
          }
        });

        // Create audit log with diff
        const changes = this.createDiff(existingAsset, convertBigIntToNumber(updated));
        await tx.asset_audit_logs.create({
          data: {
            asset_id: id,
            action: 'update',
            changed_by: userId,
            changes,
            createddate: BigInt(Date.now())
          }
        });

        return updated;
      });

      logger.info({ assetId: id, userId }, 'Promotional asset updated successfully');
      return convertBigIntToNumber(updatedAsset);
    } catch (error) {
      logger.error({ error, id, data, userId }, 'Error updating promotional asset');
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to update promotional asset');
    }
  }

  async delete(id: number, userId: string) {
    try {
      const existingAsset = await this.findById(id);

      await prisma.$transaction(async (tx) => {
        // Create audit log before deletion
        await tx.asset_audit_logs.create({
          data: {
            asset_id: id,
            action: 'delete',
            changed_by: userId,
            changes: { deleted: existingAsset },
            createddate: BigInt(Date.now())
          }
        });

        await tx.promotional_assets.delete({
          where: { id }
        });
      });

      logger.info({ assetId: id, userId }, 'Promotional asset deleted successfully');
    } catch (error) {
      logger.error({ error, id, userId }, 'Error deleting promotional asset');
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete promotional asset');
    }
  }

  async getAuditLogs(assetId: number, page: number = 1, limit: number = 20) {
    try {
      const { skip, take } = getPrismaSkipTake(page, limit);
      
      const [logs, total] = await Promise.all([
        prisma.asset_audit_logs.findMany({
          where: { asset_id: assetId },
          skip,
          take,
          orderBy: { createddate: 'desc' }
        }),
        prisma.asset_audit_logs.count({ where: { asset_id: assetId } })
      ]);

      // Convert BigInt to number for JSON serialization
      const formattedLogs = logs.map(log => convertBigIntToNumber(log));

      return createPaginationResult(formattedLogs, total, page, limit);
    } catch (error) {
      logger.error({ error, assetId }, 'Error retrieving audit logs');
      throw new DatabaseError('Failed to retrieve audit logs');
    }
  }

  private createDiff(oldData: any, newData: any): Record<string, any> {
    const changes: Record<string, any> = {
      before: {},
      after: {}
    };

    for (const key in newData) {
      if (JSON.stringify(newData[key]) !== JSON.stringify(oldData[key])) {
        changes.before[key] = oldData[key];
        changes.after[key] = newData[key];
      }
    }

    return changes;
  }
} 