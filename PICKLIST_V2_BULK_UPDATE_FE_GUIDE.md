# Picklist v2 Bulk Update - Frontend Guide

## Overview

The bulk update endpoint allows you to update multiple picklist items in a single API call. This is perfect for:
- Reordering items (drag-and-drop)
- Updating fieldnames
- Changing parent dependencies
- Updating labels and values
- Complete reorganization of picklist structure

## Endpoint

```
PUT /v2/picklists/bulk
```

## Request Format

Send an array of picklist update objects. Each object must include an `id` and any fields you want to update.

### Request Body Structure

```typescript
interface BulkUpdateItem {
  id: number | string;        // Required - Picklist ID
  fieldname?: string | null;  // Optional - Update fieldname
  parent?: string | null;     // Optional - Update parent dependency
  sortorder?: number | null;  // Optional - Update sort order
  label?: string | null;      // Optional - Update display label
  value?: string | null;      // Optional - Update stored value
}
```

### Example Request

```json
[
  {
    "id": 30,
    "label": "Home Fragrance",
    "value": "home_fragrance",
    "fieldname": "category",
    "parent": null,
    "sortorder": 1
  },
  {
    "id": 31,
    "label": "Wellness & Aromatherapy",
    "value": "wellness_aromatherapy",
    "fieldname": "category",
    "parent": null,
    "sortorder": 2
  },
  {
    "id": 33,
    "label": "Incense Sticks",
    "value": "incense_sticks",
    "fieldname": "subcategory",
    "parent": "home_fragrance",
    "sortorder": 1
  }
]
```

## Response Format

### Success Response (200)

All updates succeeded:

```json
{
  "success": true,
  "data": [
    {
      "id": 30,
      "success": true,
      "data": {
        "id": 30,
        "label": "Home Fragrance",
        "value": "home_fragrance",
        "fieldname": "category",
        "parent": null,
        "sortorder": 1,
        // ... other fields
      }
    },
    {
      "id": 31,
      "success": true,
      "data": {
        // ... updated picklist object
      }
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  },
  "message": "Successfully updated 2 picklist(s)"
}
```

### Partial Success Response (207)

Some updates succeeded, some failed:

```json
{
  "success": true,
  "data": [
    {
      "id": 30,
      "success": true,
      "data": { /* updated picklist */ }
    },
    {
      "id": 999,
      "success": false,
      "error": "Picklist not found or update failed"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 1,
    "failed": 1
  },
  "message": "Updated 1 of 2 picklist(s)"
}
```

### Error Response (400)

Invalid request:

```json
{
  "success": false,
  "message": "Request body must be a non-empty array of picklist updates",
  "details": "Error details",
  "statusCode": 400
}
```

## Use Cases

### 1. Reorder Items (Drag & Drop)

When user drags items to reorder, send updated `sortorder` values:

```javascript
// After drag-and-drop reordering
const updates = [
  { id: 30, sortorder: 1 },
  { id: 31, sortorder: 2 },
  { id: 32, sortorder: 3 },
  { id: 33, sortorder: 4 }
];

await fetch('/v2/picklists/bulk', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(updates)
});
```

### 2. Update Parent Dependencies

When moving items to different parent groups:

```javascript
const updates = [
  { id: 33, parent: "home_fragrance" },
  { id: 34, parent: "home_fragrance" },
  { id: 35, parent: null }  // Remove parent
];
```

### 3. Change Fieldname

When reorganizing items into different fieldname groups:

```javascript
const updates = [
  { id: 30, fieldname: "category" },
  { id: 31, fieldname: "category" }
];
```

### 4. Update Labels/Values

When editing labels or values:

```javascript
const updates = [
  { id: 30, label: "New Label", value: "new_value" },
  { id: 31, label: "Another Label", value: "another_value" }
];
```

### 5. Complete Reorganization

Update everything at once:

```javascript
const updates = [
  {
    id: 33,
    label: "Incense Sticks",
    value: "incense_sticks",
    fieldname: "subcategory",
    parent: "home_fragrance",
    sortorder: 1
  },
  {
    id: 34,
    label: "Dhoop Sticks",
    value: "dhoop_sticks",
    fieldname: "subcategory",
    parent: "home_fragrance",
    sortorder: 2
  }
];
```

## Frontend Implementation Examples

### React/TypeScript Example

```typescript
interface PicklistUpdate {
  id: number | string;
  fieldname?: string | null;
  parent?: string | null;
  sortorder?: number | null;
  label?: string | null;
  value?: string | null;
}

async function bulkUpdatePicklists(updates: PicklistUpdate[]) {
  try {
    const response = await fetch('/v2/picklists/bulk', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const result = await response.json();

    if (response.ok) {
      // Check if all succeeded
      if (result.summary.failed === 0) {
        console.log('All updates successful!');
        return result;
      } else {
        console.warn('Some updates failed:', result);
        // Handle partial success
        return result;
      }
    } else {
      throw new Error(result.message || 'Update failed');
    }
  } catch (error) {
    console.error('Bulk update error:', error);
    throw error;
  }
}

// Usage: Reorder items
function handleReorder(items: any[]) {
  const updates = items.map((item, index) => ({
    id: item.id,
    sortorder: index + 1
  }));
  
  bulkUpdatePicklists(updates);
}

// Usage: Update parent
function handleParentChange(itemIds: number[], newParent: string | null) {
  const updates = itemIds.map(id => ({
    id,
    parent: newParent
  }));
  
  bulkUpdatePicklists(updates);
}
```

### Drag & Drop Reorder Example

```typescript
function handleDragEnd(result: any, items: any[]) {
  if (!result.destination) return;

  const reorderedItems = Array.from(items);
  const [reorderedItem] = reorderedItems.splice(result.source.index, 1);
  reorderedItems.splice(result.destination.index, 0, reorderedItem);

  // Update sortorder for all affected items
  const updates = reorderedItems.map((item, index) => ({
    id: item.id,
    sortorder: index + 1
  }));

  bulkUpdatePicklists(updates);
}
```

### Batch Edit Example

```typescript
function handleBatchEdit(
  selectedIds: number[],
  updates: Partial<PicklistUpdate>
) {
  const bulkUpdates = selectedIds.map(id => ({
    id,
    ...updates  // Spread any fields to update
  }));

  bulkUpdatePicklists(bulkUpdates);
}

// Usage: Batch update parent
handleBatchEdit([33, 34, 35], { parent: 'home_fragrance' });

// Usage: Batch update fieldname
handleBatchEdit([30, 31, 32], { fieldname: 'category' });
```

## Important Notes

### Null Values

- Set `parent: null` to remove a parent dependency
- Set `label: null` or `value: null` to clear those fields
- Set `sortorder: null` to remove sort order

### Partial Updates

- Only include fields you want to update
- Omit fields you don't want to change
- `id` is always required

### Validation

- `label` and `value` have max length of 255 characters
- Empty strings are treated as null
- Each update must have an `id`

### Error Handling

- Check `result.summary.failed` to see if any updates failed
- Check individual `result.data[].success` for each item
- Status code `207` means partial success (some succeeded, some failed)
- Status code `200` means all succeeded

### Best Practices

1. **Batch Updates**: Group related updates together for better performance
2. **Error Handling**: Always check the summary and individual results
3. **Optimistic Updates**: Update UI immediately, rollback on error
4. **Validation**: Validate data before sending to API
5. **Loading States**: Show loading indicator during bulk operations

## Example: Complete Reorder Flow

```typescript
async function reorderPicklistItems(
  fieldname: string,
  items: Array<{ id: number; sortorder: number }>
) {
  // Prepare updates with new sortorder
  const updates = items.map((item, index) => ({
    id: item.id,
    sortorder: index + 1
  }));

  try {
    const result = await bulkUpdatePicklists(updates);
    
    if (result.summary.failed === 0) {
      // Success - refresh data or update local state
      await refreshPicklists(fieldname);
      return { success: true, message: 'Items reordered successfully' };
    } else {
      // Partial failure - show warning
      const failed = result.data.filter(r => !r.success);
      return {
        success: false,
        message: `Failed to update ${failed.length} item(s)`,
        failedItems: failed
      };
    }
  } catch (error) {
    console.error('Reorder failed:', error);
    return { success: false, message: 'Failed to reorder items' };
  }
}
```

## Status Codes

- **200** - All updates succeeded
- **207** - Multi-Status (some succeeded, some failed)
- **400** - Bad Request (invalid data, missing id, etc.)
- **500** - Internal Server Error

## Summary

The bulk update endpoint is perfect for:
- ✅ Drag-and-drop reordering
- ✅ Batch editing multiple items
- ✅ Reorganizing picklist structure
- ✅ Updating parent dependencies
- ✅ Changing fieldnames
- ✅ Editing labels and values

All in a single API call! 🚀

