import { z } from 'zod';
export declare const createTransactionSchema: z.ZodObject<{
    transactionid: z.ZodString;
    transactiondata: z.ZodOptional<z.ZodAny>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    merchanttransactionid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    transactionfor: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    transactionid: z.ZodString;
    transactiondata: z.ZodOptional<z.ZodAny>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    merchanttransactionid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    transactionfor: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    transactionid: z.ZodString;
    transactiondata: z.ZodOptional<z.ZodAny>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    merchanttransactionid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    transactionfor: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updateTransactionSchema: z.ZodObject<{
    transactiondata: z.ZodOptional<z.ZodAny>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    merchanttransactionid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    transactionfor: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    transactiondata: z.ZodOptional<z.ZodAny>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    merchanttransactionid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    transactionfor: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    transactiondata: z.ZodOptional<z.ZodAny>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    merchanttransactionid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    transactionfor: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertTransactionSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    transactionid: z.ZodOptional<z.ZodString>;
    transactiondata: z.ZodOptional<z.ZodAny>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    merchanttransactionid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    transactionfor: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodNumber>;
    transactionid: z.ZodOptional<z.ZodString>;
    transactiondata: z.ZodOptional<z.ZodAny>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    merchanttransactionid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    transactionfor: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodNumber>;
    transactionid: z.ZodOptional<z.ZodString>;
    transactiondata: z.ZodOptional<z.ZodAny>;
    userid: z.ZodOptional<z.ZodNumber>;
    productid: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    merchanttransactionid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    transactionfor: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const transactionParamsSchema: z.ZodObject<{
    transactionid: z.ZodString;
}, "strip", z.ZodTypeAny, {
    transactionid: string;
}, {
    transactionid: string;
}>;
export declare const transactionByIdParamsSchema: z.ZodObject<{
    id: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const transactionQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    transactionid: z.ZodOptional<z.ZodString>;
    userid: z.ZodOptional<z.ZodString>;
    merchanttransactionid: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodString>;
    mobilenumber: z.ZodOptional<z.ZodString>;
    transactionfor: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodString>;
    createdBefore: z.ZodOptional<z.ZodString>;
    amountMin: z.ZodOptional<z.ZodString>;
    amountMax: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    userid?: string | undefined;
    merchanttransactionid?: string | undefined;
    mobilenumber?: string | undefined;
    transactionid?: string | undefined;
    amount?: string | undefined;
    transactionfor?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
    amountMin?: string | undefined;
    amountMax?: string | undefined;
}, {
    name?: string | undefined;
    userid?: string | undefined;
    merchanttransactionid?: string | undefined;
    mobilenumber?: string | undefined;
    transactionid?: string | undefined;
    amount?: string | undefined;
    transactionfor?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
    amountMin?: string | undefined;
    amountMax?: string | undefined;
}>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type UpsertTransactionInput = z.infer<typeof upsertTransactionSchema>;
export type TransactionParams = z.infer<typeof transactionParamsSchema>;
export type TransactionByIdParams = z.infer<typeof transactionByIdParamsSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
//# sourceMappingURL=transaction.schema.d.ts.map