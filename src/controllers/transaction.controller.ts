import { FastifyRequest, FastifyReply } from 'fastify';
import { TransactionService } from '../services/transaction.service.js';
import { 
  createTransactionSchema, 
  updateTransactionSchema, 
  upsertTransactionSchema,
  transactionParamsSchema,
  transactionByIdParamsSchema,
  TransactionParams,
  TransactionByIdParams
} from '../schemas/transaction.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';

export class TransactionController {
  public transactionService = new TransactionService();

  getTransactions = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.transactionService.findMany(filters, page, limit);
    
    // Format all transactions in the result
    const formattedData = formatEntitiesForAPI(result.data, 'transaction');
    
    const response = createSuccessResponse('Transactions retrieved successfully', formattedData);
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

  getTransaction = asyncHandler(async (request: FastifyRequest<{ Params: TransactionByIdParams }>, reply: FastifyReply) => {
    const { id } = transactionByIdParamsSchema.parse(request.params);
    
    const transaction = await this.transactionService.findById(id);
    
    // Format the individual transaction data
    const formattedTransaction = formatEntitiesForAPI([transaction], 'transaction')[0];
    
    const response = createSuccessResponse('Transaction retrieved successfully', formattedTransaction);
    return reply.code(200).send(response);
  });

  getTransactionByTransactionId = asyncHandler(async (request: FastifyRequest<{ Params: TransactionParams }>, reply: FastifyReply) => {
    const { transactionid } = transactionParamsSchema.parse(request.params);
    
    const transaction = await this.transactionService.findByTransactionId(transactionid);
    
    if (!transaction) {
      return reply.code(404).send({
        success: false,
        message: 'Transaction not found',
        details: 'No transaction found with the specified transaction ID',
        statusCode: 404,
      });
    }
    
    // Format the individual transaction data
    const formattedTransaction = formatEntitiesForAPI([transaction], 'transaction')[0];
    
    const response = createSuccessResponse('Transaction retrieved successfully', formattedTransaction);
    return reply.code(200).send(response);
  });

  getUserTransactions = asyncHandler(async (request: FastifyRequest<{ 
    Params: { userId: string }, 
    Querystring: Record<string, any> 
  }>, reply: FastifyReply) => {
    const userId = parseInt(request.params.userId);
    
    if (isNaN(userId)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid user ID',
        details: 'User ID must be a valid number',
        statusCode: 400,
      });
    }

    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    const result = await this.transactionService.findByUserId(userId, page, limit);
    
    // Format all transactions in the result
    const formattedData = formatEntitiesForAPI(result.data, 'transaction');
    
    const response = createSuccessResponse('User transactions retrieved successfully', formattedData);
    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: {
        userId,
        total: result.pagination.total,
      }
    });
  });

  createTransaction = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createTransactionSchema.parse(request.body);
    
    const transaction = await this.transactionService.create(data);
    
    // Format the created transaction data
    const formattedTransaction = formatEntitiesForAPI([transaction], 'transaction')[0];
    
    const response = createSuccessResponse('Transaction created successfully', formattedTransaction);
    return reply.code(201).send(response);
  });

  updateTransaction = asyncHandler(async (request: FastifyRequest<{ Params: TransactionByIdParams }>, reply: FastifyReply) => {
    const { id } = transactionByIdParamsSchema.parse(request.params);
    const data = updateTransactionSchema.parse(request.body);
    
    const transaction = await this.transactionService.update(id, data);
    
    // Format the updated transaction data
    const formattedTransaction = formatEntitiesForAPI([transaction], 'transaction')[0];
    
    const response = createSuccessResponse('Transaction updated successfully', formattedTransaction);
    return reply.code(200).send(response);
  });

  updateTransactionByTransactionId = asyncHandler(async (request: FastifyRequest<{ Params: TransactionParams }>, reply: FastifyReply) => {
    const { transactionid } = transactionParamsSchema.parse(request.params);
    const data = updateTransactionSchema.parse(request.body);
    
    const transaction = await this.transactionService.updateByTransactionId(transactionid, data);
    
    // Format the updated transaction data
    const formattedTransaction = formatEntitiesForAPI([transaction], 'transaction')[0];
    
    const response = createSuccessResponse('Transaction updated successfully', formattedTransaction);
    return reply.code(200).send(response);
  });

  deleteTransaction = asyncHandler(async (request: FastifyRequest<{ Params: TransactionByIdParams }>, reply: FastifyReply) => {
    const { id } = transactionByIdParamsSchema.parse(request.params);
    
    await this.transactionService.delete(id);
    
    const response = createSuccessResponse('Transaction deleted successfully', null);
    return reply.code(200).send(response);
  });

  deleteTransactionByTransactionId = asyncHandler(async (request: FastifyRequest<{ Params: TransactionParams }>, reply: FastifyReply) => {
    const { transactionid } = transactionParamsSchema.parse(request.params);
    
    await this.transactionService.deleteByTransactionId(transactionid);
    
    const response = createSuccessResponse('Transaction deleted successfully', null);
    return reply.code(200).send(response);
  });

  upsertTransaction = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertTransactionSchema.parse(request.body);
    
    const transaction = await this.transactionService.upsert(data);
    
    // Format the upserted transaction data
    const formattedTransaction = formatEntitiesForAPI([transaction], 'transaction')[0];
    
    const message = data.id || (data.transactionid && await this.transactionService.findByTransactionId(data.transactionid))
      ? 'Transaction updated successfully' 
      : 'Transaction created successfully';
    const response = createSuccessResponse(message, formattedTransaction);
    return reply.code(200).send(response);
  });

  getTransactionStats = asyncHandler(async (request: FastifyRequest<{ 
    Querystring: { userId?: string } 
  }>, reply: FastifyReply) => {
    const userIdParam = request.query.userId;
    const userId = userIdParam ? parseInt(userIdParam) : undefined;
    
    if (userIdParam && isNaN(userId!)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid user ID',
        details: 'User ID must be a valid number',
        statusCode: 400,
      });
    }
    
    const stats = await this.transactionService.getTransactionStats(userId);
    
    const response = createSuccessResponse('Transaction statistics retrieved successfully', stats);
    return reply.code(200).send(response);
  });
} 