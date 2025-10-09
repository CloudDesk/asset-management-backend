import type { StockImportCommitRow } from '../schemas/stock-import.schema.js';
export type StockImportRowStatus = 'success' | 'warning' | 'error';
export interface StockImportRowIssue {
    type: 'error' | 'warning';
    field?: string;
    message: string;
}
export interface StockImportNormalizedRow {
    rowNumber?: number;
    puc: string;
    platform: string;
    batchno: string;
    stockstatus: string;
    ecompublish: boolean;
    serialnumber?: string;
    rfid?: string;
    manufacturedyear?: number;
    releaseyear?: number;
    poid?: string;
    supplierid?: string;
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
export declare class StockImportService {
    private stockService;
    private productService;
    private platformStockService;
    generatePreview(fileBuffer: Buffer): Promise<StockImportEvaluation>;
    validateNormalizedRows(rows: StockImportCommitRow[]): Promise<StockImportEvaluation>;
    private evaluateRows;
    private processRow;
    private processRawRow;
    private processNormalizedRow;
    private applyDuplicateChecks;
    /**
     * Generic picklist validation for all picklist fields
     * Validates and converts labels to values for any field that has picklist data
     */
    private validatePicklistFields;
    private applyDatabaseChecks;
    private appendIssue;
    private hasError;
    private parseExcel;
    private buildColumnMapping;
    private get headerFieldMapping();
    private normalizeHeader;
    private extractCellValue;
    private normalizeString;
    private parseBoolean;
    private resolveProductIdentifier;
    private parseDateField;
    private excelSerialNumberToDate;
    parseAndValidateExcel(fileBuffer: Buffer): Promise<StockImportEvaluation>;
    /**
     * Validate commit data to ensure all picklist values and reference IDs exist
     * This provides an additional safety layer even though preview should have validated
     */
    private validateCommitData;
    insertValidatedRows(rows: any[]): Promise<{
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
    }>;
}
//# sourceMappingURL=stockImport.service.d.ts.map