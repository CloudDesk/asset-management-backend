# 🛒 Guest User Checkout Flow Documentation

## Overview

The guest checkout feature allows users to complete purchases without creating a full account. This document describes the complete implementation and flow for guest user checkout.

## Architecture Design

### ✅ **Recommended Approach: Use Existing Routes with `isguest` Flag**

We implemented the guest checkout using existing user infrastructure with a simple `isguest` boolean flag. This approach provides:

- **Minimal Backend Changes**: Leverages existing user, address, and order creation flows
- **Code Reuse**: No duplicate services or controllers
- **Easy Conversion**: Simple flag flip when guest becomes registered user
- **Order History Preservation**: Guest orders automatically linked when user registers with same phone

## Database Schema

The `users` table includes the `isguest` field:

```prisma
model users {
  id               Int         @id @default(autoincrement())
  useremail        String?     @unique @db.VarChar(255)
  userpassword     String?     @db.VarChar(255)
  usermobilenumber BigInt?
  firstname        String?     @db.VarChar(500)
  lastname         String?     @db.VarChar(500)
  isguest          Boolean?    // Guest user flag
  // ... other fields
}
```

## API Endpoints

### 1. Create Guest User

**Endpoint**: `POST /v1/users/guest`

**Description**: Creates a guest user with minimal required information.

**Request Body**:
```json
{
  "firstname": "John",
  "useremail": "john@example.com",  // Optional
  "usermobilenumber": 1234567890     // Required
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Guest user created successfully",
  "data": {
    "id": 123,
    "firstname": "John",
    "useremail": "john@example.com",
    "usermobilenumber": 1234567890,
    "isguest": true,
    "createddate": 1696723200000,
    "modifieddate": 1696723200000
  }
}
```

**Error Responses**:
- `409 Conflict`: Phone number already registered (user should login instead)
- `400 Bad Request`: Invalid input data

### 2. Create Address for Guest User

**Endpoint**: `POST /v1/addresses`

**Description**: Creates a delivery address for the guest user (same endpoint as regular users).

**Request Body**:
```json
{
  "userid": 123,
  "name": "John Doe",
  "mobilenumber": 1234567890,
  "doornumber": "123",
  "address": "Main Street",
  "landmark": "Near Park",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": 400001
}
```

### 3. Create Order

**Endpoint**: `POST /v1/orders`

**Description**: Creates an order for the guest user (same endpoint as regular users).

**Request Body**:
```json
{
  "userid": 123,
  "addressid": 456,
  "orderamount": 1500.00,
  "productid": [101, 102],
  "quantity": 2
  // ... other order fields
}
```

### 4. Convert Guest to Registered User

**Endpoint**: `POST /v1/users/:id/convert-to-registered`

**Description**: Converts a guest user to a registered user when they decide to create an account.

**Request Body**:
```json
{
  "useremail": "john@example.com",
  "userpassword": "SecurePassword123!",
  "lastname": "Doe"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Guest user converted to registered user successfully",
  "data": {
    "id": 123,
    "firstname": "John",
    "lastname": "Doe",
    "useremail": "john@example.com",
    "usermobilenumber": 1234567890,
    "isguest": false,
    "modifieddate": 1696723300000
  }
}
```

## Frontend Implementation Flow

### Step-by-Step Checkout Process

```
┌─────────────────────────────────────────────────────────────┐
│                    Cart Page                                 │
│  User clicks "Proceed to Checkout"                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          Show "Authentication Required" Modal                │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐   │
│  │   Login    │  │   Cancel   │  │ Continue as Guest   │   │
│  └────────────┘  └────────────┘  └─────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ User clicks "Continue as Guest"
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Guest User Information Modal                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Name:  [_____________________]                       │    │
│  │ Email: [_____________________] (optional)            │    │
│  │ Phone: [_____________________] (required)            │    │
│  │                                                       │    │
│  │            [Submit]  [Cancel]                        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ POST /v1/users/guest
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          Guest User Created (isguest=true)                   │
│          Store user ID in frontend state                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Address Entry Step                          │
│  Since guest user has no saved addresses:                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Name:      [_____________________]                   │    │
│  │ Mobile:    [_____________________]                   │    │
│  │ Address:   [_____________________]                   │    │
│  │ City:      [_____________________]                   │    │
│  │ State:     [_____________________]                   │    │
│  │ Pincode:   [_____________________]                   │    │
│  │                                                       │    │
│  │            [Continue to Payment]                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ POST /v1/addresses
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Address Created & Linked to Guest User             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Payment Step                              │
│  Process payment (PhonePe / COD)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ POST /v1/orders
                      ▼
┌─────────────────────────────────────────────────────────────┐
│            Order Created & Placed Successfully               │
│          Guest user completes checkout without login         │
└─────────────────────────────────────────────────────────────┘
```

## User Registration After Guest Checkout

### Scenario: Guest User Later Creates Account

When a guest user later decides to register using the **same phone number**, their previous guest orders will automatically appear in their order history.

**Flow**:

1. **Guest Places Order**
   - User creates guest account with phone: `1234567890`
   - Places order as guest user (ID: 123)

2. **Guest Logs In / Registers**
   - User enters same phone number: `1234567890`
   - System finds existing user (ID: 123, `isguest=true`)

3. **Automatic Order Linkage**
   - System recognizes user by phone number
   - All orders with `userid=123` automatically appear in "My Orders"
   - Can optionally convert guest user to registered user

4. **Conversion (Optional)**
   ```bash
   POST /v1/users/123/convert-to-registered
   {
     "useremail": "john@example.com",
     "userpassword": "SecurePassword123!"
   }
   ```

## Code Examples

### Frontend: Create Guest User

```javascript
// When user clicks "Continue as Guest"
async function createGuestUser(guestInfo) {
  try {
    const response = await fetch('http://localhost:5600/v1/users/guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstname: guestInfo.name,
        useremail: guestInfo.email,
        usermobilenumber: parseInt(guestInfo.phone)
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // Store guest user info
      localStorage.setItem('guestUserId', result.data.id);
      localStorage.setItem('isGuest', 'true');
      
      // Proceed to address step
      navigateToAddressStep(result.data.id);
    }
  } catch (error) {
    console.error('Error creating guest user:', error);
  }
}
```

### Frontend: Create Order for Guest

```javascript
async function placeGuestOrder(orderData) {
  const guestUserId = localStorage.getItem('guestUserId');
  
  const response = await fetch('http://localhost:5600/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userid: parseInt(guestUserId),
      addressid: orderData.addressId,
      orderamount: orderData.total,
      productid: orderData.productIds,
      // ... other fields
    })
  });

  const result = await response.json();
  return result;
}
```

### Backend: Query Guest Users

```javascript
// Get all guest users
GET /v1/users?isguest=true

// Get all registered users
GET /v1/users?isguest=false

// Get orders for a specific user (including guest orders)
GET /v1/orders?userid=123
```

## Key Features

### ✅ **What's Implemented**

1. **Guest User Creation**: Minimal fields required (name, phone, optional email)
2. **Existing Infrastructure**: Uses same endpoints as regular users
3. **Address Management**: Guest users can add delivery addresses
4. **Order Placement**: Guest users can complete checkout and place orders
5. **User Conversion**: Guest users can convert to registered users
6. **Order History**: Past guest orders appear when user logs in with same phone
7. **Query Filtering**: Filter users by `isguest` status

### 🔄 **Automatic Behavior**

- **Duplicate Prevention**: If phone number exists, returns existing guest user
- **Phone Validation**: Phone number is required and must be unique
- **Timestamp Management**: Automatic `createddate` and `modifieddate` tracking
- **Order Linking**: Orders automatically linked by `userid` regardless of guest status

## Testing

### Test the Guest Checkout Flow

```bash
# 1. Create a guest user
curl -X POST http://localhost:5600/v1/users/guest \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Guest User",
    "useremail": "guest@example.com",
    "usermobilenumber": 9876543210
  }'

# Response: { "data": { "id": 123, "isguest": true, ... } }

# 2. Create an address for the guest user
curl -X POST http://localhost:5600/v1/addresses \
  -H "Content-Type: application/json" \
  -d '{
    "userid": 123,
    "name": "Guest User",
    "mobilenumber": 9876543210,
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": 400001
  }'

# 3. Create an order for the guest user
curl -X POST http://localhost:5600/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userid": 123,
    "addressid": 456,
    "orderamount": 1500,
    "productid": [1, 2],
    "orderstatus": "pending"
  }'

# 4. Query guest users
curl http://localhost:5600/v1/users?isguest=true

# 5. Convert guest to registered user
curl -X POST http://localhost:5600/v1/users/123/convert-to-registered \
  -H "Content-Type: application/json" \
  -d '{
    "useremail": "user@example.com",
    "userpassword": "SecurePassword123!",
    "lastname": "Smith"
  }'
```

## Best Practices

### ✅ **Do's**

1. **Always capture phone number** - Required for order tracking and future account linkage
2. **Keep guest flow simple** - Only ask for essential information
3. **Show clear messaging** - Explain benefits of creating account vs guest checkout
4. **Preserve order history** - Link orders when guest later registers
5. **Handle duplicates gracefully** - If phone exists, inform user to login

### ❌ **Don'ts**

1. **Don't force registration** - Allow guest checkout for faster conversion
2. **Don't ask for password** - Guest users don't need authentication
3. **Don't lose orders** - Always link by phone number when user registers
4. **Don't require email** - Make email optional for guest users

## Security Considerations

1. **Phone Number Validation**: Ensure phone numbers are unique and properly formatted
2. **Order Access Control**: Guest users can only access their own orders
3. **No Authentication Token**: Guest users don't receive session tokens
4. **Data Cleanup**: Consider periodically cleaning up abandoned guest accounts

## Future Enhancements

- [ ] Send order confirmation via SMS to guest phone number
- [ ] Auto-cleanup guest users with no orders after 30 days
- [ ] Guest user email marketing opt-in
- [ ] One-time password (OTP) verification for guest phone numbers
- [ ] Guest-to-registered conversion incentives (coupons, points)

## Summary

The guest checkout implementation leverages your existing infrastructure with minimal changes:

- ✅ **Single field addition**: `isguest` boolean in users table
- ✅ **Two new endpoints**: `/users/guest` and `/users/:id/convert-to-registered`
- ✅ **No changes to orders/addresses**: Uses existing flows
- ✅ **Simple frontend integration**: Standard API calls
- ✅ **Automatic order linking**: Based on phone number matching

This approach **reduces backend complexity** while **simplifying frontend development**, exactly as you wanted! 🎉

