import pkg from 'exceljs';
const { Workbook } = pkg;
import { StockService } from './stock.service.js';
import { logger } from '../config/logger.js';

export class ExcelService {
  private stockService = new StockService();

  // Location options for dropdown validation
  private readonly locationOptions = [
    { value: "", label: "Select a location" },
    { value: "warehouse-a", label: "Warehouse A" },
    { value: "warehouse-b", label: "Warehouse B" },
    { value: "retail-store-1", label: "Retail Store 1" },
    { value: "retail-store-2", label: "Retail Store 2" },
    { value: "online-fulfillment", label: "Online Fulfillment Center" },
  ];

  /**
   * Generate multi-sheet Excel file for stock export
   * @param filters - Query filters (including puc, page, limit)
   * @returns Excel buffer
   */
  async generateStockExcel(filters: Record<string, any>): Promise<Buffer> {
    try {
      const { page = 1, limit = 500, ...stockFilters } = filters;
      
      logger.info({ filters, page, limit }, 'Starting multi-sheet stock Excel generation');

      // Fetch stock data using the existing service
      const stockData = await this.stockService.findMany(stockFilters, page, limit);
      
      // Create workbook
      const workbook = new Workbook();
      
      // Sheet 1: Bulk Upload Template
      this.createBulkUploadSheet(workbook, stockFilters.puc);
      
      // Sheet 2: Stock Data (retrieved data)
      this.createStockDataSheet(workbook, stockData);
      
      // Sheet 3: Instructions
      this.createInstructionsSheet(workbook);
      
      // Convert to buffer
      const buffer = await workbook.xlsx.writeBuffer() as Buffer;
      
      logger.info(
        { 
          recordCount: stockData.data.length, 
          totalRecords: stockData.pagination.total,
          page,
          limit,
          sheets: ['Bulk Upload', 'Stock Data', 'Instructions']
        }, 
        'Multi-sheet stock Excel generation completed'
      );
      
      return buffer;
    } catch (error) {
      logger.error({ error, filters }, 'Error generating stock Excel');
      throw error;
    }
  }

  /**
   * Add header row with styling
   */
  private addHeaderRow(worksheet: any, headers: string[]) {
    const headerRow = worksheet.addRow(headers);
    
    // Style the header row
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' } // Blue background
    };
    
    // Add borders to header
    headerRow.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  }

  /**
   * Bind stock data to Excel rows
   */
  private bindStockDataToRows(worksheet: any, stocks: any[]) {
    stocks.forEach(stock => {
      const row = worksheet.addRow([
        stock.id?.toString() || '',
        stock.puc || '',
        stock.serialnumber || '',
        stock.stockstatus || '',
        this.convertEpochToDate(stock.manufacturedyear),
        this.convertEpochToDate(stock.releaseyear),
        stock.ecompublish === true ? 'Yes' : 'No',
        stock.rfid || '',
        stock.location || ''
      ]);
      
      // Add borders to data rows
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
  }

  /**
   * Convert epoch timestamp (bigint) to readable date format
   * @param epochTime - Bigint epoch timestamp in seconds
   * @returns Formatted date string or empty string
   */
  private convertEpochToDate(epochTime: any): string {
    if (!epochTime) return '';
    
    try {
      // Handle both bigint and number types
      const timestamp = typeof epochTime === 'bigint' ? Number(epochTime) : epochTime;
      
      // Check if it's a valid timestamp
      if (isNaN(timestamp) || timestamp <= 0) return '';
      
      // Convert from seconds to milliseconds by multiplying by 1000
      const timestampMs = timestamp * 1000;
      
      const date = new Date(timestampMs);
      
      // Check if date is valid
      if (isNaN(date.getTime())) return '';
      
      // Return formatted date (DD/MM/YYYY)
      return date.toLocaleDateString('en-GB');
    } catch (error) {
      logger.warn({ epochTime, error }, 'Error converting epoch time to date');
      return '';
    }
  }

  /**
   * Apply formatting to the worksheet
   */
  private formatStockWorksheet(worksheet: any) {
    // Auto-fit columns with minimum width
    worksheet.columns.forEach((column, index) => {
      const headerLength = column.header?.length || 10;
      column.width = Math.max(headerLength + 2, 12);
    });
    
    // Set specific widths for certain columns
    worksheet.getColumn(1).width = 8;  // ID
    worksheet.getColumn(2).width = 15; // PUC
    worksheet.getColumn(3).width = 20; // Serial Number
    worksheet.getColumn(4).width = 15; // Stock Status
    worksheet.getColumn(5).width = 18; // Manufactured Year
    worksheet.getColumn(6).width = 15; // Release Year
    worksheet.getColumn(7).width = 18; // E-Commerce Publish
    worksheet.getColumn(8).width = 20; // RFID
    worksheet.getColumn(9).width = 15; // Location
    
    // Freeze the header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  /**
   * Create Sheet 1: Bulk Upload Template
   */
  private createBulkUploadSheet(workbook: any, puc?: string) {
    const worksheet = workbook.addWorksheet('Bulk Upload');
    
    // Define bulk upload headers as per requirements
    const headers = [
      'PUC',
      'RFID',
      'Serial Number',
      'Manufactured Year',
      'E-Commerce Publish',
      'Release Year',
      'Location'
    ];
    
    // Add headers
    this.addHeaderRow(worksheet, headers);
    
    // Add sample row with PUC pre-filled if provided
    if (puc) {
      const sampleRow = worksheet.addRow([
        puc, // PUC pre-filled
        '', // RFID
        '', // Serial Number
        '', // Manufactured Year (YYYY-MM-DD)
        '', // E-Commerce Publish (TRUE/FALSE)
        '', // Release Year (YYYY-MM-DD)
        '' // Location (dropdown)
      ]);
      
      // Style sample row with light gray background
      sampleRow.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
    
    // Add data validation for E-Commerce Publish column (column E)
    worksheet.getColumn(5).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"TRUE,FALSE"']
        };
      }
    });
    
    // Add data validation for Location column (column G)
    const locationValues = this.locationOptions.map(opt => opt.value).filter(val => val !== '');
    worksheet.getColumn(7).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${locationValues.join(',')}"`]
        };
      }
    });
    
    // Set column widths
    worksheet.getColumn(1).width = 20; // PUC
    worksheet.getColumn(2).width = 20; // RFID
    worksheet.getColumn(3).width = 25; // Serial Number
    worksheet.getColumn(4).width = 18; // Manufactured Year
    worksheet.getColumn(5).width = 20; // E-Commerce Publish
    worksheet.getColumn(6).width = 15; // Release Year
    worksheet.getColumn(7).width = 25; // Location
    
    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    
    // Add note about date format
    worksheet.addRow([]);
    const noteRow = worksheet.addRow(['Note: Date format should be YYYY-MM-DD (e.g., 2025-01-15)']);
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF666666' } };
  }

  /**
   * Create Sheet 2: Stock Data (Retrieved Data)
   */
  private createStockDataSheet(workbook: any, stockData: any) {
    const worksheet = workbook.addWorksheet('Stock Data');
    
    // Define headers for stock data (original format)
    const headers = [
      'ID',
      'PUC', 
      'Serial Number',
      'Stock Status',
      'Manufactured Year',
      'Release Year', 
      'E-Commerce Publish',
      'RFID',
      'Location'
    ];
    
    // Add headers
    this.addHeaderRow(worksheet, headers);
    
    // Add data rows
    this.bindStockDataToRows(worksheet, stockData.data);
    
    // Apply formatting
    this.formatStockWorksheet(worksheet);
  }

  /**
   * Create Sheet 3: Instructions
   */
  private createInstructionsSheet(workbook: any) {
    const worksheet = workbook.addWorksheet('Instructions');
    
    // Title
    const titleRow = worksheet.addRow(['Bulk Stock Upload - Instructions']);
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF4472C4' } };
    titleRow.getCell(1).alignment = { horizontal: 'left' };
    
    worksheet.addRow([]); // Empty row
    
    // Steps
    const steps = [
      { step: 'Step 1:', instruction: 'Download and open this template' },
      { step: 'Step 2:', instruction: 'Go to "Bulk Upload" sheet for data entry' },
      { step: 'Step 3:', instruction: 'Fill in stock data for each row' },
      { step: 'Step 4:', instruction: 'Use dropdowns for E-Commerce Publish and Location fields' },
      { step: 'Step 5:', instruction: 'Use YYYY-MM-DD format for date fields' },
      { step: 'Step 6:', instruction: 'Save the file and upload it to the system' }
    ];
    
    steps.forEach(({ step, instruction }) => {
      const row = worksheet.addRow([step, instruction]);
      row.getCell(1).font = { bold: true };
    });
    
    worksheet.addRow([]); // Empty row
    
    // Column Guidelines
    const guidelinesRow = worksheet.addRow(['Column Guidelines:']);
    guidelinesRow.font = { bold: true, size: 14 };
    
    const guidelines = [
      { field: 'PUC:', description: 'Product Unique Code - Required' },
      { field: 'RFID:', description: 'RFID tag identifier - Optional' },
      { field: 'Serial Number:', description: 'Device serial number - Required' },
      { field: 'Manufactured Year:', description: 'Date in YYYY-MM-DD format' },
      { field: 'E-Commerce Publish:', description: 'Use dropdown: TRUE or FALSE' },
      { field: 'Release Year:', description: 'Date in YYYY-MM-DD format' },
      { field: 'Location:', description: 'Use dropdown to select warehouse/store location' }
    ];
    
    guidelines.forEach(({ field, description }) => {
      const row = worksheet.addRow([field, description]);
      row.getCell(1).font = { bold: true };
    });
    
    worksheet.addRow([]); // Empty row
    
    // Location Options
    const locationRow = worksheet.addRow(['Available Locations:']);
    locationRow.font = { bold: true, size: 14 };
    
    this.locationOptions.slice(1).forEach(option => { // Skip "Select a location"
      worksheet.addRow([option.value, option.label]);
    });
    
    // Set column widths
    worksheet.getColumn(1).width = 25;
    worksheet.getColumn(2).width = 50;
  }
}
