/**
 * Converts BigInt values and other database objects to JSON-serializable values
 */
export declare function convertBigIntToNumber(obj: any): any;
/**
 * Performs a fast findMany operation optimized for performance
 */
export declare function fastFindMany(modelName: string, options?: {
    skip?: number;
    take?: number;
    useAllColumns?: boolean;
}): Promise<any[]>;
/**
 * Performs dynamic findMany with proper filtering and counting
 */
export declare function dynamicFindManyWithFilters(modelName: string, filters?: Record<string, any>, options?: {
    skip?: number;
    take?: number;
    useAllColumns?: boolean;
}): Promise<{
    data: any[];
    total: number;
}>;
/**
 * Performs a dynamic findMany operation that adapts to available columns
 */
export declare function dynamicFindMany(modelName: string, options?: {
    where?: any;
    skip?: number;
    take?: number;
    orderBy?: any;
    include?: any;
}): Promise<any[]>;
/**
 * Performs a dynamic count operation with optimizations
 */
export declare function dynamicCount(modelName: string, where?: any): Promise<number>;
/**
 * Performs a dynamic findUnique operation
 */
export declare function dynamicFindUnique(modelName: string, where: any, include?: any): Promise<any | null>;
/**
 * Performs a dynamic create operation
 */
export declare function dynamicCreate(modelName: string, data: Record<string, any>, include?: any): Promise<any | null>;
/**
 * Performs a dynamic update operation
 */
export declare function dynamicUpdate(modelName: string, where: any, data: Record<string, any>, include?: any): Promise<any | null>;
/**
 * Performs a dynamic delete operation
 */
export declare function dynamicDelete(modelName: string, where: any): Promise<boolean>;
/**
 * Clears the schema cache (useful for testing or when schema changes)
 */
export declare function clearSchemaCache(): void;
/**
 * Gets current schema cache status
 */
export declare function getSchemaCacheStatus(): Array<{
    tableName: string;
    columns: string[];
    age: number;
}>;
/**
 * Safely serializes database objects for API responses
 * This function ensures that all database objects are properly converted to JSON-serializable values
 */
export declare function serializeForAPI(data: any): any;
/**
 * Formats a single supplier object for API response
 * Ensures all numeric fields are properly converted and handles any special cases
 */
export declare function formatSupplierForAPI(supplier: any): any;
/**
 * Formats a single product object for API response
 */
export declare function formatProductForAPI(product: any): any;
/**
 * Formats a single stock object for API response
 */
export declare function formatStockForAPI(stock: any): any;
/**
 * Formats a single purchase order object for API response
 */
export declare function formatPurchaseOrderForAPI(purchaseOrder: any): any;
/**
 * Formats a single purchase request object for API response
 */
export declare function formatPurchaseRequestForAPI(purchaseRequest: any): any;
/**
 * Formats a single picklist object for API response
 */
export declare function formatPicklistForAPI(picklist: any): any;
/**
 * Formats a single quotes object for API response
 */
export declare function formatQuotesForAPI(quote: any): any;
/**
 * Formats a single user object for API response
 */
export declare function formatUsersForAPI(user: any): any;
/**
 * Formats a single inventory user object for API response
 */
export declare function formatInventoryUsersForAPI(inventoryUser: any): any;
/**
 * Formats a single poinvoice object for API response
 */
export declare function formatPoinvoiceForAPI(poinvoice: any): any;
/**
 * Formats a single address object for API response
 */
export declare function formatAddressForAPI(address: any): any;
/**
 * Formats a single sample purchase order object for API response
 */
export declare function formatSamplePurchaseOrderForAPI(samplePurchaseOrder: any): any;
/**
 * Formats a single sample purchase request object for API response
 */
export declare function formatSamplePurchaseRequestForAPI(samplePurchaseRequest: any): any;
/**
 * Formats a single orders object for API response
 */
export declare function formatOrdersForAPI(order: any): any;
/**
 * Formats a single orderline object for API response
 */
export declare function formatOrderlineForAPI(orderline: any): any;
/**
 * Universal formatter that detects entity type and applies appropriate formatting
 */
export declare function formatEntityForAPI(entity: any, entityType?: string): any;
/**
 * Formats an array of entities for API response
 */
export declare function formatEntitiesForAPI(entities: any[], entityType?: string): any[];
//# sourceMappingURL=dynamicDbOperations.d.ts.map