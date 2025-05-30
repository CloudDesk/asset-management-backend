import { z } from 'zod';
export declare const createAddressSchema: z.ZodObject<{
    userid: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    pincode: z.ZodOptional<z.ZodNumber>;
    doornumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    landmark: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    userid: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    pincode: z.ZodOptional<z.ZodNumber>;
    doornumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    landmark: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    userid: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    pincode: z.ZodOptional<z.ZodNumber>;
    doornumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    landmark: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updateAddressSchema: z.ZodObject<{
    userid: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    pincode: z.ZodOptional<z.ZodNumber>;
    doornumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    landmark: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    userid: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    pincode: z.ZodOptional<z.ZodNumber>;
    doornumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    landmark: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    userid: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    pincode: z.ZodOptional<z.ZodNumber>;
    doornumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    landmark: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertAddressSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    userid: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    pincode: z.ZodOptional<z.ZodNumber>;
    doornumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    landmark: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodString>;
    userid: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    pincode: z.ZodOptional<z.ZodNumber>;
    doornumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    landmark: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodString>;
    userid: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    mobilenumber: z.ZodOptional<z.ZodNumber>;
    pincode: z.ZodOptional<z.ZodNumber>;
    doornumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    landmark: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
    createddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const addressParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type UpsertAddressInput = z.infer<typeof upsertAddressSchema>;
export type AddressParams = z.infer<typeof addressParamsSchema>;
//# sourceMappingURL=address.schema.d.ts.map