import { query } from "../database/postgres.js"
import dataTypeCheck from "../utils/Datatype/checkDatatype.js";
import { QueryResult } from "pg";
import imageResize from "../imageResize/imageRessize.js";
import { ErrorHandler } from "../errorHandler/errorHandler.js";
import { cartservice } from "./cart.service.js";
import { performance } from 'perf_hooks';
import { QueryBuilder } from "../utils/QueryBuilder.js";
import { 
  ProductQueryParams, 
  ProductServiceResponse, 
  ProductQuantityData,
  ProductBatchData,
  ProductLockData
} from "../interfaces/product.interface.js";
import { 
  DEFAULT_PAGE_SIZE, 
  DEFAULT_PAGE_NUMBER, 
  PRODUCT_STATUS,
  STOCK_THRESHOLDS
} from "../constants/product.constants.js";
import { Storage } from '@google-cloud/storage';

export class ProductRevoService {
  private readonly tableName = 'product_revo';
  private queryBuilder: QueryBuilder;
  private storage: Storage;

  constructor() {
    this.queryBuilder = new QueryBuilder(this.tableName);
    this.storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE
    });
  }

  public async getProductsData(request: ProductQueryParams): Promise<ProductServiceResponse> {
    try {
      console.log('inside getProductsData')
      const queryBuilder = new QueryBuilder(this.tableName);
      queryBuilder.buildWhereClause(request);
      const { query: queryText, params: queryParams } = queryBuilder.buildQuery(
        parseInt(request.page?.toString()) || DEFAULT_PAGE_NUMBER,
        parseInt(request.count?.toString()) || DEFAULT_PAGE_SIZE
      );

      const result = await query(queryText, queryParams);
      console.log(result, 'result in getProductsData')
      return result.rows;
    } catch (error) {
      console.log(error, 'error in getProductsData')
      return await ErrorHandler.handleQueryError(error);
    }
  }

  public async getEcomProducts(request: ProductQueryParams): Promise<ProductServiceResponse> {
    try {
      const pageNumber = parseInt(request.page?.toString()) || DEFAULT_PAGE_NUMBER;
      const recordCount = parseInt(request.count?.toString()) || DEFAULT_PAGE_SIZE;

      const queryBuilder = new QueryBuilder(this.tableName);
      queryBuilder.buildWhereClause(request);
      const { query: queryText, params: queryParams } = queryBuilder.buildQuery(pageNumber, recordCount);

      const result = await query(queryText, queryParams);
      return await dataTypeCheck(result);
    } catch (error) {
      console.error("Query Execution Error: IN getEcomProducts", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  public async getSimilarProducts(request: ProductQueryParams): Promise<ProductServiceResponse> {
    try {
      const pageNumber = parseInt(request.page?.toString()) || DEFAULT_PAGE_NUMBER;
      const recordCount = parseInt(request.count?.toString()) || DEFAULT_PAGE_SIZE;

      const queryBuilder = new QueryBuilder(this.tableName);
      queryBuilder.buildWhereClause(request);
      const { query: queryText, params: queryParams } = queryBuilder.buildQuery(pageNumber, recordCount);

      const result = await query(queryText, queryParams);

      if (result.rows.length <= 1) {
        return await this.getLatestProducts(request, pageNumber, recordCount);
      }

      return await dataTypeCheck(result);
    } catch (error) {
      console.error("Query Execution Error: IN getSimilarProducts", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  private async getLatestProducts(request: ProductQueryParams, pageNumber: number, recordCount: number): Promise<ProductServiceResponse> {
    const offset = (pageNumber - 1) * recordCount;
    const queryParams: any[] = [];
    let queryText = '';

    Object.entries(request).forEach(([key, value]) => {
      if (key === 'subcategory') {
        const paramValues = Array.isArray(value) ? value : [value];
        const clauses = paramValues.map(() => `${key} = $1`);
        queryText = `SELECT * FROM products WHERE (${clauses.join(' OR ')}) AND (isarchive = FALSE OR isarchive IS NULL) AND (isdeleted = FALSE OR isdeleted IS NULL) AND (removefromrecyclebin = FALSE OR removefromrecyclebin IS NULL) ORDER BY modifieddate DESC OFFSET $2 LIMIT $3`;
        queryParams.push(...paramValues, offset, recordCount);
      }
    });

    const result = await query(queryText, queryParams);
    return await dataTypeCheck(result);
  }

  public async deleteProduct(id: number): Promise<ProductServiceResponse> {
    try {
      const result = await this.queryBuilder.executeQuery(
        `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`,
        [id]
      );
      return {
        success: true,
        rows: result.rows
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Failed to delete product',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  public async upsertProduct(productData: any): Promise<ProductServiceResponse> {
    try {
      const { id, ...upsertFields } = productData;
      const fieldNames = Object.keys(upsertFields);
      const fieldValues = Object.values(upsertFields);

      let queryText: string;
      let params: any[];

      if (id) {
        queryText = `UPDATE ${this.tableName} SET ${fieldNames
          .map((field, index) => `${field} = $${index + 1}`)
          .join(', ')} WHERE id = $${fieldNames.length + 1} RETURNING *`;
        params = [...fieldValues, id];
      } else {
        queryText = `INSERT INTO ${this.tableName} (${fieldNames.join(', ')}) 
          VALUES (${fieldNames.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`;
        params = fieldValues;
      }

      return await query(queryText, params);
    } catch (error) {
      console.error("Query Execution Error: IN upsertProduct", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  public async upsertQuantityFields(data: ProductQuantityData, orderedQuantity: number, isSold: boolean): Promise<ProductServiceResponse> {
    try {
      const { quantity, ecompublishedquantity, soldquantity, availablequantity, puc } = data;
      const productStatus = this.determineProductStatus(availablequantity);

      const updateQueryBase = `UPDATE ${this.tableName} SET 
        quantity = $1, 
        ecompublishedquantity = $2, 
        soldquantity = $3, 
        availablequantity = $4, 
        productstatus = $5`;

      let updateQuery = '';
      let updateParams: any[];

      if (isSold && !isNaN(orderedQuantity)) {
        updateQuery = `${updateQueryBase}, orderedquantity = orderedquantity - $6 WHERE puc = $7 RETURNING *`;
        updateParams = [quantity, ecompublishedquantity, soldquantity, availablequantity, productStatus, orderedQuantity, puc];
      } else {
        updateQuery = `${updateQueryBase} WHERE puc = $6 RETURNING *`;
        updateParams = [quantity, ecompublishedquantity, soldquantity, availablequantity, productStatus, puc];
      }

      const updateResult = await query(updateQuery, updateParams);
      const cartData = {
        productid: updateResult.rows[0].id,
        availablequantity
      };

      const updateCartQuantity = await cartservice.upsertCartQuantity(cartData);
      
      if (updateCartQuantity?.command === 'UPDATE' || updateCartQuantity === null) {
        return updateResult.rows[0];
      }

      return {
        product: updateResult.rows[0],
        cart: 'Problem In Cart Quantity Updates. Please contact support Team'
      };
    } catch (error) {
      console.error("Query Execution Error: IN upsertQuantityFields", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  private determineProductStatus(availableQuantity: number): string {
    if (availableQuantity > STOCK_THRESHOLDS.LOW_STOCK_MAX) {
      return PRODUCT_STATUS.IN_STOCK;
    } else if (availableQuantity > STOCK_THRESHOLDS.OUT_OF_STOCK) {
      return PRODUCT_STATUS.LOW_STOCK;
    }
    return PRODUCT_STATUS.OUT_OF_STOCK;
  }

  public async bulkupsertProducttosetZero(request: any): Promise<ProductServiceResponse> {
    try {
      const { data, setZero } = request.body;
      const query = `
        UPDATE ${this.tableName}
        SET lock_qty = CASE 
          WHEN $1 = true THEN 0
          ELSE lock_qty + orderedquantity
        END
        WHERE id = ANY($2)
        RETURNING *
      `;
      const result = await this.queryBuilder.executeQuery(query, [setZero, data.map((item: any) => item.id)]);
      return {
        success: true,
        rows: result.rows
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Failed to update product quantities',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  public async getArcheivedProductsrevo(request: any): Promise<ProductServiceResponse> {
    try {
      const pageNumber = parseInt(request.page?.toString()) || DEFAULT_PAGE_NUMBER;
      const recordCount = parseInt(request.count?.toString()) || DEFAULT_PAGE_SIZE;
      const offset = (pageNumber - 1) * recordCount;

      const query = `
        SELECT * FROM ${this.tableName}
        WHERE status = 'archived'
        ORDER BY id DESC
        LIMIT $1 OFFSET $2
      `;
      const result = await this.queryBuilder.executeQuery(query, [recordCount, offset]);
      return {
        success: true,
        rows: result.rows
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Failed to fetch archived products',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  public async getEachProductsRevo(id: number): Promise<ProductServiceResponse> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE id = $1
      `;
      const result = await this.queryBuilder.executeQuery(query, [id]);
      return {
        success: true,
        rows: result.rows
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Failed to fetch product',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  public async updateOrderedQuantityarray(request: any): Promise<ProductServiceResponse> {
    try {
      const { data } = request.body;
      const query = `
        UPDATE ${this.tableName}
        SET orderedquantity = CASE id
          ${data.map((item: any, index: number) => `WHEN ${item.id} THEN ${item.orderedquantity}`).join(' ')}
          ELSE orderedquantity
        END
        WHERE id = ANY($1)
        RETURNING *
      `;
      const result = await this.queryBuilder.executeQuery(query, [data.map((item: any) => item.id)]);
      return {
        success: true,
        rows: result.rows
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Failed to update ordered quantities',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  public async upsertProductwithFileRevo(request: any): Promise<ProductServiceResponse> {
    try {
      const { productid } = request.params;
      let existingProductData = await this.queryBuilder.executeQuery(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [productid]
      );
      let data = existingProductData.rows[0] || {};
      let imageData;

      if (request.files) {
        imageData = await imageResize(request);
        const upsertProductData = {
          large: data?.large ? [...data.large, ...imageData.url.Large] : imageData.url.Large,
          medium: data?.medium ? [...data.medium, ...imageData.url.Medium] : imageData.url.Medium,
          small: data?.small ? [...data.small, ...imageData.url.Small] : imageData.url.Small
        };

        const fieldNames = Object.keys(upsertProductData);
        const fieldValues = Object.values(upsertProductData);

        const queryText = `UPDATE ${this.tableName} SET ${fieldNames
          .map((field, index) => `${field} = $${index + 1}`)
          .join(', ')} WHERE id = $${fieldNames.length + 1} RETURNING *`;

        const result = await this.queryBuilder.executeQuery(queryText, [...fieldValues, Number(productid)]);
        return { 
          success: true,
          rows: result.rows,
          productid,
          pathurldatas: imageData?.path || null 
        };
      }

      return { 
        success: false,
        errorMessage: 'No files to process',
        statusCode: 400
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Failed to process file upload',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  public async upsertProductwithfileRevogcp(request: any): Promise<ProductServiceResponse> {
    try {
      const { productid } = request.body;
      let existingProductData = await this.queryBuilder.executeQuery(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [productid]
      );
      let data = existingProductData.rows[0] || {};

      if (request.body.url) {
        const imageData = request.body;
        const upsertProductData = {
          large: data?.large ? [...data.large, ...imageData.url.Large] : imageData.url.Large,
          medium: data?.medium ? [...data.medium, ...imageData.url.Medium] : imageData.url.Medium,
          small: data?.small ? [...data.small, ...imageData.url.Small] : imageData.url.Small
        };

        const fieldNames = Object.keys(upsertProductData);
        const fieldValues = Object.values(upsertProductData);

        const queryText = `UPDATE ${this.tableName} SET ${fieldNames
          .map((field, index) => `${field} = $${index + 1}`)
          .join(', ')} WHERE id = $${fieldNames.length + 1} RETURNING *`;

        const result = await this.queryBuilder.executeQuery(queryText, [...fieldValues, Number(productid)]);
        return {
          success: true,
          rows: result.rows,
          productid,
          pathurldatas: imageData?.url || null 
        };
      }

      return { 
        success: false,
        errorMessage: 'No URL data to process',
        statusCode: 400
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Failed to process GCP file upload',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  public async rearrangeImageRevo(request: any): Promise<ProductServiceResponse> {
    try {
      const { productid, image } = request.body;
      const query = `
        UPDATE ${this.tableName}
        SET image = $1
        WHERE id = $2
        RETURNING *
      `;
      const result = await this.queryBuilder.executeQuery(query, [image, productid]);
      return {
        success: true,
        rows: result.rows
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Failed to rearrange images',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  public async updateRemoveFromRecyclebinRevo(id: number): Promise<ProductServiceResponse> {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET status = 'active'
        WHERE id = $1
            RETURNING *
        `;
      const result = await this.queryBuilder.executeQuery(query, [id]);
        return {
        success: true,
        rows: result.rows
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Failed to restore product from recycle bin',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  private async uploadFileToGcp(filePath: string, fileName: string): Promise<string> {
    try {
      const bucket = this.storage.bucket(process.env.GCP_BUCKET_NAME || '');
      const blob = bucket.file(`products/${Date.now()}-${fileName}`);
      
      await blob.save(filePath, {
        metadata: {
          contentType: 'image/jpeg'
        }
      });

      await blob.makePublic();
      return blob.publicUrl();
    } catch (error) {
      throw new Error(`Failed to upload file to GCP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getProductById(id: number): Promise<ProductServiceResponse> {
    try {
      const result = await this.queryBuilder.executeQuery(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      return {
        success: true,
        rows: result.rows
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: 'Failed to fetch product',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }
}

export const productrevoService = new ProductRevoService();