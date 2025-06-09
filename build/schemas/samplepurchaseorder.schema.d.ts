import { z } from 'zod';
export declare const createSamplePurchaseOrderSchema: z.ZodObject<{
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
export declare const updateSamplePurchaseOrderSchema: z.ZodObject<{
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
export declare const upsertSamplePurchaseOrderSchema: z.ZodObject<{
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
export declare const samplePurchaseOrderParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const samplePurchaseOrderQuerySchema: z.ZodObject<{
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
    supplierid?: string | undefined;
    createddate?: string | undefined;
    modifieddate?: string | undefined;
    gstnumber?: string | undefined;
    companyname?: string | undefined;
    companyaddress?: string | undefined;
    contactname?: string | undefined;
    phonenumber?: string | undefined;
    companymail?: string | undefined;
    createdby?: string | undefined;
    modifiedby?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}, {
    id?: string | undefined;
    supplierid?: string | undefined;
    createddate?: string | undefined;
    modifieddate?: string | undefined;
    gstnumber?: string | undefined;
    companyname?: string | undefined;
    companyaddress?: string | undefined;
    contactname?: string | undefined;
    phonenumber?: string | undefined;
    companymail?: string | undefined;
    createdby?: string | undefined;
    modifiedby?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}>;
export type CreateSamplePurchaseOrderInput = z.infer<typeof createSamplePurchaseOrderSchema>;
export type UpdateSamplePurchaseOrderInput = z.infer<typeof updateSamplePurchaseOrderSchema>;
export type UpsertSamplePurchaseOrderInput = z.infer<typeof upsertSamplePurchaseOrderSchema>;
export type SamplePurchaseOrderParams = z.infer<typeof samplePurchaseOrderParamsSchema>;
export type SamplePurchaseOrderQuery = z.infer<typeof samplePurchaseOrderQuerySchema>;
//# sourceMappingURL=samplepurchaseorder.schema.d.ts.map