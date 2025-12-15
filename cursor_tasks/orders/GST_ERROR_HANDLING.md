# GST Calculation Error Handling & Fallback Strategy

## 📋 Overview

This document outlines the comprehensive error handling strategy for GST calculation, including scenarios when EKART is unavailable, authentication fails, or pincode lookups fail.

---

## 🔄 Error Handling Flow

```
GST Calculation Request
        │
        ▼
┌───────────────────────────────────────┐
│ 1. Get Warehouse Pincode              │
│    ├─► Try EKART API                  │
│    ├─► If fails → Use ENV fallback   │
│    └─► If no fallback → null          │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ 2. Get Delivery Pincode               │
│    └─► From order.addressid           │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ 3. Get States from Pincodes           │
│    ├─► Call Postal API                │
│    ├─► If fails → null                 │
│    └─► Log warning                     │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ 4. Determine GST Type                 │
│    ├─► If both states available       │
│    │   └─► Compare → INTRA/INTER      │
│    ├─► If any state missing            │
│    │   └─► Default to INTER-STATE     │
│    └─► Continue with GST calculation  │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ 5. Calculate & Update GST             │
│    └─► Order creation continues       │
│        (GST errors don't fail order)  │
└───────────────────────────────────────┘
```

---

## 🚨 Error Scenarios & Handling

### Scenario 1: EKART Authentication Failure

**When it happens:**
- EKART credentials are invalid/expired
- EKART API returns 401/403
- EKART service is not connected

**Error Handling:**
```typescript
// In getWarehousePincode()
catch (error) {
  if (error.response?.status === 401 || error.response?.status === 403) {
    logger.error('⚠️ EKART authentication failed');
    // Fallback to ENV variable
    return getFallbackWarehousePincode();
  }
}
```

**Fallback Strategy:**
1. ✅ Log error with details
2. ✅ Check `WAREHOUSE_PINCODE` environment variable
3. ✅ If valid → Use it for GST calculation
4. ✅ If invalid/missing → Continue with `null` (defaults to INTER-STATE)

**Result:**
- Order creation **continues** (not blocked)
- GST defaults to **INTER-STATE** (IGST)
- Error logged for admin review

---

### Scenario 2: EKART Service Unavailable

**When it happens:**
- Network timeout
- Connection refused
- EKART API is down

**Error Handling:**
```typescript
catch (error) {
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    logger.error('⚠️ EKART service unavailable');
    // Fallback to ENV variable
    return getFallbackWarehousePincode();
  }
}
```

**Fallback Strategy:**
1. ✅ Log connection error
2. ✅ Use `WAREHOUSE_PINCODE` from environment
3. ✅ Continue GST calculation

**Result:**
- Order creation **continues**
- GST uses fallback pincode if available
- Otherwise defaults to INTER-STATE

---

### Scenario 3: No Addresses in EKART

**When it happens:**
- EKART API succeeds but returns empty array
- No addresses registered in EKART

**Error Handling:**
```typescript
if (!addresses || addresses.length === 0) {
  logger.warn('No addresses found in EKART');
  return getFallbackWarehousePincode();
}
```

**Fallback Strategy:**
1. ✅ Log warning
2. ✅ Use `WAREHOUSE_PINCODE` from environment
3. ✅ Continue GST calculation

**Result:**
- Order creation **continues**
- GST uses fallback pincode

---

### Scenario 4: Postal Pincode API Failure

**When it happens:**
- Postal API is down
- Invalid pincode format
- Network timeout

**Error Handling:**
```typescript
// In getStateFromPincode()
catch (error) {
  logger.error('Error fetching state from postal API');
  return null; // Returns null, not throws
}
```

**Fallback Strategy:**
1. ✅ Log error
2. ✅ Return `null` for state
3. ✅ In `getGstType()`, if any state is null:
   ```typescript
   if (!fromState || !toState) {
     return {
       gst_type: 'INTER-STATE', // Safe default
       error: 'Invalid pincode(s)'
     };
   }
   ```

**Result:**
- Order creation **continues**
- GST defaults to **INTER-STATE** (IGST)
- Error logged for review

---

### Scenario 5: Invalid Pincode Format

**When it happens:**
- Pincode is not 6 digits
- Pincode contains non-numeric characters
- Pincode is null/undefined

**Error Handling:**
```typescript
// Validation in getStateFromPincode()
if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
  logger.debug('Invalid pincode format');
  return null;
}
```

**Fallback Strategy:**
1. ✅ Validate format before API call
2. ✅ Return `null` if invalid
3. ✅ Default to INTER-STATE

**Result:**
- Order creation **continues**
- GST defaults to INTER-STATE
- Invalid pincode logged

---

### Scenario 6: Delivery Pincode Missing

**When it happens:**
- `order.addressid` is null
- Address record not found
- Address has no pincode

**Error Handling:**
```typescript
// In processOrderGst()
const deliveryPincode = await this.getDeliveryPincode(addressId);

if (!deliveryPincode) {
  logger.warn('Delivery pincode not found');
  return { 
    success: false, 
    error: 'Delivery pincode not found' 
  };
}
```

**Fallback Strategy:**
1. ✅ Return error (GST calculation skipped)
2. ✅ Order creation **still succeeds**
3. ✅ GST fields remain null in database

**Result:**
- Order creation **continues** (GST skipped)
- GST fields are null (can be calculated later)
- Error logged for admin to fix address

---

## 🛡️ Fallback Configuration

### Environment Variable: `WAREHOUSE_PINCODE`

**Purpose:** Fallback warehouse pincode when EKART is unavailable

**Format:** 6-digit numeric string (e.g., `"600001"`)

**Usage:**
```bash
# .env file
WAREHOUSE_PINCODE=600001
```

**Validation:**
- Must be exactly 6 digits
- Must be numeric only
- If invalid → ignored, logs warning

**Priority:**
1. **First:** EKART API (if available)
2. **Second:** `WAREHOUSE_PINCODE` env variable
3. **Third:** Default to INTER-STATE (IGST)

---

## 📊 Error Handling Summary Table

| Scenario | Error Type | Fallback | Order Creation | GST Result |
|----------|-----------|----------|----------------|------------|
| EKART Auth Failure | 401/403 | ENV pincode → INTER-STATE | ✅ Continues | INTER-STATE |
| EKART Unavailable | Network | ENV pincode → INTER-STATE | ✅ Continues | INTER-STATE |
| No EKART Addresses | Empty array | ENV pincode → INTER-STATE | ✅ Continues | INTER-STATE |
| Postal API Failure | Network/Timeout | INTER-STATE | ✅ Continues | INTER-STATE |
| Invalid Pincode | Validation | INTER-STATE | ✅ Continues | INTER-STATE |
| Missing Delivery Pincode | Data | Skip GST | ✅ Continues | Null (can fix later) |
| GST Calculation Error | Any | Log & Continue | ✅ Continues | Partial/Null |

---

## 🔍 Logging Strategy

### Error Log Levels

| Level | When | Action |
|-------|------|--------|
| **ERROR** | EKART auth failure, critical errors | Admin review required |
| **WARN** | Fallback used, missing data | Monitor, may need fix |
| **INFO** | Normal operation, fallback used | For tracking |
| **DEBUG** | Validation failures, detailed flow | Development/debugging |

### Example Log Messages

```typescript
// EKART Auth Failure
logger.error({
  error: error.message,
  status: 401,
  code: 'UNAUTHORIZED'
}, '⚠️ EKART authentication failed - cannot fetch warehouse address. Using fallback pincode.');

// Fallback Used
logger.info({
  pincode: '600001',
  source: 'ENV_WAREHOUSE_PINCODE'
}, '✅ Using fallback warehouse pincode from environment variable');

// Default to INTER-STATE
logger.warn({
  fromPincode,
  toPincode,
  fromState,
  toState
}, '⚠️ Cannot determine state for warehouse pincode - defaulting to INTER-STATE (IGST)');
```

---

## ✅ Best Practices

### 1. **Never Block Order Creation**
- GST calculation errors should **never** fail order creation
- Order can be created without GST, calculated later if needed

### 2. **Always Have Fallback**
- Always check `WAREHOUSE_PINCODE` env variable
- Default to INTER-STATE if all else fails

### 3. **Comprehensive Logging**
- Log all errors with context
- Include pincodes, states, error codes
- Help admins diagnose issues

### 4. **Graceful Degradation**
- If warehouse pincode unavailable → Use INTER-STATE
- If delivery pincode unavailable → Skip GST (can fix later)
- If postal API fails → Use INTER-STATE

### 5. **Error Recovery**
- GST can be recalculated later if needed
- Admin can fix address/pincode issues
- System continues operating despite errors

---

## 🔧 Configuration Checklist

### Required Setup

- [ ] **EKART Credentials** (for primary source)
  - `EKART_CLIENT_ID`
  - `EKART_USERNAME`
  - `EKART_PASSWORD`

- [ ] **Fallback Pincode** (for error scenarios)
  - `WAREHOUSE_PINCODE` (6-digit pincode)

### Recommended Monitoring

- [ ] Monitor logs for EKART auth failures
- [ ] Monitor logs for fallback usage
- [ ] Alert if fallback used frequently
- [ ] Review orders with null GST fields

---

## 📝 Example Error Scenarios

### Example 1: EKART Auth Failure

```
[ERROR] ⚠️ EKART authentication failed - cannot fetch warehouse address. Using fallback pincode.
  error: "Unauthorized"
  status: 401
  code: "UNAUTHORIZED"

[INFO] ✅ Using fallback warehouse pincode from environment variable
  pincode: "600001"
  source: "ENV_WAREHOUSE_PINCODE"

[INFO] GST calculation completed successfully
  gst_type: "INTRA-STATE"
  fromState: "Tamil Nadu"
  toState: "Tamil Nadu"
```

### Example 2: Postal API Failure

```
[WARN] ⚠️ Cannot determine state for warehouse pincode - defaulting to INTER-STATE (IGST)
  fromPincode: "600001"
  toPincode: "110001"
  fromState: null
  toState: "Delhi"
  missingPincode: "warehouse"

[INFO] GST calculation completed
  gst_type: "INTER-STATE"
  error: "Invalid warehouse pincode or postal API unavailable"
```

### Example 3: Missing Delivery Pincode

```
[WARN] Delivery pincode not found
  orderId: 12345
  addressId: 678

[ERROR] Error processing order GST
  error: "Delivery pincode not found"
  orderId: 12345

[INFO] Order created successfully (GST skipped, can be calculated later)
```

---

## 🎯 Summary

**Key Principles:**
1. ✅ **Never block order creation** due to GST errors
2. ✅ **Always have fallback** (ENV pincode → INTER-STATE)
3. ✅ **Log everything** for debugging and monitoring
4. ✅ **Graceful degradation** - system continues operating
5. ✅ **Recoverable** - GST can be fixed/calculated later

**Default Behavior:**
- If warehouse pincode unavailable → Use `WAREHOUSE_PINCODE` env
- If env not set → Default to **INTER-STATE** (IGST)
- If delivery pincode missing → Skip GST (order still created)
- If postal API fails → Default to **INTER-STATE** (IGST)

**Result:** System is resilient and continues operating even when external services fail.

