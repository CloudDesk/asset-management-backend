import { FastifyInstance } from 'fastify';
import { PermissionSetController } from '../controllers/permissionset.controller.js';

export async function permissionSetRoutes(fastify: FastifyInstance) {
  const permissionSetController = new PermissionSetController();

  // GET /v1/permission-sets - Get all permission sets with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all permission sets with pagination and filtering',
      tags: ['Permission Sets'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          name: { type: 'string', description: 'Filter by permission set name' },
          roleid: { type: 'string', description: 'Filter by role ID' },
          isactive: { type: 'string', description: 'Filter by active status (true/false)' },
          isdefault: { type: 'string', description: 'Filter by default status (true/false)' },
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
  }, permissionSetController.getPermissionSets.bind(permissionSetController));

  // GET /v1/permission-sets/:id - Get permission set by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get permission set by ID',
      tags: ['Permission Sets'],
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
  }, permissionSetController.getPermissionSet.bind(permissionSetController));

  // POST /v1/permission-sets - Create new permission set
  fastify.post('/', {
    schema: {
      description: 'Create a new permission set',
      tags: ['Permission Sets'],
      body: {
        type: 'object',
        required: ['name', 'roleid', 'permissions'],
        properties: {
          name: { type: 'string', maxLength: 200 },
          description: { type: 'string', maxLength: 500 },
          roleid: { type: 'number' },
          isactive: { type: 'boolean', default: true },
          isdefault: { type: 'boolean', default: false },
          permissions: {
            type: 'array',
            items: {
              type: 'object',
              required: ['object'],
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
                accesslevel: { type: 'string', enum: ['all', 'own', 'subordinates'] },
                customactions: { type: 'object' },
              },
              additionalProperties: true
            },
            minItems: 1
          },
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
  }, permissionSetController.createPermissionSet.bind(permissionSetController));

  // PUT /v1/permission-sets/:id - Update permission set
  fastify.put('/:id', {
    schema: {
      description: 'Update permission set by ID',
      tags: ['Permission Sets'],
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
          name: { type: 'string', maxLength: 200 },
          description: { type: 'string', maxLength: 500 },
          roleid: { type: 'number' },
          isactive: { type: 'boolean' },
          isdefault: { type: 'boolean' },
          permissions: {
            type: 'array',
            items: {
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
                accesslevel: { type: 'string', enum: ['all', 'own', 'subordinates'] },
                customactions: { type: 'object' },
              },
              additionalProperties: true
            }
          },
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
  }, permissionSetController.updatePermissionSet.bind(permissionSetController));

  // DELETE /v1/permission-sets/:id - Delete permission set
  fastify.delete('/:id', {
    schema: {
      description: 'Delete permission set by ID',
      tags: ['Permission Sets'],
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
  }, permissionSetController.deletePermissionSet.bind(permissionSetController));

  // GET /v1/permission-sets/role/:roleid - Get all permission sets for a role
  fastify.get('/role/:roleid', {
    schema: {
      description: 'Get all permission sets for a specific role',
      tags: ['Permission Sets'],
      params: {
        type: 'object',
        properties: {
          roleid: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['roleid'],
      },
      querystring: {
        type: 'object',
        properties: {
          activeOnly: { type: 'string', enum: ['true', 'false'], description: 'Filter to active permission sets only (default: true)' },
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
              items: {
                type: 'object',
                additionalProperties: true
              }
            },
          },
        },
      },
    },
  }, permissionSetController.getPermissionSetsByRole.bind(permissionSetController));

  // GET /v1/permission-sets/role/:roleid/active - Get active permission set for a role (using selection logic)
  fastify.get('/role/:roleid/active', {
    schema: {
      description: 'Get the active permission set for a role using selection logic (default → first active)',
      tags: ['Permission Sets'],
      params: {
        type: 'object',
        properties: {
          roleid: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['roleid'],
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
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, permissionSetController.getPermissionSetForRole.bind(permissionSetController));

  // GET /v1/permission-sets/preview - Preview activation impact
  fastify.get('/preview', {
    schema: {
      description: 'Preview the impact of activating a permission set for a role (shows which sets would be deactivated)',
      tags: ['Permission Sets'],
      querystring: {
        type: 'object',
        required: ['roleid'],
        properties: {
          roleid: { 
            type: 'string', 
            description: 'Role ID to preview activation for',
            pattern: '^\\d+$'
          },
          permissionSetId: { 
            type: 'string', 
            description: 'Optional: Permission Set ID being activated (for update operations)',
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
                roleId: { type: 'number' },
                roleName: { type: 'string' },
                roleCode: { type: 'string' },
                activatingPermissionSet: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    currentStatus: { type: 'string' },
                    newStatus: { type: 'string' },
                  },
                },
                currentlyActiveCount: { type: 'number' },
                willBeDeactivated: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      permissionSetId: { type: 'number' },
                      permissionSetName: { type: 'string' },
                      description: { type: 'string', nullable: true },
                      currentStatus: { type: 'string' },
                      newStatus: { type: 'string' },
                      isDefault: { type: 'boolean' },
                      createdDate: { type: 'number', nullable: true },
                    },
                  },
                },
                impact: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      permissionSetId: { type: 'number' },
                      permissionSetName: { type: 'string' },
                      description: { type: 'string', nullable: true },
                      currentStatus: { type: 'string' },
                      newStatus: { type: 'string' },
                      isDefault: { type: 'boolean' },
                      createdDate: { type: 'number', nullable: true },
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
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, permissionSetController.previewActivation.bind(permissionSetController));

  // GET /v1/permission-sets/system-default-preview - Preview system default impact
  fastify.get('/system-default-preview', {
    schema: {
      description: 'Preview the impact of setting a permission set as system-wide default (shows which existing system default would be unset)',
      tags: ['Permission Sets'],
      querystring: {
        type: 'object',
        properties: {
          permissionSetId: { 
            type: 'string', 
            description: 'Optional: Permission Set ID being set as system default (for update operations). If not provided, previews for creating a new system default.',
            pattern: '^\\d+$'
          },
        },
        additionalProperties: false,
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
                settingAsDefault: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    roleid: { type: 'number', nullable: true },
                    currentIsDefault: { type: 'boolean' },
                    newIsDefault: { type: 'boolean' },
                  },
                },
                currentSystemDefault: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    roleid: { type: 'number', nullable: true },
                    isactive: { type: 'boolean' },
                  },
                },
                willBeUnset: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      permissionSetId: { type: 'number' },
                      permissionSetName: { type: 'string' },
                      description: { type: 'string', nullable: true },
                      currentStatus: { type: 'string' },
                      newStatus: { type: 'string' },
                      roleid: { type: 'number', nullable: true },
                      isActive: { type: 'boolean' },
                      createdDate: { type: 'number', nullable: true },
                    },
                  },
                },
                impact: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      permissionSetId: { type: 'number' },
                      permissionSetName: { type: 'string' },
                      description: { type: 'string', nullable: true },
                      currentStatus: { type: 'string' },
                      newStatus: { type: 'string' },
                      roleid: { type: 'number', nullable: true },
                      isActive: { type: 'boolean' },
                      createdDate: { type: 'number', nullable: true },
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
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, permissionSetController.previewSystemDefault.bind(permissionSetController));
}

