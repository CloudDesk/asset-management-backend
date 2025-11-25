# Security & Permissions Implementation Plan
## 2-Day Sprint Breakdown

---

## 📋 Your Plan Overview

✅ **Day 1: Foundation**
1. Add roles CRUD
2. Add permissionset CRUD
3. Update user routes map the roleid

✅ **Day 2: Security Implementation**
4. Start implement the security model (split into steps)
   - Data access control
   - CRUD security control
   - User hierarchy, ownership
   - Others (field permissions, caching, etc.)

---

## 🎯 Detailed 2-Day Implementation Plan

### **DAY 1: Foundation & Setup** (8-10 hours)

#### **Phase 1: Database Setup** (2 hours)
**Priority: CRITICAL - Must complete first**

- [ ] **Step 1.1**: Add Prisma models to `schema.prisma`
  - [ ] Add `Role` model
  - [ ] Add `PermissionSet` model
  - [ ] Add `UserHierarchy` model (optional for now)
  - [ ] Add `roleid` field to `users` model
  - [ ] Add indexes
  - [ ] Note: `FieldPermission` model skipped for now

- [ ] **Step 1.2**: Run Prisma migration
  ```bash
  npx prisma migrate dev --name add_roles_permissions_system
  npx prisma generate
  ```

- [ ] **Step 1.3**: Seed default roles
  - [ ] Create seed script or migration
  - [ ] Seed: superadmin, admin, manager, staff
  - [ ] Verify roles created

**Estimated Time**: 2 hours  
**Blockers**: None  
**Can Start**: Immediately

---

#### **Phase 2: Roles CRUD API** (2-3 hours)
**Priority: HIGH - Needed for admin UI**

- [ ] **Step 2.1**: Create Role Service
  - [ ] File: `src/services/role.service.ts`
  - [ ] Methods: `create`, `findAll`, `findById`, `update`, `delete`
  - [ ] Include permission sets in responses

- [ ] **Step 2.2**: Create Role Controller
  - [ ] File: `src/controllers/role.controller.ts`
  - [ ] Methods: `createRole`, `getRoles`, `getRoleById`, `updateRole`, `deleteRole`
  - [ ] Validation and error handling

- [ ] **Step 2.3**: Create Role Routes
  - [ ] File: `src/routes/role.route.ts`
  - [ ] `POST /v1/roles` - Create role
  - [ ] `GET /v1/roles` - List roles
  - [ ] `GET /v1/roles/:id` - Get role by ID
  - [ ] `PUT /v1/roles/:id` - Update role
  - [ ] `DELETE /v1/roles/:id` - Delete role (soft delete if has users)
  - [ ] Add Fastify schemas

- [ ] **Step 2.4**: Register routes
  - [ ] Add to `src/routes/index.ts`

**Estimated Time**: 2-3 hours  
**Blockers**: Phase 1 must be complete  
**Can Start**: After Phase 1

---

#### **Phase 3: Permission Set CRUD API** (2-3 hours)
**Priority: HIGH - Needed for admin UI**

- [ ] **Step 3.1**: Create Permission Set Service
  - [ ] File: `src/services/permissionset.service.ts`
  - [ ] Methods: `create`, `findAll`, `findById`, `update`, `delete`
  - [ ] Handle JSONB permissions array
  - [ ] Validate permission structure

- [ ] **Step 3.2**: Create Permission Set Controller
  - [ ] File: `src/controllers/permissionset.controller.ts`
  - [ ] Methods: `createPermissionSet`, `getPermissionSets`, `getPermissionSetById`, `updatePermissionSet`, `deletePermissionSet`
  - [ ] Validate JSONB structure

- [ ] **Step 3.3**: Create Permission Set Routes
  - [ ] File: `src/routes/permissionset.route.ts`
  - [ ] `POST /v1/permission-sets` - Create permission set
  - [ ] `GET /v1/permission-sets` - List permission sets (with roleid filter)
  - [ ] `GET /v1/permission-sets/:id` - Get permission set by ID
  - [ ] `PUT /v1/permission-sets/:id` - Update permission set
  - [ ] `DELETE /v1/permission-sets/:id` - Delete permission set
  - [ ] Add Fastify schemas

- [ ] **Step 3.4**: Register routes
  - [ ] Add to `src/routes/index.ts`

**Estimated Time**: 2-3 hours  
**Blockers**: Phase 1 must be complete  
**Can Start**: After Phase 1 (can parallel with Phase 2)

---

#### **Phase 4: User-Role Mapping** (1-2 hours)
**Priority: HIGH - Needed before security implementation**

- [ ] **Step 4.1**: Update User Service
  - [ ] Add `assignRole` method
  - [ ] Add `getUserRole` method
  - [ ] Update user creation to accept `roleid`

- [ ] **Step 4.2**: Update User Controller
  - [ ] Add `assignRole` endpoint handler
  - [ ] Update `createUser` to handle `roleid`
  - [ ] Update `getUser` to include role info

- [ ] **Step 4.3**: Update User Routes
  - [ ] `PUT /v1/users/:id/role` - Assign role to user
  - [ ] `GET /v1/users/:id` - Include role in response
  - [ ] Update `POST /v1/users` - Accept `roleid` in body

- [ ] **Step 4.4**: Create default permission sets for each role
  - [ ] Script or migration to create default permission sets
  - [ ] Assign roles to existing users (optional)

**Estimated Time**: 1-2 hours  
**Blockers**: Phase 1, Phase 2, Phase 3  
**Can Start**: After Phase 2 & 3

---

### **DAY 2: Security Implementation** (8-10 hours)

#### **Phase 5: Core Permission Utilities** (2-3 hours)
**Priority: CRITICAL - Foundation for all security**

- [ ] **Step 5.1**: Create Permission Checker
  - [ ] File: `src/utils/permissionChecker.ts`
  - [ ] Implement `checkPermission()` function
  - [ ] Implement `getUserPermissions()` function
  - [ ] Handle permission inheritance (parent roles)
  - [ ] Test with different roles

- [ ] **Step 5.2**: Create Data Access Filter
  - [ ] File: `src/utils/dataAccessFilter.ts`
  - [ ] Implement `buildDataAccessFilter()` function
  - [ ] Handle `viewall`, `accesslevel` (all, own, subordinates)
  - [ ] Test filtering logic

**Estimated Time**: 2-3 hours  
**Blockers**: Phase 1, Phase 4  
**Can Start**: After Phase 4

---

#### **Phase 6: Permission Middleware** (1-2 hours)
**Priority: CRITICAL - Route protection**

- [ ] **Step 6.1**: Create Permission Middleware
  - [ ] File: `src/middleware/permission.middleware.ts`
  - [ ] Implement `requirePermission()` function
  - [ ] Handle ownership checking
  - [ ] Return proper error responses

- [ ] **Step 6.2**: Create Permission API Routes
  - [ ] File: `src/routes/permission.route.ts`
  - [ ] `GET /v1/permissions/user` - Get user permissions (for frontend)
  - [ ] `GET /v1/permissions/check` - Check specific permission
  - [ ] Register routes

**Estimated Time**: 1-2 hours  
**Blockers**: Phase 5  
**Can Start**: After Phase 5

---

#### **Phase 7: Data Access Control (Layer 1)** (2 hours)
**Priority: HIGH - Controls which records user can see**

- [ ] **Step 7.1**: Update GET (List) Routes
  - [ ] Products: `GET /v1/products`
  - [ ] Stocks: `GET /v1/stocks`
  - [ ] Orders: `GET /v1/orders`
  - [ ] Add `buildDataAccessFilter()` to each route
  - [ ] Test with different roles and `viewall` flags

- [ ] **Step 7.2**: Update Service Layer
  - [ ] Update `product.service.ts` - Use data access filter
  - [ ] Update `stock.service.ts` - Use data access filter
  - [ ] Update `order.service.ts` - Use data access filter
  - [ ] Ensure `createdby` field exists in tables

**Estimated Time**: 2 hours  
**Blockers**: Phase 5, Phase 6  
**Can Start**: After Phase 6

---

#### **Phase 8: CRUD Security Control (Layer 2)** (2-3 hours)
**Priority: HIGH - Controls what actions user can perform**

- [ ] **Step 8.1**: Add Permission Middleware to Routes
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

- [ ] **Step 8.2**: Update Service Methods
  - [ ] Add permission checks in service layer (double-check)
  - [ ] Handle `modifyall` and `deleteall` flags
  - [ ] Test cross-ownership scenarios

**Estimated Time**: 2-3 hours  
**Blockers**: Phase 6  
**Can Start**: After Phase 6 (can parallel with Phase 7)

---

#### **Phase 9: User Hierarchy & Ownership** (1-2 hours)
**Priority: MEDIUM - Can be simplified for MVP**

- [ ] **Step 9.1**: User Hierarchy (Optional for MVP)
  - [ ] Create `UserHierarchy` service (if needed)
  - [ ] Add manager-subordinate relationships
  - [ ] Update `buildDataAccessFilter()` to handle `subordinates` access level

- [ ] **Step 9.2**: Ownership Fields
  - [ ] Verify `createdby` field exists in all tables
  - [ ] Add `createdby` to new records on creation
  - [ ] Update `getResource()` helper in middleware

**Estimated Time**: 1-2 hours  
**Blockers**: Phase 5, Phase 7  
**Can Start**: After Phase 7

---

#### **Phase 10: Additional Features** (1-2 hours)
**Priority: LOW - Can be done later if time runs out**

- [ ] **Step 10.1**: Field Permissions (Optional)
  - [ ] Implement field-level permission checking
  - [ ] Add to permission checker
  - [ ] Use in service layer for field filtering

- [ ] **Step 10.2**: Permission Caching (Optional)
  - [ ] Add in-memory cache for permissions
  - [ ] Cache TTL: 1 hour
  - [ ] Invalidate on role/permission changes

- [ ] **Step 10.3**: Testing & Documentation
  - [ ] Test all permission scenarios
  - [ ] Document API endpoints
  - [ ] Create example permission sets

**Estimated Time**: 1-2 hours  
**Blockers**: None  
**Can Start**: Anytime (can skip if time runs out)

---

## ⏰ 2-Day Timeline

### **DAY 1 (8-10 hours)**

| Time | Phase | Task | Status |
|------|-------|------|--------|
| **Hour 1-2** | Phase 1 | Database Setup | 🔴 Critical |
| **Hour 3-5** | Phase 2 | Roles CRUD | 🟡 High |
| **Hour 3-6** | Phase 3 | Permission Set CRUD | 🟡 High (Parallel) |
| **Hour 7-8** | Phase 4 | User-Role Mapping | 🟡 High |

**Day 1 Deliverables:**
- ✅ Database tables created
- ✅ Roles CRUD API working
- ✅ Permission Sets CRUD API working
- ✅ Users can be assigned roles

---

### **DAY 2 (8-10 hours)**

| Time | Phase | Task | Status |
|------|-------|------|--------|
| **Hour 1-3** | Phase 5 | Core Permission Utilities | 🔴 Critical |
| **Hour 4-5** | Phase 6 | Permission Middleware | 🔴 Critical |
| **Hour 6-7** | Phase 7 | Data Access Control (Layer 1) | 🟡 High |
| **Hour 8-10** | Phase 8 | CRUD Security Control (Layer 2) | 🟡 High |
| **Hour 11-12** | Phase 9 | User Hierarchy & Ownership | 🟢 Medium |
| **Hour 13-14** | Phase 10 | Additional Features | 🟢 Low (Optional) |

**Day 2 Deliverables:**
- ✅ Permission checking working
- ✅ Data access filtering working
- ✅ All routes protected with permissions
- ✅ Cross-ownership checks working

---

## 🎯 Priority Matrix

### **Must Have (Day 1 + Day 2 Morning)**
1. ✅ Database setup
2. ✅ Roles CRUD
3. ✅ Permission Sets CRUD
4. ✅ User-role mapping
5. ✅ Permission checker
6. ✅ Permission middleware
7. ✅ Basic route protection

### **Should Have (Day 2 Afternoon)**
8. ✅ Data access filtering
9. ✅ Ownership checks
10. ✅ Cross-ownership permissions

### **Nice to Have (If Time Permits)**
11. ⚠️ User hierarchy
12. ⚠️ Field permissions
13. ⚠️ Permission caching

---

## 🚀 Quick Start Checklist

### **Before Starting:**
- [ ] Review `SECURITY_AND_PERMISSIONS_MASTER_PLAN.md`
- [ ] Ensure PostgreSQL database is accessible
- [ ] Have Prisma CLI installed
- [ ] Backup current database (if production)

### **Day 1 Morning:**
- [ ] Start with Phase 1 (Database Setup)
- [ ] Test migration works
- [ ] Verify roles seeded

### **Day 1 Afternoon:**
- [ ] Build Roles CRUD (Phase 2)
- [ ] Build Permission Sets CRUD (Phase 3)
- [ ] Test APIs with Postman/Thunder Client

### **Day 2 Morning:**
- [ ] Build permission utilities (Phase 5)
- [ ] Build middleware (Phase 6)
- [ ] Test permission checking

### **Day 2 Afternoon:**
- [ ] Add data access filtering (Phase 7)
- [ ] Add route protection (Phase 8)
- [ ] Test end-to-end

---

## 📝 Missing Steps Added

Based on your plan, I've added:

1. ✅ **Database Setup** - Prisma migration (you had this implied)
2. ✅ **Permission Utilities** - Core checking logic (needed before security)
3. ✅ **Permission Middleware** - Route protection (needed for CRUD security)
4. ✅ **Permission API Routes** - For frontend to fetch permissions
5. ✅ **Service Layer Updates** - Need to update services to use filters
6. ✅ **Ownership Field Verification** - Ensure `createdby` exists
7. ✅ **Testing** - Critical for security features

---

## ⚠️ Risk Mitigation

### **If Running Behind Schedule:**

**Day 1 Evening:**
- Skip detailed validation in CRUD APIs (add later)
- Use simple permission set structure (expand later)

**Day 2:**
- Skip user hierarchy (Phase 9) - can add later
- Skip field permissions (Phase 10) - can add later
- Focus on core: permission checking + route protection

**Minimum Viable:**
- Roles CRUD ✅
- Permission Sets CRUD ✅
- User-role mapping ✅
- Permission checking ✅
- Basic route protection ✅

---

## 🎯 Success Criteria

### **End of Day 1:**
- [ ] Can create/view/update/delete roles via API
- [ ] Can create/view/update/delete permission sets via API
- [ ] Can assign roles to users
- [ ] Database has all required tables

### **End of Day 2:**
- [ ] Permission checking works for all objects
- [ ] Data access filtering works (viewall, own)
- [ ] All routes are protected
- [ ] Cross-ownership checks work (modifyall, deleteall)
- [ ] Frontend can fetch user permissions

---

## 📚 Reference Files

- **Master Plan**: `SECURITY_AND_PERMISSIONS_MASTER_PLAN.md`
- **Prisma Schema**: `prisma/schema.prisma`
- **Code Examples**: See master plan for implementation details

---

## 💡 Tips for 2-Day Sprint

1. **Start Simple**: Get basic CRUD working first, then add features
2. **Test Early**: Test each phase before moving to next
3. **Use Examples**: Copy code from master plan, adapt to your codebase
4. **Parallel Work**: Phase 2 & 3 can be done in parallel
5. **Skip Optional**: User hierarchy and field permissions can wait
6. **Focus on Core**: Permission checking + route protection is priority

---

## ✅ Your Plan is Good!

Your plan covers the essentials. I've added:
- Detailed breakdown with time estimates
- Missing steps (database setup, utilities, middleware)
- Priority levels
- Risk mitigation
- Success criteria

**Ready to start? Begin with Phase 1 (Database Setup)!** 🚀

