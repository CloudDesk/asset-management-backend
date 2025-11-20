import { FastifyRequest, FastifyReply } from 'fastify';
import { PicklistService } from '../services/picklist.service.js';
import { 
  createPicklistSchema, 
  updatePicklistSchema,
  picklistParamsSchema,
  PicklistParams
} from '../schemas/picklist.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler,
  ValidationError
} from '../utils/errorHandler.js';
import { formatPicklistForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';

export class PicklistController {
  public picklistService = new PicklistService();

  getPicklists = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    
    // Regular paginated mode - orders by fieldname first, then sortorder
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.picklistService.findMany(filters, page, limit);
    
    // Format all picklists in the result
    const formattedData = formatEntitiesForAPI(result.data, 'picklist');
    
    const response = createSuccessResponse('Picklists retrieved successfully', formattedData);
    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: {
        filters: Object.keys(filters),
        total: result.pagination.total,
        filtered: Object.keys(filters).length > 0
      }
    });
  });

  getPicklist = asyncHandler(async (request: FastifyRequest<{ Params: PicklistParams }>, reply: FastifyReply) => {
    const { id } = picklistParamsSchema.parse(request.params);
    
    const picklist = await this.picklistService.findById(id);
    
    const response = createSuccessResponse('Picklist retrieved successfully', formatPicklistForAPI(picklist));
    return reply.code(200).send(response);
  });

  createPicklist = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createPicklistSchema.parse(request.body);
    
    const picklist = await this.picklistService.create(data);
    
    const response = createSuccessResponse('Picklist item created successfully', formatPicklistForAPI(picklist));
    return reply.code(201).send(response);
  });

  updatePicklist = asyncHandler(async (request: FastifyRequest<{ Params: PicklistParams }>, reply: FastifyReply) => {
    const { id } = picklistParamsSchema.parse(request.params);
    const data = updatePicklistSchema.parse(request.body);
    
    const picklist = await this.picklistService.update(id, data);
    
    const response = createSuccessResponse('Picklist item updated successfully', formatPicklistForAPI(picklist));
    return reply.code(200).send(response);
  });

  deletePicklist = asyncHandler(async (request: FastifyRequest<{ Params: PicklistParams }>, reply: FastifyReply) => {
    const { id } = picklistParamsSchema.parse(request.params);
    
    await this.picklistService.delete(id);
    
    const response = createSuccessResponse('Picklist item deleted successfully', null);
    return reply.code(200).send(response);
  });

  /**
   * v2: Get picklists with optional grouping by fieldname and/or parent
   * Supports both flat and grouped response formats
   */
  getPicklistsV2 = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    const allFilters: Record<string, any> = request.query || {};
    
    // Extract v2-specific parameters
    const groupByFieldname = allFilters.groupByFieldname === 'true' || allFilters.groupByFieldname === true;
    const groupByParent = allFilters.groupByParent === 'true' || allFilters.groupByParent === true;
    const sortorder = (allFilters.sortorder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC') as 'ASC' | 'DESC';
    const fieldnameOrder = (allFilters.fieldnameOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC') as 'ASC' | 'DESC';
    const limit = allFilters.limit ? parseInt(allFilters.limit, 10) : 1000;
    
    // Remove v2-specific params from filters
    const { groupByFieldname: _, groupByParent: __, sortorder: ___, fieldnameOrder: ____, limit: _____, ...filters } = allFilters;
    
    const result = await this.picklistService.findManyV2(
      filters,
      groupByFieldname,
      groupByParent,
      sortorder,
      fieldnameOrder,
      limit
    );
    
    if (groupByFieldname && result.grouped) {
      // Grouped response (with or without parent grouping)
      const message = groupByParent 
        ? 'Picklists grouped by fieldname and parent successfully'
        : 'Picklists grouped by fieldname successfully';
      
      const response = createSuccessResponse(message, result.grouped);
      return reply.code(200).send({
        ...response,
        meta: result.meta
      });
    }
    
    // Flat response (legacy compatible)
    const response = createSuccessResponse(
      'Picklists retrieved successfully',
      result.flat || []
    );
    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: result.meta
    });
  });

  /**
   * v2: Bulk update picklists - Update fieldname, parent, sortorder, label, value, controlled fields, and isactive
   * Allows reordering and reorganizing picklist items from frontend
   * Supports soft delete via isactive flag
   */
  bulkUpdatePicklistsV2 = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const updates = request.body as Array<{
      id?: number | string | null;
      fieldname?: string;
      parent?: string | null;
      sortorder?: number | null;
      label?: string | null;
      value?: string | null;
      object?: string;
      description?: string | null;
      controlledfieldname?: string | null;
      controlledlabel?: string | null;
      controlledvalue?: string | null;
      isactive?: boolean | null;
    }>;

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Request body must be a non-empty array of picklist items');
    }

    // Validate each item based on operation type (create vs update)
    for (const item of updates) {
      const isCreate = !item.id || item.id === null || (typeof item.id === 'number' && item.id <= 0) || (typeof item.id === 'string' && (item.id === '' || parseInt(item.id) <= 0));
      
      if (isCreate) {
        // For CREATE: validate required fields
        if (!item.label || !item.value || !item.object || !item.fieldname) {
          throw new Error('For new items, label, value, object, and fieldname are required');
        }
      } else {
        // For UPDATE: id must be valid (positive number)
        if (typeof item.id === 'string' && (!/^\d+$/.test(item.id) || parseInt(item.id) <= 0)) {
          throw new Error(`Invalid id format: ${item.id}. ID must be a positive integer for updates.`);
        }
        if (typeof item.id === 'number' && item.id <= 0) {
          throw new Error(`Invalid id: ${item.id}. ID must be a positive integer for updates.`);
        }
      }
    }

    const result = await this.picklistService.bulkUpdateV2(updates);

    const success = result.summary.failed === 0;
    const statusCode = success ? 200 : 207; // 207 Multi-Status if some failed

    // Count creates vs updates from results
    const createdCount = result.results.filter(r => r.success && r.operation === 'create').length;
    const updatedCount = result.results.filter(r => r.success && r.operation === 'update').length;

    let message = '';
    if (createdCount > 0 && updatedCount > 0) {
      message = success
        ? `Successfully created ${createdCount} and updated ${updatedCount} picklist(s)`
        : `Created ${createdCount} and updated ${updatedCount} of ${result.summary.total} picklist(s)`;
    } else if (createdCount > 0) {
      message = success
        ? `Successfully created ${createdCount} picklist(s)`
        : `Created ${createdCount} of ${result.summary.total} picklist(s)`;
    } else {
      message = success
        ? `Successfully updated ${updatedCount} picklist(s)`
        : `Updated ${updatedCount} of ${result.summary.total} picklist(s)`;
    }

    const response = createSuccessResponse(message, result.results);

    return reply.code(statusCode).send({
      ...response,
      summary: {
        ...result.summary,
        created: createdCount,
        updated: updatedCount
      }
    });
  });

  /**
   * Get unique fieldnames filtered by object
   * Returns array of unique fieldname strings for dependency management
   */
  getDependencyFieldnames = asyncHandler(async (request: FastifyRequest<{ Querystring: { object: string } }>, reply: FastifyReply) => {
    const { object } = request.query;

    if (!object) {
      throw new Error('object query parameter is required');
    }

    const fieldnames = await this.picklistService.getUniqueFieldnamesByObject(object);

    const response = createSuccessResponse(
      `Retrieved ${fieldnames.length} unique fieldname(s) for object '${object}'`,
      fieldnames
    );

    return reply.code(200).send(response);
  });
} 