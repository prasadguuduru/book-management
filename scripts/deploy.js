#!/usr/bin/env node

/**
 * Main deployment script for ebook publishing platform
 * Handles deployment to different environments (dev, qa, staging, prod)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`🔄 ${description}...`, 'blue');
  try {
    const output = execSync(command, { stdio: 'inherit', encoding: 'utf8' });
    log(`✅ ${description} completed`, 'green');
    return output;
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function validateEnvironment(env) {
  const validEnvs = ['local', 'dev', 'qa', 'staging', 'prod'];
  if (!validEnvs.includes(env)) {
    log(`❌ Invalid environment: ${env}. Valid options: ${validEnvs.join(', ')}`, 'red');
    process.exit(1);
  }
}

function checkPrerequisites(env) {
  log(`🔍 Checking prerequisites for ${env} deployment...`, 'blue');
  
  // Check if required files exist
  const requiredFiles = [
    'package.json',
    'docker-compose.yml',
    '.env.example'
  ];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      log(`❌ Required file missing: ${file}`, 'red');
      process.exit(1);
    }
  }
  
  // Check if environment file exists
  const envFile = env === 'local' ? '.env.local' : `.env.${env}`;
  if (!fs.existsSync(envFile)) {
    log(`⚠️  Environment file ${envFile} not found, using defaults`, 'yellow');
  }
  
  log(`✅ Prerequisites check passed`, 'green');
}

function deployToEnvironment(env) {
  log(`🚀 Starting deployment to ${env} environment...`, 'blue');
  
  switch (env) {
    case 'local':
      deployLocal();
      break;
    case 'dev':
    case 'qa':
    case 'staging':
    case 'prod':
      deployAWS(env);
      break;
    default:
      log(`❌ Unsupported environment: ${env}`, 'red');
      process.exit(1);
  }
}

function deployLocal() {
  log(`🏠 Deploying to LocalStack environment...`, 'blue');
  
  // Start LocalStack if not running
  execCommand('npm run localstack:start', 'Starting LocalStack');
  
  // Wait for LocalStack to be ready
  execCommand('npm run localstack:wait', 'Waiting for LocalStack');
  
  // Deploy infrastructure
  execCommand('npm run infra:local', 'Deploying infrastructure to LocalStack');
  
  // Create database and seed data
  execCommand('npm run db:setup', 'Setting up database');
  
  log(`🎉 Local deployment completed successfully!`, 'green');
  log(`📍 Access points:`, 'blue');
  log(`   • Frontend: http://localhost:3000`, 'blue');
  log(`   • Backend API: http://localhost:3001/api`, 'blue');
  log(`   • Health Check: http://localhost:3001/health`, 'blue');
  log(`   • LocalStack: http://localhost:4566`, 'blue');
}

function deployAWS(env) {
  log(`☁️  Deploying to AWS ${env} environment...`, 'blue');
  
  // Build Lambda packages
  execCommand('npm run build:lambda', 'Building Lambda packages');
  
  // Deploy infrastructure
  execCommand(`npm run infra:${env}`, `Deploying infrastructure to ${env}`);
  
  // Build and deploy frontend
  execCommand(`npm run build:frontend:${env}`, `Building frontend for ${env}`);
  
  // Deploy frontend to S3/CloudFront
  if (fs.existsSync(`scripts/deploy-s3-frontend.sh`)) {
    execCommand(`./scripts/deploy-s3-frontend.sh ${env}`, `Deploying frontend to ${env}`);
  }
  
  // Run health checks
  if (fs.existsSync(`scripts/test-infrastructure.sh`)) {
    execCommand(`npm run test:infra:${env}`, `Running health checks for ${env}`);
  }
  
  log(`🎉 AWS ${env} deployment completed successfully!`, 'green');
  log(`📍 Check AWS Console for resource URLs`, 'blue');
}

function showUsage() {
  log(`Usage: node deploy.js <environment>`, 'blue');
  log(``, 'reset');
  log(`Environments:`, 'blue');
  log(`  local    - Deploy to LocalStack for local development`, 'reset');
  log(`  dev      - Deploy to AWS development environment`, 'reset');
  log(`  qa       - Deploy to AWS QA environment`, 'reset');
  log(`  staging  - Deploy to AWS staging environment`, 'reset');
  log(`  prod     - Deploy to AWS production environment`, 'reset');
  log(``, 'reset');
  log(`Examples:`, 'blue');
  log(`  node deploy.js local`, 'reset');
  log(`  node deploy.js qa`, 'reset');
  log(`  node deploy.js prod`, 'reset');
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }
  
  const environment = args[0].toLowerCase();
  
  log(`🚀 Ebook Publishing Platform Deployment`, 'blue');
  log(`📅 ${new Date().toISOString()}`, 'blue');
  log(`🎯 Target Environment: ${environment}`, 'blue');
  log(``, 'reset');
  
  validateEnvironment(environment);
  checkPrerequisites(environment);
  deployToEnvironment(environment);
  
  log(``, 'reset');
  log(`🎉 Deployment completed successfully!`, 'green');
  log(`📊 Summary:`, 'blue');
  log(`   • Environment: ${environment}`, 'reset');
  log(`   • Timestamp: ${new Date().toISOString()}`, 'reset');
  log(`   • Status: SUCCESS`, 'green');
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  log(`💥 Uncaught Exception: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`💥 Unhandled Rejection at: ${promise}, reason: ${reason}`, 'red');
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = { deployToEnvironment, validateEnvironment };