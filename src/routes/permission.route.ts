import { FastifyInstance, FastifyReply } from 'fastify';
import { getUserPermissions } from '../utils/permissionChecker.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';

export async function permissionRoutes(fastify: FastifyInstance) {
  // GET /v1/permissions/user - Get all permissions for current user (for frontend)
  fastify.get('/user', {
    schema: {
      description: 'Get all permissions for the current authenticated inventory user',
      tags: ['Permissions'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                role: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    code: { type: 'string' },
                    level: { type: 'number' }
                  }
                },
                permissions: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      object: { type: 'string' },
                      read: { type: 'boolean' },
                      create: { type: 'boolean' },
                      edit: { type: 'boolean' },
                      delete: { type: 'boolean' },
                      export: { type: 'boolean' },
                      import: { type: 'boolean' },
                      approve: { type: 'boolean' },
                      reject: { type: 'boolean' },
                      viewall: { type: 'boolean' },
                      modifyall: { type: 'boolean' },
                      deleteall: { type: 'boolean' },
                      accesslevel: { type: 'string' },
                      customactions: {
                        type: 'object',
                        additionalProperties: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            },
            message: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const userid = request.user?.id;

    if (!userid) {
      return reply.code(401).send({
        success: false,
        message: 'Unauthorized',
        details: 'User not authenticated',
        statusCode: 401
      });
    }

    logger.debug({ userid }, 'Fetching user permissions');

    const permissions = await getUserPermissions(userid);

    logger.info({
      userid,
      roleId: permissions.role?.id,
      permissionCount: Object.keys(permissions.permissions).length
    }, 'User permissions retrieved successfully');

    const response = createSuccessResponse('User permissions retrieved successfully', permissions);
    return reply.code(200).send(response);
  }));


}

