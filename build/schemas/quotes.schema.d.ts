import { z } from 'zod';
export declare const createQuotesSchema: z.ZodObject<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    prnumber: z.ZodOptional<z.ZodString>;
    quoteurl: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    prnumber: z.ZodOptional<z.ZodString>;
    quoteurl: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    prnumber: z.ZodOptional<z.ZodString>;
    quoteurl: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updateQuotesSchema: z.ZodObject<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    prnumber: z.ZodOptional<z.ZodString>;
    quoteurl: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    prnumber: z.ZodOptional<z.ZodString>;
    quoteurl: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    prnumber: z.ZodOptional<z.ZodString>;
    quoteurl: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertQuotesSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    prnumber: z.ZodOptional<z.ZodString>;
    quoteurl: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    prnumber: z.ZodOptional<z.ZodString>;
    quoteurl: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    prnumber: z.ZodOptional<z.ZodString>;
    quoteurl: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const quotesParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const quotesQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    prnumber: z.ZodOptional<z.ZodString>;
    quotenumber: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodString>;
    createdBefore: z.ZodOptional<z.ZodString>;
    modifiedAfter: z.ZodOptional<z.ZodString>;
    modifiedBefore: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
    prnumber?: string | undefined;
    quotenumber?: string | undefined;
    modifiedAfter?: string | undefined;
    modifiedBefore?: string | undefined;
}, {
    status?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
    prnumber?: string | undefined;
    quotenumber?: string | undefined;
    modifiedAfter?: string | undefined;
    modifiedBefore?: string | undefined;
}>;
export declare function validateQuotesDynamicFields(data: Record<string, any>): Record<string, any>;
export type CreateQuotesInput = z.infer<typeof createQuotesSchema>;
export type UpdateQuotesInput = z.infer<typeof updateQuotesSchema>;
export type UpsertQuotesInput = z.infer<typeof upsertQuotesSchema>;
export type QuotesParams = z.infer<typeof quotesParamsSchema>;
export type QuotesQuery = z.infer<typeof quotesQuerySchema>;
//# sourceMappingURL=quotes.schema.d.ts.map