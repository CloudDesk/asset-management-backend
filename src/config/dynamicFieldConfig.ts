export interface DynamicFieldConfig {
  table: string;
  allowedFields: string[];
  requiredFields: string[];
  fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'date'>;
}

export const dynamicFieldConfigs: Record<string, DynamicFieldConfig> = {
  product: {
    table: 'product',
    allowedFields: [
      'name', 'puc', 'shortdescription', 'fulldescription', 'category', 'subcategory',
      'fragnancetype', 'Brand', 'pack', 'price', 'discount', 'averagerating',
      'quantity', 'orderedquantity', 'soldquantity', 'availablequantity', 
      'ecompublishedquantity', 'productstatus', 'large', 'medium', 'small',
      'createddate', 'modifieddate', 'isdealoftheday'
    ],
    requiredFields: ['name'],
    fieldTypes: {
      name: 'string',
      puc: 'string',
      shortdescription: 'string',
      fulldescription: 'string',
      category: 'string',
      subcategory: 'string',
      fragnancetype: 'string',
      Brand: 'string',
      pack: 'string',
      price: 'number',
      discount: 'number',
      averagerating: 'number',
      quantity: 'number',
      orderedquantity: 'number',
      soldquantity: 'number',
      availablequantity: 'number',
      ecompublishedquantity: 'number',
      productstatus: 'string',
      createddate: 'number',
      modifieddate: 'number',
      isdealoftheday: 'boolean'
    }
  },
  stock: {
    table: 'stock',
    allowedFields: [
      'puc', 'platform', 'sku', 'serialnumber', 'batchno', 'poid', 'supplierid',
      'platformhistory', 'stockstatus', 'orderlinenumber', 'orderid', 'ecompublish',
      'isdeleted', 'isarchive', 'removefromrecyclebin', 'manufacturedyear', 'releaseyear',
      'solddate', 'createddate', 'modifieddate', 'rfid', 'rfidscannedtime'
    ],
    requiredFields: ['puc', 'platform'],
    fieldTypes: {
      puc: 'string',
      platform: 'string',
      sku: 'string',
      serialnumber: 'string',
      batchno: 'string',
      poid: 'number',
      supplierid: 'number',
      stockstatus: 'string',
      orderlinenumber: 'string',
      orderid: 'string',
      ecompublish: 'boolean',
      isdeleted: 'boolean',
      isarchive: 'boolean',
      removefromrecyclebin: 'boolean',
      manufacturedyear: 'number',
      releaseyear: 'number',
      solddate: 'number',
      createddate: 'number',
      modifieddate: 'number',
      rfid: 'string',
      rfidscannedtime: 'number'
    }
  },
  picklist: {
    table: 'picklist',
    allowedFields: [
      'label', 'value', 'object', 'controlledvalue', 'fieldname',
      'controlledlabel', 'controlledfieldname', 'parent'
    ],
    requiredFields: ['label', 'value'],
    fieldTypes: {
      label: 'string',
      value: 'string',
      object: 'string',
      controlledvalue: 'string',
      fieldname: 'string',
      controlledlabel: 'string',
      controlledfieldname: 'string',
      parent: 'string'
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
  },
  platformstock: {
    table: 'platformstock',
    allowedFields: [
      'platform', 'productId', 'availableQty', 'orderedQty', 'soldQty', 'totalQty',
      'lockQty', 'createddate', 'modifieddate'
    ],
    requiredFields: ['platform', 'productId'],
    fieldTypes: {
      platform: 'string',
      productId: 'number',
      availableQty: 'number',
      orderedQty: 'number',
      soldQty: 'number',
      totalQty: 'number',
      lockQty: 'number',
      createddate: 'number',
      modifieddate: 'number'
    }
  }
};

// Legacy picklist types - kept for backward compatibility
export const picklistTypes = {
  PRODUCT_STATUS: 'PRODUCT_STATUS',
  PRODUCT_CATEGORY: 'PRODUCT_CATEGORY',
  WAREHOUSE_LOCATION: 'WAREHOUSE_LOCATION',
  QUALITY_GRADE: 'QUALITY_GRADE'
} as const;

export type PicklistType = typeof picklistTypes[keyof typeof picklistTypes]; 