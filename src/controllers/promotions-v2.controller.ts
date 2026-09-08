import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { PromotionEligibilityRequestSchema, PromotionGiftSelectionSchema, PromotionSelectionSchema } from '../schemas/promotions-v2.schema.js';
import { PromotionsV2Service } from '../services/promotions-v2.service.js';
import { asyncHandler, createSuccessResponse } from '../utils/errorHandler.js';

export class PromotionsV2Controller {
  private readonly service = new PromotionsV2Service();

  private inventoryUser(request: FastifyRequest): number {
    const user = (request as AuthenticatedRequest).user;
    if (!user || user.userType !== 'inventory') throw Object.assign(new Error('Inventory user authentication is required'), { statusCode: 403 });
    return user.id;
  }

  quote = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user;
    const customerId = user?.userType === 'ecommerce' ? String(user.id) : undefined;
    return reply.send(createSuccessResponse('Promotion quote created', await this.service.quote(request.body, customerId)));
  });

  select = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { evaluationId } = request.params as { evaluationId: string };
    const input = PromotionSelectionSchema.parse(request.body);
    const user = (request as AuthenticatedRequest).user;
    return reply.send(createSuccessResponse('Promotion selection evaluated', await this.service.requoteEvaluation(evaluationId, { promotionId: input.promotion_id }, user?.userType === 'ecommerce' ? String(user.id) : undefined)));
  });

  removeSelection = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { evaluationId, promotionId } = request.params as { evaluationId: string; promotionId: string };
    const user = (request as AuthenticatedRequest).user;
    return reply.send(createSuccessResponse('Promotion selection removed', await this.service.requoteEvaluation(evaluationId, { removePromotionId: Number(promotionId) }, user?.userType === 'ecommerce' ? String(user.id) : undefined)));
  });

  selectGift = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { evaluationId } = request.params as { evaluationId: string };
    const input = PromotionGiftSelectionSchema.parse(request.body);
    const user = (request as AuthenticatedRequest).user;
    return reply.send(createSuccessResponse('Gift selection evaluated', await this.service.requoteEvaluation(evaluationId, { promotionId: input.promotion_id, giftProductId: input.product_id }, user?.userType === 'ecommerce' ? String(user.id) : undefined)));
  });

  validate = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { evaluationId } = request.params as { evaluationId: string };
    const user = (request as AuthenticatedRequest).user;
    return reply.send(createSuccessResponse('Promotion quote revalidated', await this.service.requoteEvaluation(evaluationId, undefined, user?.userType === 'ecommerce' ? String(user.id) : undefined)));
  });

  saveDraft = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    this.inventoryUser(request);
    const { promotionId } = request.params as { promotionId: string };
    return reply.code(201).send(createSuccessResponse('Promotion rule draft created', await this.service.saveDraft(Number(promotionId), request.body)));
  });

  migrateLegacy = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    this.inventoryUser(request);
    const { promotionId } = request.params as { promotionId: string };
    return reply.code(201).send(createSuccessResponse('Legacy promotion converted to a V2 draft', await this.service.migrateLegacy(Number(promotionId))));
  });

  publish = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = this.inventoryUser(request);
    const { promotionId } = request.params as { promotionId: string };
    return reply.send(createSuccessResponse('Promotion rule published', await this.service.publish(Number(promotionId), userId)));
  });

  simulate = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    this.inventoryUser(request);
    const { promotionId } = request.params as { promotionId: string };
    return reply.send(createSuccessResponse('Promotion simulation completed', await this.service.simulate(Number(promotionId), request.body)));
  });

  facets = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    this.inventoryUser(request);
    return reply.send(createSuccessResponse('Promotion facets retrieved', await this.service.getFacets()));
  });

  eligibility = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user;
    const input = PromotionEligibilityRequestSchema.parse(request.body);
    const customerId = user?.userType === 'ecommerce' ? String(user.id) : undefined;
    return reply.send(createSuccessResponse('Promotion eligibility checked', await this.service.eligibility(input, customerId)));
  });

  latestRule = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    this.inventoryUser(request);
    const { promotionId } = request.params as { promotionId: string };
    return reply.send(createSuccessResponse('Latest promotion rule retrieved', await this.service.getLatestRule(Number(promotionId))));
  });

  analytics = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    this.inventoryUser(request);
    return reply.send(createSuccessResponse('Promotion analytics retrieved', await this.service.getAnalytics()));
  });

  matchedProducts = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    this.inventoryUser(request);
    const { promotionId } = request.params as { promotionId: string };
    const query = request.query as { page?: string; limit?: string };
    return reply.send(createSuccessResponse('Matched products retrieved', await this.service.getMatchedProducts(Number(promotionId), Math.max(1, Number(query.page) || 1), Math.min(200, Math.max(1, Number(query.limit) || 50)))));
  });
}
