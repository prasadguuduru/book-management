/**
 * DynamoDB client with LocalStack and QA environment support
 */

import { DynamoDB } from 'aws-sdk';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export class DynamoDBClient {
  private client: DynamoDB.DocumentClient;
  private tableName: string;

  constructor() {
    const dynamoConfig: DynamoDB.DocumentClient.DocumentClientOptions & DynamoDB.Types.ClientConfiguration = {
      region: config.aws.region,
      maxRetries: 3,
      retryDelayOptions: {
        customBackoff: (retryCount: number) => Math.pow(2, retryCount) * 100,
      },
      httpOptions: {
        connectTimeout: 1000,
        timeout: 5000,
      },
    };

    // Only use explicit credentials for local development (LocalStack)
    if (config.database.endpoint) {
      (dynamoConfig as any).endpoint = config.database.endpoint;
      dynamoConfig.accessKeyId = config.aws.accessKeyId;
      dynamoConfig.secretAccessKey = config.aws.secretAccessKey;
      logger.info(`Using DynamoDB endpoint: ${config.database.endpoint} with explicit credentials`);
    } else {
      // In AWS Lambda, use IAM role credentials (no explicit keys needed)
      logger.info('Using IAM role credentials for DynamoDB access');
    }

    this.client = new DynamoDB.DocumentClient(dynamoConfig);
    this.tableName = config.database.tableName;

    logger.info(`DynamoDB client initialized for table: ${this.tableName}`);
  }

  /**
   * Get the DynamoDB DocumentClient instance
   */
  getClient(): DynamoDB.DocumentClient {
    return this.client;
  }

  /**
   * Get the table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Put an item into the table
   */
  async put(item: any, conditionExpression?: string): Promise<void> {
    const params: DynamoDB.DocumentClient.PutItemInput = {
      TableName: this.tableName,
      Item: item,
    };

    if (conditionExpression) {
      params.ConditionExpression = conditionExpression;
    }

    try {
      await this.client.put(params).promise();
      logger.debug(`Item put successfully: ${item.PK}#${item.SK}`);
    } catch (error) {
      logger.error('Error putting item:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get an item from the table
   */
  async get(pk: string, sk: string): Promise<any | null> {
    const params: DynamoDB.DocumentClient.GetItemInput = {
      TableName: this.tableName,
      Key: { PK: pk, SK: sk },
    };

    try {
      const result = await this.client.get(params).promise();
      logger.debug(`Item retrieved: ${pk}#${sk}, found: ${!!result.Item}`);
      return result.Item || null;
    } catch (error) {
      logger.error('Error getting item:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update an item in the table
   */
  async update(
    pk: string,
    sk: string,
    updateExpression: string,
    expressionAttributeValues: any,
    expressionAttributeNames?: any,
    conditionExpression?: string
  ): Promise<any> {
    const params: DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: { PK: pk, SK: sk },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };

    if (expressionAttributeNames) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (conditionExpression) {
      params.ConditionExpression = conditionExpression;
    }

    try {
      const result = await this.client.update(params).promise();
      logger.debug(`Item updated: ${pk}#${sk}`);
      return result.Attributes;
    } catch (error) {
      logger.error('Error updating item:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete an item from the table
   */
  async delete(pk: string, sk: string, conditionExpression?: string): Promise<void> {
    const params: DynamoDB.DocumentClient.DeleteItemInput = {
      TableName: this.tableName,
      Key: { PK: pk, SK: sk },
    };

    if (conditionExpression) {
      params.ConditionExpression = conditionExpression;
    }

    try {
      await this.client.delete(params).promise();
      logger.debug(`Item deleted: ${pk}#${sk}`);
    } catch (error) {
      logger.error('Error deleting item:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Query items from the table
   */
  async query(
    keyConditionExpression: string,
    expressionAttributeValues: any,
    indexName?: string,
    expressionAttributeNames?: any,
    filterExpression?: string,
    limit?: number,
    exclusiveStartKey?: any,
    scanIndexForward: boolean = true
  ): Promise<{ items: any[]; lastEvaluatedKey?: any; count: number; }> {
    const params: DynamoDB.DocumentClient.QueryInput = {
      TableName: this.tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: scanIndexForward,
    };

    if (indexName) {
      params.IndexName = indexName;
    }

    if (expressionAttributeNames) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (filterExpression) {
      params.FilterExpression = filterExpression;
    }

    if (limit) {
      params.Limit = limit;
    }

    if (exclusiveStartKey) {
      params.ExclusiveStartKey = exclusiveStartKey;
    }

    try {
      const result = await this.client.query(params).promise();
      logger.debug(`Query executed, returned ${result.Items?.length || 0} items`);

      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0,
      };
    } catch (error) {
      logger.error('Error querying items:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Scan items from the table
   */
  async scan(
    filterExpression?: string,
    expressionAttributeValues?: any,
    indexName?: string,
    expressionAttributeNames?: any,
    limit?: number,
    exclusiveStartKey?: any
  ): Promise<{ items: any[]; lastEvaluatedKey?: any; count: number; }> {
    const params: DynamoDB.DocumentClient.ScanInput = {
      TableName: this.tableName,
    };

    if (filterExpression) {
      params.FilterExpression = filterExpression;
    }

    if (expressionAttributeValues) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    if (indexName) {
      params.IndexName = indexName;
    }

    if (expressionAttributeNames) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (limit) {
      params.Limit = limit;
    }

    if (exclusiveStartKey) {
      params.ExclusiveStartKey = exclusiveStartKey;
    }

    try {
      const result = await this.client.scan(params).promise();
      logger.debug(`Scan executed, returned ${result.Items?.length || 0} items`);

      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0,
      };
    } catch (error) {
      logger.error('Error scanning items:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Batch write items to the table
   */
  async batchWrite(items: any[]): Promise<void> {
    const chunks = this.chunkArray(items, 25); // DynamoDB batch limit

    for (const chunk of chunks) {
      const params: DynamoDB.DocumentClient.BatchWriteItemInput = {
        RequestItems: {
          [this.tableName]: chunk.map(item => ({
            PutRequest: { Item: item },
          })),
        },
      };

      try {
        await this.client.batchWrite(params).promise();
        logger.debug(`Batch write completed for ${chunk.length} items`);
      } catch (error) {
        logger.error('Error in batch write:', error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }
  }

  /**
   * Batch get items from the table
   */
  async batchGet(keys: { PK: string; SK: string; }[]): Promise<any[]> {
    const chunks = this.chunkArray(keys, 100); // DynamoDB batch limit
    const allItems: any[] = [];

    for (const chunk of chunks) {
      const params: DynamoDB.DocumentClient.BatchGetItemInput = {
        RequestItems: {
          [this.tableName]: {
            Keys: chunk,
          },
        },
      };

      try {
        const result = await this.client.batchGet(params).promise();
        const items = result.Responses?.[this.tableName] || [];
        allItems.push(...items);
        logger.debug(`Batch get completed for ${chunk.length} keys, returned ${items.length} items`);
      } catch (error) {
        logger.error('Error in batch get:', error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }

    return allItems;
  }

  /**
   * Utility method to chunk arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to describe the table to check connectivity
      const dynamoConfig: any = {
        region: config.aws.region,
      };

      // Only use explicit credentials for local development
      if (config.database.endpoint && config.aws.accessKeyId) {
        dynamoConfig.endpoint = config.database.endpoint;
        dynamoConfig.accessKeyId = config.aws.accessKeyId;
        dynamoConfig.secretAccessKey = config.aws.secretAccessKey;
      }
      // For AWS environments, don't set credentials - use IAM role

      const dynamodb = new DynamoDB(dynamoConfig);

      await dynamodb.describeTable({ TableName: this.tableName }).promise();
      logger.info('DynamoDB health check passed');
      return true;
    } catch (error) {
      logger.error('DynamoDB health check failed:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
}

// Singleton instance
export const dynamoDBClient = new DynamoDBClient();