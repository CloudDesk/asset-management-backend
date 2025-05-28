import { z } from 'zod';
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
    limit: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: string | undefined;
    limit?: string | undefined;
}>;
export interface PaginationParams {
    page: number;
    limit: number;
}
export interface PaginationResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export declare function getPaginationParams(query: Record<string, unknown>): PaginationParams;
export declare function createPaginationResult<T>(data: T[], total: number, page: number, limit: number): PaginationResult<T>;
export declare function getPrismaSkipTake(page: number, limit: number): {
    skip: number;
    take: number;
};
//# sourceMappingURL=pagination.d.ts.map