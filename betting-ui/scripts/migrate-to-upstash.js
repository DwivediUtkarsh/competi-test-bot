#!/usr/bin/env node

/**
 * Migration script to transition from local Redis to Upstash Redis
 * Run this script to validate the Upstash configuration
 */

const { Redis } = require('@upstash/redis');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function testUpstashConnection() {
  console.log('🔧 Testing Upstash Redis connection...');
  
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('❌ Missing Upstash environment variables:');
    console.error('   - UPSTASH_REDIS_REST_URL');
    console.error('   - UPSTASH_REDIS_REST_TOKEN');
    process.exit(1);
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Test basic operations
    console.log('📝 Testing basic Redis operations...');
    
    const testKey = `migration-test:${Date.now()}`;
    const testValue = { message: 'Hello Upstash!', timestamp: Date.now() };
    
    // Set a value
    await redis.set(testKey, JSON.stringify(testValue), { ex: 60 });
    console.log('✅ SET operation successful');
    
    // Get the value
    const retrieved = await redis.get(testKey);
    let parsedValue;
    
    // Handle both string and object responses from Upstash
    if (typeof retrieved === 'string') {
      parsedValue = JSON.parse(retrieved);
    } else if (typeof retrieved === 'object' && retrieved !== null) {
      parsedValue = retrieved;
    } else {
      throw new Error('Unexpected response type from Redis');
    }
    
    if (parsedValue.message === testValue.message) {
      console.log('✅ GET operation successful');
    } else {
      throw new Error('Retrieved value does not match');
    }
    
    // Test TTL
    const ttl = await redis.ttl(testKey);
    if (ttl > 0) {
      console.log('✅ TTL operation successful');
    }
    
    // Test DELETE
    const deleted = await redis.del(testKey);
    if (deleted > 0) {
      console.log('✅ DELETE operation successful');
    }
    
    // Test advanced operations
    console.log('📝 Testing advanced operations...');
    
    // Test NX (set if not exists)
    const nxResult = await redis.set(`${testKey}-nx`, 'test', { nx: true, ex: 30 });
    if (nxResult === 'OK') {
      console.log('✅ SET NX operation successful');
      await redis.del(`${testKey}-nx`);
    }
    
    // Test XX (set if exists)
    await redis.set(`${testKey}-xx`, 'initial');
    const xxResult = await redis.set(`${testKey}-xx`, 'updated', { xx: true });
    if (xxResult === 'OK') {
      console.log('✅ SET XX operation successful');
      await redis.del(`${testKey}-xx`);
    }
    
    console.log('🎉 All Upstash Redis tests passed!');
    
    // Performance test
    console.log('📊 Running performance test...');
    const start = Date.now();
    const perfKey = `perf-test:${Date.now()}`;
    
    await redis.set(perfKey, 'performance test');
    await redis.get(perfKey);
    await redis.del(perfKey);
    
    const latency = Date.now() - start;
    console.log(`⚡ Latency: ${latency}ms`);
    
    if (latency < 1000) {
      console.log('✅ Performance is good');
    } else {
      console.log('⚠️  High latency detected - check your region configuration');
    }
    
  } catch (error) {
    console.error('❌ Upstash Redis test failed:', error);
    process.exit(1);
  }
}

async function validateEnvironment() {
  console.log('🔍 Validating environment configuration...');
  
  const requiredVars = [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'SESSION_SECRET',
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    return false;
  }
  
  console.log('✅ All required environment variables are set');
  return true;
}

async function main() {
  console.log('🚀 Starting Upstash Redis migration validation...');
  console.log('');
  
  if (!await validateEnvironment()) {
    process.exit(1);
  }
  
  await testUpstashConnection();
  
  console.log('');
  console.log('🎯 Migration validation complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Update your .env.local with your Upstash credentials');
  console.log('2. Test your application with: npm run dev');
  console.log('3. Monitor the health endpoint: http://localhost:3000/api/health');
  console.log('4. Remove old Redis dependencies when ready');
}

if (require.main === module) {
  main().catch(console.error);
} 