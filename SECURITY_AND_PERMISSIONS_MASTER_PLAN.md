# Security & Permissions Master Plan
## Single Source of Truth - Complete Implementation Guide

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Two-Layer Security Model](#two-layer-security-model)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [API Integration](#api-integration)
8. [Migration Guide](#migration-guide)
9. [Implementation Checklist](#implementation-checklist)

---

## 🎯 Overview

### Goals
- ✅ **Two-Layer Security**: Data access control + operation-level permissions
- ✅ **Role-Based Access Control (RBAC)**: Permission sets tied to roles
- ✅ **Hierarchy Support**: Role hierarchy + optional user hierarchy
- ✅ **Cross-Ownership Permissions**: View/edit/delete records owned by others
- ✅ **Frontend Permission Caching**: Optimized permission checks
- ✅ **Database-Driven**: Fully configurable through database
- ✅ **Simple & Scalable**: JSONB permissions, one role per user

### Key Features
- **Layer 1**: Data Access Control (which records user can see)
- **Layer 2**: Operation-Level Security (what actions user can perform)
- **Permission Inheritance**: Parent role permissions
- **Record Ownership**: Support for `createdby`/`ownerid` fields
- **Access Levels**: all, own, subordinates (optional)

---

## 🏗️ Architecture

### Two-Layer Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUEST                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│        LAYER 1: DATA ACCESS CONTROL                         │
│  (Controls WHICH records user can see)                     │
│  • viewall flag → No filter                                 │
│  • accesslevel → all, own, subordinates                    │
│  • Ownership-based filtering                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│      LAYER 2: OPERATION-LEVEL SECURITY                      │
│  (Controls WHAT actions user can perform)                   │
│  • Object-level permissions (read, create, edit, delete)    │
│  • Record-level permissions (viewall, modifyall, deleteall)│
│  • Cross-ownership checks                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXECUTE ACTION                          │
└─────────────────────────────────────────────────────────────┘
```

### Security Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **PermissionChecker** | Core permission checking logic | `src/utils/permissionChecker.ts` |
| **DataAccessFilter** | Builds data access queries | `src/utils/dataAccessFilter.ts` |
| **PermissionMiddleware** | Route protection | `src/middleware/permission.middleware.ts` |
| **AuthService** | Frontend permission management | Frontend: `src/lib/stores/auth.ts` |

---

## 💾 Database Schema

### Prisma Schema

```prisma
// ============================================
// ROLES & PERMISSIONS SYSTEM
// ============================================

// 1. Role hierarchy and basic role information
model Role {
  id          String   @id @default(cuid())
  name        String   @unique @db.VarChar(100)
  code        String   @unique @db.VarChar(50)  // e.g., "superadmin", "admin", "manager"
  level       Int      @default(0)              // Hierarchy level (1=highest, higher=lower)
  description String?  @db.VarChar(500)
  isactive    Boolean  @default(true)
  issystem    Boolean  @default(false)          // System roles cannot be deleted
  
  // Relations
  permissionsets PermissionSet[]
  users          users[]        // One-to-many: one role can have many users
  parentroleid   String?
  parentRole     Role?     @relation("RoleHierarchy", fields: [parentroleid], references: [id], onDelete: SetNull)
  childRoles     Role[]    @relation("RoleHierarchy")
  
  createdat      DateTime  @default(now())
  updatedat       DateTime  @updatedat
  
  @@index([code])
  @@index([level])
  @@map("roles")
}

// 2. Permission Sets - Collection of permissions for a role
// Permissions stored as JSONB (not separate table)
model PermissionSet {
  id          String   @id @default(cuid())
  name        String   @db.VarChar(200)
  description String?  @db.VarChar(500)
  roleid      String
  role        Role     @relation(fields: [roleid], references: [id], onDelete: Cascade)
  isactive    Boolean  @default(true)
  isdefault   Boolean  @default(false)          // Default set for the role
  
  // Permissions stored as JSONB array
  // Structure: Array of permission objects
  permissions      Json         // See structure below
  
  createdat        DateTime  @default(now())
  updatedat        DateTime  @updatedat
  
  @@index([roleid])
  @@index([isactive])
  @@map("permission_sets")
}

// 3. User Hierarchy (OPTIONAL - for manager-subordinate relationships)
// Note: FieldPermission model skipped for now - can be added later if needed
model UserHierarchy {
  id            String   @id @default(cuid())
  userid        Int      @unique
  managerid     Int?     // User's manager ID
  subordinates  Json?    // Array of subordinate user IDs: [1, 2, 3]
  
  createdat     DateTime  @default(now())
  updatedat     DateTime  @updatedat
  
  @@index([managerid])
  @@map("user_hierarchies")
}

// ============================================
// UPDATE EXISTING users MODEL
// ============================================

// Add to existing users model (around line 647):
model users {
  id               Int         @id @default(autoincrement())
  useremail        String?     @unique(map: "unique_email_users") @db.VarChar(255)
  userpassword     String?     @db.VarChar(255)
  createddate      BigInt?
  modifieddate     BigInt?
  usermobilenumber BigInt?
  fcmid            String?     @db.VarChar(500)
  firstname        String?     @db.VarChar(500)
  lastname         String?     @db.VarChar(500)
  gender           String?     @db.VarChar(50)
  gstnumber        String?     @db.VarChar(20)
  isbusinessuser   Boolean?    @default(false)
  isguest          Boolean?    @default(false)
  isactive         Boolean?    @default(true)
  
  // ADD THIS: One user has one role (one-to-many relationship)
  roleid           String?     // Foreign key to roles.id
  role             Role?       @relation(fields: [roleid], references: [id], onDelete: SetNull)
  
  // Existing relations
  address          address[]
  orderline        orderline[]
  orders           orders[]
  tickets          tickets[]   @ignore
  rating           rating[]
  
  @@index([roleid])
  @@map("users")
}
```

### Permission JSONB Structure

```json
[
  {
    "object": "products",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "export": true,
    "import": false,
    "approve": true,
    "reject": false,
    "viewall": true,        // Layer 1: Can view all records
    "modifyall": false,     // Layer 1: Can modify all records
    "deleteall": false,     // Layer 1: Can delete all records
    "accesslevel": "all",   // Optional: all, own, subordinates
    "customactions": {
      "publish": true,
      "archive": false
    }
  },
  {
    "object": "stocks",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "export": true,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "own"
  }
]
```

### Required Tables Summary

| Table | Purpose | Required? |
|-------|---------|-----------|
| `roles` | Role definitions | ✅ **Yes** |
| `permission_sets` | Permission sets with JSONB | ✅ **Yes** |
| `field_permissions` | Field-level permissions | ❌ **Skipped for now** |
| `user_hierarchies` | Manager-subordinate relationships | ⚠️ **Optional** |
| `users.roleid` | User-role mapping | ✅ **Yes** |

---

## 🔐 Two-Layer Security Model

### Layer 1: Data Access Control

**Purpose**: Controls **which records** a user can see based on:
- `viewall` flag
- `accesslevel` (all, own, subordinates)
- Record ownership (`createdby` or `ownerid` field)

**When Used**:
- GET operations for listing records
- Search and filter operations
- Dashboard data aggregation

**Implementation**:
```typescript
// Build data access filter
const accessQuery = await buildDataAccessFilter(
  userid,
  'products',
  baseQuery
);

// Execute filtered query
const products = await prisma.product.findMany({
  where: accessQuery
});
```

### Layer 2: Operation-Level Security

**Purpose**: Controls **what actions** a user can perform on specific records:
- Object-level permissions (read, create, edit, delete)
- Record-level permissions (viewall, modifyall, deleteall)
- Cross-ownership checks

**When Used**:
- Individual record operations (GET, PUT, DELETE)
- Create operations (POST)
- Update operations (PUT)

**Implementation**:
```typescript
// Check object-level permission
const objectPermission = await checkPermission(
  userid,
  'products',
  'edit'
);

// Check record-level permission (if record owner provided)
const recordPermission = await checkPermission(
  userid,
  'products',
  'edit',
  { resourceownerid: product.createdby }
);
```

---

## 🔧 Backend Implementation

### 1. Permission Checker

**File**: `src/utils/permissionChecker.ts`

```typescript
import { prisma } from '../models/prisma.js';
import logger from '../config/logger.js';

export interface PermissionContext {
  object: string;
  action: string;
  resourceid?: string;
  resourceownerid?: number;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  inheritedFrom?: string;
  scope?: {
    viewall: boolean;
    modifyall: boolean;
    deleteall: boolean;
  };
}

/**
 * Check if user has permission for an action on an object
 * Implements both Layer 1 and Layer 2 security
 */
export async function checkPermission(
  userid: number,
  object: string,
  action: string,
  context?: PermissionContext
): Promise<PermissionResult> {
  try {
    // Get user with role
    const user = await prisma.users.findUnique({
      where: { id: userid },
      include: {
        role: {
          include: {
            parentRole: true,
            permissionsets: {
              where: { isactive: true, isdefault: true },
              take: 1
            }
          }
        }
      }
    });

    if (!user || !user.role) {
      return {
        allowed: false,
        reason: 'User has no role assigned'
      };
    }

    const role = user.role;
    let permissionset = role.permissionsets[0];
    
    // Check parent role if no permission set found
    if (!permissionset && role.parentroleid) {
      const parentRole = await prisma.role.findUnique({
        where: { id: role.parentroleid },
        include: {
          permissionsets: {
            where: { isactive: true, isdefault: true },
            take: 1
          }
        }
      });
      
      if (parentRole?.permissionsets[0]) {
        permissionset = parentRole.permissionsets[0];
      }
    }
    
    if (!permissionset) {
      return {
        allowed: false,
        reason: 'No permission set found for role'
      };
    }

    // Parse permissions from JSONB
    const permissions = permissionset.permissions as Array<{
      object: string;
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
      accesslevel?: string;
      customactions?: Record<string, boolean>;
    }>;

    const permission = permissions.find(p => p.object === object);
    
    if (!permission) {
      return {
        allowed: false,
        reason: 'No permission found for object'
      };
    }

    // LAYER 2: Check object-level permission
    const hasObjectPermission = checkAction(permission, action);
    if (!hasObjectPermission) {
      return {
        allowed: false,
        reason: `Action '${action}' not allowed for object '${object}'`
      };
    }

    // LAYER 2: Check record-level permission (if record owner provided)
    if (context?.resourceownerid !== undefined) {
      const isOwner = userid === context.resourceownerid;
      
      if (isOwner) {
        // Owner: Basic permission is enough
        return {
          allowed: true,
          inheritedFrom: role.name,
          scope: {
            viewall: permission.viewall === true,
            modifyall: permission.modifyall === true,
            deleteall: permission.deleteall === true
          }
        };
      } else {
        // Non-owner: Check cross-ownership permissions
        switch (action) {
          case 'read':
            if (!permission.viewall) {
              return {
                allowed: false,
                reason: 'Cannot view records owned by others'
              };
            }
            break;
          case 'edit':
            if (!permission.modifyall) {
              return {
                allowed: false,
                reason: 'Cannot modify records owned by others'
              };
            }
            break;
          case 'delete':
            if (!permission.deleteall) {
              return {
                allowed: false,
                reason: 'Cannot delete records owned by others'
              };
            }
            break;
        }
      }
    }

    return {
      allowed: true,
      inheritedFrom: role.name,
      scope: {
        viewall: permission.viewall === true,
        modifyall: permission.modifyall === true,
        deleteall: permission.deleteall === true
      }
    };
  } catch (error) {
    logger.error({ error, userid, object, action }, 'Error checking permission');
    return {
      allowed: false,
      reason: 'Error checking permission'
    };
  }
}

/**
 * Helper: Check if action is allowed
 */
function checkAction(permission: any, action: string): boolean {
  switch (action) {
    case 'read': return permission.read === true;
    case 'create': return permission.create === true;
    case 'edit': return permission.edit === true;
    case 'delete': return permission.delete === true;
    case 'export': return permission.export === true;
    case 'import': return permission.import === true;
    case 'approve': return permission.approve === true;
    case 'reject': return permission.reject === true;
    default:
      return permission.customactions?.[action] === true;
  }
}

/**
 * Get all permissions for a user (for frontend)
 */
export async function getUserPermissions(userid: number): Promise<{
  roles: string[];
  permissions: Record<string, any>;
}> {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userid },
      include: {
        role: {
          include: {
            permissionsets: {
              where: { isactive: true, isdefault: true },
              take: 1
            }
          }
        }
      }
    });

    if (!user || !user.role) {
      return {
        roles: [],
        permissions: {}
      };
    }

    const role = user.role;
    const permissionset = role.permissionsets[0];
    
    if (!permissionset) {
      return {
        roles: [role.code],
        permissions: {}
      };
    }

    // Parse permissions from JSONB
    const permissionsArray = permissionset.permissions as Array<any>;
    const permissions: Record<string, any> = {};
    
    for (const perm of permissionsArray) {
      permissions[perm.object] = {
        read: perm.read || false,
        create: perm.create || false,
        edit: perm.edit || false,
        delete: perm.delete || false,
        export: perm.export || false,
        import: perm.import || false,
        approve: perm.approve || false,
        reject: perm.reject || false,
        viewall: perm.viewall || false,
        modifyall: perm.modifyall || false,
        deleteall: perm.deleteall || false,
        accesslevel: perm.accesslevel || 'own',
        customactions: perm.customactions || {}
      };
    }

    return {
      roles: [role.code],
      permissions
    };
  } catch (error) {
    logger.error({ error, userid }, 'Error getting user permissions');
    throw error;
  }
}
```

### 2. Data Access Filter

**File**: `src/utils/dataAccessFilter.ts`

```typescript
import { prisma } from '../models/prisma.js';
import logger from '../config/logger.js';

/**
 * Build data access filter (Layer 1)
 * Controls which records user can see
 */
export async function buildDataAccessFilter(
  userid: number,
  object: string,
  baseQuery: any = {}
): Promise<any> {
  try {
    // Get user's role and permissions
    const user = await prisma.users.findUnique({
      where: { id: userid },
      include: {
        role: {
          include: {
            permissionsets: {
              where: { isactive: true, isdefault: true },
              take: 1
            }
          }
        }
      }
    });

    if (!user || !user.role) {
      return { ...baseQuery, id: -1 }; // Return empty result
    }

    const permissionset = user.role.permissionsets[0];
    if (!permissionset) {
      return { ...baseQuery, id: -1 };
    }

    // Parse permissions
    const permissions = permissionset.permissions as Array<any>;
    const permission = permissions.find(p => p.object === object);
    
    if (!permission) {
      return { ...baseQuery, id: -1 };
    }

    // LAYER 1: Apply data access filter
    if (permission.viewall === true) {
      // Can view all records - no filter needed
      return baseQuery;
    }

    // Check access level
    const accesslevel = permission.accesslevel || 'own';
    
    switch (accesslevel) {
      case 'all':
        // No filter
        return baseQuery;
        
      case 'own':
        // Only own records
        return {
          ...baseQuery,
          createdby: userid  // Assuming createdby field exists
        };
        
      case 'subordinates':
        // Own + subordinates' records
        const userhierarchy = await getuserhierarchy(userid);
        const subordinateids = userhierarchy?.subordinates as number[] || [];
        return {
          ...baseQuery,
          createdby: {
            in: [userid, ...subordinateids]
          }
        };
        
      default:
        // Default to own
        return {
          ...baseQuery,
          createdby: userid
        };
    }
  } catch (error) {
    logger.error({ error, userid, object }, 'Error building data access filter');
    return { ...baseQuery, id: -1 }; // Fail safe: return empty
  }
}

/**
 * Get user hierarchy (manager-subordinate relationships)
 */
async function getuserhierarchy(userid: number): Promise<any> {
  try {
    return await prisma.userhierarchy.findUnique({
      where: { userid }
    });
  } catch (error) {
    // Table might not exist yet
    return null;
  }
}
```

### 3. Permission Middleware

**File**: `src/middleware/permission.middleware.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { checkPermission, PermissionContext } from '../utils/permissionChecker.js';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: number;
    roleid?: string;
    email?: string;
    [key: string]: any;
  };
  permission?: {
    allowed: boolean;
    scope?: {
      viewall: boolean;
      modifyall: boolean;
      deleteall: boolean;
    };
  };
}

/**
 * Middleware to require permission before route handler
 */
export function requirePermission(
  object: string,
  action: string,
  options?: {
    checkownership?: boolean;
    ownershipfield?: string;
    resourceidParam?: string;
  }
) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const userid = request.user?.id;
    
    if (!userid) {
      return reply.code(401).send({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
    }

    // Build permission context
    const context: PermissionContext = {
      object,
      action
    };

    // Check ownership if required
    if (options?.checkownership) {
      const resourceid = request.params?.[options.resourceidparam || 'id'];
      if (resourceid) {
        // Get resource to check ownership
        const resource = await getResource(object, resourceid);
        if (resource) {
          const ownerField = options.ownershipfield || 'createdby';
          context.resourceid = resourceid;
          context.resourceownerid = resource[ownerField];
        }
      }
    }

    // Check permission (handles both layers)
    const result = await checkPermission(userid, object, action, context);

    if (!result.allowed) {
      return reply.code(403).send({
        success: false,
        message: 'Permission denied',
        details: result.reason,
        object,
        action
      });
    }

    // Attach permission context to request
    request.permission = {
      allowed: true,
      scope: result.scope
    };
  };
}

/**
 * Helper: Get resource for ownership check
 */
async function getResource(object: string, resourceid: string): Promise<any> {
  const { prisma } = await import('../models/prisma.js');
  
  try {
    switch (object) {
      case 'products':
        return await prisma.product.findUnique({
          where: { id: BigInt(resourceid) },
          select: { id: true, createdby: true }
        });
      case 'stocks':
        return await prisma.stock.findUnique({
          where: { id: BigInt(resourceid) },
          select: { id: true, createdby: true }
        });
      case 'orders':
        return await prisma.orders.findUnique({
          where: { id: parseInt(resourceid) },
          select: { id: true, userid: true } // Assuming userid is owner
        });
      // Add more cases as needed
      default:
        return null;
    }
  } catch (error) {
    return null;
  }
}
```

---

## 🎨 Frontend Implementation

### 1. Auth Store with Permissions

**File**: `src/lib/stores/auth.ts` (React) or `src/lib/stores/auth.ts` (Svelte)

```typescript
import { writable, get } from 'svelte/store'; // or React useState/Context

interface Permission {
  read: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  import: boolean;
  approve: boolean;
  reject: boolean;
  viewall: boolean;
  modifyall: boolean;
  deleteall: boolean;
  accesslevel?: string;
  customactions?: Record<string, boolean>;
}

interface UserPermissions {
  [objectType: string]: Permission;
}

interface AuthState {
  user: any | null;
  permissions: UserPermissions;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissionsLoaded: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  permissions: {},
  isAuthenticated: false,
  isLoading: false,
  permissionsLoaded: false,
  error: null
};

export const authStore = writable<AuthState>(initialState);

/**
 * Load permissions for user
 */
export async function loadPermissions(userid: number): Promise<void> {
  authStore.update(state => ({ ...state, isLoading: true }));
  
  try {
    const response = await fetch('/api/v1/permissions/user', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch permissions');
    }
    
    const data = await response.json();
    const permissionsMap: UserPermissions = {};
    
    // Convert permissions array to object map
    data.data.permissions.forEach((perm: any) => {
      const objectKey = perm.object.toLowerCase();
      permissionsMap[objectKey] = {
        read: perm.read || false,
        create: perm.create || false,
        edit: perm.edit || false,
        delete: perm.delete || false,
        export: perm.export || false,
        import: perm.import || false,
        approve: perm.approve || false,
        reject: perm.reject || false,
        viewall: perm.viewall || false,
        modifyall: perm.modifyall || false,
        deleteall: perm.deleteall || false,
        accesslevel: perm.accesslevel || 'own',
        customactions: perm.customactions || {}
      };
    });
    
    authStore.update(state => ({
      ...state,
      permissions: permissionsMap,
      permissionsLoaded: true,
      isLoading: false,
      error: null
    }));
    
    // Cache in localStorage
    localStorage.setItem('permissions', JSON.stringify(permissionsMap));
    localStorage.setItem('permissions_timestamp', Date.now().toString());
  } catch (error) {
    authStore.update(state => ({
      ...state,
      error: error.message,
      isLoading: false
    }));
  }
}

/**
 * Check if user has specific permission
 */
export function hasPermission(objectType: string, permission: keyof Permission): boolean {
  const state = get(authStore);
  const objectPermissions = state.permissions[objectType.toLowerCase()];
  return objectPermissions?.[permission] || false;
}

/**
 * Check if user can perform action on specific record
 */
export function canPerformAction(
  objectType: string,
  action: 'read' | 'edit' | 'delete',
  recordownerid?: number,
  currentuserid?: number
): boolean {
  const state = get(authStore);
  const objectPermissions = state.permissions[objectType.toLowerCase()];
  
  // If no record owner specified, use basic permissions
  if (!recordownerid || !currentuserid) {
    return objectPermissions?.[action] || false;
  }
  
  // Check if user owns the record
  const isOwner = recordownerid === currentuserid;
  
  if (isOwner) {
    // Owner: Check basic permission
    return objectPermissions?.[action] || false;
  } else {
    // Non-owner: Check cross-ownership permissions
    switch (action) {
      case 'read': return objectPermissions?.viewall || false;
      case 'edit': return objectPermissions?.modifyall || false;
      case 'delete': return objectPermissions?.deleteall || false;
      default: return false;
    }
  }
}
```

### 2. Permission Components

**React Example**: `src/components/PermissionGuard.tsx`

```typescript
import { ReactNode } from 'react';
import { hasPermission, canPerformAction } from '../lib/stores/auth';

interface PermissionGuardProps {
  object: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
  recordownerid?: number;
  currentuserid?: number;
}

export function PermissionGuard({
  object,
  action,
  children,
  fallback = null,
  recordownerid,
  currentuserid
}: PermissionGuardProps) {
  const hasAccess = recordownerid && currentuserid
    ? canPerformAction(object, action as any, recordownerid, currentuserid)
    : hasPermission(object, action as any);
  
  if (!hasAccess) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
```

---

## 🔌 API Integration

### 1. Permission API Routes

**File**: `src/routes/permission.route.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { getUserPermissions } from '../utils/permissionChecker.js';

export async function permissionRoutes(fastify: FastifyInstance) {
  // GET /v1/permissions/user - Get all permissions for current user
  fastify.get('/user', {
    preHandler: [fastify.authenticate] // Your auth middleware
  }, async (request, reply) => {
    const userid = request.user?.id;
    
    if (!userid) {
      return reply.code(401).send({
        success: false,
        message: 'Unauthorized'
      });
    }

    const permissions = await getUserPermissions(userid);

    return reply.send({
      success: true,
      data: permissions
    });
  });

  // GET /v1/permissions/check - Check specific permission
  fastify.get('/check', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          object: { type: 'string' },
          action: { type: 'string' }
        },
        required: ['object', 'action']
      }
    }
  }, async (request, reply) => {
    const userid = request.user?.id;
    const { object, action } = request.query as { object: string; action: string };

    const { checkPermission } = await import('../utils/permissionChecker.js');
    const result = await checkPermission(userid, object, action);

    return reply.send({
      success: true,
      data: result
    });
  });
}
```

### 2. Protected Route Example

**File**: `src/routes/product.route.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { requirePermission } from '../middleware/permission.middleware.js';
import { buildDataAccessFilter } from '../utils/dataAccessFilter.js';

export async function productRoutes(fastify: FastifyInstance) {
  // GET /v1/products - List products (Layer 1 + Layer 2)
  fastify.get('/', {
    preHandler: requirePermission('products', 'read')
  }, async (request, reply) => {
    const userid = request.user?.id;
    
    // Layer 1: Build data access filter
    const accessQuery = await buildDataAccessFilter(
      userid,
      'products',
      {} // base query
    );
    
    // Execute filtered query
    const products = await prisma.product.findMany({
      where: accessQuery
    });
    
    return reply.send({
      success: true,
      data: products
    });
  });

  // PUT /v1/products/:id - Update product (Layer 2)
  fastify.put('/:id', {
    preHandler: requirePermission('products', 'edit', {
      checkownership: true,
      ownershipfield: 'createdby',
      resourceidparam: 'id'
    })
  }, async (request, reply) => {
    const product = await productService.update(
      request.params.id,
      request.body,
      request.user?.id
    );
    
    return reply.send({
      success: true,
      data: product
    });
  });
}
```

---

## 📦 Migration Guide

### Step 1: Add Prisma Models

1. Add `Role`, `PermissionSet`, `UserHierarchy` models to `schema.prisma` (FieldPermission skipped for now)
2. Add `roleid` field to `users` model
3. Run migration:
```bash
npx prisma migrate dev --name add_roles_permissions_system
```

### Step 2: Seed Default Roles

```typescript
// prisma/seed.ts
const defaultRoles = [
  {
    id: 'role-superadmin',
    name: 'Super Admin',
    code: 'superadmin',
    level: 1,
    issystem: true,
    isactive: true
  },
  {
    id: 'role-admin',
    name: 'Admin',
    code: 'admin',
    level: 2,
    issystem: true,
    isactive: true
  },
  {
    id: 'role-manager',
    name: 'Manager',
    code: 'manager',
    level: 3,
    issystem: true,
    isactive: true
  },
  {
    id: 'role-staff',
    name: 'Staff',
    code: 'staff',
    level: 4,
    issystem: true,
    isactive: true
  }
];
```

### Step 3: Create Permission Sets

```typescript
// Create admin permission set
await prisma.permissionset.create({
  data: {
    name: 'Admin Permission Set',
    description: 'Full access',
    roleid: 'role-admin',
    isdefault: true,
    permissions: [
      {
        object: 'products',
        read: true,
        create: true,
        edit: true,
        delete: true,
        export: true,
        import: true,
        viewall: true,
        modifyall: true,
        deleteall: true,
        accesslevel: 'all'
      }
      // ... more objects
    ]
  }
});
```

### Step 4: Assign Roles to Users

```typescript
// Update existing users with roles
await prisma.users.updateMany({
  where: { /* criteria */ },
  data: { roleid: 'role-admin' }
});
```

---

## ✅ Implementation Checklist

### Backend
- [ ] Add Prisma models (Role, PermissionSet, UserHierarchy) - FieldPermission skipped for now
- [ ] Add `roleid` to `users` model
- [ ] Run Prisma migration
- [ ] Create `permissionChecker.ts`
- [ ] Create `dataAccessFilter.ts`
- [ ] Create `permission.middleware.ts`
- [ ] Create permission API routes
- [ ] Update existing routes with permission middleware
- [ ] Seed default roles
- [ ] Create default permission sets
- [ ] Assign roles to users

### Frontend
- [ ] Create auth store with permissions
- [ ] Create permission loading function
- [ ] Create permission checking functions
- [ ] Create PermissionGuard component
- [ ] Create ProtectedButton component
- [ ] Update components to use permissions
- [ ] Add permission checks before actions

### Testing
- [ ] Test permission checking
- [ ] Test data access filtering
- [ ] Test cross-ownership permissions
- [ ] Test permission inheritance
- [ ] Test frontend permission checks

---

## 📝 Summary

### Architecture
- ✅ **Two-Layer Security**: Data access + operation permissions
- ✅ **JSONB Permissions**: Simple, flexible storage
- ✅ **One Role Per User**: Simplified relationship
- ✅ **Role Hierarchy**: Permission inheritance
- ✅ **Record Ownership**: Support for createdby/ownerid

### Key Files
- `src/utils/permissionChecker.ts` - Core permission logic
- `src/utils/dataAccessFilter.ts` - Data access filtering
- `src/middleware/permission.middleware.ts` - Route protection
- Frontend: Auth store with permission management

### Database
- 2 required tables: `roles`, `permission_sets` (field_permissions skipped for now)
- 1 optional table: `user_hierarchies`
- 1 field added: `users.roleid`

**This is your complete, single source of truth for Security & Permissions!** 🎯

---

## 🚀 Quick Start Guide

### Common Questions & Answers

#### 1. **User-Role Mapping**
**Q: How do users get roles?**  
**A**: One user = One role (via `roleid` field in `users` table)

```typescript
// Assign role to user
await prisma.users.update({
  where: { id: userid },
  data: { roleid: 'role-admin-id' }
});
```

#### 2. **Backend Permission Checking**
**Q: When do I check permissions?**  
**A**: Before every DB operation (read, create, update, delete)

**Pattern 1: Middleware (Recommended)**
```typescript
fastify.get('/products', {
  preHandler: requirePermission('products', 'read')
}, handler);
```

**Pattern 2: Service Layer**
```typescript
async findAll(userid: number) {
  const hasPermission = await checkPermission(userid, 'products', 'read');
  if (!hasPermission.allowed) {
    throw new Error('Permission denied');
  }
  // Proceed with query
}
```

#### 3. **Frontend Permission Management**
**Q: How do I manage permissions in frontend?**  
**A**: Fetch ALL permissions ONCE on login, use locally (no API calls per action)

```typescript
// On login
await loadPermissions(userid);

// In components
const canCreate = hasPermission('products', 'create');
const canedit = canPerformAction('products', 'edit', record.ownerid, currentuserid);
```

### Complete Flow Example

#### Backend Flow:
```
1. User makes request → GET /api/v1/products
2. Auth middleware extracts userid
3. Permission middleware checks: requirePermission('products', 'read')
4. Layer 1: Build data access filter (viewall, accesslevel)
5. Layer 2: Check object-level permission
6. Execute filtered query
7. Return results
```

#### Frontend Flow:
```
1. User logs in
2. Fetch permissions: GET /api/v1/permissions/user
3. Store in auth store + localStorage
4. Use in components: hasPermission('products', 'create')
5. Show/hide UI elements based on permissions
```

---

## 📚 JSONB Permission Examples

### Complete Permission Set Example

```json
[
  {
    "object": "products",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "export": true,
    "import": false,
    "approve": true,
    "reject": false,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "all",
    "customactions": {
      "publish": true,
      "archive": false
    }
  },
  {
    "object": "stocks",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "export": true,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "own"
  },
  {
    "object": "orders",
    "read": true,
    "create": true,
    "edit": false,
    "delete": false,
    "export": false,
    "viewall": false,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "own"
  },
  {
    "object": "suppliers",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "export": true,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "all"
  },
  {
    "object": "purchase_requests",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "approve": true,
    "reject": true,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "subordinates"
  },
  {
    "object": "purchase_orders",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "approve": true,
    "reject": true,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "subordinates"
  },
  {
    "object": "promotions",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "export": true,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "all"
  },
  {
    "object": "picklist",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "all"
  },
  {
    "object": "channels",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "all"
  },
  {
    "object": "transactions",
    "read": true,
    "create": true,
    "edit": true,
    "delete": false,
    "export": true,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "all"
  },
  {
    "object": "dashboards",
    "read": true,
    "create": false,
    "edit": false,
    "delete": false,
    "viewall": true,
    "modifyall": false,
    "deleteall": false,
    "accesslevel": "all"
  }
]
```

### Permission Object TypeScript Interface

```typescript
interface PermissionObject {
  object: string;              // Required: 'products', 'stocks', etc.
  read?: boolean;              // Optional: default false
  create?: boolean;            // Optional: default false
  edit?: boolean;              // Optional: default false
  delete?: boolean;            // Optional: default false
  export?: boolean;            // Optional: default false
  import?: boolean;            // Optional: default false
  approve?: boolean;           // Optional: default false
  reject?: boolean;            // Optional: default false
  viewall?: boolean;           // Layer 1: Can view all records
  modifyall?: boolean;         // Layer 1: Can modify all records
  deleteall?: boolean;         // Layer 1: Can delete all records
  accesslevel?: string;        // Optional: 'all', 'own', 'subordinates'
  customactions?: {            // Optional: for custom actions
    [key: string]: boolean;
  };
}
```

---

## 🎯 Common Patterns & Best Practices

### Pattern 1: Route Protection
```typescript
// ✅ Good: Middleware checks before handler
fastify.get('/products', {
  preHandler: requirePermission('products', 'read')
}, handler);

// ❌ Bad: Checking in handler (too late)
fastify.get('/products', async (req, reply) => {
  const hasPerm = await checkPermission(...); // Too late!
});
```

### Pattern 2: Service Layer Filtering
```typescript
// ✅ Good: Service filters based on viewall
async findAll(userid: number) {
  const accessQuery = await buildDataAccessFilter(userid, 'products', {});
  return await prisma.product.findMany({ where: accessQuery });
}

// ❌ Bad: Always returning all
async findAll() {
  return await prisma.product.findMany(); // Security issue!
}
```

### Pattern 3: Frontend Conditional Rendering
```typescript
// ✅ Good: Check before rendering
{hasPermission('products', 'create') && (
  <button onClick={handleCreate}>Create</button>
)}

// ✅ Better: Use component
<PermissionGuard object="products" action="create">
  <button onClick={handleCreate}>Create</button>
</PermissionGuard>
```

### Pattern 4: Record-Level Permission Check
```typescript
// ✅ Good: Check ownership for individual records
const canedit = canPerformAction(
  'products',
  'edit',
  product.createdby,
  currentuserid
);

// ❌ Bad: Only checking object-level
const canedit = hasPermission('products', 'edit'); // Missing ownership check!
```

---

## 🔍 FAQ & Troubleshooting

### Q: How do I add a new object to permissions?
**A**: Add it to the permissions JSONB array:
```typescript
await prisma.permissionset.update({
  where: { id: permissionsetid },
  data: {
    permissions: [
      ...existingPermissions,
      {
        object: 'new_object',
        read: true,
        create: true,
        edit: false,
        delete: false,
        viewall: false,
        modifyall: false,
        deleteall: false,
        accesslevel: 'own'
      }
    ]
  }
});
```

### Q: How do I check if a user can view all records?
**A**: Use the `viewall` flag in permissions:
```typescript
const permissions = await getUserPermissions(userid);
const canviewAll = permissions.permissions['products']?.viewall;
```

### Q: What if a user has no role?
**A**: Permission checks will return `allowed: false` with reason `'User has no role assigned'`

### Q: How do I handle permission inheritance?
**A**: The `checkPermission` function automatically checks parent roles if no permission set is found for the current role.

### Q: Can a user have multiple roles?
**A**: No, our simplified model uses one role per user. If you need multiple roles, you'd need to add a `user_roles` many-to-many table.

### Q: How do I add custom actions?
**A**: Add them to the `customactions` object in permissions JSONB:
```json
{
  "object": "products",
  "customactions": {
    "publish": true,
    "archive": false,
    "feature": true
  }
}
```

---

## 🔒 Security Best Practices

### Backend
1. **Always Check Authentication First**
   ```typescript
   if (!userid) {
     return reply.code(401).send({ error: 'Unauthorized' });
   }
   ```

2. **Use Both Layers for Individual Records**
   ```typescript
   // Layer 1: Object-level
   const objectPermission = await checkPermission(userid, 'products', 'edit');
   
   // Layer 2: Record-level
   const recordPermission = await checkPermission(
     userid,
     'products',
     'edit',
     { resourceownerid: product.createdby }
   );
   ```

3. **Never Trust Frontend Checks**
   - Always verify permissions on the backend
   - Frontend checks are for UX only

4. **Log Permission Denials**
   ```typescript
   if (!result.allowed) {
     logger.warn({ userid, object, action }, 'Permission denied');
   }
   ```

### Frontend
1. **Wait for Permissions to Load**
   ```typescript
   {!permissionsLoaded ? (
     <div>Loading permissions...</div>
   ) : (
     <YourContent />
   )}
   ```

2. **Cache Permissions**
   ```typescript
   // Cache in localStorage with expiration
   localStorage.setItem('permissions', JSON.stringify(permissions));
   localStorage.setItem('permissions_timestamp', Date.now().toString());
   ```

3. **Check Record Ownership**
   ```typescript
   const canedit = canPerformAction(
     'products',
     'edit',
     record.ownerid,
     currentuserid
   );
   ```

---

## 📊 Alignment with BaseApp Security Model

### ✅ Fully Aligned Features
- Two-layer security (data access + operation permissions)
- Permission structure (read, create, edit, delete, viewall, modifyall, deleteall)
- Role-based access control
- Permission inheritance
- Frontend permission caching
- Record ownership checks

### ⚠️ Differences (Simplified Approach)
- **Permission Storage**: JSONB in `permission_sets` (vs separate table)
- **User-Role Relationship**: One role per user (vs many-to-many)
- **Data Access Rules**: Flags in JSONB (vs separate table)

### Benefits of Our Approach
- ✅ Simpler structure (fewer tables)
- ✅ Easier to manage (one role per user)
- ✅ Flexible (JSONB allows easy extension)
- ✅ Fast (single query for all permissions)

---

## 🎓 Learning Resources

### Key Concepts
1. **Layer 1 (Data Access)**: Controls which records user can see
2. **Layer 2 (Operation)**: Controls what actions user can perform
3. **Permission Inheritance**: Child roles inherit from parent roles
4. **Record Ownership**: Users can only modify their own records unless they have `modifyall`/`deleteall`

### File Structure Reference
```
Backend:
├── src/
│   ├── utils/
│   │   ├── permissionChecker.ts      # Core permission logic
│   │   └── dataAccessFilter.ts       # Data access filtering
│   ├── middleware/
│   │   └── permission.middleware.ts  # Route protection
│   └── routes/
│       └── permission.route.ts       # Permission APIs

Frontend:
├── src/
│   ├── lib/
│   │   └── stores/
│   │       └── auth.ts              # Permission management
│   └── components/
│       └── PermissionGuard.tsx      # Permission components
```

---

## 📝 Version History

- **v1.0** - Initial master plan with two-layer security
- Includes: Roles, Permission Sets, Field Permissions, User Hierarchy
- Aligned with BaseApp concepts while maintaining simplified structure

