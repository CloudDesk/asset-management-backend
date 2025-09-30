import pkg from 'exceljs';
const { Workbook } = pkg;
import { StockService } from './stock.service.js';
import { SupplierService } from './supplier.service.js';
import { PurchaseOrderService } from './purchaseorder.service.js';
import { PicklistService } from './picklist.service.js';
import { logger } from '../config/logger.js';

interface StockColumnDefinition {
  key: string;
  header: string;
  required?: boolean;
}

interface SupplierReference {
  id: string;
  name: string;
}

interface PurchaseOrderReference {
  id: string;
  ponumber: string;
}

interface PicklistOption {
  label: string;
  value: string;
}

type PicklistOptionMap = Record<string, PicklistOption[]>;

const BOOLEAN_FIELDS = new Set([
  'ecompublish',
  'isdeleted',
  'isarchive',
  'removefromrecyclebin'
]);

const TEMPORAL_FIELDS = new Set([
  'manufacturedyear',
  'releaseyear',
  'solddate',
  'createddate',
  'modifieddate',
  'rfidscannedtime'
]);

const COLUMN_GUIDELINES: Record<string, string> = {
  puc: 'Required. Product unique code for the stock item.',
  platform: 'Required. Enter the picklist value for the selling platform (see platform picklist below).',
  batchno: 'Required. Batch or lot number for the item.',
  stockstatus: 'Required. Enter the picklist value for stock status (see stock status picklist below).',
  ecompublish: 'Required. Enter TRUE to publish on e-commerce listings, FALSE otherwise.',
  manufacturedyear: 'Optional. Year or date (YYYY-MM-DD) the item was manufactured.',
  releaseyear: 'Optional. Year or date (YYYY-MM-DD) the item was released.',
  poid: 'Optional. Enter the purchase order ID (see purchase order reference).',
  supplierid: 'Optional. Enter the supplier ID (see supplier reference).',
  serialnumber: 'Optional. Device serial number.',
  rfid: 'Optional. RFID tag value.',
  orderid: 'Optional. Related order identifier.',
  orderlinenumber: 'Optional. Related order line number.',
  sku: 'Optional. Stock keeping unit. Auto-generated for existing records.',
  isdeleted: 'Optional. Enter TRUE if the record is marked as deleted or FALSE if active.',
  isarchive: 'Optional. Enter TRUE if archived or FALSE if active.',
  removefromrecyclebin: 'Optional. Enter TRUE if the record should be removed from recycle bin.',
  solddate: 'Optional. Date sold (YYYY-MM-DD).',
  createddate: 'Optional. Record creation date (YYYY-MM-DD).',
  modifieddate: 'Optional. Last modified date (YYYY-MM-DD).',
  rfidscannedtime: 'Optional. Date the RFID was scanned (YYYY-MM-DD).'
};

const TRUE_FALSE_LIST = '"TRUE,FALSE"';

const TEMPLATE_COLUMNS: StockColumnDefinition[] = [
  { key: 'puc', header: 'puc', required: true },
  { key: 'platform', header: 'platform', required: true },
  { key: 'batchno', header: 'batchno', required: true },
  { key: 'stockstatus', header: 'stockstatus', required: true },
  { key: 'ecompublish', header: 'ecompublish', required: true },
  { key: 'manufacturedyear', header: 'manufacturedyear' },
  { key: 'releaseyear', header: 'releaseyear' },
  { key: 'poid', header: 'poid' },
  { key: 'supplierid', header: 'supplierid' },
  { key: 'serialnumber', header: 'serialnumber' }
];

const DATA_COLUMNS: StockColumnDefinition[] = [
  ...TEMPLATE_COLUMNS,
  { key: 'solddate', header: 'solddate' },
  { key: 'createddate', header: 'createddate' },
  { key: 'modifieddate', header: 'modifieddate' }
];

export class ExcelService {
  private stockService = new StockService();
  private supplierService = new SupplierService();
  private purchaseOrderService = new PurchaseOrderService();
  private picklistService = new PicklistService();

  /**
   * Generate multi-sheet Excel file for stock export
   * @param filters - Query filters (including puc, page, limit)
   * @returns Excel buffer
   */
  async generateStockExcel(filters: Record<string, any>): Promise<Buffer> {
    try {
      const { page = 1, limit = 500, ...stockFilters } = filters;

      logger.info({ filters, page, limit }, 'Starting multi-sheet stock Excel generation');

      const stockData = await this.stockService.findMany(stockFilters, page, limit);

      const [suppliers, purchaseOrders, picklistOptions] = await Promise.all([
        this.fetchSuppliers(),
        this.fetchPurchaseOrders(),
        this.fetchStockPicklistOptions()
      ]);

      const workbook = new Workbook();

      this.createBulkUploadSheet(workbook, {
        columns: TEMPLATE_COLUMNS,
        samplePuc: stockFilters.puc
      });

      this.createStockDataSheet(workbook, {
        columns: DATA_COLUMNS,
        stocks: stockData.data
      });

      this.createInstructionsSheet(workbook, {
        columns: TEMPLATE_COLUMNS,
        suppliers,
        purchaseOrders,
        picklistOptions
      });

      const bufferData = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.isBuffer(bufferData)
        ? bufferData
        : Buffer.from(bufferData as ArrayBufferLike);

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

  private addHeaderRow(worksheet: any, headers: string[]) {
    const headerRow = worksheet.addRow(headers);

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    headerRow.eachCell((cell: any) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    return headerRow;
  }

  private createBulkUploadSheet(
    workbook: any,
    params: {
      columns: StockColumnDefinition[];
      samplePuc?: string;
    }
  ) {
    const worksheet = workbook.addWorksheet('Bulk Upload');

    this.addHeaderRow(worksheet, params.columns.map((column) => column.header));

    if (params.samplePuc) {
      const sampleRow = worksheet.addRow(
        params.columns.map((column) => (column.key === 'puc' ? params.samplePuc : ''))
      );

      sampleRow.eachCell((cell: any) => {
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

    const ecomIndex = params.columns.findIndex((column) => column.key === 'ecompublish');
    if (ecomIndex !== -1) {
      worksheet.getColumn(ecomIndex + 1).eachCell({ includeEmpty: true }, (cell: any, rowNumber: number) => {
        if (rowNumber > 1) {
          cell.dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [TRUE_FALSE_LIST]
          };
        }
      });
    }

    this.adjustColumnWidths(worksheet, params.columns);
  }

  private createStockDataSheet(
    workbook: any,
    params: {
      columns: StockColumnDefinition[];
      stocks: any[];
    }
  ) {
    const worksheet = workbook.addWorksheet('Stock Data');
    this.addHeaderRow(worksheet, params.columns.map((column) => column.header));

    params.stocks.forEach((stock) => {
      const rowValues = params.columns.map((column) => this.formatStockValue(column.key, stock[column.key]));
      const row = worksheet.addRow(rowValues);
      this.applyRowBorder(row);
    });

    this.adjustColumnWidths(worksheet, params.columns);
  }

  private createInstructionsSheet(
    workbook: any,
    params: {
      columns: StockColumnDefinition[];
      suppliers: SupplierReference[];
      purchaseOrders: PurchaseOrderReference[];
      picklistOptions: PicklistOptionMap;
    }
  ) {
    const worksheet = workbook.addWorksheet('Instructions');

    const titleRow = worksheet.addRow(['Bulk Stock Upload - Instructions']);
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF4472C4' } };
    titleRow.getCell(1).alignment = { horizontal: 'left' };

    worksheet.addRow([]);

    const steps = [
      'Verify required columns are filled: puc, platform, batchno, stockstatus, ecompublish.',
      'Use the "Bulk Upload" sheet to enter new or updated stock records.',
      'Refer to the guidelines and reference lists below before entering values.',
      'Save the file and upload it back into the system once complete.'
    ];

    steps.forEach((instruction, index) => {
      const row = worksheet.addRow([`Step ${index + 1}:`, instruction]);
      row.getCell(1).font = { bold: true };
    });

    worksheet.addRow([]);

    const guidelinesRow = worksheet.addRow(['Column Guidelines']);
    guidelinesRow.font = { bold: true, size: 14 };

    params.columns.forEach((column) => {
      const description = COLUMN_GUIDELINES[column.key] || (column.required ? 'Required field.' : 'Optional field.');
      const row = worksheet.addRow([column.header, description]);
      row.getCell(1).font = { bold: true };
    });

    worksheet.addRow([]);

    const supplierTitle = worksheet.addRow(['Supplier Reference (ObjectId - Supplier Name)', 'Enter the ID value in the supplierid column.']);
    supplierTitle.font = { bold: true };
    const supplierHeader = worksheet.addRow(['ID', 'Supplier Name']);
    supplierHeader.font = { bold: true };

    if (params.suppliers.length === 0) {
      worksheet.addRow(['No supplier records found.', '']);
    } else {
      params.suppliers.forEach((supplier) => {
        worksheet.addRow([supplier.id, supplier.name]);
      });
    }

    worksheet.addRow([]);

    const poTitle = worksheet.addRow(['Purchase Order Reference (ObjectId - PONumber)', 'Enter the ID value in the poid column.']);
    poTitle.font = { bold: true };
    const poHeader = worksheet.addRow(['ID', 'PO Number']);
    poHeader.font = { bold: true };

    if (params.purchaseOrders.length === 0) {
      worksheet.addRow(['No purchase order records found.', '']);
    } else {
      params.purchaseOrders.forEach((po) => {
        worksheet.addRow([po.id, po.ponumber]);
      });
    }

    worksheet.addRow([]);

    const platformTitle = worksheet.addRow(['Platform Picklist (Label - Value)', 'Enter the Value in the platform column.']);
    platformTitle.font = { bold: true };
    const platformHeader = worksheet.addRow(['Label', 'Value']);
    platformHeader.font = { bold: true };

    const platformOptions = params.picklistOptions['platform'] || [];
    if (platformOptions.length === 0) {
      worksheet.addRow(['No platform picklist records found.', '']);
    } else {
      platformOptions.forEach((option) => {
        worksheet.addRow([option.label, option.value]);
      });
    }

    worksheet.addRow([]);

    const statusTitle = worksheet.addRow(['Stock Status Picklist (Label - Value)', 'Enter the Value in the stockstatus column.']);
    statusTitle.font = { bold: true };
    const statusHeader = worksheet.addRow(['Label', 'Value']);
    statusHeader.font = { bold: true };

    const statusOptions = params.picklistOptions['stockstatus'] || [];
    if (statusOptions.length === 0) {
      worksheet.addRow(['No stock status picklist records found.', '']);
    } else {
      statusOptions.forEach((option) => {
        worksheet.addRow([option.label, option.value]);
      });
    }

    worksheet.getColumn(1).width = 45;
    worksheet.getColumn(2).width = 80;
  }

  private adjustColumnWidths(worksheet: any, columns: StockColumnDefinition[]) {
    columns.forEach((column, index) => {
      const excelColumn = worksheet.getColumn(index + 1);
      let maxLength = column.header.length + 2;

      excelColumn.eachCell({ includeEmpty: true }, (cell: any) => {
        const cellValue = cell.value ?? '';
        const length = typeof cellValue === 'number' ? cellValue.toString().length : cellValue.toString().length;
        if (length + 2 > maxLength) {
          maxLength = length + 2;
        }
      });

      excelColumn.width = Math.min(Math.max(maxLength, 12), 40);
    });

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private applyRowBorder(row: any) {
    row.eachCell((cell: any) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  }

  private formatStockValue(columnKey: string, value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (BOOLEAN_FIELDS.has(columnKey)) {
      if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
      }
      if (typeof value === 'number') {
        return value === 1 ? 'TRUE' : 'FALSE';
      }
      return value.toString().toUpperCase();
    }

    if (TEMPORAL_FIELDS.has(columnKey)) {
      return this.formatTemporalValue(value);
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value.toString() : '';
    }

    if (value instanceof Date) {
      return this.toIsoDateString(value);
    }

    return value.toString();
  }

  private formatTemporalValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    const numericValue = typeof value === 'bigint' ? Number(value) : value;

    if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
      if (numericValue > 1e12) {
        const date = new Date(numericValue);
        return isNaN(date.getTime()) ? numericValue.toString() : this.toIsoDateString(date);
      }

      if (numericValue > 1e9) {
        const date = new Date(numericValue * 1000);
        return isNaN(date.getTime()) ? numericValue.toString() : this.toIsoDateString(date);
      }

      if (numericValue >= 1000 && numericValue <= 9999) {
        return numericValue.toString();
      }

      return numericValue.toString();
    }

    if (typeof numericValue === 'string') {
      return numericValue;
    }

    return '';
  }

  private async fetchSuppliers(): Promise<SupplierReference[]> {
    try {
      const { data } = await this.supplierService.findMany({}, 1, 500);

      return data
        .map((supplier: any) => ({
          id: this.safeToString(supplier.id),
          name: supplier.suppliername || ''
        }))
        .filter((supplier) => supplier.id !== '');
    } catch (error) {
      logger.warn({ error }, 'Failed to load supplier reference data for Excel instructions');
      return [];
    }
  }

  private async fetchPurchaseOrders(): Promise<PurchaseOrderReference[]> {
    try {
      const { data } = await this.purchaseOrderService.findMany({}, 1, 500);

      return data
        .map((po: any) => ({
          id: this.safeToString(po.id),
          ponumber: this.safeToString(
            po.ponumber || po.po_number || po.orderNumber || po.order_number || ''
          )
        }))
        .filter((po) => po.id !== '' && po.ponumber !== '');
    } catch (error) {
      logger.warn({ error }, 'Failed to load purchase order reference data for Excel instructions');
      return [];
    }
  }

  private async fetchStockPicklistOptions(): Promise<PicklistOptionMap> {
    try {
      const picklists = await this.picklistService.findByObject('stock');
      const options: PicklistOptionMap = {};

      picklists.forEach((item: any) => {
        const fieldname = (item.fieldname || '').toString().toLowerCase();
        if (!['platform', 'stockstatus'].includes(fieldname)) {
          return;
        }

        if (!options[fieldname]) {
          options[fieldname] = [];
        }

        options[fieldname].push({
          label: this.safeToString(item.label || ''),
          value: this.safeToString(item.value || '')
        });
      });

      return options;
    } catch (error) {
      logger.warn({ error }, 'Failed to load picklist reference data for Excel instructions');
      return {};
    }
  }

  private toIsoDateString(date: Date): string {
    const isoString = date.toISOString();
    const [datePart] = isoString.split('T');
    return datePart ?? isoString;
  }

  private safeToString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value.toString() : '';
    }

    return value.toString();
  }
}
