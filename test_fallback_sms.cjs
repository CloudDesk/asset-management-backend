/**
 * Test SMS with fallback (Infobip -> Twilio)
 */

const http = require('http');

const testData = {
  phoneNumber: '8825727948',
  message: '🔄 FALLBACK TEST - Trying Infobip first, then Twilio if needed'
};

console.log('🔄 Testing SMS with FALLBACK...');
console.log('📱 Phone:', testData.phoneNumber);
console.log('💬 Message:', testData.message);
console.log('⏰ Time:', new Date().toISOString());
console.log('=' * 60);

const options = {
  hostname: 'localhost',
  port: 5600,
  path: '/v1/sms/send-otp-with-fallback',
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
    console.log('📄 Response Body:');
    
    try {
      const jsonResponse = JSON.parse(data);
      console.log(JSON.stringify(jsonResponse, null, 2));
      
      if (jsonResponse.success) {
        console.log('\n🎉 SMS SENT SUCCESSFULLY!');
        console.log('📬 Message ID:', jsonResponse.data?.messageId);
        console.log('📊 Status:', jsonResponse.data?.status);
        console.log('🔧 Provider:', jsonResponse.data?.provider);
        console.log('🔄 Fallback Used:', jsonResponse.data?.fallbackUsed || false);
        
        if (jsonResponse.data?.fallbackUsed) {
          console.log('\n✅ FALLBACK WORKED!');
          console.log('📱 Twilio delivered the SMS!');
        } else {
          console.log('\n✅ PRIMARY PROVIDER WORKED!');
          console.log('📱 Infobip delivered the SMS!');
        }
        
      } else {
        console.log('\n❌ BOTH PROVIDERS FAILED');
        console.log('Error:', jsonResponse.message);
        console.log('Details:', jsonResponse.details);
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
