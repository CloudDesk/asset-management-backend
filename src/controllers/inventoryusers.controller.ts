import { FastifyRequest, FastifyReply } from 'fastify';
import { InventoryUsersService } from '../services/inventoryusers.service.js';
import { 
  createInventoryUsersSchema, 
  updateInventoryUsersSchema, 
  upsertInventoryUsersSchema,
  inventoryUsersParamsSchema,
  InventoryUsersParams
} from '../schemas/inventoryusers.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { formatEntitiesForAPI, formatInventoryUsersForAPI } from '../utils/dynamicDbOperations.js';

export class InventoryUsersController {
  public inventoryUsersService = new InventoryUsersService();

  getInventoryUsers = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.inventoryUsersService.findMany(filters, page, limit);
    
    // Format all inventory users in the result
    const formattedData = formatEntitiesForAPI(result.data, 'inventoryusers');
    
    const response = createSuccessResponse('Inventory users retrieved successfully', formattedData);
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

  getInventoryUser = asyncHandler(async (request: FastifyRequest<{ Params: InventoryUsersParams }>, reply: FastifyReply) => {
    const { id } = inventoryUsersParamsSchema.parse(request.params);
    
    const inventoryUser = await this.inventoryUsersService.findById(id);
    
    // Format the individual inventory user data
    const formattedInventoryUser = formatInventoryUsersForAPI(inventoryUser);
    
    const response = createSuccessResponse('Inventory user retrieved successfully', formattedInventoryUser);
    return reply.code(200).send(response);
  });

  createInventoryUser = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createInventoryUsersSchema.parse(request.body);
    
    const inventoryUser = await this.inventoryUsersService.create(data);
    
    // Format the created inventory user data
    const formattedInventoryUser = formatInventoryUsersForAPI(inventoryUser);
    
    const response = createSuccessResponse('Inventory user created successfully', formattedInventoryUser);
    return reply.code(201).send(response);
  });

  updateInventoryUser = asyncHandler(async (request: FastifyRequest<{ Params: InventoryUsersParams }>, reply: FastifyReply) => {
    const { id } = inventoryUsersParamsSchema.parse(request.params);
    const data = updateInventoryUsersSchema.parse(request.body);
    
    const inventoryUser = await this.inventoryUsersService.update(id, data);
    
    // Format the updated inventory user data
    const formattedInventoryUser = formatInventoryUsersForAPI(inventoryUser);
    
    const response = createSuccessResponse('Inventory user updated successfully', formattedInventoryUser);
    return reply.code(200).send(response);
  });

  deleteInventoryUser = asyncHandler(async (request: FastifyRequest<{ Params: InventoryUsersParams }>, reply: FastifyReply) => {
    const { id } = inventoryUsersParamsSchema.parse(request.params);
    
    await this.inventoryUsersService.delete(id);
    
    const response = createSuccessResponse('Inventory user deleted successfully', null);
    return reply.code(200).send(response);
  });

  upsertInventoryUser = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertInventoryUsersSchema.parse(request.body);
    
    const inventoryUser = await this.inventoryUsersService.upsert(data);
    
    // Format the upserted inventory user data
    const formattedInventoryUser = formatInventoryUsersForAPI(inventoryUser);
    
    const message = data.id ? 'Inventory user updated successfully' : 'Inventory user created successfully';
    const response = createSuccessResponse(message, formattedInventoryUser);
    return reply.code(200).send(response);
  });
} 