const axios = require('axios');

const BASE_URL = 'http://localhost:5600';

async function testUserEvaluations() {
  try {
    console.log('🧪 Testing user active evaluations route...\n');

    const response = await axios.get(`${BASE_URL}/v1/promotions/evaluations?user_id=24`);

    console.log('✅ User Evaluations Response:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.data.evaluations.length > 0) {
      console.log('\n📊 Summary:');
      console.log(`- Total Active Evaluations: ${response.data.data.total_count}`);
      console.log('- Evaluation IDs:');
      response.data.data.evaluations.forEach((eval, index) => {
        console.log(`  ${index + 1}. ${eval.evaluation_id} (Status: ${eval.status})`);
      });
    } else {
      console.log('ℹ️ No active evaluations found for user 24');
    }

  } catch (error) {
    console.error('❌ Error testing user evaluations:', error.response?.data || error.message);
  }
}

// Run the test
testUserEvaluations();
