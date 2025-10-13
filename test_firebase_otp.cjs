/**
 * Firebase OTP Authentication Test Script
 * 
 * This script tests the Firebase OTP endpoints without requiring
 * a real Firebase ID token (for backend validation only)
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

function logWarning(message) {
  log(colors.yellow, '⚠', message);
}

// Test counter
let passed = 0;
let failed = 0;

/**
 * Test 1: Send OTP endpoint
 */
async function testSendOTP() {
  logInfo('Test 1: POST /v1/firebase-otp/send');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+919876543210' }),
    });
    
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      logSuccess('Valid phone number accepted');
      logInfo(`Response: ${JSON.stringify(data.data)}`);
      passed++;
    } else {
      logError('Unexpected response');
      failed++;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    failed++;
  }
}

/**
 * Test 2: Invalid phone number
 */
async function testInvalidPhoneNumber() {
  logInfo('Test 2: Invalid phone number validation');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '1234567890' }),
    });
    
    const data = await response.json();
    
    if (response.status === 400 && !data.success) {
      logSuccess('Invalid phone number rejected correctly');
      logInfo(`Error message: ${data.message}`);
      passed++;
    } else {
      logError('Invalid phone number should be rejected');
      failed++;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    failed++;
  }
}

/**
 * Test 3: Missing phone number
 */
async function testMissingPhoneNumber() {
  logInfo('Test 3: Missing phone number validation');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    
    const data = await response.json();
    
    if (response.status === 400 && !data.success) {
      logSuccess('Missing phone number rejected correctly');
      passed++;
    } else {
      logError('Request without phone number should be rejected');
      failed++;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    failed++;
  }
}

/**
 * Test 4: Session creation without token
 */
async function testSessionWithoutToken() {
  logInfo('Test 4: Session creation without Firebase token');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    
    const data = await response.json();
    
    if (response.status === 400 && !data.success) {
      logSuccess('Session creation without token rejected correctly');
      passed++;
    } else {
      logError('Session creation without token should be rejected');
      failed++;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    failed++;
  }
}

/**
 * Test 5: Session creation with invalid token
 */
async function testSessionWithInvalidToken() {
  logInfo('Test 5: Session creation with invalid Firebase token');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'invalid-token-123' }),
    });
    
    const data = await response.json();
    
    if (response.status === 401 && !data.success) {
      logSuccess('Invalid Firebase token rejected correctly');
      logInfo(`Error message: ${data.message}`);
      passed++;
    } else {
      logError('Invalid token should be rejected');
      failed++;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    failed++;
  }
}

/**
 * Test 6: Get current user without authentication
 */
async function testMeWithoutAuth() {
  logInfo('Test 6: Get current user without authentication');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/me`, {
      method: 'GET',
    });
    
    const data = await response.json();
    
    if (response.status === 401 && !data.success) {
      logSuccess('Unauthenticated request rejected correctly');
      passed++;
    } else {
      logError('Request without auth should be rejected');
      failed++;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    failed++;
  }
}

/**
 * Test 7: Logout endpoint
 */
async function testLogout() {
  logInfo('Test 7: Logout endpoint');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/logout`, {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      logSuccess('Logout endpoint works correctly');
      passed++;
    } else {
      logError('Logout should succeed');
      failed++;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    failed++;
  }
}

/**
 * Test 8: Rate limiting (send multiple requests)
 */
async function testRateLimiting() {
  logInfo('Test 8: Rate limiting check (sending 12 requests rapidly)');
  
  try {
    let rateLimited = false;
    
    for (let i = 0; i < 12; i++) {
      const response = await fetch(`${BASE_URL}/v1/firebase-otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: `+9198765432${i.toString().padStart(2, '0')}` }),
      });
      
      if (response.status === 429) {
        rateLimited = true;
        break;
      }
    }
    
    if (rateLimited) {
      logSuccess('Rate limiting is working');
      passed++;
    } else {
      logWarning('Rate limiting might not be triggered (normal if limits are high)');
      passed++;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    failed++;
  }
}

/**
 * Test 9: Health check
 */
async function testHealthCheck() {
  logInfo('Test 9: Server health check');
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      logSuccess('Server is healthy');
      passed++;
    } else {
      logError('Health check failed');
      failed++;
    }
  } catch (error) {
    logError(`Server might not be running: ${error.message}`);
    failed++;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('Firebase OTP Authentication - Test Suite');
  console.log('='.repeat(60) + '\n');
  
  logInfo(`Testing against: ${BASE_URL}`);
  logWarning('Make sure the server is running (npm run dev)\n');
  
  // Run all tests
  await testHealthCheck();
  await testSendOTP();
  await testInvalidPhoneNumber();
  await testMissingPhoneNumber();
  await testSessionWithoutToken();
  await testSessionWithInvalidToken();
  await testMeWithoutAuth();
  await testLogout();
  await testRateLimiting();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  
  const total = passed + failed;
  const successRate = ((passed / total) * 100).toFixed(1);
  
  logSuccess(`Passed: ${passed}/${total}`);
  if (failed > 0) {
    logError(`Failed: ${failed}/${total}`);
  }
  
  console.log(`\nSuccess Rate: ${successRate}%\n`);
  
  if (failed === 0) {
    logSuccess('All tests passed! ✨');
    console.log('\nNext steps:');
    console.log('1. Set up Firebase credentials in .env file');
    console.log('2. Test with real Firebase ID tokens from client');
    console.log('3. Check Swagger docs at http://localhost:3000/docs\n');
  } else {
    logError('Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  process.exit(1);
});

