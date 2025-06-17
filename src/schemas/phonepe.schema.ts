import { z } from 'zod';

// PhonePe payment initiation schema
export const phonePePaymentInitiationSchema = z.object({
  merchantTransactionId: z.string()
    .min(1, 'Merchant transaction ID is required')
    .max(35, 'Merchant transaction ID must be 35 characters or less')
    .optional(),
  amount: z.number()
    .positive('Amount must be greater than 0')
    .max(100000, 'Amount cannot exceed ₹1,00,000')
    .refine((val) => Number.isFinite(val), 'Amount must be a valid number')
    .refine((val) => Number(val.toFixed(2)) === val, 'Amount can have at most 2 decimal places'),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  mobileNumber: z.string()
    .regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits')
    .refine((val) => !val.startsWith('0'), 'Mobile number cannot start with 0'),
  userId: z.number()
    .int('User ID must be an integer')
    .positive('User ID must be positive'),
  productIds: z.array(z.number().int().positive())
    .optional()
    .default([]),
  transactionFor: z.string()
    .min(1)
    .max(255)
    .optional()
    .default('product_purchase'),
  callbackUrl: z.string()
    .url('Callback URL must be a valid URL')
    .optional()
}).strict();

// PhonePe refund schema
export const phonePeRefundSchema = z.object({
  refundAmount: z.number()
    .positive('Refund amount must be greater than 0')
    .max(100000, 'Refund amount cannot exceed ₹1,00,000')
    .optional(),
  reason: z.string()
    .min(1, 'Reason is required for refund')
    .max(500, 'Reason must be 500 characters or less')
    .optional()
}).strict();

// Route parameter schemas
export const merchantTransactionIdParamsSchema = z.object({
  merchantTransactionId: z.string()
    .min(1, 'Merchant transaction ID is required')
    .max(35, 'Invalid merchant transaction ID')
});

export const userIdParamsSchema = z.object({
  userId: z.string()
    .regex(/^\d+$/, 'User ID must be a valid number')
    .refine((val) => parseInt(val) > 0, 'User ID must be positive')
});

// Query parameter schemas
export const paginationQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a number')
    .optional()
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .optional()
    .default('10')
    .refine((val) => parseInt(val) <= 100, 'Limit cannot exceed 100')
});

export const transactionIdGenerationQuerySchema = z.object({
  prefix: z.string()
    .min(1, 'Prefix cannot be empty')
    .max(10, 'Prefix must be 10 characters or less')
    .regex(/^[A-Z0-9_]+$/, 'Prefix can only contain uppercase letters, numbers, and underscores')
    .optional()
    .default('TXN')
});

export const transactionStatsQuerySchema = z.object({
  userId: z.string()
    .regex(/^\d+$/, 'User ID must be a valid number')
    .refine((val) => parseInt(val) > 0, 'User ID must be positive')
    .optional()
});

// Webhook signature validation schema
export const webhookSignatureHeaderSchema = z.object({
  'x-verify': z.string()
    .min(1, 'X-Verify header is required')
});

// PhonePe callback query schema
export const callbackQuerySchema = z.object({
  token: z.string().optional()
});

// Response schemas for documentation
export const paymentInitiationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    merchantTransactionId: z.string(),
    redirectUrl: z.string().url(),
    amount: z.number(),
    status: z.string()
  }).optional(),
  errors: z.null()
});

export const paymentStatusResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    merchantTransactionId: z.string(),
    status: z.string(),
    success: z.boolean(),
    message: z.string(),
    paymentData: z.object({
      merchantId: z.string(),
      merchantTransactionId: z.string(),
      transactionId: z.string(),
      amount: z.number(),
      state: z.string(),
      responseCode: z.string(),
      paymentInstrument: z.object({
        type: z.string(),
        cardType: z.string().optional(),
        pgTransactionId: z.string().optional(),
        bankTransactionId: z.string().optional(),
        pgAuthorizationCode: z.string().optional(),
        arn: z.string().optional(),
        bankId: z.string().optional(),
        brn: z.string().optional()
      })
    }).optional()
  }).optional(),
  errors: z.null()
});

export const refundResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    merchantTransactionId: z.string(),
    refundId: z.string(),
    refundAmount: z.number(),
    reason: z.string().optional(),
    status: z.string()
  }).optional(),
  errors: z.null()
});

export const transactionHistoryResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    data: z.array(z.any()),
    pagination: z.object({
      currentPage: z.number(),
      totalPages: z.number(),
      pageSize: z.number(),
      total: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean()
    })
  }).optional(),
  meta: z.object({
    userId: z.number(),
    page: z.number(),
    limit: z.number()
  }).optional(),
  errors: z.null()
});

export const healthCheckResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    service: z.string(),
    status: z.string(),
    timestamp: z.string(),
    version: z.string(),
    environment: z.string(),
    configuration: z.object({
      merchantId: z.string(),
      saltKey: z.string(),
      baseUrl: z.string(),
      redirectUrls: z.object({
        success: z.string(),
        failure: z.string(),
        status: z.string()
      })
    })
  }).optional(),
  errors: z.null()
});

// Type exports
export type PhonePePaymentInitiationInput = z.infer<typeof phonePePaymentInitiationSchema>;
export type PhonePeRefundInput = z.infer<typeof phonePeRefundSchema>;
export type MerchantTransactionIdParams = z.infer<typeof merchantTransactionIdParamsSchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type TransactionIdGenerationQuery = z.infer<typeof transactionIdGenerationQuerySchema>;
export type TransactionStatsQuery = z.infer<typeof transactionStatsQuerySchema>;
export type WebhookSignatureHeader = z.infer<typeof webhookSignatureHeaderSchema>;
export type CallbackQuery = z.infer<typeof callbackQuerySchema>;

// Validation helper functions
export const validateMobileNumber = (mobileNumber: string): boolean => {
  return /^\d{10}$/.test(mobileNumber) && !mobileNumber.startsWith('0');
};

export const validateAmount = (amount: number): boolean => {
  return amount > 0 && amount <= 100000 && Number.isFinite(amount) && Number(amount.toFixed(2)) === amount;
};

export const validateMerchantTransactionId = (id: string): boolean => {
  return id.length > 0 && id.length <= 35;
};

export const sanitizeName = (name: string): string => {
  return name.replace(/[^a-zA-Z\s]/g, '').trim();
};

export const generateValidationErrorMessage = (error: z.ZodError): string => {
  return error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
}; 