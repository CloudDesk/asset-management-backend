export const DEFAULT_PAGE_SIZE = 5000;
export const DEFAULT_PAGE_NUMBER = 1;
export const TIMEOUT_THRESHOLD = 5000;

export const PRODUCT_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock'
} as const;

export const STOCK_THRESHOLDS = {
  LOW_STOCK_MAX: 5,
  OUT_OF_STOCK: 0
} as const;

export const BASE_CONDITIONS = `(isarchive = FALSE OR isarchive IS NULL) AND (isdeleted = FALSE OR isdeleted IS NULL) AND (removefromrecyclebin = FALSE OR removefromrecyclebin IS NULL)`;

export const DEFAULT_ORDER_BY = {
  field: 'modifieddate',
  direction: 'DESC'
} as const; 