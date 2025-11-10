# Amazon-Nivaana Integration Guide
## Complete Developer & Business Implementation Documentation

**Version:** 1.0  
**Date:** November 7, 2025  
**Target Audience:** Software Developers, Integration Engineers, Solution Architects, QA Engineers, Business Stakeholders  
**Marketplace:** Amazon India (Marketplace ID: A21TJRUUN4KGV)

> **📌 NEW: This guide has been split into focused versions for easier navigation:**
> - **[Main Overview Guide](./AMAZON_INTEGRATION_MAIN.md)** - Quick start and decision guide
> - **[Sandbox Implementation Guide](./AMAZON_INTEGRATION_SANDBOX.md)** - Testing & development (no verification needed)
> - **[Production Implementation Guide](./AMAZON_INTEGRATION_PRODUCTION.md)** - Live integration (requires verification)
>
> **This document remains as a comprehensive reference covering both environments.**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Prerequisites & Setup](#2-prerequisites--setup)
3. [Authentication & Configuration](#3-authentication--configuration)
4. [System Architecture](#4-system-architecture)
5. [Integration Flows](#5-integration-flows)
6. [API Reference](#6-api-reference)
7. [Data Model & Field Mappings](#7-data-model--field-mappings)
8. [Error Handling & Retry Strategy](#8-error-handling--retry-strategy)
9. [Testing Plan](#9-testing-plan)
10. [Go-Live Checklist](#10-go-live-checklist)
11. [Operational Guidelines](#11-operational-guidelines)
12. [Troubleshooting](#12-troubleshooting)
13. [Support & References](#13-support--references)

---

## 1. Introduction

### 1.1 Purpose

This document provides a complete technical and business guide for integrating the Nivaana Inventory System with Amazon Seller Central (India) using the Selling Partner API (SP-API). It defines the prerequisites, setup procedures, system architecture, synchronization logic for products, stock, orders, and shipments, along with detailed implementation steps, field mappings, and error handling.

### 1.2 Objectives

- Enable two-way synchronization between Nivaana and Amazon Seller Central
- Maintain real-time accuracy of product stock and order data
- Automate order creation, shipment confirmation, and tracking updates
- Ensure compliance with Amazon's SP-API policies and data privacy guidelines

### 1.3 Scope

This integration covers:
- **Seller-fulfilled (FBM)** operations on Amazon India (Marketplace ID: A21TJRUUN4KGV)
- Inventory updates, order import, shipment confirmation, and tracking sync
- **Does NOT include** FBA (Fulfilled by Amazon) stock management

### 1.4 High-Level Summary

Use Amazon's Selling Partner API (SP-API): register your app, get seller consent (refresh token), and then implement a connector service that:
- **(a)** Pushes inventory updates to Amazon via Feeds API or JSON Listings API
- **(b)** Receives or polls order events via the Orders API and Notifications API
- **(c)** Posts shipment/tracking confirmations back to Amazon (Feeds or confirmShipment)

Maintain a SKU/ASIN mapping and a reconciliation job to handle discrepancies.

---

## 2. Prerequisites & Setup

### 2.1 Business Account Requirements

| Requirement | Description |
|------------|-------------|
| **Amazon Seller Account** | Must be an active Professional Plan account on Amazon.in |
| **SP-API Developer Registration** | Register via Seller Central Partner Network to obtain developer profile, LWA client credentials, and AWS IAM Role ARN |
| **Private Application Creation** | Create a private SP-API application for your company. This allows secure use of credentials and internal integration |
| **API Role Access** | Enable these roles: Orders, Listings, Feeds, Notifications, and Shipping |
| **AWS Account** | Required for SigV4 signing. Use IAM role linked to your developer profile |
| **LWA Authorization** | Perform OAuth 2.0 authorization to obtain a refresh token for seller access |

### 2.2 Technical Requirements

| Component | Minimum Requirement |
|-----------|---------------------|
| **Environment** | Node.js (v18+) or Python 3.10+ |
| **Framework** | Nivaana Backend (Fastify/Node.js) |
| **Database** | PostgreSQL or MongoDB |
| **Queue/Worker** | RabbitMQ / BullMQ / AWS SQS |
| **Authentication** | AWS Signature Version 4 (SigV4) + Login With Amazon (LWA) |
| **Hosting** | HTTPS endpoint (public) for receiving Amazon Notifications |
| **Testing Environment** | Amazon SP-API Sandbox |

### 2.3 Account Types: Solution Provider Portal vs Private App

**Important:** Amazon offers two paths for SP-API access:

| Account Type | Use Case | Identity Verification | Best For |
|--------------|----------|---------------------|----------|
| **Solution Provider Portal** | Providing integration services to multiple sellers | Required for production apps | Companies serving multiple clients |
| **Private App** | Internal integration for your own seller account | Required for production apps | Single seller/company integration |

**For Nivaana Integration:**
- If integrating for your own company's seller account → Use **Private App**
- If building a platform to serve multiple sellers → Use **Solution Provider Portal**
- **If you're a developer building for a client (like NIVAANA) who has a seller account → Use Solution Provider Portal** ✅

### 2.3.1 Solution Provider Workflow: Developer Building for Client

**Your Scenario:**
- ✅ You have created your own SP-API developer account (Solution Provider Portal)
- ✅ Client (NIVAANA) has their own Amazon Seller Account
- ✅ You've created an app client and got LWA credentials
- ❓ Need to connect your app to client's seller account

**Quick Answers to Your Questions:**

| Question | Answer |
|----------|--------|
| **Q1: Will I need to create a Private SP-API application for my client's seller account?** | ❌ **NO** - You DON'T need to create a Private App. Your Solution Provider Portal app can connect to ANY seller account (including NIVAANA's) via OAuth authorization. |
| **Q2: Where to give API role access?** | ✅ **In YOUR Solution Provider Portal app settings** - Go to your app → "Roles" or "API Access" section → Enable required roles. These roles apply to all sellers that authorize your app. |
| **Q3: Will AWS account be needed?** | ✅ **YES** - AWS account is required for SigV4 signing. |
| **Q4: Which email to create AWS account?** | ✅ **YOUR email** (same as SP-API developer account). AWS account is linked to YOUR developer profile, not client's seller account. |

**Answer: You DON'T need to create a Private App. Here's what you need to do:**

1. **Your App (Solution Provider Portal)** - Already done ✅
   - You created app client in Solution Provider Portal
   - You have LWA credentials (Client ID, Client Secret)
   - This is YOUR developer account

2. **Connect to Client's Seller Account** - Next step ⬇️
   - You need to get **OAuth authorization** from the client's seller account
   - Client (NIVAANA) will authorize your app to access their seller account
   - This gives you a **Refresh Token** for that specific seller account

3. **API Role Access** - Set in YOUR app
   - API roles are configured in **YOUR Solution Provider Portal app**
   - When you created the app, you assigned roles (Orders, Listings, Feeds, etc.)
   - These roles apply to ALL seller accounts that authorize your app

4. **AWS Account** - Required for SigV4 signing
   - You need an AWS account to sign SP-API requests
   - Can be created with YOUR email (the one you used for SP-API developer account)
   - You'll create an IAM role and link it to your developer profile

### 2.4 Sandbox vs Production: Key Differences

| Aspect | Sandbox Environment | Production Environment |
|--------|-------------------|----------------------|
| **Identity Verification** | ❌ **NOT Required** | ✅ **Required** (Business registration info + Identity document) |
| **Testing Capabilities** | ✅ **Full API testing** (all endpoints work) | ✅ Full production access |
| **Data** | Test/mock data | Real customer orders, real inventory |
| **Time to Start** | Immediate (after account creation) | 5-10 business days (after identity verification) |
| **Mobile Number** | Personal mobile number is acceptable | Personal mobile number acceptable, but business info required for verification |
| **Can Test Everything?** | ✅ **YES** - All APIs, all flows work in sandbox | ✅ Yes, but with real data |

**Your Understanding is CORRECT:**
- ✅ **Sandbox:** No identity verification needed, can test all APIs and flows
- ✅ **Production:** Requires identity verification with business registration info
- ✅ **Personal mobile number:** Acceptable for registration, but production will need business documents

### 2.4.1 Frequently Asked Questions

**Q: Can I register with my personal mobile number?**  
A: ✅ **YES** - Personal mobile number is acceptable for both Solution Provider Portal and Private App registration.

**Q: Do I need to verify identity for sandbox testing?**  
A: ❌ **NO** - Sandbox environment does NOT require identity verification. You can start testing immediately after creating your app.

**Q: Can I test everything in sandbox?**  
A: ✅ **YES** - All SP-API endpoints work in sandbox:
   - Inventory updates (Listings Items API, Feeds API)
   - Order fetching (Orders API)
   - Shipment confirmations (Shipments API)
   - Notifications (Notifications API)
   - All authentication flows (LWA, SigV4)

**Q: When do I need business registration info?**  
A: Only when moving to **Production** - The "Verify your Identity" step (which requires business registration info) is specifically for creating production apps, not sandbox apps.

**Q: Individual Developer vs Company - which should I choose?**  
A: 
- **Individual Developer:** If you're building for yourself or as a freelancer
- **Company:** If you're representing a business entity
- Both can use personal mobile number initially
- Both need business info for production verification

**Q: How long does sandbox testing take to set up?**  
A: **Immediate** - Once you create the app, it's automatically in "Sandbox" status and you can start testing right away.

### 2.5 Developer Setup Steps

#### Step 1: Register as a Developer

**Option A: Solution Provider Portal (For Multiple Sellers)**
1. Go to **Solution Provider Portal** → Register
2. You can register as:
   - **Individual Developer** (using personal mobile number) ✅
   - **On behalf of Company** (using company information)
3. For **Sandbox:** No identity verification needed - start testing immediately
4. For **Production:** Complete identity verification with:
   - Business registration info
   - Identity document
   - Approval takes **5–10 business days**

**Option B: Private App (For Single Seller)**
1. Go to **Seller Central → Apps & Services → Manage Your Apps → Register as Developer**
2. Create a **Private App** for your seller account
3. For **Sandbox:** No identity verification needed
4. For **Production:** Complete identity verification

#### Step 2: Create Application (Sandbox First)

1. In Developer Central/Solution Provider Portal, create a new app
2. **App Status:** Will be automatically set to **"Sandbox"** (no verification needed)
3. **Assign API Roles** (This is where you set role access):
   - Go to your app settings in Solution Provider Portal
   - Navigate to "Roles" or "API Access" section
   - Enable these roles:
     - `sellingpartnerapi::orders::read/write`
     - `sellingpartnerapi::feeds::write`
     - `sellingpartnerapi::notifications::read`
     - `sellingpartnerapi::listings::read/write`
     - `sellingpartnerapi::shipping::read/write`
   - **Note:** These roles apply to ALL seller accounts that authorize your app
4. Obtain **Sandbox Credentials:**
   - **Client ID** (Sandbox)
   - **Client Secret** (Sandbox)
   - **AWS IAM Role ARN** (You'll get this after AWS setup)
   - **View sandbox credentials** link available immediately

**Note:** You can test ALL APIs and flows in sandbox without identity verification!

### ✅ Next Steps After Getting Sandbox LWA Credentials

**You've completed:**
- ✅ Created sandbox app "Nivaana"
- ✅ Got LWA credentials (Client ID and Client Secret)

**What to do next (in order):**

#### Step 1: Save Your Credentials Securely

1. **Copy your credentials:**
   - **Client Identifier:** `amzn1.application-oa2-client.xxxxx` (from the modal)
   - **Client Secret:** Click to reveal and copy (keep it secure!)
   - **Rotation Deadline:** Note the date (2026-05-06) - you'll need to rotate before this

2. **Store in environment variables:**
   ```env
   # Sandbox Credentials
   AMAZON_CLIENT_ID_SANDBOX=amzn1.application-oa2-client.7ad6031534434413abf37ff84645fc21
   AMAZON_CLIENT_SECRET_SANDBOX=your_client_secret_here
   AMAZON_ENVIRONMENT=SANDBOX
   AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV
   ```

#### Step 2: Set Up API Roles in Your App

**⚠️ Important for Sandbox Apps:**

When you click "Edit App" for a **Sandbox app**, you'll see this message:
> **"Sandbox apps have access to all static sandbox APIs. Your production data access may be different as role requests are approved or denied based on evaluation of information submitted during developer registration."**

**What This Means:**
- ✅ **For Sandbox:** You DON'T need to select roles - you automatically have access to ALL sandbox APIs!
- ✅ **All APIs work in sandbox** without explicit role selection:
  - Orders API ✅
  - Feeds API ✅
  - Notifications API ✅
  - Listings API ✅
  - Shipping API ✅
- ⏳ **For Production:** Role selection will be required after identity verification

**Action Required:**
- **For Sandbox:** ✅ **Nothing to do!** You can skip this step - all APIs are already available.
- **For Production:** You'll set up roles later when you complete identity verification.

**Why This Happens:**
- Sandbox is a testing environment with all APIs enabled by default
- Production requires explicit role approval based on your use case and verification
- This allows you to test everything in sandbox without restrictions

**Next Step:** Since sandbox has all APIs enabled, you can proceed directly to Step 3 (AWS Setup)!

#### Step 3: Set Up AWS Account and IAM Role

**Why:** SP-API requires AWS SigV4 signing for all requests.

1. **Create AWS Account** (if you don't have one):
   - Go to https://aws.amazon.com/
   - Sign up with YOUR email (same as SP-API developer account)
   - Complete verification

2. **Create IAM Role:**
   - AWS Console → IAM → Roles → Create Role
   - Trusted entity: "AWS Account"
   - Enter Amazon's account ID: `589160054188`
   - Attach policy: `AmazonSellingPartnerAPIFullAccess`
   - Name: `SP-API-Role`
   - **Copy the Role ARN** (format: `arn:aws:iam::YOUR_ACCOUNT_ID:role/SP-API-Role`)

3. **Link IAM Role to Developer Profile:**
   - Solution Provider Portal → Developer Profile Settings
   - Find "AWS IAM Role ARN" field
   - Paste the IAM Role ARN
   - Save

4. **Add to environment variables:**
   ```env
   AMAZON_AWS_IAM_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/SP-API-Role
   AMAZON_REGION=ap-south-1  # Mumbai region for India marketplace
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   ```

#### Step 4: Get Refresh Token (For Sandbox Testing)

**For sandbox, you need a refresh token to make API calls:**

1. **Option A: Use Test Seller Account (Recommended for Sandbox)**
   - Amazon provides test seller accounts for sandbox
   - Use OAuth authorization flow with test seller
   - Get refresh token for testing

2. **Option B: Use Real Seller Account (NIVAANA)**
   - Generate OAuth URL:
     ```
     https://sellercentral.amazon.in/apps/authorize/consent?
       application_id={YOUR_APP_ID}&
       state={UNIQUE_STATE}&
       version=beta
     ```
   - Share URL with NIVAANA
   - They authorize → you get refresh token
   - **Note:** Even in sandbox, you can connect to real seller account for testing

3. **Store refresh token:**
   ```env
   AMAZON_REFRESH_TOKEN_SANDBOX=your_refresh_token_here
   ```

#### Step 5: Implement Authentication Code

**Create token refresh function:**

```javascript
// amazon-auth.service.js
import axios from 'axios';

const AMAZON_LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

let cachedToken = null;
let tokenExpiry = null;

async function refreshAccessToken() {
  const response = await axios.post(AMAZON_LWA_TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: process.env.AMAZON_REFRESH_TOKEN_SANDBOX,
    client_id: process.env.AMAZON_CLIENT_ID_SANDBOX,
    client_secret: process.env.AMAZON_CLIENT_SECRET_SANDBOX
  });
  
  return response.data.access_token;
}

export async function getAccessToken() {
  const now = Date.now();
  // Refresh 1 minute before expiry (tokens valid for 1 hour)
  if (!cachedToken || now >= tokenExpiry - 60000) {
    cachedToken = await refreshAccessToken();
    tokenExpiry = now + 3600000; // 1 hour
  }
  return cachedToken;
}
```

#### Step 6: Test Your First API Call

**Test inventory update (simple test):**

```javascript
// test-amazon-api.js
import { getAccessToken } from './amazon-auth.service.js';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import axios from 'axios';

async function testInventoryUpdate() {
  try {
    // 1. Get access token
    const accessToken = await getAccessToken();
    
    // 2. Prepare request
    const sellerId = 'YOUR_SELLER_ID'; // Get from seller account
    const sku = 'TEST-SKU-001';
    const request = {
      method: 'PATCH',
      url: `https://sandbox.sellingpartnerapi-eu.amazon.com/listings/2021-08-01/items/${sellerId}/${sku}`,
      headers: {
        'Content-Type': 'application/json',
        'x-amz-access-token': accessToken
      },
      body: JSON.stringify({
        productType: 'PRODUCT',
        patches: [{
          op: 'replace',
          path: '/attributes/fulfillment_availability',
          value: [{
            fulfillment_channel_code: 'DEFAULT',
            quantity: 100
          }]
        }]
      })
    };
    
    // 3. Sign with AWS SigV4
    const signer = new SignatureV4({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      },
      region: process.env.AMAZON_REGION,
      service: 'execute-api',
      sha256: Sha256
    });
    
    const signedRequest = await signer.sign(request);
    
    // 4. Make API call
    const response = await axios(signedRequest);
    console.log('✅ Success!', response.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testInventoryUpdate();
```

#### Step 7: Verify Everything Works

**Checklist:**
- [ ] Credentials saved in environment variables
- [ ] API roles (Sandbox: ✅ Auto-enabled, Production: ⏳ Will set later)
- [ ] AWS IAM role created and linked
- [ ] Refresh token obtained
- [ ] Authentication code implemented
- [ ] First API call successful

**Note:** For sandbox, API roles are automatically enabled - no action needed!

**Common Issues:**
- **401 Unauthorized:** Check refresh token is valid
- **403 Forbidden:** (Sandbox: Shouldn't happen - all APIs enabled. Production: Check role approval)
- **Signature errors:** Check AWS credentials and IAM role ARN

#### Step 8: Build Your Integration

Now you can start building:
1. **Inventory sync service** - Update Amazon inventory from Nivaana
2. **Order fetch service** - Get orders from Amazon
3. **Shipment confirmation service** - Update tracking info
4. **Error handling and retry logic**
5. **Webhook receiver** - For notifications

**Next:** See Section 5 (Integration Flows) for detailed implementation.

### ⚠️ Important: Understanding Sandbox vs Production Apps

**Your Goal:**
- ✅ **Sandbox App** - For testing all APIs and integration flows
- ✅ **Production App** - To connect to NIVAANA's real seller account and actual inventory

**Current Situation:**
- ✅ You have a **Sandbox app** (Nivaana) - Status: "Sandbox"
- ⏳ You need a **Production app** - Requires identity verification

### Workflow: Sandbox First, Then Production

#### Phase 1: Sandbox Testing (Do This Now) ✅

**What You Can Do in Sandbox:**
1. **Test ALL APIs** without identity verification:
   - ✅ Inventory updates (Listings Items API, Feeds API)
   - ✅ Order fetching (Orders API)
   - ✅ Shipment confirmations (Shipments API)
   - ✅ Notifications (Notifications API)
   - ✅ All authentication flows (LWA, SigV4)

2. **Set Up API Roles:**
   - Go to "Developer Central" page
   - Click "Edit App" button next to your "Nivaana" app
   - In app settings, find "Roles" or "API Access" section
   - Enable required roles:
     - `sellingpartnerapi::orders::read/write`
     - `sellingpartnerapi::feeds::write`
     - `sellingpartnerapi::notifications::read`
     - `sellingpartnerapi::listings::read/write`
     - `sellingpartnerapi::shipping::read/write`

3. **Get Sandbox Credentials:**
   - Click "View sandbox credentials" link
   - Get Client ID, Client Secret
   - Use these for testing

4. **Test Integration:**
   - Build and test your integration code
   - Validate all API calls work correctly
   - Test error handling and retry logic
   - **No real data** - Uses test/mock data

#### Phase 2: Production App (For Real Inventory) ⏳

**When Ready for Production:**

1. **Complete Identity Verification:**
   - Go to "Steps to create production apps" page
   - Click "Verify your Identity"
   - **Options for documents:**
     - **Option A:** Use your personal identity document (if individual developer)
     - **Option B:** Use client's (NIVAANA) business registration documents
     - **Option C:** If you have your own business, use business registration
   - Approval takes **20 minutes to 5-10 business days**

2. **After Identity Verification Approved:**
   - "Set up Solution Provider Account Profile and Permissions" becomes available
   - Set up roles, use cases, and security controls
   - Your app status changes from "Sandbox" to "Production"
   - You'll receive **production credentials** (different from sandbox)

3. **Connect to Real Seller Account:**
   - Use OAuth authorization to connect to NIVAANA's seller account
   - Get refresh token for their real seller account
   - Now you can access:
     - ✅ Real inventory from NIVAANA's seller account
     - ✅ Real orders from Amazon customers
     - ✅ Real shipment confirmations
     - ✅ All production data

### Key Differences: Sandbox vs Production

| Aspect | Sandbox App | Production App |
|--------|-------------|----------------|
| **Identity Verification** | ❌ Not required | ✅ Required |
| **API Testing** | ✅ All APIs work | ✅ All APIs work |
| **Data** | Test/mock data | Real seller account data |
| **Inventory** | Test inventory | Real NIVAANA inventory |
| **Orders** | Test orders | Real customer orders |
| **Credentials** | Sandbox Client ID/Secret | Production Client ID/Secret |
| **Status** | "Sandbox" | "Production" |
| **When to Use** | Development & Testing | Live integration |

### Recommended Approach

**Now (Development Phase):**
1. ✅ Use **Sandbox app** for all testing
2. ✅ Set API roles in sandbox app settings
3. ✅ Build and test your integration
4. ✅ Validate all flows work correctly

**Later (Production Phase):**
1. ⏳ Complete identity verification (when ready)
2. ⏳ Get production app credentials
3. ⏳ Connect to NIVAANA's real seller account
4. ⏳ Switch from sandbox to production credentials in your code
5. ⏳ Start syncing real inventory and orders

**Important:** You can keep both sandbox and production apps active. Use sandbox for testing new features, production for live operations.

#### Step 2.1: Connect Your App to Client's Seller Account (OAuth Authorization)

**This is the critical step to connect your app to NIVAANA's seller account:**

1. **Generate OAuth Authorization URL:**
   ```
   https://sellercentral.amazon.in/apps/authorize/consent?
     application_id={YOUR_APP_ID}&
     state={UNIQUE_STATE_VALUE}&
     version=beta
   ```

2. **Client (NIVAANA) Authorization Process:**
   - Share the authorization URL with your client (NIVAANA)
   - Client logs into their Amazon Seller Central account
   - Client reviews and approves the permissions your app requests
   - Client clicks "Authorize" or "Confirm"

3. **Get Refresh Token:**
   - After client authorizes, Amazon redirects to your callback URL with an authorization code
   - Exchange authorization code for refresh token:
     ```javascript
     POST https://api.amazon.com/auth/o2/token
     Body: {
       grant_type: "authorization_code",
       code: "{AUTHORIZATION_CODE}",
       client_id: "{YOUR_CLIENT_ID}",
       client_secret: "{YOUR_CLIENT_SECRET}",
       redirect_uri: "{YOUR_CALLBACK_URL}"
     }
     ```
   - Response contains `refresh_token` - **Store this securely!**
   - This refresh token is specific to NIVAANA's seller account

4. **Use Refresh Token:**
   - Use this refresh token to get access tokens for SP-API calls
   - Each seller account that authorizes your app will have its own refresh token

#### Step 3: Configure AWS Account and IAM Role

**Q: Do I need AWS account?**  
**A: ✅ YES** - AWS account is required for SigV4 signing of SP-API requests.

**Q: Which email should I use to create AWS account?**  
**A:** Use **YOUR email** (the same email you used for SP-API developer registration). The AWS account is linked to YOUR developer profile, not the client's seller account.

**Steps to Set Up AWS:**

1. **Create AWS Account** (if you don't have one):
   - Go to https://aws.amazon.com/
   - Sign up with YOUR email (same as SP-API developer account)
   - Complete AWS account verification
   - **Note:** AWS has a free tier, but you may need to provide payment method

2. **Create IAM Role for SP-API:**
   - Login to AWS Console → IAM → Roles → Create Role
   - Select "AWS Account" as trusted entity
   - Enter Amazon's account ID: `589160054188` (for SP-API)
   - Attach policy: `AmazonSellingPartnerAPIFullAccess` (or create custom policy with required permissions)
   - Name the role (e.g., `SP-API-Role`)
   - **Copy the Role ARN** (format: `arn:aws:iam::YOUR_ACCOUNT_ID:role/SP-API-Role`)

3. **Link IAM Role to Your Developer Profile:**
   - Go back to Solution Provider Portal
   - Navigate to your developer profile settings
   - Find "AWS IAM Role ARN" field
   - Paste the IAM Role ARN you just created
   - Save

4. **Verify Setup:**
   - Your app should now show the AWS IAM Role ARN in credentials
   - This role will be used to sign all SP-API requests

#### Step 4: OAuth 2.0 Authorization (Login With Amazon)

1. Use Client ID and Client Secret to generate an Access Token using the Refresh Token
2. Tokens expire in **1 hour**; refresh before expiry
3. Store refresh token securely (encrypted vault)

#### Step 5: Implement SigV4 Signing

1. Every SP-API call must be signed with AWS SigV4
2. Use AWS SDK or custom signing logic
3. Combine with LWA access token in headers

#### Step 6: Sandbox Testing (No Verification Needed!)

1. **Start testing immediately** - No identity verification required for sandbox
2. Test all endpoints in the SP-API Sandbox:
   - ✅ Inventory updates
   - ✅ Order fetching
   - ✅ Shipment confirmations
   - ✅ All API flows work identically to production
3. Use sandbox credentials (separate from production)
4. **Sandbox allows full testing** - You can validate your entire integration before moving to production

#### Step 7: Production App Setup (For Real Inventory)

**Goal:** Create production app to connect to NIVAANA's real seller account and actual inventory.

**Step 7.1: Complete Identity Verification**

1. **Go to "Steps to create production apps" page**
2. **Click "Verify your Identity"**
3. **Choose Document Option:**
   
   **Option A: Individual Developer (You)**
   - Upload your personal identity document (Aadhaar, PAN, Passport, etc.)
   - This works if you're developing as an individual
   
   **Option B: Client's Business Documents (NIVAANA)**
   - Ask NIVAANA to provide their business registration documents
   - Use their business info for verification
   - This is common when developer builds for client
   
   **Option C: Your Own Business**
   - If you have a registered business, use your business documents
   
4. **Upload Required Documents:**
   - Business registration info (if using business option)
   - Identity document (personal ID)
5. **Submit and Wait:**
   - Approval takes **20 minutes to 5-10 business days**
   - You'll receive email notification when approved

**Step 7.2: Set Up Production Profile**

1. **After Identity Verification Approved:**
   - "Set up Solution Provider Account Profile and Permissions" step becomes active
   - Click "Get started after your identity verified" button
   
2. **Configure Production Settings:**
   - Set up roles (same as sandbox: Orders, Listings, Feeds, Notifications, Shipping)
   - Define use cases (describe how you'll use the API)
   - Configure security controls
   
3. **App Status Changes:**
   - Your app status changes from "Sandbox" to "Production"
   - You'll see production credentials (different from sandbox)

**Step 7.3: Connect to Real Seller Account**

1. **Get Production Credentials:**
   - Production Client ID
   - Production Client Secret
   - Production AWS IAM Role ARN
   
2. **OAuth Authorization for Real Account:**
   - Generate OAuth URL using production credentials
   - Share with NIVAANA (client)
   - Client authorizes your production app
   - Get refresh token for their real seller account
   
3. **Switch to Production in Your Code:**
   ```javascript
   // Environment configuration
   const config = {
     environment: 'PRODUCTION', // or 'SANDBOX'
     clientId: process.env.AMAZON_CLIENT_ID_PROD, // Production credentials
     clientSecret: process.env.AMAZON_CLIENT_SECRET_PROD,
     refreshToken: process.env.AMAZON_REFRESH_TOKEN_PROD, // From real seller account
     marketplaceId: 'A21TJRUUN4KGV' // India
   };
   ```

4. **Now You Have Access to:**
   - ✅ Real inventory from NIVAANA's seller account
   - ✅ Real orders from Amazon customers
   - ✅ Real shipment confirmations
   - ✅ All production data

**Step 7.4: Maintain Both Sandbox and Production**

**Best Practice:** Keep both environments active

- **Sandbox:** Use for testing new features, debugging, development
- **Production:** Use for live operations, real inventory sync, real orders

**Code Example - Environment Switching:**
```javascript
// Check environment
const isProduction = process.env.AMAZON_ENVIRONMENT === 'PRODUCTION';

const amazonConfig = {
  baseURL: isProduction 
    ? 'https://sellingpartnerapi-eu.amazon.com'  // Production
    : 'https://sandbox.sellingpartnerapi-eu.amazon.com', // Sandbox
  clientId: isProduction 
    ? process.env.AMAZON_CLIENT_ID_PROD 
    : process.env.AMAZON_CLIENT_ID_SANDBOX,
  clientSecret: isProduction 
    ? process.env.AMAZON_CLIENT_SECRET_PROD 
    : process.env.AMAZON_CLIENT_SECRET_SANDBOX,
  refreshToken: isProduction 
    ? process.env.AMAZON_REFRESH_TOKEN_PROD  // Real seller account
    : process.env.AMAZON_REFRESH_TOKEN_SANDBOX  // Test account
};
```

---

## 3. Authentication & Configuration

### 3.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                       │
└─────────────────────────────────────────────────────────────┘

1. Refresh Token (Stored Securely)
   │
   ├─► Exchange for Access Token (LWA)
   │   POST https://api.amazon.com/auth/o2/token
   │   Body: {
   │     grant_type: "refresh_token",
   │     refresh_token: "{REFRESH_TOKEN}",
   │     client_id: "{CLIENT_ID}",
   │     client_secret: "{CLIENT_SECRET}"
   │   }
   │
   └─► Access Token (Valid 1 hour)
       │
       ├─► Use in SP-API calls
       │   Header: x-amz-access-token: {ACCESS_TOKEN}
       │
       └─► Sign request with AWS SigV4
           Header: Authorization: AWS4-HMAC-SHA256 ...
```

### 3.2 Environment Variables

```env
# Amazon SP-API Configuration
AMAZON_CLIENT_ID=your_client_id
AMAZON_CLIENT_SECRET=your_client_secret
AMAZON_REFRESH_TOKEN=your_refresh_token
AMAZON_AWS_IAM_ROLE_ARN=arn:aws:iam::123456789012:role/SP-API-Role
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV  # India
AMAZON_REGION=ap-south-1  # Mumbai region for India marketplace

# API Endpoints
AMAZON_SP_API_BASE_URL=https://sellingpartnerapi-eu.amazon.com
AMAZON_LWA_TOKEN_URL=https://api.amazon.com/auth/o2/token

# Notifications Webhook
AMAZON_WEBHOOK_URL=https://your-domain.com/api/amazon/notifications
AMAZON_WEBHOOK_SECRET=your_webhook_secret

# Environment
AMAZON_ENVIRONMENT=SANDBOX  # or PRODUCTION
```

### 3.3 Token Refresh Implementation

```javascript
// Example: Token refresh logic
async function refreshAccessToken() {
  const response = await axios.post(AMAZON_LWA_TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: process.env.AMAZON_REFRESH_TOKEN,
    client_id: process.env.AMAZON_CLIENT_ID,
    client_secret: process.env.AMAZON_CLIENT_SECRET
  });
  
  return response.data.access_token;
}

// Cache token and refresh 1 minute before expiry
let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  const now = Date.now();
  if (!cachedToken || now >= tokenExpiry - 60000) { // Refresh 1 min before expiry
    cachedToken = await refreshAccessToken();
    tokenExpiry = now + 3600000; // 1 hour
  }
  return cachedToken;
}
```

### 3.4 AWS SigV4 Signing

All SP-API requests must be signed using AWS Signature Version 4. Use AWS SDK or implement custom signing:

```javascript
// Example using AWS SDK
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';

const signer = new SignatureV4({
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN // If using temporary credentials
  },
  region: AMAZON_REGION,
  service: 'execute-api',
  sha256: Sha256
});

const signedRequest = await signer.sign(request);
```

---

## 4. System Architecture

### 4.1 Integration Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NIVAANA INVENTORY SYSTEM                      │
│                     (Your Responsibility - Handle)                   │
│                                                                      │
│  • Product Management (Add/Update SKUs)                             │
│  • Stock Quantity Management                                        │
│  • Order Processing & Packing                                       │
│  • Dispatch & Courier Integration                                   │
│  • Tracking Information Management                                  │
└─────────────────────────────────────────────────────────────────────┘
                                 ↕️
                    (API Communication Layer)
                     SP-API (Selling Partner API)
                                 ↕️
┌─────────────────────────────────────────────────────────────────────┐
│                   AMAZON SELLER CENTRAL (INDIA)                      │
│                  (Amazon's Responsibility - Handle)                  │
│                                                                      │
│  • Order Creation on Customer Purchase                              │
│  • Payment Processing                                               │
│  • Order Status Management                                          │
│  • Customer Communication (some)                                    │
│  • Marketplace Hosting & Customer Interface                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    NIVAANA BACKEND (Node.js)                      │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Connector       │  │ Webhook         │  │ Sync Job        │  │
│  │ Service         │  │ Receiver        │  │ Manager         │  │
│  │                 │  │                 │  │                 │  │
│  │ • SP-API Auth   │  │ • Notifications │  │ • Periodic       │  │
│  │ • Feeds         │  │ • Order Events  │  │   Reconciliation│  │
│  │ • Orders API    │  │ • Signature     │  │ • Stock Sync    │  │
│  │ • Shipments     │  │   Validation    │  │ • Batch Updates │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                   │                   │              │
│           └───────────────────┴───────────────────┘              │
│                              │                                    │
│                    ┌─────────▼─────────┐                         │
│                    │   Worker Queue    │                         │
│                    │  (RabbitMQ/SQS)   │                         │
│                    │                   │                         │
│                    │ • Feed Processing │                         │
│                    │ • API Retries     │                         │
│                    │ • Async Jobs      │                         │
│                    └─────────┬─────────┘                         │
│                              │                                    │
│                    ┌─────────▼─────────┐                         │
│                    │   Database        │                         │
│                    │  (PostgreSQL)     │                         │
│                    │                   │                         │
│                    │ • Products       │                         │
│                    │ • Orders         │                         │
│                    │ • Stock          │                         │
│                    │ • Sync Logs      │                         │
│                    │ • SKU Mapping    │                         │
│                    └───────────────────┘                         │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **Connector Service** | Handles SP-API auth, feeds, and orders synchronization |
| **Webhook Receiver** | Receives Notifications API events (new orders, status changes) |
| **Sync Job Manager** | Periodically triggers stock and reconciliation jobs |
| **Worker Queue** | Processes feed uploads and API retries asynchronously |
| **Admin Dashboard** | Displays sync logs, feed status, and order history |
| **Mapping DB** | Maps Nivaana SKUs ↔ Amazon SKUs/ASINs, stores sellerId, refresh token, marketplaceId, last sync time, last feed ids, and sync history |

---

## 5. Integration Flows

### 5.1 Flow A: Inventory Synchronization (Nivaana → Amazon)

**Trigger:** Product added or stock quantity updated in Nivaana  
**Goal:** Update Amazon's available stock

#### Flow Steps

1. **Detect product or stock change** in Nivaana
2. **Prepare JSON payload** with SKU and updated quantity
3. **Submit feed** via `POST /feeds/2021-06-30/feeds`
4. **Poll for feed processing report**
5. **Update Nivaana sync log** with Amazon response

#### Example Payload (Listings Items API)

```json
{
  "productType": "PRODUCT",
  "patches": [
    {
      "op": "replace",
      "path": "/attributes/fulfillment_availability",
      "value": [
        {
          "fulfillment_channel_code": "DEFAULT",
          "quantity": 95
        }
      ]
    }
  ]
}
```

#### Example Payload (Feeds API - POST_INVENTORY_AVAILABILITY_DATA)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope>
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>YOUR_SELLER_ID</MerchantIdentifier>
  </Header>
  <MessageType>Inventory</MessageType>
  <Message>
    <MessageID>1</MessageID>
    <OperationType>Update</OperationType>
    <Inventory>
      <SKU>NIVAANA-SKU-001</SKU>
      <Quantity>95</Quantity>
    </Inventory>
  </Message>
</AmazonEnvelope>
```

#### API Call Example

```javascript
// Method 1: Using Listings Items API (Recommended for single SKU updates)
PATCH /listings/2021-08-01/items/{sellerId}/{sku}
Headers:
  Content-Type: application/json
  x-amz-access-token: {ACCESS_TOKEN}
  Authorization: AWS4-HMAC-SHA256 ...

Body:
{
  "productType": "PRODUCT",
  "patches": [{
    "op": "replace",
    "path": "/attributes/fulfillment_availability",
    "value": [{
      "fulfillment_channel_code": "DEFAULT",
      "quantity": 95
    }]
  }]
}

// Method 2: Using Feeds API (Recommended for bulk updates)
POST /feeds/2021-06-30/feeds
Headers:
  Content-Type: application/json
  x-amz-access-token: {ACCESS_TOKEN}

Body:
{
  "feedType": "POST_INVENTORY_AVAILABILITY_DATA",
  "marketplaceIds": ["A21TJRUUN4KGV"],
  "inputFeedDocumentId": "{DOCUMENT_ID}" // Upload feed document first
}
```

#### Best Practices

- **Batch multiple SKU updates** into one feed (respect size limits)
- **Keep idempotency**: send sequence ids or ensure replays don't double-apply adjustments
- **For multi-warehouse**: Amazon expects a single available quantity per seller SKU per marketplace; you must aggregate per-warehouse stock into a single number
- **Real-time updates**: Sync inventory immediately when stock changes

---

### 5.2 Flow B: Order Synchronization (Amazon → Nivaana)

**Trigger:** Customer places order on Amazon  
**Goal:** Fetch order details and create record in Nivaana

#### Flow Steps

1. **Amazon creates order** after payment
2. **Notifications API sends "ORDER_PLACED" event** OR **Nivaana polls** `GET /orders/v0/orders`
3. **Fetch full order data** via `GET /orders/v0/orders/{orderId}/orderItems`
4. **Create new order** in Nivaana
5. **Decrease availableqty, increase orderqty**

#### API Call Example

```javascript
// Step 1: Fetch orders (Polling or via Notifications)
GET /orders/v0/orders?MarketplaceIds=A21TJRUUN4KGV&CreatedAfter=2025-11-07T00:00:00Z&OrderStatuses=Unshipped

Headers:
  x-amz-access-token: {ACCESS_TOKEN}
  Authorization: AWS4-HMAC-SHA256 ...

Response:
{
  "Orders": [
    {
      "AmazonOrderId": "171-1234567-1234567",
      "PurchaseDate": "2025-11-07T06:00:00Z",
      "OrderStatus": "Unshipped",
      "FulfillmentChannel": "MFN",
      "ShippingAddress": {
        "Name": "John Doe",
        "AddressLine1": "123 Main Street",
        "AddressLine2": "Apt 4B",
        "City": "Bangalore",
        "StateOrRegion": "Karnataka",
        "PostalCode": "560001",
        "CountryCode": "IN",
        "Phone": "+919876543210"
      },
      "BuyerInfo": {
        "BuyerEmail": "customer@example.com"
      }
    }
  ]
}

// Step 2: Get order items
GET /orders/v0/orders/{orderId}/orderItems

Response:
{
  "OrderItems": [
    {
      "OrderItemId": "12345678901234",
      "ASIN": "B08XYZ1234",
      "SellerSKU": "NIVAANA-SKU-001",
      "Title": "Product Name",
      "QuantityOrdered": 5,
      "ItemPrice": {
        "Amount": 1000.00,
        "CurrencyCode": "INR"
      }
    }
  ]
}
```

#### Nivaana Order Creation

```javascript
// Create order in Nivaana
{
  "amazon_order_id": "171-1234567-1234567",
  "order_date": "2025-11-07T06:00:00Z",
  "order_status": "unshipped",
  "fulfillment_channel": "MFN", // Seller-fulfilled
  "customer_name": "John Doe",
  "customer_email": "customer@example.com",
  "customer_phone": "+919876543210",
  "shipping_address": {
    "line1": "123 Main Street",
    "line2": "Apt 4B",
    "city": "Bangalore",
    "state": "Karnataka",
    "postal_code": "560001",
    "country": "IN"
  },
  "items": [
    {
      "amazon_order_item_id": "12345678901234",
      "sku": "NIVAANA-SKU-001",
      "asin": "B08XYZ1234",
      "quantity": 5,
      "price": 1000.00
    }
  ]
}

// Update inventory
availableqty -= 5
orderqty += 5
```

#### Notifications API Setup

```javascript
// Step 1: Create destination
POST /notifications/v1/destinations
Body:
{
  "resourceSpecification": {
    "sqs": {
      "arn": "arn:aws:sqs:us-east-1:123456789012:amazon-orders"
    }
  }
}

// Step 2: Create subscription
POST /notifications/v1/subscriptions/{notificationType}
Body:
{
  "destinationId": "{DESTINATION_ID}",
  "payloadVersion": "1.0"
}

// Notification types:
// - ORDER_CHANGE
// - ORDER_STATUS_CHANGE
```

#### Best Practices

- **Use Notifications API** to reduce polling (better than polling every 5-15 min)
- **Poll frequency**: If using polling, check every 5-15 minutes
- **FBA vs FBM**: If order is FBA, Amazon handles fulfillment; you must NOT decrement your FBM stock for FBA orders. Detect via `FulfillmentChannel` in Orders API
- **Idempotency**: Dedupe on Amazon orderId to prevent duplicate orders

---

### 5.3 Flow C: Shipment Confirmation (Nivaana → Amazon)

**Trigger:** Package dispatched to courier  
**Goal:** Update shipment tracking details on Amazon

#### Flow Steps

1. **Obtain courier and tracking number** from shipping partner
2. **Submit shipment confirmation** API call: `POST /orders/v0/orders/{orderId}/shipmentConfirmation`
3. **Amazon updates order status** to "Shipped"
4. **Customer receives automated email** with tracking number

#### API Call Example

```javascript
// Single shipment confirmation
POST /orders/v0/orders/{orderId}/shipmentConfirmation

Headers:
  Content-Type: application/json
  x-amz-access-token: {ACCESS_TOKEN}
  Authorization: AWS4-HMAC-SHA256 ...

Body:
{
  "shipmentDate": "2025-11-07T14:30:00Z",
  "carrierCode": "BlueDart",
  "carrierName": "Blue Dart Express",
  "trackingNumber": "BD123456789IN",
  "orderItems": [
    {
      "orderItemId": "12345678901234",
      "quantity": 5
    }
  ]
}

Response:
{
  "status": "Success"
}
```

#### Bulk Shipment via Feeds API

```javascript
// For multiple shipments, use Feeds API
POST /feeds/2021-06-30/feeds
Body:
{
  "feedType": "POST_ORDER_FULFILLMENT_DATA",
  "marketplaceIds": ["A21TJRUUN4KGV"],
  "inputFeedDocumentId": "{DOCUMENT_ID}"
}

// Feed document format (XML)
<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope>
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>YOUR_SELLER_ID</MerchantIdentifier>
  </Header>
  <MessageType>OrderFulfillment</MessageType>
  <Message>
    <MessageID>1</MessageID>
    <OrderFulfillment>
      <AmazonOrderID>171-1234567-1234567</AmazonOrderID>
      <FulfillmentDate>2025-11-07T14:30:00Z</FulfillmentDate>
      <FulfillmentData>
        <CarrierCode>BlueDart</CarrierCode>
        <CarrierName>Blue Dart Express</CarrierName>
        <ShippingMethod>Standard</ShippingMethod>
        <ShipperTrackingNumber>BD123456789IN</ShipperTrackingNumber>
      </FulfillmentData>
      <Item>
        <AmazonOrderItemCode>12345678901234</AmazonOrderItemCode>
        <Quantity>5</Quantity>
      </Item>
    </OrderFulfillment>
  </Message>
</AmazonEnvelope>
```

#### Nivaana Inventory Update

```javascript
// After dispatch
orderqty -= 5
soldqty += 5
// availableqty stays the same (already decreased when order received)
```

#### Carrier Codes for India

| Carrier | Code |
|---------|------|
| Blue Dart Express | `BlueDart` |
| Delhivery | `Delhivery` |
| DTDC Courier | `DTDC` |
| FedEx India | `FedEx` |
| Professional Courier | `Professional` |
| Other | `Other` (use with carrierName field) |

#### Best Practices

- **Send immediately** after dispatch (critical for customer experience)
- **Implement retry logic** for failed shipment confirmations
- **Validate carrier codes** before sending (Amazon may reject invalid codes)
- **Use bulk feeds** for multiple shipments to reduce API calls

---

### 5.4 Complete Order Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│          AMAZON ORDER STATUS PROGRESSION                 │
│                                                          │
│  Unshipped ────► Shipped ────► Delivered ────► Completed │
│     ↑               ↑              ↑                      │
│     │               │              │                      │
│   CREATED      YOU UPDATE       (Automatic)            │
│   BY AMAZON    VIA API (API 4)   by Amazon            │
│                                  or courier            │
└─────────────────────────────────────────────────────────┘

YOUR NIVAANA STATUS & INVENTORY:

Step 1: Unshipped (Customer ordered on Amazon)
  └─ Your Action: 
     ├─ Fetch order (API 2 & 3)
     ├─ orderqty += 5
     └─ availableqty -= 5

Step 2: Processing (You pack order)
  └─ Your Action:
     ├─ Print packing slip & invoice
     ├─ Pack product
     ├─ Generate shipping label
     └─ NO inventory changes

Step 3: Dispatched (You hand to courier)
  └─ Your Action:
     ├─ orderqty -= 5
     ├─ soldqty += 5
     ├─ Send shipment confirmation (API 4)
     └─ Amazon status → "Shipped"

Step 4: In Transit (Courier delivers)
  └─ Your Action: Optional tracking monitoring

Step 5: Delivered
  └─ Your Action: Optional reporting/analytics
```

---

## 6. API Reference

### 6.1 Primary Amazon APIs

| API | Purpose | Endpoint Pattern |
|-----|---------|------------------|
| **Feeds API** | Bulk inventory updates, bulk shipment/tracking updates, listing changes | `POST /feeds/2021-06-30/feeds` |
| **Listings Items API** | Per-SKU listing reads/updates (title, price, attributes, quantity) | `PATCH /listings/2021-08-01/items/{sellerId}/{sku}` |
| **Orders API** | Read order details (GET orders, order items) | `GET /orders/v0/orders` |
| **Notifications API** | Subscribe to order/fulfillment-related notifications | `POST /notifications/v1/subscriptions/{notificationType}` |
| **Shipments API** | Confirm shipped packages, upload tracking IDs | `POST /orders/v0/orders/{orderId}/shipmentConfirmation` |

### 6.2 Key Endpoints

#### Update Inventory (Listings Items API)

```http
PATCH https://sellingpartnerapi-eu.amazon.com/listings/2021-08-01/items/{sellerId}/{sku}

Headers:
  Content-Type: application/json
  x-amz-access-token: {ACCESS_TOKEN}
  Authorization: AWS4-HMAC-SHA256 Credential=...

Body:
{
  "productType": "PRODUCT",
  "patches": [
    {
      "op": "replace",
      "path": "/attributes/fulfillment_availability",
      "value": [
        {
          "fulfillment_channel_code": "DEFAULT",
          "quantity": 95
        }
      ]
    }
  ]
}
```

#### Fetch Orders

```http
GET https://sellingpartnerapi-eu.amazon.com/orders/v0/orders?MarketplaceIds=A21TJRUUN4KGV&CreatedAfter=2025-11-07T00:00:00Z&OrderStatuses=Unshipped

Headers:
  x-amz-access-token: {ACCESS_TOKEN}
  Authorization: AWS4-HMAC-SHA256 Credential=...
```

#### Get Order Items

```http
GET https://sellingpartnerapi-eu.amazon.com/orders/v0/orders/{orderId}/orderItems

Headers:
  x-amz-access-token: {ACCESS_TOKEN}
  Authorization: AWS4-HMAC-SHA256 Credential=...
```

#### Confirm Shipment

```http
POST https://sellingpartnerapi-eu.amazon.com/orders/v0/orders/{orderId}/shipmentConfirmation

Headers:
  Content-Type: application/json
  x-amz-access-token: {ACCESS_TOKEN}
  Authorization: AWS4-HMAC-SHA256 Credential=...

Body:
{
  "shipmentDate": "2025-11-07T14:30:00Z",
  "carrierCode": "BlueDart",
  "carrierName": "Blue Dart Express",
  "trackingNumber": "BD123456789IN",
  "orderItems": [
    {
      "orderItemId": "12345678901234",
      "quantity": 5
    }
  ]
}
```

#### Submit Feed

```http
POST https://sellingpartnerapi-eu.amazon.com/feeds/2021-06-30/feeds

Headers:
  Content-Type: application/json
  x-amz-access-token: {ACCESS_TOKEN}
  Authorization: AWS4-HMAC-SHA256 Credential=...

Body:
{
  "feedType": "POST_INVENTORY_AVAILABILITY_DATA",
  "marketplaceIds": ["A21TJRUUN4KGV"],
  "inputFeedDocumentId": "{DOCUMENT_ID}"
}
```

#### Get Feed Processing Report

```http
GET https://sellingpartnerapi-eu.amazon.com/feeds/2021-06-30/feeds/{feedId}

Headers:
  x-amz-access-token: {ACCESS_TOKEN}
  Authorization: AWS4-HMAC-SHA256 Credential=...
```

---

## 7. Data Model & Field Mappings

### 7.1 Inventory Fields Mapping

| Nivaana Field | Description | Sync with Amazon | Direction |
|--------------|-------------|------------------|-----------|
| **availableqty** | Units available for sale | ✅ Yes | → Amazon |
| **orderqty** | Units in pending orders | ❌ No | Internal |
| **soldqty** | Units fulfilled/shipped | ❌ No | Internal |
| **lockqty** | Units locked during internal order process | ❌ No | Internal |
| **sku** | SKU unique identifier | ✅ Yes | ↔ Both |
| **asin** | Amazon Standard Identification Number | ✅ Optional | ← Amazon |
| **warehouse_id** | Warehouse source | ✅ Aggregated | → Amazon |

### 7.2 Inventory Logic Example

```
NIVAANA INVENTORY RECORD for SKU: NIVAANA-SKU-001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

availableqty: 250
  ├─ Meaning: Units AVAILABLE to be ordered RIGHT NOW
  ├─ Sync to Amazon: YES (this is what Amazon shows as "in stock")
  ├─ Updated when:
  │  ├─ New stock received: +100 → availableqty = 350
  │  └─ Amazon order placed: -5 → availableqty = 245
  └─ Never decrease when: Product ships (stays same, just move to soldqty)

orderqty: 25
  ├─ Meaning: Units in PENDING ORDERS from Amazon (not yet shipped)
  ├─ Sync to Amazon: NO (internal tracking only)
  ├─ Updated when:
  │  ├─ New Amazon order: +5 → orderqty = 30
  │  └─ Order dispatched: -5 → orderqty = 25
  └─ Represents: Amount reserved but not yet sold/fulfilled

soldqty: 150
  ├─ Meaning: Units SHIPPED and SOLD (fulfilled orders)
  ├─ Sync to Amazon: NO (internal tracking only)
  ├─ Updated when:
  │  ├─ Order dispatched: +5 → soldqty = 155
  │  └─ Never decreases (historical record)
  └─ Represents: Completed sales

lockqty: 10
  ├─ Meaning: Units LOCKED during payment in YOUR e-commerce app
  ├─ Use: ONLY for your own e-commerce orders (NOT Amazon)
  ├─ For Amazon: IGNORE this field (Amazon pre-pays)
  └─ DO NOT sync to Amazon

REAL-TIME EXAMPLE:
━━━━━━━━━━━━━━━━━

Scenario: Product received, Amazon orders placed, some dispatched

Physical Inventory: Total = 250 units in warehouse

Breakdown:
┌─ 95 units → Available for new orders (availableqty)
├─ 20 units → Pending in 4 Amazon orders (orderqty)
├─ 135 units → Already shipped to customers (soldqty)
└─ 0 units   → Locked in your e-comm (lockqty) [for your app only]

Total: 95 + 20 + 135 = 250 ✓ (Matches warehouse count)

What Amazon Shows: 95 units in stock
What customers see on Amazon.in: 95 available to order
```

### 7.3 SKU Mapping Requirements

- **Nivaana SKU must match Amazon SKU exactly** (case-sensitive)
- Store mapping in database:
  ```sql
  CREATE TABLE amazon_sku_mapping (
    id SERIAL PRIMARY KEY,
    nivaana_sku VARCHAR(255) UNIQUE NOT NULL,
    amazon_sku VARCHAR(255) NOT NULL,
    asin VARCHAR(20),
    marketplace_id VARCHAR(20) DEFAULT 'A21TJRUUN4KGV',
    fulfillment_channel VARCHAR(10) DEFAULT 'FBM',
    last_sync_at TIMESTAMP,
    last_feed_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

### 7.4 Order Data Model

```javascript
// Nivaana Order Schema
{
  id: number,
  amazon_order_id: string, // Unique identifier from Amazon
  order_date: timestamp,
  order_status: 'unshipped' | 'shipped' | 'delivered' | 'cancelled',
  fulfillment_channel: 'MFN' | 'AFN', // Seller-fulfilled vs Amazon-fulfilled
  marketplace_id: string, // 'A21TJRUUN4KGV'
  
  // Customer info (use only for fulfillment, don't store long-term per Amazon policy)
  customer_name: string,
  customer_email: string,
  customer_phone: string,
  shipping_address: {
    line1: string,
    line2?: string,
    city: string,
    state: string,
    postal_code: string,
    country: string
  },
  
  // Items
  items: [{
    amazon_order_item_id: string,
    sku: string,
    asin: string,
    quantity: number,
    price: number
  }],
  
  // Shipping
  tracking_number?: string,
  carrier_code?: string,
  carrier_name?: string,
  shipment_date?: timestamp,
  
  // Sync tracking
  last_sync_at: timestamp,
  sync_status: 'pending' | 'synced' | 'error',
  sync_errors?: string[]
}
```

---

## 8. Error Handling & Retry Strategy

### 8.1 Common Error Codes

| Error Code | Cause | Action |
|------------|-------|--------|
| **400 Bad Request** | Invalid payload | Validate JSON before submission |
| **401 Unauthorized** | Token expired | Refresh LWA token using refresh token |
| **403 Forbidden** | Missing permissions | Recheck IAM role and API roles |
| **404 Not Found** | Order/SKU not found | Verify orderId, marketplaceId |
| **429 Too Many Requests** | Rate limit exceeded | Implement exponential backoff |
| **500 Internal Server Error** | Amazon internal issue | Retry after delay, log details |

### 8.2 Retry Logic

```javascript
// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 2000, // 2 seconds
  maxDelay: 15000, // 15 seconds
  backoffMultiplier: 2.5
};

async function callWithRetry(apiCall, retries = 0) {
  try {
    return await apiCall();
  } catch (error) {
    if (retries >= RETRY_CONFIG.maxRetries) {
      throw error;
    }
    
    // Don't retry on 4xx errors (except 429)
    if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
      throw error;
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retries),
      RETRY_CONFIG.maxDelay
    );
    
    await sleep(delay);
    return callWithRetry(apiCall, retries + 1);
  }
}

// Usage
const result = await callWithRetry(() => 
  amazonAPI.updateInventory(sku, quantity)
);
```

### 8.3 Feed Processing Error Handling

```javascript
// Always check feed processing report
async function submitFeedAndCheckReport(feedData) {
  // 1. Submit feed
  const feedResponse = await amazonAPI.submitFeed(feedData);
  const feedId = feedResponse.feedId;
  
  // 2. Poll for processing completion
  let feedStatus = 'IN_PROGRESS';
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max
  
  while (feedStatus === 'IN_PROGRESS' && attempts < maxAttempts) {
    await sleep(10000); // Wait 10 seconds
    const feed = await amazonAPI.getFeed(feedId);
    feedStatus = feed.processingStatus;
    attempts++;
  }
  
  // 3. Get processing report
  if (feedStatus === 'DONE') {
    const report = await amazonAPI.getFeedProcessingReport(feedId);
    
    // Parse report for errors
    const errors = parseFeedReport(report);
    if (errors.length > 0) {
      // Log errors and requeue failed SKUs
      logger.error('Feed processing errors', { feedId, errors });
      await requeueFailedSKUs(errors);
    }
  } else {
    throw new Error(`Feed processing failed: ${feedStatus}`);
  }
}
```

### 8.4 Error Logging

```javascript
// Comprehensive error logging
function logAPIError(operation, error, context = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    operation,
    error: {
      message: error.message,
      code: error.response?.status,
      data: error.response?.data
    },
    context,
    stack: error.stack
  };
  
  // Log to database
  await db.errorLogs.create(errorLog);
  
  // Alert if critical
  if (error.response?.status >= 500) {
    await sendAlert('Amazon API Error', errorLog);
  }
}
```

---

## 9. Testing Plan

### 9.1 Testing Stages

| Stage | Activity | Validation |
|-------|----------|------------|
| **1. Authentication Test** | Test refresh token → access token exchange | Verify valid token response |
| **2. Inventory Feed Test** | Push sample SKU with quantity | Confirm Amazon shows updated qty |
| **3. Order Fetch Test** | Place test order in sandbox | Confirm order received in Nivaana |
| **4. Shipment Test** | Post test shipment confirmation | Confirm order status → Shipped |
| **5. Rate Limit Test** | Run multiple concurrent calls | Confirm retry logic works |
| **6. Error Simulation** | Use invalid orderId | Confirm error logging |
| **7. Reconciliation Test** | Compare Amazon vs Nivaana stock | Confirm accurate sync |

### 9.2 Sandbox Testing

```javascript
// Sandbox environment configuration
const SANDBOX_CONFIG = {
  baseURL: 'https://sandbox.sellingpartnerapi-eu.amazon.com',
  marketplaceId: 'A21TJRUUN4KGV',
  testOrderId: 'TEST-ORDER-123', // Use Amazon's test order IDs
  testSKU: 'TEST-SKU-001'
};

// Test inventory update
async function testInventoryUpdate() {
  const result = await amazonAPI.updateInventory(
    SANDBOX_CONFIG.testSKU,
    100,
    SANDBOX_CONFIG
  );
  console.log('Inventory update test:', result);
}

// Test order fetch
async function testOrderFetch() {
  const orders = await amazonAPI.getOrders({
    marketplaceIds: [SANDBOX_CONFIG.marketplaceId],
    createdAfter: new Date(Date.now() - 86400000).toISOString()
  });
  console.log('Orders fetched:', orders);
}

// Test shipment confirmation
async function testShipmentConfirmation() {
  const result = await amazonAPI.confirmShipment(
    SANDBOX_CONFIG.testOrderId,
    {
      carrierCode: 'BlueDart',
      trackingNumber: 'TEST-TRACKING-123',
      shipmentDate: new Date().toISOString()
    },
    SANDBOX_CONFIG
  );
  console.log('Shipment confirmation test:', result);
}
```

### 9.3 Production Testing Checklist

- [ ] Test with 1 real product (low stock item)
- [ ] Place 1 real order on Amazon.in
- [ ] Verify order appears in Nivaana within 15 minutes
- [ ] Process and dispatch order
- [ ] Verify shipment confirmation updates Amazon
- [ ] Verify customer receives tracking email
- [ ] Monitor for 24 hours for any errors

---

## 10. Go-Live Checklist

### 10.1 Pre-Launch (One-time Setup)

- [ ] **SP-API Developer Registration Approved**
- [ ] **Private App Created with Roles**
- [ ] **IAM Role Linked to Developer Profile**
- [ ] **Refresh Token Generated and Secured**
- [ ] **Token Refresh Logic Implemented**
- [ ] **Sandbox Testing Passed**
- [ ] **Notifications Endpoint Verified (HTTPS)**
- [ ] **Inventory Feed Upload Successful**
- [ ] **Order Fetch Flow Validated**
- [ ] **Shipment Confirmation Verified**
- [ ] **Reconciliation Job Scheduled**
- [ ] **Error Logging and Retry Implemented**
- [ ] **Go-Live Credentials Configured**
- [ ] **Production Test Order Verified**

### 10.2 Operational (Ongoing)

- [ ] **Product added to Amazon → Sync inventory via API**
- [ ] **Every 5-15 min: Fetch orders via API**
- [ ] **For each order: Update Nivaana inventory (orderqty ↑, availableqty ↓)**
- [ ] **Pack order in Nivaana**
- [ ] **Dispatch to courier**
- [ ] **Get tracking number**
- [ ] **Send shipment confirmation via API**
- [ ] **Monitor API errors and retry**
- [ ] **Track data accuracy daily**

### 10.3 Key Numbers to Remember

| Metric | Value | Notes |
|--------|-------|-------|
| **API Token Expiry** | 1 hour | Refresh before expiry |
| **Order Poll Frequency** | 5-15 min | Or use Notifications API |
| **Rate Limit (Get Orders)** | 1 req/min | Can increase with usage |
| **Rate Limit (Shipment)** | 2 req/sec | Good headroom for most sellers |
| **Inventory Sync** | Real-time | Do it immediately on change |
| **SKU Match Requirement** | Exact | Nivaana SKU = Amazon SKU |
| **Marketplace ID (India)** | A21TJRUUN4KGV | Use for all India queries |

---

## 11. Operational Guidelines

### 11.1 Responsibility Matrix

| Task | Owner | When | System |
|------|-------|------|--------|
| Product creation | You | On-demand | Nivaana |
| Inventory sync to Amazon | You | Real-time | API |
| Order placement | Amazon | When customer buys | Amazon |
| Order fetch from Amazon | You | Every 5-15 min | API |
| Inventory update on order | You | Upon order receipt | Nivaana |
| Packing & labeling | You | During processing | Nivaana |
| Shipment confirmation to Amazon | You | After dispatch | API |
| Tracking display to customer | Amazon | After shipment API | Amazon.in |
| Delivery | Courier | In transit | Courier |

### 11.2 FBA vs FBM Handling

**Important:** If a SKU is under FBA (Fulfilled by Amazon), you must NOT update Amazon stock for that SKU — Amazon manages it. For FBM/Seller-fulfilled, you must push inventory updates.

**Detection:**
```javascript
// Check fulfillment channel in order
if (order.FulfillmentChannel === 'AFN') {
  // Amazon Fulfilled - don't update inventory
  logger.info('FBA order - skipping inventory update', { orderId });
} else if (order.FulfillmentChannel === 'MFN') {
  // Seller Fulfilled - update inventory
  await updateInventory(order);
}
```

### 11.3 Rate Limits & Throttling

- **SP-API has rate limits per API** — implement backoff and batching
- **Polling too frequently wastes quota** — prefer Notifications
- **Spread API calls** to avoid hitting limits
- **Use exponential backoff** for 429 errors

### 11.4 Async Feed Processing

- **Feeds are processed asynchronously** — always fetch the processing report
- **Parse per-SKU errors** from processing report
- **Requeue failed SKUs** for retry
- **Log all feed processing results** for audit

### 11.5 Carrier Names & Services

- **Amazon validates carriers and shipping services**
- **Use Amazon's accepted carrier codes** (see section 5.3)
- **Otherwise, Amazon may reject tracking updates**
- **Test carrier codes in sandbox first**

### 11.6 Idempotency & Reconciliation

- **Treat feeds and order handling idempotently** (use internal request IDs)
- **Dedupe on Amazon orderId** to prevent duplicate orders
- **Reconcile daily** against Amazon reports (inventory and order reports)
- **Produce discrepancy alerts** for ops team

### 11.7 Security Best Practices

- **Store refresh tokens and AWS credentials securely** (encrypted vault)
- **Validate Notifications signature** on receipt
- **Use HTTPS** for all webhook endpoints
- **Rotate credentials** periodically
- **Monitor for unauthorized access**

### 11.8 Reconciliation Job

```javascript
// Daily reconciliation job
async function reconcileInventory() {
  // 1. Get inventory from Amazon
  const amazonInventory = await amazonAPI.getInventoryReport();
  
  // 2. Get inventory from Nivaana
  const nivaanaInventory = await db.stock.findAll({
    where: { marketplace: 'amazon' }
  });
  
  // 3. Compare and find discrepancies
  const discrepancies = [];
  for (const item of nivaanaInventory) {
    const amazonItem = amazonInventory.find(
      a => a.sellerSku === item.sku
    );
    
    if (amazonItem && amazonItem.quantity !== item.availableqty) {
      discrepancies.push({
        sku: item.sku,
        nivaana: item.availableqty,
        amazon: amazonItem.quantity,
        difference: item.availableqty - amazonItem.quantity
      });
    }
  }
  
  // 4. Alert if discrepancies found
  if (discrepancies.length > 0) {
    await sendAlert('Inventory Discrepancies', discrepancies);
    // Optionally auto-sync
    await syncDiscrepancies(discrepancies);
  }
}
```

---

## 12. Troubleshooting

### 12.1 Common Issues

#### Issue 1: Order Placed But Item Out of Stock

**Problem:** Customer ordered 5 units, but availableqty was 0  
**Cause:** Nivaana inventory not synced to Amazon  
**Prevention:**
- Always sync inventory to Amazon when stock changes
- Use notifications to update Amazon in real-time
- Set stock check frequency to minimum (every 5 min)

**Recovery:**
- Cancel order on Amazon if truly out of stock
- Or fulfill from alternative source and update tracking

#### Issue 2: Order Received, But Nivaana Misses It

**Problem:** Customer ordered but Nivaana didn't fetch order  
**Cause:** API polling missed it or network error  
**Prevention:**
- Use Notifications API for real-time detection (better than polling)
- Implement retry logic for failed API calls
- Monitor logs for missed orders

**Recovery:**
- Manually check Seller Central for unfetched orders
- Create order in Nivaana manually
- Verify inventory adjustments

#### Issue 3: Order Dispatched, But Amazon Not Updated

**Problem:** Package shipped but Amazon still shows "Unshipped"  
**Cause:** Shipment confirmation API call failed  
**Result:** Customer gets no tracking info, order incomplete  
**Prevention:**
- Implement retry logic for shipment confirmation API
- Log all API responses
- Set up alerts for failed shipment updates

**Recovery:**
- Manually send shipment confirmation via API
- Or update in Seller Central dashboard
- Send tracking number to customer via Amazon messaging

#### Issue 4: Inventory Mismatch

**Problem:** Amazon shows different quantity than Nivaana  
**Cause:** Feed processing failed or not sent  
**Prevention:**
- Always check feed processing reports
- Implement reconciliation job
- Monitor feed status

**Recovery:**
- Run reconciliation job
- Manually sync inventory for affected SKUs
- Investigate root cause (feed errors, API failures)

### 12.2 Quick Decision Tree

```
Q: Product has new stock in Nivaana
└─ A: Call API to update Amazon inventory ✓

Q: Order appears on Seller Central
└─ A: Call API to fetch, create in Nivaana ✓

Q: Order is being processed in Nivaana
└─ A: No API call yet, just internal updates ✓

Q: Package is handed to courier
└─ A: Call API to confirm shipment to Amazon ✓

Q: Inventory fields for Amazon order
└─ A: orderqty ↑, availableqty ↓, NOT lockqty ✓

Q: Should we store customer data?
└─ A: Use only for fulfillment, don't store long-term ✓

Q: What if API call fails?
└─ A: Implement retry with exponential backoff ✓

Q: How to handle rate limits?
└─ A: Spread requests, use exponential backoff ✓
```

### 12.3 Debugging Tips

1. **Enable verbose logging** for all API calls
2. **Store request/response** in database for audit
3. **Monitor feed processing reports** for SKU-level errors
4. **Set up alerts** for API failures and discrepancies
5. **Use Amazon Seller Central** to verify sync status
6. **Check token expiry** if getting 401 errors
7. **Verify marketplace ID** if getting 404 errors
8. **Check IAM permissions** if getting 403 errors

---

## 13. Support & References

### 13.1 Official Documentation

| Resource | URL |
|----------|-----|
| **Amazon SP-API Docs** | https://developer-docs.amazon.com/sp-api/ |
| **Orders API Reference** | https://developer-docs.amazon.com/sp-api/docs/orders-api-v0-reference |
| **Feeds API Reference** | https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference |
| **Listings Items API** | https://developer-docs.amazon.com/sp-api/docs/listings-items-api-v2021-08-01-reference |
| **Notifications API** | https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference |
| **AWS SigV4 Guide** | https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html |
| **LWA (Login With Amazon)** | https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api |

### 13.2 Support Channels

- **Amazon SP-API Support:** https://developer.amazonservices.com/support
- **Seller Central (India):** https://sellercentral.amazon.in
- **Developer Forums:** https://developer-docs.amazon.com/sp-api/docs/community-support

### 13.3 Common Troubleshooting Resources

- **Token invalid?** Refresh using refresh_token
- **Order not syncing?** Check marketplace ID and API quota
- **Shipment not updating?** Verify order ID and response status
- **Inventory mismatch?** Check last API call time and response

---

## 14. Implementation Checklist - MVP

### 14.1 Minimal Implementation (First MVP)

1. [ ] **Register app + get LWA + AWS credentials and seller refresh token**
2. [ ] **Implement auth (LWA refresh token exchange) + SigV4 signing module**
3. [ ] **Implement Notifications subscription and a webhook receiver for new orders**
4. [ ] **Implement order ingestion flow:** receive notification → call Orders API for full details → create order in Nivaana
5. [ ] **Implement inventory feed submit** (small batches) and process feed reports. Start with a simple single-SKU feed update when stock changes
6. [ ] **Implement shipment confirmation** (confirmShipment) for single orders; add bulk feed shipment later
7. [ ] **Add a daily reconciliation cron job** (compare Amazon inventory vs Nivaana)

### 14.2 Production-Ready Features

1. [ ] **Error handling and retry logic** for all API calls
2. [ ] **Comprehensive logging** and monitoring
3. [ ] **Admin dashboard** for sync status and logs
4. [ ] **Alerting system** for critical failures
5. [ ] **Bulk operations** for inventory and shipments
6. [ ] **SKU mapping management** UI
7. [ ] **Reconciliation reports** and discrepancy resolution

---

## 15. Conclusion

This integration enables seamless two-way communication between Nivaana Inventory and Amazon Seller Central India. Once implemented:

- ✅ Inventory updates propagate automatically to Amazon listings
- ✅ Orders flow into Nivaana in near real-time
- ✅ Shipments and tracking updates are synced back to Amazon instantly

By following this guide, developers can confidently deploy and maintain a robust, compliant SP-API integration ensuring accurate stock levels, timely order processing, and complete traceability between systems.

**Key Success Factors:**
- Proper authentication and token management
- Real-time inventory synchronization
- Reliable order fetching (prefer Notifications over polling)
- Immediate shipment confirmation after dispatch
- Daily reconciliation and error monitoring
- Comprehensive error handling and retry logic

---

**Document Version:** 1.0  
**Last Updated:** November 2025  
**Maintained By:** Integration Team – Nivaana Inventory

---

## Appendix A: Code Examples

### A.1 Complete Integration Service Example

```typescript
// amazon-integration.service.ts
import axios from 'axios';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';

export class AmazonIntegrationService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  
  async updateInventory(sku: string, quantity: number) {
    const token = await this.getAccessToken();
    const request = {
      method: 'PATCH',
      url: `https://sellingpartnerapi-eu.amazon.com/listings/2021-08-01/items/${SELLER_ID}/${sku}`,
      headers: {
        'Content-Type': 'application/json',
        'x-amz-access-token': token
      },
      body: JSON.stringify({
        productType: 'PRODUCT',
        patches: [{
          op: 'replace',
          path: '/attributes/fulfillment_availability',
          value: [{
            fulfillment_channel_code: 'DEFAULT',
            quantity: quantity
          }]
        }]
      })
    };
    
    const signedRequest = await this.signRequest(request);
    return await axios(signedRequest);
  }
  
  async getOrders(createdAfter: string) {
    const token = await this.getAccessToken();
    const request = {
      method: 'GET',
      url: `https://sellingpartnerapi-eu.amazon.com/orders/v0/orders?MarketplaceIds=A21TJRUUN4KGV&CreatedAfter=${createdAfter}`,
      headers: {
        'x-amz-access-token': token
      }
    };
    
    const signedRequest = await this.signRequest(request);
    return await axios(signedRequest);
  }
  
  async confirmShipment(orderId: string, shipmentData: any) {
    const token = await this.getAccessToken();
    const request = {
      method: 'POST',
      url: `https://sellingpartnerapi-eu.amazon.com/orders/v0/orders/${orderId}/shipmentConfirmation`,
      headers: {
        'Content-Type': 'application/json',
        'x-amz-access-token': token
      },
      body: JSON.stringify(shipmentData)
    };
    
    const signedRequest = await this.signRequest(request);
    return await axios(signedRequest);
  }
  
  private async getAccessToken() {
    const now = Date.now();
    if (!this.accessToken || now >= this.tokenExpiry - 60000) {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', {
        grant_type: 'refresh_token',
        refresh_token: process.env.AMAZON_REFRESH_TOKEN,
        client_id: process.env.AMAZON_CLIENT_ID,
        client_secret: process.env.AMAZON_CLIENT_SECRET
      });
      
      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + 3600000; // 1 hour
    }
    return this.accessToken!;
  }
  
  private async signRequest(request: any) {
    const signer = new SignatureV4({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      },
      region: process.env.AMAZON_REGION!,
      service: 'execute-api',
      sha256: Sha256
    });
    
    return await signer.sign(request);
  }
}
```

---

**End of Document**

