/**
 * Test with a different phone number to see if it's account-specific
 */

const http = require('http');

// Test with a different number format
const testData = {
  phoneNumber: '919876543210', // Different test number with country code
  message: 'Test SMS to different number - account verification'
};

console.log('🧪 Testing with DIFFERENT phone number...');
console.log('📱 Phone:', testData.phoneNumber);
console.log('💬 Message:', testData.message);
console.log('⏰ Time:', new Date().toISOString());
console.log('---');

const options = {
  hostname: 'localhost',
  port: 5600,
  path: '/v1/sms/send-otp',
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
        console.log('\n✅ SMS ACCEPTED');
        console.log('📬 Message ID:', jsonResponse.data?.messageId);
        console.log('📊 Status:', jsonResponse.data?.status);
      } else {
        console.log('\n❌ SMS REJECTED:', jsonResponse.message);
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
