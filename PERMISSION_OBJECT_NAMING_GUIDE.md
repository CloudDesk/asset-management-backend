# Permission Object Naming Guide

## ✅ **Your Frontend Config is Correct!**

Your `AVAILABLE_OBJECTS` config is perfect. This guide shows how to map it to database table names for storing in permissions JSONB.

## 🎯 **Approach: Use Database Table Names in Permissions JSONB**

**Store actual database table names directly** in your permission JSONB structure. This eliminates the need for mapping utilities and makes permission checks straightforward.

**Benefits:**
- ✅ No mapping needed - direct table name lookup
- ✅ Simpler implementation
- ✅ Less code to maintain
- ✅ Direct relationship between permission and database table

## 📋 **Complete Mapping: Frontend Config → Database Table Names**

| Frontend Config Name | Store in Permissions JSONB (DB Table Name) | Database Table | Status |
|---------------------|-------------------------------------------|----------------|--------|
| `products` | `product` | `product` | ✅ Exists |
| `stocks` | `stock` | `stock` | ✅ Exists |
| `orders` | `orders` | `orders` | ✅ Exists |
| `suppliers` | `supplier` | `supplier` | ✅ Exists |
| `purchase_requests` | `purchaserequest` | `purchaserequest` | ✅ Exists |
| `purchase_orders` | `purchaseorder` | `purchaseorder` | ✅ Exists |
| `promotions` | `promotions` | `promotions` | ✅ Exists |
| `picklist` | `picklist` | `picklist` | ✅ Exists |
| `channels` | `channels` | ❌ Not in DB | ⚠️ Future |
| `transactions` | `transaction` | `transaction` | ✅ Exists |
| `dashboards` | `dashboards` | ❌ Not in DB | ⚠️ Future |
| `accounts` | `accounts` | ❌ Not in DB | ⚠️ Future |
| `contacts` | `contacts` | ❌ Not in DB | ⚠️ Future |
| `users` | `users` | `users` | ✅ Exists |
| `roles` | `roles` | `roles` | ✅ Exists |
| `permissionsets` | `permission_sets` | `permission_sets` | ✅ Exists |
| `layoutconfigs` | `layoutconfigs` | ❌ Not in DB | ⚠️ Future |
| `reports` | `reports` | ❌ Not in DB | ⚠️ Future |

**Key Rules:**
- **Frontend uses:** Plural/underscore names (e.g., `products`, `purchase_requests`, `permissionsets`)
- **Store in Permissions:** DB table names (e.g., `product`, `purchaserequest`, `permission_sets`)
- **Future objects:** Can be added to permissions even if not in DB yet

## 📝 **Example Permission Set JSONB Structure**

```json
{
  "id": 1,
  "name": "Admin Permission Set",
  "description": "Full access for administrators",
  "roleid": 1,
  "isactive": true,
  "isdefault": false,
  "permissions": [
    {
      "object": "product",  // NOT "products" - use DB table name
      "read": true,
      "create": true,
      "edit": true,
      "delete": true,
      "export": true,
      "import": true,
      "viewall": true,
      "modifyall": true,
      "deleteall": true,
      "accesslevel": "all"
    },
    {
      "object": "stock",  // NOT "stocks"
      "read": true,
      "create": true,
      "edit": true,
      "delete": false,
      "viewall": true,
      "modifyall": false,
      "deleteall": false,
      "accesslevel": "own"
    },
    {
      "object": "purchaserequest",  // NOT "purchase_requests"
      "read": true,
      "create": true,
      "edit": true,
      "approve": true,
      "reject": true,
      "viewall": true,
      "modifyall": true,
      "accesslevel": "all"
    },
    {
      "object": "permission_sets",  // NOT "permissionsets"
      "read": true,
      "create": true,
      "edit": true,
      "delete": false,
      "viewall": true,
      "modifyall": true,
      "accesslevel": "all"
    }
  ]
}
```

## 🔧 **Backend Mapping Utility**

Create this utility to convert between frontend names and DB table names:

```typescript
// src/utils/permissionMapper.ts

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
```

## 🔒 **Backend Permission Check Implementation**

When checking permissions, use database table names directly:

```typescript
// src/middleware/security.ts

export async function checkPermission(
  userId: number,
  tableName: string, // e.g., "product" (direct DB table name)
  action: 'read' | 'create' | 'edit' | 'delete' | 'export' | 'import' | 'approve' | 'reject'
): Promise<boolean> {
  // 1. Get user's role
  const user = await prisma.inventoryusers.findUnique({
    where: { id: userId },
    include: { rolerelation: true }
  });
  
  if (!user || !user.roleid) {
    return false;
  }
  
  // 2. Get permission set for role
  const permissionSet = await getPermissionSetForRole(user.roleid);
  
  if (!permissionSet) {
    return false;
  }
  
  // 3. Find permission for the table (direct match, no mapping needed)
  const permissions = permissionSet.permissions as Array<{
    object: string;
    [key: string]: any;
  }>;
  
  const tablePermission = permissions.find(p => p.object === tableName);
  
  if (!tablePermission) {
    return false;
  }
  
  // 4. Check action permission
  return tablePermission[action] === true;
}

// Example usage:
// If you receive frontend name, convert it first:
import { getDbTableName } from '../utils/permissionMapper';
const frontendName = 'products';
const dbTableName = getDbTableName(frontendName); // 'product'
const canRead = await checkPermission(userId, dbTableName, 'read');
```

## 🎨 **Frontend Integration**

### **Your Frontend Config (Correct!)**

```typescript
// Frontend: config/permissionSet.config.ts

/**
 * Available objects in the system that can have permissions assigned
 * These correspond to the different modules/entities in the application
 */
export const AVAILABLE_OBJECTS = [
  "products",
  "stocks",
  "orders",
  "suppliers",
  "purchase_requests",
  "purchase_orders",
  "promotions",
  "picklist",
  "channels",
  "transactions",
  "dashboards",
  "accounts",
  "contacts",
  "users",
  "roles",
  "permissionsets",
  "layoutconfigs",
  "reports",
] as const;

export type PermissionObjectName = typeof AVAILABLE_OBJECTS[number];
```

### **Frontend to Backend Conversion**

When sending permissions to backend, convert frontend names to DB table names:

```typescript
// Frontend: utils/permissionConverter.ts

import { AVAILABLE_OBJECTS } from '../config/permissionSet.config';

const FRONTEND_TO_DB_MAP: Record<string, string> = {
  'products': 'product',
  'stocks': 'stock',
  'orders': 'orders',
  'suppliers': 'supplier',
  'purchase_requests': 'purchaserequest',
  'purchase_orders': 'purchaseorder',
  'promotions': 'promotions',
  'picklist': 'picklist',
  'channels': 'channels',
  'transactions': 'transaction',
  'dashboards': 'dashboards',
  'accounts': 'accounts',
  'contacts': 'contacts',
  'users': 'users',
  'roles': 'roles',
  'permissionsets': 'permission_sets',
  'layoutconfigs': 'layoutconfigs',
  'reports': 'reports',
};

export function convertFrontendToDb(frontendName: string): string {
  return FRONTEND_TO_DB_MAP[frontendName] || frontendName;
}

export function convertDbToFrontend(dbName: string): string {
  const reverseMap: Record<string, string> = {};
  Object.entries(FRONTEND_TO_DB_MAP).forEach(([key, value]) => {
    reverseMap[value] = key;
  });
  return reverseMap[dbName] || dbName;
}

// Usage when creating/updating permission set
const frontendPermissions = [
  { object: 'products', read: true, create: true },
  { object: 'purchase_requests', read: true, create: false }
];

const backendPermissions = frontendPermissions.map(p => ({
  ...p,
  object: convertFrontendToDb(p.object) // Convert to DB table name
}));

// Send to backend
await createPermissionSet({
  ...otherFields,
  permissions: backendPermissions // [{ object: 'product', ... }, { object: 'purchaserequest', ... }]
});
```

### **TypeScript Interface**

```typescript
// Frontend: types/permissions.ts

export type PermissionObjectName = typeof AVAILABLE_OBJECTS[number];

export interface PermissionObject {
  object: PermissionObjectName;
  read?: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  export?: boolean;
  import?: boolean;
  approve?: boolean;
  reject?: boolean;
  viewall?: boolean;
  modifyall?: boolean;
  deleteall?: boolean;
  accesslevel?: 'all' | 'own' | 'subordinates';
  customactions?: Record<string, boolean>;
}
```

## ✅ **Validation**

### **Backend Validation**

```typescript
// Simple validation - check if it's a valid table name
const VALID_TABLE_NAMES = [
  // Existing tables
  'product', 'stock', 'supplier', 'orders', 
  'purchaserequest', 'purchaseorder', 'promotions',
  'roles', 'permission_sets', 'picklist',
  'transaction', 'users',
  // Future tables (can be added to permissions now)
  'channels', 'dashboards', 'accounts', 'contacts',
  'layoutconfigs', 'reports'
];

if (!VALID_TABLE_NAMES.includes(permission.object)) {
  throw new Error(`Invalid permission object: ${permission.object}`);
}
```

## 📊 **Summary**

| Aspect | Recommendation |
|--------|----------------|
| **What to Store in Permissions JSONB** | **Database table names directly** (e.g., `product`, `stock`, `supplier`, `purchaserequest`) |
| **Frontend Config** | Use your `AVAILABLE_OBJECTS` as-is (e.g., `products`, `purchase_requests`) |
| **Conversion** | Convert frontend → DB when sending to backend, DB → frontend when receiving |
| **Validation** | Validate against valid table names list |
| **Complexity** | ✅ Low - Simple mapping utility handles conversion |

## 🎯 **Key Takeaways**

1. ✅ **Your frontend config is correct** - keep using `AVAILABLE_OBJECTS` as-is
2. ✅ **Store DB table names in permissions JSONB** - e.g., `product`, not `products`
3. ✅ **Use mapping utility** - Convert between frontend and DB names when needed
4. ✅ **Simple approach** - Direct table name lookup, no complex mapping needed

---

**Remember:** Frontend can use friendly names (`products`, `purchase_requests`), but permissions JSONB stores actual database table names (`product`, `purchaserequest`) for direct lookup.
