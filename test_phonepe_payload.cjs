const axios = require('axios');

const payload = {
  "transaction": {
    "name": "User",
    "amount": 572.5,
    "mobilenumber": "9994824573",
    "userId": 24,
    "productid": [8],
    "transactionfor": "product"
  },
  "order": [
    {
      "productid": 8,
      "productname": "WishCare Pure Rosemary Essential Oil - 15 ML",
      "productcategory": "wellness",
      "userid": 24,
      "addressid": 20,
      "productamount": 850,
      "discountamount": 152,
      "orderamount": 698,
      "quantity": 1,
      "cartId": 416
    }
  ],
  "mode": "phonepe",
  "evaluation_ids": ["eval_1757304668750_44ddp4jpp"]
};

async function testPhonePePayload() {
  try {
    console.log('🚀 Testing PhonePe payload...');
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post('http://localhost:5600/v1/phonepe/initiate', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });
    
    console.log('✅ Response Status:', response.status);
    console.log('📋 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data.redirectUrl) {
      console.log('🔗 Redirect URL for payment:', response.data.data.redirectUrl);
      console.log('💳 Transaction ID:', response.data.data.merchantTransactionId);
      
      // Extract transaction ID for callback simulation
      const transactionId = response.data.data.merchantTransactionId;
      
      console.log('\n⏳ Waiting 3 seconds before simulating payment callback...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate payment callback (you would normally get this from PhonePe)
      console.log('🔄 Simulating payment callback...');
      const callbackUrl = `http://localhost:5600/v1/phonepe/callback/${transactionId}`;
      
      try {
        const callbackResponse = await axios.post(callbackUrl, {}, {
          headers: {
            'Content-Type': 'application/json',
          },
          maxRedirects: 0,  // Don't follow redirects
          validateStatus: function (status) {
            return status >= 200 && status < 400; // Accept redirects as success
          }
        });
        
        console.log('✅ Callback Status:', callbackResponse.status);
        if (callbackResponse.status === 302) {
          console.log('🔄 Callback redirected (expected behavior)');
          console.log('📍 Redirect Location:', callbackResponse.headers.location);
        }
        
      } catch (callbackError) {
        if (callbackError.response && callbackError.response.status === 302) {
          console.log('🔄 Callback redirected successfully (302)');
          console.log('📍 Redirect Location:', callbackError.response.headers.location);
        } else {
          console.error('❌ Callback Error:', callbackError.response?.data || callbackError.message);
        }
      }
      
    } else {
      console.error('❌ Payment initiation failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.error('📊 Status:', error.response?.status);
  }
}

// Run the test
testPhonePePayload();
