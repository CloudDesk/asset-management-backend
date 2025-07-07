import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionActionsService } from '../services/promotion-actions.service.js';
import { 
  createPromotionActionsSchema, 
  updatePromotionActionsSchema, 
  upsertPromotionActionsSchema,
  CreatePromotionActionsInput,
  UpdatePromotionActionsInput,
  UpsertPromotionActionsInput
} from '../schemas/promotion-actions.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';

export class PromotionActionsController {
  public promotionActionsService = new PromotionActionsService();

  getPromotionActions = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.promotionActionsService.findMany(filters, page, limit);
    
    const response = createSuccessResponse('Promotion actions retrieved successfully', result.data);
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

  getPromotionAction = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    
    const promotionAction = await this.promotionActionsService.findById(id);
    
    const response = createSuccessResponse('Promotion action retrieved successfully', promotionAction);
    return reply.code(200).send(response);
  });

  createPromotionAction = asyncHandler(async (request: FastifyRequest<{ Body: CreatePromotionActionsInput }>, reply: FastifyReply) => {
    const data = createPromotionActionsSchema.parse(request.body);
    
    const promotionAction = await this.promotionActionsService.create(data);
    
    const response = createSuccessResponse('Promotion action created successfully', promotionAction);
    return reply.code(201).send(response);
  });

  updatePromotionAction = asyncHandler(async (request: FastifyRequest<{ Params: { id: string }; Body: UpdatePromotionActionsInput }>, reply: FastifyReply) => {
    const { id } = request.params;
    const data = updatePromotionActionsSchema.parse(request.body);
    
    const promotionAction = await this.promotionActionsService.update(id, data);
    
    const response = createSuccessResponse('Promotion action updated successfully', promotionAction);
    return reply.code(200).send(response);
  });

  deletePromotionAction = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    
    await this.promotionActionsService.delete(id);
    
    const response = createSuccessResponse('Promotion action deleted successfully', null);
    return reply.code(200).send(response);
  });

  upsertPromotionAction = asyncHandler(async (request: FastifyRequest<{ Body: UpsertPromotionActionsInput }>, reply: FastifyReply) => {
    const data = upsertPromotionActionsSchema.parse(request.body);
    
    const promotionAction = await this.promotionActionsService.upsert(data);
    
    const message = data.id ? 'Promotion action updated successfully' : 'Promotion action created successfully';
    const response = createSuccessResponse(message, promotionAction);
    return reply.code(200).send(response);
  });
} 