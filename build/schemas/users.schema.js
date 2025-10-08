import { z } from 'zod';
// Create users schema based on actual database table
export const createUsersSchema = z.object({
    useremail: z.string().email().max(255).optional(),
    userpassword: z.string().max(255).optional(),
    usermobilenumber: z.coerce.number().optional(),
    fcmid: z.string().max(500).optional(),
    firstname: z.string().max(500).optional(),
    lastname: z.string().max(500).optional(),
    gender: z.string().max(50).optional(),
    gstnumber: z.string().max(20).optional(),
    isbusinessuser: z.boolean().optional(),
    isguest: z.boolean().optional(),
    createddate: z.coerce.number().optional(),
    modifieddate: z.coerce.number().optional(),
}).passthrough(); // Allow any additional fields
// Guest user schema with minimal required fields
export const createGuestUserSchema = z.object({
    firstname: z.string().max(500).min(1, 'Name is required'),
    // Allow empty string, null, undefined, or valid email - converts empty/falsy to undefined
    useremail: z.string().max(255).optional().transform(val => {
        // Convert empty strings, null, undefined to undefined
        if (!val || val.trim() === '')
            return undefined;
        return val;
    }).pipe(z.string().email().optional()),
    usermobilenumber: z.coerce.number().positive('Phone number is required'),
    isguest: z.boolean().default(true),
    createddate: z.coerce.number().optional(),
    modifieddate: z.coerce.number().optional(),
}).passthrough();
export const updateUsersSchema = z.object({
    useremail: z.string().email().max(255).optional(),
    userpassword: z.string().max(255).optional(),
    usermobilenumber: z.coerce.number().optional(),
    fcmid: z.string().max(500).optional(),
    firstname: z.string().max(500).optional(),
    lastname: z.string().max(500).optional(),
    gender: z.string().max(50).optional(),
    gstnumber: z.string().max(20).optional(),
    isbusinessuser: z.boolean().optional(),
    isguest: z.boolean().optional(),
    createddate: z.coerce.number().optional(),
    modifieddate: z.coerce.number().optional(),
}).passthrough();
export const upsertUsersSchema = z.object({
    id: z.number().int().positive().optional(),
    useremail: z.string().email().max(255).optional(),
    userpassword: z.string().max(255).optional(),
    usermobilenumber: z.coerce.number().optional(),
    fcmid: z.string().max(500).optional(),
    firstname: z.string().max(500).optional(),
    lastname: z.string().max(500).optional(),
    gender: z.string().max(50).optional(),
    gstnumber: z.string().max(20).optional(),
    isbusinessuser: z.boolean().optional(),
    isguest: z.boolean().optional(),
    createddate: z.coerce.number().optional(),
    modifieddate: z.coerce.number().optional(),
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
    isguest: z.string().optional(),
    usermobilenumber: z.string().optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
});
//# sourceMappingURL=users.schema.js.map