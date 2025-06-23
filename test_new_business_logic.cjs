const fetch = require('node-fetch');

// Configuration
const BASE_URL = 'http://localhost:5600/v1';
const TEST_PRODUCT_PUC = 'es-we-0000000005';

// Test scenarios for NEW business logic
const testScenarios = [
  {
    name: "SCENARIO 1: Create Available + ecompublish=true",
    description: "Should count in BOTH availablequantity AND ecompublishedquantity",
    action: async () => {
      const beforeState = await getProduct();
      
      const stockData = {
        puc: TEST_PRODUCT_PUC,
        serialnumber: `NEW_LOGIC_1_${Date.now()}`,
        stockstatus: "Available",
        ecompublish: true,
        location: "test-warehouse"
      };
      
      const response = await createStock(stockData);
      const stockId = response.data.id;
      
      await sleep(1500);
      const afterState = await getProduct();
      
      return {
        stockId,
        expected: {
          quantity: beforeState.quantity + 1,
          availablequantity: beforeState.availablequantity + 1, // NEW: Both Available AND ecompublish=true
          soldquantity: beforeState.soldquantity,
          ecompublishedquantity: beforeState.ecompublishedquantity + 1 // ecompublish=true AND not Sold
        },
        actual: afterState,
        beforeState,
        afterState
      };
    }
  },
  {
    name: "SCENARIO 2: Create Available + ecompublish=false",
    description: "Should NOT count in availablequantity (NEW LOGIC), should NOT count in ecompublishedquantity",
    action: async () => {
      const beforeState = await getProduct();
      
      const stockData = {
        puc: TEST_PRODUCT_PUC,
        serialnumber: `NEW_LOGIC_2_${Date.now()}`,
        stockstatus: "Available",
        ecompublish: false,
        location: "test-warehouse"
      };
      
      const response = await createStock(stockData);
      const stockId = response.data.id;
      
      await sleep(1500);
      const afterState = await getProduct();
      
      return {
        stockId,
        expected: {
          quantity: beforeState.quantity + 1,
          availablequantity: beforeState.availablequantity, // NEW: No change (needs ecompublish=true)
          soldquantity: beforeState.soldquantity,
          ecompublishedquantity: beforeState.ecompublishedquantity // No change (ecompublish=false)
        },
        actual: afterState,
        beforeState,
        afterState
      };
    }
  },
  {
    name: "SCENARIO 3: Create Damaged + ecompublish=true",
    description: "Should NOT count in availablequantity, should count in ecompublishedquantity (NEW LOGIC)",
    action: async () => {
      const beforeState = await getProduct();
      
      const stockData = {
        puc: TEST_PRODUCT_PUC,
        serialnumber: `NEW_LOGIC_3_${Date.now()}`,
        stockstatus: "Damaged",
        ecompublish: true,
        location: "test-warehouse"
      };
      
      const response = await createStock(stockData);
      const stockId = response.data.id;
      
      await sleep(1500);
      const afterState = await getProduct();
      
      return {
        stockId,
        expected: {
          quantity: beforeState.quantity + 1,
          availablequantity: beforeState.availablequantity, // No change (not Available)
          soldquantity: beforeState.soldquantity,
          ecompublishedquantity: beforeState.ecompublishedquantity + 1 // NEW: ecompublish=true AND not Sold
        },
        actual: afterState,
        beforeState,
        afterState
      };
    }
  },
  {
    name: "SCENARIO 4: Create Sold + ecompublish=true",
    description: "Should NOT count in availablequantity, should NOT count in ecompublishedquantity (excluded)",
    action: async () => {
      const beforeState = await getProduct();
      
      const stockData = {
        puc: TEST_PRODUCT_PUC,
        serialnumber: `NEW_LOGIC_4_${Date.now()}`,
        stockstatus: "Sold",
        ecompublish: true,
        location: "test-warehouse"
      };
      
      const response = await createStock(stockData);
      const stockId = response.data.id;
      
      await sleep(1500);
      const afterState = await getProduct();
      
      return {
        stockId,
        expected: {
          quantity: beforeState.quantity + 1,
          availablequantity: beforeState.availablequantity, // No change (not Available)
          soldquantity: beforeState.soldquantity + 1,
          ecompublishedquantity: beforeState.ecompublishedquantity // NEW: No change (Sold excluded)
        },
        actual: afterState,
        beforeState,
        afterState
      };
    }
  },
  {
    name: "SCENARIO 5: Update Available+ecompublish=true → Available+ecompublish=false",
    description: "Should decrease both availablequantity AND ecompublishedquantity",
    action: async () => {
      const beforeState = await getProduct();
      
      // First create Available + ecompublish=true
      const stockData = {
        puc: TEST_PRODUCT_PUC,
        serialnumber: `NEW_LOGIC_5_${Date.now()}`,
        stockstatus: "Available",
        ecompublish: true,
        location: "test-warehouse"
      };
      
      const createResponse = await createStock(stockData);
      const stockId = createResponse.data.id;
      await sleep(1500);
      
      const midState = await getProduct();
      
      // Now update ecompublish to false
      await updateStock(stockId, { ecompublish: false });
      await sleep(1500);
      
      const afterState = await getProduct();
      
      return {
        stockId,
        expected: {
          quantity: midState.quantity, // No change
          availablequantity: midState.availablequantity - 1, // NEW: Decrease (no longer ecompublish=true)
          soldquantity: midState.soldquantity,
          ecompublishedquantity: midState.ecompublishedquantity - 1 // Decrease (no longer ecompublish=true)
        },
        actual: afterState,
        beforeState: midState,
        afterState
      };
    }
  },
  {
    name: "SCENARIO 6: Update Available+ecompublish=false → Available+ecompublish=true",
    description: "Should increase both availablequantity AND ecompublishedquantity",
    action: async () => {
      const beforeState = await getProduct();
      
      // First create Available + ecompublish=false
      const stockData = {
        puc: TEST_PRODUCT_PUC,
        serialnumber: `NEW_LOGIC_6_${Date.now()}`,
        stockstatus: "Available",
        ecompublish: false,
        location: "test-warehouse"
      };
      
      const createResponse = await createStock(stockData);
      const stockId = createResponse.data.id;
      await sleep(1500);
      
      const midState = await getProduct();
      
      // Now update ecompublish to true
      await updateStock(stockId, { ecompublish: true });
      await sleep(1500);
      
      const afterState = await getProduct();
      
      return {
        stockId,
        expected: {
          quantity: midState.quantity, // No change
          availablequantity: midState.availablequantity + 1, // NEW: Increase (now ecompublish=true)
          soldquantity: midState.soldquantity,
          ecompublishedquantity: midState.ecompublishedquantity + 1 // Increase (now ecompublish=true)
        },
        actual: afterState,
        beforeState: midState,
        afterState
      };
    }
  },
  {
    name: "SCENARIO 7: Update Available+ecompublish=true → Damaged+ecompublish=true",
    description: "Should decrease availablequantity but keep ecompublishedquantity (Damaged allowed)",
    action: async () => {
      const beforeState = await getProduct();
      
      // First create Available + ecompublish=true
      const stockData = {
        puc: TEST_PRODUCT_PUC,
        serialnumber: `NEW_LOGIC_7_${Date.now()}`,
        stockstatus: "Available",
        ecompublish: true,
        location: "test-warehouse"
      };
      
      const createResponse = await createStock(stockData);
      const stockId = createResponse.data.id;
      await sleep(1500);
      
      const midState = await getProduct();
      
      // Now update to Damaged
      await updateStock(stockId, { stockstatus: "Damaged" });
      await sleep(1500);
      
      const afterState = await getProduct();
      
      return {
        stockId,
        expected: {
          quantity: midState.quantity, // No change
          availablequantity: midState.availablequantity - 1, // Decrease (no longer Available)
          soldquantity: midState.soldquantity,
          ecompublishedquantity: midState.ecompublishedquantity // NEW: No change (Damaged + ecompublish=true still counts)
        },
        actual: afterState,
        beforeState: midState,
        afterState
      };
    }
  },
  {
    name: "SCENARIO 8: Update Available+ecompublish=true → Sold+ecompublish=true",
    description: "Should decrease both availablequantity AND ecompublishedquantity, increase soldquantity",
    action: async () => {
      const beforeState = await getProduct();
      
      // First create Available + ecompublish=true
      const stockData = {
        puc: TEST_PRODUCT_PUC,
        serialnumber: `NEW_LOGIC_8_${Date.now()}`,
        stockstatus: "Available",
        ecompublish: true,
        location: "test-warehouse"
      };
      
      const createResponse = await createStock(stockData);
      const stockId = createResponse.data.id;
      await sleep(1500);
      
      const midState = await getProduct();
      
      // Now update to Sold
      await updateStock(stockId, { stockstatus: "Sold" });
      await sleep(1500);
      
      const afterState = await getProduct();
      
      return {
        stockId,
        expected: {
          quantity: midState.quantity, // No change
          availablequantity: midState.availablequantity - 1, // Decrease (no longer Available)
          soldquantity: midState.soldquantity + 1, // Increase (now Sold)
          ecompublishedquantity: midState.ecompublishedquantity - 1 // NEW: Decrease (Sold excluded)
        },
        actual: afterState,
        beforeState: midState,
        afterState
      };
    }
  }
];

// Helper functions
async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data.message || response.statusText}`);
  }
  
  return data;
}

async function getProduct() {
  const response = await makeRequest(`${BASE_URL}/products?puc=${TEST_PRODUCT_PUC}&limit=1`);
  const product = response.data[0];
  return {
    quantity: product.quantity || 0,
    availablequantity: product.availablequantity || 0,
    soldquantity: product.soldquantity || 0,
    ecompublishedquantity: product.ecompublishedquantity || 0
  };
}

async function createStock(stockData) {
  return await makeRequest(`${BASE_URL}/stocks`, {
    method: 'POST',
    body: JSON.stringify(stockData)
  });
}

async function updateStock(stockId, updateData) {
  return await makeRequest(`${BASE_URL}/stocks/${stockId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  });
}

async function deleteStock(stockId) {
  return await makeRequest(`${BASE_URL}/stocks/${stockId}`, {
    method: 'DELETE',
    body: JSON.stringify({})
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function validateResult(expected, actual, scenario) {
  const errors = [];
  
  Object.keys(expected).forEach(field => {
    if (expected[field] !== actual[field]) {
      errors.push(`${field}: expected ${expected[field]}, got ${actual[field]}`);
    }
  });
  
  return errors;
}

// Main test execution
async function runNewBusinessLogicTests() {
  console.log('🚀 Testing NEW Business Logic - availablequantity requires ecompublish=true');
  console.log('📋 ecompublishedquantity counts ecompublish=true AND stockstatus≠"Sold"');
  console.log('=' .repeat(80));
  
  const results = [];
  const createdStockIds = [];
  
  try {
    // Get initial state
    const initialState = await getProduct();
    console.log('📊 Initial Product State:', initialState);
    console.log('');
    
    // Run each scenario
    for (let i = 0; i < testScenarios.length; i++) {
      const scenario = testScenarios[i];
      console.log(`🧪 Test ${i + 1}/${testScenarios.length}: ${scenario.name}`);
      console.log(`   Description: ${scenario.description}`);
      
      try {
        const result = await scenario.action();
        createdStockIds.push(result.stockId);
        
        const validationErrors = validateResult(result.expected, result.actual, scenario.name);
        
        if (validationErrors.length === 0) {
          console.log('   ✅ PASSED');
          results.push({ scenario: scenario.name, success: true });
        } else {
          console.log('   ❌ FAILED');
          console.log('     Errors:', validationErrors.join(', '));
          console.log('     Expected:', result.expected);
          console.log('     Actual:  ', result.actual);
          results.push({ scenario: scenario.name, success: false, errors: validationErrors });
        }
        
        console.log('     State Changes:', {
          quantity: `${result.beforeState.quantity} → ${result.afterState.quantity}`,
          availablequantity: `${result.beforeState.availablequantity} → ${result.afterState.availablequantity}`,
          soldquantity: `${result.beforeState.soldquantity} → ${result.afterState.soldquantity}`,
          ecompublishedquantity: `${result.beforeState.ecompublishedquantity} → ${result.afterState.ecompublishedquantity}`
        });
        
      } catch (error) {
        console.log('   ❌ ERROR:', error.message);
        results.push({ scenario: scenario.name, success: false, error: error.message });
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up test data...');
    for (const stockId of createdStockIds) {
      try {
        await deleteStock(stockId);
        console.log(`   ✅ Deleted stock ID: ${stockId}`);
      } catch (error) {
        console.log(`   ❌ Failed to delete stock ${stockId}: ${error.message}`);
      }
    }
    
    await sleep(1500);
    
    // Final state
    const finalState = await getProduct();
    console.log('\n📊 Final Product State:', finalState);
    
    // Summary
    const passedTests = results.filter(r => r.success).length;
    const totalTests = results.length;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 NEW BUSINESS LOGIC TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Overall Result: ${passedTests}/${totalTests} tests passed (${passRate}%)`);
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.scenario}`);
      if (result.errors) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    if (passedTests === totalTests) {
      console.log('\n🌟 ALL NEW BUSINESS LOGIC TESTS PASSED!');
      console.log('✅ availablequantity now requires both Available status AND ecompublish=true');
      console.log('✅ ecompublishedquantity counts ecompublish=true stocks except Sold');
    } else {
      console.log('\n⚠️  Some tests failed.');
      process.exit(1);
    }
  }
}

// Run tests
if (require.main === module) {
  runNewBusinessLogicTests().catch(error => {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runNewBusinessLogicTests }; 