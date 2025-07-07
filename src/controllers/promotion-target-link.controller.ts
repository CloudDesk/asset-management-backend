import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionTargetLinkService } from '../services/promotion-target-link.service.js';
import { 
  createPromotionTargetLinkSchema, 
  updatePromotionTargetLinkSchema, 
  upsertPromotionTargetLinkSchema,
  CreatePromotionTargetLinkInput,
  UpdatePromotionTargetLinkInput,
  UpsertPromotionTargetLinkInput
} from '../schemas/promotion-target-link.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';

export class PromotionTargetLinkController {
  public promotionTargetLinkService = new PromotionTargetLinkService();

  getPromotionTargetLinks = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.promotionTargetLinkService.findMany(filters, page, limit);
    
    const response = createSuccessResponse('Promotion target links retrieved successfully', result.data);
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

  getPromotionTargetLink = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    
    const promotionTargetLink = await this.promotionTargetLinkService.findById(id);
    
    const response = createSuccessResponse('Promotion target link retrieved successfully', promotionTargetLink);
    return reply.code(200).send(response);
  });

  createPromotionTargetLink = asyncHandler(async (request: FastifyRequest<{ Body: CreatePromotionTargetLinkInput }>, reply: FastifyReply) => {
    const data = createPromotionTargetLinkSchema.parse(request.body);
    
    const promotionTargetLink = await this.promotionTargetLinkService.create(data);
    
    const response = createSuccessResponse('Promotion target link created successfully', promotionTargetLink);
    return reply.code(201).send(response);
  });

  updatePromotionTargetLink = asyncHandler(async (request: FastifyRequest<{ Params: { id: string }; Body: UpdatePromotionTargetLinkInput }>, reply: FastifyReply) => {
    const { id } = request.params;
    const data = updatePromotionTargetLinkSchema.parse(request.body);
    
    const promotionTargetLink = await this.promotionTargetLinkService.update(id, data);
    
    const response = createSuccessResponse('Promotion target link updated successfully', promotionTargetLink);
    return reply.code(200).send(response);
  });

  deletePromotionTargetLink = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    
    await this.promotionTargetLinkService.delete(id);
    
    const response = createSuccessResponse('Promotion target link deleted successfully', null);
    return reply.code(200).send(response);
  });

  upsertPromotionTargetLink = asyncHandler(async (request: FastifyRequest<{ Body: UpsertPromotionTargetLinkInput }>, reply: FastifyReply) => {
    const data = upsertPromotionTargetLinkSchema.parse(request.body);
    
    const promotionTargetLink = await this.promotionTargetLinkService.upsert(data);
    
    const message = data.id ? 'Promotion target link updated successfully' : 'Promotion target link created successfully';
    const response = createSuccessResponse(message, promotionTargetLink);
    return reply.code(200).send(response);
  });
} 