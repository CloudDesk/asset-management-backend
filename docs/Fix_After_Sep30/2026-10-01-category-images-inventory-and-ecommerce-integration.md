# Category Images — Inventory Admin and Ecom Integration

**Date:** 2026-10-01  
**Status:** ✅ Implemented and Build Verified  
**Repositories:** `asset-management-backend`, `asset_management_frontend_aromazen`, `Nivaana-Ecom-Web`, `vyb-lyf-file-upload`

---

## 1. Objective

Provide one centrally managed image for every product category and subcategory. Inventory users manage these images through the Admin portal, while storefront clients consume the active image URLs returned by the Backend.

This removes the previous Ecom behavior where a subcategory chip used an arbitrary image from the first matching product.

---

## 2. Data and Backend Architecture

### 2.1 Managed Image Record

The `category_images` table has a one-to-one relationship with a category or subcategory `picklist` row through the unique `picklistid` field.

Stored metadata includes:

- Original/mobile image URL and object key.
- Thumbnail URL and object key.
- Storage bucket.
- Alt text.
- Width, height, file size, and MIME type.
- Active/inactive storefront visibility.
- Creation and modification audit fields.

Only product picklists with `fieldname = category` or `fieldname = subcategory` can be managed through this feature.

### 2.2 Backend Endpoints

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/v1/category-images` | List category/subcategory picklists with their managed image metadata. |
| `GET` | `/v1/category-images/:picklistId` | Read one managed image record. |
| `POST` / `PUT` | `/v1/category-images/:picklistId/image` | Upload or replace the image and generated thumbnail. |
| `PATCH` | `/v1/category-images/:picklistId` | Update alt text or storefront visibility. |
| `DELETE` | `/v1/category-images/:picklistId/image` | Delete the database record and stored image objects. |

All mutations use the existing `picklist` permission checks. Upload accepts JPEG, PNG, and WebP images, with the Admin UI enforcing the current 5 MB limit before submission.

### 2.3 File-Upload Service

The Backend forwards category-image uploads to:

```text
${STORAGE_BACKEND_URL}/category-images/upload
```

The request is authenticated with `STORAGE_API_KEY`. Local Backend development may point `STORAGE_BACKEND_URL` either to a locally running File-Upload service or the hosted dev/SIT File-Upload service. When the hosted service is used, uploads affect the hosted dev/SIT storage bucket.

---

## 3. Inventory Admin Experience

Route:

```text
/category-images
```

Implemented behavior:

- Static page heading and Refresh action, matching the Dashboard layout.
- Only filters, records, and pagination scroll below the heading.
- Search by category, subcategory, value, or parent.
- Filter by all, configured, or missing images.
- Thumbnail click opens a full-resolution preview with metadata and alt text.
- Selecting an image opens a review modal before upload or replacement.
- Review includes filename, dimensions, format, and file size.
- Explicit `Add image` and `Replace` actions instead of an upload icon alone.
- The ambiguous eye/eye-slash action was removed.
- Storefront state now uses a labelled `Visible` / `Hidden` switch.
- Hiding a visible image requires confirmation.
- Alt text remains editable inline.
- Delete remains a separate destructive action with confirmation.
- Loading state is isolated to the affected record.

No Backend API changes were required for the final Admin UX improvement.

---

## 4. Ecom Storefront Consumption

The product category-count/tree response now includes the active managed image fields:

```ts
imageUrl?: string | null;
thumbnailUrl?: string | null;
```

Storefront image selection follows this order:

1. Managed `thumbnailUrl`.
2. Managed `imageUrl`.
3. Shared taxonomy fallback image.

Only active image records are returned for storefront use. Hidden images therefore fall back safely instead of appearing in Ecom.

### 4.1 Subcategory Chips

The Ecom subcategory navigation chips now use Admin-managed subcategory images. Chip dimensions, image dimensions, layout, and interaction styling remain unchanged; only the image source was changed.

### 4.2 Fallback Behavior

If a category/subcategory does not have a managed active image, or its URL is unavailable, the same shared fallback image is displayed. The UI no longer selects an unrelated product image as the subcategory fallback.

Nested sub-subcategory images continue using the existing product-derived image because the current Admin feature manages only category and subcategory picklists.

---

## 5. Files Involved

### Backend

- `asset-management-backend/prisma/schema.prisma`
- `asset-management-backend/src/routes/category-image.route.ts`
- `asset-management-backend/src/controllers/category-image.controller.ts`
- `asset-management-backend/src/services/category-image.service.ts`
- `asset-management-backend/src/services/storage.service.ts`
- `asset-management-backend/src/services/product.service.ts`

### Inventory Admin

- `asset_management_frontend_aromazen/src/pages/categoryImages/CategoryImagesPage.tsx`
- `asset_management_frontend_aromazen/src/services/categoryImageService.ts`
- `asset_management_frontend_aromazen/src/types/categoryImage.ts`

### Ecom

- `Nivaana-Ecom-Web/src/assets/config.js`
- `Nivaana-Ecom-Web/src/assets/config.d.ts`
- `Nivaana-Ecom-Web/src/components/categoryNavigationData.ts`
- `Nivaana-Ecom-Web/src/components/CategoryNavigationRail.tsx`
- `Nivaana-Ecom-Web/src/services/productPlatformService.ts`
- `Nivaana-Ecom-Web/src/types/index.ts`
- `Nivaana-Ecom-Web/src/pages/Products.tsx`
- `Nivaana-Ecom-Web/src/pages/ProductDetails.tsx`

---

## 6. Verification

- Inventory Admin TypeScript and production build: passed.
- Category Images page ESLint check: passed.
- Ecom TypeScript and production build: passed.
- Managed subcategory image verified from the category-tree response.
- Missing managed image verified to use the shared fallback.
- Existing chip and image dimensions were preserved.

