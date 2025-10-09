import pkg from 'exceljs';
const { Workbook } = pkg;
import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';
import { ValidationError } from '../utils/errorHandler.js';
import type { StockImportCommitRow } from '../schemas/stock-import.schema.js';
import { StockService } from './stock.service.js';
import { ProductService } from './product.service.js';
import { PlatformStockService } from './platformStock.service.js';

export type StockImportRowStatus = 'success' | 'warning' | 'error';

export interface StockImportRowIssue {
  type: 'error' | 'warning';
  field?: string;
  message: string;
}

export interface StockImportNormalizedRow {
  rowNumber?: number;
  puc: string; // ✅ UPDATED: Now mandatory
  platform: string; // ✅ NEW: Mandatory
  batchno: string; // ✅ NEW: Mandatory
  stockstatus: string; // ✅ NEW: Mandatory
  ecompublish: boolean; // ✅ UPDATED: Now mandatory
  serialnumber?: string; // ✅ UPDATED: Now optional
  rfid?: string; // ✅ UPDATED: Now optional
  manufacturedyear?: number; // ✅ UPDATED: Optional
  releaseyear?: number; // ✅ UPDATED: Optional
  poid?: string; // ✅ NEW: Optional
  supplierid?: string; // ✅ NEW: Optional
  location?: string; // ✅ LEGACY: Optional, backward compatibility
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
 
  private stockService = new StockService();
  private productService = new ProductService();
  private platformStockService = new PlatformStockService();
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
    try {
      await this.applyDatabaseChecks(processedRows);
    } catch (error) {
      console.error('Error in applyDatabaseChecks:', error);
      throw error;
    }

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
      validRows: validRows.map(row => ({
        ...row,
        rowNumber: row.rowNumber ?? 0, // Ensure rowNumber is always a number
      })),
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
    const normalized: StockImportNormalizedRow = {
      rowNumber: row.rowNumber,
      puc: '',
      platform: '',
      batchno: '',
      stockstatus: '',
      ecompublish: false,
    };

    // ✅ NEW: PUC validation - mandatory field
    const puc = this.normalizeString(row.values.puc);
    if (!puc) {
      issues.push({ type: 'error', field: 'puc', message: 'PUC (Product Unique Code) is required' });
    } else {
      normalized.puc = puc;
      // Note: PUC existence in products table will be validated in applyDatabaseChecks
    }

    // ✅ NEW: Platform validation - mandatory field
    const platform = this.normalizeString(row.values.platform);
    if (!platform) {
      issues.push({ type: 'error', field: 'platform', message: 'Platform is required' });
    } else {
      normalized.platform = platform;
      // Note: Platform picklist validation will be done in applyDatabaseChecks
    }

    // ✅ NEW: Batch Number validation - mandatory field
    const batchno = this.normalizeString(row.values.batchno);
    if (!batchno) {
      issues.push({ type: 'error', field: 'batchno', message: 'Batch Number is required' });
    } else {
      normalized.batchno = batchno;
    }

    // ✅ NEW: Stock Status validation - mandatory field
    const stockstatus = this.normalizeString(row.values.stockstatus);
    if (!stockstatus) {
      issues.push({ type: 'error', field: 'stockstatus', message: 'Stock Status is required' });
    } else {
      normalized.stockstatus = stockstatus;
      // Note: Stock Status picklist validation will be done in applyDatabaseChecks
    }

    // ✅ NEW: E-commerce Publish validation - mandatory field
    const ecompublishValue = row.values.ecompublish;
    if (ecompublishValue === undefined || ecompublishValue === null) {
      issues.push({ type: 'error', field: 'ecompublish', message: 'E-commerce Publish is required' });
    } else if (typeof ecompublishValue === 'boolean') {
      normalized.ecompublish = ecompublishValue;
    } else if (typeof ecompublishValue === 'string') {
      const normalizedValue = ecompublishValue.toLowerCase().trim();
      if (normalizedValue === 'true') {
        normalized.ecompublish = true;
      } else if (normalizedValue === 'false') {
        normalized.ecompublish = false;
      } else {
        issues.push({ type: 'error', field: 'ecompublish', message: 'E-commerce Publish must be TRUE or FALSE' });
      }
    } else {
      issues.push({ type: 'error', field: 'ecompublish', message: 'E-commerce Publish must be TRUE or FALSE' });
    }

    // ✅ NEW: Serial Number - optional field (no duplicate validation)
    const serial = this.normalizeString(row.values.serialnumber);
    if (serial) {
      normalized.serialnumber = serial;
    }

    // ✅ NEW: Manufactured Year validation - optional field
    if (row.values.manufacturedyear !== undefined && row.values.manufacturedyear !== null) {
      const manufactured = this.parseDateField(row.values.manufacturedyear, 'manufacturedyear', issues, row.rowNumber);
      if (manufactured !== undefined) {
        normalized.manufacturedyear = manufactured;
      }
    }

    // ✅ NEW: Release Year validation - optional field
    if (row.values.releaseyear !== undefined && row.values.releaseyear !== null) {
      const release = this.parseDateField(row.values.releaseyear, 'releaseyear', issues, row.rowNumber);
      if (release !== undefined) {
        normalized.releaseyear = release;
      }
    }

    // ✅ NEW: Purchase Order ID validation - optional field
    const poid = this.normalizeString(row.values.poid);
    if (poid) {
      normalized.poid = poid;
      // Note: PO ID existence validation will be done in applyDatabaseChecks
    }

    // ✅ NEW: Supplier ID validation - optional field
    const supplierid = this.normalizeString(row.values.supplierid);
    if (supplierid) {
      normalized.supplierid = supplierid;
      // Note: Supplier ID existence validation will be done in applyDatabaseChecks
    }

    // ✅ LEGACY: RFID validation (keeping for backward compatibility)
    const rfid = this.normalizeString(row.values.rfid);
    if (rfid) {
      normalized.rfid = rfid;
    }

    return {
      rowNumber: row.rowNumber,
      status: issues.some((issue) => issue.type === 'error') ? 'error' : 'success',
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
      puc: '',
      platform: '',
      batchno: '',
      stockstatus: '',
      ecompublish: false,
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
    // ✅ UPDATED: Only check RFID duplicates (serial number duplicates are now allowed)
    const rfidMap = new Map<string, StockImportRowResult[]>();

    for (const row of rows) {
      const rfidKey = row.normalized?.rfid?.toLowerCase();
      if (rfidKey) {
        const list = rfidMap.get(rfidKey) ?? [];
        list.push(row);
        rfidMap.set(rfidKey, list);
      }
    }

    const duplicateMessage = {
      rfid: 'Duplicate RFID found in uploaded file',
    };

    rfidMap.forEach((list) => {
      if (list.length > 1) {
        list.forEach((row) => this.appendIssue(row, 'rfid', duplicateMessage.rfid));
      }
    });
  }

  /**
   * Generic picklist validation for all picklist fields
   * Validates and converts labels to values for any field that has picklist data
   */
  private async validatePicklistFields(rows: StockImportRowResult[]): Promise<void> {
    // Define which fields are picklist fields for the stock object
    const picklistFields = ['platform', 'stockstatus']; // Add more fields as needed
    
    // Collect all unique values for each picklist field
    const fieldValues = new Map<string, Set<string>>();
    
    picklistFields.forEach(field => {
      fieldValues.set(field, new Set());
    });

    // Collect values from all rows
    rows.forEach(row => {
      picklistFields.forEach(field => {
        const value = row.original?.[field];
        if (value && typeof value === 'string' && value.trim()) {
          fieldValues.get(field)!.add(value.trim());
        }
      });
    });

    // Process each picklist field
    for (const field of picklistFields) {
      const values = fieldValues.get(field);
      if (!values || values.size === 0) continue;

      const valueList = Array.from(values);
      
      // Fetch picklist data for this field
      const picklistData = await prisma.picklist.findMany({
        where: {
          object: 'stock',
          fieldname: field,
          OR: [
            ...valueList.map((value) => ({ value: { equals: value, mode: 'insensitive' as const } })),
            ...valueList.map((value) => ({ label: { equals: value, mode: 'insensitive' as const } }))
          ],
        },
        select: { value: true, label: true },
      });

      // Create mapping from label to value
      const labelToValueMap = new Map<string, string>();
      const validValues = new Set<string>();
      
      picklistData.forEach((record) => {
        if (record.value && record.label) {
          const valueLower = record.value.toLowerCase();
          const labelLower = record.label.toLowerCase();
          validValues.add(valueLower);
          labelToValueMap.set(labelLower, record.value);
        }
      });

      // Apply validation and conversion to each row
      rows.forEach((row) => {
        const originalValue = row.original?.[field];
        if (originalValue && typeof originalValue === 'string') {
          const inputLower = originalValue.trim().toLowerCase();
          
          // Check if input is a label first (prioritize label-to-value conversion)
          if (labelToValueMap.has(inputLower)) {
            // Input is a label, convert to value
            const dbValue = labelToValueMap.get(inputLower)!;
            if (row.normalized) {
              (row.normalized as any)[field] = dbValue;
            }
          } else if (validValues.has(inputLower)) {
            // Input is already a valid value, keep it as is
            if (row.normalized) {
              (row.normalized as any)[field] = originalValue.trim();
            }
          } else {
            // Input is neither a valid value nor a valid label
            this.appendIssue(row, field, `Invalid ${field} value. Must match a value or label from the ${field} picklist.`);
          }
        }
      });
    }
  }

  private async applyDatabaseChecks(rows: StockImportRowResult[]): Promise<void> {
    // ✅ NEW: Collect all values for batch validation

    // 1. Apply generic picklist validation for all picklist fields
    await this.validatePicklistFields(rows);

    // 2. Check PUC existence in products table - use original data
    const pucs = new Set(
      rows
        .filter((row) => row.original?.puc && typeof row.original.puc === 'string')
        .map((row: any) => String(row.original.puc).trim())
        .filter(Boolean)
    );


    // 4. Check Purchase Order IDs - use original data
    const poIds = new Set(
      rows
        .filter((row) => row.original?.poid !== undefined && row.original?.poid !== null)
        .map((row: any) => {
          const poId = row.original.poid;
          if (typeof poId === 'number') {
            return poId;
          } else if (typeof poId === 'string') {
            return parseInt(poId.trim(), 10);
          }
          return NaN;
        })
        .filter((id) => !isNaN(id))
    );

    // 5. Check Supplier IDs - use original data
    const supplierIds = new Set(
      rows
        .filter((row) => row.original?.supplierid !== undefined && row.original?.supplierid !== null)
        .map((row: any) => {
          const supplierId = row.original.supplierid;
          if (typeof supplierId === 'number') {
            return supplierId;
          } else if (typeof supplierId === 'string') {
            return parseInt(supplierId.trim(), 10);
          }
          return NaN;
        })
        .filter((id) => !isNaN(id))
    );



    // ✅ NEW: Purchase Order ID validation
    if (poIds.size > 0) {
      const poIdList = Array.from(poIds);
      const existingPOs = await prisma.purchaseOrder.findMany({
        where: {
          OR: poIdList.map((value) => ({
            id: { equals: value },
          })),
        },
        select: { id: true },
      });

      const existingPOSet = new Set(existingPOs.map((record) => record.id));

      rows.forEach((row) => {
        const originalPOId = row.original?.poid;
        if (originalPOId !== undefined && originalPOId !== null) {
          let parsedId: number;
          if (typeof originalPOId === 'number') {
            parsedId = originalPOId;
          } else if (typeof originalPOId === 'string') {
            parsedId = parseInt(originalPOId.trim(), 10);
          } else {
            return; // Skip invalid types
          }
          
          if (!isNaN(parsedId) && !existingPOSet.has(parsedId)) {
            this.appendIssue(row, 'poid', 'Purchase Order ID does not exist in database.');
          }
        }
      });
    }

    // ✅ NEW: Supplier ID validation
    if (supplierIds.size > 0) {
      const supplierIdList = Array.from(supplierIds);
      const existingSuppliers = await prisma.supplier.findMany({
        where: {
          OR: supplierIdList.map((value) => ({
            id: { equals: value },
          })),
        },
        select: { id: true },
      });

      const existingSupplierSet = new Set(existingSuppliers.map((record) => record.id));

      rows.forEach((row) => {
        const originalSupplierId = row.original?.supplierid;
        if (originalSupplierId !== undefined && originalSupplierId !== null) {
          let parsedId: number;
          if (typeof originalSupplierId === 'number') {
            parsedId = originalSupplierId;
          } else if (typeof originalSupplierId === 'string') {
            parsedId = parseInt(originalSupplierId.trim(), 10);
          } else {
            return; // Skip invalid types
          }
          
          if (!isNaN(parsedId) && !existingSupplierSet.has(parsedId)) {
            this.appendIssue(row, 'supplierid', 'Supplier ID does not exist in database.');
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

  private async parseExcel(fileBuffer: any): Promise<StockImportInputRow[]> {
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
      const requiredFields = ['puc', 'platform', 'batchno', 'stockstatus', 'ecompublish'];
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
      // ✅ NEW: PUC variations (mandatory)
      'puc': 'puc',
      'product unique code': 'puc',
      'product code': 'puc',

      // ✅ NEW: Platform variations (mandatory)
      'platform': 'platform',
      'selling platform': 'platform',
      'marketplace': 'platform',

      // ✅ NEW: Batch Number variations (mandatory)
      'batchno': 'batchno',
      'batch number': 'batchno',
      'batch no': 'batchno',
      'lot number': 'batchno',
      'lot no': 'batchno',

      // ✅ NEW: Stock Status variations (mandatory)
      'stockstatus': 'stockstatus',
      'stock status': 'stockstatus',
      'status': 'stockstatus',
      'inventory status': 'stockstatus',

      // ✅ NEW: E-commerce Publish variations (mandatory)
      'ecompublish': 'ecompublish',
      'e-commerce publish': 'ecompublish',
      'e commerce publish': 'ecompublish',
      'ecommerce publish': 'ecompublish',
      'publish': 'ecompublish',
      'ec publish': 'ecompublish',
      'publish to ecommerce': 'ecompublish',

      // ✅ NEW: Manufactured Year variations (optional)
      'manufacturedyear': 'manufacturedyear',
      'manufactured year': 'manufacturedyear',
      'manufacturing year': 'manufacturedyear',
      'manufacturing date': 'manufacturedyear',
      'mfg year': 'manufacturedyear',
      'mfg date': 'manufacturedyear',

      // ✅ NEW: Release Year variations (optional)
      'releaseyear': 'releaseyear',
      'release year': 'releaseyear',
      'release date': 'releaseyear',

      // ✅ NEW: Purchase Order ID variations (optional)
      'poid': 'poid',
      'po id': 'poid',
      'purchase order id': 'poid',
      'purchase order': 'poid',
      'po': 'poid',

      // ✅ NEW: Supplier ID variations (optional)
      'supplierid': 'supplierid',
      'supplier id': 'supplierid',
      'supplier': 'supplierid',
      'vendor id': 'supplierid',
      'vendor': 'supplierid',

      // ✅ NEW: Serial Number variations (optional)
      'serialnumber': 'serialnumber',
      'serial number': 'serialnumber',
      'serial': 'serialnumber',
      'sn': 'serialnumber',

      // ✅ LEGACY: RFID variations (optional, backward compatibility)
      'rfid': 'rfid',
      'rfid tag': 'rfid',
      'rfid number': 'rfid',

      // ✅ LEGACY: Location variations (optional, backward compatibility)
      'location': 'location',
      'storage location': 'location',
      'warehouse': 'location',
      'warehouse location': 'location',

      // ✅ LEGACY: Additional common stock fields (optional, backward compatibility)
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
        date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
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

  /**
   * Validate commit data to ensure all picklist values and reference IDs exist
   * This provides an additional safety layer even though preview should have validated
   */
  private async validateCommitData(rows: any[]): Promise<void> {
    // Collect all unique values for validation
    const platforms = new Set<string>();
    const stockStatuses = new Set<string>();
    const poIds = new Set<number>();
    const supplierIds = new Set<number>();
    const pucs = new Set<string>();

    rows.forEach(row => {
      if (row.platform && typeof row.platform === 'string') {
        platforms.add(row.platform.trim());
      }
      if (row.stockstatus && typeof row.stockstatus === 'string') {
        stockStatuses.add(row.stockstatus.trim());
      }
      if (row.poid) {
        const poId = typeof row.poid === 'string' ? parseInt(row.poid, 10) : row.poid;
        if (!isNaN(poId)) poIds.add(poId);
      }
      if (row.supplierid) {
        const supplierId = typeof row.supplierid === 'string' ? parseInt(row.supplierid, 10) : row.supplierid;
        if (!isNaN(supplierId)) supplierIds.add(supplierId);
      }
      if (row.puc && typeof row.puc === 'string') {
        pucs.add(row.puc.trim());
      }
    });

    // Validate picklist values
    if (platforms.size > 0) {
      const platformList = Array.from(platforms);
      const existingPlatforms = await prisma.picklist.findMany({
        where: {
          object: 'stock',
          fieldname: 'platform',
          OR: [
            ...platformList.map((value) => ({ value: { equals: value, mode: 'insensitive' as const } })),
            ...platformList.map((value) => ({ label: { equals: value, mode: 'insensitive' as const } }))
          ],
        },
        select: { value: true, label: true },
      });

      const validPlatforms = new Set<string>();
      existingPlatforms.forEach(record => {
        if (record.value) validPlatforms.add(record.value.toLowerCase());
        if (record.label) validPlatforms.add(record.label.toLowerCase());
      });

      const invalidPlatforms = platformList.filter(platform => 
        !validPlatforms.has(platform.toLowerCase())
      );

      if (invalidPlatforms.length > 0) {
        throw new ValidationError(`Invalid platform values: ${invalidPlatforms.join(', ')}. Must match values from the platform picklist.`);
      }
    }

    if (stockStatuses.size > 0) {
      const stockStatusList = Array.from(stockStatuses);
      const existingStockStatuses = await prisma.picklist.findMany({
        where: {
          object: 'stock',
          fieldname: 'stockstatus',
          OR: [
            ...stockStatusList.map((value) => ({ value: { equals: value, mode: 'insensitive' as const } })),
            ...stockStatusList.map((value) => ({ label: { equals: value, mode: 'insensitive' as const } }))
          ],
        },
        select: { value: true, label: true },
      });

      const validStockStatuses = new Set<string>();
      existingStockStatuses.forEach(record => {
        if (record.value) validStockStatuses.add(record.value.toLowerCase());
        if (record.label) validStockStatuses.add(record.label.toLowerCase());
      });

      const invalidStockStatuses = stockStatusList.filter(status => 
        !validStockStatuses.has(status.toLowerCase())
      );

      if (invalidStockStatuses.length > 0) {
        throw new ValidationError(`Invalid stock status values: ${invalidStockStatuses.join(', ')}. Must match values from the stock status picklist.`);
      }
    }

    // Validate reference IDs
    if (poIds.size > 0) {
      const poIdList = Array.from(poIds);
      const existingPOs = await prisma.purchaseOrder.findMany({
        where: {
          OR: poIdList.map((id) => ({ id: { equals: id } })),
        },
        select: { id: true },
      });

      const existingPOSet = new Set(existingPOs.map(record => record.id));
      const invalidPOIds = poIdList.filter(id => !existingPOSet.has(id));

      if (invalidPOIds.length > 0) {
        throw new ValidationError(`Invalid Purchase Order IDs: ${invalidPOIds.join(', ')}. These IDs do not exist in the database.`);
      }
    }

    if (supplierIds.size > 0) {
      const supplierIdList = Array.from(supplierIds);
      const existingSuppliers = await prisma.supplier.findMany({
        where: {
          OR: supplierIdList.map((id) => ({ id: { equals: id } })),
        },
        select: { id: true },
      });

      const existingSupplierSet = new Set(existingSuppliers.map(record => record.id));
      const invalidSupplierIds = supplierIdList.filter(id => !existingSupplierSet.has(id));

      if (invalidSupplierIds.length > 0) {
        throw new ValidationError(`Invalid Supplier IDs: ${invalidSupplierIds.join(', ')}. These IDs do not exist in the database.`);
      }
    }

    // Validate PUCs exist in products
    if (pucs.size > 0) {
      const pucList = Array.from(pucs);
      const existingProducts = await prisma.product.findMany({
        where: {
          OR: pucList.map((puc) => ({ puc: { equals: puc, mode: 'insensitive' as const } })),
        },
        select: { puc: true },
      });

      const existingPucSet = new Set(existingProducts.map(record => record.puc?.toLowerCase()));
      const invalidPucs = pucList.filter(puc => !existingPucSet.has(puc.toLowerCase()));

      if (invalidPucs.length > 0) {
        throw new ValidationError(`Invalid PUCs: ${invalidPucs.join(', ')}. These PUCs do not exist in the products database. Please create the products first.`);
      }
    }

    logger.info({
      platformsValidated: platforms.size,
      stockStatusesValidated: stockStatuses.size,
      poIdsValidated: poIds.size,
      supplierIdsValidated: supplierIds.size,
      pucsValidated: pucs.size
    }, 'Commit data validation completed successfully');
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
    platformStockUpdates: {
      attempted: number;
      succeeded: number;
      failed: number;
      failures: Array<{
        productId: number;
        platform: string;
        message: string;
        rowNumber?: number;
      }>;
    };
  }> {
    try {
      logger.info({
        rowCount: rows.length
      }, 'Starting stock bulk insert process');

      // ✅ NEW: Validate all rows before insertion to ensure data integrity
      await this.validateCommitData(rows);

      const inserted: Array<{ rowNumber: number; data: any }> = [];
      const failures: Array<{ rowNumber: number; serialnumber?: string; rfid?: string; message: string }> = [];
      const productUpdateQueue: Array<{
        identifier: string;
        insertedStock: { ecompublish?: boolean; stockstatus?: string; quantity?: number };
        rowNumber?: number;
      }> = [];
      const platformStockUpdateQueue: Array<{
        productId: number;
        platform: string;
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

          // Convert string IDs to integers for database compatibility
          if (stockData.poid && typeof stockData.poid === 'string') {
            stockData.poid = parseInt(stockData.poid, 10);
          }
          if (stockData.supplierid && typeof stockData.supplierid === 'string') {
            stockData.supplierid = parseInt(stockData.supplierid, 10);
          }

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
            const insertedStockInfo = {
              ecompublish: createdStock.ecompublish ?? stockData.ecompublish ?? false,
              stockstatus: createdStock.stockstatus ?? stockData.stockstatus ?? 'Available',
              quantity: Number(createdStock.quantity ?? stockData.quantity ?? 1) || 1
            };

            // Queue product update
            productUpdateQueue.push({
              identifier: productIdentifier,
              rowNumber,
              insertedStock: insertedStockInfo
            });

            // Queue platformstock update if platform is available
            if (createdStock.platform) {
              // Need to get productId from the product identifier
              // This will be resolved during the update phase
              platformStockUpdateQueue.push({
                productId: 0, // Will be resolved from identifier
                platform: createdStock.platform,
                insertedStock: insertedStockInfo,
                rowNumber
              });
            }
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

      // Update product quantities
      let productUpdateSuccessCount = 0;
      const productUpdateFailures: Array<{ identifier: string; message: string; rowNumber?: number }> = [];
      const productIdMap = new Map<string, number>(); // Map identifier to productId for platformstock updates

      for (const task of productUpdateQueue) {
        try {
          const updateResult = await this.productService.updateStockTotals(task.identifier, task.insertedStock);
          productUpdateSuccessCount += 1;
          
          // Get product to extract productId for platformstock updates
          try {
            const product = await this.productService.findById(task.identifier);
            if (product && product.id) {
              productIdMap.set(task.identifier, Number(product.id));
            }
          } catch (error) {
            // If we can't get the product, we'll skip platformstock update for this item
          }
          
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

      // Update platformstock quantities (NEW - was missing in bulk import)
      let platformStockUpdateSuccessCount = 0;
      const platformStockUpdateFailures: Array<{ 
        productId: number; 
        platform: string; 
        message: string; 
        rowNumber?: number 
      }> = [];

      // Group platformstock updates by unique (productId, platform) to avoid duplicate updates
      const platformStockGroups = new Map<string, {
        productId: number;
        platform: string;
        totalQuantity: number;
        ecompublishQuantity: number; // Separate count for ecompublish=true items
        hasAnyEcompublish: boolean;
        stockstatus: string;
        rowNumbers: number[];
      }>();

      // Resolve productIds and group by (productId, platform)
      for (let i = 0; i < platformStockUpdateQueue.length; i++) {
        const task = platformStockUpdateQueue[i];
        const productTask = productUpdateQueue[i];
        
        if (!task || !productTask) continue;
        
        const productIdentifier = productTask.identifier;
        if (!productIdentifier) continue;

        const productId = productIdMap.get(productIdentifier);
        if (!productId) continue;

        const groupKey = `${productId}_${task.platform}`;
        const existing = platformStockGroups.get(groupKey);
        const itemQuantity = task.insertedStock.quantity || 1;
        const isEcompublish = task.insertedStock.ecompublish || false;

        if (existing) {
          // Aggregate quantities for same product-platform combination
          existing.totalQuantity += itemQuantity;
          // Count ecompublish items separately
          if (isEcompublish) {
            existing.ecompublishQuantity += itemQuantity;
          }
          if (task.rowNumber) existing.rowNumbers.push(task.rowNumber);
          // Track if ANY item has ecompublish=true
          existing.hasAnyEcompublish = existing.hasAnyEcompublish || isEcompublish;
        } else {
          platformStockGroups.set(groupKey, {
            productId,
            platform: task.platform,
            totalQuantity: itemQuantity,
            ecompublishQuantity: isEcompublish ? itemQuantity : 0,
            hasAnyEcompublish: isEcompublish,
            stockstatus: task.insertedStock.stockstatus || 'Available',
            rowNumbers: task.rowNumber ? [task.rowNumber] : []
          });
        }
      }

      logger.info({
        platformStockGroupsCount: platformStockGroups.size,
        totalQueuedUpdates: platformStockUpdateQueue.length
      }, 'Grouped platformstock updates by product-platform combination');

      // Execute platformstock updates
      for (const [groupKey, group] of platformStockGroups.entries()) {
        try {
          // Get current platformstock record
          const currentRecord = await prisma.platformStock.findUnique({
            where: {
              productid_platform: {
                productid: BigInt(group.productId),
                platform: group.platform
              }
            }
          });

          // Calculate new quantities
          const currentAvailableQty = currentRecord?.availableqty || 0;
          const currentTotalQty = currentRecord?.totalqty || 0;
          const currentSoldQty = currentRecord?.soldqty || 0;

          // totalQty increases by ALL items (regardless of ecompublish)
          const newTotalQty = currentTotalQty + group.totalQuantity;
          
          // availableQty increases ONLY by ecompublish=true items
          const newAvailableQty = currentAvailableQty + group.ecompublishQuantity;
          
          // Calculate platform status based on new available quantity
          const newPlatformStatus = this.platformStockService['calculatePlatformStatus'](newAvailableQty);

          logger.debug({
            productId: group.productId,
            platform: group.platform,
            before: {
              availableqty: currentAvailableQty,
              totalqty: currentTotalQty
            },
            additions: {
              totalQuantity: group.totalQuantity,
              ecompublishQuantity: group.ecompublishQuantity
            },
            after: {
              availableqty: newAvailableQty,
              totalqty: newTotalQty,
              platformstatus: newPlatformStatus
            }
          }, 'Calculating platformstock quantities for bulk update');

          // Update platformstock directly
          await prisma.platformStock.upsert({
            where: {
              productid_platform: {
                productid: BigInt(group.productId),
                platform: group.platform
              }
            },
            update: {
              availableqty: newAvailableQty,
              totalqty: newTotalQty,
              soldqty: currentSoldQty,
              platformstatus: newPlatformStatus,
              modifieddate: BigInt(Date.now())
            },
            create: {
              productid: BigInt(group.productId),
              platform: group.platform,
              availableqty: newAvailableQty,
              totalqty: newTotalQty,
              soldqty: 0,
              orderedqty: 0,
              lockqty: 0,
              platformstatus: newPlatformStatus,
              createddate: BigInt(Date.now()),
              modifieddate: BigInt(Date.now())
            }
          });
          
          platformStockUpdateSuccessCount += 1;
          
          logger.debug({
            productId: group.productId,
            platform: group.platform,
            totalQuantity: group.totalQuantity,
            ecompublishQuantity: group.ecompublishQuantity,
            rowNumbers: group.rowNumbers,
            hasAnyEcompublish: group.hasAnyEcompublish,
            stockstatus: group.stockstatus,
            newAvailableQty,
            newTotalQty,
            newPlatformStatus
          }, 'Updated platformstock quantities after bulk stock import');
        } catch (error: any) {
          const message = error.message || 'Failed to update platformstock quantities';
          const failureRecord = {
            productId: group.productId,
            platform: group.platform,
            message,
            ...(group.rowNumbers.length > 0 ? { rowNumber: group.rowNumbers[0] } : {})
          };
          
          platformStockUpdateFailures.push(failureRecord);
          
          logger.warn({
            productId: group.productId,
            platform: group.platform,
            rowNumbers: group.rowNumbers,
            error: message
          }, 'Failed to update platformstock quantities after bulk stock import');
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

      const platformStockUpdateSummary = {
        attempted: platformStockGroups.size,
        succeeded: platformStockUpdateSuccessCount,
        failed: platformStockUpdateFailures.length,
        failures: platformStockUpdateFailures
      };

      logger.info({
        ...summary,
        productQuantityUpdates: productUpdateSummary,
        platformStockUpdates: platformStockUpdateSummary
      }, 'Stock bulk insert process completed with product and platformstock quantity synchronization');

      return {
        summary,
        inserted,
        failures,
        productQuantityUpdates: productUpdateSummary,
        platformStockUpdates: platformStockUpdateSummary
      };

    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in insertValidatedRows');
      throw error;
    }
  }
}
