import axios from 'axios';

async function testProductQuantityUpdate() {
  try {
    console.log('=== STARTING PRODUCT QUANTITY UPDATE DEBUG TEST ===');
    console.log('Timestamp:', new Date().toISOString());
    
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

    console.log('=== PAYLOAD TO BE SENT ===');
    console.log(JSON.stringify(payload, null, 2));

    console.log('=== STEP 1: SENDING PAYMENT INITIATION REQUEST ===');
    console.log('URL: http://localhost:5600/v1/phonepe/initiate');
    
    const response = await axios.post('http://localhost:5600/v1/phonepe/initiate', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('=== PAYMENT INITIATION RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data.merchantTransactionId) {
      const merchantTransactionId = response.data.data.merchantTransactionId;
      console.log('=== MERCHANT TRANSACTION ID EXTRACTED ===');
      console.log('merchantTransactionId:', merchantTransactionId);
      
      // Wait a bit for the transaction to be processed
      console.log('=== WAITING 3 SECONDS FOR TRANSACTION PROCESSING ===');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check payment status
      console.log('=== STEP 2: CHECKING PAYMENT STATUS ===');
      console.log('URL:', `http://localhost:5600/v1/phonepe/status/${merchantTransactionId}`);
      
      const statusResponse = await axios.get(`http://localhost:5600/v1/phonepe/status/${merchantTransactionId}`);
      
      console.log('=== PAYMENT STATUS RESPONSE ===');
      console.log('Status:', statusResponse.status);
      console.log('Data:', JSON.stringify(statusResponse.data, null, 2));
      
      // Check transaction details
      console.log('=== STEP 3: CHECKING TRANSACTION DETAILS ===');
      console.log('URL:', `http://localhost:5600/v1/transactions?merchanttransactionid=${merchantTransactionId}`);
      
      try {
        const transactionResponse = await axios.get(`http://localhost:5600/v1/transactions?merchanttransactionid=${merchantTransactionId}`);
        console.log('=== TRANSACTION DETAILS ===');
        console.log('Status:', transactionResponse.status);
        console.log('Data:', JSON.stringify(transactionResponse.data, null, 2));
      } catch (transactionError) {
        console.log('=== TRANSACTION DETAILS ERROR ===');
        console.log('Error:', transactionError.response?.data || transactionError.message);
      }
      
      // Check product details
      console.log('=== STEP 4: CHECKING PRODUCT DETAILS ===');
      console.log('URL:', `http://localhost:5600/v1/products/11`);
      
      try {
        const productResponse = await axios.get(`http://localhost:5600/v1/products/11`);
        console.log('=== PRODUCT DETAILS BEFORE UPDATE ===');
        console.log('Status:', productResponse.status);
        console.log('Data:', JSON.stringify(productResponse.data, null, 2));
      } catch (productError) {
        console.log('=== PRODUCT DETAILS ERROR ===');
        console.log('Error:', productError.response?.data || productError.message);
      }
      
    } else {
      console.log('=== ERROR: NO MERCHANT TRANSACTION ID IN RESPONSE ===');
      console.log('Response data:', response.data);
    }

  } catch (error) {
    console.log('=== TEST ERROR ===');
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('No response object');
    }
    console.log('Stack trace:', error.stack);
  }
  
  console.log('=== TEST COMPLETED ===');
  console.log('Timestamp:', new Date().toISOString());
}

// Run the test
testProductQuantityUpdate(); 
