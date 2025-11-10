# Amazon OAuth Flow - Exact Steps
## Complete Step-by-Step Guide

**Version:** 1.0  
**Date:** January 2025

---

## 🔄 Complete OAuth Flow

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Frontend → Backend (Initiate OAuth)                │
├─────────────────────────────────────────────────────────────┤
│ Frontend calls: POST /v1/amazon/auth/initiate              │
│ Backend returns: authorizationUrl                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Frontend → Amazon (Redirect User)                  │
├─────────────────────────────────────────────────────────────┤
│ Frontend redirects user to authorizationUrl                 │
│ User sees: Amazon OAuth Consent Page                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: User → Amazon (Login & Approve)                    │
├─────────────────────────────────────────────────────────────┤
│ User logs into Amazon Seller account                        │
│ User clicks "Authorize" button                              │
│ ⚠️ If seller account incomplete → Tax registration page    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Amazon → Frontend (Redirect with Code)             │
├─────────────────────────────────────────────────────────────┤
│ Amazon redirects to: redirectUri                           │
│ URL: http://localhost:5173/amazon/callback?                │
│      spapi_oauth_code=CODE&                                │
│      selling_partner_id=SELLER_ID&                         │
│      state=STATE                                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Frontend → Backend (Send Code)                     │
├─────────────────────────────────────────────────────────────┤
│ Frontend extracts code from URL                             │
│ Frontend calls: POST /v1/amazon/auth/callback               │
│ Backend exchanges code for refresh token                    │
│ Backend stores refresh token in database                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Exact Steps with Code

### **STEP 1: Frontend Calls Initiate Endpoint**

**Frontend Code:**
```typescript
// When user clicks "Connect Amazon" button
const handleConnectAmazon = async () => {
  try {
    // Call backend to get OAuth URL
    const response = await axios.post(
      'http://localhost:5600/v1/amazon/auth/initiate',
      {
        redirectUri: 'http://localhost:5173/amazon/callback',
        // state is optional - backend will generate if not provided
      },
      {
        headers: {
          'Authorization': `Bearer ${userSessionToken}`, // Required!
          'Content-Type': 'application/json'
        }
      }
    );

    // Response:
    // {
    //   "success": true,
    //   "message": "OAuth URL generated successfully",
    //   "data": {
    //     "authorizationUrl": "https://sellercentral.amazon.in/apps/authorize/consent?...",
    //     "state": "8377c4159ded564a899883ffc5c15c5613aabc2b3ddeb792c5f7f2ce6ac4c356"
    //   }
    // }

    // Save state for later verification
    localStorage.setItem('amazon_oauth_state', response.data.data.state);

    // Redirect user to Amazon OAuth page
    window.location.href = response.data.data.authorizationUrl;
  } catch (error) {
    console.error('Failed to initiate OAuth:', error);
  }
};
```

---

### **STEP 2: User is Redirected to Amazon**

**What Happens:**
- User is redirected to: `https://sellercentral.amazon.in/apps/authorize/consent?...`
- User sees Amazon OAuth consent page (NOT tax registration page)
- User must log in if not already logged in

**⚠️ Important:** If you see the tax registration page (`/insoa/registration/tax`), it means:
1. Your seller account setup is incomplete
2. You need to complete seller account registration first
3. After completing registration, try the OAuth flow again

---

### **STEP 3: User Approves on Amazon**

**What User Sees:**
- Amazon OAuth consent page showing:
  - App name (your app)
  - Permissions requested
  - "Authorize" button

**User Action:**
- Click "Authorize" button
- Amazon processes the authorization

---

### **STEP 4: Amazon Redirects to Your Frontend**

**Amazon Redirects To:**
```
http://localhost:5173/amazon/callback?
  spapi_oauth_code=Atzr|IwEBIJ...&
  selling_partner_id=A1EXAMPLE123&
  state=8377c4159ded564a899883ffc5c15c5613aabc2b3ddeb792c5f7f2ce6ac4c356
```

**⚠️ Important Parameters:**
- `spapi_oauth_code` - Authorization code (NOT just `code`)
- `selling_partner_id` - Seller ID (store this!)
- `state` - State parameter (verify this matches!)

---

### **STEP 5: Frontend Callback Page**

**Frontend Callback Page Code:**
```typescript
// pages/amazon/callback.tsx or app/amazon/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

export default function AmazonCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract parameters from URL
        // Amazon SP-API uses 'spapi_oauth_code' (not just 'code')
        const code = searchParams.get('spapi_oauth_code') || searchParams.get('code');
        const sellingPartnerId = searchParams.get('selling_partner_id');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Check for errors
        if (error) {
          console.error('Amazon authorization error:', error);
          setStatus('Error: ' + error);
          router.push('/amazon/connect?error=' + error);
          return;
        }

        // Validate required parameters
        if (!code) {
          console.error('No authorization code received');
          setStatus('Error: No authorization code');
          router.push('/amazon/connect?error=no_code');
          return;
        }

        if (!state) {
          console.error('No state parameter received');
          setStatus('Error: No state parameter');
          router.push('/amazon/connect?error=no_state');
          return;
        }

        // Verify state matches (CSRF protection)
        const savedState = localStorage.getItem('amazon_oauth_state');
        if (state !== savedState) {
          console.error('State mismatch');
          setStatus('Error: Invalid state');
          router.push('/amazon/connect?error=invalid_state');
          return;
        }

        setStatus('Exchanging code for token...');

        // Send authorization code to backend
        const response = await axios.post(
          'http://localhost:5600/v1/amazon/auth/callback',
          {
            code,                    // Authorization code
            sellingPartnerId,         // Seller ID from Amazon
            state                     // State for verification
          },
          {
            headers: {
              'Authorization': `Bearer ${userSessionToken}`, // Required!
              'Content-Type': 'application/json'
            }
          }
        );

        // Response:
        // {
        //   "success": true,
        //   "message": "Amazon account connected successfully",
        //   "data": {
        //     "sellerId": "A1EXAMPLE123"
        //   }
        // }

        // Clear saved state
        localStorage.removeItem('amazon_oauth_state');

        setStatus('Success! Redirecting...');

        // Success! Redirect to success page
        router.push('/amazon/connect?success=true');
      } catch (error: any) {
        console.error('Failed to exchange code:', error);
        setStatus('Error: ' + (error.response?.data?.message || error.message));
        router.push('/amazon/connect?error=exchange_failed');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="container">
      <h1>Connecting to Amazon...</h1>
      <p>{status}</p>
    </div>
  );
}
```

---

### **STEP 6: Backend Exchanges Code for Refresh Token**

**What Backend Does:**
1. Receives code, sellingPartnerId, and state from frontend
2. Verifies state parameter (CSRF protection)
3. Calls Amazon token endpoint to exchange code for refresh token
4. Stores refresh token in database (encrypted)
5. Returns success response

**Backend Endpoint:**
```
POST /v1/amazon/auth/callback
Headers:
  Authorization: Bearer {userSessionToken}

Body:
{
  "code": "Atzr|IwEBIJ...",
  "sellingPartnerId": "A1EXAMPLE123",
  "state": "8377c4159ded564a899883ffc5c15c5613aabc2b3ddeb792c5f7f2ce6ac4c356"
}

Response:
{
  "success": true,
  "message": "Amazon account connected successfully",
  "data": {
    "sellerId": "A1EXAMPLE123"
  }
}
```

---

## ⚠️ Common Issues & Solutions

### **Issue 1: Tax Registration Page Instead of OAuth Consent**

**Problem:** After login, you see `/insoa/registration/tax` instead of OAuth consent page.

**Solution:**
1. Complete your Amazon Seller account setup first
2. Go to Seller Central and complete all required steps:
   - Tax information
   - Business details
   - Bank account
3. After completing setup, try OAuth flow again

**Alternative:** If you're testing with a sandbox account, you might need to use a different test seller account.

---

### **Issue 2: Redirect Goes to Wrong URL**

**Problem:** Amazon redirects to wrong URL or shows error.

**Solution:**
1. Ensure `redirectUri` in `/auth/initiate` matches exactly what's registered in Amazon Solution Provider Portal
2. Check that the redirect URI is whitelisted in your app settings
3. Use the exact same URL (including protocol, domain, port, path)

---

### **Issue 3: Missing `spapi_oauth_code` Parameter**

**Problem:** Frontend doesn't receive `spapi_oauth_code` in callback.

**Solution:**
1. Check URL parameters - Amazon uses `spapi_oauth_code` (not just `code`)
2. Also check for `code` as fallback
3. Verify redirect URI matches exactly

---

### **Issue 4: State Mismatch Error**

**Problem:** Backend returns "Invalid state parameter" error.

**Solution:**
1. Ensure frontend saves state from `/auth/initiate` response
2. Send the same state in `/auth/callback` request
3. State expires after 10 minutes - restart flow if expired

---

## ✅ Complete Frontend Implementation Example

```typescript
// components/ConnectAmazonButton.tsx
'use client';

import { useState } from 'react';
import axios from 'axios';

export function ConnectAmazonButton() {
  const [loading, setLoading] = useState(false);
  const userSessionToken = 'YOUR_SESSION_TOKEN'; // Get from auth context

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Step 1: Get OAuth URL from backend
      const response = await axios.post(
        'http://localhost:5600/v1/amazon/auth/initiate',
        {
          redirectUri: 'http://localhost:5173/amazon/callback',
        },
        {
          headers: {
            'Authorization': `Bearer ${userSessionToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Step 2: Save state and redirect
      const { authorizationUrl, state } = response.data.data;
      localStorage.setItem('amazon_oauth_state', state);
      window.location.href = authorizationUrl;
    } catch (error) {
      console.error('Failed to initiate Amazon connection:', error);
      setLoading(false);
    }
  };

  return (
    <button onClick={handleConnect} disabled={loading}>
      {loading ? 'Connecting...' : 'Connect Amazon'}
    </button>
  );
}
```

```typescript
// pages/amazon/callback.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

export default function AmazonCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing...');
  const userSessionToken = 'YOUR_SESSION_TOKEN'; // Get from auth context

  useEffect(() => {
    const handleCallback = async () => {
      // Step 4: Extract parameters from URL
      const code = searchParams.get('spapi_oauth_code') || searchParams.get('code');
      const sellingPartnerId = searchParams.get('selling_partner_id');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        router.push('/amazon/connect?error=' + error);
        return;
      }

      if (!code || !state) {
        router.push('/amazon/connect?error=missing_params');
        return;
      }

      // Verify state
      const savedState = localStorage.getItem('amazon_oauth_state');
      if (state !== savedState) {
        router.push('/amazon/connect?error=invalid_state');
        return;
      }

      try {
        // Step 5: Send code to backend
        await axios.post(
          'http://localhost:5600/v1/amazon/auth/callback',
          { code, sellingPartnerId, state },
          {
            headers: {
              'Authorization': `Bearer ${userSessionToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        localStorage.removeItem('amazon_oauth_state');
        router.push('/amazon/connect?success=true');
      } catch (error) {
        router.push('/amazon/connect?error=exchange_failed');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div>
      <h1>Connecting to Amazon...</h1>
      <p>{status}</p>
    </div>
  );
}
```

---

## 📋 Checklist

- [ ] Frontend calls `/auth/initiate` with `redirectUri`
- [ ] Frontend saves `state` from response
- [ ] Frontend redirects user to `authorizationUrl`
- [ ] User logs in and approves on Amazon
- [ ] Amazon redirects to `redirectUri` with `spapi_oauth_code`, `selling_partner_id`, and `state`
- [ ] Frontend extracts parameters from URL
- [ ] Frontend verifies `state` matches saved state
- [ ] Frontend calls `/auth/callback` with code, sellingPartnerId, and state
- [ ] Backend exchanges code for refresh token
- [ ] Backend stores refresh token in database
- [ ] Frontend shows success message

---

## 🔑 Key Points

1. **OAuth URL:** Generated by backend, user is redirected to it
2. **Redirect URI:** Must match exactly what's registered in Amazon Solution Provider Portal
3. **Authorization Code:** Amazon returns `spapi_oauth_code` (not just `code`)
4. **State Parameter:** Used for CSRF protection, must be verified
5. **Refresh Token:** Stored in database by backend (not returned to frontend)
6. **Access Token:** Generated on-demand from refresh token (not stored)

---

**Document Version:** 1.0  
**Last Updated:** January 2025

