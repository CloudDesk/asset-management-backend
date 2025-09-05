const axios = require('axios');

const BASE_URL = 'http://localhost:5600';

async function testPhonePeDebug() {
  try {
    console.log('🧪 Testing PhonePe initiate with debug logs...\n');

    const response = await axios.post(`${BASE_URL}/v1/phonepe/initiate`, {
      mode: "phonepe",
      evaluation_ids: [
        "eval_1757082387167_iilicjzjh",
        "eval_1757084924560_yd7lr2kca"
      ],
      transaction: {
        userId: 24,
        amount: 638,
        currency: "INR",
        productid: [8],
        mobilenumber: "9876543210"
      },
      order: [{
        addressid: 1,
        cartId: 1,
        discountamount: 0,
        orderamount: 638,
        productamount: 638,
        productcategory: "electronics",
        productid: 8,
        productname: "Test Product",
        quantity: 1,
        userid: 24
      }]
    });

    console.log('✅ PhonePe Response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ PhonePe Error:');
    console.log('Status:', error.response?.status);
    console.log('Response:', JSON.stringify(error.response?.data, null, 2));
  }
}

// Run the test
testPhonePeDebug();
