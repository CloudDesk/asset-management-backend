import { 
  CreateTransactionInput, 
  UpdateTransactionInput, 
  UpsertTransactionInput
} from '../schemas/transaction.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
import { 
  dynamicFindManyWithFilters,
  dynamicFindUnique, 
  dynamicCreate, 
  dynamicUpdate, 
  dynamicDelete
} from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';

// Enhanced error handling for database operations
class DatabaseConnectionError extends Error {
  constructor(message: string, originalError?: any) {
    super(message);
    this.name = 'DatabaseConnectionError';
    this.originalError = originalError;
  }
  originalError?: any;
}

export class TransactionService {
  
  /**
   * Enhanced error handler for database operations
   */
  private handleDatabaseError(error: any, operation: string, context: any = {}) {
    logger.error({ 
      error: error.message, 
      code: error.code,
      operation,
      context,
      stack: error.stack 
    }, `Database error in transaction ${operation}`);

    // Handle specific database connection errors
    if (
      error.code === 'P1001' || // Can't reach database server
      error.code === 'P1017' || // Server has closed the connection
      error.message?.includes("Can't reach database server") ||
      error.message?.includes("Connection terminated") ||
      error.message?.includes("connect timeout")
    ) {
      throw new DatabaseConnectionError(
        `Database connection failed during ${operation}. This might be a temporary issue. Please try again.`,
        error
      );
    }

    // Handle foreign key constraint errors
    if (error.code === 'P2003') {
      throw new Error(`Foreign key constraint violation during ${operation}: ${error.message}`);
    }

    // Handle unique constraint errors
    if (error.code === 'P2002') {
      throw new Error(`Unique constraint violation during ${operation}: ${error.message}`);
    }

    // For other errors, throw the original error
    throw error;
  }

  /**
   * Retry wrapper for database operations
   */
  private async retryDatabaseOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Only retry on connection errors
        if (
          attempt < maxRetries &&
          (
            error.code === 'P1001' || 
            error.code === 'P1017' ||
            error.message?.includes("Can't reach database server") ||
            error.message?.includes("Connection terminated")
          )
        ) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
          logger.warn({ 
            operation: operationName,
            attempt, 
            maxRetries, 
            delay,
            error: error.message 
          }, `Database operation failed, retrying in ${delay}ms...`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If not retryable or max retries reached, handle the error
        this.handleDatabaseError(error, operationName);
      }
    }
    
    // This should never be reached, but just in case
    throw lastError;
  }

  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    return this.retryDatabaseOperation(async () => {
      try {
        logger.info({ filters, page, limit }, 'Starting dynamic transaction findMany with filters');

        const { skip, take } = getPrismaSkipTake(page, limit);

        // Handle special filters for amount range
        const processedFilters = this.processFilters(filters);

        // Use the new dynamic filtering system
        const { data: transactions, total } = await dynamicFindManyWithFilters('transaction', processedFilters, {
          skip,
          take,
          useAllColumns: true // Get all available columns
        });

        logger.info({
          transactionCount: transactions.length, 
          total,
          filtered: Object.keys(processedFilters).length > 0,
          appliedFilters: Object.keys(processedFilters),
          availableFields: transactions.length > 0 ? Object.keys(transactions[0]) : []
        }, 'Dynamic transaction findMany with filters completed');

        return createPaginationResult(transactions, total, page, limit);
      } catch (error) {
        logger.error({ error, filters, page, limit }, 'Error in dynamic transaction findMany operation');
        throw error;
      }
    }, 'findMany');
  }

  async findById(id: string) {
    return this.retryDatabaseOperation(async () => {
      try {
        logger.debug({ transactionId: id }, 'Starting dynamic transaction findById operation');

        const transaction = await dynamicFindUnique('transaction', { id: parseInt(id) });

        if (!transaction) {
          throw new Error('Transaction not found');
        }

        logger.debug({ 
          transactionId: id, 
          availableFields: Object.keys(transaction) 
        }, 'Dynamic transaction findById completed');

        return transaction;
      } catch (error) {
        logger.error({ error, transactionId: id }, 'Error in transaction findById operation');
        throw error;
      }
    }, 'findById');
  }

  async findByTransactionId(transactionid: string) {
    return this.retryDatabaseOperation(async () => {
      try {
        logger.debug({ transactionid }, 'Starting dynamic transaction findByTransactionId operation');

        const transactions = await dynamicFindManyWithFilters('transaction', { transactionid }, {
          skip: 0,
          take: 1,
          useAllColumns: true
        });

        const transaction = transactions.data?.[0] || null;

        logger.debug({ 
          transactionid, 
          found: !!transaction,
          availableFields: transaction ? Object.keys(transaction) : []
        }, 'Dynamic transaction findByTransactionId completed');

        return transaction;
      } catch (error) {
        logger.error({ error, transactionid }, 'Error in transaction findByTransactionId operation');
        throw error;
      }
    }, 'findByTransactionId');
  }

  async findByUserId(userId: number, page: number = 1, limit: number = 10): Promise<PaginationResult<any>> {
    try {
      logger.debug({ userId, page, limit }, 'Starting dynamic transaction findByUserId operation');

      const { skip, take } = getPrismaSkipTake(page, limit);

      const { data: transactions, total } = await dynamicFindManyWithFilters('transaction', { userid: userId }, {
        skip,
        take,
        useAllColumns: true
      });

      logger.debug({ 
        userId, 
        transactionCount: transactions.length,
        total,
        availableFields: transactions.length > 0 ? Object.keys(transactions[0]) : []
      }, 'Dynamic transaction findByUserId completed');

      return createPaginationResult(transactions, total, page, limit);
    } catch (error) {
      logger.error({ error, userId, page, limit }, 'Error in transaction findByUserId operation');
      throw error;
    }
  }

  async create(data: CreateTransactionInput & Record<string, any>) {
    try {
      logger.debug({ originalData: data }, 'Starting dynamic transaction create operation');

      // Add timestamps
      const transactionData = {
        ...data,
        createddate: Date.now(),
        modifieddate: Date.now()
      };

      const transaction = await dynamicCreate('transaction', transactionData);

      if (!transaction) {
        throw new Error('Failed to create transaction - no valid fields provided');
      }

      logger.info({ 
        transactionId: transaction.transactionid, 
        availableFields: Object.keys(transaction) 
      }, 'Dynamic transaction create completed');

      return transaction;
    } catch (error) {
      logger.error({ error, data }, 'Error in transaction create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdateTransactionInput & Record<string, any>) {
    try {
      // Check if transaction exists
      await this.findById(id);

      logger.debug({ originalData: data, transactionId: id }, 'Starting dynamic transaction update operation');

      // Add modified timestamp
      const transactionData = {
        ...data,
        modifieddate: Date.now()
      };

      const transaction = await dynamicUpdate('transaction', { id: parseInt(id) }, transactionData);

      if (!transaction) {
        throw new Error('Failed to update transaction - no valid fields provided');
      }

      logger.info({ 
        transactionId: id, 
        availableFields: Object.keys(transaction) 
      }, 'Dynamic transaction update completed');

      return transaction;
    } catch (error) {
      logger.error({ error, data, transactionId: id }, 'Error in transaction update operation');
      throw error;
    }
  }

  async updateByTransactionId(transactionid: string, data: UpdateTransactionInput & Record<string, any>) {
    try {
      // Check if transaction exists
      const existingTransaction = await this.findByTransactionId(transactionid);
      if (!existingTransaction) {
        throw new Error('Transaction not found');
      }

      logger.debug({ originalData: data, transactionid }, 'Starting dynamic transaction updateByTransactionId operation');

      // Add modified timestamp
      const transactionData = {
        ...data,
        modifieddate: Date.now()
      };

      const transaction = await dynamicUpdate('transaction', { transactionid }, transactionData);

      if (!transaction) {
        throw new Error('Failed to update transaction - no valid fields provided');
      }

      logger.info({ 
        transactionid, 
        availableFields: Object.keys(transaction) 
      }, 'Dynamic transaction updateByTransactionId completed');

      return transaction;
    } catch (error) {
      logger.error({ error, data, transactionid }, 'Error in transaction updateByTransactionId operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Check if transaction exists
      await this.findById(id);

      logger.debug({ transactionId: id }, 'Starting dynamic transaction delete operation');

      const success = await dynamicDelete('transaction', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete transaction');
      }

      logger.info({ transactionId: id }, 'Dynamic transaction delete completed successfully');
    } catch (error) {
      logger.error({ error, transactionId: id }, 'Error in transaction delete operation');
      throw error;
    }
  }

  async deleteByTransactionId(transactionid: string) {
    try {
      // Check if transaction exists
      const existingTransaction = await this.findByTransactionId(transactionid);
      if (!existingTransaction) {
        throw new Error('Transaction not found');
      }

      logger.debug({ transactionid }, 'Starting dynamic transaction deleteByTransactionId operation');

      const success = await dynamicDelete('transaction', { transactionid });

      if (!success) {
        throw new Error('Failed to delete transaction');
      }

      logger.info({ transactionid }, 'Dynamic transaction deleteByTransactionId completed successfully');
    } catch (error) {
      logger.error({ error, transactionid }, 'Error in transaction deleteByTransactionId operation');
      throw error;
    }
  }

  async upsert(data: UpsertTransactionInput & Record<string, any>) {
    try {
      logger.debug({ originalData: data }, 'Starting dynamic transaction upsert operation');

      if (data.id) {
        // Update existing transaction by ID
        try {
          const { id, ...updateData } = data;
          
          // Check if there are any valid update fields
          if (Object.keys(updateData).length === 0) {
            // If no update data, just return the existing transaction
            return await this.findById(String(id));
          }
          
          return await this.update(String(id), updateData);
        } catch (error: any) {
          // If update fails due to no valid fields, try to return existing record
          if (error.message?.includes('no valid fields provided')) {
            return await this.findById(String(data.id));
          }
          throw error;
        }
      } else if (data.transactionid) {
        // Check if transaction exists by transactionid
        const existingTransaction = await this.findByTransactionId(data.transactionid);
        if (existingTransaction) {
          // Update existing
          try {
            const { transactionid, ...updateData } = data;
            
            // Check if there are any valid update fields
            if (Object.keys(updateData).length === 0) {
              // If no update data, just return the existing transaction
              return existingTransaction;
            }
            
            return await this.updateByTransactionId(transactionid, updateData);
          } catch (error: any) {
            // If update fails due to no valid fields, return existing record
            if (error.message?.includes('no valid fields provided')) {
              return existingTransaction;
            }
            throw error;
          }
        } else {
          // Create new - ensure transactionid is present
          if (!data.transactionid) {
            throw new Error('transactionid is required for creating new transaction');
          }
          return await this.create({ ...data, transactionid: data.transactionid });
        }
      } else {
        throw new Error('Either id or transactionid must be provided for upsert operation');
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in transaction upsert operation');
      throw error;
    }
  }

  /**
   * Get transaction statistics for a user
   */
  async getTransactionStats(userId?: number): Promise<any> {
    try {
      logger.debug({ userId }, 'Starting transaction statistics calculation');

      const filters = userId ? { userid: userId } : {};
      
      const { data: transactions } = await dynamicFindManyWithFilters('transaction', filters, {
        skip: 0,
        take: 10000, // Get all for stats calculation
        useAllColumns: true
      });

      const stats = {
        total: transactions.length,
        totalAmount: transactions.reduce((sum: number, t: any) => {
          const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
          return sum + amount;
        }, 0),
        byTransactionFor: {} as Record<string, number>,
        recentTransactions: transactions
          .sort((a: any, b: any) => (b.createddate || 0) - (a.createddate || 0))
          .slice(0, 5)
      };

      // Group by transaction purpose
      transactions.forEach((t: any) => {
        const purpose = t.transactionfor || 'Unknown';
        stats.byTransactionFor[purpose] = (stats.byTransactionFor[purpose] || 0) + 1;
      });

      logger.info({ userId, stats }, 'Transaction statistics calculated');

      return stats;
    } catch (error) {
      logger.error({ error, userId }, 'Error calculating transaction statistics');
      throw error;
    }
  }

  /**
   * Process filters for special cases like amount range
   */
  private processFilters(filters: FilterOptions): FilterOptions {
    const processedFilters = { ...filters };

    // Handle amount range filters
    if (filters.amountMin || filters.amountMax) {
      const amountFilter: any = {};
      if (filters.amountMin) {
        amountFilter.gte = parseFloat(String(filters.amountMin));
      }
      if (filters.amountMax) {
        amountFilter.lte = parseFloat(String(filters.amountMax));
      }
      processedFilters.amount = amountFilter;
      
      // Remove the range filters from the main filter set
      delete processedFilters.amountMin;
      delete processedFilters.amountMax;
    }

    return processedFilters;
  }
} 
