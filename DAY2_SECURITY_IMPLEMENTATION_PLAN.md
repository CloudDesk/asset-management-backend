# Day 2: Security Implementation - Detailed Plan

## 🎯 Overview

**Goal**: Implement two-layer security model (Data Access Control + Operation-Level Security) and expose permissions to frontend.

**Flow**:
1. **User Login** → Authenticate inventory user
2. **Get Permissions** → FE calls `GET /v1/permissions/user` after login
3. **Store in FE** → FE stores permissions in auth store + localStorage
4. **Use for UI** → FE uses permissions to show/hide buttons, menus, etc.
5. **BE Protection** → BE validates permissions on every request

---

## 📋 Implementation Phases

### **Phase 5: Core Permission Utilities** (2-3 hours) ⚡ START HERE
**Priority: CRITICAL - Foundation for all security**

#### Step 5.1: Create Permission Checker
- [ ] File: `src/utils/permissionChecker.ts`
- [ ] Implement `checkPermission()` - Check if user can perform action
- [ ] Implement `getUserPermissions()` - Get all permissions for user (for FE)
- [ ] Handle permission inheritance (parent roles)
- [ ] Handle system-wide default permission set fallback
- [ ] Support for `inventoryusers` table (not `users` table)

#### Step 5.2: Create Data Access Filter
- [ ] File: `src/utils/dataAccessFilter.ts`
- [ ] Implement `buildDataAccessFilter()` - Build Prisma where clause
- [ ] Handle `viewall` flag
- [ ] Handle `accesslevel` (all, own, subordinates)
- [ ] Support ownership fields (`createdby` or `ownerid`)

**Deliverables**:
- ✅ Permission checking utilities ready
- ✅ Data access filtering utilities ready

---

### **Phase 6: Permission API & Middleware** (1-2 hours) ⚡ NEXT
**Priority: CRITICAL - Expose permissions to FE + Route protection**

#### Step 6.1: Create Permission API Routes
- [ ] File: `src/routes/permission.route.ts`
- [ ] `GET /v1/permissions/user` - Get all permissions for current user (for FE)
- [ ] `GET /v1/permissions/check` - Check specific permission (optional, for FE)
- [ ] Register routes in `src/routes/index.ts`
- [ ] Use `authenticateInventoryUser` middleware

#### Step 6.2: Update Login Response (Optional Enhancement)
- [ ] Option A: Include permissions in login response
- [ ] Option B: FE calls `/v1/permissions/user` separately after login (Recommended)

#### Step 6.3: Create Permission Middleware
- [ ] File: `src/middleware/permission.middleware.ts`
- [ ] Implement `requirePermission()` function
- [ ] Handle ownership checking
- [ ] Return proper error responses (403 Forbidden)

**Deliverables**:
- ✅ FE can fetch user permissions after login
- ✅ Permission middleware ready for route protection

---

### **Phase 7: Data Access Control (Layer 1)** (2 hours)
**Priority: HIGH - Controls which records user can see**

#### Step 7.1: Update GET (List) Routes
- [ ] Products: `GET /v1/products` - Add `buildDataAccessFilter()`
- [ ] Stocks: `GET /v1/stocks` - Add `buildDataAccessFilter()`
- [ ] Orders: `GET /v1/orders` - Add `buildDataAccessFilter()`
- [ ] Test with different roles and `viewall` flags

#### Step 7.2: Update Service Layer
- [ ] Update `product.service.ts` - Use data access filter in `findMany`
- [ ] Update `stock.service.ts` - Use data access filter in `findMany`
- [ ] Update `order.service.ts` - Use data access filter in `findMany`
- [ ] Ensure `createdby` field exists in tables (check schema)

**Deliverables**:
- ✅ Users only see records they're allowed to see
- ✅ `viewall` flag working correctly

---

### **Phase 8: CRUD Security Control (Layer 2)** (2-3 hours)
**Priority: HIGH - Controls what actions user can perform**

#### Step 8.1: Add Permission Middleware to Routes
- [ ] Products routes:
  - [ ] `GET /v1/products` - `requirePermission('products', 'read')`
  - [ ] `POST /v1/products` - `requirePermission('products', 'create')`
  - [ ] `PUT /v1/products/:id` - `requirePermission('products', 'edit', { checkownership: true })`
  - [ ] `DELETE /v1/products/:id` - `requirePermission('products', 'delete', { checkownership: true })`
  
- [ ] Stocks routes:
  - [ ] `GET /v1/stocks` - `requirePermission('stocks', 'read')`
  - [ ] `POST /v1/stocks` - `requirePermission('stocks', 'create')`
  - [ ] `PUT /v1/stocks/:id` - `requirePermission('stocks', 'edit', { checkownership: true })`
  - [ ] `DELETE /v1/stocks/:id` - `requirePermission('stocks', 'delete', { checkownership: true })`
  
- [ ] Orders routes:
  - [ ] `GET /v1/orders` - `requirePermission('orders', 'read')`
  - [ ] `POST /v1/orders` - `requirePermission('orders', 'create')`
  - [ ] `PUT /v1/orders/:id` - `requirePermission('orders', 'edit', { checkownership: true })`
  - [ ] `DELETE /v1/orders/:id` - `requirePermission('orders', 'delete', { checkownership: true })`

#### Step 8.2: Update Service Methods (Double-Check)
- [ ] Add permission checks in service layer (if needed)
- [ ] Handle `modifyall` and `deleteall` flags
- [ ] Test cross-ownership scenarios

**Deliverables**:
- ✅ All routes protected with permissions
- ✅ Ownership checks working
- ✅ Cross-ownership permissions (`modifyall`, `deleteall`) working

---

### **Phase 9: User Hierarchy & Ownership** (1-2 hours)
**Priority: MEDIUM - Can be simplified for MVP**

#### Step 9.1: Ownership Fields
- [ ] Verify `createdby` field exists in all tables
- [ ] Add `createdby` to new records on creation (in services)
- [ ] Update `getResource()` helper in middleware

#### Step 9.2: User Hierarchy (Optional for MVP)
- [ ] Create `UserHierarchy` service (if needed)
- [ ] Add manager-subordinate relationships
- [ ] Update `buildDataAccessFilter()` to handle `subordinates` access level

**Deliverables**:
- ✅ Ownership tracking working
- ✅ `subordinates` access level working (if implemented)

---

## 🔄 Frontend Integration Flow

### Step 1: User Login
```typescript
// FE: Login
POST /v1/auth/login
{
  "useremail": "user@example.com",
  "userpassword": "password123"
}

// Response
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "session-token"
  }
}
```

### Step 2: Fetch Permissions (After Login)
```typescript
// FE: Get Permissions
GET /v1/permissions/user
Headers: { Authorization: "Bearer <token>" }

// Response
{
  "success": true,
  "data": {
    "role": {
      "id": 1,
      "name": "Admin",
      "code": "admin"
    },
    "permissions": {
      "products": {
        "read": true,
        "create": true,
        "edit": true,
        "delete": false,
        "viewall": true,
        "modifyall": false,
        "deleteall": false
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
```

### Step 4: Use in UI
```typescript
// FE: Check permissions before showing UI
if (hasPermission('products', 'create')) {
  // Show "Create Product" button
}

if (canPerformAction('products', 'edit', product.createdby, currentUserId)) {
  // Show "Edit" button
}
```

---

## 🚀 Quick Start: Phase 5 & 6 (Priority)

### Immediate Actions:

1. **Create Permission Checker** (`src/utils/permissionChecker.ts`)
   - Get user's role from `inventoryusers` table
   - Get active permission set for role
   - Parse JSONB permissions
   - Return permission map for FE

2. **Create Permission API Route** (`src/routes/permission.route.ts`)
   - `GET /v1/permissions/user` endpoint
   - Use `authenticateInventoryUser` middleware
   - Return permissions in FE-friendly format

3. **Test Flow**:
   - Login as inventory user
   - Call `/v1/permissions/user`
   - Verify permissions returned correctly

4. **Then Continue**:
   - Phase 5.2: Data Access Filter
   - Phase 6.3: Permission Middleware
   - Phase 7: Apply to routes
   - Phase 8: Protect routes

---

## 📝 Key Implementation Notes

### 1. User Table
- **Use `inventoryusers` table** (not `users` table)
- `inventoryusers.roleid` → `roles.id`
- `inventoryusers.rolerelation` → role relation

### 2. Permission Set Selection Logic
1. Get user's role from `inventoryusers.roleid`
2. Find active permission set for role (`isactive: true`)
3. If no active set, use system-wide default (`isdefault: true, roleid: null`)
4. Parse JSONB permissions array

### 3. Permission Structure
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

### 4. Frontend Object Names
- FE uses: `"products"`, `"purchase_requests"`, etc.
- BE converts to DB table names: `"product"`, `"purchaserequest"`, etc.
- Use `getDbTableName()` from `permissionMapper.ts`

---

## ✅ Success Criteria

### End of Phase 5 & 6:
- [ ] `GET /v1/permissions/user` returns user permissions
- [ ] Permissions include all objects from permission set
- [ ] FE can fetch and store permissions after login
- [ ] Permission checker validates permissions correctly

### End of Phase 7:
- [ ] Users only see records they're allowed to see
- [ ] `viewall` flag working correctly
- [ ] `accesslevel: "own"` filters to user's records

### End of Phase 8:
- [ ] All routes protected with permissions
- [ ] 403 errors returned for unauthorized actions
- [ ] Ownership checks working
- [ ] Cross-ownership permissions working

---

## 🎯 Next Steps

1. **Start with Phase 5.1** - Create Permission Checker
2. **Then Phase 6.1** - Create Permission API Route (for FE)
3. **Test with FE** - Verify permissions flow works
4. **Continue with Phase 5.2** - Data Access Filter
5. **Then Phase 6.3** - Permission Middleware
6. **Apply to Routes** - Phase 7 & 8

**Ready to start? Let's begin with Phase 5.1!** 🚀

