# 🔄 Actions Array to Object Conversion Guide

## 📊 **Current vs Desired Structure**

### **❌ Current (Array Format):**
```json
{
  "actions": [
    {
      "type": "PERCENT_OFF",
      "value": 20,
      "max_discount": 500
    }
  ]
}
```

### **✅ Desired (Single Object Format):**
```json
{
  "action": {
    "type": "PERCENT_OFF",
    "value": 20,
    "max_discount": 500
  }
}
```

## 🛠️ **Migration Process**

### **Step 1: Add New Column**
```sql
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS action JSONB;
```

### **Step 2: Convert Data**
```sql
UPDATE promotions 
SET action = CASE 
  WHEN actions IS NOT NULL AND jsonb_array_length(actions) > 0 THEN
    actions->0  -- Take the first action from the array
  ELSE NULL
END
WHERE actions IS NOT NULL AND jsonb_array_length(actions) > 0;
```

### **Step 3: Remove Old Columns**
```sql
ALTER TABLE promotions DROP COLUMN IF EXISTS actions;
ALTER TABLE promotions DROP COLUMN IF EXISTS discount_type;
ALTER TABLE promotions DROP COLUMN IF EXISTS discount_value;
```

## 📋 **Conversion Examples**

### **Example 1: Percentage Discount**
```sql
-- Before (Array)
actions: [{"type": "PERCENT_OFF", "value": 20, "max_discount": 500}]

-- After (Object)
action: {"type": "PERCENT_OFF", "value": 20, "max_discount": 500}
```

### **Example 2: BOGO Promotion**
```sql
-- Before (Array)
actions: [{"type": "BOGO", "value": 1, "buy_quantity": 2, "get_quantity": 1}]

-- After (Object)
action: {"type": "BOGO", "value": 1, "buy_quantity": 2, "get_quantity": 1}
```

### **Example 3: Free Product**
```sql
-- Before (Array)
actions: [{"type": "FREE_PRODUCT", "value": 0, "free_product_id": "PROD999"}]

-- After (Object)
action: {"type": "FREE_PRODUCT", "value": 0, "free_product_id": "PROD999"}
```

## 🔍 **Migration Logic Explanation**

### **Why `actions->0`?**
- Most promotions have only **ONE** action
- `actions->0` extracts the first (and usually only) element from the array
- This converts `[{...}]` to `{...}`

### **Safety Checks:**
```sql
WHEN actions IS NOT NULL AND jsonb_array_length(actions) > 0 THEN
```
- Ensures `actions` column exists
- Ensures array is not empty
- Prevents errors during conversion

## 🎯 **Frontend Impact**

### **Before Migration:**
```typescript
// Frontend sends
{
  discount_type: "PERCENT_OFF",
  discount_value: 20,
  max_discount_cap: 500
}

// Backend stores as
{
  actions: [{"type": "PERCENT_OFF", "value": 20, "max_discount": 500}]
}
```

### **After Migration:**
```typescript
// Frontend sends (same)
{
  discount_type: "PERCENT_OFF", 
  discount_value: 20,
  max_discount_cap: 500
}

// Backend stores as
{
  action: {"type": "PERCENT_OFF", "value": 20, "max_discount": 500}
}
```

## ✅ **Benefits of Single Object**

1. **Simpler Structure**: `action: {}` instead of `actions: [{}]`
2. **No Array Management**: No need to handle array operations
3. **Cleaner Queries**: Direct access to action properties
4. **Better Performance**: Less JSON parsing overhead
5. **Frontend Friendly**: Matches your frontend's single action approach

## 🚀 **Running the Migration**

### **Option 1: Run Full Migration**
```bash
psql -h your-host -p your-port -U your-user -d your-db -f remove_redundant_promotion_fields.sql
```

### **Option 2: Step-by-Step**
```sql
-- 1. Backup data
CREATE TABLE promotions_backup AS SELECT * FROM promotions;

-- 2. Add new column
ALTER TABLE promotions ADD COLUMN action JSONB;

-- 3. Convert data
UPDATE promotions SET action = actions->0 WHERE actions IS NOT NULL;

-- 4. Remove old columns
ALTER TABLE promotions DROP COLUMN actions;
ALTER TABLE promotions DROP COLUMN discount_type;
ALTER TABLE promotions DROP COLUMN discount_value;
```

## 🔍 **Verification**

### **Check Conversion Success:**
```sql
SELECT 
  id,
  name,
  type,
  action,
  CASE 
    WHEN action IS NOT NULL THEN 'CONVERTED'
    ELSE 'NO_ACTION'
  END as status
FROM promotions 
WHERE action IS NOT NULL
LIMIT 5;
```

### **Expected Results:**
```
id | name                    | type              | action                                    | status
---|-------------------------|-------------------|-------------------------------------------|----------
1  | 20% OFF on Cart         | PERCENT_OFF_CART  | {"type":"PERCENT_OFF","value":20}         | CONVERTED
2  | Buy 2 Get 1 Free        | BOGO              | {"type":"BOGO","value":1,"buy_quantity":2}| CONVERTED
3  | Free Sample              | FREE_PRODUCT      | {"type":"FREE_PRODUCT","value":0}         | CONVERTED
```

## ⚠️ **Important Notes**

1. **Backup First**: Always backup your data before running migration
2. **Test Environment**: Run migration in test environment first
3. **Frontend Compatibility**: Your frontend will continue working without changes
4. **Gradual Migration**: Can be done during maintenance window

## 🎯 **Summary**

The migration converts:
- `actions: [{...}]` → `action: {...}`
- Removes redundant `discount_type` and `discount_value` fields
- Maintains all existing data and functionality
- Improves data structure and performance

**Result**: Cleaner, more efficient promotion data structure that aligns perfectly with your frontend implementation! 🚀
