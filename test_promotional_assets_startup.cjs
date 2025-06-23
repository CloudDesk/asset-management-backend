#!/usr/bin/env node

/**
 * Startup Test for Promotional Assets Routes
 * Verifies that the routes are properly registered and server starts correctly
 */

const http = require('http');

const BASE_URL = 'http://localhost:5600';
const HEALTH_ENDPOINT = `${BASE_URL}/health`;
const SWAGGER_ENDPOINT = `${BASE_URL}/docs`;

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message) {
  console.log(`❌ ${message}`);
}

function makeHttpRequest(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          data: data
        });
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    request.setTimeout(5000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function testServerHealth() {
  logInfo('Testing server health endpoint...');
  
  try {
    const response = await makeHttpRequest(HEALTH_ENDPOINT);
    
    if (response.statusCode === 200) {
      logSuccess('Server health check passed');
      
      try {
        const healthData = JSON.parse(response.data);
        if (healthData.success && healthData.data.status === 'ok') {
          logSuccess('Health endpoint returns correct data structure');
          logInfo(`Server uptime: ${healthData.data.uptime}s`);
          logInfo(`Environment: ${healthData.data.environment}`);
        }
      } catch (parseError) {
        logError('Health endpoint returned invalid JSON');
      }
    } else {
      logError(`Health check failed with status: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    return false;
  }
  
  return true;
}

async function testSwaggerDocumentation() {
  logInfo('Testing Swagger documentation endpoint...');
  
  try {
    const response = await makeHttpRequest(SWAGGER_ENDPOINT);
    
    if (response.statusCode === 200) {
      logSuccess('Swagger documentation is accessible');
      
      // Check if it contains promotional assets routes
      if (response.data.includes('Promotional Assets')) {
        logSuccess('Promotional Assets routes are documented in Swagger');
      } else {
        logInfo('Promotional Assets routes may not be documented yet (check manually)');
      }
    } else {
      logError(`Swagger documentation failed with status: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Swagger documentation test failed: ${error.message}`);
  }
}

async function testPromotionalAssetsRoutes() {
  logInfo('Testing promotional assets route registration...');
  
  const routes = [
    '/v1/promotional-assets',
    '/v1/promotional-assets/1',
    '/v1/promotional-assets/audit/1'
  ];
  
  for (const route of routes) {
    try {
      const response = await makeHttpRequest(`${BASE_URL}${route}`);
      
      // We expect 401 (unauthorized) or 400 (bad request) rather than 404 (not found)
      // This indicates the route exists but requires authentication
      if (response.statusCode === 401) {
        logSuccess(`Route ${route} exists (requires authentication)`);
      } else if (response.statusCode === 400) {
        logSuccess(`Route ${route} exists (validation error)`);
      } else if (response.statusCode === 404) {
        logError(`Route ${route} not found - check route registration`);
      } else {
        logInfo(`Route ${route} responded with status ${response.statusCode}`);
      }
    } catch (error) {
      logError(`Failed to test route ${route}: ${error.message}`);
    }
  }
}

async function runStartupTests() {
  console.log('🚀 Starting Promotional Assets Startup Tests');
  console.log(`📡 Target server: ${BASE_URL}`);
  console.log('=' .repeat(50));
  
  // Wait a moment for server to be ready
  logInfo('Waiting for server to be ready...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const isHealthy = await testServerHealth();
  
  if (!isHealthy) {
    logError('Server is not healthy. Make sure the server is running on port 5600.');
    logInfo('Start the server with: npm run dev');
    process.exit(1);
  }
  
  await testSwaggerDocumentation();
  await testPromotionalAssetsRoutes();
  
  console.log('\n🎉 Startup tests completed!');
  console.log('\nNext steps:');
  console.log('1. Get a valid authentication token');
  console.log('2. Run: TEST_TOKEN=your-token node test_promotional_assets_comprehensive.js');
  console.log('3. Check Swagger UI at: http://localhost:5600/docs');
}

// Check if server is likely running
logInfo('Checking if server is running...');
runStartupTests().catch((error) => {
  logError(`Startup test failed: ${error.message}`);
  logInfo('Make sure the server is running: npm run dev');
  process.exit(1);
}); 