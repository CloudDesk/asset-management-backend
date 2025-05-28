/**
 * Safe Database Operations Utility
 *
 * This module provides utilities for handling database operations when schema fields
 * might not exist yet. This is designed for iterative development where the database
 * schema is still evolving.
 *
 * Behavior:
 * - CREATE: Unknown fields are ignored (filtered out before database operation)
 * - READ: Missing fields return as null/undefined in response
 * - UPDATE: Unknown fields are ignored, existing fields are updated safely
 *
 * When you add new fields to the Prisma schema, they will automatically be used
 * without any code changes needed.
 */
export interface SafeFieldConfig {
    coreFields: string[];
    optionalFields: string[];
    dynamicFields: string[];
}
export declare const SAFE_FIELD_CONFIGS: {
    product: {
        coreFields: readonly string[];
        optionalFields: readonly string[];
        dynamicFields: readonly string[];
    };
    stock: {
        coreFields: readonly string[];
        optionalFields: readonly string[];
        dynamicFields: readonly string[];
    };
    picklist: {
        coreFields: readonly string[];
        optionalFields: readonly string[];
        dynamicFields: readonly string[];
    };
};
/**
 * Safely filters input data to only include fields that exist in the schema
 * Unknown fields are logged and ignored to prevent database errors
 */
export declare function safeFilterInputData(data: Record<string, any>, modelName: keyof typeof SAFE_FIELD_CONFIGS, operation?: 'create' | 'update'): Record<string, any>;
/**
 * Safely processes database result to handle missing fields
 * Missing fields are set to null to maintain consistent API response structure
 */
export declare function safeProcessDbResult(result: Record<string, any> | null, modelName: keyof typeof SAFE_FIELD_CONFIGS): Record<string, any> | null;
/**
 * Safely processes array of database results
 */
export declare function safeProcessDbResults<T extends Record<string, any>>(results: T[], modelName: keyof typeof SAFE_FIELD_CONFIGS): T[];
/**
 * Wrapper for Prisma operations that handles errors gracefully
 * If a field doesn't exist in the database, the operation continues without that field
 */
export declare function safePrismaOperation<T>(operation: () => Promise<T>, operationName: string, modelName: string): Promise<T | null>;
/**
 * Type-safe field validator that checks if a field should be included in operations
 */
export declare function isFieldSafe(fieldName: string, modelName: keyof typeof SAFE_FIELD_CONFIGS, includeOptional?: boolean): boolean;
/**
 * Extracts dynamic fields from input data and validates them
 */
export declare function extractDynamicFields(data: Record<string, any>, modelName: keyof typeof SAFE_FIELD_CONFIGS): Record<string, any>;
//# sourceMappingURL=safeDbOperations.d.ts.map