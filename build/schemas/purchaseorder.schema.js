import { z } from 'zod';
import { dynamicFieldConfigs } from '../config/dynamicFieldConfig.js';
// Flexible purchase order schema that works with any database structure
export const createPurchaseOrderSchema = z.object({
    // Core fields that might exist
    orderNumber: z.string().min(1).max(100).optional(),
    supplierId: z.string().uuid().optional(),
    orderDate: z.string().datetime().optional(),
    expectedDeliveryDate: z.string().datetime().optional(),
    actualDeliveryDate: z.string().datetime().optional(),
    status: z.string().optional(),
    totalAmount: z.number().positive().optional(),
    notes: z.string().optional(),
    // Common alternative field names (snake_case)
    order_number: z.string().min(1).max(100).optional(),
    supplier_id: z.string().uuid().optional(),
    order_date: z.string().datetime().optional(),
    expected_delivery_date: z.string().datetime().optional(),
    actual_delivery_date: z.string().datetime().optional(),
    purchase_status: z.string().optional(),
    total_amount: z.number().positive().optional(),
    order_notes: z.string().optional(),
}).passthrough(); // Allow any additional fields
export const updatePurchaseOrderSchema = z.object({
    // All fields optional for updates
    orderNumber: z.string().min(1).max(100).optional(),
    supplierId: z.string().uuid().optional(),
    orderDate: z.string().datetime().optional(),
    expectedDeliveryDate: z.string().datetime().optional(),
    actualDeliveryDate: z.string().datetime().optional(),
    status: z.string().optional(),
    totalAmount: z.number().positive().optional(),
    notes: z.string().optional(),
    // Common alternative field names
    order_number: z.string().min(1).max(100).optional(),
    supplier_id: z.string().uuid().optional(),
    order_date: z.string().datetime().optional(),
    expected_delivery_date: z.string().datetime().optional(),
    actual_delivery_date: z.string().datetime().optional(),
    purchase_status: z.string().optional(),
    total_amount: z.number().positive().optional(),
    order_notes: z.string().optional(),
}).passthrough();
export const upsertPurchaseOrderSchema = z.object({
    id: z.string().uuid().optional(),
    // Core fields
    orderNumber: z.string().min(1).max(100).optional(),
    supplierId: z.string().uuid().optional(),
    orderDate: z.string().datetime().optional(),
    expectedDeliveryDate: z.string().datetime().optional(),
    actualDeliveryDate: z.string().datetime().optional(),
    status: z.string().optional(),
    totalAmount: z.number().positive().optional(),
    notes: z.string().optional(),
    // Common alternative field names
    order_number: z.string().min(1).max(100).optional(),
    supplier_id: z.string().uuid().optional(),
    order_date: z.string().datetime().optional(),
    expected_delivery_date: z.string().datetime().optional(),
    actual_delivery_date: z.string().datetime().optional(),
    purchase_status: z.string().optional(),
    total_amount: z.number().positive().optional(),
    order_notes: z.string().optional(),
}).passthrough();
export const purchaseOrderParamsSchema = z.object({
    id: z.string().uuid('Invalid purchase order ID'),
});
export const purchaseOrderQuerySchema = z.object({
    // Pagination
    page: z.string().optional(),
    limit: z.string().optional(),
    // Filter fields - support both naming conventions
    orderNumber: z.string().optional(),
    supplierId: z.string().optional(),
    status: z.string().optional(),
    minAmount: z.string().optional(),
    maxAmount: z.string().optional(),
    orderDateAfter: z.string().optional(),
    orderDateBefore: z.string().optional(),
    expectedDeliveryAfter: z.string().optional(),
    expectedDeliveryBefore: z.string().optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
    // Alternative field names (snake_case)
    order_number: z.string().optional(),
    supplier_id: z.string().optional(),
    purchase_status: z.string().optional(),
    min_amount: z.string().optional(),
    max_amount: z.string().optional(),
    order_date_after: z.string().optional(),
    order_date_before: z.string().optional(),
    expected_delivery_after: z.string().optional(),
    expected_delivery_before: z.string().optional(),
    created_after: z.string().optional(),
    created_before: z.string().optional(),
});
// Dynamic field validation - permissive approach
export function validatePurchaseOrderDynamicFields(data) {
    const config = dynamicFieldConfigs.purchaseOrder;
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
//# sourceMappingURL=purchaseorder.schema.js.map