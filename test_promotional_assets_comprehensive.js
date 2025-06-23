#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Promotional Assets API
 * Tests all CRUD operations, filtering, pagination, and error scenarios
 */

const BASE_URL = 'http://localhost:5600/v1';
const PROMOTIONAL_ASSETS_URL = `${BASE_URL}/promotional-assets`;

// Test configuration
const TEST_TOKEN = process.env.TEST_TOKEN || 'your-test-token-here';
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${TEST_TOKEN}`
};

// Test data
const SAMPLE_ASSET = {
  type: 'banner',
  placement: 'homepage',
  title: 'Test Promotional Banner',
  content: {
    imageUrl: 'https://example.com/banner.jpg',
    text: 'Special offer - 50% off!',
    ctaButton: {
      text: 'Shop Now',
      link: 'https://example.com/shop'
    }
  },
  priority: 10,
  is_active: true,
  schedule_start: '2024-01-01T00:00:00Z',
  schedule_end: '2024-12-31T23:59:59Z'
};

const SAMPLE_ASSET_UPDATE = {
  title: 'Updated Promotional Banner',
  content: {
    imageUrl: 'https://example.com/updated-banner.jpg',
    text: 'Updated offer - 70% off!',
    ctaButton: {
      text: 'Buy Now',
      link: 'https://example.com/buy'
    }
  },
  priority: 15,
  is_active: false
};

// Utility functions
function logTest(testName) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log('=' .repeat(50));
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message, error) {
  console.log(`❌ ${message}`);
  if (error) {
    console.log(`   Error: ${error.message || error}`);
  }
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...HEADERS, ...options.headers }
    });

    const contentType = response.headers.get('content-type');
    let data = null;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      data: data,
      success: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      data: null,
      success: false,
      error: error.message
    };
  }
}

// Test functions
async function testAuthentication() {
  logTest('Authentication Requirements');
  
  // Test without token
  const noTokenResponse = await fetch(`${PROMOTIONAL_ASSETS_URL}`, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (noTokenResponse.status === 401) {
    logSuccess('Authentication required - correctly rejected request without token');
  } else {
    logError('Authentication check failed - should reject requests without token');
  }

  // Test with invalid token
  const invalidTokenResponse = await fetch(`${PROMOTIONAL_ASSETS_URL}`, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token'
    }
  });
  
  if (invalidTokenResponse.status === 401) {
    logSuccess('Invalid token correctly rejected');
  } else {
    logError('Invalid token check failed');
  }
}

async function testCreateAsset() {
  logTest('Create Promotional Asset');
  
  const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}`, {
    method: 'POST',
    body: JSON.stringify(SAMPLE_ASSET)
  });

  if (response.success && response.data.success) {
    logSuccess(`Asset created successfully with ID: ${response.data.data.id}`);
    logInfo(`Title: ${response.data.data.title}`);
    logInfo(`Type: ${response.data.data.type}`);
    logInfo(`Version: ${response.data.data.version}`);
    return response.data.data;
  } else {
    logError('Failed to create asset', response.data);
    return null;
  }
}

async function testCreateAssetValidation() {
  logTest('Create Asset - Input Validation');

  // Test missing required fields
  const invalidAsset = {
    type: 'banner',
    // Missing placement, title, content
  };

  const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}`, {
    method: 'POST',
    body: JSON.stringify(invalidAsset)
  });

  if (!response.success && response.status === 400) {
    logSuccess('Validation correctly rejected asset with missing fields');
  } else {
    logError('Validation should reject asset with missing required fields');
  }

  // Test invalid asset type
  const invalidTypeAsset = {
    ...SAMPLE_ASSET,
    type: 'invalid_type'
  };

  const response2 = await makeRequest(`${PROMOTIONAL_ASSETS_URL}`, {
    method: 'POST',
    body: JSON.stringify(invalidTypeAsset)
  });

  if (!response2.success && response2.status === 400) {
    logSuccess('Validation correctly rejected asset with invalid type');
  } else {
    logError('Validation should reject asset with invalid type');
  }

  // Test invalid schedule dates
  const invalidScheduleAsset = {
    ...SAMPLE_ASSET,
    schedule_start: '2024-12-31T23:59:59Z',
    schedule_end: '2024-01-01T00:00:00Z' // End before start
  };

  const response3 = await makeRequest(`${PROMOTIONAL_ASSETS_URL}`, {
    method: 'POST',
    body: JSON.stringify(invalidScheduleAsset)
  });

  if (!response3.success && response3.status === 400) {
    logSuccess('Validation correctly rejected asset with invalid schedule dates');
  } else {
    logError('Validation should reject asset with end date before start date');
  }
}

async function testGetAssets() {
  logTest('Get All Promotional Assets');
  
  const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}`);

  if (response.success && response.data.success) {
    logSuccess(`Retrieved ${response.data.data.length} assets`);
    logInfo(`Total assets: ${response.data.pagination.total}`);
    logInfo(`Current page: ${response.data.pagination.page}`);
    
    if (response.data.data.length > 0) {
      logInfo(`Sample asset: ${response.data.data[0].title}`);
    }
    
    return response.data.data;
  } else {
    logError('Failed to retrieve assets', response.data);
    return [];
  }
}

async function testGetAssetById(assetId) {
  logTest(`Get Asset by ID: ${assetId}`);
  
  const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${assetId}`);

  if (response.success && response.data.success) {
    logSuccess(`Retrieved asset: ${response.data.data.title}`);
    logInfo(`Type: ${response.data.data.type}`);
    logInfo(`Priority: ${response.data.data.priority}`);
    logInfo(`Active: ${response.data.data.is_active}`);
    return response.data.data;
  } else {
    logError(`Failed to retrieve asset ${assetId}`, response.data);
    return null;
  }
}

async function testGetNonExistentAsset() {
  logTest('Get Non-existent Asset');
  
  const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/99999`);

  if (!response.success && response.status === 404) {
    logSuccess('Correctly returned 404 for non-existent asset');
  } else {
    logError('Should return 404 for non-existent asset');
  }
}

async function testFilterAssets() {
  logTest('Filter Promotional Assets');

  // Test filter by type
  const typeResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?type=banner`);
  if (typeResponse.success) {
    logSuccess(`Type filter returned ${typeResponse.data.data.length} banner assets`);
  }

  // Test filter by active status
  const activeResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?is_active=true`);
  if (activeResponse.success) {
    logSuccess(`Active filter returned ${activeResponse.data.data.length} active assets`);
  }

  // Test filter by placement
  const placementResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?placement=homepage`);
  if (placementResponse.success) {
    logSuccess(`Placement filter returned ${placementResponse.data.data.length} homepage assets`);
  }

  // Test filter by priority range
  const priorityResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?priority_min=5&priority_max=15`);
  if (priorityResponse.success) {
    logSuccess(`Priority filter returned ${priorityResponse.data.data.length} assets in range 5-15`);
  }

  // Test currently scheduled assets
  const scheduledResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?schedule_active=true`);
  if (scheduledResponse.success) {
    logSuccess(`Schedule filter returned ${scheduledResponse.data.data.length} currently scheduled assets`);
  }
}

async function testPagination() {
  logTest('Pagination');

  // Test first page
  const page1Response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?page=1&limit=2`);
  if (page1Response.success) {
    logSuccess(`Page 1 returned ${page1Response.data.data.length} assets`);
    logInfo(`Total pages: ${page1Response.data.pagination.totalPages}`);
  }

  // Test second page if it exists
  const page2Response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?page=2&limit=2`);
  if (page2Response.success) {
    logSuccess(`Page 2 returned ${page2Response.data.data.length} assets`);
  }
}

async function testUpdateAsset(asset) {
  logTest(`Update Asset: ${asset.id}`);

  const updateData = {
    ...SAMPLE_ASSET_UPDATE,
    version: asset.version
  };

  const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${asset.id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  });

  if (response.success && response.data.success) {
    logSuccess(`Asset updated successfully`);
    logInfo(`New title: ${response.data.data.title}`);
    logInfo(`New priority: ${response.data.data.priority}`);
    logInfo(`New version: ${response.data.data.version}`);
    return response.data.data;
  } else {
    logError('Failed to update asset', response.data);
    return null;
  }
}

async function testUpdateConcurrencyControl(asset) {
  logTest('Update Asset - Concurrency Control');

  const updateData = {
    title: 'Concurrent Update Test',
    version: 999 // Wrong version number
  };

  const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${asset.id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  });

  if (!response.success && response.status === 400) {
    logSuccess('Concurrency control correctly rejected update with wrong version');
  } else {
    logError('Concurrency control should reject updates with wrong version');
  }
}

async function testGetAuditLogs(assetId) {
  logTest(`Get Audit Logs for Asset: ${assetId}`);
  
  const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/audit/${assetId}`);

  if (response.success && response.data.success) {
    logSuccess(`Retrieved ${response.data.data.length} audit log entries`);
    
    response.data.data.forEach((log, index) => {
      logInfo(`Log ${index + 1}: ${log.action} by ${log.changed_by}`);
    });
    
    return response.data.data;
  } else {
    logError(`Failed to retrieve audit logs for asset ${assetId}`, response.data);
    return [];
  }
}

async function testDeleteAsset(assetId) {
  logTest(`Delete Asset: ${assetId}`);
  
  const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${assetId}`, {
    method: 'DELETE'
  });

  if (response.success && response.data.success) {
    logSuccess(`Asset ${assetId} deleted successfully`);
    return true;
  } else {
    logError(`Failed to delete asset ${assetId}`, response.data);
    return false;
  }
}

async function testDeleteNonExistentAsset() {
  logTest('Delete Non-existent Asset');
  
  const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/99999`, {
    method: 'DELETE'
  });

  if (!response.success && response.status === 404) {
    logSuccess('Correctly returned 404 when trying to delete non-existent asset');
  } else {
    logError('Should return 404 when trying to delete non-existent asset');
  }
}

async function testInvalidEndpoints() {
  logTest('Invalid Endpoints');

  // Test invalid asset ID format
  const response1 = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/abc`);
  if (!response1.success && response1.status === 400) {
    logSuccess('Correctly rejected invalid asset ID format');
  } else {
    logError('Should reject invalid asset ID format');
  }

  // Test unsupported HTTP method
  const response2 = await makeRequest(`${PROMOTIONAL_ASSETS_URL}`, {
    method: 'PATCH'
  });
  if (!response2.success && response2.status === 404) {
    logSuccess('Correctly rejected unsupported HTTP method');
  } else {
    logError('Should reject unsupported HTTP method');
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Promotional Assets API Test Suite');
  console.log(`📡 Base URL: ${BASE_URL}`);
  console.log(`🔑 Using token: ${TEST_TOKEN.substring(0, 10)}...`);
  console.log('\n');

  let createdAsset = null;
  let updatedAsset = null;

  try {
    // Authentication tests
    await testAuthentication();
    
    // Input validation tests
    await testCreateAssetValidation();
    
    // Create asset test
    createdAsset = await testCreateAsset();
    
    if (!createdAsset) {
      logError('Cannot continue tests without a created asset');
      return;
    }

    // Read operations
    await testGetAssets();
    await testGetAssetById(createdAsset.id);
    await testGetNonExistentAsset();
    
    // Filtering and pagination
    await testFilterAssets();
    await testPagination();
    
    // Update operations
    updatedAsset = await testUpdateAsset(createdAsset);
    await testUpdateConcurrencyControl(updatedAsset || createdAsset);
    
    // Audit logs
    await testGetAuditLogs(createdAsset.id);
    
    // Error scenarios
    await testDeleteNonExistentAsset();
    await testInvalidEndpoints();
    
    // Cleanup - delete the test asset
    await testDeleteAsset(createdAsset.id);
    
    console.log('\n🎉 All tests completed!');
    console.log('Check the logs above for any failures.');
    
  } catch (error) {
    logError('Test suite failed with unexpected error', error);
  }
}

// Check if we have the required token
if (!TEST_TOKEN || TEST_TOKEN === 'your-test-token-here') {
  console.log('❌ Please set TEST_TOKEN environment variable with a valid authentication token');
  console.log('   Example: TEST_TOKEN=your-actual-token node test_promotional_assets_comprehensive.js');
  process.exit(1);
}

// Run the tests
runAllTests().catch(console.error); 