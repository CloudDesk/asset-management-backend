# 🎨 Frontend Implementation Examples

## 📱 **Backend Changes Summary**

### **✅ COMPLETED: Database & Backend Cleanup**
- **Database Schema**: Converted `actions[]` → `action{}` (single object)
- **Removed Redundant Fields**: `discount_type`, `discount_value`, `actions` columns deleted
- **Date Fields**: `start_date`/`end_date` now store Unix timestamps (BigInt)
- **Backend Transformation**: Frontend flat structure → Backend single action object
- **API Compatibility**: Frontend can still send old format, backend transforms it

### **🔄 Current Frontend-Backend Data Flow:**
```typescript
// ✅ CURRENT: Frontend sends flat structure (form.tsx)
const frontendPayload = {
  name: "20% OFF Cart",
  type: "PERCENT_OFF_CART",
  discount_type: "PERCENT_OFF",      // Auto-mapped from type
  discount_value: 20,                 // User input
  max_discount_cap: 500,              // Optional cap
  buy_quantity: 2,                    // For BOGO
  get_quantity: 1,                    // For BOGO
  product_ids: ["PROD101"],           // For BOGO/Free Product
  free_product_id: "PROD999",         // For Free Product
  minimum_purchase: 200,              // For Free Product
  max_free_items: 5,                  // For BOGO/Free Product
  minimum_order_value: 500,           // For Free Shipping
  // ... other fields
};

// ✅ Backend transforms to single action object
const backendData = {
  name: "20% OFF Cart",
  type: "PERCENT_OFF_CART",
  action: {                           // Single object
    type: "PERCENT_OFF",
    value: 20,
    max_discount: 500
  }
  // ... other fields
};
```

## 🎯 **What Frontend Needs to Change**

### **❌ CURRENT ISSUES in form.tsx:**

1. **Still using `actions` array** (line 1070, 1291, 1698)
2. **Still sending `actions` in payload** (line 1291)
3. **ActionManager component** still manages array (line 777-938)
4. **Form validation** still checks `actions` array (line 1228-1253)

### **✅ REQUIRED CHANGES:**

#### **1. Remove Actions Array Management**
```typescript
// ❌ REMOVE: Current actions array handling
const [formData, setFormData] = useState<Partial<PromotionFormData>>({
  // ... other fields
  actions: [],  // ❌ Remove this
  // ... other fields
});

// ✅ REPLACE: With single action object
const [formData, setFormData] = useState<Partial<PromotionFormData>>({
  // ... other fields
  action: {     // ✅ Single object
    type: "PERCENT_OFF",
    value: 0
  },
  // ... other fields
});
```

#### **2. Update ActionManager Component**
```typescript
// ❌ CURRENT: Manages actions array
const ActionManager: React.FC<{
  actions: PromotionAction[];  // ❌ Array
  onChange: (actions: PromotionAction[]) => void;  // ❌ Array
  // ...
}> = ({ actions, onChange, ... }) => {
  // ❌ Array management logic
};

// ✅ REPLACE: Manage single action object
const ActionManager: React.FC<{
  action: PromotionAction;  // ✅ Single object
  onChange: (action: PromotionAction) => void;  // ✅ Single object
  // ...
}> = ({ action, onChange, ... }) => {
  // ✅ Single object management logic
};
```

#### **3. Update Form Submission**
```typescript
// ❌ CURRENT: Still sends actions array
const submitData = {
  ...formData,
  actions: formData.actions || [],  // ❌ Remove this
};

// ✅ REPLACE: Send single action object
const submitData = {
  ...formData,
  action: formData.action || { type: "PERCENT_OFF", value: 0 },  // ✅ Single object
};
```

#### **4. Update Form Validation**
```typescript
// ❌ REMOVE: Actions array validation (line 1228-1253)
if (formData.actions && formData.actions.length > 0) {
  formData.actions.forEach((action, index) => {
    // ❌ Array validation logic
  });
}

// ✅ REPLACE: Single action validation
if (formData.action) {
  if (!formData.action.type) {
    validationErrors.action_type = "Action type is required";
  }
  if (formData.action.value === undefined || formData.action.value === null) {
    validationErrors.action_value = "Action value is required";
  }
}
```

## 🎯 **Updated Type-Specific Form Components**

### **✅ NEW: Single Action Object Structure**
```typescript
// ✅ UPDATED: Single action object interface
interface PromotionAction {
  type: 'PERCENT_OFF' | 'FIXED_AMOUNT_OFF' | 'FREE_SHIPPING' | 'BOGO' | 'FREE_PRODUCT';
  
  // Common fields
  value?: number | boolean;
  
  // PERCENT_OFF fields
  max_discount?: number;        // Optional cap
  
  // FIXED_AMOUNT_OFF fields
  // (uses value field)
  
  // FREE_SHIPPING fields
  min_order_value?: number;    // Min order for free shipping
  
  // BOGO fields
  buy_quantity?: number;        // How many to buy
  get_quantity?: number;        // How many free
  product_ids?: string[];       // Product IDs (empty = all)
  max_free_items?: number;      // Limit free items
  
  // FREE_PRODUCT fields
  free_product_id?: string;     // Product ID to give free
  min_purchase?: number;        // Min purchase required
  max_free_items?: number;      // Limit free items
}
```

### **1. Updated Percentage Discount Form**
```tsx
// ✅ UPDATED: PERCENT_OFF_CART / PERCENT_OFF_ITEM
const PercentageDiscountForm = ({ action, onChange }) => {
  return (
    <div className="action-form">
      <h3>Percentage Discount</h3>
      
      <div className="form-group">
        <label>Discount Percentage (1-100%)</label>
        <input
          type="number"
          min="1"
          max="100"
          value={action.value || ''}
          onChange={(e) => onChange({ ...action, value: parseInt(e.target.value) })}
          required
        />
      </div>
      
      <div className="form-group">
        <label>Maximum Discount Cap (Optional)</label>
        <input
          type="number"
          value={action.max_discount || ''}
          onChange={(e) => onChange({ ...action, max_discount: parseFloat(e.target.value) })}
        />
        <small>e.g., ₹500 - maximum discount even if percentage is higher</small>
      </div>
    </div>
  );
};
```

### **2. Updated Fixed Amount Discount Form**
```tsx
// ✅ UPDATED: FIXED_AMOUNT_OFF_CART / FIXED_AMOUNT_OFF_ITEM
const FixedAmountDiscountForm = ({ action, onChange }) => {
  return (
    <div className="action-form">
      <h3>Fixed Amount Discount</h3>
      
      <div className="form-group">
        <label>Discount Amount (₹)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={action.value || ''}
          onChange={(e) => onChange({ ...action, value: parseFloat(e.target.value) })}
          required
        />
      </div>
    </div>
  );
};
```

### **3. Updated BOGO Form with Product Selection**
```tsx
// ✅ UPDATED: BOGO
const BOGOForm = ({ action, onChange, availableProducts }) => {
  return (
    <div className="action-form">
      <h3>Buy One Get One (BOGO)</h3>
      
      <div className="form-group">
        <label>Buy Quantity</label>
        <input
          type="number"
          min="1"
          value={action.buy_quantity || ''}
          onChange={(e) => onChange({ ...action, buy_quantity: parseInt(e.target.value) })}
          required
        />
      </div>
      
      <div className="form-group">
        <label>Get Quantity (Free)</label>
        <input
          type="number"
          min="1"
          value={action.get_quantity || ''}
          onChange={(e) => onChange({ ...action, get_quantity: parseInt(e.target.value) })}
          required
        />
      </div>
      
      <div className="form-group">
        <label>Apply to Products</label>
        <select
          multiple
          value={action.product_ids || []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, option => option.value);
            onChange({ ...action, product_ids: selected });
          }}
        >
          <option value="">All Products</option>
          {availableProducts.map(product => (
            <option key={product.id} value={product.id}>
              {product.name} (₹{product.price})
            </option>
          ))}
        </select>
        <small>Leave empty to apply to all products</small>
      </div>
      
      <div className="form-group">
        <label>Maximum Free Items per Order</label>
        <input
          type="number"
          min="1"
          value={action.max_free_items || ''}
          onChange={(e) => onChange({ ...action, max_free_items: parseInt(e.target.value) })}
        />
      </div>
    </div>
  );
};
```

### **4. Updated Free Product Form**
```tsx
// ✅ UPDATED: FREE_PRODUCT
const FreeProductForm = ({ action, onChange, availableProducts }) => {
  return (
    <div className="action-form">
      <h3>Free Product</h3>
      
      <div className="form-group">
        <label>Select Free Product</label>
        <select
          value={action.free_product_id || ''}
          onChange={(e) => onChange({ ...action, free_product_id: e.target.value })}
          required
        >
          <option value="">Choose a product...</option>
          {availableProducts.map(product => (
            <option key={product.id} value={product.id}>
              {product.name} (₹{product.price})
            </option>
          ))}
        </select>
      </div>
      
      <div className="form-group">
        <label>Minimum Purchase Required (₹)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={action.min_purchase || ''}
          onChange={(e) => onChange({ ...action, min_purchase: parseFloat(e.target.value) })}
        />
      </div>
      
      <div className="form-group">
        <label>Maximum Free Items per Order</label>
        <input
          type="number"
          min="1"
          value={action.max_free_items || ''}
          onChange={(e) => onChange({ ...action, max_free_items: parseInt(e.target.value) })}
        />
      </div>
    </div>
  );
};
```

### **5. Updated Free Shipping Form**
```tsx
// ✅ UPDATED: FREE_SHIPPING
const FreeShippingForm = ({ action, onChange }) => {
  return (
    <div className="action-form">
      <h3>Free Shipping</h3>
      
      <div className="form-group">
        <label>Minimum Order Value for Free Shipping (₹)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={action.min_order_value || ''}
          onChange={(e) => onChange({ ...action, min_order_value: parseFloat(e.target.value) })}
        />
        <small>Leave empty for free shipping on all orders</small>
      </div>
    </div>
  );
};
```

## 🔄 **Updated Dynamic Form Rendering**

```tsx
// ✅ UPDATED: Single action object management
const PromotionForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    action: {
      type: '',
      value: 0,
      // Type-specific fields will be populated based on action.type
    }
  });

  const handleActionChange = (newAction) => {
    setFormData(prev => ({
      ...prev,
      action: newAction
    }));
  };

  const handlePromotionTypeChange = (promotionType) => {
    // Auto-set action type based on promotion type
    const actionType = PROMOTION_TYPE_TO_DISCOUNT_TYPE[promotionType];
    setFormData(prev => ({
      ...prev,
      type: promotionType,
      action: {
        type: actionType,
        value: actionType === 'FREE_SHIPPING' || actionType === 'FREE_PRODUCT' ? 0 : prev.action.value,
        // Clear type-specific fields when type changes
        max_discount: undefined,
        buy_quantity: undefined,
        get_quantity: undefined,
        product_ids: undefined,
        free_product_id: undefined,
        min_purchase: undefined,
        max_free_items: undefined,
        min_order_value: undefined,
      }
    }));
  };

  const renderActionForm = () => {
    switch (formData.action.type) {
      case 'PERCENT_OFF':
        return <PercentageDiscountForm action={formData.action} onChange={handleActionChange} />;
      case 'FIXED_AMOUNT_OFF':
        return <FixedAmountDiscountForm action={formData.action} onChange={handleActionChange} />;
      case 'BOGO':
        return <BOGOForm action={formData.action} onChange={handleActionChange} availableProducts={products} />;
      case 'FREE_PRODUCT':
        return <FreeProductForm action={formData.action} onChange={handleActionChange} availableProducts={products} />;
      case 'FREE_SHIPPING':
        return <FreeShippingForm action={formData.action} onChange={handleActionChange} />;
      default:
        return <div>Select a promotion type to configure action</div>;
    }
  };

  return (
    <form>
      {/* Basic fields */}
      <input
        type="text"
        placeholder="Promotion Name"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
      />
      
      <select
        value={formData.type}
        onChange={(e) => handlePromotionTypeChange(e.target.value)}
      >
        <option value="">Select Promotion Type</option>
        <option value="PERCENT_OFF_CART">Percentage Off Cart</option>
        <option value="FIXED_AMOUNT_OFF_CART">Fixed Amount Off Cart</option>
        <option value="BOGO">Buy One Get One</option>
        <option value="FREE_PRODUCT">Free Product</option>
        <option value="FREE_SHIPPING">Free Shipping</option>
      </select>
      
      {/* Dynamic action form - single action only */}
      {formData.type && renderActionForm()}
      
      {/* No add/remove buttons needed - single action only */}
    </form>
  );
};
```

## 📤 **Updated API Payload Examples**

### **✅ CURRENT: Frontend Still Sends Flat Structure (Working)**
```json
{
  "name": "20% OFF on Cart",
  "type": "PERCENT_OFF_CART",
  "discount_type": "PERCENT_OFF",
  "discount_value": 20,
  "max_discount_cap": 500,
  "conditions": [
    {
      "attribute": "cart.total_value",
      "operator": "GTE",
      "value": 1000
    }
  ]
}
```
**Backend Response:**
```json
{
  "action": {
    "type": "PERCENT_OFF",
    "value": 20,
    "max_discount": 500
  }
}
```

### **✅ FUTURE: Frontend Sends Single Action Object (Recommended)**
```json
{
  "name": "20% OFF on Cart",
  "type": "PERCENT_OFF_CART",
  "action": {
    "type": "PERCENT_OFF",
    "value": 20,
    "max_discount": 500
  },
  "conditions": [
    {
      "attribute": "cart.total_value",
      "operator": "GTE",
      "value": 1000
    }
  ]
}
```

### **✅ FUTURE: BOGO with Single Action Object**
```json
{
  "name": "Buy 2 Get 1 Free - Electronics",
  "type": "BOGO",
  "action": {
    "type": "BOGO",
    "value": 0,
    "buy_quantity": 2,
    "get_quantity": 1,
    "product_ids": ["PROD101", "PROD102"],
    "max_free_items": 5
  },
  "conditions": [
    {
      "attribute": "cart.total_value",
      "operator": "GTE",
      "value": 500
    }
  ]
}
```

### **✅ FUTURE: Free Product with Single Action Object**
```json
{
  "name": "Free Sample with Purchase",
  "type": "FREE_PRODUCT",
  "action": {
    "type": "FREE_PRODUCT",
    "value": 0,
    "free_product_id": "PROD999",
    "min_purchase": 200,
    "max_free_items": 1
  },
  "conditions": [
    {
      "attribute": "cart.total_value",
      "operator": "GTE",
      "value": 200
    }
  ]
}
```

## 🎯 **Migration Strategy**

### **Phase 1: ✅ COMPLETED (Backend)**
- Database cleanup: `actions[]` → `action{}`
- Backend transformation layer
- API compatibility maintained

### **Phase 2: 🔄 IN PROGRESS (Frontend)**
- Update form.tsx to use single action object
- Remove actions array management
- Update ActionManager component
- Update form validation

### **Phase 3: 🚀 FUTURE (Optional)**
- Remove backend transformation layer
- Frontend sends single action object directly
- Cleaner API contracts

## ✅ **Benefits of Updated Approach**

1. **✅ No Redundancy**: Single source of truth for discount logic
2. **✅ Simplified UI**: No add/remove buttons for actions
3. **✅ Type-Specific Forms**: Only relevant fields shown
4. **✅ Product Selection**: Easy BOGO and FREE_PRODUCT implementation
5. **✅ Better Validation**: Type-specific validation rules
6. **✅ Cleaner Code**: Less complex state management
7. **✅ Database Efficiency**: Smaller footprint, faster queries
8. **✅ Type Safety**: Clear action structure for each promotion type
