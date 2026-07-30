import { FastifyInstance } from 'fastify';
import { ReturnReplacementPolicyController } from '../controllers/return-replacement-policy.controller.js';

const policyResponseProperties = {
  id: { type: 'number' },
  category: { type: 'string' },
  subcategory: { type: 'string', nullable: true },
  subsubcategory: { type: 'string', nullable: true },
  scopekey: { type: 'string' },
  returnallowed: { type: 'boolean' },
  replacementallowed: { type: 'boolean' },
  returnwindowdays: { type: 'number', nullable: true },
  replacementwindowdays: { type: 'number', nullable: true },
  allowedrefundmethods: { type: 'array', items: { type: 'string' } },
  notes: { type: 'string', nullable: true },
  isactive: { type: 'boolean' },
  createdby: { type: 'number', nullable: true },
  modifiedby: { type: 'number', nullable: true },
  createddate: { type: 'number', nullable: true },
  modifieddate: { type: 'number', nullable: true },
};

const policyBodySchema = {
  type: 'object',
  required: ['category'],
  properties: {
    category: { type: 'string' },
    subcategory: { type: 'string' },
    subsubcategory: { type: 'string' },
    returnallowed: { type: 'boolean' },
    replacementallowed: { type: 'boolean' },
    returnwindowdays: { type: 'number' },
    replacementwindowdays: { type: 'number' },
    allowedrefundmethods: {
      type: 'array',
      items: { type: 'string', enum: ['original_payment', 'wallet'] },
    },
    notes: { type: 'string' },
    isactive: { type: 'boolean' },
    createdby: { type: 'number' },
    modifiedby: { type: 'number' },
  },
  additionalProperties: false,
};

export async function returnReplacementPolicyRoutes(fastify: FastifyInstance) {
  const controller = new ReturnReplacementPolicyController();

  fastify.get('/', {
    schema: {
      description: 'List return and replacement policies',
      tags: ['Return Replacement Policies'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          limit: { type: 'string' },
          category: { type: 'string' },
          subcategory: { type: 'string' },
          subsubcategory: { type: 'string' },
          isactive: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'array',
              items: { type: 'object', properties: policyResponseProperties, additionalProperties: true },
            },
            pagination: { type: 'object', additionalProperties: true },
            meta: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, controller.getPolicies);

  fastify.get('/eligibility', {
    schema: {
      description: 'Evaluate return/replacement eligibility by orderline, product, or category scope',
      tags: ['Return Replacement Policies'],
      querystring: {
        type: 'object',
        properties: {
          orderlineid: { type: 'string' },
          productid: { type: 'string' },
          category: { type: 'string' },
          subcategory: { type: 'string' },
          subsubcategory: { type: 'string' },
          requesttype: { type: 'string', enum: ['return', 'replacement'] },
        },
      },
    },
  }, controller.checkEligibility);

  fastify.get('/:id', {
    schema: {
      description: 'Get return/replacement policy by ID',
      tags: ['Return Replacement Policies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, controller.getPolicy);

  fastify.post('/', {
    schema: {
      description: 'Create return/replacement policy',
      tags: ['Return Replacement Policies'],
      body: policyBodySchema,
    },
  }, controller.createPolicy);

  fastify.post('/upsert', {
    schema: {
      description: 'Create or update a policy for the supplied category scope',
      tags: ['Return Replacement Policies'],
      body: policyBodySchema,
    },
  }, controller.upsertPolicy);

  fastify.put('/:id', {
    schema: {
      description: 'Update return/replacement policy',
      tags: ['Return Replacement Policies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        ...policyBodySchema,
        required: [],
      },
    },
  }, controller.updatePolicy);

  fastify.delete('/:id', {
    schema: {
      description: 'Delete return/replacement policy',
      tags: ['Return Replacement Policies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, controller.deletePolicy);
}
