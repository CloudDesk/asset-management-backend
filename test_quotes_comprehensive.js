import fetch from 'node-fetch';

const baseUrl = 'http://localhost:5600/v1';

async function makeRequest(url, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      status: response.status,
      success: response.ok,
      data
    };
  } catch (error) {
    return {
      status: 0,
      success: false,
      error: error.message
    };
  }
}

async function testQuotesComprehensive() {
  console.log('🚀 COMPREHENSIVE QUOTES API TESTING');
  console.log('=====================================\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  function logTest(testName, passed, details = '') {
    totalTests++;
    if (passed) {
      passedTests++;
      console.log(`✅ ${testName}`);
    } else {
      console.log(`❌ ${testName}`);
    }
    if (details) {
      console.log(`   ${details}`);
    }
    console.log('');
  }

  // Test 1: Get all quotes (no filter)
  console.log('📊 Test 1: Get all quotes (no filter)');
  const allQuotes = await makeRequest(`${baseUrl}/quotes/`);
  const allQuotesCount = allQuotes.data?.pagination?.total || 0;
  logTest(
    'Get all quotes', 
    allQuotes.success && allQuotesCount > 0,
    `Status: ${allQuotes.status}, Total quotes: ${allQuotesCount}`
  );

  // Test 2: Filter by specific prnumber (query param)
  console.log('🎯 Test 2: Filter by specific prnumber (query param)');
  const prnumberFilter = await makeRequest(`${baseUrl}/quotes/?prnumber=REVO-PR-00005`);
  const prnumberCount = prnumberFilter.data?.pagination?.total || 0;
  const correctPrnumberFilter = prnumberCount === 1 && 
    prnumberFilter.data?.data?.[0]?.prnumber === 'REVO-PR-00005';
  logTest(
    'Filter by prnumber (query param)', 
    prnumberFilter.success && correctPrnumberFilter,
    `Status: ${prnumberFilter.status}, Filtered count: ${prnumberCount}, Correct filter: ${correctPrnumberFilter}`
  );

  // Test 3: Filter by specific prnumber (dedicated route)
  console.log('🔗 Test 3: Filter by specific prnumber (dedicated route)');
  const dedicatedPrnumber = await makeRequest(`${baseUrl}/quotes/prnumber/REVO-PR-00005`);
  const dedicatedCount = dedicatedPrnumber.data?.pagination?.total || 0;
  const correctDedicatedFilter = dedicatedCount === 1 && 
    dedicatedPrnumber.data?.data?.[0]?.prnumber === 'REVO-PR-00005';
  logTest(
    'Filter by prnumber (dedicated route)', 
    dedicatedPrnumber.success && correctDedicatedFilter,
    `Status: ${dedicatedPrnumber.status}, Filtered count: ${dedicatedCount}, Correct filter: ${correctDedicatedFilter}`
  );

  // Test 4: Filter by quotenumber
  console.log('📝 Test 4: Filter by quotenumber');
  const quotenumberFilter = await makeRequest(`${baseUrl}/quotes/?quotenumber=TEST4-QUOTE-00017`);
  const quotenumberCount = quotenumberFilter.data?.pagination?.total || 0;
  const correctQuotenumberFilter = quotenumberCount === 1 && 
    quotenumberFilter.data?.data?.[0]?.quotenumber === 'TEST4-QUOTE-00017';
  logTest(
    'Filter by quotenumber', 
    quotenumberFilter.success && correctQuotenumberFilter,
    `Status: ${quotenumberFilter.status}, Filtered count: ${quotenumberCount}, Correct filter: ${correctQuotenumberFilter}`
  );

  // Test 5: Filter by status
  console.log('📊 Test 5: Filter by status');
  const statusFilter = await makeRequest(`${baseUrl}/quotes/?status=closed_won`);
  const statusCount = statusFilter.data?.pagination?.total || 0;
  const allHaveCorrectStatus = statusFilter.data?.data?.every(quote => quote.status === 'closed_won') || false;
  logTest(
    'Filter by status', 
    statusFilter.success && statusCount > 0 && allHaveCorrectStatus,
    `Status: ${statusFilter.status}, Filtered count: ${statusCount}, All have correct status: ${allHaveCorrectStatus}`
  );

  // Test 6: Filter by status (dedicated route)
  console.log('🔗 Test 6: Filter by status (dedicated route)');
  const dedicatedStatus = await makeRequest(`${baseUrl}/quotes/status/closed_won`);
  const dedicatedStatusCount = dedicatedStatus.data?.pagination?.total || 0;
  const allHaveCorrectStatusDedicated = dedicatedStatus.data?.data?.every(quote => quote.status === 'closed_won') || false;
  logTest(
    'Filter by status (dedicated route)', 
    dedicatedStatus.success && dedicatedStatusCount > 0 && allHaveCorrectStatusDedicated,
    `Status: ${dedicatedStatus.status}, Filtered count: ${dedicatedStatusCount}, All have correct status: ${allHaveCorrectStatusDedicated}`
  );

  // Test 7: Filter by non-existent prnumber
  console.log('❌ Test 7: Filter by non-existent prnumber');
  const nonExistentPr = await makeRequest(`${baseUrl}/quotes/?prnumber=NON-EXISTENT-PR-99999`);
  const nonExistentPrCount = nonExistentPr.data?.pagination?.total || 0;
  logTest(
    'Filter by non-existent prnumber', 
    nonExistentPr.success && nonExistentPrCount === 0,
    `Status: ${nonExistentPr.status}, Count: ${nonExistentPrCount} (should be 0)`
  );

  // Test 8: Filter by non-existent status
  console.log('❌ Test 8: Filter by non-existent status');
  const nonExistentStatus = await makeRequest(`${baseUrl}/quotes/?status=non_existent_status`);
  const nonExistentStatusCount = nonExistentStatus.data?.pagination?.total || 0;
  logTest(
    'Filter by non-existent status', 
    nonExistentStatus.success && nonExistentStatusCount === 0,
    `Status: ${nonExistentStatus.status}, Count: ${nonExistentStatusCount} (should be 0)`
  );

  // Test 9: Multiple filters (prnumber + status)
  console.log('🔄 Test 9: Multiple filters (prnumber + status)');
  const multipleFilters = await makeRequest(`${baseUrl}/quotes/?prnumber=REVO-PR-00005&status=closed_won`);
  const multipleFiltersCount = multipleFilters.data?.pagination?.total || 0;
  const correctMultipleFilters = multipleFiltersCount === 1 && 
    multipleFilters.data?.data?.[0]?.prnumber === 'REVO-PR-00005' &&
    multipleFilters.data?.data?.[0]?.status === 'closed_won';
  logTest(
    'Multiple filters (prnumber + status)', 
    multipleFilters.success && correctMultipleFilters,
    `Status: ${multipleFilters.status}, Count: ${multipleFiltersCount}, Correct filters: ${correctMultipleFilters}`
  );

  // Test 10: Pagination
  console.log('📄 Test 10: Pagination');
  const paginatedQuotes = await makeRequest(`${baseUrl}/quotes/?page=1&limit=2`);
  const paginatedCount = paginatedQuotes.data?.data?.length || 0;
  const hasCorrectPagination = paginatedQuotes.data?.pagination?.page === 1 && 
    paginatedQuotes.data?.pagination?.limit === 2 && 
    paginatedCount <= 2;
  logTest(
    'Pagination', 
    paginatedQuotes.success && hasCorrectPagination,
    `Status: ${paginatedQuotes.status}, Returned: ${paginatedCount}, Page: ${paginatedQuotes.data?.pagination?.page}, Limit: ${paginatedQuotes.data?.pagination?.limit}`
  );

  // Test 11: Get quote by ID
  console.log('🔍 Test 11: Get quote by ID');
  const quoteById = await makeRequest(`${baseUrl}/quotes/17`);
  const correctQuoteById = quoteById.data?.data?.id === 17;
  logTest(
    'Get quote by ID', 
    quoteById.success && correctQuoteById,
    `Status: ${quoteById.status}, Quote ID: ${quoteById.data?.data?.id}`
  );

  // Test 12: Get non-existent quote by ID
  console.log('❌ Test 12: Get non-existent quote by ID');
  const nonExistentQuote = await makeRequest(`${baseUrl}/quotes/99999`);
  logTest(
    'Get non-existent quote by ID', 
    !nonExistentQuote.success && (nonExistentQuote.status === 404 || nonExistentQuote.status === 400),
    `Status: ${nonExistentQuote.status} (should be 404 or 400)`
  );

  // Test 13: Case insensitive filtering
  console.log('🔤 Test 13: Case insensitive filtering');
  const caseInsensitive = await makeRequest(`${baseUrl}/quotes/?status=CLOSED_WON`);
  const caseInsensitiveCount = caseInsensitive.data?.pagination?.total || 0;
  logTest(
    'Case insensitive filtering', 
    caseInsensitive.success && caseInsensitiveCount > 0,
    `Status: ${caseInsensitive.status}, Count: ${caseInsensitiveCount} (should match closed_won)`
  );

  // Test 14: Wildcard search (if supported)
  console.log('🔍 Test 14: Wildcard search');
  const wildcardSearch = await makeRequest(`${baseUrl}/quotes/?prnumber=REVO*`);
  const wildcardCount = wildcardSearch.data?.pagination?.total || 0;
  const allMatchWildcard = wildcardSearch.data?.data?.every(quote => 
    quote.prnumber.startsWith('REVO')) || false;
  logTest(
    'Wildcard search', 
    wildcardSearch.success && wildcardCount > 0 && allMatchWildcard,
    `Status: ${wildcardSearch.status}, Count: ${wildcardCount}, All match wildcard: ${allMatchWildcard}`
  );

  // Test 15: Get quotes stats
  console.log('📈 Test 15: Get quotes stats');
  const quotesStats = await makeRequest(`${baseUrl}/quotes/stats`);
  const hasStatsData = quotesStats.data?.data?.total !== undefined;
  logTest(
    'Get quotes stats', 
    quotesStats.success && hasStatsData,
    `Status: ${quotesStats.status}, Has stats data: ${hasStatsData}`
  );

  // Summary
  console.log('=====================================');
  console.log('📊 TEST SUMMARY');
  console.log('=====================================');
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests} tests`);
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`📈 Success Rate: ${successRate}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! The quotes API is production-ready! 🚀');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }
}

testQuotesComprehensive(); 