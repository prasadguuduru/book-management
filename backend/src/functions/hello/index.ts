import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { cors } from '../../middleware/cors';

const mockData = {
  message: 'Hello from Lambda!',
  books: [
    {
      id: '1',
      title: 'Sample Book 1',
      author: 'John Doe',
      status: 'PUBLISHED'
    },
    {
      id: '2',
      title: 'Sample Book 2',
      author: 'Jane Smith',
      status: 'DRAFT'
    }
  ],
  timestamp: new Date().toISOString()
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Apply CORS headers
    const response = cors({
      statusCode: 200,
      body: JSON.stringify(mockData),
      headers: {
        'Content-Type': 'application/json',
      }
    });

    return response;
  } catch (error) {
    console.error('Error:', error);
    return cors({
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }
};
