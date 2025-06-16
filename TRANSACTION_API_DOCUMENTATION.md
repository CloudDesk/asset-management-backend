# Transaction API Documentation

## Overview

The Transaction API provides comprehensive CRUD operations for managing financial transactions in the asset management system. It follows RESTful principles and includes advanced features like filtering, pagination, statistics, and robust error handling.

## Base URL
```
http://localhost:5600/v1/transactions
```

## Database Schema

The transaction table has the following structure:

```sql
model transaction {
  id                    Int      @default(autoincrement())
  transactionid         String   @id @db.VarChar(500)
  createddate           BigInt?
  modifieddate          BigInt?
  transactiondata       Json?
  userid                Int?
  productid             Int[]
  merchanttransactionid String?  @db.VarChar(500)
  name                  String?  @db.VarChar(500)
  amount                Decimal? @db.Decimal
  mobilenumber          BigInt?
  transactionfor        String?  @db.VarChar(255)
  orders                orders[]
}
```

## Authentication

Currently, the transaction endpoints are public. For production use, consider implementing authentication middleware.

## API Endpoints

### 1. Get All Transactions

**GET** `/v1/transactions`

Retrieve all transactions with pagination and filtering support.

#### Query Parameters
- `page` (string, optional): Page number (default: 1)
- `limit` (string, optional): Items per page (default: 10)
- `transactionid` (string, optional): Filter by transaction ID
- `userid` (string, optional): Filter by user ID
- `merchanttransactionid` (string, optional): Filter by merchant transaction ID
- `name` (string, optional): Filter by transaction name
- `amount` (string, optional): Filter by exact amount
- `amountMin` (string, optional): Filter by minimum amount
- `amountMax` (string, optional): Filter by maximum amount
- `mobilenumber` (string, optional): Filter by mobile number
- `transactionfor` (string, optional): Filter by transaction purpose
- `createdAfter` (string, optional): Filter by creation date (after timestamp)
- `createdBefore` (string, optional): Filter by creation date (before timestamp)

#### Example Request
```bash
curl -X GET "http://localhost:5600/v1/transactions?page=1&limit=10&amountMin=100&amountMax=500"
```

#### Example Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "transactionid": "TX-1234567890",
      "transactiondata": {
        "currency": "USD",
        "description": "Product purchase"
      },
      "userid": 1,
      "productid": [1, 2, 3],
      "merchanttransactionid": "MERCHANT-123",
      "name": "Product Purchase",
      "amount": 149.99,
      "mobilenumber": 1234567890,
      "transactionfor": "product_purchase",
      "createddate": 1640995200000,
      "modifieddate": 1640995200000
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "filters": ["amountMin", "amountMax"],
    "total": 1,
    "filtered": true
  }
}
```

### 2. Get Transaction by Database ID

**GET** `/v1/transactions/id/:id`

Retrieve a specific transaction by its database ID.

#### Parameters
- `id` (string, required): Database ID of the transaction

#### Example Request
```bash
curl -X GET "http://localhost:5600/v1/transactions/id/1"
```

### 3. Get Transaction by Transaction ID

**GET** `/v1/transactions/:transactionid`

Retrieve a specific transaction by its transaction ID.

#### Parameters
- `transactionid` (string, required): Transaction ID

#### Example Request
```bash
curl -X GET "http://localhost:5600/v1/transactions/TX-1234567890"
```

### 4. Get User Transactions

**GET** `/v1/transactions/user/:userId`

Retrieve all transactions for a specific user.

#### Parameters
- `userId` (string, required): User ID

#### Query Parameters
- `page` (string, optional): Page number
- `limit` (string, optional): Items per page

#### Example Request
```bash
curl -X GET "http://localhost:5600/v1/transactions/user/1?page=1&limit=5"
```

### 5. Get Transaction Statistics

**GET** `/v1/transactions/stats`

Get statistical information about transactions.

#### Query Parameters
- `userId` (string, optional): Filter statistics by user ID

#### Example Request
```bash
curl -X GET "http://localhost:5600/v1/transactions/stats?userId=1"
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "total": 150,
    "totalAmount": 45678.90,
    "byTransactionFor": {
      "product_purchase": 120,
      "subscription": 25,
      "refund": 5
    },
    "recentTransactions": [
      {
        "id": 1,
        "transactionid": "TX-1234567890",
        "amount": 149.99,
        "createddate": 1640995200000
      }
    ]
  },
  "message": "Transaction statistics retrieved successfully"
}
```

### 6. Create Transaction

**POST** `/v1/transactions`

Create a new transaction.

#### Request Body
```json
{
  "transactionid": "TX-1234567890",
  "transactiondata": {
    "currency": "USD",
    "description": "Product purchase"
  },
  "userid": 1,
  "productid": [1, 2, 3],
  "merchanttransactionid": "MERCHANT-123",
  "name": "Product Purchase",
  "amount": 149.99,
  "mobilenumber": 1234567890,
  "transactionfor": "product_purchase"
}
```

#### Required Fields
- `transactionid`: Unique transaction identifier

#### Example Request
```bash
curl -X POST "http://localhost:5600/v1/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionid": "TX-1234567890",
    "name": "Test Transaction",
    "amount": 99.99,
    "transactionfor": "test"
  }'
```

### 7. Update Transaction by Database ID

**PUT** `/v1/transactions/id/:id`

Update an existing transaction using its database ID.

#### Parameters
- `id` (string, required): Database ID

#### Request Body
```json
{
  "name": "Updated Transaction Name",
  "amount": 199.99,
  "transactionfor": "updated_purpose"
}
```

#### Example Request
```bash
curl -X PUT "http://localhost:5600/v1/transactions/id/1" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Transaction",
    "amount": 199.99
  }'
```

### 8. Update Transaction by Transaction ID

**PUT** `/v1/transactions/:transactionid`

Update an existing transaction using its transaction ID.

#### Parameters
- `transactionid` (string, required): Transaction ID

### 9. Upsert Transaction

**POST** `/v1/transactions/upsert`

Create a new transaction or update an existing one (upsert operation).

#### Request Body
```json
{
  "id": 1,
  "transactionid": "TX-1234567890",
  "name": "Upsert Transaction",
  "amount": 299.99,
  "transactionfor": "upsert_test"
}
```

#### Logic
- If `id` is provided: Update existing transaction by database ID
- If `transactionid` is provided: Update existing transaction by transaction ID or create new if not found
- Either `id` or `transactionid` must be provided

### 10. Delete Transaction by Database ID

**DELETE** `/v1/transactions/id/:id`

Delete a transaction using its database ID.

#### Parameters
- `id` (string, required): Database ID

#### Example Request
```bash
curl -X DELETE "http://localhost:5600/v1/transactions/id/1"
```

### 11. Delete Transaction by Transaction ID

**DELETE** `/v1/transactions/:transactionid`

Delete a transaction using its transaction ID.

#### Parameters
- `transactionid` (string, required): Transaction ID

## Error Handling

The API returns appropriate HTTP status codes and error messages:

### Success Responses
- `200 OK`: Successful GET, PUT, DELETE operations
- `201 Created`: Successful POST operations

### Error Responses
- `400 Bad Request`: Invalid request data or missing required fields
- `404 Not Found`: Transaction not found
- `500 Internal Server Error`: Server-side errors

#### Error Response Format
```json
{
  "success": false,
  "message": "Error message",
  "details": "Detailed error description",
  "statusCode": 400
}
```

## Data Types and Validation

### Field Types
- `id`: Integer (auto-increment)
- `transactionid`: String (max 500 chars, required for creation)
- `transactiondata`: JSON object (optional)
- `userid`: Positive integer (optional)
- `productid`: Array of positive integers (optional)
- `merchanttransactionid`: String (max 500 chars, optional)
- `name`: String (max 500 chars, optional)
- `amount`: Number or string (optional)
- `mobilenumber`: Number (optional)
- `transactionfor`: String (max 255 chars, optional)
- `createddate`: Number (timestamp, auto-generated)
- `modifieddate`: Number (timestamp, auto-updated)

### Validation Rules
- `transactionid` is required for creating new transactions
- `userid` must be a positive integer if provided
- `productid` must be an array of positive integers if provided
- All string fields have maximum length validations
- Numeric fields are properly typed and validated

## Advanced Features

### Filtering
- **Exact Match**: Filter by exact values (e.g., `userid=1`)
- **Range Filtering**: Use `amountMin` and `amountMax` for amount ranges
- **Date Filtering**: Use `createdAfter` and `createdBefore` for date ranges
- **Multiple Filters**: Combine multiple filters for complex queries

### Pagination
- Default page size: 10 items
- Maximum recommended page size: 100 items
- Includes pagination metadata in responses

### Dynamic Field Support
- API supports additional fields beyond the schema
- Uses `passthrough()` validation for flexibility
- All fields are properly formatted in responses

## Testing

### Running Tests
```bash
# Make the test script executable
chmod +x test_transactions.sh

# Run comprehensive tests
./test_transactions.sh

# Or run directly with Node.js
node test_transactions_comprehensive.js
```

### Test Coverage
The test suite covers:
- ✅ Health check endpoint
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Filtering and pagination
- ✅ Error handling and validation
- ✅ Performance testing
- ✅ Edge cases and boundary conditions

## Performance Considerations

- **Indexing**: Consider adding indexes on frequently queried fields
- **Pagination**: Always use pagination for large datasets
- **Filtering**: Use specific filters to reduce result sets
- **Caching**: Consider implementing caching for frequently accessed data

## Security Considerations

- **Input Validation**: All inputs are validated using Zod schemas
- **SQL Injection**: Protected by Prisma ORM
- **Rate Limiting**: Consider implementing rate limiting for production
- **Authentication**: Implement proper authentication for sensitive operations

## Production Deployment

### Environment Variables
Ensure the following environment variables are configured:
- `DATABASE_URL`: Database connection string
- `NODE_ENV`: Set to 'production'
- `LOG_LEVEL`: Appropriate logging level

### Monitoring
- Monitor API response times
- Track error rates and types
- Set up alerts for critical failures
- Log all transaction operations for audit trails

## API Versioning

Current version: v1
- All endpoints are prefixed with `/v1/`
- Backward compatibility maintained within major versions
- Breaking changes will increment the major version

## Support and Maintenance

For issues or questions:
1. Check the test suite for examples
2. Review error messages and status codes
3. Ensure proper request formatting
4. Verify database connectivity and schema

---

*Last updated: December 2024*
*API Version: 1.0.0* 