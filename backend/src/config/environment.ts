/**
 * Environment configuration for the ebook publishing platform
 */

export interface Config {
  environment: 'local' | 'development' | 'staging' | 'production';
  port: number;
  aws: {
    region: string;
    endpoint: string | undefined;
    accessKeyId: string;
    secretAccessKey: string;
  };
  database: {
    tableName: string;
    endpoint: string | undefined;
  };
  jwt: {
    publicKey: string;
    privateKey: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
  };
  cors: {
    origin: string | string[];
  };
  encryption: {
    key: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

const getConfig = (): Config => {
  const environment = (process.env['NODE_ENV'] || 'local') as Config['environment'];

  return {
    environment,
    port: parseInt(process.env['BACKEND_PORT'] || process.env['PORT'] || '3001', 10),
    aws: {
      region: process.env['AWS_REGION'] || 'us-east-1',
      endpoint: process.env['AWS_ENDPOINT_URL'] || (environment === 'local' ? 'http://localhost:4566' : undefined),
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || 'test',
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || 'test',
    },
    database: {
      tableName: process.env['TABLE_NAME'] || 'ebook-platform-data',
      endpoint: process.env['DYNAMODB_ENDPOINT'] || (environment === 'local' ? 'http://localhost:4566' : undefined),
    },
    jwt: {
      publicKey: process.env['JWT_PUBLIC_KEY'] || 'ebook-platform-dev-secret-key-for-jwt-tokens-2024',
      privateKey: process.env['JWT_PRIVATE_KEY'] || 'ebook-platform-dev-secret-key-for-jwt-tokens-2024',
      accessTokenExpiry: process.env['JWT_ACCESS_EXPIRY'] || '15m',
      refreshTokenExpiry: process.env['JWT_REFRESH_EXPIRY'] || '7d',
    },
    cors: {
      origin: process.env['CORS_ORIGIN']?.split(',').map(url => url.trim()) || ['http://localhost:3000'],
    },
    encryption: {
      key: process.env['ENCRYPTION_KEY'] || 'dummy-encryption-key-32-characters',
    },
    logging: {
      level: (process.env['LOG_LEVEL'] as Config['logging']['level']) ||
        (environment === 'production' ? 'info' : 'debug'),
    },
  };
};

export const config = getConfig();