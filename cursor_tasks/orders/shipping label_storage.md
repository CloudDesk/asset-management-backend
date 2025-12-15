# Shipping Label API Reference

## Base URL
```
http://localhost:4500
```

---

## Route 1: Upload Shipping Label

### API Details
- **Method:** `POST`
- **URL:** `/shipping/label/:trackingId`
- **Full URL Example:** `http://localhost:4500/shipping/label/FMPC001`

### URL Parameters
| Parameter | Type | Required | Example |
|-----------|------|----------|---------|
| `trackingId` | string | Yes | `FMPC001` |

### Query Parameters
None

### Request Payload
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | PDF file (max 10MB) |

**Example (cURL):**
```bash
curl -X POST http://localhost:4500/shipping/label/FMPC001 \
  -F "file=@label.pdf"
```

**Example (Postman):**
- Body → form-data
- Key: `file` (type: File)
- Value: Select PDF file

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Shipping label uploaded successfully",
  "data": {
    "trackingId": "FMPC001",
    "url": "https://storage.googleapis.com/niv-shipping-lavel-dev/FMPC001/label.pdf",
    "filename": "FMPC001/label.pdf"
  }
}
```

### Error Responses

**400 Bad Request - Missing Tracking ID:**
```json
{
  "success": false,
  "message": "Tracking ID is required"
}
```

**400 Bad Request - No File:**
```json
{
  "success": false,
  "message": "No file uploaded. Please upload a PDF file."
}
```

**400 Bad Request - Multiple Files:**
```json
{
  "success": false,
  "message": "Only one file allowed per tracking ID"
}
```

**400 Bad Request - Invalid File Type:**
```json
{
  "success": false,
  "message": "Only PDF files are allowed for shipping labels"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "File upload failed",
  "error": "Error message details"
}
```

---

## Route 2: Get Shipping Label URL

### API Details
- **Method:** `GET`
- **URL:** `/shipping/label/:trackingId`
- **Full URL Example:** `http://localhost:4500/shipping/label/FMPC001`

### URL Parameters
| Parameter | Type | Required | Example |
|-----------|------|----------|---------|
| `trackingId` | string | Yes | `FMPC001` |

### Query Parameters
None

### Request Payload
None (GET request)

**Example (cURL):**
```bash
curl http://localhost:4500/shipping/label/FMPC001
```

**Example (Postman):**
- Method: `GET`
- URL: `http://localhost:4500/shipping/label/FMPC001`
- No body required

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Shipping label found",
  "data": {
    "trackingId": "FMPC001",
    "url": "https://storage.googleapis.com/niv-shipping-lavel-dev/FMPC001/label.pdf"
  }
}
```

### Error Responses

**400 Bad Request - Missing Tracking ID:**
```json
{
  "success": false,
  "message": "Tracking ID is required"
}
```

**404 Not Found - File Doesn't Exist:**
```json
{
  "success": false,
  "message": "Shipping label not found for this tracking ID",
  "trackingId": "FMPC001"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Failed to get shipping label URL",
  "error": "Error message details"
}
```

---

## Summary

| Route | Method | URL | Payload | Query |
|-------|--------|-----|---------|-------|
| Upload Label | POST | `/shipping/label/:trackingId` | `file` (multipart/form-data) | None |
| Get Label URL | GET | `/shipping/label/:trackingId` | None | None |
