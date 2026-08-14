# Amazon Listing Creation From Nivaana Backend Plan

## Purpose

This document defines the backend-first plan for creating Amazon listings from products that are created normally inside Nivaana.

The goal is not to make product creation clumsy. A Nivaana product should continue to be created in the normal product workflow. Amazon publishing should be a separate, guided, auditable workflow that starts after the Nivaana product exists.

Frontend design should happen after the backend contracts, validations, state model, and safety rules are implemented.

## Simple Answer

Yes, Nivaana can support creating Amazon listings from the inventory portal, but it should be implemented carefully.

Amazon listing creation is not just a normal product API call. It depends on:

- Whether the product already exists in Amazon's catalog as an ASIN.
- Amazon product type requirements.
- Required category-specific fields.
- Listing restrictions and approval requirements.
- Offer details such as price, quantity, condition, and fulfillment channel.
- Validation errors returned by Amazon.
- Asynchronous Amazon processing after submission.

Therefore, the correct Nivaana flow should be:

1. Create product in Nivaana as usual.
2. Start Amazon listing workflow from that product.
3. Search or match the product in Amazon catalog.
4. Decide whether this is an offer-only listing or a full new catalog listing.
5. Validate required Amazon fields.
6. Preview Amazon validation issues.
7. Publish only after explicit user confirmation.
8. Track Amazon submission status.
9. Store the Amazon listing and mapping in Nivaana.
10. Enable stock sync only after the listing is accepted and mapped.

## Current Backend Status

The current backend already has useful Amazon foundations, but it does not yet implement Amazon listing creation from a Nivaana product.

### Already Implemented Or Partially Implemented

| Area | Current Status |
| --- | --- |
| Production listing import | Existing backend imports Amazon production listings into Nivaana in read-oriented mode. |
| Listing mapping | Existing backend supports mapping imported Amazon listings to Nivaana products. |
| Mapping audit | Existing backend stores mapping/remap/unmap history. |
| Seller-fulfilled stock sync | Existing backend supports preview and publish flow for mapped eligible listings. |
| Offer update | Existing backend supports preview/apply for price, quantity, availability, and handling time on existing listings. |
| Production write guard | Existing backend has kill-switch style production write protection. |
| Sandbox inventory | Existing backend has sandbox inventory tooling for virtual inventory-style tests. |
| Orders and fulfillment | Existing backend has order import and fulfillment routing foundations. |

### Not Yet Implemented

| Missing Area | Why It Is Needed |
| --- | --- |
| Amazon catalog search | Needed to check whether the Nivaana product already exists as an ASIN. |
| Product Type Definitions integration | Needed to know Amazon-required fields for the selected marketplace/product type. |
| Listings Restrictions integration | Needed to know if seller can list the item or needs approval. |
| Amazon listing draft table | Needed to save publish progress, errors, and user decisions before touching Amazon. |
| Offer-only listing creation | Needed to create a seller SKU against an existing ASIN. |
| Full catalog listing creation | Needed when the product does not already exist on Amazon. |
| Validation-preview workflow | Needed before production writes. |
| Image/media submission workflow | Needed for full product listings. |
| Listing creation status tracker | Needed because Amazon can accept a submission but later surface issues. |
| Publish audit records | Needed for traceability and rollback decisions. |

## Important Amazon Concepts

### Nivaana Product

This is the internal product record owned by Nivaana. It has fields such as product name, PUC, category, stock, price, descriptions, dimensions, weight, brand, pack, and net quantity.

### Amazon Listing

This is the seller's SKU/offer on Amazon for a marketplace. It can point to an existing ASIN or create/update product facts when allowed.

### ASIN

Amazon's product identity. If the product already exists in Amazon's catalog, Nivaana should usually create an offer against that ASIN instead of trying to create duplicate product content.

### Seller SKU

The seller's listing key. This should be generated and stored by Nivaana. It does not need to equal Nivaana PUC, but the mapping must be explicit and permanent.

### Product Type

Amazon's category/schema identity. Required attributes vary by product type and marketplace.

### Offer-Only Listing

A listing where the ASIN already exists and Nivaana only submits seller-specific sales terms: SKU, price, quantity, condition, fulfillment availability, handling time, etc.

### Full Catalog Product Listing

A listing where Nivaana submits product facts such as title, brand, bullets, images, category attributes, dimensions, compliance data, and offer fields. This is harder and should be implemented after offer-only listing creation.

## Recommended Backend Phases

## Phase 1: Backend Readiness And Data Model

Goal: Prepare durable backend structures before adding Amazon create actions.

### Actions

| Action Title | Description |
| --- | --- |
| Define Amazon Publish Draft | Add a draft record that links one Nivaana product to one intended Amazon publish workflow. |
| Store Publish Intent | Track whether the user wants to map existing listing, create offer-only listing, or create full catalog listing. |
| Store Amazon Candidate ASINs | Save catalog search candidates selected or reviewed by the user. |
| Store Product Type | Save selected Amazon product type and marketplace-specific schema version/checksum. |
| Store Required Field Completion | Track which Amazon-required fields are complete, missing, invalid, or not applicable. |
| Store Validation Results | Persist Amazon validation-preview issues. |
| Store Submission Status | Track draft, validation_failed, ready_to_publish, submitted, accepted, invalid, live, suppressed, failed. |
| Store Audit Events | Record every validation, publish attempt, approval, rejection, and status refresh. |

### Suggested Tables

| Table | Purpose |
| --- | --- |
| `amazon_listing_publish_drafts` | One draft per product/listing publish attempt. |
| `amazon_listing_publish_candidates` | ASIN/catalog candidates returned by Amazon search. |
| `amazon_listing_publish_attributes` | Amazon-specific attributes collected for the selected product type. |
| `amazon_listing_publish_validations` | Validation preview results and Amazon issues. |
| `amazon_listing_publish_submissions` | Actual publish attempts, submission IDs, status, and issues. |
| `amazon_listing_publish_audits` | Human-readable audit trail for every action. |

### Important Fields For Draft

| Field | Purpose |
| --- | --- |
| `productId` | Nivaana product being listed. |
| `marketplace` | Should be `AMAZON`. |
| `environment` | `SANDBOX`, `PRODUCTION`, or internal test mode. |
| `sellerId` | Amazon seller account. |
| `marketplaceId` | Amazon marketplace. |
| `listingMode` | `MAP_EXISTING`, `OFFER_ONLY`, or `FULL_CATALOG`. |
| `sellerSku` | Proposed or confirmed Amazon seller SKU. |
| `asin` | Selected existing ASIN if applicable. |
| `productType` | Amazon product type selected for validation/publish. |
| `fulfilmentChannel` | MFN, Easy Ship, FBA, or unknown. |
| `status` | Draft lifecycle status. |
| `lastValidationStatus` | Latest Amazon validation result. |
| `lastSubmissionStatus` | Latest Amazon publish result. |
| `createdByUserId` | User who started the draft. |
| `approvedByUserId` | User who approved production publish. |

## Phase 2: Product-To-Amazon Readiness Mapper

Goal: Convert a Nivaana product into an Amazon-ready draft without publishing.

### Actions

| Action Title | Description |
| --- | --- |
| Build Product Readiness Snapshot | Read Nivaana product details, stock, dimensions, weight, brand, pack, and images. |
| Generate Suggested Seller SKU | Suggest a unique Amazon seller SKU based on PUC/brand/product/pack. |
| Check Required Nivaana Fields | Validate that Nivaana product has the minimum fields needed before Amazon validation. |
| Detect Missing Commercial Fields | Identify missing price, stock, tax/category, condition, and handling time. |
| Detect Missing Content Fields | Identify missing title, bullets, description, images, dimensions, weight, or compliance fields. |
| Create Draft Without Amazon Write | Save the draft and allow user review before any external API write. |

### Backend Rules

- Do not automatically publish to Amazon when a Nivaana product is created.
- Do not assume Nivaana PUC is the Amazon seller SKU.
- Seller SKU must be unique per seller and marketplace.
- Product drafts should be resumable.
- Product drafts should be cancellable.
- Draft creation must not modify Amazon.

## Phase 3: Amazon Catalog Match And ASIN Selection

Goal: Prevent duplicate Amazon catalog creation when the product already exists.

### Actions

| Action Title | Description |
| --- | --- |
| Search Amazon Catalog | Search by GTIN/barcode if available, otherwise title, brand, and keywords. |
| Show ASIN Candidates | Store candidate ASINs with title, brand, image, product type, and confidence score. |
| Select Existing ASIN | User confirms that one Amazon catalog item is the same product. |
| Mark No Match Found | User confirms that no candidate is the correct product. |
| Save Match Decision | Persist selected ASIN or no-match decision with audit history. |

### Backend Rules

- If an exact ASIN/catalog match exists, prefer offer-only listing creation.
- If multiple candidates exist, force manual review.
- If no candidate is selected, continue only after user confirms full catalog creation.
- Catalog search results must be treated as suggestions, not final truth.

## Phase 4: Listing Restrictions And Eligibility

Goal: Confirm the seller is allowed to list the product before collecting too many fields.

### Actions

| Action Title | Description |
| --- | --- |
| Check ASIN Restrictions | For offer-only listing, check restrictions for the selected ASIN and condition. |
| Check Brand/Product Type Restrictions | For full catalog listing, check restrictions by brand and product type where supported. |
| Store Restriction Result | Save restriction status and any approval links or next steps. |
| Block Restricted Publish | Do not allow publish if Amazon reports listing is restricted. |
| Allow Recheck | Let backend refresh restrictions after seller obtains approval. |

### Backend Rules

- Restricted products must be blocked before production publish.
- The API response should explain the restriction in user-friendly terms.
- Approval-required status should be a normal workflow state, not a backend failure.

## Phase 5: Product Type Definitions And Attribute Schema

Goal: Use Amazon's own schema to decide required fields.

### Actions

| Action Title | Description |
| --- | --- |
| Search Product Types | Retrieve likely Amazon product type recommendations. |
| Select Product Type | Save chosen product type for the draft. |
| Fetch Product Type Definition | Retrieve JSON schema for `LISTING`, `LISTING_PRODUCT_ONLY`, or `LISTING_OFFER_ONLY`. |
| Cache Schema | Store schema version/checksum to avoid repeated calls and improve auditability. |
| Map Nivaana Fields | Map product name, brand, dimensions, weight, images, price, stock, and category fields to Amazon attributes. |
| Identify Required Fields | Return a backend-generated checklist of missing or invalid fields. |

### Backend Rules

- Do not hardcode one product schema for all products.
- Required fields can vary by Amazon marketplace and product type.
- Schema versions/checksums should be tracked because Amazon requirements can change.
- Backend should own validation rules; frontend should only display them.

## Phase 6: Offer-Only Listing Creation

Goal: Implement the safest first version of Amazon listing creation.

Offer-only means the product already exists in Amazon's catalog as an ASIN. Nivaana creates the seller's listing/offer against that ASIN.

### Actions

| Action Title | Description |
| --- | --- |
| Prepare Offer Payload | Build Amazon payload with ASIN/product identifier, seller SKU, price, condition, quantity, and fulfillment availability. |
| Validate Offer Payload | Run local schema validation and Amazon validation preview. |
| Preview Amazon Issues | Store and return Amazon validation issues before publishing. |
| Confirm Publish | Require explicit user confirmation before production write. |
| Submit Offer Listing | Call Amazon listing create/full update operation for the SKU. |
| Import Created Listing | Refresh listing from Amazon after submission. |
| Auto-Map Listing | Create/update `marketplace_listings.productId` mapping after Amazon accepts. |
| Enable Stock Workflow | Keep inventory sync disabled by default until user enables it. |

### Recommended First Production Scope

- Existing ASIN only.
- One product at a time.
- Seller-fulfilled/MFN quantity only.
- India marketplace first if that is the current account scope.
- No bulk creation.
- No automatic publish.
- No full product content creation.
- No FBA inbound workflow in this phase.

### Why Offer-Only First

Offer-only listing creation is safer because Amazon already owns the catalog product facts. Nivaana only needs to provide seller-specific offer details.

This reduces risk around:

- Wrong category.
- Wrong product type.
- Missing compliance attributes.
- Duplicate ASIN creation.
- Image/content moderation issues.
- Search suppression caused by incomplete catalog data.

## Phase 7: Full Catalog Product Listing Creation

Goal: Support creating Amazon catalog listings when the product does not already exist.

This should happen only after offer-only listing creation is stable.

### Actions

| Action Title | Description |
| --- | --- |
| Collect Product Facts | Collect Amazon-required title, brand, bullets, description, dimensions, weight, material, fragrance, quantity, and usage data. |
| Collect Media | Attach product images and validate image requirements. |
| Collect Compliance Fields | Capture safety, legal, ingredient, manufacturer, origin, or category-specific fields where required. |
| Validate Against Schema | Use Product Type Definitions schema before Amazon validation preview. |
| Preview Amazon Validation | Show Amazon issues before publishing. |
| Submit Full Listing | Create the listing with product facts and offer details. |
| Track Async Status | Poll or receive notifications until listing becomes live, invalid, suppressed, or needs action. |
| Save Amazon Mapping | Store ASIN, SKU, product type, mapping, and status when available. |

### Backend Rules

- Full catalog creation must be behind a separate feature flag.
- Required product facts must be collected in a draft before publish.
- Amazon validation errors must be field-level where possible.
- Do not allow bulk full catalog creation in the first release.
- Suppressed or invalid listings must appear in an exception queue.

## Phase 8: Stock Sync After Listing Creation

Goal: Sync stock only after Amazon listing creation is accepted and mapped.

### Actions

| Action Title | Description |
| --- | --- |
| Confirm Listing Is Accepted | Check Amazon listing status after submission. |
| Store Marketplace Mapping | Save `sellerSku`, `asin`, `productType`, `productId`, marketplace, and seller. |
| Preview Initial Stock Sync | Show Amazon current quantity, Nivaana available quantity, and proposed target quantity. |
| Enable Manual Sync | User explicitly enables manual sync for the new listing. |
| Publish Initial Stock | Push seller-fulfilled stock only after preview confirmation. |
| Enable Auto Sync Later | Automatic sync is allowed only after manual sync works safely. |

### Rules By Fulfillment Type

| Fulfillment Type | Stock Handling |
| --- | --- |
| MFN / Self Ship | Nivaana can publish seller-fulfilled quantity after preview and confirmation. |
| Easy Ship | Treat as seller-fulfilled where Amazon allows quantity publishing, but shipping workflow must follow Easy Ship rules. |
| FBA | Do not publish stock through normal listing quantity sync. FBA inventory is managed by Amazon fulfillment/inbound flows. |

## Phase 9: Testing Strategy

Goal: Test safely without assuming Amazon has a complete fake production marketplace.

### Amazon Sandbox Reality

Amazon SP-API has sandbox endpoints, but sandbox support differs by API.

| Area | Sandbox Type | What It Means |
| --- | --- | --- |
| Listings Items API | Static sandbox | Useful for request shape, auth, and mocked responses; not a full stateful fake Amazon catalog. |
| Listings Restrictions API | Static sandbox | Useful for mocked restriction response handling. |
| FBA Inventory API | Dynamic sandbox | Can create virtual inventory items and change virtual quantities without production impact. |
| Orders/Fulfillment APIs | Varies by API | Some APIs have dynamic sandbox behavior, others are static or limited. |

### What We Can Test In Amazon Sandbox

- Authentication and endpoint wiring.
- Request body shape.
- Static success responses.
- Static validation/error handling.
- FBA virtual inventory creation and quantity movement where dynamic sandbox supports it.

### What We Cannot Fully Prove In Listings Static Sandbox

- A real new Amazon listing becoming live.
- Real category/product-type validation for Nivaana's exact products.
- Real ASIN assignment.
- Real search suppression behavior.
- Real browse-node/category behavior.
- Full post-submission moderation outcomes.

### Required Test Layers

| Test Layer | Purpose |
| --- | --- |
| Unit tests | Validate payload builders, SKU generation, mapping rules, and state transitions. |
| Contract tests | Validate backend request/response schemas for frontend use. |
| Mock Amazon integration tests | Simulate accepted, invalid, restricted, throttled, duplicate SKU, suppressed, and retry scenarios. |
| Amazon static sandbox tests | Confirm Listings Items request shape and static response parsing. |
| Amazon dynamic FBA sandbox tests | Test virtual FBA inventory behavior separately from MFN listing creation. |
| Production pilot tests | Publish one or two low-risk SKUs with validation preview and explicit approval. |

### Production Pilot Rule

Because Listings Items sandbox is static, final confidence for listing creation must come from a carefully controlled production pilot.

Pilot requirements:

- Production writes disabled by default.
- Dedicated feature flag for listing creation.
- One product at a time.
- Validation preview required.
- Senior/admin confirmation required.
- Immediate post-submit import/refresh.
- Exception queue for any Amazon issues.
- Full audit trail.
- Easy rollback/disable action where Amazon supports it.

## Recommended Backend APIs

These APIs are proposed after the backend model is added. Names can be adjusted to match existing route conventions.

### Draft And Readiness

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/channels/amazon/products/:productId/publish-drafts` | Create an Amazon publish draft from a Nivaana product. |
| `GET` | `/api/channels/amazon/publish-drafts/:draftId` | Get draft details, status, missing fields, candidates, validations, and audit timeline. |
| `DELETE` | `/api/channels/amazon/publish-drafts/:draftId` | Cancel a draft before publish. |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/readiness` | Recalculate Nivaana-to-Amazon readiness. |

### Catalog And Restrictions

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/catalog-search` | Search Amazon catalog candidates for this product. |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/select-asin` | Select an existing Amazon ASIN for offer-only listing. |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/no-catalog-match` | Confirm that no existing ASIN is suitable. |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/restrictions/check` | Check listing restrictions and approval requirements. |

### Product Type And Attributes

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/product-types/search` | Get product type recommendations. |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/product-types/select` | Select Amazon product type. |
| `GET` | `/api/channels/amazon/publish-drafts/:draftId/required-fields` | Return required Amazon fields and current completion status. |
| `PATCH` | `/api/channels/amazon/publish-drafts/:draftId/attributes` | Save Amazon-specific draft attributes. |

### Validation And Publish

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/validate` | Run local and Amazon validation preview without publishing. |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/publish` | Submit the listing after explicit confirmation. |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/refresh-status` | Refresh Amazon listing status after submission. |
| `POST` | `/api/channels/amazon/publish-drafts/:draftId/import-created-listing` | Import the created listing and create/update mapping. |

## Backend Service Modules

| Service | Responsibility |
| --- | --- |
| `amazon-listing-publish-draft.service.ts` | Create, read, cancel, and update publish drafts. |
| `amazon-product-readiness.service.ts` | Convert Nivaana product fields into Amazon readiness checklist. |
| `amazon-catalog-search.client.ts` | Call Amazon Catalog Items API. |
| `amazon-listing-restrictions.client.ts` | Call Amazon Listings Restrictions API. |
| `amazon-product-type-definition.client.ts` | Fetch product type schemas and recommendations. |
| `amazon-listing-payload-builder.service.ts` | Build offer-only and full catalog payloads. |
| `amazon-listing-validation.service.ts` | Run local schema checks and Amazon validation preview. |
| `amazon-listing-publish.service.ts` | Execute guarded production publish. |
| `amazon-listing-publish-status.service.ts` | Refresh submitted listing status and issues. |
| `amazon-listing-publish-audit.service.ts` | Record audit history for every draft and publish action. |

## State Machine

### Draft Statuses

| Status | Meaning |
| --- | --- |
| `DRAFT` | Draft created but not ready. |
| `READINESS_FAILED` | Nivaana product is missing required local data. |
| `CATALOG_REVIEW_REQUIRED` | Amazon catalog candidates need user review. |
| `ASIN_SELECTED` | User selected an existing ASIN. |
| `NO_ASIN_MATCH` | User confirmed full catalog listing is needed. |
| `RESTRICTED` | Amazon says listing is restricted or approval is required. |
| `ATTRIBUTES_REQUIRED` | Amazon-required fields are missing. |
| `VALIDATION_FAILED` | Local or Amazon validation failed. |
| `READY_TO_PUBLISH` | Draft passed validation and can be submitted. |
| `SUBMITTED` | Backend submitted to Amazon. |
| `ACCEPTED` | Amazon accepted the submission for processing. |
| `INVALID` | Amazon rejected the submission. |
| `LIVE` | Listing appears active/live after refresh. |
| `SUPPRESSED` | Listing exists but has Amazon issues. |
| `FAILED` | Technical failure occurred. |
| `CANCELLED` | User cancelled the draft. |

### Required Transitions

- `DRAFT` -> `CATALOG_REVIEW_REQUIRED`
- `CATALOG_REVIEW_REQUIRED` -> `ASIN_SELECTED`
- `CATALOG_REVIEW_REQUIRED` -> `NO_ASIN_MATCH`
- `ASIN_SELECTED` -> `READY_TO_PUBLISH` only after restrictions and validation pass.
- `NO_ASIN_MATCH` -> `ATTRIBUTES_REQUIRED` until full catalog fields are complete.
- `READY_TO_PUBLISH` -> `SUBMITTED` only after explicit confirmation.
- `SUBMITTED` -> `ACCEPTED`, `INVALID`, or `FAILED`.
- `ACCEPTED` -> `LIVE` or `SUPPRESSED` after status refresh/import.

## Production Safeguards

Amazon listing creation is a production write. It should follow stricter safeguards than read-only import or mapping.

Required safeguards:

- Global production write flag.
- Separate listing creation feature flag.
- Separate full catalog creation feature flag.
- Per-user permission for Amazon listing publish.
- Explicit confirmation payload with `confirmed: true`.
- Validation preview required before publish.
- Preview expiration window.
- Source product version check to prevent stale publish.
- Idempotency/request key for publish attempts.
- Audit record for every action.
- No automatic publish on normal product save.
- No bulk publish in first release.
- Clear error handling for Amazon throttling and validation issues.
- Retry only for technical/retryable errors, not validation errors.

## Permissions

Recommended future permissions:

| Permission | Purpose |
| --- | --- |
| `amazon.products.readiness` | View Amazon readiness for Nivaana products. |
| `amazon.products.draft` | Create and edit Amazon publish drafts. |
| `amazon.catalog.search` | Search Amazon catalog from a draft. |
| `amazon.products.validate` | Run validation preview. |
| `amazon.products.publish_offer` | Publish offer-only listings. |
| `amazon.products.publish_full_catalog` | Publish full catalog listings. |
| `amazon.products.status` | Refresh and view publish status. |
| `amazon.products.cancel` | Cancel drafts. |
| `amazon.products.audit` | View publish audit trail. |

Phase 1 can temporarily map these to existing channel edit/admin permissions, but production publish should eventually have dedicated permissions.

## Error Handling Model

Backend should return structured, user-friendly errors.

| Error Code | Meaning |
| --- | --- |
| `AMAZON_PUBLISH_DRAFT_NOT_FOUND` | Draft does not exist or is outside user scope. |
| `AMAZON_PRODUCT_NOT_READY` | Nivaana product is missing required local data. |
| `AMAZON_SELLER_SKU_DUPLICATE` | Seller SKU is already used for this seller/marketplace. |
| `AMAZON_ASIN_SELECTION_REQUIRED` | User must choose ASIN or confirm no match. |
| `AMAZON_LISTING_RESTRICTED` | Amazon requires approval or blocks listing. |
| `AMAZON_PRODUCT_TYPE_REQUIRED` | Product type has not been selected. |
| `AMAZON_REQUIRED_FIELDS_MISSING` | Required Amazon attributes are incomplete. |
| `AMAZON_VALIDATION_FAILED` | Amazon validation preview returned blocking issues. |
| `AMAZON_PRODUCTION_WRITES_DISABLED` | Global write guard blocked publish. |
| `AMAZON_LISTING_CREATION_DISABLED` | Feature flag blocked listing creation. |
| `AMAZON_PREVIEW_EXPIRED` | User must validate again before publishing. |
| `AMAZON_PRODUCT_CHANGED_AFTER_PREVIEW` | Nivaana product changed after validation. |
| `AMAZON_PUBLISH_FAILED` | Technical Amazon submission failure. |

## Audit Events

Required audit operations:

- `PUBLISH_DRAFT_CREATED`
- `PUBLISH_DRAFT_UPDATED`
- `CATALOG_SEARCH_PERFORMED`
- `ASIN_SELECTED`
- `NO_ASIN_MATCH_CONFIRMED`
- `RESTRICTIONS_CHECKED`
- `PRODUCT_TYPE_SELECTED`
- `ATTRIBUTES_UPDATED`
- `VALIDATION_PREVIEWED`
- `VALIDATION_FAILED`
- `READY_TO_PUBLISH`
- `PUBLISH_SUBMITTED`
- `PUBLISH_ACCEPTED`
- `PUBLISH_INVALID`
- `PUBLISH_FAILED`
- `PUBLISH_STATUS_REFRESHED`
- `CREATED_LISTING_IMPORTED`
- `CREATED_LISTING_MAPPED`
- `PUBLISH_DRAFT_CANCELLED`

Every audit event should include:

- Draft ID.
- Product ID.
- Seller ID.
- Marketplace ID.
- Seller SKU.
- ASIN when available.
- Operation.
- Before/after values where applicable.
- User ID and user type.
- Timestamp.
- Amazon request/submission ID where available.

## Product Field Mapping Checklist

The exact fields depend on Amazon product type, but Nivaana should prepare these common fields.

### Core Identity

- Product name.
- Brand.
- PUC.
- Proposed Amazon seller SKU.
- Product category and subcategory.
- Amazon marketplace.
- Amazon product type.

### Commercial Fields

- Price.
- Currency.
- Quantity.
- Units per listing.
- Condition.
- Handling time.
- Fulfillment channel.

### Content Fields

- Amazon title.
- Bullet points.
- Product description.
- Search terms.
- Images.
- Variation/pack information.

### Physical Fields

- Length.
- Width.
- Height.
- Weight.
- Net quantity.
- Number of items.
- Pack size.

### Compliance Fields

These are product-type specific and must be driven by Amazon schema:

- Manufacturer.
- Country of origin.
- Material.
- Ingredients.
- Safety warnings.
- Legal disclaimers.
- Batteries/hazardous material fields where applicable.
- Category-specific regulatory attributes.

## UX Guidance For Later Frontend Design

Frontend should be designed only after backend APIs are ready, but backend should support this future UX.

Recommended future flow:

1. User creates product normally in Nivaana.
2. Product detail page shows Amazon status.
3. If not listed, user sees `Create Amazon Listing`.
4. Wizard starts with listing type:
   - Map to existing imported listing.
   - Create offer for existing ASIN.
   - Create new Amazon catalog listing.
5. User reviews Amazon catalog candidates.
6. User fills missing Amazon-required fields.
7. User runs validation preview.
8. User sees field-level errors.
9. User confirms publish.
10. User tracks listing status.
11. User enables stock sync after listing is accepted and mapped.

Important UX rules:

- Do not publish to Amazon during normal product save.
- Do not show a publish button when required fields are missing.
- Do not hide Amazon validation errors in generic toast messages.
- Do not mix listing creation with stock sync.
- Do not offer FBA stock sync as normal quantity publishing.
- Always show whether the action affects production Amazon.

## Recommended Implementation Order

1. Add publish draft data model and audit model.
2. Add backend readiness snapshot from Nivaana product.
3. Add seller SKU generation and duplicate checks.
4. Add Catalog Items search client and candidate storage.
5. Add Listings Restrictions client and result storage.
6. Add Product Type Definitions client and schema cache.
7. Add draft attribute storage and required-field checklist.
8. Add offer-only validation preview.
9. Add offer-only publish endpoint behind feature flag.
10. Add created listing import and auto-mapping.
11. Add stock sync handoff after accepted mapping.
12. Add full catalog listing draft support.
13. Add full catalog validation preview.
14. Add full catalog publish behind stricter feature flag.
15. Add notifications/polling for listing status and issues.

## What Should Not Be Implemented First

- Bulk product publishing.
- Automatic publish when product is created.
- Full catalog creation before offer-only creation.
- Direct FBA stock publishing through normal quantity sync.
- Frontend-first wizard without backend validation.
- Hardcoded one-size-fits-all Amazon product schema.
- Title-only ASIN matching without user review.
- Production publish without validation preview.

## Open Decisions

Before implementation, confirm:

1. Which Amazon marketplace should be first: India only or multi-marketplace from the beginning?
2. Should Nivaana PUC be used as the default seller SKU prefix, or should Amazon SKUs follow a separate naming convention?
3. Which product families should be first: incense sticks, room mists, diffuser oils, sachets, decor, or bottles?
4. Does the seller have valid GTIN/barcode data, GTIN exemption, or brand approval for all products?
5. Which fields are mandatory for Nivaana product creation before Amazon readiness can even start?
6. Should full catalog creation be allowed only to admin users?
7. Should listing publish use Listings Items API one-by-one first, then JSON Listings Feed later for bulk?

## Official Amazon References

- Listings Items API: https://developer-docs.amazon.com/sp-api/docs/listings-items-api
- Manage Product Listings with SP-API: https://developer-docs.amazon.com/sp-api/docs/manage-product-listings-guide
- Building Listings Management Workflows Guide: https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide
- Product Type Definitions API: https://developer-docs.amazon.com/sp-api/docs/product-type-definitions-api
- Listings Restrictions API: https://developer-docs.amazon.com/sp-api/docs/listings-restrictions-api
- Understanding listing status and seller-fulfilled inventory: https://developer-docs.amazon.com/sp-api/docs/understanding-amazon-listing-status-and-seller-fulfilled-inventory-management
- SP-API Sandbox: https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox
- FBA Inventory Dynamic Sandbox Guide: https://developer-docs.amazon.com/sp-api/docs/fba-inventory-api-v1-dynamic-sandbox-guide
