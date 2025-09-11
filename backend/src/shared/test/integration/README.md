# Book Workflow Notifications - Integration Tests

## Overview

This directory contains comprehensive end-to-end integration tests for the book workflow notification system. The tests verify the complete flow from book status changes to email delivery, including error handling, retry mechanisms, and performance characteristics.

## Test Coverage

### Core End-to-End Flow Tests (`book-workflow-notifications.integration.test.ts`)

#### Complete Workflow Tests
- **Book Submitted**: Tests the complete flow when a book is submitted for editing
  - Verifies event publishing from workflow service
  - Validates SQS event processing in notification service
  - Confirms email delivery with correct content
  - Checks email includes book details, submission notes, and action URLs

- **Book Approved**: Tests the approval workflow
  - Validates approval event generation and processing
  - Verifies approval email content and formatting
  - Confirms action URLs point to publication interface

- **Book Rejected**: Tests the rejection workflow
  - Validates rejection event handling (status transition back to editing)
  - Verifies rejection email with feedback and revision instructions
  - Confirms action URLs point to editing interface

- **Book Published**: Tests the publication workflow
  - Validates publication event and email delivery
  - Verifies congratulatory email content
  - Confirms action URLs point to published book view

#### Error Scenarios and Retry Mechanisms
- **Transient SES Errors**: Tests retry logic for temporary failures
  - Simulates throttling and service unavailable errors
  - Verifies exponential backoff and eventual success
  - Validates retry count tracking and batch failure handling

- **Permanent SES Errors**: Tests DLQ handling for permanent failures
  - Simulates invalid email addresses and quota exceeded errors
  - Verifies messages go directly to DLQ without retry
  - Validates error logging and metrics emission

- **Invalid Event Schema**: Tests validation and error handling
  - Tests events with missing required fields
  - Tests events with invalid status transitions
  - Verifies validation failures go to DLQ immediately

- **Batch Processing**: Tests mixed success/failure scenarios
  - Processes batches with valid and invalid events
  - Verifies partial batch failure handling
  - Validates individual event success/failure tracking

#### Email Content and Delivery Verification
- **Content Generation**: Tests email template generation
  - Verifies subject lines match notification types
  - Validates HTML and text body content
  - Confirms book details are included correctly

- **Action URLs**: Tests dynamic URL generation
  - Verifies URLs are generated based on status transitions
  - Validates environment-specific base URLs
  - Confirms URLs point to correct frontend pages

- **Target Email Configuration**: Tests email delivery configuration
  - Verifies emails are sent to configured target address
  - Tests environment variable configuration
  - Validates sender email configuration

### Performance and Monitoring Tests (`book-workflow-notifications-performance.integration.test.ts`)

#### Performance Tests
- **Single Event Processing**: Tests individual event processing time
  - Validates processing completes within 2-second threshold
  - Measures end-to-end latency from event to email

- **Batch Processing**: Tests batch processing performance
  - Processes batches of 10 events within 5-second threshold
  - Validates linear scaling of processing time

- **Concurrent Processing**: Tests high-volume concurrent scenarios
  - Processes 5 concurrent batches of 5 events each
  - Validates system handles concurrent load within 8-second threshold

- **Memory Pressure**: Tests performance under memory constraints
  - Processes events with large metadata payloads (3KB+ each)
  - Validates performance remains acceptable under memory pressure

#### Monitoring and Metrics Tests
- **Performance Metrics**: Tests performance monitoring integration
  - Verifies batch processing metrics are emitted
  - Validates event processing time tracking
  - Confirms email delivery time monitoring

- **CloudWatch Metrics**: Tests CloudWatch integration
  - Verifies success/failure rate metrics
  - Validates DLQ message metrics
  - Confirms error type classification

- **Processing Time Tracking**: Tests performance trend analysis
  - Tracks processing times across different batch sizes
  - Validates performance thresholds (500ms per event)
  - Analyzes scaling characteristics

## Test Architecture

### Test Structure
```
backend/src/test/integration/
├── book-workflow-notifications.integration.test.ts     # Core E2E tests
├── book-workflow-notifications-performance.integration.test.ts  # Performance tests
├── run-integration-tests.sh                           # Test runner script
└── README.md                                          # This documentation
```

### Mock Strategy
- **AWS SDK Mocking**: Uses `aws-sdk-client-mock` for SNS, SQS, and SES
- **Event Publisher Mocking**: Uses `MockBookEventPublisher` for controlled testing
- **Service Integration**: Tests real service integration with mocked AWS calls

### Test Data Management
- **Isolated Test Data**: Each test uses unique book IDs and event IDs
- **Configurable Environment**: Environment variables control test behavior
- **Clean State**: Tests reset mocks and state between runs

## Running the Tests

### Prerequisites
- Node.js 18+ installed
- Backend dependencies installed (`npm install`)
- Project built (`npm run build`)

### Running Individual Test Suites

```bash
# Core end-to-end flow tests
npm run test:integration -- --testPathPattern="book-workflow-notifications.integration.test.ts"

# Performance and monitoring tests
npm run test:integration -- --testPathPattern="book-workflow-notifications-performance.integration.test.ts"

# All integration tests
npm run test:integration -- --testPathPattern="integration"
```

### Running with the Test Runner Script

```bash
# Run comprehensive test suite with reporting
./backend/src/test/integration/run-integration-tests.sh
```

The test runner script provides:
- Environment setup and validation
- Sequential test execution with detailed reporting
- Coverage report generation
- Comprehensive result summary
- Troubleshooting guidance

### Test Configuration

#### Environment Variables
```bash
NODE_ENV=test
AWS_REGION=us-east-1
NOTIFICATION_TARGET_EMAIL=bookmanagement@yopmail.com
FROM_EMAIL=noreply@test.com
FRONTEND_BASE_URL=https://test.bookmanagement.com
BOOK_EVENTS_SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:test-book-events
BOOK_NOTIFICATIONS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/test-book-notifications
```

#### Jest Configuration
- **Timeout**: 60 seconds for integration tests
- **Workers**: Single worker to avoid resource conflicts
- **Coverage**: Generates detailed coverage reports
- **Handle Detection**: Detects and reports open handles

## Test Scenarios Covered

### Requirements Validation

The integration tests validate all requirements from the specification:

#### Requirement 2.1 - Book Submitted Notifications
- ✅ Tests complete workflow for book submission
- ✅ Verifies email content includes book details
- ✅ Validates notification timing and delivery

#### Requirement 2.2 - Book Approved Notifications  
- ✅ Tests approval workflow and email generation
- ✅ Verifies approval-specific email content
- ✅ Validates action URLs for publication

#### Requirement 2.3 - Book Rejected Notifications
- ✅ Tests rejection workflow (status transition back)
- ✅ Verifies rejection email with feedback
- ✅ Validates revision instructions and URLs

#### Requirement 2.4 - Book Published Notifications
- ✅ Tests publication workflow completion
- ✅ Verifies congratulatory email content
- ✅ Validates published book access URLs

#### Requirement 3.1 - Email Delivery to Target Address
- ✅ Tests email delivery to configured address
- ✅ Verifies environment variable configuration
- ✅ Validates sender email configuration

#### Requirement 4.1 - Reliable Message Processing
- ✅ Tests retry mechanisms for transient failures
- ✅ Verifies DLQ handling for permanent failures
- ✅ Validates batch processing with partial failures

## Performance Benchmarks

### Acceptable Performance Thresholds
- **Single Event**: < 2 seconds end-to-end
- **Batch Processing (10 events)**: < 5 seconds
- **Concurrent Processing (25 events)**: < 8 seconds
- **Per-Event Processing**: < 500ms average
- **Memory Pressure (large events)**: < 10 seconds

### Monitoring Metrics
- **Success Rate**: > 99% for valid events
- **Retry Success Rate**: > 95% for transient failures
- **DLQ Rate**: < 1% for normal operations
- **Processing Time**: Tracked and alerted on thresholds

## Troubleshooting

### Common Issues

#### Test Timeouts
- **Cause**: Network latency or resource contention
- **Solution**: Increase timeout or reduce concurrent workers
- **Command**: `--testTimeout=120000` for 2-minute timeout

#### Mock Failures
- **Cause**: AWS SDK mock configuration issues
- **Solution**: Verify mock setup and reset between tests
- **Debug**: Enable verbose logging with `--verbose`

#### Memory Issues
- **Cause**: Large test data or memory leaks
- **Solution**: Use `--detectOpenHandles` and `--forceExit`
- **Monitor**: Check Node.js memory usage during tests

#### Environment Configuration
- **Cause**: Missing or incorrect environment variables
- **Solution**: Verify all required variables are set
- **Check**: Review environment setup in test runner

### Debug Commands

```bash
# Run with verbose output
npm run test:integration -- --verbose --testPathPattern="integration"

# Run with open handle detection
npm run test:integration -- --detectOpenHandles --testPathPattern="integration"

# Run single test file with debugging
npm run test:integration -- --testPathPattern="book-workflow-notifications.integration.test.ts" --verbose

# Generate coverage report
npm run test:integration -- --coverage --testPathPattern="integration"
```

## Continuous Integration

### CI/CD Integration
The integration tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions configuration
- name: Run Integration Tests
  run: |
    cd backend
    npm install
    npm run build
    ./src/test/integration/run-integration-tests.sh
  env:
    NODE_ENV: test
    AWS_REGION: us-east-1
    NOTIFICATION_TARGET_EMAIL: ci-test@example.com
```

### Test Reporting
- **JUnit XML**: Compatible with CI/CD test reporting
- **Coverage Reports**: LCOV format for coverage tracking
- **Performance Metrics**: JSON output for trend analysis

## Maintenance

### Adding New Tests
1. Follow existing test patterns and naming conventions
2. Use helper functions for common test setup
3. Include both positive and negative test cases
4. Add performance validation for new features
5. Update documentation with new test scenarios

### Updating Test Data
1. Use realistic but anonymized test data
2. Ensure test data doesn't conflict between tests
3. Update test data when schema changes
4. Maintain backward compatibility where possible

### Performance Monitoring
1. Review performance benchmarks regularly
2. Update thresholds based on infrastructure changes
3. Monitor test execution times in CI/CD
4. Alert on performance regressions

The integration test suite provides comprehensive validation of the book workflow notification system, ensuring reliability, performance, and correctness of the end-to-end flow from status changes to email delivery.