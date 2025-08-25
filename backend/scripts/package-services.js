#!/usr/bin/env node

/**
 * Package Lambda services for deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVICES = [
  'auth-service',
  'book-service', 
  'user-service',
  'workflow-service',
  'review-service',
  'notification-service'
];

const DIST_DIR = path.join(__dirname, '..', 'dist');

async function packageServices() {
  console.log('📦 Packaging Lambda services...');

  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  for (const service of SERVICES) {
    console.log(`📦 Packaging ${service}...`);
    
    const serviceDir = path.join(DIST_DIR, service);
    const zipFile = path.join(DIST_DIR, `${service}.zip`);

    try {
      // Create service directory
      if (!fs.existsSync(serviceDir)) {
        fs.mkdirSync(serviceDir, { recursive: true });
      }

      // Copy compiled JavaScript files
      const srcFiles = path.join(DIST_DIR, '**/*.js');
      execSync(`cp -r ${srcFiles} ${serviceDir}/`, { stdio: 'inherit' });

      // Copy package.json and install production dependencies
      const packageJson = {
        name: service,
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          'aws-lambda': '^1.0.7',
          'aws-sdk': '^2.1490.0'
        }
      };

      fs.writeFileSync(
        path.join(serviceDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Install production dependencies
      execSync('npm install --production', {
        cwd: serviceDir,
        stdio: 'inherit'
      });

      // Create ZIP file
      execSync(`cd ${serviceDir} && zip -r ../${service}.zip .`, {
        stdio: 'inherit'
      });

      // Clean up temporary directory
      execSync(`rm -rf ${serviceDir}`, { stdio: 'inherit' });

      console.log(`✅ ${service} packaged successfully`);
    } catch (error) {
      console.error(`❌ Error packaging ${service}:`, error.message);
      process.exit(1);
    }
  }

  console.log('✅ All services packaged successfully!');
}

if (require.main === module) {
  packageServices().catch(error => {
    console.error('❌ Packaging failed:', error);
    process.exit(1);
  });
}