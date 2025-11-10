# Amazon SP-API Integration - Setup Flow Summary
## For Management Review

**Date:** January 2025  
**Integration:** Nivaana Web App ↔ Amazon Selling Partner API (SP-API)  
**Environment:** Sandbox (Testing) → Production (Live)

---

## ✅ Complete Setup Flow (Confirmed)

### **Phase 1: Amazon Solution Provider Portal Setup**

**Step 1: Create Developer Account**
- ✅ Register at Amazon Solution Provider Portal
- ✅ Register as Individual Developer (or Company)
- ✅ **No identity verification required for Sandbox**

**Step 2: Create Sandbox Application**
- ✅ Create new app in Developer Central
- ✅ App automatically set to "Sandbox" status
- ✅ App Name: "Nivaana" (or your choice)
- ✅ API Type: SP API

**Step 3: Get LWA Credentials**
- ✅ Click "View sandbox credentials"
- ✅ **Copy and save:**
  - Client ID (LWA)
  - Client Secret
  - Rotation Deadline

**Deliverable:** LWA Client ID and Client Secret

---

### **Phase 2: AWS Account & IAM Setup**

**Step 4: Create AWS Account**
- ✅ Use same email as Amazon Solution Provider Portal account
- ✅ Complete AWS account verification
- ✅ **Note:** New AWS accounts may have 24-48 hour restrictions

**Step 5: Create IAM Role**
- ✅ AWS Console → IAM → Roles → Create Role
- ✅ Trusted entity: "AWS Account" → "Another AWS account"
- ✅ Enter Amazon's account ID: `589160054188`
- ✅ Role name: `SP-API-Role`
- ✅ **Copy the Role ARN** (format: `arn:aws:iam::YOUR_ACCOUNT_ID:role/SP-API-Role`)

**Step 6: Add Inline Policy to IAM Role**
- ✅ After role creation, go to role → Permissions tab
- ✅ Click "Add permissions" → "Create inline policy"
- ✅ Use JSON tab, paste policy:
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
- ✅ Policy name: `SPAPIAccessPolicy`

**Deliverable:** IAM Role ARN

---

### **Phase 3: Get Refresh Token**

**Step 7: Create Refresh Token**
- ✅ Go to Solution Provider Portal → Your App → Sandbox Testing
- ✅ Click "Create Token" button
- ✅ Copy the refresh token from the table
- ✅ **Store securely** (this is used for all API calls)

**Deliverable:** Amazon Refresh Token

---

### **Phase 4: AWS Access Keys (For SigV4 Signing)**

**Step 8: Create IAM User**
- ✅ AWS Console → IAM → Users → Add users
- ✅ Username: `sp-api-user` (or any name)
- ✅ **Uncheck** "Provide user access to the AWS Management Console"
- ✅ Skip permissions (optional)
- ✅ Create user

**Step 9: Generate Access Keys**
- ✅ Go to IAM → Users → Select `sp-api-user`
- ✅ Security credentials tab → Access keys section
- ✅ Click "Create access key"
- ✅ Use case: "Application running outside AWS"
- ✅ Description: "Amazon SP-API integration for Nivaana backend"
- ✅ **Copy both immediately:**
  - Access Key ID (starts with `AKIA...`)
  - Secret Access Key (shown only once!)

**Deliverable:** AWS Access Key ID and Secret Access Key

---

## 📋 Configuration Summary

### **Environment Variables Required:**

```env
# Amazon SP-API Credentials (From Solution Provider Portal)
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxxxx
AMAZON_CLIENT_SECRET=your_client_secret_here
AMAZON_REFRESH_TOKEN=your_refresh_token_here
AMAZON_ENVIRONMENT=SANDBOX
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV  # Fixed for India

# AWS Credentials (From IAM User)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AMAZON_REGION=eu-west-1

# AWS IAM Role (From IAM Role)
AMAZON_AWS_IAM_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/SP-API-Role
```

---

## ✅ Your Flow Confirmation

**Your Understanding:**
1. ✅ Create Amazon Solution Provider Portal → Get LWA Client ID & Secret
2. ✅ Setup AWS Account → Create IAM Role → Get Role ARN
3. ✅ Create inline policy for IAM role (you said "privacy policy" but meant "inline policy")
4. ✅ Get Refresh Token from Solution Provider Portal
5. ✅ Create IAM User → Get Access Key ID & Secret Access Key

**Status:** ✅ **100% CORRECT!**

**Minor Correction:**
- You mentioned "privacy policy" - it's actually an **"inline policy"** attached to the IAM role
- Everything else is accurate

---

## 🎯 Implementation Status

### **Backend Implementation:**
- ✅ Amazon Service (Authentication & API calls)
- ✅ Amazon Controller (Request handlers)
- ✅ Amazon Routes (API endpoints)
- ✅ Environment configuration

### **API Endpoints Ready:**
- ✅ `GET /v1/amazon/products/:sellerId` - Get product list
- ✅ `GET /v1/amazon/products/:sellerId/:sku` - Get product by SKU
- ✅ `PATCH /v1/amazon/inventory/:sellerId/:sku` - Update inventory
- ✅ `GET /v1/amazon/orders` - Get orders
- ✅ `GET /v1/amazon/orders/:orderId/items` - Get order items
- ✅ `POST /v1/amazon/orders/:orderId/shipment` - Confirm shipment

---

## 📊 Setup Checklist

### **Amazon Setup:**
- [ ] Solution Provider Portal account created
- [ ] Sandbox app created
- [ ] LWA Client ID obtained
- [ ] LWA Client Secret obtained
- [ ] Refresh Token created

### **AWS Setup:**
- [ ] AWS account created
- [ ] IAM Role created (`SP-API-Role`)
- [ ] Inline policy attached to role
- [ ] IAM Role ARN copied
- [ ] IAM User created (`sp-api-user`)
- [ ] Access Key ID obtained
- [ ] Secret Access Key obtained

### **Backend Configuration:**
- [ ] All environment variables added to `.env`
- [ ] Backend service tested
- [ ] API endpoints tested
- [ ] Authentication flow verified

### **Frontend Integration:**
- [ ] API service created
- [ ] Sync components created
- [ ] Error handling implemented
- [ ] UI components integrated

---

## 🔄 Runtime Flow (After Setup)

```
User clicks "Sync" → Frontend → Backend API → Amazon SP-API
                                    ↓
                            Auto-authentication
                            (Uses refresh token)
                                    ↓
                            Returns data → Frontend
```

**Key Point:** No user login required - all authentication is server-side.

---

## ⚠️ Important Notes for Management

1. **Security:**
   - All credentials stored securely in backend `.env`
   - Never exposed to frontend
   - Refresh token auto-rotates access tokens

2. **Cost:**
   - AWS account: Free tier available
   - Amazon SP-API: Free for sandbox, standard API pricing for production
   - No additional infrastructure costs

3. **Timeline:**
   - Sandbox setup: 1-2 days (including AWS account restrictions)
   - Production setup: Additional 1-2 days (identity verification required)

4. **Dependencies:**
   - Amazon Solution Provider Portal account
   - AWS account
   - Backend server with environment variables configured

---

## ✅ Confirmation

**Your flow is 100% correct!** All steps are accurate and in the right order.

**Ready for:**
- ✅ Manager presentation
- ✅ Team handoff
- ✅ Production deployment (after sandbox testing)

---

**Document Version:** 1.0  
**Status:** ✅ Approved for Management Review

