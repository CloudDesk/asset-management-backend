import { FastifyRequest, FastifyReply } from 'fastify';
import { PermissionSetService } from '../services/permissionset.service.js';
import { 
  createPermissionSetSchema, 
  updatePermissionSetSchema,
  permissionSetParamsSchema,
  PermissionSetParams
} from '../schemas/permissionset.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';

export class PermissionSetController {
  public permissionSetService = new PermissionSetService();

  getPermissionSets = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.permissionSetService.findMany(filters, page, limit);
    
    const response = createSuccessResponse('Permission sets retrieved successfully', result.data);
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

  getPermissionSet = asyncHandler(async (request: FastifyRequest<{ Params: PermissionSetParams }>, reply: FastifyReply) => {
    const { id } = permissionSetParamsSchema.parse(request.params);
    
    const permissionSet = await this.permissionSetService.findById(id);
    
    const response = createSuccessResponse('Permission set retrieved successfully', permissionSet);
    return reply.code(200).send(response);
  });

  createPermissionSet = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createPermissionSetSchema.parse(request.body);
    
    const permissionSet = await this.permissionSetService.create(data);
    
    const response = createSuccessResponse('Permission set created successfully', permissionSet);
    return reply.code(201).send(response);
  });

  updatePermissionSet = asyncHandler(async (request: FastifyRequest<{ Params: PermissionSetParams }>, reply: FastifyReply) => {
    const { id } = permissionSetParamsSchema.parse(request.params);
    const data = updatePermissionSetSchema.parse(request.body);
    
    const permissionSet = await this.permissionSetService.update(id, data);
    
    const response = createSuccessResponse('Permission set updated successfully', permissionSet);
    return reply.code(200).send(response);
  });

  deletePermissionSet = asyncHandler(async (request: FastifyRequest<{ Params: PermissionSetParams }>, reply: FastifyReply) => {
    const { id } = permissionSetParamsSchema.parse(request.params);
    
    const result = await this.permissionSetService.delete(id);
    
    const response = createSuccessResponse('Permission set deleted successfully', result);
    return reply.code(200).send(response);
  });

  getPermissionSetsByRole = asyncHandler(async (request: FastifyRequest<{ Params: { roleid: string }; Querystring: { activeOnly?: string } }>, reply: FastifyReply) => {
    const { roleid } = request.params;
    const activeOnly = request.query.activeOnly !== 'false'; // Default to true
    
    const permissionSets = await this.permissionSetService.findByRoleId(roleid, activeOnly);
    
    const response = createSuccessResponse('Permission sets retrieved successfully', permissionSets);
    return reply.code(200).send(response);
  });

  getPermissionSetForRole = asyncHandler(async (request: FastifyRequest<{ Params: { roleid: string } }>, reply: FastifyReply) => {
    const { roleid } = request.params;
    
    const permissionSet = await this.permissionSetService.getPermissionSetForRole(roleid);
    
    if (!permissionSet) {
      return reply.code(404).send({
        success: false,
        error: 'No active permission set found for this role',
        statusCode: 404
      });
    }
    
    const response = createSuccessResponse('Permission set retrieved successfully', permissionSet);
    return reply.code(200).send(response);
  });

  // Preview activation impact
  previewActivation = asyncHandler(async (request: FastifyRequest<{ Querystring: { roleid: string; permissionSetId?: string } }>, reply: FastifyReply) => {
    const { roleid, permissionSetId } = request.query;

    if (!roleid) {
      return reply.code(400).send({
        success: false,
        error: 'roleid query parameter is required',
        statusCode: 400
      });
    }

    const parsedPermissionSetId = permissionSetId ? parseInt(permissionSetId) : undefined;

    if (permissionSetId && isNaN(parsedPermissionSetId!)) {
      return reply.code(400).send({
        success: false,
        error: 'permissionSetId must be a valid number',
        statusCode: 400
      });
    }

    const preview = await this.permissionSetService.previewActivation(roleid, parsedPermissionSetId);
    
    const response = createSuccessResponse('Permission set activation preview generated', preview);
    return reply.code(200).send(response);
  });

  // Preview system default impact
  previewSystemDefault = asyncHandler(async (request: FastifyRequest<{ Querystring: { permissionSetId?: string } }>, reply: FastifyReply) => {
    const { permissionSetId } = request.query;

    const parsedPermissionSetId = permissionSetId ? parseInt(permissionSetId) : undefined;

    if (permissionSetId && isNaN(parsedPermissionSetId!)) {
      return reply.code(400).send({
        success: false,
        error: 'permissionSetId must be a valid number',
        statusCode: 400
      });
    }

    const preview = await this.permissionSetService.previewSystemDefault(parsedPermissionSetId);
    
    const response = createSuccessResponse('System default preview generated', preview);
    return reply.code(200).send(response);
  });
}

