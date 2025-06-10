# Sample Purchase Request API Documentation

## Overview

The Sample Purchase Request API provides a complete CRUD (Create, Read, Update, Delete) interface for managing sample purchase requests in the asset management system. This API follows the same architectural patterns and conventions as the existing purchase order and supplier routes.

## Table Schema

**Table: samplepurchaserequest**

| Column         | Type                   | Description                            |
|----------------|------------------------|----------------------------------------|
| id             | SERIAL PRIMARY KEY     | Unique identifier                      |
| companyname    | VARCHAR(255)           | Name of the company                    |
| contactname    | VARCHAR(255)           | Name of the contact person             |
| phonenumber    | BIGINT                 | Phone number                           |
| companymail    | VARCHAR(255)           | Company email address                  |
| gstnumber      | VARCHAR(50)            | GST number                             |
| companyaddress | TEXT                   | Company address                        |
| supplierid     | INTEGER                | Foreign key to supplier table          |
| items          | JSONB                  | Array of items with id, name, quantity |
| createddate    | TIMESTAMP              | Creation timestamp                     |
| modifieddate   | TIMESTAMP              | Last modification timestamp            |
| createdby      | VARCHAR(255)           | User who created the record            |
| modifiedby     | VARCHAR(255)           | User who last modified the record      |

## API Endpoints

### Base URL

```
/v1/samplepurchaserequests
```

### Authentication

All endpoints require authentication using the existing authentication middleware.

### Get All Sample Purchase Requests

**Endpoint:** `GET /v1/samplepurchaserequests`

**Query Parameters:**
- `page`: Page number (optional, default: 1)
- `limit`: Number of items per page (optional, default: 10)
- Filter parameters: Any column name can be used as a filter parameter

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "companyname": "Sample Company",
      "contactname": "John Doe",
      "phonenumber": 9876543210,
      "companymail": "sample@example.com",
      "gstnumber": "GST12345",
      "companyaddress": "123 Sample Street",
      "supplierid": 1,
      "items": [
        {
          "id": 1,
          "name": "Item 1",
          "quantity": 5
        }
      ],
      "createddate": 1623456789,
      "modifieddate": 1623456789,
      "createdby": "admin",
      "modifiedby": "admin"
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
    "filters": [],
    "total": 1,
    "filtered": false
  }
}
```

### Get Sample Purchase Request by ID

**Endpoint:** `GET /v1/samplepurchaserequests/:id`

**Parameters:**
- `id`: Sample purchase request ID (required)

**Response:**
```json
{
  "success": true,
  "message": "Sample purchase request retrieved successfully",
  "data": {
    "id": 1,
    "companyname": "Sample Company",
    "contactname": "John Doe",
    "phonenumber": 9876543210,
    "companymail": "sample@example.com",
    "gstnumber": "GST12345",
    "companyaddress": "123 Sample Street",
    "supplierid": 1,
    "items": [
      {
        "id": 1,
        "name": "Item 1",
        "quantity": 5
      }
    ],
    "createddate": 1623456789,
    "modifieddate": 1623456789,
    "createdby": "admin",
    "modifiedby": "admin"
  }
}
```

### Create Sample Purchase Request

**Endpoint:** `POST /v1/samplepurchaserequests`

**Request Body:**
```json
{
  "companyname": "New Sample Company",
  "contactname": "Jane Smith",
  "phonenumber": 9876543210,
  "companymail": "new@example.com",
  "gstnumber": "GST54321",
  "companyaddress": "456 New Street",
  "supplierid": 2,
  "items": [
    {
      "id": 2,
      "name": "New Item",
      "quantity": 10
    }
  ],
  "createdby": "admin",
  "modifiedby": "admin"
}
```

**Required Fields:**
- `companyname`
- `contactname`
- `phonenumber`
- `companymail`
- `gstnumber`
- `companyaddress`
- `supplierid`
- `items`
- `createdby`
- `modifiedby`

**Response:**
```json
{
  "success": true,
  "message": "Sample purchase request created successfully",
  "data": {
    "id": 2,
    "companyname": "New Sample Company",
    "contactname": "Jane Smith",
    "phonenumber": 9876543210,
    "companymail": "new@example.com",
    "gstnumber": "GST54321",
    "companyaddress": "456 New Street",
    "supplierid": 2,
    "items": [
      {
        "id": 2,
        "name": "New Item",
        "quantity": 10
      }
    ],
    "createddate": 1623456789,
    "modifieddate": 1623456789,
    "createdby": "admin",
    "modifiedby": "admin"
  }
}
```

### Update Sample Purchase Request

**Endpoint:** `PUT /v1/samplepurchaserequests/:id`

**Parameters:**
- `id`: Sample purchase request ID (required)

**Request Body:**
```json
{
  "companyname": "Updated Sample Company",
  "contactname": "John Updated",
  "phonenumber": 9876543211,
  "companymail": "updated@example.com",
  "gstnumber": "GST99999",
  "companyaddress": "789 Updated Street",
  "supplierid": 3,
  "items": [
    {
      "id": 3,
      "name": "Updated Item",
      "quantity": 15
    }
  ],
  "modifiedby": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sample purchase request updated successfully",
  "data": {
    "id": 1,
    "companyname": "Updated Sample Company",
    "contactname": "John Updated",
    "phonenumber": 9876543211,
    "companymail": "updated@example.com",
    "gstnumber": "GST99999",
    "companyaddress": "789 Updated Street",
    "supplierid": 3,
    "items": [
      {
        "id": 3,
        "name": "Updated Item",
        "quantity": 15
      }
    ],
    "createddate": 1623456789,
    "modifieddate": 1623456890,
    "createdby": "admin",
    "modifiedby": "admin"
  }
}
```

### Delete Sample Purchase Request

**Endpoint:** `DELETE /v1/samplepurchaserequests/:id`

**Parameters:**
- `id`: Sample purchase request ID (required)

**Response:**
```json
{
  "success": true,
  "message": "Sample purchase request deleted successfully"
}
```

### Get Sample Purchase Requests by Supplier

**Endpoint:** `GET /v1/samplepurchaserequests/supplier/:supplierId`

**Parameters:**
- `supplierId`: Supplier ID (required)

**Query Parameters:**
- `page`: Page number (optional, default: 1)
- `limit`: Number of items per page (optional, default: 10)

**Response:**
```json
{
  "success": true,
  "message": "Sample purchase requests by supplier retrieved successfully",
  "data": {
    "supplierId": "1",
    "data": [
      {
        "id": 1,
        "companyname": "Sample Company",
        "contactname": "John Doe",
        "phonenumber": 9876543210,
        "companymail": "sample@example.com",
        "gstnumber": "GST12345",
        "companyaddress": "123 Sample Street",
        "supplierid": 1,
        "items": [
          {
            "id": 1,
            "name": "Item 1",
            "quantity": 5
          }
        ],
        "createddate": 1623456789,
        "modifieddate": 1623456789,
        "createdby": "admin",
        "modifiedby": "admin"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "details": "Invalid input data",
  "statusCode": 400
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Sample purchase request with ID 123 not found",
  "details": "The requested resource could not be found",
  "statusCode": 404
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "details": "Error details",
  "statusCode": 500
}
```

## Testing

To test the API endpoints, you can use the provided test script:

```bash
node test_samplepurchaserequest.js
```

The test script includes comprehensive tests for:
- Creating sample purchase requests
- Retrieving all sample purchase requests with pagination and filtering
- Getting sample purchase requests by ID
- Updating sample purchase requests
- Deleting sample purchase requests
- Getting sample purchase requests by supplier
- Error handling for invalid data and non-existent records

## Features

- **Dynamic Filtering**: Filter by any column in the database
- **Pagination**: Built-in pagination support
- **Validation**: Comprehensive input validation using Zod schemas
- **Error Handling**: Consistent error responses
- **Authentication**: Integrated with existing authentication middleware
- **Logging**: Comprehensive logging for debugging and monitoring
- **Type Safety**: Full TypeScript support with proper type definitions

## Database Integration

The API uses dynamic database operations that automatically adapt to the database schema. This means:
- New columns added to the table are automatically supported
- Filtering works on any existing column
- The API is resilient to schema changes
- All database operations are logged for debugging

## Performance Considerations

- Uses efficient database queries with proper indexing
- Implements pagination to handle large datasets
- Includes query optimization for filtering operations
- Supports bulk operations where appropriate 