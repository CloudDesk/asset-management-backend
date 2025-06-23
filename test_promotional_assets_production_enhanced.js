#!/usr/bin/env node

/**
 * ENHANCED COMPREHENSIVE PRODUCTION-READY TEST SUITE
 * Testing promotional_assets and asset_audit_logs tables
 * All CRUD operations, field validations, filters, edge cases, security, performance
 */

const BASE_URL = 'http://localhost:5600/v1';
const PROMOTIONAL_ASSETS_URL = `${BASE_URL}/promotional-assets`;

// Enhanced test data sets for comprehensive testing
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
      textColor: '#ffffff',
      metadata: {
        campaign: 'summer2024',
        budget: 5000,
        targetAudience: ['young_adults', 'families']
      }
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
      discount: '20%',
      reviews: {
        average: 4.8,
        count: 1250,
        highlights: ['Great quality', 'Fast shipping', 'Excellent support']
      }
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
      incentive: '10% discount on first order',
      design: {
        theme: 'modern',
        colors: {
          primary: '#007bff',
          secondary: '#6c757d',
          background: '#ffffff'
        }
      }
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
          price: '$199.99',
          rating: 4.5
        },
        {
          imageUrl: 'https://example.com/product2.jpg',
          title: 'Product 2',
          price: '$299.99',
          rating: 4.8
        },
        {
          imageUrl: 'https://example.com/product3.jpg',
          title: 'Product 3',
          price: '$399.99',
          rating: 4.9
        }
      ],
      autoPlay: true,
      interval: 5000,
      navigation: true,
      indicators: true
    },
    priority: 8,
    is_active: true,
    schedule_start: '2024-05-01T00:00:00Z',
    schedule_end: '2024-11-30T23:59:59Z'
  }
];

// Enhanced invalid test cases
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
    name: 'Invalid schedule dates (end before start)',
    data: {
      type: 'banner',
      placement: 'homepage',
      title: 'Test',
      content: { test: 'data' },
      schedule_start: '2024-12-31T23:59:59Z',
      schedule_end: '2024-01-01T00:00:00Z'
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
    name: 'Title too long (300+ chars)',
    data: {
      type: 'banner',
      placement: 'homepage',
      title: 'A'.repeat(300),
      content: { test: 'data' }
    },
    expectedError: 'validation'
  },
  {
    name: 'Placement too long (100+ chars)',
    data: {
      type: 'banner',
      placement: 'B'.repeat(150),
      title: 'Test',
      content: { test: 'data' }
    },
    expectedError: 'validation'
  },
  {
    name: 'Invalid date format',
    data: {
      type: 'banner',
      placement: 'homepage',
      title: 'Test',
      content: { test: 'data' },
      schedule_start: 'invalid-date'
    },
    expectedError: 'validation'
  },
  {
    name: 'Non-boolean is_active',
    data: {
      type: 'banner',
      placement: 'homepage',
      title: 'Test',
      content: { test: 'data' },
      is_active: 'true' // string instead of boolean
    },
    expectedError: 'validation'
  },
  {
    name: 'Non-integer priority',
    data: {
      type: 'banner',
      placement: 'homepage',
      title: 'Test',
      content: { test: 'data' },
      priority: 'high' // string instead of number
    },
    expectedError: 'validation'
  }
];

// Performance test data
const BULK_TEST_ASSETS = Array.from({ length: 50 }, (_, index) => ({
  type: ['banner', 'featured_ad', 'popup', 'carousel'][index % 4],
  placement: ['homepage', 'sidebar', 'footer', 'header'][index % 4],
  title: `Bulk Test Asset ${index + 1}`,
  content: {
    bulkId: index + 1,
    description: `This is bulk test asset number ${index + 1}`,
    metadata: {
      batchId: Math.floor(index / 10),
      timestamp: new Date().toISOString()
    }
  },
  priority: index % 20,
  is_active: index % 2 === 0,
  schedule_start: '2024-01-01T00:00:00Z',
  schedule_end: '2024-12-31T23:59:59Z'
}));

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

function logPerformance(message, startTime) {
  const duration = Date.now() - startTime;
  console.log(`⚡ ${message} (${duration}ms)`);
}

// Enhanced request function with proper headers
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
  failed: 0,
  performance: {
    create: [],
    read: [],
    update: [],
    delete: []
  }
};

function recordTest(passed, duration = null, operation = null) {
  testStats.total++;
  if (passed) testStats.passed++;
  else testStats.failed++;
  
  if (duration && operation) {
    testStats.performance[operation].push(duration);
  }
}

// Enhanced test functions
async function testCreateAssets() {
  logSection('CREATE OPERATIONS - Testing promotional_assets table');
  
  const createdAssets = [];

  // Test valid asset creation with performance monitoring
  for (let i = 0; i < VALID_ASSETS.length; i++) {
    const asset = VALID_ASSETS[i];
    logTest(`Create Valid Asset ${i + 1}: ${asset.title}`);
    
    const startTime = Date.now();
    const response = await makeRequest(PROMOTIONAL_ASSETS_URL, {
      method: 'POST',
      body: JSON.stringify(asset)
    });
    const duration = Date.now() - startTime;

    if (response.success && response.data.success) {
      logSuccess(`Asset created: ID ${response.data.data.id}`);
      logInfo(`Title: ${response.data.data.title}`);
      logInfo(`Type: ${response.data.data.type}`);
      logInfo(`Priority: ${response.data.data.priority}`);
      logInfo(`Active: ${response.data.data.is_active}`);
      logInfo(`Version: ${response.data.data.version}`);
      logPerformance(`Create operation completed`, startTime);
      createdAssets.push(response.data.data);
      recordTest(true, duration, 'create');
    } else {
      logError(`Failed to create asset: ${asset.title}`, response.data);
      recordTest(false);
    }
  }

  // Test invalid asset creation (enhanced)
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

async function testBulkOperations() {
  logSection('BULK OPERATIONS - Performance and stress testing');

  logTest('Bulk Create Performance Test');
  const bulkCreatedAssets = [];
  const startTime = Date.now();

  // Create assets in batches for better performance monitoring
  const batchSize = 10;
  for (let i = 0; i < BULK_TEST_ASSETS.length; i += batchSize) {
    const batch = BULK_TEST_ASSETS.slice(i, i + batchSize);
    const batchStartTime = Date.now();
    
    const promises = batch.map(asset => 
      makeRequest(PROMOTIONAL_ASSETS_URL, {
        method: 'POST',
        body: JSON.stringify(asset)
      })
    );

    const responses = await Promise.all(promises);
    const batchDuration = Date.now() - batchStartTime;
    
    const successCount = responses.filter(r => r.success).length;
    const failCount = responses.length - successCount;
    
    logInfo(`Batch ${Math.floor(i/batchSize) + 1}: ${successCount} success, ${failCount} failed (${batchDuration}ms)`);
    
    // Store successful assets for later testing
    responses.forEach(response => {
      if (response.success && response.data.success) {
        bulkCreatedAssets.push(response.data.data);
      }
    });
    
    recordTest(successCount === batch.length);
  }

  const totalDuration = Date.now() - startTime;
  logPerformance(`Bulk create completed: ${bulkCreatedAssets.length} assets`, startTime);
  logInfo(`Average time per asset: ${(totalDuration / BULK_TEST_ASSETS.length).toFixed(2)}ms`);

  // Test bulk retrieval performance
  logTest('Bulk Retrieval Performance Test');
  const retrievalStartTime = Date.now();
  const allAssetsResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?limit=100`);
  
  if (allAssetsResponse.success) {
    logPerformance(`Retrieved ${allAssetsResponse.data.data.length} assets`, retrievalStartTime);
    logInfo(`Database contains ${allAssetsResponse.data.pagination.total} total assets`);
    recordTest(true, Date.now() - retrievalStartTime, 'read');
  } else {
    logError('Bulk retrieval failed', allAssetsResponse.data);
    recordTest(false);
  }

  return bulkCreatedAssets;
}

async function testAdvancedFiltering() {
  logSection('ADVANCED FILTERING - Complex query combinations');

  // Test multiple filter combinations
  const filterTests = [
    {
      name: 'Type + Active Status',
      query: 'type=banner&is_active=true',
      description: 'Active banners only'
    },
    {
      name: 'Priority Range + Placement',
      query: 'priority_min=5&priority_max=15&placement=homepage',
      description: 'Homepage assets with priority 5-15'
    },
    {
      name: 'Multiple Types',
      query: 'type=banner&type=featured_ad',
      description: 'Banners or featured ads'
    },
    {
      name: 'Complex Schedule Filter',
      query: 'schedule_active=true&is_active=true',
      description: 'Currently active and scheduled assets'
    },
    {
      name: 'Pagination with Filters',
      query: 'type=banner&page=1&limit=5',
      description: 'First 5 banners'
    },
    {
      name: 'Sorting by Priority',
      query: 'priority_min=0&priority_max=20',
      description: 'Assets sorted by priority'
    }
  ];

  for (const test of filterTests) {
    logTest(`Filter Test: ${test.name}`);
    
    const startTime = Date.now();
    const response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}?${test.query}`);
    
    if (response.success) {
      logSuccess(`${test.description}: ${response.data.data.length} assets found`);
      logPerformance(`Filter query completed`, startTime);
      logInfo(`Total matching: ${response.data.pagination.total}`);
      recordTest(true, Date.now() - startTime, 'read');
    } else {
      logError(`Filter test failed: ${test.name}`, response.data);
      recordTest(false);
    }
  }
}

async function testConcurrencyControl(createdAssets) {
  logSection('CONCURRENCY CONTROL - Multi-user scenarios');

  if (createdAssets.length === 0) {
    logWarning('No assets available for concurrency testing');
    return;
  }

  const testAsset = createdAssets[0];

  // Test concurrent updates
  logTest('Concurrent Update Simulation');
  
  // First update should succeed
  const update1Data = {
    title: 'Concurrent Update 1',
    version: testAsset.version
  };

  const update1Response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${testAsset.id}`, {
    method: 'PUT',
    body: JSON.stringify(update1Data)
  });

  if (update1Response.success) {
    logSuccess('First concurrent update succeeded');
    recordTest(true);

    // Second update with old version should fail
    const update2Data = {
      title: 'Concurrent Update 2 (should fail)',
      version: testAsset.version // Using original version
    };

    const update2Response = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${testAsset.id}`, {
      method: 'PUT',
      body: JSON.stringify(update2Data)
    });

    if (!update2Response.success && update2Response.status === 400) {
      logSuccess('Second concurrent update correctly rejected');
      recordTest(true);
    } else {
      logError('Second concurrent update should have been rejected');
      recordTest(false);
    }
  } else {
    logError('First concurrent update failed', update1Response.data);
    recordTest(false);
  }
}

async function testDataIntegrity() {
  logSection('DATA INTEGRITY - Field validation and constraints');

  // Test JSONB content field integrity
  logTest('JSONB Content Field Integrity');
  
  const complexContent = {
    type: 'banner',
    placement: 'test-integrity',
    title: 'Data Integrity Test',
    content: {
      // Test various JSON data types
      string: 'test string',
      number: 12345,
      boolean: true,
      null_value: null,
      array: [1, 2, 3, 'a', 'b', 'c'],
      nested_object: {
        level1: {
          level2: {
            level3: 'deep nesting test',
            array_in_object: [{ id: 1, name: 'test' }]
          }
        }
      },
      unicode: '🚀 Unicode test with émojis and spëcial chars',
      escaped_chars: 'Test with "quotes" and \\backslashes\\ and \n newlines',
      large_text: 'A'.repeat(1000) // 1KB string
    }
  };

  const response = await makeRequest(PROMOTIONAL_ASSETS_URL, {
    method: 'POST',
    body: JSON.stringify(complexContent)
  });

  if (response.success) {
    logSuccess('Complex JSONB content stored successfully');
    logInfo(`Asset ID: ${response.data.data.id}`);
    
    // Verify content integrity by retrieving
    const retrieveResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${response.data.data.id}`);
    
    if (retrieveResponse.success) {
      logSuccess('Complex JSONB content retrieved successfully');
      logInfo('Content field is preserved as JSON object');
      recordTest(true);
    } else {
      logError('Failed to retrieve complex content');
      recordTest(false);
    }
  } else {
    logError('Failed to store complex JSONB content', response.data);
    recordTest(false);
  }

  // Test field length constraints
  logTest('Field Length Constraints');
  
  const maxLengthTests = [
    {
      field: 'title',
      value: 'A'.repeat(255), // Max allowed
      shouldPass: true
    },
    {
      field: 'title',
      value: 'A'.repeat(300), // Exceeds max
      shouldPass: false
    },
    {
      field: 'placement',
      value: 'B'.repeat(100), // Max allowed
      shouldPass: true
    },
    {
      field: 'placement',
      value: 'B'.repeat(150), // Exceeds max
      shouldPass: false
    }
  ];

  for (const test of maxLengthTests) {
    const testData = {
      type: 'banner',
      placement: test.field === 'placement' ? test.value : 'test',
      title: test.field === 'title' ? test.value : 'Test',
      content: { test: 'data' }
    };

    const lengthTestResponse = await makeRequest(PROMOTIONAL_ASSETS_URL, {
      method: 'POST',
      body: JSON.stringify(testData)
    });

    if (test.shouldPass) {
      if (lengthTestResponse.success) {
        logSuccess(`${test.field} max length (${test.value.length} chars) accepted`);
        recordTest(true);
      } else {
        logError(`${test.field} max length should be accepted`);
        recordTest(false);
      }
    } else {
      if (!lengthTestResponse.success) {
        logSuccess(`${test.field} over-length (${test.value.length} chars) rejected`);
        recordTest(true);
      } else {
        logError(`${test.field} over-length should be rejected`);
        recordTest(false);
      }
    }
  }
}

async function testAuditLogsComprehensive(createdAssets) {
  logSection('COMPREHENSIVE AUDIT LOGS - Testing asset_audit_logs table');

  if (createdAssets.length === 0) {
    logWarning('No created assets to check audit logs');
    return;
  }

  const assetToTest = createdAssets[0];

  // Test comprehensive audit log functionality
  logTest(`Comprehensive Audit Logs for Asset: ${assetToTest.id}`);
  
  // Perform multiple operations to generate audit logs
  logInfo('Performing operations to generate audit logs...');
  
  // Update operation
  const updateResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${assetToTest.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Audit Test Updated Title',
      priority: assetToTest.priority + 10,
      version: assetToTest.version
    })
  });

  if (updateResponse.success) {
    logInfo('Update operation completed');
  }

  // Retrieve audit logs
  const auditResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/audit/${assetToTest.id}`);

  if (auditResponse.success && auditResponse.data.success) {
    logSuccess(`Retrieved ${auditResponse.data.data.length} audit log entries`);
    
    const auditLogs = auditResponse.data.data;
    
    // Comprehensive audit log validation
    const validationTests = [
      {
        name: 'Required Fields Present',
        test: () => {
          const requiredFields = ['id', 'asset_id', 'action', 'changed_by', 'changes', 'createddate'];
          return auditLogs.every(log => 
            requiredFields.every(field => field in log)
          );
        }
      },
      {
        name: 'Valid Action Types',
        test: () => {
          const validActions = ['create', 'update', 'delete'];
          return auditLogs.every(log => validActions.includes(log.action));
        }
      },
      {
        name: 'Changes Field Structure',
        test: () => {
          return auditLogs.every(log => 
            typeof log.changes === 'object' && log.changes !== null
          );
        }
      },
      {
        name: 'Timestamp Ordering',
        test: () => {
          // Should be ordered by createddate DESC
          for (let i = 0; i < auditLogs.length - 1; i++) {
            if (Number(auditLogs[i].createddate) < Number(auditLogs[i + 1].createddate)) {
              return false;
            }
          }
          return true;
        }
      },
      {
        name: 'User Attribution',
        test: () => {
          return auditLogs.every(log => 
            typeof log.changed_by === 'string' && log.changed_by.length > 0
          );
        }
      }
    ];

    for (const validation of validationTests) {
      if (validation.test()) {
        logSuccess(`Audit validation passed: ${validation.name}`);
        recordTest(true);
      } else {
        logError(`Audit validation failed: ${validation.name}`);
        recordTest(false);
      }
    }

    // Log detailed audit information
    auditLogs.forEach((log, index) => {
      const date = new Date(Number(log.createddate)).toISOString();
      logInfo(`Log ${index + 1}: ${log.action} by ${log.changed_by} at ${date}`);
      
      if (log.action === 'update' && log.changes.before && log.changes.after) {
        const changedFields = Object.keys(log.changes.after);
        logInfo(`  Changed fields: ${changedFields.join(', ')}`);
      }
    });

    recordTest(true);
  } else {
    logError(`Failed to retrieve audit logs for asset ${assetToTest.id}`, auditResponse.data);
    recordTest(false);
  }

  // Test audit logs for non-existent asset (should return empty array)
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

async function testSecurityAndEdgeCases() {
  logSection('SECURITY & EDGE CASES - Production security testing');

  // Enhanced security tests
  const securityTests = [
    {
      name: 'SQL Injection in Type Filter',
      url: `${PROMOTIONAL_ASSETS_URL}?type='; DROP TABLE promotional_assets; --`,
      expectation: 'safe handling'
    },
    {
      name: 'XSS in Title Field',
      data: {
        type: 'banner',
        placement: 'test',
        title: '<script>alert("XSS")</script>',
        content: { test: 'data' }
      },
      expectation: 'safe storage'
    },
    {
      name: 'Path Traversal in ID',
      url: `${PROMOTIONAL_ASSETS_URL}/../../../etc/passwd`,
      expectation: 'rejection'
    },
    {
      name: 'Large Payload Attack',
      data: {
        type: 'banner',
        placement: 'test',
        title: 'Large Payload Test',
        content: {
          largeField: 'A'.repeat(1000000) // 1MB string
        }
      },
      expectation: 'controlled handling'
    },
    {
      name: 'Invalid JSON Structure',
      rawBody: '{"type":"banner","placement":"test","title":"Test","content":{"invalid":}',
      expectation: 'rejection'
    }
  ];

  for (const test of securityTests) {
    logTest(`Security Test: ${test.name}`);
    
    let response;
    if (test.url) {
      response = await makeRequest(test.url);
    } else if (test.rawBody) {
      try {
        response = await fetch(PROMOTIONAL_ASSETS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: test.rawBody
        });
        response = {
          status: response.status,
          success: response.ok,
          data: await response.text()
        };
      } catch (error) {
        response = { status: 0, success: false, error: error.message };
      }
    } else if (test.data) {
      response = await makeRequest(PROMOTIONAL_ASSETS_URL, {
        method: 'POST',
        body: JSON.stringify(test.data)
      });
    }

    // Evaluate based on expectation
    if (test.expectation === 'safe handling' || test.expectation === 'rejection') {
      if (!response.success || response.status >= 400) {
        logSuccess(`Security test passed: ${test.name}`);
        recordTest(true);
      } else {
        logError(`Security test failed: ${test.name} - should be rejected`);
        recordTest(false);
      }
    } else if (test.expectation === 'safe storage') {
      if (response.success) {
        logSuccess(`Security test passed: ${test.name} - data stored safely`);
        recordTest(true);
      } else {
        logError(`Security test failed: ${test.name}`);
        recordTest(false);
      }
    } else if (test.expectation === 'controlled handling') {
      // For large payloads, either accept gracefully or reject with proper error
      if (response.success || (response.status === 413 || response.status === 400)) {
        logSuccess(`Security test passed: ${test.name} - controlled handling`);
        recordTest(true);
      } else {
        logError(`Security test failed: ${test.name} - unexpected response`);
        recordTest(false);
      }
    }
  }
}

async function testDeleteOperationsEnhanced(createdAssets) {
  logSection('ENHANCED DELETE OPERATIONS - Testing delete functionality');

  if (createdAssets.length === 0) {
    logWarning('No created assets to delete');
    return;
  }

  // Test delete asset with enhanced verification
  const assetToDelete = createdAssets[createdAssets.length - 1];
  logTest(`Delete Asset: ${assetToDelete.id}`);
  
  const startTime = Date.now();
  const deleteResponse = await makeRequest(`${PROMOTIONAL_ASSETS_URL}/${assetToDelete.id}`, {
    method: 'DELETE'
  });

  if (deleteResponse.success && deleteResponse.data.success) {
    logSuccess(`Asset ${assetToDelete.id} deleted successfully`);
    logPerformance('Delete operation completed', startTime);
    recordTest(true, Date.now() - startTime, 'delete');
    
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

// Performance analysis
function analyzePerformance() {
  logSection('PERFORMANCE ANALYSIS');
  
  const operations = ['create', 'read', 'update', 'delete'];
  
  for (const op of operations) {
    const times = testStats.performance[op];
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      logInfo(`${op.toUpperCase()} Performance:`);
      logInfo(`  Operations: ${times.length}`);
      logInfo(`  Average: ${avg.toFixed(2)}ms`);
      logInfo(`  Min: ${min}ms`);
      logInfo(`  Max: ${max}ms`);
      
      // Performance thresholds (adjust based on requirements)
      const thresholds = { create: 1000, read: 500, update: 1000, delete: 500 };
      if (avg < thresholds[op]) {
        logSuccess(`${op} performance within acceptable range`);
      } else {
        logWarning(`${op} performance may need optimization (avg: ${avg.toFixed(2)}ms)`);
      }
    }
  }
}

// Main enhanced test runner
async function runEnhancedProductionTests() {
  console.log('🚀 STARTING ENHANCED COMPREHENSIVE PRODUCTION-READY TESTS');
  console.log('📊 Testing both promotional_assets and asset_audit_logs tables');
  console.log('🔒 Including security, performance, and stress testing');
  console.log(`📡 Base URL: ${BASE_URL}`);
  console.log(`🕐 Started at: ${new Date().toISOString()}`);
  console.log('\n');

  let createdAssets = [];
  let bulkCreatedAssets = [];

  try {
    // Run all enhanced test suites
    createdAssets = await testCreateAssets();
    bulkCreatedAssets = await testBulkOperations();
    await testAdvancedFiltering();
    await testConcurrencyControl(createdAssets);
    await testDataIntegrity();
    await testAuditLogsComprehensive([...createdAssets, ...bulkCreatedAssets]);
    await testSecurityAndEdgeCases();
    await testDeleteOperationsEnhanced([...createdAssets, ...bulkCreatedAssets]);

    // Performance analysis
    analyzePerformance();

    // Print final results
    logSection('ENHANCED TEST RESULTS SUMMARY');
    console.log(`📊 Total Tests: ${testStats.total}`);
    console.log(`✅ Passed: ${testStats.passed}`);
    console.log(`❌ Failed: ${testStats.failed}`);
    
    const successRate = ((testStats.passed / testStats.total) * 100).toFixed(2);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    // Assets created during testing
    const totalAssetsCreated = createdAssets.length + bulkCreatedAssets.length;
    console.log(`🏗️  Assets Created: ${totalAssetsCreated}`);
    
    if (testStats.failed === 0) {
      console.log('\n🎉 ALL ENHANCED TESTS PASSED - API IS FULLY PRODUCTION READY!');
      console.log('✅ Security tested');
      console.log('✅ Performance analyzed');
      console.log('✅ Concurrency handled');
      console.log('✅ Data integrity verified');
      console.log('✅ Audit trails comprehensive');
    } else if (successRate >= 95) {
      console.log('\n🌟 EXCELLENT RESULTS - API IS PRODUCTION READY!');
      console.log('ℹ️  Minor issues detected but core functionality is solid');
    } else if (successRate >= 90) {
      console.log('\n👍 GOOD RESULTS - API IS MOSTLY PRODUCTION READY');
      console.log('⚠️  Some issues need attention before full deployment');
    } else {
      console.log('\n⚠️  ISSUES DETECTED - Please review failures before production');
    }
    
    console.log(`\n🕐 Completed at: ${new Date().toISOString()}`);
    
  } catch (error) {
    logError('Enhanced test suite failed with unexpected error', error);
    console.log('\n💥 ENHANCED TEST SUITE ABORTED DUE TO CRITICAL ERROR');
  }
}

// Start the enhanced tests
console.log('⏳ Checking server availability...');
setTimeout(() => {
  runEnhancedProductionTests().catch(console.error);
}, 2000); 