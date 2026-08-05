import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { addCouponGroupMembersSchema, createCouponGroupSchema, updateCouponGroupSchema } from '../schemas/coupon-group.schema.js';
import { CouponGroupService } from '../services/coupon-group.service.js';
import { asyncHandler, createSuccessResponse } from '../utils/errorHandler.js';

export class CouponGroupController {
  private service = new CouponGroupService();

  private requireAdmin(request: AuthenticatedRequest, reply: FastifyReply) {
    if (!request.user || request.user.userType !== 'inventory') {
      reply.code(403).send({ success: false, message: 'Inventory authentication required' });
      return false;
    }
    return true;
  }

  create = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!this.requireAdmin(request, reply)) return;
    const group = await this.service.create(createCouponGroupSchema.parse(request.body));
    return reply.code(201).send(createSuccessResponse('Coupon group created', group));
  });

  list = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!this.requireAdmin(request, reply)) return;
    return reply.send(createSuccessResponse('Coupon groups retrieved', await this.service.list()));
  });

  get = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!this.requireAdmin(request, reply)) return;
    const groupId = Number((request.params as { id: string }).id);
    return reply.send(createSuccessResponse('Coupon group retrieved', await this.service.get(groupId)));
  });

  listCustomerCandidates = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!this.requireAdmin(request, reply)) return;
    const groupId = Number((request.params as { id: string }).id);
    const query = request.query as { search?: string; limit?: string };
    const limit = Math.min(Math.max(Number(query.limit || 10) || 10, 1), 10);
    return reply.send(createSuccessResponse(
      'Coupon group customer candidates retrieved',
      await this.service.listCustomerCandidates(groupId, query.search || '', limit),
    ));
  });

  update = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!this.requireAdmin(request, reply)) return;
    const groupId = Number((request.params as { id: string }).id);
    return reply.send(createSuccessResponse('Coupon group updated', await this.service.update(groupId, updateCouponGroupSchema.parse(request.body))));
  });

  addMembers = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!this.requireAdmin(request, reply)) return;
    const groupId = Number((request.params as { id: string }).id);
    const { customer_ids } = addCouponGroupMembersSchema.parse(request.body);
    return reply.send(createSuccessResponse('Coupon group members added', await this.service.addMembers(groupId, customer_ids)));
  });

  removeMember = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!this.requireAdmin(request, reply)) return;
    const { id, customerId } = request.params as { id: string; customerId: string };
    await this.service.removeMember(Number(id), Number(customerId));
    return reply.send(createSuccessResponse('Coupon group member removed', null));
  });

  removeMembers = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!this.requireAdmin(request, reply)) return;
    const groupId = Number((request.params as { id: string }).id);
    const { customer_ids } = addCouponGroupMembersSchema.parse(request.body);
    return reply.send(createSuccessResponse('Coupon group members removed', await this.service.removeMembers(groupId, customer_ids)));
  });
}
