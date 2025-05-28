/**
 * Gets the dynamically generated supplier schemas
 */
export declare function getSupplierSchemas(): Promise<any>;
/**
 * Generates query parameters schema for supplier filtering
 */
export declare function getSupplierQuerySchema(): Promise<{
    type: string;
    properties: Record<string, any>;
    additionalProperties: boolean;
}>;
/**
 * Clears the supplier schema cache
 */
export declare function clearSupplierSchemaCache(): void;
//# sourceMappingURL=supplier.swagger.d.ts.map