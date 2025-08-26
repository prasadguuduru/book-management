#!/usr/bin/env node

/**
 * Package Lambda services for deployment
 * Creates individual ZIP files for each Lambda function with proper dependencies
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
const SRC_DIR = path.join(__dirname, '..', 'src');

// Lambda handler template for each service
const createLambdaHandler = (serviceName) => `
const { app } = require('./index');
const serverless = require('serverless-http');

// Create serverless handler
const handler = serverless(app, {
  binary: ['image/*', 'application/octet-stream'],
  request: (request, event, context) => {
    // Add Lambda context to request
    request.lambda = { event, context };
    request.requestId = context.awsRequestId;
  }
});

module.exports = { handler };
`;

async function packageServices() {
  console.log('📦 Packaging Lambda services for deployment...');

  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Check if TypeScript compilation was successful
  const indexPath = path.join(DIST_DIR, 'index.js');
  if (!fs.existsSync(indexPath)) {
    console.error('❌ TypeScript compilation required. Run "npm run build" first.');
    process.exit(1);
  }

  for (const service of SERVICES) {
    console.log(`📦 Packaging ${service}...`);
    
    const serviceDir = path.join(DIST_DIR, service);
    const zipFile = path.join(DIST_DIR, `${service}.zip`);

    try {
      // Clean up existing service directory and zip
      if (fs.existsSync(serviceDir)) {
        execSync(`rm -rf ${serviceDir}`, { stdio: 'pipe' });
      }
      if (fs.existsSync(zipFile)) {
        fs.unlinkSync(zipFile);
      }

      // Create service directory
      fs.mkdirSync(serviceDir, { recursive: true });

      // Copy all compiled JavaScript files
      console.log(`  📁 Copying compiled files for ${service}...`);
      execSync(`cp -r ${DIST_DIR}/*.js ${serviceDir}/`, { stdio: 'pipe' });
      
      // Copy subdirectories if they exist
      const subdirs = ['config', 'middleware', 'routes', 'services', 'types', 'utils'];
      for (const subdir of subdirs) {
        const srcSubdir = path.join(DIST_DIR, subdir);
        if (fs.existsSync(srcSubdir)) {
          execSync(`cp -r ${srcSubdir} ${serviceDir}/`, { stdio: 'pipe' });
        }
      }

      // Create Lambda handler for this service
      const handlerContent = createLambdaHandler(service);
      fs.writeFileSync(path.join(serviceDir, 'lambda.js'), handlerContent);

      // Create service-specific package.json with production dependencies
      const packageJson = {
        name: service,
        version: '1.0.0',
        description: `Lambda function for ${service}`,
        main: 'lambda.js',
        dependencies: {
          'aws-lambda': '^1.0.7',
          'aws-sdk': '^2.1490.0',
          'bcryptjs': '^2.4.3',
          'jsonwebtoken': '^9.0.2',
          'joi': '^17.11.0',
          'uuid': '^9.0.1',
          'compression': '^1.7.4',
          'cors': '^2.8.5',
          'express': '^4.18.2',
          'helmet': '^7.1.0',
          'serverless-http': '^3.2.0'
        }
      };

      fs.writeFileSync(
        path.join(serviceDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Install production dependencies
      console.log(`  📦 Installing dependencies for ${service}...`);
      execSync('npm install --production --silent', {
        cwd: serviceDir,
        stdio: 'pipe'
      });

      // Create ZIP file
      console.log(`  🗜️  Creating ZIP archive for ${service}...`);
      execSync(`cd ${serviceDir} && zip -r -q ../${service}.zip .`, {
        stdio: 'pipe'
      });

      // Get ZIP file size
      const stats = fs.statSync(zipFile);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      // Clean up temporary directory
      execSync(`rm -rf ${serviceDir}`, { stdio: 'pipe' });

      console.log(`  ✅ ${service} packaged successfully (${fileSizeInMB} MB)`);
    } catch (error) {
      console.error(`❌ Error packaging ${service}:`, error.message);
      if (error.stdout) console.error('STDOUT:', error.stdout.toString());
      if (error.stderr) console.error('STDERR:', error.stderr.toString());
      process.exit(1);
    }
  }

  console.log('\n✅ All Lambda services packaged successfully!');
  console.log('\n📋 Package Summary:');
  
  // Show package summary
  for (const service of SERVICES) {
    const zipFile = path.join(DIST_DIR, `${service}.zip`);
    if (fs.existsSync(zipFile)) {
      const stats = fs.statSync(zipFile);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  📦 ${service}.zip - ${fileSizeInMB} MB`);
    }
  }

  console.log('\n🚀 Ready for deployment to AWS Lambda!');
}

if (require.main === module) {
  packageServices().catch(error => {
    console.error('❌ Packaging failed:', error);
    process.exit(1);
  });
}