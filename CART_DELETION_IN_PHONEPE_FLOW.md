# Cart Deletion in PhonePe Payment Flow

## 📋 Current Status

**⚠️ IMPORTANT:** Cart data is **NOT automatically deleted** in the PhonePe initiate or callback routes on the backend.

---

## 🔍 Current Implementation

### Backend (PhonePe Routes)

#### 1. **POST /v1/phonepe/initiate** (`src/controllers/phonepe.controller.ts`)

**Cart Deletion:** ❌ **NOT DELETED**

**Flow:**
1. Validates promotions
2. Validates products & stock
3. Locks stock
4. Creates transaction record
5. For COD: Creates order immediately
6. For PhonePe: Returns redirectUrl
7. **Cart items remain in database**

**Code Location:** `src/controllers/phonepe.controller.ts:28-1191`

**No cart deletion code found:**
```typescript
// ❌ No CartService.clearCartByUserId() call
// ❌ No cart deletion in initiate endpoint
```

---

#### 2. **ALL /v1/phonepe/callback/:transactionId** (`src/routes/phonepe.route.ts`)

**Cart Deletion:** ❌ **NOT DELETED**

**Flow:**
1. Checks transaction status
2. Verifies payment with PhonePe
3. Updates transaction to SUCCESS
4. Creates order via `createOrderAfterPayment()`
5. Updates product quantities
6. **Cart items remain in database**

**Code Location:** `src/routes/phonepe.route.ts:483-889`

**No cart deletion code found:**
```typescript
// ❌ No CartService.clearCartByUserId() call
// ❌ No cart deletion in callback endpoint
```

---

#### 3. **createOrderAfterPayment()** (`src/controllers/phonepe.controller.ts`)

**Cart Deletion:** ❌ **NOT DELETED**

**Flow:**
1. Retrieves transaction data
2. Validates products
3. Calculates order totals
4. Creates order & orderlines
5. Redeems promotions
6. **Cart items remain in database**

**Code Location:** `src/controllers/phonepe.controller.ts:1982-3200`

**No cart deletion code found:**
```typescript
// ❌ No CartService.clearCartByUserId() call
// ❌ No cart deletion after order creation
```

---

### Frontend (React Native)

**Cart Deletion:** ✅ **HANDLED ON FRONTEND**

According to `PHONEPE_BACKEND_FEATURES_FOR_REACT_NATIVE.md`:

```typescript
const handlePaymentSuccess = (data) => {
  setPaymentStatus("success");
  
  navigation.navigate("OrderSuccess", {
    transactionId: data.merchantTransactionId,
    amount: data.paymentData?.amount / 100,
    orderId: data.orderId,
  });

  // Clear cart - FRONTEND RESPONSIBILITY
  clearCart();  // ✅ Called on frontend
};

const handleCODSuccess = (data) => {
  setPaymentStatus("success");
  
  navigation.navigate("OrderSuccess", {
    orderId: data.orderData.orderId,
    orderIdDisplay: data.orderData.orderid,
    amount: totalAmount,
    mode: "cod",
  });

  clearCart();  // ✅ Called on frontend
};
```

**Location:** Frontend code (not in backend repository)

---

## 🛠️ Available Cart Service Method

### `CartService.clearCartByUserId()`

**Location:** `src/services/cart.service.ts:423-449`

**Method:**
```typescript
async clearCartByUserId(userId: string) {
  // Find all cart items for the user
  const { data: cartItems } = await dynamicFindManyWithFilters('cart', {
    userid: parseInt(userId),
    iscart: true
  }, { useAllColumns: true });

  // Delete each cart item
  for (const item of cartItems) {
    await dynamicDelete('cart', { id: item.id });
  }

  return { deletedCount: cartItems.length };
}
```

**Current Usage:**
- ✅ Available via API: `DELETE /v1/carts/user/:userId/clear`
- ❌ **NOT called from PhonePe flow**

---

## ⚠️ Potential Issues

### 1. **Cart Not Cleared on Backend**

**Problem:**
- If frontend fails to call `clearCart()` (network error, app crash, etc.)
- Cart items remain in database even after successful order
- User sees old cart items on next app launch

**Impact:**
- User confusion
- Potential duplicate orders
- Data inconsistency

### 2. **Race Conditions**

**Problem:**
- Frontend might clear cart before order is fully created
- If order creation fails, cart is already cleared
- User loses cart items without getting order

**Impact:**
- Data loss
- Poor user experience

---

## ✅ Recommended Solution

### Option 1: Clear Cart After Successful Order Creation (Backend)

**Add cart deletion in `createOrderAfterPayment()` after order creation:**

```typescript
// In src/controllers/phonepe.controller.ts:createOrderAfterPayment()

// After order creation (line ~2643)
const order = await this.ordersService.create(orderData);

// ✅ ADD: Clear cart after successful order creation
try {
  const { CartService } = await import('../services/cart.service.js');
  const cartService = new CartService();
  
  await cartService.clearCartByUserId(transaction.userid.toString());
  
  logger.info({
    transactionId,
    orderId: order.id,
    userId: transaction.userid,
    note: 'Cart cleared after successful order creation'
  }, 'Cart cleared successfully');
} catch (cartError) {
  // Non-critical: Log but don't fail order creation
  logger.warn({
    transactionId,
    orderId: order.id,
    userId: transaction.userid,
    error: cartError instanceof Error ? cartError.message : 'Unknown error'
  }, 'Failed to clear cart after order creation (non-critical)');
}
```

**Location:** `src/controllers/phonepe.controller.ts:2643` (after order creation)

**Benefits:**
- ✅ Ensures cart is cleared even if frontend fails
- ✅ Single source of truth (backend)
- ✅ Data consistency

**Considerations:**
- Should be non-blocking (don't fail order if cart clear fails)
- Should log errors for monitoring

---

### Option 2: Clear Cart in Callback Route (After Order Creation)

**Add cart deletion in callback route after order creation:**

```typescript
// In src/routes/phonepe.route.ts (after order creation)

if (orderCreationStatus === "success" && orderId) {
  // ✅ ADD: Clear cart after successful order creation
  try {
    const { CartService } = await import('../services/cart.service.js');
    const cartService = new CartService();
    
    await cartService.clearCartByUserId(transaction.userid.toString());
    
    fastify.log.info({
      transactionId,
      orderId,
      userId: transaction.userid
    }, 'Cart cleared after successful order creation');
  } catch (cartError) {
    // Non-critical: Log but don't fail
    fastify.log.warn({
      transactionId,
      orderId,
      error: cartError instanceof Error ? cartError.message : 'Unknown error'
    }, 'Failed to clear cart (non-critical)');
  }
  
  // Redirect to success page
  return reply.redirect(successUrl);
}
```

**Location:** `src/routes/phonepe.route.ts:700-750` (after order creation)

---

### Option 3: Keep Frontend-Only (Current)

**Keep current implementation:**
- Frontend clears cart after receiving success response
- Backend doesn't clear cart

**Pros:**
- Simpler backend
- Frontend has control

**Cons:**
- Risk of cart not being cleared if frontend fails
- Data inconsistency

---

## 📊 Comparison

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Backend (Option 1)** | ✅ Guaranteed cleanup<br>✅ Data consistency<br>✅ Single source of truth | ⚠️ Additional DB operation | **✅ RECOMMENDED** |
| **Backend (Option 2)** | ✅ Guaranteed cleanup<br>✅ In callback route | ⚠️ Only for PhonePe (not COD)<br>⚠️ Additional DB operation | ⚠️ Partial solution |
| **Frontend Only** | ✅ Simple<br>✅ Frontend control | ❌ Can fail silently<br>❌ Data inconsistency | ❌ Not recommended |

---

## 🔧 Implementation Steps (Recommended: Option 1)

1. **Import CartService in PhonePe Controller:**
   ```typescript
   // At top of file or in createOrderAfterPayment()
   const { CartService } = await import('../services/cart.service.js');
   const cartService = new CartService();
   ```

2. **Add cart clearing after order creation:**
   ```typescript
   // After line 2643 in phonepe.controller.ts
   const order = await this.ordersService.create(orderData);
   
   // Clear cart (non-blocking)
   try {
     await cartService.clearCartByUserId(transaction.userid.toString());
     logger.info({ orderId: order.id, userId: transaction.userid }, 'Cart cleared');
   } catch (error) {
     logger.warn({ error, orderId: order.id }, 'Cart clear failed (non-critical)');
   }
   ```

3. **Test:**
   - Create order via PhonePe
   - Verify cart is cleared
   - Verify order creation still succeeds if cart clear fails

---

## 📝 Summary

**Current State:**
- ❌ Cart is **NOT deleted** in PhonePe initiate route
- ❌ Cart is **NOT deleted** in PhonePe callback route
- ❌ Cart is **NOT deleted** in `createOrderAfterPayment()`
- ✅ Cart deletion is **handled by frontend** (after successful payment only)

**Frontend Implementation:**
- ✅ PhonePe: Clears cart in `handlePaymentSuccess()` after payment success
- ✅ COD: Clears cart after COD order creation success
- ✅ Cart NOT cleared if payment fails/cancelled (good design)

**Recommended Approach: Hybrid (Frontend + Backend)**
- ✅ **Keep frontend clearing** for immediate UX (user sees cart cleared instantly)
- ✅ **Add backend clearing** as safety net (ensures cart cleared even if frontend fails)
- ✅ Make backend clearing non-blocking (don't fail order if cart clear fails)
- ✅ Log errors for monitoring

**Benefits of Hybrid:**
- ✅ Best UX: Frontend clears immediately
- ✅ Data consistency: Backend ensures cart is cleared even if frontend crashes/disconnects
- ✅ Resilience: Works even if user refreshes page or app crashes
- ✅ No duplicate work: Backend only clears if cart still exists (idempotent)

---

*Last Updated: 2025-12-10*

