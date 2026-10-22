import { FastifyInstance } from 'fastify';
import { logAmazonFailure } from '../utils/amazonFailureLog.js';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireAmazonChannelPermission } from '../middleware/amazon-channel-permission.middleware.js';
import {
  AmazonConnectionError,
  amazonConnectionService,
  AmazonUserType,
} from '../services/amazon-connection.service.js';

const amazonUser = (request: AuthenticatedRequest): { userId: number; userType: AmazonUserType } => {
  if (!request.user?.id) throw new AmazonConnectionError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  return {
    userId: request.user.id,
    userType: request.user.userType === 'ecommerce' ? 'users' : 'inventoryusers',
  };
};

const sendConnectionError = (reply: import('fastify').FastifyReply, error: unknown) => {
  logAmazonFailure(reply.request, error);
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
}
