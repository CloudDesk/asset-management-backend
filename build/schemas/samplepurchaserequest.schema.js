import { z } from 'zod';
// Reusable item schema for better performance (defined once, used multiple times)
const itemSchema = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1).max(255).trim(),
    quantity: z.number().int().positive().max(999999)
});
// Reusable base fields for consistency and performance
const baseFields = {
    companyname: z.string().min(1).max(255).trim(),
    contactname: z.string().min(1).max(255).trim(),
    phonenumber: z.number().int().positive().min(1000000000).max(9999999999), // 10-digit validation
    companymail: z.string().email().max(255).toLowerCase(),
    gstnumber: z.string().min(1).max(50).trim().toUpperCase(),
    companyaddress: z.string().min(1).max(1000).trim(),
    supplierid: z.number().int().positive(),
    items: z.array(itemSchema).min(1).max(100), // Limit items for performance
    createdby: z.string().min(1).max(255).trim(),
    modifiedby: z.string().min(1).max(255).trim(),
    createddate: z.number().int().positive().optional(),
    modifieddate: z.number().int().positive().optional()
};
// Validation schema for creating a sample purchase request
export const createSamplePurchaseRequestSchema = z.object({
    ...baseFields
}).strict(); // Use strict() instead of passthrough() for better validation
// Validation schema for updating a sample purchase request
export const updateSamplePurchaseRequestSchema = z.object({
    companyname: baseFields.companyname.optional(),
    contactname: baseFields.contactname.optional(),
    phonenumber: baseFields.phonenumber.optional(),
    companymail: baseFields.companymail.optional(),
    gstnumber: baseFields.gstnumber.optional(),
    companyaddress: baseFields.companyaddress.optional(),
    supplierid: baseFields.supplierid.optional(),
    items: baseFields.items.optional(),
    createdby: baseFields.createdby.optional(),
    modifiedby: baseFields.modifiedby.optional(),
    createddate: baseFields.createddate.optional(),
    modifieddate: baseFields.modifieddate.optional()
}).strict().refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided for update" });
// Schema for upserting (create or update)
export const upsertSamplePurchaseRequestSchema = z.object({
    id: z.string().min(1).optional(),
    companyname: baseFields.companyname.optional(),
    contactname: baseFields.contactname.optional(),
    phonenumber: baseFields.phonenumber.optional(),
    companymail: baseFields.companymail.optional(),
    gstnumber: baseFields.gstnumber.optional(),
    companyaddress: baseFields.companyaddress.optional(),
    supplierid: baseFields.supplierid.optional(),
    items: baseFields.items.optional(),
    createdby: baseFields.createdby.optional(),
    modifiedby: baseFields.modifiedby.optional(),
    createddate: baseFields.createddate.optional(),
    modifieddate: baseFields.modifieddate.optional()
}).strict();
// Schema for URL params with ID - optimized with better validation
export const samplePurchaseRequestParamsSchema = z.object({
    id: z.string().min(1).regex(/^\d+$/, "ID must be a valid number")
});
// Schema for query parameters - optimized with coercion and validation
export const samplePurchaseRequestQuerySchema = z.object({
    // Pagination with coercion and limits
    page: z.string().optional().transform((val) => val ? Math.max(1, parseInt(val) || 1) : 1),
    limit: z.string().optional().transform((val) => {
        const parsed = parseInt(val || '10');
        return Math.min(Math.max(1, parsed), 100); // Limit between 1-100 for performance
    }),
    // Filter fields with proper validation
    id: z.string().optional(),
    companyname: z.string().max(255).optional(),
    contactname: z.string().max(255).optional(),
    phonenumber: z.string().optional(),
    companymail: z.string().email().optional().or(z.string().length(0)),
    gstnumber: z.string().max(50).optional(),
    companyaddress: z.string().max(1000).optional(),
    supplierid: z.string().optional(),
    createdby: z.string().max(255).optional(),
    modifiedby: z.string().max(255).optional(),
    createddate: z.string().optional(),
    modifieddate: z.string().optional(),
    // Sorting and ordering for performance
    sortBy: z.enum(['id', 'companyname', 'contactname', 'createddate', 'modifieddate']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
}).strict();
//# sourceMappingURL=samplepurchaserequest.schema.js.map