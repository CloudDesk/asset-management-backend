const { createClient } = require('redis');

// Load environment variables
require('dotenv').config();

async function testRedisCloud() {
  console.log('🧪 Testing Redis Cloud Connection\n');
  console.log('Configuration:');
  console.log('- Host:', process.env.REDIS_HOST || 'Not set');
  console.log('- Port:', process.env.REDIS_PORT || 'Not set');
  console.log('- Has Password:', !!process.env.REDIS_PASSWORD);
  console.log('- Username:', process.env.REDIS_USERNAME || 'default');
  console.log('- Using URL:', !!process.env.REDIS_URL);
  console.log('\n---\n');

  let client;
  
  try {
    // Create Redis client based on configuration
    if (process.env.REDIS_URL) {
      console.log('1️⃣  Creating client with REDIS_URL...');
      client = createClient({
        url: process.env.REDIS_URL
      });
    } else if (process.env.REDIS_HOST) {
      console.log('1️⃣  Creating client with individual parameters...');
      const config = {
        socket: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379')
        }
      };

      if (process.env.REDIS_PASSWORD) {
        config.username = process.env.REDIS_USERNAME || 'default';
        config.password = process.env.REDIS_PASSWORD;
      }

      client = createClient(config);
    } else {
      console.log('1️⃣  Creating client with default localhost...');
      client = createClient({
        url: 'redis://localhost:6379'
      });
    }

    // Event handlers
    client.on('error', (err) => {
      console.error('❌ Redis Error:', err.message);
    });

    client.on('connect', () => {
      console.log('✅ Connected to Redis');
    });

    client.on('ready', () => {
      console.log('✅ Redis is ready\n');
    });

    // Connect
    console.log('2️⃣  Connecting...');
    await client.connect();
    
    // Test 1: Ping
    console.log('3️⃣  Testing PING...');
    const pong = await client.ping();
    console.log('✅ Ping response:', pong);
    
    // Test 2: Set a key
    console.log('\n4️⃣  Testing SET...');
    const testKey = 'test:connection:' + Date.now();
    await client.set(testKey, 'Hello from Node.js!');
    console.log('✅ Set key:', testKey);
    
    // Test 3: Get the key
    console.log('\n5️⃣  Testing GET...');
    const value = await client.get(testKey);
    console.log('✅ Retrieved value:', value);
    
    // Test 4: Set with expiry (like OTP)
    console.log('\n6️⃣  Testing SETEX (with expiry)...');
    const otpKey = 'test:otp:+918825727948';
    await client.setEx(otpKey, 60, JSON.stringify({
      otp: '123456',
      attempts: 0,
      createdAt: Date.now()
    }));
    console.log('✅ Set OTP key with 60s expiry:', otpKey);
    
    // Test 5: Check TTL
    console.log('\n7️⃣  Testing TTL...');
    const ttl = await client.ttl(otpKey);
    console.log('✅ Time to live:', ttl, 'seconds');
    
    // Test 6: Get OTP data
    console.log('\n8️⃣  Testing GET OTP...');
    const otpData = await client.get(otpKey);
    console.log('✅ OTP data:', JSON.parse(otpData));
    
    // Test 7: Increment (for rate limiting)
    console.log('\n9️⃣  Testing INCR (rate limiting)...');
    const rateKey = 'test:rate:+918825727948';
    const count1 = await client.incr(rateKey);
    const count2 = await client.incr(rateKey);
    const count3 = await client.incr(rateKey);
    console.log('✅ Rate limit counts:', count1, count2, count3);
    await client.expire(rateKey, 900); // 15 minutes
    console.log('✅ Set expiry for rate limit');
    
    // Test 8: Get info
    console.log('\n🔟  Getting Redis Info...');
    const info = await client.info('server');
    const lines = info.split('\r\n');
    const version = lines.find(l => l.startsWith('redis_version:'));
    const mode = lines.find(l => l.startsWith('redis_mode:'));
    console.log('✅', version);
    console.log('✅', mode);
    
    // Clean up
    console.log('\n1️⃣1️⃣  Cleaning up test keys...');
    await client.del(testKey);
    await client.del(otpKey);
    await client.del(rateKey);
    console.log('✅ Test keys deleted');
    
    // Disconnect
    await client.quit();
    console.log('\n✅ Disconnected from Redis');
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 All tests passed!');
    console.log('='.repeat(50));
    console.log('\n✅ Your Redis Cloud connection is working perfectly!');
    console.log('✅ OTP storage will work correctly');
    console.log('✅ Rate limiting will work correctly');
    console.log('\nYou can now start your server: npm run dev');
    
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ Test Failed!');
    console.error('='.repeat(50));
    console.error('\nError:', error.message);
    
    if (error.message.includes('WRONGPASS')) {
      console.error('\n💡 Solution:');
      console.error('   - Check your REDIS_PASSWORD in .env file');
      console.error('   - Get correct password from Redis Cloud dashboard');
      console.error('   - Make sure there are no extra spaces');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
      console.error('\n💡 Solution:');
      console.error('   - Check your REDIS_HOST and REDIS_PORT in .env file');
      console.error('   - Verify endpoint from Redis Cloud dashboard');
      console.error('   - Make sure Redis Cloud instance is active');
    } else if (error.message.includes('NOAUTH')) {
      console.error('\n💡 Solution:');
      console.error('   - Add REDIS_PASSWORD to your .env file');
      console.error('   - Get password from Redis Cloud dashboard');
    }
    
    if (client) {
      try {
        await client.quit();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    
    process.exit(1);
  }
}

testRedisCloud();

