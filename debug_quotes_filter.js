import fetch from 'node-fetch';

async function testQuotesFilter() {
  console.log('🔍 Testing Quotes Filtering Debug');
  
  const baseUrl = 'http://localhost:5600/v1';
  
  try {
    console.log('\n📊 Test 1: Get all quotes (no filter)');
    const allQuotes = await fetch(`${baseUrl}/quotes/`);
    const allData = await allQuotes.json();
    console.log('Total quotes:', allData.pagination?.total || 0);
    console.log('Returned quotes:', allData.data?.length || 0);
    if (allData.data?.length > 0) {
      console.log('First quote prnumber:', allData.data[0].prnumber);
      console.log('All prnumbers:', allData.data.map(q => q.prnumber));
    }
    
    console.log('\n🎯 Test 2: Filter by specific prnumber');
    const filteredQuotes = await fetch(`${baseUrl}/quotes/?prnumber=REVO-PR-00005`);
    const filteredData = await filteredQuotes.json();
    console.log('Filtered total:', filteredData.pagination?.total || 0);
    console.log('Filtered returned:', filteredData.data?.length || 0);
    console.log('Meta info:', filteredData.meta);
    if (filteredData.data?.length > 0) {
      console.log('Filtered prnumbers:', filteredData.data.map(q => q.prnumber));
    }
    
    console.log('\n🔗 Test 3: Use dedicated prnumber route');
    const dedicatedRoute = await fetch(`${baseUrl}/quotes/prnumber/REVO-PR-00005`);
    const dedicatedData = await dedicatedRoute.json();
    console.log('Dedicated total:', dedicatedData.pagination?.total || 0);
    console.log('Dedicated returned:', dedicatedData.data?.length || 0);
    console.log('Dedicated meta:', dedicatedData.meta);
    if (dedicatedData.data?.length > 0) {
      console.log('Dedicated prnumbers:', dedicatedData.data.map(q => q.prnumber));
    }
    
    console.log('\n✅ Test 4: Filter by status (should work)');
    const statusFilter = await fetch(`${baseUrl}/quotes/?status=closed_won`);
    const statusData = await statusFilter.json();
    console.log('Status total:', statusData.pagination?.total || 0);
    console.log('Status returned:', statusData.data?.length || 0);
    if (statusData.data?.length > 0) {
      console.log('All statuses:', statusData.data.map(q => q.status));
    }
    
    console.log('\n❌ Test 5: Filter by non-existent status');
    const noMatchFilter = await fetch(`${baseUrl}/quotes/?status=non_existent`);
    const noMatchData = await noMatchFilter.json();
    console.log('No match total:', noMatchData.pagination?.total || 0);
    console.log('No match returned:', noMatchData.data?.length || 0);
    
  } catch (error) {
    console.error('Error testing quotes filter:', error.message);
  }
}

testQuotesFilter(); 