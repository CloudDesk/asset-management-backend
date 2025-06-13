import { z } from 'zod';
import { dynamicFieldConfigs } from '../config/dynamicFieldConfig.js';
// Flexible product schema that works with any database structure
export const createProductSchema = z.object({
    // Core fields that might exist
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    category: z.string().max(100).optional(),
    price: z.number().positive().optional(),
    status: z.string().optional(),
    // Common alternative field names
    product_name: z.string().min(1).max(255).optional(),
    product_description: z.string().optional(),
    product_category: z.string().max(100).optional(),
    product_price: z.number().positive().optional(),
    product_status: z.string().optional(),
}).passthrough(); // Allow any additional fields
export const updateProductSchema = z.object({
    // All fields optional for updates
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    category: z.string().max(100).optional(),
    price: z.number().positive().optional(),
    status: z.string().optional(),
    // Common alternative field names
    product_name: z.string().min(1).max(255).optional(),
    product_description: z.string().optional(),
    product_category: z.string().max(100).optional(),
    product_price: z.number().positive().optional(),
    product_status: z.string().optional(),
}).passthrough();
export const upsertProductSchema = z.object({
    id: z.string().uuid().optional(),
    // Core fields
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    category: z.string().max(100).optional(),
    price: z.number().positive().optional(),
    status: z.string().optional(),
    // Common alternative field names
    product_name: z.string().min(1).max(255).optional(),
    product_description: z.string().optional(),
    product_category: z.string().max(100).optional(),
    product_price: z.number().positive().optional(),
    product_status: z.string().optional(),
}).passthrough();
export const productParamsSchema = z.object({
    id: z.string().regex(/^\d+$/, 'Invalid product ID - must be a numeric string'),
});
export const productQuerySchema = z.object({
    // Pagination
    page: z.string().optional(),
    limit: z.string().optional(),
    // Filter fields - support both naming conventions
    name: z.string().optional(),
    category: z.string().optional(),
    status: z.string().optional(),
    description: z.string().optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
    minStock: z.string().optional(),
    maxStock: z.string().optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
    // Alternative field names
    product_name: z.string().optional(),
    product_category: z.string().optional(),
    product_status: z.string().optional(),
    product_description: z.string().optional(),
    min_price: z.string().optional(),
    max_price: z.string().optional(),
    min_stock: z.string().optional(),
    max_stock: z.string().optional(),
    created_after: z.string().optional(),
    created_before: z.string().optional(),
});
// Dynamic field validation - now more permissive
export function validateProductDynamicFields(data) {
    const config = dynamicFieldConfigs.product;
    const dynamicFields = {};
    for (const [key, value] of Object.entries(data)) {
        // Accept any field, but apply type conversion for known fields
        if (config && config.allowedFields.includes(key)) {
            const fieldType = config.fieldTypes[key];
            try {
                switch (fieldType) {
                    case 'string':
                        dynamicFields[key] = String(value);
                        break;
                    case 'number':
                        dynamicFields[key] = Number(value);
                        break;
                    case 'boolean':
                        dynamicFields[key] = Boolean(value);
                        break;
                    case 'date':
                        dynamicFields[key] = new Date(value);
                        break;
                    default:
                        dynamicFields[key] = value;
                }
            }
            catch (error) {
                // If type conversion fails, store as-is
                dynamicFields[key] = value;
            }
        }
        else {
            // For unknown fields, store as-is
            dynamicFields[key] = value;
        }
    }
    return dynamicFields;
}
//# sourceMappingURL=product.schema.js.map