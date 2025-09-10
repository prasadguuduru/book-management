/**
 * Health check handler for notification service
 */

import { SharedLogger } from '../../shared/logging/logger';
import { HandlerResponse } from '../types/notification';

// Initialize shared logger for health check handler
const logger = new SharedLogger('notification-service-health');

/**
 * Handle health check requests
 */
export async function healthCheckHandler(requestId: string): Promise<HandlerResponse> {
  logger.setCorrelationId(requestId);
  
  logger.info('Health check requested', { requestId });
  
  return {
    statusCode: 200,
    body: {
      status: 'healthy',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      requestId,
      capabilities: [
        'email_notifications',
        'workflow_integration',
        'ses_delivery'
      ]
    }
  };
}