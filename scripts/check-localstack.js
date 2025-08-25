#!/usr/bin/env node

/**
 * Check LocalStack health and available services
 */

const http = require('http');

async function checkHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:4566/health', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            if (data && data.trim() !== '') {
              const health = JSON.parse(data);
              resolve(health);
            } else {
              // Empty response but 200 status - LocalStack is running
              resolve({ status: 'running', services: {} });
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        } catch (error) {
          // If JSON parse fails but we got 200, LocalStack is probably running
          if (res.statusCode === 200) {
            resolve({ status: 'running', services: {}, note: 'JSON parse failed but service responding' });
          } else {
            reject(error);
          }
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function main() {
  try {
    console.log('🔍 Checking LocalStack health...');
    const health = await checkHealth();
    
    console.log('✅ LocalStack is running!');
    console.log('');
    console.log('📊 Service Status:');
    
    if (health.services) {
      Object.entries(health.services).forEach(([service, status]) => {
        const icon = status === 'available' ? '✅' : '❌';
        console.log(`  ${icon} ${service}: ${status}`);
      });
    } else {
      console.log('  ℹ️  Service details not available');
    }
    
    console.log('');
    console.log('🌐 LocalStack Dashboard: http://localhost:4566');
    
  } catch (error) {
    console.error('❌ LocalStack is not running or not accessible');
    console.error('Error:', error.message);
    console.log('');
    console.log('💡 Try running: npm run setup');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}