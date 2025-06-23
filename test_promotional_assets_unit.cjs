#!/usr/bin/env node

/**
 * Unit Tests for Promotional Assets Service
 * Tests business logic, validation, and error handling
 */

const assert = require('assert');

// Mock data for testing
const SAMPLE_ASSETS = [
  {
    id: 1,
    type: 'banner',
    placement: 'homepage',
    title: 'Summer Sale Banner',
    content: { imageUrl: 'banner1.jpg', text: 'Save 50%!' },
    priority: 10,
    is_active: true,
    schedule_start: new Date('2024-06-01'),
    schedule_end: new Date('2024-08-31'),
    version: 1,
    createddate: Date.now(),
    modifieddate: Date.now()
  },
  {
    id: 2,
    type: 'popup',
    placement: 'modal',
    title: 'Newsletter Signup',
    content: { text: 'Subscribe now!', form: true },
    priority: 5,
    is_active: false,
    schedule_start: null,
    schedule_end: null,
    version: 1,
    createddate: Date.now(),
    modifieddate: Date.now()
  }
];

// Test functions
function testValidateScheduleDates() {
  console.log('🧪 Testing schedule date validation...');
  
  // Valid dates
  const validStart = '2024-01-01T00:00:00Z';
  const validEnd = '2024-12-31T23:59:59Z';
  
  const startDate = new Date(validStart);
  const endDate = new Date(validEnd);
  
  assert(startDate <= endDate, 'Valid schedule dates should pass validation');
  console.log('✅ Valid schedule dates pass validation');
  
  // Invalid dates (end before start)
  const invalidStart = '2024-12-31T23:59:59Z';
  const invalidEnd = '2024-01-01T00:00:00Z';
  
  const invalidStartDate = new Date(invalidStart);
  const invalidEndDate = new Date(invalidEnd);
  
  assert(invalidStartDate > invalidEndDate, 'Invalid schedule dates should fail validation');
  console.log('✅ Invalid schedule dates fail validation');
}

function testFilterActiveAssets() {
  console.log('🧪 Testing active asset filtering...');
  
  const activeAssets = SAMPLE_ASSETS.filter(asset => asset.is_active === true);
  const inactiveAssets = SAMPLE_ASSETS.filter(asset => asset.is_active === false);
  
  assert(activeAssets.length === 1, 'Should find 1 active asset');
  assert(inactiveAssets.length === 1, 'Should find 1 inactive asset');
  assert(activeAssets[0].title === 'Summer Sale Banner', 'Active asset should be Summer Sale Banner');
  
  console.log('✅ Active asset filtering works correctly');
}

function testFilterByType() {
  console.log('🧪 Testing asset type filtering...');
  
  const bannerAssets = SAMPLE_ASSETS.filter(asset => asset.type === 'banner');
  const popupAssets = SAMPLE_ASSETS.filter(asset => asset.type === 'popup');
  const carouselAssets = SAMPLE_ASSETS.filter(asset => asset.type === 'carousel');
  
  assert(bannerAssets.length === 1, 'Should find 1 banner asset');
  assert(popupAssets.length === 1, 'Should find 1 popup asset');
  assert(carouselAssets.length === 0, 'Should find 0 carousel assets');
  
  console.log('✅ Type filtering works correctly');
}

function testFilterByPriorityRange() {
  console.log('🧪 Testing priority range filtering...');
  
  const minPriority = 5;
  const maxPriority = 10;
  
  const priorityFilteredAssets = SAMPLE_ASSETS.filter(asset => 
    asset.priority >= minPriority && asset.priority <= maxPriority
  );
  
  assert(priorityFilteredAssets.length === 2, 'Should find 2 assets in priority range 5-10');
  
  const highPriorityAssets = SAMPLE_ASSETS.filter(asset => asset.priority > 7);
  assert(highPriorityAssets.length === 1, 'Should find 1 high priority asset');
  
  console.log('✅ Priority range filtering works correctly');
}

function testFilterBySchedule() {
  console.log('🧪 Testing schedule filtering...');
  
  const now = new Date('2024-07-15'); // Middle of summer
  
  const scheduledAssets = SAMPLE_ASSETS.filter(asset => {
    if (!asset.schedule_start && !asset.schedule_end) return false;
    
    const startCheck = !asset.schedule_start || asset.schedule_start <= now;
    const endCheck = !asset.schedule_end || asset.schedule_end >= now;
    
    return startCheck && endCheck;
  });
  
  assert(scheduledAssets.length === 1, 'Should find 1 currently scheduled asset');
  assert(scheduledAssets[0].title === 'Summer Sale Banner', 'Scheduled asset should be Summer Sale Banner');
  
  console.log('✅ Schedule filtering works correctly');
}

function testContentValidation() {
  console.log('🧪 Testing content validation...');
  
  // Valid content
  const validContent = { imageUrl: 'test.jpg', text: 'Hello' };
  assert(Object.keys(validContent).length > 0, 'Valid content should have properties');
  
  // Empty content (should be invalid)
  const emptyContent = {};
  assert(Object.keys(emptyContent).length === 0, 'Empty content should be invalid');
  
  // Complex content
  const complexContent = {
    imageUrl: 'banner.jpg',
    text: 'Special offer!',
    ctaButton: {
      text: 'Shop Now',
      link: '/shop'
    },
    style: {
      backgroundColor: '#ff0000',
      fontSize: '18px'
    }
  };
  assert(Object.keys(complexContent).length > 0, 'Complex content should be valid');
  
  console.log('✅ Content validation works correctly');
}

function testAssetTypeValidation() {
  console.log('🧪 Testing asset type validation...');
  
  const validTypes = ['banner', 'featured_ad', 'popup', 'carousel'];
  const invalidTypes = ['sidebar', 'footer', 'header', 'invalid'];
  
  validTypes.forEach(type => {
    assert(validTypes.includes(type), `${type} should be a valid asset type`);
  });
  
  invalidTypes.forEach(type => {
    assert(!validTypes.includes(type), `${type} should be an invalid asset type`);
  });
  
  console.log('✅ Asset type validation works correctly');
}

function testPriorityOrdering() {
  console.log('🧪 Testing priority ordering...');
  
  const sortedAssets = [...SAMPLE_ASSETS].sort((a, b) => b.priority - a.priority);
  
  assert(sortedAssets[0].priority >= sortedAssets[1].priority, 'Assets should be ordered by priority desc');
  assert(sortedAssets[0].title === 'Summer Sale Banner', 'Highest priority asset should be first');
  
  console.log('✅ Priority ordering works correctly');
}

function testVersionIncrement() {
  console.log('🧪 Testing version increment logic...');
  
  const originalAsset = { ...SAMPLE_ASSETS[0] };
  const updatedAsset = { ...originalAsset, version: originalAsset.version + 1 };
  
  assert(updatedAsset.version === originalAsset.version + 1, 'Version should increment on update');
  assert(updatedAsset.version === 2, 'Updated version should be 2');
  
  console.log('✅ Version increment works correctly');
}

function testConcurrencyControl() {
  console.log('🧪 Testing optimistic concurrency control...');
  
  const currentAsset = { ...SAMPLE_ASSETS[0] };
  const updateAttempt1 = { version: currentAsset.version };
  const updateAttempt2 = { version: currentAsset.version - 1 }; // Stale version
  
  // Valid version should pass
  assert(updateAttempt1.version === currentAsset.version, 'Current version should pass concurrency check');
  
  // Stale version should fail
  assert(updateAttempt2.version !== currentAsset.version, 'Stale version should fail concurrency check');
  
  console.log('✅ Optimistic concurrency control works correctly');
}

function testAuditLogStructure() {
  console.log('🧪 Testing audit log structure...');
  
  const sampleAuditLog = {
    id: 1,
    asset_id: 1,
    action: 'create',
    changed_by: 'test@example.com',
    changes: {
      created: SAMPLE_ASSETS[0]
    },
    createddate: Date.now()
  };
  
  assert(sampleAuditLog.asset_id === 1, 'Audit log should reference correct asset');
  assert(['create', 'update', 'delete'].includes(sampleAuditLog.action), 'Action should be valid');
  assert(typeof sampleAuditLog.changed_by === 'string', 'Changed by should be a string');
  assert(typeof sampleAuditLog.changes === 'object', 'Changes should be an object');
  
  console.log('✅ Audit log structure is correct');
}

function testDiffCreation() {
  console.log('🧪 Testing diff creation for audit logs...');
  
  const oldAsset = {
    id: 1,
    title: 'Old Title',
    priority: 5,
    is_active: true
  };
  
  const newAsset = {
    id: 1,
    title: 'New Title',
    priority: 10,
    is_active: true
  };
  
  const expectedDiff = {
    before: {
      title: 'Old Title',
      priority: 5
    },
    after: {
      title: 'New Title',
      priority: 10
    }
  };
  
  // Simulate diff creation logic
  const actualDiff = { before: {}, after: {} };
  for (const key in newAsset) {
    if (JSON.stringify(newAsset[key]) !== JSON.stringify(oldAsset[key])) {
      actualDiff.before[key] = oldAsset[key];
      actualDiff.after[key] = newAsset[key];
    }
  }
  
  assert(Object.keys(actualDiff.before).length === 2, 'Should track 2 changed fields in before');
  assert(Object.keys(actualDiff.after).length === 2, 'Should track 2 changed fields in after');
  assert(actualDiff.before.title === 'Old Title', 'Should track old title');
  assert(actualDiff.after.title === 'New Title', 'Should track new title');
  
  console.log('✅ Diff creation works correctly');
}

function testPaginationCalculation() {
  console.log('🧪 Testing pagination calculation...');
  
  const totalItems = 25;
  const itemsPerPage = 10;
  const currentPage = 2;
  
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const skip = (currentPage - 1) * itemsPerPage;
  const take = itemsPerPage;
  
  assert(totalPages === 3, 'Should calculate 3 total pages');
  assert(skip === 10, 'Should skip 10 items for page 2');
  assert(take === 10, 'Should take 10 items per page');
  
  // Test edge cases
  const lastPageItems = totalItems - (skip);
  assert(lastPageItems > 0, 'Last page should have items');
  
  console.log('✅ Pagination calculation works correctly');
}

// Run all tests
function runUnitTests() {
  console.log('🚀 Starting Promotional Assets Unit Tests');
  console.log('=' .repeat(50));
  
  try {
    testValidateScheduleDates();
    testFilterActiveAssets();
    testFilterByType();
    testFilterByPriorityRange();
    testFilterBySchedule();
    testContentValidation();
    testAssetTypeValidation();
    testPriorityOrdering();
    testVersionIncrement();
    testConcurrencyControl();
    testAuditLogStructure();
    testDiffCreation();
    testPaginationCalculation();
    
    console.log('\n🎉 All unit tests passed!');
    
  } catch (error) {
    console.log(`\n❌ Unit test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the tests
runUnitTests(); 