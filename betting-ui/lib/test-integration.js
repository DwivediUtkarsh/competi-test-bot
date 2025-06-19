/**
 * Test script to verify session API integration
 * Run with: node lib/test-integration.js
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function testSessionIntegration() {
  console.log('🧪 Testing Session API Integration...\n');

  try {
    // Test 1: Create a session
    console.log('1️⃣ Testing session creation...');
    const createResponse = await axios.post(`${BASE_URL}/api/session/create`, {
      userId: '123456789012345678',
      marketId: 'test-market-123',
      discordUser: { id: '123456789012345678', username: 'testuser' },
      guildName: 'Test Guild'
    });

    if (createResponse.data.success) {
      console.log('✅ Session created successfully');
      console.log(`   Token: ${createResponse.data.token.substring(0, 20)}...`);
      console.log(`   JTI: ${createResponse.data.data.jti}`);
      
      const token = createResponse.data.token;

      // Test 2: Check session status
      console.log('\n2️⃣ Testing session status check...');
      const statusResponse = await axios.get(`${BASE_URL}/api/session/status/${token}`);
      
      if (statusResponse.data.success) {
        console.log('✅ Session status check successful');
        console.log(`   Status: ${statusResponse.data.data.status}`);
        console.log(`   TTL: ${statusResponse.data.data.ttl} seconds`);
      } else {
        console.log('❌ Session status check failed');
      }

      // Test 3: Validate and consume session
      console.log('\n3️⃣ Testing session validation (will consume)...');
      const validateResponse = await axios.get(`${BASE_URL}/api/session/validate/${token}`);
      
      if (validateResponse.data.success && validateResponse.data.valid) {
        console.log('✅ Session validation successful');
        console.log(`   User ID: ${validateResponse.data.data.userId}`);
        console.log(`   Market ID: ${validateResponse.data.data.marketId}`);
      } else {
        console.log('❌ Session validation failed');
      }

      // Test 4: Try to validate again (should fail - single use)
      console.log('\n4️⃣ Testing single-use enforcement...');
      try {
        const revalidateResponse = await axios.get(`${BASE_URL}/api/session/validate/${token}`);
        if (revalidateResponse.data.success) {
          console.log('❌ ERROR: Session was used twice (should fail)');
        }
      } catch (error) {
        if (error.response?.status === 401) {
          console.log('✅ Single-use enforcement working correctly');
        } else {
          console.log(`❌ Unexpected error: ${error.message}`);
        }
      }

    } else {
      console.log('❌ Session creation failed');
      console.log(createResponse.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }

  console.log('\n🏁 Integration test completed!');
}

// Run the test
testSessionIntegration(); 