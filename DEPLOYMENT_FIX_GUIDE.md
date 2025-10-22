# GCP Deployment Fix Guide

## Issues Fixed

### 1. Architecture Compatibility Issue ✅
**Problem**: `"exec format error"` - Docker image built for wrong architecture
**Solution**: Added `--platform=linux/amd64` to Dockerfile to ensure AMD64 compatibility with GCP Cloud Run

### 2. Port Configuration ✅
**Problem**: Server running on port 5600, but Cloud Run expects port 8080
**Solution**: 
- Updated Dockerfile to expose port 8080
- Set `ENV PORT=8080` in Dockerfile
- Updated default port in env.ts from 3000 to 8080

### 3. Missing Environment Variables ✅
**Problem**: Many environment variables referenced in cloudbuildprod.yaml but not defined in env.ts
**Solution**: Added all missing environment variables to env.ts schema:
- GCP Configuration (GCP_PROJECT_ID, GCP_PROJECT_LOCATION, etc.)
- Email Configuration (GMAIL_*)
- PostgreSQL Configuration (POSTGRES_*)
- PhonePe Configuration (PHONEPE_*)
- Redis Configuration (REDIS_*)
- API Configuration (REDIRECT_URL_*, API_BASE_URL)
- OTP Configuration (OTP_*, RATE_LIMIT_*, BLOCK_DURATION)

### 4. Cloud Build Configuration ✅
**Problem**: Missing substitution variables in cloudbuildprod.yaml
**Solution**: Added all missing substitution variables and fixed environment variable mapping

## Required Environment Variables

Before deploying, ensure these environment variables are set in your GCP project:

### Required Variables:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY=your-firebase-private-key
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
```

### Optional Variables (with defaults):
```bash
NODE_ENV=production
PORT=8080
APP_JWT_SECRET=your-jwt-secret
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
GCP_PROJECT_ID=nivaana
GCP_PROJECT_LOCATION=asia-south1
# ... and many more (see env.ts for complete list)
```

## Deployment Commands

### Option 1: Use the fixed full-deploy command
```bash
npm run full-deploy
```

### Option 2: Manual deployment steps
```bash
# Set GCP project
gcloud config set project nivaana

# Build Docker image with correct architecture
docker build --platform linux/amd64 -t nivaana .

# Tag for GCR
docker tag nivaana gcr.io/nivaana/nivaana

# Push to GCR
docker push gcr.io/nivaana/nivaana

# Deploy to Cloud Run
gcloud run deploy nivaana-dev \
  --image gcr.io/nivaana/nivaana:latest \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --service-account nivaana-dev@nivaana.iam.gserviceaccount.com \
  --execution-environment gen2 \
  --set-env-vars="DATABASE_URL=your-database-url,NODE_ENV=production,PORT=8080"
```

## Testing the Fix

1. **Local Testing**:
   ```bash
   # Build and test locally
   docker build --platform linux/amd64 -t nivaana-test .
   docker run -p 8080:8080 --env-file .env nivaana-test
   ```

2. **GCP Testing**:
   ```bash
   # Deploy and check logs
   npm run full-deploy
   gcloud run services logs read nivaana-dev --region=asia-south1
   ```

## Common Issues and Solutions

### Issue: "Application failed to start"
- **Cause**: Missing required environment variables
- **Solution**: Ensure all required variables are set in GCP Cloud Run environment

### Issue: "Port 8080 not accessible"
- **Cause**: Application not binding to 0.0.0.0
- **Solution**: Already fixed in index.ts (host: '0.0.0.0')

### Issue: "Database connection failed"
- **Cause**: DATABASE_URL not set or incorrect
- **Solution**: Verify DATABASE_URL format and network access

## Next Steps

1. Set all required environment variables in GCP
2. Run `npm run full-deploy`
3. Monitor deployment logs
4. Test the deployed application

The deployment should now work correctly with the architecture compatibility fix and proper environment variable configuration.
