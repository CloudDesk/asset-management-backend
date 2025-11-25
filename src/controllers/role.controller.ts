import { FastifyRequest, FastifyReply } from 'fastify';
import { RoleService } from '../services/role.service.js';
import { 
  createRoleSchema, 
  updateRoleSchema,
  roleParamsSchema,
  RoleParams
} from '../schemas/role.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';

export class RoleController {
  public roleService = new RoleService();

  getRoles = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.roleService.findMany(filters, page, limit);
    
    const response = createSuccessResponse('Roles retrieved successfully', result.data);
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

  getRole = asyncHandler(async (request: FastifyRequest<{ Params: RoleParams }>, reply: FastifyReply) => {
    const { id } = roleParamsSchema.parse(request.params);
    
    const role = await this.roleService.findById(id);
    
    const response = createSuccessResponse('Role retrieved successfully', role);
    return reply.code(200).send(response);
  });

  createRole = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createRoleSchema.parse(request.body);
    
    const role = await this.roleService.create(data);
    
    const response = createSuccessResponse('Role created successfully', role);
    return reply.code(201).send(response);
  });

  updateRole = asyncHandler(async (request: FastifyRequest<{ Params: RoleParams }>, reply: FastifyReply) => {
    const { id } = roleParamsSchema.parse(request.params);
    const data = updateRoleSchema.parse(request.body);
    
    const role = await this.roleService.update(id, data);
    
    const response = createSuccessResponse('Role updated successfully', role);
    return reply.code(200).send(response);
  });

  deleteRole = asyncHandler(async (request: FastifyRequest<{ Params: RoleParams }>, reply: FastifyReply) => {
    const { id } = roleParamsSchema.parse(request.params);
    
    const result = await this.roleService.delete(id);
    
    const response = createSuccessResponse('Role deleted successfully', result);
    return reply.code(200).send(response);
  });

  previewLevelChange = asyncHandler(async (request: FastifyRequest<{ Querystring: { level: string; excludeRoleId?: string } }>, reply: FastifyReply) => {
    const level = parseInt(request.query.level);
    const excludeRoleId = request.query.excludeRoleId ? parseInt(request.query.excludeRoleId) : undefined;

    if (isNaN(level) || level < 1) {
      return reply.code(400).send({
        success: false,
        error: 'Level must be a positive integer (1 or greater)',
        statusCode: 400
      });
    }

    const preview = await this.roleService.previewLevelChange(level, excludeRoleId);
    
    const response = createSuccessResponse('Level change preview generated', preview);
    return reply.code(200).send(response);
  });
}

