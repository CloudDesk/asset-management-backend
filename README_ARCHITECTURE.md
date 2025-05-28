# Asset Management Backend - Architecture Guide

A production-grade Node.js API backend built with Fastify, TypeScript, and Prisma ORM featuring centralized error handling, logging, safe schema evolution, and clean architecture.

## 🏗️ Architecture Overview

This project follows a clean architecture pattern with clear separation of concerns:

```
src/
├── config/                 # Configuration and environment setup
│   ├── env.ts              # Environment variables with Zod validation
│   └── logger.ts           # Centralized Pino logger configuration
├── controllers/            # HTTP request handlers
├── services/              # Business logic layer
├── models/                # Database models and Prisma client
├── routes/                # Route definitions and API versioning
├── schemas/               # Request/response validation schemas
├── utils/                 # Utility functions and helpers
│   ├── safeDbOperations.ts # Safe database operations for schema evolution
│   ├── errorHandler.ts     # Centralized error handling
│   ├── pagination.ts       # Pagination utilities
│   └── filterBuilder.ts    # Query filter builders
├── plugins/               # Fastify plugins
├── server.ts              # Fastify server setup
└── index.ts               # Application entry point
```

## 🔧 Core Features

### Centralized Error Handling
- **Location**: `src/utils/errorHandler.ts`
- **Features**: 
  - Consistent error response format
  - Automatic error logging with context
  - Prisma error mapping
  - HTTP status code handling
  - Validation error formatting

### Centralized Logging
- **Location**: `src/config/logger.ts` & `src/plugins/logger.ts`
- **Features**:
  - Pino logger with pretty print for development
  - Request/response timing
  - Error stack trace logging
  - Structured logging with context

### Safe Database Operations
- **Location**: `src/utils/safeDbOperations.ts`
- **Features**:
  - Graceful handling of missing database fields
  - Input data filtering for unknown fields
  - Result processing for consistent API responses
  - Automatic field adoption when schema is updated
  - Comprehensive logging of ignored fields

### Response Format
All API responses follow this consistent format:

```typescript
// Success Response
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... } | null,
  "errors": null
}

// Error Response
{
  "success": false,
  "message": "User-friendly error message",
  "error": "ERROR_CODE",
  "errors": [...] | null
}
```

## 🛡️ Safe Schema Evolution

This system is designed for iterative development where the database schema evolves over time.

### How It Works

1. **Field Configuration**: Each model has a configuration in `SAFE_FIELD_CONFIGS`:
   ```typescript
   product: {
     coreFields: ['id', 'name', 'description', ...],      // Always exist
     optionalFields: ['totalStockQuantity', ...],         // May not exist yet
     dynamicFields: ['brand', 'model', 'color', ...]      // Stored in JSON
   }
   ```

2. **Input Filtering**: `safeFilterInputData()` filters incoming data:
   - Known fields → passed to database
   - Dynamic fields → stored in JSON
   - Unknown fields → ignored and logged

3. **Result Processing**: `safeProcessDbResult()` ensures consistent responses:
   - Missing optional fields → set to `null`
   - Missing dynamic fields → set to `null`
   - Maintains consistent API structure

4. **Error Handling**: `safePrismaOperation()` catches database errors:
   - Missing column errors → logged and handled gracefully
   - Other errors → re-thrown normally

### Benefits

- ✅ **Deploy Early**: API works even with incomplete schema
- ✅ **Iterative Development**: Add fields incrementally
- ✅ **Zero Downtime**: No API changes needed when schema evolves
- ✅ **Consistent Responses**: Always returns expected structure
- ✅ **Debugging**: Unknown fields are logged for review

### Example Usage

```typescript
// In service layer
async create(data: CreateProductInput & Record<string, any>) {
  // Filter input data safely
  const safeData = safeFilterInputData(data, 'product', 'create');
  
  // Perform database operation safely
  const product = await safePrismaOperation(
    () => prisma.product.create({ data: safeData }),
    'create',
    'product'
  );
  
  // Process result safely
  return safeProcessDbResult(product, 'product');
}
```

## 🚀 Adding New Routes and Controllers

### Step 1: Update Safe Field Configuration

First, add your new fields to the configuration in `src/utils/safeDbOperations.ts`:

```typescript
export const SAFE_FIELD_CONFIGS = {
  category: {  // New model
    coreFields: ['id', 'name', 'createdAt', 'updatedAt'],
    optionalFields: ['description', 'isActive'],
    dynamicFields: ['metadata', 'tags']
  }
};
```

### Step 2: Create Database Schema

Add your model to `prisma/schema.prisma`:

```prisma
model Category {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  @@map("category")  // Maps to your existing table
}
```

### Step 3: Create Service with Safe Operations

Create `src/services/category.service.ts`:

```typescript
import { 
  safeFilterInputData, 
  safeProcessDbResult, 
  safeProcessDbResults, 
  safePrismaOperation 
} from '../utils/safeDbOperations.js';

export class CategoryService {
  async create(data: Record<string, any>) {
    try {
      // Filter input data safely
      const safeData = safeFilterInputData(data, 'category', 'create');
      
      const category = await safePrismaOperation(
        () => prisma.category.create({ data: safeData }),
        'create',
        'category'
      );
      
      // Process result safely
      return safeProcessDbResult(category, 'category');
    } catch (error) {
      logger.error({ error, data }, 'Error in category create operation');
      throw error;
    }
  }

  async findMany(filters: any, page: number, limit: number) {
    try {
      const [categories, total] = await Promise.all([
        safePrismaOperation(
          () => prisma.category.findMany({ /* ... */ }),
          'findMany',
          'category'
        ),
        safePrismaOperation(
          () => prisma.category.count(),
          'count',
          'category'
        ),
      ]);

      const safeCategories = Array.isArray(categories) 
        ? safeProcessDbResults(categories, 'category') 
        : [];
      
      return createPaginationResult(safeCategories, total || 0, page, limit);
    } catch (error) {
      logger.error({ error }, 'Error in category findMany operation');
      throw error;
    }
  }
}
```

### Step 4: Create Controller

Controllers remain largely the same, using the response helpers:

```typescript
import { createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js';

export class CategoryController {
  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const category = await this.categoryService.create(request.body);
      const response = createSuccessResponse('Category created successfully', category);
      return reply.code(201).send(response);
    } catch (error) {
      const errorResponse = createErrorResponse('Failed to create category', 'CREATE_ERROR');
      return reply.code(400).send(errorResponse);
    }
  }
}
```

## 🔍 Field Evolution Workflow

### Adding New Fields

1. **Add to Configuration**: Update `SAFE_FIELD_CONFIGS` with new field
2. **Update Schema**: Add field to Prisma schema
3. **Run Migration**: `npm run db:migrate`
4. **Regenerate Client**: `npm run db:generate`
5. **Deploy**: Field is automatically available in API

### Field Types

- **Core Fields**: Always expected, will cause errors if missing
- **Optional Fields**: May not exist, returned as `null` if missing
- **Dynamic Fields**: Stored in JSON, flexible schema

### Monitoring

Check logs for field usage:
```bash
# See what fields are being ignored
grep "Safely ignored unknown fields" logs/app.log

# See database operation warnings
grep "Database field missing" logs/app.log
```

## 🧪 Testing Safe Operations

### Test Missing Fields

```typescript
// Test with extra fields (should be ignored)
const response = await request(app)
  .post('/api/v1/products')
  .send({
    name: 'Test Product',
    unknownField: 'should be ignored',
    futureField: 'will be used when schema is updated'
  });

// Response should succeed, unknown fields logged
expect(response.status).toBe(201);
```

### Test Missing Database Columns

```typescript
// Even if database column doesn't exist, API should work
const product = await productService.create({
  name: 'Test',
  nonExistentField: 'value'  // Safely ignored
});

expect(product.name).toBe('Test');
expect(product.nonExistentField).toBeUndefined();
```

## 📊 Monitoring and Debugging

### Log Levels

- **DEBUG**: Field filtering details, safe data transformations
- **INFO**: Successful operations, field adoptions
- **WARN**: Missing database fields, ignored operations
- **ERROR**: Actual errors that need attention

### Key Log Messages

```bash
# Field filtering
"Creating product with safe data filtering"

# Missing database fields
"Database field missing for product.create - continuing safely"

# Unknown fields
"Safely ignored unknown fields for product create"
```

## 🔧 Development Guidelines

### Safe Database Operations
- Always use `safeFilterInputData()` before database operations
- Always use `safeProcessDbResult()` after database operations
- Wrap Prisma calls with `safePrismaOperation()`
- Update field configurations when adding new fields

### Error Handling
- Use try/catch in all service methods
- Use `createSuccessResponse()` and `createErrorResponse()` helpers
- Let the centralized error handler manage Prisma and validation errors

### Logging
- Log field filtering operations at DEBUG level
- Log missing field warnings at WARN level
- Include relevant context in all log messages

## 🚀 Production Considerations

### Performance
- Field filtering adds minimal overhead
- Result processing is optimized for common cases
- Database operations are wrapped, not replaced

### Monitoring
- Monitor logs for frequently ignored fields
- Track missing field warnings
- Set up alerts for unexpected database errors

### Deployment
- Safe operations allow zero-downtime schema updates
- Deploy API changes before database migrations
- Roll back safely if needed

This architecture ensures your API remains stable and functional throughout the entire development lifecycle, from initial prototype to production deployment. 