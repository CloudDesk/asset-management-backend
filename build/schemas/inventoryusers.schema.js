import { z } from 'zod';
// Create inventoryusers schema based on actual database table
export const createInventoryUsersSchema = z.object({
    useremail: z.string().email().max(255).optional(),
    userpassword: z.string().max(255).optional(),
    role: z.string().max(500).optional(),
    usersphonenumber: z.coerce.number().optional(),
    firstname: z.string().max(255).optional(),
    lastname: z.string().max(255).optional(),
    location: z.string().max(500).optional(),
    fcmid: z.string().max(400).optional(),
    createddate: z.coerce.number().optional(),
    modifieddate: z.coerce.number().optional(),
}).passthrough(); // Allow any additional fields
export const updateInventoryUsersSchema = z.object({
    useremail: z.string().email().max(255).optional(),
    userpassword: z.string().max(255).optional(),
    role: z.string().max(500).optional(),
    usersphonenumber: z.coerce.number().optional(),
    firstname: z.string().max(255).optional(),
    lastname: z.string().max(255).optional(),
    location: z.string().max(500).optional(),
    fcmid: z.string().max(400).optional(),
    createddate: z.coerce.number().optional(),
    modifieddate: z.coerce.number().optional(),
}).passthrough();
export const upsertInventoryUsersSchema = z.object({
    id: z.number().int().positive().optional(),
    useremail: z.string().email().max(255).optional(),
    userpassword: z.string().max(255).optional(),
    role: z.string().max(500).optional(),
    usersphonenumber: z.coerce.number().optional(),
    firstname: z.string().max(255).optional(),
    lastname: z.string().max(255).optional(),
    location: z.string().max(500).optional(),
    fcmid: z.string().max(400).optional(),
    createddate: z.coerce.number().optional(),
    modifieddate: z.coerce.number().optional(),
}).passthrough();
export const inventoryUsersParamsSchema = z.object({
    id: z.string().refine((val) => /^\d+$/.test(val), 'Invalid inventory user ID'),
});
export const inventoryUsersQuerySchema = z.object({
    // Pagination
    page: z.string().optional(),
    limit: z.string().optional(),
    // Filter fields based on actual table columns
    useremail: z.string().optional(),
    role: z.string().optional(),
    firstname: z.string().optional(),
    lastname: z.string().optional(),
    location: z.string().optional(),
    usersphonenumber: z.string().optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
});
//# sourceMappingURL=inventoryusers.schema.js.map