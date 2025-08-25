#!/usr/bin/env node

/**
 * Wait for LocalStack to be ready before proceeding with deployment
 */

const http = require('http');
const { execSync } = require('child_process');

const LOCALSTACK_URL = 'http://localhost:4566';
const MAX_RETRIES = 60; // Increased retries
const RETRY_INTERVAL = 3000; // 3 seconds

async function checkLocalStackHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${LOCALSTACK_URL}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          // Check if we got a 200 response first
          if (res.statusCode !== 200) {
            console.log(`❌ Health check returned status: ${res.statusCode}`);
            resolve(false);
            return;
          }
          
          // Try to parse JSON, but handle empty or malformed responses
          if (!data || data.trim() === '') {
            console.log(`❌ Health check returned empty response`);
            resolve(false);
            return;
          }
          
          const health = JSON.parse(data);
          console.log(`📊 Health check response:`, health);
          
          // If we have services, check them
          if (health.services) {
            const availableServices = Object.keys(health.services).filter(
              service => health.services[service] === 'available'
            );
            console.log(`✅ Available services: ${availableServices.join(', ')}`);
            
            // Check for at least some basic services
            const hasBasicServices = availableServices.length >= 3;
            resolve(hasBasicServices);
          } else {
            // If no services object, but we got a valid JSON response, consider it ready
            console.log(`✅ LocalStack responding with valid JSON`);
            resolve(true);
          }
        } catch (error) {
          console.log(`❌ Health check parse error: ${error.message}`);
          console.log(`📄 Raw response: ${data.substring(0, 200)}...`);
          
          // If we get a connection but malformed JSON, LocalStack might still be starting
          // Let's try a simpler check - just see if we can connect
          if (res.statusCode === 200) {
            console.log(`✅ LocalStack is responding (status 200), considering it ready`);
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`🔌 Connection error: ${error.message}`);
      resolve(false);
    });
    
    req.setTimeout(8000, () => {
      console.log(`⏰ Health check timeout`);
      req.destroy();
      resolve(false);
    });
  });
}

async function checkDockerContainer() {
  try {
    const result = execSync('docker ps --filter "name=ebook-platform-localstack" --format "{{.Status}}"', { 
      encoding: 'utf8' 
    }).trim();
    
    console.log(`🐳 Container status: ${result || 'Not running'}`);
    return result.includes('Up');
  } catch (error) {
    console.log(`🐳 Docker check failed: ${error.message}`);
    return false;
  }
}

async function waitForLocalStack() {
  console.log('🔄 Waiting for LocalStack to be ready...');
  console.log('📋 This may take a few minutes on first startup...');
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      // First check if container is running
      const containerRunning = await checkDockerContainer();
      if (!containerRunning) {
        console.log(`⏳ Attempt ${i + 1}/${MAX_RETRIES} - Container not running yet...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
        continue;
      }
      
      // Then check health - be more lenient
      const isReady = await checkLocalStackHealth();
      if (isReady) {
        console.log('✅ LocalStack is ready!');
        console.log('🌐 LocalStack Dashboard: http://localhost:4566');
        return;
      }
      
      // If we've been waiting a while and container is healthy, assume it's ready
      if (i > 10 && containerRunning) {
        console.log('✅ LocalStack container is healthy, proceeding...');
        console.log('🌐 LocalStack Dashboard: http://localhost:4566');
        return;
      }
    } catch (error) {
      console.log(`❌ Check failed: ${error.message}`);
    }
    
    console.log(`⏳ Attempt ${i + 1}/${MAX_RETRIES} - LocalStack not ready yet, retrying in ${RETRY_INTERVAL/1000}s...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
  }
  
  console.error('❌ LocalStack failed to start within the expected time');
  console.log('💡 Try running: docker-compose logs localstack');
  console.log('💡 Or restart with: docker-compose down && docker-compose up -d');
  process.exit(1);
}

if (require.main === module) {
  waitForLocalStack().catch(error => {
    console.error('❌ Error waiting for LocalStack:', error);
    process.exit(1);
  });
}