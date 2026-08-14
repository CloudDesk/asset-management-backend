import { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { claimCouponSchema, couponWalletListSchema, createQuickCouponSchema, updateQuickCouponSchema, walletChannelSchema, walletDiscountQuoteSchema } from '../schemas/coupon-wallet.schema.js';
import { CouponWalletService } from '../services/coupon-wallet.service.js';
import { WalletRedemptionService } from '../services/wallet-redemption.service.js';
import { asyncHandler, createSuccessResponse } from '../utils/errorHandler.js';

export class CouponWalletController {
  private service = new CouponWalletService();
  private redemptionService = new WalletRedemptionService();

  getMyWallet = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'ecommerce') {
      return reply.code(403).send({ success: false, message: 'Customer authentication required' });
    }
    const { channel } = walletChannelSchema.parse(request.query);
    const coupons = await this.service.getCustomerWallet(request.user.id, channel);
    return reply.send(createSuccessResponse('Coupon wallet retrieved', coupons));
  });

  claimCoupon = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'ecommerce') {
      return reply.code(403).send({ success: false, message: 'Customer authentication required' });
    }
    const { code, channel } = claimCouponSchema.parse(request.body);
    const coupon = await this.service.claimCoupon(request.user.id, code, channel);
    return reply.send(createSuccessResponse('Coupon added to wallet', coupon));
  });

  listAdminCoupons = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'inventory') {
      return reply.code(403).send({ success: false, message: 'Inventory authentication required' });
    }
    const query = couponWalletListSchema.parse(request.query);
    const result = await this.service.listAdminCoupons(query);
    return reply.send(createSuccessResponse('Issued coupons retrieved', result));
  });

  getMyWalletActivity = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'ecommerce') {
      return reply.code(403).send({ success: false, message: 'Customer authentication required' });
    }
    const query = request.query as { page?: string; limit?: string; credit_id?: string };
    const page = Math.max(Number(query.page || 1) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit || 10) || 10, 1), 50);
    const creditId = query.credit_id ? Number(query.credit_id) : undefined;
    if (creditId !== undefined && (!Number.isInteger(creditId) || creditId <= 0)) {
      return reply.code(400).send({ success: false, message: 'Invalid wallet credit ID' });
    }
    const result = await this.service.getCustomerWalletActivity(request.user.id, page, limit, creditId);
    return reply.send(createSuccessResponse('Coupon wallet activity retrieved', result));
  });

  quoteWalletDiscount = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'ecommerce') {
      return reply.code(403).send({ success: false, message: 'Customer authentication required' });
    }
    const input = walletDiscountQuoteSchema.parse(request.body);
    const quote = await this.redemptionService.quote(request.user.id, input.eligibility_base, input.payable_amount);
    return reply.send(createSuccessResponse('Wallet discount calculated', quote));
  });

  previewCoupon = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'ecommerce') {
      return reply.code(403).send({ success: false, message: 'Customer authentication required' });
    }
    const { code, channel } = claimCouponSchema.parse(request.body);
    const coupon = await this.service.previewCoupon(request.user.id, code, channel);
    return reply.send(createSuccessResponse('Coupon is eligible to add to wallet', coupon));
  });

  createQuickCoupon = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'inventory') {
      return reply.code(403).send({ success: false, message: 'Inventory authentication required' });
    }
    const input = createQuickCouponSchema.parse(request.body);
    const coupon = await this.service.createQuickCoupon(input);
    return reply.code(201).send(createSuccessResponse('One-off coupon created', coupon));
  });

  updateQuickCoupon = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'inventory') {
      return reply.code(403).send({ success: false, message: 'Inventory authentication required' });
    }
    const assignmentId = Number((request.params as { assignmentId: string }).assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return reply.code(400).send({ success: false, message: 'Invalid coupon ID' });
    }
    const input = updateQuickCouponSchema.parse(request.body);
    const coupon = await this.service.updateQuickCoupon(assignmentId, input);
    return reply.send(createSuccessResponse('Coupon updated', coupon));
  });
}
