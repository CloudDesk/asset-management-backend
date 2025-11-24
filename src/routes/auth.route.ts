import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InventoryUsersService } from '../services/inventoryusers.service.js';
import { authRateLimit } from '../utils/auth.js';
import { logger } from '../config/logger.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { AuthenticatedRequest, authenticateInventoryUser } from '../middleware/auth.middleware.js';

export async function authRoutes(fastify: FastifyInstance) {
  const inventoryUsersService = new InventoryUsersService();

  // POST /v1/auth/signin - Sign in inventory user
  fastify.post('/signin', {
    schema: {
      description: 'Sign in inventory user with email and password',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['useremail', 'userpassword'],
        properties: {
          useremail: { 
            type: 'string', 
            format: 'email', 
            description: 'User email address'
          },
          userpassword: { 
            type: 'string', 
            minLength: 1,
            description: 'User password'
          },
        },
        additionalProperties: false,
        examples: [
          {
            useremail: 'user@example.com',
            userpassword: 'SecurePassword123!'
          }
        ]
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    useremail: { type: 'string' },
                    role: { type: 'string' },
                    firstname: { type: 'string' },
                    lastname: { type: 'string' },
                    location: { type: 'string' },
                    roleid: { type: 'number', nullable: true },
                  },
                  additionalProperties: true
                },
                roles: {
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
                },
                token: { type: 'string', description: 'JWT access token' },
                refreshToken: { type: 'string', description: 'JWT refresh token' },
                expiresIn: { type: 'number', description: 'Access token expiry in seconds' },
              },
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
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        429: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
            remainingAttempts: { type: 'number' },
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
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { useremail, userpassword } = request.body as { useremail: string; userpassword: string };

    // Rate limiting check
    const identifier = `${request.ip}-${useremail}`;
    if (authRateLimit.isRateLimited(identifier)) {
      const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
      logger.warn({ 
        ip: request.ip, 
        email: useremail,
        remainingAttempts 
      }, 'Sign-in rate limited');
      
      return reply.code(429).send({
        success: false,
        message: 'Too many sign-in attempts',
        details: 'Please try again later',
        statusCode: 429,
        remainingAttempts,
      });
    }

    try {
      const result = await inventoryUsersService.authenticate(useremail, userpassword);
      
      if (!result) {
        // Record failed attempt
        authRateLimit.recordAttempt(identifier);
        const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
        
        logger.warn({ 
          ip: request.ip, 
          email: useremail,
          remainingAttempts 
        }, 'Sign-in failed: Invalid credentials');
        
        return reply.code(401).send({
          success: false,
          message: 'Invalid credentials',
          details: 'The email or password you entered is incorrect',
          statusCode: 401,
          remainingAttempts,
        });
      }

      // Clear rate limiting on successful sign-in
      authRateLimit.clearAttempts(identifier);

      logger.info({ 
        userId: result.user.id, 
        email: useremail,
        ip: request.ip 
      }, 'User signed in successfully');

      const response = createSuccessResponse('Sign-in successful', result);
      return reply.code(200).send(response);
    } catch (error) {
      authRateLimit.recordAttempt(identifier);
      logger.error({ error, email: useremail, ip: request.ip }, 'Error during sign-in');
      throw error;
    }
  }));

  // POST /v1/auth/register - Register new inventory user
  fastify.post('/register', {
    schema: {
      description: 'Register a new inventory user account',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['useremail', 'userpassword', 'firstname', 'lastname'],
        properties: {
          useremail: { 
            type: 'string', 
            format: 'email', 
            description: 'User email address'
          },
          userpassword: { 
            type: 'string', 
            minLength: 8,
            description: 'User password (minimum 8 characters)'
          },
          firstname: { 
            type: 'string', 
            minLength: 1,
            maxLength: 255,
            description: 'First name'
          },
          lastname: { 
            type: 'string', 
            minLength: 1,
            maxLength: 255,
            description: 'Last name'
          },
          role: { 
            type: 'string', 
            maxLength: 500,
            description: 'User role (optional)'
          },
          location: { 
            type: 'string', 
            maxLength: 500,
            description: 'User location (optional)'
          },
          usersphonenumber: { 
            type: 'number', 
            description: 'Phone number (optional)'
          },
          fcmid: { 
            type: 'string', 
            maxLength: 400,
            description: 'FCM ID for notifications (optional)'
          },
        },
        additionalProperties: false,
        examples: [
          {
            useremail: 'newuser@example.com',
            userpassword: 'SecurePassword123!',
            firstname: 'John',
            lastname: 'Doe',
            role: 'admin',
            location: 'Warehouse A'
          }
        ]
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    useremail: { type: 'string' },
                    role: { type: 'string' },
                    firstname: { type: 'string' },
                    lastname: { type: 'string' },
                    location: { type: 'string' },
                  },
                  additionalProperties: true
                },
                token: { type: 'string' },
              },
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
        409: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        429: {
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
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const userData = request.body as {
      useremail: string;
      userpassword: string;
      firstname: string;
      lastname: string;
      role?: string;
      location?: string;
      usersphonenumber?: number;
      fcmid?: string;
    };

    // Rate limiting for registration
    const identifier = `register-${request.ip}-${userData.useremail}`;
    if (authRateLimit.isRateLimited(identifier)) {
      logger.warn({ 
        ip: request.ip, 
        email: userData.useremail 
      }, 'Registration rate limited');
      
      return reply.code(429).send({
        success: false,
        message: 'Too many registration attempts',
        details: 'Please try again later',
        statusCode: 429,
      });
    }

    try {
      // Store the original password before it gets hashed
      const originalPassword = userData.userpassword;
      
      // Create the user
      const newUser = await inventoryUsersService.create(userData);
      
      // Authenticate the user immediately after registration using the original password
      const authResult = await inventoryUsersService.authenticate(userData.useremail, originalPassword);
      
      if (!authResult) {
        throw new Error('Failed to authenticate user after registration');
      }

      authRateLimit.recordAttempt(identifier);

      logger.info({ 
        userId: newUser.id, 
        email: userData.useremail,
        ip: request.ip 
      }, 'User registered and signed in successfully');

      const response = createSuccessResponse('Registration successful', authResult);
      return reply.code(201).send(response);
    } catch (error) {
      authRateLimit.recordAttempt(identifier);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Email already exists')) {
          return reply.code(409).send({
            success: false,
            message: 'Email already exists',
            details: 'An account with this email address already exists',
            statusCode: 409,
          });
        }
        
        if (error.message.includes('Password validation failed')) {
          return reply.code(400).send({
            success: false,
            message: 'Invalid password',
            details: error.message,
            statusCode: 400,
          });
        }
      }
      
      logger.error({ error, email: userData.useremail, ip: request.ip }, 'Error during registration');
      throw error;
    }
  }));

  // POST /v1/auth/signout - Sign out inventory user
  fastify.post('/signout', {
    preHandler: authenticateInventoryUser,
    schema: {
      description: 'Sign out inventory user (requires authentication)',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        401: {
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
  }, asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const userId = request.user!.id;

    await inventoryUsersService.signOut(userId);

    logger.info({ 
      userId, 
      email: request.user!.useremail,
      ip: request.ip 
    }, 'User signed out successfully');

    const response = createSuccessResponse('Sign-out successful', null);
    return reply.code(200).send(response);
  }));

  // POST /v1/auth/forgot-password - Initiate password reset
  fastify.post('/forgot-password', {
    schema: {
      description: 'Initiate password reset process for inventory user',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['useremail'],
        properties: {
          useremail: { 
            type: 'string', 
            format: 'email', 
            description: 'User email address' 
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
            details: { type: 'string' },
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
        429: {
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
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { useremail } = request.body as { useremail: string };

    // Rate limiting for password reset requests
    const identifier = `reset-${request.ip}-${useremail}`;
    if (authRateLimit.isRateLimited(identifier)) {
      logger.warn({ 
        ip: request.ip, 
        email: useremail 
      }, 'Password reset rate limited');
      
      return reply.code(429).send({
        success: false,
        message: 'Too many password reset requests',
        details: 'Please try again later',
        statusCode: 429,
      });
    }

    try {
      await inventoryUsersService.initiatePasswordReset(useremail);
      
      // Record attempt regardless of whether email exists (security)
      authRateLimit.recordAttempt(identifier);

      logger.info({ 
        email: useremail,
        ip: request.ip 
      }, 'Password reset initiated');

      // Always return success to prevent email enumeration
      return reply.code(200).send({
        success: true,
        message: 'Password reset email sent',
        details: 'If an account with this email exists, you will receive a password reset link shortly',
      });
    } catch (error) {
      authRateLimit.recordAttempt(identifier);
      logger.error({ error, email: useremail, ip: request.ip }, 'Error during password reset initiation');
      throw error;
    }
  }));

  // POST /v1/auth/reset-password - Reset password with token
  fastify.post('/reset-password', {
    schema: {
      description: 'Reset password using reset token',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { 
            type: 'string', 
            minLength: 1,
            description: 'Password reset token' 
          },
          newPassword: { 
            type: 'string', 
            minLength: 8,
            description: 'New password (minimum 8 characters)' 
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
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { token, newPassword } = request.body as { token: string; newPassword: string };

    try {
      await inventoryUsersService.resetPassword(token, newPassword);

      logger.info({ 
        ip: request.ip 
      }, 'Password reset completed successfully');

      const response = createSuccessResponse('Password reset successful', null);
      return reply.code(200).send(response);
    } catch (error) {
      logger.error({ error, ip: request.ip }, 'Error during password reset');
      throw error;
    }
  }));

  // POST /v1/auth/update-password - Update password for authenticated user
  fastify.post('/update-password', {
    preHandler: authenticateInventoryUser,
    schema: {
      description: 'Update password for authenticated inventory user',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { 
            type: 'string', 
            minLength: 1,
            description: 'Current password' 
          },
          newPassword: { 
            type: 'string', 
            minLength: 8,
            description: 'New password (minimum 8 characters)' 
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
        401: {
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
  }, asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
    const userId = request.user!.id;

    try {
      await inventoryUsersService.updatePassword(userId, currentPassword, newPassword);

      logger.info({ 
        userId, 
        email: request.user!.useremail,
        ip: request.ip 
      }, 'Password updated successfully');

      const response = createSuccessResponse('Password updated successfully', null);
      return reply.code(200).send(response);
    } catch (error) {
      logger.error({ error, userId, ip: request.ip }, 'Error updating password');
      throw error;
    }
  }));

  // GET /v1/auth/me - Get current user information
  fastify.get('/me', {
    preHandler: authenticateInventoryUser,
    schema: {
      description: 'Get current authenticated user information',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
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
                role: { type: 'string' },
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                location: { type: 'string' },
                usersphonenumber: { type: 'number' },
                fcmid: { type: 'string' },
                createddate: { type: 'number' },
                modifieddate: { type: 'number' },
              },
              additionalProperties: true
            },
            message: { type: 'string' },
          },
        },
        401: {
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
  }, asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user!;

    logger.debug({ 
      userId: user.id, 
      email: user.useremail 
    }, 'User information retrieved');

    const response = createSuccessResponse('User information retrieved successfully', user);
    return reply.code(200).send(response);
  }));

  // POST /v1/auth/refresh - Refresh access token
  fastify.post('/refresh', {
    schema: {
      description: 'Refresh JWT access token using refresh token',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token'
          }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', description: 'New JWT access token' },
                refreshToken: { type: 'string', description: 'New JWT refresh token (if sliding expiry enabled)' },
                expiresIn: { type: 'number', description: 'Access token expiry in seconds' }
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
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      return reply.code(400).send({
        success: false,
        message: 'Refresh token required',
        details: 'Please provide a refresh token',
        statusCode: 400
      });
    }

    try {
      const { refreshAccessToken } = await import('../utils/jwt.js');
      const tokenPair = refreshAccessToken(refreshToken);

      // Update refresh token in database if sliding expiry is enabled
      if (tokenPair.refreshToken !== refreshToken) {
        const { verifyToken } = await import('../utils/jwt.js');
        const decoded = verifyToken(tokenPair.refreshToken);
        
        const inventoryUsersService = new InventoryUsersService();
        await inventoryUsersService.update(decoded.userId.toString(), {
          sessiontoken: tokenPair.refreshToken
        } as any);
      }

      logger.info({ 
        userId: (await import('../utils/jwt.js')).verifyToken(tokenPair.refreshToken).userId
      }, 'Access token refreshed successfully');

      const response = createSuccessResponse('Token refreshed successfully', {
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn
      });
      return reply.code(200).send(response);
    } catch (error: any) {
      logger.error({ error }, 'Error refreshing token');
      
      return reply.code(401).send({
        success: false,
        message: 'Token refresh failed',
        details: error.message || 'Invalid or expired refresh token',
        statusCode: 401
      });
    }
  }));
} 