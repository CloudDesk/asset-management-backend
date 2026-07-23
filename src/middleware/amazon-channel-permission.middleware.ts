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

export type AmazonOperationalCapability =
  | 'amazon_listing_import'
  | 'amazon_mapping'
  | 'amazon_inventory_sync'
  | 'amazon_order_sync'
  | 'amazon_shipment_confirmation'
  | 'amazon_product_update'
  | 'amazon_operations_admin'
  | 'amazon_retry_failures'
  | 'amazon_export';

type ChannelPermissions = Partial<Record<AmazonChannelPermission, boolean>> & {
  customactions?: Record<string, boolean>;
};

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

const capabilityFallback: Record<AmazonOperationalCapability, AmazonChannelPermission[]> = {
  amazon_listing_import: ['import', 'create'],
  amazon_mapping: ['create', 'edit', 'modifyall'],
  amazon_inventory_sync: ['edit', 'modifyall'],
  amazon_order_sync: ['import', 'create'],
  amazon_shipment_confirmation: ['edit', 'modifyall'],
  amazon_product_update: ['edit', 'modifyall'],
  amazon_operations_admin: ['modifyall'],
  amazon_retry_failures: ['edit', 'modifyall'],
  amazon_export: ['read'],
};

export const requireAmazonOperationalCapability = (capability: AmazonOperationalCapability) =>
  async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    const userId = request.user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Authentication required' });
    const userPermissions = await getUserPermissions(userId);
    const channelPermissions = userPermissions.permissions.channels;
    const explicitlyAllowed = channelPermissions?.customactions?.[capability] === true;
    const explicitlyDenied = channelPermissions?.customactions?.[capability] === false;
    const fallbackAllowed = hasAmazonChannelPermission(channelPermissions, capabilityFallback[capability]);
    if (!explicitlyAllowed && (explicitlyDenied || !fallbackAllowed)) {
      return reply.code(403).send({
        success: false,
        message: `You do not have the ${capability} capability`,
        details: 'Ask an administrator to update the Channels custom actions.',
        statusCode: 403,
        code: 'AMAZON_OPERATION_CAPABILITY_DENIED',
      });
    }
  };
