# DLQ Management System

This document describes the comprehensive Dead Letter Queue (DLQ) management system implemented for the notification email failure triage.

## Overview

The DLQ management system provides tools for:
- **Analysis**: Categorize and analyze failed messages in the DLQ
- **Reprocessing**: Selectively reprocess messages after fixes are deployed
- **Monitoring**: Real-time monitoring with alerting for message accumulation
- **Reporting**: Detailed reports and recommendations for operational insights

## Components

### 1. DLQ Analyzer (`dlq-analysis-comprehensive.ts`)

Analyzes messages in the DLQ to identify patterns and root causes.

**Features:**
- Categorizes messages by error type (EVENT_DETECTION_ERROR, INVALID_MESSAGE_FORMAT, etc.)
- Identifies reprocessable vs non-reprocessable messages
- Correlates with CloudWatch logs for detailed error analysis
- Generates comprehensive reports with recommendations

**Usage:**
```bash
npm run dlq:analyze -- --output ./reports --verbose
```

### 2. DLQ Message Reprocessor (`dlq-message-reprocessor.ts`)

Provides selective reprocessing capabilities for DLQ messages.

**Features:**
- Dry-run mode for safe testing
- Selective reprocessing by message ID or criteria
- Batch processing with configurable batch sizes
- Comprehensive error handling and reporting
- Rollback capabilities

**Usage:**
```bash
# Dry run (recommended first)
npm run dlq:reprocess -- --dry-run --max 10

# Reprocess specific messages
npm run dlq:reprocess -- --ids "msg-123,msg-456" --dry-run

# Actual reprocessing (after testing)
npm run dlq:reprocess -- --max 5 --batch-size 3
```

### 3. DLQ Monitor (`dlq-monitoring.ts`)

Real-time monitoring system with CloudWatch integration.

**Features:**
- Custom CloudWatch metrics collection
- Configurable alerting thresholds
- Health status reporting
- Dashboard data generation
- SNS alert notifications

**Usage:**
```bash
# Single status check
npm run dlq:status -- --environment qa

# Continuous monitoring
npm run dlq:monitor -- --environment qa --watch --interval 30

# Get detailed monitoring data
npm run dlq:monitor -- --environment qa
```

### 4. CloudWatch Dashboard (`dlq-dashboard.tf`)

Terraform configuration for CloudWatch dashboard and alarms.

**Features:**
- Real-time DLQ metrics visualization
- Lambda function performance metrics
- Error log analysis
- Automated alerting rules

## CLI Commands

### Analysis Commands

```bash
# Analyze DLQ messages
npm run dlq:analyze

# Analyze with custom output directory
npm run dlq:analyze -- --output ./custom-reports --verbose
```

### Reprocessing Commands

```bash
# Dry run reprocessing (safe)
npm run dlq:reprocess -- --dry-run --max 10

# Reprocess specific messages
npm run dlq:reprocess -- --ids "message-id-1,message-id-2" --dry-run

# Actual reprocessing with batch control
npm run dlq:reprocess -- --max 5 --batch-size 3

# Reprocess all reprocessable messages
npm run dlq:reprocess -- --max 50 --batch-size 5
```

### Monitoring Commands

```bash
# Quick status check
npm run dlq:status

# Status for specific environment
npm run dlq:status -- --environment prod

# Continuous monitoring
npm run dlq:monitor -- --watch --interval 60

# Single monitoring check with details
npm run dlq:monitor -- --environment qa
```

## Error Categories

The system categorizes DLQ messages into the following error types:

### EVENT_DETECTION_ERROR
- **Cause**: Undefined property access in event detection logic
- **Reprocessable**: Yes
- **Fix Required**: Update notification service event detection code

### INVALID_MESSAGE_FORMAT
- **Cause**: Message does not have valid SNS structure
- **Reprocessable**: No
- **Action**: Investigate SNS publishing logic

### INVALID_EVENT_DATA
- **Cause**: Event data missing required fields
- **Reprocessable**: No
- **Action**: Fix upstream event generation

### VALIDATION_ERROR
- **Cause**: Event data failed validation checks
- **Reprocessable**: Yes
- **Fix Required**: Update validation logic or fix data format

### PROCESSING_TIMEOUT
- **Cause**: Lambda function timeout during processing
- **Reprocessable**: Yes
- **Fix Required**: Optimize Lambda performance or increase timeout

### REPEATED_FAILURE
- **Cause**: Message failed processing multiple times
- **Reprocessable**: No
- **Action**: Manual investigation required

## Monitoring Thresholds

### QA Environment
- **Message Count**: Alert when > 10 messages
- **Message Age**: Alert when oldest message > 2 hours
- **Message Rate**: Alert when > 5 messages/minute

### Production Environment
- **Message Count**: Alert when > 20 messages
- **Message Age**: Alert when oldest message > 4 hours
- **Message Rate**: Alert when > 10 messages/minute

## Integration Tests

Comprehensive integration tests are provided in `dlq-handling.integration.test.ts`:

```bash
# Run DLQ integration tests
npm run test:integration -- --testNamePattern="DLQ"

# Run all integration tests
npm run test:integration
```

**Test Coverage:**
- DLQ message analysis accuracy
- Reprocessing functionality
- Monitoring and alerting
- Error recovery workflows
- Performance under load
- Concurrent operations safety

## Operational Procedures

### 1. Daily DLQ Health Check

```bash
# Check DLQ status
npm run dlq:status -- --environment qa

# If messages are present, analyze them
npm run dlq:analyze -- --output ./daily-reports
```

### 2. After Deploying Fixes

```bash
# 1. Analyze current DLQ state
npm run dlq:analyze

# 2. Test reprocessing (dry run)
npm run dlq:reprocess -- --dry-run --max 10

# 3. Reprocess reprocessable messages
npm run dlq:reprocess -- --max 10 --batch-size 3

# 4. Monitor results
npm run dlq:monitor -- --watch --interval 30
```

### 3. Emergency Response

```bash
# 1. Quick status check
npm run dlq:status

# 2. Analyze for critical issues
npm run dlq:analyze -- --verbose

# 3. Check monitoring for alerts
npm run dlq:monitor

# 4. If safe, reprocess critical messages
npm run dlq:reprocess -- --ids "critical-msg-id" --dry-run
```

## Report Formats

### Analysis Reports

**JSON Report** (`dlq-analysis-TIMESTAMP.json`):
- Complete structured data
- Detailed message analysis
- Log entries and correlations
- Machine-readable format

**Markdown Summary** (`dlq-analysis-summary-TIMESTAMP.md`):
- Human-readable summary
- Key metrics and trends
- Recommendations and actions
- Executive summary format

### Reprocessing Reports

**JSON Report** (`dlq-reprocessing-TIMESTAMP.json`):
- Detailed processing results
- Individual message outcomes
- Performance metrics
- Error details

**Markdown Summary** (`dlq-reprocessing-summary-TIMESTAMP.md`):
- Processing summary
- Success/failure breakdown
- Recommendations for next steps

## Best Practices

### 1. Safety First
- Always use `--dry-run` before actual reprocessing
- Start with small batch sizes
- Monitor system health during reprocessing
- Have rollback procedures ready

### 2. Regular Monitoring
- Check DLQ status daily
- Set up automated alerting
- Review analysis reports weekly
- Track trends over time

### 3. Incident Response
- Analyze before reprocessing
- Document root causes
- Update monitoring thresholds based on learnings
- Share findings with team

### 4. Performance Optimization
- Use appropriate batch sizes
- Monitor Lambda performance during reprocessing
- Consider provisioned concurrency for high-volume scenarios
- Implement circuit breakers for external dependencies

## Troubleshooting

### Common Issues

**1. Analysis Takes Too Long**
- Reduce the time window for log analysis
- Use more specific log filters
- Consider running analysis in smaller batches

**2. Reprocessing Fails**
- Check Lambda function health
- Verify SQS queue permissions
- Ensure original queue is accessible
- Review batch size settings

**3. Monitoring Alerts Not Working**
- Verify SNS topic configuration
- Check CloudWatch alarm settings
- Confirm IAM permissions for metrics publishing
- Test alert delivery manually

**4. High Memory Usage**
- Reduce batch sizes
- Implement streaming for large datasets
- Add memory monitoring
- Consider Lambda memory allocation

### Debug Commands

```bash
# Test DLQ connectivity
aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names All

# Check Lambda function logs
aws logs filter-log-events --log-group-name /aws/lambda/qa-notification-service --start-time $(date -d '1 hour ago' +%s)000

# Verify SNS topic
aws sns get-topic-attributes --topic-arn $SNS_TOPIC_ARN

# Test SQS permissions
aws sqs send-message --queue-url $QUEUE_URL --message-body "test"
```

## Security Considerations

### IAM Permissions
- Minimum required permissions for each operation
- Separate roles for analysis vs reprocessing
- Audit trail for all DLQ operations
- Secure handling of message content

### Data Protection
- No sensitive data in logs
- Encrypted message content
- Secure report storage
- GDPR compliance for user data

### Access Control
- Role-based access to DLQ operations
- Audit logging for all actions
- Secure CLI authentication
- Environment-specific permissions

## Future Enhancements

### Planned Features
- Web-based dashboard for DLQ management
- Automated reprocessing based on error patterns
- Machine learning for error prediction
- Integration with incident management systems

### Monitoring Improvements
- Predictive alerting based on trends
- Custom metrics for business impact
- Integration with APM tools
- Real-time notification delivery tracking

### Performance Optimizations
- Parallel processing for large DLQs
- Streaming analysis for memory efficiency
- Caching for frequently accessed data
- Connection pooling for AWS services

This DLQ management system provides comprehensive tools for handling notification failures and ensuring reliable email delivery in the ebook publishing platform.