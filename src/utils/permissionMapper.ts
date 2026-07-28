/**
 * Maps frontend object names to database table names
 * Frontend uses: "products", "purchase_requests", etc.
 * DB uses: "product", "purchaserequest", etc.
 */
export const FRONTEND_TO_DB_TABLE_MAP: Record<string, string> = {
  // Existing objects
  'products': 'product',
  'stocks': 'stock',
  'orders': 'orders',
  'suppliers': 'supplier',
  'purchase_requests': 'purchaserequest',
  'purchase_orders': 'purchaseorder',
  'promotions': 'promotions',
  'picklist': 'picklist',
  'category_images': 'category_images',
  'transactions': 'transaction',
  'users': 'users',
  'roles': 'roles',
  'permissionsets': 'permission_sets',
  
  // Future objects (not in DB yet, but can be used in permissions)
  'channels': 'channels',
  'dashboards': 'dashboards',
  'accounts': 'accounts',
  'contacts': 'contacts',
  'layoutconfigs': 'layoutconfigs',
  'reports': 'reports',
};

/**
 * Converts frontend object name to database table name
 * @param frontendName - Frontend config name (e.g., "products", "purchase_requests")
 * @returns Database table name (e.g., "product", "purchaserequest")
 */
export function getDbTableName(frontendName: string): string {
  return FRONTEND_TO_DB_TABLE_MAP[frontendName] || frontendName;
}

/**
 * Converts database table name to frontend object name
 * @param dbTableName - Database table name (e.g., "product", "purchaserequest")
 * @returns Frontend config name (e.g., "products", "purchase_requests")
 */
export function getFrontendName(dbTableName: string): string {
  const reverseMap: Record<string, string> = {};
  Object.entries(FRONTEND_TO_DB_TABLE_MAP).forEach(([key, value]) => {
    reverseMap[value] = key;
  });
  return reverseMap[dbTableName] || dbTableName;
}

/**
 * Validates if a frontend object name is valid
 */
export function isValidFrontendObject(frontendName: string): boolean {
  return Object.keys(FRONTEND_TO_DB_TABLE_MAP).includes(frontendName);
}

/**
 * Gets all valid frontend object names
 */
export function getAllValidFrontendObjects(): string[] {
  return Object.keys(FRONTEND_TO_DB_TABLE_MAP);
}

/**
 * Converts an array of permission objects from frontend names to DB table names
 * @param permissions - Array of permission objects with frontend object names
 * @returns Array of permission objects with DB table names
 */
export function convertPermissionsToDb(permissions: Array<{ object: string; [key: string]: any }>): Array<{ object: string; [key: string]: any }> {
  return permissions.map(permission => ({
    ...permission,
    object: getDbTableName(permission.object)
  }));
}

/**
 * Converts an array of permission objects from DB table names to frontend names
 * @param permissions - Array of permission objects with DB table names
 * @returns Array of permission objects with frontend names
 */
export function convertPermissionsToFrontend(permissions: Array<{ object: string; [key: string]: any }>): Array<{ object: string; [key: string]: any }> {
  return permissions.map(permission => ({
    ...permission,
    object: getFrontendName(permission.object)
  }));
}
