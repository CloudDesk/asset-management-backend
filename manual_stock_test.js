import axios from 'axios';

const BASE_URL = 'http://localhost:5600';
const STOCK_ENDPOINT = `${BASE_URL}/v1/stocks`;

async function testStockCreation() {
  console.log('🧪 Testing Stock POST Method');
  console.log(`🎯 Endpoint: ${STOCK_ENDPOINT}`);

  // Test 1: Create stock without productId (to avoid foreign key constraint)
  const payload1 = {
    "serialNumber": "manual_test_001",
    "manufactureYear": "2025-06-03",
    "ecommercePublish": true,
    "releaseYear": "2025-06-05",
    "location": "chennai"
  };

  try {
    console.log('\n📤 Test 1: Creating stock without productId');
    console.log('Payload:', JSON.stringify(payload1, null, 2));
    
    const response1 = await axios.post(STOCK_ENDPOINT, payload1, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });

    console.log(`📥 Response Status: ${response1.status}`);
    console.log('Response:', JSON.stringify(response1.data, null, 2));

    if (response1.status === 201) {
      console.log('✅ SUCCESS: Stock created successfully!');
      
      // Test 2: Try the original user payload
      const payload2 = {
        "serialNumber": "user_test_002", // Different serial number
        "manufactureYear": "2025-06-03",
        "ecommercePublish": true,
        "releaseYear": "2025-06-05",
        "location": "chennai"
      };

      console.log('\n📤 Test 2: Testing user payload (without productId)');
      console.log('Payload:', JSON.stringify(payload2, null, 2));

      const response2 = await axios.post(STOCK_ENDPOINT, payload2, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true
      });

      console.log(`📥 Response Status: ${response2.status}`);
      console.log('Response:', JSON.stringify(response2.data, null, 2));

      if (response2.status === 201) {
        console.log('✅ SUCCESS: User payload works!');
      } else {
        console.log('❌ FAILED: User payload failed');
      }
    } else {
      console.log('❌ FAILED: Initial test failed');
    }

  } catch (error) {
    console.error('💥 ERROR:', error.message);
  }
}

testStockCreation().catch(console.error); 