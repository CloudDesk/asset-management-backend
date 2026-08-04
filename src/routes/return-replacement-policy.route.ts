import { FastifyInstance } from 'fastify';
import { ReturnReplacementPolicyController } from '../controllers/return-replacement-policy.controller.js';

const policyResponseProperties = {
  id: { type: 'number' },
  category: { type: 'string' },
  subcategory: { type: 'string', nullable: true },
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

const reasonCodeParamsSchema = {
  type: 'object',
  required: ['id', 'reasonCode'],
  properties: {
    id: { type: 'string' },
    reasonCode: { type: 'string' },
  },
};

const policyReasonConfigurationBodySchema = {
  type: 'object',
  required: ['configurationVersion', 'configuration'],
  properties: {
    configurationVersion: { type: 'number' },
    isActive: { type: 'boolean' },
    modifiedBy: { type: 'number' },
    configuration: {
      type: 'object',
      properties: {
        aliases: { type: 'array', items: { type: 'string' } },
        raiseWithinHours: { type: 'number', nullable: true },
        evidence: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'required', 'minimum'],
            properties: {
              type: { type: 'string', enum: ['product_photo', 'package_photo', 'unboxing_video', 'defect_video', 'other'] },
              required: { type: 'boolean' },
              minimum: { type: 'number' },
            },
            additionalProperties: false,
          },
        },
        allowedResolutions: {
          type: 'array',
          items: { type: 'string', enum: ['replacement', 'refund', 'partial_refund', 'ship_missing_item', 'complete_return'] },
        },
        openedPackageAllowed: { type: 'boolean' },
        approvalMode: { type: 'string', enum: ['evidence_first', 'pickup_first'] },
        resolutionTiming: { type: 'string', nullable: true },
        pickup: {
          type: 'object',
          properties: {
            required: { type: 'boolean' },
            triggerMode: { type: 'string', enum: ['manual_admin'] },
            chargeBearer: { type: 'string', enum: ['nivaana'] },
            deductChargeFromRefund: { type: 'boolean', enum: [false] },
          },
          additionalProperties: false,
        },
        stockUnavailableResolution: {
          type: 'string',
          enum: ['replacement', 'refund', 'partial_refund', 'ship_missing_item', 'complete_return', null],
          nullable: true,
        },
        notifyCustomerOnStockFallback: { type: 'boolean' },
      },
      additionalProperties: false,
    },
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
          requesttype: { type: 'string', enum: ['return', 'replacement'] },
        },
      },
    },
  }, controller.checkEligibility);

  fastify.get('/:id/reasons', {
    schema: {
      description: 'List policy-specific reason configurations for a return/replacement policy',
      tags: ['Return Replacement Policies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, controller.getPolicyReasons);

  fastify.get('/:id/reasons/:reasonCode', {
    schema: {
      description: 'Get one policy-specific reason configuration',
      tags: ['Return Replacement Policies'],
      params: reasonCodeParamsSchema,
    },
  }, controller.getPolicyReason);

  fastify.patch('/:id/reasons/:reasonCode', {
    schema: {
      description: 'Update one policy-specific reason configuration with optimistic version control',
      tags: ['Return Replacement Policies'],
      params: reasonCodeParamsSchema,
      body: policyReasonConfigurationBodySchema,
    },
  }, controller.updatePolicyReason);

  fastify.post('/:id/reasons/:reasonCode/reset', {
    schema: {
      description: 'Reset one policy-specific reason configuration to the current master default',
      tags: ['Return Replacement Policies'],
      params: reasonCodeParamsSchema,
      body: {
        type: 'object',
        properties: {
          configurationVersion: { type: 'number' },
          modifiedBy: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  }, controller.resetPolicyReason);

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
