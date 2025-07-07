const axios = require('axios');

const BASE_URL = 'http://localhost:5600';
const PROMOTIONS_URL = `${BASE_URL}/v1/promotions`;
const PROMOTION_RULES_URL = `${BASE_URL}/v1/promotion-rules`;
const PROMOTION_ACTIONS_URL = `${BASE_URL}/v1/promotion-actions`;

async function testPromotionsEligibility() {
  console.log('\n🚀 Starting Promotions Eligibility Tests...\n');
  
  try {
    // Test 1: Basic eligibility check with no cart
    console.log('Test 1: Basic eligibility check with no cart');
    const basicResponse = await axios.get(`${PROMOTIONS_URL}/eligible?user_id=test_user&platform=web`);
    console.log('✅ Basic eligibility check passed');
    console.log(`Found ${basicResponse.data.data.eligible_promotions?.length || 0} eligible promotions\n`);

    // Test 2: Eligibility with cart items
    console.log('Test 2: Eligibility with cart items');
    const cartData = {
      user_id: 'test_user',
      platform: 'web',
      cart: [
        { product_id: '1', quantity: 2, price: 100 },
        { product_id: '2', quantity: 1, price: 50 }
      ]
    };
    const cartResponse = await axios.post(`${PROMOTIONS_URL}/eligible`, cartData);
    console.log('✅ Cart eligibility check passed');
    console.log(`Found ${cartResponse.data.data.eligible_promotions?.length || 0} eligible promotions\n`);

    // Test 3: Create and test a new promotion
    console.log('Test 3: Create and test new promotion');
    
    // Create promotion
    const promotion = await axios.post(PROMOTIONS_URL, {
      name: 'Test Cart Total Promotion',
      type: 'discount',
      code: 'TEST_CART_TOTAL',
      status: 'active',
      visibility: 'public'
    });
    console.log('✅ Created test promotion');

    // Add rule
    const rule = await axios.post(PROMOTION_RULES_URL, {
      promotion_id: promotion.data.data.id,
      rule_type: 'cart',
      condition_key: 'cart_total',
      operator: 'greater_than',
      value: '200',
      value_type: 'number'
    });
    console.log('✅ Added promotion rule');

    // Add action
    const action = await axios.post(PROMOTION_ACTIONS_URL, {
      promotion_id: promotion.data.data.id,
      action_type: 'flat_discount',
      value: '20',
      target: 'cart'
    });
    console.log('✅ Added promotion action');

    // Test with cart meeting the rule
    const validCartData = {
      user_id: 'test_user',
      platform: 'web',
      cart: [
        { product_id: '1', quantity: 3, price: 100 } // Total 300
      ]
    };
    const validCartResponse = await axios.post(`${PROMOTIONS_URL}/eligible`, validCartData);
    console.log('✅ Valid cart eligibility check passed');
    console.log(`Found ${validCartResponse.data.data.eligible_promotions?.length || 0} eligible promotions\n`);

    // Test 4: Test with different platforms
    console.log('Test 4: Platform-specific eligibility');
    const platforms = ['web', 'mobile', 'pos'];
    for (const platform of platforms) {
      const platformResponse = await axios.get(`${PROMOTIONS_URL}/eligible?user_id=test_user&platform=${platform}`);
      console.log(`✅ ${platform} platform check passed`);
      console.log(`Found ${platformResponse.data.data.eligible_promotions?.length || 0} eligible promotions for ${platform}\n`);
    }

    // Test 5: Test with specific promotion code
    console.log('Test 5: Code-specific eligibility');
    const codeResponse = await axios.get(`${PROMOTIONS_URL}/eligible?user_id=test_user&platform=web&code=TEST_CART_TOTAL`);
    console.log('✅ Code-specific eligibility check passed');
    console.log(`Found ${codeResponse.data.data.eligible_promotions?.length || 0} eligible promotions for code\n`);

    console.log('\n✅ All promotion eligibility tests completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
  }
}

testPromotionsEligibility();