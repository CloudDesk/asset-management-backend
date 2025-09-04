import axios from 'axios';

async function testManualProductQuantityUpdate() {
  try {
    console.log('=== TESTING MANUAL PRODUCT QUANTITY UPDATE ===');
    
    // Test data
    const orderData = {
      id: 51,
      orderid: "ORDER_TXN_1756969075400_49DG1F_1756969118484",
      userid: 5,
      orderamount: 240,
      orderstatus: "payment_completed",
      quantity: 1,
      transactionid: "NIVAANA-TRAN-00103",
      productamount: 240,
      discountamount: 0,
      ispaymentsucceed: true,
      merchanttransactionid: "TXN_1756969075400_49DG1F",
      productid: [11],
      mode: "phonepe",
      createddate: 1756969118484,
      modifieddate: 1756969118484
    };

    const originalOrderItems = [
      {
        productid: 11,
        productname: "ARCASA Scented Candles",
        productcategory: "wellness",
        userid: 5,
        addressid: 22,
        productamount: 240,
        discountamount: 0,
        orderamount: 240,
        quantity: 1,
        cartId: 390
      }
    ];

    console.log('Order Data:', JSON.stringify(orderData, null, 2));
    console.log('Original Order Items:', JSON.stringify(originalOrderItems, null, 2));

    // Call the product quantity update endpoint
    const response = await axios.post('http://localhost:5600/v1/phonepe/test-update-quantities', {
      orderData,
      originalOrderItems,
      mode: 'phonepe'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
}

testManualProductQuantityUpdate();
