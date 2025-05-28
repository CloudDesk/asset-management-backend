# Asset Management Backend

A production-grade Node.js API backend built with Fastify, TypeScript, and Prisma ORM for PostgreSQL.

## 🚀 Features

- **Fast & Scalable**: Built with Fastify for high performance
- **Type-Safe**: Full TypeScript support with strict type checking
- **Database**: PostgreSQL with Prisma ORM for type-safe database operations
- **Safe Schema Evolution**: Graceful handling of missing database fields during development
- **Dynamic Fields**: Support for dynamic fields in products and stocks
- **Pagination**: Built-in pagination for all list endpoints
- **Filtering**: Advanced filtering capabilities for all entities
- **Validation**: Request/response validation with Zod schemas
- **Documentation**: Auto-generated Swagger/OpenAPI documentation
- **Error Handling**: Comprehensive error handling and logging
- **Environment Config**: Centralized environment configuration with validation

## 📦 Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Documentation**: Swagger/OpenAPI
- **Logging**: Pino

## 🏗️ Project Structure

```
src/
├── config/
│   ├── env.ts                  # Environment configuration with Zod validation
│   └── dynamicFieldConfig.ts   # Dynamic fields and picklist configuration
├── controllers/
│   ├── product.controller.ts   # Product CRUD operations
│   ├── stock.controller.ts     # Stock CRUD operations
│   └── picklist.controller.ts  # Picklist CRUD operations
├── models/
│   └── prisma.ts              # Prisma client singleton
├── routes/
│   ├── index.ts               # Main route registration
│   ├── product.route.ts       # Product routes
│   ├── stock.route.ts         # Stock routes
│   └── picklist.route.ts      # Picklist routes
├── schemas/
│   ├── product.schema.ts      # Product validation schemas
│   ├── stock.schema.ts        # Stock validation schemas
│   └── picklist.schema.ts     # Picklist validation schemas
├── services/
│   ├── product.service.ts     # Product business logic
│   ├── stock.service.ts       # Stock business logic
│   └── picklist.service.ts    # Picklist business logic
├── utils/
│   ├── pagination.ts          # Pagination utilities
│   ├── filterBuilder.ts       # Query filter builders
│   └── picklistUtils.ts       # Picklist utilities
├── plugins/
│   ├── db.ts                  # Database plugin
│   └── swagger.ts             # Swagger documentation plugin
├── server.ts                  # Fastify server setup
└── index.ts                   # Application entry point
```

## 🛠️ Setup & Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

### 1. Clone and Install

```bash
git clone <repository-url>
cd asset-management-backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/asset_management
PORT=3000
NODE_ENV=development
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed the database with sample data
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/health`

## 🔗 API Endpoints

### Products
- `GET /v1/products` - List products with pagination and filtering
- `GET /v1/products/:id` - Get product by ID
- `POST /v1/products` - Create new product
- `PUT /v1/products/:id` - Update product
- `DELETE /v1/products/:id` - Delete product
- `POST /v1/products/upsert` - Create or update product

### Stocks
- `GET /v1/stocks` - List stocks with pagination and filtering
- `GET /v1/stocks/:id` - Get stock by ID
- `POST /v1/stocks` - Create new stock
- `PUT /v1/stocks/:id` - Update stock
- `DELETE /v1/stocks/:id` - Delete stock
- `POST /v1/stocks/upsert` - Create or update stock
- `PATCH /v1/stocks/:id/quantities` - Update stock quantities only

### Picklists
- `GET /v1/picklists` - List picklists with pagination and filtering
- `GET /v1/picklists/by-type?type=PRODUCT_STATUS` - Get picklists by type
- `GET /v1/picklists/:id` - Get picklist by ID
- `POST /v1/picklists` - Create new picklist item
- `PUT /v1/picklists/:id` - Update picklist item
- `DELETE /v1/picklists/:id` - Delete picklist item
- `PATCH /v1/picklists/:id/toggle` - Toggle picklist active status
- `POST /v1/picklists/reorder` - Reorder picklist items

## 🔍 Query Parameters

### Pagination
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)

### Product Filters
- `name` - Filter by product name
- `category` - Filter by category
- `status` - Filter by status
- `minPrice` / `maxPrice` - Price range filter
- `minStock` / `maxStock` - Stock quantity filter
- `createdAfter` / `createdBefore` - Date range filter

### Stock Filters
- `productId` - Filter by product ID
- `batchNumber` - Filter by batch number
- `warehouseLocation` - Filter by warehouse location
- `minQuantity` / `maxQuantity` - Quantity range filter
- `minAvailable` / `maxAvailable` - Available quantity range filter

## 🎯 Dynamic Fields

Both products and stocks support dynamic fields that can be added to requests:

### Product Dynamic Fields
- `brand`, `model`, `color`, `size`, `weight`
- `dimensions`, `material`, `warranty`, `tags`, `notes`
- `customField1` through `customField5`

### Stock Dynamic Fields
- `supplier`, `purchasePrice`, `expiryDate`, `manufacturingDate`
- `qualityGrade`, `notes`
- `customField1` through `customField3`

Example request with dynamic fields:
```json
{
  "name": "iPhone 15",
  "category": "electronics",
  "price": 999.99,
  "status": "active",
  "brand": "Apple",
  "model": "iPhone 15",
  "color": "Blue",
  "warranty": "1 year"
}
```

## 🗄️ Database Schema

### Product
- Core fields: `id`, `name`, `description`, `category`, `price`, `status`
- Computed fields: `totalStockQuantity`, `totalStockAvailable`, `totalStockSold`
- Dynamic fields: JSON field for flexible attributes

### Stock
- Core fields: `id`, `productId`, `batchNumber`, `warehouseLocation`
- Quantities: `quantity`, `availableQuantity`, `soldQuantity`
- Dynamic fields: JSON field for flexible attributes

### Picklist
- Generic enum table for dropdown values
- Fields: `type`, `table`, `field`, `label`, `value`, `isActive`, `ordering`

## 🛡️ Dynamic Schema Discovery

**Important**: This API dynamically discovers your database schema at runtime and adapts to whatever columns exist.

### Behavior:
- **Schema Discovery**: Automatically discovers available columns in your database tables
- **Dynamic Queries**: Only queries columns that actually exist
- **Graceful Handling**: Works with any database schema state
- **Real-time Adaptation**: Adapts to schema changes without code modifications
- **Flexible Filtering**: Supports both camelCase and snake_case column names
- **Universal Compatibility**: Works with any PostgreSQL database structure

### How It Works:
1. **Column Discovery**: Queries `information_schema.columns` to discover available columns
2. **Smart Filtering**: Only includes existing columns in database operations
3. **Flexible Queries**: Handles both `productId` and `product_id` naming conventions
4. **Caching**: Caches schema information for 5 minutes to improve performance
5. **Error Recovery**: Gracefully handles missing columns and tables

### API Behavior:
- **GET without filters**: Returns `SELECT * FROM table` equivalent - all records with all available columns
- **GET with filters**: Applies filters using flexible column matching (tries both camelCase and snake_case)
- **POST/PUT**: Accepts any fields, only uses those that exist in the database
- **Automatic Adaptation**: If you add columns to your database, the API immediately starts using them

### Debug Endpoints (Development Only):
- `GET /debug/tables` - List all tables in your database
- `GET /debug/tables/:tableName/columns` - Get columns for a specific table
- `GET /debug/schema` - View cached schema information
- `POST /debug/schema/clear` - Clear schema cache

### Benefits:
- ✅ **Works with ANY database schema** - No configuration needed
- ✅ **Zero setup** - Just point to your database and it works
- ✅ **Real-time discovery** - Adapts to schema changes automatically
- ✅ **Performance optimized** - Caches schema information
- ✅ **Development friendly** - Debug endpoints to inspect your schema
- ✅ **Flexible naming** - Supports both camelCase and snake_case
- ✅ **Universal queries** - `SELECT *` behavior when no filters applied

### Example Usage:
```bash
# See what tables exist in your database
curl http://localhost:3000/debug/tables

# See what columns exist in your product table
curl http://localhost:3000/debug/tables/product/columns

# Get all products (equivalent to SELECT * FROM product)
curl http://localhost:3000/v1/products

# Filter products (works with any column names you have)
curl "http://localhost:3000/v1/products?name=iPhone&category=electronics"

# Create product with any fields (only existing columns will be used)
curl -X POST http://localhost:3000/v1/products \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Product", "any_field": "any_value", "custom_column": "data"}'

# Works with both naming conventions
curl -X POST http://localhost:3000/v1/products \
  -H "Content-Type: application/json" \
  -d '{"product_name": "Test", "product_price": 99.99}'
```

The API will automatically work with whatever columns exist in your database!

## 🚀 Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables

Set the following environment variables in production:

```env
DATABASE_URL=postgresql://user:password@host:port/database
PORT=3000
NODE_ENV=production
```

## 🏗️ Architecture & Development

For detailed information about the architecture, adding new routes, and development guidelines, see:

**[📖 Architecture Guide](./README_ARCHITECTURE.md)**

This guide covers:
- Clean architecture patterns
- Adding new routes and controllers
- Extending filter builders and pagination
- Error handling best practices
- Logging guidelines
- Testing strategies

## 🧪 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with sample data
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors

### Code Style

The project uses ESLint with TypeScript rules for code consistency.

## 📄 License

ISC License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For questions or issues, please open an issue on the repository.

## 🔍 Dynamic Filtering System

The API now supports **universal dynamic filtering** on all endpoints. You can filter by any field that exists in your database, regardless of the Prisma schema definition.

### ✨ Key Features

- **Universal Field Support**: Filter by any column in your database
- **Accurate Counts**: Get correct totals for filtered results
- **Multiple Filter Types**: Exact match, wildcard search, range queries
- **Performance Optimized**: Uses proper WHERE clauses and database indexes
- **Schema Agnostic**: Works with any database structure

### 🚀 Usage Examples

#### Basic Filtering
```bash
# Filter stocks by PUC
GET /v1/stocks?puc=mp-nw-0000000025
# Returns: {"total": 4, "data": [...]}

# Filter products by category
GET /v1/products?category=new
# Returns: {"total": 24, "data": [...]}

# Filter by stock status
GET /v1/stocks?stockstatus=Available
# Returns: {"total": 10, "data": [...]}
```

#### Multiple Filters (AND Logic)
```bash
# Combine multiple filters
GET /v1/stocks?category=new&stockstatus=Available
# Returns: {"total": 10, "data": [...]}

# Filter by brand and model
GET /v1/products?brand=Samsung&model=Galaxy
```

#### Wildcard Search
```bash
# Search products starting with "Samsung"
GET /v1/stocks?productname=Samsung*
# Returns: {"total": 6, "data": [...]}

# Search any field with wildcards
GET /v1/products?model=*Pro*
```

#### Range Queries
```bash
# Price range filtering
GET /v1/products?minprice=100&maxprice=500

# Quantity range
GET /v1/stocks?minquantity=10&maxquantity=100
```

#### Case-Insensitive Search
```bash
# All string filters are case-insensitive
GET /v1/stocks?brand=samsung  # Matches "Samsung", "SAMSUNG", etc.
```

### 📊 Response Format

All filtered responses include metadata:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 4,
    "totalPages": 1
  },
  "meta": {
    "filters": ["puc"],
    "total": 4,
    "filtered": true
  }
}
```

### 🎯 Supported Endpoints

Dynamic filtering works on all main endpoints:

- `GET /v1/stocks` - Filter stock records
- `GET /v1/products` - Filter product records  
- `GET /v1/picklists` - Filter picklist records

### ⚡ Performance Benefits

- **Filtered queries**: 400-600ms (vs 2000ms+ unfiltered)
- **Accurate counts**: Only counts matching records
- **Index utilization**: Proper WHERE clauses enable database indexes
- **Reduced data transfer**: Smaller result sets

### 🔧 Technical Implementation

The system uses:
- **Runtime schema discovery**: Queries `information_schema.columns`
- **Dynamic WHERE clause building**: Parameterized queries for safety
- **Intelligent column mapping**: Handles both camelCase and snake_case
- **Type-aware filtering**: Different logic for strings, numbers, dates
- **Caching**: 30-minute TTL for schema information

### 🧪 Testing Filtering

Use the debug endpoint to test filters:

```bash
# Test any filter combination
GET /debug/test-filtering?puc=mp-nw-0000000025&category=new

# Response includes query performance
{
  "data": {
    "queryTime": "463ms",
    "filters": ["puc", "category"],
    "total": 4,
    "returned": 4
  }
}
``` 