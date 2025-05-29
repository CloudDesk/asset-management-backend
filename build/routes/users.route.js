import { UsersController } from '../controllers/users.controller.js';
export async function usersRoutes(fastify) {
    const usersController = new UsersController();
    // GET /v1/users - Get all users with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all users with pagination and filtering',
            tags: ['Users'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    useremail: { type: 'string', description: 'Filter by user email' },
                    firstname: { type: 'string', description: 'Filter by first name' },
                    lastname: { type: 'string', description: 'Filter by last name' },
                    gender: { type: 'string', description: 'Filter by gender' },
                    gstnumber: { type: 'string', description: 'Filter by GST number' },
                    isbusinessuser: { type: 'string', description: 'Filter by business user status' },
                    createdAfter: { type: 'string', description: 'Created after date' },
                    createdBefore: { type: 'string', description: 'Created before date' },
                },
                additionalProperties: true, // Allow any query parameters for dynamic filtering
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'number' },
                                    useremail: { type: 'string' },
                                    firstname: { type: 'string' },
                                    lastname: { type: 'string' },
                                    gender: { type: 'string' },
                                    gstnumber: { type: 'string' },
                                    isbusinessuser: { type: 'boolean' },
                                    usermobilenumber: { type: 'number' },
                                    fcmid: { type: 'string' },
                                    createddate: { type: 'number' },
                                    modifieddate: { type: 'number' },
                                },
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
    }, usersController.getUsers.bind(usersController));
    // GET /v1/users/:id - Get user by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get user by ID',
            tags: ['Users'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'User ID' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                id: { type: 'number' },
                                useremail: { type: 'string' },
                                firstname: { type: 'string' },
                                lastname: { type: 'string' },
                                gender: { type: 'string' },
                                gstnumber: { type: 'string' },
                                isbusinessuser: { type: 'boolean' },
                                usermobilenumber: { type: 'number' },
                                fcmid: { type: 'string' },
                                createddate: { type: 'number' },
                                modifieddate: { type: 'number' },
                            },
                            additionalProperties: true
                        },
                        message: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
            },
        },
    }, usersController.getUser.bind(usersController));
    // POST /v1/users - Create new user
    fastify.post('/', {
        schema: {
            description: 'Create a new user',
            tags: ['Users'],
            body: {
                type: 'object',
                properties: {
                    useremail: { type: 'string', format: 'email', description: 'User email address' },
                    userpassword: { type: 'string', description: 'User password' },
                    firstname: { type: 'string', description: 'First name' },
                    lastname: { type: 'string', description: 'Last name' },
                    gender: { type: 'string', description: 'Gender' },
                    gstnumber: { type: 'string', description: 'GST number' },
                    isbusinessuser: { type: 'boolean', description: 'Is business user' },
                    usermobilenumber: { type: 'string', description: 'Mobile number' },
                    fcmid: { type: 'string', description: 'FCM ID' },
                },
                additionalProperties: true,
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true
                        },
                        message: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
            },
        },
    }, usersController.createUser.bind(usersController));
    // PUT /v1/users/:id - Update user
    fastify.put('/:id', {
        schema: {
            description: 'Update user by ID',
            tags: ['Users'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'User ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    useremail: { type: 'string', format: 'email', description: 'User email address' },
                    userpassword: { type: 'string', description: 'User password' },
                    firstname: { type: 'string', description: 'First name' },
                    lastname: { type: 'string', description: 'Last name' },
                    gender: { type: 'string', description: 'Gender' },
                    gstnumber: { type: 'string', description: 'GST number' },
                    isbusinessuser: { type: 'boolean', description: 'Is business user' },
                    usermobilenumber: { type: 'string', description: 'Mobile number' },
                    fcmid: { type: 'string', description: 'FCM ID' },
                },
                additionalProperties: true,
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true
                        },
                        message: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
            },
        },
    }, usersController.updateUser.bind(usersController));
    // DELETE /v1/users/:id - Delete user
    fastify.delete('/:id', {
        schema: {
            description: 'Delete user by ID',
            tags: ['Users'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'User ID' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
            },
        },
    }, usersController.deleteUser.bind(usersController));
    // POST /v1/users/upsert - Upsert user
    fastify.post('/upsert', {
        schema: {
            description: 'Create or update user (upsert)',
            tags: ['Users'],
            body: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'User ID (for update)' },
                    useremail: { type: 'string', format: 'email', description: 'User email address' },
                    userpassword: { type: 'string', description: 'User password' },
                    firstname: { type: 'string', description: 'First name' },
                    lastname: { type: 'string', description: 'Last name' },
                    gender: { type: 'string', description: 'Gender' },
                    gstnumber: { type: 'string', description: 'GST number' },
                    isbusinessuser: { type: 'boolean', description: 'Is business user' },
                    usermobilenumber: { type: 'string', description: 'Mobile number' },
                    fcmid: { type: 'string', description: 'FCM ID' },
                },
                additionalProperties: true,
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { type: 'object', additionalProperties: true },
                        message: { type: 'string' },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
            },
        },
    }, usersController.upsertUser.bind(usersController));
}
//# sourceMappingURL=users.route.js.map