import { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { claimCouponSchema, couponWalletListSchema } from '../schemas/coupon-wallet.schema.js';
import { CouponWalletService } from '../services/coupon-wallet.service.js';
import { asyncHandler, createSuccessResponse } from '../utils/errorHandler.js';

export class CouponWalletController {
  private service = new CouponWalletService();

  getMyWallet = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'ecommerce') {
      return reply.code(403).send({ success: false, message: 'Customer authentication required' });
    }
    const coupons = await this.service.getCustomerWallet(request.user.id);
    return reply.send(createSuccessResponse('Coupon wallet retrieved', coupons));
  });

  claimCoupon = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'ecommerce') {
      return reply.code(403).send({ success: false, message: 'Customer authentication required' });
    }
    const { code } = claimCouponSchema.parse(request.body);
    const coupon = await this.service.claimCoupon(request.user.id, code);
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
}
