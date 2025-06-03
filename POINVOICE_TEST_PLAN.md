# Purchase Order Invoice API Test Plan

## Overview

This document outlines the comprehensive test plan for the Purchase Order Invoice API implementation, covering all functional, security, performance, and edge case scenarios.

## Test Environment Setup

### Prerequisites
- Node.js application running on `http://localhost:5600`
- PostgreSQL database with proper schema
- Test data setup with valid suppliers and purchase orders
- Axios library for HTTP requests

### Test Data Requirements
- Valid purchase order with `ponumber: "FREAU-TEQIT-PO-0000000016"`
- Valid supplier with `id: 97`
- Test payment data with various amounts
- Security test payloads for injection testing

## Test Categories

### 1. Purchase Order Creation Tests

#### Test 1.1: Valid Purchase Order Creation
**Objective:** Verify that purchase orders are created with `po_status` set to `in_progress`

**Test Steps:**
1. Send POST request to `/v1/purchaseorders` with valid data
2. Verify response status is 201
3. Verify `po_status` field is set to `"in_progress"`
4. Verify all required fields are present in response

**Expected Result:**
- HTTP 201 Created
- `po_status` = `"in_progress"`
- All purchase order fields populated correctly

#### Test 1.2: Invalid Purchase Order Creation
**Objective:** Verify proper error handling for invalid data

**Test Steps:**
1. Send POST request with missing required fields
2. Send POST request with invalid data types
3. Send POST request with duplicate `ponumber`

**Expected Result:**
- HTTP 400 Bad Request for validation errors
- HTTP 409 Conflict for duplicate ponumber
- Clear error messages in response

### 2. PO Invoice Creation Tests

#### Test 2.1: Partial Payment Invoice
**Objective:** Verify PO status updates to `partially_fulfilled` on partial payment

**Test Steps:**
1. Create purchase order with total amount 2520
2. Create poinvoice with payment amount 1000
3. Verify poinvoice creation (HTTP 201)
4. Check purchase order status is updated to `partially_fulfilled`
5. Verify `poinvoice.purchaseorderstatus` matches PO status

**Expected Result:**
- HTTP 201 Created for poinvoice
- PO status updated to `"partially_fulfilled"`
- Poinvoice `purchaseorderstatus` = `"partially_fulfilled"`

#### Test 2.2: Full Payment Invoice
**Objective:** Verify PO status updates to `fulfilled` when total payments equal PO total

**Test Steps:**
1. Use existing PO with partial payment (1000 paid, 1520 remaining)
2. Create poinvoice with payment amount 1520
3. Verify poinvoice creation (HTTP 201)
4. Check purchase order status is updated to `fulfilled`
5. Verify total payments equal PO total

**Expected Result:**
- HTTP 201 Created for poinvoice
- PO status updated to `"fulfilled"`
- Total payments = PO total amount

#### Test 2.3: Zero Payment Invoice
**Objective:** Verify PO status remains unchanged for zero payment

**Test Steps:**
1. Create poinvoice with payment amount 0
2. Verify poinvoice creation (HTTP 201)
3. Check purchase order status remains `in_progress`

**Expected Result:**
- HTTP 201 Created for poinvoice
- PO status remains `"in_progress"`

#### Test 2.4: Invalid ponumber
**Objective:** Verify error handling for non-existent purchase orders

**Test Steps:**
1. Send POST request with invalid/non-existent ponumber
2. Verify appropriate error response

**Expected Result:**
- HTTP 400 Bad Request or 404 Not Found
- Clear error message about invalid ponumber

### 3. Data Validation Tests

#### Test 3.1: Required Field Validation
**Objective:** Verify all required fields are validated

**Test Steps:**
1. Send POST request without `ponumber`
2. Send POST request without `invoiceamount`
3. Send POST request without `paymentdata`

**Expected Result:**
- HTTP 400 Bad Request
- Specific error messages for missing fields

#### Test 3.2: Data Type Validation
**Objective:** Verify proper data type validation

**Test Steps:**
1. Send string value for numeric fields
2. Send negative values for amount fields
3. Send invalid date formats
4. Send malformed JSON in `paymentdata`

**Expected Result:**
- HTTP 400 Bad Request
- Type validation error messages

#### Test 3.3: Field Length Validation
**Objective:** Verify field length constraints

**Test Steps:**
1. Send extremely long strings for text fields
2. Send values exceeding database column limits
3. Test URL field format validation

**Expected Result:**
- HTTP 400 Bad Request for length violations
- Proper error messages

### 4. Security Tests

#### Test 4.1: SQL Injection Prevention
**Objective:** Verify protection against SQL injection attacks

**Test Steps:**
1. Send SQL injection payloads in `ponumber` field
2. Send SQL injection in `invoicenumber` field
3. Test various SQL injection techniques

**Test Payloads:**
- `"' OR 1=1--"`
- `"'; DROP TABLE poinvoice;--"`
- `"' UNION SELECT * FROM users--"`

**Expected Result:**
- Input sanitized or request rejected
- No database errors or data exposure

#### Test 4.2: XSS Prevention
**Objective:** Verify protection against cross-site scripting

**Test Steps:**
1. Send XSS payloads in `comments` field
2. Send XSS payloads in `receiptcomments` field
3. Send XSS payloads in `instructions` field

**Test Payloads:**
- `"<script>alert('xss')</script>"`
- `"<img src=x onerror=alert('xss')>"`
- `"javascript:alert('xss')"`

**Expected Result:**
- Input sanitized in response
- No script execution in client

#### Test 4.3: Input Sanitization
**Objective:** Verify proper input sanitization

**Test Steps:**
1. Send HTML tags in text fields
2. Send special characters and Unicode
3. Test file upload security (if applicable)

**Expected Result:**
- Dangerous content sanitized
- Safe content preserved

### 5. Business Logic Tests

#### Test 5.1: Payment Calculation Logic
**Objective:** Verify accurate payment amount calculations

**Test Steps:**
1. Create multiple invoices for same PO
2. Verify total payment calculation
3. Test edge cases (overpayment, exact payment)

**Expected Result:**
- Accurate payment totals
- Correct status transitions

#### Test 5.2: Status Transition Logic
**Objective:** Verify proper status transitions

**Test Steps:**
1. Test status change from `in_progress` to `partially_fulfilled`
2. Test status change from `partially_fulfilled` to `fulfilled`
3. Verify no status change when PO is already `fulfilled`

**Expected Result:**
- Correct status transitions
- No invalid status changes

#### Test 5.3: Concurrent Payment Processing
**Objective:** Verify thread-safe payment processing

**Test Steps:**
1. Send multiple concurrent payment requests for same PO
2. Verify data consistency
3. Check for race conditions

**Expected Result:**
- All payments processed correctly
- No data corruption
- Consistent final state

### 6. API Response Tests

#### Test 6.1: GET All Poinvoices
**Objective:** Verify retrieval of all poinvoices

**Test Steps:**
1. Send GET request to `/v1/poinvoices`
2. Verify response format and structure
3. Check pagination functionality
4. Test filtering capabilities

**Expected Result:**
- HTTP 200 OK
- Proper JSON structure
- All required fields present
- Working pagination

#### Test 6.2: GET Single Poinvoice
**Objective:** Verify retrieval of single poinvoice by ID

**Test Steps:**
1. Send GET request to `/v1/poinvoices/{id}`
2. Verify response contains all fields
3. Test with invalid ID

**Expected Result:**
- HTTP 200 OK for valid ID
- HTTP 404 Not Found for invalid ID
- Complete poinvoice data

#### Test 6.3: Response Field Completeness
**Objective:** Verify all expected fields are present in responses

**Required Fields:**
- `id`, `ponumber`, `invoiceamount`, `invoicedate`
- `invoicenumber`, `invoiceurl`, `paymentdata`
- `createddate`, `modifieddate`, `balanceamount`
- `iscreditpayment`, `paymentduedate`, `invoicestatus`
- `pototal`, `purchaseorderstatus`, `suppliertype`

**Test Steps:**
1. Create poinvoice and verify all fields in response
2. Retrieve poinvoice and verify field completeness
3. Check field data types and formats

**Expected Result:**
- All required fields present
- Correct data types
- Proper formatting

### 7. Performance Tests

#### Test 7.1: Response Time
**Objective:** Verify acceptable response times

**Test Steps:**
1. Measure response time for POST requests
2. Measure response time for GET requests
3. Test with varying payload sizes

**Expected Result:**
- POST requests < 2 seconds
- GET requests < 1 second
- Consistent performance

#### Test 7.2: Concurrent Load
**Objective:** Verify system handles concurrent requests

**Test Steps:**
1. Send multiple concurrent POST requests
2. Send multiple concurrent GET requests
3. Monitor system resources

**Expected Result:**
- All requests processed successfully
- No significant performance degradation
- Stable system resources

#### Test 7.3: Large Dataset Handling
**Objective:** Verify performance with large datasets

**Test Steps:**
1. Create large number of poinvoices
2. Test pagination with large datasets
3. Test filtering performance

**Expected Result:**
- Acceptable response times
- Proper pagination functionality
- Efficient database queries

### 8. Error Handling Tests

#### Test 8.1: Database Connection Errors
**Objective:** Verify graceful handling of database issues

**Test Steps:**
1. Simulate database connection failure
2. Simulate database timeout
3. Test transaction rollback scenarios

**Expected Result:**
- HTTP 500 Internal Server Error
- Proper error messages
- No data corruption

#### Test 8.2: Invalid Request Formats
**Objective:** Verify handling of malformed requests

**Test Steps:**
1. Send invalid JSON
2. Send requests with wrong Content-Type
3. Send oversized requests

**Expected Result:**
- HTTP 400 Bad Request
- Clear error messages
- No server crashes

#### Test 8.3: Rate Limiting
**Objective:** Verify rate limiting functionality

**Test Steps:**
1. Send requests exceeding rate limit
2. Verify rate limit headers
3. Test rate limit reset

**Expected Result:**
- HTTP 429 Too Many Requests
- Proper rate limit headers
- Rate limit resets correctly

### 9. Integration Tests

#### Test 9.1: End-to-End Workflow
**Objective:** Verify complete business workflow

**Test Steps:**
1. Create purchase order
2. Create partial payment invoice
3. Create final payment invoice
4. Verify final state

**Expected Result:**
- Complete workflow executes successfully
- All status transitions correct
- Data consistency maintained

#### Test 9.2: Database Transaction Integrity
**Objective:** Verify ACID properties

**Test Steps:**
1. Test transaction rollback on errors
2. Verify data consistency across tables
3. Test concurrent transaction handling

**Expected Result:**
- Transactions maintain ACID properties
- No partial updates on errors
- Consistent data state

### 10. Edge Cases and Boundary Tests

#### Test 10.1: Boundary Values
**Objective:** Test system behavior at boundaries

**Test Steps:**
1. Test with minimum/maximum numeric values
2. Test with empty and null values
3. Test with boundary dates

**Expected Result:**
- Proper handling of boundary values
- Appropriate validation messages
- No system crashes

#### Test 10.2: Unusual Scenarios
**Objective:** Test uncommon but valid scenarios

**Test Steps:**
1. Multiple invoices with zero amounts
2. Overpayment scenarios
3. Duplicate invoice numbers

**Expected Result:**
- System handles unusual scenarios gracefully
- Appropriate business logic applied
- Clear status and error messages

## Test Execution

### Automated Test Execution
```bash
# Run comprehensive test suite
node test_poinvoice_comprehensive.js

# Run specific test categories
npm test -- --grep "Purchase Order Creation"
npm test -- --grep "Security Tests"
npm test -- --grep "Performance Tests"
```

### Manual Test Execution
1. Set up test environment
2. Execute test cases in order
3. Document results and issues
4. Verify fixes and re-test

### Test Data Cleanup
- Clean up test data after each test run
- Reset database state for consistent testing
- Maintain test data isolation

## Success Criteria

### Functional Requirements
- ✅ Purchase orders created with `po_status = "in_progress"`
- ✅ PO status updates correctly based on payments
- ✅ All CRUD operations work correctly
- ✅ Proper error handling and validation

### Security Requirements
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Input sanitization
- ✅ Rate limiting

### Performance Requirements
- ✅ Response times within acceptable limits
- ✅ Concurrent request handling
- ✅ Scalable with large datasets

### Quality Requirements
- ✅ 100% test coverage for critical paths
- ✅ All edge cases handled
- ✅ Comprehensive error scenarios tested
- ✅ Production-ready code quality

## Test Reporting

### Test Results Format
```json
{
  "testSuite": "PO Invoice API",
  "totalTests": 45,
  "passed": 43,
  "failed": 2,
  "coverage": "95%",
  "executionTime": "120 seconds",
  "failedTests": [
    {
      "name": "Concurrent Payment Processing",
      "error": "Race condition detected",
      "severity": "high"
    }
  ]
}
```

### Continuous Integration
- Integrate tests with CI/CD pipeline
- Run tests on every code change
- Block deployments on test failures
- Generate test reports automatically

---

**Test Plan Version:** 1.0  
**Last Updated:** January 27, 2025  
**Status:** Ready for Execution 