# Amazon-Nivaana Integration Guide
## Sandbox Implementation (Testing & Development)

**Version:** 1.0  
**Date:** November 7, 2025  
**Environment:** Sandbox (Testing)  
**Marketplace:** Amazon India (Marketplace ID: A21TJRUUN4KGV)

> **📌 Quick Links:** [Main Guide](./AMAZON_INTEGRATION_MAIN.md) | [Production Guide](./AMAZON_INTEGRATION_PRODUCTION.md)

---

## 🎯 What is Sandbox?

**Sandbox** is Amazon's testing environment where you can:
- ✅ Test ALL SP-API endpoints without restrictions
- ✅ No identity verification required
- ✅ No business documents needed
- ✅ Start testing immediately
- ✅ All APIs automatically enabled

**Perfect for:** Development, testing, validation before going live.

---

## 🔑 Important IDs Clarification

**Common Confusion - What are these IDs?**

| ID | What It Is | Where You See It | Is It Fixed? |
|----|------------|------------------|--------------|
| **`A1LIKGFDSPWZB2`** | **Developer Account ID** | Portal header (top right) | ✅ Yes - Your account ID |
| **`A21TJRUUN4KGV`** | **Marketplace ID** (India) | Used in API calls | ✅ Yes - Fixed for all India sellers |
| **`amzn1.sp.solution.xxxxx`** | **App ID** | Developer Central table | ✅ Yes - Your app identifier |
| **`amzn1.application-oa2-client.xxxxx`** | **Client ID** (LWA) | LWA credentials modal | ❌ No - Different for sandbox/prod |

**Key Points:**
- ✅ **Marketplace ID (`A21TJRUUN4KGV`)** is **FIXED** for Amazon India - same for sandbox and production
- ✅ **Developer Account ID (`A1LIKGFDSPWZB2`)** is **FIXED** - it's your account identifier
- ❌ **Client ID** is **DIFFERENT** for sandbox vs production (but use same env key!)

---

## ✅ Prerequisites (Sandbox)

| Requirement | Sandbox Status |
|------------|----------------|
| **Amazon Seller Account** | Not required for testing |
| **SP-API Developer Registration** | ✅ Required (can use personal mobile number) |
| **Identity Verification** | ❌ **NOT Required** |
| **Business Documents** | ❌ **NOT Required** |
| **API Role Access** | ✅ **Auto-enabled** (all APIs available) |
| **AWS Account** | ✅ Required (for SigV4 signing) |
| **LWA Authorization** | ✅ Required (get refresh token) |

---

## 🚀 Step-by-Step Setup (Sandbox)

### Step 1: Register as Developer

1. Go to **Solution Provider Portal** → Register
2. Register as:
   - **Individual Developer** (using personal mobile number) ✅
   - **On behalf of Company** (using company information)
3. **No identity verification needed** - start immediately!

### Step 2: Create Sandbox App

1. In **Developer Central**, click **"+ Add new app client"**
2. **App Status:** Automatically set to **"Sandbox"**
3. Fill in app details:
   - **App name:** Nivaana (or your choice)
   - **API Type:** SP API
4. Click **"Save and exit"**

### Step 3: Get LWA Credentials

1. In Developer Central, find your app
2. Click **"View sandbox credentials"** link
3. **Copy and save:**
   - **Client Identifier** (Client ID)
   - **Client Secret** (click to reveal)
   - **Rotation Deadline** (note the date)

4. **Store in environment variables:**
   ```env
   # Sandbox Credentials
   AMAZON_CLIENT_ID_SANDBOX=amzn1.application-oa2-client.xxxxx
   AMAZON_CLIENT_SECRET_SANDBOX=your_client_secret_here
   AMAZON_ENVIRONMENT=SANDBOX
   AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV
   AMAZON_SP_API_BASE_URL=https://sandbox.sellingpartnerapi-eu.amazon.com
   ```

### Step 4: API Roles (Sandbox)

**⚠️ Important:** When you click "Edit App" for a Sandbox app, you'll see:

> **"Sandbox apps have access to all static sandbox APIs. Your production data access may be different..."**

**What This Means:**
- ✅ **No action needed!** All APIs are automatically enabled in sandbox
- ✅ You have access to:
  - Orders API ✅
  - Feeds API ✅
  - Notifications API ✅
  - Listings API ✅
  - Shipping API ✅

**Action:** Skip this step - proceed to AWS setup!

### Step 5: Set Up AWS Account and IAM Role

**⚠️ Important Update (October 2023):** Amazon SP-API authentication has changed. SP-API now primarily uses LWA (Login with Amazon) access tokens. However, you may still need to create an IAM role to link it in the Solution Provider Portal, even if it's not used for actual API authentication.

**Why:** Some SP-API setups still require an IAM role ARN to be linked in your developer profile, though the role may not be actively used for SigV4 signing in newer implementations.

1. **Create AWS Account:**
   - Go to https://aws.amazon.com/
   - Sign up with **YOUR email** (same as SP-API developer account)
   - **When asked "How do you plan to use AWS?":**
     - **Option A: "Personal - for your own projects"** ✅ **Recommended for developers**
       - Simpler setup
       - Fine for SP-API integration
       - No business verification needed
       - Works perfectly for SigV4 signing
     - **Option B: "Business - for your work, school, or organization"**
       - Use if you're doing this professionally for clients
       - May require business information
       - Both options work for SP-API - choose based on your situation
   - **Note:** This choice doesn't affect SP-API functionality - either works!
   - Complete verification (email, phone, payment method)

2. **Create IAM Role:**
   
   **🚨 CRITICAL: New AWS Account Restrictions**
   
   **If you created your AWS account within the last 24-48 hours**, you may encounter "Invalid principal" errors when creating IAM roles with cross-account trust relationships. This is a common AWS security restriction for new accounts.
   
   **Solutions for New AWS Accounts:**
   
   - **Option 1: Wait 24-48 hours** ⏰ (Recommended)
     - New AWS accounts often need 24-48 hours to fully activate all IAM features
     - Try creating the role again after waiting
     - This is the most reliable solution
   
   - **Option 2: Contact AWS Support** 📞
     - Open a support case with AWS Support
     - Request them to remove the restriction on your account
     - They can usually do this quickly for legitimate use cases
   
   - **Option 3: Check if IAM Role is Actually Required** ✅
     - Go to Solution Provider Portal → Developer Profile Settings
     - Check if "AWS IAM Role ARN" field is **required** or **optional**
     - As of October 2023, SP-API primarily uses LWA tokens, so the IAM role might be optional
     - If optional, you can skip this step and proceed without the role
   
   **⚠️ Important:** There is **NO managed AWS policy** called `AmazonSellingPartnerAPIFullAccess` or `sellingpartnerapifullaccess`. You must add an **inline policy** to the role.
   
   **⚠️ Note:** Do NOT use `AWSMarketplaceSellerFullAccess` - that's for AWS Marketplace (selling software on AWS), NOT for Amazon Selling Partner API (e-commerce integration). These are completely different services!
   
   **📋 About Amazon's Account ID (`589160054188`):**
   
   - **Where does this come from?** This is Amazon's official AWS account ID for SP-API services, as documented in Amazon's SP-API developer documentation.
   - **Why don't I see it in Solution Provider Portal?** This ID is NOT shown in your developer portal because it's Amazon's internal AWS account ID, not something related to your developer account. It's used specifically for the IAM trust relationship.
   - **Why do I need it?** When you create an IAM role, you need to specify which AWS account can "assume" (use) that role. By entering Amazon's account ID (`589160054188`), you're telling AWS: "Allow Amazon's SP-API service (running in account 589160054188) to use this role in my account."
   - **Is this correct?** Yes, this is the standard account ID used by all SP-API developers. It's documented in Amazon's official SP-API setup guides.
   - **Your account ID vs Amazon's:** 
     - Your AWS account ID: `260727659482` (where you create the role)
     - Amazon's account ID: `589160054188` (who can assume the role)
   
   **⚠️ Important:** If you get an error "Invalid principal in policy", use **Option B (Custom Trust Policy)** below instead.
   
   **Option A: Using AWS Console Wizard (Try this first):**
   - AWS Console → IAM → Roles → Create Role
   - Trusted entity: **"AWS Account"**
   - Under "An AWS account", select **"Another AWS account"** (NOT "This account")
   - Enter Amazon's account ID: `589160054188`
   - Click **"Next"**
   - **Skip attaching any policies** (we'll add an inline policy after creating the role)
   - Click **"Next"** (you may see a warning - that's okay)
   - Role name: `SP-API-Role`
   - Description: `IAM role for Amazon SP-API integration`
   - Click **"Create role"**
   
   **Option B: Using Custom Trust Policy with Service Principal (Try if Option A fails):**
   
   If you get an "Invalid principal" error with the account ID, try using a **service principal** with `.amazonaws.com`:
   
   - AWS Console → IAM → Roles → Create Role
   - Click **"Custom trust policy"** tab (at the top)
   - Paste this trust policy (using service principal):
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Principal": {
             "Service": "sellingpartnerapi.amazonaws.com"
           },
           "Action": "sts:AssumeRole"
         }
       ]
     }
     ```
   - Click **"Next"**
   - **Skip attaching any policies** (we'll add an inline policy after creating the role)
   - Click **"Next"**
   - Role name: `SP-API-Role`
   - Description: `IAM role for Amazon SP-API integration`
   - Click **"Create role"**
   
   **Note:** Use `sellingpartnerapi.amazonaws.com` (with `.amazonaws.com`, not `.amazon.com`).
   
   **Option C: For New AWS Accounts (Created < 24-48 hours ago):**
   
   **If your AWS account is new**, the "Invalid principal" error is likely due to AWS account restrictions. Here's what to do:
   
   1. **Wait 24-48 hours** ⏰ (Most Common Solution)
      - New AWS accounts need time to fully activate IAM features
      - Cross-account trust relationships are often restricted initially
      - Try again after 24-48 hours - this usually resolves the issue
   
   2. **Contact AWS Support** 📞 (Fastest Solution)
      - Go to AWS Support Center → Create a support case
      - Explain you need to create an IAM role for Amazon SP-API integration
      - Request removal of the new account restriction for IAM role creation
      - AWS Support can usually remove this restriction quickly
   
   3. **Check if IAM Role is Actually Required** ✅
      - Go to Solution Provider Portal → Developer Profile Settings
      - Check if "AWS IAM Role ARN" field is **required** (red asterisk) or **optional**
      - **As of October 2023**, SP-API primarily uses LWA tokens, not IAM roles
      - If the field is **optional**, you can skip creating the role for now
      - You can always add it later when your AWS account restrictions are lifted
   
   4. **Verify Account Status**
      - Ensure your AWS account is fully verified (email, phone, payment method)
      - Some restrictions are lifted after account verification is complete
   
   **Note:** This is a temporary restriction on new AWS accounts, not a problem with your configuration. The role creation will work once the restriction is lifted.

3. **Add Inline Policy to the Role:**
   - After the role is created, click on the role name `SP-API-Role`
   - Click on the **"Permissions"** tab
   - Click **"Add permissions"** → **"Create inline policy"**
   - Click the **"JSON"** tab
   - Paste the following policy document:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": "execute-api:Invoke",
           "Resource": "arn:aws:execute-api:*:*:*"
         }
       ]
     }
     ```
   - Click **"Next"**
   - Policy name: `SPAPIAccessPolicy`
   - Click **"Create policy"**
   - **Copy the Role ARN** (format: `arn:aws:iam::YOUR_ACCOUNT_ID:role/SP-API-Role`)

4. **Link IAM Role:**
   
   **📍 Where to Find "Developer Profile Settings" / IAM Role ARN Field:**
   
   **⚠️ Important Clarification:**
   - **For Sandbox Apps:** Identity verification is **NOT required**
   - The "Solution Type Setup" page mentions verification, but that's mainly for "Offer services" option
   - If you selected "Build applications that use SP APIs", you don't need verification for sandbox
   - The IAM Role ARN field might not be visible or required for sandbox apps
   
   **For Sandbox Apps, try these locations:**
   
   **Option 1: Settings Icon → Solution Type Setup**
   - Click the **Settings gear icon** (⚙️) in the top right corner
   - Click **"Solution Type Setup"**
   - Make sure "Build applications that use SP APIs" is checked
   - Look for any IAM Role ARN field (might not be present for sandbox)
   - **Note:** The verification message is for "Offer services" - you can ignore it for sandbox
   
   **Option 2: App Settings (Edit Your Sandbox App)**
   - Go to **Apps** → Find your "Nivaana" sandbox app
   - Click **"Edit"** on your sandbox app
   - Look for "AWS IAM Role ARN" or "IAM Role" field in the app settings
   - Paste the IAM Role ARN (if field exists)
   - Save
   
   **Option 3: Skip This Step (Most Likely for Sandbox)**
   - **Important:** For sandbox apps, the IAM Role ARN is likely **NOT required**
   - As of October 2023, SP-API primarily uses LWA tokens, not IAM roles
   - The "Set up Solution Provider Account Profile and Permissions" section is for **production apps only**
   - **For sandbox, you can skip this step entirely**
   - You can proceed directly to Step 6 (Get Refresh Token)
   
   **About "Solution Type Setup" and Verification:**
   - The verification mentioned in "Solution Type Setup" is for **"Offer services"** option
   - If you're just "Building applications that use SP APIs" (sandbox), verification is **NOT needed**
   - The greyed-out "Set up Solution Provider Account Profile and Permissions" is for production
   - **For sandbox testing, you don't need to complete identity verification**
   
   **✅ Recommendation for Sandbox:**
   - **Skip Step 4 (Link IAM Role)** - it's not required for sandbox
   - Proceed directly to **Step 6: Get Refresh Token**
   - The IAM role will be needed later for production, but not for sandbox testing

5. **Add AWS credentials to environment:**
   
   **⚠️ Important:** As of October 2023, SP-API primarily uses LWA tokens. AWS Access Keys might not be strictly required for API calls, but you may need them for SigV4 signing if your implementation requires it.
   
   **Option A: If AWS Access Keys are Required (Create IAM User):**
   
   **📋 Updated AWS Console Flow (2024-2025):**
   
   AWS has updated their console - you now create the user first, then generate access keys separately.
   
   1. **Create IAM User:**
      - AWS Console → IAM → Users → **Add users**
      - **Step 1: Specify user details**
        - Username: `sp-api-user` (or any name)
        - **Uncheck** "Provide user access to the AWS Management Console" (unless you need console access)
        - **Note:** The blue info box says: "If you are creating programmatic access through access keys... you can generate them after you create this IAM user"
        - Click **"Next"**
      
      - **Step 2: Set permissions** (Optional)
        - You can skip attaching policies if you're only using it for SP-API
        - Or attach minimal policies if needed
        - Click **"Next"**
      
      - **Step 3: Review and create**
        - Review the details
        - Click **"Create user"**
   
   2. **Generate Access Keys (After User Creation):**
      - After creating the user, you'll see a success page
      - **Option A: Create access key immediately**
        - On the success page, look for **"Create access key"** button or link
        - Click it to generate access keys right away
      
      - **Option B: Create access key later (Recommended method):**
        - Go to IAM → Users → Select your user (`sp-api-user`)
        - Click the **"Security credentials"** tab
        - Scroll down to **"Access keys"** section
        - Click **"Create access key"** button
        - **Select use case:** Choose **"Application running outside AWS"** ✅
          - **Why:** Your Nivaana web application runs outside AWS and needs programmatic access to AWS services for SP-API SigV4 signing
          - **Alternative:** If "Application running outside AWS" is not available, select **"Other"**
        - **Description (Optional but Recommended):**
          - Enter: `Amazon SP-API integration for Nivaana backend`
          - Or: `SP-API SigV4 signing credentials`
          - This helps you identify the key's purpose later
        - Click **"Next"** → **"Create access key"**
        - **⚠️ CRITICAL:** You'll see:
          - **Access key ID** (starts with `AKIA...`)
          - **Secret access key** (long string)
        - **Copy BOTH immediately** - you can only see the secret key ONCE!
        - Download as CSV or copy to secure location
        - Click **"Done"**
   
   **⚠️ Important Security Notes:**
   - The Secret access key is shown ONLY ONCE - copy it immediately
   - If you lose it, you'll need to delete and create a new access key
   - Store keys securely (never commit to Git)
   
   **Option B: If AWS Access Keys are NOT Required (LWA Only):**
   
   - As of October 2023, SP-API may work with just LWA tokens
   - You can set placeholder values or skip these environment variables
   - Test your API calls first - if they work without AWS keys, you don't need them
   
   **Add to environment variables:**
   ```env
   # AWS Configuration
   AMAZON_AWS_IAM_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/SP-API-Role
   AMAZON_REGION=ap-south-1  # Mumbai region for India marketplace
   
   # AWS Access Keys (if required for your implementation)
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE  # Replace with your actual Access Key ID
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY  # Replace with your actual Secret Key
   ```
   
   **⚠️ Security Notes:**
   - Never commit AWS access keys to version control (Git)
   - Store them in `.env` file (add `.env` to `.gitignore`)
   - Rotate access keys regularly
   - Use IAM user with minimal permissions (principle of least privilege)

### Step 6: Get Refresh Token

**For sandbox, you need a refresh token to make API calls:**

**✅ You've Already Created Refresh Token in Solution Provider Portal!**

If you clicked "Create Token" in the Sandbox Testing page, you already have a refresh token. You can see it in the "Sandbox Refresh Token" table.

**Option A: Use Refresh Token from Solution Provider Portal (What You Did)**
- Go to Solution Provider Portal → Your App → Sandbox Testing
- Click "Create Token" button
- Copy the refresh token from the table
- **Store in environment:**
  ```env
  AMAZON_REFRESH_TOKEN_SANDBOX=your_refresh_token_here
  ```

**Option B: Use Real Seller Account (NIVAANA) - For Production Testing**
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

**Store refresh token and seller ID:**
```env
AMAZON_REFRESH_TOKEN_SANDBOX=your_refresh_token_here
AMAZON_SELLER_ID=ATESTSELLER123  # For sandbox testing, or get from NIVAANA for real account
```

**📋 About Seller ID:**
- **Seller ID** is the unique identifier for a seller account on Amazon
- For **sandbox testing**: You can use a test seller ID like `ATESTSELLER123`
- For **real testing with NIVAANA**: Ask NIVAANA for their Seller ID (found in their Seller Central account)
- Format: Usually starts with `A` followed by alphanumeric characters (e.g., `A1EXAMPLE123`)

### Step 7: Implement Authentication

**Token refresh function:**

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

### Step 8: Test Your First API Calls

**📋 About Seller ID:**

**What is Seller ID?**
- **Seller ID** is the unique identifier for a seller account on Amazon
- Format: Usually starts with `A` followed by alphanumeric characters (e.g., `A1EXAMPLE123`)
- It identifies which seller account you're making API calls for

**Where to Get Seller ID for Sandbox:**

**Option A: From Refresh Token Response (If Available)**
- When you exchange refresh token for access token, the response might include seller information
- Check the token response for seller ID

**Option B: Use Test Seller ID (For Sandbox Testing)**
- For sandbox, you can use a test seller ID
- Common test seller IDs: `ATESTSELLER123` or similar
- **Note:** Some sandbox APIs might work without a real seller ID

**Option C: Get from NIVAANA's Seller Account (For Real Testing)**
- If you're testing with NIVAANA's real seller account:
  - Ask NIVAANA for their **Seller ID** (also called Merchant ID)
  - It's usually found in their Seller Central account settings
  - Format: `A1XXXXXXXXXXXXX` (starts with A, followed by alphanumeric)

**Option D: Extract from API Response**
- Some SP-API endpoints return seller information
- You can call a simple API endpoint first to get seller details

**For Sandbox Testing (Recommended):**
- You can start with a placeholder: `ATESTSELLER123`
- Or use the seller ID from your refresh token if available
- Sandbox is forgiving and may accept test values

**Test inventory update:**

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
    // For sandbox, you can use a test seller ID or get it from NIVAANA
    const sellerId = process.env.AMAZON_SELLER_ID || 'ATESTSELLER123'; // Replace with actual seller ID
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

**More API Testing Examples:**

**1. Get Product List (GET):**

```javascript
// test-get-products.js
import { getAccessToken } from './amazon-auth.service.js';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import axios from 'axios';

async function testGetProducts() {
  try {
    const accessToken = await getAccessToken();
    const sellerId = process.env.AMAZON_SELLER_ID || 'ATESTSELLER123';
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
    
    const request = {
      method: 'GET',
      url: `https://sandbox.sellingpartnerapi-eu.amazon.com/listings/2021-08-01/items/${sellerId}?marketplaceIds=${marketplaceId}`,
      headers: {
        'x-amz-access-token': accessToken
      }
    };
    
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
    const response = await axios(signedRequest);
    console.log('✅ Products:', response.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testGetProducts();
```

**2. Get Orders (GET):**

```javascript
// test-get-orders.js
import { getAccessToken } from './amazon-auth.service.js';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import axios from 'axios';

async function testGetOrders() {
  try {
    const accessToken = await getAccessToken();
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
    
    // Get orders from last 7 days
    const createdAfter = new Date();
    createdAfter.setDate(createdAfter.getDate() - 7);
    const createdAfterISO = createdAfter.toISOString();
    
    const request = {
      method: 'GET',
      url: `https://sandbox.sellingpartnerapi-eu.amazon.com/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=${createdAfterISO}`,
      headers: {
        'x-amz-access-token': accessToken
      }
    };
    
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
    const response = await axios(signedRequest);
    console.log('✅ Orders:', response.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testGetOrders();
```

**3. Get Order Items (GET):**

```javascript
// test-get-order-items.js
async function testGetOrderItems(orderId) {
  try {
    const accessToken = await getAccessToken();
    
    const request = {
      method: 'GET',
      url: `https://sandbox.sellingpartnerapi-eu.amazon.com/orders/v0/orders/${orderId}/orderItems`,
      headers: {
        'x-amz-access-token': accessToken
      }
    };
    
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
    const response = await axios(signedRequest);
    console.log('✅ Order Items:', response.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Usage: testGetOrderItems('TEST-ORDER-ID');
```

**4. Update Inventory (PATCH) - Already shown above**

**5. Get Product by SKU (GET):**

```javascript
// test-get-product-by-sku.js
async function testGetProductBySku(sku) {
  try {
    const accessToken = await getAccessToken();
    const sellerId = process.env.AMAZON_SELLER_ID || 'ATESTSELLER123';
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
    
    const request = {
      method: 'GET',
      url: `https://sandbox.sellingpartnerapi-eu.amazon.com/listings/2021-08-01/items/${sellerId}/${sku}?marketplaceIds=${marketplaceId}`,
      headers: {
        'x-amz-access-token': accessToken
      }
    };
    
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
    const response = await axios(signedRequest);
    console.log('✅ Product:', response.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Usage: testGetProductBySku('TEST-SKU-001');
```

**6. Create Feed (POST) - For bulk inventory updates:**

```javascript
// test-create-feed.js
async function testCreateFeed() {
  try {
    const accessToken = await getAccessToken();
    const sellerId = process.env.AMAZON_SELLER_ID || 'ATESTSELLER123';
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
    
    // Feed document for inventory update
    const feedDocument = {
      contentType: 'text/xml; charset=UTF-8',
      // Your feed content here
    };
    
    const request = {
      method: 'POST',
      url: `https://sandbox.sellingpartnerapi-eu.amazon.com/feeds/2021-06-30/feeds`,
      headers: {
        'Content-Type': 'application/json',
        'x-amz-access-token': accessToken
      },
      body: JSON.stringify({
        feedType: 'POST_INVENTORY_AVAILABILITY_DATA',
        marketplaceIds: [marketplaceId],
        inputFeedDocumentId: 'YOUR_FEED_DOCUMENT_ID'
      })
    };
    
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
    const response = await axios(signedRequest);
    console.log('✅ Feed Created:', response.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}
```

**Common Testing Workflow:**

1. **Start with GET requests** (easier, no data modification)
   - Get product list
   - Get orders
   - Get product by SKU

2. **Then test PATCH requests** (update operations)
   - Update inventory
   - Update product attributes

3. **Finally test POST requests** (create operations)
   - Create feeds
   - Submit shipment confirmations

---

## ✅ Sandbox Testing Checklist

- [ ] Developer account created
- [ ] Sandbox app created
- [ ] LWA credentials obtained and saved
- [ ] AWS account created
- [ ] IAM role created and linked
- [ ] Refresh token obtained
- [ ] Authentication code implemented
- [ ] First API call successful
- [ ] All integration flows tested

---

## 🔧 Sandbox-Specific Notes

### API Endpoints
- **Base URL:** `https://sandbox.sellingpartnerapi-eu.amazon.com`
- All endpoints work identically to production
- Uses test/mock data

### Data
- **Inventory:** Test inventory data
- **Orders:** Test orders (use test order IDs)
- **Shipments:** Test shipment confirmations

### Limitations
- Data is not real - it's for testing only
- Some rate limits may be different
- Test data resets periodically

### Common Issues (Sandbox)

| Issue | Solution |
|-------|----------|
| **401 Unauthorized** | Check refresh token is valid |
| **403 Forbidden** | Shouldn't happen in sandbox (all APIs enabled) |
| **Signature errors** | Check AWS credentials and IAM role ARN |
| **404 Not Found** | Verify you're using sandbox base URL |

---

## 📚 Next Steps

After completing sandbox testing:

1. ✅ Validate all API calls work
2. ✅ Test all integration flows
3. ✅ Verify error handling
4. ✅ Test retry logic

**Ready for Production?** → [Go to Production Guide](./AMAZON_INTEGRATION_PRODUCTION.md)

---

## 📖 Additional Resources

- **Amazon SP-API Docs:** https://developer-docs.amazon.com/sp-api/
- **Sandbox Testing Guide:** https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox
- **API Reference:** https://developer-docs.amazon.com/sp-api/docs
- **IAM Role Setup (Official):** Check Amazon's SP-API documentation for the latest IAM role configuration requirements
- **Account ID Verification:** The account ID `589160054188` is Amazon's official SP-API account ID as documented in Amazon's developer guides

---

**Document Version:** 1.0  
**Last Updated:** November 7, 2025

