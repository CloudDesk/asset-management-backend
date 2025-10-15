import { SmsController } from '../controllers/sms.controller.js';
export async function smsRoutes(fastify) {
    const smsController = new SmsController();
    // POST /v1/sms/send-otp - Send OTP SMS
    fastify.post('/send-otp', {
        schema: {
            description: 'Send OTP SMS to a phone number via Infobip',
            tags: ['SMS'],
            body: {
                type: 'object',
                required: ['phoneNumber', 'message'],
                properties: {
                    phoneNumber: {
                        type: 'string',
                        description: 'Recipient phone number (digits only, 10-15 characters)',
                        minLength: 10,
                        maxLength: 15,
                        pattern: '^\\d+$',
                        examples: ['8825727948']
                    },
                    message: {
                        type: 'string',
                        description: 'SMS message content (max 160 characters)',
                        minLength: 1,
                        maxLength: 160,
                        examples: ['Your OTP is 123456']
                    }
                }
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
                                phoneNumber: { type: 'string', description: 'Recipient phone number' },
                                messageId: { type: 'string', description: 'Infobip message ID' },
                                status: { type: 'string', description: 'Message status from Infobip' },
                                sentAt: { type: 'string', description: 'Timestamp when message was sent' }
                            }
                        },
                        errors: { type: 'null' }
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
    }, smsController.sendOtp.bind(smsController));
    // POST /v1/sms/send-otp-twilio - Send OTP SMS via Twilio
    fastify.post('/send-otp-twilio', {
        schema: {
            description: 'Send OTP SMS to a phone number via Twilio',
            tags: ['SMS', 'Twilio'],
            body: {
                type: 'object',
                required: ['phoneNumber', 'message'],
                properties: {
                    phoneNumber: {
                        type: 'string',
                        description: 'Recipient phone number (digits only, 10-15 characters)',
                        minLength: 10,
                        maxLength: 15,
                        pattern: '^\\d+$',
                        examples: ['8825727948']
                    },
                    message: {
                        type: 'string',
                        description: 'SMS message content (max 160 characters)',
                        minLength: 1,
                        maxLength: 160,
                        examples: ['Your OTP is 123456']
                    }
                }
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
                                phoneNumber: { type: 'string', description: 'Recipient phone number' },
                                messageId: { type: 'string', description: 'Twilio message SID' },
                                status: { type: 'string', description: 'Message status from Twilio' },
                                provider: { type: 'string', description: 'SMS provider used' },
                                sentAt: { type: 'string', description: 'Timestamp when message was sent' }
                            }
                        },
                        errors: { type: 'null' }
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
    }, smsController.sendOtpTwilio.bind(smsController));
    // POST /v1/sms/send-otp-with-fallback - Send OTP SMS with fallback (Infobip -> Twilio)
    fastify.post('/send-otp-with-fallback', {
        schema: {
            description: 'Send OTP SMS with automatic fallback (tries Infobip first, then Twilio)',
            tags: ['SMS', 'Fallback'],
            body: {
                type: 'object',
                required: ['phoneNumber', 'message'],
                properties: {
                    phoneNumber: {
                        type: 'string',
                        description: 'Recipient phone number (digits only, 10-15 characters)',
                        minLength: 10,
                        maxLength: 15,
                        pattern: '^\\d+$',
                        examples: ['8825727948']
                    },
                    message: {
                        type: 'string',
                        description: 'SMS message content (max 160 characters)',
                        minLength: 1,
                        maxLength: 160,
                        examples: ['Your OTP is 123456']
                    }
                }
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
                                phoneNumber: { type: 'string', description: 'Recipient phone number' },
                                messageId: { type: 'string', description: 'Message ID from provider' },
                                status: { type: 'string', description: 'Message status' },
                                provider: { type: 'string', description: 'SMS provider used' },
                                fallbackUsed: { type: 'boolean', description: 'Whether fallback provider was used' },
                                sentAt: { type: 'string', description: 'Timestamp when message was sent' }
                            }
                        },
                        errors: { type: 'null' }
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
    }, smsController.sendOtpWithFallback.bind(smsController));
}
//# sourceMappingURL=sms.route.js.map