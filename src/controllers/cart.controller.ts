import { FastifyRequest, FastifyReply } from 'fastify';
import { CartService } from '../services/cart.service.js';
import { 
  createCartSchema, 
  updateCartSchema, 
  upsertCartSchema,
  cartParamsSchema,
  CartParams
} from '../schemas/cart.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { formatEntitiesForAPI, formatEntityForAPI } from '../utils/dynamicDbOperations.js';

export class CartController {
  public cartService = new CartService();

  getCarts = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.cartService.findMany(filters, page, limit);
    
    // Format all carts in the result
    const formattedData = formatEntitiesForAPI(result.data, 'cart');
    
    const response = createSuccessResponse('Cart items retrieved successfully', formattedData);
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

  getCart = asyncHandler(async (request: FastifyRequest<{ Params: CartParams }>, reply: FastifyReply) => {
    const { id } = cartParamsSchema.parse(request.params);
    
    const cart = await this.cartService.findById(id);
    
    // Format the individual cart data
    const formattedCart = formatEntityForAPI(cart, 'cart');
    
    const response = createSuccessResponse('Cart item retrieved successfully', formattedCart);
    return reply.code(200).send(response);
  });

  createCart = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createCartSchema.parse(request.body);
    
    const cart = await this.cartService.create(data);
    
    // Format the created cart data
    const formattedCart = formatEntityForAPI(cart, 'cart');
    
    const response = createSuccessResponse('Cart item created successfully', formattedCart);
    return reply.code(201).send(response);
  });

  updateCart = asyncHandler(async (request: FastifyRequest<{ Params: CartParams }>, reply: FastifyReply) => {
    const { id } = cartParamsSchema.parse(request.params);
    const data = updateCartSchema.parse(request.body);
    
    const cart = await this.cartService.update(id, data);
    
    // Format the updated cart data
    const formattedCart = formatEntityForAPI(cart, 'cart');
    
    const response = createSuccessResponse('Cart item updated successfully', formattedCart);
    return reply.code(200).send(response);
  });

  deleteCart = asyncHandler(async (request: FastifyRequest<{ Params: CartParams }>, reply: FastifyReply) => {
    const { id } = cartParamsSchema.parse(request.params);
    
    await this.cartService.delete(id);
    
    const response = createSuccessResponse('Cart item deleted successfully', null);
    return reply.code(200).send(response);
  });

  upsertCart = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertCartSchema.parse(request.body);
    
    const cart = await this.cartService.upsert(data);
    
    // Format the upserted cart data
    const formattedCart = formatEntityForAPI(cart, 'cart');
    
    const message = data.id ? 'Cart item updated successfully' : 'Cart item created successfully';
    const response = createSuccessResponse(message, formattedCart);
    return reply.code(200).send(response);
  });

  // Additional cart-specific endpoints
  getCartsByUserId = asyncHandler(async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    const { userId } = request.params;
    
    if (!userId || !/^\d+$/.test(userId)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid user ID',
        details: 'User ID must be a positive integer',
        statusCode: 400
      });
    }
    
    const carts = await this.cartService.findByUserId(userId, true);
    
    // Format all cart items
    const formattedCarts = carts.map(cart => formatEntityForAPI(cart, 'cart'));
    
    const response = createSuccessResponse('User cart items retrieved successfully', formattedCarts);
    return reply.code(200).send(response);
  });

  getWishlistByUserId = asyncHandler(async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    const { userId } = request.params;
    
    if (!userId || !/^\d+$/.test(userId)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid user ID',
        details: 'User ID must be a positive integer',
        statusCode: 400
      });
    }
    
    const wishlist = await this.cartService.findWishlistByUserId(userId);
    
    // Format all wishlist items
    const formattedWishlist = wishlist.map(item => formatEntityForAPI(item, 'cart'));
    
    const response = createSuccessResponse('User wishlist items retrieved successfully', formattedWishlist);
    return reply.code(200).send(response);
  });

  clearCartByUserId = asyncHandler(async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    const { userId } = request.params;
    
    if (!userId || !/^\d+$/.test(userId)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid user ID',
        details: 'User ID must be a positive integer',
        statusCode: 400
      });
    }
    
    const result = await this.cartService.clearCartByUserId(userId);
    
    const response = createSuccessResponse('User cart cleared successfully', result);
    return reply.code(200).send(response);
  });
} 
