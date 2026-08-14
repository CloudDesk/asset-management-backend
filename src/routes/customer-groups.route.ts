import { FastifyInstance } from 'fastify';
import { PromotionAssignmentController } from '../controllers/promotion-assignment.controller.js';

export async function customerGroupRoutes(fastify: FastifyInstance) {
  const controller = new PromotionAssignmentController();

  fastify.post('/', controller.createGroup);
  fastify.get('/', controller.listGroups);
  fastify.get('/:id', controller.getGroup);
  fastify.patch('/:id', controller.updateGroup);
  fastify.post('/:id/members', controller.addMembers);
  fastify.delete('/:id/members/:customerId', controller.removeMember);
}
