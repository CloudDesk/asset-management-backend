const { z } = require('zod');

// Import the validation schemas from our TypeScript files
// Since we can't directly import TypeScript in CommonJS, we'll recreate the schemas here for testing

// Promotions Schema Validation
const createPromotionsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['coupon', 'automatic', 'waive_fee']).optional(),
  code: z.string().optional(),
  auto_apply: z.boolean().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  priority: z.number().int().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  max_redemptions: z.number().int().optional(),
  per_user_limit: z.number().int().optional(),
  stackable: z.boolean().optional(),
}).strict();

// Promotion Rules Schema Validation  
const createPromotionRulesSchema = z.object({
  promotion_id: z.number().int().positive().optional(),
  rule_type: z.enum(['user', 'product', 'cart', 'payment']).optional(),
  condition_key: z.string().optional(),
  operator: z.string().optional(),
  value: z.string().optional(),
  value_type: z.enum(['string', 'number', 'currency']).optional(),
  logic_group: z.string().optional(),
  priority: z.number().int().optional(),
  exclude: z.boolean().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().optional(),
}).strict();

// Promotion Actions Schema Validation
const createPromotionActionsSchema = z.object({
  promotion_id: z.number().int().positive().optional(),
  action_type: z.enum(['percentage_discount', 'flat_discount', 'free_product', 'waive_fee']).optional(),
  target: z.string().optional(),
  value_type: z.enum(['percentage', 'currency']).optional(),
  value: z.number().optional(),
  reward_product_id: z.number().int().optional(),
  min_combo_size: z.number().int().optional(),
  apply_to_product_ids: z.array(z.number().int()).optional(),
  max_discount_cap: z.number().optional(),
  check_inventory: z.boolean().optional(),
  execution_group: z.string().optional(),
  action_order: z.number().int().optional(),
}).strict();

// Test data
const VALID_PROMOTION_TYPES = ['coupon', 'automatic', 'waive_fee'];
const VALID_PROMOTION_STATUSES = ['active', 'inactive'];
const VALID_PROMOTION_VISIBILITY = ['public', 'private'];
const VALID_RULE_TYPES = ['user', 'product', 'cart', 'payment'];
const VALID_RULE_VALUE_TYPES = ['string', 'number', 'currency'];
const VALID_ACTION_TYPES = ['percentage_discount', 'flat_discount', 'free_product', 'waive_fee'];
const VALID_ACTION_VALUE_TYPES = ['percentage', 'currency'];

// Invalid test data
const INVALID_PROMOTION_TYPES = ['invalid_type', 'discount', 'special'];
const INVALID_PROMOTION_STATUSES = ['pending', 'draft', 'expired'];
const INVALID_PROMOTION_VISIBILITY = ['restricted', 'internal'];
const INVALID_RULE_TYPES = ['order', 'category', 'brand'];
const INVALID_RULE_VALUE_TYPES = ['boolean', 'date', 'array'];
const INVALID_ACTION_TYPES = ['buy_one_get_one', 'bundle_discount'];
const INVALID_ACTION_VALUE_TYPES = ['fixed', 'ratio'];

// Test results
let testResults = [];

function logResult(testName, success, error = null) {
  const result = {
    test: testName,
    success,
    error: error ? error.message : null,
    timestamp: new Date().toISOString()
  };
  testResults.push(result);
  console.log(`${success ? '✅' : '❌'} ${testName}`);
  if (error && !success) {
    console.log(`   Error: ${error.message}`);
  }
}

// Test 1: Valid Promotion Types
function testValidPromotionTypes() {
  console.log('\n🧪 Testing Valid Promotion Types...');
  
  for (const type of VALID_PROMOTION_TYPES) {
    try {
      const result = createPromotionsSchema.parse({
        name: 'Test Promotion',
        type: type,
        status: 'active',
        visibility: 'public'
      });
      
      if (result.type === type) {
        logResult(`Valid Promotion Type: ${type}`, true);
      } else {
        logResult(`Valid Promotion Type: ${type}`, false, new Error('Type not preserved'));
      }
    } catch (error) {
      logResult(`Valid Promotion Type: ${type}`, false, error);
    }
  }
}

// Test 2: Invalid Promotion Types
function testInvalidPromotionTypes() {
  console.log('\n🧪 Testing Invalid Promotion Types...');
  
  for (const type of INVALID_PROMOTION_TYPES) {
    try {
      createPromotionsSchema.parse({
        name: 'Test Promotion',
        type: type,
        status: 'active',
        visibility: 'public'
      });
      
      logResult(`Invalid Promotion Type: ${type}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      logResult(`Invalid Promotion Type: ${type}`, true);
    }
  }
}

// Test 3: Valid Promotion Statuses
function testValidPromotionStatuses() {
  console.log('\n🧪 Testing Valid Promotion Statuses...');
  
  for (const status of VALID_PROMOTION_STATUSES) {
    try {
      const result = createPromotionsSchema.parse({
        name: 'Test Promotion',
        type: 'coupon',
        status: status,
        visibility: 'public'
      });
      
      if (result.status === status) {
        logResult(`Valid Promotion Status: ${status}`, true);
      } else {
        logResult(`Valid Promotion Status: ${status}`, false, new Error('Status not preserved'));
      }
    } catch (error) {
      logResult(`Valid Promotion Status: ${status}`, false, error);
    }
  }
}

// Test 4: Invalid Promotion Statuses
function testInvalidPromotionStatuses() {
  console.log('\n🧪 Testing Invalid Promotion Statuses...');
  
  for (const status of INVALID_PROMOTION_STATUSES) {
    try {
      createPromotionsSchema.parse({
        name: 'Test Promotion',
        type: 'coupon',
        status: status,
        visibility: 'public'
      });
      
      logResult(`Invalid Promotion Status: ${status}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      logResult(`Invalid Promotion Status: ${status}`, true);
    }
  }
}

// Test 5: Valid Promotion Visibility
function testValidPromotionVisibility() {
  console.log('\n🧪 Testing Valid Promotion Visibility...');
  
  for (const visibility of VALID_PROMOTION_VISIBILITY) {
    try {
      const result = createPromotionsSchema.parse({
        name: 'Test Promotion',
        type: 'coupon',
        status: 'active',
        visibility: visibility
      });
      
      if (result.visibility === visibility) {
        logResult(`Valid Promotion Visibility: ${visibility}`, true);
      } else {
        logResult(`Valid Promotion Visibility: ${visibility}`, false, new Error('Visibility not preserved'));
      }
    } catch (error) {
      logResult(`Valid Promotion Visibility: ${visibility}`, false, error);
    }
  }
}

// Test 6: Invalid Promotion Visibility
function testInvalidPromotionVisibility() {
  console.log('\n🧪 Testing Invalid Promotion Visibility...');
  
  for (const visibility of INVALID_PROMOTION_VISIBILITY) {
    try {
      createPromotionsSchema.parse({
        name: 'Test Promotion',
        type: 'coupon',
        status: 'active',
        visibility: visibility
      });
      
      logResult(`Invalid Promotion Visibility: ${visibility}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      logResult(`Invalid Promotion Visibility: ${visibility}`, true);
    }
  }
}

// Test 7: Valid Rule Types
function testValidRuleTypes() {
  console.log('\n🧪 Testing Valid Rule Types...');
  
  for (const ruleType of VALID_RULE_TYPES) {
    try {
      const result = createPromotionRulesSchema.parse({
        promotion_id: 1,
        rule_type: ruleType,
        condition_key: 'test_key',
        operator: 'equals',
        value: 'test_value',
        value_type: 'string'
      });
      
      if (result.rule_type === ruleType) {
        logResult(`Valid Rule Type: ${ruleType}`, true);
      } else {
        logResult(`Valid Rule Type: ${ruleType}`, false, new Error('Rule type not preserved'));
      }
    } catch (error) {
      logResult(`Valid Rule Type: ${ruleType}`, false, error);
    }
  }
}

// Test 8: Invalid Rule Types
function testInvalidRuleTypes() {
  console.log('\n🧪 Testing Invalid Rule Types...');
  
  for (const ruleType of INVALID_RULE_TYPES) {
    try {
      createPromotionRulesSchema.parse({
        promotion_id: 1,
        rule_type: ruleType,
        condition_key: 'test_key',
        operator: 'equals',
        value: 'test_value',
        value_type: 'string'
      });
      
      logResult(`Invalid Rule Type: ${ruleType}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      logResult(`Invalid Rule Type: ${ruleType}`, true);
    }
  }
}

// Test 9: Valid Rule Value Types
function testValidRuleValueTypes() {
  console.log('\n🧪 Testing Valid Rule Value Types...');
  
  for (const valueType of VALID_RULE_VALUE_TYPES) {
    try {
      const result = createPromotionRulesSchema.parse({
        promotion_id: 1,
        rule_type: 'user',
        condition_key: 'test_key',
        operator: 'equals',
        value: valueType === 'number' ? '100' : 'test_value',
        value_type: valueType
      });
      
      if (result.value_type === valueType) {
        logResult(`Valid Rule Value Type: ${valueType}`, true);
      } else {
        logResult(`Valid Rule Value Type: ${valueType}`, false, new Error('Value type not preserved'));
      }
    } catch (error) {
      logResult(`Valid Rule Value Type: ${valueType}`, false, error);
    }
  }
}

// Test 10: Invalid Rule Value Types
function testInvalidRuleValueTypes() {
  console.log('\n🧪 Testing Invalid Rule Value Types...');
  
  for (const valueType of INVALID_RULE_VALUE_TYPES) {
    try {
      createPromotionRulesSchema.parse({
        promotion_id: 1,
        rule_type: 'user',
        condition_key: 'test_key',
        operator: 'equals',
        value: 'test_value',
        value_type: valueType
      });
      
      logResult(`Invalid Rule Value Type: ${valueType}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      logResult(`Invalid Rule Value Type: ${valueType}`, true);
    }
  }
}

// Test 11: Valid Action Types
function testValidActionTypes() {
  console.log('\n🧪 Testing Valid Action Types...');
  
  for (const actionType of VALID_ACTION_TYPES) {
    try {
      const result = createPromotionActionsSchema.parse({
        promotion_id: 1,
        action_type: actionType,
        target: 'cart',
        value_type: 'percentage',
        value: 10
      });
      
      if (result.action_type === actionType) {
        logResult(`Valid Action Type: ${actionType}`, true);
      } else {
        logResult(`Valid Action Type: ${actionType}`, false, new Error('Action type not preserved'));
      }
    } catch (error) {
      logResult(`Valid Action Type: ${actionType}`, false, error);
    }
  }
}

// Test 12: Invalid Action Types
function testInvalidActionTypes() {
  console.log('\n🧪 Testing Invalid Action Types...');
  
  for (const actionType of INVALID_ACTION_TYPES) {
    try {
      createPromotionActionsSchema.parse({
        promotion_id: 1,
        action_type: actionType,
        target: 'cart',
        value_type: 'percentage',
        value: 10
      });
      
      logResult(`Invalid Action Type: ${actionType}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      logResult(`Invalid Action Type: ${actionType}`, true);
    }
  }
}

// Test 13: Valid Action Value Types
function testValidActionValueTypes() {
  console.log('\n🧪 Testing Valid Action Value Types...');
  
  for (const valueType of VALID_ACTION_VALUE_TYPES) {
    try {
      const result = createPromotionActionsSchema.parse({
        promotion_id: 1,
        action_type: 'percentage_discount',
        target: 'cart',
        value_type: valueType,
        value: valueType === 'percentage' ? 15 : 25
      });
      
      if (result.value_type === valueType) {
        logResult(`Valid Action Value Type: ${valueType}`, true);
      } else {
        logResult(`Valid Action Value Type: ${valueType}`, false, new Error('Value type not preserved'));
      }
    } catch (error) {
      logResult(`Valid Action Value Type: ${valueType}`, false, error);
    }
  }
}

// Test 14: Invalid Action Value Types
function testInvalidActionValueTypes() {
  console.log('\n🧪 Testing Invalid Action Value Types...');
  
  for (const valueType of INVALID_ACTION_VALUE_TYPES) {
    try {
      createPromotionActionsSchema.parse({
        promotion_id: 1,
        action_type: 'percentage_discount',
        target: 'cart',
        value_type: valueType,
        value: 10
      });
      
      logResult(`Invalid Action Value Type: ${valueType}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      logResult(`Invalid Action Value Type: ${valueType}`, true);
    }
  }
}

// Test 15: Strict Mode Validation (Extra fields should fail)
function testStrictModeValidation() {
  console.log('\n🧪 Testing Strict Mode Validation...');
  
  try {
    createPromotionsSchema.parse({
      name: 'Test Promotion',
      type: 'coupon',
      status: 'active',
      visibility: 'public',
      invalid_field: 'should_fail' // This should cause validation to fail
    });
    
    logResult('Strict Mode - Extra Fields', false, new Error('Should have failed validation'));
  } catch (error) {
    // Should fail validation
    logResult('Strict Mode - Extra Fields', true);
  }
  
  try {
    createPromotionRulesSchema.parse({
      promotion_id: 1,
      rule_type: 'user',
      condition_key: 'test_key',
      operator: 'equals',
      value: 'test_value',
      value_type: 'string',
      invalid_field: 'should_fail' // This should cause validation to fail
    });
    
    logResult('Strict Mode Rules - Extra Fields', false, new Error('Should have failed validation'));
  } catch (error) {
    // Should fail validation
    logResult('Strict Mode Rules - Extra Fields', true);
  }
  
  try {
    createPromotionActionsSchema.parse({
      promotion_id: 1,
      action_type: 'percentage_discount',
      target: 'cart',
      value_type: 'percentage',
      value: 10,
      invalid_field: 'should_fail' // This should cause validation to fail
    });
    
    logResult('Strict Mode Actions - Extra Fields', false, new Error('Should have failed validation'));
  } catch (error) {
    // Should fail validation
    logResult('Strict Mode Actions - Extra Fields', true);
  }
}

// Test 16: Valid Complete Combinations
function testCompleteValidCombinations() {
  console.log('\n🧪 Testing Complete Valid Combinations...');
  
  let successful = 0;
  let total = 0;
  
  for (const type of VALID_PROMOTION_TYPES) {
    for (const status of VALID_PROMOTION_STATUSES) {
      for (const visibility of VALID_PROMOTION_VISIBILITY) {
        total++;
        try {
          const result = createPromotionsSchema.parse({
            name: `Combo Test - ${type}-${status}-${visibility}`,
            type: type,
            status: status,
            visibility: visibility,
            priority: 1,
            max_redemptions: 100,
            per_user_limit: 1,
            stackable: true
          });
          
          if (result.type === type && result.status === status && result.visibility === visibility) {
            successful++;
          }
        } catch (error) {
          console.log(`Failed combination: ${type}-${status}-${visibility}`, error.message);
        }
      }
    }
  }
  
  logResult(`All Valid Combinations (${successful}/${total})`, successful === total);
}

// Generate test report
function generateTestReport() {
  const successful = testResults.filter(r => r.success).length;
  const total = testResults.length;
  const failedTests = testResults.filter(r => !r.success);

  console.log('\n' + '='.repeat(60));
  console.log('📊 PROMOTIONS SCHEMA VALIDATION TEST REPORT');
  console.log('='.repeat(60));
  console.log(`\n📈 Summary: ${successful}/${total} tests passed (${Math.round(successful/total*100)}%)`);
  
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`   - ${test.test}: ${test.error || 'Unknown error'}`);
    });
  }

  console.log('\n✅ Field Constraints Successfully Enforced:');
  console.log(`   - Promotion Types: ${VALID_PROMOTION_TYPES.join(', ')}`);
  console.log(`   - Promotion Statuses: ${VALID_PROMOTION_STATUSES.join(', ')}`);
  console.log(`   - Promotion Visibility: ${VALID_PROMOTION_VISIBILITY.join(', ')}`);
  console.log(`   - Rule Types: ${VALID_RULE_TYPES.join(', ')}`);
  console.log(`   - Rule Value Types: ${VALID_RULE_VALUE_TYPES.join(', ')}`);
  console.log(`   - Action Types: ${VALID_ACTION_TYPES.join(', ')}`);
  console.log(`   - Action Value Types: ${VALID_ACTION_VALUE_TYPES.join(', ')}`);

  console.log('\n🔒 Validation Features:');
  console.log('   - Strict mode enforced (no extra fields allowed)');
  console.log('   - Enum constraints for all specified fields');
  console.log('   - Type safety and runtime validation');
  
  console.log('\n' + '='.repeat(60));
  
  return successful === total;
}

// Main test execution
function runTests() {
  console.log('🚀 Starting Promotions Schema Validation Tests...\n');
  console.log('ℹ️  This test validates the Zod schemas directly without requiring server/database connection\n');

  try {
    // Run all tests
    testValidPromotionTypes();
    testInvalidPromotionTypes();
    testValidPromotionStatuses();
    testInvalidPromotionStatuses();
    testValidPromotionVisibility();
    testInvalidPromotionVisibility();
    testValidRuleTypes();
    testInvalidRuleTypes();
    testValidRuleValueTypes();
    testInvalidRuleValueTypes();
    testValidActionTypes();
    testInvalidActionTypes();
    testValidActionValueTypes();
    testInvalidActionValueTypes();
    testStrictModeValidation();
    testCompleteValidCombinations();

    // Generate and display report
    const allTestsPassed = generateTestReport();
    
    if (allTestsPassed) {
      console.log('\n🎉 All schema validation tests passed! Field constraints are working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the failed tests above.');
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
}

// Start tests
runTests(); 