import { Prisma } from '@prisma/client';

export interface FilterOptions {
  [key: string]: string | string[] | undefined;
}

/**
 * Builds flexible product filters that work with any column naming convention
 */
export function buildProductFilters(filters: FilterOptions): any {
  const conditions: any[] = [];

  // Basic string filters - try both camelCase and snake_case
  if (filters.name) {
    conditions.push({
      OR: [
        { name: { contains: filters.name as string, mode: 'insensitive' } },
      ]
    });
  }

  if (filters.category) {
    conditions.push({
      OR: [
        { category: { contains: filters.category as string, mode: 'insensitive' } },
      ]
    });
  }

  if (filters.status) {
    conditions.push({
      OR: [
        { status: filters.status as string },
      ]
    });
  }

  if (filters.description) {
    conditions.push({
      OR: [
        { description: { contains: filters.description as string, mode: 'insensitive' } },
      ]
    });
  }

  // Price range filters
  if (filters.minPrice || filters.maxPrice) {
    const priceFilter: any = {};
    if (filters.minPrice) {
      priceFilter.gte = parseFloat(filters.minPrice as string);
    }
    if (filters.maxPrice) {
      priceFilter.lte = parseFloat(filters.maxPrice as string);
    }
    conditions.push({
      OR: [
        { price: priceFilter },
      ]
    });
  }

  // Stock quantity filters - try multiple field names
  if (filters.minStock || filters.maxStock) {
    const stockFilter: any = {};
    if (filters.minStock) {
      stockFilter.gte = parseInt(filters.minStock as string, 10);
    }
    if (filters.maxStock) {
      stockFilter.lte = parseInt(filters.maxStock as string, 10);
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
    const dateFilter: any = {};
    if (filters.createdAfter) {
      dateFilter.gte = new Date(filters.createdAfter as string);
    }
    if (filters.createdBefore) {
      dateFilter.lte = new Date(filters.createdBefore as string);
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
export function buildStockFilters(filters: FilterOptions): any {
  const conditions: any[] = [];

  // Product ID filter - try multiple field names
  if (filters.productId) {
    conditions.push({
      OR: [
        { productId: filters.productId as string },
        { product_id: filters.productId as string }
      ]
    });
  }

  // Batch number filter
  if (filters.batchNumber) {
    conditions.push({
      OR: [
        { batchNumber: { contains: filters.batchNumber as string, mode: 'insensitive' } },
        { batch_number: { contains: filters.batchNumber as string, mode: 'insensitive' } }
      ]
    });
  }

  // Warehouse location filter
  if (filters.warehouseLocation) {
    conditions.push({
      OR: [
        { warehouseLocation: { contains: filters.warehouseLocation as string, mode: 'insensitive' } },
        { warehouse_location: { contains: filters.warehouseLocation as string, mode: 'insensitive' } }
      ]
    });
  }

  // Quantity filters
  if (filters.minQuantity || filters.maxQuantity) {
    const quantityFilter: any = {};
    if (filters.minQuantity) {
      quantityFilter.gte = parseInt(filters.minQuantity as string, 10);
    }
    if (filters.maxQuantity) {
      quantityFilter.lte = parseInt(filters.maxQuantity as string, 10);
    }
    conditions.push({
      OR: [
        { quantity: quantityFilter },
      ]
    });
  }

  // Available quantity filters
  if (filters.minAvailable || filters.maxAvailable) {
    const availableFilter: any = {};
    if (filters.minAvailable) {
      availableFilter.gte = parseInt(filters.minAvailable as string, 10);
    }
    if (filters.maxAvailable) {
      availableFilter.lte = parseInt(filters.maxAvailable as string, 10);
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
    const dateFilter: any = {};
    if (filters.createdAfter) {
      dateFilter.gte = new Date(filters.createdAfter as string);
    }
    if (filters.createdBefore) {
      dateFilter.lte = new Date(filters.createdBefore as string);
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
export function buildPicklistFilters(filters: FilterOptions): any {
  const conditions: any[] = [];

  if (filters.type) {
    conditions.push({
      OR: [
        { type: filters.type as string },
      ]
    });
  }

  if (filters.table) {
    conditions.push({
      OR: [
        { table: filters.table as string },
      ]
    });
  }

  if (filters.field) {
    conditions.push({
      OR: [
        { field: filters.field as string },
      ]
    });
  }

  if (filters.label) {
    conditions.push({
      OR: [
        { label: { contains: filters.label as string, mode: 'insensitive' } },
      ]
    });
  }

  if (filters.value) {
    conditions.push({
      OR: [
        { value: { contains: filters.value as string, mode: 'insensitive' } },
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
export function buildSupplierFilters(filters: FilterOptions): any {
  const conditions: any[] = [];

  // Basic string filters - try both camelCase and snake_case
  if (filters.name) {
    conditions.push({
      OR: [
        { name: { contains: filters.name as string, mode: 'insensitive' } },
        { supplier_name: { contains: filters.name as string, mode: 'insensitive' } }
      ]
    });
  }

  if (filters.contactPerson) {
    conditions.push({
      OR: [
        { contactPerson: { contains: filters.contactPerson as string, mode: 'insensitive' } },
        { contact_person: { contains: filters.contactPerson as string, mode: 'insensitive' } }
      ]
    });
  }

  if (filters.email) {
    conditions.push({
      OR: [
        { email: { contains: filters.email as string, mode: 'insensitive' } },
        { supplier_email: { contains: filters.email as string, mode: 'insensitive' } }
      ]
    });
  }

  if (filters.phone) {
    conditions.push({
      OR: [
        { phone: { contains: filters.phone as string, mode: 'insensitive' } },
        { supplier_phone: { contains: filters.phone as string, mode: 'insensitive' } }
      ]
    });
  }

  if (filters.city) {
    conditions.push({
      OR: [
        { city: { contains: filters.city as string, mode: 'insensitive' } },
        { supplier_city: { contains: filters.city as string, mode: 'insensitive' } }
      ]
    });
  }

  if (filters.country) {
    conditions.push({
      OR: [
        { country: { contains: filters.country as string, mode: 'insensitive' } },
        { supplier_country: { contains: filters.country as string, mode: 'insensitive' } }
      ]
    });
  }

  if (filters.status) {
    conditions.push({
      OR: [
        { status: filters.status as string },
        { supplier_status: filters.status as string }
      ]
    });
  }

  // Date range filters
  if (filters.createdAfter || filters.createdBefore) {
    const dateFilter: any = {};
    if (filters.createdAfter) {
      dateFilter.gte = new Date(filters.createdAfter as string);
    }
    if (filters.createdBefore) {
      dateFilter.lte = new Date(filters.createdBefore as string);
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
export function buildPurchaseOrderFilters(filters: FilterOptions): any {
  const conditions: any[] = [];

  // Order number filter
  if (filters.orderNumber) {
    conditions.push({
      OR: [
        { orderNumber: { contains: filters.orderNumber as string, mode: 'insensitive' } },
        { order_number: { contains: filters.orderNumber as string, mode: 'insensitive' } }
      ]
    });
  }

  // Supplier ID filter
  if (filters.supplierId) {
    conditions.push({
      OR: [
        { supplierId: filters.supplierId as string },
        { supplier_id: filters.supplierId as string }
      ]
    });
  }

  // Status filter
  if (filters.status) {
    conditions.push({
      OR: [
        { status: filters.status as string },
        { purchase_status: filters.status as string }
      ]
    });
  }

  // Amount range filters
  if (filters.minAmount || filters.maxAmount) {
    const amountFilter: any = {};
    if (filters.minAmount) {
      amountFilter.gte = parseFloat(filters.minAmount as string);
    }
    if (filters.maxAmount) {
      amountFilter.lte = parseFloat(filters.maxAmount as string);
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
    const dateFilter: any = {};
    if (filters.orderDateAfter) {
      dateFilter.gte = new Date(filters.orderDateAfter as string);
    }
    if (filters.orderDateBefore) {
      dateFilter.lte = new Date(filters.orderDateBefore as string);
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
    const dateFilter: any = {};
    if (filters.expectedDeliveryAfter) {
      dateFilter.gte = new Date(filters.expectedDeliveryAfter as string);
    }
    if (filters.expectedDeliveryBefore) {
      dateFilter.lte = new Date(filters.expectedDeliveryBefore as string);
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
    const dateFilter: any = {};
    if (filters.createdAfter) {
      dateFilter.gte = new Date(filters.createdAfter as string);
    }
    if (filters.createdBefore) {
      dateFilter.lte = new Date(filters.createdBefore as string);
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
export function buildPurchaseRequestFilters(filters: FilterOptions): any {
  const conditions: any[] = [];

  // Request number filter
  if (filters.requestNumber) {
    conditions.push({
      OR: [
        { requestNumber: { contains: filters.requestNumber as string, mode: 'insensitive' } },
        { request_number: { contains: filters.requestNumber as string, mode: 'insensitive' } }
      ]
    });
  }

  // Supplier ID filter
  if (filters.supplierId) {
    conditions.push({
      OR: [
        { supplierId: filters.supplierId as string },
        { supplier_id: filters.supplierId as string }
      ]
    });
  }

  // Status filter
  if (filters.status) {
    conditions.push({
      OR: [
        { status: filters.status as string },
        { request_status: filters.status as string }
      ]
    });
  }

  // Priority filter
  if (filters.priority) {
    conditions.push({
      OR: [
        { priority: filters.priority as string },
        { request_priority: filters.priority as string }
      ]
    });
  }

  // Requested by filter
  if (filters.requestedBy) {
    conditions.push({
      OR: [
        { requestedBy: { contains: filters.requestedBy as string, mode: 'insensitive' } },
        { requested_by: { contains: filters.requestedBy as string, mode: 'insensitive' } }
      ]
    });
  }

  // Approved by filter
  if (filters.approvedBy) {
    conditions.push({
      OR: [
        { approvedBy: { contains: filters.approvedBy as string, mode: 'insensitive' } },
        { approved_by: { contains: filters.approvedBy as string, mode: 'insensitive' } }
      ]
    });
  }

  // Amount range filters
  if (filters.minAmount || filters.maxAmount) {
    const amountFilter: any = {};
    if (filters.minAmount) {
      amountFilter.gte = parseFloat(filters.minAmount as string);
    }
    if (filters.maxAmount) {
      amountFilter.lte = parseFloat(filters.maxAmount as string);
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
    const dateFilter: any = {};
    if (filters.requestDateAfter) {
      dateFilter.gte = new Date(filters.requestDateAfter as string);
    }
    if (filters.requestDateBefore) {
      dateFilter.lte = new Date(filters.requestDateBefore as string);
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
    const dateFilter: any = {};
    if (filters.requiredDateAfter) {
      dateFilter.gte = new Date(filters.requiredDateAfter as string);
    }
    if (filters.requiredDateBefore) {
      dateFilter.lte = new Date(filters.requiredDateBefore as string);
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
    const dateFilter: any = {};
    if (filters.createdAfter) {
      dateFilter.gte = new Date(filters.createdAfter as string);
    }
    if (filters.createdBefore) {
      dateFilter.lte = new Date(filters.createdBefore as string);
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