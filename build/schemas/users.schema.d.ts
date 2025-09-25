import { z } from 'zod';
export declare const createUsersSchema: z.ZodObject<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    usermobilenumber: z.ZodOptional<z.ZodNumber>;
    fcmid: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    isbusinessuser: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    usermobilenumber: z.ZodOptional<z.ZodNumber>;
    fcmid: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    isbusinessuser: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    usermobilenumber: z.ZodOptional<z.ZodNumber>;
    fcmid: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    isbusinessuser: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updateUsersSchema: z.ZodObject<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    usermobilenumber: z.ZodOptional<z.ZodNumber>;
    fcmid: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    isbusinessuser: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    usermobilenumber: z.ZodOptional<z.ZodNumber>;
    fcmid: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    isbusinessuser: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    usermobilenumber: z.ZodOptional<z.ZodNumber>;
    fcmid: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    isbusinessuser: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertUsersSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    usermobilenumber: z.ZodOptional<z.ZodNumber>;
    fcmid: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    isbusinessuser: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodNumber>;
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    usermobilenumber: z.ZodOptional<z.ZodNumber>;
    fcmid: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    isbusinessuser: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodNumber>;
    useremail: z.ZodOptional<z.ZodString>;
    userpassword: z.ZodOptional<z.ZodString>;
    usermobilenumber: z.ZodOptional<z.ZodNumber>;
    fcmid: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    isbusinessuser: z.ZodOptional<z.ZodBoolean>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const usersParamsSchema: z.ZodObject<{
    id: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const usersQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    useremail: z.ZodOptional<z.ZodString>;
    firstname: z.ZodOptional<z.ZodString>;
    lastname: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    isbusinessuser: z.ZodOptional<z.ZodString>;
    usermobilenumber: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodString>;
    createdBefore: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    useremail?: string | undefined;
    usermobilenumber?: string | undefined;
    firstname?: string | undefined;
    lastname?: string | undefined;
    gender?: string | undefined;
    gstnumber?: string | undefined;
    isbusinessuser?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
}, {
    useremail?: string | undefined;
    usermobilenumber?: string | undefined;
    firstname?: string | undefined;
    lastname?: string | undefined;
    gender?: string | undefined;
    gstnumber?: string | undefined;
    isbusinessuser?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdAfter?: string | undefined;
    createdBefore?: string | undefined;
}>;
export type CreateUsersInput = z.infer<typeof createUsersSchema>;
export type UpdateUsersInput = z.infer<typeof updateUsersSchema>;
export type UpsertUsersInput = z.infer<typeof upsertUsersSchema>;
export type UsersParams = z.infer<typeof usersParamsSchema>;
export type UsersQuery = z.infer<typeof usersQuerySchema>;
//# sourceMappingURL=users.schema.d.ts.map