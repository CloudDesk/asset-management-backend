import { FastifyRequest, FastifyReply } from 'fastify';
import { StockService } from '../services/stock.service.js';
import { ExcelService } from '../services/excel.service.js';
import { StockImportService } from '../services/stockImport.service.js';
import { 
  createStockSchema, 
  updateStockSchema, 
  upsertStockSchema,
  stockParamsSchema,
  rfidUpdateStockSchema,
  bulkRfidUpdateStockSchema,
  StockParams,
  RfidUpdateStockInput,
  BulkRfidUpdateStockInput,
  CreateStockInput
} from '../schemas/stock.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler,
  ValidationError
} from '../utils/errorHandler.js';
import { formatStockForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
import { stockImportCommitSchema, StockImportCommitInput } from '../schemas/stock-import.schema.js';
import { logger } from '../config/logger.js';

export class StockController {
  public stockService = new StockService();
  private excelService = new ExcelService();
  private stockImportService = new StockImportService();

  getStocks = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.stockService.findMany(filters, page, limit);
    
    // Format all stocks in the result
    const formattedData = formatEntitiesForAPI(result.data, 'stock');

    let summary: any = null;
    const pucFilterRaw = filters?.puc;
    const pucFilter = Array.isArray(pucFilterRaw) ? pucFilterRaw[0] : pucFilterRaw;

    if (typeof pucFilter === 'string' && pucFilter.trim().length > 0) {
      summary = await this.stockService.getSummaryByPuc(pucFilter.trim());
    }
    
    const response = createSuccessResponse('Stocks retrieved successfully', formattedData);

    const payload: Record<string, any> = {
      ...response,
      pagination: result.pagination,
      meta: {
        filters: Object.keys(filters),
        total: result.pagination.total,
        filtered: Object.keys(filters).length > 0
      }
    };

    if (summary) {
      payload.summary = summary;
    }

    return reply.code(200).send(payload);
  });

  getStock = asyncHandler(async (request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) => {
    const { id } = stockParamsSchema.parse(request.params);
    
    const stock = await this.stockService.findById(id);
    
    const response = createSuccessResponse('Stock retrieved successfully', formatStockForAPI(stock));
    return reply.code(200).send(response);
  });

  createStock = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createStockSchema.parse(request.body);
    
    const stock = await this.stockService.create(data);
    
    const response = createSuccessResponse('Stock created successfully', formatStockForAPI(stock));
    return reply.code(201).send(response);
  });

  createBulkStocks = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const stockArray = request.body as (CreateStockInput & Record<string, any>)[];
  
    if (!Array.isArray(stockArray) || stockArray.length === 0) {
      throw new Error("Request body must be a non-empty array");
    }
  
    const result = await this.stockService.createBulk(stockArray);
  
    const success = result.failures.length === 0;
    const code = success ? 201 : 207;
  
    return reply.code(code).send({
      success,
      insertedCount: result.inserted.length,
      failures: result.failures,
    });
  });  

  updateStock = asyncHandler(async (request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) => {
    const { id } = stockParamsSchema.parse(request.params);
    const data = updateStockSchema.parse(request.body);
    
    const stock = await this.stockService.update(id, data);
    
    const response = createSuccessResponse('Stock updated successfully', formatStockForAPI(stock));
    return reply.code(200).send(response);
  });

  deleteStock = asyncHandler(async (request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) => {
    const { id } = stockParamsSchema.parse(request.params);
    
    await this.stockService.delete(id);
    
    const response = createSuccessResponse('Stock deleted successfully', null);
    return reply.code(200).send(response);
  });

  upsertStock = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertStockSchema.parse(request.body);
    
    const stock = await this.stockService.upsert(data);
    
    const message = data.id ? 'Stock updated successfully' : 'Stock created successfully';
    const response = createSuccessResponse(message, formatStockForAPI(stock));
    return reply.code(200).send(response);
  });

  updateQuantities = asyncHandler(async (request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) => {
    const { id } = stockParamsSchema.parse(request.params);
    const quantities = request.body as {
      quantity?: number;
      availableQuantity?: number;
      soldQuantity?: number;
    };
    
    const stock = await this.stockService.updateQuantities(id, quantities);
    
    const response = createSuccessResponse('Stock quantities updated successfully', formatStockForAPI(stock));
    return reply.code(200).send(response);
  });

  updateStockByRfid = asyncHandler(async (request: FastifyRequest<{
    Body: RfidUpdateStockInput
  }>, reply: FastifyReply) => {
    const { rfid, orderlineid } = rfidUpdateStockSchema.parse(request.body);
    
    const stock = await this.stockService.updateByRfid(rfid, orderlineid);
    
    const response = createSuccessResponse(
      'Stock updated successfully via RFID scan', 
      formatStockForAPI(stock)
    );
    return reply.code(200).send(response);
  });

  bulkUpdateStockByRfid = asyncHandler(async (request: FastifyRequest<{
    Body: BulkRfidUpdateStockInput
  }>, reply: FastifyReply) => {
    const updates = bulkRfidUpdateStockSchema.parse(request.body);
    
    const result = await this.stockService.bulkUpdateByRfid(updates);
    
    // Format the successful stock results
    const formattedResults = result.results.map(item => {
      if (item.success && 'data' in item) {
        return {
          ...item,
          data: formatStockForAPI(item.data)
        };
      }
      return item;
    });
    
    const responseData = {
      ...result,
      results: formattedResults
    };
    
    // Determine response code based on results
    const responseCode = result.summary.failed === 0 ? 200 : 207; // 207 = Multi-Status
    
    const message = result.summary.failed === 0 
      ? `All ${result.summary.successful} stocks updated successfully via RFID scan`
      : `Bulk RFID update completed: ${result.summary.successful} successful, ${result.summary.failed} failed`;
    
    const response = createSuccessResponse(message, responseData);
    return reply.code(responseCode).send(response);
  });

  /**
   * Export stocks to Excel file
   */
  exportStocks = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters
    const allFilters: Record<string, any> = request.query || {};
    
    // Generate Excel buffer
    const excelBuffer = await this.excelService.generateStockExcel(allFilters);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `stock_export_${timestamp}.xlsx`;
    
    // Set response headers for file download
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Content-Length', excelBuffer.length.toString());
    
    return reply.send(excelBuffer);
  });

  /**
   * Generate preview for stock import file
   */
  /*
  importPreview = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const file = await (request as any).file?.();

    if (!file) {
      throw new ValidationError('No file uploaded', 'Please attach an Excel file to import stocks');
    }

    const mimeType = file.mimetype;
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      throw new ValidationError('Invalid file format', 'Please upload an Excel (.xlsx) file');
    }

    const fileBuffer = await file.toBuffer();
    const preview = await this.stockImportService.generatePreview(fileBuffer);

    const response = createSuccessResponse('Import preview generated successfully', preview);
    return reply.code(200).send(response);
  });
*/
  /**
   * Commit validated stock import rows
   */
  /*
  importCommit = asyncHandler(async (
    request: FastifyRequest<{ Body: StockImportCommitInput }>,
    reply: FastifyReply
  ) => {
    const { rows } = stockImportCommitSchema.parse(request.body);

    const validation = await this.stockImportService.validateNormalizedRows(rows);

    if (validation.summary.errors > 0 || validation.summary.warnings > 0) {
      return reply.code(400).send({
        success: false,
        message: 'Import commit validation failed',
        statusCode: 400,
        data: validation,
      });
    }

    const rowsToInsert = validation.validRows;

    const createdStocks: any[] = [];
    const failures: Array<{ rowNumber?: number; serialnumber?: string; message: string }> = [];

    for (const row of rowsToInsert) {
      const { rowNumber, ...payload } = row;
      try {
        const created = await this.stockService.create(payload as any);
        createdStocks.push({
          rowNumber,
          data: formatStockForAPI(created),
        });
      } catch (error: any) {
        logger.error({ error: error.message, rowNumber, serialnumber: row.serialnumber }, 'Failed to insert stock during import commit');
        failures.push({
          rowNumber,
          serialnumber: row.serialnumber,
          message: error.message || 'Failed to insert row',
        });
      }
    }

    const summary = {
      requested: rows.length,
      inserted: createdStocks.length,
      failed: failures.length,
    };

    const responseData = {
      summary,
      inserted: createdStocks,
      failures,
    };

    const responseCode = failures.length > 0 ? 207 : 201;
    const message = failures.length > 0
      ? 'Import commit completed with partial failures'
      : 'Import commit completed successfully';

    const response = createSuccessResponse(message, responseData);
    return reply.code(responseCode).send(response);
  });*/

  // Import  preview - Parse and validate Excel file
  importPreview = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('importBulkPreview started');
      console.log('Request body:', request.body);
      console.log('Request headers:', request.headers);
      
      // Handle Fastify multipart file upload (with attachFieldsToBody: true)
      const body = request.body as any;
      
      if (!body || !body.file) {
        return reply.code(400).send({
          success: false,
          message: 'No file uploaded',
          details: 'Please upload an Excel file using multipart/form-data with field name "file"',
          statusCode: 400
        });
      }

      const uploadedFile = body.file;
      console.log('Uploaded file:', uploadedFile);

      // Validate file type
      if (!uploadedFile.mimetype.includes('spreadsheet') && !uploadedFile.filename?.endsWith('.xlsx')) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid file type',
          details: 'Please upload an Excel (.xlsx) file',
          statusCode: 400
        });
      }

      // Get file buffer from Fastify multipart
      const fileBuffer = await uploadedFile.toBuffer();
      console.log('File buffer size:', fileBuffer.length);
      
      if (fileBuffer.length === 0) {
        return reply.code(400).send({
          success: false,
          message: 'Empty file uploaded',
          details: 'The uploaded file appears to be empty',
          statusCode: 400
        });
      }

      logger.info({
        filename: uploadedFile.filename,
        mimetype: uploadedFile.mimetype,
        fileSize: fileBuffer.length
      }, 'Processing stock import file');

      // Parse and validate Excel file using StockImportService
      const validationResult = await this.stockImportService.parseAndValidateExcel(fileBuffer);

      logger.info({
        totalRows: validationResult.summary.totalRows,
        validRows: validationResult.summary.success,
        errorRows: validationResult.summary.errors,
        warningRows: validationResult.summary.warnings
      }, 'Stock import validation completed');

      const message = `Parsed ${validationResult.summary.totalRows} rows. Found ${validationResult.summary.success} valid rows, ${validationResult.summary.warnings} warnings, and ${validationResult.summary.errors} errors.`;

      const response = createSuccessResponse(message, validationResult);
      return reply.code(200).send(response);

    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in stock import preview');
      return reply.code(400).send({
        success: false,
        message: 'Failed to process Excel file',
        details: error.message,
        statusCode: 400
      });
    }
  });

  // Import commit - Insert validated rows into database
  importCommit = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = request.body as { rows: any[] };

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return reply.code(400).send({
          success: false,
          message: 'No valid rows provided',
          details: 'Please provide an array of validated rows for insertion',
          statusCode: 400
        });
      }

      logger.info({
        rowCount: rows.length
      }, 'Starting stock import commit process');

      // Insert validated rows using StockImportService
      const insertResult = await this.stockImportService.insertValidatedRows(rows);

      logger.info({
        requested: insertResult.summary.requested,
        inserted: insertResult.summary.inserted,
        failed: insertResult.summary.failed
      }, 'Stock import commit completed');

      const message = insertResult.summary.failed > 0
        ? `Import completed with ${insertResult.summary.failed} failures out of ${insertResult.summary.requested} rows`
        : `Successfully imported ${insertResult.summary.inserted} stock records`;

      // Return appropriate status code
      const statusCode = insertResult.summary.failed > 0 ? 207 : 201; // 207 = Multi-Status for partial success

      const response = createSuccessResponse(message, insertResult);
      return reply.code(statusCode).send(response);

    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in stock import commit');
      return reply.code(500).send({
        success: false,
        message: 'Failed to commit stock import',
        details: error.message,
        statusCode: 500
      });
    }
  });
}
