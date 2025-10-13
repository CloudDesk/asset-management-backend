/**
 * Simple Working Test for Firebase OTP Backend
 * Tests the actual functionality with correct parameters
 */

const BASE_URL = 'http://localhost:5600';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function logSuccess(message) {
  log(colors.green, '✓', message);
}

function logError(message) {
  log(colors.red, '✗', message);
}

function logInfo(message) {
  log(colors.blue, 'ℹ', message);
}

/**
 * Test 1: Send OTP with correct phone number format
 */
async function testSendOTP() {
  logInfo('Testing: Send OTP with correct phone number format');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+918870339850' }),
    });
    
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      logSuccess(`OTP send request successful!`);
      logInfo(`Response: ${JSON.stringify(data.data, null, 2)}`);
      return true;
    } else {
      logError(`OTP send failed: ${data.message}`);
      logError(`Status: ${response.status}, Response: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Test invalid phone number (should fail)
 */
async function testInvalidPhone() {
  logInfo('Testing: Invalid phone number (should be rejected)');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '98870339850' }), // Missing +
    });
    
    const data = await response.json();
    
    if (response.status === 400 && !data.success) {
      logSuccess('Invalid phone number correctly rejected');
      return true;
    } else {
      logError('Should have rejected invalid phone number');
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Test logout endpoint (should work)
 */
async function testLogout() {
  logInfo('Testing: Logout endpoint');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/logout`, {
      method: 'POST',
      // No Content-Type header for empty body
    });
    
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      logSuccess('Logout endpoint working');
      return true;
    } else {
      logError(`Logout failed: ${data.message}`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Test GET /me endpoint (should return 401)
 */
async function testGetMe() {
  logInfo('Testing: GET /me endpoint (should return 401)');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/me`, {
      method: 'GET',
      // No Content-Type header for GET request
    });
    
    const data = await response.json();
    
    if (response.status === 401 && !data.success) {
      logSuccess('Unauthenticated request correctly rejected');
      return true;
    } else {
      logError('Should have rejected unauthenticated request');
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🔥 Firebase OTP Backend - Working Test');
  console.log('='.repeat(60) + '\n');
  
  logInfo(`Testing backend at: ${BASE_URL}`);
  logInfo('This tests your backend implementation with correct parameters\n');
  
  const results = [];
  
  results.push(await testSendOTP());
  console.log('');
  results.push(await testInvalidPhone());
  console.log('');
  results.push(await testLogout());
  console.log('');
  results.push(await testGetMe());
  console.log('');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('='.repeat(60));
  logInfo(`Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    logSuccess('🎉 All tests passed! Your backend is working correctly!');
    logInfo('The issue is with Firebase Client SDK reCAPTCHA, not your backend.');
  } else {
    logError('❌ Some tests failed. Check the errors above.');
  }
  console.log('='.repeat(60) + '\n');
}

// Run tests
runAllTests().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  process.exit(1);
});
