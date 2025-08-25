#!/usr/bin/env node

/**
 * Troubleshoot LocalStack issues
 */

const { execSync } = require('child_process');
const http = require('http');

async function checkDockerStatus() {
  console.log('🐳 Checking Docker status...');
  
  try {
    const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Docker: ${dockerVersion}`);
    
    const dockerComposeVersion = execSync('docker-compose --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Docker Compose: ${dockerComposeVersion}`);
  } catch (error) {
    console.log(`❌ Docker not available: ${error.message}`);
    return false;
  }
  
  return true;
}

async function checkContainerStatus() {
  console.log('\n📦 Checking container status...');
  
  try {
    const containers = execSync('docker ps -a --filter "name=ebook-platform" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"', { 
      encoding: 'utf8' 
    });
    console.log(containers);
    
    // Check if LocalStack container exists
    const localstackStatus = execSync('docker ps -a --filter "name=ebook-platform-localstack" --format "{{.Status}}"', { 
      encoding: 'utf8' 
    }).trim();
    
    if (!localstackStatus) {
      console.log('❌ LocalStack container not found');
      return false;
    }
    
    console.log(`📊 LocalStack status: ${localstackStatus}`);
    return localstackStatus.includes('Up');
  } catch (error) {
    console.log(`❌ Container check failed: ${error.message}`);
    return false;
  }
}

async function checkLocalStackHealth() {
  console.log('\n🏥 Checking LocalStack health...');
  
  return new Promise((resolve) => {
    const req = http.get('http://localhost:4566/health', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          console.log('✅ LocalStack health response:', JSON.stringify(health, null, 2));
          resolve(true);
        } catch (error) {
          console.log(`❌ Health check parse error: ${error.message}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`❌ Health check connection error: ${error.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('❌ Health check timeout');
      req.destroy();
      resolve(false);
    });
  });
}

async function showContainerLogs() {
  console.log('\n📋 Recent LocalStack logs:');
  
  try {
    const logs = execSync('docker logs --tail 20 ebook-platform-localstack', { 
      encoding: 'utf8' 
    });
    console.log(logs);
  } catch (error) {
    console.log(`❌ Could not get logs: ${error.message}`);
  }
}

async function suggestFixes() {
  console.log('\n💡 Suggested fixes:');
  console.log('1. Restart LocalStack:');
  console.log('   docker-compose down && docker-compose up -d');
  console.log('');
  console.log('2. Clean restart:');
  console.log('   docker-compose down -v && docker-compose up -d');
  console.log('');
  console.log('3. Check available memory:');
  console.log('   docker system df');
  console.log('');
  console.log('4. View full logs:');
  console.log('   docker-compose logs -f localstack');
  console.log('');
  console.log('5. Update LocalStack:');
  console.log('   docker-compose pull localstack');
}

async function troubleshoot() {
  console.log('🔍 LocalStack Troubleshooting Tool\n');
  
  const dockerOk = await checkDockerStatus();
  if (!dockerOk) {
    console.log('\n❌ Docker is not available. Please install Docker first.');
    return;
  }
  
  const containerRunning = await checkContainerStatus();
  if (!containerRunning) {
    console.log('\n❌ LocalStack container is not running.');
    await suggestFixes();
    return;
  }
  
  const healthOk = await checkLocalStackHealth();
  if (!healthOk) {
    console.log('\n❌ LocalStack is not responding to health checks.');
    await showContainerLogs();
    await suggestFixes();
    return;
  }
  
  console.log('\n✅ LocalStack appears to be running correctly!');
  console.log('🌐 LocalStack Dashboard: http://localhost:4566');
  console.log('🗄️  DynamoDB Admin: http://localhost:8001');
}

if (require.main === module) {
  troubleshoot().catch(error => {
    console.error('❌ Troubleshooting failed:', error);
    process.exit(1);
  });
}