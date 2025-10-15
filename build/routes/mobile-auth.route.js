import { UsersService } from '../services/users.service.js';
import { OrdersService } from '../services/orders.service.js';
import { OrderlineService } from '../services/orderline.service.js';
import { EmailService } from '../services/email.service.js';
import { authRateLimit } from '../utils/auth.js';
import { logger } from '../config/logger.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
export async function mobileAuthRoutes(fastify) {
    const usersService = new UsersService();
    const ordersService = new OrdersService();
    const orderlineService = new OrderlineService();
    const emailService = new EmailService();
    // POST /v1/mobile-auth/request-otp - Step 1: Request OTP for mobile number
    fastify.post('/request-otp', {
        schema: {
            description: 'Request OTP for mobile number (passwordless login step 1, or verify for delete account)',
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
                    verifyOnly: {
                        type: 'boolean',
                        description: 'If true, only verify user exists without creating new user (for delete account flow). Default: false',
                        default: false
                    }
                },
                additionalProperties: false,
                examples: [
                    {
                        usermobilenumber: 9344715431
                    },
                    {
                        usermobilenumber: 9344715431,
                        verifyOnly: true
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
                        details: { type: 'string' },
                        statusCode: { type: 'number' },
                        remainingAttempts: { type: 'number' },
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
        const { usermobilenumber, verifyOnly = false } = request.body;
        // Rate limiting check using mobile number
        const identifier = `${request.ip}-${usermobilenumber}`;
        if (authRateLimit.isRateLimited(identifier)) {
            const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
            logger.warn({
                ip: request.ip,
                mobileNumber: usermobilenumber,
                remainingAttempts,
                verifyOnly
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
            const result = await usersService.generateMobileOTP(usermobilenumber, verifyOnly);
            if (!result) {
                // Record failed attempt
                authRateLimit.recordAttempt(identifier);
                const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
                // Different error messages based on verifyOnly flag
                if (verifyOnly) {
                    logger.warn({
                        ip: request.ip,
                        mobileNumber: usermobilenumber,
                        remainingAttempts
                    }, 'OTP request failed: User not found (verifyOnly mode)');
                    return reply.code(404).send({
                        success: false,
                        message: 'User not found',
                        details: 'No account exists with this mobile number.',
                        statusCode: 404,
                        remainingAttempts,
                    });
                }
                else {
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
            }
            // Clear rate limiting on successful OTP generation
            authRateLimit.clearAttempts(identifier);
            logger.info({
                mobileNumber: usermobilenumber,
                ip: request.ip,
                isNewUser: result.isNewUser,
                verifyOnly
            }, `OTP generated successfully for mobile number ${result.isNewUser ? '(new user created)' : '(existing user)'}${verifyOnly ? ' [verify mode]' : ''}`);
            const responseMessage = verifyOnly
                ? 'OTP sent successfully for verification'
                : (result.isNewUser
                    ? 'New account created and OTP sent successfully'
                    : 'OTP sent successfully');
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
            logger.error({ error, mobileNumber: usermobilenumber, verifyOnly, ip: request.ip }, 'Error during OTP generation');
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
    // POST /v1/mobile-auth/delete-account - Delete user account (soft delete)
    fastify.post('/delete-account', {
        schema: {
            description: 'Deactivate user account and send account data via email',
            tags: ['Mobile Authentication'],
            body: {
                type: 'object',
                required: ['userid'],
                properties: {
                    userid: {
                        type: 'number',
                        description: 'User ID to deactivate'
                    },
                    useremail: {
                        type: 'string',
                        format: 'email',
                        description: 'Email address (required if user does not have email in DB)'
                    }
                },
                additionalProperties: false,
                examples: [
                    {
                        userid: 123,
                        useremail: 'user@example.com'
                    },
                    {
                        userid: 123
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
                                userId: { type: 'number' },
                                email: { type: 'string' },
                                isActive: { type: 'boolean' },
                                ordersCount: { type: 'number' },
                                orderlinesCount: { type: 'number' },
                                emailSent: { type: 'boolean' }
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
                404: {
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
    }, asyncHandler(async (request, reply) => {
        const { userid, useremail } = request.body;
        try {
            // 1. Check if user exists
            const user = await usersService.findById(userid.toString());
            if (!user) {
                return reply.code(404).send({
                    success: false,
                    message: 'User not found',
                    details: `No user found with ID ${userid}`,
                    statusCode: 404
                });
            }
            // 2. Check if email exists in DB or provided in request
            const userEmail = user.useremail || useremail;
            if (!userEmail) {
                return reply.code(400).send({
                    success: false,
                    message: 'Email required',
                    details: 'User does not have an email in the database. Please provide email address in the request.',
                    statusCode: 400
                });
            }
            // 3. Get all orders and orderlines for the user
            logger.info({ userId: userid }, 'Fetching user orders and orderlines for account deletion');
            const ordersResult = await ordersService.findMany({ userid: userid.toString() }, 1, 10000);
            const orders = ordersResult.data || [];
            // Get all orderlines for all orders
            let allOrderlines = [];
            for (const order of orders) {
                const orderlines = await orderlineService.findByOrderId(order.id);
                allOrderlines = [...allOrderlines, ...orderlines];
            }
            logger.info({
                userId: userid,
                ordersCount: orders.length,
                orderlinesCount: allOrderlines.length
            }, 'Retrieved user data for deletion email');
            // 4. Deactivate user account (and update email if provided and different)
            const emailToUpdate = useremail && useremail !== user.useremail ? useremail : undefined;
            await usersService.deactivateAccount(userid, emailToUpdate);
            // 5. Send email with user data
            const userName = user.firstname || 'User';
            await emailService.sendAccountDeletionEmail(userEmail, userName, {
                orders,
                orderlines: allOrderlines
            });
            logger.info({
                userId: userid,
                email: userEmail,
                ordersCount: orders.length,
                orderlinesCount: allOrderlines.length
            }, 'Account deleted and confirmation email sent successfully');
            const response = createSuccessResponse('Account deactivated successfully', {
                userId: userid,
                email: userEmail,
                isActive: false,
                ordersCount: orders.length,
                orderlinesCount: allOrderlines.length,
                emailSent: true
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error, userId: userid }, 'Error during account deletion');
            return reply.code(500).send({
                success: false,
                message: 'Failed to delete account',
                details: error.message || 'An unexpected error occurred',
                statusCode: 500
            });
        }
    }));
}
//# sourceMappingURL=mobile-auth.route.js.map