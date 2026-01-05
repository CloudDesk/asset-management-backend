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

const DEFAULT_PLATFORM_STOCK_PLATFORMS = ['amazon', 'flipkart', 'nivapp'] as const;
const DEFAULT_PLATFORM_STATUS = 'outofstock';

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

      // Fetch components for combo products
      const comboProductIds = products
        .filter((p: any) => p.iscombo === true)
        .map((p: any) => BigInt(p.id));

      if (comboProductIds.length > 0) {
        try {
          // Batch fetch all components for all combo products with product details
          const allComponents = await (prisma as any).productBundleMap.findMany({
            where: {
              bundleproductid: {
                in: comboProductIds
              }
            },
            select: {
              bundleproductid: true,
              componentproductid: true,
              requiredqty: true,
              isactive: true,
              componentproduct: {
                select: {
                  name: true,
                  puc: true,
                }
              }
            },
            orderBy: {
              id: 'asc',
            }
          });

          // Get all unique component product IDs
          const componentProductIds = [...new Set(allComponents.map((comp: any) => comp.componentproductid))];

          // Batch fetch platform stock for all component products (nivapp platform)
          const componentPlatformStocks = componentProductIds.length > 0
            ? await prisma.platformStock.findMany({
              where: {
                productid: { in: componentProductIds.map((id: any) => BigInt(id)) },
                platform: 'nivapp'
              },
              select: {
                productid: true,
                availableqty: true,
                lockqty: true,
                orderedqty: true,
                soldqty: true,
                platformstatus: true,
              }
            })
            : [];

          // Create a map of component product ID to platform stock
          const platformStockMap = new Map();
          componentPlatformStocks.forEach((ps: any) => {
            platformStockMap.set(ps.productid.toString(), {
              availableqty: ps.availableqty,
              lockqty: ps.lockqty || 0,
              orderedqty: ps.orderedqty,
              soldqty: ps.soldqty,
              platformstatus: ps.platformstatus,
            });
          });

          // Group components by bundleproductid
          const componentsByBundle: Record<string, any[]> = {};
          allComponents.forEach((comp: any) => {
            const bundleId = comp.bundleproductid.toString();
            const componentId = comp.componentproductid.toString();
            if (!componentsByBundle[bundleId]) {
              componentsByBundle[bundleId] = [];
            }
            componentsByBundle[bundleId].push({
              componentproductid: Number(comp.componentproductid),
              requiredqty: comp.requiredqty,
              isactive: comp.isactive,
              product: {
                name: comp.componentproduct?.name || null,
                puc: comp.componentproduct?.puc || null,
              },
              platformStock: platformStockMap.get(componentId) || null,
            });
          });

          // Attach components to combo products
          products.forEach((product: any) => {
            if (product.iscombo === true) {
              const productId = product.id.toString();
              product.components = componentsByBundle[productId] || [];
            }
          });

          logger.info({
            comboProductCount: comboProductIds.length,
            totalComponents: allComponents.length
          }, 'Combo product components fetched successfully');
        } catch (componentError: any) {
          logger.error(
            {
              error: componentError?.message,
            },
            'Failed to fetch combo product components in findMany'
          );
          // Don't fail the request, just set empty arrays
          products.forEach((product: any) => {
            if (product.iscombo === true) {
              product.components = [];
            }
          });
        }
      }

      logger.info({
        productCount: products.length,
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: products.length > 0 ? Object.keys(products[0]) : [],
        comboProductCount: comboProductIds.length
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

      // If product is a combo, fetch component details from productbundlemap
      if ((product as any).iscombo === true) {
        try {
          const bundleProductId = BigInt(product.id);
          const components = await (prisma as any).productBundleMap.findMany({
            where: {
              bundleproductid: bundleProductId,
            },
            select: {
              componentproductid: true,
              requiredqty: true,
              isactive: true,
              componentproduct: {
                select: {
                  name: true,
                  puc: true,
                }
              }
            },
            orderBy: {
              id: 'asc', // Consistent ordering
            }
          });

          // Convert BigInt to number and include product details
          (product as any).components = components.map((comp: any) => ({
            componentproductid: Number(comp.componentproductid),
            requiredqty: comp.requiredqty,
            isactive: comp.isactive,
            product: {
              name: comp.componentproduct?.name || null,
              puc: comp.componentproduct?.puc || null,
            }
          }));

          logger.info({
            productId: id,
            componentCount: components.length
          }, 'Combo product components fetched successfully');
        } catch (componentError: any) {
          logger.error(
            {
              error: componentError?.message,
              productId: id,
            },
            'Failed to fetch combo product components'
          );
          // Don't fail the request, just set empty array
          (product as any).components = [];
        }
      }

      logger.debug({
        productId: id,
        availableFields: Object.keys(product),
        isCombo: (product as any).iscombo,
        componentCount: (product as any).iscombo ? ((product as any).components?.length || 0) : 0
      }, 'Dynamic product findById completed');

      return product;
    } catch (error) {
      logger.error({ error, productId: id }, 'Error in product findById operation');
      throw error;
    }
  }
  // Add these methods to ProductService class

  async findManyForPlatform(
    platform: string,
    filters: Record<string, any> = {},
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: any[]; pagination: any }> {
    try {
      const offset = (page - 1) * limit;

      // Build base query with platform stock join
      const whereClause = this.buildPlatformWhereClause(platform, filters);

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: whereClause,
          include: {
            platformStocks: {
              where: { platform },
              select: {
                id: true,
                platform: true,
                availableqty: true,
                platformstatus: true,
                soldqty: true,
                totalqty: true,
                orderedqty: true,
                lockqty: true,
              } as any,
              take: 1, // Only get one record since it's unique
            },
          },
          skip: offset,
          take: limit,
          orderBy: { createddate: 'desc' },
        }),
        prisma.product.count({ where: whereClause }),
      ]);

      // Fetch components for combo products
      const comboProductIds = products
        .filter((p: any) => p.iscombo === true)
        .map((p: any) => BigInt(p.id));

      if (comboProductIds.length > 0) {
        try {
          // Batch fetch all components for all combo products with product details
          const allComponents = await (prisma as any).productBundleMap.findMany({
            where: {
              bundleproductid: {
                in: comboProductIds
              }
            },
            select: {
              bundleproductid: true,
              componentproductid: true,
              requiredqty: true,
              isactive: true,
              componentproduct: {
                select: {
                  name: true,
                  puc: true,
                }
              }
            },
            orderBy: {
              id: 'asc',
            }
          });

          // Get all unique component product IDs
          const componentProductIds = [...new Set(allComponents.map((comp: any) => comp.componentproductid))];

          // Batch fetch platform stock for all component products (nivapp platform)
          const componentPlatformStocks = componentProductIds.length > 0
            ? await prisma.platformStock.findMany({
              where: {
                productid: { in: componentProductIds.map((id: any) => BigInt(id)) },
                platform: 'nivapp'
              },
              select: {
                productid: true,
                availableqty: true,
                lockqty: true,
                orderedqty: true,
                soldqty: true,
                platformstatus: true,
              }
            })
            : [];

          // Create a map of component product ID to platform stock
          const platformStockMap = new Map();
          componentPlatformStocks.forEach((ps: any) => {
            platformStockMap.set(ps.productid.toString(), {
              availableqty: ps.availableqty,
              lockqty: ps.lockqty || 0,
              orderedqty: ps.orderedqty,
              soldqty: ps.soldqty,
              platformstatus: ps.platformstatus,
            });
          });

          // Group components by bundleproductid
          const componentsByBundle: Record<string, any[]> = {};
          allComponents.forEach((comp: any) => {
            const bundleId = comp.bundleproductid.toString();
            const componentId = comp.componentproductid.toString();
            if (!componentsByBundle[bundleId]) {
              componentsByBundle[bundleId] = [];
            }
            componentsByBundle[bundleId].push({
              componentproductid: Number(comp.componentproductid),
              requiredqty: comp.requiredqty,
              isactive: comp.isactive,
              product: {
                name: comp.componentproduct?.name || null,
                puc: comp.componentproduct?.puc || null,
              },
              platformStock: platformStockMap.get(componentId) || null,
            });
          });

          // Attach components to combo products
          products.forEach((product: any) => {
            if (product.iscombo === true) {
              const productId = product.id.toString();
              product.components = componentsByBundle[productId] || [];
            }
          });

          logger.info({
            comboProductCount: comboProductIds.length,
            totalComponents: allComponents.length,
            platform
          }, 'Combo product components fetched successfully for platform');
        } catch (componentError: any) {
          logger.error(
            {
              error: componentError?.message,
              platform,
            },
            'Failed to fetch combo product components in findManyForPlatform'
          );
          // Don't fail the request, just set empty arrays
          products.forEach((product: any) => {
            if (product.iscombo === true) {
              product.components = [];
            }
          });
        }
      }

      return {
        data: products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: offset + limit < total,
          hasPrev: page > 1,
        },
      };
    } catch (error: any) {
      logger.error({ error: error.message, platform, filters }, 'Error in findManyForPlatform');
      throw error;
    }
  }

  async findByIdForPlatform(id: string, platform: string): Promise<any> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: BigInt(id) },
        include: {
          platformStocks: {
            where: { platform },
            select: {
              id: true,
              platform: true,
              availableqty: true,
              platformstatus: true,
              soldqty: true,
              totalqty: true,
              orderedqty: true,
              lockqty: true,
              createddate: true,
              modifieddate: true,
            } as any,
            take: 1, // Only get one record since it's unique
          },
        },
      });

      if (!product) {
        throw new Error(`Product with ID ${id} not found`);
      }

      // If product is a combo, fetch component details from productbundlemap
      if ((product as any).iscombo === true) {
        try {
          const bundleProductId = BigInt(product.id);
          const components = await (prisma as any).productBundleMap.findMany({
            where: {
              bundleproductid: bundleProductId,
            },
            select: {
              componentproductid: true,
              requiredqty: true,
              isactive: true,
              componentproduct: {
                select: {
                  name: true,
                  puc: true,
                }
              }
            },
            orderBy: {
              id: 'asc', // Consistent ordering
            }
          });

          // Get component product IDs
          const componentProductIds = components.map((comp: any) => comp.componentproductid);

          // Fetch platform stock for all component products (nivapp platform)
          const componentPlatformStocks = componentProductIds.length > 0
            ? await prisma.platformStock.findMany({
              where: {
                productid: { in: componentProductIds.map((id: any) => BigInt(id)) },
                platform: 'nivapp'
              },
              select: {
                productid: true,
                availableqty: true,
                lockqty: true,
                orderedqty: true,
                soldqty: true,
                platformstatus: true,
              }
            })
            : [];

          // Create a map of component product ID to platform stock
          const platformStockMap = new Map();
          componentPlatformStocks.forEach((ps: any) => {
            platformStockMap.set(ps.productid.toString(), {
              availableqty: ps.availableqty,
              lockqty: ps.lockqty || 0,
              orderedqty: ps.orderedqty,
              soldqty: ps.soldqty,
              platformstatus: ps.platformstatus,
            });
          });

          // Convert BigInt to number and include product details and platform stock
          (product as any).components = components.map((comp: any) => {
            const componentId = comp.componentproductid.toString();
            return {
              componentproductid: Number(comp.componentproductid),
              requiredqty: comp.requiredqty,
              isactive: comp.isactive,
              product: {
                name: comp.componentproduct?.name || null,
                puc: comp.componentproduct?.puc || null,
              },
              platformStock: platformStockMap.get(componentId) || null,
            };
          });

          logger.info({
            productId: id,
            platform,
            componentCount: components.length
          }, 'Combo product components fetched successfully for platform');
        } catch (componentError: any) {
          logger.error(
            {
              error: componentError?.message,
              productId: id,
              platform,
            },
            'Failed to fetch combo product components in findByIdForPlatform'
          );
          // Don't fail the request, just set empty array
          (product as any).components = [];
        }
      }

      return product;
    } catch (error: any) {
      logger.error({ error: error.message, id, platform }, 'Error in findByIdForPlatform');
      throw error;
    }
  }

  private buildPlatformWhereClause(platform: string, filters: Record<string, any>): any {
    const where: any = {};

    // Add platform stock existence filter
    where.platformStocks = {
      some: {
        platform,
      },
    };

    // Apply other filters
    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.subcategory) {
      where.subcategory = filters.subcategory;
    }

    if (filters.brand) {
      where.Brand = filters.brand;
    }

    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) {
        where.price.gte = parseFloat(filters.minPrice);
      }
      if (filters.maxPrice) {
        where.price.lte = parseFloat(filters.maxPrice);
      }
    }

    if (filters.stockStatus) {
      where.platformStocks = {
        some: {
          platform,
          platformstatus: filters.stockStatus,
        },
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { shortdescription: { contains: filters.search, mode: 'insensitive' } },
        { fulldescription: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.subsubcategory) {
      where.subsubcategory = filters.subsubcategory;
    }

    if (filters.isdealoftheday) {
      where.isdealoftheday = filters.isdealoftheday === 'true';
    }

    return where;
  }


  async create(data: CreateProductInput & Record<string, any>) {
    try {
      logger.debug({ originalData: data }, 'Starting dynamic product create operation');
      console.log(data);
      // Extract combo-related fields (components is only for create, not a product table field)
      const { components, ...productData } = data;
      const isCombo = productData.iscombo === true;

      // Validate: components should only be provided for combo products
      if (components && !isCombo) {
        throw new Error('Components can only be provided when iscombo is true. Remove components or set iscombo to true.');
      }

      // Validate combo product requirements
      if (isCombo) {
        if (!components || !Array.isArray(components) || components.length === 0) {
          throw new Error('Combo products require at least one component. Please provide components array.');
        }

        // Check for duplicate combo product with same components
        // Normalize components to handle string/number/bigint productid
        const normalizedComponents = components.map(c => ({
          productid: typeof c.productid === 'bigint' ? Number(c.productid) :
            typeof c.productid === 'string' ? c.productid : c.productid,
          requiredqty: c.requiredqty
        }));

        const existingCombo = await this.findExistingComboByComponents(normalizedComponents);
        if (existingCombo) {
          throw new Error(
            `A combo product with the same components already exists. ` +
            `Existing combo product ID: ${existingCombo.id}, Name: "${existingCombo.name}". ` +
            `Please use the existing combo product or modify the components.`
          );
        }

        // Validate component product IDs exist
        for (const component of components) {
          const componentId = typeof component.productid === 'string'
            ? BigInt(component.productid)
            : BigInt(component.productid);

          const componentProduct = await prisma.product.findUnique({
            where: { id: componentId }
          });

          if (!componentProduct) {
            throw new Error(`Component product with ID ${component.productid} does not exist`);
          }

          if ((componentProduct as any).iscombo === true) {
            throw new Error(`Component product ${component.productid} cannot be a combo product. Only single products can be components.`);
          }
        }

        // Set combo defaults
        productData.iscombo = true;
        productData.combotype = productData.combotype || 'fixed';
        // Combo products have no physical stock
        productData.quantity = 0;
        productData.availablequantity = 0;
        productData.ecompublishedquantity = 0;
      }

      const product = await dynamicCreate('product', productData);

      if (!product) {
        throw new Error('Failed to create product - no valid fields provided');
      }

      // Create platform stock for ALL products (including combo products)
      // Combo products still need platform stock records for tracking, even though availability is calculated dynamically
      try {
        await this.createDefaultPlatformStocks(product.id);
      } catch (platformStockError: any) {
        logger.error(
          {
            error: platformStockError?.message,
            productId: product.id,
          },
          'Failed to create default platform stock records; attempting to roll back product creation'
        );

        try {
          await dynamicDelete('product', { id: product.id });
        } catch (rollbackError: any) {
          logger.error(
            {
              error: rollbackError?.message,
              productId: product.id,
            },
            'Product rollback after platform stock failure did not complete'
          );
        }

        throw platformStockError;
      }

      // Create combo bundle map entries if this is a combo product
      if (isCombo && components) {
        try {
          const bundleProductId = BigInt(product.id);
          const currentTimestamp = BigInt(Date.now());

          for (const component of components) {
            const componentProductId = typeof component.productid === 'string'
              ? BigInt(component.productid)
              : BigInt(component.productid);

            await dynamicCreate('productbundlemap', {
              bundleproductid: bundleProductId,
              componentproductid: componentProductId,
              requiredqty: component.requiredqty,
              isactive: true,
              createddate: currentTimestamp,
              modifieddate: currentTimestamp,
            });
          }

          logger.info({
            productId: product.id,
            componentCount: components.length
          }, 'Combo product bundle map entries created successfully');
        } catch (bundleMapError: any) {
          logger.error(
            {
              error: bundleMapError?.message,
              productId: product.id,
            },
            'Failed to create bundle map entries; attempting to roll back product creation'
          );

          // Rollback: Delete product and platform stocks
          try {
            // Delete platform stocks
            await prisma.platformStock.deleteMany({
              where: { productid: BigInt(product.id) }
            });
            // Delete product
            await dynamicDelete('product', { id: product.id });
          } catch (rollbackError: any) {
            logger.error(
              {
                error: rollbackError?.message,
                productId: product.id,
              },
              'Product rollback after bundle map failure did not complete'
            );
          }

          throw new Error(`Failed to create combo bundle map: ${bundleMapError.message}`);
        }
      }

      logger.info({
        productId: product.id,
        availableFields: Object.keys(product),
        isCombo: isCombo,
        componentCount: isCombo ? components?.length : 0
      }, 'Dynamic product create completed');

      return product;
    } catch (error: any) {
      logger.error({
        error: error.message,
        errorCode: error.code,
        errorMeta: error.meta,
        originalData: data
      }, 'Error in product create operation');

      // Re-throw the original error to preserve specific error details
      throw error;
    }
  }

  async update(id: string, data: UpdateProductInput & Record<string, any>) {
    try {
      // Check if product exists
      const existingProduct = await this.findById(id);



      logger.debug({ originalData: data, productId: id }, 'Starting dynamic product update operation');

      // Silently extract and ignore combo-related fields from payload
      // These fields cannot be updated after product creation
      const { components, iscombo, combotype, ...updateData } = data;

      if (components || iscombo || combotype) {
        logger.debug({
          productId: id,
          skippedFields: {
            components: components,
            iscombo: iscombo,
            combotype: combotype
          }
        }, 'Silently skipping combo-related fields from update payload');
      }

      // Auto-set modified date
      updateData.modifieddate = updateData.modifieddate || Date.now();

      const product = await dynamicUpdate('product', { id }, updateData);

      if (!product) {
        throw new Error('Failed to update product - no valid fields provided');
      }

      logger.info({
        productId: id,
        productName: product.name,
        updatedFields: Object.keys(updateData)
      }, 'Dynamic product update completed successfully');

      return product;
    } catch (error: any) {
      logger.error({
        error: {
          message: error?.message || 'Unknown error',
          stack: error?.stack,
          code: error?.code,
          name: error?.name,
          fullError: error
        },
        data,
        productId: id
      }, 'Error in product update operation');
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
        return this.update(String(id), updateData);
      } else {
        // Create new product - ensure required fields are present
        logger.debug({ data: updateData }, 'Upserting new product');

        // Ensure required fields for creation
        const createData = {
          ...updateData,
          // Provide defaults if missing required fields
          name: updateData.name || 'TEMP-PRODUCT',
          puc: updateData.puc || 'TEMP-PUC'
        };

        return this.create(createData as CreateProductInput & Record<string, any>);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in product upsert operation');
      throw error;
    }
  }

  async updateStockTotals(productIdentifier: string, insertedStock?: { ecompublish?: boolean, stockstatus?: string, quantity?: number }, stockStatusChange?: { from: string, to: string }) {
    try {
      logger.debug({ productIdentifier }, 'Starting comprehensive stock totals update');

      // First, try to determine if productIdentifier is an ID or PUC and find the product
      let product = null;
      let productPuc = productIdentifier;
      let productId = productIdentifier;

      // Try to find product by ID first (if it's numeric)
      if (/^\d+$/.test(productIdentifier)) {
        try {
          product = await dynamicFindUnique('product', { id: productIdentifier });
          if (product && product.puc) {
            productPuc = product.puc;
            productId = product.id;
            logger.debug({ productIdentifier, productId, productPuc }, 'Found product by ID');
          }
        } catch (error) {
          logger.debug({ productIdentifier }, 'Could not find product by ID, will try by PUC');
        }
      }

      // If not found by ID or not numeric, try to find by PUC
      if (!product) {
        try {
          const products = await dynamicFindMany('product', {
            where: { puc: productIdentifier },
            take: 1
          });
          if (products && products.length > 0) {
            product = products[0];
            productPuc = product.puc;
            productId = product.id;
            logger.debug({ productIdentifier, productId, productPuc }, 'Found product by PUC');
          }
        } catch (error) {
          logger.warn({ productIdentifier }, 'Could not find product by PUC either');
        }
      }

      if (!product) {
        logger.warn({ productIdentifier }, 'Product not found, skipping stock totals update');
        return { totalQuantity: 0, totalAvailable: 0, totalSold: 0, totalEcomPublished: 0 };
      }

      // Find stocks by PUC (primary relationship) - only use active stocks
      const stocks = await dynamicFindMany('stock', {
        where: {
          puc: productPuc,
          isdeleted: { not: true },
          isarchive: { not: true }
        },
      });

      if (!Array.isArray(stocks) || stocks.length === 0) {
        logger.warn({ productIdentifier, productPuc, productId }, 'No active stocks found for product, setting quantities to zero');

        // Update product to zero quantities if no stocks found
        const updateData = {
          quantity: 0,
          availablequantity: 0,
          soldquantity: 0,
          ecompublishedquantity: 0,
          productstatus: 'out_of_stock',
          modifieddate: BigInt(Date.now())
        };

        await dynamicUpdate('product', { id: productId }, updateData);
        logger.info({ productIdentifier, productId }, 'Updated product quantities to zero (no active stocks found)');

        return { totalQuantity: 0, totalAvailable: 0, totalSold: 0, totalEcomPublished: 0 };
      }

      // Calculate totals based on stock records count (not stock.quantity field)
      let totalQuantity = 0;
      let totalAvailable = 0;
      let totalSold = 0;
      let totalEcomPublished = 0;

      stocks.forEach(stock => {
        // Count each stock record as 1 unit (not using stock.quantity field)
        totalQuantity += 1;

        if (stock.stockstatus?.toLowerCase() === 'available') {
          // Only count e-commerce published if stock is available AND ecompublish is true
          if (stock.ecompublish === true) {
            totalEcomPublished += 1;
            totalAvailable += 1; // Available quantity = stocks that are Available AND ecompublish=true
          }
          // Note: Available stocks with ecompublish=false are NOT counted in availablequantity
        } else if (stock.stockstatus?.toLowerCase() === 'sold') {
          totalSold += 1;
        }
        // Note: Damaged stocks are not counted in available or sold
      });

      const totals = {
        totalQuantity,
        totalAvailable, // Recalculated from actual stock data
        totalSold,
        totalEcomPublished
      };

      logger.info({
        productIdentifier,
        productId,
        productPuc,
        stockCount: stocks.length,
        totals,
        stockBreakdown: {
          totalStocks: stocks.length,
          availableAndEcomPublishedCount: totalAvailable, // Available AND ecompublish=true (for reference)
          soldCount: totalSold,
          ecomPublishedCount: totalEcomPublished,

          stockDetails: stocks.map(s => ({
            id: s.id,
            status: s.stockstatus,
            ecompublish: s.ecompublish,
            countsAsAvailable: s.stockstatus === 'Available' && s.ecompublish === true
          }))
        }
      }, 'Calculated stock totals - availablequantity will be calculated using business formula: ecompublishedquantity - orderedquantity - soldquantity');

      // Determine product status based on available quantity
      let productStatus = 'out_of_stock';
      if (totals.totalAvailable > 5) {
        productStatus = 'in_stock';
      } else if (totals.totalAvailable >= 1) {
        productStatus = 'low_stock';
      }

      // Handle orderedquantity decrease when stock changes to Sold
      let orderedQuantityAdjustment = 0;
      if (stockStatusChange &&
        stockStatusChange.from?.toLowerCase() !== 'sold' &&
        stockStatusChange.to?.toLowerCase() === 'sold') {
        // When stock changes to Sold, decrease orderedquantity by 1
        orderedQuantityAdjustment = -1;
        logger.info({
          productIdentifier,
          stockStatusChange,
          orderedQuantityAdjustment
        }, 'Stock status changed to Sold - will decrease orderedquantity');
      }

      // Calculate availablequantity using business formula: ecompublishedquantity - orderedquantity - soldquantity
      const currentOrderedQuantity = product.orderedquantity || 0;
      const orderedQuantityAfterAdjustment = orderedQuantityAdjustment !== 0
        ? Math.max(0, currentOrderedQuantity + orderedQuantityAdjustment)
        : currentOrderedQuantity;

      const calculatedAvailableQuantity = Math.max(0, totals.totalEcomPublished - orderedQuantityAfterAdjustment - totals.totalSold);

      // Update product with calculated totals
      const updateData: Record<string, any> = {
        quantity: totals.totalQuantity,
        availablequantity: calculatedAvailableQuantity, // Use business formula instead of totalAvailable
        soldquantity: totals.totalSold,
        ecompublishedquantity: totals.totalEcomPublished,
        productstatus: productStatus,
        modifieddate: BigInt(Date.now())
      };

      // Add orderedquantity adjustment if needed
      if (orderedQuantityAdjustment !== 0) {
        const currentOrderedQuantity = product.orderedquantity || 0;
        const newOrderedQuantity = Math.max(0, currentOrderedQuantity + orderedQuantityAdjustment);
        updateData.orderedquantity = newOrderedQuantity;

        logger.info({
          productIdentifier,
          currentOrderedQuantity,
          adjustment: orderedQuantityAdjustment,
          newOrderedQuantity
        }, 'Adjusting orderedquantity for stock status change to Sold');
      }

      const updatedProduct = await dynamicUpdate('product', { id: productId }, updateData);

      if (updatedProduct) {
        logger.info({
          productIdentifier,
          productId,
          productPuc,
          totals,
          productStatus,
          availableQuantityCalculation: {
            ecompublishedquantity: totals.totalEcomPublished,
            orderedquantity: orderedQuantityAfterAdjustment,
            soldquantity: totals.totalSold,
            calculatedAvailableQuantity
          },
          updatedFields: Object.keys(updateData)
        }, 'Updated product stock totals and status successfully - availablequantity calculated using business formula');
      } else {
        logger.warn({
          productIdentifier,
          productId,
          productPuc,
          totals,
          productStatus,
          attemptedFields: Object.keys(updateData)
        }, 'Could not update product - fields may not be available in schema');
      }

      return {
        ...totals,
        updatedProduct: updatedProduct || null
      };
    } catch (error) {
      logger.error({ error, productIdentifier }, 'Error in updateStockTotals operation');
      throw error;
    }
  }

  /**
   * Upsert product with file upload handling - merges image URLs into size arrays
   */
  async upsertProductWithFile(data: any) {
    try {
      const { productid, url, ...otherData } = data;
      let existingProductData: any = {};
      const upsertProductData: any = { ...otherData };

      // If productid is provided, fetch existing product data
      if (productid) {
        logger.debug({ productId: productid }, 'Fetching existing product for file upsert');
        existingProductData = await dynamicFindUnique('product', { id: productid });

        if (!existingProductData) {
          throw new Error(`Product with ID ${productid} not found`);
        }
      }

      // Handle image URL merging if url data is provided
      if (url) {
        logger.debug({
          productId: productid,
          urlData: url,
          existingLarge: existingProductData?.large,
          existingMedium: existingProductData?.medium,
          existingSmall: existingProductData?.small
        }, 'Processing image URL data for size arrays');

        // Merge large images
        if (url.Large && Array.isArray(url.Large)) {
          upsertProductData.large = existingProductData?.large
            ? [...(existingProductData.large || []), ...url.Large]
            : url.Large;
        }

        // Merge medium images
        if (url.Medium && Array.isArray(url.Medium)) {
          upsertProductData.medium = existingProductData?.medium
            ? [...(existingProductData.medium || []), ...url.Medium]
            : url.Medium;
        }

        // Merge small images
        if (url.Small && Array.isArray(url.Small)) {
          upsertProductData.small = existingProductData?.small
            ? [...(existingProductData.small || []), ...url.Small]
            : url.Small;
        }

        logger.debug({
          productId: productid,
          mergedLarge: upsertProductData.large,
          mergedMedium: upsertProductData.medium,
          mergedSmall: upsertProductData.small
        }, 'Image URL arrays merged successfully');
      }

      let result: any;

      if (productid) {
        // Update existing product
        logger.debug({ productId: productid, updateData: upsertProductData }, 'Updating existing product with file data');
        result = await this.update(productid, upsertProductData);
      } else {
        // Create new product
        logger.debug({ createData: upsertProductData }, 'Creating new product with file data');
        result = await this.create(upsertProductData);
      }

      logger.info({
        productId: productid || result?.id,
        operation: productid ? 'update' : 'create',
        hasImageData: !!url,
        imageArraysUpdated: {
          large: !!upsertProductData.large,
          medium: !!upsertProductData.medium,
          small: !!upsertProductData.small
        }
      }, 'Product upsert with file completed successfully');

      return {
        result,
        productid: productid || result?.id,
        pathurldatas: url || null
      };

    } catch (error: any) {
      logger.error({
        error: error.message,
        data,
        productId: data?.productid
      }, 'Error in product upsert with file operation');

      // Use the project's error handling pattern
      if (error.message.includes('not found')) {
        throw new Error(`Product with ID ${data?.productid} not found`);
      }

      throw error;
    }
  }

  /**
   * Rearrange image URLs within product arrays (large, medium, small)
   */
  async rearrangeProductImages(productId: string, rearrangeData: {
    large?: string[];
    medium?: string[];
    small?: string[];
  }) {
    try {
      logger.debug({ productId, rearrangeData }, 'Starting product image rearrangement');

      // Fetch existing product to validate
      const existingProduct = await dynamicFindUnique('product', { id: productId });
      if (!existingProduct) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      // Validate that provided arrays contain the same URLs as existing arrays
      const updateData: any = {};

      if (rearrangeData.large) {
        const existingLarge = existingProduct.large || [];
        if (!this.arraysContainSameElements(rearrangeData.large, existingLarge)) {
          throw new Error('Large array rearrangement must contain exactly the same URLs as existing array');
        }
        updateData.large = rearrangeData.large;
      }

      if (rearrangeData.medium) {
        const existingMedium = existingProduct.medium || [];
        if (!this.arraysContainSameElements(rearrangeData.medium, existingMedium)) {
          throw new Error('Medium array rearrangement must contain exactly the same URLs as existing array');
        }
        updateData.medium = rearrangeData.medium;
      }

      if (rearrangeData.small) {
        const existingSmall = existingProduct.small || [];
        if (!this.arraysContainSameElements(rearrangeData.small, existingSmall)) {
          throw new Error('Small array rearrangement must contain exactly the same URLs as existing array');
        }
        updateData.small = rearrangeData.small;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No valid rearrangement data provided');
      }

      // Update the product with rearranged arrays
      const result = await this.update(productId, updateData);

      logger.info({
        productId,
        rearrangedArrays: Object.keys(updateData),
        arrayLengths: {
          large: updateData.large?.length,
          medium: updateData.medium?.length,
          small: updateData.small?.length
        }
      }, 'Product image rearrangement completed successfully');

      return result;

    } catch (error: any) {
      logger.error({
        error: error.message,
        productId,
        rearrangeData
      }, 'Error in product image rearrangement operation');
      throw error;
    }
  }

  /**
   * Helper method to check if two arrays contain the same elements (order doesn't matter)
   */
  private arraysContainSameElements(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) return false;

    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();

    return sorted1.every((val, index) => val === sorted2[index]);
  }

  /**
   * Delete specific URLs from product image arrays
   */
  async deleteProductImageUrls(productId: string, deleteData: {
    large?: string[];
    medium?: string[];
    small?: string[];
  }) {
    try {
      logger.debug({ productId, deleteData }, 'Starting product image URL deletion');

      // Fetch existing product to validate
      const existingProduct = await dynamicFindUnique('product', { id: productId });
      if (!existingProduct) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      const updateData: any = {};
      const deletionSummary: any = {};

      // Process large array deletions
      if (deleteData.large && deleteData.large.length > 0) {
        const existingLarge = existingProduct.large || [];
        const filteredLarge = existingLarge.filter((url: string) => !deleteData.large!.includes(url));

        if (filteredLarge.length === existingLarge.length) {
          logger.warn({ productId, urlsToDelete: deleteData.large }, 'No matching URLs found in large array');
        } else {
          updateData.large = filteredLarge;
          deletionSummary.large = {
            before: existingLarge.length,
            after: filteredLarge.length,
            deleted: existingLarge.length - filteredLarge.length
          };
        }
      }

      // Process medium array deletions
      if (deleteData.medium && deleteData.medium.length > 0) {
        const existingMedium = existingProduct.medium || [];
        const filteredMedium = existingMedium.filter((url: string) => !deleteData.medium!.includes(url));

        if (filteredMedium.length === existingMedium.length) {
          logger.warn({ productId, urlsToDelete: deleteData.medium }, 'No matching URLs found in medium array');
        } else {
          updateData.medium = filteredMedium;
          deletionSummary.medium = {
            before: existingMedium.length,
            after: filteredMedium.length,
            deleted: existingMedium.length - filteredMedium.length
          };
        }
      }

      // Process small array deletions
      if (deleteData.small && deleteData.small.length > 0) {
        const existingSmall = existingProduct.small || [];
        const filteredSmall = existingSmall.filter((url: string) => !deleteData.small!.includes(url));

        if (filteredSmall.length === existingSmall.length) {
          logger.warn({ productId, urlsToDelete: deleteData.small }, 'No matching URLs found in small array');
        } else {
          updateData.small = filteredSmall;
          deletionSummary.small = {
            before: existingSmall.length,
            after: filteredSmall.length,
            deleted: existingSmall.length - filteredSmall.length
          };
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No URLs were found to delete from the specified arrays');
      }

      // Update the product with filtered arrays
      const result = await this.update(productId, updateData);

      logger.info({
        productId,
        deletionSummary,
        totalDeleted: Object.values(deletionSummary).reduce((sum: number, info: any) => sum + info.deleted, 0)
      }, 'Product image URL deletion completed successfully');

      return {
        product: result,
        deletionSummary
      };

    } catch (error: any) {
      logger.error({
        error: error.message,
        productId,
        deleteData
      }, 'Error in product image URL deletion operation');
      throw error;
    }
  }

  /**
   * Calculate platform status based on available quantity
   * @param availableqty - Available quantity
   * @returns Platform status string
   */
  private calculatePlatformStatus(availableqty: number): string {
    if (availableqty === 0) {
      return 'out_of_stock';
    } else if (availableqty > 5) {
      return 'in_stock';
    } else {
      return 'low_stock';
    }
  }

  /**
   * Update platform stock status based on available quantity
   * @param productId - Product ID
   * @param platform - Platform name
   * @param availableqty - Available quantity
   */
  private async updatePlatformStockStatus(productId: number | string, platform: string, availableqty: number): Promise<void> {
    try {
      const numericId = typeof productId === 'string' ? parseInt(productId, 10) : Number(productId);
      const platformStatus = this.calculatePlatformStatus(availableqty);

      await prisma.platformStock.updateMany({
        where: {
          productid: BigInt(numericId),
          platform: platform
        },
        data: {
          platformstatus: platformStatus,
          modifieddate: BigInt(Date.now())
        } as any
      });

      logger.debug({
        productId: numericId,
        platform,
        availableqty,
        platformStatus
      }, 'Updated platform stock status');
    } catch (error: any) {
      logger.error({
        error: error.message,
        productId,
        platform,
        availableqty
      }, 'Error updating platform stock status');
      throw error;
    }
  }

  /**
   * Check if a combo product with the same components already exists
   * @param components - Array of components to check
   * @returns Existing combo product if found, null otherwise
   */
  async findExistingComboByComponents(components: Array<{ productid: string | number | bigint; requiredqty: number }>): Promise<any | null> {
    try {
      // Normalize and sort components for comparison
      const normalizedComponents = components
        .map(c => ({
          componentproductid: typeof c.productid === 'string' ? BigInt(c.productid) : BigInt(c.productid),
          requiredqty: c.requiredqty
        }))
        .sort((a, b) => {
          // Sort by componentproductid first, then by requiredqty
          if (a.componentproductid < b.componentproductid) return -1;
          if (a.componentproductid > b.componentproductid) return 1;
          return a.requiredqty - b.requiredqty;
        });

      if (normalizedComponents.length === 0) {
        return null;
      }

      // Get all combo products using raw query since iscombo might not be in Prisma schema
      const comboProducts = await prisma.$queryRaw<Array<{
        id: bigint;
        name: string;
      }>>`
        SELECT id, name
        FROM product
        WHERE iscombo = true
      `;

      if (comboProducts.length === 0) {
        return null;
      }

      // Check each combo product for matching components
      for (const comboProduct of comboProducts) {
        // Get bundle map entries for this combo
        const bundleMaps = await prisma.$queryRaw<Array<{
          componentproductid: bigint;
          requiredqty: number;
        }>>`
          SELECT componentproductid, requiredqty
          FROM productbundlemap
          WHERE bundleproductid = ${BigInt(comboProduct.id)}
            AND isactive = true
          ORDER BY componentproductid, requiredqty
        `;

        if (bundleMaps.length !== normalizedComponents.length) {
          continue; // Different number of components
        }

        // Compare components
        const existingComponents = bundleMaps
          .map(bm => ({
            componentproductid: bm.componentproductid,
            requiredqty: bm.requiredqty
          }))
          .sort((a, b) => {
            if (a.componentproductid < b.componentproductid) return -1;
            if (a.componentproductid > b.componentproductid) return 1;
            return a.requiredqty - b.requiredqty;
          });

        // Check if all components match
        const isMatch = normalizedComponents.every((nc, index) => {
          const ec = existingComponents[index];
          return ec &&
            ec.componentproductid === nc.componentproductid &&
            ec.requiredqty === nc.requiredqty;
        });

        if (isMatch) {
          return {
            id: Number(comboProduct.id),
            name: comboProduct.name,
            components: existingComponents.map(ec => ({
              productid: Number(ec.componentproductid),
              requiredqty: ec.requiredqty
            }))
          };
        }
      }

      return null;
    } catch (error: any) {
      logger.error(
        { error: error.message, components },
        'Error checking for existing combo product'
      );
      // Don't throw - allow creation to proceed if check fails
      return null;
    }
  }

  /**
   * Validate combo components before creation (public method for validation endpoint)
   * @param components - Array of components to validate
   * @returns Validation result with existing combo info if found
   */
  async validateComboComponents(components: Array<{ productid: string | number; requiredqty: number }>): Promise<{
    isValid: boolean;
    existingCombo?: {
      id: number;
      name: string;
      components: Array<{ productid: number; requiredqty: number }>;
    };
    message: string;
  }> {
    try {
      if (!components || !Array.isArray(components) || components.length === 0) {
        return {
          isValid: false,
          message: 'Components array is required and must not be empty'
        };
      }

      // Validate component product IDs exist
      for (const component of components) {
        const componentId = typeof component.productid === 'string'
          ? BigInt(component.productid)
          : BigInt(component.productid);

        const componentProduct = await prisma.product.findUnique({
          where: { id: componentId }
        });

        if (!componentProduct) {
          return {
            isValid: false,
            message: `Component product with ID ${component.productid} does not exist`
          };
        }

        if ((componentProduct as any).iscombo === true) {
          return {
            isValid: false,
            message: `Component product ${component.productid} cannot be a combo product. Only single products can be components.`
          };
        }
      }

      // Check for duplicate
      const existingCombo = await this.findExistingComboByComponents(components);
      if (existingCombo) {
        return {
          isValid: false,
          existingCombo: {
            id: existingCombo.id,
            name: existingCombo.name,
            components: existingCombo.components
          },
          message: `A combo product with the same components already exists (ID: ${existingCombo.id}, Name: "${existingCombo.name}")`
        };
      }

      return {
        isValid: true,
        message: 'Components are valid and no duplicate combo product found'
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, components },
        'Error validating combo components'
      );
      return {
        isValid: false,
        message: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Get product counts grouped by category and subcategory for a specific platform
   * Includes all categories and subcategories from picklist, even those with 0 products
   */
  async getProductCountsByCategory(platform: string): Promise<{
    platform: string;
    totalProducts: number;
    categories: Array<{
      id: string;
      label: string;
      count: number;
      subcategories: Array<{
        id: string;
        label: string;
        count: number;
        subsubcategories: Array<{
          id: string;
          label: string;
          count: number;
        }>;
      }>;
    }>;
  }> {
    try {
      logger.info({ platform }, 'Getting product counts by category for platform');

      // Step 1: Fetch all categories from picklist
      const categories = await prisma.picklist.findMany({
        where: {
          fieldname: 'category',
          object: 'product',
        },
        select: {
          value: true,
          label: true,
        },
      });

      // Step 2: Fetch all subcategories from picklist with their parent category
      const subcategories = await prisma.picklist.findMany({
        where: {
          fieldname: 'subcategory',
          object: 'product',
        },
        select: {
          value: true,
          label: true,
          controlledvalue: true, // This is the parent category
        },
      });

      // Step 3: Fetch all subsubcategories from picklist with their parent subcategory
      const subsubcategories = await prisma.picklist.findMany({
        where: {
          fieldname: 'subsubcategory',
          object: 'product',
        },
        select: {
          value: true,
          label: true,
          controlledvalue: true, // This is the parent subcategory
        },
      });

      // Step 4: Get actual product counts grouped by category, subcategory, and subsubcategory
      // Using Prisma ORM groupBy instead of raw SQL
      const productCounts = await prisma.product.groupBy({
        by: ['category', 'subcategory', 'subsubcategory'],
        where: {
          platformStocks: {
            some: {
              platform,
            },
          },
        },
        _count: {
          id: true,
        },
      });

      // Step 4: Create a map of actual counts
      const countsMap = new Map<string, number>();
      let totalProducts = 0;

      for (const row of productCounts) {
        const category = row.category || '';
        const subcategory = row.subcategory || '';
        const count = row._count.id; // Prisma groupBy returns _count object
        const key = `${category}::${subcategory}`;
        countsMap.set(key, count);
        totalProducts += count;
      }

      // Step 5: Build the response structure with all categories, subcategories, and subsubcategories
      const categoryMap = new Map<string, {
        id: string;
        label: string;
        count: number;
        subcategories: Map<string, {
          id: string;
          label: string;
          count: number;
          subsubcategories: Array<{ id: string; label: string; count: number }>;
        }>;
      }>();

      // Initialize all categories with 0 count
      for (const cat of categories) {
        if (!cat.value || !cat.label) continue; // Skip if value or label is null

        categoryMap.set(cat.value, {
          id: cat.value,
          label: cat.label,
          count: 0,
          subcategories: new Map(),
        });
      }

      // Add all subcategories to their parent categories
      for (const subcat of subcategories) {
        // Skip if essential fields are null
        if (!subcat.value || !subcat.label || !subcat.controlledvalue) continue;

        const parentCategory = subcat.controlledvalue; // This is the parent category value

        if (categoryMap.has(parentCategory)) {
          const categoryEntry = categoryMap.get(parentCategory)!;

          categoryEntry.subcategories.set(subcat.value, {
            id: subcat.value,
            label: subcat.label,
            count: 0,
            subsubcategories: [],
          });
        }
      }

      // Add all subsubcategories to their parent subcategories
      for (const subsubcat of subsubcategories) {
        // Skip if essential fields are null
        if (!subsubcat.value || !subsubcat.label || !subsubcat.controlledvalue) continue;

        const parentSubcategory = subsubcat.controlledvalue; // This is the parent subcategory value

        // Find which category contains this subcategory
        for (const categoryEntry of categoryMap.values()) {
          if (categoryEntry.subcategories.has(parentSubcategory)) {
            const subcategoryEntry = categoryEntry.subcategories.get(parentSubcategory)!;

            subcategoryEntry.subsubcategories.push({
              id: subsubcat.value,
              label: subsubcat.label,
              count: 0,
            });

            break; // Found the parent, no need to continue
          }
        }
      }

      // Now update counts based on actual product data
      for (const row of productCounts) {
        const category = row.category || '';
        const subcategory = row.subcategory || '';
        const subsubcategory = row.subsubcategory || '';
        const count = Number(row._count.id);

        if (categoryMap.has(category)) {
          const categoryEntry = categoryMap.get(category)!;

          if (categoryEntry.subcategories.has(subcategory)) {
            const subcategoryEntry = categoryEntry.subcategories.get(subcategory)!;

            // If there's a subsubcategory, update its count
            if (subsubcategory) {
              const subsubcatEntry = subcategoryEntry.subsubcategories.find(s => s.id === subsubcategory);
              if (subsubcatEntry) {
                subsubcatEntry.count += count;
              }
            }

            // Always update subcategory and category counts
            subcategoryEntry.count += count;
            categoryEntry.count += count;
          }
        }
      }

      // Convert map to array and sort
      const categoriesArray = Array.from(categoryMap.values())
        .sort((a, b) => a.label.localeCompare(b.label))
        .map(cat => ({
          id: cat.id,
          label: cat.label,
          count: cat.count,
          subcategories: Array.from(cat.subcategories.values())
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(subcat => ({
              id: subcat.id,
              label: subcat.label,
              count: subcat.count,
              subsubcategories: subcat.subsubcategories.sort((a, b) => a.label.localeCompare(b.label)),
            })),
        }));

      logger.info({
        platform,
        totalProducts,
        categoryCount: categoriesArray.length,
        totalSubcategories: subcategories.length,
        totalSubsubcategories: subsubcategories.length,
      }, 'Product counts by category retrieved successfully');

      return {
        platform,
        totalProducts,
        categories: categoriesArray,
      };
    } catch (error: any) {
      logger.error({ error: error.message, platform }, 'Error getting product counts by category');
      throw error;
    }
  }

  /**
   * Format a category/subcategory ID into a human-readable label
   * Example: "home_fragrance" -> "Home Fragrance"
   */
  private formatLabel(id: string): string {
    if (!id) return '';

    return id
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }


  private async createDefaultPlatformStocks(productId: number | string) {
    const numericId = typeof productId === 'string' ? parseInt(productId, 10) : Number(productId);

    if (!Number.isFinite(numericId)) {
      logger.warn({ productId }, 'Skipping default platform stock creation due to invalid product ID');
      return;
    }

    const platformStockDefaults = {
      productid: numericId,
      availableqty: 0,
      orderedqty: 0,
      soldqty: 0,
      totalqty: 0,
      lockqty: 0,
      platformstatus: this.calculatePlatformStatus(0), // Calculate status based on availableqty = 0
    };

    for (const platform of DEFAULT_PLATFORM_STOCK_PLATFORMS) {
      try {
        const existing = await prisma.platformStock.findUnique({
          where: {
            productid_platform: {
              productid: BigInt(numericId),
              platform,
            },
          },
        });

        if (existing) {
          logger.debug({ productId: numericId, platform }, 'Default platform stock already present, skipping creation');
          continue;
        }

        await dynamicCreate('platformstock', {
          ...platformStockDefaults,
          platform,
        });

        logger.info({ productId: numericId, platform }, 'Default platform stock created');
      } catch (error: any) {
        logger.error(
          {
            error: error?.message,
            productId: numericId,
            platform,
          },
          'Error while creating default platform stock'
        );
        throw error;
      }
    }
  }
}
