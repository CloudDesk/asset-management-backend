/**
 * Check Twilio account status and available phone numbers
 */

const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = 'ACbec90816980e03561f55ad7974990aa8';
const TWILIO_AUTH_TOKEN = '3ed2c97fd12cbd109383f21e97e00b8d';

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function checkTwilioAccount() {
  console.log('🔍 Checking Twilio Account...');
  console.log('📋 Account SID:', TWILIO_ACCOUNT_SID);
  console.log('=' * 50);

  try {
    // Check account info
    console.log('\n1️⃣ Account Information:');
    const account = await client.api.accounts(TWILIO_ACCOUNT_SID).fetch();
    console.log('✅ Account Status:', account.status);
    console.log('📛 Account Name:', account.friendlyName);
    console.log('💰 Account Type:', account.type);
    console.log('📅 Created:', account.dateCreated);

    // Check balance
    console.log('\n2️⃣ Account Balance:');
    const balance = await client.balance.fetch();
    console.log('💰 Balance:', balance.balance, balance.currency);

    // Check available phone numbers
    console.log('\n3️⃣ Available Phone Numbers:');
    try {
      const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 5 });
      if (phoneNumbers.length > 0) {
        console.log('📱 Available Phone Numbers:');
        phoneNumbers.forEach((number, index) => {
          console.log(`   ${index + 1}. ${number.phoneNumber} (${number.friendlyName || 'No name'})`);
        });
      } else {
        console.log('❌ No phone numbers found in this account');
        console.log('💡 You need to purchase a phone number from Twilio Console');
        console.log('🔗 Visit: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming');
      }
    } catch (phoneError) {
      console.log('❌ Error fetching phone numbers:', phoneError.message);
    }

    // Check if account can send SMS
    console.log('\n4️⃣ SMS Capabilities:');
    try {
      // Try to get messaging services (this will fail if not configured)
      const messagingServices = await client.messaging.v1.services.list({ limit: 1 });
      console.log('✅ Messaging services available:', messagingServices.length > 0);
    } catch (error) {
      console.log('⚠️  Messaging services not configured:', error.message);
    }

    console.log('\n📋 Summary:');
    console.log('- Account Status:', account.status);
    console.log('- Balance:', balance.balance, balance.currency);
    console.log('- Phone Numbers:', phoneNumbers?.length || 0);
    
    if (!phoneNumbers || phoneNumbers.length === 0) {
      console.log('\n🚨 ACTION REQUIRED:');
      console.log('1. Visit Twilio Console: https://console.twilio.com');
      console.log('2. Go to Phone Numbers > Manage > Buy a number');
      console.log('3. Purchase a phone number for SMS sending');
      console.log('4. Update the TWILIO_PHONE_NUMBER in the service');
    }

  } catch (error) {
    console.error('❌ Error checking Twilio account:', error.message);
    console.error('🔍 Error details:', error);
    
    if (error.code === 20003) {
      console.log('\n🚨 AUTHENTICATION ERROR:');
      console.log('- Check your Account SID and Auth Token');
      console.log('- Make sure the credentials are correct');
    }
  }
}

checkTwilioAccount();
