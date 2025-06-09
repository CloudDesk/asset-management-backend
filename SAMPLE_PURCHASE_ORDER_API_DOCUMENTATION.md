# Sample Purchase Order API Documentation

## Overview

The Sample Purchase Order API provides a complete CRUD (Create, Read, Update, Delete) interface for managing sample purchase orders in the asset management system. This API follows the same architectural patterns and conventions as the existing purchase order and supplier routes.

## Table Schema

**Table: samplepurchaseorder**

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
/v1/samplepurchaseorders
```

### Authentication

All endpoints require authentication using the existing authentication middleware.

### Get All Sample Purchase Orders

**Endpoint:** `GET /v1/samplepurchaseorders`

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

### Get Sample Purchase Order by ID

**Endpoint:** `GET /v1/samplepurchaseorders/:id`

**Parameters:**
- `id`: Sample purchase order ID (required)

**Response:**
```json
{
  "success": true,
  "message": "Sample purchase order retrieved successfully",
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

### Create Sample Purchase Order

**Endpoint:** `POST /v1/samplepurchaseorders`

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
  "message": "Sample purchase order created successfully",
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

### Update Sample Purchase Order

**Endpoint:** `PUT /v1/samplepurchaseorders/:id`

**Parameters:**
- `id`: Sample purchase order ID (required)

**Request Body:**
```json
{
  "companyname": "Updated Company",
  "contactname": "Updated Contact",
  "modifiedby": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sample purchase order updated successfully",
  "data": {
    "id": 2,
    "companyname": "Updated Company",
    "contactname": "Updated Contact",
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
    "modifieddate": 1623456790,
    "createdby": "admin",
    "modifiedby": "admin"
  }
}
```

### Delete Sample Purchase Order

**Endpoint:** `DELETE /v1/samplepurchaseorders/:id`

**Parameters:**
- `id`: Sample purchase order ID (required)

**Response:**
```json
{
  "success": true,
  "message": "Sample purchase order deleted successfully"
}
```

### Get Sample Purchase Orders by Supplier

**Endpoint:** `GET /v1/samplepurchaseorders/supplier/:supplierId`

**Parameters:**
- `supplierId`: Supplier ID (required)

**Query Parameters:**
- `page`: Page number (optional, default: 1)
- `limit`: Number of items per page (optional, default: 10)

**Response:**
```json
{
  "success": true,
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

## Testing

A test script is provided to validate all CRUD operations. Run the script using Node.js:

```bash
node test_samplepurchaseorder.js
```

The test script performs the following operations:
1. Create a new sample purchase order
2. Retrieve all sample purchase orders
3. Retrieve a specific sample purchase order by ID
4. Update the sample purchase order
5. Get sample purchase orders filtered by supplier
6. Delete the sample purchase order

## Error Responses

The API follows the standard error response format:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid ID format. ID must be an integer.",
  "details": "The provided ID 'abc' is not a valid integer format.",
  "statusCode": 400
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Sample purchase order with ID 999 not found",
  "details": "The requested resource could not be found",
  "statusCode": 404
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "details": "Something went wrong on the server",
  "statusCode": 500
}
```

## Implementation Notes

The Sample Purchase Order API follows the same architectural patterns as other APIs in the system:

1. Uses the MVC pattern with separate controller, service, and route layers
2. Leverages dynamic database operations for flexible schema handling
3. Applies proper validation using Zod schemas
4. Follows consistent error handling patterns
5. Implements pagination and filtering
6. Provides appropriate documentation and testing tools 