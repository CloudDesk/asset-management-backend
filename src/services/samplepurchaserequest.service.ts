import { prisma } from '../models/prisma.js';
import { 
  CreateSamplePurchaseRequestInput, 
  UpdateSamplePurchaseRequestInput, 
  UpsertSamplePurchaseRequestInput
} from '../schemas/samplepurchaserequest.schema.js';
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

export class SamplePurchaseRequestService {
  /**
   * Find sample purchase requests with dynamic filtering and pagination
   * Supports any field that exists in the database
   */
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic sample purchase request findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use the dynamic filtering system that adapts to any database schema
      const { data: samplePurchaseRequests, total } = await dynamicFindManyWithFilters('samplepurchaserequest', filters, {
        skip,
        take,
        useAllColumns: true // Get all available columns
      });

      logger.info({
        samplePurchaseRequestCount: samplePurchaseRequests.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: samplePurchaseRequests.length > 0 ? Object.keys(samplePurchaseRequests[0]) : []
      }, 'Dynamic sample purchase request findMany with filters completed');

      return createPaginationResult(samplePurchaseRequests, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic sample purchase request findMany operation');
      throw error;
    }
  }

  /**
   * Find sample purchase request by ID using dynamic operations
   */
  async findById(id: string) {
    try {
      logger.debug({ samplePurchaseRequestId: id }, 'Starting dynamic sample purchase request findById operation');

      const samplePurchaseRequest = await dynamicFindUnique('samplepurchaserequest', { id });

      if (!samplePurchaseRequest) {
        throw new Error('Sample purchase request not found');
      }

      logger.debug({ 
        samplePurchaseRequestId: id, 
        availableFields: Object.keys(samplePurchaseRequest) 
      }, 'Dynamic sample purchase request findById completed');

      return samplePurchaseRequest;
    } catch (error) {
      logger.error({ error, samplePurchaseRequestId: id }, 'Error in sample purchase request findById operation');
      throw error;
    }
  }

  /**
   * Create new sample purchase request with dynamic field support
   * Only uses fields that exist in the database schema
   */
  async create(data: CreateSamplePurchaseRequestInput & Record<string, any>) {
    try {
      logger.debug({ originalData: data }, 'Starting dynamic sample purchase request create operation');

      // Let database triggers handle timestamps
      const createData = {
        ...data
      };

      const samplePurchaseRequest = await dynamicCreate('samplepurchaserequest', createData);

      if (!samplePurchaseRequest) {
        throw new Error('Failed to create sample purchase request - no valid fields provided');
      }

      logger.info({ 
        samplePurchaseRequestId: samplePurchaseRequest.id,
        availableFields: Object.keys(samplePurchaseRequest) 
      }, 'Dynamic sample purchase request create completed');

      return samplePurchaseRequest;
    } catch (error) {
      logger.error({ error, data }, 'Error in sample purchase request create operation');
      throw error;
    }
  }

  /**
   * Update sample purchase request with dynamic field support
   */
  async update(id: string, data: UpdateSamplePurchaseRequestInput & Record<string, any>) {
    try {
      // Check if sample purchase request exists first
      await this.findById(id);

      logger.debug({ originalData: data, samplePurchaseRequestId: id }, 'Starting dynamic sample purchase request update operation');

      // Let database triggers handle timestamps
      const updateData = {
        ...data
      };

      const samplePurchaseRequest = await dynamicUpdate('samplepurchaserequest', { id }, updateData);

      if (!samplePurchaseRequest) {
        throw new Error('Failed to update sample purchase request - no valid fields provided');
      }

      logger.info({ 
        samplePurchaseRequestId: id, 
        availableFields: Object.keys(samplePurchaseRequest) 
      }, 'Dynamic sample purchase request update completed');

      return samplePurchaseRequest;
    } catch (error) {
      logger.error({ error, data, samplePurchaseRequestId: id }, 'Error in sample purchase request update operation');
      throw error;
    }
  }

  /**
   * Delete sample purchase request by ID
   */
  async delete(id: string) {
    try {
      // Check if sample purchase request exists first
      await this.findById(id);

      logger.debug({ samplePurchaseRequestId: id }, 'Starting dynamic sample purchase request delete operation');

      const success = await dynamicDelete('samplepurchaserequest', { id });

      if (!success) {
        throw new Error('Failed to delete sample purchase request');
      }

      logger.info({ samplePurchaseRequestId: id }, 'Dynamic sample purchase request delete completed successfully');
    } catch (error) {
      logger.error({ error, samplePurchaseRequestId: id }, 'Error in sample purchase request delete operation');
      throw error;
    }
  }

  /**
   * Upsert sample purchase request - create if ID not provided, update if ID exists
   */
  async upsert(data: UpsertSamplePurchaseRequestInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing sample purchase request
        logger.debug({ samplePurchaseRequestId: id, data: updateData }, 'Upserting existing sample purchase request');
        return this.update(id, updateData);
      } else {
        // Create new sample purchase request
        logger.debug({ data: updateData }, 'Upserting new sample purchase request');
        // Validate that required fields are present for creation
        if (!this.validateRequiredFields(updateData)) {
          throw new Error('Missing required fields for sample purchase request creation');
        }
        return this.create(updateData as CreateSamplePurchaseRequestInput);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in sample purchase request upsert operation');
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
   * Find sample purchase requests by supplier ID
   */
  async findBySupplier(supplierId: string, page: number = 1, limit: number = 10) {
    try {
      logger.debug({ supplierId, page, limit }, 'Finding sample purchase requests by supplier');

      const filters = { supplierid: supplierId };

      const result = await this.findMany(filters, page, limit);

      logger.debug({ 
        supplierId, 
        samplePurchaseRequestCount: result.data.length,
        total: result.pagination.total
      }, 'Found sample purchase requests by supplier');

      return result;
    } catch (error) {
      logger.error({ error, supplierId }, 'Error finding sample purchase requests by supplier');
      throw error;
    }
  }
} 
