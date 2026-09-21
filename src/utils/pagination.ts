import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.string().transform((val) => Math.max(1, parseInt(val, 10) || 1)).default('1'),
  limit: z.string().transform((val) => Math.max(1, parseInt(val, 10) || 10)).default('10'),
});

const DEFAULT_MAX_LIMIT = 100;

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

export function getPaginationParams(
  query: Record<string, unknown>,
  maxLimit: number = DEFAULT_MAX_LIMIT
): PaginationParams {
  const result = paginationSchema.parse(query);
  const normalizedMaxLimit = Math.max(1, Math.floor(maxLimit));

  return {
    page: result.page,
    limit: Math.min(normalizedMaxLimit, result.limit),
  };
}

export function createPaginationResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResult<T> {
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

export function getPrismaSkipTake(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}
