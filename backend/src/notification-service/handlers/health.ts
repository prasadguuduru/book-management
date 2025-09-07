/**
 * Health check handler for notification service
 */

import { HandlerResponse } from '../types/notification';

/**
 * Handle health check requests
 */
export async function healthCheckHandler(requestId: string): Promise<HandlerResponse> {
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