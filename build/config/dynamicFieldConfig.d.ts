export interface DynamicFieldConfig {
    table: string;
    allowedFields: string[];
    requiredFields: string[];
    fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'date'>;
}
export declare const dynamicFieldConfigs: Record<string, DynamicFieldConfig>;
export declare const picklistTypes: {
    readonly PRODUCT_STATUS: "PRODUCT_STATUS";
    readonly PRODUCT_CATEGORY: "PRODUCT_CATEGORY";
    readonly WAREHOUSE_LOCATION: "WAREHOUSE_LOCATION";
    readonly QUALITY_GRADE: "QUALITY_GRADE";
};
export type PicklistType = typeof picklistTypes[keyof typeof picklistTypes];
//# sourceMappingURL=dynamicFieldConfig.d.ts.map