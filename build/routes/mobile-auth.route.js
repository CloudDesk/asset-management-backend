import { UsersService } from '../services/users.service.js';
import { OrdersService } from '../services/orders.service.js';
import { OrderlineService } from '../services/orderline.service.js';
import { EmailService } from '../services/email.service.js';
import { FirebaseOTPService } from '../services/firebase-otp.service.js';
import { TwilioSmsService } from '../services/twilioSms.service.js';
import { otpService } from '../services/otp.service.js';
import { authRateLimit, generateSessionToken, sanitizeUserData } from '../utils/auth.js';
import { logger } from '../config/logger.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
export async function mobileAuthRoutes(fastify) {
    const usersService = new UsersService();
    const ordersService = new OrdersService();
    const orderlineService = new OrderlineService();
    const emailService = new EmailService();
    const firebaseOTPService = new FirebaseOTPService();
    const twilioSmsService = new TwilioSmsService();
    // POST /v1/mobile-auth/firebase-login - Firebase OTP Authentication
    fastify.post('/firebase-login', {
        schema: {
            description: 'Login with Firebase OTP - Verify Firebase ID token and create/get user',
            tags: ['Mobile Authentication'],
            body: {
                type: 'object',
                required: ['idToken'],
                properties: {
                    idToken: {
                        type: 'string',
                        description: 'Firebase ID token obtained after OTP verification on client side',
                        minLength: 1
                    }
                },
                additionalProperties: false,
                examples: [
                    {
                        idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...'
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
                                        usermobilenumber: { type: 'number' },
                                        firstname: { type: 'string' },
                                        lastname: { type: 'string' },
                                        useremail: { type: 'string' }
                                    },
                                    additionalProperties: true
                                },
                                token: { type: 'string' },
                                isNewUser: { type: 'boolean' }
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
                }
            }
        }
    }, asyncHandler(async (request, reply) => {
        const { idToken } = request.body;
        try {
            // 1. Verify Firebase ID token
            logger.debug({ ip: request.ip }, 'Verifying Firebase ID token');
            const decodedToken = await firebaseOTPService.verifyFirebaseToken(idToken);
            // 2. Extract phone number from Firebase token
            const firebasePhoneNumber = decodedToken.phone_number;
            if (!firebasePhoneNumber) {
                return reply.code(400).send({
                    success: false,
                    message: 'Phone number not found in Firebase token',
                    details: 'Firebase token must contain a valid phone number',
                    statusCode: 400
                });
            }
            // 3. Convert Firebase phone number (+919876543210) to number (9876543210)
            // Handle both +91 (India) and other country codes
            const phoneNumber = parseInt(firebasePhoneNumber.replace(/^\+91/, '').replace(/^\+/, ''));
            logger.info({
                firebaseUid: decodedToken.uid,
                phoneNumber,
                ip: request.ip
            }, 'Firebase token verified, processing user login');
            // 4. Check if user exists
            let user = await usersService.findByMobileNumber(phoneNumber);
            let isNewUser = false;
            if (!user) {
                // Create new user
                logger.info({ phoneNumber }, 'Creating new user from Firebase authentication');
                const newUserData = {
                    usermobilenumber: phoneNumber,
                    firstname: 'User',
                    useremail: decodedToken.email || undefined,
                    createddate: Date.now(),
                    modifieddate: Date.now()
                };
                user = await usersService.create(newUserData);
                isNewUser = true;
                logger.info({
                    userId: user.id,
                    phoneNumber
                }, 'New user created from Firebase authentication');
            }
            // 5. Generate session token
            const sessionToken = generateSessionToken();
            // 6. Sanitize user data (remove sensitive information)
            const sanitizedUser = sanitizeUserData(user);
            logger.info({
                userId: user.id,
                phoneNumber,
                isNewUser,
                ip: request.ip
            }, 'User authenticated successfully via Firebase OTP');
            const message = isNewUser
                ? 'New account created and authenticated successfully'
                : 'Authentication successful';
            const response = createSuccessResponse(message, {
                user: sanitizedUser,
                token: sessionToken,
                isNewUser
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error, ip: request.ip }, 'Error during Firebase authentication');
            return reply.code(401).send({
                success: false,
                message: 'Authentication failed',
                details: error.message || 'Invalid or expired Firebase token',
                statusCode: 401
            });
        }
    }));
    // POST /v1/mobile-auth/request-otp - Step 1: Request OTP for mobile number (Legacy - Hardcoded OTP)
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
            // Step 1: Check if user exists
            const user = await usersService.findByMobileNumber(usermobilenumber);
            // Step 2: Handle verifyOnly mode (for delete account flow)
            if (!user && verifyOnly) {
                authRateLimit.recordAttempt(identifier);
                const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
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
            // Step 3: For normal flow, we DON'T create user yet
            // User will be created AFTER OTP verification
            const isNewUser = !user; // Track if this will be a new user
            logger.info({
                mobileNumber: usermobilenumber,
                userExists: !!user,
                verifyOnly
            }, `OTP requested for ${user ? 'existing user' : 'new registration'}`);
            // Step 4: Generate OTP using Redis service
            const phoneNumberString = `+91${usermobilenumber}`; // Convert to string with country code
            const otpResult = await otpService.generateAndStoreOtp(phoneNumberString);
            if (!otpResult.success) {
                // Handle rate limiting or other errors from OTP service
                const statusCode = otpResult.retryAfter ? 429 : 400;
                logger.warn({
                    mobileNumber: usermobilenumber,
                    error: otpResult.error
                }, 'OTP generation failed');
                if (otpResult.retryAfter) {
                    reply.header('Retry-After', otpResult.retryAfter.toString());
                }
                return reply.code(statusCode).send({
                    success: false,
                    message: 'Failed to generate OTP',
                    details: otpResult.error || 'Could not generate OTP',
                    statusCode
                });
            }
            // Step 5: Send SMS via Twilio
            const otpMessage = `Your verification code is: ${otpResult.otp}. Valid for 60 seconds. Do not share this code.`;
            const smsResult = await twilioSmsService.sendOtp(phoneNumberString, otpMessage);
            if (!smsResult.success) {
                // SMS sending failed - delete OTP from Redis
                await otpService.deleteOtp(phoneNumberString);
                logger.error({
                    mobileNumber: usermobilenumber,
                    error: smsResult.errorMessage
                }, 'Failed to send OTP SMS');
                return reply.code(500).send({
                    success: false,
                    message: 'Failed to send OTP',
                    details: smsResult.errorMessage || 'Could not send SMS',
                    statusCode: 500
                });
            }
            // Clear rate limiting on successful OTP generation and sending
            authRateLimit.clearAttempts(identifier);
            logger.info({
                mobileNumber: usermobilenumber,
                ip: request.ip,
                isNewUser,
                verifyOnly,
                messageId: smsResult.messageId
            }, `OTP sent successfully for mobile number ${isNewUser ? '(new user created)' : '(existing user)'}${verifyOnly ? ' [verify mode]' : ''}`);
            const responseMessage = verifyOnly
                ? 'OTP sent successfully for verification'
                : (isNewUser
                    ? 'New account created and OTP sent successfully'
                    : 'OTP sent successfully');
            const response = createSuccessResponse(responseMessage, {
                mobileNumber: usermobilenumber,
                otpSent: true,
                expiresIn: 60,
                canResendAfter: 30,
                isNewUser,
                // For development only - you can remove this in production
                // otp: otpResult.otp
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
                        description: '6-digit OTP received via SMS'
                    },
                },
                additionalProperties: false,
                examples: [
                    {
                        usermobilenumber: 9344715431,
                        otp: 123456
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
                                isNewUser: { type: 'boolean', description: 'True if account was just created after OTP verification' },
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
        console.log(request.body);
        // Custom OTP validation with user-friendly messages
        if (otp === undefined || otp === null) {
            return reply.code(400).send({
                success: false,
                message: 'OTP is required',
                details: 'Please enter the 6-digit OTP you received',
                statusCode: 400
            });
        }
        // Convert OTP to string for Redis validation
        const otpString = otp.toString();
        if (otpString.length !== 6) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid OTP format',
                details: 'OTP must be exactly 6 digits',
                statusCode: 400
            });
        }
        if (!/^\d{6}$/.test(otpString)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid OTP format',
                details: 'OTP must contain only digits',
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
            // Step 1: Verify OTP using Redis service FIRST
            const phoneNumberString = `+91${usermobilenumber}`;
            const verifyResult = await otpService.verifyOtp(phoneNumberString, otpString);
            if (!verifyResult.success || !verifyResult.verified) {
                // Record failed attempt
                authRateLimit.recordAttempt(identifier);
                const remainingAttempts = authRateLimit.getRemainingAttempts(identifier);
                logger.warn({
                    ip: request.ip,
                    mobileNumber: usermobilenumber,
                    remainingAttempts,
                    error: verifyResult.error
                }, 'OTP verification failed');
                const statusCode = verifyResult.canResend === false ? 429 : 401;
                return reply.code(statusCode).send({
                    success: false,
                    message: 'OTP verification failed',
                    details: verifyResult.error || 'Invalid or expired OTP',
                    statusCode,
                    remainingAttempts,
                    attemptsRemaining: verifyResult.attemptsRemaining,
                    canResend: verifyResult.canResend
                });
            }
            // Step 2: OTP is valid! Now check if user exists or create new one
            let user = await usersService.findByMobileNumber(usermobilenumber);
            let isNewUser = false;
            if (!user) {
                // Create new user AFTER successful OTP verification
                logger.info({ mobileNumber: usermobilenumber }, 'Creating new verified user after OTP verification');
                try {
                    const newUserData = {
                        usermobilenumber: usermobilenumber,
                        firstname: `User`,
                        createddate: Date.now(),
                        modifieddate: Date.now()
                    };
                    user = await usersService.create(newUserData);
                    isNewUser = true;
                    logger.info({
                        userId: user.id,
                        mobileNumber: usermobilenumber
                    }, 'New verified user created successfully');
                }
                catch (error) {
                    logger.error({ error, mobileNumber: usermobilenumber }, 'Failed to create new user after OTP verification');
                    return reply.code(500).send({
                        success: false,
                        message: 'Authentication failed',
                        details: 'OTP verified but failed to create account. Please try again.',
                        statusCode: 500
                    });
                }
            }
            // Clear rate limiting on successful authentication
            authRateLimit.clearAttempts(identifier);
            // Step 3: Generate session token
            const sessionToken = generateSessionToken();
            // Step 4: Sanitize user data
            const sanitizedUser = sanitizeUserData(user);
            logger.info({
                userId: user.id,
                mobileNumber: usermobilenumber,
                isNewUser,
                ip: request.ip
            }, `User authenticated successfully via mobile OTP ${isNewUser ? '(new account created)' : '(existing account)'}`);
            const result = {
                user: sanitizedUser,
                token: sessionToken,
                isNewUser // Include isNewUser flag in response
            };
            const message = isNewUser
                ? 'Account created and authenticated successfully'
                : 'Authentication successful';
            const response = createSuccessResponse(message, result);
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