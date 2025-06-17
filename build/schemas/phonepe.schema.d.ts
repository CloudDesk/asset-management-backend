import { z } from 'zod';
export declare const phonePePaymentInitiationSchema: z.ZodObject<{
    merchantTransactionId: z.ZodOptional<z.ZodString>;
    amount: z.ZodEffects<z.ZodEffects<z.ZodNumber, number, number>, number, number>;
    name: z.ZodString;
    mobileNumber: z.ZodEffects<z.ZodString, string, string>;
    userId: z.ZodNumber;
    productIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>>;
    transactionFor: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    callbackUrl: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    name: string;
    amount: number;
    userId: number;
    mobileNumber: string;
    productIds: number[];
    transactionFor: string;
    merchantTransactionId?: string | undefined;
    callbackUrl?: string | undefined;
}, {
    name: string;
    amount: number;
    userId: number;
    mobileNumber: string;
    merchantTransactionId?: string | undefined;
    productIds?: number[] | undefined;
    transactionFor?: string | undefined;
    callbackUrl?: string | undefined;
}>;
export declare const phonePeRefundSchema: z.ZodObject<{
    refundAmount: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    refundAmount?: number | undefined;
    reason?: string | undefined;
}, {
    refundAmount?: number | undefined;
    reason?: string | undefined;
}>;
export declare const merchantTransactionIdParamsSchema: z.ZodObject<{
    merchantTransactionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    merchantTransactionId: string;
}, {
    merchantTransactionId: string;
}>;
export declare const userIdParamsSchema: z.ZodObject<{
    userId: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    userId: string;
}, {
    userId: string;
}>;
export declare const paginationQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    limit: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, string, string | undefined>;
}, "strip", z.ZodTypeAny, {
    page: string;
    limit: string;
}, {
    page?: string | undefined;
    limit?: string | undefined;
}>;
export declare const transactionIdGenerationQuerySchema: z.ZodObject<{
    prefix: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    prefix: string;
}, {
    prefix?: string | undefined;
}>;
export declare const transactionStatsQuerySchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    userId?: string | undefined;
}, {
    userId?: string | undefined;
}>;
export declare const webhookSignatureHeaderSchema: z.ZodObject<{
    'x-verify': z.ZodString;
}, "strip", z.ZodTypeAny, {
    'x-verify': string;
}, {
    'x-verify': string;
}>;
export declare const callbackQuerySchema: z.ZodObject<{
    token: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    token?: string | undefined;
}, {
    token?: string | undefined;
}>;
export declare const paymentInitiationResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodString;
    data: z.ZodOptional<z.ZodObject<{
        merchantTransactionId: z.ZodString;
        redirectUrl: z.ZodString;
        amount: z.ZodNumber;
        status: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        amount: number;
        merchantTransactionId: string;
        redirectUrl: string;
    }, {
        status: string;
        amount: number;
        merchantTransactionId: string;
        redirectUrl: string;
    }>>;
    errors: z.ZodNull;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: boolean;
    errors: null;
    data?: {
        status: string;
        amount: number;
        merchantTransactionId: string;
        redirectUrl: string;
    } | undefined;
}, {
    message: string;
    success: boolean;
    errors: null;
    data?: {
        status: string;
        amount: number;
        merchantTransactionId: string;
        redirectUrl: string;
    } | undefined;
}>;
export declare const paymentStatusResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodString;
    data: z.ZodOptional<z.ZodObject<{
        merchantTransactionId: z.ZodString;
        status: z.ZodString;
        success: z.ZodBoolean;
        message: z.ZodString;
        paymentData: z.ZodOptional<z.ZodObject<{
            merchantId: z.ZodString;
            merchantTransactionId: z.ZodString;
            transactionId: z.ZodString;
            amount: z.ZodNumber;
            state: z.ZodString;
            responseCode: z.ZodString;
            paymentInstrument: z.ZodObject<{
                type: z.ZodString;
                cardType: z.ZodOptional<z.ZodString>;
                pgTransactionId: z.ZodOptional<z.ZodString>;
                bankTransactionId: z.ZodOptional<z.ZodString>;
                pgAuthorizationCode: z.ZodOptional<z.ZodString>;
                arn: z.ZodOptional<z.ZodString>;
                bankId: z.ZodOptional<z.ZodString>;
                brn: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                type: string;
                cardType?: string | undefined;
                pgTransactionId?: string | undefined;
                bankTransactionId?: string | undefined;
                pgAuthorizationCode?: string | undefined;
                arn?: string | undefined;
                bankId?: string | undefined;
                brn?: string | undefined;
            }, {
                type: string;
                cardType?: string | undefined;
                pgTransactionId?: string | undefined;
                bankTransactionId?: string | undefined;
                pgAuthorizationCode?: string | undefined;
                arn?: string | undefined;
                bankId?: string | undefined;
                brn?: string | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            state: string;
            amount: number;
            transactionId: string;
            merchantTransactionId: string;
            merchantId: string;
            responseCode: string;
            paymentInstrument: {
                type: string;
                cardType?: string | undefined;
                pgTransactionId?: string | undefined;
                bankTransactionId?: string | undefined;
                pgAuthorizationCode?: string | undefined;
                arn?: string | undefined;
                bankId?: string | undefined;
                brn?: string | undefined;
            };
        }, {
            state: string;
            amount: number;
            transactionId: string;
            merchantTransactionId: string;
            merchantId: string;
            responseCode: string;
            paymentInstrument: {
                type: string;
                cardType?: string | undefined;
                pgTransactionId?: string | undefined;
                bankTransactionId?: string | undefined;
                pgAuthorizationCode?: string | undefined;
                arn?: string | undefined;
                bankId?: string | undefined;
                brn?: string | undefined;
            };
        }>>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        status: string;
        success: boolean;
        merchantTransactionId: string;
        paymentData?: {
            state: string;
            amount: number;
            transactionId: string;
            merchantTransactionId: string;
            merchantId: string;
            responseCode: string;
            paymentInstrument: {
                type: string;
                cardType?: string | undefined;
                pgTransactionId?: string | undefined;
                bankTransactionId?: string | undefined;
                pgAuthorizationCode?: string | undefined;
                arn?: string | undefined;
                bankId?: string | undefined;
                brn?: string | undefined;
            };
        } | undefined;
    }, {
        message: string;
        status: string;
        success: boolean;
        merchantTransactionId: string;
        paymentData?: {
            state: string;
            amount: number;
            transactionId: string;
            merchantTransactionId: string;
            merchantId: string;
            responseCode: string;
            paymentInstrument: {
                type: string;
                cardType?: string | undefined;
                pgTransactionId?: string | undefined;
                bankTransactionId?: string | undefined;
                pgAuthorizationCode?: string | undefined;
                arn?: string | undefined;
                bankId?: string | undefined;
                brn?: string | undefined;
            };
        } | undefined;
    }>>;
    errors: z.ZodNull;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: boolean;
    errors: null;
    data?: {
        message: string;
        status: string;
        success: boolean;
        merchantTransactionId: string;
        paymentData?: {
            state: string;
            amount: number;
            transactionId: string;
            merchantTransactionId: string;
            merchantId: string;
            responseCode: string;
            paymentInstrument: {
                type: string;
                cardType?: string | undefined;
                pgTransactionId?: string | undefined;
                bankTransactionId?: string | undefined;
                pgAuthorizationCode?: string | undefined;
                arn?: string | undefined;
                bankId?: string | undefined;
                brn?: string | undefined;
            };
        } | undefined;
    } | undefined;
}, {
    message: string;
    success: boolean;
    errors: null;
    data?: {
        message: string;
        status: string;
        success: boolean;
        merchantTransactionId: string;
        paymentData?: {
            state: string;
            amount: number;
            transactionId: string;
            merchantTransactionId: string;
            merchantId: string;
            responseCode: string;
            paymentInstrument: {
                type: string;
                cardType?: string | undefined;
                pgTransactionId?: string | undefined;
                bankTransactionId?: string | undefined;
                pgAuthorizationCode?: string | undefined;
                arn?: string | undefined;
                bankId?: string | undefined;
                brn?: string | undefined;
            };
        } | undefined;
    } | undefined;
}>;
export declare const refundResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodString;
    data: z.ZodOptional<z.ZodObject<{
        merchantTransactionId: z.ZodString;
        refundId: z.ZodString;
        refundAmount: z.ZodNumber;
        reason: z.ZodOptional<z.ZodString>;
        status: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        merchantTransactionId: string;
        refundAmount: number;
        refundId: string;
        reason?: string | undefined;
    }, {
        status: string;
        merchantTransactionId: string;
        refundAmount: number;
        refundId: string;
        reason?: string | undefined;
    }>>;
    errors: z.ZodNull;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: boolean;
    errors: null;
    data?: {
        status: string;
        merchantTransactionId: string;
        refundAmount: number;
        refundId: string;
        reason?: string | undefined;
    } | undefined;
}, {
    message: string;
    success: boolean;
    errors: null;
    data?: {
        status: string;
        merchantTransactionId: string;
        refundAmount: number;
        refundId: string;
        reason?: string | undefined;
    } | undefined;
}>;
export declare const transactionHistoryResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodString;
    data: z.ZodOptional<z.ZodObject<{
        data: z.ZodArray<z.ZodAny, "many">;
        pagination: z.ZodObject<{
            currentPage: z.ZodNumber;
            totalPages: z.ZodNumber;
            pageSize: z.ZodNumber;
            total: z.ZodNumber;
            hasNext: z.ZodBoolean;
            hasPrev: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            total: number;
            currentPage: number;
            totalPages: number;
            pageSize: number;
            hasNext: boolean;
            hasPrev: boolean;
        }, {
            total: number;
            currentPage: number;
            totalPages: number;
            pageSize: number;
            hasNext: boolean;
            hasPrev: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        data: any[];
        pagination: {
            total: number;
            currentPage: number;
            totalPages: number;
            pageSize: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }, {
        data: any[];
        pagination: {
            total: number;
            currentPage: number;
            totalPages: number;
            pageSize: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>>;
    meta: z.ZodOptional<z.ZodObject<{
        userId: z.ZodNumber;
        page: z.ZodNumber;
        limit: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        userId: number;
    }, {
        page: number;
        limit: number;
        userId: number;
    }>>;
    errors: z.ZodNull;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: boolean;
    errors: null;
    meta?: {
        page: number;
        limit: number;
        userId: number;
    } | undefined;
    data?: {
        data: any[];
        pagination: {
            total: number;
            currentPage: number;
            totalPages: number;
            pageSize: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    } | undefined;
}, {
    message: string;
    success: boolean;
    errors: null;
    meta?: {
        page: number;
        limit: number;
        userId: number;
    } | undefined;
    data?: {
        data: any[];
        pagination: {
            total: number;
            currentPage: number;
            totalPages: number;
            pageSize: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    } | undefined;
}>;
export declare const healthCheckResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    message: z.ZodString;
    data: z.ZodOptional<z.ZodObject<{
        service: z.ZodString;
        status: z.ZodString;
        timestamp: z.ZodString;
        version: z.ZodString;
        environment: z.ZodString;
        configuration: z.ZodObject<{
            merchantId: z.ZodString;
            saltKey: z.ZodString;
            baseUrl: z.ZodString;
            redirectUrls: z.ZodObject<{
                success: z.ZodString;
                failure: z.ZodString;
                status: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                status: string;
                success: string;
                failure: string;
            }, {
                status: string;
                success: string;
                failure: string;
            }>;
        }, "strip", z.ZodTypeAny, {
            merchantId: string;
            saltKey: string;
            baseUrl: string;
            redirectUrls: {
                status: string;
                success: string;
                failure: string;
            };
        }, {
            merchantId: string;
            saltKey: string;
            baseUrl: string;
            redirectUrls: {
                status: string;
                success: string;
                failure: string;
            };
        }>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        version: string;
        timestamp: string;
        service: string;
        environment: string;
        configuration: {
            merchantId: string;
            saltKey: string;
            baseUrl: string;
            redirectUrls: {
                status: string;
                success: string;
                failure: string;
            };
        };
    }, {
        status: string;
        version: string;
        timestamp: string;
        service: string;
        environment: string;
        configuration: {
            merchantId: string;
            saltKey: string;
            baseUrl: string;
            redirectUrls: {
                status: string;
                success: string;
                failure: string;
            };
        };
    }>>;
    errors: z.ZodNull;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: boolean;
    errors: null;
    data?: {
        status: string;
        version: string;
        timestamp: string;
        service: string;
        environment: string;
        configuration: {
            merchantId: string;
            saltKey: string;
            baseUrl: string;
            redirectUrls: {
                status: string;
                success: string;
                failure: string;
            };
        };
    } | undefined;
}, {
    message: string;
    success: boolean;
    errors: null;
    data?: {
        status: string;
        version: string;
        timestamp: string;
        service: string;
        environment: string;
        configuration: {
            merchantId: string;
            saltKey: string;
            baseUrl: string;
            redirectUrls: {
                status: string;
                success: string;
                failure: string;
            };
        };
    } | undefined;
}>;
export type PhonePePaymentInitiationInput = z.infer<typeof phonePePaymentInitiationSchema>;
export type PhonePeRefundInput = z.infer<typeof phonePeRefundSchema>;
export type MerchantTransactionIdParams = z.infer<typeof merchantTransactionIdParamsSchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type TransactionIdGenerationQuery = z.infer<typeof transactionIdGenerationQuerySchema>;
export type TransactionStatsQuery = z.infer<typeof transactionStatsQuerySchema>;
export type WebhookSignatureHeader = z.infer<typeof webhookSignatureHeaderSchema>;
export type CallbackQuery = z.infer<typeof callbackQuerySchema>;
export declare const validateMobileNumber: (mobileNumber: string) => boolean;
export declare const validateAmount: (amount: number) => boolean;
export declare const validateMerchantTransactionId: (id: string) => boolean;
export declare const sanitizeName: (name: string) => string;
export declare const generateValidationErrorMessage: (error: z.ZodError) => string;
//# sourceMappingURL=phonepe.schema.d.ts.map