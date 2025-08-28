#!/usr/bin/env ts-node

/**
 * CLI script to test the DynamoDB data access layer
 */

import { dataLayerTester } from '@/data/test-data-layer';
import { seedDataService } from '@/data/seed-data';
import { logger } from '@/utils/logger';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'test';

  try {
    switch (command) {
      case 'test':
        logger.info('Running data layer tests...');
        await dataLayerTester.runAllTests();
        break;

      case 'workflow':
        logger.info('Testing book workflow...');
        await dataLayerTester.testBookWorkflow();
        break;

      case 'performance':
        logger.info('Running performance tests...');
        await dataLayerTester.performanceTest();
        break;

      case 'seed':
        logger.info('Seeding mock data...');
        await seedDataService.seedAll();
        break;

      case 'help':
        console.log(`
Usage: npm run test:data-layer [command]

Commands:
  test        Run all data layer tests (default)
  workflow    Test complete book workflow
  performance Run performance tests
  seed        Seed mock data
  help        Show this help message

Examples:
  npm run test:data-layer
  npm run test:data-layer workflow
  npm run test:data-layer seed
        `);
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        logger.info('Use "help" command to see available options');
        process.exit(1);
    }

    logger.info('✅ Command completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Command failed:', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}