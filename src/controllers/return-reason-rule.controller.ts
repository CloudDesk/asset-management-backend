import { FastifyReply, FastifyRequest } from 'fastify';
import { ReturnReasonRuleService } from '../services/return-reason-rule.service.js';
import {
  createReturnReasonRuleSchema,
  returnReasonRuleQuerySchema,
  returnSourceParamsSchema,
  updateReturnReasonRuleSchema,
} from '../schemas/return-source.schema.js';
import { asyncHandler, createSuccessResponse } from '../utils/errorHandler.js';
import { getPaginationParams } from '../utils/pagination.js';

export class ReturnReasonRuleController {
  private reasonRuleService = new ReturnReasonRuleService();

  getRules = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const query = returnReasonRuleQuerySchema.parse(request.query || {});
    const { page, limit } = getPaginationParams(request.query as Record<string, unknown>);
    const result = await this.reasonRuleService.findMany(query, page, limit);

    return reply.code(200).send({
      ...createSuccessResponse('Return reason rules retrieved successfully', result.data),
      pagination: result.pagination,
    });
  });

  getRule = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const rule = await this.reasonRuleService.findById(id);

    return reply.code(200).send(createSuccessResponse('Return reason rule retrieved successfully', rule));
  });

  createRule = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createReturnReasonRuleSchema.parse(request.body);
    const rule = await this.reasonRuleService.create(data);

    return reply.code(201).send(createSuccessResponse('Return reason rule created successfully', rule));
  });

  updateRule = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = returnSourceParamsSchema.parse(request.params);
    const data = updateReturnReasonRuleSchema.parse(request.body);
    const rule = await this.reasonRuleService.update(id, data);

    return reply.code(200).send(createSuccessResponse('Return reason rule updated successfully', rule));
  });

  upsertDefaults = asyncHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
    const rules = await this.reasonRuleService.upsertDefaults();

    return reply.code(200).send(createSuccessResponse('Default return reason rules upserted successfully', rules));
  });
}
