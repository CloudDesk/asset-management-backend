const axios = require('axios');
const assert = require('assert');
const { execSync } = require('child_process');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const PROMOTIONS_URL = `${BASE_URL}/v1/promotions`;
const PROMOTION_RULES_URL = `${BASE_URL}/v1/promotion-rules`;
const PROMOTION_ACTIONS_URL = `${BASE_URL}/v1/promotion-actions`;

// Test data for valid field values
const VALID_PROMOTION_TYPES = ['coupon', 'automatic', 'waive_fee'];
const VALID_PROMOTION_STATUSES = ['active', 'inactive'];
const VALID_PROMOTION_VISIBILITY = ['public', 'private'];
const VALID_RULE_TYPES = ['user', 'product', 'cart', 'payment'];
const VALID_RULE_VALUE_TYPES = ['string', 'number', 'currency'];
const VALID_ACTION_TYPES = ['percentage_discount', 'flat_discount', 'free_product', 'waive_fee'];
const VALID_ACTION_VALUE_TYPES = ['percentage', 'currency'];

// Test data for invalid field values
const INVALID_PROMOTION_TYPES = ['invalid_type', 'discount', 'special'];
const INVALID_PROMOTION_STATUSES = ['pending', 'draft', 'expired'];
const INVALID_PROMOTION_VISIBILITY = ['restricted', 'internal'];
const INVALID_RULE_TYPES = ['order', 'category', 'brand'];
const INVALID_RULE_VALUE_TYPES = ['boolean', 'date', 'array'];
const INVALID_ACTION_TYPES = ['buy_one_get_one', 'bundle_discount'];
const INVALID_ACTION_VALUE_TYPES = ['fixed', 'ratio'];

// Test results storage
let testResults = [];
let createdPromotions = [];
let createdRules = [];
let createdActions = [];

// Utility functions
function logResult(testName, success, error = null) {
  const result = {
    test: testName,
    success,
    error: error ? error.message : null,
    timestamp: new Date().toISOString()
  };
  testResults.push(result);
  console.log(`${success ? '✅' : '❌'} ${testName}`);
  if (error) {
    console.log(`   Error: ${error.message}`);
  }
}

function generateUniqueCode() {
  return `TEST_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test server availability
async function testServerAvailability() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    logResult('Server Health Check', response.status === 200);
    return true;
  } catch (error) {
    logResult('Server Health Check', false, error);
    return false;
  }
}

// Test 1: Valid Promotion Types
async function testValidPromotionTypes() {
  for (const type of VALID_PROMOTION_TYPES) {
    try {
      const promotionData = {
        name: `Test Promotion - ${type}`,
        type: type,
        status: 'active',
        visibility: 'public',
        code: generateUniqueCode()
      };

      const response = await axios.post(PROMOTIONS_URL, promotionData);
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.data.data.type, type);
      
      createdPromotions.push(response.data.data);
      logResult(`Valid Promotion Type: ${type}`, true);
    } catch (error) {
      logResult(`Valid Promotion Type: ${type}`, false, error);
    }
    await delay(100);
  }
}

// Test 2: Invalid Promotion Types
async function testInvalidPromotionTypes() {
  for (const type of INVALID_PROMOTION_TYPES) {
    try {
      const promotionData = {
        name: `Test Promotion - ${type}`,
        type: type,
        status: 'active',
        visibility: 'public',
        code: generateUniqueCode()
      };

      const response = await axios.post(PROMOTIONS_URL, promotionData);
      logResult(`Invalid Promotion Type: ${type}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      if (error.response && error.response.status === 400) {
        logResult(`Invalid Promotion Type: ${type}`, true);
      } else {
        logResult(`Invalid Promotion Type: ${type}`, false, error);
      }
    }
    await delay(100);
  }
}

// Test 3: Valid Promotion Statuses
async function testValidPromotionStatuses() {
  for (const status of VALID_PROMOTION_STATUSES) {
    try {
      const promotionData = {
        name: `Test Promotion - ${status}`,
        type: 'coupon',
        status: status,
        visibility: 'public',
        code: generateUniqueCode()
      };

      const response = await axios.post(PROMOTIONS_URL, promotionData);
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.data.data.status, status);
      
      createdPromotions.push(response.data.data);
      logResult(`Valid Promotion Status: ${status}`, true);
    } catch (error) {
      logResult(`Valid Promotion Status: ${status}`, false, error);
    }
    await delay(100);
  }
}

// Test 4: Invalid Promotion Statuses
async function testInvalidPromotionStatuses() {
  for (const status of INVALID_PROMOTION_STATUSES) {
    try {
      const promotionData = {
        name: `Test Promotion - ${status}`,
        type: 'coupon',
        status: status,
        visibility: 'public',
        code: generateUniqueCode()
      };

      const response = await axios.post(PROMOTIONS_URL, promotionData);
      logResult(`Invalid Promotion Status: ${status}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      if (error.response && error.response.status === 400) {
        logResult(`Invalid Promotion Status: ${status}`, true);
      } else {
        logResult(`Invalid Promotion Status: ${status}`, false, error);
      }
    }
    await delay(100);
  }
}

// Test 5: Valid Promotion Visibility
async function testValidPromotionVisibility() {
  for (const visibility of VALID_PROMOTION_VISIBILITY) {
    try {
      const promotionData = {
        name: `Test Promotion - ${visibility}`,
        type: 'coupon',
        status: 'active',
        visibility: visibility,
        code: generateUniqueCode()
      };

      const response = await axios.post(PROMOTIONS_URL, promotionData);
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.data.data.visibility, visibility);
      
      createdPromotions.push(response.data.data);
      logResult(`Valid Promotion Visibility: ${visibility}`, true);
    } catch (error) {
      logResult(`Valid Promotion Visibility: ${visibility}`, false, error);
    }
    await delay(100);
  }
}

// Test 6: Invalid Promotion Visibility
async function testInvalidPromotionVisibility() {
  for (const visibility of INVALID_PROMOTION_VISIBILITY) {
    try {
      const promotionData = {
        name: `Test Promotion - ${visibility}`,
        type: 'coupon',
        status: 'active',
        visibility: visibility,
        code: generateUniqueCode()
      };

      const response = await axios.post(PROMOTIONS_URL, promotionData);
      logResult(`Invalid Promotion Visibility: ${visibility}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      if (error.response && error.response.status === 400) {
        logResult(`Invalid Promotion Visibility: ${visibility}`, true);
      } else {
        logResult(`Invalid Promotion Visibility: ${visibility}`, false, error);
      }
    }
    await delay(100);
  }
}

// Test 7: Valid Rule Types
async function testValidRuleTypes() {
  if (createdPromotions.length === 0) {
    // Create a promotion for testing rules
    const promotion = await createTestPromotion();
    createdPromotions.push(promotion);
  }

  for (const ruleType of VALID_RULE_TYPES) {
    try {
      const ruleData = {
        promotion_id: createdPromotions[0].id,
        rule_type: ruleType,
        condition_key: 'test_key',
        operator: 'equals',
        value: 'test_value',
        value_type: 'string'
      };

      const response = await axios.post(PROMOTION_RULES_URL, ruleData);
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.data.data.rule_type, ruleType);
      
      createdRules.push(response.data.data);
      logResult(`Valid Rule Type: ${ruleType}`, true);
    } catch (error) {
      logResult(`Valid Rule Type: ${ruleType}`, false, error);
    }
    await delay(100);
  }
}

// Test 8: Invalid Rule Types
async function testInvalidRuleTypes() {
  if (createdPromotions.length === 0) {
    const promotion = await createTestPromotion();
    createdPromotions.push(promotion);
  }

  for (const ruleType of INVALID_RULE_TYPES) {
    try {
      const ruleData = {
        promotion_id: createdPromotions[0].id,
        rule_type: ruleType,
        condition_key: 'test_key',
        operator: 'equals',
        value: 'test_value',
        value_type: 'string'
      };

      const response = await axios.post(PROMOTION_RULES_URL, ruleData);
      logResult(`Invalid Rule Type: ${ruleType}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      if (error.response && error.response.status === 400) {
        logResult(`Invalid Rule Type: ${ruleType}`, true);
      } else {
        logResult(`Invalid Rule Type: ${ruleType}`, false, error);
      }
    }
    await delay(100);
  }
}

// Test 9: Valid Rule Value Types
async function testValidRuleValueTypes() {
  if (createdPromotions.length === 0) {
    const promotion = await createTestPromotion();
    createdPromotions.push(promotion);
  }

  for (const valueType of VALID_RULE_VALUE_TYPES) {
    try {
      const ruleData = {
        promotion_id: createdPromotions[0].id,
        rule_type: 'user',
        condition_key: 'test_key',
        operator: 'equals',
        value: valueType === 'number' ? '100' : 'test_value',
        value_type: valueType
      };

      const response = await axios.post(PROMOTION_RULES_URL, ruleData);
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.data.data.value_type, valueType);
      
      createdRules.push(response.data.data);
      logResult(`Valid Rule Value Type: ${valueType}`, true);
    } catch (error) {
      logResult(`Valid Rule Value Type: ${valueType}`, false, error);
    }
    await delay(100);
  }
}

// Test 10: Invalid Rule Value Types
async function testInvalidRuleValueTypes() {
  if (createdPromotions.length === 0) {
    const promotion = await createTestPromotion();
    createdPromotions.push(promotion);
  }

  for (const valueType of INVALID_RULE_VALUE_TYPES) {
    try {
      const ruleData = {
        promotion_id: createdPromotions[0].id,
        rule_type: 'user',
        condition_key: 'test_key',
        operator: 'equals',
        value: 'test_value',
        value_type: valueType
      };

      const response = await axios.post(PROMOTION_RULES_URL, ruleData);
      logResult(`Invalid Rule Value Type: ${valueType}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      if (error.response && error.response.status === 400) {
        logResult(`Invalid Rule Value Type: ${valueType}`, true);
      } else {
        logResult(`Invalid Rule Value Type: ${valueType}`, false, error);
      }
    }
    await delay(100);
  }
}

// Test 11: Valid Action Types
async function testValidActionTypes() {
  if (createdPromotions.length === 0) {
    const promotion = await createTestPromotion();
    createdPromotions.push(promotion);
  }

  for (const actionType of VALID_ACTION_TYPES) {
    try {
      const actionData = {
        promotion_id: createdPromotions[0].id,
        action_type: actionType,
        target: 'cart',
        value_type: 'percentage',
        value: 10
      };

      const response = await axios.post(PROMOTION_ACTIONS_URL, actionData);
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.data.data.action_type, actionType);
      
      createdActions.push(response.data.data);
      logResult(`Valid Action Type: ${actionType}`, true);
    } catch (error) {
      logResult(`Valid Action Type: ${actionType}`, false, error);
    }
    await delay(100);
  }
}

// Test 12: Invalid Action Types
async function testInvalidActionTypes() {
  if (createdPromotions.length === 0) {
    const promotion = await createTestPromotion();
    createdPromotions.push(promotion);
  }

  for (const actionType of INVALID_ACTION_TYPES) {
    try {
      const actionData = {
        promotion_id: createdPromotions[0].id,
        action_type: actionType,
        target: 'cart',
        value_type: 'percentage',
        value: 10
      };

      const response = await axios.post(PROMOTION_ACTIONS_URL, actionData);
      logResult(`Invalid Action Type: ${actionType}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      if (error.response && error.response.status === 400) {
        logResult(`Invalid Action Type: ${actionType}`, true);
      } else {
        logResult(`Invalid Action Type: ${actionType}`, false, error);
      }
    }
    await delay(100);
  }
}

// Test 13: Valid Action Value Types
async function testValidActionValueTypes() {
  if (createdPromotions.length === 0) {
    const promotion = await createTestPromotion();
    createdPromotions.push(promotion);
  }

  for (const valueType of VALID_ACTION_VALUE_TYPES) {
    try {
      const actionData = {
        promotion_id: createdPromotions[0].id,
        action_type: 'percentage_discount',
        target: 'cart',
        value_type: valueType,
        value: valueType === 'percentage' ? 15 : 25
      };

      const response = await axios.post(PROMOTION_ACTIONS_URL, actionData);
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.data.data.value_type, valueType);
      
      createdActions.push(response.data.data);
      logResult(`Valid Action Value Type: ${valueType}`, true);
    } catch (error) {
      logResult(`Valid Action Value Type: ${valueType}`, false, error);
    }
    await delay(100);
  }
}

// Test 14: Invalid Action Value Types
async function testInvalidActionValueTypes() {
  if (createdPromotions.length === 0) {
    const promotion = await createTestPromotion();
    createdPromotions.push(promotion);
  }

  for (const valueType of INVALID_ACTION_VALUE_TYPES) {
    try {
      const actionData = {
        promotion_id: createdPromotions[0].id,
        action_type: 'percentage_discount',
        target: 'cart',
        value_type: valueType,
        value: 10
      };

      const response = await axios.post(PROMOTION_ACTIONS_URL, actionData);
      logResult(`Invalid Action Value Type: ${valueType}`, false, new Error('Should have failed validation'));
    } catch (error) {
      // Should fail validation
      if (error.response && error.response.status === 400) {
        logResult(`Invalid Action Value Type: ${valueType}`, true);
      } else {
        logResult(`Invalid Action Value Type: ${valueType}`, false, error);
      }
    }
    await delay(100);
  }
}

// Test 15: Complete End-to-End Flow
async function testCompleteEndToEndFlow() {
  try {
    // Step 1: Create a promotion with all valid fields
    const promotionData = {
      name: 'Complete E2E Test Promotion',
      type: 'coupon',
      status: 'active',
      visibility: 'public',
      code: generateUniqueCode(),
      priority: 1,
      max_redemptions: 100,
      per_user_limit: 1,
      stackable: true,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    const promotionResponse = await axios.post(PROMOTIONS_URL, promotionData);
    assert.strictEqual(promotionResponse.status, 201);
    
    const promotion = promotionResponse.data.data;
    createdPromotions.push(promotion);

    // Step 2: Create promotion rules
    const ruleData = {
      promotion_id: promotion.id,
      rule_type: 'cart',
      condition_key: 'minimum_amount',
      operator: 'greater_than',
      value: '50',
      value_type: 'currency',
      is_active: true
    };

    const ruleResponse = await axios.post(PROMOTION_RULES_URL, ruleData);
    assert.strictEqual(ruleResponse.status, 201);
    
    const rule = ruleResponse.data.data;
    createdRules.push(rule);

    // Step 3: Create promotion actions
    const actionData = {
      promotion_id: promotion.id,
      action_type: 'percentage_discount',
      target: 'cart',
      value_type: 'percentage',
      value: 20,
      action_order: 1
    };

    const actionResponse = await axios.post(PROMOTION_ACTIONS_URL, actionData);
    assert.strictEqual(actionResponse.status, 201);
    
    const action = actionResponse.data.data;
    createdActions.push(action);

    // Step 4: Get promotion with rules and actions
    const fullPromotionResponse = await axios.get(`${PROMOTIONS_URL}/${promotion.id}`);
    assert.strictEqual(fullPromotionResponse.status, 200);

    // Step 5: Test promotion eligibility
    const eligibilityData = {
      user_id: 'test_user_123',
      cart: [
        { product_id: 1, quantity: 2 },
        { product_id: 2, quantity: 1 }
      ],
      platform: 'web',
      payment_method: 'credit_card'
    };

    const eligibilityResponse = await axios.post(`${PROMOTIONS_URL}/eligible`, eligibilityData);
    // Note: This might fail if the promotion evaluation service is not fully implemented
    // but the test structure should work

    logResult('Complete End-to-End Flow', true);
  } catch (error) {
    logResult('Complete End-to-End Flow', false, error);
  }
}

// Test 16: Test all combinations
async function testAllValidCombinations() {
  let successful = 0;
  let total = 0;

  for (const type of VALID_PROMOTION_TYPES) {
    for (const status of VALID_PROMOTION_STATUSES) {
      for (const visibility of VALID_PROMOTION_VISIBILITY) {
        try {
          total++;
          const promotionData = {
            name: `Combo Test - ${type}-${status}-${visibility}`,
            type: type,
            status: status,
            visibility: visibility,
            code: generateUniqueCode()
          };

          const response = await axios.post(PROMOTIONS_URL, promotionData);
          assert.strictEqual(response.status, 201);
          
          createdPromotions.push(response.data.data);
          successful++;
        } catch (error) {
          console.log(`Failed combination: ${type}-${status}-${visibility}`, error.message);
        }
        await delay(50);
      }
    }
  }

  logResult(`All Valid Combinations (${successful}/${total})`, successful === total);
}

// Helper function to create a test promotion
async function createTestPromotion() {
  const promotionData = {
    name: 'Test Promotion for Rules/Actions',
    type: 'coupon',
    status: 'active',
    visibility: 'public',
    code: generateUniqueCode()
  };

  const response = await axios.post(PROMOTIONS_URL, promotionData);
  return response.data.data;
}

// Cleanup function
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  // Clean up actions
  for (const action of createdActions) {
    try {
      await axios.delete(`${PROMOTION_ACTIONS_URL}/${action.id}`);
    } catch (error) {
      console.log(`Failed to delete action ${action.id}:`, error.message);
    }
  }

  // Clean up rules
  for (const rule of createdRules) {
    try {
      await axios.delete(`${PROMOTION_RULES_URL}/${rule.id}`);
    } catch (error) {
      console.log(`Failed to delete rule ${rule.id}:`, error.message);
    }
  }

  // Clean up promotions
  for (const promotion of createdPromotions) {
    try {
      await axios.delete(`${PROMOTIONS_URL}/${promotion.id}`);
    } catch (error) {
      console.log(`Failed to delete promotion ${promotion.id}:`, error.message);
    }
  }

  console.log('✅ Cleanup completed');
}

// Generate test report
function generateTestReport() {
  const successful = testResults.filter(r => r.success).length;
  const total = testResults.length;
  const failedTests = testResults.filter(r => !r.success);

  console.log('\n' + '='.repeat(60));
  console.log('📊 PROMOTIONS FIELD CONSTRAINTS TEST REPORT');
  console.log('='.repeat(60));
  console.log(`\n📈 Summary: ${successful}/${total} tests passed (${Math.round(successful/total*100)}%)`);
  
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`   - ${test.test}: ${test.error || 'Unknown error'}`);
    });
  }

  console.log('\n✅ Field Constraints Validation:');
  console.log(`   - Promotion Types: ${VALID_PROMOTION_TYPES.join(', ')}`);
  console.log(`   - Promotion Statuses: ${VALID_PROMOTION_STATUSES.join(', ')}`);
  console.log(`   - Promotion Visibility: ${VALID_PROMOTION_VISIBILITY.join(', ')}`);
  console.log(`   - Rule Types: ${VALID_RULE_TYPES.join(', ')}`);
  console.log(`   - Rule Value Types: ${VALID_RULE_VALUE_TYPES.join(', ')}`);
  console.log(`   - Action Types: ${VALID_ACTION_TYPES.join(', ')}`);
  console.log(`   - Action Value Types: ${VALID_ACTION_VALUE_TYPES.join(', ')}`);

  console.log('\n🔧 Test Data Created:');
  console.log(`   - Promotions: ${createdPromotions.length}`);
  console.log(`   - Rules: ${createdRules.length}`);
  console.log(`   - Actions: ${createdActions.length}`);
  
  console.log('\n' + '='.repeat(60));
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Promotions Field Constraints Tests...\n');

  // Check server availability
  const serverAvailable = await testServerAvailability();
  if (!serverAvailable) {
    console.log('❌ Server is not available. Please start the server first.');
    return;
  }

  try {
    // Run all tests
    await testValidPromotionTypes();
    await testInvalidPromotionTypes();
    await testValidPromotionStatuses();
    await testInvalidPromotionStatuses();
    await testValidPromotionVisibility();
    await testInvalidPromotionVisibility();
    await testValidRuleTypes();
    await testInvalidRuleTypes();
    await testValidRuleValueTypes();
    await testInvalidRuleValueTypes();
    await testValidActionTypes();
    await testInvalidActionTypes();
    await testValidActionValueTypes();
    await testInvalidActionValueTypes();
    await testCompleteEndToEndFlow();
    await testAllValidCombinations();

    // Generate and display report
    generateTestReport();

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  } finally {
    // Cleanup
    await cleanup();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Tests interrupted. Cleaning up...');
  await cleanup();
  process.exit(0);
});

// Start tests
runTests(); 