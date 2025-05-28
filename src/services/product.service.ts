import { prisma } from '../models/prisma.js';
import { Prisma } from '@prisma/client';
import { 
  CreateProductInput, 
  UpdateProductInput, 
  UpsertProductInput,
  validateProductDynamicFields 
} from '../schemas/product.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { buildProductFilters, FilterOptions } from '../utils/filterBuilder.js';
import { 
  safeFilterInputData, 
  safeProcessDbResult, 
  safeProcessDbResults, 
  safePrismaOperation 
} from '../utils/safeDbOperations.js';
import { 
  dynamicFindMany, 
  dynamicCount, 
  dynamicFindUnique, 
  dynamicCreate, 
  dynamicUpdate, 
  dynamicDelete,
  dynamicFindManyWithFilters
} from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';

export class ProductService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic product findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use the new dynamic filtering system
      const { data: products, total } = await dynamicFindManyWithFilters('product', filters, {
        skip,
        take,
        useAllColumns: true // Get all available columns
      });

      logger.info({
        productCount: products.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: products.length > 0 ? Object.keys(products[0]) : []
      }, 'Dynamic product findMany with filters completed');

      return createPaginationResult(products, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic product findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug({ productId: id }, 'Starting dynamic product findById operation');

      const product = await dynamicFindUnique('product', { id });

      if (!product) {
        throw new Error('Product not found');
      }

      logger.debug({ 
        productId: id, 
        availableFields: Object.keys(product) 
      }, 'Dynamic product findById completed');

      return product;
    } catch (error) {
      logger.error({ error, productId: id }, 'Error in product findById operation');
      throw error;
    }
  }

  async create(data: CreateProductInput & Record<string, any>) {
    try {
      logger.debug({ originalData: data }, 'Starting dynamic product create operation');

      const product = await dynamicCreate('product', data);

      if (!product) {
        throw new Error('Failed to create product - no valid fields provided');
      }

      logger.info({ 
        productId: product.id, 
        availableFields: Object.keys(product) 
      }, 'Dynamic product create completed');

      return product;
    } catch (error) {
      logger.error({ error, data }, 'Error in product create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdateProductInput & Record<string, any>) {
    try {
      // Check if product exists
      await this.findById(id);

      logger.debug({ originalData: data, productId: id }, 'Starting dynamic product update operation');

      const product = await dynamicUpdate('product', { id }, data);

      if (!product) {
        throw new Error('Failed to update product - no valid fields provided');
      }

      logger.info({ 
        productId: id, 
        availableFields: Object.keys(product) 
      }, 'Dynamic product update completed');

      return product;
    } catch (error) {
      logger.error({ error, data, productId: id }, 'Error in product update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Check if product exists
      await this.findById(id);

      logger.debug({ productId: id }, 'Starting dynamic product delete operation');

      const success = await dynamicDelete('product', { id });

      if (!success) {
        throw new Error('Failed to delete product');
      }

      logger.info({ productId: id }, 'Dynamic product delete completed successfully');
    } catch (error) {
      logger.error({ error, productId: id }, 'Error in product delete operation');
      throw error;
    }
  }

  async upsert(data: UpsertProductInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing product
        logger.debug({ productId: id, data: updateData }, 'Upserting existing product');
        return this.update(id, updateData);
      } else {
        // Create new product
        logger.debug({ data: updateData }, 'Upserting new product');
        return this.create(updateData);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in product upsert operation');
      throw error;
    }
  }

  async updateStockTotals(productId: string) {
    try {
      logger.debug({ productId }, 'Starting dynamic stock totals update');

      const stocks = await dynamicFindMany('stock', {
        where: { productId },
      });

      if (!Array.isArray(stocks) || stocks.length === 0) {
        logger.warn({ productId }, 'No stocks found for product, skipping stock totals update');
        return { totalQuantity: 0, totalAvailable: 0, totalSold: 0 };
      }

      const totals = stocks.reduce(
        (acc: { totalQuantity: number; totalAvailable: number; totalSold: number }, stock: any) => ({
          totalQuantity: acc.totalQuantity + (stock.quantity || 0),
          totalAvailable: acc.totalAvailable + (stock.availableQuantity || stock.available_quantity || 0),
          totalSold: acc.totalSold + (stock.soldQuantity || stock.sold_quantity || 0),
        }),
        { totalQuantity: 0, totalAvailable: 0, totalSold: 0 }
      );

      // Try to update stock totals if the fields exist
      const updateData = {
        totalStockQuantity: totals.totalQuantity,
        totalStockAvailable: totals.totalAvailable,
        totalStockSold: totals.totalSold,
      };

      const updatedProduct = await dynamicUpdate('product', { id: productId }, updateData);

      if (updatedProduct) {
        logger.debug({ productId, totals }, 'Updated product stock totals successfully');
      } else {
        logger.debug({ productId, totals }, 'Stock total fields not available in schema, skipping update');
      }

      return totals;
    } catch (error) {
      logger.error({ error, productId }, 'Error in updateStockTotals operation');
      throw error;
    }
  }
} 