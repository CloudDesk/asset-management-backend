/**
 * Comprehensive Test Script for Orderlines API
 * Run using Node.js: node test_orderlines_comprehensive.js
 * 
 * This script tests all CRUD operations for the orderlines API
 * including pagination, filtering, status updates, bulk operations, and error handling.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
const execPromise = promisify(exec);

// Configuration
const API_URL = 'http://localhost:5600/v1/orderlines';
let testOrderlineId = null;
let testOrderlineNumber = null;
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

// Test: Create a new orderline
async function testCreateOrderline() {
  console.log('\n=== TEST: Create Orderline ===');
  
  const testData = {
    orderid: 1,
    productid: 175,
    userid: 1,
    addressid: 1,
    productamount: 100.00,
    discountamount: 10.00,
    orderamount: 90.00,
    quantity: 2,
    productname: "Test Product",
    productcategory: "Electronics",
    productcolour: "Black",
    orderstatus: "pending",
    deliveryfrom: "Mumbai Warehouse",
    location: "Mumbai",
    merchanttransactionid: `TXN-OL-${Date.now()}`
  };
  
  const command = `curl -s -X POST ${API_URL} ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(testData)}'`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && parsedResponse.data) {
    testOrderlineId = parsedResponse.data.id;
    testOrderlineNumber = parsedResponse.data.orderlinenumber;
    logTestResult('Create Orderline', true, `Created orderline with ID: ${testOrderlineId}, Number: ${testOrderlineNumber}`);
    return true;
  } else {
    logTestResult('Create Orderline', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Get all orderlines with pagination
async function testGetAllOrderlines() {
  console.log('\n=== TEST: Get All Orderlines ===');
  
  const command = `curl -s "${API_URL}?page=1&limit=10" ${getAuthHeader()}`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && Array.isArray(parsedResponse.data)) {
    logTestResult('Get All Orderlines', true, `Retrieved ${parsedResponse.data.length} orderlines`);
    
    // Test pagination info
    if (parsedResponse.pagination) {
      logTestResult('Pagination Info', true, `Page: ${parsedResponse.pagination.page}, Total: ${parsedResponse.pagination.total}`);
    }
    return true;
  } else {
    logTestResult('Get All Orderlines', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Get orderline by ID
async function testGetOrderlineById() {
  console.log('\n=== TEST: Get Orderline by ID ===');
  
  if (!testOrderlineId) {
    logTestResult('Get Orderline by ID', false, 'No test orderline ID available');
    return false;
  }
  
  const command = `curl -s ${API_URL}/${testOrderlineId} ${getAuthHeader()}`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && parsedResponse.data) {
    const orderline = parsedResponse.data;
    logTestResult('Get Orderline by ID', true, `Retrieved orderline: ${orderline.id} (${orderline.orderlinenumber})`);
    return true;
  } else {
    logTestResult('Get Orderline by ID', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Get orderline by orderline number
async function testGetOrderlineByNumber() {
  console.log('\n=== TEST: Get Orderline by Number ===');
  
  if (!testOrderlineNumber) {
    logTestResult('Get Orderline by Number', false, 'No test orderline number available');
    return false;
  }
  
  const command = `curl -s ${API_URL}/orderlinenumber/${testOrderlineNumber} ${getAuthHeader()}`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && parsedResponse.data) {
    const orderline = parsedResponse.data;
    logTestResult('Get Orderline by Number', true, `Retrieved orderline: ${orderline.id} (${orderline.orderlinenumber})`);
    return true;
  } else {
    logTestResult('Get Orderline by Number', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Get orderlines by order ID
async function testGetOrderlinesByOrderId() {
  console.log('\n=== TEST: Get Orderlines by Order ID ===');
  
  const command = `curl -s ${API_URL}/order/1 ${getAuthHeader()}`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && Array.isArray(parsedResponse.data)) {
    logTestResult('Get Orderlines by Order ID', true, `Retrieved ${parsedResponse.data.length} orderlines for order 1`);
    return true;
  } else {
    logTestResult('Get Orderlines by Order ID', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Update orderline
async function testUpdateOrderline() {
  console.log('\n=== TEST: Update Orderline ===');
  
  if (!testOrderlineId) {
    logTestResult('Update Orderline', false, 'No test orderline ID available');
    return false;
  }
  
  const updateData = {
    orderstatus: "processing",
    quantity: 3,
    productamount: 120.00,
    orderamount: 105.00,
    discountamount: 15.00,
    location: "Delhi"
  };
  
  const command = `curl -s -X PUT ${API_URL}/${testOrderlineId} ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(updateData)}'`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && parsedResponse.data) {
    const orderline = parsedResponse.data;
    logTestResult('Update Orderline', true, `Updated orderline status to: ${orderline.orderstatus}, quantity: ${orderline.quantity}`);
    return true;
  } else {
    logTestResult('Update Orderline', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Update orderline status
async function testUpdateOrderlineStatus() {
  console.log('\n=== TEST: Update Orderline Status ===');
  
  if (!testOrderlineId) {
    logTestResult('Update Orderline Status', false, 'No test orderline ID available');
    return false;
  }
  
  const statusData = {
    status: "dispatched",
    additionalData: {
      courier: "FedEx",
      trackingNumber: "FDX123456789",
      estimatedDelivery: "2024-01-15"
    }
  };
  
  const command = `curl -s -X PATCH ${API_URL}/${testOrderlineId}/status ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(statusData)}'`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && parsedResponse.data) {
    const orderline = parsedResponse.data;
    logTestResult('Update Orderline Status', true, `Updated status to: ${orderline.orderstatus}`);
    
    // Verify that dispatch date was set
    if (orderline.dispatcheddate) {
      logTestResult('Auto-set Dispatch Date', true, `Dispatch date: ${new Date(orderline.dispatcheddate).toISOString()}`);
    }
    return true;
  } else {
    logTestResult('Update Orderline Status', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Bulk update orderline status
async function testBulkUpdateOrderlineStatus() {
  console.log('\n=== TEST: Bulk Update Orderline Status ===');
  
  if (!testOrderlineId) {
    logTestResult('Bulk Update Orderline Status', false, 'No test orderline ID available');
    return false;
  }
  
  // Create additional orderlines for bulk testing
  const additionalOrderlines = [];
  for (let i = 0; i < 3; i++) {
    const testData = {
      orderid: 1,
      productid: i + 2,
      userid: 1,
      addressid: 1,
      productamount: 50.00 + (i * 10),
      discountamount: 5.00,
      orderamount: 45.00 + (i * 10),
      quantity: 1,
      productname: `Bulk Test Product ${i + 1}`,
      productcategory: "Test Category",
      orderstatus: "pending",
      deliveryfrom: "Test Warehouse"
    };
    
    const createCommand = `curl -s -X POST ${API_URL} ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(testData)}'`;
    const createResponse = await curl(createCommand);
    const createParsed = parseResponse(createResponse);
    
    if (createParsed && createParsed.success && createParsed.data) {
      additionalOrderlines.push(createParsed.data.id.toString());
    }
  }
  
  // Include the main test orderline
  const orderlineIds = [testOrderlineId.toString(), ...additionalOrderlines];
  
  const bulkUpdateData = {
    orderlineIds: orderlineIds,
    status: "ready_to_dispatch",
    additionalData: {
      warehouse: "Central Warehouse",
      preparedBy: "Staff001"
    }
  };
  
  const command = `curl -s -X PATCH ${API_URL}/bulk-status ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(bulkUpdateData)}'`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success && Array.isArray(parsedResponse.data)) {
    const results = parsedResponse.data;
    const successCount = results.filter(r => r.success).length;
    logTestResult('Bulk Update Orderline Status', true, `Updated ${successCount}/${results.length} orderlines successfully`);
    
    // Log individual results
    results.forEach((result, index) => {
      if (result.success) {
        logTestResult(`Bulk Update Item ${index + 1}`, true, `ID: ${result.id}`);
      } else {
        logTestResult(`Bulk Update Item ${index + 1}`, false, `ID: ${result.id}, Error: ${result.error}`);
      }
    });
    
    return true;
  } else {
    logTestResult('Bulk Update Orderline Status', false, parsedResponse ? parsedResponse.message : 'Invalid response');
    return false;
  }
}

// Test: Filtering
async function testFiltering() {
  console.log('\n=== TEST: Orderline Filtering ===');
  
  // Test filter by status
  const statusFilterCommand = `curl -s "${API_URL}?orderstatus=ready_to_dispatch&limit=5" ${getAuthHeader()}`;
  const statusResponse = await curl(statusFilterCommand);
  const statusParsed = parseResponse(statusResponse);
  
  if (statusParsed && statusParsed.success) {
    logTestResult('Filter by Status', true, `Found ${statusParsed.data.length} ready-to-dispatch orderlines`);
  } else {
    logTestResult('Filter by Status', false, 'Status filtering failed');
  }
  
  // Test filter by product category
  const categoryFilterCommand = `curl -s "${API_URL}?productcategory=Electronics&limit=5" ${getAuthHeader()}`;
  const categoryResponse = await curl(categoryFilterCommand);
  const categoryParsed = parseResponse(categoryResponse);
  
  if (categoryParsed && categoryParsed.success) {
    logTestResult('Filter by Product Category', true, `Found ${categoryParsed.data.length} Electronics orderlines`);
  } else {
    logTestResult('Filter by Product Category', false, 'Category filtering failed');
  }
  
  // Test filter by order ID
  const orderFilterCommand = `curl -s "${API_URL}?orderid=1&limit=5" ${getAuthHeader()}`;
  const orderResponse = await curl(orderFilterCommand);
  const orderParsed = parseResponse(orderResponse);
  
  if (orderParsed && orderParsed.success) {
    logTestResult('Filter by Order ID', true, `Found ${orderParsed.data.length} orderlines for order 1`);
  } else {
    logTestResult('Filter by Order ID', false, 'Order ID filtering failed');
  }
  
  // Test filter by user ID
  const userFilterCommand = `curl -s "${API_URL}?userid=1&limit=5" ${getAuthHeader()}`;
  const userResponse = await curl(userFilterCommand);
  const userParsed = parseResponse(userResponse);
  
  if (userParsed && userParsed.success) {
    logTestResult('Filter by User ID', true, `Found ${userParsed.data.length} orderlines for user 1`);
  } else {
    logTestResult('Filter by User ID', false, 'User ID filtering failed');
  }
}

// Test: Upsert orderline
async function testUpsertOrderline() {
  console.log('\n=== TEST: Upsert Orderline ===');
  
  // Test upsert create (no ID provided)
  const createData = {
    orderid: 2,
    productid: 174,
    userid: 2,
    addressid: 2,
    productamount: 75,
    discountamount: 5,
    orderamount: 70,
    quantity: 1,
    productname: "Upsert Test Product",
    productcategory: "Home & Garden",
    productcolour: "Green",
    orderstatus: "pending",
    deliveryfrom: "Kolkata Warehouse",
    location: "Kolkata"
  };
  
  const createCommand = `curl -s -X POST ${API_URL}/upsert ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(createData)}'`;
  const createResponse = await curl(createCommand);
  const createParsed = parseResponse(createResponse);
  
  if (createParsed && createParsed.success && createParsed.data) {
    logTestResult('Upsert Create', true, `Created orderline with ID: ${createParsed.data.id}`);
    
    // Test update via upsert (with ID)
    const updateData = {
      id: createParsed.data.id,
      orderstatus: "confirmed",
      quantity: 2,
      orderamount: 140.00
    };
    
    const updateCommand = `curl -s -X POST ${API_URL}/upsert ${getAuthHeader()} -H "Content-Type: application/json" -d '${JSON.stringify(updateData)}'`;
    const updateResponse = await curl(updateCommand);
    const updateParsed = parseResponse(updateResponse);
    
    if (updateParsed && updateParsed.success && updateParsed.data) {
      logTestResult('Upsert Update', true, `Updated orderline status to: ${updateParsed.data.orderstatus}, quantity: ${updateParsed.data.quantity}`);
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
  
  // Test invalid orderline ID
  const invalidIdCommand = `curl -s ${API_URL}/999999 ${getAuthHeader()}`;
  const invalidResponse = await curl(invalidIdCommand);
  const invalidParsed = parseResponse(invalidResponse);
  
  if (invalidParsed && !invalidParsed.success) {
    logTestResult('Invalid Orderline ID Error', true, 'Correctly returned error for invalid ID');
  } else {
    logTestResult('Invalid Orderline ID Error', false, 'Should have returned error for invalid ID');
  }
  
  // Test invalid data format
  const invalidDataCommand = `curl -s -X POST ${API_URL} ${getAuthHeader()} -H "Content-Type: application/json" -d '{"invalid": "data", "quantity": "not_a_number"}'`;
  const invalidDataResponse = await curl(invalidDataCommand);
  const invalidDataParsed = parseResponse(invalidDataResponse);
  
  if (invalidDataParsed && !invalidDataParsed.success) {
    logTestResult('Invalid Data Format Error', true, 'Correctly returned error for invalid data');
  } else {
    logTestResult('Invalid Data Format Error', false, 'Should have returned error for invalid data');
  }
  
  // Test missing status in status update
  const missingStatusCommand = `curl -s -X PATCH ${API_URL}/${testOrderlineId}/status ${getAuthHeader()} -H "Content-Type: application/json" -d '{}'`;
  const missingStatusResponse = await curl(missingStatusCommand);
  const missingStatusParsed = parseResponse(missingStatusResponse);
  
  if (missingStatusParsed && !missingStatusParsed.success) {
    logTestResult('Missing Status Error', true, 'Correctly returned error for missing status');
  } else {
    logTestResult('Missing Status Error', false, 'Should have returned error for missing status');
  }
  
  // Test empty orderline IDs in bulk update
  const emptyBulkCommand = `curl -s -X PATCH ${API_URL}/bulk-status ${getAuthHeader()} -H "Content-Type: application/json" -d '{"orderlineIds": [], "status": "delivered"}'`;
  const emptyBulkResponse = await curl(emptyBulkCommand);
  const emptyBulkParsed = parseResponse(emptyBulkResponse);
  
  if (emptyBulkParsed && !emptyBulkParsed.success) {
    logTestResult('Empty Bulk Update Error', true, 'Correctly returned error for empty orderline IDs');
  } else {
    logTestResult('Empty Bulk Update Error', false, 'Should have returned error for empty orderline IDs');
  }
}

// Test: Delete orderline (should be last test)
async function testDeleteOrderline() {
  console.log('\n=== TEST: Delete Orderline ===');
  
  if (!testOrderlineId) {
    logTestResult('Delete Orderline', false, 'No test orderline ID available');
    return false;
  }
  
  const command = `curl -s -X DELETE ${API_URL}/${testOrderlineId} ${getAuthHeader()}`;
  const response = await curl(command);
  const parsedResponse = parseResponse(response);
  
  if (parsedResponse && parsedResponse.success) {
    logTestResult('Delete Orderline', true, `Successfully deleted orderline ${testOrderlineId}`);
    
    // Verify orderline is deleted
    const verifyCommand = `curl -s ${API_URL}/${testOrderlineId} ${getAuthHeader()}`;
    const verifyResponse = await curl(verifyCommand);
    const verifyParsed = parseResponse(verifyResponse);
    
    if (verifyParsed && !verifyParsed.success) {
      logTestResult('Verify Orderline Deletion', true, 'Orderline not found after deletion');
    } else {
      logTestResult('Verify Orderline Deletion', false, 'Orderline still exists after deletion');
    }
    return true;
  } else {
    logTestResult('Delete Orderline', false, parsedResponse ? parsedResponse.message : 'Invalid response');
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
  console.log('🚀 Starting Comprehensive Orderlines API Tests');
  console.log('===============================================');
  
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
  await testCreateOrderline();
  await testGetAllOrderlines();
  await testGetOrderlineById();
  await testGetOrderlineByNumber();
  await testGetOrderlinesByOrderId();
  await testUpdateOrderline();
  await testUpdateOrderlineStatus();
  await testBulkUpdateOrderlineStatus();
  await testFiltering();
  await testUpsertOrderline();
  await testErrorHandling();
  await testPerformance();
  await testDeleteOrderline(); // This should be last
  
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
    console.log('\n🎉 All tests passed! Orderlines API is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the API implementation.');
  }
}

// Run the tests
runTests().catch(console.error); 