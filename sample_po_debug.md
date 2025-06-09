# Sample Purchase Order JSONB Debug

## The Issue

The issue with the `items` field appears to be a mismatch between different layers of the application:

1. **Schema Validation Layer**: Expects `items` to be an array of objects (as defined in the Zod schema)
2. **Database Layer**: Expects `items` to be in JSONB format
3. **Data Transformation**: The `dynamicCreate` function is not properly handling the transformation between these formats

## Test JSON

The schema validation (Zod) requires the JSON to look like this:

```json
{
  "companyname": "Test Company",
  "contactname": "John Doe",
  "phonenumber": 9876543210,
  "companymail": "test@example.com",
  "gstnumber": "GST123456789",
  "companyaddress": "123 Test Street, Test City",
  "supplierid": 99,
  "items": [
    {
      "id": 1,
      "name": "Product A",
      "quantity": 10
    },
    {
      "id": 2,
      "name": "Product B",
      "quantity": 5
    }
  ],
  "createdby": "testuser",
  "modifiedby": "testuser"
}
```

## Root Cause

The error message "Field 'items' expects jsonb but received jsonb" suggests that there's a type mismatch in how the data is being passed to PostgreSQL.

The `dynamicCreate` function in `dynamicDbOperations.ts` has special handling for the `paymentdata` field (lines 1040-1042), but there's no explicit handling for the `items` field:

```typescript
// Handle JSON fields properly for PostgreSQL
if (key === 'paymentdata' && value !== null && value !== undefined) {
  // For JSONB fields with explicit casting, stringify the JSON
  rawData[key] = typeof value === 'string' ? value : JSON.stringify(value);
} else {
  rawData[key] = value;
}
```

## Solution

The solution is to update the `dynamicCreate` function to handle the `items` field similar to how it handles the `paymentdata` field:

```typescript
// Handle JSON fields properly for PostgreSQL
if ((key === 'paymentdata' || key === 'items') && value !== null && value !== undefined) {
  // For JSONB fields with explicit casting, stringify the JSON
  rawData[key] = typeof value === 'string' ? value : JSON.stringify(value);
} else {
  rawData[key] = value;
}
```

And in the SQL generation:

```typescript
// Build placeholders with special handling for JSON fields
const placeholders = columns.map((col, index) => {
  if (col === 'paymentdata' || col === 'items') {
    return `$${index + 1}::jsonb`;
  }
  return `$${index + 1}`;
}).join(', ');
```

This should resolve the type mismatch issue and allow proper handling of the `items` field as JSONB in the database. 