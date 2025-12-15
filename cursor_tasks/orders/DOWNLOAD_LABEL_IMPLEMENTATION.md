# Download Label Implementation

## Overview

This document describes the download label flow which calls EKART API and then uploads to GCP Storage Backend (server 4500).

## Flow

```
1. Client → POST /v1/ekart/shipments/label
   Body: { trackingIds: ["FMPC001", "FMPC002"] }

2. Asset Management Backend → EKART API
   POST /v1/package/label
   Headers: Bearer {EKART_TOKEN}
   Body: { ids: ["FMPC001", "FMPC002"] }
   Response: string<binary> (PDF)

3. Convert to Buffer
   Buffer.from(response.data)

4. Asset Management Backend → GCP Storage Backend (server 4500)
   POST /api/v1/storage/upload-buffer
   Headers: Content-Type: application/json
   Body: {
     fileBuffer: base64-encoded-buffer,
     fileName: "FMPC001/label.pdf",
     bucket: "niv-shipping-lavel-dev",
     contentType: "application/pdf"
   }
   Response: { success: true, data: { url: "https://..." } }

5. Update Database
   orders.label_url = public_url
   orders.label_downloaded_at = timestamp
   (NO STATUS CHANGE, NO status_history update)

6. Return PDF Binary
   Response: PDF file for immediate download
```

---

## Route: Download Label

**POST** `/v1/ekart/shipments/label`

### Request Body

```json
{
  "trackingIds": ["FMPC001", "FMPC002"]
}
```

### Response

- **Content-Type:** `application/pdf`
- **Body:** Binary PDF file

---

## Implementation Details

### 1. Create Shipment (NO STATUS CHANGE)

**Route:** `POST /v1/ekart/shipments/forward`

**What it does:**
- ✅ Calls EKART API to create shipment
- ✅ Updates `orders` table with:
  - `tracking_id`
  - `vendor`
  - `barcodes`
  - `public_tracking_link`
  - `shipment_created_at`
- ❌ **NO status change** (remains `ready_for_dispatch`)
- ❌ **NO status_history update**

**Code Location:** `src/controllers/ekart.controller.ts` (lines 121-204)

---

### 2. Download Label (NO STATUS CHANGE)

**Route:** `POST /v1/ekart/shipments/label`

**What it does:**
1. ✅ Calls EKART API → Gets binary PDF
2. ✅ Converts to Buffer
3. ✅ Calls GCP Storage Backend (server 4500) → Uploads PDF
4. ✅ Updates `orders` table with:
   - `label_url` (public GCP URL)
   - `label_downloaded_at`
- ❌ **NO status change** (remains `ready_for_dispatch`)
- ❌ **NO status_history update**

**Code Location:** `src/controllers/ekart.controller.ts` (lines 244-337)

---

## Environment Variables

**File:** `.env`

```bash
# GCP Storage Backend (server 4500)
STORAGE_BACKEND_URL=http://localhost:4500  # or your server 4500 URL
SHIPPING_BUCKET=niv-shipping-lavel-dev
```

**File:** `src/config/env.ts` (already added ✅)

```typescript
STORAGE_BACKEND_URL: z.string().optional().default('http://localhost:4500'),
SHIPPING_BUCKET: z.string().optional(),
```

---

## GCP Storage Backend API (Server 4500)

### Endpoint: Upload from Buffer

**POST** `/api/v1/storage/upload-buffer`

**Note:** This endpoint needs to be implemented in server 4500 (GCP Storage Backend). See implementation guide for server 4500 setup.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "fileBuffer": "base64-encoded-pdf-buffer",
  "fileName": "FMPC001/label.pdf",
  "bucket": "niv-shipping-lavel-dev",
  "contentType": "application/pdf",
  "makePublic": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "url": "https://storage.googleapis.com/niv-shipping-lavel-dev/FMPC001/label.pdf",
    "fileName": "FMPC001/label.pdf",
    "bucket": "niv-shipping-lavel-dev"
  }
}
```

---

## Storage Structure

**Bucket:** `niv-shipping-lavel-dev`

**Path Format:** `tracking_id/label.pdf`

**Examples:**
- `FMPC001/label.pdf`
- `FMPC002/label.pdf`

**Public URLs:**
- `https://storage.googleapis.com/niv-shipping-lavel-dev/FMPC001/label.pdf`
- `https://storage.googleapis.com/niv-shipping-lavel-dev/FMPC002/label.pdf`

---

## Status Flow

```
ready_for_dispatch
    ↓
[Create Shipment] ← NO STATUS CHANGE, NO status_history
    ↓
[Download Label] ← NO STATUS CHANGE, NO status_history
    ↓
ready_for_dispatch (still)
    ↓
[Mark Shipped] ← STATUS CHANGES to "shipped", status_history updated
```

---

## Code Changes

### Removed
- ❌ `storageService` import (no longer needed)
- ❌ Storage service dependency

### Added
- ✅ Direct `axios` call to server 4500
- ✅ `STORAGE_BACKEND_URL` environment variable
- ✅ Comments clarifying NO STATUS CHANGE

---

## Testing

### 1. Test Download Label

```bash
curl -X POST http://localhost:8080/v1/ekart/shipments/label \
  -H "Content-Type: application/json" \
  -d '{
    "trackingIds": ["FMPC001", "FMPC002"]
  }' \
  --output labels.pdf
```

### 2. Verify in Database

```sql
SELECT id, tracking_id, label_url, label_downloaded_at, status
FROM orders
WHERE tracking_id IN ('FMPC001', 'FMPC002');
```

**Expected:**
- `label_url` = GCP public URL
- `label_downloaded_at` = timestamp
- `status` = `ready_for_dispatch` (unchanged)

---

## Summary

✅ **Create Shipment:** NO status change, NO status_history  
✅ **Download Label:** NO status change, NO status_history  
✅ **Calls EKART API:** Gets binary PDF  
✅ **Calls Server 4500:** Uploads to GCP Storage  
✅ **No Storage Config:** Direct HTTP call, no storage service needed  
✅ **Path Format:** `tracking_id/label.pdf`

