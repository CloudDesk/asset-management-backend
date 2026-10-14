import type { FastifyRequest } from 'fastify';

export function logAmazonFailure(request: FastifyRequest, error: unknown) {
  const item = error as { name?: string; message?: string; code?: string; statusCode?: number } | null;
  // Never serialize HTTP client configuration, headers, or request bodies.
  const user = (request as FastifyRequest & { user?: { id?: number; userType?: string } }).user;
  request.log.error({ operation: request.routeOptions.url, method: request.method,
    userId: user?.id, userType: user?.userType,
    params: request.params, error: { name: item?.name, message: item?.message,
      code: item?.code, statusCode: item?.statusCode } }, 'Amazon request failed');
}
