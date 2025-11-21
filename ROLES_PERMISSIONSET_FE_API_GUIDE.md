# Roles & Permission Sets - Frontend API Integration Guide

Complete API documentation with TypeScript interfaces, request/response examples, and payload schemas for all CRUD operations.

---

## 📋 Table of Contents

1. [Roles API](#roles-api)
   - [GET /v1/roles](#get-v1roles)
   - [GET /v1/roles/:id](#get-v1rolesid)
   - [POST /v1/roles](#post-v1roles)
   - [PUT /v1/roles/:id](#put-v1rolesid)
   - [DELETE /v1/roles/:id](#delete-v1rolesid)
   - [GET /v1/roles/level-preview](#get-v1roleslevel-preview)

2. [Permission Sets API](#permission-sets-api)
   - [GET /v1/permission-sets](#get-v1permission-sets)
   - [GET /v1/permission-sets/:id](#get-v1permission-setsid)
   - [POST /v1/permission-sets](#post-v1permission-sets)
   - [PUT /v1/permission-sets/:id](#put-v1permission-setsid)
   - [DELETE /v1/permission-sets/:id](#delete-v1permission-setsid)
   - [GET /v1/permission-sets/role/:roleid](#get-v1permission-setsroleroleid)
   - [GET /v1/permission-sets/role/:roleid/active](#get-v1permission-setsroleroleidactive)
   - [GET /v1/permission-sets/preview](#get-v1permission-setspreview)
   - [GET /v1/permission-sets/system-default-preview](#get-v1permission-setssystem-default-preview)

3. [TypeScript Interfaces](#typescript-interfaces)

---

## 🔐 Roles API

### **GET /v1/roles**

Get all roles with pagination and filtering.

#### **Request**

```typescript
GET /v1/roles?page=1&limit=10&name=admin&code=admin&level=1&isactive=true&issystem=false&parentroleid=1&sortBy=level&sortOrder=asc
```

#### **Query Parameters**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | string | Page number | `"1"` |
| `limit` | string | Items per page | `"10"` |
| `name` | string | Filter by role name (partial match) | `"admin"` |
| `code` | string | Filter by role code (partial match) | `"admin"` |
| `level` | string | Filter by level | `"1"` |
| `isactive` | string | Filter by active status | `"true"` or `"false"` |
| `issystem` | string | Filter by system role status | `"true"` or `"false"` |
| `parentroleid` | string | Filter by parent role ID | `"1"` |
| `sortBy` | string | Sort by field: `id`, `name`, or `level` (default: `level`) | `"level"` |
| `sortOrder` | string | Sort order: `asc` or `desc` (default: `asc`) | `"asc"` |

#### **Response**

```typescript
{
  success: true,
  message: "Roles retrieved successfully",
  data: [
    {
      id: 1,
      name: "Super Admin",
      code: "superadmin",
      level: 1,
      description: "Full system access",
      isactive: true,
      issystem: true,
      parentroleid: null,
      createddate: 1704067200000,
      modifieddate: 1704067200000,
      permissionsets: [
        {
          id: 1,
          name: "Super Admin Permission Set",
          description: "Full access",
          isactive: true,
          isdefault: false
        }
      ],
      inventoryusers: [
        {
          id: 1,
          useremail: "admin@example.com",
          firstname: "John",
          lastname: "Doe"
        }
      ],
      parentrole: null,
      childroles: [
        {
          id: 2,
          name: "Admin",
          code: "admin",
          level: 2
        }
      ]
    }
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 25,
    totalPages: 3,
    hasNext: true,
    hasPrev: false
  },
  meta: {
    filters: ["name", "isactive"],
    total: 25,
    filtered: true
  }
}
```

#### **TypeScript Interface**

```typescript
interface Role {
  id: number;
  name: string;
  code: string;
  level: number;
  description: string | null;
  isactive: boolean;
  issystem: boolean;
  parentroleid: number | null;
  createddate: number | null;
  modifieddate: number | null;
  permissionsets?: Array<{
    id: number;
    name: string;
    description: string | null;
    isactive: boolean;
    isdefault: boolean;
  }>;
  inventoryusers?: Array<{
    id: number;
    useremail: string | null;
    firstname: string | null;
    lastname: string | null;
  }>;
  parentrole?: {
    id: number;
    name: string;
    code: string;
    level?: number;
  } | null;
  childroles?: Array<{
    id: number;
    name: string;
    code: string;
    level?: number;
  }>;
}

interface RolesResponse {
  success: boolean;
  message: string;
  data: Role[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    filters: string[];
    total: number;
    filtered: boolean;
  };
}
```

---

### **GET /v1/roles/:id**

Get a single role by ID.

#### **Request**

```typescript
GET /v1/roles/1
```

#### **Response**

```typescript
{
  success: true,
  message: "Role retrieved successfully",
  data: {
    id: 1,
    name: "Super Admin",
    code: "superadmin",
    level: 1,
    description: "Full system access",
    isactive: true,
    issystem: true,
    parentroleid: null,
    createddate: 1704067200000,
    modifieddate: 1704067200000,
    permissionsets: [
      {
        id: 1,
        name: "Super Admin Permission Set",
        description: "Full access",
        isactive: true,
        isdefault: false,
        permissions: [
          {
            object: "products",
            read: true,
            create: true,
            edit: true,
            delete: true,
            viewall: true,
            modifyall: true,
            deleteall: true,
            accesslevel: "all"
          }
        ]
      }
    ],
    inventoryusers: [...],
    parentrole: null,
    childroles: [...]
  }
}
```

---

### **POST /v1/roles**

Create a new role.

#### **Request Payload**

```typescript
{
  name: "Manager",
  code: "manager",
  level: 3,  // Required, must be >= 1
  description: "Manager role with limited access",
  isactive: true,
  issystem: false,
  parentroleid: 2,  // Optional: parent role ID (0 or null = no parent)
  createddate: 1704067200000,  // Optional: auto-generated if not provided
  modifieddate: 1704067200000  // Optional: auto-generated if not provided
}
```

#### **TypeScript Interface**

```typescript
interface CreateRolePayload {
  name: string;                    // Required, max 100 chars
  code: string;                    // Required, max 50 chars, unique, lowercase alphanumeric with underscores only
  level: number;                   // Required, must be >= 1 (no default)
  description?: string | null;     // Optional, max 500 chars
  isactive?: boolean;              // Optional, default: true
  issystem?: boolean;              // Optional, default: false
  parentroleid?: number | null;    // Optional: parent role ID (0 or null = no parent)
  createddate?: number;            // Optional: Unix timestamp (milliseconds)
  modifieddate?: number;           // Optional: Unix timestamp (milliseconds)
}
```

#### **Response**

```typescript
{
  success: true,
  message: "Role created successfully",
  data: {
    id: 3,
    name: "Manager",
    code: "manager",
    level: 3,  // Auto-adjusted if conflict exists
    description: "Manager role with limited access",
    isactive: true,
    issystem: false,
    parentroleid: 2,
    createddate: 1704067200000,
    modifieddate: 1704067200000,
    permissionsets: [],
    parentrole: {
      id: 2,
      name: "Admin",
      code: "admin"
    },
    childroles: []
  }
}
```

#### **Example Usage**

```typescript
const createRole = async (payload: CreateRolePayload): Promise<{ success: boolean; message: string; data: Role }> => {
  const response = await fetch('/api/v1/roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create role');
  }

  return response.json();
};

// Usage
await createRole({
  name: "Manager",
  code: "manager",
  level: 3,  // Required, must be >= 1
  description: "Manager role with limited access",
  isactive: true,
  issystem: false,
  parentroleid: 2
});
```

#### **Important Notes**

- **Level Required**: `level` is **required** and must be `>= 1` (no default value).
- **Level Auto-Adjustment**: If you pass `level: 4` and a role with level 4 already exists, the existing role will be shifted to level 5, and your new role will get level 4.
- **Level Auto-Normalization**: If you pass `level: 100` and the max level in DB is 5, your role will get level 6 (max + 1).
- **Unique Constraints**: `name` and `code` must be unique.
- **Code Format**: Must be lowercase alphanumeric with underscores only (e.g., "admin", "super_admin"). The code is automatically normalized to lowercase.
- **Parent Role**: `parentroleid` can be `null`, `0`, or a positive integer. Both `null` and `0` mean no parent.

---

### **PUT /v1/roles/:id**

Update an existing role.

#### **Request Payload**

```typescript
{
  name?: string;                   // Optional
  code?: string;                   // Optional, must be unique if changed
  level?: number;                  // Optional, auto-adjusted if conflict
  description?: string | null;     // Optional
  isactive?: boolean;              // Optional
  issystem?: boolean;              // Optional
  parentroleid?: number | null;    // Optional (0 or null = no parent)
  createddate?: number;            // Optional
  modifieddate?: number;           // Optional (auto-updated)
}
```

#### **Important Notes**

- **System Role Protection**: Cannot deactivate or modify `issystem` for system roles.
- **Level Auto-Adjustment**: When updating level, other roles are automatically shifted to maintain uniqueness.
- **Partial Updates**: Only include fields you want to update.

---

### **DELETE /v1/roles/:id**

Delete a role (soft delete if has dependencies).

#### **Response (Hard Delete)**

```typescript
{
  success: true,
  message: "Role deleted successfully",
  data: {
    id: 3,
    deleted: true
  }
}
```

#### **Response (Soft Delete - has users)**

```typescript
{
  success: true,
  message: "Role deleted successfully",
  data: {
    id: 3,
    name: "Manager",
    code: "manager",
    level: 3,
    isactive: false,  // Deactivated instead of deleted
    modifieddate: 1704153600000
  }
}
```

---

### **GET /v1/roles/level-preview**

Preview the impact of assigning a specific level to a role.

#### **Request**

```typescript
GET /v1/roles/level-preview?level=3&excludeRoleId=5
```

#### **Query Parameters**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `level` | string | The level to preview (must be >= 1) | `"3"` |
| `excludeRoleId` | string | Optional: Role ID to exclude from impact calculation (for update operations) | `"5"` |

#### **Response**

```typescript
{
  success: true,
  message: "Level change preview generated",
  data: {
    requestedLevel: 3,
    levelExists: true,
    existingRoleAtLevel: {
      id: 2,
      name: "Admin",
      code: "admin",
      level: 3
    },
    affectedRolesCount: 2,
    impact: [
      {
        roleId: 2,
        roleName: "Admin",
        roleCode: "admin",
        currentLevel: 3,
        newLevel: 4
      },
      {
        roleId: 4,
        roleName: "Staff",
        roleCode: "staff",
        currentLevel: 4,
        newLevel: 5
      }
    ],
    message: "Level 3 is currently assigned to \"Admin\". This role will take Level 3, and 2 role(s) will be shifted up."
  }
}
```

#### **TypeScript Interface**

```typescript
interface LevelPreviewResponse {
  success: boolean;
  message: string;
  data: {
    requestedLevel: number;
    levelExists: boolean;
    existingRoleAtLevel: {
      id: number;
      name: string;
      code: string;
      level: number;
    } | null;
    affectedRolesCount: number;
    impact: Array<{
      roleId: number;
      roleName: string;
      roleCode: string;
      currentLevel: number;
      newLevel: number;
    }>;
    message: string;
  };
}
```

#### **Example Usage**

```typescript
const previewLevelChange = async (
  level: number,
  excludeRoleId?: number
): Promise<LevelPreviewResponse> => {
  const params = new URLSearchParams();
  params.append('level', level.toString());
  if (excludeRoleId) {
    params.append('excludeRoleId', excludeRoleId.toString());
  }

  const response = await fetch(`/api/v1/roles/level-preview?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to preview level change');
  }

  return response.json();
};

// Usage - Preview for new role
const preview = await previewLevelChange(3);
console.log(preview.data.message);
// "Level 3 is currently assigned to \"Admin\". This role will take Level 3, and 2 role(s) will be shifted up."

// Usage - Preview for updating existing role
const updatePreview = await previewLevelChange(2, 5); // Exclude role ID 5 from impact
console.log(updatePreview.data.impact);
```

---

## 🔑 Permission Sets API

### **GET /v1/permission-sets**

Get all permission sets with pagination and filtering.

#### **Request**

```typescript
GET /v1/permission-sets?page=1&limit=10&name=Admin&roleid=1&isactive=true&isdefault=true
```

#### **Query Parameters**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | string | Page number | `"1"` |
| `limit` | string | Items per page | `"10"` |
| `name` | string | Filter by permission set name (partial match) | `"Admin"` |
| `roleid` | string | Filter by role ID (null for system-wide default) | `"1"` or `null` |
| `isactive` | string | Filter by active status | `"true"` or `"false"` |
| `isdefault` | string | Filter by system-wide default status | `"true"` or `"false"` |

#### **Response**

```typescript
{
  success: true,
  message: "Permission sets retrieved successfully",
  data: [
    {
      id: 1,
      name: "Admin Permission Set",
      description: "Full access for administrators",
      roleid: 1,
      isactive: true,
      isdefault: false,
      permissions: [
        {
          object: "products",
          read: true,
          create: true,
          edit: true,
          delete: true,
          export: true,
          import: true,
          viewall: true,
          modifyall: true,
          deleteall: true,
          accesslevel: "all"
        }
      ],
      createddate: 1704067200000,
      modifieddate: 1704067200000,
      role: {
        id: 1,
        name: "Super Admin",
        code: "superadmin",
        level: 1
      }
    },
    {
      id: 2,
      name: "System Default Permissions",
      description: "Default permissions for roles without active sets",
      roleid: null,  // System-wide default
      isactive: true,
      isdefault: true,  // System-wide default
      permissions: [...],
      createddate: 1704067200000,
      modifieddate: 1704067200000,
      role: null
    }
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 15,
    totalPages: 2,
    hasNext: true,
    hasPrev: false
  },
  meta: {
    filters: ["roleid", "isactive"],
    total: 15,
    filtered: true
  }
}
```

#### **TypeScript Interface**

```typescript
interface PermissionObject {
  object: string;                    // Required: 'products', 'stocks', etc.
  read?: boolean;                   // Optional, default: false
  create?: boolean;                 // Optional, default: false
  edit?: boolean;                   // Optional, default: false
  delete?: boolean;                 // Optional, default: false
  export?: boolean;                 // Optional, default: false
  import?: boolean;                 // Optional, default: false
  approve?: boolean;                // Optional, default: false
  reject?: boolean;                 // Optional, default: false
  viewall?: boolean;               // Layer 1: Can view all records
  modifyall?: boolean;              // Layer 1: Can modify all records
  deleteall?: boolean;              // Layer 1: Can delete all records
  accesslevel?: 'all' | 'own' | 'subordinates';  // Optional
  customactions?: Record<string, boolean>;  // Optional: custom actions
}

interface PermissionSet {
  id: number;
  name: string;
  description: string | null;
  roleid: number | null;  // NULL for system-wide default
  isactive: boolean;
  isdefault: boolean;     // System-wide default (not per-role)
  permissions: PermissionObject[];  // JSONB array
  createddate: number | null;
  modifieddate: number | null;
  role?: {
    id: number;
    name: string;
    code: string;
    level?: number;
  } | null;
}

interface PermissionSetsResponse {
  success: boolean;
  message: string;
  data: PermissionSet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    filters: string[];
    total: number;
    filtered: boolean;
  };
}
```

---

### **GET /v1/permission-sets/:id**

Get a single permission set by ID.

#### **Request**

```typescript
GET /v1/permission-sets/1
```

#### **Response**

```typescript
{
  success: true,
  message: "Permission set retrieved successfully",
  data: {
    id: 1,
    name: "Admin Permission Set",
    description: "Full access for administrators",
    roleid: 1,
    isactive: true,
    isdefault: false,
    permissions: [
      {
        object: "products",
        read: true,
        create: true,
        edit: true,
        delete: true,
        export: true,
        import: true,
        viewall: true,
        modifyall: true,
        deleteall: true,
        accesslevel: "all"
      }
    ],
    createddate: 1704067200000,
    modifieddate: 1704067200000,
    role: {
      id: 1,
      name: "Super Admin",
      code: "superadmin",
      level: 1,
      description: "Full system access"
    }
  }
}
```

---

### **POST /v1/permission-sets**

Create a new permission set.

#### **Request Payload**

```typescript
// Role-specific permission set
{
  name: "Manager Permission Set",
  description: "Limited access for managers",
  roleid: 3,  // Required for role-specific sets
  isactive: true,
  isdefault: false,  // System-wide default (not per-role)
  permissions: [
    {
      object: "products",
      read: true,
      create: true,
      edit: true,
      delete: false,
      export: true,
      import: false,
      viewall: true,
      modifyall: false,
      deleteall: false,
      accesslevel: "own"
    }
  ]
}

// System-wide default permission set
{
  name: "System Default Permissions",
  description: "Default permissions for roles without active sets",
  roleid: null,  // NULL for system-wide default
  isactive: true,
  isdefault: true,  // System-wide default
  permissions: [
    {
      object: "products",
      read: true,
      create: false,
      edit: false,
      delete: false,
      viewall: false
    }
  ]
}
```

#### **TypeScript Interface**

```typescript
interface CreatePermissionSetPayload {
  name: string;                    // Required, max 200 chars
  description?: string | null;     // Optional, max 500 chars
  roleid: number | null;           // Required for role-specific, NULL for system default
  isactive?: boolean;              // Optional, default: true
  isdefault?: boolean;             // Optional, default: false (system-wide default)
  permissions: PermissionObject[];  // Required, at least 1 permission
  createddate?: number;            // Optional: Unix timestamp (milliseconds)
  modifieddate?: number;           // Optional: Unix timestamp (milliseconds)
}
```

#### **Important Notes**

- **System-Wide Default**: `isdefault` is a system-wide fallback (not per-role). Only ONE system-wide default exists.
- **One Active Per Role**: When creating an active permission set for a role, all other active sets for that role are automatically deactivated.
- **Role Validation**: For role-specific sets, `roleid` must exist. For system default, `roleid` should be `null`.
- **Permissions Array**: Must contain at least one permission object.

---

### **PUT /v1/permission-sets/:id**

Update an existing permission set.

#### **Request Payload**

```typescript
{
  name?: string;                   // Optional
  description?: string | null;     // Optional
  roleid?: number | null;         // Optional (NULL for system default)
  isactive?: boolean;             // Optional
  isdefault?: boolean;            // Optional (system-wide default)
  permissions?: PermissionObject[]; // Optional
  createddate?: number;           // Optional
  modifieddate?: number;          // Optional (auto-updated)
}
```

#### **Important Notes**

- **System-Wide Default**: Setting `isdefault: true` unset ALL other system-wide defaults (not per-role).
- **One Active Per Role**: Activating a permission set for a role automatically deactivates all other active sets for that role.
- **Cannot Deactivate Only Active**: Cannot deactivate the only active permission set for a role (system default can be used as fallback).
- **System Default Protection**: Cannot deactivate system default permission set.
- **Partial Updates**: Only include fields you want to update.

---

### **DELETE /v1/permission-sets/:id**

Delete a permission set.

#### **Request**

```typescript
DELETE /v1/permission-sets/5
```

#### **Response**

```typescript
{
  success: true,
  message: "Permission set deleted successfully",
  data: {
    id: 5,
    deleted: true
  }
}
```

---

### **GET /v1/permission-sets/role/:roleid**

Get all permission sets for a specific role.

#### **Request**

```typescript
GET /v1/permission-sets/role/3?activeOnly=true
```

#### **Path Parameters**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `roleid` | string | Role ID | `"3"` |

#### **Query Parameters**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `activeOnly` | string | Filter to active permission sets only (default: `true`) | `"true"` or `"false"` |

#### **Response**

```typescript
{
  success: true,
  message: "Permission sets for role 3 retrieved successfully",
  data: [
    {
      id: 5,
      name: "Manager - Full Access",
      description: "Full access permissions",
      roleid: 3,
      isactive: true,
      isdefault: false,
      permissions: [...],
      createddate: 1704067200000,
      modifieddate: 1704067200000,
      role: {
        id: 3,
        name: "Manager",
        code: "manager"
      }
    },
    {
      id: 6,
      name: "Manager - Read Only",
      description: "Read only permissions",
      roleid: 3,
      isactive: false,  // Inactive (archived)
      isdefault: false,
      permissions: [...],
      createddate: 1704067201000,
      modifieddate: 1704067201000,
      role: {
        id: 3,
        name: "Manager",
        code: "manager"
      }
    }
  ]
}
```

#### **TypeScript Interface**

```typescript
interface PermissionSetsByRoleResponse {
  success: boolean;
  message: string;
  data: PermissionSet[];
}
```

---

### **GET /v1/permission-sets/role/:roleid/active**

Get the active permission set for a role using selection logic.

#### **Request**

```typescript
GET /v1/permission-sets/role/3/active
```

#### **Path Parameters**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `roleid` | string | Role ID | `"3"` |

#### **Selection Logic**

The API uses the following priority order:
1. **Active permission set for the role** (`isactive: true`)
2. **Check parent role** (if role has `parentroleid`) - recursive
3. **System-wide default** (`isdefault: true`) - FALLBACK
4. **null** (no permissions - restricted access)

#### **Response (Active Set Found)**

```typescript
{
  success: true,
  message: "Active permission set for role 3 retrieved successfully",
  data: {
    id: 5,
    name: "Manager - Full Access",
    description: "Full access permissions",
    roleid: 3,
    isactive: true,
    isdefault: false,
    permissions: [
      {
        object: "products",
        read: true,
        create: true,
        edit: true,
        delete: true,
        viewall: true,
        modifyall: true,
        deleteall: true,
        accesslevel: "all"
      }
    ],
    createddate: 1704067200000,
    modifieddate: 1704067200000,
    role: {
      id: 3,
      name: "Manager",
      code: "manager"
    }
  }
}
```

#### **Response (Using System Default - 404)**

```typescript
{
  success: false,
  error: "No active permission set found for this role",
  statusCode: 404
}
```

#### **TypeScript Interface**

```typescript
interface ActivePermissionSetResponse {
  success: boolean;
  message: string;
  data: PermissionSet;
}
```

---

### **GET /v1/permission-sets/preview**

Preview the impact of activating a permission set for a role.

#### **Request**

```typescript
GET /v1/permission-sets/preview?roleid=3&permissionSetId=7
```

#### **Query Parameters**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `roleid` | string | Role ID to preview activation for (required) | `"3"` |
| `permissionSetId` | string | Optional: Permission Set ID being activated (for update operations) | `"7"` |

#### **Response**

```typescript
{
  success: true,
  message: "Permission set activation preview generated",
  data: {
    roleId: 3,
    roleName: "Manager",
    roleCode: "manager",
    activatingPermissionSet: {
      id: 7,
      name: "Manager - New Permissions",
      description: "New permission set",
      currentStatus: "inactive",
      newStatus: "active"
    },
    currentlyActiveCount: 1,
    willBeDeactivated: [
      {
        permissionSetId: 5,
        permissionSetName: "Manager - Full Access",
        description: "Full access permissions",
        currentStatus: "active",
        newStatus: "inactive",
        isDefault: false,
        createdDate: 1704067200000
      }
    ],
    impact: [
      {
        permissionSetId: 5,
        permissionSetName: "Manager - Full Access",
        description: "Full access permissions",
        currentStatus: "active",
        newStatus: "inactive",
        isDefault: false,
        createdDate: 1704067200000
      }
    ],
    message: "Activating \"Manager - New Permissions\" will deactivate 1 currently active permission set(s) for role \"Manager\"."
  }
}
```

#### **Response (No Active Sets)**

```typescript
{
  success: true,
  message: "Permission set activation preview generated",
  data: {
    roleId: 3,
    roleName: "Manager",
    roleCode: "manager",
    activatingPermissionSet: null,
    currentlyActiveCount: 0,
    willBeDeactivated: [],
    impact: [],
    message: "No currently active permission sets for role \"Manager\". Activating a new permission set will not affect any existing sets."
  }
}
```

#### **TypeScript Interface**

```typescript
interface ActivationPreviewResponse {
  success: boolean;
  message: string;
  data: {
    roleId: number;
    roleName: string;
    roleCode: string;
    activatingPermissionSet: {
      id: number;
      name: string;
      description: string | null;
      currentStatus: 'active' | 'inactive';
      newStatus: 'active';
    } | null;
    currentlyActiveCount: number;
    willBeDeactivated: Array<{
      permissionSetId: number;
      permissionSetName: string;
      description: string | null;
      currentStatus: 'active';
      newStatus: 'inactive';
      isDefault: boolean;
      createdDate: number | null;
    }>;
    impact: Array<{
      permissionSetId: number;
      permissionSetName: string;
      description: string | null;
      currentStatus: 'active';
      newStatus: 'inactive';
      isDefault: boolean;
      createdDate: number | null;
    }>;
    message: string;
  };
}
```

---

### **GET /v1/permission-sets/system-default-preview**

Preview the impact of setting a permission set as the system-wide default.

#### **Request**

```typescript
GET /v1/permission-sets/system-default-preview?permissionSetId=5
```

#### **Query Parameters**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `permissionSetId` | string | Optional: Permission Set ID being set as system default (for update operations). If not provided, previews for creating a new system default. | `"5"` |

#### **Response (With Existing System Default)**

```typescript
{
  success: true,
  message: "System default preview generated",
  data: {
    settingAsDefault: {
      id: 5,
      name: "System Default Permissions",
      description: "Default permissions for all roles",
      roleid: null,  // System default must have roleid: null
      currentIsDefault: false,
      newIsDefault: true
    },
    currentSystemDefault: {
      id: 2,
      name: "Old System Default",
      description: "Previous system default",
      roleid: null,
      isactive: true
    },
    willBeUnset: [
      {
        permissionSetId: 2,
        permissionSetName: "Old System Default",
        description: "Previous system default",
        currentStatus: "system default",
        newStatus: "not default",
        roleid: null,
        isActive: true,
        createdDate: 1704067200000
      }
    ],
    impact: [
      {
        permissionSetId: 2,
        permissionSetName: "Old System Default",
        description: "Previous system default",
        currentStatus: "system default",
        newStatus: "not default",
        roleid: null,
        isActive: true,
        createdDate: 1704067200000
      }
    ],
    message: "Setting \"System Default Permissions\" as system-wide default will unset the current system default \"Old System Default\"."
  }
}
```

#### **Response (No Existing System Default)**

```typescript
{
  success: true,
  message: "System default preview generated",
  data: {
    settingAsDefault: null,
    currentSystemDefault: null,
    willBeUnset: [],
    impact: [],
    message: "No existing system-wide default. This will be the first system default."
  }
}
```

#### **Response (Creating New System Default)**

```typescript
{
  success: true,
  message: "System default preview generated",
  data: {
    settingAsDefault: null,
    currentSystemDefault: {
      id: 2,
      name: "Current System Default",
      description: "Existing system default",
      roleid: null,
      isactive: true
    },
    willBeUnset: [
      {
        permissionSetId: 2,
        permissionSetName: "Current System Default",
        description: "Existing system default",
        currentStatus: "system default",
        newStatus: "not default",
        roleid: null,
        isActive: true,
        createdDate: 1704067200000
      }
    ],
    impact: [
      {
        permissionSetId: 2,
        permissionSetName: "Current System Default",
        description: "Existing system default",
        currentStatus: "system default",
        newStatus: "not default",
        roleid: null,
        isActive: true,
        createdDate: 1704067200000
      }
    ],
    message: "Creating a new system-wide default will unset the current system default \"Current System Default\"."
  }
}
```

#### **TypeScript Interface**

```typescript
interface SystemDefaultPreviewResponse {
  success: boolean;
  message: string;
  data: {
    settingAsDefault: {
      id: number;
      name: string;
      description: string | null;
      roleid: number | null;
      currentIsDefault: boolean;
      newIsDefault: true;
    } | null;
    currentSystemDefault: {
      id: number;
      name: string;
      description: string | null;
      roleid: number | null;
      isactive: boolean;
    } | null;
    willBeUnset: Array<{
      permissionSetId: number;
      permissionSetName: string;
      description: string | null;
      currentStatus: 'system default';
      newStatus: 'not default';
      roleid: number | null;
      isActive: boolean;
      createdDate: number | null;
    }>;
    impact: Array<{
      permissionSetId: number;
      permissionSetName: string;
      description: string | null;
      currentStatus: 'system default';
      newStatus: 'not default';
      roleid: number | null;
      isActive: boolean;
      createdDate: number | null;
    }>;
    message: string;
  };
}
```

#### **Example Usage**

```typescript
const previewSystemDefault = async (
  permissionSetId?: number
): Promise<SystemDefaultPreviewResponse> => {
  const params = new URLSearchParams();
  if (permissionSetId) {
    params.append('permissionSetId', permissionSetId.toString());
  }

  const response = await fetch(`/api/v1/permission-sets/system-default-preview?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to preview system default');
  }

  return response.json();
};

// Usage - Preview for creating new system default
const preview = await previewSystemDefault();
console.log(preview.data.message);
// "No existing system-wide default. This will be the first system default."

// Usage - Preview for updating existing permission set to system default
const updatePreview = await previewSystemDefault(5);
console.log(updatePreview.data.willBeUnset);
// Shows which existing system default will be unset
```

#### **Important Notes**

- **System-Wide Default**: Only permission sets with `roleid: null` can be set as system-wide default.
- **Only ONE System Default**: Setting a new system default will automatically unset the existing one.
- **No Query Parameter**: If `permissionSetId` is not provided, the preview shows the impact of creating a new system default.
- **Validation**: If `permissionSetId` is provided, it must have `roleid: null` to be eligible as system default.

---

## 📝 TypeScript Interfaces (Complete)

### **Complete Type Definitions**

```typescript
// ============================================
// ROLES
// ============================================

export interface Role {
  id: number;
  name: string;
  code: string;
  level: number;
  description: string | null;
  isactive: boolean;
  issystem: boolean;
  parentroleid: number | null;
  createddate: number | null;
  modifieddate: number | null;
  permissionsets?: PermissionSet[];
  inventoryusers?: Array<{
    id: number;
    useremail: string | null;
    firstname: string | null;
    lastname: string | null;
  }>;
  parentrole?: {
    id: number;
    name: string;
    code: string;
    level?: number;
  } | null;
  childroles?: Array<{
    id: number;
    name: string;
    code: string;
    level?: number;
  }>;
}

export interface CreateRolePayload {
  name: string;                    // Required, max 100 chars
  code: string;                    // Required, max 50 chars, unique, lowercase alphanumeric with underscores only
  level: number;                   // Required, must be >= 1 (no default)
  description?: string | null;     // Optional, max 500 chars
  isactive?: boolean;              // Optional, default: true
  issystem?: boolean;              // Optional, default: false
  parentroleid?: number | null;    // Optional: parent role ID (0 or null = no parent)
  createddate?: number;            // Optional: Unix timestamp (milliseconds)
  modifieddate?: number;           // Optional: Unix timestamp (milliseconds)
}

export interface UpdateRolePayload {
  name?: string;                   // Optional, max 100 chars
  code?: string;                   // Optional, max 50 chars, unique, lowercase alphanumeric with underscores only
  level?: number;                  // Optional, must be >= 1 if provided
  description?: string | null;     // Optional, max 500 chars
  isactive?: boolean;              // Optional
  issystem?: boolean;              // Optional
  parentroleid?: number | null;    // Optional: parent role ID (0 or null = no parent)
  createddate?: number;            // Optional
  modifieddate?: number;           // Optional (auto-updated)
}

export interface RolesResponse {
  success: boolean;
  message: string;
  data: Role[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    filters: string[];
    total: number;
    filtered: boolean;
  };
}

export interface RolesQueryParams {
  page?: number;
  limit?: number;
  name?: string;
  code?: string;
  level?: number;
  isactive?: boolean;
  issystem?: boolean;
  parentroleid?: number;
  sortBy?: 'id' | 'name' | 'level';  // Sort field (default: 'level')
  sortOrder?: 'asc' | 'desc';        // Sort order (default: 'asc')
}

export interface RoleResponse {
  success: boolean;
  message: string;
  data: Role;
}

export interface LevelPreviewResponse {
  success: boolean;
  message: string;
  data: {
    requestedLevel: number;
    levelExists: boolean;
    existingRoleAtLevel: {
      id: number;
      name: string;
      code: string;
      level: number;
    } | null;
    affectedRolesCount: number;
    impact: Array<{
      roleId: number;
      roleName: string;
      roleCode: string;
      currentLevel: number;
      newLevel: number;
    }>;
    message: string;
  };
}

// ============================================
// PERMISSION SETS
// ============================================

export interface PermissionObject {
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
  accesslevel?: 'all' | 'own' | 'subordinates';
  customactions?: Record<string, boolean>;
}

export interface PermissionSet {
  id: number;
  name: string;
  description: string | null;
  roleid: number | null;  // NULL for system-wide default
  isactive: boolean;
  isdefault: boolean;     // System-wide default (not per-role)
  permissions: PermissionObject[];
  createddate: number | null;
  modifieddate: number | null;
  role?: {
    id: number;
    name: string;
    code: string;
    level?: number;
    description?: string | null;
  } | null;
}

export interface CreatePermissionSetPayload {
  name: string;
  description?: string | null;
  roleid: number | null;  // Required for role-specific, NULL for system default
  isactive?: boolean;
  isdefault?: boolean;     // System-wide default (not per-role)
  permissions: PermissionObject[];
  createddate?: number;
  modifieddate?: number;
}

export interface UpdatePermissionSetPayload {
  name?: string;
  description?: string | null;
  roleid?: number | null;  // NULL for system default
  isactive?: boolean;
  isdefault?: boolean;     // System-wide default (not per-role)
  permissions?: PermissionObject[];
  createddate?: number;
  modifieddate?: number;
}

export interface PermissionSetsResponse {
  success: boolean;
  message: string;
  data: PermissionSet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    filters: string[];
    total: number;
    filtered: boolean;
  };
}

export interface PermissionSetResponse {
  success: boolean;
  message: string;
  data: PermissionSet;
}

export interface PermissionSetsByRoleResponse {
  success: boolean;
  message: string;
  data: PermissionSet[];
}

export interface ActivePermissionSetResponse {
  success: boolean;
  message: string;
  data: PermissionSet;
}

export interface ActivationPreviewResponse {
  success: boolean;
  message: string;
  data: {
    roleId: number;
    roleName: string;
    roleCode: string;
    activatingPermissionSet: {
      id: number;
      name: string;
      description: string | null;
      currentStatus: 'active' | 'inactive';
      newStatus: 'active';
    } | null;
    currentlyActiveCount: number;
    willBeDeactivated: Array<{
      permissionSetId: number;
      permissionSetName: string;
      description: string | null;
      currentStatus: 'active';
      newStatus: 'inactive';
      isDefault: boolean;
      createdDate: number | null;
    }>;
    impact: Array<{
      permissionSetId: number;
      permissionSetName: string;
      description: string | null;
      currentStatus: 'active';
      newStatus: 'inactive';
      isDefault: boolean;
      createdDate: number | null;
    }>;
    message: string;
  };
}

export interface SystemDefaultPreviewResponse {
  success: boolean;
  message: string;
  data: {
    settingAsDefault: {
      id: number;
      name: string;
      description: string | null;
      roleid: number | null;
      currentIsDefault: boolean;
      newIsDefault: true;
    } | null;
    currentSystemDefault: {
      id: number;
      name: string;
      description: string | null;
      roleid: number | null;
      isactive: boolean;
    } | null;
    willBeUnset: Array<{
      permissionSetId: number;
      permissionSetName: string;
      description: string | null;
      currentStatus: 'system default';
      newStatus: 'not default';
      roleid: number | null;
      isActive: boolean;
      createdDate: number | null;
    }>;
    impact: Array<{
      permissionSetId: number;
      permissionSetName: string;
      description: string | null;
      currentStatus: 'system default';
      newStatus: 'not default';
      roleid: number | null;
      isActive: boolean;
      createdDate: number | null;
    }>;
    message: string;
  };
}

// ============================================
// ERROR RESPONSES
// ============================================

export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
  statusCode: number;
}
```

---

## 🎯 Key Changes & Important Notes

### **Permission Sets - Key Updates**

#### **1. System-Wide Default (`isdefault`)**

- **Changed**: `isdefault` is now a **system-wide fallback** (not per-role)
- **Purpose**: Used as fallback when a role has no active permission set
- **Only ONE**: Only one system-wide default exists in the entire system
- **Can have `roleid: null`**: System default can have `roleid: null`

#### **2. One Active Per Role Enforcement**

- **Enforced**: Only ONE active permission set per role at any time
- **Automatic**: When creating/activating a permission set, all other active sets for that role are automatically deactivated
- **Cannot Deactivate Only Active**: Cannot deactivate the only active permission set for a role (system default can be used as fallback)

#### **3. Selection Logic**

When getting the active permission set for a role:
1. **Active permission set for the role** (`isactive: true`)
2. **Check parent role** (if role has `parentroleid`) - recursive
3. **System-wide default** (`isdefault: true`) - FALLBACK
4. **null** (no permissions - restricted access)

#### **4. New Endpoints**

- **GET /v1/permission-sets/role/:roleid** - Get all permission sets for a role
- **GET /v1/permission-sets/role/:roleid/active** - Get active permission set for a role (with selection logic)
- **GET /v1/permission-sets/preview** - Preview activation impact before activating
- **GET /v1/permission-sets/system-default-preview** - Preview system-wide default impact before setting

#### **5. System-Wide Default Rules**

- **`roleid: null` Required**: Only permission sets with `roleid: null` can be system-wide defaults
- **If `roleid` is `null`, `isdefault` must be `true`**: When creating/updating a permission set with `roleid: null`, `isdefault` must be `true`
- **If `isdefault` is `false`, `roleid` must be provided**: Role-specific permission sets cannot be system defaults
- **Only ONE System Default**: Setting a new system default automatically unsets the existing one

---

## 📦 Complete Example Payloads

### **Create System-Wide Default Permission Set**

```json
{
  "name": "System Default Permissions",
  "description": "Default permissions for roles without active permission sets",
  "roleid": null,
  "isactive": true,
  "isdefault": true,
  "permissions": [
    {
      "object": "products",
      "read": true,
      "create": false,
      "edit": false,
      "delete": false,
      "viewall": false
    },
    {
      "object": "dashboards",
      "read": true,
      "create": false,
      "edit": false,
      "delete": false
    }
  ]
}
```

### **Create Role-Specific Permission Set**

```json
{
  "name": "Manager Permission Set",
  "description": "Permissions for managers",
  "roleid": 3,
  "isactive": true,
  "isdefault": false,
  "permissions": [
    {
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
      "accesslevel": "own"
    }
  ]
}
```

---

## 🎨 UI Flow Guide: Create/Update Permission Set Form

### **Step-by-Step Implementation**

#### **1. Initialize Create Form**

When the user opens the **Create Permission Set** form:

1. **First, call the system-default-preview API:**
   ```typescript
   GET /v1/permission-sets/system-default-preview
   ```

2. **Check the response:**
   - **If `currentSystemDefault` is `null`**: No system default exists → Enable "isDefault" checkbox option
   - **If `currentSystemDefault` exists**: System default already exists → Disable/hide "isDefault" checkbox (set to `false`)

#### **2. Role Selection Dropdown**

**Build the role dropdown with the following logic:**

```typescript
// Pseudo-code for role dropdown
const buildRoleOptions = (systemDefaultPreview: SystemDefaultPreviewResponse) => {
  const roles = [...]; // Fetch all roles from GET /v1/roles
  
  const options = [];
  
  // Only add "Default (Null)" option if no system default exists
  if (systemDefaultPreview.data.currentSystemDefault === null) {
    options.push({
      value: null,
      label: "Default (Null)",
      isSystemDefault: true
    });
  }
  
  // Add all regular roles
  roles.forEach(role => {
    options.push({
      value: role.id,
      label: role.name,
      isSystemDefault: false
    });
  });
  
  return options;
};
```

**Important Rules:**
- **"Default (Null)" option**: Only show if `system-default-preview` returns `currentSystemDefault: null`
- **When "Default (Null)" is selected**: 
  - `roleid` = `null`
  - `isdefault` = `true` (automatically set, checkbox checked and disabled)
  - Show "isDefault" checkbox (checked, disabled)
- **When any regular role is selected**:
  - `roleid` = selected role ID
  - `isdefault` = `false` (automatically set)
  - Hide "isDefault" checkbox (not applicable for role-specific sets)

#### **3. Form State Management**

```typescript
interface PermissionSetFormState {
  name: string;
  description: string | null;
  roleid: number | null;
  isactive: boolean;
  isdefault: boolean;
  permissions: PermissionObject[];
}

// Initial state
const [formState, setFormState] = useState<PermissionSetFormState>({
  name: '',
  description: null,
  roleid: null,
  isactive: true,
  isdefault: false,
  permissions: []
});

// Handle role selection
const handleRoleChange = (selectedRoleId: number | null) => {
  if (selectedRoleId === null) {
    // "Default (Null)" selected
    setFormState(prev => ({
      ...prev,
      roleid: null,
      isdefault: true  // Auto-set to true
    }));
  } else {
    // Regular role selected
    setFormState(prev => ({
      ...prev,
      roleid: selectedRoleId,
      isdefault: false  // Auto-set to false
    }));
  }
};
```

#### **4. Conditional UI Rendering**

```typescript
// Show isDefault checkbox ONLY when:
// 1. System default preview returned null (no existing system default)
// 2. AND "Default (Null)" is selected in role dropdown
const showIsDefaultCheckbox = 
  systemDefaultPreview?.data.currentSystemDefault === null && 
  formState.roleid === null;

// Render checkbox
{showIsDefaultCheckbox && (
  <Checkbox
    checked={formState.isdefault}
    disabled={true}  // Always disabled when shown (auto-set to true)
    label="System-Wide Default"
    helpText="This permission set will be used as fallback for roles without active permission sets"
  />
)}
```

#### **5. Update Form Flow**

For **Update Permission Set** form:

1. **Load existing permission set data**
2. **Call system-default-preview API** (same as create)
3. **Pre-populate form:**
   - If `roleid === null`: Select "Default (Null)" option, `isdefault` = `true`
   - If `roleid !== null`: Select the role, `isdefault` = `false`
4. **Apply same conditional logic** as create form

#### **6. Validation Before Submit**

```typescript
const validateForm = (formState: PermissionSetFormState): boolean => {
  // Rule 1: If roleid is null, isdefault MUST be true
  if (formState.roleid === null && formState.isdefault !== true) {
    showError('System default permission sets must have isdefault set to true');
    return false;
  }
  
  // Rule 2: If isdefault is false, roleid must be provided
  if (formState.isdefault === false && !formState.roleid) {
    showError('Role-specific permission sets must have a role selected');
    return false;
  }
  
  // Rule 3: At least one permission required
  if (!formState.permissions || formState.permissions.length === 0) {
    showError('At least one permission is required');
    return false;
  }
  
  return true;
};
```

#### **7. Complete Example: React Component**

```typescript
import { useState, useEffect } from 'react';

const PermissionSetForm = ({ mode = 'create', permissionSetId }: { mode: 'create' | 'update', permissionSetId?: number }) => {
  const [formState, setFormState] = useState<PermissionSetFormState>({
    name: '',
    description: null,
    roleid: null,
    isactive: true,
    isdefault: false,
    permissions: []
  });
  
  const [systemDefaultPreview, setSystemDefaultPreview] = useState<SystemDefaultPreviewResponse | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Step 1: Load system default preview and roles
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Call system-default-preview API
        const previewResponse = await fetch('/api/v1/permission-sets/system-default-preview');
        const previewData = await previewResponse.json();
        setSystemDefaultPreview(previewData);
        
        // Load roles
        const rolesResponse = await fetch('/api/v1/roles?limit=100');
        const rolesData = await rolesResponse.json();
        setRoles(rolesData.data);
        
        // If update mode, load existing permission set
        if (mode === 'update' && permissionSetId) {
          const psResponse = await fetch(`/api/v1/permission-sets/${permissionSetId}`);
          const psData = await psResponse.json();
          setFormState({
            name: psData.data.name,
            description: psData.data.description,
            roleid: psData.data.roleid,
            isactive: psData.data.isactive,
            isdefault: psData.data.isdefault,
            permissions: psData.data.permissions
          });
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [mode, permissionSetId]);

  // Build role options
  const roleOptions = [
    // Only add "Default (Null)" if no system default exists
    ...(systemDefaultPreview?.data.currentSystemDefault === null 
      ? [{ value: null, label: 'Default (Null)' }] 
      : []),
    // Add all regular roles
    ...roles.map(role => ({ value: role.id, label: role.name }))
  ];

  // Handle role selection
  const handleRoleChange = (selectedRoleId: number | null) => {
    if (selectedRoleId === null) {
      // "Default (Null)" selected
      setFormState(prev => ({
        ...prev,
        roleid: null,
        isdefault: true  // Auto-set to true
      }));
    } else {
      // Regular role selected
      setFormState(prev => ({
        ...prev,
        roleid: selectedRoleId,
        isdefault: false  // Auto-set to false
      }));
    }
  };

  // Show isDefault checkbox only when "Default (Null)" is selected
  const showIsDefaultCheckbox = 
    systemDefaultPreview?.data.currentSystemDefault === null && 
    formState.roleid === null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!validateForm(formState)) {
      return;
    }
    
    // Submit
    const url = mode === 'create' 
      ? '/api/v1/permission-sets'
      : `/api/v1/permission-sets/${permissionSetId}`;
    
    const method = mode === 'create' ? 'POST' : 'PUT';
    
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save permission set');
      }
      
      // Success - redirect or show success message
      console.log('Permission set saved successfully');
    } catch (error) {
      console.error('Error saving permission set:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formState.name}
        onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Permission Set Name"
        required
      />
      
      <select
        value={formState.roleid ?? ''}
        onChange={(e) => handleRoleChange(e.target.value ? parseInt(e.target.value) : null)}
        required
      >
        <option value="">Select Role</option>
        {roleOptions.map(option => (
          <option key={option.value ?? 'null'} value={option.value ?? ''}>
            {option.label}
          </option>
        ))}
      </select>
      
      {/* Show isDefault checkbox ONLY when "Default (Null)" is selected */}
      {showIsDefaultCheckbox && (
        <label>
          <input
            type="checkbox"
            checked={formState.isdefault}
            disabled={true}  // Always disabled (auto-set to true)
          />
          System-Wide Default
          <small>This permission set will be used as fallback for roles without active permission sets</small>
        </label>
      )}
      
      {/* Other form fields... */}
      
      <button type="submit">Save Permission Set</button>
    </form>
  );
};
```

---

## 🚀 Quick Start

1. **Copy TypeScript interfaces** to your frontend project

2. **Use the hooks** in your React components:
   ```typescript
   import { useRoles } from './hooks/useRoles';
   import { usePermissionSets } from './hooks/usePermissionSets';

   function RolesPage() {
     const { roles, loading, createRole, updateRole, deleteRole } = useRoles({ page: 1, limit: 10 });
     // Use roles, createRole, updateRole, deleteRole
   }

   function PermissionSetsPage() {
     const { permissionSets, loading, createPermissionSet, updatePermissionSet } = usePermissionSets({ roleid: 3 });
     // Use permissionSets, createPermissionSet, updatePermissionSet
   }
   ```

---

**All CRUD operations are ready to use!** 🎉
