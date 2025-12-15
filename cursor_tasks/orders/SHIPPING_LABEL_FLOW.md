# Shipping Label Flow - Simple Summary

## Two Backends

1. **Asset Management Backend** (this project) - Port 8080
2. **GCP Storage Backend** (server 4500) - Port 4500

---

## Flow

### Step 1: Create Shipment
**Route:** `POST /v1/ekart/shipments/forward`

```
Asset Management Backend
    ↓
EKART API (create shipment)
    ↓
Update orders table:
  - tracking_id
  - vendor
  - barcodes
  - public_tracking_link
  - shipment_created_at

❌ NO STATUS CHANGE
❌ NO status_history update
Status remains: "ready_for_dispatch"
```

---

### Step 2: Download Label
**Route:** `POST /v1/ekart/shipments/label`

```
Asset Management Backend
    ↓
1. EKART API (download label)
   POST /v1/package/label
   Body: { ids: ["FMPC001", "FMPC002"] }
   Response: string<binary> (PDF)
    ↓
2. Convert to Buffer
   Buffer.from(response.data)
    ↓
3. GCP Storage Backend (server 4500)
   POST /api/v1/storage/upload-buffer
   Headers: Content-Type: application/json
   Body: {
     fileBuffer: base64-encoded-buffer,
     fileName: "FMPC001/label.pdf",
     bucket: "niv-shipping-lavel-dev"
   }
   Response: { success: true, data: { url: "https://..." } }
    ↓
4. Update orders table:
   - label_url (public GCP URL)
   - label_downloaded_at

❌ NO STATUS CHANGE
❌ NO status_history update
Status remains: "ready_for_dispatch"
    ↓
5. Return PDF binary for download
```

---

## Environment Variables

**Asset Management Backend `.env`:**

```bash
# GCP Storage Backend (server 4500)
STORAGE_BACKEND_URL=http://localhost:4500
SHIPPING_BUCKET=niv-shipping-lavel-dev
```

**No storage config needed in this project!** Just HTTP calls to server 4500.

---

## Storage Structure

**Bucket:** `niv-shipping-lavel-dev`

**Path Format:** `tracking_id/label.pdf`

**Examples:**
- `FMPC001/label.pdf`
- `FMPC002/label.pdf`

**Public URLs:**
- `https://storage.googleapis.com/niv-shipping-lavel-dev/FMPC001/label.pdf`

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

## Code Locations

- **Create Shipment:** `src/controllers/ekart.controller.ts` (lines 121-204)
- **Download Label:** `src/controllers/ekart.controller.ts` (lines 244-370)
- **Environment Config:** `src/config/env.ts` (lines 53-55)

---

## Summary

✅ **Create Shipment:** Calls EKART → Updates database → NO status change  
✅ **Download Label:** Calls EKART → Gets PDF → Calls server 4500 → Updates database → NO status change  
✅ **No Storage Config:** Direct HTTP calls to server 4500  
✅ **Path Format:** `tracking_id/label.pdf`

