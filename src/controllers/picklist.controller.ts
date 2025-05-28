import { FastifyRequest, FastifyReply } from 'fastify';
import { PicklistService } from '../services/picklist.service.js';
import { 
  createPicklistSchema, 
  updatePicklistSchema,
  picklistParamsSchema,
  picklistQuerySchema,
  PicklistParams,
  PicklistQuery
} from '../schemas/picklist.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { PicklistType } from '../config/dynamicFieldConfig.js';

export class PicklistController {
  private picklistService = new PicklistService();

  async getPicklists(request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) {
    try {
      // Get all query parameters as filters (not just schema-validated ones)
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);
      
      // Remove pagination params from filters
      const { page: _, limit: __, ...filters } = allFilters;
      
      const result = await this.picklistService.findMany(filters, page, limit);
      
      return reply.code(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
        meta: {
          filters: Object.keys(filters),
          total: result.pagination.total,
          filtered: Object.keys(filters).length > 0
        }
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch picklists',
      });
    }
  }

  async getPicklist(request: FastifyRequest<{ Params: PicklistParams }>, reply: FastifyReply) {
    try {
      const { id } = picklistParamsSchema.parse(request.params);
      
      const picklist = await this.picklistService.findById(id);
      
      return reply.code(200).send({
        success: true,
        data: picklist,
      });
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Picklist item not found' ? 404 : 400;
      return reply.code(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch picklist',
      });
    }
  }

  async getPicklistByType(request: FastifyRequest<{ 
    Querystring: { type: PicklistType; table?: string; field?: string } 
  }>, reply: FastifyReply) {
    try {
      const { type, table, field } = request.query;
      
      if (!type) {
        return reply.code(400).send({
          success: false,
          error: 'Type parameter is required',
        });
      }
      
      const picklists = await this.picklistService.findByType(type, table, field);
      
      return reply.code(200).send({
        success: true,
        data: picklists,
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch picklist items',
      });
    }
  }

  async createPicklist(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createPicklistSchema.parse(request.body);
      
      const picklist = await this.picklistService.create(data);
      
      return reply.code(201).send({
        success: true,
        data: picklist,
        message: 'Picklist item created successfully',
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create picklist item',
      });
    }
  }

  async updatePicklist(request: FastifyRequest<{ Params: PicklistParams }>, reply: FastifyReply) {
    try {
      const { id } = picklistParamsSchema.parse(request.params);
      const data = updatePicklistSchema.parse(request.body);
      
      const picklist = await this.picklistService.update(id, data);
      
      return reply.code(200).send({
        success: true,
        data: picklist,
        message: 'Picklist item updated successfully',
      });
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Picklist item not found' ? 404 : 400;
      return reply.code(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update picklist item',
      });
    }
  }

  async deletePicklist(request: FastifyRequest<{ Params: PicklistParams }>, reply: FastifyReply) {
    try {
      const { id } = picklistParamsSchema.parse(request.params);
      
      await this.picklistService.delete(id);
      
      return reply.code(200).send({
        success: true,
        message: 'Picklist item deleted successfully',
      });
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Picklist item not found' ? 404 : 400;
      return reply.code(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete picklist item',
      });
    }
  }

  async toggleActive(request: FastifyRequest<{ Params: PicklistParams }>, reply: FastifyReply) {
    try {
      const { id } = picklistParamsSchema.parse(request.params);
      
      const picklist = await this.picklistService.toggleActive(id);
      
      return reply.code(200).send({
        success: true,
        data: picklist,
        message: `Picklist item ${picklist.isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Picklist item not found' ? 404 : 400;
      return reply.code(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle picklist item status',
      });
    }
  }

  async reorderPicklists(request: FastifyRequest<{
    Body: {
      type: PicklistType;
      table: string;
      field: string;
      items: { id: string; ordering: number }[];
    }
  }>, reply: FastifyReply) {
    try {
      const { type, table, field, items } = request.body;
      
      const picklists = await this.picklistService.reorder(type, table, field, items);
      
      return reply.code(200).send({
        success: true,
        data: picklists,
        message: 'Picklist items reordered successfully',
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reorder picklist items',
      });
    }
  }
} 