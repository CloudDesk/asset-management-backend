/**
 * Gets the dynamically generated purchase request schemas
 */
export declare function getPurchaseRequestSchemas(): Promise<any>;
/**
 * Generates query parameters schema for purchase request filtering
 */
export declare function getPurchaseRequestQuerySchema(): Promise<{
    type: string;
    properties: Record<string, any>;
    additionalProperties: boolean;
}>;
/**
 * Clears the purchase request schema cache
 */
export declare function clearPurchaseRequestSchemaCache(): void;
//# sourceMappingURL=purchaserequest.swagger.d.ts.map