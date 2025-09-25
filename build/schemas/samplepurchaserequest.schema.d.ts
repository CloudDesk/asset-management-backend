import { z } from 'zod';
export declare const createSamplePurchaseRequestSchema: z.ZodObject<{
    companyname: z.ZodString;
    contactname: z.ZodString;
    phonenumber: z.ZodNumber;
    companymail: z.ZodString;
    gstnumber: z.ZodString;
    companyaddress: z.ZodString;
    supplierid: z.ZodNumber;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        quantity: number;
    }, {
        name: string;
        id: number;
        quantity: number;
    }>, "many">;
    createdby: z.ZodString;
    modifiedby: z.ZodString;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    companyname: z.ZodString;
    contactname: z.ZodString;
    phonenumber: z.ZodNumber;
    companymail: z.ZodString;
    gstnumber: z.ZodString;
    companyaddress: z.ZodString;
    supplierid: z.ZodNumber;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        quantity: number;
    }, {
        name: string;
        id: number;
        quantity: number;
    }>, "many">;
    createdby: z.ZodString;
    modifiedby: z.ZodString;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    companyname: z.ZodString;
    contactname: z.ZodString;
    phonenumber: z.ZodNumber;
    companymail: z.ZodString;
    gstnumber: z.ZodString;
    companyaddress: z.ZodString;
    supplierid: z.ZodNumber;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        quantity: number;
    }, {
        name: string;
        id: number;
        quantity: number;
    }>, "many">;
    createdby: z.ZodString;
    modifiedby: z.ZodString;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updateSamplePurchaseRequestSchema: z.ZodObject<{
    companyname: z.ZodOptional<z.ZodString>;
    contactname: z.ZodOptional<z.ZodString>;
    phonenumber: z.ZodOptional<z.ZodNumber>;
    companymail: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    companyaddress: z.ZodOptional<z.ZodString>;
    supplierid: z.ZodOptional<z.ZodNumber>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        quantity: number;
    }, {
        name: string;
        id: number;
        quantity: number;
    }>, "many">>;
    createdby: z.ZodOptional<z.ZodString>;
    modifiedby: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    companyname: z.ZodOptional<z.ZodString>;
    contactname: z.ZodOptional<z.ZodString>;
    phonenumber: z.ZodOptional<z.ZodNumber>;
    companymail: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    companyaddress: z.ZodOptional<z.ZodString>;
    supplierid: z.ZodOptional<z.ZodNumber>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        quantity: number;
    }, {
        name: string;
        id: number;
        quantity: number;
    }>, "many">>;
    createdby: z.ZodOptional<z.ZodString>;
    modifiedby: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    companyname: z.ZodOptional<z.ZodString>;
    contactname: z.ZodOptional<z.ZodString>;
    phonenumber: z.ZodOptional<z.ZodNumber>;
    companymail: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    companyaddress: z.ZodOptional<z.ZodString>;
    supplierid: z.ZodOptional<z.ZodNumber>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        quantity: number;
    }, {
        name: string;
        id: number;
        quantity: number;
    }>, "many">>;
    createdby: z.ZodOptional<z.ZodString>;
    modifiedby: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertSamplePurchaseRequestSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    companyname: z.ZodOptional<z.ZodString>;
    contactname: z.ZodOptional<z.ZodString>;
    phonenumber: z.ZodOptional<z.ZodNumber>;
    companymail: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    companyaddress: z.ZodOptional<z.ZodString>;
    supplierid: z.ZodOptional<z.ZodNumber>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        quantity: number;
    }, {
        name: string;
        id: number;
        quantity: number;
    }>, "many">>;
    createdby: z.ZodOptional<z.ZodString>;
    modifiedby: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodString>;
    companyname: z.ZodOptional<z.ZodString>;
    contactname: z.ZodOptional<z.ZodString>;
    phonenumber: z.ZodOptional<z.ZodNumber>;
    companymail: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    companyaddress: z.ZodOptional<z.ZodString>;
    supplierid: z.ZodOptional<z.ZodNumber>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        quantity: number;
    }, {
        name: string;
        id: number;
        quantity: number;
    }>, "many">>;
    createdby: z.ZodOptional<z.ZodString>;
    modifiedby: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodString>;
    companyname: z.ZodOptional<z.ZodString>;
    contactname: z.ZodOptional<z.ZodString>;
    phonenumber: z.ZodOptional<z.ZodNumber>;
    companymail: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    companyaddress: z.ZodOptional<z.ZodString>;
    supplierid: z.ZodOptional<z.ZodNumber>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        quantity: number;
    }, {
        name: string;
        id: number;
        quantity: number;
    }>, "many">>;
    createdby: z.ZodOptional<z.ZodString>;
    modifiedby: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodNumber>;
    modifieddate: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export declare const samplePurchaseRequestParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const samplePurchaseRequestQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    companyname: z.ZodOptional<z.ZodString>;
    contactname: z.ZodOptional<z.ZodString>;
    phonenumber: z.ZodOptional<z.ZodString>;
    companymail: z.ZodOptional<z.ZodString>;
    gstnumber: z.ZodOptional<z.ZodString>;
    companyaddress: z.ZodOptional<z.ZodString>;
    supplierid: z.ZodOptional<z.ZodString>;
    createdby: z.ZodOptional<z.ZodString>;
    modifiedby: z.ZodOptional<z.ZodString>;
    createddate: z.ZodOptional<z.ZodString>;
    modifieddate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id?: string | undefined;
    createddate?: string | undefined;
    modifieddate?: string | undefined;
    gstnumber?: string | undefined;
    companyname?: string | undefined;
    companyaddress?: string | undefined;
    contactname?: string | undefined;
    phonenumber?: string | undefined;
    supplierid?: string | undefined;
    companymail?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdby?: string | undefined;
    modifiedby?: string | undefined;
}, {
    id?: string | undefined;
    createddate?: string | undefined;
    modifieddate?: string | undefined;
    gstnumber?: string | undefined;
    companyname?: string | undefined;
    companyaddress?: string | undefined;
    contactname?: string | undefined;
    phonenumber?: string | undefined;
    supplierid?: string | undefined;
    companymail?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    createdby?: string | undefined;
    modifiedby?: string | undefined;
}>;
export type CreateSamplePurchaseRequestInput = z.infer<typeof createSamplePurchaseRequestSchema>;
export type UpdateSamplePurchaseRequestInput = z.infer<typeof updateSamplePurchaseRequestSchema>;
export type UpsertSamplePurchaseRequestInput = z.infer<typeof upsertSamplePurchaseRequestSchema>;
export type SamplePurchaseRequestParams = z.infer<typeof samplePurchaseRequestParamsSchema>;
export type SamplePurchaseRequestQuery = z.infer<typeof samplePurchaseRequestQuerySchema>;
//# sourceMappingURL=samplepurchaserequest.schema.d.ts.map