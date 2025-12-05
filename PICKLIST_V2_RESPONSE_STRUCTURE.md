# Picklist V2 API Response Structure

## Updated Structure (After controlledfieldname grouping)

When `groupByFieldname=true` and `groupByParent=true`, the response now includes an additional grouping level by `controlledfieldname`.

### Structure:
```
fieldname → controlledfieldname → parent → items[]
```

---

## Example Response Structure

### For `fragnancetype` (Multiple controlledfieldname values)

**Before:** Items with same parent but different `controlledfieldname` were mixed together.

**After:** Items are separated by `controlledfieldname` first, then by `parent`.

```json
{
  "success": true,
  "meta": {
    "grouped": true,
    "groupedByParent": true,
    "groupCount": 13,
    "totalRecords": 69
  },
  "message": "Picklists grouped by fieldname and parent successfully",
  "data": {
    "fragnancetype": {
      "subsubcategory": {
        "incense_sticks": [
          {
            "id": 3,
            "label": "Kasturi",
            "value": "kasturi",
            "object": "product",
            "controlledvalue": "incense_sticks",
            "fieldname": "fragnancetype",
            "controlledlabel": "Incense Sticks",
            "controlledfieldname": "subsubcategory",
            "parent": "incense_sticks",
            "description": "Parent-dependent picklist: options filtered by subcategory value for fragnancetype",
            "sortorder": 1,
            "isactive": true,
            "createddate": 1758879549,
            "modifieddate": 1764843527
          },
          {
            "id": 4,
            "label": "Kesar Chandan",
            "value": "kesar_chandan",
            "controlledfieldname": "subsubcategory",
            "parent": "incense_sticks",
            // ... other fields
          }
          // ... more items with controlledfieldname="subsubcategory" and parent="incense_sticks"
        ]
      },
      "subcategory": {
        "fragrance_sachets": [
          {
            "id": 65,
            "label": "Cool Aqua",
            "value": "cool_aqua",
            "object": "product",
            "controlledvalue": "fragrance_sachets",
            "fieldname": "fragnancetype",
            "controlledlabel": "Fragrance Sachets",
            "controlledfieldname": "subcategory",
            "parent": "fragrance_sachets",
            "description": null,
            "sortorder": 14,
            "isactive": true,
            "createddate": 1763613636,
            "modifieddate": 1764843534
          },
          {
            "id": 69,
            "label": "Vanila",
            "value": "vanila",
            "controlledfieldname": "subcategory",
            "parent": "fragrance_sachets",
            // ... other fields
          }
          // ... more items with controlledfieldname="subcategory" and parent="fragrance_sachets"
        ]
      }
    }
  }
}
```

---

### For `subcategory` (Single controlledfieldname value)

For fieldnames that have **only one** `controlledfieldname` value (or all items share the same `controlledfieldname`), the structure still works the same way. There will just be **one key** at the `controlledfieldname` level:

```json
{
  "data": {
    "subcategory": {
      "category": {
        "home_fragrance": [
          {
            "id": 33,
            "label": "Incense",
            "value": "incense",
            "fieldname": "subcategory",
            "controlledfieldname": "category",
            "parent": "home_fragrance",
            // ... other fields
          }
        ],
        "aromatherapy_&_wellness": [
          {
            "id": 36,
            "label": "Essential Oils",
            "value": "essential_oils",
            "fieldname": "subcategory",
            "controlledfieldname": "category",
            "parent": "aromatherapy_&_wellness",
            // ... other fields
          }
        ]
      }
      // Note: Only one controlledfieldname key ("category") exists here
      // If there were multiple, you'd see more keys like "subcategory": { "category": {...}, "other_field": {...} }
    }
  }
}
```

**UI Handling:** The iteration pattern remains the same. You'll just iterate through one `controlledfieldname` group instead of multiple. The code doesn't need special handling - it works for both single and multiple `controlledfieldname` values.

---

### For `category` (No controlledfieldname - null)

For fieldnames with no `controlledfieldname` (null), they will be grouped under `"null"`:

```json
{
  "data": {
    "category": {
      "null": {
        "null": [
          {
            "id": 30,
            "label": "Home Fragrance",
            "value": "home_fragrance",
            "fieldname": "category",
            "controlledfieldname": null,
            "parent": null,
            // ... other fields
          },
          {
            "id": 31,
            "label": "Aromatherapy & Wellness",
            "value": "aromatherapy_&_wellness",
            "fieldname": "category",
            "controlledfieldname": null,
            "parent": null,
            // ... other fields
          }
        ]
      }
    }
  }
}
```

---

## UI Mapping Guide

### For `fragnancetype` with multiple controlledfieldname values:

1. **First Level:** Iterate over `fragnancetype` object
2. **Second Level:** Iterate over `controlledfieldname` keys (`subsubcategory`, `subcategory`)
   - This creates separate sections in UI for each controlled field type
3. **Third Level:** Iterate over `parent` keys (`incense_sticks`, `fragrance_sachets`)
   - This groups items by their parent value
4. **Fourth Level:** Display the items array

### Example UI Structure:

**For `fragnancetype` (Multiple controlledfieldname):**
```
Field Name: fragnancetype
├── Controlled Field: subsubcategory
│   ├── Parent: incense_sticks
│   │   ├── Kasturi
│   │   ├── Kesar Chandan
│   │   └── ...
│   └── (other parents if any)
└── Controlled Field: subcategory
    ├── Parent: fragrance_sachets
    │   ├── Cool Aqua
    │   ├── Vanila
    │   └── ...
    └── (other parents if any)
```

**For `subcategory` (Single controlledfieldname):**
```
Field Name: subcategory
└── Controlled Field: category (only one controlledfieldname)
    ├── Parent: home_fragrance
    │   ├── Incense
    │   ├── Car & Room Fresheners
    │   └── ...
    ├── Parent: aromatherapy_&_wellness
    │   ├── Essential Oils
    │   ├── Fragrance Blends
    │   └── ...
    └── (other parents)
```

**Note:** The structure is the same, but with only one `controlledfieldname` key when all items share the same value.

---

## Complete Response Example

```json
{
  "success": true,
  "meta": {
    "grouped": true,
    "groupedByParent": true,
    "groupCount": 13,
    "totalRecords": 69
  },
  "message": "Picklists grouped by fieldname and parent successfully",
  "data": {
    "category": {
      "null": {
        "null": [
          {
            "id": 30,
            "label": "Home Fragrance",
            "value": "home_fragrance",
            "fieldname": "category",
            "controlledfieldname": null,
            "parent": null
          }
        ]
      }
    },
    "subcategory": {
      "category": {
        "home_fragrance": [
          {
            "id": 33,
            "label": "Incense",
            "value": "incense",
            "fieldname": "subcategory",
            "controlledfieldname": "category",
            "parent": "home_fragrance"
          }
        ]
      }
    },
    "subsubcategory": {
      "subcategory": {
        "incense": [
          {
            "id": 89,
            "label": "Incense sticks",
            "value": "incense_sticks",
            "fieldname": "subsubcategory",
            "controlledfieldname": "subcategory",
            "parent": "incense"
          }
        ]
      }
    },
    "fragnancetype": {
      "subsubcategory": {
        "incense_sticks": [
          {
            "id": 3,
            "label": "Kasturi",
            "value": "kasturi",
            "fieldname": "fragnancetype",
            "controlledfieldname": "subsubcategory",
            "parent": "incense_sticks"
          }
        ]
      },
      "subcategory": {
        "fragrance_sachets": [
          {
            "id": 65,
            "label": "Cool Aqua",
            "value": "cool_aqua",
            "fieldname": "fragnancetype",
            "controlledfieldname": "subcategory",
            "parent": "fragrance_sachets"
          }
        ]
      }
    }
  }
}
```

---

## Key Points for UI Development

1. **3-Level Nesting:** `fieldname → controlledfieldname → parent → items[]`
2. **Null Handling:** Both `controlledfieldname` and `parent` can be `null`, which will appear as the string `"null"` in the keys
3. **Single vs Multiple controlledfieldname:**
   - **Single controlledfieldname:** When all items have the same `controlledfieldname` (or only one exists), there will be **one key** at that level. The structure is still the same, just simpler.
   - **Multiple controlledfieldname:** When a fieldname has items with different `controlledfieldname` values, they will be in **separate sections** (separate keys).
4. **Unified UI Code:** The same iteration code works for both cases - you don't need special handling for single vs multiple `controlledfieldname` values.
5. **Backward Compatible:** Fieldnames with single or no `controlledfieldname` still work correctly.

---

## TypeScript Interface (for reference)

```typescript
interface PicklistV2Response {
  success: boolean;
  meta: {
    grouped: boolean;
    groupedByParent: boolean;
    groupCount: number;
    totalRecords: number;
  };
  message: string;
  data: {
    [fieldname: string]: {
      [controlledfieldname: string]: {
        [parent: string]: PicklistItem[];
      };
    };
  };
}

interface PicklistItem {
  id: number;
  label: string;
  value: string;
  object: string;
  controlledvalue: string | null;
  fieldname: string;
  controlledlabel: string | null;
  controlledfieldname: string | null;
  parent: string | null;
  description: string | null;
  sortorder: number;
  isactive: boolean;
  createddate: number;
  modifieddate: number;
}
```

