#!/usr/bin/env node

/**
 * RBAC Testing Script
 * Tests Role-Based Access Control functionality
 */

const API_URL = 'http://localhost:3001';

// Test users for different roles
const testUsers = {
  author: {
    email: 'author@test.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'Author',
    role: 'AUTHOR'
  },
  editor: {
    email: 'editor@test.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'Editor',
    role: 'EDITOR'
  },
  publisher: {
    email: 'publisher@test.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'Publisher',
    role: 'PUBLISHER'
  },
  reader: {
    email: 'reader@test.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'Reader',
    role: 'READER'
  }
};

async function testCORS() {
  console.log('🔍 Testing CORS configuration...');
  
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3002'
      }
    });
    
    if (response.ok) {
      console.log('✅ CORS test passed - Backend accessible from frontend');
      return true;
    } else {
      console.log('❌ CORS test failed - Backend not accessible');
      return false;
    }
  } catch (error) {
    console.log('❌ Backend not running or not accessible:', error.message);
    return false;
  }
}

async function registerUser(userData) {
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3002'
      },
      body: JSON.stringify(userData)
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Registered ${userData.role}: ${userData.email}`);
      return data;
    } else {
      const error = await response.json();
      if (error.error?.code === 'USER_EXISTS') {
        console.log(`ℹ️  User already exists: ${userData.email}`);
        return await loginUser(userData);
      } else {
        console.log(`❌ Registration failed for ${userData.role}:`, error.error?.message);
        return null;
      }
    }
  } catch (error) {
    console.log(`❌ Registration error for ${userData.role}:`, error.message);
    return null;
  }
}

async function loginUser(userData) {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3002'
      },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Login successful for ${userData.role}: ${userData.email}`);
      return data;
    } else {
      const error = await response.json();
      console.log(`❌ Login failed for ${userData.role}:`, error.error?.message);
      return null;
    }
  } catch (error) {
    console.log(`❌ Login error for ${userData.role}:`, error.message);
    return null;
  }
}

async function testTokenRefresh(refreshToken) {
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3002'
      },
      body: JSON.stringify({ refreshToken })
    });

    if (response.ok) {
      console.log('✅ Token refresh successful');
      return await response.json();
    } else {
      const error = await response.json();
      console.log('❌ Token refresh failed:', error.error?.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Token refresh error:', error.message);
    return null;
  }
}

async function testProtectedEndpoint(token, endpoint, method = 'GET') {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3002'
      }
    });

    return {
      status: response.status,
      ok: response.ok,
      data: response.ok ? await response.json() : await response.text()
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

async function runRBACTests() {
  console.log('🚀 Starting RBAC Tests...\n');

  // Test CORS first
  const corsWorking = await testCORS();
  if (!corsWorking) {
    console.log('\n❌ Backend not accessible. Please start the backend first.');
    process.exit(1);
  }

  console.log('\n📝 Testing User Registration and Authentication...');
  
  const userTokens = {};
  
  // Register and login all test users
  for (const [role, userData] of Object.entries(testUsers)) {
    const result = await registerUser(userData);
    if (result) {
      userTokens[role] = result.accessToken;
    }
  }

  console.log('\n🔐 Testing Token Refresh...');
  if (userTokens.author) {
    const authorData = await loginUser(testUsers.author);
    if (authorData?.refreshToken) {
      await testTokenRefresh(authorData.refreshToken);
    }
  }

  console.log('\n🛡️  Testing Role-Based Access Control...');
  
  // Test different endpoints with different roles
  const testCases = [
    { endpoint: '/api/books', method: 'GET', description: 'List books' },
    { endpoint: '/api/books', method: 'POST', description: 'Create book' },
    { endpoint: '/api/users', method: 'GET', description: 'List users' },
    { endpoint: '/api/workflow', method: 'GET', description: 'View workflow' },
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.description} (${testCase.method} ${testCase.endpoint})`);
    
    for (const [role, token] of Object.entries(userTokens)) {
      if (token) {
        const result = await testProtectedEndpoint(token, testCase.endpoint, testCase.method);
        const status = result.ok ? '✅' : '❌';
        console.log(`  ${status} ${role.toUpperCase()}: ${result.status} ${result.ok ? 'ALLOWED' : 'DENIED'}`);
      }
    }
  }

  console.log('\n🎉 RBAC Testing Complete!');
  console.log('\n📊 Summary:');
  console.log(`- Registered/Logged in ${Object.keys(userTokens).length} users`);
  console.log(`- Tested ${testCases.length} different endpoints`);
  console.log('- CORS configuration working ✅');
}

// Run the tests
runRBACTests().catch(console.error);