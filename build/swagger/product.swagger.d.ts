/**
 * Gets the dynamically generated product schemas
 */
export declare function getProductSchemas(): Promise<any>;
/**
 * Generates query parameters schema for product filtering
 */
export declare function getProductQuerySchema(): Promise<{
    type: string;
    properties: Record<string, any>;
    additionalProperties: boolean;
}>;
/**
 * Clears the product schema cache
 */
export declare function clearProductSchemaCache(): void;
//# sourceMappingURL=product.swagger.d.ts.map