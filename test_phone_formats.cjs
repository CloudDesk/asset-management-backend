/**
 * Test different phone number formats for SMS delivery
 */

const http = require('http');

const phoneFormats = [
  '8825727948',        // Current format (10 digits)
  '918825727948',      // With country code (India +91)
  '+918825727948',     // With + and country code
  '08825727948',       // With leading zero
];

const testMessage = 'Test SMS delivery - Format check';

async function testPhoneFormat(phoneNumber) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5600,
      path: '/v1/sms/send-otp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const testData = {
      phoneNumber: phoneNumber,
      message: testMessage
    };

    console.log(`\n🧪 Testing format: ${phoneNumber}`);
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success) {
            console.log(`✅ SUCCESS - Message ID: ${response.data.messageId}`);
            console.log(`📊 Status: ${response.data.status}`);
          } else {
            console.log(`❌ FAILED - ${response.message}`);
          }
        } catch (error) {
          console.log(`❌ Parse Error: ${data}`);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request Error: ${error.message}`);
      resolve();
    });

    req.write(JSON.stringify(testData));
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Testing different phone number formats...');
  console.log('📱 Target number: 8825727948');
  console.log('💬 Message:', testMessage);
  console.log('=' * 50);

  for (const phoneFormat of phoneFormats) {
    await testPhoneFormat(phoneFormat);
    // Wait 2 seconds between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n📋 Summary:');
  console.log('- Check your phone for messages from the last 5 minutes');
  console.log('- If you receive any, note which format worked');
  console.log('- If none work, we need to check Infobip account settings');
}

runTests();
