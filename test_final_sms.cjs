/**
 * Final test with proper international format
 */

const http = require('http');

const testData = {
  phoneNumber: '8825727948', // Will be auto-formatted to 918825727948
  message: '✅ FINAL TEST - SMS delivery fix applied! Check your phone now!'
};

console.log('🎯 FINAL SMS TEST');
console.log('📱 Input Number:', testData.phoneNumber);
console.log('🔄 Auto-formatted to: 91' + testData.phoneNumber);
console.log('💬 Message:', testData.message);
console.log('⏰ Time:', new Date().toISOString());
console.log('=' * 60);

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
        console.log('\n🎉 SMS SENT SUCCESSFULLY!');
        console.log('📬 Message ID:', jsonResponse.data?.messageId);
        console.log('📊 Status:', jsonResponse.data?.status);
        console.log('⏰ Sent At:', jsonResponse.data?.sentAt);
        
        console.log('\n📱 WHAT TO DO NOW:');
        console.log('1. Check your phone for SMS from "NIVAPP"');
        console.log('2. Wait 1-2 minutes for delivery');
        console.log('3. If you receive it, the fix worked!');
        console.log('4. If not, we need to check other issues');
        
        console.log('\n🔍 TROUBLESHOOTING IF STILL NOT WORKING:');
        console.log('- Check if your number is on DND (Do Not Disturb)');
        console.log('- Try with a different phone number');
        console.log('- Check Infobip account balance (currently $0)');
        console.log('- Verify account is not in trial mode');
        
      } else {
        console.log('\n❌ SMS FAILED:', jsonResponse.message);
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
