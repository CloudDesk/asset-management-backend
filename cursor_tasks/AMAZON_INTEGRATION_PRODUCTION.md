# Amazon-Nivaana Integration Guide
## Production Implementation (Live Integration)

**Version:** 1.0  
**Date:** November 7, 2025  
**Environment:** Production (Live)  
**Marketplace:** Amazon India (Marketplace ID: A21TJRUUN4KGV)

> **📌 Quick Links:** [Main Guide](./AMAZON_INTEGRATION_MAIN.md) | [Sandbox Guide](./AMAZON_INTEGRATION_SANDBOX.md)

---

## ⚠️ Prerequisites for Production

**Before starting, ensure you have:**
- ✅ Completed sandbox testing (recommended)
- ✅ Identity verification documents ready
- ✅ Client (NIVAANA) seller account access
- ✅ AWS account set up

**⚠️ IMPORTANT: Account Ownership Decision**

**You need to decide who owns the accounts:**

| Account Type | Developer Email (Your Email) | Client Email (NIVAANA's Email) |
|--------------|------------------------------|--------------------------------|
| **Solution Provider Portal** | ✅ Can use your email | ✅ **Recommended:** Use NIVAANA's official business email |
| **AWS Account** | ✅ Can use your email | ✅ **Recommended:** Use NIVAANA's official business email |

**Recommendation for Production:**
- ✅ **Use NIVAANA's official business email** for both accounts
- ✅ Client owns the integration long-term
- ✅ Better for production and maintenance
- ✅ Client can manage independently

**If you've already created with your email:**
- ✅ You can continue (faster to start)
- ⚠️ Consider transferring to NIVAANA's email for production
- ⚠️ Document all credentials for client handover

---

## 🔐 Account Ownership - Important Clarification

### **Who Should Create the Accounts?**

**Option A: Developer Owns Accounts (For Development/Testing Only)**
- **Solution Provider Portal:** Created with **developer's email** (you)
- **AWS Account:** Created with **developer's email** (you)
- **Why:** Developer builds and maintains the integration
- **Client's Role:** NIVAANA only needs to authorize your app via OAuth
- **⚠️ Billing Responsibility:** **YOU will be responsible for AWS bills**
- **⚠️ Not Recommended for Production**

**Option B: Client Owns Accounts (✅ STRONGLY RECOMMENDED for Production)**
- **Solution Provider Portal:** Created with **NIVAANA's official business email**
- **AWS Account:** Created with **NIVAANA's official business email**
- **Why:** Client owns and controls the integration long-term
- **Developer's Role:** You help set it up, but client owns credentials
- **✅ Billing Responsibility:** **NIVAANA pays for their own AWS usage**
- **✅ Recommended for Production**

### **💰 Billing Considerations:**

**AWS Account Billing:**
- **Whoever owns the AWS account is responsible for billing**
- AWS charges for:
  - API Gateway requests (minimal for SP-API - usually free tier covers it)
  - Data transfer (usually minimal for SP-API)
  - Other AWS services if used
- **For SP-API:** AWS usage is typically minimal (just SigV4 signing)
- **But:** Account owner is responsible for any charges

**Solution Provider Portal:**
- ✅ **FREE** - No billing
- ✅ No charges for using SP-API
- ✅ No charges for creating apps

**Amazon SP-API:**
- ✅ **FREE** - No charges for API calls
- ✅ No per-request fees
- ✅ No subscription fees

### **Recommendation:**

**For Development/Testing:**
- ✅ Use **your email** (developer) for both accounts
- ✅ Faster setup, easier for development
- ⚠️ **You pay AWS bills** (usually minimal, but still your responsibility)

**For Production/Long-term:**
- ✅ **STRONGLY RECOMMENDED:** Use **NIVAANA's official business email** for both accounts
- ✅ Client owns the integration
- ✅ **Client pays AWS bills** (not you!)
- ✅ Better for long-term maintenance
- ✅ Client can manage credentials independently
- ✅ No billing responsibility for you

### **What NIVAANA Needs:**
- ✅ **Amazon Seller Account** (they already have this)
- ✅ **Authorization** to connect your app to their seller account (via OAuth)
- ✅ **Seller ID** (to share with you for API calls)

### **What You Need:**
- ✅ **Solution Provider Portal account** (developer or client email)
- ✅ **AWS account** (developer or client email)
- ✅ **IAM role and access keys** (from the AWS account)
- ✅ **Production app credentials** (from Solution Provider Portal)
- ✅ **Refresh token** (from NIVAANA's OAuth authorization)

---

## 📋 Account Setup Options

### **Scenario 1: Developer Owns Accounts (Current Setup)**

**If you've already created accounts with your email:**

⚠️ **You can proceed, but consider the billing implications!**

**Pros:**
- ✅ Already set up
- ✅ Faster to get started
- ✅ You control the credentials

**Cons:**
- ⚠️ **YOU will be responsible for AWS billing** (even if minimal)
- ⚠️ Client doesn't own the integration
- ⚠️ You need to share credentials with client for long-term
- ⚠️ If you leave, client needs to recreate accounts
- ⚠️ Any AWS charges come to your payment method

**Billing Impact:**
- AWS charges (if any) will be billed to **your payment method**
- Even if minimal, you're responsible for the account
- Need to monitor AWS usage
- Need to handle billing disputes if any

**Action:** 
- ✅ For **testing/development:** Continue with your accounts
- ⚠️ For **production:** **STRONGLY RECOMMENDED** to recreate with NIVAANA's email
- ⚠️ Document all credentials for client handover

---

### **Scenario 2: Client Owns Accounts (✅ STRONGLY RECOMMENDED for Production)**

**If NIVAANA should own the accounts:**

**Steps:**
1. **Create Solution Provider Portal with NIVAANA's email:**
   - Use NIVAANA's official business email
   - Register as company (use NIVAANA's business info)
   - Complete identity verification with NIVAANA's documents

2. **Create AWS Account with NIVAANA's email:**
   - Use NIVAANA's official business email
   - Complete AWS verification
   - **NIVAANA adds their payment method** (they pay bills)
   - Create IAM role and user
   - Get access keys

3. **You help with setup:**
   - Guide them through the process
   - Help configure the integration
   - Document everything for them

**Pros:**
- ✅ **Client pays AWS bills** (not you!)
- ✅ Client owns the integration
- ✅ Client can manage independently
- ✅ Better for long-term maintenance
- ✅ No dependency on developer
- ✅ No billing responsibility for you
- ✅ Client controls their own costs

**Cons:**
- ⚠️ Takes longer (client needs to create accounts)
- ⚠️ Client needs to be involved in setup
- ⚠️ Client needs to provide payment method for AWS

**Action:** **STRONGLY RECOMMENDED** - Recreate accounts with NIVAANA's email for production.

---

## ✅ Recommended Approach

**For Your Situation:**

Since you've already created accounts with your email:

1. **Option A: Continue with Your Accounts (Development/Testing Only)**
   - ✅ Use your existing accounts
   - ✅ Document all credentials for NIVAANA
   - ⚠️ **YOU pay AWS bills** (even if minimal)
   - ⚠️ **Not recommended for production**

2. **Option B: Recreate with NIVAANA's Email (✅ RECOMMENDED for Production)**
   - ✅ Create new accounts with NIVAANA's official email
   - ✅ Client owns everything from the start
   - ✅ **Client pays AWS bills** (not you!)
   - ✅ Better for production/long-term
   - ✅ No billing responsibility for you

**Decision Factors:**
- **Billing:** If you don't want to pay AWS bills → Use NIVAANA's email ✅
- **Timeline:** If you need to go live quickly → Use your accounts (but transfer later)
- **Ownership:** If client should own it → Use NIVAANA's email ✅
- **Maintenance:** If client will maintain it → Use NIVAANA's email ✅

**💡 Best Practice:**
- **For Testing:** Use your accounts (you control, faster setup)
- **For Production:** **Use NIVAANA's accounts** (they own, they pay, they control)

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

## 🎯 What is Production?

**Production** is Amazon's live environment where you:
- ✅ Connect to real seller accounts
- ✅ Sync real inventory from NIVAANA
- ✅ Process real customer orders
- ✅ Update real shipment tracking
- ✅ Handle live production data

**Requires:** Identity verification and role approval.

---

## ✅ Prerequisites (Production)

| Requirement | Production Status |
|------------|-------------------|
| **Amazon Seller Account** | ✅ Required (NIVAANA's account) |
| **SP-API Developer Registration** | ✅ Required |
| **Identity Verification** | ✅ **REQUIRED** |
| **Business Documents** | ✅ **REQUIRED** |
| **API Role Access** | ✅ Need to request/approve |
| **AWS Account** | ✅ Required |
| **LWA Authorization** | ✅ Required (real seller account) |

---

## 🚀 Step-by-Step Setup (Production)

**⚠️ IMPORTANT: Use NIVAANA's Official Business Email for All Accounts**

For production, all accounts should be created with **NIVAANA's official business email** to ensure:
- ✅ Client owns the integration
- ✅ Client pays AWS bills
- ✅ Client controls credentials
- ✅ No billing responsibility for developer

---

### Phase 1: Amazon Solution Provider Portal Setup

#### Step 1: Create Solution Provider Portal Account (NIVAANA's Email)

1. **Go to Amazon Solution Provider Portal**
   - Visit: https://developer.amazonservices.com/
   - Click "Register" or "Sign Up"

2. **Register with NIVAANA's Information:**
   - **Email:** Use NIVAANA's official business email (e.g., `tech@nivaana.com` or `admin@nivaana.com`)
   - **Account Type:** Select "On behalf of Company"
   - **Company Name:** NIVAANA's business name
   - **Business Information:** Use NIVAANA's business details
   - **Contact Information:** NIVAANA's business contact details

3. **Complete Registration:**
   - Verify email (NIVAANA's email)
   - Complete profile setup
   - Accept terms and conditions

**✅ Deliverable:** Solution Provider Portal account created with NIVAANA's email

---

#### Step 2: Complete Identity Verification (Required for Production)

**This is REQUIRED before creating production apps.**

1. **Go to "Steps to create production apps" page**
   - In Solution Provider Portal, navigate to production setup
   - Click "Verify your Identity"

2. **Choose Document Option:**
   
   **Recommended: Use NIVAANA's Business Documents**
   - Upload NIVAANA's business registration documents
   - Business registration certificate
   - GST certificate (if applicable)
   - Business PAN card
   - Authorized signatory ID (Aadhaar/PAN/Passport)

3. **Upload Required Documents:**
   - Business registration certificate
   - GST certificate (if applicable)
   - Authorized signatory identity document
   - Additional documents as requested

4. **Submit and Wait:**
   - Approval takes **20 minutes to 5-10 business days**
   - You'll receive email notification (to NIVAANA's email) when approved

**✅ Deliverable:** Identity verification approved

---

#### Step 3: Create Production App

**After Identity Verification is Approved:**

1. **"Set up Solution Provider Account Profile and Permissions" becomes active**
   - The greyed-out button becomes clickable
   - Click "Get started after your identity verified"

2. **Create Production App:**
   - Click "+ Add new app client"
   - **App Name:** "Nivaana Production" (or your choice)
   - **API Type:** SP API
   - **App Status:** Will be set to "Production" (not Sandbox)

3. **Request API Roles:**
   - Configure required API roles:
     - `sellingpartnerapi::orders::read/write`
     - `sellingpartnerapi::feeds::write`
     - `sellingpartnerapi::notifications::read`
     - `sellingpartnerapi::listings::read/write`
     - `sellingpartnerapi::shipping::read/write`
   - Define use cases: Describe how NIVAANA will use the API
   - Configure security controls

4. **Wait for Role Approval:**
   - Amazon reviews your role requests
   - Approval usually quick after identity verification
   - You'll receive email notification when approved

**✅ Deliverable:** Production app created with API roles approved

---

#### Step 4: Get Production LWA Credentials

1. **View Production Credentials:**
   - In Developer Central, find your production app
   - Click "View credentials" (NOT "View sandbox credentials")
   - **Copy and save:**
     - **Production Client ID** (LWA) - Different from sandbox!
     - **Production Client Secret** - Different from sandbox!
     - **Rotation Deadline** - Note the date

2. **Store in environment variables:**
   ```env
   # Production Credentials (NIVAANA's Account)
   AMAZON_CLIENT_ID=amzn1.application-oa2-client.prod_xxxxx
   AMAZON_CLIENT_SECRET=production_secret_here
   AMAZON_ENVIRONMENT=PRODUCTION
   AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV
   AMAZON_SP_API_BASE_URL=https://sellingpartnerapi-eu.amazon.com
   ```

**✅ Deliverable:** Production LWA Client ID and Client Secret

---

### Phase 2: AWS Account & IAM Setup (NIVAANA's Email)

#### Step 5: Create AWS Account (NIVAANA's Email)

1. **Go to AWS:**
   - Visit: https://aws.amazon.com/
   - Click "Create an AWS Account"

2. **Sign Up with NIVAANA's Information:**
   - **Email:** Use **NIVAANA's official business email** (same as Solution Provider Portal)
   - **Account Name:** NIVAANA's business name
   - **Account Type:** Select "Business - for your work, school, or organization"
   - **Business Information:** Use NIVAANA's business details

3. **Complete AWS Verification:**
   - Verify email (NIVAANA's email)
   - Verify phone number (NIVAANA's business phone)
   - **Add Payment Method:** NIVAANA's payment method (credit card)
     - ⚠️ **Important:** NIVAANA adds their payment method - they pay bills!
   - Complete identity verification

4. **Choose Support Plan:**
   - Basic (Free) plan is sufficient for SP-API
   - No need for paid support plans

**✅ Deliverable:** AWS account created with NIVAANA's email and payment method

---

#### Step 6: Create IAM Role (Same Process as Sandbox)

1. **Go to IAM Console:**
   - AWS Console → IAM → Roles → Create Role

2. **Create Role:**
   - Trusted entity: "AWS Account" → "Another AWS account"
   - Enter Amazon's account ID: `589160054188`
   - Click "Next"

3. **Skip Policies:**
   - **Skip attaching any policies** (we'll add inline policy after)

4. **Role Details:**
   - Role name: `SP-API-Role`
   - Description: `IAM role for Amazon SP-API integration (NIVAANA)`
   - Click "Create role"

5. **Copy Role ARN:**
   - After creation, copy the Role ARN
   - Format: `arn:aws:iam::NIVAANA_ACCOUNT_ID:role/SP-API-Role`

**✅ Deliverable:** IAM Role ARN

---

#### Step 7: Add Inline Policy to IAM Role

1. **Go to Role:**
   - Click on the role name `SP-API-Role`
   - Click on the "Permissions" tab

2. **Create Inline Policy:**
   - Click "Add permissions" → "Create inline policy"
   - Click the "JSON" tab
   - Paste the following policy:
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
   - Click "Next"
   - Policy name: `SPAPIAccessPolicy`
   - Click "Create policy"

**✅ Deliverable:** Inline policy attached to IAM role

---

#### Step 8: Link IAM Role (If Required)

1. **Go to Solution Provider Portal:**
   - Developer Central → Your Production App → Edit

2. **Link IAM Role:**
   - Find "AWS IAM Role ARN" field
   - Paste the IAM Role ARN: `arn:aws:iam::NIVAANA_ACCOUNT_ID:role/SP-API-Role`
   - Save

**Note:** For production, this step may be required. If the field is not visible, it may be optional.

**✅ Deliverable:** IAM Role linked to production app

---

### Phase 3: Get Refresh Token (Production - OAuth Flow)

#### Step 9: Get Production Refresh Token via OAuth

**⚠️ Production requires REAL seller account authorization via OAuth!**

1. **Generate OAuth Authorization URL:**
   ```
   https://sellercentral.amazon.in/apps/authorize/consent?
     application_id={YOUR_PRODUCTION_APP_ID}&
     state={UNIQUE_STATE}&
     version=beta
   ```
   - Replace `{YOUR_PRODUCTION_APP_ID}` with your production app ID
   - Replace `{UNIQUE_STATE}` with a unique state value (for security)

2. **Share with NIVAANA:**
   - Send the authorization URL to NIVAANA
   - NIVAANA needs to:
     - Log into their **Amazon Seller Central account**
     - Review the permissions your app is requesting
     - Click "Authorize" or "Confirm"

3. **Get Authorization Code:**
   - After NIVAANA authorizes, Amazon redirects to your callback URL
   - The redirect includes an `authorization_code` in the URL

4. **Exchange Authorization Code for Refresh Token:**
   ```javascript
   POST https://api.amazon.com/auth/o2/token
   Body: {
     grant_type: "authorization_code",
     code: "{AUTHORIZATION_CODE}",
     client_id: "{YOUR_PRODUCTION_CLIENT_ID}",
     client_secret: "{YOUR_PRODUCTION_CLIENT_SECRET}",
     redirect_uri: "{YOUR_CALLBACK_URL}"
   }
   ```

5. **Store Refresh Token:**
   - Response contains `refresh_token`
   - **Store securely** - this is specific to NIVAANA's seller account
   ```env
   AMAZON_REFRESH_TOKEN=production_refresh_token_from_oauth_here
   ```

**✅ Deliverable:** Production refresh token (from NIVAANA's OAuth authorization)

---

### Phase 4: AWS Access Keys (NIVAANA's Account)

#### Step 10: Create IAM User

1. **Go to IAM Console:**
   - AWS Console → IAM → Users → Add users

2. **Create User:**
   - **Step 1: Specify user details**
     - Username: `sp-api-user` (or any name)
     - **Uncheck** "Provide user access to the AWS Management Console"
     - Click "Next"

   - **Step 2: Set permissions** (Optional)
     - You can skip attaching policies
     - Click "Next"

   - **Step 3: Review and create**
     - Review the details
     - Click "Create user"

**✅ Deliverable:** IAM user created

---

#### Step 11: Generate Access Keys

1. **Go to User:**
   - IAM → Users → Select `sp-api-user`
   - Click the "Security credentials" tab

2. **Create Access Key:**
   - Scroll to "Access keys" section
   - Click "Create access key"
   - **Select use case:** "Application running outside AWS"
   - **Description:** "Amazon SP-API integration for Nivaana backend"
   - Click "Next" → "Create access key"

3. **Copy Access Keys:**
   - **⚠️ CRITICAL:** Copy BOTH immediately - secret key shown only once!
     - **Access Key ID** (starts with `AKIA...`)
     - **Secret Access Key** (long string)
   - Download as CSV or copy to secure location
   - Click "Done"

4. **Store in environment variables:**
   ```env
   # AWS Configuration (NIVAANA's Account)
   AMAZON_AWS_IAM_ROLE_ARN=arn:aws:iam::NIVAANA_ACCOUNT_ID:role/SP-API-Role
   AMAZON_REGION=eu-west-1
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

**✅ Deliverable:** AWS Access Key ID and Secret Access Key

---

## 📋 Complete Production Setup Checklist

### **Phase 1: Amazon Setup (NIVAANA's Email)**
- [ ] Solution Provider Portal account created with NIVAANA's email
- [ ] Identity verification completed with NIVAANA's documents
- [ ] Identity verification approved
- [ ] Production app created
- [ ] API roles requested and approved
- [ ] Production Client ID obtained
- [ ] Production Client Secret obtained

### **Phase 2: AWS Setup (NIVAANA's Email)**
- [ ] AWS account created with NIVAANA's email
- [ ] NIVAANA's payment method added (they pay bills)
- [ ] IAM Role created (`SP-API-Role`)
- [ ] Inline policy attached (`execute-api:Invoke`)
- [ ] IAM Role ARN copied
- [ ] IAM Role linked to production app (if required)

### **Phase 3: Get Refresh Token**
- [ ] OAuth authorization URL generated
- [ ] URL shared with NIVAANA
- [ ] NIVAANA authorized the app in Seller Central
- [ ] Authorization code received
- [ ] Refresh token obtained via OAuth exchange
- [ ] Refresh token stored securely

### **Phase 4: AWS Access Keys**
- [ ] IAM User created (`sp-api-user`)
- [ ] Access Key ID generated
- [ ] Secret Access Key generated and saved
- [ ] All credentials stored in environment variables

---

## 🔄 Complete Production Flow Summary

```
Phase 1: Amazon Setup (NIVAANA's Email)
├── Create Solution Provider Portal account (NIVAANA's email)
├── Complete Identity Verification (NIVAANA's documents)
├── Create Production App
├── Request API Roles
└── Get Production LWA Credentials (Client ID, Secret)

Phase 2: AWS Setup (NIVAANA's Email)
├── Create AWS Account (NIVAANA's email + payment method)
├── Create IAM Role (with Amazon's account ID: 589160054188)
├── Add Inline Policy (execute-api:Invoke)
├── Get IAM Role ARN
└── Link IAM Role to production app

Phase 3: Get Refresh Token (Production - OAuth)
└── OAuth flow with NIVAANA's real seller account

Phase 4: AWS Access Keys (NIVAANA's Account)
├── Create IAM User
└── Generate Access Keys (Access Key ID, Secret Access Key)
```

---

## 🔧 Production-Specific Configuration

**Switch from sandbox to production:**

```javascript
// Environment configuration (Using global env keys)
const isProduction = process.env.AMAZON_ENVIRONMENT === 'PRODUCTION';

const amazonConfig = {
  baseURL: process.env.AMAZON_SP_API_BASE_URL, // Set in .env based on environment
  clientId: process.env.AMAZON_CLIENT_ID, // Same key, different value
  clientSecret: process.env.AMAZON_CLIENT_SECRET, // Same key, different value
  refreshToken: process.env.AMAZON_REFRESH_TOKEN, // Same key, different value
  marketplaceId: process.env.AMAZON_MARKETPLACE_ID, // Fixed: A21TJRUUN4KGV
  region: process.env.AMAZON_REGION,
  iamRoleArn: process.env.AMAZON_AWS_IAM_ROLE_ARN
};
```

**Example .env files:**

**`.env.sandbox`:**
```env
AMAZON_CLIENT_ID=amzn1.application-oa2-client.sandbox_xxxxx
AMAZON_CLIENT_SECRET=sandbox_secret_here
AMAZON_REFRESH_TOKEN=sandbox_refresh_token_here
AMAZON_ENVIRONMENT=SANDBOX
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV
AMAZON_SP_API_BASE_URL=https://sandbox.sellingpartnerapi-eu.amazon.com
```

**`.env.production`:**
```env
AMAZON_CLIENT_ID=amzn1.application-oa2-client.prod_xxxxx
AMAZON_CLIENT_SECRET=production_secret_here
AMAZON_REFRESH_TOKEN=production_refresh_token_here
AMAZON_ENVIRONMENT=PRODUCTION
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV
AMAZON_SP_API_BASE_URL=https://sellingpartnerapi-eu.amazon.com
```

### Step 6: Test Production Connection

**Test with real data (carefully):**

1. **Test Inventory Sync:**
   - Update a single SKU with test quantity
   - Verify it appears in NIVAANA's Amazon Seller Central
   - **Important:** Use a test SKU first!

2. **Test Order Fetch:**
   - Fetch recent orders from Amazon
   - Verify order data is correct
   - Check customer information

3. **Test Shipment Confirmation:**
   - Confirm a test shipment
   - Verify tracking updates correctly
   - Check customer receives notification

### Step 7: Go Live Checklist

**Before going fully live:**

- [ ] Identity verification approved
- [ ] Production credentials obtained
- [ ] API roles approved
- [ ] Connected to real seller account
- [ ] Production refresh token obtained
- [ ] Code updated for production
- [ ] Tested with real data (carefully)
- [ ] Error handling implemented
- [ ] Retry logic implemented
- [ ] Monitoring set up
- [ ] Alerts configured
- [ ] Reconciliation job scheduled

---

## 🔧 Production-Specific Notes

### API Endpoints
- **Base URL:** `https://sellingpartnerapi-eu.amazon.com`
- All endpoints work with real data
- Rate limits apply (check Amazon docs)

### Data
- **Inventory:** Real NIVAANA inventory
- **Orders:** Real customer orders
- **Shipments:** Real shipment confirmations

### Important Considerations

1. **Rate Limits:**
   - Production has stricter rate limits
   - Implement proper backoff and throttling
   - Monitor API usage

2. **Error Handling:**
   - Production errors affect real operations
   - Implement comprehensive error handling
   - Set up alerts for critical failures

3. **Data Accuracy:**
   - Real inventory must be accurate
   - Implement reconciliation jobs
   - Monitor for discrepancies

4. **Security:**
   - Store credentials securely (encrypted)
   - Rotate secrets before deadline
   - Monitor for unauthorized access

---

## ⚠️ Production Best Practices

### 1. Maintain Both Sandbox and Production

**Best Practice:** Keep both environments active

- **Sandbox:** Use for testing new features, debugging
- **Production:** Use for live operations

### 2. Credential Management

**Using Global Environment Keys (Recommended):**

```javascript
// Single configuration using global env keys
const config = {
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  baseURL: process.env.AMAZON_SP_API_BASE_URL,
  marketplaceId: process.env.AMAZON_MARKETPLACE_ID, // Fixed: A21TJRUUN4KGV
  environment: process.env.AMAZON_ENVIRONMENT
};
```

**Switch environments by changing .env file values, not keys!**

### 3. Monitoring

- Monitor API call success rates
- Track inventory sync accuracy
- Monitor order processing times
- Set up alerts for failures

### 4. Reconciliation

- Run daily reconciliation jobs
- Compare Amazon vs Nivaana inventory
- Identify and resolve discrepancies
- Generate reports

---

## 🚨 Production Troubleshooting

| Issue | Solution |
|-------|----------|
| **401 Unauthorized** | Refresh token expired - refresh it |
| **403 Forbidden** | Check API roles are approved |
| **429 Rate Limit** | Implement exponential backoff |
| **Inventory Mismatch** | Run reconciliation job |
| **Order Not Syncing** | Check Notifications API setup |
| **Shipment Not Updating** | Verify carrier codes are correct |

---

## 📚 Additional Resources

- **Amazon SP-API Docs:** https://developer-docs.amazon.com/sp-api/
- **Production Best Practices:** https://developer-docs.amazon.com/sp-api/docs
- **Rate Limits:** https://developer-docs.amazon.com/sp-api/docs/rate-limits
- **Seller Central (India):** https://sellercentral.amazon.in

---

## 🔄 Migration from Sandbox to Production

**When ready to migrate:**

1. ✅ Complete all sandbox testing
2. ✅ Complete identity verification
3. ✅ Get production credentials
4. ✅ Connect to real seller account
5. ✅ Update code to use production config
6. ✅ Test with real data (carefully)
7. ✅ Monitor closely for first 24-48 hours
8. ✅ Keep sandbox active for testing

---

**Document Version:** 1.0  
**Last Updated:** November 7, 2025

