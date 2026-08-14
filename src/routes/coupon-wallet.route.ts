import type { FastifyInstance } from 'fastify';
import { CouponWalletController } from '../controllers/coupon-wallet.controller.js';
import { CouponGroupController } from '../controllers/coupon-group.controller.js';

export async function couponWalletRoutes(fastify: FastifyInstance) {
  const controller = new CouponWalletController();
  const groupController = new CouponGroupController();
  fastify.get('/me', controller.getMyWallet);
  fastify.get('/me/activity', controller.getMyWalletActivity);
  fastify.post('/preview', controller.previewCoupon);
  fastify.post('/claim', controller.claimCoupon);
  fastify.post('/discount/quote', controller.quoteWalletDiscount);
  fastify.get('/admin/coupons', controller.listAdminCoupons);
  fastify.post('/admin/coupons', controller.createQuickCoupon);
  fastify.patch('/admin/coupons/:assignmentId', controller.updateQuickCoupon);
  fastify.get('/admin/groups', groupController.list);
  fastify.post('/admin/groups', groupController.create);
  fastify.get('/admin/groups/:id/customers', groupController.listCustomerCandidates);
  fastify.get('/admin/groups/:id', groupController.get);
  fastify.patch('/admin/groups/:id', groupController.update);
  fastify.post('/admin/groups/:id/members', groupController.addMembers);
  fastify.post('/admin/groups/:id/members/remove', groupController.removeMembers);
  fastify.delete('/admin/groups/:id/members/:customerId', groupController.removeMember);
}
