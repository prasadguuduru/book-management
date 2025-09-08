/**
 * Mock CloudWatch Metrics Service for testing
 */

export class CloudWatchMetricsService {
  async recordNotificationSuccess(notificationType: string, processingTimeMs: number): Promise<void> {
    // Mock implementation
  }

  async recordNotificationFailure(notificationType: string, errorType: string, processingTimeMs: number): Promise<void> {
    // Mock implementation
  }

  async recordBatchProcessingMetrics(
    totalRecords: number,
    successfulRecords: number,
    failedRecords: number,
    processingTimeMs: number
  ): Promise<void> {
    // Mock implementation
  }

  async recordEmailDeliveryMetrics(
    notificationType: string,
    deliveryStatus: 'sent' | 'failed',
    deliveryTimeMs: number,
    errorType?: string
  ): Promise<void> {
    // Mock implementation
  }

  async recordDLQMessage(notificationType: string, reason: string): Promise<void> {
    // Mock implementation
  }

  createTimer(): { stop: () => number } {
    return {
      stop: () => 100 // Mock processing time
    };
  }
}

export const cloudWatchMetrics = new CloudWatchMetricsService();