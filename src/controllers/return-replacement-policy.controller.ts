import { FastifyReply, FastifyRequest } from 'fastify';
import { ReturnReplacementPolicyService } from '../services/return-replacement-policy.service.js';
import { ReturnPolicyReasonRuleService } from '../services/return-policy-reason-rule.service.js';
import {
  createReturnReplacementPolicySchema,
  returnReplacementPolicyEligibilityQuerySchema,
  returnReplacementPolicyParamsSchema,
  returnPolicyReasonParamsSchema,
  returnReplacementPolicyQuerySchema,
  resetPolicyReasonRuleSchema,
  updatePolicyReasonRuleSchema,
  updateReturnReplacementPolicySchema,
} from '../schemas/return-replacement-policy.schema.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { getPaginationParams } from '../utils/pagination.js';

export class ReturnReplacementPolicyController {
  private policyService = new ReturnReplacementPolicyService();
  private policyReasonRuleService = new ReturnPolicyReasonRuleService();

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

  getPolicyReasons = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = returnReplacementPolicyParamsSchema.parse(request.params);
    const mappings = await this.policyReasonRuleService.listPolicyReasonRules(parseInt(id, 10));

    return reply
      .code(200)
      .send(createSuccessResponse('Policy reason configurations retrieved successfully', mappings));
  });

  getPolicyReason = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, reasonCode } = returnPolicyReasonParamsSchema.parse(request.params);
    const mapping = await this.policyReasonRuleService.getPolicyReasonRule(parseInt(id, 10), reasonCode);

    return reply
      .code(200)
      .send(createSuccessResponse('Policy reason configuration retrieved successfully', mapping));
  });

  updatePolicyReason = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, reasonCode } = returnPolicyReasonParamsSchema.parse(request.params);
    const data = updatePolicyReasonRuleSchema.parse(request.body);
    const mapping = await this.policyReasonRuleService.updatePolicyReasonRule(parseInt(id, 10), reasonCode, data);

    return reply
      .code(200)
      .send(createSuccessResponse('Policy reason configuration updated successfully', mapping));
  });

  resetPolicyReason = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, reasonCode } = returnPolicyReasonParamsSchema.parse(request.params);
    const data = resetPolicyReasonRuleSchema.parse(request.body || {});
    const mapping = await this.policyReasonRuleService.resetPolicyReasonRule(parseInt(id, 10), reasonCode, data);

    return reply
      .code(200)
      .send(createSuccessResponse('Policy reason configuration reset successfully', mapping));
  });

  checkEligibility = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const query = returnReplacementPolicyEligibilityQuerySchema.parse(request.query || {});
    const result = await this.policyService.resolveEligibility(query);

    return reply
      .code(200)
      .send(createSuccessResponse('Return/replacement eligibility evaluated successfully', result));
  });
}
