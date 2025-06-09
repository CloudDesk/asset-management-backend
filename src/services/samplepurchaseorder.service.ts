import { prisma } from '../models/prisma.js';
import { 
  CreateSamplePurchaseOrderInput, 
  UpdateSamplePurchaseOrderInput, 
  UpsertSamplePurchaseOrderInput
} from '../schemas/samplepurchaseorder.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
import { 
  dynamicFindMany, 
  dynamicCount, 
  dynamicFindUnique, 
  dynamicCreate, 
  dynamicUpdate, 
  dynamicDelete,
  dynamicFindManyWithFilters
} from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';

export class SamplePurchaseOrderService {
  /**
   * Find sample purchase orders with dynamic filtering and pagination
   * Supports any field that exists in the database
   */
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic sample purchase order findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use the dynamic filtering system that adapts to any database schema
      const { data: samplePurchaseOrders, total } = await dynamicFindManyWithFilters('samplepurchaseorder', filters, {
        skip,
        take,
        useAllColumns: true // Get all available columns
      });

      logger.info({
        samplePurchaseOrderCount: samplePurchaseOrders.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: samplePurchaseOrders.length > 0 ? Object.keys(samplePurchaseOrders[0]) : []
      }, 'Dynamic sample purchase order findMany with filters completed');

      return createPaginationResult(samplePurchaseOrders, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic sample purchase order findMany operation');
      throw error;
    }
  }

  /**
   * Find sample purchase order by ID using dynamic operations
   */
  async findById(id: string) {
    try {
      logger.debug({ samplePurchaseOrderId: id }, 'Starting dynamic sample purchase order findById operation');

      const samplePurchaseOrder = await dynamicFindUnique('samplepurchaseorder', { id });

      if (!samplePurchaseOrder) {
        throw new Error('Sample purchase order not found');
      }

      logger.debug({ 
        samplePurchaseOrderId: id, 
        availableFields: Object.keys(samplePurchaseOrder) 
      }, 'Dynamic sample purchase order findById completed');

      return samplePurchaseOrder;
    } catch (error) {
      logger.error({ error, samplePurchaseOrderId: id }, 'Error in sample purchase order findById operation');
      throw error;
    }
  }

  /**
   * Create new sample purchase order with dynamic field support
   * Only uses fields that exist in the database schema
   */
  async create(data: CreateSamplePurchaseOrderInput & Record<string, any>) {
    try {
      logger.debug({ originalData: data }, 'Starting dynamic sample purchase order create operation');

      // Let database triggers handle timestamps
      const createData = {
        ...data
      };

      const samplePurchaseOrder = await dynamicCreate('samplepurchaseorder', createData);

      if (!samplePurchaseOrder) {
        throw new Error('Failed to create sample purchase order - no valid fields provided');
      }

      logger.info({ 
        samplePurchaseOrderId: samplePurchaseOrder.id,
        availableFields: Object.keys(samplePurchaseOrder) 
      }, 'Dynamic sample purchase order create completed');

      return samplePurchaseOrder;
    } catch (error) {
      logger.error({ error, data }, 'Error in sample purchase order create operation');
      throw error;
    }
  }

  /**
   * Update sample purchase order with dynamic field support
   */
  async update(id: string, data: UpdateSamplePurchaseOrderInput & Record<string, any>) {
    try {
      // Check if sample purchase order exists first
      await this.findById(id);

      logger.debug({ originalData: data, samplePurchaseOrderId: id }, 'Starting dynamic sample purchase order update operation');

      // Let database triggers handle timestamps
      const updateData = {
        ...data
      };

      const samplePurchaseOrder = await dynamicUpdate('samplepurchaseorder', { id }, updateData);

      if (!samplePurchaseOrder) {
        throw new Error('Failed to update sample purchase order - no valid fields provided');
      }

      logger.info({ 
        samplePurchaseOrderId: id, 
        availableFields: Object.keys(samplePurchaseOrder) 
      }, 'Dynamic sample purchase order update completed');

      return samplePurchaseOrder;
    } catch (error) {
      logger.error({ error, data, samplePurchaseOrderId: id }, 'Error in sample purchase order update operation');
      throw error;
    }
  }

  /**
   * Delete sample purchase order by ID
   */
  async delete(id: string) {
    try {
      // Check if sample purchase order exists first
      await this.findById(id);

      logger.debug({ samplePurchaseOrderId: id }, 'Starting dynamic sample purchase order delete operation');

      const success = await dynamicDelete('samplepurchaseorder', { id });

      if (!success) {
        throw new Error('Failed to delete sample purchase order');
      }

      logger.info({ samplePurchaseOrderId: id }, 'Dynamic sample purchase order delete completed successfully');
    } catch (error) {
      logger.error({ error, samplePurchaseOrderId: id }, 'Error in sample purchase order delete operation');
      throw error;
    }
  }

  /**
   * Upsert sample purchase order - create if ID not provided, update if ID exists
   */
  async upsert(data: UpsertSamplePurchaseOrderInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing sample purchase order
        logger.debug({ samplePurchaseOrderId: id, data: updateData }, 'Upserting existing sample purchase order');
        return this.update(id, updateData);
      } else {
        // Create new sample purchase order
        logger.debug({ data: updateData }, 'Upserting new sample purchase order');
        // Validate that required fields are present for creation
        if (!this.validateRequiredFields(updateData)) {
          throw new Error('Missing required fields for sample purchase order creation');
        }
        return this.create(updateData as CreateSamplePurchaseOrderInput);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in sample purchase order upsert operation');
      throw error;
    }
  }

  /**
   * Validates that all required fields are present for creation
   */
  private validateRequiredFields(data: Record<string, any>): boolean {
    const requiredFields = [
      'companyname', 'contactname', 'phonenumber', 'companymail',
      'gstnumber', 'companyaddress', 'supplierid', 'items',
      'createdby', 'modifiedby'
    ];
    
    return requiredFields.every(field => data[field] !== undefined);
  }

  /**
   * Find sample purchase orders by supplier ID
   */
  async findBySupplier(supplierId: string, page: number = 1, limit: number = 10) {
    try {
      logger.debug({ supplierId, page, limit }, 'Finding sample purchase orders by supplier');

      const filters = { supplierid: supplierId };

      const result = await this.findMany(filters, page, limit);

      logger.debug({ 
        supplierId, 
        samplePurchaseOrderCount: result.data.length,
        total: result.pagination.total
      }, 'Found sample purchase orders by supplier');

      return result;
    } catch (error) {
      logger.error({ error, supplierId }, 'Error finding sample purchase orders by supplier');
      throw error;
    }
  }
} 