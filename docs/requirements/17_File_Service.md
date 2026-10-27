# 17 · File and Document Service (vyb-lyf-file-upload)

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** `vyb-lyf-file-upload` (`src/routes/routes.ts`, controllers, `src/multer`, `src/cloudstorge`, `src/template`), `DEPLOYMENT_GUIDE.md`, Cloud Build files.
**Runs on:** Cloud Run (`cloudbuildsit.yaml`, `cloudbuildprod.yaml`); stores files in Google Cloud Storage.

## 1. Purpose

A separate service that stores uploaded files and generates PDFs (PO, invoices, labels) for the backend, Inventory, E-com and Mobile.

## 2. Functions

| Endpoint | Used by | Does |
| --- | --- | --- |
| `POST /product/images/:productid` | Inventory products | Product images (02) |
| `POST /storefront/media`, `/upload/advertisement` | Inventory promotional assets | Home page media (12) |
| `POST /uploadrating/images` | Customer ratings | Review photos (12) |
| `POST /pr/quotes`, `/po/invoice` | Purchasing | Quote files, supplier invoices (04) |
| `POST /generate-document/:templatetype` | Inventory PO | Builds the PO PDF from a `.docx` template; calls back `PUT /v1/purchaseorders/:id` with the user's token (04) |
| `POST /order/invoice`, `/pdf` | Backend | Customer tax invoice and return invoice PDFs (07) |
| `POST /shipping/label/:trackingId`, `GET /shipping/label/:trackingId` | Backend | Stores and serves Ekart / Shipmozo labels (09) |
| `POST /file-upload/:organisation`, `GET /get-files/:organisation` | General | Generic upload and list |
| `POST /tickets/images` | Legacy service tickets | (retired?) |
| `GET /health` | Monitoring | |

- **FIL-01** Maximum upload size is **150 MB** per file (multer). Module rules can be stricter: category image ≤ 5 MB, return photo ≤ 8 MB, video ≤ 60 MB.
- **FIL-02** Each environment has its own base URL (`API_CONFIG.BASE_URL_UPLOADS`). Clients must never hard-code it (FIX-2026-10-07-62).
- **FIL-03** Return evidence and category images are stored in their own buckets (`RETURN_EVIDENCE_BUCKET`, `CATEGORY_IMAGES_BUCKET`), set in the backend env.

## 3. Gaps and items to confirm

- **Security:** only the return-evidence and category-image uploads check the `X-Storage-Api-Key` header (`STORAGE_API_KEY`). Every other route has no authentication of its own (it only forwards `Authorization` on callbacks), so anyone who knows the URL can upload. Extend the key check to all routes.
- No allowed file-type list is enforced service-wide.
- `Revo-*` templates and `tickets` / `revoinvoice` come from the earlier Revo product. Confirm which are still needed.

## 4. Source documents

`vyb-lyf-file-upload/DEPLOYMENT_GUIDE.md`, `QUICK_DEPLOY.md`, `OPTIMIZATION_NOTES.md`.
