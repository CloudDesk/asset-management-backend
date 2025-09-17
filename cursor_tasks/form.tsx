import React, { useState } from "react";
import type {
  Promotion,
  PromotionFormData,
  PromotionCondition,
  PromotionAction,
} from "../../types/promotion";
import {
  COMMON_ATTRIBUTES,
  ATTRIBUTE_TYPES,
  OPERATORS_BY_TYPE,
  COMMON_USER_SEGMENTS,
  COMMON_CATEGORIES,
  ACTION_TYPE_CONFIG,
} from "../../types/promotion";
import { useToast } from "../common/Toast";

interface PromotionFormProps {
  initialData?: Promotion;
  onSubmit: (data: PromotionFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// Field configuration for promotion form
interface FieldConfig {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "select"
    | "number"
    | "boolean"
    | "datetime"
    | "json";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

// Promotion type options
const PROMOTION_TYPES = [
  { value: "PERCENT_OFF_ITEM", label: "Percent Off Item" },
  { value: "FIXED_AMOUNT_OFF_ITEM", label: "Fixed Amount Off Item" },
  { value: "BOGO", label: "Buy One Get One" },
  { value: "PERCENT_OFF_CART", label: "Percent Off Cart" },
  { value: "FIXED_AMOUNT_OFF_CART", label: "Fixed Amount Off Cart" },
  { value: "FREE_SHIPPING", label: "Free Shipping" },
  { value: "FREE_PRODUCT", label: "Free Product" },
];

// Status options
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

// Visibility options
const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
  { value: "all", label: "All" },
];

// Discount type options
const DISCOUNT_TYPE_OPTIONS = [
  { value: "PERCENT_OFF", label: "Percentage" },
  { value: "FIXED_AMOUNT_OFF", label: "Fixed Amount" },
  { value: "FREE_SHIPPING", label: "Free Shipping" },
  { value: "BOGO", label: "Buy One Get One" },
  { value: "FREE_PRODUCT", label: "Free Product" },
];

// Mapping from promotion type to discount type
const PROMOTION_TYPE_TO_DISCOUNT_TYPE: Record<string, string> = {
  "PERCENT_OFF_ITEM": "PERCENT_OFF",
  "FIXED_AMOUNT_OFF_ITEM": "FIXED_AMOUNT_OFF",
  "PERCENT_OFF_CART": "PERCENT_OFF",
  "FIXED_AMOUNT_OFF_CART": "FIXED_AMOUNT_OFF",
  "BOGO": "BOGO",
  "FREE_SHIPPING": "FREE_SHIPPING",
  "FREE_PRODUCT": "FREE_PRODUCT",
};

// Discount value constraints based on discount type
const DISCOUNT_VALUE_CONSTRAINTS: Record<string, { min: number; max: number; step: number; placeholder: string }> = {
  "PERCENT_OFF": { min: 0, max: 100, step: 0.01, placeholder: "Enter percentage (0-100%)" },
  "FIXED_AMOUNT_OFF": { min: 0, max: 10000, step: 0.01, placeholder: "Enter amount (0-10000)" },
  "FREE_SHIPPING": { min: 0, max: 0, step: 1, placeholder: "Free shipping" },
  "BOGO": { min: 0, max: 10, step: 1, placeholder: "Number of free items" },
  "FREE_PRODUCT": { min: 0, max: 0, step: 1, placeholder: "Free product" },
};

// Helper function to calculate max redemptions based on budget and product price
const calculateMaxRedemptions = (budget: number, productPrice: number, discountValue: number, discountType: string): number => {
  if (!budget || !productPrice) return 0;
  
  let effectivePrice = productPrice;
  
  if (discountType === "PERCENT_OFF") {
    effectivePrice = productPrice * (1 - discountValue / 100);
  } else if (discountType === "FIXED_AMOUNT_OFF") {
    effectivePrice = Math.max(0, productPrice - discountValue);
  }
  
  return Math.floor(budget / effectivePrice);
};

// Helper function to calculate per user limit (10% of max redemptions)
const calculatePerUserLimit = (maxRedemptions: number): number => {
  return Math.floor(maxRedemptions * 0.1);
};

// Product lookup interface
interface ProductInfo {
  id: string;
  name: string;
  price: number;
  availableQuantity: number;
  sku: string;
}

// Mock product data - replace with actual API call
const MOCK_PRODUCTS: ProductInfo[] = [
  { id: "PROD001", name: "Wellness Product A", price: 100, availableQuantity: 500, sku: "WP001" },
  { id: "PROD002", name: "Wellness Product B", price: 150, availableQuantity: 300, sku: "WP002" },
  { id: "PROD003", name: "Wellness Product C", price: 200, availableQuantity: 200, sku: "WP003" },
  { id: "PROD004", name: "Wellness Product D", price: 250, availableQuantity: 100, sku: "WP004" },
];

// Helper function to get product info
const getProductInfo = (productId: string): ProductInfo | null => {
  return MOCK_PRODUCTS.find(p => p.id === productId) || null;
};

// Helper function to validate quantity against available stock
const validateProductQuantity = (productId: string, requestedQuantity: number): { valid: boolean; message?: string; maxAllowed?: number } => {
  const product = getProductInfo(productId);
  if (!product) {
    return { valid: false, message: "Product not found" };
  }
  
  if (requestedQuantity > product.availableQuantity) {
    return { 
      valid: false, 
      message: `Only ${product.availableQuantity} units available`,
      maxAllowed: product.availableQuantity
    };
  }
  
  return { valid: true };
};

// Field configurations (excluding conditions and actions - they'll be handled separately)
const PROMOTION_FIELDS: FieldConfig[] = [
  {
    key: "name",
    label: "Promotion Name",
    type: "text",
    required: true,
    placeholder: "Enter promotion name",
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    placeholder: "Enter promotion description",
  },
  {
    key: "type",
    label: "Promotion Type",
    type: "select",
    required: true,
    options: PROMOTION_TYPES,
  },
  {
    key: "code",
    label: "Coupon Code",
    type: "text",
    placeholder: "Enter coupon code (optional for automatic promotions)",
  },
  {
    key: "auto_apply",
    label: "Auto Apply",
    type: "boolean",
  },
  {
    key: "is_active",
    label: "Active Status",
    type: "boolean",
  },
  {
    key: "start_date",
    label: "Start Date",
    type: "datetime",
    required: true,
  },
  {
    key: "end_date",
    label: "End Date",
    type: "datetime",
    required: true,
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: STATUS_OPTIONS,
  },
  {
    key: "priority",
    label: "Priority",
    type: "number",
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: "visibility",
    label: "Visibility",
    type: "select",
    options: VISIBILITY_OPTIONS,
  },
  {
    key: "max_redemptions",
    label: "Max Redemptions",
    type: "number",
    min: 0,
    step: 1,
    placeholder: "Total usage limit",
  },
  {
    key: "per_user_limit",
    label: "Per User Limit",
    type: "number",
    min: 0,
    step: 1,
    placeholder: "Usage limit per user",
  },
  {
    key: "stackable",
    label: "Stackable",
    type: "boolean",
  },
  {
    key: "budget",
    label: "Budget",
    type: "number",
    min: 0,
    step: 0.01,
    placeholder: "Promotion budget amount",
  },
  {
    key: "product_price",
    label: "Product Price (for budget calculation)",
    type: "number",
    min: 0,
    step: 0.01,
    placeholder: "Enter product price for budget calculations",
  },
  {
    key: "discount_value",
    label: "Discount Value",
    type: "number",
    min: 0,
    step: 0.01,
    placeholder: "Enter discount value",
  },
  {
    key: "product_id",
    label: "Product ID",
    type: "text",
    placeholder: "Enter product ID (for BOGO/Free Product)",
  },
  {
    key: "free_product_id",
    label: "Free Product ID",
    type: "text",
    placeholder: "Enter free product ID (for BOGO/Free Product)",
  },
  {
    key: "product_quantity",
    label: "Product Quantity",
    type: "number",
    min: 1,
    step: 1,
    placeholder: "Enter product quantity",
  },
  {
    key: "free_product_quantity",
    label: "Free Product Quantity",
    type: "number",
    min: 1,
    step: 1,
    placeholder: "Enter free product quantity",
  },
  {
    key: "timezone",
    label: "Timezone",
    type: "text",
    placeholder: "e.g., Asia/Kolkata, UTC",
  },
  {
    key: "evaluation_expiry_minutes",
    label: "Evaluation Expiry (minutes)",
    type: "number",
    min: 1,
    max: 1440,
    step: 1,
  },
];

// Helper function to get field icon
const getFieldIcon = (fieldKey: string): string => {
  const icons: Record<string, string> = {
    name: "tag",
    description: "align-left",
    type: "bullhorn",
    code: "ticket-alt",
    auto_apply: "magic",
    is_active: "toggle-on",
    start_date: "calendar-plus",
    end_date: "calendar-times",
    status: "info-circle",
    priority: "sort-numeric-up",
    visibility: "eye",
    max_redemptions: "users",
    per_user_limit: "user",
    stackable: "layer-group",
    budget: "dollar-sign",
    timezone: "clock",
    evaluation_expiry_minutes: "hourglass-half",
    discount_type: "percentage",
    discount_value: "calculator",
    conditions: "list-check",
    actions: "play",
  };
  return icons[fieldKey] || "cog";
};

// Helper function to get attribute type
const getAttributeType = (attribute: string): string => {
  const attributeKey = attribute as keyof typeof ATTRIBUTE_TYPES;
  return ATTRIBUTE_TYPES[attributeKey] || "string";
};

// Helper function to get available operators for an attribute
const getAvailableOperators = (attribute: string): readonly string[] => {
  const attributeType = getAttributeType(attribute);
  const typeKey = attributeType as keyof typeof OPERATORS_BY_TYPE;
  return OPERATORS_BY_TYPE[typeKey] || ["EQ"];
};

// Helper function to parse value based on operator
const parseConditionValue = (
  value: string,
  operator: string,
): string | number | string[] | boolean => {
  if (operator === "IN" || operator === "NOT_IN") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      // If not valid JSON, treat as comma-separated values
      return value
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v);
    }
  }

  if (
    operator === "GTE" ||
    operator === "LTE" ||
    operator === "LT" ||
    operator === "EQ"
  ) {
    const numValue = parseFloat(value);
    return isNaN(numValue) ? value : numValue;
  }

  return value;
};

// Enhanced Condition Management Component
const ConditionManager: React.FC<{
  conditions: PromotionCondition[];
  onChange: (conditions: PromotionCondition[]) => void;
  errors: Record<string, string>;
}> = ({ conditions, onChange, errors }) => {
  const [showTemplates, setShowTemplates] = useState(false);

  const addCondition = () => {
    const newCondition: PromotionCondition = {
      attribute: "",
      operator: "GTE",
      value: "",
    };
    onChange([...conditions, newCondition]);
  };

  const updateCondition = (
    index: number,
    field: keyof PromotionCondition,
    value: string | number | string[] | boolean,
  ) => {
    const updatedConditions = [...conditions];
    updatedConditions[index] = { ...updatedConditions[index], [field]: value };
    onChange(updatedConditions);
  };

  const addTemplate = (template: Partial<PromotionCondition>) => {
    const newCondition: PromotionCondition = {
      attribute: "",
      operator: "GTE",
      value: "",
      ...template,
    };
    onChange([...conditions, newCondition]);
    setShowTemplates(false);
  };

  const removeCondition = (index: number) => {
    const updatedConditions = conditions.filter((_, i) => i !== index);
    onChange(updatedConditions);
  };

  const renderValueInput = (condition: PromotionCondition, index: number) => {
    const { operator, attribute } = condition;
    const attributeType = getAttributeType(attribute);

    if (operator === "IN" || operator === "NOT_IN") {
      // For array inputs, show suggestions based on attribute
      const suggestions = attribute.includes("segment")
        ? Array.from(COMMON_USER_SEGMENTS)
        : attribute.includes("category")
          ? Array.from(COMMON_CATEGORIES)
          : [];

      return (
        <div className="space-y-2">
          <textarea
            value={
              Array.isArray(condition.value)
                ? JSON.stringify(condition.value)
                : String(condition.value)
            }
            onChange={(e) =>
              updateCondition(
                index,
                "value",
                parseConditionValue(e.target.value, operator),
              )
            }
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
            placeholder='["value1", "value2"] or comma-separated'
            rows={2}
          />
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    const currentValues = Array.isArray(condition.value)
                      ? condition.value
                      : [];
                    if (!currentValues.includes(suggestion)) {
                      updateCondition(index, "value", [
                        ...currentValues,
                        suggestion,
                      ]);
                    }
                  }}
                  className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (operator === "DATE_ADD_DAYS") {
      return (
        <div className="space-y-2">
          <input
            type="number"
            value={Number(condition.value) || ""}
            onChange={(e) =>
              updateCondition(index, "value", parseInt(e.target.value) || 0)
            }
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
            placeholder="Days"
          />
          <select
            value={condition.comparison || "GTE"}
            onChange={(e) =>
              updateCondition(index, "comparison", e.target.value)
            }
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
          >
            <option value="GTE">Greater than or equal</option>
            <option value="LTE">Less than or equal</option>
            <option value="LT">Less than</option>
            <option value="GT">Greater than</option>
            <option value="EQ">Equal</option>
          </select>
          <select
            value={condition.compare_with || "current_date"}
            onChange={(e) =>
              updateCondition(index, "compare_with", e.target.value)
            }
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
          >
            <option value="current_date">Current Date</option>
            <option value="start_date">Promotion Start Date</option>
            <option value="end_date">Promotion End Date</option>
          </select>
        </div>
      );
    }

    if (attributeType === "number") {
      return (
        <input
          type="number"
          value={Number(condition.value) || ""}
          onChange={(e) =>
            updateCondition(index, "value", parseFloat(e.target.value) || 0)
          }
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
          placeholder="Enter number"
          step="0.01"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(condition.value)}
        onChange={(e) => updateCondition(index, "value", e.target.value)}
        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
        placeholder="Enter value"
      />
    );
  };

  const commonTemplates = [
    {
      name: "Minimum Cart Value",
      condition: {
        attribute: "cart.total_value",
        operator: "GTE" as const,
        value: 1000,
      },
    },
    {
      name: "New User",
      condition: {
        attribute: "user.segment",
        operator: "IN" as const,
        value: ["new_user"],
      },
    },
    {
      name: "First Order",
      condition: {
        attribute: "user.order_count",
        operator: "EQ" as const,
        value: 0,
      },
    },
    {
      name: "Category Filter",
      condition: {
        attribute: "cart.items.category",
        operator: "IN" as const,
        value: ["Wellness"],
      },
    },
    {
      name: "Product SKU Filter",
      condition: {
        attribute: "cart.items.sku",
        operator: "IN" as const,
        value: ["SAMPLE_SKU"],
      },
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <i className="fas fa-filter mr-2 text-indigo-600"></i>
          Conditions
        </h3>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors"
          >
            Templates
          </button>
          <button
            type="button"
            onClick={addCondition}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {showTemplates && (
        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <h4 className="text-sm font-medium mb-2 text-purple-800 dark:text-purple-200">
            Quick Templates
          </h4>
          <div className="flex flex-wrap gap-2">
            {commonTemplates.map((template, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => addTemplate(template.condition)}
                className="px-3 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 rounded transition-colors"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left py-2 px-2">Index</th>
              <th className="text-left py-2 px-2">Attribute</th>
              <th className="text-left py-2 px-2">Operator</th>
              <th className="text-left py-2 px-2">Value</th>
              <th className="text-left py-2 px-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {conditions.map((condition, index) => (
              <tr
                key={index}
                className="border-b border-gray-100 dark:border-gray-700"
              >
                <td className="py-2 px-2">{index + 1}</td>
                <td className="py-2 px-2">
                  <select
                    value={condition.attribute}
                    onChange={(e) =>
                      updateCondition(index, "attribute", e.target.value)
                    }
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
                  >
                    <option value="">Select Attribute</option>
                    {COMMON_ATTRIBUTES.map((attr) => (
                      <option key={attr} value={attr}>
                        {attr}
                      </option>
                    ))}
                  </select>
                  {!COMMON_ATTRIBUTES.includes(
                    condition.attribute as (typeof COMMON_ATTRIBUTES)[number],
                  ) &&
                    condition.attribute && (
                      <input
                        type="text"
                        value={condition.attribute}
                        onChange={(e) =>
                          updateCondition(index, "attribute", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs mt-1"
                        placeholder="Custom attribute"
                      />
                    )}
                </td>
                <td className="py-2 px-2">
                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      updateCondition(
                        index,
                        "operator",
                        e.target.value as PromotionCondition["operator"],
                      )
                    }
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
                  >
                    {getAvailableOperators(condition.attribute).map((op) => (
                      <option key={op} value={op}>
                        {op === "GTE"
                          ? "≥ Greater than or equal"
                          : op === "LTE"
                            ? "≤ Less than or equal"
                            : op === "LT"
                              ? "< Less than"
                              : op === "EQ"
                                ? "= Equal"
                                : op === "IN"
                                  ? "∈ In array"
                                  : op === "NOT_IN"
                                    ? "∉ Not in array"
                                    : op === "CONTAINS"
                                      ? "⊃ Contains"
                                      : op === "DATE_ADD_DAYS"
                                        ? "📅 Date + Days"
                                        : op}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-2">
                  {renderValueInput(condition, index)}
                </td>
                <td className="py-2 px-2">
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                    title="Remove condition"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {conditions.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <i className="fas fa-filter text-4xl mb-4"></i>
          <p>
            No conditions defined. Click "Add" or use "Templates" to create
            conditions.
          </p>
        </div>
      )}

      {/* Display condition validation errors */}
      {Object.keys(errors).some((key) => key.startsWith("condition_")) && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            Condition Validation Errors:
          </h4>
          <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
            {Object.entries(errors)
              .filter(([key]) => key.startsWith("condition_"))
              .map(([key, error]) => (
                <li key={key}>• {error}</li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Simplified Action Management Component - Single Action Based on Promotion Type
const ActionManager: React.FC<{
  actions: PromotionAction[];
  onChange: (actions: PromotionAction[]) => void;
  errors: Record<string, string>;
  promotionType: string;
  discountValue: number;
}> = ({ actions, onChange, errors, promotionType, discountValue }) => {
  const discountType = PROMOTION_TYPE_TO_DISCOUNT_TYPE[promotionType];
  const constraints = DISCOUNT_VALUE_CONSTRAINTS[discountType];

  const updateAction = (field: keyof PromotionAction, value: string | number | boolean) => {
    const updatedActions = [{
      type: discountType as PromotionAction["type"],
      value: field === "value" ? value : discountValue,
    }];
    onChange(updatedActions);
  };

  const renderValueInput = (action: PromotionAction, index: number) => {
    const config =
      ACTION_TYPE_CONFIG[action.type as keyof typeof ACTION_TYPE_CONFIG];

    if (!config) {
      return (
        <input
          type="text"
          value={String(action.value)}
          onChange={(e) => updateAction(index, "value", e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
          placeholder="Value"
        />
      );
    }

    if (config.valueType === "boolean") {
      return (
        <select
          value={action.value === true ? "true" : "false"}
          onChange={(e) =>
            updateAction(index, "value", e.target.value === "true")
          }
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    if (config.valueType === "number") {
      return (
        <input
          type="number"
          value={Number(action.value) || ""}
          onChange={(e) =>
            updateAction(index, "value", parseFloat(e.target.value) || 0)
          }
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
          placeholder={config.valuePlaceholder}
          min={config.valueMin}
          max={"valueMax" in config ? config.valueMax : undefined}
          step="0.01"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(action.value)}
        onChange={(e) => updateAction(index, "value", e.target.value)}
        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
        placeholder={config.valuePlaceholder}
      />
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <i className="fas fa-play mr-2 text-green-600"></i>
          Action Configuration
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Auto-configured based on promotion type
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Action Type
            </label>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {DISCOUNT_TYPE_OPTIONS.find(opt => opt.value === discountType)?.label || discountType}
              </span>
              <i className="fas fa-lock ml-2 text-gray-400"></i>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Action Value
            </label>
            {discountType === "FREE_SHIPPING" || discountType === "FREE_PRODUCT" ? (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <span className="text-sm font-medium text-gray-900 dark:text-white">0 (Auto-set)</span>
              </div>
            ) : (
              <input
                type="number"
                value={discountValue || ""}
                onChange={(e) => updateAction("value", parseFloat(e.target.value) || 0)}
                placeholder={constraints?.placeholder || "Enter value"}
                min={constraints?.min}
                max={constraints?.max}
                step={constraints?.step}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              />
            )}
          </div>
        </div>

        {/* Action Preview */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
            <i className="fas fa-eye mr-2"></i>
            Action Preview
          </h4>
          <div className="text-lg font-semibold text-green-900 dark:text-green-100">
            {discountType === "PERCENT_OFF" && `${discountValue}% off`}
            {discountType === "FIXED_AMOUNT_OFF" && `₹${discountValue} off`}
            {discountType === "FREE_SHIPPING" && "🚚 Free Shipping"}
            {discountType === "BOGO" && `🎁 Buy One Get ${discountValue} Free`}
            {discountType === "FREE_PRODUCT" && "🆓 Free Product"}
          </div>
        </div>
      </div>

      {/* Display action validation errors */}
      {Object.keys(errors).some((key) => key.startsWith("action_")) && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            Action Validation Errors:
          </h4>
          <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
            {Object.entries(errors)
              .filter(([key]) => key.startsWith("action_"))
              .map(([key, error]) => (
                <li key={key}>• {error}</li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Product Lookup Component
const ProductLookup: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}> = ({ value, onChange, placeholder, label }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = MOCK_PRODUCTS.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProduct = getProductInfo(value);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={searchTerm || selectedProduct?.name || value}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
        />
        {selectedProduct && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <i className="fas fa-check-circle text-green-500"></i>
          </div>
        )}
      </div>
      
      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => {
                onChange(product.id);
                setSearchTerm("");
                setShowDropdown(false);
              }}
              className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">ID: {product.id} | SKU: {product.sku}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">₹{product.price}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Stock: {product.availableQuantity}</div>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">
              No products found
            </div>
          )}
        </div>
      )}
      
      {selectedProduct && (
        <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-medium text-green-800 dark:text-green-200">{selectedProduct.name}</div>
              <div className="text-xs text-green-600 dark:text-green-400">₹{selectedProduct.price} | Stock: {selectedProduct.availableQuantity}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setSearchTerm("");
              }}
              className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Promotion Form Component
export const PromotionForm: React.FC<PromotionFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState<Partial<PromotionFormData>>({
    name: "",
    description: "",
    type: "PERCENT_OFF_ITEM",
    code: "",
    auto_apply: false,
    is_active: true,
    start_date: "",
    end_date: "",
    status: "active",
    priority: 1,
    visibility: "public",
    max_redemptions: undefined,
    per_user_limit: undefined,
    stackable: false,
    budget: undefined,
    timezone: "Asia/Kolkata",
    evaluation_expiry_minutes: 15,
    discount_type: "PERCENT_OFF",
    discount_value: undefined,
    product_id: "",
    free_product_id: "",
    product_quantity: 1,
    free_product_quantity: 1,
    conditions: [],
    actions: [],
    ...initialData,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>(
    {},
  );
  const { showError } = useToast();

  const isEditMode = Boolean(initialData?.id);

  // Handle field change
  const handleFieldChange = (fieldKey: string, value: unknown) => {
    setFormData((prev) => {
      const newData = { ...prev, [fieldKey]: value };
      
      // Auto-select discount type based on promotion type
      if (fieldKey === "type" && value) {
        const discountType = PROMOTION_TYPE_TO_DISCOUNT_TYPE[value as string];
        if (discountType) {
          newData.discount_type = discountType;
          
          // Set default discount value based on type
          if (discountType === "FREE_SHIPPING" || discountType === "FREE_PRODUCT") {
            newData.discount_value = 0;
          }
        }
      }
      
      // Calculate max redemptions and per user limit when budget, product price, or discount value changes
      if (["budget", "product_price", "discount_value"].includes(fieldKey)) {
        const budget = fieldKey === "budget" ? Number(value) : Number(newData.budget);
        const productPrice = fieldKey === "product_price" ? Number(value) : Number(newData.product_price);
        const discountValue = fieldKey === "discount_value" ? Number(value) : Number(newData.discount_value);
        const discountType = PROMOTION_TYPE_TO_DISCOUNT_TYPE[newData.type as string];
        
        if (budget && productPrice && discountType) {
          const maxRedemptions = calculateMaxRedemptions(budget, productPrice, discountValue, discountType);
          const perUserLimit = calculatePerUserLimit(maxRedemptions);
          
          newData.max_redemptions = maxRedemptions;
          newData.per_user_limit = perUserLimit;
        }
      }
      
      return newData;
    });

    setTouchedFields((prev) => ({ ...prev, [fieldKey]: true }));

    // Clear error for this field
    if (errors[fieldKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = (): Record<string, string> => {
    const validationErrors: Record<string, string> = {};

    PROMOTION_FIELDS.forEach((field) => {
      const value = formData[field.key as keyof PromotionFormData];

      if (field.required) {
        if (value === undefined || value === null || value === "") {
          validationErrors[field.key] = `${field.label} is required`;
        }
      }

      // Additional validations for discount value
      if (
        field.key === "discount_value" &&
        value !== undefined &&
        value !== null
      ) {
        const numValue = Number(value);
        const discountType = PROMOTION_TYPE_TO_DISCOUNT_TYPE[formData.type as string];
        const constraints = DISCOUNT_VALUE_CONSTRAINTS[discountType];
        
        if (isNaN(numValue)) {
          validationErrors[field.key] = "Discount value must be a valid number";
        } else if (constraints) {
          if (numValue < constraints.min) {
            validationErrors[field.key] = `Discount value must be at least ${constraints.min}`;
          } else if (numValue > constraints.max) {
            validationErrors[field.key] = `Discount value must be at most ${constraints.max}`;
          }
        }
      }

      // Additional validations for product quantities
      if (field.key === "product_quantity" || fieldKey === "free_product_quantity") {
        const productId = field.key === "product_quantity" ? formData.product_id : formData.free_product_id;
        const quantity = Number(value);
        
        if (productId && quantity) {
          const validation = validateProductQuantity(productId as string, quantity);
          if (!validation.valid) {
            validationErrors[field.key] = validation.message || "Invalid quantity";
          }
        }
      }

      if ((field.key === "start_date" || field.key === "end_date") && value) {
        const startDate = new Date(formData.start_date || "");
        const endDate = new Date(formData.end_date || "");
        if (startDate && endDate && startDate >= endDate) {
          validationErrors[field.key] = "End date must be after start date";
        }
      }

      // Validate JSON fields
      if (field.type === "json" && value && typeof value === "string") {
        try {
          JSON.parse(value);
        } catch {
          validationErrors[field.key] = "Invalid JSON format";
        }
      }
    });

    // Validate conditions - all fields required for each row
    if (formData.conditions && formData.conditions.length > 0) {
      formData.conditions.forEach((condition, index) => {
        const hasAnyField =
          condition.attribute ||
          condition.operator ||
          (condition.value !== undefined &&
            condition.value !== null &&
            condition.value !== "");

        if (hasAnyField) {
          // If any field is filled, all fields must be filled
          if (!condition.attribute) {
            validationErrors[`condition_${index}_attribute`] =
              `Row ${index + 1}: Attribute is required when condition is specified`;
          }
          if (!condition.operator) {
            validationErrors[`condition_${index}_operator`] =
              `Row ${index + 1}: Operator is required when condition is specified`;
          }
          if (
            condition.value === undefined ||
            condition.value === null ||
            condition.value === ""
          ) {
            validationErrors[`condition_${index}_value`] =
              `Row ${index + 1}: Value is required when condition is specified`;
          }
        }
      });
    }

    // Validate actions - all fields required for each row
    if (formData.actions && formData.actions.length > 0) {
      formData.actions.forEach((action, index) => {
        const hasAnyField =
          action.type ||
          (action.value !== undefined &&
            action.value !== null &&
            action.value !== "");

        if (hasAnyField) {
          // If any field is filled, all fields must be filled
          if (!action.type) {
            validationErrors[`action_${index}_type`] =
              `Row ${index + 1}: Action type is required when action is specified`;
          }
          if (
            action.value === undefined ||
            action.value === null ||
            action.value === ""
          ) {
            validationErrors[`action_${index}_value`] =
              `Row ${index + 1}: Value is required when action is specified`;
          }
        }
      });
    }

    return validationErrors;
  };

  // Helper function to convert date to UTC epoch format (Unix timestamp in seconds)
  const convertToEpochSeconds = (dateValue: string | null | undefined): number | undefined => {
    if (!dateValue) return undefined;
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return undefined;
      // Convert to UTC epoch seconds (divide by 1000)
      return Math.floor(date.getTime() / 1000);
    } catch {
      return undefined;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm();
    setErrors(validationErrors);
    setTouchedFields(
      Object.fromEntries(PROMOTION_FIELDS.map((f) => [f.key, true])),
    );

    if (Object.keys(validationErrors).length === 0) {
      try {
        const submitData = {
          ...formData,
          // Ensure discount_type is set based on promotion type
          discount_type: PROMOTION_TYPE_TO_DISCOUNT_TYPE[formData.type as string] || formData.discount_type,
          // Convert dates to UTC epoch format (Unix timestamp in seconds) for DB storage
          start_date: convertToEpochSeconds(formData.start_date),
          end_date: convertToEpochSeconds(formData.end_date),
          conditions: formData.conditions || [],
          actions: formData.actions || [],
        };

        await onSubmit(submitData as PromotionFormData);
      } catch (error) {
        console.error("Form submission error:", error);
        showError("Submission failed", "Failed to save promotion");
      }
    }
  };

  // Render field based on type
  const renderField = (field: FieldConfig) => {
    const fieldKey = field.key;
    const value = formData[fieldKey as keyof PromotionFormData];
    const hasError = errors[fieldKey] && touchedFields[fieldKey];
    const promotionType = formData.type as string;
    const discountType = PROMOTION_TYPE_TO_DISCOUNT_TYPE[promotionType];

    // Conditional visibility for product-related fields
    if (fieldKey === "product_id" || fieldKey === "free_product_id") {
      const shouldShow = ["BOGO", "FREE_PRODUCT"].includes(discountType);
      if (!shouldShow) {
        return (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <i className="fas fa-info-circle text-2xl mb-2"></i>
            <p>Product selection is only available for BOGO and Free Product promotions</p>
          </div>
        );
      }
      
      // Show product lookup for applicable fields
      return (
        <ProductLookup
          value={(value as string) || ""}
          onChange={(newValue) => handleFieldChange(fieldKey, newValue)}
          placeholder={field.placeholder || ""}
          label={field.label}
        />
      );
    }

    // Special handling for product quantity fields
    if (fieldKey === "product_quantity" || fieldKey === "free_product_quantity") {
      const shouldShow = ["BOGO", "FREE_PRODUCT"].includes(discountType);
      if (!shouldShow) {
        return (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <i className="fas fa-info-circle text-2xl mb-2"></i>
            <p>Quantity selection is only available for BOGO and Free Product promotions</p>
          </div>
        );
      }

      const productId = fieldKey === "product_quantity" ? formData.product_id : formData.free_product_id;
      const product = getProductInfo(productId as string);
      
      return (
        <div>
          <input
            type="number"
            id={fieldKey}
            value={(value as number) || ""}
            onChange={(e) => {
              const newQuantity = parseInt(e.target.value) || 0;
              handleFieldChange(fieldKey, newQuantity);
            }}
            placeholder={field.placeholder}
            min={field.min}
            max={product?.availableQuantity || field.max}
            step={field.step}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200 ${
              hasError ? "border-red-500 ring-2 ring-red-200" : "border-gray-300"
            }`}
          />
          {product && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <i className="fas fa-box mr-1"></i>
              Available: {product.availableQuantity} units
            </div>
          )}
          {product && (value as number) > (product.availableQuantity || 0) && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              <i className="fas fa-exclamation-triangle mr-1"></i>
              Quantity exceeds available stock
            </div>
          )}
        </div>
      );
    }

    // Special handling for discount value field - hide for certain types
    if (fieldKey === "discount_value") {
      const constraints = DISCOUNT_VALUE_CONSTRAINTS[discountType];
      
      // Hide for FREE_SHIPPING and FREE_PRODUCT
      if (discountType === "FREE_SHIPPING" || discountType === "FREE_PRODUCT") {
        return (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <i className="fas fa-info-circle text-2xl mb-2"></i>
            <p>Discount value is automatically set to 0 for this promotion type</p>
          </div>
        );
      }

      // Show with constraints for other types
      return (
        <input
          type="number"
          id={fieldKey}
          value={(value as number) || ""}
          onChange={(e) =>
            handleFieldChange(fieldKey, parseFloat(e.target.value) || 0)
          }
          placeholder={constraints?.placeholder || "Enter discount value"}
          min={constraints?.min}
          max={constraints?.max}
          step={constraints?.step}
          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200 ${
            hasError ? "border-red-500 ring-2 ring-red-200" : "border-gray-300"
          }`}
        />
      );
    }

    const commonProps = {
      id: fieldKey,
      className: `w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200 ${
        hasError ? "border-red-500 ring-2 ring-red-200" : "border-gray-300"
      }`,
    };

    switch (field.type) {
      case "textarea":
        return (
          <textarea
            {...commonProps}
            value={(value as string) || ""}
            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
          />
        );

      case "select":
        return (
          <select
            {...commonProps}
            value={(value as string) || ""}
            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "number":
        return (
          <input
            type="number"
            {...commonProps}
            value={(value as number) || ""}
            onChange={(e) =>
              handleFieldChange(fieldKey, parseFloat(e.target.value) || 0)
            }
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        );

      case "boolean":
        return (
          <div
            className="flex items-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl cursor-pointer hover:from-indigo-50 hover:to-indigo-100 dark:hover:from-indigo-900/20 dark:hover:to-indigo-800/20 transition-all duration-200"
            onClick={() => handleFieldChange(fieldKey, !value)}
          >
            <div className="flex items-center flex-1">
              <div
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  value ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-500"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${
                    value ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </div>
              <div className="ml-4">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {field.label}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {value ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
            {Boolean(value) && (
              <span className="px-3 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full font-medium">
                Enabled
              </span>
            )}
          </div>
        );

      case "datetime": {
        const formatDateTimeForInput = (dateValue: string | null): string => {
          if (!dateValue) return "";
          try {
            const utcDate = new Date(dateValue);
            if (isNaN(utcDate.getTime())) return "";
            const year = utcDate.getFullYear();
            const month = String(utcDate.getMonth() + 1).padStart(2, "0");
            const day = String(utcDate.getDate()).padStart(2, "0");
            const hours = String(utcDate.getHours()).padStart(2, "0");
            const minutes = String(utcDate.getMinutes()).padStart(2, "0");
            return `${year}-${month}-${day}T${hours}:${minutes}`;
          } catch {
            return "";
          }
        };

        return (
          <div className="relative">
            <input
              type="datetime-local"
              {...commonProps}
              value={formatDateTimeForInput(value as string)}
              onChange={(e) => {
                const newValue = e.target.value;
                if (newValue) {
                  const [datePart, timePart] = newValue.split("T");
                  const [year, month, day] = datePart.split("-").map(Number);
                  const [hours, minutes] = timePart.split(":").map(Number);
                  const localDate = new Date(
                    year,
                    month - 1,
                    day,
                    hours,
                    minutes || 0,
                  );
                  handleFieldChange(fieldKey, localDate.toISOString());
                } else {
                  handleFieldChange(fieldKey, "");
                }
              }}
            />
            {Boolean(value) && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Scheduled for: {new Date(value as string).toLocaleString()}
              </div>
            )}
          </div>
        );
      }

      case "json":
        return (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            <i className="fas fa-info-circle text-2xl mb-2"></i>
            <p>JSON fields are now managed in separate sections below.</p>
          </div>
        );

      default:
        return (
          <input
            type="text"
            {...commonProps}
            value={(value as string) || ""}
            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROMOTION_FIELDS.map((field) => (
            <div
              key={field.key}
              className={field.type === "textarea" ? "md:col-span-2" : ""}
            >
              <label
                htmlFor={field.key}
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
              >
                <i
                  className={`fas fa-${getFieldIcon(field.key)} mr-2 text-indigo-600`}
                ></i>
                {field.label}{" "}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              {renderField(field)}
              {errors[field.key] && touchedFields[field.key] && (
                <p className="mt-2 text-sm text-red-600 flex items-center bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  {errors[field.key]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Conditions Section */}
        <div className="mt-8">
          <ConditionManager
            conditions={formData.conditions || []}
            onChange={(conditions) =>
              setFormData((prev) => ({ ...prev, conditions }))
            }
            errors={errors}
          />
        </div>

        {/* Product Information Preview */}
        {(formData.product_id || formData.free_product_id) && (
          <div className="mt-8">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
              <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center">
                <i className="fas fa-box mr-2"></i>
                Product Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.product_id && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                    <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Main Product</div>
                    {(() => {
                      const product = getProductInfo(formData.product_id as string);
                      return product ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">ID: {product.id} | SKU: {product.sku}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Price: ₹{product.price} | Stock: {product.availableQuantity}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Quantity: {formData.product_quantity || 1}</div>
                        </div>
                      ) : (
                        <div className="text-gray-500 dark:text-gray-400">Product not found</div>
                      );
                    })()}
                  </div>
                )}
                {formData.free_product_id && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                    <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Free Product</div>
                    {(() => {
                      const product = getProductInfo(formData.free_product_id as string);
                      return product ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">ID: {product.id} | SKU: {product.sku}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Price: ₹{product.price} | Stock: {product.availableQuantity}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Quantity: {formData.free_product_quantity || 1}</div>
                        </div>
                      ) : (
                        <div className="text-gray-500 dark:text-gray-400">Product not found</div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Budget Calculation Preview */}
        {(formData.budget && formData.product_price && formData.discount_value) && (
          <div className="mt-8">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
                <i className="fas fa-calculator mr-2"></i>
                Budget Calculation Preview
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Budget Amount</div>
                  <div className="text-xl font-bold text-blue-900 dark:text-blue-100">₹{formData.budget}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Max Redemptions</div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{formData.max_redemptions || 0}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Per User Limit</div>
                  <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{formData.per_user_limit || 0}</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <i className="fas fa-info-circle mr-1"></i>
                Calculations: Max Redemptions = Budget ÷ Effective Price, Per User Limit = 10% of Max Redemptions
              </div>
            </div>
          </div>
        )}

        {/* Actions Section */}
        <div className="mt-8">
          <ActionManager
            actions={formData.actions || []}
            onChange={(actions) =>
              setFormData((prev) => ({ ...prev, actions }))
            }
            errors={errors}
            promotionType={formData.type as string}
            discountValue={formData.discount_value as number}
          />
        </div>

        <div className="flex justify-end space-x-4 mt-8">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all duration-200 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl disabled:opacity-50 transition-all duration-200 font-medium flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <i className="fas fa-save mr-2"></i>
                {isEditMode ? "Update Promotion" : "Create Promotion"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
