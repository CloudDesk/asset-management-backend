import { FastifyInstance } from 'fastify';
import { RoleController } from '../controllers/role.controller.js';

export async function roleRoutes(fastify: FastifyInstance) {
  const roleController = new RoleController();

  // GET /v1/roles - Get all roles with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all roles with pagination and filtering',
      tags: ['Roles'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          name: { type: 'string', description: 'Filter by role name' },
          code: { type: 'string', description: 'Filter by role code' },
          level: { type: 'string', description: 'Filter by level' },
          isactive: { type: 'string', description: 'Filter by active status (true/false)' },
          issystem: { type: 'string', description: 'Filter by system role status (true/false)' },
          parentroleid: { type: 'string', description: 'Filter by parent role ID' },
          sortBy: { type: 'string', description: 'Sort by field: id, name, or level (default: level)', enum: ['id', 'name', 'level'] },
          sortOrder: { type: 'string', description: 'Sort order: asc or desc (default: asc)', enum: ['asc', 'desc', 'ASC', 'DESC'] },
        },
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { 
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                filters: { type: 'array', items: { type: 'string' } },
                total: { type: 'number' },
                filtered: { type: 'boolean' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, roleController.getRoles.bind(roleController));

  // GET /v1/roles/:id - Get role by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get role by ID',
      tags: ['Roles'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              additionalProperties: true
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, roleController.getRole.bind(roleController));

  // POST /v1/roles - Create new role
  fastify.post('/', {
    schema: {
      description: 'Create a new role',
      tags: ['Roles'],
      body: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string', maxLength: 100 },
          code: { type: 'string', maxLength: 50 },
          level: { type: 'number', default: 0 },
          description: { type: 'string', maxLength: 500 },
          isactive: { type: 'boolean', default: true },
          issystem: { type: 'boolean', default: false },
          parentroleid: { type: 'number' },
        },
        additionalProperties: true,
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              additionalProperties: true
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, roleController.createRole.bind(roleController));

  // PUT /v1/roles/:id - Update role
  fastify.put('/:id', {
    schema: {
      description: 'Update role by ID',
      tags: ['Roles'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 100 },
          code: { type: 'string', maxLength: 50 },
          level: { type: 'number' },
          description: { type: 'string', maxLength: 500 },
          isactive: { type: 'boolean' },
          issystem: { type: 'boolean' },
          parentroleid: { type: 'number', nullable: true },
        },
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              additionalProperties: true
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, roleController.updateRole.bind(roleController));

  // DELETE /v1/roles/:id - Delete role
  fastify.delete('/:id', {
    schema: {
      description: 'Delete role by ID (soft delete if has dependencies)',
      tags: ['Roles'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              additionalProperties: true
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, roleController.deleteRole.bind(roleController));

  // GET /v1/roles/level-preview - Preview level change impact
  fastify.get('/level-preview', {
    schema: {
      description: 'Preview the impact of assigning a specific level to a role',
      tags: ['Roles'],
      querystring: {
        type: 'object',
        required: ['level'],
        properties: {
          level: { 
            type: 'string', 
            description: 'The level to preview (must be >= 1)',
            pattern: '^[1-9]\\d*$'
          },
          excludeRoleId: { 
            type: 'string', 
            description: 'Optional: Role ID to exclude from impact calculation (for update operations)',
            pattern: '^\\d+$'
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                requestedLevel: { type: 'number' },
                levelExists: { type: 'boolean' },
                existingRoleAtLevel: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    code: { type: 'string' },
                    level: { type: 'number' },
                  },
                },
                affectedRolesCount: { type: 'number' },
                impact: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      roleId: { type: 'number' },
                      roleName: { type: 'string' },
                      roleCode: { type: 'string' },
                      currentLevel: { type: 'number' },
                      newLevel: { type: 'number' },
                    },
                  },
                },
                message: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, roleController.previewLevelChange.bind(roleController));
}

