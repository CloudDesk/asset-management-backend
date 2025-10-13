/**
 * Firebase OTP Authentication Schemas
 * Defines request/response schemas for Firebase Phone OTP routes
 */

/**
 * POST /firebase-otp/send - Send OTP to phone number
 */
export const sendOTPSchema = {
  description: 'Trigger OTP send to phone number (client-side Firebase SDK operation)',
  tags: ['Firebase Authentication'],
  body: {
    type: 'object',
    required: ['phoneNumber'],
    properties: {
      phoneNumber: {
        type: 'string',
        description: 'Phone number in E.164 format (e.g., +1234567890)',
        pattern: '^\\+[1-9]\\d{1,14}$',
        examples: ['+919876543210', '+14155552671'],
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
            status: { type: 'string', enum: ['otp_sent'] },
            phoneNumber: { type: 'string' },
          },
        },
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
        retryAfter: { type: 'number' },
      },
    },
  },
};

/**
 * POST /firebase-otp/verify - Verify OTP code (optional route)
 */
export const verifyOTPSchema = {
  description: 'Verify OTP and confirm Firebase ID token validity (optional step)',
  tags: ['Firebase Authentication'],
  body: {
    type: 'object',
    required: ['idToken'],
    properties: {
      idToken: {
        type: 'string',
        description: 'Firebase ID token obtained after OTP verification',
        minLength: 1,
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
            status: { type: 'string', enum: ['firebase_verified'] },
            uid: { type: 'string' },
            phone: { type: 'string' },
          },
        },
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
  },
};

/**
 * POST /firebase-otp/session - Exchange Firebase ID token for app session
 */
export const createSessionSchema = {
  description: 'Exchange Firebase ID token for application session (JWT + cookie)',
  tags: ['Firebase Authentication'],
  body: {
    type: 'object',
    required: ['idToken'],
    properties: {
      idToken: {
        type: 'string',
        description: 'Firebase ID token obtained after successful OTP verification',
        minLength: 1,
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
            ok: { type: 'boolean' },
            uid: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            token: { type: 'string' },
          },
        },
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
};

/**
 * POST /firebase-otp/logout - Destroy app session
 */
export const logoutSchema = {
  description: 'Destroy application session (clear cookies)',
  tags: ['Firebase Authentication'],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
          },
        },
      },
    },
  },
};

/**
 * POST /firebase-otp/verify-recaptcha - Verify reCAPTCHA Enterprise token
 */
export const verifyRecaptchaSchema = {
  description: 'Verify reCAPTCHA Enterprise token for bot protection',
  tags: ['Firebase Authentication'],
  body: {
    type: 'object',
    required: ['token', 'action'],
    properties: {
      token: {
        type: 'string',
        description: 'reCAPTCHA Enterprise response token from client',
        minLength: 1,
      },
      action: {
        type: 'string',
        description: 'Action name that was executed (e.g., send_otp)',
        minLength: 1,
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
            verified: { type: 'boolean' },
            score: { type: 'number' },
            action: { type: 'string' },
          },
        },
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
};

/**
 * GET /firebase-otp/me - Get current authenticated user
 */
export const getCurrentUserSchema = {
  description: 'Get currently authenticated user from session',
  tags: ['Firebase Authentication'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                uid: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
                iat: { type: 'number' },
                exp: { type: 'number' },
              },
            },
          },
        },
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
};


