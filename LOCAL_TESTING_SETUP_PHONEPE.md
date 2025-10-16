# 🧪 Local Testing Setup - PhonePe + Race Condition Testing

**Date**: October 16, 2025  
**Purpose**: Test race condition fix in local development with PhonePe test environment  
**Issue**: PhonePe callbacks require HTTPS (not http://localhost)  
**Solution**: Use ngrok for secure tunnel  

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Ngrok Setup](#ngrok-setup)
3. [Environment Configuration](#environment-configuration)
4. [PhonePe Dashboard Configuration](#phonepe-dashboard-configuration)
5. [Testing Workflow](#testing-workflow)
6. [Race Condition Test Scenarios](#race-condition-test-scenarios)
7. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites

### Required Tools

```bash
# 1. Node.js and npm (already installed)
node --version  # Should be v18+

# 2. Your backend server
cd /Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend

# 3. Ngrok (install if not already)
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Required Accounts

- ✅ PhonePe Merchant Account (production with test environment)
- ✅ Ngrok Account (free tier works)

---

## 2. Ngrok Setup

### Step 1: Install Ngrok

```bash
# macOS with Homebrew
brew install ngrok

# Verify installation
ngrok version
```

### Step 2: Create Ngrok Account

1. Go to https://ngrok.com/
2. Sign up for free account
3. Get your authtoken from dashboard

### Step 3: Configure Ngrok

```bash
# Add your authtoken (get from ngrok dashboard)
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE

# Example:
# ngrok config add-authtoken 2abcXYZ123_your_actual_token
```

### Step 4: Start Ngrok Tunnel

```bash
# Start ngrok pointing to your local backend port
ngrok http 5600

# You'll see output like:
# Forwarding https://abcd-1234-5678.ngrok-free.app -> http://localhost:5600
```

### Step 5: Note Your Ngrok URL

```
Your ngrok URL will look like:
https://abcd-1234-5678.ngrok-free.app

IMPORTANT: This URL changes every time you restart ngrok (free tier)
```

---

## 3. Environment Configuration

### File Locations to Update

You need to configure the ngrok URL in **3 places**:

1. ✅ Environment variables (.env file)
2. ✅ PhonePe Dashboard (merchant portal)
3. ✅ PhonePe service configuration (code)

---

### Configuration 1: Update .env File

**File**: `.env` (root directory)

```bash
# ==================================
# LOCAL TESTING WITH NGROK
# ==================================

# Your ngrok URL (update this every time ngrok restarts)
NGROK_URL=https://abcd-1234-5678.ngrok-free.app

# PhonePe Configuration (Test Environment)
PHONEPE_ENVIRONMENT=SANDBOX  # or UAT
PHONEPE_MERCHANT_ID=your_test_merchant_id
PHONEPE_SALT_KEY=your_test_salt_key
PHONEPE_KEY_INDEX=1

# OR if using SDK
PHONEPE_CLIENT_ID=your_client_id
PHONEPE_CLIENT_SECRET=your_client_secret
PHONEPE_CLIENT_VERSION=1
PHONEPE_USE_SDK=true

# PhonePe Callback URLs (use ngrok URL)
REDIRECT_URL_SUCCESS=${NGROK_URL}/payment/success
REDIRECT_URL_FAILURE=${NGROK_URL}/payment/failure
REDIRECT_URL_PAYMENT_STATUS=${NGROK_URL}

# Database
DATABASE_URL=your_database_url

# Server Port
PORT=5600
```

**IMPORTANT**: Update `NGROK_URL` every time you restart ngrok!

---

### Configuration 2: PhonePe Service Configuration

**File**: `src/services/phonepe.service.ts`

**Current Configuration** (Lines 24-49):
```typescript
const PHONEPE_CONFIG = {
  // ... other config

  // Redirect URLs
  REDIRECT_SUCCESS:
    process.env.REDIRECT_URL_SUCCESS || "http://localhost:5600/payment/success",
  REDIRECT_FAILURE:
    process.env.REDIRECT_URL_FAILURE || "http://localhost:5600/payment/failure",
  REDIRECT_STATUS:
    process.env.REDIRECT_URL_PAYMENT_STATUS || "http://localhost:5600",
};
```

**No code changes needed!** The configuration already reads from environment variables.

Just make sure your `.env` file has the ngrok URLs:
```bash
REDIRECT_URL_PAYMENT_STATUS=https://abcd-1234-5678.ngrok-free.app
```

---

### Configuration 3: PhonePe Dashboard

**Where**: PhonePe Merchant Dashboard → Settings → Webhooks/Callbacks

#### Callback URL Configuration

1. Login to PhonePe Merchant Dashboard
   - URL: https://business.phonepe.com/ (or test environment URL)

2. Navigate to: **Settings** → **API Configuration** → **Webhook URLs**

3. Set Callback URL:
   ```
   Payment Callback URL: https://abcd-1234-5678.ngrok-free.app/v1/phonepe/callback/{transactionId}
   ```

4. Set Webhook URL (if available):
   ```
   Webhook URL: https://abcd-1234-5678.ngrok-free.app/v1/phonepe/webhook
   ```

5. Save configuration

**Note**: You'll need to update this in PhonePe dashboard every time ngrok restarts (free tier gets new URL).

---

## 4. Complete Testing Setup

### Terminal Setup (4 Windows)

#### Terminal 1: Ngrok
```bash
cd /Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend

# Start ngrok
ngrok http 5600

# Keep this running, note the URL
# Example: https://abcd-1234-5678.ngrok-free.app
```

#### Terminal 2: Backend Server
```bash
cd /Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend

# Update .env with ngrok URL first!
# Then start server
npm run dev

# Server starts on http://localhost:5600
# But accessible via https://abcd-1234-5678.ngrok-free.app
```

#### Terminal 3: Database Monitoring
```bash
# Connect to your database
# Monitor platformStock table in real-time

# Example for PostgreSQL:
psql $DATABASE_URL

# Then run:
SELECT 
  productid,
  platform,
  availableqty,
  lockqty,
  orderedqty,
  (availableqty - lockqty) as actual_available,
  modifieddate
FROM "platformStock"
WHERE productid = 101 AND platform = 'nivapp';

# Run this query repeatedly to see changes
# Or use: \watch 1  (auto-refresh every 1 second)
```

#### Terminal 4: Server Logs
```bash
# Tail server logs
cd /Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend

# If using separate log file:
tail -f logs/app.log

# Or just watch Terminal 2 output
```

---

## 5. Testing Workflow

### Quick Start Checklist

```bash
# 1. Start ngrok
Terminal 1: ngrok http 5600

# 2. Copy ngrok URL
Note: https://abcd-1234-5678.ngrok-free.app

# 3. Update .env
NGROK_URL=https://abcd-1234-5678.ngrok-free.app
REDIRECT_URL_PAYMENT_STATUS=https://abcd-1234-5678.ngrok-free.app

# 4. Update PhonePe Dashboard
Callback URL: https://abcd-1234-5678.ngrok-free.app/v1/phonepe/callback/{transactionId}

# 5. Start server
Terminal 2: npm run dev

# 6. Verify connection
curl https://abcd-1234-5678.ngrok-free.app/v1/phonepe/health

# 7. Ready to test!
```

---

## 6. Race Condition Test Scenarios

### Test 1: Sequential Orders (Baseline)

**Purpose**: Verify existing functionality works

```bash
# Setup database
psql $DATABASE_URL -c "
UPDATE \"platformStock\" 
SET availableqty = 10, lockqty = 0, orderedqty = 0
WHERE productid = 101 AND platform = 'nivapp';
"

# User 1 order
curl -X POST https://YOUR_NGROK_URL.ngrok-free.app/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "phonepe",
    "evaluation_ids": [],
    "order": [
      {
        "addressid": 1,
        "cartId": 1,
        "discountamount": 0,
        "orderamount": 700,
        "productamount": 100,
        "productcategory": "Electronics",
        "productid": 101,
        "productname": "Test Product",
        "quantity": 7,
        "userid": 1
      }
    ],
    "transaction": {
      "amount": 700,
      "mobilenumber": "9999999999",
      "name": "Test User 1",
      "productid": [101],
      "transactionfor": "product",
      "userId": 1
    }
  }'

# Wait 5 seconds, then User 2 order
sleep 5

curl -X POST https://YOUR_NGROK_URL.ngrok-free.app/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "phonepe",
    "evaluation_ids": [],
    "order": [
      {
        "addressid": 2,
        "cartId": 2,
        "discountamount": 0,
        "orderamount": 600,
        "productamount": 100,
        "productcategory": "Electronics",
        "productid": 101,
        "productname": "Test Product",
        "quantity": 6,
        "userid": 2
      }
    ],
    "transaction": {
      "amount": 600,
      "mobilenumber": "8888888888",
      "name": "Test User 2",
      "productid": [101],
      "transactionfor": "product",
      "userId": 2
    }
  }'

# Expected Result:
# User 1: Success ✅
# User 2: Error "Insufficient stock" ❌
```

---

### Test 2: Simultaneous Orders (Race Condition Test)

**Purpose**: Test race condition fix

Create a test script for simultaneous requests:

**File**: `test_race_condition.sh`

```bash
#!/bin/bash

# Race Condition Test Script
# Tests simultaneous orders to verify SELECT FOR UPDATE fix

# Configuration
NGROK_URL="https://YOUR_NGROK_URL.ngrok-free.app"
PRODUCT_ID=101
AVAILABLE_QTY=10
USER1_QTY=7
USER2_QTY=6

echo "=========================================="
echo "Race Condition Test"
echo "=========================================="
echo "Available Qty: $AVAILABLE_QTY"
echo "User 1 wants: $USER1_QTY"
echo "User 2 wants: $USER2_QTY"
echo "Total requested: $((USER1_QTY + USER2_QTY))"
echo "Expected: Only User 1 should succeed"
echo "=========================================="

# Reset database
echo "Resetting platformStock..."
psql $DATABASE_URL -c "
UPDATE \"platformStock\" 
SET availableqty = $AVAILABLE_QTY, lockqty = 0, orderedqty = 0
WHERE productid = $PRODUCT_ID AND platform = 'nivapp';
"

echo "Starting simultaneous requests..."
echo ""

# User 1 request (background)
curl -X POST $NGROK_URL/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d "{
    \"mode\": \"phonepe\",
    \"evaluation_ids\": [],
    \"order\": [{
      \"addressid\": 1,
      \"cartId\": 1,
      \"discountamount\": 0,
      \"orderamount\": 700,
      \"productamount\": 100,
      \"productcategory\": \"Electronics\",
      \"productid\": $PRODUCT_ID,
      \"productname\": \"Test Product\",
      \"quantity\": $USER1_QTY,
      \"userid\": 1
    }],
    \"transaction\": {
      \"amount\": 700,
      \"mobilenumber\": \"9999999999\",
      \"name\": \"Test User 1\",
      \"productid\": [$PRODUCT_ID],
      \"transactionfor\": \"product\",
      \"userId\": 1
    }
  }" > user1_response.json 2>&1 &

# User 2 request (background, nearly simultaneous)
sleep 0.01  # 10ms delay to simulate near-simultaneous

curl -X POST $NGROK_URL/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d "{
    \"mode\": \"phonepe\",
    \"evaluation_ids\": [],
    \"order\": [{
      \"addressid\": 2,
      \"cartId\": 2,
      \"discountamount\": 0,
      \"orderamount\": 600,
      \"productamount\": 100,
      \"productcategory\": \"Electronics\",
      \"productid\": $PRODUCT_ID,
      \"productname\": \"Test Product\",
      \"quantity\": $USER2_QTY,
      \"userid\": 2
    }],
    \"transaction\": {
      \"amount\": 600,
      \"mobilenumber\": \"8888888888\",
      \"name\": \"Test User 2\",
      \"productid\": [$PRODUCT_ID],
      \"transactionfor\": \"product\",
      \"userId\": 2
    }
  }" > user2_response.json 2>&1 &

# Wait for both to complete
wait

echo ""
echo "=========================================="
echo "Results:"
echo "=========================================="

echo ""
echo "User 1 Response:"
cat user1_response.json | jq '.'

echo ""
echo "User 2 Response:"
cat user2_response.json | jq '.'

echo ""
echo "=========================================="
echo "Database State:"
echo "=========================================="

psql $DATABASE_URL -c "
SELECT 
  productid,
  platform,
  availableqty,
  lockqty,
  orderedqty,
  (availableqty - lockqty) as actual_available,
  CASE 
    WHEN lockqty = $USER1_QTY THEN '✅ CORRECT (only User 1)'
    WHEN lockqty = $((USER1_QTY + USER2_QTY)) THEN '❌ WRONG (both users)'
    ELSE '⚠️  UNEXPECTED'
  END as validation
FROM \"platformStock\"
WHERE productid = $PRODUCT_ID AND platform = 'nivapp';
"

echo ""
echo "=========================================="
echo "Test Complete"
echo "=========================================="

# Cleanup
rm user1_response.json user2_response.json
```

**Usage**:
```bash
# Make executable
chmod +x test_race_condition.sh

# Update NGROK_URL in script
nano test_race_condition.sh

# Run test
./test_race_condition.sh
```

---

### Test 3: Three Concurrent Users

**File**: `test_three_users.sh`

```bash
#!/bin/bash

NGROK_URL="https://YOUR_NGROK_URL.ngrok-free.app"

echo "Testing 3 concurrent users..."
echo "Available: 10, User1: 4, User2: 5, User3: 3"
echo "Expected: 2 succeed (total ≤10), 1 fails"

# Reset
psql $DATABASE_URL -c "
UPDATE \"platformStock\" 
SET availableqty = 10, lockqty = 0
WHERE productid = 101 AND platform = 'nivapp';
"

# Launch 3 requests simultaneously
curl -X POST $NGROK_URL/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d '{"mode":"phonepe","order":[{"productid":101,"quantity":4,...}],...}' > user1.json &

curl -X POST $NGROK_URL/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d '{"mode":"phonepe","order":[{"productid":101,"quantity":5,...}],...}' > user2.json &

curl -X POST $NGROK_URL/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d '{"mode":"phonepe","order":[{"productid":101,"quantity":3,...}],...}' > user3.json &

wait

echo "User 1 Result:"
jq '.success' user1.json

echo "User 2 Result:"
jq '.success' user2.json

echo "User 3 Result:"
jq '.success' user3.json

rm user*.json
```

---

## 7. Monitoring During Tests

### Server Logs to Watch

Look for these log messages in Terminal 2:

#### BEFORE FIX:
```json
// Both users read same state ❌
{
  "productId": 101,
  "currentAvailableQty": 10,
  "currentLockQty": 0,
  "actualAvailable": 10,
  "requestedQuantity": 7,
  "msg": "Stock locked successfully for product"
}

{
  "productId": 101,
  "currentAvailableQty": 10,  // ← STALE! Should be 3
  "currentLockQty": 0,         // ← STALE! Should be 7
  "actualAvailable": 10,       // ← WRONG!
  "requestedQuantity": 6,
  "msg": "Stock locked successfully for product"
}
```

#### AFTER FIX:
```json
// User 1 succeeds
{
  "productId": 101,
  "currentAvailableQty": 10,
  "currentLockQty": 0,
  "actualAvailable": 10,
  "requestedQuantity": 7,
  "lockAcquired": true,  // ← NEW: Lock acquired
  "msg": "Row lock acquired for platformStock - reading fresh data"
}

// User 2 fails with fresh data ✅
{
  "productId": 101,
  "currentAvailableQty": 3,   // ← FRESH! Updated by User 1
  "currentLockQty": 7,         // ← FRESH! Updated by User 1
  "actualAvailable": 0,        // ← CORRECT!
  "requestedQuantity": 6,
  "lockAcquired": true,
  "msg": "Row lock acquired for platformStock - reading fresh data"
}

{
  "error": "Insufficient stock during locking: Available 0, Requested 6",
  "msg": "Failed to lock stock for product"
}
```

---

### Database Queries During Test

**Terminal 3**: Run this query to watch changes in real-time

```sql
-- PostgreSQL: Auto-refresh every 1 second
\watch 1

SELECT 
  productid,
  platform,
  availableqty,
  lockqty,
  orderedqty,
  (availableqty - lockqty) as actual_available,
  to_timestamp(modifieddate::bigint / 1000) as last_modified
FROM "platformStock"
WHERE productid = 101 AND platform = 'nivapp';
```

**Expected Output** (after User 1 succeeds, User 2 fails):
```
 productid | platform | availableqty | lockqty | orderedqty | actual_available | last_modified
-----------+----------+--------------+---------+------------+------------------+------------------
   101     | nivapp   |      3       |    7    |     0      |        0         | 2025-10-16 ...

✅ CORRECT: Only 7 locked (User 1), not 13!
```

---

## 8. Verification Checklist

### After Running Tests

- [ ] **User 1 Response**: Success with redirectUrl ✅
- [ ] **User 2 Response**: Error "Insufficient stock" ❌
- [ ] **Database lockqty**: Equals User 1 qty (7), not User 1 + User 2 (13) ✅
- [ ] **Server Logs**: Show "Row lock acquired" messages ✅
- [ ] **Transaction Table**: User 2 status = "FAILED" or no record ✅
- [ ] **No Overselling**: (availableqty - lockqty) >= 0 ✅

---

## 9. Troubleshooting

### Issue 1: Ngrok URL Changes

**Problem**: Ngrok URL changes every restart (free tier)

**Solution**:
```bash
# Option 1: Use paid ngrok (static URL)
ngrok http 5600 --subdomain=your-custom-name

# Option 2: Update URLs script
# File: update_ngrok_urls.sh

#!/bin/bash
NEW_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
echo "New ngrok URL: $NEW_URL"

# Update .env
sed -i '' "s|NGROK_URL=.*|NGROK_URL=$NEW_URL|g" .env
sed -i '' "s|REDIRECT_URL_PAYMENT_STATUS=.*|REDIRECT_URL_PAYMENT_STATUS=$NEW_URL|g" .env

echo "Updated .env file"
echo "⚠️  Don't forget to update PhonePe Dashboard!"
```

---

### Issue 2: PhonePe Callback Not Received

**Symptoms**: Payment completes but callback not called

**Check**:
1. Ngrok is running:
   ```bash
   curl https://YOUR_NGROK_URL.ngrok-free.app/health
   ```

2. Callback URL correct in PhonePe Dashboard

3. Server logs show callback:
   ```
   "Payment callback received for transaction: TXN_..."
   ```

4. Ngrok logs show request:
   ```
   POST /v1/phonepe/callback/TXN_... 200 OK
   ```

---

### Issue 3: Database Connection from Ngrok

**Problem**: Server can't connect to database through ngrok

**Solution**: Database connection is DIRECT, not through ngrok:
```
Your laptop → ngrok tunnel → Your laptop (server)
                               ↓
                          Database (direct connection)
```

Ngrok only tunnels HTTP requests, not database connections.

---

### Issue 4: CORS Issues with Ngrok

**Problem**: Frontend can't call ngrok URL

**Solution**: Update CORS in `server.ts`:
```typescript
fastify.register(cors, {
  origin: [
    'http://localhost:3000',
    'https://*.ngrok-free.app',  // Add this
    'https://*.ngrok.io'         // Add this
  ],
  credentials: true
});
```

---

## 10. Production Deployment Notes

### Differences from Local Testing

| Aspect | Local (ngrok) | Production |
|--------|---------------|------------|
| **URL** | https://random.ngrok-free.app | https://api.yourcompany.com |
| **SSL** | Ngrok provides | Your SSL certificate |
| **Callback** | Ngrok tunnel | Direct to server |
| **PhonePe Config** | Test environment | Production environment |
| **Database** | Local/dev database | Production database |

### Before Production Deploy

1. ✅ Remove ngrok URLs from .env
2. ✅ Update PhonePe Dashboard with production URLs
3. ✅ Use production PhonePe credentials
4. ✅ Test SSL certificate working
5. ✅ Verify callback URLs are HTTPS

---

## 11. Summary: Complete Testing Flow

### Setup (One Time)
```bash
# 1. Install ngrok
brew install ngrok

# 2. Configure ngrok authtoken
ngrok config add-authtoken YOUR_TOKEN

# 3. Create test scripts
# Copy test_race_condition.sh from above
```

### Every Test Session
```bash
# 1. Start ngrok
ngrok http 5600
# Note URL: https://abcd-1234.ngrok-free.app

# 2. Update .env
NGROK_URL=https://abcd-1234.ngrok-free.app
REDIRECT_URL_PAYMENT_STATUS=https://abcd-1234.ngrok-free.app

# 3. Update PhonePe Dashboard
# Callback URL: https://abcd-1234.ngrok-free.app/v1/phonepe/callback/{transactionId}

# 4. Start server
npm run dev

# 5. Run tests
./test_race_condition.sh

# 6. Check results
# User 2 should fail with "Insufficient stock" ✅
```

---

## 12. Configuration Summary

### Places to Configure Ngrok URL

| Location | File/Place | Configuration |
|----------|-----------|---------------|
| **1. Environment** | `.env` | `NGROK_URL=https://...`<br>`REDIRECT_URL_PAYMENT_STATUS=https://...` |
| **2. PhonePe Dashboard** | business.phonepe.com | Callback URL: `https://.../v1/phonepe/callback/{id}` |
| **3. Testing Scripts** | `test_*.sh` | Update `NGROK_URL` variable |

### No Code Changes Needed! ✅

The code already reads from environment variables:
- `process.env.REDIRECT_URL_PAYMENT_STATUS`
- `process.env.REDIRECT_URL_SUCCESS`
- `process.env.REDIRECT_URL_FAILURE`

---

**Document Version**: 1.0  
**Status**: Ready for Local Testing  
**Next**: Apply race condition fix → Test with this setup  

---

