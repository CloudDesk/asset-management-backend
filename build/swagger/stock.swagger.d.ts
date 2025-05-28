/**
 * Gets the dynamically generated stock schemas
 */
export declare function getStockSchemas(): Promise<any>;
/**
 * Generates query parameters schema for stock filtering
 */
export declare function getStockQuerySchema(): Promise<{
    type: string;
    properties: Record<string, any>;
    additionalProperties: boolean;
}>;
/**
 * Clears the stock schema cache
 */
export declare function clearStockSchemaCache(): void;
//# sourceMappingURL=stock.swagger.d.ts.map