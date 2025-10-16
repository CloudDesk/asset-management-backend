import { FastifyInstance } from 'fastify';
import { SmsController } from '../controllers/sms.controller.js';

export async function smsRoutes(fastify: FastifyInstance) {
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
            examples: ['9994824573']
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
            examples: ['9994824573']
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
            examples: ['9994824573']
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

  // POST /v1/sms/send-otp-with-storage - Send OTP with Redis storage and rate limiting
  fastify.post('/send-otp-with-storage', {
    schema: {
      description: 'Send OTP SMS with Redis storage, automatic expiration, and rate limiting',
      tags: ['SMS', 'OTP', 'Authentication'],
      body: {
        type: 'object',
        required: ['phoneNumber'],
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'Recipient phone number (10-15 digits, with or without country code)',
            minLength: 10,
            maxLength: 15,
            pattern: '^\\+?\\d+$',
            examples: ['9994824573', '+919994824573']
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
                expiresIn: { type: 'number', description: 'OTP expiry in seconds (60)' },
                canResendAfter: { type: 'number', description: 'Seconds to wait before resending (30)' },
                sentAt: { type: 'string', description: 'Timestamp when OTP was sent' }
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
        429: {
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
  }, smsController.sendOtpWithStorage.bind(smsController));

  // POST /v1/sms/verify-otp - Verify OTP
  fastify.post('/verify-otp', {
    schema: {
      description: 'Verify OTP code sent to phone number',
      tags: ['SMS', 'OTP', 'Authentication'],
      body: {
        type: 'object',
        required: ['phoneNumber', 'otp'],
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'Phone number that received the OTP',
            minLength: 10,
            maxLength: 15,
            pattern: '^\\+?\\d+$',
            examples: ['9994824573', '+919994824573']
          },
          otp: {
            type: 'string',
            description: '6-digit OTP code',
            minLength: 6,
            maxLength: 6,
            pattern: '^\\d{6}$',
            examples: ['123456']
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
                verified: { type: 'boolean', description: 'Whether OTP was verified successfully' },
                phoneNumber: { type: 'string', description: 'Verified phone number' }
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
            attemptsRemaining: { type: 'number', description: 'Number of attempts remaining' },
            canResend: { type: 'boolean', description: 'Whether OTP can be resent' },
            statusCode: { type: 'number' }
          }
        },
        429: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            canResend: { type: 'boolean' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, smsController.verifyOtp.bind(smsController));

  // POST /v1/sms/resend-otp - Resend OTP
  fastify.post('/resend-otp', {
    schema: {
      description: 'Resend OTP to phone number (subject to rate limiting)',
      tags: ['SMS', 'OTP', 'Authentication'],
      body: {
        type: 'object',
        required: ['phoneNumber'],
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'Phone number to resend OTP to',
            minLength: 10,
            maxLength: 15,
            pattern: '^\\+?\\d+$',
            examples: ['9994824573', '+9199948245738']
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
                phoneNumber: { type: 'string' },
                expiresIn: { type: 'number' },
                canResendAfter: { type: 'number' },
                sentAt: { type: 'string' }
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
        429: {
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
  }, smsController.resendOtp.bind(smsController));
}

