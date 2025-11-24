import { FastifyInstance } from 'fastify';
import { getUserPermissions, checkPermission } from '../utils/permissionChecker.js';
import { authenticateInventoryUser, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';

export async function permissionRoutes(fastify: FastifyInstance) {
  // GET /v1/permissions/user - Get all permissions for current user (for frontend)
  fastify.get('/user', {
    preHandler: [authenticateInventoryUser],
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
  }, asyncHandler(async (request: AuthenticatedRequest, reply) => {
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

  // GET /v1/permissions/check - Check specific permission (optional, for frontend)
  fastify.get('/check', {
    preHandler: [authenticateInventoryUser],
    schema: {
      description: 'Check if current user has a specific permission',
      tags: ['Permissions'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          object: { 
            type: 'string',
            description: 'Object name (e.g., "products", "stocks")'
          },
          action: { 
            type: 'string',
            description: 'Action to check (e.g., "read", "create", "edit", "delete")'
          },
          resourceid: {
            type: 'string',
            description: 'Optional: Resource ID for ownership check'
          },
          resourceownerid: {
            type: 'string',
            description: 'Optional: Resource owner ID for ownership check'
          }
        },
        required: ['object', 'action']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                allowed: { type: 'boolean' },
                reason: { type: 'string', nullable: true },
                inheritedFrom: { type: 'string', nullable: true },
                scope: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    viewall: { type: 'boolean' },
                    modifyall: { type: 'boolean' },
                    deleteall: { type: 'boolean' }
                  }
                }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' }
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
  }, asyncHandler(async (request: AuthenticatedRequest, reply) => {
    const userid = request.user?.id;

    if (!userid) {
      return reply.code(401).send({
        success: false,
        message: 'Unauthorized',
        details: 'User not authenticated',
        statusCode: 401
      });
    }

    const { object, action, resourceid, resourceownerid } = request.query as {
      object: string;
      action: string;
      resourceid?: string;
      resourceownerid?: string;
    };

    if (!object || !action) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid request',
        details: 'object and action are required',
        statusCode: 400
      });
    }

    logger.debug({ userid, object, action, resourceid, resourceownerid }, 'Checking specific permission');

    const result = await checkPermission(
      userid,
      object,
      action,
      {
        object,
        action,
        resourceid,
        resourceownerid: resourceownerid ? parseInt(resourceownerid) : undefined
      }
    );

    logger.info({ 
      userid, 
      object, 
      action, 
      allowed: result.allowed 
    }, 'Permission check completed');

    const response = createSuccessResponse('Permission check completed', result);
    return reply.code(200).send(response);
  }));
}

