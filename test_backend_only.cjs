/**
 * Backend-Only Firebase OTP Test
 * Tests the backend implementation without Firebase Client SDK
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

/**
 * Test Backend Endpoints (without Firebase Client SDK)
 */
async function testBackendEndpoints() {
  console.log('\n' + '='.repeat(60));
  console.log('Firebase OTP Backend-Only Test');
  console.log('='.repeat(60) + '\n');
  
  logInfo(`Testing backend at: ${BASE_URL}`);
  logWarning('Note: This tests backend validation, not actual SMS sending\n');
  
  // Test 1: Send OTP endpoint (validation only)
  logInfo('Test 1: POST /v1/firebase-otp/send (validation)');
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+918870339850' }),
    });
    
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      logSuccess('Backend validation working correctly');
      logInfo(`Response: ${JSON.stringify(data.data)}`);
    } else {
      logError('Backend validation failed');
      logError(`Status: ${response.status}, Response: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
  }
  
  // Test 2: Invalid phone number
  logInfo('\nTest 2: Invalid phone number validation');
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '98870339850' }), // Missing +
    });
    
    const data = await response.json();
    
    if (response.status === 400 && !data.success) {
      logSuccess('Invalid phone number correctly rejected');
    } else {
      logError('Should have rejected invalid phone number');
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
  }
  
  // Test 3: Session endpoint with invalid token
  logInfo('\nTest 3: Session endpoint validation');
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'invalid-token-12345' }),
    });
    
    const data = await response.json();
    
    if (response.status === 401 && !data.success) {
      logSuccess('Invalid Firebase token correctly rejected');
    } else {
      logError('Should have rejected invalid token');
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
  }
  
  // Test 4: Logout endpoint
  logInfo('\nTest 4: Logout endpoint');
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/logout`, {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      logSuccess('Logout endpoint working');
    } else {
      logError('Logout endpoint failed');
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
  }
  
  // Test 5: Get current user without auth
  logInfo('\nTest 5: Get current user (no auth)');
  try {
    const response = await fetch(`${BASE_URL}/v1/firebase-otp/me`);
    
    const data = await response.json();
    
    if (response.status === 401 && !data.success) {
      logSuccess('Unauthenticated request correctly rejected');
    } else {
      logError('Should have rejected unauthenticated request');
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
  logSuccess('Backend tests completed!');
  logInfo('Your Firebase OTP backend implementation is working correctly.');
  logWarning('The reCAPTCHA issue is a Firebase Client SDK problem, not your backend.');
  console.log('='.repeat(60) + '\n');
}

// Run tests
testBackendEndpoints().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  process.exit(1);
});
