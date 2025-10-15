# GCP Cloud Tasks - Lock Cleanup Implementation Guide

**Version:** 1.0  
**Date:** October 10, 2025  
**Purpose:** Automatic cleanup of expired stock locks using GCP Cloud Tasks

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Environment Variables](#environment-variables)
4. [GCP Setup](#gcp-setup)
5. [Implementation Flow](#implementation-flow)
6. [Testing](#testing)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

### The Problem
When a user initiates PhonePe payment:
1. Stock is locked (`platformstock.lockqty += qty`)
2. User redirected to PhonePe payment page
3. **User abandons payment** (closes browser, doesn't complete)
4. Stock remains locked forever ❌
5. Other customers can't buy the product ❌

### The Solution
**GCP Cloud Tasks** automatically releases locks after 15 minutes if payment not completed.

### Key Features
✅ Automatic lock release for abandoned/failed payments  
✅ Configurable timeout (default: 15 minutes)  
✅ Non-blocking (doesn't affect payment flow)  
✅ Idempotent (safe to run multiple times)  
✅ Detailed logging and error handling  
✅ Works only for PhonePe mode (COD converts locks immediately)

---

## 🔄 How It Works

### Timeline

```
T0: User initiates payment
    └─ Validate products, stock, promotions ✅
    └─ Lock stock atomically ✅
    └─ CREATE GCP CLOUD TASK (15-min delay) ✅
    └─ Return redirectUrl to frontend ✅
    └─ Frontend redirects user to PhonePe ✅

T1-T14: User on PhonePe payment page
    └─ Stock remains locked ✅
    └─ GCP Task scheduled, waiting...

T15: GCP Task triggers
    └─ Call: POST /v1/phonepe/cleanup-lock
    └─ Check payment status from PhonePe
    
    IF payment SUCCESS:
        └─ Do nothing (lock already converted) ✅
        └─ Return: { action: 'none' }
    
    ELSE IF payment PENDING/INITIATED/FAILED:
        └─ Release locks:
            platformstock.lockqty -= qty
            platformstock.availableqty += qty
        └─ Update transaction status: EXPIRED
        └─ Return: { action: 'locks_released' }
```

### PhonePe Mode vs COD Mode

| Mode | Lock Timing | GCP Task Created? | Lock Release |
|------|-------------|-------------------|--------------|
| **PhonePe** | At initiation | ✅ Yes (15 min) | On payment success OR timeout |
| **COD** | At initiation | ❌ No | Immediately converted to order |

---

## 🔧 Environment Variables

### Required Variables

Add these to your `.env` file:

```bash
# ========================================
# GCP Cloud Tasks Configuration
# ========================================

# GCP Project Settings
GCP_PROJECT_ID=your-gcp-project-id
GCP_PROJECT_QUEUE=lock-cleanup-queue
GCP_PROJECT_LOCATION=asia-south1

# API Configuration
API_BASE_URL=https://your-api-domain.com

# Lock Cleanup Settings
LOCK_CLEANUP_DELAY_SECONDS=900  # 15 minutes (default)

# Optional: Legacy support
GCP_TASK_URL=https://your-api-domain.com/v1/phonepe/cleanup-lock
```

### Variable Details

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GCP_PROJECT_ID` | Your GCP Project ID | - | ✅ Yes |
| `GCP_PROJECT_QUEUE` | Task queue name | `lock-cleanup-queue` | ✅ Yes |
| `GCP_PROJECT_LOCATION` | GCP region | `asia-south1` | ✅ Yes |
| `API_BASE_URL` | Your backend API URL | - | ✅ Yes |
| `LOCK_CLEANUP_DELAY_SECONDS` | Lock timeout (seconds) | `900` (15 min) | ❌ No |
| `GCP_TASK_URL` | Legacy: Full cleanup URL | - | ❌ No |

### Delay Configuration Options

| Value | Minutes | Use Case |
|-------|---------|----------|
| `600` | 10 min | Fast checkout (user feels rushed) |
| **`900`** | **15 min** | **Recommended (industry standard)** ✅ |
| `1200` | 20 min | Relaxed checkout |
| `1800` | 30 min | Very relaxed (not recommended) |

---

## 🏗️ GCP Setup

### Step 1: Create Cloud Tasks Queue

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Create queue
gcloud tasks queues create lock-cleanup-queue \
  --location=asia-south1 \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=5 \
  --max-attempts=3 \
  --min-backoff=60s \
  --max-backoff=600s
```

### Step 2: Verify Queue Creation

```bash
# List queues
gcloud tasks queues describe lock-cleanup-queue --location=asia-south1
```

Expected output:
```yaml
name: projects/YOUR_PROJECT_ID/locations/asia-south1/queues/lock-cleanup-queue
rateLimits:
  maxDispatchesPerSecond: 10
  maxConcurrentDispatches: 5
retryConfig:
  maxAttempts: 3
  minBackoff: 60s
  maxBackoff: 600s
state: RUNNING
```

### Step 3: Service Account Permissions

Ensure your service account has permission:

```bash
# Grant Cloud Tasks Enqueuer role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member=serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/cloudtasks.enqueuer
```

### Step 4: Authentication Setup

**Option A: Service Account Key (Local/Development)**

```bash
# Create service account key
gcloud iam service-accounts keys create key.json \
  --iam-account=YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
```

**Option B: Application Default Credentials (Production/GCP)**

```bash
# On GCP (Cloud Run, GCE, etc.)
# No setup needed - uses default service account automatically
```

---

## 📊 Implementation Flow

### 1. Payment Initiation (phonepe.controller.ts)

```typescript
// Line 405-545: Lock stock atomically
await prisma.$transaction(async (tx) => {
  for (const item of requestBody.order) {
    // Lock stock
    await tx.platformStock.update({
      where: { productid_platform: { productid, platform: 'nivapp' } },
      data: {
        availableqty: platformStock.availableqty - item.quantity,
        lockqty: (platformStock.lockqty || 0) + item.quantity,
        modifieddate: BigInt(Date.now())
      }
    });
  }
});

// Line 556-598: Create GCP Cloud Task
if (requestBody.mode === 'phonepe') {
  const { createLockCleanupTask } = await import('../services/gcpTasks.service.js');
  
  const taskResult = await createLockCleanupTask(
    merchantTransactionId,
    900  // 15 minutes
  );
  
  logger.info('GCP Cloud Task created for lock cleanup');
}
```

### 2. GCP Task Creation (gcpTasks.service.ts)

```typescript
export async function createLockCleanupTask(
  merchantTransactionId: string,
  delayInSeconds: number = 900
): Promise<{ success: boolean; taskName?: string }> {
  
  const payload = {
    merchantTransactionId,
    createdAt: new Date().toISOString(),
    action: 'release_expired_lock'
  };

  const task = {
    httpRequest: {
      headers: { 'Content-Type': 'application/json' },
      httpMethod: 'POST',
      url: `${API_BASE_URL}/v1/phonepe/cleanup-lock`,
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    },
    scheduleTime: {
      seconds: Math.floor(Date.now() / 1000) + delayInSeconds,
    }
  };

  const [response] = await client.createTask({ parent, task });
  
  return { success: true, taskName: response.name };
}
```

### 3. Lock Cleanup Endpoint (phonepe.controller.ts)

```typescript
// Line 2921-3205: cleanupExpiredLock handler
cleanupExpiredLock = asyncHandler(async (request, reply) => {
  const { merchantTransactionId } = request.body;
  
  // Step 1: Check payment status
  const paymentStatus = await this.phonePeService.checkPaymentStatus(merchantTransactionId);
  
  // Step 2: If successful, do nothing
  if (paymentStatus.code === 'PAYMENT_SUCCESS') {
    return reply.send({
      success: true,
      action: 'none',
      message: 'Payment successful - no cleanup needed'
    });
  }
  
  // Step 3: If pending/failed, release locks
  if (paymentStatus.code === 'PAYMENT_PENDING' || 
      paymentStatus.code === 'PAYMENT_FAILED') {
    
    // Get transaction details
    const transaction = await this.transactionService.findMany({
      merchanttransactionid: merchantTransactionId
    });
    
    const orderItems = transaction.data[0].transactiondata?.originalPayload?.order;
    
    // Release locks atomically
    await prisma.$transaction(async (tx) => {
      for (const item of orderItems) {
        const platformStock = await tx.platformStock.findUnique({
          where: {
            productid_platform: {
              productid: BigInt(item.productid),
              platform: 'nivapp'
            }
          }
        });
        
        const quantityToRelease = Math.min(item.quantity, platformStock.lockqty);
        
        await tx.platformStock.update({
          where: {
            productid_platform: {
              productid: BigInt(item.productid),
              platform: 'nivapp'
            }
          },
          data: {
            availableqty: platformStock.availableqty + quantityToRelease,
            lockqty: Math.max(0, platformStock.lockqty - quantityToRelease),
            modifieddate: BigInt(Date.now())
          }
        });
      }
    });
    
    // Update transaction status
    await this.transactionService.update(transaction.data[0].id, {
      transactiondata: {
        ...transaction.data[0].transactiondata,
        status: 'EXPIRED',
        expiredAt: new Date().toISOString(),
        reason: 'payment_timeout_or_failure'
      }
    });
    
    return reply.send({
      success: true,
      action: 'locks_released',
      message: 'Locks released successfully'
    });
  }
});
```

### 4. Route Definition (phonepe.route.ts)

```typescript
// Line 1406-1538: Cleanup route
fastify.post('/cleanup-lock', {
  schema: {
    description: 'Cleanup expired stock locks (GCP Cloud Tasks webhook)',
    tags: ['PhonePe Payment', 'Internal'],
    body: {
      type: 'object',
      properties: {
        merchantTransactionId: { type: 'string' },
        createdAt: { type: 'string' },
        action: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          action: {
            type: 'string',
            enum: ['none', 'locks_released']
          },
          data: { type: 'object' }
        }
      }
    }
  }
}, phonePeController.cleanupExpiredLock);
```

---

## 🧪 Testing

### Test 1: Successful Payment (No Cleanup Needed)

```bash
# 1. Initiate payment
curl -X POST https://your-api.com/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "userid": 1,
    "mode": "phonepe",
    "order": [{"productid": 1, "quantity": 1}]
  }'

# Response includes merchantTransactionId
# GCP Task created with 15-min delay

# 2. Complete payment (within 15 min)
# User pays on PhonePe, callback called, lock converted to order

# 3. GCP Task triggers after 15 min
# Checks payment status → SUCCESS
# Returns: { action: 'none', message: 'Payment successful' }
# No cleanup performed ✅
```

### Test 2: Abandoned Payment (Cleanup Triggered)

```bash
# 1. Initiate payment
curl -X POST https://your-api.com/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "userid": 1,
    "mode": "phonepe",
    "order": [{"productid": 1, "quantity": 2}]
  }'

# Response: merchantTransactionId, redirectUrl
# Stock locked: platformstock.lockqty += 2
# GCP Task scheduled

# 2. User abandons (doesn't pay)
# Wait 15+ minutes

# 3. GCP Task triggers
# POST /v1/phonepe/cleanup-lock
# Payload: { merchantTransactionId: "..." }

# 4. Cleanup checks payment status → PENDING
# Releases locks:
#   platformstock.lockqty -= 2
#   platformstock.availableqty += 2
# Updates transaction status: EXPIRED
# Returns: { action: 'locks_released' }
```

### Test 3: Failed Payment (Cleanup Triggered)

```bash
# 1. Initiate payment
# 2. User attempts payment but it fails (insufficient balance, etc.)
# 3. Payment status: PAYMENT_FAILED
# 4. GCP Task triggers after 15 min
# 5. Checks status → FAILED
# 6. Releases locks ✅
```

### Test 4: Manual Cleanup Trigger (For Testing)

```bash
# Manually trigger cleanup endpoint
curl -X POST https://your-api.com/v1/phonepe/cleanup-lock \
  -H "Content-Type: application/json" \
  -d '{
    "merchantTransactionId": "MERCHANT_TXN_ID_HERE",
    "createdAt": "2025-10-10T10:00:00Z",
    "action": "release_expired_lock"
  }'

# Expected responses:
# - Payment SUCCESS: { action: 'none' }
# - Payment PENDING/FAILED: { action: 'locks_released', data: {...} }
```

### Test 5: COD Mode (No Task Created)

```bash
# 1. Initiate COD payment
curl -X POST https://your-api.com/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "userid": 1,
    "mode": "cod",
    "order": [{"productid": 1, "quantity": 1}]
  }'

# Response: order created immediately
# Stock: lockqty = 0 (converted to orderedqty)
# GCP Task: NOT created (COD doesn't need cleanup)
# Log: "Skipping GCP Cloud Task creation - COD mode"
```

---

## 📈 Monitoring

### Key Metrics to Track

1. **Tasks Created**
   - Count per hour/day
   - Success rate
   - Failure reasons

2. **Locks Released**
   - Number of products released
   - Total quantity released
   - Frequency of abandoned payments

3. **Task Execution Time**
   - Time from creation to execution
   - Actual vs expected delay

4. **Payment Status Distribution**
   - SUCCESS (no cleanup)
   - PENDING (cleanup triggered)
   - FAILED (cleanup triggered)

### Log Queries

**Find All Cleanup Tasks Created Today**

```javascript
// In GCP Cloud Logging
resource.type="cloud_tasks_queue"
resource.labels.queue_id="lock-cleanup-queue"
timestamp >= "2025-10-10T00:00:00Z"
jsonPayload.message="GCP Cloud Task created successfully for lock cleanup"
```

**Find All Locks Released**

```javascript
resource.type="cloud_run_revision"
jsonPayload.message="Lock released successfully for product"
timestamp >= "2025-10-10T00:00:00Z"
```

**Find Failed Cleanups**

```javascript
resource.type="cloud_run_revision"
jsonPayload.message=~"Error.*cleanup"
severity >= "ERROR"
timestamp >= "2025-10-10T00:00:00Z"
```

### Database Queries

**Check Current Active Locks**

```sql
SELECT 
  p.productid,
  pr.name,
  p.lockqty,
  p.availableqty,
  TO_TIMESTAMP(p.modifieddate / 1000) as last_modified,
  EXTRACT(EPOCH FROM NOW()) - (p.modifieddate / 1000) as age_seconds
FROM platformstock p
JOIN product pr ON p.productid = pr.id
WHERE p.lockqty > 0 
  AND p.platform = 'nivapp'
ORDER BY age_seconds DESC;
```

**Check Expired Transactions**

```sql
SELECT 
  merchanttransactionid,
  transactiondata->>'status' as status,
  transactiondata->>'reason' as reason,
  transactiondata->>'expiredAt' as expired_at,
  transactiondata->>'cleanupExecutedAt' as cleanup_executed_at,
  TO_TIMESTAMP(createddate / 1000) as created_at
FROM transaction
WHERE transactiondata->>'status' = 'EXPIRED'
  AND transactiondata->>'reason' = 'payment_timeout_or_failure'
ORDER BY createddate DESC
LIMIT 50;
```

**Daily Cleanup Statistics**

```sql
SELECT 
  DATE_TRUNC('day', TO_TIMESTAMP(modifieddate / 1000)) as date,
  COUNT(*) as expired_count,
  COUNT(DISTINCT merchanttransactionid) as unique_transactions
FROM transaction
WHERE transactiondata->>'status' = 'EXPIRED'
  AND transactiondata->>'reason' = 'payment_timeout_or_failure'
GROUP BY date
ORDER BY date DESC
LIMIT 30;
```

---

## 🔍 Troubleshooting

### Issue 1: GCP Task Not Created

**Symptoms:**
- Log: "Failed to create GCP Cloud Task"
- No task in GCP Console

**Possible Causes:**
1. Missing environment variables
2. Invalid GCP credentials
3. Queue doesn't exist
4. Service account lacks permissions

**Solution:**

```bash
# Check environment variables
echo $GCP_PROJECT_ID
echo $GCP_PROJECT_QUEUE
echo $GCP_PROJECT_LOCATION

# Verify queue exists
gcloud tasks queues describe lock-cleanup-queue --location=asia-south1

# Check service account permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# Grant permission if missing
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member=serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/cloudtasks.enqueuer
```

---

### Issue 2: Task Created But Not Executed

**Symptoms:**
- Task visible in GCP Console
- Status: "Pending" or "Scheduled"
- Never executes after delay

**Possible Causes:**
1. Incorrect schedule time
2. API endpoint unreachable
3. Authentication issues

**Solution:**

```bash
# List pending tasks
gcloud tasks list --queue=lock-cleanup-queue --location=asia-south1

# Check task details
gcloud tasks describe TASK_NAME --queue=lock-cleanup-queue --location=asia-south1

# Verify API endpoint
curl -X POST https://your-api.com/v1/phonepe/cleanup-lock \
  -H "Content-Type: application/json" \
  -d '{"merchantTransactionId":"test-123"}'
```

---

### Issue 3: Cleanup Called But Locks Not Released

**Symptoms:**
- Cleanup endpoint returns success
- `platformstock.lockqty` still > 0
- No errors in logs

**Possible Causes:**
1. Payment status = SUCCESS (no cleanup needed)
2. Transaction not found
3. Order items missing in transaction data

**Debug Steps:**

```bash
# 1. Check transaction status
curl https://your-api.com/v1/transaction/MERCHANT_TXN_ID

# 2. Check payment status
curl https://api.phonepe.com/apis/hermes/status/MERCHANT_ID/MERCHANT_TXN_ID

# 3. Check platformstock
SELECT * FROM platformstock WHERE productid = X AND platform = 'nivapp';

# 4. Manually trigger cleanup with logging
curl -X POST https://your-api.com/v1/phonepe/cleanup-lock \
  -H "Content-Type: application/json" \
  -d '{"merchantTransactionId":"MERCHANT_TXN_ID"}' \
  -v
```

---

### Issue 4: Locks Released Multiple Times (Negative Qty)

**Symptoms:**
- `platformstock.lockqty` becomes negative
- `platformstock.availableqty` inflated

**Cause:**
- Task retried multiple times (GCP retry policy)
- No idempotency check

**Solution:**

Already handled in code:

```typescript
// Line 3050-3074: Idempotent release logic
const currentLockQty = platformStock.lockqty || 0;
const requestedQty = item.quantity;
const quantityToRelease = Math.min(requestedQty, currentLockQty);

if (quantityToRelease <= 0) {
  // Already released, skip
  continue;
}

const newLockQty = Math.max(0, currentLockQty - quantityToRelease);
// Always non-negative ✅
```

---

### Issue 5: High Task Queue Size

**Symptoms:**
- Many pending tasks in queue
- Tasks taking longer than 15 min to execute

**Cause:**
- High order volume
- Queue rate limits too low

**Solution:**

```bash
# Increase queue limits
gcloud tasks queues update lock-cleanup-queue \
  --location=asia-south1 \
  --max-dispatches-per-second=50 \
  --max-concurrent-dispatches=20

# Monitor queue
gcloud tasks queues describe lock-cleanup-queue --location=asia-south1
```

---

## 📊 Performance Considerations

### Scalability

| Orders/Hour | Tasks/Hour | Queue Config | Notes |
|-------------|------------|--------------|-------|
| < 100 | < 100 | Default | Fine |
| 100-1000 | 100-1000 | max-dispatches: 50 | Increase limits |
| > 1000 | > 1000 | max-dispatches: 100 | Consider sharding |

### Cost Estimation

**GCP Cloud Tasks Pricing (as of 2025)**

- First 1M tasks/month: **FREE** ✅
- Additional tasks: **$0.40 per 1M tasks**

**Example Costs:**

| Orders/Day | Tasks/Month | Cost/Month |
|------------|-------------|------------|
| 100 | 3,000 | **$0** (free tier) |
| 1,000 | 30,000 | **$0** (free tier) |
| 10,000 | 300,000 | **$0** (free tier) |
| 50,000 | 1,500,000 | **$0.20** |
| 100,000 | 3,000,000 | **$0.80** |

**Very cost-effective!** 💰

---

## 🎯 Best Practices

### 1. Always Log Task Creation

```typescript
logger.info({
  merchantTransactionId,
  taskName,
  scheduledTime,
  delaySeconds
}, 'GCP Cloud Task created');
```

### 2. Non-Critical Error Handling

```typescript
try {
  await createLockCleanupTask(merchantTransactionId);
} catch (error) {
  // Log but don't fail the request
  logger.warn({ error }, 'Task creation failed (non-critical)');
  // Continue with payment flow ✅
}
```

### 3. Idempotent Cleanup

```typescript
// Always check current state before releasing
const quantityToRelease = Math.min(requestedQty, currentLockQty);
if (quantityToRelease <= 0) return; // Already released
```

### 4. Detailed Logging

```typescript
logger.info({
  productId,
  quantityReleased,
  before: { availableqty, lockqty },
  after: { availableqty, lockqty }
}, 'Lock released');
```

### 5. Status-Based Actions

```typescript
if (paymentStatus === 'SUCCESS') {
  return { action: 'none' }; // Don't release
}

if (paymentStatus === 'PENDING' || paymentStatus === 'FAILED') {
  // Release locks
  return { action: 'locks_released' };
}
```

---

## 📚 Related Documentation

- [PhonePe Integration Guide](./PHONEPE_INTEGRATION_README.md)
- [Stock Lock Implementation](./STOCK_LOCKQTY_COMPLETE_GUIDE.md)
- [Payment Flow Documentation](./FRONTEND_PAYMENT_RESPONSE_GUIDE.md)
- [GCP Cloud Tasks Official Docs](https://cloud.google.com/tasks/docs)

---

## ✅ Checklist

### Pre-Deployment

- [ ] GCP Cloud Tasks queue created
- [ ] Service account has `cloudtasks.enqueuer` role
- [ ] Environment variables configured
- [ ] GOOGLE_APPLICATION_CREDENTIALS set (if using key file)
- [ ] API endpoint accessible from GCP
- [ ] Tested with abandoned payment scenario
- [ ] Tested with successful payment scenario
- [ ] Monitoring queries ready

### Post-Deployment

- [ ] Monitor task creation logs
- [ ] Monitor cleanup execution logs
- [ ] Check queue statistics daily
- [ ] Verify no negative quantities
- [ ] Review expired transactions weekly
- [ ] Adjust timeout if needed (based on data)

---

## 🚀 Quick Start Commands

```bash
# 1. Install dependencies (if not already)
npm install @google-cloud/tasks

# 2. Set environment variables
export GCP_PROJECT_ID=your-project-id
export GCP_PROJECT_QUEUE=lock-cleanup-queue
export GCP_PROJECT_LOCATION=asia-south1
export API_BASE_URL=https://your-api.com
export LOCK_CLEANUP_DELAY_SECONDS=900

# 3. Create GCP queue
gcloud tasks queues create lock-cleanup-queue \
  --location=asia-south1 \
  --max-dispatches-per-second=10

# 4. Deploy your application
npm run build
npm start

# 5. Test cleanup endpoint
curl -X POST https://your-api.com/v1/phonepe/cleanup-lock \
  -H "Content-Type: application/json" \
  -d '{"merchantTransactionId":"test-123"}'
```

---

## 📞 Support

**For issues:**
1. Check logs: `journalctl -u your-app -f`
2. Check GCP Console: Cloud Tasks > Queues
3. Check transaction table: `SELECT * FROM transaction WHERE merchanttransactionid = '...'`
4. Check platformstock: `SELECT * FROM platformstock WHERE lockqty > 0`

**Need help?** Contact: devops@yourcompany.com

---

**Implementation Complete!** ✅

The GCP Cloud Tasks integration ensures stock locks are automatically released for abandoned PhonePe payments, preventing inventory deadlocks and improving customer experience.

