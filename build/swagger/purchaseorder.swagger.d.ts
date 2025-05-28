/**
 * Gets the dynamically generated purchase order schemas
 */
export declare function getPurchaseOrderSchemas(): Promise<any>;
/**
 * Generates query parameters schema for purchase order filtering
 */
export declare function getPurchaseOrderQuerySchema(): Promise<{
    type: string;
    properties: Record<string, any>;
    additionalProperties: boolean;
}>;
/**
 * Clears the purchase order schema cache
 */
export declare function clearPurchaseOrderSchemaCache(): void;
//# sourceMappingURL=purchaseorder.swagger.d.ts.map