#!/usr/bin/env node

/**
 * Test script for Quote Attachment with PR Status Update functionality
 * This script tests various scenarios including positive and negative cases
 */

const baseUrl = 'http://localhost:5600/v1';

// Test data
const testPrNumber = 'LAKSH-PR-00022';
const testQuoteUrl = 'https://example.com/quotes/sample-quote-document.pdf';

/**
 * Helper function to make HTTP requests
 */
async function makeRequest(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      status: response.status,
      success: response.ok,
      data
    };
  } catch (error) {
    console.error('Request failed:', error);
    return {
      status: 0,
      success: false,
      data: { error: error.message }
    };
  }
}

/**
 * Test Case 1: Create a new quote with non-closed_won status
 */
async function testCreateQuoteNonClosedWon() {
  console.log('\n🔸 Test Case 1: Create new quote with draft status');
  
  const payload = {
    prnumber: testPrNumber,
    quoteurl: testQuoteUrl,
    quotenumber: 'Q-TEST-001',
    status: 'draft',
    createddate: Date.now(),
    modifieddate: Date.now()
  };

  const result = await makeRequest(`${baseUrl}/quotes/attach-with-pr-update`, 'POST', payload);
  
  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.success) {
    console.log('✅ Test passed: Quote created successfully');
    console.log('📋 PR Update Message:', result.data.data.message.purchaseRequest);
    return result.data.data.quote.id;
  } else {
    console.log('❌ Test failed');
    return null;
  }
}

/**
 * Test Case 2: Update quote to closed_won status (should trigger PR update)
 */
async function testUpdateQuoteToClosedWon(quoteId) {
  console.log('\n🔸 Test Case 2: Update quote to closed_won status');
  
  const payload = {
    id: quoteId,
    prnumber: testPrNumber,
    quoteurl: testQuoteUrl,
    quotenumber: 'Q-TEST-001',
    status: 'closed_won',
    modifieddate: Date.now()
  };

  const result = await makeRequest(`${baseUrl}/quotes/attach-with-pr-update`, 'POST', payload);
  
  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.success) {
    console.log('✅ Test passed: Quote updated to closed_won successfully');
    console.log('📋 PR Update Message:', result.data.data.message.purchaseRequest);
  } else {
    console.log('❌ Test failed');
  }
}

/**
 * Test Case 3: Create quote with closed_won status directly
 */
async function testCreateQuoteClosedWonDirect() {
  console.log('\n🔸 Test Case 3: Create new quote with closed_won status directly');
  
  const payload = {
    prnumber: testPrNumber,
    quoteurl: testQuoteUrl,
    quotenumber: 'Q-TEST-002',
    status: 'closed_won',
    createddate: Date.now(),
    modifieddate: Date.now()
  };

  const result = await makeRequest(`${baseUrl}/quotes/attach-with-pr-update`, 'POST', payload);
  
  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.success) {
    console.log('✅ Test passed: Quote created with closed_won status successfully');
    console.log('📋 PR Update Message:', result.data.data.message.purchaseRequest);
    return result.data.data.quote.id;
  } else {
    console.log('❌ Test failed');
    return null;
  }
}

/**
 * Test Case 4: Negative test - missing prnumber
 */
async function testMissingPrNumber() {
  console.log('\n🔸 Test Case 4: Negative test - missing prnumber');
  
  const payload = {
    quoteurl: testQuoteUrl,
    quotenumber: 'Q-TEST-003',
    status: 'draft'
  };

  const result = await makeRequest(`${baseUrl}/quotes/attach-with-pr-update`, 'POST', payload);
  
  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (!result.success && result.status === 400) {
    console.log('✅ Test passed: Correctly rejected request with missing prnumber');
  } else {
    console.log('❌ Test failed: Should have rejected request with missing prnumber');
  }
}

/**
 * Test Case 5: Negative test - invalid prnumber (non-existent PR)
 */
async function testInvalidPrNumber() {
  console.log('\n🔸 Test Case 5: Negative test - invalid prnumber (non-existent PR)');
  
  const payload = {
    prnumber: 'INVALID-PR-99999',
    quoteurl: testQuoteUrl,
    quotenumber: 'Q-TEST-004',
    status: 'closed_won',
    createddate: Date.now(),
    modifieddate: Date.now()
  };

  const result = await makeRequest(`${baseUrl}/quotes/attach-with-pr-update`, 'POST', payload);
  
  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.success) {
    console.log('✅ Test passed: Quote created but PR not found (expected behavior)');
    console.log('📋 PR Update Message:', result.data.data.message.purchaseRequest);
  } else {
    console.log('❌ Test failed');
  }
}

/**
 * Test Case 6: Verify quotes by PR number
 */
async function testGetQuotesByPrNumber() {
  console.log('\n🔸 Test Case 6: Get quotes by PR number');
  
  const result = await makeRequest(`${baseUrl}/quotes/prnumber/${testPrNumber}`);
  
  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.success) {
    console.log('✅ Test passed: Successfully retrieved quotes by PR number');
    console.log(`📊 Found ${result.data.data.length} quotes for PR ${testPrNumber}`);
  } else {
    console.log('❌ Test failed');
  }
}

/**
 * Test Case 7: Get quotes statistics
 */
async function testGetQuotesStats() {
  console.log('\n🔸 Test Case 7: Get quotes statistics');
  
  const result = await makeRequest(`${baseUrl}/quotes/stats`);
  
  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.success) {
    console.log('✅ Test passed: Successfully retrieved quotes statistics');
  } else {
    console.log('❌ Test failed');
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting Quote Attachment with PR Status Update Tests');
  console.log('=' .repeat(60));
  
  try {
    // Test creating a quote with draft status
    const quoteId1 = await testCreateQuoteNonClosedWon();
    
    // If successful, update it to closed_won
    if (quoteId1) {
      await testUpdateQuoteToClosedWon(quoteId1);
    }
    
    // Test creating a quote directly with closed_won status
    await testCreateQuoteClosedWonDirect();
    
    // Negative tests
    await testMissingPrNumber();
    await testInvalidPrNumber();
    
    // Verification tests
    await testGetQuotesByPrNumber();
    await testGetQuotesStats();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Test execution completed');
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ or a fetch polyfill');
  process.exit(1);
}

// Run tests
runTests().catch(console.error); 