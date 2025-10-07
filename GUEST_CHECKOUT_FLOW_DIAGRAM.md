# 🛒 Guest Checkout Flow - Visual Diagram

## Complete Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER BROWSING PRODUCTS                           │
│                     (Not logged in, adds to cart)                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CART PAGE                                      │
│  Items in cart, user clicks "Proceed to Checkout"                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION MODAL                                  │
│                                                                          │
│     ┌──────────────────────────────────────────────────────┐           │
│     │  Authentication Required                              │           │
│     │                                                       │           │
│     │  Please login or continue as guest                   │           │
│     │                                                       │           │
│     │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │           │
│     │  │  Login   │  │  Cancel  │  │ Continue as Guest│  │           │
│     │  └──────────┘  └──────────┘  └──────────────────┘  │           │
│     └──────────────────────────────────────────────────────┘           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
                ▼                                 ▼
      ┌──────────────────┐            ┌──────────────────────┐
      │   User Clicks    │            │   User Clicks        │
      │     LOGIN        │            │  CONTINUE AS GUEST   │
      └────────┬─────────┘            └──────────┬───────────┘
               │                                  │
               ▼                                  ▼
      ┌──────────────────┐            ┌──────────────────────────────────┐
      │  Regular Login   │            │   GUEST INFO COLLECTION MODAL    │
      │      Flow        │            │                                   │
      │  (Existing)      │            │  ┌─────────────────────────────┐ │
      └──────────────────┘            │  │ Name:  [_______________]    │ │
                                      │  │ Email: [_______________]    │ │
                                      │  │        (optional)           │ │
                                      │  │ Phone: [_______________]    │ │
                                      │  │        (required)           │ │
                                      │  │                             │ │
                                      │  │  [Submit]      [Cancel]    │ │
                                      │  └─────────────────────────────┘ │
                                      └──────────┬───────────────────────┘
                                                 │
                                                 ▼
                                      ┌──────────────────────────────────┐
                                      │  POST /v1/users/guest            │
                                      │  {                               │
                                      │    firstname: "John",            │
                                      │    useremail: "j@example.com",   │
                                      │    usermobilenumber: 1234567890  │
                                      │  }                               │
                                      └──────────┬───────────────────────┘
                                                 │
                                                 ▼
                                      ┌──────────────────────────────────┐
                                      │  BACKEND PROCESSING              │
                                      │  - Check if phone exists         │
                                      │  - Create user with isguest=true │
                                      │  - Return guest user ID          │
                                      └──────────┬───────────────────────┘
                                                 │
                                                 ▼
                                      ┌──────────────────────────────────┐
                                      │  ✅ GUEST USER CREATED           │
                                      │  User ID: 123                    │
                                      │  isguest: true                   │
                                      │  Store ID in state/localStorage  │
                                      └──────────┬───────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ADDRESS ENTRY STEP                               │
│  Since guest has no saved addresses, ask for delivery address:          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Name:         [_______________________________]               │    │
│  │  Mobile:       [_______________________________]               │    │
│  │  Door Number:  [_______________________________]               │    │
│  │  Address:      [_______________________________]               │    │
│  │  Landmark:     [_______________________________]               │    │
│  │  City:         [_______________________________]               │    │
│  │  State:        [_______________________________]               │    │
│  │  Pincode:      [_______________________________]               │    │
│  │                                                                 │    │
│  │               [Continue to Payment]                            │    │
│  └────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────────────────┐
                      │  POST /v1/addresses              │
                      │  {                               │
                      │    userid: 123,  ← Guest user ID │
                      │    name: "John",                 │
                      │    address: "123 Main St",       │
                      │    city: "Mumbai",               │
                      │    state: "Maharashtra"          │
                      │  }                               │
                      └──────────┬───────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────────────────┐
                      │  ✅ ADDRESS CREATED              │
                      │  Address ID: 456                 │
                      │  Linked to guest user 123        │
                      └──────────┬───────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT STEP                                   │
│  Process payment via PhonePe / COD / Other                              │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Order Summary:                                                 │    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                   │    │
│  │  Product 1         ₹500                                         │    │
│  │  Product 2         ₹1000                                        │    │
│  │                    ━━━━                                         │    │
│  │  Total:            ₹1500                                        │    │
│  │                                                                 │    │
│  │  Delivery Address:                                             │    │
│  │  John, 123 Main St, Mumbai, Maharashtra                        │    │
│  │                                                                 │    │
│  │  ┌─────────────┐  ┌─────────────┐                             │    │
│  │  │   PhonePe   │  │     COD     │                             │    │
│  │  └─────────────┘  └─────────────┘                             │    │
│  └────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────────────────┐
                      │  POST /v1/orders                 │
                      │  {                               │
                      │    userid: 123,  ← Guest user    │
                      │    addressid: 456,               │
                      │    orderamount: 1500,            │
                      │    productid: [1, 2],            │
                      │    orderstatus: "pending"        │
                      │  }                               │
                      └──────────┬───────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────────────────┐
                      │  ✅ ORDER PLACED SUCCESSFULLY    │
                      │  Order ID: ORD-12345             │
                      │  Status: Payment Pending/Success │
                      └──────────┬───────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      ORDER CONFIRMATION PAGE                             │
│  ✅ Order placed successfully!                                          │
│  Order ID: ORD-12345                                                    │
│  We'll send updates to your phone: +91 1234567890                       │
└─────────────────────────────────────────────────────────────────────────┘


═════════════════════════════════════════════════════════════════════════
                    LATER: GUEST USER REGISTERS
═════════════════════════════════════════════════════════════════════════

                      ┌──────────────────────────────────┐
                      │  Guest user decides to register  │
                      │  with SAME phone number          │
                      └──────────┬───────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────────────────┐
                      │  User logs in / registers with   │
                      │  Phone: 1234567890               │
                      └──────────┬───────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────────────────┐
                      │  BACKEND FINDS GUEST USER        │
                      │  - Matches phone number          │
                      │  - User ID: 123                  │
                      │  - isguest: true                 │
                      └──────────┬───────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────────────────┐
                      │  OPTION 1: Auto-login as guest   │
                      │  Show all past guest orders      │
                      │                                  │
                      │  OPTION 2: Convert to registered │
                      │  POST /v1/users/123/convert...   │
                      │  {                               │
                      │    useremail: "j@example.com",   │
                      │    userpassword: "Pass123!"      │
                      │  }                               │
                      └──────────┬───────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MY ORDERS PAGE                                   │
│  ✅ All guest orders now visible under registered account!              │
│                                                                          │
│  Order History:                                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                    │
│  📦 ORD-12345  |  ₹1500  |  Delivered  |  (Guest Order) ✅              │
│  📦 ORD-67890  |  ₹2000  |  Processing |  (New Order)                   │
│                                                                          │
│  User ID: 123                                                           │
│  Status: Registered (was guest) ✅                                      │
│  isguest: false                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Flow Points

### ✅ **Guest User Creation**
- Minimal info required (name + phone)
- Creates user with `isguest=true`
- Stores user ID for subsequent calls

### ✅ **Checkout Process**
- Uses **existing** address endpoint
- Uses **existing** order endpoint
- No special guest-specific logic needed

### ✅ **Order Linking**
- Orders linked by `userid`
- When user registers with same phone, all orders appear
- Automatic order history preservation

---

## Database State at Each Step

### After Guest User Creation
```
users table:
┌────┬───────────┬──────────────┬─────────┐
│ id │ firstname │ phone        │ isguest │
├────┼───────────┼──────────────┼─────────┤
│123 │ John      │ 1234567890   │ true    │
└────┴───────────┴──────────────┴─────────┘
```

### After Address Creation
```
address table:
┌────┬────────┬────────────┬─────────────────┐
│ id │ userid │ name       │ address         │
├────┼────────┼────────────┼─────────────────┤
│456 │ 123    │ John       │ 123 Main St     │
└────┴────────┴────────────┴─────────────────┘
```

### After Order Creation
```
orders table:
┌────┬────────┬───────────┬───────────┬────────┐
│ id │ userid │ orderid   │ amount    │ status │
├────┼────────┼───────────┼───────────┼────────┤
│ 1  │ 123    │ ORD-12345 │ 1500      │ paid   │
└────┴────────┴───────────┴───────────┴────────┘
```

### After Conversion to Registered
```
users table:
┌────┬───────────┬────────────────┬──────────────┬─────────┐
│ id │ firstname │ email          │ phone        │ isguest │
├────┼───────────┼────────────────┼──────────────┼─────────┤
│123 │ John      │ j@example.com  │ 1234567890   │ false   │ ← Updated!
└────┴───────────┴────────────────┴──────────────┴─────────┘

orders table: (Unchanged - orders still linked to userid 123)
┌────┬────────┬───────────┬───────────┬────────┐
│ id │ userid │ orderid   │ amount    │ status │
├────┼────────┼───────────┼───────────┼────────┤
│ 1  │ 123    │ ORD-12345 │ 1500      │ paid   │ ← Still visible!
└────┴────────┴───────────┴───────────┴────────┘
```

---

## API Calls Summary

### Frontend Must Call:

1. **Create Guest User**
   ```
   POST /v1/users/guest
   ```

2. **Create Address** (existing endpoint)
   ```
   POST /v1/addresses
   ```

3. **Create Order** (existing endpoint)
   ```
   POST /v1/orders
   ```

4. **Optional: Convert Guest** (when user registers later)
   ```
   POST /v1/users/:id/convert-to-registered
   ```

---

## Benefits Summary

| Aspect | Benefit |
|--------|---------|
| **Backend** | Minimal changes, no code duplication |
| **Frontend** | Reuse existing flows, one new API call |
| **User** | Fast checkout, no forced registration |
| **Orders** | Automatically preserved and linked |
| **Maintenance** | Simple flag-based logic |

---

## Next Steps

1. ✅ Backend implementation: **COMPLETE**
2. ⏳ Frontend implementation: **Your turn!**
3. ⏳ Testing: Run `node test_guest_checkout.cjs`
4. ⏳ UI/UX: Design the guest info modal
5. ⏳ Integration: Connect to existing flows

---

**Need more details?** See:
- `GUEST_CHECKOUT_DOCUMENTATION.md` - Complete API reference
- `GUEST_CHECKOUT_SUMMARY.md` - Quick implementation guide
- `test_guest_checkout.cjs` - Automated test script

