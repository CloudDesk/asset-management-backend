export declare class ExcelService {
    private stockService;
    private readonly locationOptions;
    /**
     * Generate multi-sheet Excel file for stock export
     * @param filters - Query filters (including puc, page, limit)
     * @returns Excel buffer
     */
    generateStockExcel(filters: Record<string, any>): Promise<Buffer>;
    /**
     * Add header row with styling
     */
    private addHeaderRow;
    /**
     * Bind stock data to Excel rows
     */
    private bindStockDataToRows;
    /**
     * Convert epoch timestamp (bigint) to readable date format
     * @param epochTime - Bigint epoch timestamp in seconds
     * @returns Formatted date string or empty string
     */
    private convertEpochToDate;
    /**
     * Apply formatting to the worksheet
     */
    private formatStockWorksheet;
    /**
     * Create Sheet 1: Bulk Upload Template
     */
    private createBulkUploadSheet;
    /**
     * Create Sheet 2: Stock Data (Retrieved Data)
     */
    private createStockDataSheet;
    /**
     * Create Sheet 3: Instructions
     */
    private createInstructionsSheet;
}
//# sourceMappingURL=excel.service.d.ts.map