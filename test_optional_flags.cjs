const axios = require('axios');

const BASE_URL = 'http://localhost:5600';

async function testOptionalFlags() {
  try {
    console.log('🧪 Testing FREE_SHIPPING with optional flags...\n');

    // Test automatic promotions with cart value ₹850
    const cartItems = [
      {
        cart_record_id: "8",
        product_id: "8",
        quantity: 1,
        price: 850,
        category: "wellness",
        name: "WishCare Pure Rosemary Essential Oil - 15 ML"
      }
    ];

    console.log('📦 Cart Items:', JSON.stringify(cartItems, null, 2));
    console.log('💰 Cart Total: ₹850 (should qualify for free shipping over ₹500)\n');

    // Call automatic promotions API
    const response = await axios.post(`${BASE_URL}/v1/promotions/evaluate/automatic`, {
      user_id: "24",
      cart_items: cartItems,
      context: {
        channel: "web",
        geo: "IN"
      },
      current_total: 850
    });

    console.log('✅ Automatic Promotions Response:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.data.evaluations.length > 0) {
      const evaluation = response.data.data.evaluations[0];
      
      console.log('\n🔍 Analysis:');
      console.log(`- Promotion ID: ${evaluation.promotion_id}`);
      console.log(`- Promotion Name: ${evaluation.promotion_name}`);
      console.log(`- Total Discount: ₹${evaluation.total_discount}`);
      
      if (evaluation.shipping_info) {
        console.log('\n🚚 Shipping Information:');
        console.log(`- Original Shipping Cost: ₹${evaluation.shipping_info.original_shipping_cost}`);
        console.log(`- Final Shipping Cost: ₹${evaluation.shipping_info.final_shipping_cost}`);
        console.log(`- Shipping Discount: ₹${evaluation.shipping_info.shipping_discount}`);
        console.log(`- Is Free Shipping: ${evaluation.shipping_info.is_free_shipping}`);
      }

      console.log('\n📊 Breakdown:');
      if (evaluation.discount_breakdown && evaluation.discount_breakdown.length > 0) {
        evaluation.discount_breakdown.forEach(item => {
          console.log(`- ${item.product_name}: ₹${item.original_price} → ₹${item.final_price_per_item} (Discount: ₹${item.total_discount})`);
        });
      }

      // Test the optional flags
      console.log('\n🏷️ Testing Optional Flags:');
      console.log('=====================================');
      
      // Simulate what frontend would receive
      const mockAppliedPromotion = {
        promotion_id: evaluation.promotion_id,
        discount_amount: evaluation.total_discount,
        breakdown: evaluation.discount_breakdown || [],
        is_shipping_discount: true, // This would come from the database
        promotion_type: 'FREE_SHIPPING',
        shipping_info: evaluation.shipping_info
      };
      
      console.log('Mock Applied Promotion:', JSON.stringify(mockAppliedPromotion, null, 2));
      
      // Test safe frontend handling
      const isShippingDiscount = mockAppliedPromotion.is_shipping_discount === true;
      const promotionType = mockAppliedPromotion.promotion_type || 'UNKNOWN';
      const discountAmount = mockAppliedPromotion.discount_amount || 0;
      const shippingInfo = mockAppliedPromotion.shipping_info || null;
      
      console.log('\n✅ Safe Frontend Checks:');
      console.log(`- isShippingDiscount: ${isShippingDiscount}`);
      console.log(`- promotionType: ${promotionType}`);
      console.log(`- discountAmount: ₹${discountAmount}`);
      console.log(`- shippingInfo: ${shippingInfo ? 'Present' : 'Not Present'}`);
      
      if (isShippingDiscount) {
        console.log('\n🎯 Frontend Action: Show as FREE SHIPPING');
        console.log(`   - Display: "FREE SHIPPING - You save ₹${discountAmount}"`);
        console.log(`   - Shipping Cost: ₹0`);
        console.log(`   - Cart Total: Unchanged`);
      } else {
        console.log('\n🎯 Frontend Action: Show as Cart Discount');
        console.log(`   - Display: "${promotionType} - ₹${discountAmount} off"`);
        console.log(`   - Cart Total: Reduced by ₹${discountAmount}`);
      }

      // Check if the discount amount matches the shipping cost
      const expectedShippingCost = 30;
      if (evaluation.total_discount === expectedShippingCost) {
        console.log(`\n✅ SUCCESS: Discount amount (₹${evaluation.total_discount}) correctly matches shipping cost (₹${expectedShippingCost})`);
      } else {
        console.log(`\n❌ ISSUE: Discount amount (₹${evaluation.total_discount}) does not match expected shipping cost (₹${expectedShippingCost})`);
      }
    } else {
      console.log('❌ No automatic promotions found');
    }

  } catch (error) {
    console.error('❌ Error testing optional flags:', error.response?.data || error.message);
  }
}

// Run the test
testOptionalFlags();
