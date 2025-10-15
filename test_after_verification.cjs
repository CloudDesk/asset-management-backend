/**
 * Test SMS after phone number verification
 */

const http = require('http');

const testData = {
  phoneNumber: '8825727948',
  message: '🎉 VERIFIED! SMS should work now! Your OTP is 123456'
};

console.log('🧪 Testing SMS AFTER verification...');
console.log('📱 Phone:', testData.phoneNumber);
console.log('💬 Message:', testData.message);
console.log('⏰ Time:', new Date().toISOString());
console.log('=' * 50);

const options = {
  hostname: 'localhost',
  port: 5600,
  path: '/v1/sms/send-otp-twilio',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📊 Response Status:', res.statusCode);
    
    try {
      const jsonResponse = JSON.parse(data);
      
      if (jsonResponse.success) {
        console.log('\n🎉 SUCCESS! SMS SENT VIA TWILIO!');
        console.log('📬 Message ID:', jsonResponse.data?.messageId);
        console.log('📊 Status:', jsonResponse.data?.status);
        console.log('🔧 Provider:', jsonResponse.data?.provider);
        console.log('\n📱 CHECK YOUR PHONE NOW!');
        console.log('✅ Verification worked!');
        
      } else {
        console.log('\n❌ Still failing:', jsonResponse.message);
        console.log('Details:', jsonResponse.details);
        
        if (jsonResponse.details.includes('unverified')) {
          console.log('\n🔧 SOLUTION:');
          console.log('1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
          console.log('2. Add number: +918825727948');
          console.log('3. Verify via SMS code');
          console.log('4. Run this test again');
        }
      }
    } catch (error) {
      console.log('Parse error:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request Error:', error.message);
});

req.write(JSON.stringify(testData));
req.end();
