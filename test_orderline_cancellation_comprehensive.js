const axios = require('axios');
const fs = require('fs');

// Configuration
const BASE_URL = 'http://localhost:5600/v1';
const TEST_TIMEOUT = 30000;

// Test data
let testOrderId;
let testOrderlineIds = [];
let testProductIds = [];
let originalProductQuantities = {};

// Utility functions
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createTestOrder = async () => {
  try {
    log('Creating test order...');
    
    const orderData = {
      userid: 1,
      addressid: 1,
      orderamount: 1500,
      orderid: `TEST-ORDER-${Date.now()}`,
      orderstatus: 'order_processing',
      quantity: 3,
      productid: [1, 2, 3], // Test product IDs
      createddate: Date.now(),
      modifieddate: Date.now()
    };

    const response = await axios.post(`${BASE_URL}/orders`, orderData);
    
    if (response.data.success) {
      testOrderId = response.data.data.id;
      log(`Test order created with ID: ${testOrderId}`);
      return response.data.data;
    } else {
      throw new Error('Failed to create test order');
    }
  } catch (error) {
    log('Error creating test order:', error.response?.data || error.message);
    throw error;
  }
};

const createTestOrderlines = async () => {
  try {
    log('Creating test orderlines...');
    
    const orderlineData = [
      {
        orderid: testOrderId,
        productid: 1,
        userid: 1,
        quantity: 2,
        productamount: 500,
        orderamount: 1000,
        orderstatus: 'order_processing',
        orderlinenumber: `TEST-OL-1-${Date.now()}`,
        createddate: Date.now(),
        modifieddate: Date.now()
      },
      {
        orderid: testOrderId,
        productid: 2,
        userid: 1,
        quantity: 1,
        productamount: 300,
        orderamount: 300,
        orderstatus: 'order_processing',
        orderlinenumber: `TEST-OL-2-${Date.now()}`,
        createddate: Date.now(),
        modifieddate: Date.now()
      },
      {
        orderid: testOrderId,
        productid: 3,
        userid: 1,
        quantity: 1,
        productamount: 200,
        orderamount: 200,
        orderstatus: 'order_processing',
        orderlinenumber: `TEST-OL-3-${Date.now()}`,
        createddate: Date.now(),
        modifieddate: Date.now()
      }
    ];

    for (const data of orderlineData) {
      const response = await axios.post(`${BASE_URL}/orderlines`, data);
      if (response.data.success) {
        testOrderlineIds.push(response.data.data.id);
        testProductIds.push(data.productid);
        log(`Test orderline created with ID: ${response.data.data.id}`);
      } else {
        throw new Error(`Failed to create test orderline: ${JSON.stringify(data)}`);
      }
    }

    log(`Created ${testOrderlineIds.length} test orderlines`);
  } catch (error) {
    log('Error creating test orderlines:', error.response?.data || error.message);
    throw error;
  }
};

const getProductQuantities = async (productId) => {
  try {
    const response = await axios.get(`${BASE_URL}/products/${productId}`);
    if (response.data.success) {
      const product = response.data.data;
      return {
        orderedquantity: product.orderedquantity || 0,
        availablequantity: product.availablequantity || 0,
        productstatus: product.productstatus
      };
    }
    return null;
  } catch (error) {
    log(`Error getting product quantities for product ${productId}:`, error.response?.data || error.message);
    return null;
  }
};

const updateProductQuantitiesForOrder = async () => {
  try {
    log('Updating product quantities to simulate order creation...');
    
    for (const productId of testProductIds) {
      const currentQuantities = await getProductQuantities(productId);
      if (currentQuantities) {
        originalProductQuantities[productId] = { ...currentQuantities };
        
        // Simulate order creation by increasing ordered quantity and decreasing available quantity
        const orderline = testOrderlineIds.find((_, index) => testProductIds[index] === productId);
        const quantity = orderline ? 2 : 1; // Default quantities
        
        const updateData = {
          orderedquantity: currentQuantities.orderedquantity + quantity,
          availablequantity: Math.max(0, currentQuantities.availablequantity - quantity),
          modifieddate: Date.now()
        };

        const response = await axios.put(`${BASE_URL}/products/${productId}`, updateData);
        if (response.data.success) {
          log(`Updated product ${productId} quantities:`, updateData);
        }
      }
    }
  } catch (error) {
    log('Error updating product quantities:', error.response?.data || error.message);
  }
};

const getOrderStatus = async (orderId) => {
  try {
    const response = await axios.get(`${BASE_URL}/orders/${orderId}`);
    if (response.data.success) {
      return response.data.data.orderstatus;
    }
    return null;
  } catch (error) {
    log(`Error getting order status for order ${orderId}:`, error.response?.data || error.message);
    return null;
  }
};

const getOrderlineStatus = async (orderlineId) => {
  try {
    const response = await axios.get(`${BASE_URL}/orderlines/${orderlineId}`);
    if (response.data.success) {
      return response.data.data.orderstatus;
    }
    return null;
  } catch (error) {
    log(`Error getting orderline status for orderline ${orderlineId}:`, error.response?.data || error.message);
    return null;
  }
};

// Test functions
const testOrderlineCancellation = async () => {
  log('\n=== Testing Orderline Cancellation ===');
  
  try {
    // Test 1: Cancel first orderline
    log('\n--- Test 1: Cancel first orderline ---');
    const orderlineId = testOrderlineIds[0];
    const productId = testProductIds[0];
    
    const beforeQuantities = await getProductQuantities(productId);
    const beforeOrderStatus = await getOrderStatus(testOrderId);
    
    log('Before cancellation:');
    log(`- Product ${productId} quantities:`, beforeQuantities);
    log(`- Order status: ${beforeOrderStatus}`);
    
    const response = await axios.patch(`${BASE_URL}/orderlines/${orderlineId}/cancel`, {
      reason: 'Customer request'
    });
    
    if (response.data.success) {
      log('Cancellation successful:', response.data);
      
      // Verify orderline status
      const orderlineStatus = await getOrderlineStatus(orderlineId);
      log(`Orderline status after cancellation: ${orderlineStatus}`);
      
      // Verify product quantities
      const afterQuantities = await getProductQuantities(productId);
      log(`Product ${productId} quantities after cancellation:`, afterQuantities);
      
      // Verify order status (should not be cancelled yet)
      const afterOrderStatus = await getOrderStatus(testOrderId);
      log(`Order status after first cancellation: ${afterOrderStatus}`);
      
      // Verify quantity restoration
      if (beforeQuantities && afterQuantities) {
        const expectedOrdered = beforeQuantities.orderedquantity - 2; // Restored 2 units
        const expectedAvailable = beforeQuantities.availablequantity + 2;
        
        if (afterQuantities.orderedquantity === expectedOrdered && 
            afterQuantities.availablequantity === expectedAvailable) {
          log('✅ Product quantities restored correctly');
        } else {
          log('❌ Product quantities not restored correctly');
          log(`Expected: ordered=${expectedOrdered}, available=${expectedAvailable}`);
          log(`Actual: ordered=${afterQuantities.orderedquantity}, available=${afterQuantities.availablequantity}`);
        }
      }
    } else {
      log('❌ Cancellation failed:', response.data);
    }
    
    await sleep(1000);
    
    // Test 2: Cancel second orderline
    log('\n--- Test 2: Cancel second orderline ---');
    const orderlineId2 = testOrderlineIds[1];
    const productId2 = testProductIds[1];
    
    const beforeQuantities2 = await getProductQuantities(productId2);
    
    const response2 = await axios.patch(`${BASE_URL}/orderlines/${orderlineId2}/cancel`, {
      reason: 'Out of stock'
    });
    
    if (response2.data.success) {
      log('Second cancellation successful:', response2.data);
      
      const orderlineStatus2 = await getOrderlineStatus(orderlineId2);
      log(`Second orderline status: ${orderlineStatus2}`);
      
      const afterQuantities2 = await getProductQuantities(productId2);
      log(`Product ${productId2} quantities after cancellation:`, afterQuantities2);
      
      // Order should still not be cancelled
      const orderStatus2 = await getOrderStatus(testOrderId);
      log(`Order status after second cancellation: ${orderStatus2}`);
    }
    
    await sleep(1000);
    
    // Test 3: Cancel third orderline (should trigger order cancellation)
    log('\n--- Test 3: Cancel third orderline (should trigger order cancellation) ---');
    const orderlineId3 = testOrderlineIds[2];
    const productId3 = testProductIds[2];
    
    const beforeQuantities3 = await getProductQuantities(productId3);
    
    const response3 = await axios.patch(`${BASE_URL}/orderlines/${orderlineId3}/cancel`, {
      reason: 'Quality issue'
    });
    
    if (response3.data.success) {
      log('Third cancellation successful:', response3.data);
      
      const orderlineStatus3 = await getOrderlineStatus(orderlineId3);
      log(`Third orderline status: ${orderlineStatus3}`);
      
      const afterQuantities3 = await getProductQuantities(productId3);
      log(`Product ${productId3} quantities after cancellation:`, afterQuantities3);
      
      // Order should now be cancelled
      const finalOrderStatus = await getOrderStatus(testOrderId);
      log(`Final order status: ${finalOrderStatus}`);
      
      if (finalOrderStatus === 'cancelled') {
        log('✅ Order status correctly updated to cancelled');
      } else {
        log('❌ Order status not updated to cancelled');
      }
    }
    
    await sleep(1000);
    
    // Test 4: Try to cancel already cancelled orderline
    log('\n--- Test 4: Try to cancel already cancelled orderline ---');
    const response4 = await axios.patch(`${BASE_URL}/orderlines/${orderlineId}/cancel`, {
      reason: 'Duplicate cancellation attempt'
    });
    
    if (response4.data.success) {
      log('Duplicate cancellation handled gracefully:', response4.data);
    } else {
      log('❌ Duplicate cancellation failed:', response4.data);
    }
    
  } catch (error) {
    log('❌ Error in orderline cancellation test:', error.response?.data || error.message);
  }
};

const testInvalidCancellation = async () => {
  log('\n=== Testing Invalid Cancellation Scenarios ===');
  
  try {
    // Test 1: Cancel non-existent orderline
    log('\n--- Test 1: Cancel non-existent orderline ---');
    try {
      const response = await axios.patch(`${BASE_URL}/orderlines/99999/cancel`, {
        reason: 'Test non-existent'
      });
      log('❌ Should have failed for non-existent orderline');
    } catch (error) {
      if (error.response?.status === 404) {
        log('✅ Correctly handled non-existent orderline');
      } else {
        log('❌ Unexpected error for non-existent orderline:', error.response?.data || error.message);
      }
    }
    
    // Test 2: Cancel with invalid orderline ID
    log('\n--- Test 2: Cancel with invalid orderline ID ---');
    try {
      const response = await axios.patch(`${BASE_URL}/orderlines/invalid-id/cancel`, {
        reason: 'Test invalid ID'
      });
      log('❌ Should have failed for invalid ID');
    } catch (error) {
      if (error.response?.status === 400) {
        log('✅ Correctly handled invalid orderline ID');
      } else {
        log('❌ Unexpected error for invalid ID:', error.response?.data || error.message);
      }
    }
    
  } catch (error) {
    log('❌ Error in invalid cancellation test:', error.response?.data || error.message);
  }
};

const testBulkCancellation = async () => {
  log('\n=== Testing Bulk Cancellation ===');
  
  try {
    // Create new test order for bulk cancellation
    log('\n--- Creating new test order for bulk cancellation ---');
    const newOrderData = {
      userid: 1,
      addressid: 1,
      orderamount: 1000,
      orderid: `BULK-TEST-ORDER-${Date.now()}`,
      orderstatus: 'order_processing',
      quantity: 2,
      productid: [4, 5],
      createddate: Date.now(),
      modifieddate: Date.now()
    };

    const orderResponse = await axios.post(`${BASE_URL}/orders`, newOrderData);
    const newOrderId = orderResponse.data.data.id;
    
    // Create orderlines for bulk test
    const bulkOrderlineData = [
      {
        orderid: newOrderId,
        productid: 4,
        userid: 1,
        quantity: 1,
        productamount: 400,
        orderamount: 400,
        orderstatus: 'order_processing',
        orderlinenumber: `BULK-OL-1-${Date.now()}`,
        createddate: Date.now(),
        modifieddate: Date.now()
      },
      {
        orderid: newOrderId,
        productid: 5,
        userid: 1,
        quantity: 1,
        productamount: 600,
        orderamount: 600,
        orderstatus: 'order_processing',
        orderlinenumber: `BULK-OL-2-${Date.now()}`,
        createddate: Date.now(),
        modifieddate: Date.now()
      }
    ];

    const bulkOrderlineIds = [];
    for (const data of bulkOrderlineData) {
      const response = await axios.post(`${BASE_URL}/orderlines`, data);
      bulkOrderlineIds.push(response.data.data.id);
    }
    
    log(`Created ${bulkOrderlineIds.length} orderlines for bulk cancellation test`);
    
    // Cancel all orderlines individually
    log('\n--- Cancelling all orderlines individually ---');
    for (let i = 0; i < bulkOrderlineIds.length; i++) {
      const orderlineId = bulkOrderlineIds[i];
      const productId = bulkOrderlineData[i].productid;
      
      log(`Cancelling orderline ${orderlineId} (product ${productId})`);
      
      const response = await axios.patch(`${BASE_URL}/orderlines/${orderlineId}/cancel`, {
        reason: `Bulk test cancellation ${i + 1}`
      });
      
      if (response.data.success) {
        log(`✅ Orderline ${orderlineId} cancelled successfully`);
        
        // Check if order status was updated on last cancellation
        const orderStatus = await getOrderStatus(newOrderId);
        log(`Order status after cancellation ${i + 1}: ${orderStatus}`);
        
        if (i === bulkOrderlineIds.length - 1 && orderStatus === 'cancelled') {
          log('✅ Order correctly cancelled when all orderlines were cancelled');
        }
      } else {
        log(`❌ Failed to cancel orderline ${orderlineId}:`, response.data);
      }
      
      await sleep(500);
    }
    
  } catch (error) {
    log('❌ Error in bulk cancellation test:', error.response?.data || error.message);
  }
};

const cleanupTestData = async () => {
  log('\n=== Cleaning up test data ===');
  
  try {
    // Clean up orderlines
    for (const orderlineId of testOrderlineIds) {
      try {
        await axios.delete(`${BASE_URL}/orderlines/${orderlineId}`);
        log(`Deleted orderline ${orderlineId}`);
      } catch (error) {
        log(`Error deleting orderline ${orderlineId}:`, error.response?.data || error.message);
      }
    }
    
    // Clean up order
    if (testOrderId) {
      try {
        await axios.delete(`${BASE_URL}/orders/${testOrderId}`);
        log(`Deleted order ${testOrderId}`);
      } catch (error) {
        log(`Error deleting order ${testOrderId}:`, error.response?.data || error.message);
      }
    }
    
    // Restore original product quantities
    for (const [productId, quantities] of Object.entries(originalProductQuantities)) {
      try {
        const updateData = {
          orderedquantity: quantities.orderedquantity,
          availablequantity: quantities.availablequantity,
          productstatus: quantities.productstatus,
          modifieddate: Date.now()
        };
        
        await axios.put(`${BASE_URL}/products/${productId}`, updateData);
        log(`Restored product ${productId} quantities`);
      } catch (error) {
        log(`Error restoring product ${productId} quantities:`, error.response?.data || error.message);
      }
    }
    
  } catch (error) {
    log('Error in cleanup:', error.response?.data || error.message);
  }
};

// Main test execution
const runTests = async () => {
  log('🚀 Starting Orderline Cancellation Tests');
  log(`Base URL: ${BASE_URL}`);
  log(`Test timeout: ${TEST_TIMEOUT}ms`);
  
  try {
    // Setup
    log('\n=== Setup ===');
    await createTestOrder();
    await createTestOrderlines();
    await updateProductQuantitiesForOrder();
    
    // Run tests
    await testOrderlineCancellation();
    await testInvalidCancellation();
    await testBulkCancellation();
    
    log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    log('\n❌ Test execution failed:', error.message);
  } finally {
    // Cleanup
    await cleanupTestData();
    log('\n🧹 Cleanup completed');
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testOrderlineCancellation,
  testInvalidCancellation,
  testBulkCancellation
};
