/**
 * Shared logging system exports
 * Provides unified logging functionality for all Lambda services
 */

// Core logging classes and interfaces
export {
  SharedLogger,
  LogMeta,
  LogLevel,
  StructuredLogEntry
} from './logger';

// Logging utilities and helpers
export {
  LambdaLogContext,
  createLambdaLogger,
  extractRequestMeta,
  logApiGatewayRequest,
  logApiGatewayResponse,
  withPerformanceLogging,
  logError,
  logSecurityEvent,
  logAuditEvent,
  logDatabaseOperation,
  monitorLambdaTimeout,
  correlationIdMiddleware,
  logStructuredError,
  logBusinessOperation,
  logExternalServiceCall
} from './logging-utils';