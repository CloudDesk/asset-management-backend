import { z } from 'zod';
// Create users schema based on actual database table
export const createUsersSchema = z.object({
    useremail: z.string().email().max(255).optional(),
    userpassword: z.string().max(255).optional(),
    usermobilenumber: z.bigint().optional(),
    fcmid: z.string().max(500).optional(),
    firstname: z.string().max(500).optional(),
    lastname: z.string().max(500).optional(),
    gender: z.string().max(50).optional(),
    gstnumber: z.string().max(20).optional(),
    isbusinessuser: z.boolean().optional(),
    createddate: z.bigint().optional(),
    modifieddate: z.bigint().optional(),
}).passthrough(); // Allow any additional fields
export const updateUsersSchema = z.object({
    useremail: z.string().email().max(255).optional(),
    userpassword: z.string().max(255).optional(),
    usermobilenumber: z.bigint().optional(),
    fcmid: z.string().max(500).optional(),
    firstname: z.string().max(500).optional(),
    lastname: z.string().max(500).optional(),
    gender: z.string().max(50).optional(),
    gstnumber: z.string().max(20).optional(),
    isbusinessuser: z.boolean().optional(),
    createddate: z.bigint().optional(),
    modifieddate: z.bigint().optional(),
}).passthrough();
export const upsertUsersSchema = z.object({
    id: z.number().int().positive().optional(),
    useremail: z.string().email().max(255).optional(),
    userpassword: z.string().max(255).optional(),
    usermobilenumber: z.bigint().optional(),
    fcmid: z.string().max(500).optional(),
    firstname: z.string().max(500).optional(),
    lastname: z.string().max(500).optional(),
    gender: z.string().max(50).optional(),
    gstnumber: z.string().max(20).optional(),
    isbusinessuser: z.boolean().optional(),
    createddate: z.bigint().optional(),
    modifieddate: z.bigint().optional(),
}).passthrough();
export const usersParamsSchema = z.object({
    id: z.string().refine((val) => /^\d+$/.test(val), 'Invalid user ID'),
});
export const usersQuerySchema = z.object({
    // Pagination
    page: z.string().optional(),
    limit: z.string().optional(),
    // Filter fields based on actual table columns
    useremail: z.string().optional(),
    firstname: z.string().optional(),
    lastname: z.string().optional(),
    gender: z.string().optional(),
    gstnumber: z.string().optional(),
    isbusinessuser: z.string().optional(),
    usermobilenumber: z.string().optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
});
//# sourceMappingURL=users.schema.js.map