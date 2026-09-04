import type { FastifyInstance } from 'fastify';
import { PromotionsV2Controller } from '../controllers/promotions-v2.controller.js';
import { optionalSmartAuthentication } from '../middleware/smartAuth.middleware.js';

export async function promotionsV2Routes(fastify: FastifyInstance): Promise<void> {
  const controller = new PromotionsV2Controller();
  const optionalCustomer = { preHandler: optionalSmartAuthentication };
  fastify.post('/eligibility', optionalCustomer, controller.eligibility);
  fastify.post('/quote', optionalCustomer, controller.quote);
  fastify.post('/quote/:evaluationId/select', optionalCustomer, controller.select);
  fastify.delete('/quote/:evaluationId/selection/:promotionId', optionalCustomer, controller.removeSelection);
  fastify.post('/quote/:evaluationId/select-gift', optionalCustomer, controller.selectGift);
  fastify.post('/quote/:evaluationId/validate', optionalCustomer, controller.validate);
  fastify.put('/:promotionId/rules/draft', controller.saveDraft);
  fastify.get('/:promotionId/rules/latest', controller.latestRule);
  fastify.post('/:promotionId/migrate-legacy', controller.migrateLegacy);
  fastify.post('/:promotionId/simulate', controller.simulate);
  fastify.post('/:promotionId/publish', controller.publish);
  fastify.get('/facets', controller.facets);
  fastify.get('/analytics', controller.analytics);
  fastify.get('/:promotionId/matched-products', controller.matchedProducts);
}
