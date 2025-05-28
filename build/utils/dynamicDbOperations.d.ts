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
export declare function dynamicCreate(modelName: string, data: Record<string, any>): Promise<any | null>;
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
//# sourceMappingURL=dynamicDbOperations.d.ts.map