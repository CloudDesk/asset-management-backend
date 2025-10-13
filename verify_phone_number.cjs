/**
 * Script to help verify phone number in Twilio
 */

const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = 'ACbec90816980e03561f55ad7974990aa8';
const TWILIO_AUTH_TOKEN = '3ed2c97fd12cbd109383f21e97e00b8d';

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function verifyPhoneNumber() {
  console.log('📱 Twilio Phone Number Verification Helper');
  console.log('=' * 50);
  
  const phoneNumber = '+918825727948';
  
  console.log('🎯 Target Phone Number:', phoneNumber);
  console.log('📋 Account SID:', TWILIO_ACCOUNT_SID);
  
  try {
    // Check if number is already verified
    console.log('\n1️⃣ Checking if number is already verified...');
    
    try {
      const verifiedNumbers = await client.outgoingCallerIds.list();
      const isVerified = verifiedNumbers.some(num => num.phoneNumber === phoneNumber);
      
      if (isVerified) {
        console.log('✅ Phone number is already verified!');
        console.log('🚀 You can now send SMS to this number');
        return;
      } else {
        console.log('❌ Phone number is NOT verified');
      }
    } catch (error) {
      console.log('⚠️  Could not check verification status:', error.message);
    }
    
    // Attempt to start verification
    console.log('\n2️⃣ Starting verification process...');
    
    try {
      const verification = await client.api.outgoingCallerIds.create({
        phoneNumber: phoneNumber,
        friendlyName: 'My India Number'
      });
      
      console.log('✅ Verification request sent!');
      console.log('📬 Check your phone for verification SMS');
      console.log('🔢 Enter the verification code in Twilio Console');
      console.log('🔗 Console Link: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
      console.log('\n📋 Verification Details:');
      console.log('- Status:', verification.status);
      console.log('- Phone Number:', verification.phoneNumber);
      console.log('- SID:', verification.sid);
      
    } catch (verifyError) {
      console.log('❌ Could not start verification:', verifyError.message);
      
      if (verifyError.code === 21211) {
        console.log('\n💡 Manual Verification Required:');
        console.log('1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
        console.log('2. Click "Add a new number"');
        console.log('3. Enter:', phoneNumber);
        console.log('4. Verify via SMS code');
      }
    }
    
    console.log('\n📋 Next Steps:');
    console.log('1. Check your phone for verification SMS');
    console.log('2. Enter the code in Twilio Console');
    console.log('3. Run: node test_twilio_sms.cjs');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('🔍 Error Code:', error.code);
    
    console.log('\n🛠️  Manual Solution:');
    console.log('1. Visit: https://console.twilio.com');
    console.log('2. Go to Phone Numbers → Verified Caller IDs');
    console.log('3. Add number:', phoneNumber);
    console.log('4. Verify via SMS');
  }
}

verifyPhoneNumber();
