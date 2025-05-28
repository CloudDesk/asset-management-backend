import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.string().transform((val) => Math.max(1, parseInt(val, 10) || 1)).default('1'),
  limit: z.string().transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 10))).default('10'),
});

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

export function getPaginationParams(query: Record<string, unknown>): PaginationParams {
  console.log('=== getPaginationParams DEBUG ===');
  console.log('query:', JSON.stringify(query, null, 2));
  console.log('typeof query:', typeof query);
  
  // Check each parameter individually
  if (query.page) {
    console.log('page value:', query.page, 'typeof:', typeof query.page);
  }
  if (query.limit) {
    console.log('limit value:', query.limit, 'typeof:', typeof query.limit);
  }
  
  const result = paginationSchema.parse(query);
  console.log('parsed result:', result);
  return {
    page: result.page,
    limit: result.limit,
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