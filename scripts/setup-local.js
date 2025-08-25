#!/usr/bin/env node

/**
 * Enhanced local setup script for ebook publishing platform
 * Includes all LocalStack fixes and improvements
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runCommand(command, options = {}) {
  console.log(`🔄 Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error(error.message);
    return false;
  }
}

function createDirectories() {
  const dirs = [
    'tmp/localstack',
    'backend/dist',
    'frontend/dist',
    'logs'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

function checkDockerRunning() {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error('❌ Docker is not running. Please start Docker Desktop first.');
    return false;
  }
}

async function setupLocal() {
  console.log('🚀 Setting up local development environment...');
  console.log('');
  
  // Check if Docker is running
  if (!checkDockerRunning()) {
    process.exit(1);
  }
  
  // Create necessary directories
  console.log('📁 Creating directories...');
  createDirectories();
  
  // Stop any existing containers
  console.log('🛑 Stopping existing containers...');
  runCommand('docker-compose down', { stdio: 'pipe' });
  
  // Clean up any orphaned containers
  console.log('🧹 Cleaning up...');
  runCommand('docker system prune -f', { stdio: 'pipe' });
  
  // Start LocalStack with improved configuration
  console.log('🐳 Starting LocalStack...');
  if (!runCommand('docker-compose up -d localstack')) {
    console.error('❌ Failed to start LocalStack');
    console.log('💡 Try running: npm run troubleshoot');
    process.exit(1);
  }
  
  // Wait for LocalStack to be ready
  console.log('⏳ Waiting for LocalStack to be ready...');
  if (!runCommand('node scripts/wait-for-localstack.js')) {
    console.error('❌ LocalStack failed to start properly');
    console.log('💡 Try running: npm run troubleshoot');
    process.exit(1);
  }
  
  // Verify LocalStack functionality
  console.log('🧪 Testing LocalStack functionality...');
  if (!runCommand('node scripts/test-localstack.js')) {
    console.error('❌ LocalStack functionality test failed');
    process.exit(1);
  }
  
  // Create DynamoDB table
  console.log('📊 Creating DynamoDB table...');
  if (!runCommand('node scripts/create-table.js')) {
    console.error('❌ Failed to create DynamoDB table');
    process.exit(1);
  }
  
  console.log('');
  console.log('✅ Local development environment is ready!');
  console.log('');
  console.log('🌐 Available services:');
  console.log('  - LocalStack: http://localhost:4566');
  console.log('  - Health check: http://localhost:4566/health');
  console.log('  - DynamoDB Admin: http://localhost:8001 (optional)');
  console.log('');
  console.log('🚀 Next steps:');
  console.log('  1. npm run dev:backend   # Start backend services');
  console.log('  2. npm run dev:frontend  # Start frontend application');
  console.log('  3. npm run seed:data     # Seed mock data (optional)');
  console.log('');
  console.log('📊 Database commands:');
  console.log('  - npm run db:create      # Create DynamoDB table');
  console.log('  - npm run db:setup       # Create table + seed data');
  console.log('  - npm run seed:data      # Seed mock data only');
  console.log('');
  console.log('🔧 Troubleshooting:');
  console.log('  - npm run localstack:health  # Check LocalStack status');
  console.log('  - npm run troubleshoot       # Run diagnostics');
  console.log('  - npm run localstack:logs    # View LocalStack logs');
}

if (require.main === module) {
  setupLocal().catch(error => {
    console.error('❌ Setup failed:', error);
    console.log('💡 Try running: npm run troubleshoot');
    process.exit(1);
  });
}