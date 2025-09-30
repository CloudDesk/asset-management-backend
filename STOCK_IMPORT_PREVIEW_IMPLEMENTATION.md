# Stock Import Preview Implementation Documentation

## Overview

The Stock Import Preview functionality allows users to upload Excel files containing stock data, validate the data without committing to the database, and receive detailed feedback about data quality and potential issues. This is a two-phase import process: **Preview** (validation only) and **Commit** (actual database insertion).

## ✅ UPDATED: New Column Structure

The stock import preview now uses an updated column structure with new mandatory fields and validation rules:

### Mandatory Columns
- `puc` - Product Unique Code
- `platform` - Selling platform (must match picklist values)
- `batchno` - Batch or lot number
- `stockstatus` - Stock status (must match picklist values)
- `ecompublish` - E-commerce publish status (TRUE/FALSE)

### Optional Columns
- `manufacturedyear` - Manufactured year (epoch timestamp)
- `releaseyear` - Release year (epoch timestamp)
- `poid` - Purchase Order ID (must exist in database)
- `supplierid` - Supplier ID (must exist in database)
- `serialnumber` - Serial number (no duplicate validation)

## Architecture

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │───▶│   API Route      │───▶│   Controller        │
│   (Excel Upload)│    │   /import/preview│    │   StockController    │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Response      │◀───│   Validation     │◀───│   Service Layer     │
│   (JSON Data)   │    │   Results        │    │   StockImportService│
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                                          │
                                                          ▼
                                                ┌─────────────────────┐
                                                │   Database          │
                                                │   (Validation Only) │
                                                └─────────────────────┘
```

## Implementation Details

### 1. API Route Definition

**File**: `src/routes/stock.route.ts` (Lines 1150-1271)

```typescript
// POST /v1/stocks/import/preview
fastify.post('/import/preview', {
  schema: {
    description: 'Parse and validate stock import Excel file before commit',
    tags: ['Stocks'],
    consumes: ['multipart/form-data'],
    body: {
      type: 'object',
      properties: {
        file: {
          isFile: true,
          description: 'Excel file containing stock data to import',
        },
      },
      required: ['file'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              summary: {
                type: 'object',
                properties: {
                  totalRows: { type: 'number', description: 'Total rows processed' },
                  success: { type: 'number', description: 'Valid rows count' },
                  warnings: { type: 'number', description: 'Rows with warnings' },
                  errors: { type: 'number', description: 'Rows with errors' },
                },
                required: ['totalRows', 'success', 'warnings', 'errors'],
              },
              rows: {
                type: 'array',
                description: 'Detailed row-by-row validation results',
                items: {
                  type: 'object',
                  properties: {
                    rowNumber: { type: 'number', description: 'Excel row number' },
                    status: { type: 'string', enum: ['success', 'warning', 'error'] },
                    normalized: {
                      type: ['object', 'null'],
                      additionalProperties: true,
                      description: 'Normalized stock data ready for insertion'
                    },
                    issues: {
                      type: 'array',
                      description: 'Validation issues for this row',
                      items: {
                        type: 'object',
                        properties: {
                          type: { type: 'string', enum: ['error', 'warning'] },
                          field: { type: ['string', 'null'], nullable: true },
                          message: { type: 'string', description: 'Issue description' },
                        },
                        required: ['type', 'message'],
                      },
                    },
                    original: {
                      type: ['object', 'null'],
                      additionalProperties: true,
                      description: 'Original Excel row data'
                    },
                  },
                  required: ['rowNumber', 'status', 'issues'],
                },
              },
              validRows: {
                type: 'array',
                description: 'Rows ready for insertion',
              },
              warningRows: {
                type: 'array',
                description: 'Rows with warnings but still valid',
              },
              errorRows: {
                type: 'array',
                description: 'Rows with validation errors',
              },
            },
          },
        },
      },
      400: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          details: { type: 'string' },
          statusCode: { type: 'number' },
        },
      },
      500: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          details: { type: 'string' },
          statusCode: { type: 'number' },
        },
      },
    },
  },
}, stockController.importPreview.bind(stockController));
```

### 2. Controller Implementation

**File**: `src/controllers/stock.controller.ts` (Lines 295-370)

```typescript
importPreview = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    console.log('importBulkPreview started');
    
    // Handle Fastify multipart file upload (with attachFieldsToBody: true)
    const body = request.body as any;
    
    // Validate file presence
    if (!body || !body.file) {
      return reply.code(400).send({
        success: false,
        message: 'No file uploaded',
        details: 'Please upload an Excel file using multipart/form-data with field name "file"',
        statusCode: 400
      });
    }

    const uploadedFile = body.file;

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
      warningRows: validationResult.summary.warnings,
      errorRows: validationResult.summary.errors
    }, 'Stock import preview completed');

    const response = createSuccessResponse('Stock import preview completed', validationResult);
    return reply.code(200).send(response);

  } catch (error: any) {
    logger.error({ error: error.message }, 'Error in stock import preview');
    
    return reply.code(500).send({
      success: false,
      message: 'Internal server error during import preview',
      details: error.message,
      statusCode: 500
    });
  }
});
```

### 3. Service Layer Implementation

**File**: `src/services/stockImport.service.ts`

#### Main Entry Point

```typescript
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
```

#### Excel Parsing Process

```typescript
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
        return; // Skip header row
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
```

#### Column Mapping System

The system supports flexible column headers through a mapping system:

```typescript
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
    'manufacturedyear': 'manufacturedyear',
    'manufacture year': 'manufacturedyear',
    'year manufactured': 'manufacturedyear',
    
    // Release Year variations
    'release year': 'releaseyear',
    'releaseyear': 'releaseyear',
    'year released': 'releaseyear',
    
    // Location variations
    'location': 'location',
    'storage location': 'location',
    'warehouse': 'location',
    'store location': 'location',
    
    // E-commerce publish variations
    'ecommerce publish': 'ecompublish',
    'ecompublish': 'ecompublish',
    'e-commerce publish': 'ecompublish',
    'publish to ecommerce': 'ecompublish',
    
    // Additional fields...
  };
}
```

#### Data Validation Process

```typescript
private async evaluateRows(rawRows: StockImportInputRow[]): Promise<StockImportEvaluation> {
  // Process each raw row
  const processedRows = rawRows.map(row => this.processRawRow(row));
  
  // Apply duplicate checks within the file
  this.applyDuplicateChecks(processedRows);
  
  // Apply database validation checks
  await this.applyDatabaseChecks(processedRows);
  
  // Calculate summary statistics
  const summary = this.calculateSummary(processedRows);
  
  // Categorize rows by status
  const validRows = processedRows.filter(row => row.status === 'success').map(row => row.normalized);
  const warningRows = processedRows.filter(row => row.status === 'warning').map(row => row.normalized);
  const errorRows = processedRows.filter(row => row.status === 'error').map(row => row.original);
  
  return {
    summary,
    rows: processedRows,
    validRows,
    warningRows,
    errorRows,
  };
}
```

#### Row Processing Logic

```typescript
private processRawRow(row: StockImportInputRow): StockImportRowResult {
  const issues: StockImportRowIssue[] = [];
  const normalized: StockImportNormalizedRow = {
    rowNumber: row.rowNumber,
    serialnumber: '',
  };

  // ✅ NEW: PUC validation - mandatory field
  const puc = this.normalizeString(row.values.puc);
  if (!puc) {
    issues.push({ type: 'error', field: 'puc', message: 'PUC (Product Unique Code) is required' });
  } else {
    normalized.puc = puc;
  }

  // ✅ NEW: Platform validation - mandatory field
  const platform = this.normalizeString(row.values.platform);
  if (!platform) {
    issues.push({ type: 'error', field: 'platform', message: 'Platform is required' });
  } else {
    normalized.platform = platform;
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
  }

  // ✅ NEW: Supplier ID validation - optional field
  const supplierid = this.normalizeString(row.values.supplierid);
  if (supplierid) {
    normalized.supplierid = supplierid;
  }

  return {
    rowNumber: row.rowNumber,
    status: issues.some((issue) => issue.type === 'error') ? 'error' : 'success',
    normalized: issues.some((issue) => issue.type === 'error') ? null : normalized,
    issues,
    original: row.values,
  };
}
```

#### Database Validation Checks

```typescript
private async applyDatabaseChecks(rows: StockImportRowResult[]): Promise<void> {
  // ✅ NEW: Collect all values for batch validation
  
  // 1. Check PUC existence in products table
  const pucs = new Set(
    rows
      .filter((row) => row.original?.puc && typeof row.original.puc === 'string')
      .map((row: any) => String(row.original.puc).trim())
      .filter(Boolean)
  );

  // 2. Check Platform picklist values
  const platforms = new Set(
    rows
      .filter((row) => row.original?.platform && typeof row.original.platform === 'string')
      .map((row: any) => String(row.original.platform).trim())
      .filter(Boolean)
  );

  // 3. Check Stock Status picklist values
  const stockStatuses = new Set(
    rows
      .filter((row) => row.original?.stockstatus && typeof row.original.stockstatus === 'string')
      .map((row: any) => String(row.original.stockstatus).trim())
      .filter(Boolean)
  );

  // 4. Check Purchase Order IDs
  const poIds = new Set(
    rows
      .filter((row) => row.original?.poid && typeof row.original.poid === 'string')
      .map((row: any) => String(row.original.poid).trim())
      .filter(Boolean)
  );

  // 5. Check Supplier IDs
  const supplierIds = new Set(
    rows
      .filter((row) => row.original?.supplierid && typeof row.original.supplierid === 'string')
      .map((row: any) => String(row.original.supplierid).trim())
      .filter(Boolean)
  );

  // ✅ NEW: Platform picklist validation
  if (platforms.size > 0) {
    const platformList = Array.from(platforms);
    const existingPlatforms = await prisma.picklist.findMany({
      where: {
        object: 'stock',
        fieldname: 'platform',
        OR: platformList.map((value) => ({
          value: { equals: value, mode: 'insensitive' as const },
        })),
      },
      select: { value: true },
    });

    const existingPlatformSet = new Set(existingPlatforms.map((record) => record.value?.toLowerCase()).filter(Boolean) as string[]);

    rows.forEach((row) => {
      const originalPlatform = row.original?.platform;
      if (originalPlatform && typeof originalPlatform === 'string') {
        const key = originalPlatform.trim().toLowerCase();
        if (key && !existingPlatformSet.has(key)) {
          this.appendIssue(row, 'platform', 'Invalid platform value. Must match a value from the platform picklist.');
        }
      }
    });
  }

  // ✅ NEW: Stock Status picklist validation
  if (stockStatuses.size > 0) {
    const stockStatusList = Array.from(stockStatuses);
    const existingStockStatuses = await prisma.picklist.findMany({
      where: {
        object: 'stock',
        fieldname: 'stockstatus',
        OR: stockStatusList.map((value) => ({
          value: { equals: value, mode: 'insensitive' as const },
        })),
      },
      select: { value: true },
    });

    const existingStockStatusSet = new Set(existingStockStatuses.map((record) => record.value?.toLowerCase()).filter(Boolean) as string[]);

    rows.forEach((row) => {
      const originalStockStatus = row.original?.stockstatus;
      if (originalStockStatus && typeof originalStockStatus === 'string') {
        const key = originalStockStatus.trim().toLowerCase();
        if (key && !existingStockStatusSet.has(key)) {
          this.appendIssue(row, 'stockstatus', 'Invalid stock status value. Must match a value from the stock status picklist.');
        }
      }
    });
  }

  // ✅ NEW: Purchase Order ID validation
  if (poIds.size > 0) {
    const poIdList = Array.from(poIds);
    const existingPOs = await prisma.purchaseorder.findMany({
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
      if (originalPOId && typeof originalPOId === 'string') {
        const key = originalPOId.trim();
        if (key && !existingPOSet.has(key)) {
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
      if (originalSupplierId && typeof originalSupplierId === 'string') {
        const key = originalSupplierId.trim();
        if (key && !existingSupplierSet.has(key)) {
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
```

## Data Types and Interfaces

### Core Interfaces

```typescript
export type StockImportRowStatus = 'success' | 'warning' | 'error';

export interface StockImportRowIssue {
  type: 'error' | 'warning';
  field: string | null;
  message: string;
}

export interface StockImportRowResult {
  rowNumber: number;
  status: StockImportRowStatus;
  normalized: StockImportNormalizedRow | null;
  issues: StockImportRowIssue[];
  original: Record<string, any>;
}

export interface StockImportNormalizedRow {
  rowNumber: number;
  serialnumber: string;
  rfid: string;
  puc?: string;
  location?: string;
  manufacturedyear?: number;
  releaseyear?: number;
  ecompublish?: boolean;
  // ... additional fields
}

export interface StockImportEvaluation {
  summary: {
    totalRows: number;
    success: number;
    warnings: number;
    errors: number;
  };
  rows: StockImportRowResult[];
  validRows: any[];
  warningRows: any[];
  errorRows: any[];
}

interface StockImportInputRow {
  rowNumber: number;
  values: Record<string, any>;
  source: ImportSource;
}
```

## Excel File Format Requirements

### ✅ UPDATED: Required Columns

| Column Name | Variations | Description |
|-------------|------------|-------------|
| `puc` | "Product Unique Code", "Product Code" | Product identifier (must exist in products table) |
| `platform` | "Platform", "Selling Platform", "Marketplace" | Selling platform (must match picklist values) |
| `batchno` | "Batch Number", "Batch No", "Lot Number", "Lot No" | Batch or lot number |
| `stockstatus` | "Stock Status", "Status", "Inventory Status" | Stock status (must match picklist values) |
| `ecompublish` | "E-commerce Publish", "E Commerce Publish", "Publish" | E-commerce visibility (TRUE/FALSE) |

### ✅ UPDATED: Optional Columns

| Column Name | Variations | Description | Data Type |
|-------------|------------|-------------|-----------|
| `manufacturedyear` | "Manufactured Year", "Manufacturing Year", "Mfg Year" | Manufacture date | Epoch timestamp (seconds) |
| `releaseyear` | "Release Year", "Release Date" | Release date | Epoch timestamp (seconds) |
| `poid` | "PO ID", "Purchase Order ID", "Purchase Order", "PO" | Purchase order identifier | String (must exist in database) |
| `supplierid` | "Supplier ID", "Supplier", "Vendor ID", "Vendor" | Supplier identifier | String (must exist in database) |
| `serialnumber` | "Serial Number", "Serial", "SN" | Device serial number | String (no duplicate validation) |

### ✅ UPDATED: Sample Excel Structure

```
| puc    | platform | batchno | stockstatus | ecompublish | manufacturedyear | releaseyear | poid | supplierid | serialnumber |
|--------|----------|---------|-------------|------------|------------------|-------------|------|------------|--------------|
| PUC001 | amazon   | BATCH01 | available   | TRUE       | 1640995200       | 1640995200  | PO01 | SUP001     | SN001        |
| PUC002 | ebay     | BATCH02 | reserved    | FALSE      | 1640995200       | 1640995200  | PO02 | SUP002     | SN002        |
```

## API Response Format

### Success Response (200)

```json
{
  "success": true,
  "message": "Stock import preview completed",
  "data": {
    "summary": {
      "totalRows": 100,
      "success": 85,
      "warnings": 10,
      "errors": 5
    },
    "rows": [
      {
        "rowNumber": 2,
        "status": "success",
        "normalized": {
          "rowNumber": 2,
          "serialnumber": "SN001",
          "rfid": "RFID001",
          "puc": "PUC001",
          "location": "warehouse-a",
          "manufacturedyear": 1640995200,
          "ecompublish": true
        },
        "issues": [],
        "original": {
          "serialnumber": "SN001",
          "rfid": "RFID001",
          "puc": "PUC001",
          "location": "warehouse-a",
          "manufacturedyear": 1640995200,
          "ecompublish": true
        }
      },
      {
        "rowNumber": 3,
        "status": "error",
        "normalized": null,
        "issues": [
          {
            "type": "error",
            "field": "serialnumber",
            "message": "Serial Number already exists in database"
          }
        ],
        "original": {
          "serialnumber": "SN001",
          "rfid": "RFID003"
        }
      }
    ],
    "validRows": [
      {
        "rowNumber": 2,
        "serialnumber": "SN001",
        "rfid": "RFID001",
        "puc": "PUC001",
        "location": "warehouse-a",
        "manufacturedyear": 1640995200,
        "ecompublish": true
      }
    ],
    "warningRows": [],
    "errorRows": [
      {
        "serialnumber": "SN001",
        "rfid": "RFID003"
      }
    ]
  }
}
```

### Error Response (400/500)

```json
{
  "success": false,
  "message": "Invalid file type",
  "details": "Please upload an Excel (.xlsx) file",
  "statusCode": 400
}
```

## Usage Examples

### Frontend Integration (JavaScript)

```javascript
// Upload file for preview
async function previewStockImport(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/v1/stocks/import/preview', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      const { summary, rows, validRows, warningRows, errorRows } = result.data;
      
      console.log('Import Preview Results:');
      console.log(`Total Rows: ${summary.totalRows}`);
      console.log(`Valid: ${summary.success}`);
      console.log(`Warnings: ${summary.warnings}`);
      console.log(`Errors: ${summary.errors}`);

      // Display validation results
      displayValidationResults(rows);
      
      // Enable commit button if there are valid rows
      if (validRows.length > 0) {
        enableCommitButton(validRows);
      }
    } else {
      console.error('Preview failed:', result.message);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

function displayValidationResults(rows) {
  const resultsContainer = document.getElementById('validation-results');
  
  rows.forEach(row => {
    const rowElement = document.createElement('div');
    rowElement.className = `row-result ${row.status}`;
    
    rowElement.innerHTML = `
      <h4>Row ${row.rowNumber} - ${row.status.toUpperCase()}</h4>
      ${row.issues.map(issue => 
        `<div class="issue ${issue.type}">${issue.field}: ${issue.message}</div>`
      ).join('')}
    `;
    
    resultsContainer.appendChild(rowElement);
  });
}
```

### cURL Example

```bash
curl -X POST "http://localhost:5600/v1/stocks/import/preview" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@stock_import.xlsx"
```

## Error Handling

### ✅ UPDATED: File-Level Errors

- **No file uploaded**: Returns 400 with message "No file uploaded"
- **Invalid file type**: Returns 400 with message "Invalid file type"
- **Empty file**: Returns 400 with message "Empty file uploaded"
- **No worksheet found**: Returns 400 with message "No worksheet found in uploaded file"
- **Missing headers**: Returns 400 with message "Required columns missing in uploaded file"

### ✅ UPDATED: Data-Level Errors

- **Missing mandatory fields**: PUC, Platform, Batch Number, Stock Status, or E-commerce Publish missing
- **Invalid data types**: Non-boolean values for ecompublish field
- **Invalid picklist values**: Platform or Stock Status values not matching picklist records
- **Invalid reference IDs**: Purchase Order ID or Supplier ID not existing in database
- **Invalid PUC**: Product code doesn't exist in products table
- **Invalid date formats**: Non-numeric values for manufacturedyear or releaseyear fields

### ✅ UPDATED: System-Level Errors

- **Excel parsing errors**: Malformed Excel files
- **Database connection issues**: Database unavailable
- **Memory issues**: Large file processing problems
- **Picklist service errors**: Unable to fetch picklist validation data

## Performance Considerations

### Optimization Strategies

1. **Batch Database Queries**: Single queries for existence checks instead of individual lookups
2. **Memory Management**: Stream processing for large files
3. **Error Recovery**: Continue validation even if some rows fail
4. **Caching**: Cache product PUC lookups for repeated imports

### Scalability Limits

- **File Size**: Recommended maximum 10MB Excel files
- **Row Count**: Recommended maximum 10,000 rows per import
- **Concurrent Imports**: Limited by database connection pool

## Testing

### Unit Tests

```typescript
describe('StockImportService', () => {
  it('should parse Excel file correctly', async () => {
    const mockBuffer = Buffer.from('mock excel data');
    const result = await stockImportService.parseAndValidateExcel(mockBuffer);
    
    expect(result.summary.totalRows).toBeGreaterThan(0);
    expect(result.rows).toBeDefined();
  });

  it('should validate required fields', async () => {
    const mockRows = [
      { rowNumber: 1, values: { serialnumber: 'SN001' }, source: 'raw' }
    ];
    
    const result = await stockImportService.evaluateRows(mockRows);
    
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.rows[0].issues).toContainEqual({
      type: 'error',
      field: 'rfid',
      message: 'RFID is required'
    });
  });
});
```

### Integration Tests

```typescript
describe('Stock Import Preview API', () => {
  it('should accept valid Excel file', async () => {
    const response = await request(app)
      .post('/v1/stocks/import/preview')
      .attach('file', 'test-stock-import.xlsx')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toBeDefined();
  });

  it('should reject invalid file types', async () => {
    const response = await request(app)
      .post('/v1/stocks/import/preview')
      .attach('file', 'test.txt')
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Invalid file type');
  });
});
```

## Dependencies

### Required Packages

```json
{
  "exceljs": "^4.4.0",
  "fastify": "^4.0.0",
  "@fastify/multipart": "^8.0.0",
  "prisma": "^5.0.0"
}
```

### Configuration

```typescript
// Fastify multipart configuration
fastify.register(require('@fastify/multipart'), {
  attachFieldsToBody: true,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});
```

## Future Enhancements

### Planned Features

1. **Progress Tracking**: Real-time progress updates for large files
2. **Template Generation**: Auto-generate Excel templates with validation rules
3. **Batch Processing**: Process multiple files simultaneously
4. **Advanced Validation**: Custom validation rules per product category
5. **Import History**: Track and audit import operations

### Performance Improvements

1. **Streaming Processing**: Process large files without loading into memory
2. **Parallel Validation**: Validate rows in parallel batches
3. **Caching Layer**: Cache validation results for repeated imports
4. **Database Optimization**: Optimize queries for large-scale validation

## Troubleshooting

### ✅ UPDATED: Common Issues

1. **"Required columns missing"**: Ensure PUC, Platform, Batch Number, Stock Status, and E-commerce Publish columns exist
2. **"Invalid platform value"**: Check that platform values match picklist records (object="stock", fieldname="platform")
3. **"Invalid stock status value"**: Check that stock status values match picklist records (object="stock", fieldname="stockstatus")
4. **"PUC does not exist"**: Create product record before importing stock
5. **"Purchase Order ID does not exist"**: Verify PO ID exists in purchaseorder table
6. **"Supplier ID does not exist"**: Verify Supplier ID exists in supplier table
7. **"E-commerce Publish must be TRUE or FALSE"**: Use exact values TRUE or FALSE (case insensitive)
8. **"Invalid file type"**: Ensure file is .xlsx format
9. **"No worksheet found"**: Ensure Excel file has at least one worksheet

### Debug Mode

Enable debug logging by setting environment variable:
```bash
LOG_LEVEL=debug
```

This will provide detailed logs of the parsing and validation process.

## Conclusion

The Stock Import Preview functionality provides a robust, user-friendly way to validate stock data before committing to the database. The implementation follows clean architecture principles with clear separation of concerns, comprehensive error handling, and detailed validation feedback.

The system is designed to be extensible and maintainable, with clear interfaces and comprehensive documentation for future enhancements.
