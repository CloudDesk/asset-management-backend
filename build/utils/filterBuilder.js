/**
 * Builds flexible product filters that work with any column naming convention
 */
export function buildProductFilters(filters) {
    const conditions = [];
    // Basic string filters - try both camelCase and snake_case
    if (filters.name) {
        conditions.push({
            OR: [
                { name: { contains: filters.name, mode: 'insensitive' } },
            ]
        });
    }
    if (filters.category) {
        conditions.push({
            OR: [
                { category: { contains: filters.category, mode: 'insensitive' } },
            ]
        });
    }
    if (filters.status) {
        conditions.push({
            OR: [
                { status: filters.status },
            ]
        });
    }
    if (filters.description) {
        conditions.push({
            OR: [
                { description: { contains: filters.description, mode: 'insensitive' } },
            ]
        });
    }
    // Price range filters
    if (filters.minPrice || filters.maxPrice) {
        const priceFilter = {};
        if (filters.minPrice) {
            priceFilter.gte = parseFloat(filters.minPrice);
        }
        if (filters.maxPrice) {
            priceFilter.lte = parseFloat(filters.maxPrice);
        }
        conditions.push({
            OR: [
                { price: priceFilter },
            ]
        });
    }
    // Stock quantity filters - try multiple field names
    if (filters.minStock || filters.maxStock) {
        const stockFilter = {};
        if (filters.minStock) {
            stockFilter.gte = parseInt(filters.minStock, 10);
        }
        if (filters.maxStock) {
            stockFilter.lte = parseInt(filters.maxStock, 10);
        }
        conditions.push({
            OR: [
                { totalStockQuantity: stockFilter },
                { total_stock_quantity: stockFilter },
                { stockQuantity: stockFilter },
                { stock_quantity: stockFilter }
            ]
        });
    }
    // Date range filters - try multiple field names
    if (filters.createdAfter || filters.createdBefore) {
        const dateFilter = {};
        if (filters.createdAfter) {
            dateFilter.gte = new Date(filters.createdAfter);
        }
        if (filters.createdBefore) {
            dateFilter.lte = new Date(filters.createdBefore);
        }
        conditions.push({
            OR: [
                { createdAt: dateFilter },
                { created_at: dateFilter }
            ]
        });
    }
    // If no filters, return empty object (select all)
    if (conditions.length === 0) {
        return {};
    }
    // If only one condition, return it directly
    if (conditions.length === 1) {
        return conditions[0];
    }
    // Multiple conditions - combine with AND
    return { AND: conditions };
}
/**
 * Builds flexible stock filters that work with any column naming convention
 */
export function buildStockFilters(filters) {
    const conditions = [];
    // Product ID filter - try multiple field names
    if (filters.productId) {
        conditions.push({
            OR: [
                { productId: filters.productId },
                { product_id: filters.productId }
            ]
        });
    }
    // Batch number filter
    if (filters.batchNumber) {
        conditions.push({
            OR: [
                { batchNumber: { contains: filters.batchNumber, mode: 'insensitive' } },
                { batch_number: { contains: filters.batchNumber, mode: 'insensitive' } }
            ]
        });
    }
    // Warehouse location filter
    if (filters.warehouseLocation) {
        conditions.push({
            OR: [
                { warehouseLocation: { contains: filters.warehouseLocation, mode: 'insensitive' } },
                { warehouse_location: { contains: filters.warehouseLocation, mode: 'insensitive' } }
            ]
        });
    }
    // Quantity filters
    if (filters.minQuantity || filters.maxQuantity) {
        const quantityFilter = {};
        if (filters.minQuantity) {
            quantityFilter.gte = parseInt(filters.minQuantity, 10);
        }
        if (filters.maxQuantity) {
            quantityFilter.lte = parseInt(filters.maxQuantity, 10);
        }
        conditions.push({
            OR: [
                { quantity: quantityFilter },
            ]
        });
    }
    // Available quantity filters
    if (filters.minAvailable || filters.maxAvailable) {
        const availableFilter = {};
        if (filters.minAvailable) {
            availableFilter.gte = parseInt(filters.minAvailable, 10);
        }
        if (filters.maxAvailable) {
            availableFilter.lte = parseInt(filters.maxAvailable, 10);
        }
        conditions.push({
            OR: [
                { availableQuantity: availableFilter },
                { available_quantity: availableFilter }
            ]
        });
    }
    // Date range filters
    if (filters.createdAfter || filters.createdBefore) {
        const dateFilter = {};
        if (filters.createdAfter) {
            dateFilter.gte = new Date(filters.createdAfter);
        }
        if (filters.createdBefore) {
            dateFilter.lte = new Date(filters.createdBefore);
        }
        conditions.push({
            OR: [
                { createdAt: dateFilter },
                { created_at: dateFilter }
            ]
        });
    }
    // If no filters, return empty object (select all)
    if (conditions.length === 0) {
        return {};
    }
    // If only one condition, return it directly
    if (conditions.length === 1) {
        return conditions[0];
    }
    // Multiple conditions - combine with AND
    return { AND: conditions };
}
/**
 * Builds flexible picklist filters that work with any column naming convention
 */
export function buildPicklistFilters(filters) {
    const conditions = [];
    if (filters.type) {
        conditions.push({
            OR: [
                { type: filters.type },
            ]
        });
    }
    if (filters.table) {
        conditions.push({
            OR: [
                { table: filters.table },
            ]
        });
    }
    if (filters.field) {
        conditions.push({
            OR: [
                { field: filters.field },
            ]
        });
    }
    if (filters.label) {
        conditions.push({
            OR: [
                { label: { contains: filters.label, mode: 'insensitive' } },
            ]
        });
    }
    if (filters.value) {
        conditions.push({
            OR: [
                { value: { contains: filters.value, mode: 'insensitive' } },
            ]
        });
    }
    if (filters.isActive !== undefined) {
        const isActiveValue = filters.isActive === 'true';
        conditions.push({
            OR: [
                { isActive: isActiveValue },
                { is_active: isActiveValue }
            ]
        });
    }
    // If no filters, return empty object (select all)
    if (conditions.length === 0) {
        return {};
    }
    // If only one condition, return it directly
    if (conditions.length === 1) {
        return conditions[0];
    }
    // Multiple conditions - combine with AND
    return { AND: conditions };
}
/**
 * Builds flexible supplier filters that work with any column naming convention
 */
export function buildSupplierFilters(filters) {
    const conditions = [];
    // Basic string filters - try both camelCase and snake_case
    if (filters.name) {
        conditions.push({
            OR: [
                { name: { contains: filters.name, mode: 'insensitive' } },
                { supplier_name: { contains: filters.name, mode: 'insensitive' } }
            ]
        });
    }
    if (filters.contactPerson) {
        conditions.push({
            OR: [
                { contactPerson: { contains: filters.contactPerson, mode: 'insensitive' } },
                { contact_person: { contains: filters.contactPerson, mode: 'insensitive' } }
            ]
        });
    }
    if (filters.email) {
        conditions.push({
            OR: [
                { email: { contains: filters.email, mode: 'insensitive' } },
                { supplier_email: { contains: filters.email, mode: 'insensitive' } }
            ]
        });
    }
    if (filters.phone) {
        conditions.push({
            OR: [
                { phone: { contains: filters.phone, mode: 'insensitive' } },
                { supplier_phone: { contains: filters.phone, mode: 'insensitive' } }
            ]
        });
    }
    if (filters.city) {
        conditions.push({
            OR: [
                { city: { contains: filters.city, mode: 'insensitive' } },
                { supplier_city: { contains: filters.city, mode: 'insensitive' } }
            ]
        });
    }
    if (filters.country) {
        conditions.push({
            OR: [
                { country: { contains: filters.country, mode: 'insensitive' } },
                { supplier_country: { contains: filters.country, mode: 'insensitive' } }
            ]
        });
    }
    if (filters.status) {
        conditions.push({
            OR: [
                { status: filters.status },
                { supplier_status: filters.status }
            ]
        });
    }
    // Date range filters
    if (filters.createdAfter || filters.createdBefore) {
        const dateFilter = {};
        if (filters.createdAfter) {
            dateFilter.gte = new Date(filters.createdAfter);
        }
        if (filters.createdBefore) {
            dateFilter.lte = new Date(filters.createdBefore);
        }
        conditions.push({
            OR: [
                { createdAt: dateFilter },
                { created_at: dateFilter }
            ]
        });
    }
    // If no filters, return empty object (select all)
    if (conditions.length === 0) {
        return {};
    }
    // If only one condition, return it directly
    if (conditions.length === 1) {
        return conditions[0];
    }
    // Multiple conditions - combine with AND
    return { AND: conditions };
}
/**
 * Builds flexible purchase order filters that work with any column naming convention
 */
export function buildPurchaseOrderFilters(filters) {
    const conditions = [];
    // Order number filter
    if (filters.orderNumber) {
        conditions.push({
            OR: [
                { orderNumber: { contains: filters.orderNumber, mode: 'insensitive' } },
                { order_number: { contains: filters.orderNumber, mode: 'insensitive' } }
            ]
        });
    }
    // Supplier ID filter
    if (filters.supplierId) {
        conditions.push({
            OR: [
                { supplierId: filters.supplierId },
                { supplier_id: filters.supplierId }
            ]
        });
    }
    // Status filter
    if (filters.status) {
        conditions.push({
            OR: [
                { status: filters.status },
                { purchase_status: filters.status }
            ]
        });
    }
    // Amount range filters
    if (filters.minAmount || filters.maxAmount) {
        const amountFilter = {};
        if (filters.minAmount) {
            amountFilter.gte = parseFloat(filters.minAmount);
        }
        if (filters.maxAmount) {
            amountFilter.lte = parseFloat(filters.maxAmount);
        }
        conditions.push({
            OR: [
                { totalAmount: amountFilter },
                { total_amount: amountFilter }
            ]
        });
    }
    // Order date range filters
    if (filters.orderDateAfter || filters.orderDateBefore) {
        const dateFilter = {};
        if (filters.orderDateAfter) {
            dateFilter.gte = new Date(filters.orderDateAfter);
        }
        if (filters.orderDateBefore) {
            dateFilter.lte = new Date(filters.orderDateBefore);
        }
        conditions.push({
            OR: [
                { orderDate: dateFilter },
                { order_date: dateFilter }
            ]
        });
    }
    // Expected delivery date range filters
    if (filters.expectedDeliveryAfter || filters.expectedDeliveryBefore) {
        const dateFilter = {};
        if (filters.expectedDeliveryAfter) {
            dateFilter.gte = new Date(filters.expectedDeliveryAfter);
        }
        if (filters.expectedDeliveryBefore) {
            dateFilter.lte = new Date(filters.expectedDeliveryBefore);
        }
        conditions.push({
            OR: [
                { expectedDeliveryDate: dateFilter },
                { expected_delivery_date: dateFilter }
            ]
        });
    }
    // Created date range filters
    if (filters.createdAfter || filters.createdBefore) {
        const dateFilter = {};
        if (filters.createdAfter) {
            dateFilter.gte = new Date(filters.createdAfter);
        }
        if (filters.createdBefore) {
            dateFilter.lte = new Date(filters.createdBefore);
        }
        conditions.push({
            OR: [
                { createdAt: dateFilter },
                { created_at: dateFilter }
            ]
        });
    }
    // If no filters, return empty object (select all)
    if (conditions.length === 0) {
        return {};
    }
    // If only one condition, return it directly
    if (conditions.length === 1) {
        return conditions[0];
    }
    // Multiple conditions - combine with AND
    return { AND: conditions };
}
/**
 * Builds flexible purchase request filters that work with any column naming convention
 */
export function buildPurchaseRequestFilters(filters) {
    const conditions = [];
    // Request number filter
    if (filters.requestNumber) {
        conditions.push({
            OR: [
                { requestNumber: { contains: filters.requestNumber, mode: 'insensitive' } },
                { request_number: { contains: filters.requestNumber, mode: 'insensitive' } }
            ]
        });
    }
    // Supplier ID filter
    if (filters.supplierId) {
        conditions.push({
            OR: [
                { supplierId: filters.supplierId },
                { supplier_id: filters.supplierId }
            ]
        });
    }
    // Status filter
    if (filters.status) {
        conditions.push({
            OR: [
                { status: filters.status },
                { request_status: filters.status }
            ]
        });
    }
    // Priority filter
    if (filters.priority) {
        conditions.push({
            OR: [
                { priority: filters.priority },
                { request_priority: filters.priority }
            ]
        });
    }
    // Requested by filter
    if (filters.requestedBy) {
        conditions.push({
            OR: [
                { requestedBy: { contains: filters.requestedBy, mode: 'insensitive' } },
                { requested_by: { contains: filters.requestedBy, mode: 'insensitive' } }
            ]
        });
    }
    // Approved by filter
    if (filters.approvedBy) {
        conditions.push({
            OR: [
                { approvedBy: { contains: filters.approvedBy, mode: 'insensitive' } },
                { approved_by: { contains: filters.approvedBy, mode: 'insensitive' } }
            ]
        });
    }
    // Amount range filters
    if (filters.minAmount || filters.maxAmount) {
        const amountFilter = {};
        if (filters.minAmount) {
            amountFilter.gte = parseFloat(filters.minAmount);
        }
        if (filters.maxAmount) {
            amountFilter.lte = parseFloat(filters.maxAmount);
        }
        conditions.push({
            OR: [
                { totalEstimatedAmount: amountFilter },
                { total_estimated_amount: amountFilter }
            ]
        });
    }
    // Request date range filters
    if (filters.requestDateAfter || filters.requestDateBefore) {
        const dateFilter = {};
        if (filters.requestDateAfter) {
            dateFilter.gte = new Date(filters.requestDateAfter);
        }
        if (filters.requestDateBefore) {
            dateFilter.lte = new Date(filters.requestDateBefore);
        }
        conditions.push({
            OR: [
                { requestDate: dateFilter },
                { request_date: dateFilter }
            ]
        });
    }
    // Required date range filters
    if (filters.requiredDateAfter || filters.requiredDateBefore) {
        const dateFilter = {};
        if (filters.requiredDateAfter) {
            dateFilter.gte = new Date(filters.requiredDateAfter);
        }
        if (filters.requiredDateBefore) {
            dateFilter.lte = new Date(filters.requiredDateBefore);
        }
        conditions.push({
            OR: [
                { requiredDate: dateFilter },
                { required_date: dateFilter }
            ]
        });
    }
    // Created date range filters
    if (filters.createdAfter || filters.createdBefore) {
        const dateFilter = {};
        if (filters.createdAfter) {
            dateFilter.gte = new Date(filters.createdAfter);
        }
        if (filters.createdBefore) {
            dateFilter.lte = new Date(filters.createdBefore);
        }
        conditions.push({
            OR: [
                { createdAt: dateFilter },
                { created_at: dateFilter }
            ]
        });
    }
    // If no filters, return empty object (select all)
    if (conditions.length === 0) {
        return {};
    }
    // If only one condition, return it directly
    if (conditions.length === 1) {
        return conditions[0];
    }
    // Multiple conditions - combine with AND
    return { AND: conditions };
}
//# sourceMappingURL=filterBuilder.js.map