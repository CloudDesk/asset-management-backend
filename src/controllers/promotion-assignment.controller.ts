import { FastifyReply, FastifyRequest } from 'fastify';
import { asyncHandler, createSuccessResponse } from '../utils/errorHandler.js';
import {
  addCustomerGroupMembersSchema,
  createCustomerGroupSchema,
  createPromotionAssignmentSchema,
  updateCustomerGroupSchema,
  updatePromotionAssignmentSchema
} from '../schemas/promotion-assignment.schema.js';
import { PromotionAssignmentService } from '../services/promotion-assignment.service.js';

export class PromotionAssignmentController {
  private service = new PromotionAssignmentService();

  createVoucher = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const promotionId = Number((request.params as { id: string }).id);
    const input = createPromotionAssignmentSchema.parse(request.body);
    const assignment = await this.service.createVoucher(promotionId, input);
    return reply.code(201).send(createSuccessResponse('Voucher generated successfully', assignment));
  });

  listVouchers = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const promotionId = Number((request.params as { id: string }).id);
    const assignments = await this.service.listVouchers(promotionId);
    return reply.code(200).send(createSuccessResponse('Promotion vouchers retrieved', assignments));
  });

  updateVoucher = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const assignmentId = Number((request.params as { assignmentId: string }).assignmentId);
    const input = updatePromotionAssignmentSchema.parse(request.body);
    const assignment = await this.service.updateVoucher(assignmentId, input);
    return reply.code(200).send(createSuccessResponse('Voucher updated successfully', assignment));
  });

  createGroup = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createCustomerGroupSchema.parse(request.body);
    const group = await this.service.createGroup(input);
    return reply.code(201).send(createSuccessResponse('Customer group created', group));
  });

  listGroups = asyncHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
    const groups = await this.service.listGroups();
    return reply.code(200).send(createSuccessResponse('Customer groups retrieved', groups));
  });

  getGroup = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const groupId = Number((request.params as { id: string }).id);
    const group = await this.service.getGroup(groupId);
    return reply.code(200).send(createSuccessResponse('Customer group retrieved', group));
  });

  updateGroup = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const groupId = Number((request.params as { id: string }).id);
    const input = updateCustomerGroupSchema.parse(request.body);
    const group = await this.service.updateGroup(groupId, input);
    return reply.code(200).send(createSuccessResponse('Customer group updated', group));
  });

  addMembers = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const groupId = Number((request.params as { id: string }).id);
    const { customer_ids } = addCustomerGroupMembersSchema.parse(request.body);
    const group = await this.service.addGroupMembers(groupId, customer_ids);
    return reply.code(200).send(createSuccessResponse('Customer group members added', group));
  });

  removeMember = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, customerId } = request.params as { id: string; customerId: string };
    await this.service.removeGroupMember(Number(id), Number(customerId));
    return reply.code(200).send(createSuccessResponse('Customer group member removed', null));
  });
}
