export const dynamicFieldConfigs = {
    product: {
        table: 'product',
        allowedFields: [
            'brand', 'model', 'color', 'size', 'weight', 'dimensions',
            'material', 'warranty', 'tags', 'notes', 'customField1',
            'customField2', 'customField3', 'customField4', 'customField5'
        ],
        requiredFields: ['name', 'category'],
        fieldTypes: {
            brand: 'string',
            model: 'string',
            color: 'string',
            size: 'string',
            weight: 'number',
            dimensions: 'string',
            material: 'string',
            warranty: 'string',
            tags: 'string',
            notes: 'string',
            customField1: 'string',
            customField2: 'string',
            customField3: 'string',
            customField4: 'string',
            customField5: 'string'
        }
    },
    stock: {
        table: 'stock',
        allowedFields: [
            'supplier', 'purchasePrice', 'expiryDate', 'manufacturingDate',
            'qualityGrade', 'notes', 'customField1', 'customField2', 'customField3'
        ],
        requiredFields: ['batchNumber', 'warehouseLocation', 'quantity'],
        fieldTypes: {
            supplier: 'string',
            purchasePrice: 'number',
            expiryDate: 'date',
            manufacturingDate: 'date',
            qualityGrade: 'string',
            notes: 'string',
            customField1: 'string',
            customField2: 'string',
            customField3: 'string'
        }
    }
};
export const picklistTypes = {
    PRODUCT_STATUS: 'PRODUCT_STATUS',
    PRODUCT_CATEGORY: 'PRODUCT_CATEGORY',
    WAREHOUSE_LOCATION: 'WAREHOUSE_LOCATION',
    QUALITY_GRADE: 'QUALITY_GRADE'
};
//# sourceMappingURL=dynamicFieldConfig.js.map