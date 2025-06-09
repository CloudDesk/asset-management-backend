import { z } from 'zod';
// Validation schema for creating a sample purchase order
export const createSamplePurchaseOrderSchema = z.object({
    companyname: z.string().min(1).max(255),
    contactname: z.string().min(1).max(255),
    phonenumber: z.number().int().positive(),
    companymail: z.string().email().max(255),
    gstnumber: z.string().min(1).max(50),
    companyaddress: z.string().min(1),
    supplierid: z.number().int().positive(),
    items: z.array(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1),
        quantity: z.number().int().positive()
    })).min(1),
    createdby: z.string().min(1).max(255),
    modifiedby: z.string().min(1).max(255),
    createddate: z.number().optional(),
    modifieddate: z.number().optional()
}).passthrough();
// Validation schema for updating a sample purchase order
export const updateSamplePurchaseOrderSchema = z.object({
    companyname: z.string().min(1).max(255).optional(),
    contactname: z.string().min(1).max(255).optional(),
    phonenumber: z.number().int().positive().optional(),
    companymail: z.string().email().max(255).optional(),
    gstnumber: z.string().min(1).max(50).optional(),
    companyaddress: z.string().min(1).optional(),
    supplierid: z.number().int().positive().optional(),
    items: z.array(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1),
        quantity: z.number().int().positive()
    })).min(1).optional(),
    createdby: z.string().min(1).max(255).optional(),
    modifiedby: z.string().min(1).max(255).optional(),
    createddate: z.number().optional(),
    modifieddate: z.number().optional()
}).passthrough();
// Schema for upserting (create or update)
export const upsertSamplePurchaseOrderSchema = z.object({
    id: z.string().optional(),
    companyname: z.string().min(1).max(255).optional(),
    contactname: z.string().min(1).max(255).optional(),
    phonenumber: z.number().int().positive().optional(),
    companymail: z.string().email().max(255).optional(),
    gstnumber: z.string().min(1).max(50).optional(),
    companyaddress: z.string().min(1).optional(),
    supplierid: z.number().int().positive().optional(),
    items: z.array(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1),
        quantity: z.number().int().positive()
    })).min(1).optional(),
    createdby: z.string().min(1).max(255).optional(),
    modifiedby: z.string().min(1).max(255).optional(),
    createddate: z.number().optional(),
    modifieddate: z.number().optional()
}).passthrough();
// Schema for URL params with ID
export const samplePurchaseOrderParamsSchema = z.object({
    id: z.string()
});
// Schema for query parameters
export const samplePurchaseOrderQuerySchema = z.object({
    // Pagination
    page: z.string().optional(),
    limit: z.string().optional(),
    // Filter fields
    id: z.string().optional(),
    companyname: z.string().optional(),
    contactname: z.string().optional(),
    phonenumber: z.string().optional(),
    companymail: z.string().optional(),
    gstnumber: z.string().optional(),
    companyaddress: z.string().optional(),
    supplierid: z.string().optional(),
    createdby: z.string().optional(),
    modifiedby: z.string().optional(),
    createddate: z.string().optional(),
    modifieddate: z.string().optional()
});
//# sourceMappingURL=samplepurchaseorder.schema.js.map