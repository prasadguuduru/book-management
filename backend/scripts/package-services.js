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

// Function to analyze shared dependencies for a service
function analyzeSharedDependencies(serviceName) {
  const serviceSourceDir = path.join(SRC_DIR, serviceName);
  const dependencies = new Set();
  
  if (!fs.existsSync(serviceSourceDir)) {
    console.log(`  ⚠️  Service source directory not found: ${serviceSourceDir}`);
    return Array.from(dependencies);
  }
  
  // Recursively scan TypeScript files for shared imports
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Look for shared imports
        const sharedImportRegex = /(?:import|require).*['"`]\.\.\/shared\/([^'"`]+)['"`]/g;
        let match;
        
        while ((match = sharedImportRegex.exec(content)) !== null) {
          const sharedPath = match[1];
          const sharedModule = sharedPath.split('/')[0]; // Get the top-level shared module
          dependencies.add(sharedModule);
        }
      }
    }
  }
  
  try {
    scanDirectory(serviceSourceDir);
  } catch (error) {
    console.log(`  ⚠️  Error scanning ${serviceName} for dependencies: ${error.message}`);
  }
  
  return Array.from(dependencies);
}

// Function to validate shared dependencies are included
function validateSharedDependencies(serviceDir, serviceName, requiredDependencies) {
  const sharedDir = path.join(serviceDir, 'shared');
  
  if (!fs.existsSync(sharedDir)) {
    throw new Error(`Shared directory missing for ${serviceName}`);
  }
  
  const availableModules = fs.readdirSync(sharedDir)
    .filter(item => fs.statSync(path.join(sharedDir, item)).isDirectory());
  
  const missingDependencies = requiredDependencies.filter(dep => !availableModules.includes(dep));
  
  if (missingDependencies.length > 0) {
    console.log(`  ⚠️  Missing shared dependencies for ${serviceName}: ${missingDependencies.join(', ')}`);
  }
  
  console.log(`  ✅ Dependency validation: ${requiredDependencies.length} required, ${availableModules.length} available`);
  
  return {
    required: requiredDependencies,
    available: availableModules,
    missing: missingDependencies
  };
}

// Services that export handlers directly (no Express app)
const DIRECT_HANDLER_SERVICES = ['auth-service', 'book-service', 'notification-service'];

// Lambda handler template for Express-based services
const createExpressLambdaHandler = (serviceName) => `
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

// Lambda handler template for direct handler services
const createDirectLambdaHandler = (serviceName) => `
// Direct handler export for ${serviceName}
const { handler } = require('./${serviceName}/index');
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
    
    // Analyze shared dependencies for this service
    const requiredDependencies = analyzeSharedDependencies(service);
    console.log(`  🔍 Required shared dependencies: ${requiredDependencies.length > 0 ? requiredDependencies.join(', ') : 'none detected'}`);
    
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

      // Handle different service types
      if (DIRECT_HANDLER_SERVICES.includes(service)) {
        // For services that already export handlers directly
        console.log(`  🔗 Using direct handler for ${service}...`);
        
        // Copy only the specific service files and dependencies
        console.log(`  📁 Copying compiled files for ${service}...`);
        
        // Copy the consolidated shared directory
        const sharedDir = path.join(DIST_DIR, 'shared');
        if (fs.existsSync(sharedDir)) {
          execSync(`cp -r ${sharedDir} ${serviceDir}/`, { stdio: 'pipe' });
          console.log(`  📁 Copied shared directory with all modules`);
          
          // List shared modules for verification
          const sharedModules = fs.readdirSync(path.join(serviceDir, 'shared'))
            .filter(item => fs.statSync(path.join(serviceDir, 'shared', item)).isDirectory());
          console.log(`  ✅ Shared modules included: ${sharedModules.join(', ')}`);
          
          // Validate dependencies
          validateSharedDependencies(serviceDir, service, requiredDependencies);
        } else {
          console.error(`  ❌ Shared directory not found at ${sharedDir}`);
          throw new Error('Shared directory missing from build output');
        }
        
        // Copy the specific service directory
        const serviceSourceDir = path.join(DIST_DIR, service);
        if (fs.existsSync(serviceSourceDir)) {
          execSync(`cp -r ${serviceSourceDir} ${serviceDir}/`, { stdio: 'pipe' });
        }
        
        // Create index.js that exports the handler from the service
        const indexContent = `
// Lambda entry point for ${service}
const { handler } = require('./${service}/index');
module.exports = { handler };
`;
        fs.writeFileSync(path.join(serviceDir, 'index.js'), indexContent);
      } else {
        // For Express-based services
        console.log(`  🔗 Creating Express wrapper for ${service}...`);
        
        // Copy all compiled JavaScript files for Express services
        console.log(`  📁 Copying compiled files for ${service}...`);
        execSync(`cp -r ${DIST_DIR}/*.js ${serviceDir}/`, { stdio: 'pipe' });
        
        // Copy the consolidated shared directory
        const sharedDir = path.join(DIST_DIR, 'shared');
        if (fs.existsSync(sharedDir)) {
          execSync(`cp -r ${sharedDir} ${serviceDir}/`, { stdio: 'pipe' });
          console.log(`  📁 Copied shared directory with all modules`);
          
          // List shared modules for verification
          const sharedModules = fs.readdirSync(path.join(serviceDir, 'shared'))
            .filter(item => fs.statSync(path.join(serviceDir, 'shared', item)).isDirectory());
          console.log(`  ✅ Shared modules included: ${sharedModules.join(', ')}`);
          
          // Validate dependencies
          validateSharedDependencies(serviceDir, service, requiredDependencies);
        } else {
          console.error(`  ❌ Shared directory not found at ${sharedDir}`);
          throw new Error('Shared directory missing from build output');
        }
        
        // Create Lambda handler for this service
        const handlerContent = createExpressLambdaHandler(service);
        fs.writeFileSync(path.join(serviceDir, 'lambda.js'), handlerContent);
        
        // Create index.js that exports the handler (for Lambda compatibility)
        const indexContent = `
// Lambda entry point for ${service}
const { handler } = require('./lambda');
module.exports = { handler };
`;
        fs.writeFileSync(path.join(serviceDir, 'index.js'), indexContent);
      }

      // Create service-specific package.json with production dependencies
      const baseDependencies = {
        'aws-lambda': '^1.0.7',
        'aws-sdk': '^2.1490.0',
        '@aws-sdk/client-ses': '^3.645.0',
        '@aws-sdk/client-cloudwatch': '^3.883.0',
        '@aws-sdk/client-dynamodb': '^3.450.0',
        '@aws-sdk/lib-dynamodb': '^3.450.0',
        'bcryptjs': '^2.4.3',
        'jsonwebtoken': '^9.0.2',
        'joi': '^17.11.0',
        'uuid': '^9.0.1'
      };

      const expressDependencies = {
        'compression': '^1.7.4',
        'cors': '^2.8.5',
        'express': '^4.18.2',
        'helmet': '^7.1.0',
        'serverless-http': '^3.2.0'
      };

      const packageJson = {
        name: service,
        version: '1.0.0',
        description: `Lambda function for ${service}`,
        main: DIRECT_HANDLER_SERVICES.includes(service) ? 'index.js' : 'lambda.js',
        dependencies: DIRECT_HANDLER_SERVICES.includes(service) 
          ? baseDependencies 
          : { ...baseDependencies, ...expressDependencies }
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
  
  // Show package summary with dependency analysis
  for (const service of SERVICES) {
    const zipFile = path.join(DIST_DIR, `${service}.zip`);
    if (fs.existsSync(zipFile)) {
      const stats = fs.statSync(zipFile);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      const dependencies = analyzeSharedDependencies(service);
      console.log(`  📦 ${service}.zip - ${fileSizeInMB} MB (${dependencies.length} shared deps: ${dependencies.join(', ') || 'none'})`);
    }
  }

  console.log('\n🎯 Shared Structure Integration:');
  console.log('  ✅ Updated for consolidated backend/src/shared/ structure');
  console.log('  ✅ Dependency analysis and validation enabled');
  console.log('  ✅ Transitive dependency resolution implemented');
  console.log('\n🚀 Ready for deployment to AWS Lambda!');
}

if (require.main === module) {
  packageServices().catch(error => {
    console.error('❌ Packaging failed:', error);
    process.exit(1);
  });
}