#!/usr/bin/env node

/**
 * Comprehensive test script for frontend-backend integration
 */

const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:3002';

async function runTests() {
  console.log('🧪 Starting Frontend-Backend Integration Tests\n');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Backend Health Check
  console.log('1️⃣ Testing Backend Health...');
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    const data = await response.json();
    
    if (response.ok && data.status === 'healthy') {
      console.log('✅ Backend health check passed');
      testsPassed++;
    } else {
      console.log('❌ Backend health check failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Backend health check failed:', error.message);
    testsFailed++;
  }
  
  // Test 2: CORS Preflight
  console.log('\n2️⃣ Testing CORS Configuration...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    if (response.ok) {
      console.log('✅ CORS preflight passed');
      testsPassed++;
    } else {
      console.log('❌ CORS preflight failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ CORS test failed:', error.message);
    testsFailed++;
  }
  
  // Test 3: User Registration
  console.log('\n3️⃣ Testing User Registration...');
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    role: 'AUTHOR'
  };
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL
      },
      body: JSON.stringify(testUser)
    });
    
    const data = await response.json();
    
    if (response.ok && data.user && data.accessToken) {
      console.log('✅ User registration passed');
      console.log(`   User ID: ${data.user.userId}`);
      testsPassed++;
      
      // Store tokens for next test
      global.testTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      };
      global.testUserId = data.user.userId;
    } else {
      console.log('❌ User registration failed:', data.error?.message || 'Unknown error');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ User registration failed:', error.message);
    testsFailed++;
  }
  
  // Test 4: User Login
  console.log('\n4️⃣ Testing User Login...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.user && data.accessToken) {
      console.log('✅ User login passed');
      console.log(`   Welcome back: ${data.user.firstName} ${data.user.lastName}`);
      testsPassed++;
    } else {
      console.log('❌ User login failed:', data.error?.message || 'Unknown error');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ User login failed:', error.message);
    testsFailed++;
  }
  
  // Test 5: Token Refresh
  console.log('\n5️⃣ Testing Token Refresh...');
  if (global.testTokens?.refreshToken) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': FRONTEND_URL
        },
        body: JSON.stringify({
          refreshToken: global.testTokens.refreshToken
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.accessToken) {
        console.log('✅ Token refresh passed');
        testsPassed++;
      } else {
        console.log('❌ Token refresh failed:', data.error?.message || 'Unknown error');
        testsFailed++;
      }
    } catch (error) {
      console.log('❌ Token refresh failed:', error.message);
      testsFailed++;
    }
  } else {
    console.log('⏭️ Token refresh skipped (no refresh token available)');
  }
  
  // Test 6: Logout
  console.log('\n6️⃣ Testing User Logout...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL
      }
    });
    
    const data = await response.json();
    
    if (response.ok && data.message) {
      console.log('✅ User logout passed');
      testsPassed++;
    } else {
      console.log('❌ User logout failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ User logout failed:', error.message);
    testsFailed++;
  }
  
  // Test Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed! Frontend-Backend integration is working correctly.');
    console.log(`\n🌐 Frontend URL: ${FRONTEND_URL}`);
    console.log(`🔧 Backend URL: ${BACKEND_URL}`);
    console.log('\n✨ You can now test the frontend application in your browser!');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the configuration and try again.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});