import { PicklistService } from '../services/picklist.service.js';
import { createPicklistSchema, updatePicklistSchema, picklistParamsSchema } from '../schemas/picklist.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { formatPicklistForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
export class PicklistController {
    picklistService = new PicklistService();
    getPicklists = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters (not just schema-validated ones)
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.picklistService.findMany(filters, page, limit);
        // Format all picklists in the result
        const formattedData = formatEntitiesForAPI(result.data, 'picklist');
        const response = createSuccessResponse('Picklists retrieved successfully', formattedData);
        return reply.code(200).send({
            ...response,
            pagination: result.pagination,
            meta: {
                filters: Object.keys(filters),
                total: result.pagination.total,
                filtered: Object.keys(filters).length > 0
            }
        });
    });
    getPicklist = asyncHandler(async (request, reply) => {
        const { id } = picklistParamsSchema.parse(request.params);
        const picklist = await this.picklistService.findById(id);
        const response = createSuccessResponse('Picklist retrieved successfully', formatPicklistForAPI(picklist));
        return reply.code(200).send(response);
    });
    createPicklist = asyncHandler(async (request, reply) => {
        const data = createPicklistSchema.parse(request.body);
        const picklist = await this.picklistService.create(data);
        const response = createSuccessResponse('Picklist item created successfully', formatPicklistForAPI(picklist));
        return reply.code(201).send(response);
    });
    updatePicklist = asyncHandler(async (request, reply) => {
        const { id } = picklistParamsSchema.parse(request.params);
        const data = updatePicklistSchema.parse(request.body);
        const picklist = await this.picklistService.update(id, data);
        const response = createSuccessResponse('Picklist item updated successfully', formatPicklistForAPI(picklist));
        return reply.code(200).send(response);
    });
    deletePicklist = asyncHandler(async (request, reply) => {
        const { id } = picklistParamsSchema.parse(request.params);
        await this.picklistService.delete(id);
        const response = createSuccessResponse('Picklist item deleted successfully', null);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=picklist.controller.js.map