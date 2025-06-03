# Purchase Order Status Update Logic - Comprehensive Test Plan

## Overview

This document outlines the comprehensive testing strategy for the Purchase Order Status Update Logic API (`/v1/poinvoices/`), ensuring 1000% bug-free, production-ready implementation.

## Test Objectives

1. **Purchase Order Creation**: Verify `po_status` is set to `in_progress` and `ponumber` handling
2. **Status Update Logic**: Test POST method updates `purchaseorder.po_status` based on payment amounts
3. **Data Consistency**: Verify `poinvoice.purchaseorderstatus` matches `purchaseorder.po_status`
4. **Comprehensive Validation**: Edge cases, security, performance, and error handling

## Current Implementation Analysis

### Key Findings from Codebase Review:

1. **PONumber Generation**: Manual (not database trigger-generated)
   - Current: `ponumber` provided in request body
   - Format: Client-generated (e.g., `FREAU-TEQIT-PO-0000000016`)
   - Location: `src/services/purchaseorder.service.ts`

2. **Status Update Logic**: Implemented in `src/services/poinvoice.service.ts`
   - Method: `updatePurchaseOrderStatus()`
   - Transaction: Uses Prisma `$transaction` for atomicity
   - Calculation: Sums existing payments + current payment

3. **Status Transitions**: 
   ```
   in_progress → partially_fulfilled → fulfilled
   ```

## Test Scenarios

### 1. Purchase Order Creation Tests

#### Test 1.1: Valid Purchase Order Creation
**Objective**: Verify PO creation with `po_status=in_progress`

**Test Steps**:
```javascript
const testPO = createTestPurchaseOrder();
const response = await POST('/v1/purchaseorders', testPO);
```

**Expected Results**:
- HTTP 201 Created
- `po_status` = `"in_progress"`
- `ponumber` present and unique

**Failure Rectification**:
```javascript
// File: src/services/purchaseorder.service.ts, Line ~96
const createData = {
  ...data,
  po_status: data.po_status || 'in_progress'  // Ensure default status
};
```

#### Test 1.2: PONumber Auto-Generation (Enhancement)
**Current State**: Manual ponumber required
**Enhancement Required**: Implement auto-generation

**Implementation Options**:

**Option A: Database Trigger**
```sql
CREATE OR REPLACE FUNCTION generate_ponumber()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ponumber IS NULL OR NEW.ponumber = '' THEN
        NEW.ponumber := 'FREAU-TEQIT-PO-' || LPAD(nextval('po_sequence')::text, 10, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_ponumber
    BEFORE INSERT ON purchaseorder
    FOR EACH ROW
    EXECUTE FUNCTION generate_ponumber();
```

**Option B: Service-Level Generation**
```javascript
// File: src/services/purchaseorder.service.ts
async create(data) {
  // Generate ponumber if not provided
  if (!data.ponumber) {
    const sequence = await this.getNextPOSequence();
    data.ponumber = `FREAU-TEQIT-PO-${String(sequence).padStart(10, '0')}`;
  }
  // ... rest of create logic
}
```

### 2. PO Invoice Creation Tests

#### Test 2.1: Partial Payment Status Update
**Objective**: Verify `po_status` updates to `partially_fulfilled`

**Test Data**:
```javascript
const poinvoice = {
  ponumber: "FREAU-TEQIT-PO-0000000015",
  invoiceamount: 1000,
  paymentdata: [{ paymentamount: 600 }], // Partial payment
  // ... other fields
};
```

**Expected Logic Flow**:
1. Extract payment amount: `600`
2. Calculate total payments: `existing + 600`
3. Compare with PO total: `2520`
4. Since `600 < 2520`: Set `po_status = "partially_fulfilled"`
5. Update `poinvoice.purchaseorderstatus = "partially_fulfilled"`

**Failure Rectification Steps**:

**Issue**: Status not updating
```javascript
// File: src/services/poinvoice.service.ts
// Check Line 77: Ensure PO exists
const purchaseOrder = await dynamicFindUnique('purchaseorder', { ponumber });
if (!purchaseOrder) {
  throw new Error(`Purchase order not found for ponumber: ${ponumber}`);
}

// Check Line 83: Verify status condition
if (purchaseOrder.po_status !== 'in_progress') {
  logger.warn(`PO status is ${purchaseOrder.po_status}, expected in_progress`);
  return; // This might be the issue
}
```

**Issue**: Payment amount extraction failing
```javascript
// File: src/services/poinvoice.service.ts, Line 25
private extractPaymentAmount(paymentdata: any): number {
  if (!paymentdata) return 0;
  
  let totalPaymentAmount = 0;
  
  if (Array.isArray(paymentdata)) {
    totalPaymentAmount = paymentdata.reduce((sum, payment) => {
      const amount = parseFloat(payment.paymentamount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  } else if (typeof paymentdata === 'object' && paymentdata.paymentamount) {
    const amount = parseFloat(paymentdata.paymentamount || 0);
    totalPaymentAmount = isNaN(amount) ? 0 : amount;
  }
  
  return totalPaymentAmount;
}
```

#### Test 2.2: Full Payment Status Update
**Objective**: Verify `po_status` updates to `fulfilled`

**Test Scenario**:
1. Previous payment: 600
2. Current payment: 1920
3. Total payments: 2520 (equals PO total)
4. Expected: `po_status = "fulfilled"`

**Failure Rectification**:

**Issue**: Total calculation incorrect
```javascript
// File: src/services/poinvoice.service.ts, Line 48
private async calculateTotalPaymentsForPO(ponumber: string): Promise<number> {
  try {
    const existingInvoices = await dynamicFindManyWithFilters('poinvoice', { ponumber }, {
      useAllColumns: true
    });

    let totalPaid = 0;
    for (const invoice of existingInvoices.data) {
      const paymentAmount = this.extractPaymentAmount(invoice.paymentdata);
      totalPaid += paymentAmount;
      
      // Debug logging
      logger.debug({
        invoiceId: invoice.id,
        paymentAmount,
        runningTotal: totalPaid
      }, 'Payment calculation debug');
    }

    return totalPaid;
  } catch (error) {
    logger.error({ error, ponumber }, 'Error calculating total payments');
    return 0;
  }
}
```

**Issue**: Decimal precision problems
```javascript
// File: src/services/poinvoice.service.ts, Line 94
const poTotal = parseFloat(purchaseOrder.total || 0);
const totalPayments = totalExistingPayments + currentPaymentAmount;

// Use proper decimal comparison
const tolerance = 0.01; // 1 cent tolerance
if (totalPayments >= (poTotal - tolerance)) {
  newStatus = 'fulfilled';
} else if (currentPaymentAmount > 0) {
  newStatus = 'partially_fulfilled';
}
```

### 3. Error Handling Tests

#### Test 3.1: Invalid PONumber
**Test Data**: `ponumber: "NON-EXISTENT-PO"`
**Expected**: HTTP 400/404 with clear error message

**Rectification**:
```javascript
// File: src/services/poinvoice.service.ts
async create(data) {
  // Validate ponumber exists
  if (!data.ponumber) {
    throw new ValidationError('ponumber is required');
  }
  
  const purchaseOrder = await dynamicFindUnique('purchaseorder', { ponumber: data.ponumber });
  if (!purchaseOrder) {
    throw new NotFoundError(`Purchase order not found for ponumber: ${data.ponumber}`);
  }
  
  // ... continue with creation
}
```

#### Test 3.2: Negative Payment Amount
**Test Data**: `paymentamount: -100`
**Expected**: HTTP 400 with validation error

**Rectification**:
```javascript
// File: src/schemas/poinvoice.schema.ts
export const createPoinvoiceSchema = z.object({
  // ... other fields
  paymentdata: z.array(z.object({
    paymentamount: z.number().positive('Payment amount must be positive'),
    // ... other payment fields
  })).optional(),
}).passthrough();
```

### 4. Security Tests

#### Test 4.1: SQL Injection Prevention
**Test Data**: `ponumber: "'; DROP TABLE poinvoice; --"`
**Current Protection**: Prisma ORM with parameterized queries
**Verification**: Ensure no SQL injection possible

#### Test 4.2: XSS Prevention
**Test Data**: `comments: "<script>alert('xss')</script>"`
**Rectification**:
```javascript
// File: src/controllers/poinvoice.controller.ts
import DOMPurify from 'dompurify';

createPoinvoice = asyncHandler(async (request, reply) => {
  const data = createPoinvoiceSchema.parse(request.body);
  
  // Sanitize text inputs
  if (data.paymentdata) {
    data.paymentdata = data.paymentdata.map(payment => ({
      ...payment,
      comments: payment.comments ? DOMPurify.sanitize(payment.comments) : payment.comments
    }));
  }
  
  const poinvoice = await this.poinvoiceService.create(data);
  // ... rest of method
});
```

### 5. Performance Tests

#### Test 5.1: Concurrent Payment Processing
**Scenario**: Multiple simultaneous payments for same PO
**Risk**: Race conditions in status updates

**Rectification**:
```javascript
// File: src/services/poinvoice.service.ts
async create(data) {
  // Use row-level locking to prevent race conditions
  const poinvoice = await prisma.$transaction(async (tx) => {
    // Lock the purchase order row
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { ponumber: data.ponumber },
      lock: 'pessimistic_write' // PostgreSQL row lock
    });
    
    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }
    
    // Continue with locked row...
    const newPoinvoice = await dynamicCreate('poinvoice', createData);
    
    // Update status with lock held
    await this.updatePurchaseOrderStatus(data.ponumber, currentPaymentAmount);
    
    return newPoinvoice;
  });
  
  return poinvoice;
}
```

#### Test 5.2: Performance Optimization
**Target**: Response time < 1 second for payment processing

**Optimizations**:
```sql
-- Add database indexes
CREATE INDEX idx_poinvoice_ponumber ON poinvoice(ponumber);
CREATE INDEX idx_purchaseorder_status ON purchaseorder(po_status);
CREATE INDEX idx_poinvoice_created ON poinvoice(createddate);
```

```javascript
// File: src/services/poinvoice.service.ts
// Add caching for frequently accessed POs
private poCache = new Map();

private async getCachedPurchaseOrder(ponumber: string) {
  if (this.poCache.has(ponumber)) {
    return this.poCache.get(ponumber);
  }
  
  const po = await dynamicFindUnique('purchaseorder', { ponumber });
  if (po) {
    this.poCache.set(ponumber, po);
    // Set cache expiry
    setTimeout(() => this.poCache.delete(ponumber), 60000); // 1 minute
  }
  
  return po;
}
```

## Test Execution

### Running the Tests

```bash
# Install dependencies
npm install

# Set environment variables
export API_BASE_URL=http://localhost:5600
export TEST_VERBOSE=true
export TEST_CLEANUP=true

# Run comprehensive tests
node test_poinvoice_status_update_comprehensive.js

# Run specific test scenarios
node -e "
import { testPurchaseOrderCreation } from './test_poinvoice_status_update_comprehensive.js';
testPurchaseOrderCreation().then(console.log);
"
```

### Test Environment Setup

1. **Database Setup**:
   ```sql
   -- Ensure test database has proper schema
   -- Run migrations: npx prisma migrate deploy
   -- Seed test data: npx prisma db seed
   ```

2. **Server Setup**:
   ```bash
   # Start application server
   npm start
   # or
   node src/server.js
   ```

3. **Dependencies**:
   ```bash
   npm install axios crypto
   ```

## Production Readiness Checklist

### Essential Requirements (Must Pass):
- [ ] All status transitions working correctly (`in_progress` → `partially_fulfilled` → `fulfilled`)
- [ ] Payment amount calculations accurate (handles decimals properly)
- [ ] Database transactions atomic (no partial updates)
- [ ] Data consistency (`poinvoice.purchaseorderstatus` matches `purchaseorder.po_status`)
- [ ] Error handling comprehensive (proper HTTP status codes and messages)
- [ ] Input validation complete (required fields, data types, ranges)

### Security Requirements:
- [ ] SQL injection prevention verified
- [ ] XSS protection implemented
- [ ] Input sanitization in place
- [ ] Rate limiting configured (if applicable)

### Performance Requirements:
- [ ] Response time < 1 second for single payment
- [ ] Concurrent request handling (race condition prevention)
- [ ] Database queries optimized (proper indexes)
- [ ] Memory usage within limits

### Monitoring and Logging:
- [ ] Comprehensive logging for status changes
- [ ] Error tracking and alerting
- [ ] Performance metrics collection
- [ ] Audit trail for payment processing

## Success Criteria

### Test Pass Criteria:
1. **100% Test Success Rate**: All test scenarios must pass
2. **Zero Critical Issues**: No security vulnerabilities or data corruption risks
3. **Performance Targets Met**: Response times within acceptable limits
4. **Documentation Complete**: All rectification steps validated

### Production Deployment Gates:
1. All tests passing in staging environment
2. Load testing completed successfully
3. Security audit completed
4. Database migration plan validated
5. Rollback procedures tested

## Rectification Priority Matrix

### Priority 1 (Critical - Block Production):
- Data corruption in payment calculations
- Status update failures
- Security vulnerabilities
- Race conditions in concurrent processing

### Priority 2 (High - Fix Before Production):
- Input validation gaps
- Error handling improvements
- Performance optimization needs
- Missing audit logging

### Priority 3 (Medium - Post-Production):
- Code optimization
- Additional error messages
- Enhanced monitoring
- Documentation updates

## Contact and Support

For test failures or implementation questions:
1. Review the specific rectification steps provided in test output
2. Check application logs for detailed error information
3. Verify database state and constraints
4. Consult the codebase documentation

Remember: The goal is 1000% bug-free, production-ready API. Every test failure represents a potential production issue that must be addressed. 