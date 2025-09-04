const axios = require('axios');

async function testProductQuantityUpdate() {
  try {
    console.log('Testing product quantity update...');
    
    const payload = {
      "transaction": {
        "name": "pravinsf24@gmail.com",
        "amount": 240,
        "mobilenumber": "8870339850",
        "userId": 5,
        "productid": [11],
        "transactionfor": "product"
      },
      "order": [
        {
          "productid": 11,
          "productname": "ARCASA Scented Candles",
          "productcategory": "wellness",
          "userid": 5,
          "addressid": 22,
          "productamount": 240,
          "discountamount": 0,
          "orderamount": 240,
          "quantity": 1,
          "cartId": 390
        }
      ],
      "mode": "phonepe"
    };

    console.log('Sending payment initiation request...');
    const response = await axios.post('http://localhost:5600/api/phonepe/initiate-payment', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Payment initiation response:', response.data);
    
    if (response.data.success && response.data.data.merchantTransactionId) {
      const merchantTransactionId = response.data.data.merchantTransactionId;
      console.log('Merchant Transaction ID:', merchantTransactionId);
      
      // Wait a bit for the transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check payment status
      console.log('Checking payment status...');
      const statusResponse = await axios.get(`http://localhost:5600/api/phonepe/check-payment-status/${merchantTransactionId}`);
      console.log('Payment status response:', statusResponse.data);
    }

  } catch (error) {
    console.error('Error testing product quantity update:', error.response?.data || error.message);
  }
}

testProductQuantityUpdate();
