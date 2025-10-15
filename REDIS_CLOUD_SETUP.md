# 🔴 Redis Cloud Configuration Guide

## 📋 Your Redis Cloud Endpoint

You have a Redis Cloud connection string:
```
redis-******.*****.asia-south1-1.gce.******.redis-cloud.com:*******
```

## ⚙️ Configuration Options

You have **2 ways** to configure Redis Cloud connection:

### Option 1: Using Individual Parameters (Recommended)

Add to your `.env` file:

```bash
# Redis Cloud Configuration
REDIS_HOST=redis-******.*****.asia-south1-1.gce.******.redis-cloud.com
REDIS_PORT=*******
REDIS_PASSWORD=your_redis_password_here
REDIS_USERNAME=default

# Optional - Remove or comment out REDIS_URL
# REDIS_URL=
```

**Replace:**
- `REDIS_HOST`: Your Redis Cloud hostname (the part before the colon)
- `REDIS_PORT`: Your Redis Cloud port number (the part after the colon)
- `REDIS_PASSWORD`: Your Redis Cloud password (get from Redis Cloud dashboard)
- `REDIS_USERNAME`: Usually `default` (check Redis Cloud dashboard)

### Option 2: Using Connection URL

Add to your `.env` file:

```bash
# Redis Cloud Connection URL
REDIS_URL=redis://default:your_password_here@redis-******.*****.asia-south1-1.gce.******.redis-cloud.com:*******

# Comment out individual parameters if using URL
# REDIS_HOST=
# REDIS_PORT=
# REDIS_PASSWORD=
```

**Format:**
```
redis://[username]:[password]@[host]:[port]
```

**Replace:**
- `your_password_here`: Your Redis Cloud password
- Full hostname and port from your endpoint

---

## 🔑 Finding Your Redis Cloud Credentials

### Step 1: Log in to Redis Cloud
Go to: https://app.redislabs.com/

### Step 2: Select Your Database
Click on your database name

### Step 3: Get Connection Details
You'll see:
- **Public endpoint:** `redis-******.*****.asia-south1-1.gce.******.redis-cloud.com:*******`
- **Default user password:** Click "eye" icon to reveal

### Step 4: Copy Password
Copy the password and add it to your `.env` file

---

## 📝 Example Configuration

### Example 1: Individual Parameters
```bash
# .env file
REDIS_HOST=redis-12345.c123.asia-south1-1.gce.cloud.redislabs.com
REDIS_PORT=12345
REDIS_PASSWORD=mySecurePassword123
REDIS_USERNAME=default

# Other configurations
OTP_EXPIRY_SECONDS=60
OTP_MAX_ATTEMPTS=3
```

### Example 2: Connection URL
```bash
# .env file
REDIS_URL=redis://default:mySecurePassword123@redis-12345.c123.asia-south1-1.gce.cloud.redislabs.com:12345

# Other configurations
OTP_EXPIRY_SECONDS=60
OTP_MAX_ATTEMPTS=3
```

---

## 🧪 Test Your Connection

### Method 1: Using redis-cli
```bash
# Install redis-cli if not installed
brew install redis

# Test connection
redis-cli -h redis-******.*****.asia-south1-1.gce.******.redis-cloud.com \
  -p ******* \
  -a your_password_here \
  ping

# Should return: PONG
```

### Method 2: Using Node.js Test Script

Create `test_redis_cloud.cjs`:

```javascript
const { createClient } = require('redis');

async function testRedisCloud() {
  const client = createClient({
    socket: {
      host: 'redis-******.*****.asia-south1-1.gce.******.redis-cloud.com',
      port: *******
    },
    username: 'default',
    password: 'your_password_here'
  });

  client.on('error', (err) => console.error('Redis Error:', err));
  client.on('connect', () => console.log('✅ Connected to Redis Cloud'));
  client.on('ready', () => console.log('✅ Redis Cloud is ready'));

  try {
    await client.connect();
    
    // Test ping
    const pong = await client.ping();
    console.log('✅ Ping response:', pong);
    
    // Test set/get
    await client.set('test_key', 'Hello from Redis Cloud!');
    const value = await client.get('test_key');
    console.log('✅ Test value:', value);
    
    // Clean up
    await client.del('test_key');
    
    await client.quit();
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testRedisCloud();
```

Run it:
```bash
node test_redis_cloud.cjs
```

Expected output:
```
✅ Connected to Redis Cloud
✅ Redis Cloud is ready
✅ Ping response: PONG
✅ Test value: Hello from Redis Cloud!
✅ All tests passed!
```

---

## 🚀 Start Your Server

After configuring `.env`, start your server:

```bash
npm run dev
```

You should see:
```
🔌 Connecting to Redis...
✅ Redis connected successfully
🚀 Server running at http://localhost:5600
```

---

## 🔍 Verify OTP System Works

### Test 1: Send OTP
```bash
curl -X POST http://localhost:5600/v1/sms/send-otp-with-storage \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948"}'
```

### Test 2: Check Redis Cloud Dashboard
Go to your Redis Cloud dashboard and check:
- **Commands/sec**: Should show activity
- **Connected clients**: Should show 1 connection
- **Keys**: Should see `otp:+918825727948`

### Test 3: Verify OTP
```bash
curl -X POST http://localhost:5600/v1/sms/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber": "8825727948", "otp": "123456"}'
```

---

## ⚠️ Troubleshooting

### Error: WRONGPASS invalid username-password pair
**Problem:** Incorrect password

**Solution:**
1. Go to Redis Cloud dashboard
2. Click on your database
3. Click "eye" icon to reveal password
4. Copy exact password (no extra spaces)
5. Update `.env` file

### Error: Connection timeout
**Problem:** Incorrect hostname or port

**Solution:**
1. Verify hostname and port from Redis Cloud dashboard
2. Make sure endpoint is the **Public endpoint**
3. Check firewall/network settings

### Error: NOAUTH Authentication required
**Problem:** Password not provided

**Solution:**
Add `REDIS_PASSWORD` to your `.env` file

### Error: Redis connection failed
**Problem:** Redis Cloud not accessible

**Solution:**
1. Check if Redis Cloud instance is active
2. Verify your subscription is active
3. Test with redis-cli first

---

## 🔒 Security Best Practices

### 1. Keep Password Secret
- ❌ Never commit `.env` to git
- ✅ Add `.env` to `.gitignore`
- ✅ Use environment variables in production

### 2. Use Strong Passwords
- ✅ Redis Cloud generates strong passwords
- ❌ Don't change to weak passwords

### 3. Connection Security
- ✅ Redis Cloud uses TLS by default
- ✅ Always use encrypted connections
- ❌ Never expose credentials in logs

### 4. Access Control
- ✅ Use IP whitelisting if available
- ✅ Limit access to specific IPs
- ✅ Monitor access logs

---

## 📊 Redis Cloud Features

### Free Tier (30MB)
- ✅ Perfect for OTP verification
- ✅ Stores ~100,000 OTP records
- ✅ High availability
- ✅ Automatic backups

### Monitoring
- View metrics in Redis Cloud dashboard
- Track commands/sec
- Monitor memory usage
- Check connected clients

### Data Persistence
- ✅ Automatic persistence enabled
- ✅ No data loss on restart
- ✅ Daily backups

---

## 🎯 Recommended Configuration

For **production** with Redis Cloud:

```bash
# .env (Production)
# Redis Cloud
REDIS_HOST=redis-******.*****.asia-south1-1.gce.******.redis-cloud.com
REDIS_PORT=*******
REDIS_PASSWORD=your_secure_password
REDIS_USERNAME=default

# OTP Settings
OTP_EXPIRY_SECONDS=60
OTP_MAX_ATTEMPTS=3
RATE_LIMIT_SEND_MAX=3
RATE_LIMIT_SEND_WINDOW=900
RATE_LIMIT_VERIFY_MAX=5
RATE_LIMIT_VERIFY_WINDOW=3600
BLOCK_DURATION=3600

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Server
PORT=5600
NODE_ENV=production
```

---

## 📞 Support

### Redis Cloud Support
- Dashboard: https://app.redislabs.com/
- Docs: https://docs.redis.com/latest/rc/
- Support: https://redis.com/company/support/

### Your OTP System Docs
- [Implementation Plan](./OTP_VERIFICATION_IMPLEMENTATION_PLAN.md)
- [Testing Guide](./OTP_TESTING_GUIDE.md)
- [Quick Reference](./OTP_QUICK_REFERENCE.md)

---

## ✅ Checklist

Before going live:

- [ ] Redis Cloud credentials configured in `.env`
- [ ] Test connection with redis-cli
- [ ] Test connection with Node.js
- [ ] Start server successfully
- [ ] Send OTP successfully
- [ ] Verify data in Redis Cloud dashboard
- [ ] Verify OTP successfully
- [ ] Check rate limiting works
- [ ] Monitor Redis Cloud metrics
- [ ] Configure alerts in Redis Cloud

---

**Your Redis Cloud is ready to use!** 🎉

Just update your `.env` file with the credentials and restart your server.

