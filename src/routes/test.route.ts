import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest, requireAuthentication } from '../middleware/auth.middleware.js';
import { createSuccessResponse } from '../utils/errorHandler.js';

/**
 * Test Routes for Auth Sessions
 * 
 * Purpose: Demonstrate and test public vs protected routes
 */
export async function testRoutes(fastify: FastifyInstance) {

    // PUBLIC ROUTE - No authentication required
    fastify.get('/test/public', {
        schema: {
            description: 'Public test route - no authentication required',
            tags: ['Testing'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                message: { type: 'string' },
                                timestamp: { type: 'number' },
                                requiresAuth: { type: 'boolean' }
                            }
                        },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const response = createSuccessResponse('Public route accessed successfully', {
            message: 'This route does not require authentication',
            timestamp: Date.now(),
            requiresAuth: false,
        });

        return reply.code(200).send(response);
    });

    // PROTECTED ROUTE - Authentication required
    fastify.get('/test/protected', {
        preHandler: requireAuthentication, // This enforces authentication
        schema: {
            description: 'Protected test route - requires authentication',
            tags: ['Testing'],
            security: [{ bearerAuth: [] }],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                message: { type: 'string' },
                                timestamp: { type: 'number' },
                                requiresAuth: { type: 'boolean' },
                                authenticatedUser: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'number' },
                                        email: { type: 'string' },
                                        userType: { type: 'string' }
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
                }
            }
        }
    }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
        const response = createSuccessResponse('Protected route accessed successfully', {
            message: 'You are authenticated!',
            timestamp: Date.now(),
            requiresAuth: true,
            authenticatedUser: {
                id: request.user!.id,
                email: request.user!.useremail,
                userType: request.user!.userType || 'unknown',
            },
        });

        return reply.code(200).send(response);
    });

    // PROTECTED ROUTE - Test 401 with invalid token
    fastify.get('/test/401-demo', {
        preHandler: requireAuthentication,
        schema: {
            description: 'Protected route that returns 401 if token is invalid',
            tags: ['Testing'],
            security: [{ bearerAuth: [] }],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                message: { type: 'string' }
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
                }
            }
        }
    }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
        // If we reach here, token was valid
        const response = createSuccessResponse('Token is valid', {
            message: 'You successfully authenticated with a valid token',
        });

        return reply.code(200).send(response);
    });

    // TEST: Session info endpoint
    fastify.get('/test/session-info', {
        preHandler: requireAuthentication,
        schema: {
            description: 'Get current session information',
            tags: ['Testing'],
            security: [{ bearerAuth: [] }],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                user: { type: 'object' },
                                sessionInfo: { type: 'object' }
                            }
                        },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
        const response = createSuccessResponse('Session information retrieved', {
            user: {
                id: request.user!.id,
                email: request.user!.useremail,
                role: request.user!.role,
                userType: request.user!.userType,
            },
            sessionInfo: {
                ip: request.ip,
                userAgent: request.headers['user-agent'],
                requestedAt: new Date().toISOString(),
            },
        });

        return reply.code(200).send(response);
    });
}
