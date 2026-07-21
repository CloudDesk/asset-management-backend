import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from './auth.middleware.js';
import { getUserPermissions } from '../utils/permissionChecker.js';

export type AmazonChannelPermission =
  | 'read'
  | 'create'
  | 'edit'
  | 'delete'
  | 'import'
  | 'modifyall';

type ChannelPermissions = Partial<Record<AmazonChannelPermission, boolean>>;

export const hasAmazonChannelPermission = (
  permissions: ChannelPermissions | undefined,
  allowed: AmazonChannelPermission[]
): boolean => allowed.some((permission) => permissions?.[permission] === true);

export const requireAmazonChannelPermission = (allowed: AmazonChannelPermission[]) =>
  async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
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
    const channelPermissions = userPermissions.permissions.channels;
    if (!hasAmazonChannelPermission(channelPermissions, allowed)) {
      return reply.code(403).send({
        success: false,
        message: 'You do not have permission to perform this Amazon action',
        details: 'Ask an administrator to update your Channels permissions.',
        statusCode: 403,
        code: 'AMAZON_CHANNEL_PERMISSION_DENIED',
      });
    }
  };
