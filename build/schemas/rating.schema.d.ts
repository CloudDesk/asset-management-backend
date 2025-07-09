import { z } from 'zod';
export declare const createRatingSchema: z.ZodObject<{
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    orderid: z.ZodOptional<z.ZodNumber>;
    starrating: z.ZodOptional<z.ZodNumber>;
    comments: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    usermail: z.ZodOptional<z.ZodString>;
    orderlineid: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    orderid: z.ZodOptional<z.ZodNumber>;
    starrating: z.ZodOptional<z.ZodNumber>;
    comments: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    usermail: z.ZodOptional<z.ZodString>;
    orderlineid: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    orderid: z.ZodOptional<z.ZodNumber>;
    starrating: z.ZodOptional<z.ZodNumber>;
    comments: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    usermail: z.ZodOptional<z.ZodString>;
    orderlineid: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updateRatingSchema: z.ZodObject<{
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    orderid: z.ZodOptional<z.ZodNumber>;
    starrating: z.ZodOptional<z.ZodNumber>;
    comments: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    usermail: z.ZodOptional<z.ZodString>;
    orderlineid: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    orderid: z.ZodOptional<z.ZodNumber>;
    starrating: z.ZodOptional<z.ZodNumber>;
    comments: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    usermail: z.ZodOptional<z.ZodString>;
    orderlineid: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    orderid: z.ZodOptional<z.ZodNumber>;
    starrating: z.ZodOptional<z.ZodNumber>;
    comments: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    usermail: z.ZodOptional<z.ZodString>;
    orderlineid: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertRatingSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    orderid: z.ZodOptional<z.ZodNumber>;
    starrating: z.ZodOptional<z.ZodNumber>;
    comments: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    usermail: z.ZodOptional<z.ZodString>;
    orderlineid: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    orderid: z.ZodOptional<z.ZodNumber>;
    starrating: z.ZodOptional<z.ZodNumber>;
    comments: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    usermail: z.ZodOptional<z.ZodString>;
    orderlineid: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodNumber>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodNumber>;
    orderid: z.ZodOptional<z.ZodNumber>;
    starrating: z.ZodOptional<z.ZodNumber>;
    comments: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    usermail: z.ZodOptional<z.ZodString>;
    orderlineid: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const ratingParamsSchema: z.ZodObject<{
    id: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const ratingQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    userid: z.ZodOptional<z.ZodString>;
    productid: z.ZodOptional<z.ZodString>;
    orderid: z.ZodOptional<z.ZodString>;
    starrating: z.ZodOptional<z.ZodString>;
    usermail: z.ZodOptional<z.ZodString>;
    orderlineid: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodString>;
    createdBefore: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orderid?: string | undefined;
    productid?: string | undefined;
    userid?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
    orderlineid?: string | undefined;
    starrating?: string | undefined;
    usermail?: string | undefined;
}, {
    orderid?: string | undefined;
    productid?: string | undefined;
    userid?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
    orderlineid?: string | undefined;
    starrating?: string | undefined;
    usermail?: string | undefined;
}>;
export type CreateRatingInput = z.infer<typeof createRatingSchema>;
export type UpdateRatingInput = z.infer<typeof updateRatingSchema>;
export type UpsertRatingInput = z.infer<typeof upsertRatingSchema>;
export type RatingParams = z.infer<typeof ratingParamsSchema>;
export type RatingQuery = z.infer<typeof ratingQuerySchema>;
//# sourceMappingURL=rating.schema.d.ts.map