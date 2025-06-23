#!/usr/bin/env node

/**
 * COMPREHENSIVE PRODUCTION-READY TEST SUITE
 * Testing promotional_assets and asset_audit_logs tables
 * All CRUD operations, field validations, filters, edge cases
 */

const BASE_URL = 'http://localhost:5600/v1';
const PROMOTIONAL_ASSETS_URL = `${BASE_URL}/promotional-assets`;

// Test data sets for comprehensive testing
const VALID_ASSETS = [
  {
    type: 'banner',
    placement: 'homepage',
    title: 'Summer Sale Banner',
    content: {
      imageUrl: 'https://example.com/summer-banner.jpg',
      text: 'Summer Sale - Up to 70% Off!',
      ctaButton: {
        text: 'Shop Now',
        link: 'https://example.com/summer-sale'
      },
      backgroundColor: '#ff6b6b',
      textColor: '#ffffff'
    },
    priority: 10,
    is_active: true,
    schedule_start: '2024-06-01T00:00:00Z',
    schedule_end: '2024-08-31T23:59:59Z'
  },
  {
    type: 'featured_ad',
    placement: 'sidebar',
    title: 'New Product Launch',
    content: {
      imageUrl: 'https://example.com/product-launch.jpg',
      text: 'Introducing our latest innovation',
      features: ['Feature 1', 'Feature 2', 'Feature 3'],
      price: '$299.99',
      discount: '20%'
    },
    priority: 5,
    is_active: true,
    schedule_start: '2024-07-01T00:00:00Z',
    schedule_end: '2024-12-31T23:59:59Z'
  },
  {
    type: 'popup',
    placement: 'modal',
    title: 'Newsletter Signup',
    content: {
      title: 'Stay Updated!',
      description: 'Get the latest news and exclusive offers',
      formFields: ['email', 'firstName'],
      incentive: '10% discount on first order'
    },
    priority: 15,
    is_active: false,
    schedule_start: '2024-01-01T00:00:00Z',
    schedule_end: '2024-12-31T23:59:59Z'
  },
  {
    type: 'carousel',
    placement: 'header',
    title: 'Featured Products Carousel',
    content: {
      slides: [
        {
          imageUrl: 'https://example.com/product1.jpg',
          title: 'Product 1',
          price: '$199.99'
        },
        {
          imageUrl: 'https://example.com/product2.jpg',
          title: 'Product 2',
          price: '$299.99'
        }
      ],
      autoPlay: true,
      interval: 5000
    },
    priority: 8,
    is_active: true,
    schedule_start: '2024-05-01T00:00:00Z',
    schedule_end: '2024-11-30T23:59:59Z'
  }
];

const INVALID_ASSETS = [
  {
    name: 'Missing required fields',
    data: {
      type: 'banner',
      // Missing: placement, title, content
    },
    expectedError: 'validation'
  },
  {
    name: 'Invalid asset type',
    data: {
      type: 'invalid_type',
      placement: 'homepage',
      title: 'Test',
      content: { test: 'data' }
    },
    expectedError: 'validation'
  },
  {
    name: 'Empty content object',
    data: {
      type: 'banner',
      placement: 'homepage',
      title: 'Test',
      content: {}
    },
    expectedError: 'validation'
  },
  {
    name: 'Invalid schedule dates',
    data: {
      type: 'banner',
      placement: 'homepage',
      title: 'Test',
      content: { test: 'data' },
      schedule_start: '2024-12-31T23:59:59Z',
      schedule_end: '2024-01-01T00:00:00Z' // End before start
    },
    expectedError: 'validation'
  },
  {
    name: 'Negative priority',
    data: {
      type: 'banner',
      placement: 'homepage',
      title: 'Test',
      content: { test: 'data' },
      priority: -5
    },
    expectedError: 'validation'
  },
  {
    name: 'Too long title',
    data: {
      type: 'banner',
      placement: 'homepage',
      title: 'A'.repeat(300), // Exceeds max length
      content: { test: 'data' }
    },
    expectedError: 'validation'
  }
];

// Utility functions
function logSection(sectionName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 ${sectionName.toUpperCase()}`);
  console.log(`${'='.repeat(80)}`);
}

function logTest(testName) {
  console.log(`\n🔬 Testing: ${testName}`);
  console.log('-'.repeat(50));
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message, error) {
  console.log(`❌ ${message}`);
  if (error) {
    console.log(`   Error: ${JSON.stringify(error, null, 2)}`);
  }
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function logWarning(message) {
  console.log(`⚠️  ${message}`);
}

async function makeRequest(url, options = {}) {
  try {
    // Don't set Content-Type for DELETE requests without body
    const headers = {};
    if (options.method !== 'DELETE' || options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      headers: headers,
      ...options,
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

// Test Statistics
const testStats = {
  total: 0,
  passed: 0,
  failed: 0
};

function recordTest(passed) {
  testStats.total++;
  if (passed) testStats.passed++;
  else testStats.failed++;
}

// Core test functions
async function testCreateAssets() {
  logSection('CREATE OPERATIONS - Testing promotional_assets table');
  
  const createdAssets = [];

  // Test valid asset creation
  for (let i = 0; i < VALID_ASSETS.length; i++) {
    const asset = VALID_ASSETS[i];
    logTest(`Create Valid Asset ${i + 1}: ${asset.title}`);
    
    const response = await makeRequest(PROMOTIONAL_ASSETS_URL, {
      method: 'POST',
      body: JSON.stringify(asset)
    });

    if (response.success && response.data.success) {
      logSuccess(`Asset created: ID ${response.data.data.id}`);
      logInfo(`Title: ${response.data.data.title}`);
      logInfo(`Type: ${response.data.data.type}`);
      logInfo(`Priority: ${response.data.data.priority}`);
      logInfo(`Active: ${response.data.data.is_active}`);
      logInfo(`Version: ${response.data.data.version}`);
      createdAssets.push(response.data.data);
      recordTest(true);
    } else {
      logError(`Failed to create asset: ${asset.title}`, response.data);
      recordTest(false);
    }
  }

  // Test invalid asset creation
  for (const invalidAsset of INVALID_ASSETS) {
    logTest(`Create Invalid Asset: ${invalidAsset.name}`);
    
    const response = await makeRequest(PROMOTIONAL_ASSETS_URL, {
      method: 'POST',
      body: JSON.stringify(invalidAsset.data)
    });

    if (!response.success && response.status === 400) {
      logSuccess(`Correctly rejected invalid asset: ${invalidAsset.name}`);
      recordTest(true);
    } else {
      logError(`Should have rejected: ${invalidAsset.name}`, response.data);
      recordTest(false);
    }
  }

  return createdAssets;
}

async function testReadOperations(createdAssets) {
  logSection('READ OPERATIONS - Testing data retrieval');

  // Test get all assets
  logTest('Get All Assets');
  const allResponse = await makeRequest(PROMOTIONAL_ASSETS_URL);
  
  if (allResponse.success && allResponse.data.success) {
    logSuccess(`Retrieved ${allResponse.data.data.length} assets`);
    logInfo(`Total in database: ${allResponse.data.pagination.total}`);
    logInfo(`Current page: ${allResponse.data.pagination.page}`);
    logInfo(`Total pages: ${allResponse.data.pagination.totalPages}`);
    recordTest(true);
    
    // Validate all required fields are present
    const firstAsset = allResponse.data.data[0];
    if (firstAsset) {
      const requiredFields = ['id', 'type', 'placement', 'title', 'content', 'priority', 'is_active', 'version', 'createddate', 'modifieddate'];
      const missingFields = requiredFields.filter(field => !(field in firstAsset));
      
      if (missingFields.length === 0) {
        logSuccess('All required fields present in response');
        recordTest(true);
      } else {
        logError(`Missing fields: ${missingFields.join(', ')}`);
        recordTest(false);
      }
    }
  } else {
    logError('Failed to retrieve all assets', allResponse.data);
    recordTest(false);
  }

  // Test get specific assets
  for (const asset of createdAssets.slice(0, 2)) { // Test first 2 assets
    logTest(`Get Asset by ID: ${asset.id}`);
    
    const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${asset.id}`);
    
    if (response.success && response.data.success) {
      logSuccess(`Retrieved asset: ${response.data.data.title}`);
      logInfo(`Type: ${response.data.data.type}`);
      logInfo(`Version: ${response.data.data.version}`);
      
      // Validate content structure
      if (typeof response.data.data.content === 'object' && response.data.data.content !== null) {
        logSuccess('Content field is valid JSON object');
        recordTest(true);
      } else {
        logError('Content field is not a valid JSON object');
        recordTest(false);
      }
    } else {
      logError(`Failed to retrieve asset ${asset.id}`, response.data);
      recordTest(false);
    }
  }

  // Test get non-existent asset
  logTest('Get Non-existent Asset');
  const nonExistentResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/99999`);
  
  if (!nonExistentResponse.success && nonExistentResponse.status === 404) {
    logSuccess('Correctly returned 404 for non-existent asset');
    recordTest(true);
  } else {
    logError('Should return 404 for non-existent asset');
    recordTest(false);
  }
}

async function testFilteringOperations() {
  logSection('FILTERING OPERATIONS - Testing all filter capabilities');

  // Test filter by type
  logTest('Filter by Type: banner');
  const typeResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?type=banner`);
  if (typeResponse.success) {
    logSuccess(`Type filter returned ${typeResponse.data.data.length} banner assets`);
    const allBanners = typeResponse.data.data.every(asset => asset.type === 'banner');
    if (allBanners) {
      logSuccess('All returned assets are of type banner');
      recordTest(true);
    } else {
      logError('Some returned assets are not of type banner');
      recordTest(false);
    }
  } else {
    logError('Type filter failed', typeResponse.data);
    recordTest(false);
  }

  // Test filter by active status
  logTest('Filter by Active Status: true');
  const activeResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?is_active=true`);
  if (activeResponse.success) {
    logSuccess(`Active filter returned ${activeResponse.data.data.length} active assets`);
    const allActive = activeResponse.data.data.every(asset => asset.is_active === true);
    if (allActive) {
      logSuccess('All returned assets are active');
      recordTest(true);
    } else {
      logError('Some returned assets are not active');
      recordTest(false);
    }
  } else {
    logError('Active status filter failed', activeResponse.data);
    recordTest(false);
  }

  // Test filter by placement
  logTest('Filter by Placement: homepage');
  const placementResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?placement=homepage`);
  if (placementResponse.success) {
    logSuccess(`Placement filter returned ${placementResponse.data.data.length} homepage assets`);
    recordTest(true);
  } else {
    logError('Placement filter failed', placementResponse.data);
    recordTest(false);
  }

  // Test filter by priority range
  logTest('Filter by Priority Range: 5-15');
  const priorityResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?priority_min=5&priority_max=15`);
  if (priorityResponse.success) {
    logSuccess(`Priority filter returned ${priorityResponse.data.data.length} assets`);
    const allInRange = priorityResponse.data.data.every(asset => asset.priority >= 5 && asset.priority <= 15);
    if (allInRange) {
      logSuccess('All returned assets are in priority range 5-15');
      recordTest(true);
    } else {
      logError('Some returned assets are outside priority range 5-15');
      recordTest(false);
    }
  } else {
    logError('Priority range filter failed', priorityResponse.data);
    recordTest(false);
  }

  // Test currently scheduled assets
  logTest('Filter by Current Schedule');
  const scheduledResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?schedule_active=true`);
  if (scheduledResponse.success) {
    logSuccess(`Schedule filter returned ${scheduledResponse.data.data.length} currently scheduled assets`);
    recordTest(true);
  } else {
    logError('Schedule filter failed', scheduledResponse.data);
    recordTest(false);
  }

  // Test combined filters
  logTest('Combined Filters: type=banner&is_active=true');
  const combinedResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?type=banner&is_active=true`);
  if (combinedResponse.success) {
    logSuccess(`Combined filter returned ${combinedResponse.data.data.length} active banner assets`);
    const allMatch = combinedResponse.data.data.every(asset => 
      asset.type === 'banner' && asset.is_active === true
    );
    if (allMatch) {
      logSuccess('All returned assets match combined filters');
      recordTest(true);
    } else {
      logError('Some returned assets do not match combined filters');
      recordTest(false);
    }
  } else {
    logError('Combined filters failed', combinedResponse.data);
    recordTest(false);
  }
}

async function testPaginationOperations() {
  logSection('PAGINATION OPERATIONS - Testing pagination functionality');

  // Test first page
  logTest('Pagination: Page 1, Limit 2');
  const page1Response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?page=1&limit=2`);
  if (page1Response.success) {
    logSuccess(`Page 1 returned ${page1Response.data.data.length} assets`);
    logInfo(`Total: ${page1Response.data.pagination.total}`);
    logInfo(`Total pages: ${page1Response.data.pagination.totalPages}`);
    logInfo(`Current page: ${page1Response.data.pagination.page}`);
    logInfo(`Limit: ${page1Response.data.pagination.limit}`);
    recordTest(true);
  } else {
    logError('Page 1 pagination failed', page1Response.data);
    recordTest(false);
  }

  // Test second page
  logTest('Pagination: Page 2, Limit 2');
  const page2Response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?page=2&limit=2`);
  if (page2Response.success) {
    logSuccess(`Page 2 returned ${page2Response.data.data.length} assets`);
    recordTest(true);
  } else {
    logError('Page 2 pagination failed', page2Response.data);
    recordTest(false);
  }

  // Test large page number
  logTest('Pagination: Invalid Page (999)');
  const invalidPageResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?page=999&limit=10`);
  if (invalidPageResponse.success) {
    logSuccess(`Invalid page returned ${invalidPageResponse.data.data.length} assets (should be 0)`);
    recordTest(true);
  } else {
    logError('Invalid page pagination failed', invalidPageResponse.data);
    recordTest(false);
  }
}

async function testUpdateOperations(createdAssets) {
  logSection('UPDATE OPERATIONS - Testing update functionality and version control');

  if (createdAssets.length === 0) {
    logWarning('No created assets to update');
    return [];
  }

  const updatedAssets = [];
  const assetToUpdate = createdAssets[0];

  // Test valid update
  logTest(`Update Asset: ${assetToUpdate.id}`);
  const updateData = {
    title: 'Updated Test Asset Title',
    content: {
      ...assetToUpdate.content,
      updatedField: 'This field was added during update',
      updateTimestamp: new Date().toISOString()
    },
    priority: assetToUpdate.priority + 5,
    is_active: !assetToUpdate.is_active,
    version: assetToUpdate.version
  };

  const updateResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${assetToUpdate.id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  });

  if (updateResponse.success && updateResponse.data.success) {
    logSuccess('Asset updated successfully');
    logInfo(`New title: ${updateResponse.data.data.title}`);
    logInfo(`New priority: ${updateResponse.data.data.priority}`);
    logInfo(`New active status: ${updateResponse.data.data.is_active}`);
    logInfo(`Version incremented: ${assetToUpdate.version} → ${updateResponse.data.data.version}`);
    updatedAssets.push(updateResponse.data.data);
    recordTest(true);
  } else {
    logError('Failed to update asset', updateResponse.data);
    recordTest(false);
  }

  // Test concurrency control (wrong version)
  logTest('Update with Wrong Version (Concurrency Control)');
  const wrongVersionData = {
    title: 'This should fail',
    version: 999 // Wrong version
  };

  const wrongVersionResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${assetToUpdate.id}`, {
    method: 'PUT',
    body: JSON.stringify(wrongVersionData)
  });

  if (!wrongVersionResponse.success && wrongVersionResponse.status === 400) {
    logSuccess('Concurrency control correctly rejected update with wrong version');
    recordTest(true);
  } else {
    logError('Concurrency control should reject updates with wrong version');
    recordTest(false);
  }

  // Test update non-existent asset
  logTest('Update Non-existent Asset');
  const nonExistentUpdateResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/99999`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'Should fail', version: 1 })
  });

  if (!nonExistentUpdateResponse.success && nonExistentUpdateResponse.status === 404) {
    logSuccess('Correctly returned 404 for updating non-existent asset');
    recordTest(true);
  } else {
    logError('Should return 404 when updating non-existent asset');
    recordTest(false);
  }

  return updatedAssets;
}

async function testAuditLogsOperations(createdAssets) {
  logSection('AUDIT LOGS - Testing asset_audit_logs table');

  if (createdAssets.length === 0) {
    logWarning('No created assets to check audit logs');
    return;
  }

  const assetToCheck = createdAssets[0];

  // Test audit logs retrieval
  logTest(`Get Audit Logs for Asset: ${assetToCheck.id}`);
  const auditResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/audit/${assetToCheck.id}`);

  if (auditResponse.success && auditResponse.data.success) {
    logSuccess(`Retrieved ${auditResponse.data.data.length} audit log entries`);
    
    const auditLogs = auditResponse.data.data;
    
    // Validate audit log structure
    if (auditLogs.length > 0) {
      const firstLog = auditLogs[0];
      const requiredFields = ['id', 'asset_id', 'action', 'changed_by', 'changes', 'createddate'];
      const missingFields = requiredFields.filter(field => !(field in firstLog));
      
      if (missingFields.length === 0) {
        logSuccess('Audit log has all required fields');
        recordTest(true);
      } else {
        logError(`Audit log missing fields: ${missingFields.join(', ')}`);
        recordTest(false);
      }

      // Validate action types
      const validActions = ['create', 'update', 'delete'];
      const invalidActions = auditLogs.filter(log => !validActions.includes(log.action));
      
      if (invalidActions.length === 0) {
        logSuccess('All audit log actions are valid');
        recordTest(true);
      } else {
        logError(`Invalid audit log actions found: ${invalidActions.map(log => log.action).join(', ')}`);
        recordTest(false);
      }

      // Validate changes field (should be JSON object)
      const changesValidation = auditLogs.every(log => 
        typeof log.changes === 'object' && log.changes !== null
      );
      
      if (changesValidation) {
        logSuccess('All audit log changes are valid JSON objects');
        recordTest(true);
      } else {
        logError('Some audit log changes are not valid JSON objects');
        recordTest(false);
      }

      // Validate changed_by field
      const changedByValidation = auditLogs.every(log => 
        typeof log.changed_by === 'string' && log.changed_by.length > 0
      );
      
      if (changedByValidation) {
        logSuccess('All audit log changed_by fields are valid');
        recordTest(true);
      } else {
        logError('Some audit log changed_by fields are invalid');
        recordTest(false);
      }

      // Log audit details
      auditLogs.forEach((log, index) => {
        logInfo(`Log ${index + 1}: ${log.action} by ${log.changed_by} at ${new Date(Number(log.createddate)).toISOString()}`);
      });
    } else {
      logWarning('No audit logs found for asset');
      recordTest(false);
    }
  } else {
    logError(`Failed to retrieve audit logs for asset ${assetToCheck.id}`, auditResponse.data);
    recordTest(false);
  }

  // Test audit logs for non-existent asset
  logTest('Get Audit Logs for Non-existent Asset');
  const nonExistentAuditResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/audit/99999`);
  
  if (nonExistentAuditResponse.success && nonExistentAuditResponse.data.data.length === 0) {
    logSuccess('Correctly returned empty array for non-existent asset audit logs');
    recordTest(true);
  } else {
    logError('Should return empty array for non-existent asset audit logs');
    recordTest(false);
  }
}

async function testDeleteOperations(createdAssets) {
  logSection('DELETE OPERATIONS - Testing delete functionality');

  if (createdAssets.length === 0) {
    logWarning('No created assets to delete');
    return;
  }

  // Test delete asset
  const assetToDelete = createdAssets[createdAssets.length - 1]; // Delete last asset
  logTest(`Delete Asset: ${assetToDelete.id}`);
  
  const deleteResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${assetToDelete.id}`, {
    method: 'DELETE'
  });

  if (deleteResponse.success && deleteResponse.data.success) {
    logSuccess(`Asset ${assetToDelete.id} deleted successfully`);
    recordTest(true);
    
    // Verify asset is actually deleted
    logTest(`Verify Asset ${assetToDelete.id} is Deleted`);
    const verifyResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${assetToDelete.id}`);
    
    if (!verifyResponse.success && verifyResponse.status === 404) {
      logSuccess('Deleted asset correctly returns 404');
      recordTest(true);
    } else {
      logError('Deleted asset should return 404');
      recordTest(false);
    }
    
    // Check if delete audit log was created
    logTest(`Verify Delete Audit Log for Asset ${assetToDelete.id}`);
    const auditAfterDeleteResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/audit/${assetToDelete.id}`);
    
    if (auditAfterDeleteResponse.success) {
      const deleteAuditLog = auditAfterDeleteResponse.data.data.find(log => log.action === 'delete');
      if (deleteAuditLog) {
        logSuccess('Delete audit log was created');
        logInfo(`Delete performed by: ${deleteAuditLog.changed_by}`);
        recordTest(true);
      } else {
        logError('Delete audit log was not created');
        recordTest(false);
      }
    } else {
      logError('Could not retrieve audit logs after delete');
      recordTest(false);
    }
    
  } else {
    logError(`Failed to delete asset ${assetToDelete.id}`, deleteResponse.data);
    recordTest(false);
  }

  // Test delete non-existent asset
  logTest('Delete Non-existent Asset');
  const nonExistentDeleteResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/99999`, {
    method: 'DELETE'
  });

  if (!nonExistentDeleteResponse.success && nonExistentDeleteResponse.status === 404) {
    logSuccess('Correctly returned 404 when trying to delete non-existent asset');
    recordTest(true);
  } else {
    logError('Should return 404 when trying to delete non-existent asset');
    recordTest(false);
  }
}

async function testEdgeCasesAndSecurity() {
  logSection('EDGE CASES & SECURITY - Testing production edge cases');

  // Test invalid ID formats
  logTest('Invalid Asset ID Format');
  const invalidIdResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/abc`);
  if (!invalidIdResponse.success) {
    logSuccess('Correctly rejected invalid asset ID format');
    recordTest(true);
  } else {
    logError('Should reject invalid asset ID format');
    recordTest(false);
  }

  // Test very large content object
  logTest('Large Content Object');
  const largeContent = {
    type: 'banner',
    placement: 'test',
    title: 'Large Content Test',
    content: {
      largeArray: new Array(1000).fill('test'),
      nestedObject: {
        level1: { level2: { level3: { data: 'deep nesting test' } } }
      },
      longString: 'A'.repeat(5000)
    }
  };

  const largeContentResponse = await makeRequest(PROMOTIONAL_ASSETS_URL, {
    method: 'POST',
    body: JSON.stringify(largeContent)
  });

  if (largeContentResponse.success) {
    logSuccess('Successfully handled large content object');
    recordTest(true);
  } else {
    logError('Failed to handle large content object', largeContentResponse.data);
    recordTest(false);
  }

  // Test SQL injection attempt
  logTest('SQL Injection Protection');
  const sqlInjectionResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?type='; DROP TABLE promotional_assets; --`);
  if (sqlInjectionResponse.success || sqlInjectionResponse.status === 400) {
    logSuccess('SQL injection attempt was handled safely');
    recordTest(true);
  } else {
    logError('SQL injection attempt was not handled properly');
    recordTest(false);
  }

  // Test malformed JSON
  logTest('Malformed JSON Handling');
  try {
    const malformedResponse = await fetch(PROMOTIONAL_ASSETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json }'
    });
    
    if (!malformedResponse.ok) {
      logSuccess('Malformed JSON was correctly rejected');
      recordTest(true);
    } else {
      logError('Malformed JSON should be rejected');
      recordTest(false);
    }
  } catch (error) {
    logSuccess('Malformed JSON caused expected error');
    recordTest(true);
  }

  // Test unsupported HTTP methods
  logTest('Unsupported HTTP Method');
  const unsupportedMethodResponse = await makeRequest(PROMOTIONAL_ASSETS_URL, {
    method: 'PATCH'
  });
  
  if (!unsupportedMethodResponse.success && (unsupportedMethodResponse.status === 404 || unsupportedMethodResponse.status === 405)) {
    logSuccess('Unsupported HTTP method correctly rejected');
    recordTest(true);
  } else {
    logError('Unsupported HTTP method should be rejected');
    recordTest(false);
  }
}

// Main test runner
async function runProductionTests() {
  console.log('🚀 STARTING COMPREHENSIVE PRODUCTION-READY TESTS');
  console.log('📊 Testing both promotional_assets and asset_audit_logs tables');
  console.log(`📡 Base URL: ${BASE_URL}`);
  console.log(`🕐 Started at: ${new Date().toISOString()}`);
  console.log('\n');

  let createdAssets = [];
  let updatedAssets = [];

  try {
    // Run all test suites
    createdAssets = await testCreateAssets();
    await testReadOperations(createdAssets);
    await testFilteringOperations();
    await testPaginationOperations();
    updatedAssets = await testUpdateOperations(createdAssets);
    await testAuditLogsOperations([...createdAssets, ...updatedAssets]);
    await testDeleteOperations(createdAssets);
    await testEdgeCasesAndSecurity();

    // Print final results
    logSection('TEST RESULTS SUMMARY');
    console.log(`📊 Total Tests: ${testStats.total}`);
    console.log(`✅ Passed: ${testStats.passed}`);
    console.log(`❌ Failed: ${testStats.failed}`);
    
    const successRate = ((testStats.passed / testStats.total) * 100).toFixed(2);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (testStats.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED - API IS PRODUCTION READY!');
    } else {
      console.log('\n⚠️  Some tests failed - please review the issues above');
    }
    
    console.log(`\n🕐 Completed at: ${new Date().toISOString()}`);
    
  } catch (error) {
    logError('Test suite failed with unexpected error', error);
    console.log('\n💥 TEST SUITE ABORTED DUE TO CRITICAL ERROR');
  }
}

// Start the tests
console.log('⏳ Checking server availability...');
setTimeout(() => {
  runProductionTests().catch(console.error);
}, 2000); 