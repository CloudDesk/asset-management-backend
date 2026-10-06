# SIT, UAT and PROD Deployment Runbook

Last updated: 2026-10-06

## 1. Purpose

This is the deployment and environment-management runbook for the Nivaana platform across:

1. SIT
2. UAT
3. PROD

The promotion order is always:

```text
SIT -> UAT -> PROD
```

Do not skip an environment. A PROD deployment requires successful SIT validation, successful UAT validation, and explicit production approval.

This document covers:

- Asset-management backend
- File-upload backend
- Inventory frontend
- E-commerce frontend
- Railway/PostgreSQL databases
- Cloud Run, Cloud Build, Cloud Tasks and service accounts
- GCS document/image buckets and e-commerce web assets
- Firebase Hosting
- PhonePe, reset-password and environment URL configuration
- Deployment validation and rollback

No passwords, tokens, private keys, database URLs or client secrets belong in this document.

## 2. Environment Map

All Google Cloud resources currently use project `nivaana` and region `asia-south1` unless a component explicitly says otherwise.

| Resource | SIT | UAT | PROD |
|---|---|---|---|
| Git branch | `SIT` | `UAT` | `PROD` |
| Backend Cloud Run | `nivaana-dev` | `nivaana-uat` | `nivaana` |
| Backend URL | `https://nivaana-dev-715569764663.asia-south1.run.app` | `https://nivaana-uat-715569764663.asia-south1.run.app` | `https://nivaana-715569764663.asia-south1.run.app` |
| Backend image | `gcr.io/nivaana/nivaana-sit:latest` | `gcr.io/nivaana/nivaana-uat:latest` | `gcr.io/nivaana/nivaana-prodenv:latest` |
| Backend runtime service account | `nivaana-dev@nivaana.iam.gserviceaccount.com` | `nivaana-uat@nivaana.iam.gserviceaccount.com` | Verify `cloudbuildprod.yaml` and deployed revision |
| Backend port | `5600` | `5600` | `5600` |
| File-upload Cloud Run | `nivfiles-dev` | `nivfiles-uat` | `nivfiles` |
| File-upload URL | `https://nivfiles-dev-715569764663.asia-south1.run.app` | `https://nivfiles-uat-715569764663.asia-south1.run.app` | `https://nivfiles-715569764663.asia-south1.run.app` |
| File-upload image | `gcr.io/nivaana/niv-fileupload-sit:latest` | `gcr.io/nivaana/niv-fileupload-uat:latest` | `gcr.io/nivaana/niv-fileupload-prodenv:latest` |
| File-upload service account | `niv-fileupload-dev@nivaana.iam.gserviceaccount.com` | `niv-fileupload-uat@nivaana.iam.gserviceaccount.com` | `niv-fileupload-prod@nivaana.iam.gserviceaccount.com` |
| File-upload port | `4500` | `4500` | `4500` |
| Cloud Tasks queue | Environment-specific SIT queue | `nivaana-uat` | Environment-specific PROD queue |
| Inventory Firebase site | `nivaana-inventory-sit` | `nivaana-inventory-uat` | `nivaana-inventory-prod` |
| E-commerce Firebase site | `nivaana-ecom-web-sit` | `nivaana-ecom-web-uat` | `nivaana-ecom-web` |
| PhonePe | Sandbox | Sandbox | Production only |
| Amazon integration | Sandbox/disabled | Sandbox/disabled | Production, subject to release approval |

### Database names

| Environment | Database |
|---|---|
| SIT | `assetmanagement_dev` |
| UAT | `assetmanagement_uat` |
| PROD | `railway` (verified from the deployed service's `DATABASE_URL`) |

Important:

- UAT must only use `assetmanagement_uat`.
- The live PROD Prisma connection currently uses database `railway`.
- The deployed PROD service also contains `POSTGRES_DATABASE=assetmanagement_prod`. This does **not** select Prisma's database; it is inconsistent metadata that must be corrected or removed.
- Do not assume the PROD database from `POSTGRES_DATABASE` or a local file. `DATABASE_URL` is the effective Prisma source.
- Before every PROD deployment, inspect the trigger substitutions and the current deployed revision without printing the connection string.

## 3. Sources of Truth

### Backend

| Environment | Build configuration | Runtime configuration source |
|---|---|---|
| SIT | `cloudbuildsit.yaml` | `.env.sit`, plus configured Secret Manager references |
| UAT | `cloudbuilduat.yaml` on the `UAT` branch | `.env.uat` |
| PROD | `cloudbuildprod.yaml` | Cloud Build trigger substitutions generate `.env.prod` during the build |

### Exact environment-loading behavior

| Component | SIT | UAT | PROD |
|---|---|---|---|
| Backend | `cloudbuildsit.yaml` passes `--env-vars-file .env.sit` | `cloudbuilduat.yaml` passes `--env-vars-file .env.uat` | `cloudbuildprod.yaml` generates `.env.prod` from trigger substitutions, then passes it to Cloud Run |
| File upload | `cloudbuildsit.yaml` passes `--env-vars-file .env.sit` | `cloudbuilduat.yaml` passes `--env-vars-file .env.uat` | Current `cloudbuildprod.yaml` passes repository `.env.prod`; the configured trigger substitutions are not consumed by this YAML |
| Inventory frontend | Vite reads `.env.sit` during `vite build --mode sit` | Vite reads `.env.uat` during `vite build --mode uat` | Vite reads `.env.prod` during `vite build --mode prod` |
| E-commerce frontend | Vite reads `.env.sit` during `vite build --mode sit` | Vite reads `.env.uat` during `vite build --mode uat` | Vite reads `.env.production` during `vite build --mode production` |

SIT and UAT Cloud Build triggers do not currently define application substitutions. Their YAML files load the checked-out environment files. Therefore, a missing variable must be added to the corresponding environment file and deployed again.

For the PROD backend, adding a value only to a local `.env.prod` is not enough. The value must exist in all three places:

1. The PROD Cloud Build trigger substitution, normally named `_VARIABLE_NAME`.
2. The substitution mapping/generation step in `cloudbuildprod.yaml`.
3. The final generated `.env.prod` passed to `gcloud run deploy`.

### Database variables and precedence

| Variable | Purpose | Effective authority |
|---|---|---|
| `DATABASE_URL` | Full Prisma PostgreSQL connection URL | **Authoritative for all Prisma queries** |
| `POSTGRES__DATABASE` | SIT/UAT database-name metadata used by current environment files | Must match the database path in `DATABASE_URL` |
| `POSTGRES_DATABASE` | PROD name generated by the current build YAML | Metadata/helper value; does not override Prisma `DATABASE_URL` |
| `_DATABASE_URL` | PROD trigger substitution used to generate `DATABASE_URL` | Authoritative PROD trigger input |
| `_POSTGRES__DATABASE` | PROD trigger substitution currently written as `POSTGRES_DATABASE` | Must describe the same database as `_DATABASE_URL` or be removed |

Current live verification on 2026-10-06:

| Cloud Run service | Ready revision | Database from `DATABASE_URL` | Separate database-name variable |
|---|---|---|---|
| `nivaana-dev` | `nivaana-dev-00259-n46` | `assetmanagement_dev` | `POSTGRES__DATABASE=assetmanagement_dev` |
| `nivaana-uat` | `nivaana-uat-00006-6wz` | `assetmanagement_uat` | `POSTGRES__DATABASE=assetmanagement_uat` |
| `nivaana` | `nivaana-00120-rgg` | `railway` | `POSTGRES_DATABASE=assetmanagement_prod` (**mismatch**) |

To verify the effective database safely, parse only the pathname from `DATABASE_URL`. Never print the full connection URL:

```bash
gcloud run services describe SERVICE_NAME \
  --project nivaana \
  --region asia-south1 \
  --format=json \
| node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const e=j.spec.template.spec.containers[0].env||[];const v=e.find(x=>x.name==="DATABASE_URL")?.value;if(!v)throw new Error("DATABASE_URL missing");console.log(new URL(v).pathname.replace(/^\\//,""));})'
```

Expected output must be one of:

```text
SIT  -> assetmanagement_dev
UAT  -> assetmanagement_uat
PROD -> railway
```

### Cloud Build trigger map

| Trigger | Branch regex | Config file | Build service account | Runtime variable source |
|---|---|---|---|---|
| `nivaana-sit` | `^SIT$` | `cloudbuildsit.yaml` | `nivaana-dev@nivaana.iam.gserviceaccount.com` | `.env.sit` |
| `nivaana-uat` | `^UAT$` | `cloudbuilduat.yaml` | `nivaana-uat@nivaana.iam.gserviceaccount.com` | `.env.uat` |
| `nivaana-production` | `^Prod$` | `cloudbuildprod.yaml` | `nivaana-prod@nivaana.iam.gserviceaccount.com` | Trigger substitutions |
| `niv-file-dev` | `^sit$` | `cloudbuildsit.yaml` | `niv-fileupload-dev@nivaana.iam.gserviceaccount.com` | `.env.sit` |
| `niv-file-uat` | `^UAT$` | `cloudbuilduat.yaml` | `niv-fileupload-uat@nivaana.iam.gserviceaccount.com` | `.env.uat` |
| `niv-file-prod` | `^prod$` | `cloudbuildprod.yaml` | `niv-fileupload-prod@nivaana.iam.gserviceaccount.com` | Repository `.env.prod` in the current YAML |

Branch regex is case-sensitive. The repository branch observed as `PROD` does not match `^Prod$` or `^prod$`. Confirm the intended branch spelling and update the trigger regex before relying on automatic PROD deployment.

### PROD backend substitution groups

The PROD backend trigger must supply the variables referenced by `cloudbuildprod.yaml`. Keep them grouped during review:

Database and runtime:

```text
_DATABASE_URL
_POSTGRES__DATABASE
_POSTGRES_HOST
_POSTGRES_PASSWORD
_POSTGRES_PORT
_POSTGRES_USER
_NODE_ENV
_API_BASE_URL
_POSTGRESS_QUERY_API
```

GCP, Firebase and APNS:

```text
_GCP_PROJECT_ID
_GCP_PROJECT_LOCATION
_GCP_PROJECT_QUEUE
_GCP_TASK_URL
_FIREBASE_PROJECT_ID
_FIREBASE_SERVICE_ACCOUNT_JSON
_FIREBASE_CLIENT_EMAIL
_FIREBASE_PRIVATE_KEY
_APNS_AUTH_KEY
_APNS_KEY_ID
_APNS_TEAM_ID
_APNS_BUNDLE_ID
```

Application URLs and password/payment returns:

```text
_REDIRECT_INVENTORY_URL
_REDIRECT_URL_FAILURE
_REDIRECT_URL_PAYMENT_STATUS
_REDIRECT_URL_SUCCESS
_ECOM_PAYMENT_RETURN_URL
_MOBILE_PAYMENT_RETURN_URL
_PAYMENT_RETURN_URL_ALLOWED_ORIGINS
```

PhonePe:

```text
_PHONEPE_AUTH_MODE
_PHONEPE_CLIENT_ID
_PHONEPE_CLIENT_SECRET
_PHONEPE_CLIENT_VERSION
_PHONEPE_ENVIRONMENT
_PHONEPE_OAUTH_URL
_PHONEPE_WEBHOOK_USERNAME
_PHONEPE_WEBHOOK_PASSWORD
```

Redis, email, OTP and messaging:

```text
_REDIS_EMAIL_OTPEXPSEC
_REDIS_HOST
_REDIS_PASSWORD
_REDIS_USERNAME
_REDIS_PORT
_REDIS_SESSIONEXSEC
_GMAIL_AUTH_PASSWORD
_GMAIL_AUTH_USER
_GMAIL_HOST
_GMAIL_PORT
_GMAIL_SERVICE
_TWILIO_ACCOUNT_SID
_TWILIO_AUTH_TOKEN
_TWILIO_PHONE_NUMBER
_EXOTEL_ACCOUNT_SID
_EXOTEL_API_KEY
_EXOTEL_API_TOKEN
_EXOTEL_SENDER_ID
_EXOTEL_DLT_TEMPLATE_ID
_EXOTEL_ENTITY_ID
_EXOTEL_SUBDOMAIN
```

Amazon and application authentication:

```text
_AMAZON_MARKETPLACE_ID
_AMAZON_REGION
_AMAZON_CLIENT_ID
_AMAZON_CLIENT_SECRET
_AMAZON_REFRESH_TOKEN
_AMAZON_ENVIRONMENT
_AMAZON_SELLER_CENTRAL_URL
_AMAZON_SELLER_ID
_JWT_SECRET
_JWT_ACCESS_TOKEN_EXPIRY
_JWT_REFRESH_TOKEN_EXPIRY
_JWT_REFRESH_ON_USE
```

Shipping, file storage and seller configuration:

```text
_EKART_CLIENT_ID
_EKART_USERNAME
_EKART_PASSWORD
_EKART_BASE_URL
_SELLER_GST_TIN
_WAREHOUSE_PINCODE
_STORAGE_BACKEND_URL
_STORAGE_API_KEY
_SHIPMOZO_INTEGRATION_ENABLED
_SHIPMOZO_PUBLIC_KEY
_SHIPMOZO_PRIVATE_KEY
_SHIPMOZO_BASE_URL
_SHIPMOZO_WAREHOUSE_ID
_SHIPMOZO_TRACKING_SYNC_ENABLED
_SHIPMOZO_TRACKING_SYNC_CRON
_SHIPMOZO_TRACKING_SYNC_BATCH_SIZE
_SHIPMOZO_WEBHOOK_SECRET
```

### Current PROD trigger gaps

As of 2026-10-06, `cloudbuildprod.yaml` references 86 substitutions, while the `nivaana-production` trigger supplies 76. These referenced substitutions are currently missing from the trigger:

```text
_ECOM_PAYMENT_RETURN_URL
_FIREBASE_SERVICE_ACCOUNT_JSON
_GCP_TASK_URL
_MOBILE_PAYMENT_RETURN_URL
_PAYMENT_RETURN_URL_ALLOWED_ORIGINS
_POSTGRESS_QUERY_API
_REDIRECT_INVENTORY_URL
_SHIPMOZO_BASE_URL
_SHIPMOZO_INTEGRATION_ENABLED
_SHIPMOZO_TRACKING_SYNC_BATCH_SIZE
_SHIPMOZO_TRACKING_SYNC_CRON
_SHIPMOZO_TRACKING_SYNC_ENABLED
_SHIPMOZO_WAREHOUSE_ID
_SHIPMOZO_WEBHOOK_SECRET
```

The trigger also contains four legacy substitutions that the current backend YAML does not consume:

```text
_ACCESSKEYID
_PROTOCOL
_REGION
_SECRETACCESSKEY
```

Do not run the current PROD backend build until required substitutions are populated or explicitly made optional. The YAML validates required values and may fail before deploy.

`RESET_PASSWORD_URL` is present in SIT/UAT environment files but is not currently mapped in the PROD build substitution generator. Add `_RESET_PASSWORD_URL` to the PROD trigger and `cloudbuildprod.yaml` before relying on environment-specific forgot-password links in PROD.

### File upload

| Environment | Build configuration | Runtime configuration source |
|---|---|---|
| SIT | `cloudbuildsit.yaml` | `.env.sit` |
| UAT | `cloudbuilduat.yaml` | `.env.uat` |
| PROD | `cloudbuildprod.yaml` | `.env.prod` |

### Frontends

Vite variables are embedded at build time. Updating a Firebase/Cloud Run variable after the frontend build does not change the deployed JavaScript. Rebuild and redeploy the frontend whenever a `VITE_*` value changes.

| Frontend | SIT mode | UAT mode | PROD mode |
|---|---|---|---|
| Inventory | `sit` | `uat` | `prod` |
| E-commerce | `sit` | `uat` | `production` |

### Frontend environment values

Inventory frontend:

| Variable | SIT | UAT | PROD |
|---|---|---|---|
| `VITE_APP_ENV` | `sit` | `uat` | Production value from `.env.prod` |
| `VITE_API_BASE_URL` | SIT backend URL | UAT backend URL | PROD backend URL |
| `VITE_API_BASE_URL_UPLOADS` | SIT file-upload URL | UAT file-upload URL | PROD file-upload URL |
| Firebase public config | Inventory Firebase project config | Inventory Firebase project config | Inventory Firebase project config |
| `VITE_DEFAULT_SELLER_GST_TIN` | Approved seller GST | Approved seller GST | Approved PROD seller GST |

E-commerce frontend:

| Variable | SIT | UAT | PROD |
|---|---|---|---|
| `VITE_API_BASE_URL` | `https://nivaana-dev-715569764663.asia-south1.run.app/v1` | `https://nivaana-uat-715569764663.asia-south1.run.app/v1` | `https://nivaana-715569764663.asia-south1.run.app/v1` |
| `VITE_ASSET_BASE_URL` | SIT asset base | `https://storage.googleapis.com/nivaana-ecom-assets-uat/web/home` | Approved PROD asset base |
| `VITE_PHONEPE_IFRAME_CHECKOUT` | `true` | `true` | Set according to approved PROD checkout flow |
| `VITE_PHONEPE_CHECKOUT_SCRIPT_URL` | PhonePe staging script | PhonePe staging script | PhonePe production script |

Firebase public API keys are identifiers used by the browser and are not a replacement for Firebase security rules. Private service-account credentials must never be placed in `VITE_*` variables.

## 4. Release Promotion Rules

1. Merge and deploy to SIT.
2. Run SIT smoke tests and integration tests.
3. Promote the same tested commit(s) to UAT.
4. Apply required UAT database migrations before testing endpoints that depend on the new schema.
5. Deploy UAT file upload, then UAT backend, then both UAT frontends.
6. Complete UAT sign-off.
7. Take the PROD database backup and record the current Cloud Run revisions.
8. Verify PROD substitutions, payment environment and database target.
9. Deploy PROD in the dependency order documented below.
10. Complete production smoke tests and monitor logs.

Never rebuild PROD from unreviewed local changes. Deploy an approved commit from the intended branch.

## 5. Standard Deployment Order

Use this order in every environment:

```text
1. Database backup / clone / migration
2. GCS buckets and static assets
3. Cloud Tasks queue and IAM verification
4. File-upload Cloud Run service
5. Main backend Cloud Run service
6. Inventory frontend
7. E-commerce frontend
8. End-to-end smoke tests
```

The file-upload service is deployed before the main backend because backend flows call its environment-specific APIs.

## 6. Database Plan

### SIT

- Use only the SIT database.
- Apply schema changes and migrations in SIT first.
- Run `npx prisma validate` and `npx prisma generate` before building.
- Test both read and write operations.

### UAT

- UAT database: `assetmanagement_uat`.
- The initial UAT dataset may be cloned from the current production Railway database after taking a source backup.
- Immediately verify the cloned connection points to `assetmanagement_uat` before starting Cloud Run.
- UAT writes, deletes, payment tests and image changes must never target PROD resources.
- Apply migrations to UAT explicitly; `npx prisma generate` only regenerates the Prisma client and does not execute SQL migrations.

### PROD

- Take a restorable database backup before a schema or data migration.
- Review migration SQL and row-impact estimates.
- Confirm the deployed connection target through metadata only; never paste or log credentials.
- Apply migration once, verify it, and then deploy application code.
- Do not copy UAT data back into PROD.

### Product HSN/GST migration status

Migration source:

```text
scripts/migrations/20261006_sync_authoritative_product_tax.sql
```

Expected result for the current 89-product dataset:

- 77 products: both HSN and GST populated.
- 11 `decor` products: blank HSN and GST `18%`.
- 1 `peaceful_nights` product: blank HSN and blank GST.

The blank values above are intentional based on the approved mapping. Validate counts after each environment migration.

### User deletion safety

The proposed deletion of inventory users 1, 4 and 5 is parked and is not part of the deployment plan.

Before any future deletion:

- Audit all foreign-key and audit-column references.
- Remap valid audit ownership only after approval.
- Delete/revoke authentication sessions; never remap sessions to another user.
- Take a database backup.

## 7. GCS Bucket Matrix

Each environment must use its own writable buckets. Never configure SIT or UAT to write directly into a PROD bucket.

| Variable | SIT | UAT | PROD |
|---|---|---|---|
| `PO_BUCKET` | `niv-po-deve` | `niv-po-uat` | `niv-po-produ` |
| `PR_BUCKET` | `niv-prs-dev` | `niv-prs-uat` | `niv-prs-prod` |
| `COST_ESTIMATION_BUCKET` | `niv-cost-estimations-dev` | `niv-cost-estimations-uat` | `niv-cost-estimations-prod` |
| `PRODUCT_INVOICE_BUCKET` | `niv-products-invoice-dev` | `niv-products-invoice-uat` | `niv-products-invoice-prod` |
| `SERVICE_INVOICE_BUCKET` | `niv-service-invoices-dev` | `niv-service-invoices-uat` | `niv-service-invoices-prod` |
| `PRODUCT_IMAGES_BUCKET` | `niv-products-images-dev` | `niv-products-images-uat` | `niv-products-images-prod` |
| `RATINGS_IMAGES_BUCKET` | `niv-rating-images-dev` | `niv-rating-images-uat` | `niv-rating-images-prod` |
| `PO_INVOICE_BUCKET` | `niv-poinvoices-dev` | `niv-poinvoices-uat` | `niv-poinvoices-prod` |
| `PR_QUOTES_BUCKET` | `niv-pr-quote-dev` | `niv-pr-quote-uat` | `niv-pr-quote-prod` |
| `TICKET_IMAGES_BUCKET` | `niv-tickets-images-dev` | `niv-tickets-images-uat` | `niv-tickets-images-prod` |
| `ADVERTISEMENT_BUCKET` | `niv-advertisement_dev` | `niv-advertisement-uat` | `niv-advertisement_prod` |
| `STOREFRONT_BUCKET` | `niv-advertisement_dev` | `niv-storefront-uat` | `niv-advertisement_prod` |
| `SHIPPING_LABEL_BUCKET` | `niv-shipping-label-dev` | `niv-shipping-label-uat` | `niv-shipping-label-prod` |
| `ORDER_INVOICE_BUCKET` | `niv_order_invoice` | `niv-order-invoice-uat` | `niv_order_invoice_prod` |
| `CATEGORY_IMAGES_BUCKET` | `niv-category-images-dev` | `niv-category-images-uat` | `niv-category-images-prod` |
| `RETURN_REPLACEMENT_BUCKET` | `niv-return-attachments-dev` | `niv-return-attachments-uat` | **Missing from the current PROD file-upload environment; resolve before enabling the feature in PROD** |

### E-commerce web assets

UAT web assets are stored separately:

```text
gs://nivaana-ecom-assets-uat/web/home
```

Frontend base URL:

```text
https://storage.googleapis.com/nivaana-ecom-assets-uat/web/home
```

Asset-copy rules:

- Copy the required SIT or approved PROD objects into the target environment bucket.
- A copied GCS object is independent; deleting/reordering it in UAT does not change the source object.
- After copying product images, update or validate UAT database URLs so records refer to UAT objects.
- Do not leave UAT database records pointing to writable PROD assets.
- Preserve object names/content types/cache metadata unless a change is intentional.
- Do not broaden roles or permissions during a copy. Preserve the approved effective access model.

## 8. Required File-Upload Variables

Every environment must define all of these keys:

```text
PRODUCT_IMAGE_API
PRODUCT_RATING_API
PO_INVOICE_API
PROMOTIOANL_ASSET
PR_QUOTES_API
PR_GENERATE_API
PO_GENERATE_API
TICKETS_IMAGES_API
INVOICE_GENERATE_API
COST_ESTIMATTION_GENERATE_API
PO_BUCKET
PR_BUCKET
COST_ESTIMATION_BUCKET
PRODUCT_INVOICE_BUCKET
SERVICE_INVOICE_BUCKET
PRODUCT_IMAGES_BUCKET
RATINGS_IMAGES_BUCKET
PO_INVOICE_BUCKET
PR_QUOTES_BUCKET
TICKET_IMAGES_BUCKET
ADVERTISEMENT_BUCKET
STOREFRONT_BUCKET
SHIPPING_LABEL_BUCKET
ORDER_INVOICE_BUCKET
CATEGORY_IMAGES_BUCKET
RETURN_REPLACEMENT_BUCKET
STORAGE_API_KEY
NODE_ENV
```

Keep the existing application spellings `PROMOTIOANL_ASSET` and `COST_ESTIMATTION_GENERATE_API` until code and all environments are migrated together.

`RETURN_REPLACEMENT_BUCKET` was previously missing from some environment configurations. Check it explicitly during every release.

## 9. Required Backend Environment Checks

Compare environment key names, not secret values. At minimum verify:

### Core

```text
DATABASE_URL
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_HOST
POSTGRES_PORT
POSTGRES__DATABASE or POSTGRES_DATABASE
NODE_ENV
API_BASE_URL
REDIRECT_INVENTORY_URL
RESET_PASSWORD_URL
STORAGE_BACKEND_URL
STORAGE_API_KEY
```

### Payment return routing

```text
ECOM_PAYMENT_RETURN_URL
MOBILE_PAYMENT_RETURN_URL
PAYMENT_RETURN_URL_ALLOWED_ORIGINS
REDIRECT_URL_PAYMENT_STATUS
REDIRECT_URL_SUCCESS
REDIRECT_URL_FAILURE
```

Expected web return hosts:

| Environment | E-commerce return host | Inventory reset-password host |
|---|---|---|
| SIT | `nivaana-ecom-web-sit.web.app` | `nivaana-inventory-sit.web.app` |
| UAT | `nivaana-ecom-web-uat.web.app` | `nivaana-inventory-uat.web.app` |
| PROD | Production e-commerce host | `nivaana-inventory-prod.web.app` |

The mobile return URL is currently:

```text
nivaana://Main/ProfileTab/MyOrders
```

The mobile client must send `payment_channel: "mobile"`; the e-commerce frontend must send `payment_channel: "ecom"`.

### External integrations

Verify the key presence and intended enablement for:

- PhonePe
- Amazon SP-API
- Shipmozo
- Twilio/Exotel
- Gmail
- Redis
- Firebase/APNS
- EKart
- GCP Tasks

SIT/UAT must keep production write switches disabled unless a separately approved test specifically requires them.

## 10. PhonePe Controls

| Control | SIT | UAT | PROD |
|---|---|---|---|
| `PHONEPE_ENVIRONMENT` | `SANDBOX` | `SANDBOX` | `PRODUCTION` |
| OAuth/API host | PhonePe pre-production sandbox | PhonePe pre-production sandbox | Confirm official production host before release |
| Credentials | Test | Test; currently intended to match SIT | Production only |
| E-commerce checkout | Sandbox iframe | Sandbox iframe | Production checkout configuration |

Required E-commerce Vite values for SIT/UAT:

```text
VITE_PHONEPE_IFRAME_CHECKOUT=true
VITE_PHONEPE_CHECKOUT_SCRIPT_URL=https://mercury-stg.phonepe.com/web/bundle/checkout.js
```

If `VITE_PHONEPE_IFRAME_CHECKOUT` is missing or false, the frontend intentionally falls back to a full-page redirect using `window.location.replace()`.

Production gates:

- `PHONEPE_ENVIRONMENT=PRODUCTION` alone is not sufficient.
- Confirm production OAuth/API URLs, production client ID/secret, webhook credentials and return URLs as a matched set.
- Confirm the deployed Cloud Run revision, not only the repository file.
- Run one controlled low-value production transaction after approval.

Current live warning recorded on 2026-10-06:

```text
PROD PHONEPE_ENVIRONMENT = PRODUCTION
PROD PHONEPE_OAUTH_URL host = api-preprod.phonepe.com
```

This is a mixed production/sandbox configuration. Treat it as a release blocker until PhonePe's approved production OAuth host and matching production credentials are configured and verified together. Do not test a real production payment while this mismatch remains.

## 11. Cloud Build and IAM Checklist

Cloud Build service accounts need the effective permissions required to:

- Write Cloud Logging build logs.
- Push the container image.
- Deploy/update the intended Cloud Run service.
- Act as the environment-specific runtime service account.

The runtime service accounts need only the approved access required by that environment, including their environment-specific buckets and Cloud Tasks operations.

Known build failure pattern:

```text
Build succeeds -> Docker push fails -> Cloud Run deploy does not run
```

Check image-push permission and build logs. `roles/logging.logWriter` is required when Cloud Logging reports that the build account cannot write logs.

Do not copy broad PROD IAM roles to SIT/UAT without review. Do not edit existing role bindings merely to make environments identical; compare effective required permissions and add only missing access through the normal approval process.

## 12. Deployment Commands

Run commands from the matching repository and intended branch. Inspect `git status` first and do not deploy unrelated local changes.

### Backend

SIT:

```bash
cd /Users/sureshkumar/Documents/GitHub/Nivaana/asset-management-backend
git switch SIT
npm ci
npx prisma validate
npx prisma generate
gcloud builds submit . --config cloudbuildsit.yaml --project nivaana
```

UAT:

```bash
cd /Users/sureshkumar/Documents/GitHub/Nivaana/asset-management-backend
git switch UAT
npm ci
npx prisma validate
npx prisma generate
gcloud builds submit . --config cloudbuilduat.yaml --project nivaana
```

PROD:

```bash
cd /Users/sureshkumar/Documents/GitHub/Nivaana/asset-management-backend
git switch PROD
npm ci
npx prisma validate
npx prisma generate
gcloud builds submit . --config cloudbuildprod.yaml --project nivaana
```

For trigger-based deployments, merge/push the approved branch and monitor the matching Cloud Build trigger instead of submitting manually.

### File upload

```bash
cd /Users/sureshkumar/Documents/GitHub/Nivaana/vyb-lyf-file-upload
```

Then run the matching command:

```bash
gcloud builds submit . --config cloudbuildsit.yaml --project nivaana
gcloud builds submit . --config cloudbuilduat.yaml --project nivaana
gcloud builds submit . --config cloudbuildprod.yaml --project nivaana
```

### Inventory frontend

```bash
cd /Users/sureshkumar/Documents/GitHub/Nivaana/asset_management_frontend_aromazen
npm ci
npm run deploy:sit
npm run deploy:uat
npm run deploy:prod
```

Run only the command for the intended environment.

### E-commerce frontend

```bash
cd /Users/sureshkumar/Documents/GitHub/Nivaana/Nivaana-Ecom-Web
npm ci
npm run deploy:sit
npm run deploy:uat
npm run deploy:prod
```

Run only the command for the intended environment.

## 13. Repository Cleanup and Environment-File Retention

### Keep

| File | Reason |
|---|---|
| `.env` | Local backend development; current Node startup uses the default `dotenv` lookup |
| `.env.sit` | Current SIT Cloud Build deploy input |
| `.env.uat` | Current UAT Cloud Build deploy input |
| `.env.prod` | Keep until the relevant PROD pipeline has been verified or migrated fully to substitutions |
| `.env.amazon.local.example` | Sanitized local-development template; it must contain no real credentials |

For Vite frontends, local development should use `.env.development` and optional ignored `.env.local` overrides.

### Safe cleanup candidates

The following files are not runtime/deployment inputs and may be removed after confirming that no unique information is required:

```text
.env.backup
.env.bak
*.backup
*.bak
old dev-server/dev-watch logs
generated debug_*.txt files
```

Deleting an environment backup from the current checkout does not remove a secret from Git history. Rotate any credential that was committed, and plan a coordinated history cleanup separately if required.

### Debug-output cleanup order

Do not only delete generated debug files. The backend currently contains temporary `writeFileSync()` debug statements that recreate them and may write request/business data to the filesystem.

Use this order:

1. Replace/remove temporary debug-file writes in `src/services/poinvoice.service.ts` and `src/utils/dynamicDbOperations.ts`.
2. Keep required operational logging in the normal application/Cloud Logging path.
3. Run tests and `npm run build`.
4. Delete generated tracked `debug_*.txt` and obsolete log files.
5. Keep `/debug_*`, `*.log`, `*.bak` and `*.backup` ignored as appropriate.

### Cleanup audit recorded on 2026-10-06

- `.env.backup` and `.env.bak` were deleted from the working tree; no runtime or deployment reference was found.
- `.env.amazon.local.example` was also deleted. This does not break deployment, but restoring or replacing it with a sanitized example is recommended.
- `debug_service_loaded.txt` is still generated by active code and therefore cannot be treated as a completed cleanup.
- Prisma schema validation passes.
- The DEV-NEW TypeScript build is currently blocked at `src/controllers/product.controller.ts` because nullable `gst_rate` is dereferenced without a null check. Fix this before any deployment.

## 14. Pre-Deployment Checklist

- [ ] Correct repository and branch selected.
- [ ] Working tree reviewed; no unrelated changes included.
- [ ] Approved commits promoted from the previous environment.
- [ ] Database target verified without exposing credentials.
- [ ] Backup/restore point created where required.
- [ ] Migration SQL reviewed and tested in the previous environment.
- [ ] `npx prisma validate` passes.
- [ ] `npx prisma generate` passes.
- [ ] TypeScript/application build passes.
- [ ] Cloud Build configuration exists on the target branch.
- [ ] Trigger branch regex and configuration file path are correct.
- [ ] Runtime service account is environment-specific.
- [ ] Environment keys compared against the previous environment.
- [ ] Reset-password URL points to the target inventory frontend.
- [ ] Payment return URLs point to the target e-commerce frontend/mobile scheme.
- [ ] PhonePe SIT/UAT is sandbox; PROD is reviewed as a complete production set.
- [ ] File-upload API URLs point to the target backend.
- [ ] All target buckets exist.
- [ ] `RETURN_REPLACEMENT_BUCKET` is present.
- [ ] Static assets have been copied into the target environment bucket.
- [ ] No SIT/UAT writable configuration points to PROD buckets or database.
- [ ] Cloud Tasks queue and task URL point to the target backend.

## 15. Post-Deployment Smoke Tests

### Cloud Run

- [ ] New revision is ready and receiving traffic.
- [ ] Container listens on `PORT` (`5600` backend, `4500` file upload).
- [ ] No startup/database/Prisma errors in revision logs.
- [ ] Health/docs endpoint responds as expected.

### Database/API

- [ ] Login and token refresh work.
- [ ] Product list endpoint succeeds without Prisma `P2032`.
- [ ] Product HSN/GST null cases serialize safely.
- [ ] Create/update/read operations use the intended database.
- [ ] Forgot-password link uses the correct environment frontend.

### File upload/storage

- [ ] Upload one disposable test file per critical bucket flow.
- [ ] Returned URL belongs to the target environment bucket.
- [ ] Product/category/rating/ticket images render.
- [ ] Invoice/PO/PR generation succeeds.
- [ ] Return/replacement attachment upload succeeds.
- [ ] Delete only the disposable test objects after verification.

### Frontends

- [ ] Inventory frontend calls the target backend and file-upload service.
- [ ] E-commerce frontend calls the target backend.
- [ ] Brand logo, hero assets, product images and category images render.
- [ ] Browser console has no CORS, CSP or missing-asset errors.
- [ ] Hard refresh and direct route navigation work.

### Payments

- [ ] SIT/UAT checkout displays the PhonePe sandbox iframe modal.
- [ ] E-commerce return stays on the matching environment host.
- [ ] Mobile return uses the Nivaana deep link.
- [ ] Status endpoint confirms the result.
- [ ] Order is created once; cart/stock/payment state is consistent.
- [ ] Cancellation and failed-payment paths work.

## 16. Rollback

### Cloud Run

1. Identify the last healthy revision.
2. Move traffic back to that revision.
3. Preserve the failed revision logs for diagnosis.
4. Do not delete the failed revision until the incident is reviewed.

### Firebase Hosting

Use Firebase Hosting release history to roll back the affected site, or redeploy the last approved commit with the correct environment mode.

### Database

- Prefer a forward-fix for additive, compatible migrations.
- Use the pre-deployment backup for destructive or incompatible failures.
- Do not restore a whole database without confirming the impact on orders, payments and writes that occurred after the backup.

### Storage

- Copy operations are independent and can be corrected in the target bucket.
- Never delete source/PROD assets as part of a SIT/UAT rollback.

## 17. Current Known Follow-Ups

- [ ] Keep the effective PROD Prisma database as `railway`, or approve a database migration separately. Correct/remove the inconsistent `POSTGRES_DATABASE=assetmanagement_prod` metadata.
- [ ] Confirm the PROD database target from `_DATABASE_URL` and deployed Cloud Run metadata before every PROD release.
- [ ] Fix the current PROD PhonePe mismatch: `PHONEPE_ENVIRONMENT=PRODUCTION` is paired with `api-preprod.phonepe.com`.
- [ ] Populate or explicitly remove the 14 PROD substitutions referenced by `cloudbuildprod.yaml` but missing from the `nivaana-production` trigger.
- [ ] Add `_RESET_PASSWORD_URL` to the PROD build YAML and trigger mapping.
- [ ] Align PROD trigger branch regex with the actual PROD branch capitalization.
- [ ] Decide whether PROD file upload should continue using repository `.env.prod` or be converted to trigger-substitution generation; do not maintain both as assumed sources of truth.
- [ ] Add/confirm `RETURN_REPLACEMENT_BUCKET` for the PROD file-upload environment before enabling PROD return/replacement attachments.
- [ ] Keep the backend `cloudbuilduat.yaml` and `.env.uat` present on the `UAT` branch when promoting future changes.
- [ ] Keep Inventory and E-commerce UAT Firebase targets/configuration when merging forward from non-UAT branches.
- [ ] Consider migrating repository-stored sensitive values to Secret Manager. This is a security improvement and should be planned separately from routine releases.
- [ ] Keep inventory-user deletion parked until a dedicated migration and approval are prepared.
- [ ] Fix the DEV-NEW nullable `gst_rate` TypeScript build error before promotion to SIT.
- [ ] Remove/replace active filesystem debug writers before deleting their generated files.
- [ ] Restore or replace `.env.amazon.local.example` with a sanitized template.

## 18. Deployment Record Template

Copy this section for every release:

```text
Environment:
Date/time:
Operator:
Approved commit(s):
Database backup/reference:
Database migration(s):
File-upload build ID/revision:
Backend build ID/revision:
Inventory Firebase release:
E-commerce Firebase release:
PhonePe environment verified:
Database target verified:
Bucket isolation verified:
Smoke-test result:
Known issues:
Rollback reference:
Approver/sign-off:
```
