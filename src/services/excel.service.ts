import pkg from 'exceljs';
const { Workbook } = pkg;
import { StockService } from './stock.service.js';
import { logger } from '../config/logger.js';

export class ExcelService {
  private stockService = new StockService();

  /**
   * Generate Excel file for stock export
   * @param filters - Query filters (including puc, page, limit)
   * @returns Excel buffer
   */
  async generateStockExcel(filters: Record<string, any>): Promise<Buffer> {
    try {
      const { page = 1, limit = 500, ...stockFilters } = filters;
      
      logger.info({ filters, page, limit }, 'Starting stock Excel generation');

      // Fetch stock data using the existing service
      const stockData = await this.stockService.findMany(stockFilters, page, limit);
      
      // Create workbook and worksheet
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Stock Data');
      
      // Define headers as per requirements
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
      
      // Add headers to worksheet
      this.addHeaderRow(worksheet, headers);
      
      // Add data rows
      this.bindStockDataToRows(worksheet, stockData.data);
      
      // Apply formatting
      this.formatStockWorksheet(worksheet);
      
      // Convert to buffer
      const buffer = await workbook.xlsx.writeBuffer() as Buffer;
      
      logger.info(
        { 
          recordCount: stockData.data.length, 
          totalRecords: stockData.pagination.total,
          page,
          limit
        }, 
        'Stock Excel generation completed'
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
}
