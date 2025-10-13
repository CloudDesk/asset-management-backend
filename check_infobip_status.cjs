/**
 * Check Infobip account status and configuration
 */

const https = require('https');

const INFOBIP_API_KEY = 'App b87f14fb04a90291e48aee9c8d90ad98-edc7eee8-aa49-4917-b50f-3f3b45020ef7';
const INFOBIP_BASE_URL = 'ypnlnd.api.infobip.com';

// Check account balance
function checkAccountBalance() {
  console.log('🔍 Checking Infobip account balance...');
  
  const options = {
    hostname: INFOBIP_BASE_URL,
    path: '/account/1/balance',
    method: 'GET',
    headers: {
      'Authorization': INFOBIP_API_KEY,
      'Accept': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('📊 Account Balance Response:');
      try {
        const response = JSON.parse(data);
        console.log(JSON.stringify(response, null, 2));
      } catch (error) {
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error checking balance:', error.message);
  });

  req.end();
}

// Check SMS logs
function checkSmsLogs() {
  console.log('\n🔍 Checking recent SMS logs...');
  
  const options = {
    hostname: INFOBIP_BASE_URL,
    path: '/sms/2/logs?limit=5',
    method: 'GET',
    headers: {
      'Authorization': INFOBIP_API_KEY,
      'Accept': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('📊 SMS Logs Response:');
      try {
        const response = JSON.parse(data);
        console.log(JSON.stringify(response, null, 2));
      } catch (error) {
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error checking logs:', error.message);
  });

  req.end();
}

// Run checks
checkAccountBalance();
setTimeout(checkSmsLogs, 2000);
