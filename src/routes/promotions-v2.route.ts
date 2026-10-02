import type { FastifyInstance } from 'fastify';
import { PromotionsV2Controller } from '../controllers/promotions-v2.controller.js';
import { optionalSmartAuthentication } from '../middleware/smartAuth.middleware.js';

export async function promotionsV2Routes(fastify: FastifyInstance): Promise<void> {
  const controller = new PromotionsV2Controller();
  const optionalCustomer = { preHandler: optionalSmartAuthentication };
  fastify.post('/check-eligibility', optionalCustomer, controller.checkEligibility);
  fastify.post('/calculate', optionalCustomer, controller.calculate);
  fastify.post('/evaluations/:evaluationId/promotions', optionalCustomer, controller.applyPromotion);
  fastify.delete('/evaluations/:evaluationId/promotions/:promotionId', optionalCustomer, controller.removePromotion);
  fastify.post('/evaluations/:evaluationId/gifts', optionalCustomer, controller.chooseGift);
  fastify.post('/evaluations/:evaluationId/validate', optionalCustomer, controller.validateEvaluation);
  fastify.put('/:promotionId/rules/draft', controller.saveDraft);
  fastify.get('/:promotionId/rules/latest', controller.latestRule);
  fastify.post('/:promotionId/migrate-legacy', controller.migrateLegacy);
  fastify.post('/:promotionId/simulate', controller.simulate);
  fastify.post('/:promotionId/publish', controller.publish);
  fastify.get('/facets', controller.facets);
  fastify.get('/analytics', controller.analytics);
  fastify.get('/:promotionId/matched-products', controller.matchedProducts);
}
