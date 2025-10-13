/**
 * Firebase OTP Authentication Schemas
 * Defines request/response schemas for Firebase Phone OTP routes
 */
/**
 * POST /firebase-otp/send - Send OTP to phone number
 */
export declare const sendOTPSchema: {
    description: string;
    tags: string[];
    body: {
        type: string;
        required: string[];
        properties: {
            phoneNumber: {
                type: string;
                description: string;
                pattern: string;
                examples: string[];
            };
        };
        additionalProperties: boolean;
    };
    response: {
        200: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                data: {
                    type: string;
                    properties: {
                        status: {
                            type: string;
                            enum: string[];
                        };
                        phoneNumber: {
                            type: string;
                        };
                    };
                };
            };
        };
        400: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
            };
        };
        429: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
                retryAfter: {
                    type: string;
                };
            };
        };
    };
};
/**
 * POST /firebase-otp/verify - Verify OTP code (optional route)
 */
export declare const verifyOTPSchema: {
    description: string;
    tags: string[];
    body: {
        type: string;
        required: string[];
        properties: {
            idToken: {
                type: string;
                description: string;
                minLength: number;
            };
        };
        additionalProperties: boolean;
    };
    response: {
        200: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                data: {
                    type: string;
                    properties: {
                        status: {
                            type: string;
                            enum: string[];
                        };
                        uid: {
                            type: string;
                        };
                        phone: {
                            type: string;
                        };
                    };
                };
            };
        };
        400: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
            };
        };
        401: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
            };
        };
    };
};
/**
 * POST /firebase-otp/session - Exchange Firebase ID token for app session
 */
export declare const createSessionSchema: {
    description: string;
    tags: string[];
    body: {
        type: string;
        required: string[];
        properties: {
            idToken: {
                type: string;
                description: string;
                minLength: number;
            };
        };
        additionalProperties: boolean;
    };
    response: {
        200: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                data: {
                    type: string;
                    properties: {
                        ok: {
                            type: string;
                        };
                        uid: {
                            type: string;
                        };
                        phone: {
                            type: string;
                        };
                        email: {
                            type: string;
                        };
                        token: {
                            type: string;
                        };
                    };
                };
            };
        };
        400: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
            };
        };
        401: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
            };
        };
        500: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
            };
        };
    };
};
/**
 * POST /firebase-otp/logout - Destroy app session
 */
export declare const logoutSchema: {
    description: string;
    tags: string[];
    response: {
        200: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                data: {
                    type: string;
                    properties: {
                        ok: {
                            type: string;
                        };
                    };
                };
            };
        };
    };
};
/**
 * POST /firebase-otp/verify-recaptcha - Verify reCAPTCHA Enterprise token
 */
export declare const verifyRecaptchaSchema: {
    description: string;
    tags: string[];
    body: {
        type: string;
        required: string[];
        properties: {
            token: {
                type: string;
                description: string;
                minLength: number;
            };
            action: {
                type: string;
                description: string;
                minLength: number;
            };
        };
        additionalProperties: boolean;
    };
    response: {
        200: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                data: {
                    type: string;
                    properties: {
                        verified: {
                            type: string;
                        };
                        score: {
                            type: string;
                        };
                        action: {
                            type: string;
                        };
                    };
                };
            };
        };
        400: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
            };
        };
        500: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
            };
        };
    };
};
/**
 * GET /firebase-otp/me - Get current authenticated user
 */
export declare const getCurrentUserSchema: {
    description: string;
    tags: string[];
    security: {
        bearerAuth: never[];
    }[];
    response: {
        200: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                data: {
                    type: string;
                    properties: {
                        user: {
                            type: string;
                            properties: {
                                uid: {
                                    type: string;
                                };
                                phone: {
                                    type: string;
                                };
                                email: {
                                    type: string;
                                };
                                iat: {
                                    type: string;
                                };
                                exp: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        401: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
            };
        };
        500: {
            type: string;
            properties: {
                success: {
                    type: string;
                };
                message: {
                    type: string;
                };
                details: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
            };
        };
    };
};
//# sourceMappingURL=firebase-otp.schema.d.ts.map