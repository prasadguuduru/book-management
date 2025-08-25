#!/usr/bin/env node

/**
 * Install dependencies with proper resolution
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function installDependencies() {
  console.log('📦 Installing dependencies...');

  try {
    // Clean any existing node_modules and lock files
    console.log('🧹 Cleaning existing installations...');
    
    const pathsToClean = [
      'node_modules',
      'package-lock.json',
      'backend/node_modules',
      'backend/package-lock.json',
      'frontend/node_modules',
      'frontend/package-lock.json'
    ];

    pathsToClean.forEach(p => {
      if (fs.existsSync(p)) {
        execSync(`rm -rf ${p}`, { stdio: 'inherit' });
      }
    });

    // Install root dependencies first
    console.log('📦 Installing root dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    // Install backend dependencies
    console.log('📦 Installing backend dependencies...');
    execSync('npm install --workspace=backend', { stdio: 'inherit' });

    // Install frontend dependencies with legacy peer deps to resolve conflicts
    console.log('📦 Installing frontend dependencies...');
    execSync('npm install --workspace=frontend --legacy-peer-deps', { stdio: 'inherit' });

    console.log('✅ All dependencies installed successfully!');
    console.log('🚀 You can now run: npm run setup');

  } catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
    console.log('\n💡 Try running: npm install --legacy-peer-deps');
    process.exit(1);
  }
}

if (require.main === module) {
  installDependencies();
}