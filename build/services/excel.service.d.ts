export declare class ExcelService {
    private stockService;
    private supplierService;
    private purchaseOrderService;
    private picklistService;
    /**
     * Generate multi-sheet Excel file for stock export
     * @param filters - Query filters (including puc, page, limit)
     * @returns Excel buffer
     */
    generateStockExcel(filters: Record<string, any>): Promise<Buffer>;
    private addHeaderRow;
    private createBulkUploadSheet;
    private createStockDataSheet;
    private createInstructionsSheet;
    private adjustColumnWidths;
    private applyRowBorder;
    private formatStockValue;
    private formatTemporalValue;
    private fetchSuppliers;
    private fetchPurchaseOrders;
    private fetchStockPicklistOptions;
    private toIsoDateString;
    private safeToString;
}
//# sourceMappingURL=excel.service.d.ts.map