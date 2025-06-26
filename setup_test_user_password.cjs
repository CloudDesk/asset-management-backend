#!/usr/bin/env node

/**
 * Setup Test User Password
 * This script updates a user's password for testing mobile authentication
 */

const BASE_URL = 'http://localhost:5600';

async function setupTestPassword() {
  console.log('🔧 Setting up test password for mobile authentication testing...\n');
  
  // We'll update the user with mobile number 9344715431 to have password 'test123'
  const testUserId = 4; // Based on the earlier curl results
  const testPassword = 'test123';
  
  try {
    console.log('📝 Updating user password...');
    const response = await fetch(`${BASE_URL}/v1/users/${testUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userpassword: testPassword
      })
    });
    
    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      console.log('✅ Test password setup completed successfully!');
      console.log(`   User ID: ${testUserId}`);
      console.log(`   Mobile: 9344715431`);
      console.log(`   Password: ${testPassword}`);
      console.log(`   \nYou can now test mobile authentication with these credentials.`);
    } else {
      console.error('❌ Failed to setup test password:', data.message);
    }
    
  } catch (error) {
    console.error('❌ Error setting up test password:', error.message);
  }
}

// Run the setup
setupTestPassword(); 