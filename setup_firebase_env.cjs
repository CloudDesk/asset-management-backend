#!/usr/bin/env node
/**
 * Firebase Environment Setup Script
 * 
 * This script reads your Firebase service account JSON and updates/creates
 * the .env file with the necessary Firebase credentials.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// Read Firebase service account JSON
const firebaseJsonPath = path.join(__dirname, 'docblitz-437213-firebase-adminsdk-f22m7-ca8f4ecf76.json');

if (!fs.existsSync(firebaseJsonPath)) {
  log(colors.red, '✗ Firebase service account JSON not found!');
  log(colors.yellow, 'Expected location:', firebaseJsonPath);
  process.exit(1);
}

log(colors.blue, '📄 Reading Firebase service account JSON...');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));

// Extract Firebase credentials
const FIREBASE_PROJECT_ID = firebaseConfig.project_id;
const FIREBASE_CLIENT_EMAIL = firebaseConfig.client_email;
const FIREBASE_PRIVATE_KEY = firebaseConfig.private_key;

log(colors.green, '✓ Firebase credentials loaded');
log(colors.blue, `  Project ID: ${FIREBASE_PROJECT_ID}`);
log(colors.blue, `  Client Email: ${FIREBASE_CLIENT_EMAIL}`);

// Generate JWT secret if not exists
let APP_JWT_SECRET = crypto.randomBytes(32).toString('hex');
log(colors.green, '✓ Generated new JWT secret');

// Read existing .env file or create template
const envPath = path.join(__dirname, '.env');
let envContent = '';
let envExists = false;

if (fs.existsSync(envPath)) {
  envExists = true;
  envContent = fs.readFileSync(envPath, 'utf8');
  log(colors.yellow, '⚠ .env file exists - will update Firebase credentials');
  
  // Check if JWT secret already exists
  const jwtMatch = envContent.match(/APP_JWT_SECRET=(.+)/);
  if (jwtMatch && jwtMatch[1]) {
    APP_JWT_SECRET = jwtMatch[1].trim();
    log(colors.blue, '  Using existing JWT secret');
  }
} else {
  log(colors.blue, 'ℹ Creating new .env file...');
}

// Function to update or add environment variable
function updateEnvVar(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const newLine = `${key}=${value}`;
  
  if (regex.test(content)) {
    // Update existing
    return content.replace(regex, newLine);
  } else {
    // Add new (in Firebase section if it exists, otherwise at the end)
    const firebaseSection = content.indexOf('# Firebase Configuration');
    if (firebaseSection !== -1) {
      // Find the end of Firebase section (next # or end of file)
      const nextSection = content.indexOf('\n#', firebaseSection + 1);
      const insertPos = nextSection !== -1 ? nextSection : content.length;
      return content.slice(0, insertPos) + newLine + '\n' + content.slice(insertPos);
    } else {
      // Add Firebase section at the end
      if (!content.endsWith('\n')) content += '\n';
      content += '\n# Firebase Configuration (for Phone OTP Authentication)\n';
      content += newLine + '\n';
      return content;
    }
  }
}

// Update Firebase credentials
envContent = updateEnvVar(envContent, 'FIREBASE_PROJECT_ID', FIREBASE_PROJECT_ID);
envContent = updateEnvVar(envContent, 'FIREBASE_CLIENT_EMAIL', FIREBASE_CLIENT_EMAIL);
envContent = updateEnvVar(envContent, 'FIREBASE_PRIVATE_KEY', `"${FIREBASE_PRIVATE_KEY}"`);
envContent = updateEnvVar(envContent, 'APP_JWT_SECRET', APP_JWT_SECRET);

// Write back to .env
try {
  fs.writeFileSync(envPath, envContent, 'utf8');
  log(colors.green, colors.bold, '\n✓ Environment configuration updated successfully!\n');
  
  log(colors.blue, 'Firebase credentials configured:');
  log(colors.blue, `  ✓ FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}`);
  log(colors.blue, `  ✓ FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}`);
  log(colors.blue, `  ✓ FIREBASE_PRIVATE_KEY (configured)`);
  log(colors.blue, `  ✓ APP_JWT_SECRET (configured)`);
  
  log(colors.yellow, '\n⚠ Next steps:');
  log(colors.yellow, '  1. Restart your server: npm run dev');
  log(colors.yellow, '  2. Test the endpoints: node test_firebase_otp.cjs');
  log(colors.yellow, '  3. Check Swagger docs: http://localhost:5600/docs');
  
  log(colors.green, '\n🎉 Firebase OTP is ready to use!\n');
  
} catch (error) {
  log(colors.red, '✗ Error writing .env file:', error.message);
  log(colors.yellow, '\nManually add these to your .env file:');
  console.log(`
FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}
FIREBASE_PRIVATE_KEY="${FIREBASE_PRIVATE_KEY}"
APP_JWT_SECRET=${APP_JWT_SECRET}
  `);
  process.exit(1);
}


