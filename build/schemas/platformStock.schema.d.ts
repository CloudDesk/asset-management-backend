import { z } from 'zod';
export declare const createPlatformStockSchema: z.ZodObject<{
    platform: z.ZodString;
    productid: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    availableqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    orderedqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    soldqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    totalqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    lockqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    createddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
    modifieddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    platform: z.ZodString;
    productid: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    availableqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    orderedqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    soldqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    totalqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    lockqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    createddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
    modifieddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    platform: z.ZodString;
    productid: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    availableqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    orderedqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    soldqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    totalqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    lockqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    createddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
    modifieddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updatePlatformStockSchema: z.ZodObject<{
    platform: z.ZodOptional<z.ZodString>;
    productid: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    availableqty: z.ZodOptional<z.ZodNumber>;
    orderedqty: z.ZodOptional<z.ZodNumber>;
    soldqty: z.ZodOptional<z.ZodNumber>;
    totalqty: z.ZodOptional<z.ZodNumber>;
    lockqty: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    platform: z.ZodOptional<z.ZodString>;
    productid: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    availableqty: z.ZodOptional<z.ZodNumber>;
    orderedqty: z.ZodOptional<z.ZodNumber>;
    soldqty: z.ZodOptional<z.ZodNumber>;
    totalqty: z.ZodOptional<z.ZodNumber>;
    lockqty: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    platform: z.ZodOptional<z.ZodString>;
    productid: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    availableqty: z.ZodOptional<z.ZodNumber>;
    orderedqty: z.ZodOptional<z.ZodNumber>;
    soldqty: z.ZodOptional<z.ZodNumber>;
    totalqty: z.ZodOptional<z.ZodNumber>;
    lockqty: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertPlatformStockSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
    platform: z.ZodOptional<z.ZodString>;
    productid: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    availableqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    orderedqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    soldqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    totalqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    lockqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    createddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
    modifieddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
    platform: z.ZodOptional<z.ZodString>;
    productid: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    availableqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    orderedqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    soldqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    totalqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    lockqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    createddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
    modifieddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
    platform: z.ZodOptional<z.ZodString>;
    productid: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    availableqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    orderedqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    soldqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    totalqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    lockqty: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    createddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
    modifieddate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const platformStockParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const platformStockQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    platform: z.ZodOptional<z.ZodString>;
    productid: z.ZodOptional<z.ZodString>;
    minAvailableQty: z.ZodOptional<z.ZodString>;
    maxAvailableQty: z.ZodOptional<z.ZodString>;
    minOrderedQty: z.ZodOptional<z.ZodString>;
    maxOrderedQty: z.ZodOptional<z.ZodString>;
    minSoldQty: z.ZodOptional<z.ZodString>;
    maxSoldQty: z.ZodOptional<z.ZodString>;
    minTotalQty: z.ZodOptional<z.ZodString>;
    maxTotalQty: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodString>;
    createdBefore: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    platform?: string | undefined;
    productid?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
    minAvailableQty?: string | undefined;
    maxAvailableQty?: string | undefined;
    minOrderedQty?: string | undefined;
    maxOrderedQty?: string | undefined;
    minSoldQty?: string | undefined;
    maxSoldQty?: string | undefined;
    minTotalQty?: string | undefined;
    maxTotalQty?: string | undefined;
}, {
    platform?: string | undefined;
    productid?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
    minAvailableQty?: string | undefined;
    maxAvailableQty?: string | undefined;
    minOrderedQty?: string | undefined;
    maxOrderedQty?: string | undefined;
    minSoldQty?: string | undefined;
    maxSoldQty?: string | undefined;
    minTotalQty?: string | undefined;
    maxTotalQty?: string | undefined;
}>;
export declare const platformTransferSchema: z.ZodObject<{
    stockId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    newPlatform: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBigInt]>>;
}, "strip", z.ZodTypeAny, {
    stockId: string | number;
    newPlatform: string;
    userId?: string | number | bigint | undefined;
    reason?: string | undefined;
}, {
    stockId: string | number;
    newPlatform: string;
    userId?: string | number | bigint | undefined;
    reason?: string | undefined;
}>;
export declare const bulkPlatformStockUpdateSchema: z.ZodObject<{
    productid: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    platformUpdates: z.ZodArray<z.ZodObject<{
        platform: z.ZodString;
        availableqty: z.ZodOptional<z.ZodNumber>;
        orderedqty: z.ZodOptional<z.ZodNumber>;
        soldqty: z.ZodOptional<z.ZodNumber>;
        totalqty: z.ZodOptional<z.ZodNumber>;
        lockqty: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        platform: string;
        availableqty?: number | undefined;
        orderedqty?: number | undefined;
        soldqty?: number | undefined;
        totalqty?: number | undefined;
        lockqty?: number | undefined;
    }, {
        platform: string;
        availableqty?: number | undefined;
        orderedqty?: number | undefined;
        soldqty?: number | undefined;
        totalqty?: number | undefined;
        lockqty?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    productid: string | number;
    platformUpdates: {
        platform: string;
        availableqty?: number | undefined;
        orderedqty?: number | undefined;
        soldqty?: number | undefined;
        totalqty?: number | undefined;
        lockqty?: number | undefined;
    }[];
}, {
    productid: string | number;
    platformUpdates: {
        platform: string;
        availableqty?: number | undefined;
        orderedqty?: number | undefined;
        soldqty?: number | undefined;
        totalqty?: number | undefined;
        lockqty?: number | undefined;
    }[];
}>;
export declare function validatePlatformStockDynamicFields(data: Record<string, any>): Record<string, any>;
export type CreatePlatformStockInput = z.infer<typeof createPlatformStockSchema>;
export type UpdatePlatformStockInput = z.infer<typeof updatePlatformStockSchema>;
export type UpsertPlatformStockInput = z.infer<typeof upsertPlatformStockSchema>;
export type PlatformStockParams = z.infer<typeof platformStockParamsSchema>;
export type PlatformStockQuery = z.infer<typeof platformStockQuerySchema>;
export type PlatformTransferInput = z.infer<typeof platformTransferSchema>;
export type BulkPlatformStockUpdateInput = z.infer<typeof bulkPlatformStockUpdateSchema>;
//# sourceMappingURL=platformStock.schema.d.ts.map