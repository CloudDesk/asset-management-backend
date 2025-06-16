import autocannon from 'autocannon';
import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:5600/v1';
const TRANSACTION_ENDPOINT = `${BASE_URL}/transactions`;

// Test data
const testTransactionData = {
  transactionid: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  transactiondata: {
    currency: 'USD',
    description: 'Test transaction',
    reference: 'TEST-REF-001'
  },
  userid: 1,
  productid: [1, 2, 3],
  merchanttransactionid: `MERCHANT-${Date.now()}`,
  name: 'Test Transaction',
  amount: 149.99,
  mobilenumber: 1234567890,
  transactionfor: 'product_purchase'
};

const updateTransactionData = {
  transactiondata: {
    currency: 'EUR',
    description: 'Updated test transaction',
    reference: 'TEST-REF-002'
  },
  name: 'Updated Test Transaction',
  amount: 199.99,
  transactionfor: 'subscription'
};

// Test Results Storage
let testResults = {
  passed: 0,
  failed: 0,
  details: []
};

// Helper function to log test results
function logTest(testName, passed, details = '', response = null) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const message = `${status} - ${testName}`;
  
  if (details) {
    console.log(`${message}: ${details}`);
  } else {
    console.log(message);
  }
  
  if (response && !passed) {
    console.log('Response:', response);
  }
  
  testResults.details.push({
    test: testName,
    passed,
    details,
    timestamp: new Date().toISOString()
  });
  
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

// Helper function to make HTTP requests
async function makeRequest(url, options = {}) {
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Only set content-type for requests with body
  if (mergedOptions.body && typeof mergedOptions.body === 'object') {
    mergedOptions.body = JSON.stringify(mergedOptions.body);
    mergedOptions.headers['Content-Type'] = 'application/json';
  }
  
  try {
    const response = await fetch(url, mergedOptions);
    const data = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: data,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: error.message,
      data: null,
      error: error.message
    };
  }
}

// Test Functions
async function testHealthCheck() {
  console.log('\n🔍 Testing Health Check...');
  
  const response = await makeRequest(`${BASE_URL.replace('/v1', '')}/health`);
  
  const passed = response.ok && response.data && response.data.success;
  logTest('Health Check', passed, passed ? 'Server is healthy' : 'Server health check failed', response);
  
  return passed;
}

async function testCreateTransaction() {
  console.log('\n🔍 Testing Transaction Creation...');
  
  const response = await makeRequest(TRANSACTION_ENDPOINT, {
    method: 'POST',
    body: testTransactionData
  });
  
  const passed = response.ok && response.data && response.data.success;
  logTest('Create Transaction', passed, 
    passed ? `Transaction created with ID: ${response.data.data?.transactionid}` : 'Failed to create transaction', 
    response
  );
  
  if (passed) {
    // Store the created transaction ID for other tests
    global.createdTransactionId = response.data.data?.id;
    global.createdTransactionTxId = response.data.data?.transactionid;
  }
  
  return passed;
}

async function testGetAllTransactions() {
  console.log('\n🔍 Testing Get All Transactions...');
  
  const response = await makeRequest(`${TRANSACTION_ENDPOINT}?page=1&limit=10`);
  
  const passed = response.ok && response.data && response.data.success && Array.isArray(response.data.data);
  logTest('Get All Transactions', passed, 
    passed ? `Retrieved ${response.data.data.length} transactions` : 'Failed to retrieve transactions', 
    response
  );
  
  return passed;
}

async function testGetTransactionById() {
  console.log('\n🔍 Testing Get Transaction by ID...');
  
  if (!global.createdTransactionId) {
    logTest('Get Transaction by ID', false, 'No transaction ID available from creation test');
    return false;
  }
  
  const response = await makeRequest(`${TRANSACTION_ENDPOINT}/id/${global.createdTransactionId}`);
  
  const passed = response.ok && response.data && response.data.success;
  logTest('Get Transaction by ID', passed, 
    passed ? `Retrieved transaction: ${response.data.data?.transactionid}` : 'Failed to retrieve transaction by ID', 
    response
  );
  
  return passed;
}

async function testGetTransactionByTransactionId() {
  console.log('\n🔍 Testing Get Transaction by Transaction ID...');
  
  if (!global.createdTransactionTxId) {
    logTest('Get Transaction by Transaction ID', false, 'No transaction ID available from creation test');
    return false;
  }
  
  const response = await makeRequest(`${TRANSACTION_ENDPOINT}/${global.createdTransactionTxId}`);
  
  const passed = response.ok && response.data && response.data.success;
  logTest('Get Transaction by Transaction ID', passed, 
    passed ? `Retrieved transaction: ${response.data.data?.transactionid}` : 'Failed to retrieve transaction by transaction ID', 
    response
  );
  
  return passed;
}

async function testGetUserTransactions() {
  console.log('\n🔍 Testing Get User Transactions...');
  
  const response = await makeRequest(`${TRANSACTION_ENDPOINT}/user/1?page=1&limit=5`);
  
  const passed = response.ok && response.data && response.data.success;
  logTest('Get User Transactions', passed, 
    passed ? `Retrieved ${response.data.data?.length || 0} user transactions` : 'Failed to retrieve user transactions', 
    response
  );
  
  return passed;
}

async function testGetTransactionStats() {
  console.log('\n🔍 Testing Get Transaction Statistics...');
  
  const response = await makeRequest(`${TRANSACTION_ENDPOINT}/stats`);
  
  const passed = response.ok && response.data && response.data.success && response.data.data;
  logTest('Get Transaction Statistics', passed, 
    passed ? `Stats - Total: ${response.data.data.total}, Amount: ${response.data.data.totalAmount}` : 'Failed to retrieve transaction statistics', 
    response
  );
  
  return passed;
}

async function testUpdateTransaction() {
  console.log('\n🔍 Testing Update Transaction...');
  
  if (!global.createdTransactionId) {
    logTest('Update Transaction', false, 'No transaction ID available from creation test');
    return false;
  }
  
  const response = await makeRequest(`${TRANSACTION_ENDPOINT}/id/${global.createdTransactionId}`, {
    method: 'PUT',
    body: updateTransactionData
  });
  
  const passed = response.ok && response.data && response.data.success;
  logTest('Update Transaction', passed, 
    passed ? `Transaction updated: ${response.data.data?.transactionid}` : 'Failed to update transaction', 
    response
  );
  
  return passed;
}

async function testUpsertTransaction() {
  console.log('\n🔍 Testing Upsert Transaction...');
  
  const upsertData = {
    transactionid: `TX-UPSERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Upsert Test Transaction',
    amount: 299.99,
    transactionfor: 'upsert_test',
    transactiondata: {
      currency: 'USD',
      description: 'Upsert test transaction',
      reference: 'UPSERT-REF-001'
    },
    userid: 2,
    productid: [4, 5, 6],
    merchanttransactionid: `MERCHANT-UPSERT-${Date.now()}`,
    mobilenumber: 9876543210
  };
  
  const response = await makeRequest(`${TRANSACTION_ENDPOINT}/upsert`, {
    method: 'POST',
    body: upsertData
  });
  
  const passed = response.ok && response.data && response.data.success;
  logTest('Upsert Transaction', passed, 
    passed ? `Transaction upserted: ${response.data.data?.transactionid}` : 'Failed to upsert transaction', 
    response
  );
  
  if (passed) {
    global.upsertedTransactionId = response.data.data?.id;
  }
  
  return passed;
}

async function testFilterTransactions() {
  console.log('\n🔍 Testing Filter Transactions...');
  
  // Test filtering by amount range
  const response = await makeRequest(`${TRANSACTION_ENDPOINT}?amountMin=100&amountMax=300&page=1&limit=5`);
  
  const passed = response.ok && response.data && response.data.success;
  logTest('Filter Transactions', passed, 
    passed ? `Filtered ${response.data.data?.length || 0} transactions by amount range` : 'Failed to filter transactions', 
    response
  );
  
  return passed;
}

async function testDeleteTransaction() {
  console.log('\n🔍 Testing Delete Transaction...');
  
  if (!global.upsertedTransactionId) {
    logTest('Delete Transaction', false, 'No transaction ID available for deletion');
    return false;
  }
  
  const response = await makeRequest(`${TRANSACTION_ENDPOINT}/id/${global.upsertedTransactionId}`, {
    method: 'DELETE'
  });
  
  const passed = response.ok && response.data && response.data.success;
  logTest('Delete Transaction', passed, 
    passed ? 'Transaction deleted successfully' : 'Failed to delete transaction', 
    response
  );
  
  return passed;
}

async function testErrorHandling() {
  console.log('\n🔍 Testing Error Handling...');
  
  // Test 404 for non-existent transaction
  const response = await makeRequest(`${TRANSACTION_ENDPOINT}/id/999999`);
  
  const passed = response.status === 404;
  logTest('Error Handling (404)', passed, 
    passed ? 'Correctly returned 404 for non-existent transaction' : 'Failed to handle non-existent transaction', 
    response
  );
  
  // Test invalid data
  const invalidResponse = await makeRequest(TRANSACTION_ENDPOINT, {
    method: 'POST',
    body: { invalidField: 'test' } // Missing required transactionid
  });
  
  const invalidPassed = invalidResponse.status === 400;
  logTest('Error Handling (400)', invalidPassed, 
    invalidPassed ? 'Correctly returned 400 for invalid data' : 'Failed to handle invalid data', 
    invalidResponse
  );
  
  return passed && invalidPassed;
}

async function testInputValidation() {
  console.log('\n🔍 Testing Input Validation...');
  
  // Test required field validation
  const response = await makeRequest(TRANSACTION_ENDPOINT, {
    method: 'POST',
    body: {
      name: 'Test',
      // Missing required transactionid
    }
  });
  
  const passed = response.status === 400;
  logTest('Input Validation', passed, 
    passed ? 'Correctly validated required fields' : 'Failed to validate required fields', 
    response
  );
  
  return passed;
}

async function performanceTest() {
  console.log('\n🔍 Running Performance Test...');
  
  const result = await new Promise((resolve) => {
    autocannon({
      url: `${TRANSACTION_ENDPOINT}?limit=10`,
      connections: 10,
      duration: 10,
      headers: {
        'content-type': 'application/json'
      }
    }, (err, res) => {
      if (err) {
        console.error('Performance test error:', err);
        resolve(false);
      } else {
        const avgLatency = res.latency.average;
        const requests = res.requests.total;
        const passed = avgLatency < 1000 && requests > 0; // Less than 1 second average latency
        
        logTest('Performance Test', passed, 
          `Avg Latency: ${avgLatency}ms, Total Requests: ${requests}, RPS: ${res.requests.average}`
        );
        
        resolve(passed);
      }
    });
  });
  
  return result;
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Comprehensive Transaction API Tests...\n');
  
  const tests = [
    testHealthCheck,
    testCreateTransaction,
    testGetAllTransactions,
    testGetTransactionById,
    testGetTransactionByTransactionId,
    testGetUserTransactions,
    testGetTransactionStats,
    testUpdateTransaction,
    testUpsertTransaction,
    testFilterTransactions,
    testDeleteTransaction,
    testErrorHandling,
    testInputValidation,
    performanceTest
  ];
  
  console.log(`Running ${tests.length} test suites...\n`);
  
  for (const test of tests) {
    try {
      await test();
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
    } catch (error) {
      console.error(`Error in test ${test.name}:`, error);
      logTest(test.name, false, error.message);
    }
  }
  
  // Final results
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details
      .filter(result => !result.passed)
      .forEach(result => {
        console.log(`  - ${result.test}: ${result.details}`);
      });
  }
  
  console.log('\n🎯 Transaction API testing completed!');
  console.log('='.repeat(60));
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
runAllTests().catch(console.error); 