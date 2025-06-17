#!/usr/bin/env node

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5600/v1/phonepe';
const TEST_USER_ID = 1;
const TEST_AMOUNT = 100.50;
const TEST_MOBILE = '9876543210';
const TEST_NAME = 'John Doe';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logSection(message) {
  log(`\n${colors.bold}=== ${message} ===${colors.reset}`, colors.blue);
}

// Test functions
async function testHealthCheck() {
  logSection('Testing PhonePe Health Check');
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Health check passed');
      logInfo(`Service: ${response.data.data.service}`);
      logInfo(`Status: ${response.data.data.status}`);
      logInfo(`Environment: ${response.data.data.environment}`);
      logInfo(`Configuration: ${JSON.stringify(response.data.data.configuration, null, 2)}`);
      return true;
    } else {
      logError('Health check failed - unexpected response format');
      return false;
    }
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

async function testGenerateTransactionId() {
  logSection('Testing Transaction ID Generation');
  try {
    const response = await axios.get(`${API_BASE_URL}/generate-transaction-id?prefix=TEST`);
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Transaction ID generation passed');
      logInfo(`Generated ID: ${response.data.data.merchantTransactionId}`);
      logInfo(`Prefix: ${response.data.data.prefix}`);
      return response.data.data.merchantTransactionId;
    } else {
      logError('Transaction ID generation failed - unexpected response format');
      return null;
    }
  } catch (error) {
    logError(`Transaction ID generation failed: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function testPaymentInitiation(merchantTransactionId) {
  logSection('Testing Payment Initiation');
  
  const paymentData = {
    merchantTransactionId,
    amount: TEST_AMOUNT,
    name: TEST_NAME,
    mobileNumber: TEST_MOBILE,
    userId: TEST_USER_ID,
    productIds: [1, 2, 3],
    transactionFor: 'test_payment'
  };

  try {
    const response = await axios.post(`${API_BASE_URL}/initiate`, paymentData);
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Payment initiation passed');
      logInfo(`Transaction ID: ${response.data.data.merchantTransactionId}`);
      logInfo(`Redirect URL: ${response.data.data.redirectUrl}`);
      logInfo(`Amount: ₹${response.data.data.amount}`);
      logInfo(`Status: ${response.data.data.status}`);
      return response.data.data;
    } else {
      logError('Payment initiation failed - unexpected response format');
      return null;
    }
  } catch (error) {
    logError(`Payment initiation failed: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function testPaymentStatusCheck(merchantTransactionId) {
  logSection('Testing Payment Status Check');
  try {
    const response = await axios.get(`${API_BASE_URL}/status/${merchantTransactionId}`);
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Payment status check passed');
      logInfo(`Transaction ID: ${response.data.data.merchantTransactionId}`);
      logInfo(`Status: ${response.data.data.status}`);
      logInfo(`Success: ${response.data.data.success}`);
      logInfo(`Message: ${response.data.data.message}`);
      return response.data.data;
    } else {
      logError('Payment status check failed - unexpected response format');
      return null;
    }
  } catch (error) {
    logError(`Payment status check failed: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function testUserTransactionHistory() {
  logSection('Testing User Transaction History');
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${TEST_USER_ID}/transactions?page=1&limit=5`);
    
    if (response.status === 200 && response.data.success) {
      logSuccess('User transaction history retrieval passed');
      logInfo(`User ID: ${response.data.meta.userId}`);
      logInfo(`Page: ${response.data.meta.page}`);
      logInfo(`Limit: ${response.data.meta.limit}`);
      
      if (response.data.data && response.data.data.data) {
        logInfo(`Total transactions: ${response.data.data.pagination.total}`);
        logInfo(`Current page: ${response.data.data.pagination.currentPage}`);
        logInfo(`Total pages: ${response.data.data.pagination.totalPages}`);
      }
      
      return response.data.data;
    } else {
      logError('User transaction history retrieval failed - unexpected response format');
      return null;
    }
  } catch (error) {
    logError(`User transaction history retrieval failed: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function testTransactionStats() {
  logSection('Testing Transaction Statistics');
  try {
    const response = await axios.get(`${API_BASE_URL}/stats`);
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Transaction statistics retrieval passed');
      logInfo(`Statistics: ${JSON.stringify(response.data.data, null, 2)}`);
      return response.data.data;
    } else {
      logError('Transaction statistics retrieval failed - unexpected response format');
      return null;
    }
  } catch (error) {
    logError(`Transaction statistics retrieval failed: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function testValidation() {
  logSection('Testing Input Validation');
  
  // Test invalid payment data
  const invalidPaymentData = [
    {
      name: 'Missing required fields',
      data: {
        amount: TEST_AMOUNT
        // Missing name, mobileNumber, userId
      }
    },
    {
      name: 'Invalid mobile number',
      data: {
        merchantTransactionId: 'TEST_INVALID_MOBILE',
        amount: TEST_AMOUNT,
        name: TEST_NAME,
        mobileNumber: '123', // Invalid mobile number
        userId: TEST_USER_ID
      }
    },
    {
      name: 'Invalid amount',
      data: {
        merchantTransactionId: 'TEST_INVALID_AMOUNT',
        amount: -100, // Negative amount
        name: TEST_NAME,
        mobileNumber: TEST_MOBILE,
        userId: TEST_USER_ID
      }
    },
    {
      name: 'Invalid name format',
      data: {
        merchantTransactionId: 'TEST_INVALID_NAME',
        amount: TEST_AMOUNT,
        name: 'John123!@#', // Invalid name with numbers and special chars
        mobileNumber: TEST_MOBILE,
        userId: TEST_USER_ID
      }
    }
  ];

  let validationTestsPassed = 0;
  const totalValidationTests = invalidPaymentData.length;

  for (const testCase of invalidPaymentData) {
    try {
      logInfo(`Testing: ${testCase.name}`);
      const response = await axios.post(`${API_BASE_URL}/initiate`, testCase.data);
      
      // If we get here, validation didn't work as expected
      logWarning(`Validation test "${testCase.name}" should have failed but passed`);
    } catch (error) {
      if (error.response && error.response.status === 400) {
        logSuccess(`Validation test "${testCase.name}" correctly failed with 400 error`);
        validationTestsPassed++;
      } else {
        logError(`Validation test "${testCase.name}" failed with unexpected error: ${error.message}`);
      }
    }
  }

  logInfo(`Validation tests passed: ${validationTestsPassed}/${totalValidationTests}`);
  return validationTestsPassed === totalValidationTests;
}

async function testRefund(merchantTransactionId) {
  logSection('Testing Refund Functionality');
  
  const refundData = {
    refundAmount: 50.25,
    reason: 'Test refund for integration testing'
  };

  try {
    const response = await axios.post(`${API_BASE_URL}/refund/${merchantTransactionId}`, refundData);
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Refund initiation passed');
      logInfo(`Original Transaction ID: ${response.data.data.merchantTransactionId}`);
      logInfo(`Refund ID: ${response.data.data.refundId}`);
      logInfo(`Refund Amount: ₹${response.data.data.refundAmount}`);
      logInfo(`Reason: ${response.data.data.reason}`);
      logInfo(`Status: ${response.data.data.status}`);
      return response.data.data;
    } else {
      logError('Refund initiation failed - unexpected response format');
      return null;
    }
  } catch (error) {
    logError(`Refund initiation failed: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

// Main test execution
async function runAllTests() {
  log(`${colors.bold}🚀 Starting PhonePe Integration Tests${colors.reset}`, colors.blue);
  log(`Target API: ${API_BASE_URL}`, colors.blue);
  
  const testResults = {};
  let merchantTransactionId = null;

  // Run tests in sequence
  testResults.healthCheck = await testHealthCheck();
  
  if (testResults.healthCheck) {
    merchantTransactionId = await testGenerateTransactionId();
    testResults.generateTransactionId = !!merchantTransactionId;
    
    if (merchantTransactionId) {
      const paymentResult = await testPaymentInitiation(merchantTransactionId);
      testResults.paymentInitiation = !!paymentResult;
      
      // Wait a moment before checking status
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      testResults.paymentStatusCheck = !!(await testPaymentStatusCheck(merchantTransactionId));
      testResults.refund = !!(await testRefund(merchantTransactionId));
    }
    
    testResults.userTransactionHistory = !!(await testUserTransactionHistory());
    testResults.transactionStats = !!(await testTransactionStats());
    testResults.validation = await testValidation();
  }

  // Summary
  logSection('Test Summary');
  const totalTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(result => result === true).length;
  
  Object.entries(testResults).forEach(([testName, passed]) => {
    if (passed) {
      logSuccess(`${testName}: PASSED`);
    } else {
      logError(`${testName}: FAILED`);
    }
  });

  log(`\n${colors.bold}Overall Results: ${passedTests}/${totalTests} tests passed${colors.reset}`, 
      passedTests === totalTests ? colors.green : colors.red);

  if (passedTests === totalTests) {
    logSuccess('🎉 All tests passed! PhonePe integration is working correctly.');
  } else {
    logError('❌ Some tests failed. Please check the implementation and try again.');
  }

  // Instructions for manual testing
  if (merchantTransactionId) {
    logSection('Manual Testing Instructions');
    logInfo('To test the complete payment flow manually:');
    logInfo(`1. Copy this merchant transaction ID: ${merchantTransactionId}`);
    logInfo(`2. Use the payment initiation endpoint to get a redirect URL`);
    logInfo(`3. Open the redirect URL in a browser to complete the payment`);
    logInfo(`4. Check the payment status using the status endpoint`);
    logInfo(`5. Test the callback URL: ${API_BASE_URL}/callback/${merchantTransactionId}`);
  }

  return passedTests === totalTests;
}

// Error handling for the main execution
async function main() {
  try {
    await runAllTests();
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  main();
}

module.exports = {
  runAllTests,
  testHealthCheck,
  testPaymentInitiation,
  testPaymentStatusCheck,
  testUserTransactionHistory,
  testTransactionStats,
  testValidation,
  testRefund
}; 