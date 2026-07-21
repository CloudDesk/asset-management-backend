import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { amazonOrderImportSchema, amazonOrderQuerySchema } from '../schemas/amazon-order.schema.js';
import { amazonListingScopeService } from '../services/amazon-listing-scope.service.js';
import { AmazonOrderImportError, amazonOrderImportService } from '../services/amazon-order-import.service.js';
import { createSuccessResponse } from '../utils/errorHandler.js';

const sendError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof ZodError) return reply.code(400).send({ success: false, message: 'Invalid Amazon order request', code: 'VALIDATION_ERROR' });
  const known = error instanceof AmazonOrderImportError ? error : new AmazonOrderImportError('Amazon order operation failed', 500, 'AMAZON_ORDER_OPERATION_FAILED');
  return reply.code(known.statusCode).send({ success: false, message: known.message, details: known.message, statusCode: known.statusCode, code: known.code });
};

export class AmazonOrderController {
  private resolveScope(request: FastifyRequest) {
    const user = (request as AuthenticatedRequest).user;
    return amazonListingScopeService.resolve(user?.id, user?.userType);
  }

  importOrders = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const input = amazonOrderImportSchema.parse(request.body ?? {});
      const data = await amazonOrderImportService.importOrders(await this.resolveScope(request), {
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      }, input);
      return reply.code(200).send(createSuccessResponse('Amazon orders imported successfully', data));
    } catch (error) { return sendError(reply, error); }
  };

  getOrders = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = amazonOrderQuerySchema.parse(request.query ?? {});
      const result = await amazonOrderImportService.listOrders(await this.resolveScope(request), query);
      return reply.code(200).send({ ...createSuccessResponse('Amazon orders retrieved successfully', result.data), pagination: result.pagination });
    } catch (error) { return sendError(reply, error); }
  };
}
