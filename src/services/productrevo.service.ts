import { Pool } from "pg";
import dataTypeCheck from "../utils/Datatype/checkDatatype.js";
import imageResize from "../imageResize/imageRessize.js";
import { ErrorHandler } from "../errorHandler/errorHandler.js";
import {
  ProductServiceResponse,
  ProductFileResponse,
  ProductErrorResponse,
  ProductServiceResult,
  ProductQueryParams,
  ProductData,
  BatchUpdateData,
  ImageData
} from "../interfaces/product.interface.js";
import pool from "../database/postgres.js";

export class ProductRevoService {
  constructor(private readonly db: Pool = pool) {}

  private readonly TIMEOUT_THRESHOLD = 5000;

  /**
   * Get all products with pagination and filtering
   */
  public async getproductsData(request: { query: ProductQueryParams }): Promise<ProductServiceResult> {
    try {
      const { pageNumber, recordCount, whereClauses, queryParams, orderByField, orderByDirection } =
        this.buildQueryParameters(request.query);

      const baseConditions = `(isarchive = FALSE OR isarchive IS NULL) AND (isdeleted = FALSE OR isdeleted IS NULL) AND (removefromrecyclebin = FALSE OR removefromrecyclebin IS NULL)`;
      const whereClause = whereClauses.length > 0
        ? `WHERE ${whereClauses.join(" AND ")} AND ${baseConditions}`
        : `WHERE ${baseConditions}`;

      const orderByClause = `ORDER BY ${orderByField} ${orderByDirection}`;
      const offset = (pageNumber - 1) * recordCount;

      let queryText = `SELECT * FROM product_revo ${whereClause} ${orderByClause}`;

      if (pageNumber && recordCount) {
        queryText += ` OFFSET $${queryParams.length + 1} LIMIT $${queryParams.length + 2}`;
        queryParams.push(offset, recordCount);
      }

      const result = await this.db.query(queryText, queryParams);
      return await dataTypeCheck(result);
    } catch (error) {
      console.error("Query Execution Error: IN getproductsData", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Get e-commerce products with pagination and filtering
   */
  public async getEcomProducts(request: { query: ProductQueryParams }): Promise<ProductServiceResult> {
    try {
      const { pageNumber, recordCount, whereClauses, queryParams, orderByField, orderByDirection } =
        this.buildQueryParameters(request.query);

      const baseConditions = `(isarchive = FALSE OR isarchive IS NULL) AND (isdeleted = FALSE OR isdeleted IS NULL) AND (removefromrecyclebin = FALSE OR removefromrecyclebin IS NULL)`;
      const whereClause = whereClauses.length > 0
        ? `WHERE ${whereClauses.join(" AND ")} AND ${baseConditions}`
        : `WHERE ${baseConditions}`;

      const orderByClause = `ORDER BY ${orderByField} ${orderByDirection}`;
      const offset = (pageNumber - 1) * recordCount;

      let queryText = `SELECT * FROM product_revo ${whereClause} ${orderByClause} OFFSET $${queryParams.length + 1} LIMIT $${queryParams.length + 2}`;
      queryParams.push(offset, recordCount);

      const result = await this.db.query(queryText, queryParams);
      return await dataTypeCheck(result);
    } catch (error) {
      console.error("Query Execution Error: IN getEcomProducts", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Get similar products based on criteria
   */
  public async getSimilarProducts(request: { query: ProductQueryParams }): Promise<ProductServiceResult> {
    try {
      const { pageNumber, recordCount, whereClauses, queryParams } = this.buildQueryParameters(request.query);
      const baseConditions = `(isarchive = FALSE OR isarchive IS NULL) AND (isdeleted = FALSE OR isdeleted IS NULL) AND (removefromrecyclebin = FALSE OR removefromrecyclebin IS NULL)`;
      const whereClause = whereClauses.length > 0
        ? `WHERE ${whereClauses.join(" AND ")} AND ${baseConditions}`
        : `WHERE ${baseConditions}`;

      const offset = (pageNumber - 1) * recordCount;
      const queryText = `SELECT * FROM product_revo ${whereClause} ORDER BY modifieddate DESC OFFSET $${queryParams.length + 1} LIMIT $${queryParams.length + 2}`;
      queryParams.push(offset, recordCount);

      const result = await this.db.query(queryText, queryParams);

      if (result.rows.length <= 1) {
        return await this.getLatestProducts(request.query);
      }

      return await dataTypeCheck(result);
    } catch (error) {
      console.error("Query Execution Error: IN getSimilarProducts", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Delete a product by ID
   */
  public async deleteProductrevo(id: number): Promise<ProductServiceResult> {
    try {
      const result = await this.db.query(
        `UPDATE product_revo SET isdeleted = true WHERE id = $1`,
        [id]
      );
      return result;
    } catch (error) {
      console.error("Query Execution Error: IN deleteProductrevo", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Create or update a product
   */
  public async upsertProductrevo(productData: ProductData): Promise<ProductServiceResult> {
    try {
      if (productData.id) {
        const result = await this.db.query(
          `UPDATE product_revo SET 
            name = $1, 
            description = $2, 
            price = $3, 
            category = $4, 
            images = $5,
            isecom = $6
          WHERE id = $7`,
          [
            productData.name,
            productData.description,
            productData.price,
            productData.category,
            productData.images,
            productData.isecom,
            productData.id
          ]
        );
        return result;
      } else {
        const result = await this.db.query(
          `INSERT INTO product_revo (name, description, price, category, images, isecom)
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            productData.name,
            productData.description,
            productData.price,
            productData.category,
            productData.images,
            productData.isecom
          ]
        );
        return result;
      }
    } catch (error) {
      console.error("Query Execution Error: IN upsertProductrevo", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Get latest products when similar products are not found
   */
  private async getLatestProducts(queryParams: ProductQueryParams): Promise<ProductServiceResult> {
    try {
      const { pageNumber, recordCount, whereClauses, queryParams: params } = this.buildQueryParameters(queryParams);
      const baseConditions = `(isarchive = FALSE OR isarchive IS NULL) AND (isdeleted = FALSE OR isdeleted IS NULL) AND (removefromrecyclebin = FALSE OR removefromrecyclebin IS NULL)`;

      const whereClause = whereClauses.length > 0
        ? `WHERE ${whereClauses.join(" AND ")} AND ${baseConditions}`
        : `WHERE ${baseConditions}`;

      const offset = (pageNumber - 1) * recordCount;
      const queryText = `SELECT * FROM products ${whereClause} ORDER BY modifieddate DESC OFFSET $${params.length + 1} LIMIT $${params.length + 2}`;
      params.push(offset, recordCount);

      const result = await this.db.query(queryText, params);
      return await dataTypeCheck(result);
    } catch (error) {
      console.error("Query Execution Error: IN getLatestProducts", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Create or update a product with file
   */
  public async upsertProductwithFileRevo(request: any): Promise<ProductFileResponse> {
    try {
      const { productid } = request.params;
      const existingProduct = productid ? await this.getProductById(productid) : null;
      const imageData = request.files ? await imageResize(request) as ImageData : null;

      const upsertData = this.prepareUpsertData(existingProduct, imageData);
      const result = await this.executeUpsert(productid, upsertData);

      return {
        result,
        productid: Number(productid),
        pathurldatas: imageData?.path || null
      };
    } catch (error) {
      console.error("Query Execution Error: IN upsertProductwithFileRevo", error);
      throw error;
    }
  }

  /**
   * Update product quantities in batch
   */
  public async testupsertQuantityFieldsBatch(batchData: BatchUpdateData[], issold: boolean): Promise<ProductServiceResult> {
    try {
      const updateQueryBase = this.buildBatchUpdateQuery(issold);
      const updateQueries = batchData.map(data => ({
        query: updateQueryBase,
        params: [
          data.location,
          data.quantity,
          data.ecompublishedquantity,
          data.soldquantity,
          data.availablequantity,
          data.puc
        ]
      }));

      const updatePromises = updateQueries.map(update => this.db.query(update.query, update.params));
      const updateResults = await Promise.all(updatePromises);
      return {
        command: 'UPDATE',
        message: 'Batch update completed successfully',
        data: updateResults
      } as ProductServiceResponse;
    } catch (error) {
      console.error("Error in testupsertQuantityFieldsBatch", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Rearrange product images
   */
  public async rearrangeImageRevo(request: { params: { productid: number }, body: any }): Promise<ProductServiceResult> {
    try {
      const { productid } = request.params;
      const { ...upsertFields } = request.body;
      const fieldNames = Object.keys(upsertFields);
      const fieldValues = Object.values(upsertFields);

      // First verify if the product exists and get current image data
      const existingProduct = await this.getProductById(productid);
      if (!existingProduct) {
        return {
          command: 'UPDATE',
          message: `Product not found with id ${productid}`
        };
      }

      // Build and execute the update query
      const queryText = `UPDATE product_revo SET ${fieldNames
        .map((field, index) => `${field} = $${index + 1}`)
        .join(", ")} WHERE id = $${fieldNames.length + 1} RETURNING *`;

      const params = [...fieldValues, Number(productid)];
      const result = await this.db.query(queryText, params);

      return {
        command: 'UPDATE',
        message: 'Image Rearranged successfully',
        data: result.rows[0]
      };
    } catch (error) {
      console.error("Query Execution Error: IN rearrangeImageRevo", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Bulk update product lock quantities
   */
  public async bulkupsertProducttosetZero(data: any[], setzero: boolean): Promise<ProductServiceResult> {
    try {
      const result = await this.db.query(
        `UPDATE product_revo SET lock_qty = $1 WHERE id = ANY($2)`,
        [setzero ? 0 : 1, data]
      );
      return result;
    } catch (error) {
      console.error("Query Execution Error: bulkupsertProducttosetZero result", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Get archived products
   */
  public async getArcheivedProductsrevo(request: { query: ProductQueryParams }): Promise<ProductServiceResult> {
    try {
      const { pageNumber, recordCount, whereClauses, queryParams } = this.buildQueryParameters(request.query);
      const baseConditions = `isarchive = true AND removefromrecyclebin = false`;
      const whereClause = whereClauses.length > 0
        ? `WHERE ${whereClauses.join(" AND ")} AND ${baseConditions}`
        : `WHERE ${baseConditions}`;

      const offset = (pageNumber - 1) * recordCount;
      let queryText = `SELECT * FROM product_revo ${whereClause}`;

      if (pageNumber && recordCount) {
        queryText += ` OFFSET $${queryParams.length + 1} LIMIT $${queryParams.length + 2}`;
        queryParams.push(offset, recordCount);
      }

      const result = await this.db.query(queryText, queryParams);
      return await dataTypeCheck(result);
    } catch (error) {
      console.error("Query Execution Error: IN getArcheivedProductsrevo", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Get a single product by ID
   */
  public async getEachProductsRevo(request: any, id: number): Promise<ProductServiceResult> {
    try {
      const result = await this.db.query(
        `SELECT * FROM product_revo WHERE id = $1`,
        [id]
      );
      return await dataTypeCheck(result);
    } catch (error) {
      console.error("Query Execution Error: IN getEachProductsRevo", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Update ordered quantity array
   */
  public async updateOrderedQuantityarray(updatedData: any[]): Promise<ProductServiceResult> {
    try {
      const result = await this.db.query(
        `UPDATE product_revo SET orderedquantity = $1 WHERE id = $2`,
        [updatedData[0].orderedquantity, updatedData[0].id]
      );
      return result;
    } catch (error) {
      console.error('Error in updateOrderedQuantityarray:', error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  /**
   * Update removed from recycle bin
   */
  public async updateRemoveFromRecyclebinRevo(): Promise<ProductServiceResult> {
    try {
      const result = await this.db.query(
        `UPDATE product_revo SET removefromrecyclebin = false WHERE isdeleted = true`
      );
      return result;
    } catch (error) {
      console.error("Query Execution Error: IN updateRemoveFromRecyclebinRevo", error);
      return await ErrorHandler.handleQueryError(error);
    }
  }

  // Private helper methods
  private buildQueryParameters(query: ProductQueryParams) {
    const pageNumber = parseInt(query.page?.toString()) || 1;
    const recordCount = parseInt(query.count?.toString()) || 5000;
    const keys = Object.keys(query);
    const values = Object.values(query);

    let whereClauses: string[] = [];
    let parameterIndex = 1;
    const queryParams: any[] = [];
    let orderByField = "modifieddate";
    let orderByDirection = "DESC";

    keys.forEach((key, index) => {
      if (key === "page" || key === "count") return;

      const paramValues = Array.isArray(values[index]) ? values[index] : [values[index]];

      if (key === "displaysize" || key === "price") {
        whereClauses.push(this.buildRangeClause(key, paramValues, queryParams, parameterIndex));
        parameterIndex += paramValues.length * 2;
      } else if (key === "sortby") {
        [orderByField, orderByDirection] = this.parseSortBy(paramValues[0]);
      } else {
        whereClauses.push(this.buildStandardClause(key, paramValues, queryParams, parameterIndex));
        parameterIndex += paramValues.length;
      }
    });

    return { pageNumber, recordCount, whereClauses, queryParams, orderByField, orderByDirection };
  }

  private buildRangeClause(key: string, values: any[], params: any[], startIndex: number): string {
    const rangeClauses = values.map(range => {
      const [lowerBound, upperBound] = range.split("-");
      params.push(lowerBound, upperBound);
      return `(${key} BETWEEN $${startIndex} AND $${startIndex + 1})`;
    });
    return `(${rangeClauses.join(" OR ")})`;
  }

  private buildStandardClause(key: string, values: any[], params: any[], startIndex: number): string {
    const clauses = values.map((value, idx) => {
      if (value.startsWith("NOT ")) {
        const cleanValue = value.slice(4);
        params.push(cleanValue);
        return `${key} != $${startIndex + idx}`;
      } else if (value.toUpperCase() === 'NULL') {
        return `${key} IS NULL`;
      } else {
        params.push(value);
        return `${key} = $${startIndex + idx}`;
      }
    });
    return `(${clauses.join(" OR ")})`;
  }

  private parseSortBy(sortBy: string): [string, string] {
    const [fieldName, direction] = sortBy.split("-");
    return [fieldName, direction.toUpperCase() === "ASC" ? "ASC" : "DESC"];
  }

  private async getProductById(id: number): Promise<any> {
    const result = await this.db.query(
      `SELECT * FROM product_revo WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  private prepareUpsertData(existingProduct: any, imageData: any): any {
    if (!imageData) return {};

    return {
      large: existingProduct?.large
        ? [...existingProduct.large, ...imageData.url.Large]
        : imageData.url.Large,
      medium: existingProduct?.medium
        ? [...existingProduct.medium, ...imageData.url.Medium]
        : imageData.url.Medium,
      small: existingProduct?.small
        ? [...existingProduct.small, ...imageData.url.Small]
        : imageData.url.Small
    };
  }

  private async executeUpsert(productId: number, data: any): Promise<ProductServiceResponse> {
    const fieldNames = Object.keys(data);
    const fieldValues = Object.values(data);

    const queryText = `UPDATE product_revo SET ${fieldNames
      .map((field, index) => `${field} = $${index + 1}`)
      .join(", ")} WHERE id = $${fieldNames.length + 1} RETURNING *`;

    const params = [...fieldValues, Number(productId)];
    const result = await this.db.query(queryText, params);

    return { command: 'UPDATE', ...result.rows[0] };
  }

  private buildBatchUpdateQuery(issold: boolean): string {
    return `
            UPDATE product_revo
            SET quantityforlocation = 
                jsonb_set(
                    COALESCE(quantityforlocation, '{}'::jsonb),
                    array[$1]::text[],
                    jsonb_build_object(
                        'quantity', $2::integer,
                        'ecompublishedquantity', $3::integer,
                        'soldquantity', $4::integer,
                        'availablequantity', $5::integer
                    )
                )
            WHERE puc = $6
            RETURNING *
        `;
  }
}

// Create and export a singleton instance with proper dependency injection
export const productrevoService = new ProductRevoService();