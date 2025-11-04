# DLT Setup Verification Guide for Exotel SMS

## 📋 Understanding DLT Registration Flow

### The Complete SMS Delivery Chain:
```
Your Backend → Exotel API → Telecom Operator (Airtel/Vodafone/Jio) → User's Phone
                                        ↑
                            Requires DLT Registration
```

### Two-Level Setup Required:

1. **DLT Provider Registration** (Telecom Operators)
   - Register with each telecom operator's DLT platform
   - Airtel: https://airtel.in/dlt
   - Vodafone: https://vilt.com/dlt
   - Jio: https://jit.io/dlt
   - BSNL: https://bsnl.co.in/dlt

2. **Exotel Configuration** (SMS Aggregator)
   - Link your DLT-registered templates to Exotel
   - Exotel passes through to telecom operators

---

## ✅ Step-by-Step Verification Checklist

### **Step 1: Verify DLT Provider Registration (Airtel)**

#### A. Check Entity ID Registration
- **Portal**: Airtel DLT Portal (or your registered DLT provider)
- **Action**: Log in and verify:
  - ✅ Your **Entity ID**: `1001559274293829743` exists
  - ✅ Status: **"APPROVED"** or **"ACTIVE"** (NOT "REGISTERED" or "Pending")
  - ⚠️ **"REGISTERED" Status = Payment/Pending** → Needs to be "APPROVED" for SMS to work
  - ✅ Associated with your company/domain
  
**⚠️ CRITICAL**: If Status shows **"REGISTERED"** instead of **"APPROVED"**:
  - ❌ Your account is registered but **NOT active for sending SMS**
  - ✅ **Solution**: Click "PROCEED TO PAY" button to complete registration
  - ✅ After payment, status will change to "APPROVED" or "ACTIVE"
  - ✅ Only then can you send SMS successfully

#### B. Check Sender ID Registration
- **Action**: In DLT Portal, find Sender ID `NIVNAA`
  - ✅ Status: **"Approved"**
  - ✅ Entity ID linked: `1001559274293829743`
  - ✅ Active for all telecom operators (Airtel, Vodafone, Jio, etc.)

#### C. Check Template Registration
- **Action**: Find Template ID `1007447403618460471`
  - ✅ Template Text: `Your verification code is: {#var#}. Valid for 60 seconds. Do not share this code.`
  - ✅ Variable Placeholder: `{#var#}` (must match exactly)
  - ✅ Status: **"Approved"** (not "Pending")
  - ✅ Entity ID linked: `1001559274293829743`
  - ✅ Registered for all telecom operators

#### D. Verify Template Text Match
**IMPORTANT**: The template text in DLT must **exactly** match:
```
Your verification code is: {#var#}. Valid for 60 seconds. Do not share this code.
```

**Common Issues**:
- ❌ Extra spaces
- ❌ Wrong variable format (`{var}` instead of `{#var#}`)
- ❌ Different punctuation
- ❌ Case sensitivity

---

### **Step 2: Verify Exotel Configuration**

#### A. Login to Exotel Dashboard
- **URL**: https://www.exotel.com/dashboard
- **Navigation**: SMS Settings → SMS Templates

#### B. Verify Template Mapping
- **Action**: Find Template ID `1007447403618460471`
  - ✅ Template ID matches DLT provider
  - ✅ Template Text matches DLT registration
  - ✅ Status: **"Active"** or **"Approved"**
  - ✅ DLT Entity ID: `1001559274293829743` (or linked correctly)

#### C. Verify Sender ID Configuration
- **Navigation**: SMS Settings → Sender IDs
- **Action**: Find Sender ID `NIVNAA`
  - ✅ Sender ID: `NIVNAA`
  - ✅ Status: **"Approved"**
  - ✅ Entity ID: `1001559274293829743` (matches DLT)
  - ✅ DLT Status: **"Approved"**

#### D. Verify Template-Entity ID Link
- **Action**: Check if Template and Entity ID are linked:
  - ✅ Template row shows Entity ID: `1001559274293829743`
  - ✅ OR Template's "DLT Entity ID" column matches
  - ✅ Both are in "Approved" status

---

### **Step 3: Verify Backend Configuration**

#### A. Check Environment Variables (.env file)
```bash
# Exotel Basic Configuration
EXOTEL_ACCOUNT_SID=vip98venturesllp1
EXOTEL_API_KEY=your_api_key
EXOTEL_API_TOKEN=your_api_token
EXOTEL_SENDER_ID=NIVNAA

# DLT Configuration (from Exotel Dashboard)
EXOTEL_DLT_TEMPLATE_ID=1007447403618460471
EXOTEL_ENTITY_ID=1001559274293829743
```

#### B. Verify Values Match Exotel Dashboard
1. ✅ `EXOTEL_DLT_TEMPLATE_ID` = Template ID from Exotel Dashboard
2. ✅ `EXOTEL_ENTITY_ID` = Entity ID from Sender ID row in Exotel
3. ✅ `EXOTEL_SENDER_ID` = Sender ID from Exotel Dashboard

---

## 🔍 Troubleshooting: "DLT_TEMPLATE_NOT_FOUND" Error

### ⚠️ **CRITICAL ISSUE: "REGISTERED" Status**

**If your Airtel DLT account shows Status: "REGISTERED" (not "APPROVED"):**

- ❌ **Problem**: "REGISTERED" means account is created but **payment is pending**
- ❌ **Impact**: Cannot send SMS until status changes to "APPROVED"
- ✅ **Solution**: 
  1. Click **"PROCEED TO PAY"** button in Airtel DLT portal
  2. Complete the payment process
  3. Wait for status to change to **"APPROVED"** or **"ACTIVE"**
  4. Then your SMS will work

**Note**: You might have multiple Entity IDs:
- Old Entity ID: `1001559274293829743` (from Airtel account details)
- New Entity ID: `1005983463861691128` (Header ID you mentioned)
- **Use the Entity ID that matches your Exotel Dashboard configuration**

---

### Possible Causes & Solutions:

#### **Cause 1: Template Not Approved in DLT Provider**
**Symptom**: Template exists but status is "Pending"
**Solution**: 
- Wait for DLT approval (can take 2-7 days)
- Or contact DLT provider support

#### **Cause 2: Template Text Mismatch**
**Symptom**: Template approved but text doesn't match
**Solution**:
- Verify exact template text in DLT portal
- Update DLT registration if needed
- Re-verify in Exotel dashboard

#### **Cause 3: Entity ID Mismatch**
**Symptom**: Template approved but Entity ID doesn't match
**Solution**:
- Verify Entity ID from DLT provider matches Exotel
- Check Sender ID row in Exotel → Entity ID column
- Update `.env` if incorrect

#### **Cause 4: Sender ID Not Approved**
**Symptom**: "From: NA" in Exotel portal
**Solution**:
- Verify Sender ID `NIVNAA` is approved in DLT
- Check Sender ID status in Exotel Dashboard
- Ensure it's linked to correct Entity ID

#### **Cause 5: Template Not Linked in Exotel**
**Symptom**: Template exists in DLT but not configured in Exotel
**Solution**:
- Go to Exotel Dashboard → SMS Templates
- Add/map your DLT template
- Link to Entity ID from Sender ID settings

---

## 📝 Quick Verification Commands

### Test Your Current Configuration:

1. **Check Logs** for actual values being sent:
```bash
# Look for these in server logs:
DLTTemplateId: "1007447403618460471"
DltEntityId: "1001559274293829743"
From: "NIVNAA"
```

2. **Verify API Payload** (in logs):
```
From=NIVNAA&To=%2B919994824573&DLTTemplateId=1007447403618460471&DltEntityId=1001559274293829743&DLTVariables=%7B%22var%22%3A%22475411%22%7D
```

3. **Check Exotel Response**:
- Status should be: `"sent"` or `"queued"` (NOT `"failed"`)
- DetailedStatus should NOT contain: `"DLT_TEMPLATE_NOT_FOUND"`

---

## 🚨 Critical Points

### ❌ Common Mistakes:
1. **Using Template Entity ID instead of Sender ID Entity ID**
   - ✅ Correct: Entity ID from Sender ID row
   - ❌ Wrong: Entity ID from Template row (may be empty/pending)

2. **Template Text Mismatch**
   - ✅ Must match exactly including spaces, punctuation, case
   - ❌ Even one character difference causes failure

3. **Missing Approval Status**
   - ✅ Both Template AND Sender ID must be "Approved" in DLT
   - ❌ "Pending" status = SMS will fail

4. **Wrong Variable Format**
   - ✅ Use: `{#var#}`
   - ❌ Don't use: `{var}`, `{{var}}`, `[var]`, etc.

---

## 📞 Next Steps if Still Failing

### If verification passes but SMS still fails:

1. **Contact Exotel Support**:
   - Share your Template ID: `1007447403618460471`
   - Share your Entity ID: `1001559274293829743`
   - Share the error: `DLT_TEMPLATE_NOT_FOUND`
   - Ask them to verify the DLT mapping

2. **Contact DLT Provider (Airtel)**:
   - Verify Template ID: `1007447403618460471` is active
   - Verify Entity ID: `1001559274293829743` is linked
   - Confirm all telecom operators can see your registration

3. **Test with Different Number**:
   - Try sending to different telecom operators
   - Airtel numbers, Vodafone numbers, Jio numbers
   - Some may work while others fail if DLT registration is partial

---

## ✅ Success Indicators

When everything is configured correctly:

1. ✅ Exotel API returns: `Status: "queued"` or `"sent"`
2. ✅ Exotel Portal shows: `Status: "Delivered"` (after processing)
3. ✅ DetailedStatus: `"PENDING_TO_OPERATOR"` (initial) → `"DELIVERED"` (final)
4. ✅ From field shows: `"NIVNAA"` (not "NA")
5. ✅ User receives SMS successfully

---

## 📋 Summary Checklist

### DLT Provider (Airtel/Other):
- [ ] Entity ID registered and approved
- [ ] Sender ID `NIVNAA` registered and approved
- [ ] Template `1007447403618460471` registered and approved
- [ ] Template text exactly matches: `Your verification code is: {#var#}. Valid for 60 seconds. Do not share this code.`
- [ ] All linked to Entity ID `1001559274293829743`

### Exotel Dashboard:
- [ ] Template ID `1007447403618460471` exists and is active
- [ ] Sender ID `NIVNAA` is approved
- [ ] Entity ID `1001559274293829743` matches from Sender ID row
- [ ] Template linked to correct Entity ID

### Backend (.env):
- [ ] `EXOTEL_DLT_TEMPLATE_ID=1007447403618460471`
- [ ] `EXOTEL_ENTITY_ID=1001559274293829743` (from Sender ID row, not template row)
- [ ] `EXOTEL_SENDER_ID=NIVNAA`
- [ ] All values match Exotel Dashboard exactly

---

**Remember**: Exotel is just the aggregator. The actual DLT registration happens with the telecom operators (Airtel, Vodafone, Jio, etc.). Exotel acts as a bridge between your backend and the telecom operators.
