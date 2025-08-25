import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { cors } from '../../middleware/cors';

// Initialize DynamoDB client
const dynamoDB = new DynamoDB.DocumentClient({
  endpoint: process.env.IS_LOCAL ? 'http://localhost:4566' : undefined,
  region: process.env.AWS_REGION || 'us-west-2'
});

const TABLE_NAME = process.env.TABLE_NAME || 'books-local';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get query parameters
    const status = event.queryStringParameters?.status;
    const params: DynamoDB.DocumentClient.QueryInput | DynamoDB.DocumentClient.ScanInput = status
      ? {
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :status',
          ExpressionAttributeValues: {
            ':status': `STATUS#${status}`
          }
        }
      : {
          TableName: TABLE_NAME,
          FilterExpression: 'SK = :metadata',
          ExpressionAttributeValues: {
            ':metadata': 'METADATA'
          }
        };

    // Query or scan DynamoDB
    const result = status
      ? await dynamoDB.query(params).promise()
      : await dynamoDB.scan(params).promise();

    // Transform items for response
    const books = result.Items?.map(item => ({
      id: item.id,
      title: item.title,
      author: item.author,
      status: item.status,
      genre: item.genre,
      publishedDate: item.publishedDate
    }));

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully retrieved books',
        books,
        timestamp: new Date().toISOString()
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    };

    return cors(response);
  } catch (error) {
    console.error('Error:', error);
    
    const response = {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    };

    return cors(response);
  }
};