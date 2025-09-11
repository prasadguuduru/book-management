"use strict";
/**
 * DynamoDB client with LocalStack and QA environment support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamoDBClient = exports.DynamoDBClient = void 0;
const aws_sdk_1 = require("aws-sdk");
const environment_1 = require("../config/environment");
const logger_1 = require("../utils/logger");
class DynamoDBClient {
    constructor() {
        const dynamoConfig = {
            region: environment_1.config.aws.region,
            maxRetries: 3,
            retryDelayOptions: {
                customBackoff: (retryCount) => Math.pow(2, retryCount) * 100,
            },
            httpOptions: {
                connectTimeout: 1000,
                timeout: 5000,
            },
        };
        // Only use explicit credentials for local development (LocalStack)
        if (environment_1.config.database.endpoint) {
            dynamoConfig.endpoint = environment_1.config.database.endpoint;
            dynamoConfig.accessKeyId = environment_1.config.aws.accessKeyId;
            dynamoConfig.secretAccessKey = environment_1.config.aws.secretAccessKey;
            logger_1.logger.info(`Using DynamoDB endpoint: ${environment_1.config.database.endpoint} with explicit credentials`);
        }
        else {
            // In AWS Lambda, use IAM role credentials (no explicit keys needed)
            logger_1.logger.info('Using IAM role credentials for DynamoDB access');
        }
        this.client = new aws_sdk_1.DynamoDB.DocumentClient(dynamoConfig);
        this.tableName = environment_1.config.database.tableName;
        logger_1.logger.info(`DynamoDB client initialized for table: ${this.tableName}`);
    }
    /**
     * Get the DynamoDB DocumentClient instance
     */
    getClient() {
        return this.client;
    }
    /**
     * Get the table name
     */
    getTableName() {
        return this.tableName;
    }
    /**
     * Put an item into the table
     */
    async put(item, conditionExpression) {
        const params = {
            TableName: this.tableName,
            Item: item,
        };
        if (conditionExpression) {
            params.ConditionExpression = conditionExpression;
        }
        try {
            await this.client.put(params).promise();
            logger_1.logger.debug(`Item put successfully: ${item.PK}#${item.SK}`);
        }
        catch (error) {
            logger_1.logger.error('Error putting item:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Get an item from the table
     */
    async get(pk, sk) {
        const params = {
            TableName: this.tableName,
            Key: { PK: pk, SK: sk },
        };
        try {
            const result = await this.client.get(params).promise();
            logger_1.logger.debug(`Item retrieved: ${pk}#${sk}, found: ${!!result.Item}`);
            return result.Item || null;
        }
        catch (error) {
            logger_1.logger.error('Error getting item:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Update an item in the table
     */
    async update(pk, sk, updateExpression, expressionAttributeValues, expressionAttributeNames, conditionExpression) {
        const params = {
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
            logger_1.logger.debug(`Item updated: ${pk}#${sk}`);
            return result.Attributes;
        }
        catch (error) {
            logger_1.logger.error('Error updating item:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Delete an item from the table
     */
    async delete(pk, sk, conditionExpression) {
        const params = {
            TableName: this.tableName,
            Key: { PK: pk, SK: sk },
        };
        if (conditionExpression) {
            params.ConditionExpression = conditionExpression;
        }
        try {
            await this.client.delete(params).promise();
            logger_1.logger.debug(`Item deleted: ${pk}#${sk}`);
        }
        catch (error) {
            logger_1.logger.error('Error deleting item:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Query items from the table
     */
    async query(keyConditionExpression, expressionAttributeValues, indexName, expressionAttributeNames, filterExpression, limit, exclusiveStartKey, scanIndexForward = true) {
        const params = {
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
            logger_1.logger.debug(`Query executed, returned ${result.Items?.length || 0} items`);
            return {
                items: result.Items || [],
                lastEvaluatedKey: result.LastEvaluatedKey,
                count: result.Count || 0,
            };
        }
        catch (error) {
            logger_1.logger.error('Error querying items:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Scan items from the table
     */
    async scan(filterExpression, expressionAttributeValues, indexName, expressionAttributeNames, limit, exclusiveStartKey) {
        const params = {
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
            logger_1.logger.debug(`Scan executed, returned ${result.Items?.length || 0} items`);
            return {
                items: result.Items || [],
                lastEvaluatedKey: result.LastEvaluatedKey,
                count: result.Count || 0,
            };
        }
        catch (error) {
            logger_1.logger.error('Error scanning items:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Batch write items to the table
     */
    async batchWrite(items) {
        const chunks = this.chunkArray(items, 25); // DynamoDB batch limit
        for (const chunk of chunks) {
            const params = {
                RequestItems: {
                    [this.tableName]: chunk.map(item => ({
                        PutRequest: { Item: item },
                    })),
                },
            };
            try {
                await this.client.batchWrite(params).promise();
                logger_1.logger.debug(`Batch write completed for ${chunk.length} items`);
            }
            catch (error) {
                logger_1.logger.error('Error in batch write:', error instanceof Error ? error : new Error(String(error)));
                throw error;
            }
        }
    }
    /**
     * Batch get items from the table
     */
    async batchGet(keys) {
        const chunks = this.chunkArray(keys, 100); // DynamoDB batch limit
        const allItems = [];
        for (const chunk of chunks) {
            const params = {
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
                logger_1.logger.debug(`Batch get completed for ${chunk.length} keys, returned ${items.length} items`);
            }
            catch (error) {
                logger_1.logger.error('Error in batch get:', error instanceof Error ? error : new Error(String(error)));
                throw error;
            }
        }
        return allItems;
    }
    /**
     * Utility method to chunk arrays
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    /**
     * Health check method
     */
    async healthCheck() {
        try {
            // Try to describe the table to check connectivity
            const dynamoConfig = {
                region: environment_1.config.aws.region,
            };
            // Only use explicit credentials for local development
            if (environment_1.config.database.endpoint && environment_1.config.aws.accessKeyId) {
                dynamoConfig.endpoint = environment_1.config.database.endpoint;
                dynamoConfig.accessKeyId = environment_1.config.aws.accessKeyId;
                dynamoConfig.secretAccessKey = environment_1.config.aws.secretAccessKey;
            }
            // For AWS environments, don't set credentials - use IAM role
            const dynamodb = new aws_sdk_1.DynamoDB(dynamoConfig);
            await dynamodb.describeTable({ TableName: this.tableName }).promise();
            logger_1.logger.info('DynamoDB health check passed');
            return true;
        }
        catch (error) {
            logger_1.logger.error('DynamoDB health check failed:', error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
}
exports.DynamoDBClient = DynamoDBClient;
// Singleton instance
exports.dynamoDBClient = new DynamoDBClient();
