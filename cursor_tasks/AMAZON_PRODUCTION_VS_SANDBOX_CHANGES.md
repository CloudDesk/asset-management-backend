# Amazon SP-API: Production vs Sandbox - Key Changes

## 📊 Quick Comparison

| Aspect | Sandbox | Production |
|--------|---------|------------|
| **Identity Verification** | ❌ NOT Required | ✅ **REQUIRED** |
| **App Type** | Sandbox App | Production App |
| **Credentials** | Sandbox Client ID/Secret | Production Client ID/Secret |
| **API Access** | ✅ Auto-enabled (all APIs) | ⏳ Need to request/approve |
| **Refresh Token** | Test token or real seller | Real seller account only |
| **Data** | Test/mock data | Real NIVAANA data |
| **Setup Time** | ⚡ Immediate | ⏳ 20 mins - 10 days |

---

## 🔄 Production Setup Flow (Changes from Sandbox)

### **Phase 1: Amazon Setup - MAJOR CHANGES**

#### **Step 1: Identity Verification (NEW - Required for Production)**

**⚠️ This is the FIRST step and MUST be completed before creating production apps!**

1. Go to Solution Provider Portal → "Steps to create production apps"
2. Click **"Verify your Identity"**
3. **Choose Document Option:**

   **Option A: Individual Developer (You)**
   - Upload your personal identity document
   - Acceptable: Aadhaar, PAN, Passport, Driver's License
   - Works if you're developing as an individual

   **Option B: Client's Business Documents (NIVAANA)**
   - Ask NIVAANA to provide their business registration documents
   - Use their business info for verification
   - Common when developer builds for client

   **Option C: Your Own Business**
   - If you have a registered business, use your business documents
   - Business registration certificate
   - GST certificate (if applicable)

4. **Upload Required Documents:**
   - Business registration info (if using business option)
   - Identity document (personal ID)
   - Additional documents as requested

5. **Submit and Wait:**
   - Approval takes **20 minutes to 5-10 business days**
   - You'll receive email notification when approved

**✅ Difference from Sandbox:** Sandbox doesn't require this step!

---

#### **Step 2: Create Production App (Different from Sandbox)**

**After Identity Verification is Approved:**

1. **"Set up Solution Provider Account Profile and Permissions" becomes active**
   - The greyed-out button becomes clickable
   - Click "Get started after your identity verified"

2. **Configure Production Settings:**
   - **Set up roles:** (You need to explicitly request these)
     - `sellingpartnerapi::orders::read/write`
     - `sellingpartnerapi::feeds::write`
     - `sellingpartnerapi::notifications::read`
     - `sellingpartnerapi::listings::read/write`
     - `sellingpartnerapi::shipping::read/write`
   - **Define use cases:** Describe how you'll use the API
   - **Configure security controls:** Set up security settings

3. **App Status Changes:**
   - Your app status changes from "Sandbox" to "Production"
   - You'll see **production credentials** (different from sandbox)

**✅ Difference from Sandbox:** 
- Sandbox: App automatically created, all APIs enabled
- Production: Must request API roles, approval required

---

#### **Step 3: Get Production LWA Credentials**

1. **Production Credentials:**
   - Production Client ID (different from sandbox)
   - Production Client Secret (different from sandbox)
   - Production AWS IAM Role ARN (if required)

2. **Store in environment variables:**
   ```env
   # Production Credentials (DIFFERENT from sandbox)
   AMAZON_CLIENT_ID=amzn1.application-oa2-client.prod_xxxxx
   AMAZON_CLIENT_SECRET=production_secret_here
   AMAZON_ENVIRONMENT=PRODUCTION
   AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV  # Same for India
   AMAZON_SP_API_BASE_URL=https://sellingpartnerapi-eu.amazon.com  # Different URL
   ```

**✅ Difference from Sandbox:**
- Sandbox: `https://sandbox.sellingpartnerapi-eu.amazon.com`
- Production: `https://sellingpartnerapi-eu.amazon.com` (no "sandbox" in URL)

---

### **Phase 2: AWS Setup - SAME AS SANDBOX**

**✅ No Changes Required!**

The AWS setup is **identical** for both sandbox and production:

1. ✅ Create AWS Account (same email)
2. ✅ Create IAM Role (with Amazon's account ID: `589160054188`)
3. ✅ Add Inline Policy (`execute-api:Invoke`)
4. ✅ Get IAM Role ARN

**Note:** You can use the **same AWS account and IAM role** for both sandbox and production!

---

### **Phase 3: Get Refresh Token - MAJOR CHANGES**

**⚠️ Production requires REAL seller account authorization!**

#### **For Production:**

1. **Generate OAuth Authorization URL:**
   ```
   https://sellercentral.amazon.in/apps/authorize/consent?
     application_id={YOUR_PRODUCTION_APP_ID}&
     state={UNIQUE_STATE}&
     version=beta
   ```

2. **Share with NIVAANA:**
   - Send the authorization URL to NIVAANA
   - They need to log into their **Amazon Seller Central account**
   - They review and approve the permissions
   - They click "Authorize" or "Confirm"

3. **Get Refresh Token:**
   - After NIVAANA authorizes, Amazon redirects to your callback URL
   - Exchange authorization code for refresh token:
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
   - Response contains `refresh_token` - **Store this securely!**
   - This refresh token is specific to NIVAANA's real seller account

4. **Store refresh token:**
   ```env
   AMAZON_REFRESH_TOKEN=your_production_refresh_token_here
   ```

**✅ Difference from Sandbox:**
- Sandbox: Can use test token from Solution Provider Portal
- Production: **MUST** get real token from NIVAANA's seller account via OAuth

---

### **Phase 4: AWS Access Keys - SAME AS SANDBOX**

**✅ No Changes Required!**

The AWS access keys setup is **identical** for both sandbox and production:

1. ✅ Create IAM User
2. ✅ Generate Access Keys
3. ✅ Use case: "Application running outside AWS"
4. ✅ Description: "Amazon SP-API integration for Nivaana backend"

**Note:** You can use the **same AWS access keys** for both sandbox and production!

---

## 📋 Complete Production Setup Checklist

### **Phase 1: Amazon Setup (Production-Specific)**
- [ ] **Identity Verification** (NEW - Required)
  - [ ] Choose verification option (Individual/Business/NIVAANA)
  - [ ] Upload required documents
  - [ ] Wait for approval (20 mins - 10 days)
  - [ ] Receive approval email

- [ ] **Create Production App** (Different from Sandbox)
  - [ ] Click "Set up Solution Provider Account Profile and Permissions"
  - [ ] Request API roles:
    - [ ] `sellingpartnerapi::orders::read/write`
    - [ ] `sellingpartnerapi::feeds::write`
    - [ ] `sellingpartnerapi::notifications::read`
    - [ ] `sellingpartnerapi::listings::read/write`
    - [ ] `sellingpartnerapi::shipping::read/write`
  - [ ] Define use cases
  - [ ] Configure security controls
  - [ ] Wait for role approval

- [ ] **Get Production Credentials**
  - [ ] Production Client ID
  - [ ] Production Client Secret
  - [ ] Note rotation deadline

### **Phase 2: AWS Setup (Same as Sandbox)**
- [ ] AWS Account created (already done ✅)
- [ ] IAM Role created (already done ✅)
- [ ] Inline policy attached (already done ✅)
- [ ] IAM Role ARN copied (already done ✅)

### **Phase 3: Get Refresh Token (Production-Specific)**
- [ ] Generate OAuth authorization URL
- [ ] Share URL with NIVAANA
- [ ] NIVAANA authorizes the app
- [ ] Exchange authorization code for refresh token
- [ ] Store refresh token securely

### **Phase 4: AWS Access Keys (Same as Sandbox)**
- [ ] IAM User created (already done ✅)
- [ ] Access Keys generated (already done ✅)

---

## 🔄 Updated Production Flow

```
Phase 1: Amazon Setup (Production)
├── ✅ Identity Verification (NEW - Required)
│   ├── Upload documents
│   └── Wait for approval
├── ✅ Create Production App (Different)
│   ├── Request API roles
│   └── Wait for approval
└── ✅ Get Production LWA Credentials (Different values)

Phase 2: AWS Setup
├── ✅ Create AWS Account (Already done)
├── ✅ Create IAM Role (Already done)
├── ✅ Add Inline Policy (Already done)
└── ✅ Get IAM Role ARN (Already done)

Phase 3: Get Refresh Token (Production-Specific)
└── ✅ OAuth flow with NIVAANA's real seller account

Phase 4: AWS Access Keys
├── ✅ Create IAM User (Already done)
└── ✅ Generate Access Keys (Already done)
```

---

## 🔑 Key Differences Summary

### **What's Different in Production:**

1. **Identity Verification** ⚠️
   - **NEW:** Must complete identity verification first
   - **Time:** 20 minutes to 10 business days
   - **Sandbox:** Not required

2. **App Creation** ⚠️
   - **Production:** Must request API roles explicitly
   - **Production:** Need to define use cases
   - **Sandbox:** All APIs auto-enabled

3. **Credentials** ⚠️
   - **Production:** Different Client ID/Secret
   - **Production:** Different base URL (no "sandbox")
   - **Sandbox:** Separate credentials

4. **Refresh Token** ⚠️
   - **Production:** Must get from real seller account (OAuth)
   - **Production:** Requires NIVAANA's authorization
   - **Sandbox:** Can use test token

### **What's the Same:**

1. **AWS Setup** ✅
   - Same AWS account
   - Same IAM role
   - Same inline policy
   - Same access keys

2. **Marketplace ID** ✅
   - Same for both: `A21TJRUUN4KGV` (India)

3. **Backend Code** ✅
   - Same service, controller, routes
   - Just change environment variables

---

## 📝 Environment Variables Comparison

### **Sandbox (.env.sandbox):**
```env
AMAZON_CLIENT_ID=amzn1.application-oa2-client.sandbox_xxxxx
AMAZON_CLIENT_SECRET=sandbox_secret_here
AMAZON_REFRESH_TOKEN=sandbox_refresh_token_here
AMAZON_ENVIRONMENT=SANDBOX
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV
AMAZON_SP_API_BASE_URL=https://sandbox.sellingpartnerapi-eu.amazon.com
AMAZON_AWS_IAM_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/SP-API-Role
AMAZON_REGION=eu-west-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

### **Production (.env.production):**
```env
AMAZON_CLIENT_ID=amzn1.application-oa2-client.prod_xxxxx  # DIFFERENT
AMAZON_CLIENT_SECRET=production_secret_here  # DIFFERENT
AMAZON_REFRESH_TOKEN=production_refresh_token_here  # DIFFERENT (from NIVAANA)
AMAZON_ENVIRONMENT=PRODUCTION  # DIFFERENT
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV  # SAME
AMAZON_SP_API_BASE_URL=https://sellingpartnerapi-eu.amazon.com  # DIFFERENT (no sandbox)
AMAZON_AWS_IAM_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/SP-API-Role  # SAME
AMAZON_REGION=eu-west-1  # SAME
AWS_ACCESS_KEY_ID=your_aws_access_key  # SAME
AWS_SECRET_ACCESS_KEY=your_aws_secret_key  # SAME
```

---

## 🚀 Migration Steps (Sandbox → Production)

### **Step 1: Complete Identity Verification**
- Upload documents
- Wait for approval

### **Step 2: Create Production App**
- Request API roles
- Define use cases
- Wait for approval

### **Step 3: Get Production Credentials**
- Copy production Client ID
- Copy production Client Secret
- Update environment variables

### **Step 4: Get Production Refresh Token**
- Generate OAuth URL
- Share with NIVAANA
- Get refresh token from OAuth callback
- Update environment variable

### **Step 5: Update Environment Variables**
- Change `AMAZON_ENVIRONMENT=PRODUCTION`
- Update Client ID/Secret
- Update Refresh Token
- Update Base URL (remove "sandbox")

### **Step 6: Test Production Connection**
- Test with real data (carefully!)
- Verify all API calls work
- Monitor for errors

---

## ⚠️ Important Production Notes

1. **AWS Account & IAM Role:**
   - ✅ You can use the **same AWS account** for production
   - ✅ You can use the **same IAM role** for production
   - ✅ You can use the **same access keys** for production
   - **No need to create new AWS resources!**

2. **Credentials:**
   - Production credentials are **completely separate** from sandbox
   - Must get production Client ID/Secret from production app
   - Must get production refresh token from real seller account

3. **Data:**
   - Production uses **real NIVAANA data**
   - Be careful with updates - they affect real inventory/orders
   - Test thoroughly before going live

4. **Timeline:**
   - Identity verification: 20 mins - 10 days
   - Role approval: Usually quick after verification
   - OAuth authorization: Immediate (once NIVAANA approves)

---

## ✅ Summary for Your Manager

**What You've Already Done (Can Reuse):**
- ✅ AWS Account created
- ✅ IAM Role created
- ✅ Inline Policy attached
- ✅ IAM User created
- ✅ Access Keys generated

**What's New for Production:**
- ⚠️ Identity Verification (Required - 20 mins to 10 days)
- ⚠️ Production App Creation (Request API roles)
- ⚠️ Production Credentials (Different from sandbox)
- ⚠️ Real Seller Account Authorization (OAuth with NIVAANA)

**Timeline:**
- Identity Verification: 20 mins - 10 days
- Production App Setup: 1-2 hours (after verification)
- OAuth Authorization: Immediate (once NIVAANA approves)
- **Total: 1-2 days (depending on verification approval)**

---

**Document Version:** 1.0  
**Last Updated:** January 2025

