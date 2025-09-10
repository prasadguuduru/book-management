/**
 * Environment Configuration for Workflow Service
 * Centralizes environment variable access and provides defaults
 */

export interface WorkflowServiceConfig {
  nodeEnv: string;
  awsRegion: string;
  logLevel: string;
  bookWorkflowEventsTopicArn: string | undefined;
  localstackEndpoint: string | undefined;
  environment: string;
}

/**
 * Get workflow service configuration from environment variables
 */
export function getWorkflowServiceConfig(): WorkflowServiceConfig {
  return {
    nodeEnv: process.env['NODE_ENV'] || 'development',
    awsRegion: process.env['AWS_REGION'] || 'us-east-1',
    logLevel: process.env['LOG_LEVEL'] || 'INFO',
    bookWorkflowEventsTopicArn: process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN'],
    localstackEndpoint: process.env['LOCALSTACK_ENDPOINT'],
    environment: process.env['ENVIRONMENT'] || 'dev'
  };
}

/**
 * Check if running in test environment
 */
export function isTestEnvironment(): boolean {
  return getWorkflowServiceConfig().nodeEnv === 'test';
}

/**
 * Check if running in development environment
 */
export function isDevelopmentEnvironment(): boolean {
  return getWorkflowServiceConfig().nodeEnv === 'development';
}

/**
 * Check if running in production environment
 */
export function isProductionEnvironment(): boolean {
  const env = getWorkflowServiceConfig().nodeEnv;
  return env === 'production' || env === 'prod';
}

/**
 * Get CloudWatch namespace for metrics
 */
export function getCloudWatchNamespace(): string {
  const config = getWorkflowServiceConfig();
  return `EbookPlatform/WorkflowService/${config.environment}`;
}

/**
 * Validate required environment variables
 */
export function validateEnvironmentConfig(): { isValid: boolean; errors: string[] } {
  const config = getWorkflowServiceConfig();
  const errors: string[] = [];

  // Check required variables for production
  if (isProductionEnvironment()) {
    if (!config.bookWorkflowEventsTopicArn) {
      errors.push('BOOK_WORKFLOW_EVENTS_TOPIC_ARN is required in production');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}