import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from './auth.middleware.js';
import { getUserPermissions } from '../utils/permissionChecker.js';

type FlipkartChannelPermission = 'read' | 'create' | 'edit' | 'import' | 'modifyall';

export const requireFlipkartChannelPermission = (allowed: FlipkartChannelPermission[]) => async (
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.code(401).send({
      success: false,
      message: 'Authentication required',
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
  }

  const userPermissions = await getUserPermissions(userId);
  if (!allowed.some((permission) => userPermissions.permissions.channels?.[permission] === true)) {
    return reply.code(403).send({
      success: false,
      message: 'You do not have permission to perform this Flipkart action',
      details: 'Ask an administrator to update your Channels permissions.',
      statusCode: 403,
      code: 'FLIPKART_CHANNEL_PERMISSION_DENIED',
    });
  }
};

export const requireFlipkartChannelRead = requireFlipkartChannelPermission(['read']);
