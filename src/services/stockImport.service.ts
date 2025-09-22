import pkg from 'exceljs';
const { Workbook } = pkg;
import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';
import { ValidationError } from '../utils/errorHandler.js';
import type { StockImportCommitRow } from '../schemas/stock-import.schema.js';
import { StockService } from './stock.service.js';
import { ProductService } from './product.service.js';

export type StockImportRowStatus = 'success' | 'warning' | 'error';

export interface StockImportRowIssue {
  type: 'error' | 'warning';
  field?: string;
  message: string;
}

export interface StockImportNormalizedRow {
  rowNumber?: number;
  puc?: string;
  rfid?: string;
  serialnumber: string;
  manufacturedyear?: number;
  releaseyear?: number;
  ecompublish?: boolean;
  location?: string;
}

export interface StockImportRowResult {
  rowNumber: number;
  status: StockImportRowStatus;
  normalized: StockImportNormalizedRow | null;
  issues: StockImportRowIssue[];
  original?: Record<string, any>;
}

export interface StockImportEvaluation {
  summary: {
    totalRows: number;
    success: number;
    warnings: number;
    errors: number;
  };
  rows: StockImportRowResult[];
  validRows: StockImportNormalizedRow[];
  warningRows: StockImportRowResult[];
  errorRows: StockImportRowResult[];
}

type ImportSource = 'raw' | 'normalized';

interface StockImportInputRow {
  rowNumber: number;
  values: Record<string, any>;
  source: ImportSource;
}

export class StockImportService {
  // ✅ NEW: Valid location options (from ExcelService)
  private readonly validLocations = [
    'warehouse-a',
    'warehouse-b', 
    'retail-store-1',
    'retail-store-2',
    'online-fulfillment'
  ];
  private stockService = new StockService();
  private productService = new ProductService();
  async generatePreview(fileBuffer: Buffer): Promise<StockImportEvaluation> {
    const rows = await this.parseExcel(fileBuffer);
    return this.evaluateRows(rows);
  }

  async validateNormalizedRows(rows: StockImportCommitRow[]): Promise<StockImportEvaluation> {
    const normalizedRows: StockImportInputRow[] = rows.map((row, index) => ({
      rowNumber: row.rowNumber ?? index + 1,
      source: 'normalized',
      values: row,
    }));

    return this.evaluateRows(normalizedRows);
  }

  private async evaluateRows(rows: StockImportInputRow[]): Promise<StockImportEvaluation> {
    if (rows.length === 0) {
      throw new ValidationError('No rows found in the provided data', 'The uploaded file does not contain any data rows');
    }

    const processedRows = rows.map((row) => this.processRow(row));

    this.applyDuplicateChecks(processedRows);
    await this.applyDatabaseChecks(processedRows);

    processedRows.forEach((row) => {
      const hasErrors = row.issues.some((issue) => issue.type === 'error');
      const hasWarnings = row.issues.some((issue) => issue.type === 'warning');
      row.status = hasErrors ? 'error' : hasWarnings ? 'warning' : 'success';

      if (row.normalized) {
        row.normalized.rowNumber = row.rowNumber;
      }
    });

    const summary = processedRows.reduce(
      (acc, row) => {
        acc.totalRows += 1;
        if (row.status === 'success') acc.success += 1;
        if (row.status === 'warning') acc.warnings += 1;
        if (row.status === 'error') acc.errors += 1;
        return acc;
      },
      { totalRows: 0, success: 0, warnings: 0, errors: 0 }
    );

    const validRows = processedRows
      .filter((row) => row.status === 'success' && row.normalized)
      .map((row) => row.normalized!)
      .map(({ rowNumber, ...rest }) => ({ ...rest, rowNumber }));

    const warningRows = processedRows.filter((row) => row.status === 'warning');
    const errorRows = processedRows.filter((row) => row.status === 'error');

    return {
      summary,
      rows: processedRows,
      validRows,
      warningRows,
      errorRows,
    };
  }

  private processRow(row: StockImportInputRow): StockImportRowResult {
    if (row.source === 'raw') {
      return this.processRawRow(row);
    }

    return this.processNormalizedRow(row);
  }

  private processRawRow(row: StockImportInputRow): StockImportRowResult {
    const issues: StockImportRowIssue[] = [];
    const normalized: StockImportNormalizedRow | null = {
      rowNumber: row.rowNumber,
      serialnumber: '',
    };

    // ✅ ENHANCED: PUC validation - must exist and be valid
    const puc = this.normalizeString(row.values.puc);
    if (!puc) {
      issues.push({ type: 'error', field: 'puc', message: 'PUC (Product Unique Code) is required' });
    } else {
      normalized.puc = puc;
      // Note: PUC existence in products table will be validated in applyDatabaseChecks
    }

    const serial = this.normalizeString(row.values.serialnumber);
    if (!serial) {
      issues.push({ type: 'error', field: 'serialnumber', message: 'Serial Number is required' });
    } else {
      normalized.serialnumber = serial;
    }

    const rfid = this.normalizeString(row.values.rfid);
    if (!rfid) {
      issues.push({ type: 'error', field: 'rfid', message: 'RFID is required' });
    } else {
      normalized.rfid = rfid;
    }

    // ✅ ENHANCED: Location validation with predefined list
    const location = this.normalizeString(row.values.location);
    if (location) {
      if (this.validLocations.includes(location.toLowerCase())) {
        normalized.location = location;
      } else {
        issues.push({ 
          type: 'error', 
          field: 'location', 
          message: `Invalid location. Must be one of: ${this.validLocations.join(', ')}` 
        });
      }
    }

    // ✅ ENHANCED: E-commerce publish validation (strict true/false only)
    const ecompublishValue = row.values.ecompublish;
    if (ecompublishValue !== undefined && ecompublishValue !== null && `${ecompublishValue}`.trim() !== '') {
      const parsedBoolean = this.parseBoolean(ecompublishValue);
      if (parsedBoolean === null) {
        issues.push({ 
          type: 'error', 
          field: 'ecompublish', 
          message: 'Invalid value for E-Commerce Publish. Use TRUE, FALSE, YES, NO, 1, or 0' 
        });
      } else {
        normalized.ecompublish = parsedBoolean;
      }
    }

    const manufactured = this.parseDateField(row.values.manufacturedyear, 'manufacturedyear', issues, row.rowNumber);
    if (manufactured !== undefined) {
      normalized.manufacturedyear = manufactured;
    }

    const release = this.parseDateField(row.values.releaseyear, 'releaseyear', issues, row.rowNumber);
    if (release !== undefined) {
      normalized.releaseyear = release;
    }

    return {
      rowNumber: row.rowNumber,
      status: 'success',
      normalized: issues.some((issue) => issue.type === 'error') ? null : normalized,
      issues,
      original: row.values,
    };
  }

  private processNormalizedRow(row: StockImportInputRow): StockImportRowResult {
    const issues: StockImportRowIssue[] = [];
    const input = row.values as StockImportCommitRow;

    const normalized: StockImportNormalizedRow = {
      rowNumber: row.rowNumber,
      serialnumber: '',
    };

    const serial = this.normalizeString(input.serialnumber);
    if (!serial) {
      issues.push({ type: 'error', field: 'serialnumber', message: 'Serial Number is required' });
    } else {
      normalized.serialnumber = serial;
    }

    const rfid = this.normalizeString(input.rfid);
    if (!rfid) {
      issues.push({ type: 'error', field: 'rfid', message: 'RFID is required' });
    } else {
      normalized.rfid = rfid;
    }

    if (input.puc) {
      const puc = this.normalizeString(input.puc);
      if (puc) {
        normalized.puc = puc;
      }
    }

    if (input.location) {
      const location = this.normalizeString(input.location);
      if (location) {
        normalized.location = location;
      }
    }

    if (typeof input.ecompublish === 'boolean') {
      normalized.ecompublish = input.ecompublish;
    }

    if (input.manufacturedyear !== undefined && input.manufacturedyear !== null) {
      if (!Number.isFinite(input.manufacturedyear) || input.manufacturedyear < 0) {
        issues.push({ type: 'error', field: 'manufacturedyear', message: 'Manufactured Year must be a positive epoch timestamp in seconds' });
      } else {
        normalized.manufacturedyear = Math.floor(input.manufacturedyear);
      }
    }

    if (input.releaseyear !== undefined && input.releaseyear !== null) {
      if (!Number.isFinite(input.releaseyear) || input.releaseyear < 0) {
        issues.push({ type: 'error', field: 'releaseyear', message: 'Release Year must be a positive epoch timestamp in seconds' });
      } else {
        normalized.releaseyear = Math.floor(input.releaseyear);
      }
    }

    return {
      rowNumber: row.rowNumber,
      status: 'success',
      normalized: issues.some((issue) => issue.type === 'error') ? null : normalized,
      issues,
      original: row.values,
    };
  }

  private applyDuplicateChecks(rows: StockImportRowResult[]): void {
    const serialMap = new Map<string, StockImportRowResult[]>();
    const rfidMap = new Map<string, StockImportRowResult[]>();

    for (const row of rows) {
      const serialKey = row.normalized?.serialnumber?.toLowerCase();
      if (serialKey) {
        const list = serialMap.get(serialKey) ?? [];
        list.push(row);
        serialMap.set(serialKey, list);
      }

      const rfidKey = row.normalized?.rfid?.toLowerCase();
      if (rfidKey) {
        const list = rfidMap.get(rfidKey) ?? [];
        list.push(row);
        rfidMap.set(rfidKey, list);
      }
    }

    const duplicateMessage = {
      serialnumber: 'Duplicate Serial Number found in uploaded file',
      rfid: 'Duplicate RFID found in uploaded file',
    };

    serialMap.forEach((list) => {
      if (list.length > 1) {
        list.forEach((row) => this.appendIssue(row, 'serialnumber', duplicateMessage.serialnumber));
      }
    });

    rfidMap.forEach((list) => {
      if (list.length > 1) {
        list.forEach((row) => this.appendIssue(row, 'rfid', duplicateMessage.rfid));
      }
    });
  }

  private async applyDatabaseChecks(rows: StockImportRowResult[]): Promise<void> {
    // ✅ FIXED: Check serial numbers and RFIDs from original data, not just normalized data
    // This ensures we validate uniqueness even for rows with other validation errors
    
    // 1. Check serial number uniqueness - use original data
    const serials = new Set(
      rows
        .filter((row) => row.original?.serialnumber && typeof row.original.serialnumber === 'string')
        .map((row) => String(row.original.serialnumber).trim())
        .filter(Boolean)
    );

    // 2. Check RFID uniqueness - use original data  
    const rfids = new Set(
      rows
        .filter((row) => row.original?.rfid)
        .map((row) => String(row.original.rfid).trim())
        .filter(Boolean)
    );

    // 3. Check PUC existence in products table - use original data
    const pucs = new Set(
      rows
        .filter((row) => row.original?.puc && typeof row.original.puc === 'string')
        .map((row) => String(row.original.puc).trim())
        .filter(Boolean)
    );

    // Serial number validation
    if (serials.size > 0) {
      const serialList = Array.from(serials);
      const existingSerials = await prisma.stock.findMany({
        where: {
          OR: serialList.map((value) => ({
            serialnumber: { equals: value, mode: 'insensitive' as const },
          })),
        },
        select: { serialnumber: true },
      });

      const existingSerialSet = new Set(existingSerials.map((record) => record.serialnumber?.toLowerCase()).filter(Boolean) as string[]);

      // ✅ FIXED: Check against original data, not normalized data
      rows.forEach((row) => {
        const originalSerial = row.original?.serialnumber;
        if (originalSerial && typeof originalSerial === 'string') {
          const key = originalSerial.trim().toLowerCase();
          if (key && existingSerialSet.has(key)) {
            this.appendIssue(row, 'serialnumber', 'Serial Number already exists in the database');
          }
        }
      });
    }

    // RFID validation
    if (rfids.size > 0) {
      const rfidList = Array.from(rfids);
      const existingRfids = await prisma.stock.findMany({
        where: {
          OR: rfidList.map((value) => ({
            rfid: { equals: value, mode: 'insensitive' as const },
          })),
        },
        select: { rfid: true },
      });

      const existingRfidSet = new Set(existingRfids.map((record) => record.rfid?.toLowerCase()).filter(Boolean) as string[]);

      // ✅ FIXED: Check against original data, not normalized data
      rows.forEach((row) => {
        const originalRfid = row.original?.rfid;
        if (originalRfid) {
          const key = String(originalRfid).trim().toLowerCase();
          if (key && existingRfidSet.has(key)) {
            this.appendIssue(row, 'rfid', 'RFID already exists in the database');
          }
        }
      });
    }

    // ✅ NEW: PUC validation - Check if product exists
    if (pucs.size > 0) {
      const pucList = Array.from(pucs);
      const existingProducts = await prisma.product.findMany({
        where: {
          OR: pucList.map((value) => ({
            puc: { equals: value, mode: 'insensitive' as const },
          })),
        },
        select: { puc: true },
      });

      const existingPucSet = new Set(existingProducts.map((record) => record.puc?.toLowerCase()).filter(Boolean) as string[]);

      // ✅ FIXED: Check against original data, not normalized data
      rows.forEach((row) => {
        const originalPuc = row.original?.puc;
        if (originalPuc && typeof originalPuc === 'string') {
          const key = originalPuc.trim().toLowerCase();
          if (key && !existingPucSet.has(key)) {
            this.appendIssue(row, 'puc', 'PUC does not exist in products database. Please create the product first.');
          }
        }
      });
    }
  }

  private appendIssue(row: StockImportRowResult, field: string, message: string): void {
    const alreadyExists = row.issues.some((issue) => issue.type === 'error' && issue.field === field && issue.message === message);
    if (!alreadyExists) {
      row.issues.push({ type: 'error', field, message });
      row.normalized = null;
    }
  }

  private hasError(row: StockImportRowResult, field: string): boolean {
    return row.issues.some((issue) => issue.type === 'error' && issue.field === field);
  }

  private async parseExcel(fileBuffer: Buffer): Promise<StockImportInputRow[]> {
    try {
      const workbook = new Workbook();
      await workbook.xlsx.load(fileBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new ValidationError('No worksheet found in uploaded file', 'Ensure the Excel file has at least one worksheet');
      }

      const headerRow = worksheet.getRow(1);
      if (!headerRow || headerRow.cellCount === 0) {
        throw new ValidationError('Header row missing in uploaded file', 'Ensure the first row of the Excel file contains column headers');
      }

      const columnMapping = this.buildColumnMapping(headerRow);
      const requiredFields = ['serialnumber', 'rfid'];
      const missingHeaders = requiredFields.filter((field) => !Object.values(columnMapping).includes(field));

      if (missingHeaders.length > 0) {
        throw new ValidationError(
          'Required columns missing in uploaded file',
          `Missing columns: ${missingHeaders.join(', ')}`
        );
      }

      const rows: StockImportInputRow[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }

        const values: Record<string, any> = {};
        let hasValue = false;

        Object.entries(columnMapping).forEach(([columnIndex, fieldName]) => {
          const cell = row.getCell(parseInt(columnIndex, 10));
          const value = this.extractCellValue(cell);
          values[fieldName] = value;

          if (value !== null && value !== undefined && `${value}`.trim() !== '') {
            hasValue = true;
          }
        });

        if (hasValue) {
          rows.push({
            rowNumber,
            values,
            source: 'raw',
          });
        }
      });

      if (rows.length === 0) {
        throw new ValidationError('No data rows found in uploaded file', 'Provide at least one data row below the header');
      }

      return rows;
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      logger.error({ error: error.message }, 'Failed to parse stock import Excel file');
      throw new ValidationError('Unable to parse uploaded Excel file', error.message);
    }
  }

  private buildColumnMapping(headerRow: any): Record<number, string> {
    const columnMapping: Record<number, string> = {};

    headerRow.eachCell((cell: any, colNumber: number) => {
      const header = this.normalizeHeader(cell.value);
      if (!header) return;

      const mappedField = this.headerFieldMapping[header];
      if (mappedField) {
        columnMapping[colNumber] = mappedField;
      }
    });

    return columnMapping;
  }

  private get headerFieldMapping(): Record<string, string> {
    return {
      // PUC variations
      'puc': 'puc',
      'product unique code': 'puc',
      'product code': 'puc',
      
      // Serial Number variations
      'serial number': 'serialnumber',
      'serialnumber': 'serialnumber',
      'serial': 'serialnumber',
      'sn': 'serialnumber',
      
      // RFID variations
      'rfid': 'rfid',
      'rfid tag': 'rfid',
      'rfid number': 'rfid',
      
      // Manufactured Year variations
      'manufactured year': 'manufacturedyear',
      'manufacturing year': 'manufacturedyear',
      'manufacturing date': 'manufacturedyear',
      'manufacturedyear': 'manufacturedyear',
      'mfg year': 'manufacturedyear',
      'mfg date': 'manufacturedyear',
      
      // Release Year variations
      'release year': 'releaseyear',
      'release date': 'releaseyear',
      'releaseyear': 'releaseyear',
      
      // E-Commerce Publish variations
      'e-commerce publish': 'ecompublish',
      'e commerce publish': 'ecompublish',
      'ecommerce publish': 'ecompublish',
      'ecompublish': 'ecompublish',
      'publish': 'ecompublish',
      'ec publish': 'ecompublish',
      
      // Location variations
      'location': 'location',
      'storage location': 'location',
      'warehouse': 'location',
      'warehouse location': 'location',
      
      // Additional common stock fields
      'category': 'category',
      'subcategory': 'subcategory',
      'brand': 'brand',
      'model': 'model',
      'operating system': 'operatingsystem',
      'os': 'operatingsystem',
      'ram': 'ram',
      'memory': 'ram',
      'storage type': 'storagetype',
      'storage capacity': 'storagecapacity',
      'colour': 'colour',
      'color': 'colour',
      'processor': 'processor',
      'cpu': 'processor',
      'stock status': 'stockstatus',
      'status': 'stockstatus',
      'product name': 'productname',
      'name': 'productname',
      'nfc': 'nfc',
      'qr code': 'qrcode',
      'qrcode': 'qrcode',
      'barcode': 'barcode',
      'order id': 'orderid',
      'orderid': 'orderid',
    };
  }

  private normalizeHeader(value: any): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const text = String(value).trim().toLowerCase();
    return text || null;
  }

  private extractCellValue(cell: any): any {
    const { value } = cell;

    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'object') {
      if ('text' in value && typeof value.text === 'string') {
        return value.text;
      }

      if ('result' in value) {
        return value.result;
      }

      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText.map((item: any) => item.text).join('');
      }
    }

    return value;
  }

  private normalizeString(value: any): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const text = String(value).trim();
    return text.length > 0 ? text : undefined;
  }

  private parseBoolean(value: any): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    const text = String(value).trim().toLowerCase();
    if (text === 'true' || text === 'yes' || text === '1') {
      return true;
    }
    if (text === 'false' || text === 'no' || text === '0') {
      return false;
    }
    return null;
  }

  private resolveProductIdentifier(
    rowData: Record<string, any>,
    createdStock: Record<string, any>
  ): string | null {
    const candidates = [
      createdStock?.puc,
      rowData?.puc,
      createdStock?.productId,
      createdStock?.product_id,
      rowData?.productId,
      rowData?.product_id,
      createdStock?.productid,
      rowData?.productid
    ];

    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined) {
        continue;
      }

      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      } else if (typeof candidate === 'number') {
        return candidate.toString();
      } else if (typeof candidate === 'bigint') {
        return candidate.toString();
      }
    }

    return null;
  }

  private parseDateField(
    value: any,
    field: 'manufacturedyear' | 'releaseyear',
    issues: StockImportRowIssue[],
    rowNumber: number
  ): number | undefined {
    if (value === null || value === undefined || `${value}`.trim?.() === '') {
      // Date fields must have values
      issues.push({
        type: 'error',
        field,
        message: `${field === 'manufacturedyear' ? 'Manufactured Year' : 'Release Year'} is required`,
      });
      return undefined;
    }

    let date: Date | null = null;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'number') {
      date = this.excelSerialNumberToDate(value);
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split('-').map((part) => parseInt(part, 10));
        date = new Date(Date.UTC(year, month - 1, day));
      } else {
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
          date = parsed;
        }
      }
    }

    if (!date || Number.isNaN(date.getTime())) {
      issues.push({
        type: 'error',
        field,
        message: `Invalid date value in row ${rowNumber}. Expected YYYY-MM-DD format`,
      });
      return undefined;
    }

    // ✅ NEW: Date range validation
    const now = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(now.getFullYear() - 2);

    // Check if date is too old (more than 2 years ago)
    if (date < twoYearsAgo) {
      issues.push({
        type: 'error',
        field,
        message: `${field === 'manufacturedyear' ? 'Manufactured Year' : 'Release Year'} cannot be more than 2 years ago. Date: ${date.toISOString().split('T')[0]}`,
      });
      return undefined;
    }

    // Check if date is in the future
    if (date > now) {
      issues.push({
        type: 'error',
        field,
        message: `${field === 'manufacturedyear' ? 'Manufactured Year' : 'Release Year'} cannot be in the future. Date: ${date.toISOString().split('T')[0]}`,
      });
      return undefined;
    }

    return Math.floor(date.getTime() / 1000);
  }

  private excelSerialNumberToDate(value: number): Date {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * millisecondsPerDay);
    return date;
  }

  // Main method called by controller - Parse and validate Excel file
  async parseAndValidateExcel(fileBuffer: Buffer): Promise<StockImportEvaluation> {
    try {
      logger.info('Starting stock Excel parsing and validation');
      
      // Parse Excel file to extract rows
      const rawRows = await this.parseExcel(fileBuffer);
      console.log(rawRows,"rawRows")
      logger.info({
        rawRowsCount: rawRows.length
      }, 'Excel parsing completed, starting validation');
      
      // Evaluate and validate rows
      const evaluation = await this.evaluateRows(rawRows);
      
      logger.info({
        totalRows: evaluation.summary.totalRows,
        validRows: evaluation.summary.success,
        warningRows: evaluation.summary.warnings,
        errorRows: evaluation.summary.errors
      }, 'Stock import validation completed');
      
      return evaluation;
      
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in parseAndValidateExcel');
      throw error;
    }
  }

  // Insert validated rows into database
  async insertValidatedRows(rows: any[]): Promise<{
    summary: {
      requested: number;
      inserted: number;
      failed: number;
    };
    inserted: Array<{
      rowNumber: number;
      data: any;
    }>;
    failures: Array<{
      rowNumber: number;
      serialnumber?: string;
      rfid?: string;
      message: string;
    }>;
    productQuantityUpdates: {
      attempted: number;
      succeeded: number;
      failed: number;
      failures: Array<{
        identifier: string;
        message: string;
        rowNumber?: number;
      }>;
    };
  }> {
    try {
      logger.info({
        rowCount: rows.length
      }, 'Starting stock bulk insert process');

      const inserted: Array<{ rowNumber: number; data: any }> = [];
      const failures: Array<{ rowNumber: number; serialnumber?: string; rfid?: string; message: string }> = [];
      const productUpdateQueue: Array<{
        identifier: string;
        insertedStock: { ecompublish?: boolean; stockstatus?: string; quantity?: number };
        rowNumber?: number;
      }> = [];

      for (const row of rows) {
        const { rowNumber, ...rowData } = row;

        try {
          // Prepare stock data for insertion while preserving any existing dynamic fields
          const stockData: Record<string, any> = {
            ...rowData,
            stockstatus: rowData.stockstatus ?? 'Available',
            isdeleted: rowData.isdeleted ?? false,
            isarchive: rowData.isarchive ?? false,
            ecompublish: rowData.ecompublish ?? false,
            ewaste: rowData.ewaste ?? false,
            createddate: rowData.createddate ?? BigInt(Date.now()),
            modifieddate: rowData.modifieddate ?? BigInt(Date.now()),
            createdby: rowData.createdby ?? 1, // Default system user - ideally from auth context
            modifiedby: rowData.modifiedby ?? 1
          };

          // Insert stock record via StockService while deferring product quantity recalculation
          const createdStock = await this.stockService.create(stockData as any, { skipProductUpdate: true });

          inserted.push({
            rowNumber: rowNumber || 0,
            data: {
              id: createdStock.id,
              serialnumber: createdStock.serialnumber,
              rfid: createdStock.rfid,
              puc: createdStock.puc,
              stockstatus: createdStock.stockstatus
            }
          });

          const productIdentifier = this.resolveProductIdentifier(rowData, createdStock);
          if (productIdentifier) {
            productUpdateQueue.push({
              identifier: productIdentifier,
              rowNumber,
              insertedStock: {
                ecompublish: createdStock.ecompublish ?? stockData.ecompublish ?? false,
                stockstatus: createdStock.stockstatus ?? stockData.stockstatus ?? 'Available',
                quantity: Number(createdStock.quantity ?? stockData.quantity ?? 1) || 1
              }
            });
          } else {
            logger.warn({
              rowNumber,
              serialnumber: rowData.serialnumber,
              rfid: rowData.rfid
            }, 'Stock created during import but no product identifier found; parent product quantities not updated');
          }

          logger.debug({
            stockId: createdStock.id,
            serialnumber: createdStock.serialnumber,
            rfid: createdStock.rfid,
            rowNumber
          }, 'Stock record inserted successfully');

        } catch (error: any) {
          const errorMessage = error.message || 'Unknown error during insertion';

          failures.push({
            rowNumber: rowNumber || 0,
            serialnumber: rowData?.serialnumber,
            rfid: rowData?.rfid,
            message: errorMessage
          });

          logger.warn({
            rowNumber,
            serialnumber: rowData?.serialnumber,
            rfid: rowData?.rfid,
            error: errorMessage
          }, 'Failed to insert stock record');
        }
      }

      let productUpdateSuccessCount = 0;
      const productUpdateFailures: Array<{ identifier: string; message: string; rowNumber?: number }> = [];

      for (const task of productUpdateQueue) {
        try {
          const updateResult = await this.productService.updateStockTotals(task.identifier, task.insertedStock);
          productUpdateSuccessCount += 1;
          logger.debug({
            productIdentifier: task.identifier,
            rowNumber: task.rowNumber,
            updateResult
          }, 'Updated parent product quantities after stock import row');
        } catch (error: any) {
          const message = error.message || 'Failed to update product quantities';
          const failureRecord: { identifier: string; message: string; rowNumber?: number } = {
            identifier: task.identifier,
            message
          };

          if (typeof task.rowNumber === 'number') {
            failureRecord.rowNumber = task.rowNumber;
          }

          productUpdateFailures.push(failureRecord);
          logger.warn({
            productIdentifier: task.identifier,
            rowNumber: task.rowNumber,
            error: message
          }, 'Failed to update parent product quantities after stock import row');
        }
      }

      const summary = {
        requested: rows.length,
        inserted: inserted.length,
        failed: failures.length
      };

      const productUpdateSummary = {
        attempted: productUpdateQueue.length,
        succeeded: productUpdateSuccessCount,
        failed: productUpdateFailures.length,
        failures: productUpdateFailures
      };

      logger.info({
        ...summary,
        productQuantityUpdates: productUpdateSummary
      }, 'Stock bulk insert process completed with product quantity synchronization');

      return {
        summary,
        inserted,
        failures,
        productQuantityUpdates: productUpdateSummary
      };

    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in insertValidatedRows');
      throw error;
    }
  }
}
