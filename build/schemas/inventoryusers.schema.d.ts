import { z } from 'zod';
export declare const createInventoryUsersSchema: z.ZodObject<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    usersphonenumber: z.ZodOptional<z.ZodBigInt>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    fcmid: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodBigInt>;
    modifieddate: z.ZodOptional<z.ZodBigInt>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    usersphonenumber: z.ZodOptional<z.ZodBigInt>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    fcmid: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodBigInt>;
    modifieddate: z.ZodOptional<z.ZodBigInt>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    usersphonenumber: z.ZodOptional<z.ZodBigInt>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    fcmid: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodBigInt>;
    modifieddate: z.ZodOptional<z.ZodBigInt>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updateInventoryUsersSchema: z.ZodObject<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    usersphonenumber: z.ZodOptional<z.ZodBigInt>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    fcmid: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodBigInt>;
    modifieddate: z.ZodOptional<z.ZodBigInt>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    usersphonenumber: z.ZodOptional<z.ZodBigInt>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    fcmid: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodBigInt>;
    modifieddate: z.ZodOptional<z.ZodBigInt>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    usersphonenumber: z.ZodOptional<z.ZodBigInt>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    fcmid: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodBigInt>;
    modifieddate: z.ZodOptional<z.ZodBigInt>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertInventoryUsersSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    usersphonenumber: z.ZodOptional<z.ZodBigInt>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    fcmid: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodBigInt>;
    modifieddate: z.ZodOptional<z.ZodBigInt>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodNumber>;
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    usersphonenumber: z.ZodOptional<z.ZodBigInt>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    fcmid: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodBigInt>;
    modifieddate: z.ZodOptional<z.ZodBigInt>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodNumber>;
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    usersphonenumber: z.ZodOptional<z.ZodBigInt>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    fcmid: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodBigInt>;
    modifieddate: z.ZodOptional<z.ZodBigInt>;
}, z.ZodTypeAny, "passthrough">>;
export declare const inventoryUsersParamsSchema: z.ZodObject<{
    id: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const inventoryUsersQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    useremail: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    usersphonenumber: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodString>;
    createdBefore: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    location?: string | undefined;
    useremail?: string | undefined;
    firstname?: string | undefined;
    lastname?: string | undefined;
    role?: string | undefined;
    usersphonenumber?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
}, {
    location?: string | undefined;
    useremail?: string | undefined;
    firstname?: string | undefined;
    lastname?: string | undefined;
    role?: string | undefined;
    usersphonenumber?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
}>;
export type CreateInventoryUsersInput = z.infer<typeof createInventoryUsersSchema>;
export type UpdateInventoryUsersInput = z.infer<typeof updateInventoryUsersSchema>;
export type UpsertInventoryUsersInput = z.infer<typeof upsertInventoryUsersSchema>;
export type InventoryUsersParams = z.infer<typeof inventoryUsersParamsSchema>;
export type InventoryUsersQuery = z.infer<typeof inventoryUsersQuerySchema>;
//# sourceMappingURL=inventoryusers.schema.d.ts.map