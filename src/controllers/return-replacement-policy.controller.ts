import { FastifyReply, FastifyRequest } from 'fastify';
import { ReturnReplacementPolicyService } from '../services/return-replacement-policy.service.js';
import {
  createReturnReplacementPolicySchema,
  returnReplacementPolicyEligibilityQuerySchema,
  returnReplacementPolicyParamsSchema,
  returnReplacementPolicyQuerySchema,
  updateReturnReplacementPolicySchema,
} from '../schemas/return-replacement-policy.schema.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { getPaginationParams } from '../utils/pagination.js';

export class ReturnReplacementPolicyController {
  private policyService = new ReturnReplacementPolicyService();

  getPolicies = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const query = returnReplacementPolicyQuerySchema.parse(request.query || {});
    const { page, limit } = getPaginationParams(request.query as Record<string, unknown>);
    const result = await this.policyService.findMany(query, page, limit);

    return reply.code(200).send({
      ...createSuccessResponse('Return/replacement policies retrieved successfully', result.data),
      pagination: result.pagination,
      meta: {
        filters: Object.keys(query).filter((key) => !['page', 'limit'].includes(key)),
        total: result.pagination.total,
        filtered: Object.keys(query).some((key) => !['page', 'limit'].includes(key)),
      },
    });
  });

  getPolicy = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = returnReplacementPolicyParamsSchema.parse(request.params);
    const policy = await this.policyService.findById(id);

    return reply
      .code(200)
      .send(createSuccessResponse('Return/replacement policy retrieved successfully', policy));
  });

  createPolicy = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createReturnReplacementPolicySchema.parse(request.body);
    const policy = await this.policyService.create(data);

    return reply
      .code(201)
      .send(createSuccessResponse('Return/replacement policy created successfully', policy));
  });

  upsertPolicy = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createReturnReplacementPolicySchema.parse(request.body);
    const policy = await this.policyService.upsertByScope(data);

    return reply
      .code(200)
      .send(createSuccessResponse('Return/replacement policy upserted successfully', policy));
  });

  updatePolicy = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = returnReplacementPolicyParamsSchema.parse(request.params);
    const data = updateReturnReplacementPolicySchema.parse(request.body);
    const policy = await this.policyService.update(id, data);

    return reply
      .code(200)
      .send(createSuccessResponse('Return/replacement policy updated successfully', policy));
  });

  deletePolicy = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = returnReplacementPolicyParamsSchema.parse(request.params);
    await this.policyService.delete(id);

    return reply
      .code(200)
      .send(createSuccessResponse('Return/replacement policy deleted successfully', null));
  });

  checkEligibility = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const query = returnReplacementPolicyEligibilityQuerySchema.parse(request.query || {});
    const result = await this.policyService.resolveEligibility(query);

    return reply
      .code(200)
      .send(createSuccessResponse('Return/replacement eligibility evaluated successfully', result));
  });
}
