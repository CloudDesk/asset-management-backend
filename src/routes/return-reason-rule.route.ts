import { FastifyInstance } from 'fastify';
import { ReturnReasonRuleController } from '../controllers/return-reason-rule.controller.js';

const resolutionEnum = ['replacement', 'refund', 'partial_refund', 'ship_missing_item', 'complete_return'];

const reasonRuleBodySchema = {
  type: 'object',
  required: ['reasoncode', 'reasonname'],
  properties: {
    reasoncode: { type: 'string' },
    reasonname: { type: 'string' },
    source: { type: 'string', enum: ['customer', 'delivery_partner', 'admin', 'both'] },
    aliases: { type: 'array', items: { type: 'string' } },
    allowedresolutions: { type: 'array', items: { type: 'string', enum: resolutionEnum } },
    minimumraisewindowhours: { type: 'number', nullable: true },
    photorequired: { type: 'boolean' },
    videorequired: { type: 'boolean' },
    packagephotorequired: { type: 'boolean' },
    packagephotooptional: { type: 'boolean' },
    unboxingvideorequired: { type: 'boolean' },
    unboxingvideooptional: { type: 'boolean' },
    openedpackageallowed: { type: 'boolean' },
    pickuprequired: { type: 'boolean' },
    evidencefirstapproval: { type: 'boolean' },
    autocreatepickup: { type: 'boolean' },
    reverseshippingchargebearer: { type: 'string', enum: ['nivaana', 'customer', 'undecided'], nullable: true },
    notes: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['active', 'inactive'] },
  },
  additionalProperties: false,
};

export async function returnReasonRuleRoutes(fastify: FastifyInstance) {
  const controller = new ReturnReasonRuleController();

  fastify.get('/', {
    schema: {
      description: 'List return reason rules',
      tags: ['Return Reason Rules'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          limit: { type: 'string' },
          source: { type: 'string', enum: ['customer', 'delivery_partner', 'admin', 'both'] },
          status: { type: 'string', enum: ['active', 'inactive'] },
          q: { type: 'string' },
        },
      },
    },
  }, controller.getRules);

  fastify.post('/defaults', {
    schema: {
      description: 'Upsert default customer and delivery-partner reason rules',
      tags: ['Return Reason Rules'],
    },
  }, controller.upsertDefaults);

  fastify.get('/:id', {
    schema: {
      description: 'Get return reason rule by ID',
      tags: ['Return Reason Rules'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, controller.getRule);

  fastify.post('/', {
    schema: {
      description: 'Create return reason rule',
      tags: ['Return Reason Rules'],
      body: reasonRuleBodySchema,
    },
  }, controller.createRule);

  fastify.put('/:id', {
    schema: {
      description: 'Update return reason rule',
      tags: ['Return Reason Rules'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        ...reasonRuleBodySchema,
        required: [],
      },
    },
  }, controller.updateRule);
}
