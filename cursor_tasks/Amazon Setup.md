Phase 1: Amazon Setup
├── Seller Central https://sellercentral.amazon.in
├── Nav to partner network -> develop apps
├── Register as developer
    ├── choose private and comple the video id verification and business details
    ├── submit the business profile information

 
Phase 2: create SP-API App
├── Developer Central -> create app
    ├── fill in the app details
    ├── get the lwa client id and secret
    ├── get the credentials (lwa_app_id, lwa_client_secret,app_id)

Phase 3: Configure Redirect URI
├──Go to your app -> Edit -> OAuth Settings -> Redirect URIs -> Add your backend callback URL
    ├── Add your backend callback URL:https://api.nivaana.in/v1/amazon/auth/callback
    ├── **Must match exactly** (protocol, domain, path, no trailing slash)

phase 4 : OAuth Flow

### **STEP 1 — Create Your SP-API App**

1. **Go to Seller Central → Partner Network → Develop Apps**
   - Or use Solution Provider Portal: https://developer.amazonservices.in

2. **Create a new SP-API App**

3. **Get Credentials:**
   - `APP_ID` (e.g., `amzn1.sellerapps.app.xxxxx`) - **Used in authorization URL**
   - `LWA_CLIENT_ID` (e.g., `amzn1.application-oa2-client.xxxxx`) - **Used in token exchange**
   - `LWA_CLIENT_SECRET` (click to reveal) - **Used in token exchange**

**⚠️ Important:** 
- `APP_ID` and `LWA_CLIENT_ID` are **different** values
- `APP_ID` is used in the authorization URL (`application_id` parameter)
- `LWA_CLIENT_ID` is used in token exchange requests

4. **Add your backend callback URL:**
   ```
   https://api.nivaana.in/v1/amazon/auth/callback
   ```

✅ **This identifies your application (not tied to any seller yet).**

---

### **STEP 2 — Seller Authorizes Your App**

**⚠️ Important: Use APP_ID (not LWA_CLIENT_ID) in authorization URL!**

**You send the seller an authorization link:**

```
https://sellercentral.amazon.in/apps/authorize/consent
  ?application_id=<APP_ID>
  &state=<256-bit-random-base64>
  &version=beta
```

**Note:** 
- Use `APP_ID` (e.g., `amzn1.sellerapps.app.xxxxx`) in the authorization URL
- Use `LWA_CLIENT_ID` (e.g., `amzn1.application-oa2-client.xxxxx`) in token exchange
- `redirect_uri` is optional in URL (can be configured in app settings)
- State should be 256-bit random value (base64 encoded) for CSRF protection

**Seller Flow:**
1. Seller logs in with their Amazon Seller Central credentials (can be different email)
2. Seller clicks **"Approve"** or **"Authorize"**
3. Amazon redirects to your callback:
   ```
   https://api.nivaana.in/v1/amazon/auth/callback?
     spapi_oauth_code=Atza|IQEB...
     &selling_partner_id=A1234XYZ
     &state=<same_state>
   ```

✅ **You now know which seller (by `selling_partner_id`) authorized your app.**

**⚠️ Important:**
- `spapi_oauth_code` is valid for **5 minutes** (not 10 minutes)
- Validate `state` parameter immediately to prevent CSRF attacks
- Store state server-side (session/DB) for verification

---

### **STEP 3 — Exchange `spapi_oauth_code` → `refresh_token`**

**Your backend (NOT frontend) makes this call:**

**Endpoint:** `POST https://api.amazon.com/auth/o2/token`  
**Content-Type:** `application/x-www-form-urlencoded`

**Request Body:**
```
grant_type=authorization_code
&code=<spapi_oauth_code>
&client_id=<LWA_CLIENT_ID>
&client_secret=<LWA_CLIENT_SECRET>
&redirect_uri=https://api.nivaana.in/v1/amazon/auth/callback
```

**⚠️ Important:**
- Use `LWA_CLIENT_ID` (not `APP_ID`) in token exchange
- `redirect_uri` must match exactly what's configured in app settings

**Response:**
```json
{
  "access_token": "Atza|IQEB...",
  "refresh_token": "Atzr|IQEB...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

✅ **Store `refresh_token` securely in DB (encrypted).**

**This token uniquely ties:**
```
YOUR_APP  ←→  THAT_SELLER
```

**⚠️ Important:**
- **Immediately validate state** before this exchange → protects against CSRF
- `access_token` is temporary → can be discarded or cached for 1 hour
- `refresh_token` is long-term → store encrypted in database

---

### **STEP 4 — Use Refresh Token to Get Access Token (Reusable)**

**Whenever you need to call SP-API (orders, products, etc.), your backend first gets an access token:**

**Endpoint:** `POST https://api.amazon.com/auth/o2/token`  
**Content-Type:** `application/x-www-form-urlencoded`

**Request Body:**
```
grant_type=refresh_token
&refresh_token=<stored_refresh_token>
&client_id=<LWA_CLIENT_ID>
&client_secret=<LWA_CLIENT_SECRET>
```

**Response:**
```json
{
  "access_token": "Atza|IQEB...",
  "expires_in": 3600
}
```

✅ **Use this 1-hour access token for all SP-API calls.**

**Best Practices:**
- Cache `access_token` for **55 minutes** (refresh 5 minutes before expiry)
- Access tokens are automatically cached and refreshed before expiry
- One access token per seller (use correct refresh_token for each seller)

---

### **STEP 5 — Call Amazon SP-API with Access Token**

**Example: Fetch orders**

**Endpoint:** `GET https://sellingpartnerapi-eu.amazon.com/orders/v0/orders`

**Headers:**
```
x-amz-access-token: <access_token>
Content-Type: application/json
```

**Query Parameters (optional):**
```
?MarketplaceIds=A21TJRUUN4KGV
&CreatedAfter=2024-01-01T00:00:00Z
```

✅ **Response: Seller's orders data.**



refresh_token 
lwa_app_id
lwa_client_secret

get lwa access token using seller central app credntials
token will valid for 1 hr 

post
https://api.amazon.com/auth/o2/token

body:
grant_type="refresh_token"
refresh_token=refresh_token
client_id=lwa_app_id
client_secret=lwa_client_secret

response:
{
    "access_token": "Atza|...",
    "refresh_token": "Atzr|...",
}



# Amazon SP 

AMAZON_CLIENT_ID=amzn1.application-oa2-client.7ad6031534434413abf37ff84645fc21
AMAZON_CLIENT_SECRET=amzn1.oa2-cs.v1.6a5aaf4cb973295986da94e9c91087e614f0b9d5a5a9fa3ff87cbd8552505a33
AMAZON_ENVIRONMENT=SANDBOX
AMAZON_MARKETPLACE_ID=A21TJRUUN4KGV
AMAZON_SP_API_BASE_URL=https://sandbox.sellingpartnerapi-eu.amazon.com
AMAZON_AWS_IAM_ROLE_ARN=arn:aws:iam::260727659482:role/SP-API-Role
AMAZON_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIATZNEULPNKMS45LHY
AWS_SECRET_ACCESS_KEY=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
AMAZON_REFRESH_TOKEN=Atzr|IwEBIOpTUgghGy0tfnLtwph81TAOKgFNqxeIsUDry2bqU25j3ybpaAScpdPKTUUZQrcb8tUfvNb1rnK1_IqP37XMfHF4NrgKRKcowtwcZZahKbREwf6dR8hVLjKvtAt6x4OTyryXfvl7KdC-5exloIyJTkI2eF0FvUVoilt0vn42I3p13S-Bch4U-MphxMMgReh3fpKoChO8y_Lhv6TKSAPEKwNbuuncj7qRxQxY8J-1HREnsaV4SBMZcSOAVHOzJghtCED3f3mCf0DGi_LRd2DkheOxQ74XGvHMC41wZAz6QcVt4gb0iWJd3ssc-UF0TuUXC4Y
