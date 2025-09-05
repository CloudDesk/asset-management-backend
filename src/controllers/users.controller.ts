import { FastifyRequest, FastifyReply } from 'fastify';
import { UsersService } from '../services/users.service.js';
import { 
  createUsersSchema, 
  updateUsersSchema, 
  upsertUsersSchema,
  usersParamsSchema,
  UsersParams
} from '../schemas/users.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { formatEntitiesForAPI, formatUsersForAPI } from '../utils/dynamicDbOperations.js';

export class UsersController {
  public usersService = new UsersService();

  getUsers = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.usersService.findMany(filters, page, limit);
    
    // Format all users in the result
    const formattedData = formatEntitiesForAPI(result.data, 'users');
    
    const response = createSuccessResponse('Users retrieved successfully', formattedData);
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

  getUser = asyncHandler(async (request: FastifyRequest<{ Params: UsersParams }>, reply: FastifyReply) => {
    const { id } = usersParamsSchema.parse(request.params);
    
    const user = await this.usersService.findById(id);
    
    // Format the individual user data
    const formattedUser = formatUsersForAPI(user);
    
    const response = createSuccessResponse('User retrieved successfully', formattedUser);
    return reply.code(200).send(response);
  });

  createUser = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createUsersSchema.parse(request.body);
    
    const user = await this.usersService.create(data);
    
    // Format the created user data
    const formattedUser = formatUsersForAPI(user);
    
    const response = createSuccessResponse('User created successfully', formattedUser);
    return reply.code(201).send(response);
  });

  updateUser = asyncHandler(async (request: FastifyRequest<{ Params: UsersParams }>, reply: FastifyReply) => {
    const { id } = usersParamsSchema.parse(request.params);
    const data = updateUsersSchema.parse(request.body);
    
    const user = await this.usersService.update(id, data);
    
    // Format the updated user data
    const formattedUser = formatUsersForAPI(user);
    
    const response = createSuccessResponse('User updated successfully', formattedUser);
    return reply.code(200).send(response);
  });

  deleteUser = asyncHandler(async (request: FastifyRequest<{ Params: UsersParams }>, reply: FastifyReply) => {
    const { id } = usersParamsSchema.parse(request.params);
    
    await this.usersService.delete(id);
    
    const response = createSuccessResponse('User deleted successfully', null);
    return reply.code(200).send(response);
  });

  authenticate = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { useremail, userpassword } = request.body as { useremail: string; userpassword: string };
    
    const result = await this.usersService.authenticate(useremail, userpassword);
    
    if (!result) {
      return reply.code(401).send({
        success: false,
        message: 'Invalid credentials',
        details: 'The email or password you entered is incorrect',
        statusCode: 401,
      });
    }
    
    const response = createSuccessResponse('Sign-in successful', result);
    return reply.code(200).send(response);
  });

  upsertUser = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertUsersSchema.parse(request.body);
    
    const user = await this.usersService.upsert(data);
    
    // Format the upserted user data
    const formattedUser = formatUsersForAPI(user);
    
    const message = data.id ? 'User updated successfully' : 'User created successfully';
    const response = createSuccessResponse(message, formattedUser);
    return reply.code(200).send(response);
  });
} 
