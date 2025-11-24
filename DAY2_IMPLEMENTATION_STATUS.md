# Day 2: Security Implementation - Status & Next Steps

## ✅ Completed (Phase 5.1 & 6.1)

### 1. **Permission Checker Utility** (`src/utils/permissionChecker.ts`)
- ✅ `checkPermission()` - Checks if user can perform action on object
- ✅ `getUserPermissions()` - Gets all permissions for user (for FE)
- ✅ Handles permission inheritance (parent roles)
- ✅ Handles system-wide default permission set fallback
- ✅ Supports `inventoryusers` table (not `users` table)
- ✅ Converts frontend object names to DB table names
- ✅ Implements Layer 2 security (object-level + record-level permissions)

### 2. **Permission API Routes** (`src/routes/permission.route.ts`)
- ✅ `GET /v1/permissions/user` - Get all permissions for current user
- ✅ `GET /v1/permissions/check` - Check specific permission (optional)
- ✅ Registered in `src/routes/index.ts`
- ✅ Uses `authenticateInventoryUser` middleware
- ✅ Returns permissions in FE-friendly format

---

## 🔄 Frontend Integration Flow

### Step 1: User Login
```typescript
// FE: Login as inventory user
POST /v1/auth/login
{
  "useremail": "admin@example.com",
  "userpassword": "password123"
}

// Response
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "session-token-here"
  }
}
```

### Step 2: Fetch Permissions (After Login) ⚡ **NEW ENDPOINT**
```typescript
// FE: Get Permissions (call this immediately after login)
GET /v1/permissions/user
Headers: { Authorization: "Bearer <token>" }

// Response
{
  "success": true,
  "data": {
    "role": {
      "id": 1,
      "name": "Admin",
      "code": "admin",
      "level": 2
    },
    "permissions": {
      "products": {
        "object": "products",
        "read": true,
        "create": true,
        "edit": true,
        "delete": false,
        "export": true,
        "import": false,
        "viewall": true,
        "modifyall": false,
        "deleteall": false,
        "accesslevel": "all"
      },
      "stocks": { ... },
      "orders": { ... }
    }
  }
}
```

### Step 3: Store in FE
```typescript
// FE: Store in auth store + localStorage
authStore.set({
  user: userData,
  permissions: permissionsData,
  isAuthenticated: true
});

localStorage.setItem('permissions', JSON.stringify(permissionsData));
localStorage.setItem('permissions_timestamp', Date.now().toString());
```

### Step 4: Use in UI
```typescript
// FE: Check permissions before showing UI
import { hasPermission, canPerformAction } from './lib/stores/auth';

// Check object-level permission
if (hasPermission('products', 'create')) {
  // Show "Create Product" button
}

// Check record-level permission (with ownership)
if (canPerformAction('products', 'edit', product.createdby, currentUserId)) {
  // Show "Edit" button
}
```

---

## 📋 Next Steps (In Order)

### **Phase 5.2: Data Access Filter** (Next)
**File**: `src/utils/dataAccessFilter.ts`

**Purpose**: Build Prisma where clause to filter records based on:
- `viewall` flag
- `accesslevel` (all, own, subordinates)
- Record ownership (`createdby` field)

**Implementation**:
```typescript
export async function buildDataAccessFilter(
  userid: number,
  object: string,
  baseQuery: any = {}
): Promise<any> {
  // Get user permissions
  // Check viewall flag
  // Apply accesslevel filter
  // Return Prisma where clause
}
```

---

### **Phase 6.2: Permission Middleware** (After Phase 5.2)
**File**: `src/middleware/permission.middleware.ts`

**Purpose**: Protect routes with permission checks

**Usage**:
```typescript
fastify.get('/products', {
  preHandler: requirePermission('products', 'read')
}, handler);
```

---

### **Phase 7: Data Access Control** (After Phase 6.2)
**Apply to GET routes**:
- `GET /v1/products` - Add `buildDataAccessFilter()`
- `GET /v1/stocks` - Add `buildDataAccessFilter()`
- `GET /v1/orders` - Add `buildDataAccessFilter()`

---

### **Phase 8: CRUD Security Control** (After Phase 6.2)
**Add middleware to all routes**:
- Products: GET, POST, PUT, DELETE
- Stocks: GET, POST, PUT, DELETE
- Orders: GET, POST, PUT, DELETE

---

## 🧪 Testing the Current Implementation

### Test Permission API:

1. **Login as inventory user**:
```bash
POST http://localhost:5600/v1/auth/login
{
  "useremail": "admin@example.com",
  "userpassword": "password123"
}
```

2. **Get permissions** (use token from login):
```bash
GET http://localhost:5600/v1/permissions/user
Headers: { Authorization: "Bearer <token>" }
```

3. **Check specific permission**:
```bash
GET http://localhost:5600/v1/permissions/check?object=products&action=read
Headers: { Authorization: "Bearer <token>" }
```

---

## 📝 Key Implementation Details

### 1. User Table
- ✅ Uses `inventoryusers` table (not `users` table)
- ✅ `inventoryusers.roleid` → `roles.id`
- ✅ `inventoryusers.rolerelation` → role relation

### 2. Permission Set Selection Logic
1. Get user's role from `inventoryusers.roleid`
2. Find active permission set for role (`isactive: true`)
3. If no active set, check parent role (recursive)
4. If still no set, use system-wide default (`isdefault: true, roleid: null`)
5. Parse JSONB permissions array

### 3. Object Name Conversion
- FE sends: `"products"`, `"purchase_requests"`, etc.
- BE converts to DB: `"product"`, `"purchaserequest"`, etc.
- Uses `getDbTableName()` from `permissionMapper.ts`

### 4. Permission Structure
```json
{
  "object": "products",
  "read": true,
  "create": true,
  "edit": true,
  "delete": false,
  "viewall": true,
  "modifyall": false,
  "deleteall": false,
  "accesslevel": "all"
}
```

---

## ✅ What's Working Now

1. ✅ **Permission Checker** - Can check if user has permission
2. ✅ **Get User Permissions** - FE can fetch all permissions after login
3. ✅ **Permission API** - Two endpoints ready for FE integration
4. ✅ **Role Integration** - Works with `inventoryusers.roleid`

---

## 🚀 Ready for Frontend Integration

**Frontend can now**:
1. Login user
2. Call `GET /v1/permissions/user` to get all permissions
3. Store permissions in auth store
4. Use permissions to show/hide UI elements

**Backend will then**:
1. Implement data access filtering (Phase 5.2)
2. Implement permission middleware (Phase 6.2)
3. Protect all routes (Phase 7 & 8)

---

## 📚 Files Created/Modified

### New Files:
- ✅ `src/utils/permissionChecker.ts` - Core permission checking logic
- ✅ `src/routes/permission.route.ts` - Permission API routes
- ✅ `DAY2_SECURITY_IMPLEMENTATION_PLAN.md` - Detailed plan
- ✅ `DAY2_IMPLEMENTATION_STATUS.md` - This file

### Modified Files:
- ✅ `src/routes/index.ts` - Registered permission routes

---

## 🎯 Next Action

**Start Phase 5.2: Create Data Access Filter utility**

This will enable Layer 1 security (controlling which records users can see).

