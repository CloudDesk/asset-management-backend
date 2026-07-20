import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { amazonSandboxInventoryService } from '../services/amazon-sandbox-inventory.service.js';

type SandboxInventoryQuery = {
  nextToken?: string;
  sellerSku?: string;
};

type InitializeAmazonBody = {
  refreshToken?: string;
};

type CreateSandboxInventoryItemBody = {
  sellerSku: string;
  productName: string;
};

type SandboxInventoryItemParams = {
  sellerSku: string;
};

type AddSandboxInventoryBody = {
  quantity: number;
};

function getAmazonError(error: unknown, fallbackMessage: string) {
  const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 502) : 500;
  const responseData = axios.isAxiosError(error)
    ? error.response?.data as {
        error_description?: string;
        errors?: Array<{ message?: string }>;
      } | undefined
    : undefined;
  const amazonMessage = responseData?.error_description || responseData?.errors?.[0]?.message;
  const message = amazonMessage || (error instanceof Error ? error.message : fallbackMessage);

  return {
    statusCode: statusCode >= 400 && statusCode < 600 ? statusCode : 502,
    message,
  };
}

export async function amazonRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: InitializeAmazonBody }>('/auth/initialize', {
    schema: {
      description: 'Validate Amazon sandbox LWA credentials and initialize the frontend connection',
      tags: ['Amazon SP-API'],
      body: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    try {
      const data = await amazonSandboxInventoryService.validateConnection(request.body.refreshToken);

      return reply.code(200).send({
        success: true,
        message: 'Amazon sandbox authentication initialized successfully',
        data,
      });
    } catch (error) {
      const { statusCode, message } = getAmazonError(error, 'Unable to initialize Amazon sandbox authentication');
      request.log.error({ err: error }, 'Amazon sandbox authentication failed');

      return reply.code(statusCode).send({
        success: false,
        message,
        details: message,
      });
    }
  });

  fastify.delete('/auth/disconnect', {
    schema: {
      description: 'Clear the frontend Amazon sandbox connection state',
      tags: ['Amazon SP-API'],
    },
  }, async (_request, reply) => {
    return reply.code(200).send({
      success: true,
      message: 'Amazon sandbox connection cleared',
    });
  });

  fastify.post<{ Body: CreateSandboxInventoryItemBody }>('/sandbox/inventory/items', {
    schema: {
      description: 'Create a virtual inventory item in the Amazon FBA dynamic sandbox',
      tags: ['Amazon SP-API'],
      body: {
        type: 'object',
        required: ['sellerSku', 'productName'],
        properties: {
          sellerSku: { type: 'string', minLength: 1, maxLength: 255, pattern: '\\S' },
          productName: { type: 'string', minLength: 1, maxLength: 500, pattern: '\\S' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    try {
      const data = await amazonSandboxInventoryService.createInventoryItem({
        sellerSku: request.body.sellerSku.trim(),
        productName: request.body.productName.trim(),
      });

      return reply.code(201).send({
        success: true,
        message: 'Amazon sandbox inventory item created successfully',
        data,
      });
    } catch (error) {
      const { statusCode, message } = getAmazonError(error, 'Unable to create Amazon sandbox inventory item');
      request.log.error({ err: error }, 'Amazon sandbox inventory item creation failed');

      return reply.code(statusCode).send({
        success: false,
        message,
      });
    }
  });

  fastify.post<{
    Params: SandboxInventoryItemParams;
    Body: AddSandboxInventoryBody;
  }>('/sandbox/inventory/items/:sellerSku/quantity', {
    schema: {
      description: 'Add quantity to a virtual inventory item in the Amazon FBA dynamic sandbox',
      tags: ['Amazon SP-API'],
      params: {
        type: 'object',
        required: ['sellerSku'],
        properties: {
          sellerSku: { type: 'string', minLength: 1, maxLength: 255, pattern: '\\S' },
        },
        additionalProperties: false,
      },
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'integer', minimum: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    try {
      const data = await amazonSandboxInventoryService.addInventory(
        request.params.sellerSku.trim(),
        request.body.quantity
      );

      return reply.code(200).send({
        success: true,
        message: 'Amazon sandbox inventory quantity added successfully',
        data,
      });
    } catch (error) {
      const { statusCode, message } = getAmazonError(error, 'Unable to add Amazon sandbox inventory quantity');
      request.log.error({ err: error }, 'Amazon sandbox inventory quantity update failed');

      return reply.code(statusCode).send({
        success: false,
        message,
      });
    }
  });

  fastify.delete<{ Params: SandboxInventoryItemParams }>('/sandbox/inventory/items/:sellerSku', {
    schema: {
      description: 'Delete a zero-quantity virtual inventory item from the Amazon FBA dynamic sandbox',
      tags: ['Amazon SP-API'],
      params: {
        type: 'object',
        required: ['sellerSku'],
        properties: {
          sellerSku: { type: 'string', minLength: 1, maxLength: 255, pattern: '\\S' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    try {
      const data = await amazonSandboxInventoryService.deleteInventoryItem(
        request.params.sellerSku.trim()
      );

      return reply.code(200).send({
        success: true,
        message: 'Amazon sandbox inventory item deleted successfully',
        data,
      });
    } catch (error) {
      const { statusCode, message } = getAmazonError(error, 'Unable to delete Amazon sandbox inventory item');
      request.log.error({ err: error }, 'Amazon sandbox inventory item deletion failed');

      return reply.code(statusCode).send({
        success: false,
        message,
      });
    }
  });

  fastify.get<{ Querystring: SandboxInventoryQuery }>('/sandbox/inventory', {
    schema: {
      description: 'Get virtual FBA inventory summaries from the Amazon SP-API dynamic sandbox',
      tags: ['Amazon SP-API'],
      querystring: {
        type: 'object',
        properties: {
          nextToken: { type: 'string' },
          sellerSku: { type: 'string', minLength: 1, maxLength: 255, pattern: '\\S' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    try {
      const data = await amazonSandboxInventoryService.getInventorySummaries(
        request.query.nextToken,
        request.query.sellerSku?.trim()
      );

      return reply.code(200).send({
        success: true,
        message: 'Amazon sandbox inventory retrieved successfully',
        data,
      });
    } catch (error) {
      const { statusCode, message } = getAmazonError(error, 'Unable to retrieve Amazon sandbox inventory');

      request.log.error({ err: error }, 'Amazon sandbox inventory request failed');

      return reply.code(statusCode).send({
        success: false,
        message,
      });
    }
  });
}
