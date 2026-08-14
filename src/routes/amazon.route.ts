import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { amazonSandboxInventoryService } from '../services/amazon-sandbox-inventory.service.js';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireAmazonChannelPermission } from '../middleware/amazon-channel-permission.middleware.js';
import {
  AmazonConnectionError,
  amazonConnectionService,
  AmazonUserType,
} from '../services/amazon-connection.service.js';

type SandboxInventoryQuery = {
  nextToken?: string;
  sellerSku?: string;
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

const amazonUser = (request: AuthenticatedRequest): { userId: number; userType: AmazonUserType } => {
  if (!request.user?.id) throw new AmazonConnectionError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  return {
    userId: request.user.id,
    userType: request.user.userType === 'ecommerce' ? 'users' : 'inventoryusers',
  };
};

const sendConnectionError = (reply: import('fastify').FastifyReply, error: unknown) => {
  const connectionError = error instanceof AmazonConnectionError
    ? error
    : new AmazonConnectionError('Amazon connection request failed', 500, 'AMAZON_CONNECTION_FAILED');
  return reply.code(connectionError.statusCode).send({
    success: false,
    message: connectionError.message,
    details: connectionError.message,
    statusCode: connectionError.statusCode,
    code: connectionError.code,
  });
};

export async function amazonRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/initiate', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['create', 'edit', 'modifyall'])],
    schema: {
      description: 'Start the Amazon OAuth connection flow',
      tags: ['Amazon Connection'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const user = amazonUser(request as AuthenticatedRequest);
      const data = amazonConnectionService.initiateOAuth(user.userId, user.userType);
      return reply.code(200).send({
        success: true,
        message: 'Amazon authorization started',
        data,
      });
    } catch (error) {
      return sendConnectionError(reply, error);
    }
  });

  fastify.post<{
    Body: { code: string; sellingPartnerId: string; state: string };
  }>('/auth/callback', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['create', 'edit', 'modifyall'])],
    schema: {
      description: 'Complete Amazon OAuth and store the refresh token encrypted',
      tags: ['Amazon Connection'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['code', 'sellingPartnerId', 'state'],
        properties: {
          code: { type: 'string', minLength: 1 },
          sellingPartnerId: { type: 'string', minLength: 1 },
          state: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    try {
      const user = amazonUser(request as AuthenticatedRequest);
      const data = await amazonConnectionService.completeOAuth({
        ...user,
        code: request.body.code.trim(),
        sellingPartnerId: request.body.sellingPartnerId.trim(),
        state: request.body.state,
      });
      return reply.code(200).send({ success: true, message: 'Amazon account connected successfully', data });
    } catch (error) {
      return sendConnectionError(reply, error);
    }
  });

  fastify.get('/connection', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'Get Amazon OAuth connection and token health',
      tags: ['Amazon Connection'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const user = amazonUser(request as AuthenticatedRequest);
      const data = await amazonConnectionService.getConnectionStatus(user.userId, user.userType);
      if (!data) return reply.code(404).send({ success: false, message: 'Amazon account is not connected' });
      return reply.code(200).send({ success: true, message: 'Amazon connection retrieved successfully', data });
    } catch (error) {
      return sendConnectionError(reply, error);
    }
  });

  fastify.post('/auth/initialize', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['create'])],
    schema: {
      description: 'Manual browser refresh-token setup is disabled; use Amazon OAuth',
      tags: ['Amazon Connection'],
      security: [{ bearerAuth: [] }],
    },
  }, async (_request, reply) => reply.code(410).send({
    success: false,
    message: 'Manual refresh-token setup has been removed. Connect through Amazon OAuth.',
    code: 'AMAZON_MANUAL_TOKEN_SETUP_REMOVED',
  }));

  fastify.delete('/auth/disconnect', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['delete', 'edit', 'modifyall'])],
    schema: {
      description: 'Remove the stored Amazon OAuth connection and stop connection-based sync',
      tags: ['Amazon Connection'],
    },
  }, async (request, reply) => {
    try {
      const user = amazonUser(request as AuthenticatedRequest);
      await amazonConnectionService.disconnect(user.userId, user.userType);
      return reply.code(200).send({ success: true, message: 'Amazon account disconnected successfully' });
    } catch (error) {
      return sendConnectionError(reply, error);
    }
  });

  fastify.post<{ Body: CreateSandboxInventoryItemBody }>('/sandbox/inventory/items', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['create', 'edit', 'modifyall'])],
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
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['edit', 'modifyall'])],
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
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['delete', 'edit', 'modifyall'])],
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
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
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
