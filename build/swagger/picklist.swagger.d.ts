/**
 * Gets the dynamically generated picklist schemas
 */
export declare function getPicklistSchemas(): Promise<any>;
/**
 * Generates query parameters schema for picklist filtering
 */
export declare function getPicklistQuerySchema(): Promise<{
    type: string;
    properties: Record<string, any>;
    additionalProperties: boolean;
}>;
/**
 * Clears the picklist schema cache
 */
export declare function clearPicklistSchemaCache(): void;
//# sourceMappingURL=picklist.swagger.d.ts.map