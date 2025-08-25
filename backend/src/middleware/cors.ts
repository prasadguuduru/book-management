import { APIGatewayProxyResult } from 'aws-lambda';

const allowedOrigins = [
  'http://localhost:3000',  // React dev server
  'http://localhost:3001',  // Alternative port
  'http://localhost:5173'   // Vite dev server
];

export const cors = (response: APIGatewayProxyResult): APIGatewayProxyResult => {
  const origin = allowedOrigins[0]; // For demo, using first origin. In production, validate against actual origin

  return {
    ...response,
    headers: {
      ...response.headers,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    }
  };
};
