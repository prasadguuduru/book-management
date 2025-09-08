# Book Workflow Notifications - Logging and Monitoring

This document describes the comprehensive logging and monitoring implementation for the book workflow notifications system.

## Overview

The logging and monitoring system provides:

- **Structured Logging**: Consistent, searchable log format across all event processing
- **Performance Monitoring**: Real-time performance tracking with configurable thresholds
- **CloudWatch Metrics**: Custom metrics for monitoring success/failure rates and performance
- **Error Tracking**: Comprehensive error logging with context and retry information
- **System Health Monitoring**: Memory, CPU, and uptime tracking

## Components

### 1. Structured Logger (`structured-logger.ts`)

Provides standardized logging for all event processing operations.

#### Key Features:
- **Event Processing Logging**: Start, success, failure tracking
- **Email Delivery Logging**: Attempt, success, failure with timing
- **Batch Processing Metrics**: Success rates and processing times
- **Performance Warnings**: Configurable threshold-based alerts
- **DLQ Logging**: Dead letter queue message tracking
- **Validation Logging**: Schema and business rule validation failures

#### Usage Example:
```typescript
import { EventProcessingLogger } from '../shared/monitoring/structured-logger';

const context = {
  requestId: 'req-123',
  eventId: 'evt-456',
  bookId: 'book-789',
  notificationType: 'book_submitted'
};

EventProcessingLogger.logEventProcessingStart(context);
// ... processing logic
EventProcessingLogger.logEventProcessingSuccess({
  ...context,
  processingTimeMs: 1500
});
```

### 2. Performance Monitor (`performance-monitor.ts`)

Wraps operations with performance monitoring and threshold checking.

#### Key Features:
- **Operation Wrapping**: Automatic timing and metrics collection
- **Threshold Monitoring**: Configurable warning and critical thresholds
- **CloudWatch Integration**: Automatic metrics emission
- **Error Handling**: Graceful failure handling with metrics
- **System Health**: Memory and CPU monitoring

#### Performance Thresholds:
```typescript
const DEFAULT_THRESHOLDS = {
  eventProcessing: { warning: 5000, critical: 30000 },    // ms
  emailDelivery: { warning: 3000, critical: 10000 },      // ms
  batchProcessing: { warning: 10000, critical: 60000 },   // ms
  snsPublishing: { warning: 2000, critical: 5000 }        // ms
};
```

#### Usage Example:
```typescript
import { performanceMonitor } from '../shared/monitoring/performance-monitor';

const result = await performanceMonitor.monitorEventProcessing(async () => {
  // Your event processing logic here
  return await processEvent(event);
}, context);
```

### 3. Enhanced CloudWatch Metrics (`cloudwatch-metrics.ts`)

Extended CloudWatch metrics service with additional monitoring capabilities.

#### New Metrics:
- **Performance Alerts**: `PerformanceAlert`, `PerformanceAlertProcessingTime`
- **System Health**: `MemoryUsagePercent`, `UptimeSeconds`, `CPUUsagePercent`
- **Queue Monitoring**: `QueueDepth`, `QueueInFlightMessages`
- **Error Rates**: `ErrorRate`, `TotalRequests`, `ErrorCount`

#### Usage Example:
```typescript
import { cloudWatchMetrics } from '../services/cloudwatch-metrics';

// Record performance alert
await cloudWatchMetrics.recordPerformanceAlert(
  'EVENT_PROCESSING',
  'CRITICAL',
  35000,
  { bookId: 'book-123' }
);

// Record system health
await cloudWatchMetrics.recordSystemHealthMetrics(75.5, 3600, 45.2);
```

## Integration Points

### 1. SQS Event Handler

The SQS event handler has been enhanced with:

- **Structured logging** for all processing steps
- **Performance monitoring** for event and email processing
- **Enhanced error handling** with detailed context
- **Batch processing metrics** with success rates

### 2. SNS Event Publisher

The SNS event publisher includes:

- **Structured logging** for publish attempts and results
- **Performance monitoring** for SNS operations
- **Retry logging** with attempt tracking
- **Failure analysis** with detailed error context

### 3. Workflow Service Integration

The workflow service provides:

- **Event publishing monitoring** with performance tracking
- **Status transition logging** with business context
- **Error handling** that doesn't block workflow operations

## Log Structure

All logs follow a consistent JSON structure:

```json
{
  "timestamp": "2025-01-01T12:00:00.000Z",
  "level": "INFO",
  "message": "✅ EVENT PROCESSING SUCCESS",
  "environment": "prod",
  "service": "ebook-backend",
  "version": "1.0.0",
  "operation": "EVENT_PROCESSING_SUCCESS",
  "category": "EVENT_PROCESSING",
  "status": "SUCCESS",
  "requestId": "req-123",
  "eventId": "evt-456",
  "bookId": "book-789",
  "notificationType": "submitted_to_approved",
  "processingTimeMs": 1500
}
```

## Monitoring and Alerting

### CloudWatch Dashboards

Create dashboards to monitor:

1. **Event Processing Metrics**
   - Success/failure rates
   - Processing times
   - Queue depths

2. **Performance Metrics**
   - Threshold violations
   - Processing time distributions
   - System health indicators

3. **Error Tracking**
   - Error rates by type
   - DLQ message counts
   - Retry patterns

### Recommended Alarms

1. **High Error Rate**: Error rate > 5% over 5 minutes
2. **Queue Depth**: Queue depth > 100 messages
3. **DLQ Messages**: Any messages in DLQ
4. **Performance Critical**: Processing time > 30 seconds
5. **High Memory Usage**: Memory usage > 90%

## Configuration

### Environment Variables

```bash
# CloudWatch Configuration
AWS_REGION=us-east-1
ENVIRONMENT=prod

# Performance Thresholds (optional)
EVENT_PROCESSING_WARNING_MS=5000
EVENT_PROCESSING_CRITICAL_MS=30000
EMAIL_DELIVERY_WARNING_MS=3000
EMAIL_DELIVERY_CRITICAL_MS=10000
```

### Custom Thresholds

```typescript
import { performanceMonitor } from '../shared/monitoring/performance-monitor';

performanceMonitor.updateThresholds({
  eventProcessing: {
    warning: 3000,
    critical: 15000
  }
});
```

## Testing

The monitoring system includes comprehensive tests:

- **Unit Tests**: All logging functions and performance monitoring
- **Integration Tests**: End-to-end monitoring workflows
- **Mock Support**: Full mocking for CloudWatch and external dependencies

Run tests:
```bash
npm test -- --testPathPattern="structured-logger|performance-monitor|cloudwatch-metrics"
```

## Best Practices

### 1. Context Propagation
Always pass context through the call chain:
```typescript
const context = { requestId, eventId, bookId };
// Pass context to all logging calls
```

### 2. Error Handling
Log errors with full context but don't fail operations:
```typescript
try {
  await operation();
} catch (error) {
  EventProcessingLogger.logEventProcessingFailure(error, context);
  // Continue with fallback or retry logic
}
```

### 3. Performance Monitoring
Wrap expensive operations with monitoring:
```typescript
const result = await performanceMonitor.monitorEventProcessing(
  async () => await expensiveOperation(),
  context
);
```

### 4. Metric Naming
Use consistent metric naming conventions:
- Operation type (e.g., `EVENT_PROCESSING`)
- Status (e.g., `SUCCESS`, `FAILURE`)
- Dimensions for filtering (e.g., `NotificationType`, `ErrorType`)

## Troubleshooting

### Common Issues

1. **Missing Context**: Ensure all operations include proper context
2. **Performance Alerts**: Check thresholds and system resources
3. **CloudWatch Errors**: Verify IAM permissions and region configuration
4. **Memory Leaks**: Monitor system health metrics regularly

### Debug Logging

Enable debug logging for detailed information:
```bash
LOG_LEVEL=debug
```

This will include additional context and timing information in logs.