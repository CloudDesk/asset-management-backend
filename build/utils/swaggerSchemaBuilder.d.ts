interface ColumnInfo {
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    character_maximum_length: number | null;
    numeric_precision: number | null;
    numeric_scale: number | null;
}
interface SwaggerProperty {
    type: string;
    format?: string;
    description?: string;
    nullable?: boolean;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    example?: any;
}
interface SwaggerSchema {
    type: string;
    properties: Record<string, SwaggerProperty>;
    required: string[];
    additionalProperties?: boolean;
}
/**
 * Fetches all fields from a database table and returns their metadata
 */
export declare function getModelFields(modelName: string): Promise<ColumnInfo[]>;
/**
 * Generates a Swagger schema object for a given model
 */
export declare function generateSwaggerSchema(modelName: string, schemaType?: 'create' | 'update' | 'response'): Promise<SwaggerSchema>;
/**
 * Generates complete Swagger route schemas for CRUD operations
 */
export declare function generateCRUDSchemas(modelName: string): Promise<{
    create: SwaggerSchema;
    update: SwaggerSchema;
    response: SwaggerSchema;
    success: {
        type: string;
        properties: {
            success: {
                type: string;
            };
            message: {
                type: string;
            };
            data: SwaggerSchema;
        };
        required: string[];
    };
    list: {
        type: string;
        properties: {
            success: {
                type: string;
            };
            data: {
                type: string;
                items: SwaggerSchema;
            };
            pagination: {
                type: string;
                properties: {
                    page: {
                        type: string;
                    };
                    limit: {
                        type: string;
                    };
                    total: {
                        type: string;
                    };
                    totalPages: {
                        type: string;
                    };
                    hasNext: {
                        type: string;
                    };
                    hasPrev: {
                        type: string;
                    };
                };
            };
            meta: {
                type: string;
                properties: {
                    filters: {
                        type: string;
                        items: {
                            type: string;
                        };
                    };
                    total: {
                        type: string;
                    };
                    filtered: {
                        type: string;
                    };
                };
            };
        };
        required: string[];
    };
    error: {
        type: string;
        properties: {
            success: {
                type: string;
            };
            message: {
                type: string;
            };
            details: {
                type: string;
            };
            statusCode: {
                type: string;
            };
        };
        required: string[];
    };
}>;
/**
 * Clears the schema cache (useful for testing or when schema changes)
 */
export declare function clearSchemaCache(): void;
/**
 * Gets cache status for debugging
 */
export declare function getSchemaCacheStatus(): Array<{
    key: string;
    age: number;
}>;
export {};
//# sourceMappingURL=swaggerSchemaBuilder.d.ts.map