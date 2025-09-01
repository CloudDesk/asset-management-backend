/**
 * Comprehensive Test Script for Orders API
 * Run using Node.js: node test_orders_comprehensive.js
 * 
 * This script tests all CRUD operations for the orders API
 * including pagination, filtering, status updates, and error handling.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
const execPromise = promisify(exec);

// Configuration
const API_URL = 'http://localhost:5600/v1/orders';
let testOrderId = null;
let testOrderOrderId = null;
let authToken = null;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  errors: []
};

// Helper function to run curl commands
async function curl(command) {
  try {
    console.log(`\nExecuting: ${command}`);
    const { stdout, stderr } = await execPromise(command);
    if (stderr && !stderr.includes('Warning:')) {
      console.error(`Error: ${stderr}`);
    }
    return stdout;
  } catch (error) {
    console.error(`Execution error: ${error.message}`);
    return null;
  }
}

// Helper function to parse JSON response
function parseResponse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error(`Error parsing JSON: ${error.message}`);
    console.error(`Raw response: ${jsonString}`);
    return null;
  }
}

// Helper function to log test results
function logTestResult(testName, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName} - PASSED ${details}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName} - FAILED ${details}`);
    testResults.errors.push(`${testName}: ${details}`);
  }
}

// Generate auth header if token exists
function getAuthHeader() {
  return authToken ? `-H "Authorization: Bearer ${authToken}"` : '';
}

// Check if server is running
async function checkServerStatus() {
  console.log('\n=== Checking if server is running ===');
  const command = `curl -s http://localhost:5600/health`;
  const response = await curl(command);
  
  if (response) {
    const parsedResponse = parseResponse(response);
    if (parsedResponse && parsedResponse.success) {
      console.log('✅ Server is running');
      return true;
    }
  }
  
  console.error('❌ Server is not running or not responding');
  return false;
}

// Login to get auth token if needed
async function login() {
  console.log('\n=== Attempting to login for authentication ===');
  
  try {
    // Try accessing an endpoint without authentication first
    const testCommand = `curl -s ${API_URL}`;
    const testResponse = await curl(testCommand);
    const parsedTestResponse = parseResponse(testResponse);
    
    // If we can access the API without auth, we don't need to login
    if (parsedTestResponse && !parsedTestResponse.error) {
      console.log('✅ Authentication not required for this endpoint');
      return true;
    }
    
    // If authentication is required, perform login
    const loginData = {
      email: "admin@example.com",
      password: "admin123"
    };
    
    const loginCommand = `curl -s -X POST http://localhost:5600/v1/auth/login -H "Content-Type: application/json" -d '${JSON.stringify(loginData)}'`;
    const loginResponse = await curl(loginCommand);
    const parsedLoginResponse = parseResponse(loginResponse);
    
    if (parsedLoginResponse && parsedLoginResponse.token) {
      authToken = parsedLoginResponse.token;
      console.log('✅ Authentication successful');
      return true;
    } else {
      console.error('❌ Authentication failed');
      return false;
    }
  } catch (error) {
    console.error(`Login error: ${error.message}`);
    return false;
  }
}

// Test: Create a new order
async function testCreateOrder() {
  console.log('\n=== TEST: Create Order ===');
  
  const testData = {
    userid: 1,
    addressid: 1,
    orderamount: 150.50,
    orderstatus: "pending",
    quantity: 3,
    productamount: 120.00,
    discountamount: 20.00,
    deliveryfrom: "Mumbai Warehouse",
    ispaymentsucceed: false,
    productid: [1, 2, 3],
    merchanttransactionid: `TXN-${Date.now()}`
  };
  
  const command = `curl -s -X POST ${API_URL} ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(testData)}'`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && parsedResponse.data) {
    testOrderId = parsedResponse.data.id;
    testOrderOrderId = parsedResponse.data.orderid;
    logTestResult('Create Order', true, `Created order with ID: ${testOrderId}, OrderID: ${testOrderOrderId}`);
    return true;
  } else {
    logTestResult('Create Order', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Get all orders with pagination
async function testGetAllOrders() {
  console.log('\n=== TEST: Get All Orders ===');
  
  const command = `curl -s "${API_URL}?page=1&limit=10" ${getAuthHeader()}`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && Array.isArray(parsedResponse.data)) {
    logTestResult('Get All Orders', true, `Retrieved ${parsedResponse.data.length} orders`);
    
    // Test pagination info
    if (parsedResponse.pagination) {
      logTestResult('Pagination Info', true, `Page: ${parsedResponse.pagination.page}, Total: ${parsedResponse.pagination.total}`);
    }
    return true;
  } else {
    logTestResult('Get All Orders', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Get order by ID
async function testGetOrderById() {
  console.log('\n=== TEST: Get Order by ID ===');
  
  if (!testOrderId) {
    logTestResult('Get Order by ID', false, 'No test order ID available');
    return false;
  }
  
  const command = `curl -s ${API_URL}/${testOrderId} ${getAuthHeader()}`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && parsedResponse.data) {
    const order = parsedResponse.data;
    logTestResult('Get Order by ID', true, `Retrieved order: ${order.id} (${order.orderid})`);
    return true;
  } else {
    logTestResult('Get Order by ID', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Get order by order ID string
async function testGetOrderByOrderId() {
  console.log('\n=== TEST: Get Order by Order ID String ===');
  
  if (!testOrderOrderId) {
    logTestResult('Get Order by Order ID String', false, 'No test order ID string available');
    return false;
  }
  
  const command = `curl -s ${API_URL}/orderid/${testOrderOrderId} ${getAuthHeader()}`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && parsedResponse.data) {
    const order = parsedResponse.data;
    logTestResult('Get Order by Order ID String', true, `Retrieved order: ${order.id} (${order.orderid})`);
    return true;
  } else {
    logTestResult('Get Order by Order ID String', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Update order
async function testUpdateOrder() {
  console.log('\n=== TEST: Update Order ===');
  
  if (!testOrderId) {
    logTestResult('Update Order', false, 'No test order ID available');
    return false;
  }
  
  const updateData = {
    orderstatus: "processing",
    orderamount: 175.00,
    productamount: 140.00,
    discountamount: 15.00,
    deliveryfrom: "Delhi Warehouse"
  };
  
  const command = `curl -s -X PUT ${API_URL}/${testOrderId} ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(updateData)}'`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && parsedResponse.data) {
    const order = parsedResponse.data;
    logTestResult('Update Order', true, `Updated order status to: ${order.orderstatus}`);
    return true;
  } else {
    logTestResult('Update Order', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Update order status
async function testUpdateOrderStatus() {
  console.log('\n=== TEST: Update Order Status ===');
  
  if (!testOrderId) {
    logTestResult('Update Order Status', false, 'No test order ID available');
    return false;
  }
  
  const statusData = {
    status: "dispatched",
    additionalData: {
      courier: "DHL Express",
      trackingNumber: "DHL123456789"
    }
  };
  
  const command = `curl -s -X PATCH ${API_URL}/${testOrderId}/status ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(statusData)}'`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && parsedResponse.data) {
    const order = parsedResponse.data;
    logTestResult('Update Order Status', true, `Updated status to: ${order.orderstatus}`);
    
    // Verify that dispatch date was set
    if (order.dispatcheddate) {
      logTestResult('Auto-set Dispatch Date', true, `Dispatch date: ${new Date(order.dispatcheddate).toISOString()}`);
    }
    return true;
  } else {
    logTestResult('Update Order Status', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Filtering
async function testFiltering() {
  console.log('\n=== TEST: Order Filtering ===');
  
  // Test filter by status
  const statusFilterCommand = `curl -s "${API_URL}?orderstatus=dispatched&limit=5" ${getAuthHeader()}`;
  const statusResponse = await curl(statusFilterCommand);
  const statusParsed = parseResponse(statusResponse);
  
  if (statusParsed && statusParsed.success) {
    logTestResult('Filter by Status', true, `Found ${statusParsed.data.length} dispatched orders`);
  } else {
    logTestResult('Filter by Status', false, 'Status filtering failed');
  }
  
  // Test filter by payment status
  const paymentFilterCommand = `curl -s "${API_URL}?ispaymentsucceed=false&limit=5" ${getAuthHeader()}`;
  const paymentResponse = await curl(paymentFilterCommand);
  const paymentParsed = parseResponse(paymentResponse);
  
  if (paymentParsed && paymentParsed.success) {
    logTestResult('Filter by Payment Status', true, `Found ${paymentParsed.data.length} unpaid orders`);
  } else {
    logTestResult('Filter by Payment Status', false, 'Payment status filtering failed');
  }
  
  // Test filter by user ID
  const userFilterCommand = `curl -s "${API_URL}?userid=1&limit=5" ${getAuthHeader()}`;
  const userResponse = await curl(userFilterCommand);
  const userParsed = parseResponse(userResponse);
  
  if (userParsed && userParsed.success) {
    logTestResult('Filter by User ID', true, `Found ${userParsed.data.length} orders for user 1`);
  } else {
    logTestResult('Filter by User ID', false, 'User ID filtering failed');
  }
}

// Test: Upsert order
async function testUpsertOrder() {
  console.log('\n=== TEST: Upsert Order ===');
  
  // Test create via upsert (no ID provided)
  const createData = {
    userid: 2,
    addressid: 2,
    orderamount: 200.00,
    orderstatus: "pending",
    quantity: 1,
    productamount: 180.00,
    discountamount: 20.00,
    deliveryfrom: "Bangalore Warehouse",
    ispaymentsucceed: false,
    productid: [4, 5]
  };
  
  const createCommand = `curl -s -X POST ${API_URL}/upsert ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(createData)}'`;
  const createResponse = await curl(createCommand);
  const createParsed = parseResponse(createResponse);
  
  if (createParsed && createParsed.success && createParsed.data) {
    logTestResult('Upsert Create', true, `Created order with ID: ${createParsed.data.id}`);
    
    // Test update via upsert (with ID)
    const updateData = {
      id: createParsed.data.id,
      orderstatus: "confirmed",
      orderamount: 220.00
    };
    
    const updateCommand = `curl -s -X POST ${API_URL}/upsert ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(updateData)}'`;
    const updateResponse = await curl(updateCommand);
    const updateParsed = parseResponse(updateResponse);
    
    if (updateParsed && updateParsed.success && updateParsed.data) {
      logTestResult('Upsert Update', true, `Updated order status to: ${updateParsed.data.orderstatus}`);
    } else {
      logTestResult('Upsert Update', false, updateParsed ? updateParsed.message : 'Invalid response');
    }
  } else {
    logTestResult('Upsert Create', false, createParsed ? createParsed.message : 'Invalid response');
  }
}

// Test: Error handling
async function testErrorHandling() {
  console.log('\n=== TEST: Error Handling ===');
  
  // Test invalid order ID
  const invalidIdCommand = `curl -s ${API_URL}/999999 ${getAuthHeader()}`;
  const invalidResponse = await curl(invalidIdCommand);
  const invalidParsed = parseResponse(invalidResponse);
  
  if (invalidParsed && !invalidParsed.success) {
    logTestResult('Invalid Order ID Error', true, 'Correctly returned error for invalid ID');
  } else {
    logTestResult('Invalid Order ID Error', false, 'Should have returned error for invalid ID');
  }
  
  // Test invalid data format
  const invalidDataCommand = `curl -s -X POST ${API_URL} ${getAuthHeader()} -H "Content-Type: application/json" -d '{"invalid": "data", "orderamount": "not_a_number"}'`;
  const invalidDataResponse = await curl(invalidDataCommand);
  const invalidDataParsed = parseResponse(invalidDataResponse);
  
  if (invalidDataParsed && !invalidDataParsed.success) {
    logTestResult('Invalid Data Format Error', true, 'Correctly returned error for invalid data');
  } else {
    logTestResult('Invalid Data Format Error', false, 'Should have returned error for invalid data');
  }
  
  // Test missing status in status update
  const missingStatusCommand = `curl -s -X PATCH ${API_URL}/${testOrderId}/status ${getAuthHeader()} -H "Content-Type: application/json" -d '{}'`;
  const missingStatusResponse = await curl(missingStatusCommand);
  const missingStatusParsed = parseResponse(missingStatusResponse);
  
  if (missingStatusParsed && !missingStatusParsed.success) {
    logTestResult('Missing Status Error', true, 'Correctly returned error for missing status');
  } else {
    logTestResult('Missing Status Error', false, 'Should have returned error for missing status');
  }
}

// Test: Delete order (should be last test)
async function testDeleteOrder() {
  console.log('\n=== TEST: Delete Order ===');
  
  if (!testOrderId) {
    logTestResult('Delete Order', false, 'No test order ID available');
    return false;
  }
  
  const command = `curl -s -X DELETE ${API_URL}/${testOrderId} ${getAuthHeader()}`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success) {
    logTestResult('Delete Order', true, `Successfully deleted order ${testOrderId}`);
    
    // Verify order is deleted
    const verifyCommand = `curl -s ${API_URL}/${testOrderId} ${getAuthHeader()}`;
    const verifyResponse = await curl(verifyCommand);
    const verifyParsed = parseResponse(verifyResponse);
    
    if (verifyParsed && !verifyParsed.success) {
      logTestResult('Verify Order Deletion', true, 'Order not found after deletion');
    } else {
      logTestResult('Verify Order Deletion', false, 'Order still exists after deletion');
    }
    return true;
  } else {
    logTestResult('Delete Order', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Performance test
async function testPerformance() {
  console.log('\n=== TEST: Performance ===');
  
  const startTime = Date.now();
  const command = `curl -s "${API_URL}?limit=50" ${getAuthHeader()}`;
  const response = await curl(command);
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success) {
    if (responseTime < 2000) { // Less than 2 seconds
      logTestResult('Performance Test', true, `Response time: ${responseTime}ms (< 2000ms)`);
    } else {
      logTestResult('Performance Test', false, `Response time: ${responseTime}ms (>= 2000ms)`);
    }
  } else {
    logTestResult('Performance Test', false, 'Failed to get response');
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Comprehensive Orders API Tests');
  console.log('============================================');
  
  // Check if server is running
  if (!(await checkServerStatus())) {
    console.log('\n❌ Server not running. Please start the server and try again.');
    return;
  }
  
  // Attempt login
  if (!(await login())) {
    console.log('\n⚠️ Authentication failed, but continuing with tests...');
  }
  
  // Run all tests
  await testCreateOrder();
  await testGetAllOrders();
  await testGetOrderById();
  await testGetOrderByOrderId();
  await testUpdateOrder();
  await testUpdateOrderStatus();
  await testFiltering();
  await testUpsertOrder();
  await testErrorHandling();
  await testPerformance();
  await testDeleteOrder(); // This should be last
  
  // Print summary
  console.log('\n🏁 Test Summary');
  console.log('===============');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${(testResults.passed / testResults.total * 100).toFixed(2)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (testResults.passed === testResults.total) {
    console.log('\n🎉 All tests passed! Orders API is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the API implementation.');
  }
}

// Run the tests
runTests().catch(console.error); 