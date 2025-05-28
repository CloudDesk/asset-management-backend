import { generateCRUDSchemas } from '../utils/swaggerSchemaBuilder.js';
import { logger } from '../config/logger.js';
// Cache for generated schemas
let supplierSchemas = null;
let lastGenerated = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
/**
 * Gets the dynamically generated supplier schemas
 */
export async function getSupplierSchemas() {
    try {
        // Check if we need to regenerate schemas
        if (!supplierSchemas || (Date.now() - lastGenerated) > CACHE_TTL) {
            logger.debug('Generating fresh supplier schemas');
            supplierSchemas = await generateCRUDSchemas('supplier');
            lastGenerated = Date.now();
            logger.info('Supplier schemas generated successfully');
        }
        return supplierSchemas;
    }
    catch (error) {
        logger.error({ error }, 'Failed to generate supplier schemas');
        throw error;
    }
}
/**
 * Generates query parameters schema for supplier filtering
 */
export async function getSupplierQuerySchema() {
    try {
        const schemas = await getSupplierSchemas();
        const responseSchema = schemas.response;
        // Generate query parameters based on actual supplier fields
        const queryProperties = {
            // Pagination
            page: {
                type: 'string',
                description: 'Page number for pagination'
            },
            limit: {
                type: 'string',
                description: 'Number of items per page'
            }
        };
        // Add filter parameters for each field in the supplier schema
        for (const [fieldName, fieldSchema] of Object.entries(responseSchema.properties)) {
            const field = fieldSchema;
            // Skip system fields
            if (['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt'].includes(fieldName)) {
                continue;
            }
            // Add basic filter for the field
            queryProperties[fieldName] = {
                type: 'string',
                description: `Filter by ${fieldName}`
            };
            // Add range filters for numeric fields
            if (field.type === 'number' || field.type === 'integer') {
                queryProperties[`min${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`] = {
                    type: 'string',
                    description: `Minimum value for ${fieldName}`
                };
                queryProperties[`max${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`] = {
                    type: 'string',
                    description: `Maximum value for ${fieldName}`
                };
            }
            // Add date range filters for date fields
            if (field.format === 'date-time' || field.format === 'date') {
                queryProperties[`${fieldName}After`] = {
                    type: 'string',
                    description: `Filter ${fieldName} after this date`
                };
                queryProperties[`${fieldName}Before`] = {
                    type: 'string',
                    description: `Filter ${fieldName} before this date`
                };
            }
        }
        return {
            type: 'object',
            properties: queryProperties,
            additionalProperties: true // Allow any query parameters for dynamic filtering
        };
    }
    catch (error) {
        logger.error({ error }, 'Failed to generate supplier query schema');
        throw error;
    }
}
/**
 * Clears the supplier schema cache
 */
export function clearSupplierSchemaCache() {
    supplierSchemas = null;
    lastGenerated = 0;
    logger.info('Supplier schema cache cleared');
}
//# sourceMappingURL=supplier.swagger.js.map