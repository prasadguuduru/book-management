#!/usr/bin/env node

/**
 * Create DynamoDB table for local development
 */

const AWS = require('aws-sdk');

// Configure AWS SDK for LocalStack
const dynamodb = new AWS.DynamoDB({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  accessKeyId: 'test',
  secretAccessKey: 'test',
});

const TABLE_NAME = 'ebook-platform-data';

async function createTable() {
  console.log('📊 Creating DynamoDB table...');

  const params = {
    TableName: TABLE_NAME,
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
      { AttributeName: 'GSI2PK', AttributeType: 'S' },
      { AttributeName: 'GSI2SK', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'GSI2',
        KeySchema: [
          { AttributeName: 'GSI2PK', KeyType: 'HASH' },
          { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES',
    },
  };

  try {
    // Check if table already exists
    try {
      await dynamodb.describeTable({ TableName: TABLE_NAME }).promise();
      console.log('✅ Table already exists');
      return;
    } catch (error) {
      if (error.code !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create the table
    const result = await dynamodb.createTable(params).promise();
    console.log('✅ DynamoDB table created successfully');
    console.log(`📊 Table ARN: ${result.TableDescription.TableArn}`);

    // Wait for table to be active
    console.log('⏳ Waiting for table to be active...');
    await dynamodb.waitFor('tableExists', { TableName: TABLE_NAME }).promise();
    console.log('✅ Table is now active');

  } catch (error) {
    console.error('❌ Error creating table:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  createTable();
}

module.exports = { createTable };