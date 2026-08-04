import type { FastifyInstance } from 'fastify';
import { CouponWalletController } from '../controllers/coupon-wallet.controller.js';

export async function couponWalletRoutes(fastify: FastifyInstance) {
  const controller = new CouponWalletController();
  fastify.get('/me', controller.getMyWallet);
  fastify.post('/claim', controller.claimCoupon);
  fastify.get('/admin/coupons', controller.listAdminCoupons);
}
