# Purchase Order Status Update Testing Suite

## Quick Start

This test suite provides comprehensive testing for the Purchase Order Status Update Logic API (`/v1/poinvoices/`). 

### Prerequisites

1. **Server Running**: Ensure your API server is running on `http://localhost:5600`
2. **Database Ready**: Database should be migrated and seeded with test data
3. **Dependencies**: Install required packages: `npm install axios crypto`

### Running Tests

**Quick Smoke Test** (recommended first):
```bash
./run_poinvoice_tests.sh quick
```

**Full Comprehensive Test Suite**:
```bash
./run_poinvoice_tests.sh all
```

**Specific Test Scenarios**:
```bash
./run_poinvoice_tests.sh po-creation    # Test PO creation only
./run_poinvoice_tests.sh status-update  # Test status update logic
./run_poinvoice_tests.sh security      # Test security vulnerabilities
./run_poinvoice_tests.sh performance   # Test performance & concurrency
```

## Test Files Overview

### `test_poinvoice_status_update_comprehensive.js`
- **Purpose**: Main comprehensive test suite
- **Features**: 
  - Purchase Order creation testing
  - Status update logic (`in_progress` → `partially_fulfilled` → `fulfilled`)
  - Payment calculation verification
  - Error handling and security testing
  - Performance and concurrency testing
  - Detailed rectification steps for failures

### `run_poinvoice_tests.sh`
- **Purpose**: Easy test runner script
- **Features**:
  - Multiple test modes (quick, comprehensive, specific scenarios)
  - Server availability checking
  - Colored output for better readability
  - Environment variable configuration

### `PURCHASE_ORDER_STATUS_TEST_PLAN.md`
- **Purpose**: Detailed test documentation
- **Contents**:
  - Test scenarios and expected results
  - Rectification steps for common failures
  - Code examples for fixes
  - Production readiness checklist

## Test Scenarios Covered

### 1. Purchase Order Creation
- ✅ Verify `po_status` is set to `"in_progress"`
- ✅ Verify `ponumber` is present (manual generation)
- ✅ Test invalid data handling
- ✅ Test duplicate prevention

### 2. Payment Processing & Status Updates
- ✅ **Partial Payment**: `po_status` → `"partially_fulfilled"`
- ✅ **Full Payment**: `po_status` → `"fulfilled"`
- ✅ **Zero Payment**: `po_status` remains `"in_progress"`
- ✅ **Data Consistency**: `poinvoice.purchaseorderstatus` matches `purchaseorder.po_status`

### 3. Error Handling
- ✅ Invalid `ponumber` (non-existent PO)
- ✅ Negative payment amounts
- ✅ Missing required fields
- ✅ Malformed payment data

### 4. Security Testing
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Input sanitization

### 5. Performance Testing
- ✅ Concurrent payment processing
- ✅ Race condition prevention
- ✅ Response time validation
- ✅ Database transaction atomicity

## Expected Results

### Successful Test Output Example:
```
🚀 Starting Comprehensive Purchase Order Status Update Tests
📊 Base URL: http://localhost:5600
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ [2025-01-27T10:30:15.123Z] TEST PASSED: Server Availability - Server is responding
✅ [2025-01-27T10:30:16.456Z] TEST PASSED: Purchase Order Creation - Status - Created PO FREAU-TEQIT-PO-1737982215-A1B2 with status in_progress
✅ [2025-01-27T10:30:17.789Z] TEST PASSED: Poinvoice Partial Payment - Creation - Created poinvoice ID 123
✅ [2025-01-27T10:30:18.012Z] TEST PASSED: Poinvoice Partial Payment - PO Status Update - PO status updated to partially_fulfilled
✅ [2025-01-27T10:30:19.345Z] TEST PASSED: Poinvoice Full Payment - PO Status Update - PO status updated to fulfilled

📋 TEST RESULTS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Total Tests: 15
✅ Passed: 15
❌ Failed: 0
📊 Success Rate: 100.0%

🎉 ALL TESTS PASSED! API is production-ready! 🎉
```

## Common Failure Scenarios & Solutions

### Problem: Purchase Order Status Not Updating

**Symptoms**:
```
❌ TEST FAILED: Poinvoice Partial Payment - PO Status Update - Status is in_progress, expected partially_fulfilled
```

**Solution**:
1. Check `src/services/poinvoice.service.ts` line 77
2. Verify purchase order exists for given `ponumber`
3. Ensure payment amount extraction is working correctly
4. Check database transaction completion

### Problem: Payment Amount Calculation Incorrect

**Symptoms**:
```
❌ TEST FAILED: Poinvoice Full Payment - PO Status Update - Status is partially_fulfilled, expected fulfilled
```

**Solution**:
1. Check `calculateTotalPaymentsForPO` method (line 48)
2. Verify decimal precision handling
3. Ensure all existing payments are being summed correctly
4. Check PO total amount comparison logic

### Problem: Data Consistency Issues

**Symptoms**:
```
❌ TEST FAILED: Poinvoice Partial Payment - Status Sync - Poinvoice status is in_progress, PO status is partially_fulfilled
```

**Solution**:
1. Check poinvoice creation transaction (lines 210-217)
2. Ensure `purchaseorderstatus` field is updated after PO status change
3. Verify transaction includes both PO and poinvoice updates

## Environment Configuration

### Environment Variables:
```bash
export API_BASE_URL=http://localhost:5600  # API server URL
export TEST_VERBOSE=true                   # Enable detailed logging
export TEST_CLEANUP=true                   # Clean up test data after tests
export TEST_TIMEOUT=15000                  # Request timeout in milliseconds
export TEST_RETRIES=3                      # Number of retries for failed requests
```

### Database Requirements:
- Supplier with ID 97 must exist
- Proper database schema (run `npx prisma migrate deploy`)
- Adequate permissions for test operations

## Production Readiness Checklist

Before deploying to production, ensure:

- [ ] All tests pass (100% success rate)
- [ ] No security vulnerabilities identified
- [ ] Performance meets requirements (<1s response time)
- [ ] Database indexes optimized for queries
- [ ] Error handling comprehensive
- [ ] Logging and monitoring configured
- [ ] Backup and recovery procedures tested

## Troubleshooting

### Test Environment Issues:

**Server Not Running**:
```bash
npm start
# or
node src/server.js
```

**Database Issues**:
```bash
npx prisma migrate deploy
npx prisma db seed
```

**Permission Issues**:
```bash
chmod +x run_poinvoice_tests.sh
```

### Common API Issues:

**404 Errors**: Check if routes are properly configured in `src/routes/`

**500 Errors**: Check application logs and database connection

**Validation Errors**: Verify request data matches schema requirements

## Support

For issues or questions about the test suite:

1. Check the test output for specific rectification steps
2. Review `PURCHASE_ORDER_STATUS_TEST_PLAN.md` for detailed guidance
3. Examine application logs for detailed error information
4. Verify database state and constraints

Remember: The goal is 1000% bug-free, production-ready API! 