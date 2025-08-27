#!/usr/bin/env node

// Simple Node.js script to test API integration
const axios = require('axios');

const API_BASE_URL = 'http://localhost:4566/restapis/bk4bjp76p0/local/_user_request_';

async function testIntegration() {
  console.log('🚀 Testing LocalStack API Integration...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing auth service health...');
    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/api/auth/health`);
      console.log('✅ Auth service health:', healthResponse.data);
    } catch (error) {
      console.log('❌ Auth health check failed:', error.response?.data || error.message);
    }

    // Test 2: Login
    console.log('\n2. Testing login...');
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: 'author@test.com',
        password: 'password123'
      });
      console.log('✅ Login successful:', {
        hasToken: !!loginResponse.data.accessToken,
        user: loginResponse.data.user?.email,
        role: loginResponse.data.user?.role
      });

      const token = loginResponse.data.accessToken;

      // Test 3: Books API
      console.log('\n3. Testing books API...');
      try {
        const booksResponse = await axios.get(`${API_BASE_URL}/api/books`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Books API working:', {
          booksCount: booksResponse.data.books?.length || 0,
          hasMore: booksResponse.data.hasMore
        });
      } catch (error) {
        console.log('❌ Books API failed:', error.response?.data || error.message);
      }

    } catch (error) {
      console.log('❌ Login failed:', error.response?.data || error.message);
    }

    console.log('\n🎉 Integration test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testIntegration();