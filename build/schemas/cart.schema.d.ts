import { z } from 'zod';
export declare const createCartSchema: z.ZodObject<{
    productid: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    iscart: z.ZodOptional<z.ZodBoolean>;
    iswishlist: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    productid: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    iscart: z.ZodOptional<z.ZodBoolean>;
    iswishlist: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    productid: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    iscart: z.ZodOptional<z.ZodBoolean>;
    iswishlist: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updateCartSchema: z.ZodObject<{
    productid: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    iscart: z.ZodOptional<z.ZodBoolean>;
    iswishlist: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    productid: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    iscart: z.ZodOptional<z.ZodBoolean>;
    iswishlist: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    productid: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    iscart: z.ZodOptional<z.ZodBoolean>;
    iswishlist: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertCartSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    iscart: z.ZodOptional<z.ZodBoolean>;
    iswishlist: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    iscart: z.ZodOptional<z.ZodBoolean>;
    iswishlist: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    iscart: z.ZodOptional<z.ZodBoolean>;
    iswishlist: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const cartParamsSchema: z.ZodObject<{
    id: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const cartQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    productid: z.ZodOptional<z.ZodString>;
    userid: z.ZodOptional<z.ZodString>;
    quantity: z.ZodOptional<z.ZodString>;
    iscart: z.ZodOptional<z.ZodString>;
    iswishlist: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodString>;
    createdBefore: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    productid?: string | undefined;
    userid?: string | undefined;
    quantity?: string | undefined;
    iscart?: string | undefined;
    iswishlist?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
}, {
    productid?: string | undefined;
    userid?: string | undefined;
    quantity?: string | undefined;
    iscart?: string | undefined;
    iswishlist?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
}>;
export type CreateCartInput = z.infer<typeof createCartSchema>;
export type UpdateCartInput = z.infer<typeof updateCartSchema>;
export type UpsertCartInput = z.infer<typeof upsertCartSchema>;
export type CartParams = z.infer<typeof cartParamsSchema>;
export type CartQuery = z.infer<typeof cartQuerySchema>;
//# sourceMappingURL=cart.schema.d.ts.map