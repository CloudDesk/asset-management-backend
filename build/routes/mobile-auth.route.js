import { UsersService } from '../services/users.service.js';
import { authRateLimit } from '../utils/auth.js';
import { logger } from '../config/logger.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
export async function mobileAuthRoutes(fastify) {
    const usersService = new UsersService();
    // POST /v1/mobile-auth/request-otp - Step 1: Request OTP for mobile number
    fastify.post('/request-otp', {
        schema: {
            description: 'Request OTP for mobile number (passwordless login step 1)',
            tags: ['Mobile Authentication'],
            body: {
                type: 'object',
                required: ['usermobilenumber'],
                properties: {
                    usermobilenumber: {
                        type: 'number',
                        minimum: 1000000000,
                        maximum: 99999999999,
                        description: 'User mobile number (10-11 digits)'
                    },
                },
                additionalProperties: false,
                examples: [
                    {
                        usermobilenumber: 9344715431
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
                                mobileNumber: { type: 'number' },
                                otpSent: { type: 'boolean' },
                                expiresAt: { type: 'string' },
                                // For development only - remove in production
                                otp: { type: 'integer', description: 'Development only - hardcoded OTP' },
                                isNewUser: { type: 'boolean', description: 'Whether a new user was created automatically' }
                            },
                        },
                        message: { type: 'string' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
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
    }, asyncHandler(async (request, reply) => {
        const { usermobilenumber } = request.body;
        // Rate limiting check using mobile number
        const identifier = `${request.ip}-${usermobilenumber}`;
        if (authRateLimit.isRateLimited(identifier)) {
            const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
            logger.warn({
                ip: request.ip,
                mobileNumber: usermobilenumber,
                remainingAttempts
            }, 'OTP request rate limited');
            return reply.code(429).send({
                success: false,
                message: 'Too many OTP requests',
                details: 'Please try again later',
                statusCode: 429,
                remainingAttempts,
            });
        }
        try {
            const result = await usersService.generateMobileOTP(usermobilenumber);
            if (!result) {
                // Record failed attempt
                authRateLimit.recordAttempt(identifier);
                const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
                logger.warn({
                    ip: request.ip,
                    mobileNumber: usermobilenumber,
                    remainingAttempts
                }, 'OTP request failed: User creation failed');
                return reply.code(500).send({
                    success: false,
                    message: 'Failed to process request',
                    details: 'Unable to create user or generate OTP. Please try again.',
                    statusCode: 500,
                    remainingAttempts,
                });
            }
            // Clear rate limiting on successful OTP generation
            authRateLimit.clearAttempts(identifier);
            logger.info({
                mobileNumber: usermobilenumber,
                ip: request.ip,
                isNewUser: result.isNewUser
            }, `OTP generated successfully for mobile number ${result.isNewUser ? '(new user created)' : '(existing user)'}`);
            const responseMessage = result.isNewUser
                ? 'New account created and OTP sent successfully'
                : 'OTP sent successfully';
            const response = createSuccessResponse(responseMessage, {
                mobileNumber: usermobilenumber,
                otpSent: true,
                expiresAt: result.expiresAt.toISOString(),
                // For development only - remove in production
                otp: result.otp,
                isNewUser: result.isNewUser
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            authRateLimit.recordAttempt(identifier);
            logger.error({ error, mobileNumber: usermobilenumber, ip: request.ip }, 'Error during OTP generation');
            throw error;
        }
    }));
    // POST /v1/mobile-auth/verify-otp - Step 2: Verify OTP and authenticate
    fastify.post('/verify-otp', {
        schema: {
            description: 'Verify OTP and authenticate user (passwordless login step 2)',
            tags: ['Mobile Authentication'],
            body: {
                type: 'object',
                required: ['usermobilenumber'],
                properties: {
                    usermobilenumber: {
                        type: 'number',
                        minimum: 1000000000,
                        maximum: 99999999999,
                        description: 'User mobile number (10-11 digits)'
                    },
                    otp: {
                        description: 'OTP received (use 1234 for development)'
                    },
                },
                additionalProperties: false,
                examples: [
                    {
                        usermobilenumber: 9344715431,
                        otp: 1234
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
                                        usermobilenumber: { type: 'number' },
                                        firstname: { type: 'string' },
                                        lastname: { type: 'string' },
                                        gender: { type: 'string' },
                                        gstnumber: { type: 'string' },
                                        isbusinessuser: { type: 'boolean' },
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
    }, asyncHandler(async (request, reply) => {
        const { usermobilenumber, otp } = request.body;
        // Custom OTP validation with user-friendly messages
        if (otp === undefined || otp === null) {
            return reply.code(400).send({
                success: false,
                message: 'OTP is required',
                details: 'Please enter the 4-digit OTP you received',
                statusCode: 400
            });
        }
        if (typeof otp !== 'number') {
            return reply.code(400).send({
                success: false,
                message: 'Invalid OTP format',
                details: 'OTP must be a number',
                statusCode: 400
            });
        }
        if (otp < 1000 || otp > 9999) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid OTP format',
                details: 'OTP must be exactly 4 digits',
                statusCode: 400
            });
        }
        // Rate limiting check using mobile number
        const identifier = `${request.ip}-${usermobilenumber}`;
        if (authRateLimit.isRateLimited(identifier)) {
            const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
            logger.warn({
                ip: request.ip,
                mobileNumber: usermobilenumber,
                remainingAttempts
            }, 'OTP verification rate limited');
            return reply.code(429).send({
                success: false,
                message: 'Too many verification attempts',
                details: 'Please try again later',
                statusCode: 429,
                remainingAttempts,
            });
        }
        try {
            const result = await usersService.verifyMobileOTP(usermobilenumber, otp);
            if (!result) {
                // Record failed attempt
                authRateLimit.recordAttempt(identifier);
                const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
                logger.warn({
                    ip: request.ip,
                    mobileNumber: usermobilenumber,
                    remainingAttempts
                }, 'OTP verification failed: Invalid or expired OTP');
                return reply.code(401).send({
                    success: false,
                    message: 'Invalid or expired OTP',
                    details: 'The OTP you entered is incorrect or has expired. Please request a new one.',
                    statusCode: 401,
                    remainingAttempts,
                });
            }
            // Clear rate limiting on successful authentication
            authRateLimit.clearAttempts(identifier);
            logger.info({
                userId: result.user.id,
                mobileNumber: usermobilenumber,
                ip: request.ip
            }, 'User authenticated successfully via mobile OTP');
            const response = createSuccessResponse('Authentication successful', result);
            return reply.code(200).send(response);
        }
        catch (error) {
            authRateLimit.recordAttempt(identifier);
            logger.error({ error, mobileNumber: usermobilenumber, ip: request.ip }, 'Error during OTP verification');
            throw error;
        }
    }));
    // Legacy password-based signin (kept for backward compatibility)
    fastify.post('/signin', {
        schema: {
            description: 'Legacy: Sign in user with mobile number and password (deprecated - use OTP flow instead)',
            tags: ['Mobile Authentication'],
            deprecated: true,
            body: {
                type: 'object',
                required: ['usermobilenumber', 'userpassword'],
                properties: {
                    usermobilenumber: {
                        type: 'number',
                        minimum: 1000000000,
                        maximum: 99999999999,
                        description: 'User mobile number (10-11 digits)'
                    },
                    userpassword: {
                        type: 'string',
                        minLength: 1,
                        description: 'User password'
                    },
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
                                user: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'number' },
                                        useremail: { type: 'string' },
                                        usermobilenumber: { type: 'number' },
                                        firstname: { type: 'string' },
                                        lastname: { type: 'string' },
                                        gender: { type: 'string' },
                                        gstnumber: { type: 'string' },
                                        isbusinessuser: { type: 'boolean' },
                                    },
                                    additionalProperties: true
                                },
                                token: { type: 'string' },
                            },
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
            },
        },
    }, asyncHandler(async (request, reply) => {
        const { usermobilenumber, userpassword } = request.body;
        try {
            const result = await usersService.authenticateByMobile(usermobilenumber, userpassword);
            if (!result) {
                return reply.code(401).send({
                    success: false,
                    message: 'Invalid credentials',
                    details: 'The mobile number or password you entered is incorrect',
                    statusCode: 401,
                });
            }
            const response = createSuccessResponse('Mobile sign-in successful', result);
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error, mobileNumber: usermobilenumber, ip: request.ip }, 'Error during mobile sign-in');
            throw error;
        }
    }));
    // GET /v1/mobile-auth/user-by-mobile - Get user information by mobile number (for verification)
    fastify.get('/user-by-mobile/:mobile', {
        schema: {
            description: 'Get user information by mobile number (without authentication, for verification purposes)',
            tags: ['Mobile Authentication'],
            params: {
                type: 'object',
                required: ['mobile'],
                properties: {
                    mobile: {
                        type: 'string',
                        pattern: '^[0-9]{10,11}$',
                        description: 'Mobile number (10-11 digits)'
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                exists: { type: 'boolean' },
                                user: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'number' },
                                        usermobilenumber: { type: 'number' },
                                        firstname: { type: 'string' },
                                        lastname: { type: 'string' },
                                    },
                                    additionalProperties: false
                                }
                            }
                        },
                        message: { type: 'string' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        statusCode: { type: 'number' },
                    },
                },
            },
        },
    }, asyncHandler(async (request, reply) => {
        const { mobile } = request.params;
        const mobileNumber = parseInt(mobile);
        logger.debug({ mobileNumber }, 'Looking up user by mobile number');
        try {
            const user = await usersService.findByMobileNumber(mobileNumber);
            if (!user) {
                return reply.code(404).send({
                    success: false,
                    message: 'User not found with this mobile number',
                    statusCode: 404,
                });
            }
            // Return only safe user information (no sensitive data)
            const safeUserData = {
                id: user.id,
                usermobilenumber: user.usermobilenumber,
                firstname: user.firstname,
                lastname: user.lastname,
            };
            const response = createSuccessResponse('User found', {
                exists: true,
                user: safeUserData
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error, mobileNumber }, 'Error looking up user by mobile');
            throw error;
        }
    }));
}
//# sourceMappingURL=mobile-auth.route.js.map