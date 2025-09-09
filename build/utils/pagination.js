import { z } from 'zod';
export const paginationSchema = z.object({
    page: z.string().transform((val) => Math.max(1, parseInt(val, 10) || 1)).default('1'),
    limit: z.string().transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 10))).default('10'),
});
export function getPaginationParams(query) {
    const result = paginationSchema.parse(query);
    return {
        page: result.page,
        limit: result.limit,
    };
}
export function createPaginationResult(data, total, page, limit) {
    const totalPages = Math.ceil(total / limit);
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    };
}
export function getPrismaSkipTake(page, limit) {
    return {
        skip: (page - 1) * limit,
        take: limit,
    };
}
//# sourceMappingURL=pagination.js.map