import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { instoreOrderSchema, instoreSearchSchema } from '../schemas/instore-order.schema.js';
import { InstoreOrderService } from '../services/instore-order.service.js';
import { asyncHandler, createSuccessResponse, ValidationError } from '../utils/errorHandler.js';

export class InstoreOrderController {
  private service = new InstoreOrderService();

  private inventoryUser(request: FastifyRequest) {
    const user = (request as AuthenticatedRequest).user;
    if (!user || user.userType !== 'inventory') {
      throw new ValidationError('Only authenticated inventory users can create in-store orders');
    }
    return user.location
      ? { id: user.id, location: user.location }
      : { id: user.id };
  }

  searchCustomers = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    this.inventoryUser(request);
    const query = instoreSearchSchema.parse(request.query);
    const customers = await this.service.searchCustomers(query);
    return reply.code(200).send(createSuccessResponse('Customers retrieved successfully', customers));
  });

  searchProducts = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    this.inventoryUser(request);
    const query = instoreSearchSchema.parse(request.query);
    const products = await this.service.searchProducts(query);
    return reply.code(200).send(createSuccessResponse('In-store products retrieved successfully', products));
  });

  create = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const inventoryUser = this.inventoryUser(request);
    const input = instoreOrderSchema.parse(request.body);
    const order = await this.service.createOrder(input, inventoryUser);
    return reply.code(order.created ? 201 : 200).send(createSuccessResponse(
      order.created ? 'In-store order completed successfully' : 'Existing in-store order retrieved',
      order,
    ));
  });
}
