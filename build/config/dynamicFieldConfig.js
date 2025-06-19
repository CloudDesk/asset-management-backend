export const dynamicFieldConfigs = {
    product: {
        table: 'product',
        allowedFields: [
            'brand', 'model', 'color', 'size', 'weight', 'dimensions',
            'material', 'warranty', 'tags', 'notes', 'customField1',
            'customField2', 'customField3', 'customField4', 'customField5',
            'isdealoftheday'
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
            customField5: 'string',
            isdealoftheday: 'boolean'
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
    },
    picklist: {
        table: 'picklist',
        allowedFields: [
            'type', 'table', 'field', 'label', 'value',
            'isActive', 'ordering'
        ],
        requiredFields: ['type', 'table', 'field', 'label', 'value'],
        fieldTypes: {
            type: 'string',
            table: 'string',
            field: 'string',
            label: 'string',
            value: 'string',
            isActive: 'boolean',
            ordering: 'number'
        }
    },
    purchaserequest: {
        table: 'purchaserequest',
        allowedFields: [
            'companyname', 'companyaddress', 'contactname', 'phonenumber',
            'gstnumber', 'companymail', 'supplierid', 'prurl', 'prdata',
            'prnumber', 'supplieremail', 'prstatus', 'createddate', 'modifieddate'
        ],
        requiredFields: [
            'companyname', 'companyaddress', 'contactname', 'phonenumber',
            'gstnumber', 'companymail', 'supplierid', 'supplieremail'
        ],
        fieldTypes: {
            companyname: 'string',
            companyaddress: 'string',
            contactname: 'string',
            phonenumber: 'number',
            gstnumber: 'string',
            companymail: 'string',
            supplierid: 'number',
            prurl: 'string',
            prdata: 'string',
            prnumber: 'string',
            supplieremail: 'string',
            prstatus: 'string',
            createddate: 'number',
            modifieddate: 'number'
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