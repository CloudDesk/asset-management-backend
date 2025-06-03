# Purchase Order Invoice API Documentation

## Overview

This document provides comprehensive documentation for the Purchase Order Invoice (`poinvoice`) API implementation, including the automated purchase order status management system.

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Data Schemas](#data-schemas)
3. [Business Logic](#business-logic)
4. [Authentication & Security](#authentication--security)
5. [Error Handling](#error-handling)
6. [Examples](#examples)
7. [Testing](#testing)
8. [Production Deployment](#production-deployment)

## API Endpoints

### Purchase Order Endpoints

#### POST /v1/purchaseorders
Creates a new purchase order with `po_status` automatically set to `in_progress`.

**Request:**
```json
{
  "ponumber": "FREAU-TEQIT-PO-0000000016",
  "prnumber": "FREAU-PR-00042",
  "companyname": "Aromazen",
  "companyaddress": "AAA, BB, C",
  "contactname": "Arom",
  "phonenumber": 9785463120,
  "gstnumber": "",
  "supplierid": 97,
  "subtotal": 1000,
  "discount": 0,
  "sgst": 6,
  "cgst": 6,
  "payabletaxamount": 120,
  "total": 2520,
  "product": {
    "items": [
      { "id": 1, "name": "Scented Candle - Rose", "quantity": 10 }
    ]
  },
  "supplieraddress": "12, aura street, Chennai, Tamil Nadu, India, 600130",
  "suppliercompanyname": "Fresh Aura",
  "supplierphonenumber": 8974563120,
  "suppliergstnumber": "33BZYPS9373N1ZZ",
  "instructions": "Deliver by next week",
  "paymentterms": "30",
  "comments": "",
  "suppliertype": "local"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Purchase order created successfully",
  "data": {
    "id": 16,
    "ponumber": "FREAU-TEQIT-PO-0000000016",
    "po_status": "in_progress",
    "total": 2520,
    "createddate": 1748888755,
    "modifieddate": 1748888755,
    // ... other fields
  }
}
```

### PO Invoice Endpoints

#### POST /v1/poinvoices
Creates a new PO invoice and automatically updates the associated purchase order status based on payment amounts.

**Business Logic:**
- If `paymentdata.paymentamount` > 0 and PO status is `in_progress`:
  - If total payments < PO total: Update PO status to `partially_fulfilled`
  - If total payments >= PO total: Update PO status to `fulfilled`
- Updates `poinvoice.purchaseorderstatus` to match the updated PO status

**Request:**
```json
{
  "id": 27,
  "invoiceamount": 1000,
  "ponumber": "FREAU-TEQIT-PO-0000000016",
  "invoicedate": 1748822400,
  "invoicenumber": "INV_0006",
  "invoiceurl": "https://storage.cloud.google.com/vyb-poinvoice-dev/FREAU-TEQIT-PO-0000000016/invoice_INV-0006.pdf",
  "paymentdata": [
    {
      "id": 2,
      "comments": "First payment",
      "paymentdate": "2025-06-03",
      "paymenttype": "Part Payment",
      "paymentamount": 1000,
      "paymentmethod": "banktransfer",
      "transactionid": "TXN123456",
      "receiptcomments": "Payment received"
    }
  ],
  "balanceamount": 1520,
  "iscreditpayment": false,
  "paymentduedate": 1751414400,
  "invoicestatus": "partial",
  "pototal": 2520,
  "transportationcharges": null,
  "exchangeamount": null,
  "customdutytaxamount": null,
  "suppliertype": "local",
  "customdutychallanurl": null,
  "billofentryurl": null
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Poinvoice created successfully",
  "data": {
    "id": 27,
    "ponumber": "FREAU-TEQIT-PO-0000000016",
    "invoiceamount": 1000,
    "paymentdata": [
      {
        "id": 2,
        "paymentamount": 1000,
        "paymentmethod": "banktransfer",
        "transactionid": "TXN123456"
      }
    ],
    "purchaseorderstatus": "partially_fulfilled",
    "createddate": 1748888755,
    "modifieddate": 1748888755,
    // ... other fields
  }
}
```

#### GET /v1/poinvoices
Retrieves all PO invoices with pagination and filtering support.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `ponumber`: Filter by PO number
- `invoicestatus`: Filter by invoice status
- `suppliertype`: Filter by supplier type
- `createddate`: Filter by creation date
- Any other field in the database can be used as a filter

**Response (200):**
```json
{
  "success": true,
  "message": "Poinvoices retrieved successfully",
  "data": [
    {
      "id": 27,
      "ponumber": "FREAU-TEQIT-PO-0000000016",
      "invoiceamount": 1000,
      "paymentdata": [...],
      "purchaseorderstatus": "partially_fulfilled",
      // ... all fields
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "filters": ["ponumber"],
    "total": 25,
    "filtered": true
  }
}
```

#### GET /v1/poinvoices/:id
Retrieves a single PO invoice by ID.

**Response (200):**
```json
{
  "success": true,
  "message": "Poinvoice retrieved successfully",
  "data": {
    "id": 27,
    "ponumber": "FREAU-TEQIT-PO-0000000016",
    // ... all fields
  }
}
```

## Data Schemas

### Purchase Order Schema
```typescript
interface PurchaseOrder {
  id: number;
  ponumber: string;
  prnumber: string;
  companyname: string;
  companyaddress: string;
  contactname: string;
  phonenumber: number;
  gstnumber: string;
  io_companyname: string;
  io_companyaddress: string;
  io_contactname: string;
  io_phonenumber: number | null;
  io_gstnumber: string;
  dt_companyname: string;
  dt_companyaddress: string;
  dt_contactname: string;
  dt_phonenumber: number | null;
  dt_gstnumber: string;
  supplierid: number;
  subtotal: number;
  discount: number;
  sgst: number;
  cgst: number;
  payabletaxamount: number;
  total: number;
  createddate: number; // Unix timestamp
  modifieddate: number; // Unix timestamp
  product: {
    items: Array<{
      id: number;
      name: string;
      quantity: number;
    }>;
  };
  po_status: string; // 'in_progress' | 'partially_fulfilled' | 'fulfilled'
  supplieraddress: string;
  suppliercompanyname: string;
  supplierphonenumber: number;
  suppliergstnumber: string;
  instructions: string;
  fileurl: string | null;
  invoiceurl: string | null;
  sameasinvoice: boolean;
  paymentterms: string;
  overduedate: number | null;
  comments: string;
  suppliertype: string;
}
```

### PO Invoice Schema
```typescript
interface POInvoice {
  id: number;
  invoiceamount: number;
  ponumber: string;
  invoicedate: number; // Unix timestamp
  invoicenumber: string;
  invoiceurl: string;
  paymentdata: Array<{
    id: number;
    comments: string;
    paymentdate: string; // YYYY-MM-DD
    paymenttype: string;
    paymentamount: number;
    paymentmethod: string;
    transactionid: string;
    receiptcomments: string;
  }>;
  createddate: number; // Unix timestamp
  modifieddate: number; // Unix timestamp
  balanceamount: number;
  iscreditpayment: boolean;
  paymentduedate: number; // Unix timestamp
  invoicestatus: string;
  pototal: number;
  purchaseorderstatus: string;
  transportationcharges: number | null;
  exchangeamount: number | null;
  customdutytaxamount: number | null;
  suppliertype: string;
  customdutychallanurl: string | null;
  billofentryurl: string | null;
}
```

## Business Logic

### Purchase Order Status Transitions

```
in_progress → partially_fulfilled → fulfilled
     ↑              ↑                   ↑
   Initial      First payment       Total payments
   status       > 0                 >= PO total
```

### Status Update Rules

1. **Purchase Order Creation:**
   - Always set `po_status` to `"in_progress"`

2. **PO Invoice Creation:**
   - Extract payment amount from `paymentdata`
   - Calculate total payments for the PO number
   - Only update status if current PO status is `"in_progress"`
   - If any payment amount > 0:
     - If total payments >= PO total: Set status to `"fulfilled"`
     - Else: Set status to `"partially_fulfilled"`
   - Update `poinvoice.purchaseorderstatus` to match PO status

3. **Atomic Operations:**
   - All status updates use database transactions
   - Ensure data consistency across tables

## Authentication & Security

### Input Validation

1. **SQL Injection Prevention:**
   - All queries use parameterized statements
   - Input validation on `ponumber`, `invoicenumber`
   - Sanitize all text inputs

2. **XSS Prevention:**
   - Sanitize `comments`, `receiptcomments`, `instructions`
   - Escape HTML in response data
   - Validate URL formats for `invoiceurl`, `customdutychallanurl`

3. **Data Validation:**
   - Positive numbers for amounts
   - Valid date formats
   - Required field validation
   - Maximum length validation

### Rate Limiting
```javascript
// Example rate limiting configuration
{
  "windowMs": 900000, // 15 minutes
  "max": 100, // Limit each IP to 100 requests per windowMs
  "message": "Too many requests from this IP"
}
```

## Error Handling

### HTTP Status Codes

- **200**: Success (GET, PUT)
- **201**: Created (POST)
- **400**: Bad Request (validation errors, malformed data)
- **401**: Unauthorized (missing/invalid authentication)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found (resource doesn't exist)
- **409**: Conflict (duplicate data)
- **422**: Unprocessable Entity (business logic errors)
- **429**: Too Many Requests (rate limiting)
- **500**: Internal Server Error

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "details": "Detailed error information",
  "statusCode": 400,
  "timestamp": "2025-01-27T10:30:00.000Z",
  "path": "/v1/poinvoices",
  "errors": [
    {
      "field": "paymentamount",
      "message": "Payment amount must be positive"
    }
  ]
}
```

## Examples

### Complete Workflow Example

1. **Create Purchase Order:**
```bash
curl -X POST http://localhost:5600/v1/purchaseorders \
  -H "Content-Type: application/json" \
  -d '{
    "ponumber": "FREAU-TEQIT-PO-0000000016",
    "total": 2520,
    "supplierid": 97,
    "companyname": "Aromazen"
  }'
```

2. **Create First Invoice (Partial Payment):**
```bash
curl -X POST http://localhost:5600/v1/poinvoices \
  -H "Content-Type: application/json" \
  -d '{
    "ponumber": "FREAU-TEQIT-PO-0000000016",
    "invoiceamount": 1000,
    "paymentdata": [{
      "paymentamount": 1000,
      "paymentmethod": "banktransfer"
    }]
  }'
```

3. **Create Final Invoice (Full Payment):**
```bash
curl -X POST http://localhost:5600/v1/poinvoices \
  -H "Content-Type: application/json" \
  -d '{
    "ponumber": "FREAU-TEQIT-PO-0000000016",
    "invoiceamount": 1520,
    "paymentdata": [{
      "paymentamount": 1520,
      "paymentmethod": "banktransfer"
    }]
  }'
```

4. **Check Purchase Order Status:**
```bash
curl "http://localhost:5600/v1/purchaseorders?ponumber=FREAU-TEQIT-PO-0000000016"
```

## Testing

### Running Tests

1. **Install Dependencies:**
```bash
npm install axios
```

2. **Run Comprehensive Tests:**
```bash
node test_poinvoice_comprehensive.js
```

3. **Test Coverage:**
   - Purchase order creation with status validation
   - PO invoice creation with status updates
   - Partial and full payment scenarios
   - Input validation and security testing
   - Error handling and edge cases
   - Performance and concurrency testing

### Test Scenarios

| Test Case | Expected Result |
|-----------|----------------|
| Create PO | `po_status` = "in_progress" |
| PO Invoice with payment > 0 | PO status → "partially_fulfilled" |
| PO Invoice with total payments = PO total | PO status → "fulfilled" |
| Invalid ponumber | HTTP 400/404 |
| Duplicate ID | HTTP 409 |
| Negative payment amount | HTTP 400 |
| SQL injection attempt | Input sanitized/rejected |
| XSS payload | Input sanitized |
| Concurrent requests | All succeed |

## Production Deployment

### Environment Configuration

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/asset_management"

# Security
JWT_SECRET="your-secure-jwt-secret"
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL="info"
LOG_FORMAT="json"

# Performance
DB_POOL_SIZE=20
REQUEST_TIMEOUT=30000
```

### Performance Optimizations

1. **Database Indexes:**
```sql
CREATE INDEX idx_poinvoice_ponumber ON poinvoice(ponumber);
CREATE INDEX idx_poinvoice_created ON poinvoice(createddate);
CREATE INDEX idx_purchaseorder_status ON purchaseorder(po_status);
```

2. **Caching Strategy:**
```javascript
// Redis caching for frequently accessed data
const cacheKey = `po:${ponumber}`;
const cachedPO = await redis.get(cacheKey);
```

3. **Connection Pooling:**
```javascript
// Database connection pool configuration
{
  "min": 5,
  "max": 20,
  "idle": 30000,
  "acquire": 60000
}
```

### Monitoring & Logging

1. **Health Checks:**
```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = await checkDatabaseConnection();
  res.json({ status: 'healthy', database: dbStatus });
});
```

2. **Metrics Collection:**
   - Request duration
   - Error rates
   - Database query performance
   - Memory usage
   - API endpoint usage statistics

3. **Alerting:**
   - High error rates (>5%)
   - Slow response times (>2s)
   - Database connection issues
   - Memory/CPU threshold alerts

### Security Checklist

- ✅ Input validation and sanitization
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Rate limiting
- ✅ HTTPS enforcement
- ✅ Authentication middleware
- ✅ Request size limits
- ✅ Error message sanitization
- ✅ Database transaction security
- ✅ Audit logging

### Deployment Steps

1. **Pre-deployment:**
   - Run all tests
   - Database migration
   - Security scan
   - Performance testing

2. **Deployment:**
   - Blue-green deployment
   - Health check validation
   - Rollback procedure ready
   - Monitor error rates

3. **Post-deployment:**
   - Smoke tests
   - Performance monitoring
   - Log analysis
   - User acceptance testing

## Support

For issues or questions:
- Create GitHub issue
- Check API logs
- Review error responses
- Contact development team

---

**Last Updated:** January 27, 2025  
**Version:** 1.0.0  
**Status:** Production Ready 