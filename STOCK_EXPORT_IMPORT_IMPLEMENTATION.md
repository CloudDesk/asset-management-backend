# Stock Export and Import Routes Implementation

## 📋 Overview

Successfully implemented stock export and the two-step bulk import workflow:
- **GET /v1/stocks/export** - Export stocks to Excel file
- **POST /v1/stocks/import/preview** - Parse Excel upload, validate rows, and return a structured preview
- **POST /v1/stocks/import/commit** - Persist previously validated rows after confirmation

## 🚀 Implementation Details

### 1. Dependencies Added
- **ExcelJS**: `npm install exceljs` - For Excel file generation

### 2. Files Created/Modified

#### New Files:
- `src/services/excel.service.ts` - Excel generation service
- `src/services/stockImport.service.ts` - Excel parsing, validation, and commit preparation
- `src/schemas/stock-import.schema.ts` - Zod schema for import commit payload

#### Modified Files:
- `src/controllers/stock.controller.ts` - Added export and import methods
- `src/routes/stock.route.ts` - Added new route definitions

### 3. Excel Export Route Features

#### Endpoint: `GET /v1/stocks/export`

**Query Parameters** (all optional):
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 500)
- All existing stock filter parameters (puc, category, subcategory, etc.)

**Response**: 
- Downloads Excel file with timestamp in filename
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Filename format: `stock_export_YYYY-MM-DDTHH-MM-SS.xlsx`

**Multi-Sheet Excel Structure**:

### **Sheet 1: Bulk Upload Template**
Headers for bulk data entry:
1. **PUC** - Product Unique Code (pre-filled if PUC filter used)
2. **RFID** - RFID tag identifier
3. **Serial Number** - Device serial number
4. **Manufactured Year** - Date in YYYY-MM-DD format
5. **E-Commerce Publish** - Dropdown (TRUE/FALSE)
6. **Release Year** - Date in YYYY-MM-DD format
7. **Location** - Dropdown with predefined options

**Features**:
- PUC pre-filled if specified in query
- Data validation dropdowns for E-Commerce Publish and Location
- Sample row with light gray background
- Date format instructions
- Frozen header row

### **Sheet 2: Stock Data (Current Data)**
Headers showing retrieved stock data:
1. **ID** - Stock ID
2. **PUC** - Product Unique Code
3. **Serial Number** - Device serial number
4. **Stock Status** - Current status (Available, Sold, etc.)
5. **Manufactured Year** - Converted from bigint epoch to DD/MM/YYYY format
6. **Release Year** - Converted from bigint epoch to DD/MM/YYYY format
7. **E-Commerce Publish** - Yes/No format
8. **RFID** - RFID tag identifier
9. **Location** - Storage location

### **Sheet 3: Instructions**
Comprehensive guide including:
- Step-by-step upload instructions
- Column guidelines and requirements
- Available location options
- Date format specifications

### 4. Key Features

#### Excel Formatting:
- Professional blue header with white text
- Borders on all cells
- Auto-fitted column widths
- Frozen header row for easy scrolling
- Specific column widths optimized for content

#### Epoch Time Conversion:
- Automatically converts `manufacturedyear` and `releaseyear` from bigint epoch timestamps
- Handles both bigint and number types
- Returns empty string for invalid/null values
- Uses DD/MM/YYYY format for dates

#### Error Handling:
- Comprehensive error logging
- Graceful handling of missing/invalid data
- Returns appropriate HTTP status codes

### 5. Import Workflow

#### Step 1: `POST /v1/stocks/import/preview`

- Accepts an Excel file (`multipart/form-data`)
- Parses the **Bulk Upload** worksheet and normalises values (PUC, RFID, Serial Number, Manufactured/Release Year, etc.)
- Converts date fields from `YYYY-MM-DD` (or Excel serial/date values) to UTC epoch seconds
- Validates each row and reports:
  - **Success** – fully valid rows ready to commit
  - **Warning** – presently unused but reserved for non-blocking issues
  - **Error** – missing required data, invalid formats, duplicates, or conflicts with existing DB records
- Checks uniqueness for both `serialnumber` and `rfid`
- Returns a detailed payload containing per-row issues, a summary, and the list of valid rows for the next step

#### Step 2: `POST /v1/stocks/import/commit`

- Accepts JSON body with the array of rows selected for insertion (typically the `validRows` from preview)
- Re-validates the payload to guard against stale data or race conditions (duplicate checks re-run against the database)
- Inserts each row using the existing `StockService#create`
- Responds with summary counts, inserted records (formatted for API), and any rows that failed during insertion
- Uses HTTP **201** on full success and **207** if any row fails to insert

#### Validation Rules

- `serialnumber` and `rfid` are required and must be unique within the file and existing DB records
- Date columns accept `YYYY-MM-DD`, Excel date serials, or real Excel date objects; values convert to epoch seconds (UTC)
- Boolean column `ecompublish` accepts `true/false`, `yes/no`, `1/0` (case insensitive)
- Optional fields (PUC, location) are trimmed and included when present

## 🔧 Usage Examples

### Export All Stocks (First 500):
```bash
curl -o stocks.xlsx "http://localhost:5600/v1/stocks/export"
```

### Export Stocks with Filters:
```bash
curl -o stocks_filtered.xlsx "http://localhost:5600/v1/stocks/export?puc=ABC123&stockstatus=Available&page=1&limit=100"
```

### Frontend JavaScript Example:
```javascript
const downloadStockExport = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/v1/stocks/export?${params}`);
  
  if (!response.ok) throw new Error('Export failed');
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `stock_export_${new Date().toISOString().slice(0, 19)}.xlsx`;
  link.click();
  
  window.URL.revokeObjectURL(url);
};

// Usage
downloadStockExport({ puc: 'ABC123', limit: '1000' });
```

## 📊 Excel Output Format

### **Sheet 1: Bulk Upload Template**
| PUC | RFID | Serial Number | Manufactured Year | E-Commerce Publish | Release Year | Location |
|-----|------|---------------|-------------------|-------------------|--------------|----------|
| es-we-0000000002 | | | YYYY-MM-DD | TRUE/FALSE ↓ | YYYY-MM-DD | Select Location ↓ |

### **Sheet 2: Stock Data (Current)**
| ID | PUC | Serial Number | Stock Status | Manufactured Year | Release Year | E-Commerce Publish | RFID | Location |
|----|-----|---------------|--------------|-------------------|--------------|-------------------|------|----------|
| 1 | es-we-0000000002 | Aravi-0032415312 | Available | 15/09/2025 | 15/09/2025 | Yes | 2135432515321 | |

### **Sheet 3: Instructions**
- Step-by-step guide for bulk upload
- Column requirements and formats
- Available dropdown options
- Date format specifications

## 🔄 Integration with Existing System

The implementation follows the existing project patterns:
- Uses existing `StockService` for data retrieval
- Follows same error handling patterns with `asyncHandler`
- Integrates with existing pagination and filtering system
- Uses same Swagger/OpenAPI documentation format
- Maintains consistency with other controller methods

## 🚦 Server Status

✅ **Server starts successfully** with the new implementation
✅ **No compilation errors** in TypeScript
✅ **Preview & commit routes** registered with Fastify and documented in Swagger
✅ **Validation failures return actionable feedback** (row number, field, message)

## 📝 Next Steps

- Extend warning handling to capture non-blocking issues (e.g., optional fields left empty)
- Add automated tests covering preview parsing and commit scenarios
- Consider issuing preview tokens to avoid resending large payloads during commit (optional enhancement)

## 🔐 Security Considerations

- File upload size limits should be configured
- File type validation for imports
- Input sanitization for Excel data
- Rate limiting for export endpoints
- Authentication/authorization as per existing system

## 🐛 Issues Fixed

### ExcelJS Import Error (Fixed ✅)
**Issue**: `ExcelJS.Workbook is not a constructor` error when calling the export endpoint.

**Root Cause**: ExcelJS is a CommonJS module and requires special import handling in ES modules.

**Solution**: Changed from:
```typescript
import * as ExcelJS from 'exceljs';
// or
import ExcelJS from 'exceljs';
```

To:
```typescript
import pkg from 'exceljs';
const { Workbook } = pkg;
```

**Status**: ✅ **RESOLVED** - Export endpoint now works correctly and generates valid Excel files.

### Multi-Sheet Enhancement (Added ✅)
**Enhancement**: Added 3-sheet Excel structure with bulk upload template, current data, and instructions.

**New Features**:
- **Sheet 1 (Bulk Upload)**: Template for data entry with PUC pre-filled, dropdowns for validation
- **Sheet 2 (Stock Data)**: Current retrieved stock data (original functionality preserved)
- **Sheet 3 (Instructions)**: Comprehensive guide for users

**Location Options Available**:
- `warehouse-a` - Warehouse A
- `warehouse-b` - Warehouse B  
- `retail-store-1` - Retail Store 1
- `retail-store-2` - Retail Store 2
- `online-fulfillment` - Online Fulfillment Center

**Data Validation**:
- E-Commerce Publish: TRUE/FALSE dropdown
- Location: Dropdown with predefined warehouse/store options
- Date Format: YYYY-MM-DD for Manufactured Year and Release Year

**Status**: ✅ **COMPLETED** - Multi-sheet export with enhanced functionality ready for production.
