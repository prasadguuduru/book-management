/**
 * DLQ Monitoring and Alerting System
 * 
 * This module provides comprehensive monitoring for Dead Letter Queues:
 * 1. CloudWatch metrics collection
 * 2. Real-time monitoring dashboard
 * 3. Alerting for message accumulation
 * 4. Health checks and status reporting
 */

import { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

interface DLQMetrics {
  queueName: string;
  messageCount: number;
  oldestMessageAge: number;
  messageRate: number;
  timestamp: Date;
}

interface DLQAlert {
  alertType: 'MESSAGE_ACCUMULATION' | 'OLD_MESSAGES' | 'HIGH_RATE' | 'QUEUE_UNAVAILABLE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  metrics: DLQMetrics;
  threshold: number;
  currentValue: number;
}

interface MonitoringConfig {
  dlqUrl: string;
  alertTopicArn?: string;
  thresholds: {
    messageCount: number;
    oldestMessageAgeHours: number;
    messageRatePerMinute: number;
  };
  monitoringInterval: number;
}

class DLQMonitor {
  private cloudWatchClient: CloudWatchClient;
  private sqsClient: SQSClient;
  private snsClient: SNSClient;
  private config: MonitoringConfig;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout | undefined;

  constructor(config: MonitoringConfig) {
    this.cloudWatchClient = new CloudWatchClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    this.sqsClient = new SQSClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    this.snsClient = new SNSClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    this.config = config;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️  DLQ monitoring is already running');
      return;
    }

    console.log('🚀 Starting DLQ monitoring...');
    this.isMonitoring = true;

    // Initial metrics collection
    await this.collectAndPublishMetrics();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectAndPublishMetrics();
      } catch (error) {
        console.error('❌ Error in DLQ monitoring cycle:', error);
      }
    }, this.config.monitoringInterval);

    console.log(`✅ DLQ monitoring started with ${this.config.monitoringInterval}ms interval`);
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      console.log('⚠️  DLQ monitoring is not running');
      return;
    }

    console.log('🛑 Stopping DLQ monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined as NodeJS.Timeout | undefined;
    }

    console.log('✅ DLQ monitoring stopped');
  }

  async collectAndPublishMetrics(): Promise<DLQMetrics> {
    try {
      const metrics = await this.collectDLQMetrics();
      await this.publishMetricsToCloudWatch(metrics);
      await this.checkAlertsAndNotify(metrics);
      
      return metrics;
    } catch (error) {
      console.error('❌ Failed to collect DLQ metrics:', error);
      throw error;
    }
  }

  private async collectDLQMetrics(): Promise<DLQMetrics> {
    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.config.dlqUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'CreatedTimestamp'
        ]
      });

      const response = await this.sqsClient.send(command);
      const attributes = response.Attributes || {};

      const messageCount = parseInt(attributes.ApproximateNumberOfMessages || '0');
      
      // Get oldest message age from CloudWatch metrics
      const oldestMessageAge = await this.getOldestMessageAge();
      
      // Calculate message rate (simplified - would need historical data for accurate rate)
      const messageRate = await this.calculateMessageRate();

      const queueName = this.extractQueueName(this.config.dlqUrl);

      return {
        queueName,
        messageCount,
        oldestMessageAge,
        messageRate,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Failed to collect DLQ metrics:', error);
      throw error;
    }
  }

  private async getOldestMessageAge(): Promise<number> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // 5 minutes ago

      const command = new GetMetricStatisticsCommand({
        Namespace: 'AWS/SQS',
        MetricName: 'ApproximateAgeOfOldestMessage',
        Dimensions: [
          {
            Name: 'QueueName',
            Value: this.extractQueueName(this.config.dlqUrl)
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300, // 5 minutes
        Statistics: ['Maximum']
      });

      const response = await this.cloudWatchClient.send(command);
      
      if (response.Datapoints && response.Datapoints.length > 0) {
        const latest = response.Datapoints[response.Datapoints.length - 1];
        return latest?.Maximum || 0;
      }

      return 0;
    } catch (error) {
      console.warn('⚠️  Could not get oldest message age:', error);
      return 0;
    }
  }

  private async calculateMessageRate(): Promise<number> {
    try {
      // Get message count from 5 minutes ago
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // 5 minutes ago

      const command = new GetMetricStatisticsCommand({
        Namespace: 'AWS/SQS',
        MetricName: 'ApproximateNumberOfMessages',
        Dimensions: [
          {
            Name: 'QueueName',
            Value: this.extractQueueName(this.config.dlqUrl)
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300, // 5 minutes
        Statistics: ['Average']
      });

      const response = await this.cloudWatchClient.send(command);
      
      if (response.Datapoints && response.Datapoints.length >= 2) {
        const latest = response.Datapoints[response.Datapoints.length - 1];
        const previous = response.Datapoints[response.Datapoints.length - 2];
        
        if (latest && previous) {
          const messageDiff = (latest.Average || 0) - (previous.Average || 0);
          return Math.max(0, messageDiff); // Messages per 5-minute period
        }
      }

      return 0;
    } catch (error) {
      console.warn('⚠️  Could not calculate message rate:', error);
      return 0;
    }
  }

  private async publishMetricsToCloudWatch(metrics: DLQMetrics): Promise<void> {
    const metricData = [
      {
        MetricName: 'DLQMessageCount',
        Value: metrics.messageCount,
        Unit: 'Count' as const,
        Timestamp: metrics.timestamp,
        Dimensions: [
          {
            Name: 'QueueName',
            Value: metrics.queueName
          }
        ]
      },

      {
        MetricName: 'DLQMessageRate',
        Value: metrics.messageRate,
        Unit: 'Count/Second' as const,
        Timestamp: metrics.timestamp,
        Dimensions: [
          {
            Name: 'QueueName',
            Value: metrics.queueName
          }
        ]
      }
    ];

    const command = new PutMetricDataCommand({
      Namespace: 'NotificationSystem/DLQ',
      MetricData: metricData
    });

    try {
      await this.cloudWatchClient.send(command);
      console.log(`📊 Published DLQ metrics: ${metrics.messageCount} messages, ${metrics.oldestMessageAge}s oldest`);
    } catch (error) {
      console.error('❌ Failed to publish DLQ metrics to CloudWatch:', error);
      throw error;
    }
  }

  private async checkAlertsAndNotify(metrics: DLQMetrics): Promise<void> {
    const alerts = this.evaluateAlerts(metrics);
    
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  private evaluateAlerts(metrics: DLQMetrics): DLQAlert[] {
    const alerts: DLQAlert[] = [];

    // Check message count threshold
    if (metrics.messageCount > this.config.thresholds.messageCount) {
      alerts.push({
        alertType: 'MESSAGE_ACCUMULATION',
        severity: this.getSeverityForMessageCount(metrics.messageCount),
        message: `DLQ ${metrics.queueName} has ${metrics.messageCount} messages (threshold: ${this.config.thresholds.messageCount})`,
        metrics,
        threshold: this.config.thresholds.messageCount,
        currentValue: metrics.messageCount
      });
    }

    // Check oldest message age
    const oldestMessageAgeHours = metrics.oldestMessageAge / 3600;
    if (oldestMessageAgeHours > this.config.thresholds.oldestMessageAgeHours) {
      alerts.push({
        alertType: 'OLD_MESSAGES',
        severity: this.getSeverityForMessageAge(oldestMessageAgeHours),
        message: `DLQ ${metrics.queueName} has messages older than ${oldestMessageAgeHours.toFixed(1)} hours (threshold: ${this.config.thresholds.oldestMessageAgeHours}h)`,
        metrics,
        threshold: this.config.thresholds.oldestMessageAgeHours,
        currentValue: oldestMessageAgeHours
      });
    }

    // Check message rate
    const messageRatePerMinute = metrics.messageRate / 60;
    if (messageRatePerMinute > this.config.thresholds.messageRatePerMinute) {
      alerts.push({
        alertType: 'HIGH_RATE',
        severity: 'HIGH',
        message: `DLQ ${metrics.queueName} receiving messages at ${messageRatePerMinute.toFixed(2)}/min (threshold: ${this.config.thresholds.messageRatePerMinute}/min)`,
        metrics,
        threshold: this.config.thresholds.messageRatePerMinute,
        currentValue: messageRatePerMinute
      });
    }

    return alerts;
  }

  private getSeverityForMessageCount(count: number): DLQAlert['severity'] {
    if (count > 50) return 'CRITICAL';
    if (count > 20) return 'HIGH';
    if (count > 10) return 'MEDIUM';
    return 'LOW';
  }

  private getSeverityForMessageAge(ageHours: number): DLQAlert['severity'] {
    if (ageHours > 24) return 'CRITICAL';
    if (ageHours > 12) return 'HIGH';
    if (ageHours > 6) return 'MEDIUM';
    return 'LOW';
  }

  private async sendAlert(alert: DLQAlert): Promise<void> {
    console.log(`🚨 ${alert.severity} ALERT: ${alert.message}`);

    if (this.config.alertTopicArn) {
      try {
        const alertMessage = {
          alertType: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          queueName: alert.metrics.queueName,
          currentValue: alert.currentValue,
          threshold: alert.threshold,
          timestamp: alert.metrics.timestamp.toISOString(),
          metrics: {
            messageCount: alert.metrics.messageCount,
            oldestMessageAge: alert.metrics.oldestMessageAge,
            messageRate: alert.metrics.messageRate
          }
        };

        const command = new PublishCommand({
          TopicArn: this.config.alertTopicArn,
          Subject: `DLQ Alert: ${alert.alertType} - ${alert.severity}`,
          Message: JSON.stringify(alertMessage, null, 2)
        });

        await this.snsClient.send(command);
        console.log(`📧 Alert sent to SNS topic: ${this.config.alertTopicArn}`);
      } catch (error) {
        console.error('❌ Failed to send alert to SNS:', error);
      }
    }
  }

  private extractQueueName(queueUrl: string): string {
    const parts = queueUrl.split('/');
    return parts[parts.length - 1] || '';
  }

  // Health check method
  async getHealthStatus(): Promise<{
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    metrics: DLQMetrics;
    alerts: DLQAlert[];
  }> {
    try {
      const metrics = await this.collectDLQMetrics();
      const alerts = this.evaluateAlerts(metrics);
      
      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
      
      if (alerts.some(a => a.severity === 'CRITICAL')) {
        status = 'CRITICAL';
      } else if (alerts.some(a => a.severity === 'HIGH' || a.severity === 'MEDIUM')) {
        status = 'WARNING';
      }

      return { status, metrics, alerts };
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  }

  // Dashboard data method
  async getDashboardData(): Promise<{
    currentMetrics: DLQMetrics;
    historicalData: any[];
    alerts: DLQAlert[];
    recommendations: string[];
  }> {
    const currentMetrics = await this.collectDLQMetrics();
    const alerts = this.evaluateAlerts(currentMetrics);
    
    // Get historical data (last 24 hours)
    const historicalData = await this.getHistoricalMetrics(24);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(currentMetrics, alerts);

    return {
      currentMetrics,
      historicalData,
      alerts,
      recommendations
    };
  }

  private async getHistoricalMetrics(hours: number): Promise<any[]> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

      const command = new GetMetricStatisticsCommand({
        Namespace: 'NotificationSystem/DLQ',
        MetricName: 'DLQMessageCount',
        Dimensions: [
          {
            Name: 'QueueName',
            Value: this.extractQueueName(this.config.dlqUrl)
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600, // 1 hour periods
        Statistics: ['Average', 'Maximum']
      });

      const response = await this.cloudWatchClient.send(command);
      return response.Datapoints || [];
    } catch (error) {
      console.warn('⚠️  Could not get historical metrics:', error);
      return [];
    }
  }

  private generateRecommendations(metrics: DLQMetrics, alerts: DLQAlert[]): string[] {
    const recommendations: string[] = [];

    if (metrics.messageCount > 0) {
      recommendations.push('Analyze DLQ messages to identify root causes');
      recommendations.push('Consider reprocessing messages after fixing underlying issues');
    }

    if (alerts.some(a => a.alertType === 'MESSAGE_ACCUMULATION')) {
      recommendations.push('Investigate notification service for processing failures');
      recommendations.push('Check Lambda function logs for error patterns');
    }

    if (alerts.some(a => a.alertType === 'OLD_MESSAGES')) {
      recommendations.push('Review old messages for manual processing or purging');
      recommendations.push('Consider implementing message TTL to prevent indefinite accumulation');
    }

    if (alerts.some(a => a.alertType === 'HIGH_RATE')) {
      recommendations.push('Monitor upstream services for increased error rates');
      recommendations.push('Consider scaling notification processing capacity');
    }

    if (recommendations.length === 0) {
      recommendations.push('DLQ is healthy - continue monitoring');
    }

    return recommendations;
  }
}

// Factory function for creating monitors with common configurations
export function createDLQMonitor(environment: 'local' | 'qa' | 'prod'): DLQMonitor {
  const configs = {
    local: {
      dlqUrl: 'http://localhost:4566/000000000000/user-notifications-dlq',
      thresholds: {
        messageCount: 5,
        oldestMessageAgeHours: 1,
        messageRatePerMinute: 2
      },
      monitoringInterval: 30000 // 30 seconds
    },
    qa: {
      dlqUrl: 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-dlq',
      alertTopicArn: 'arn:aws:sns:us-east-1:582491219315:qa-dlq-alerts',
      thresholds: {
        messageCount: 10,
        oldestMessageAgeHours: 2,
        messageRatePerMinute: 5
      },
      monitoringInterval: 60000 // 1 minute
    },
    prod: {
      dlqUrl: 'https://sqs.us-east-1.amazonaws.com/582491219315/prod-user-notifications-dlq',
      alertTopicArn: 'arn:aws:sns:us-east-1:582491219315:prod-dlq-alerts',
      thresholds: {
        messageCount: 20,
        oldestMessageAgeHours: 4,
        messageRatePerMinute: 10
      },
      monitoringInterval: 300000 // 5 minutes
    }
  };

  return new DLQMonitor(configs[environment]);
}

export { DLQMonitor, type DLQMetrics, type DLQAlert, type MonitoringConfig };