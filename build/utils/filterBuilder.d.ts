export interface FilterOptions {
    [key: string]: string | string[] | undefined;
}
/**
 * Builds flexible product filters that work with any column naming convention
 */
export declare function buildProductFilters(filters: FilterOptions): any;
/**
 * Builds flexible stock filters that work with any column naming convention
 */
export declare function buildStockFilters(filters: FilterOptions): any;
/**
 * Builds flexible picklist filters that work with any column naming convention
 */
export declare function buildPicklistFilters(filters: FilterOptions): any;
/**
 * Builds flexible supplier filters that work with any column naming convention
 */
export declare function buildSupplierFilters(filters: FilterOptions): any;
/**
 * Builds flexible purchase order filters that work with any column naming convention
 */
export declare function buildPurchaseOrderFilters(filters: FilterOptions): any;
/**
 * Builds flexible purchase request filters that work with any column naming convention
 */
export declare function buildPurchaseRequestFilters(filters: FilterOptions): any;
//# sourceMappingURL=filterBuilder.d.ts.map