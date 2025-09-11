#!/bin/bash

# Book Workflow Notifications - Integration Test Runner
# Runs comprehensive end-to-end integration tests for the notification system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_ENV="integration"
TEST_TIMEOUT="60000"
MAX_WORKERS="1"

echo -e "${BLUE}🧪 Book Workflow Notifications - Integration Test Suite${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo ""

# Function to print section headers
print_section() {
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}$(printf '=%.0s' $(seq 1 ${#1}))${NC}"
}

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

# Set environment variables for testing
export NODE_ENV="test"
export AWS_REGION="us-east-1"
export NOTIFICATION_TARGET_EMAIL="bookmanagement@yopmail.com"
export FROM_EMAIL="noreply@test.com"
export FRONTEND_BASE_URL="https://test.bookmanagement.com"
export BOOK_EVENTS_SNS_TOPIC_ARN="arn:aws:sns:us-east-1:123456789012:test-book-events"
export BOOK_NOTIFICATIONS_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/123456789012/test-book-notifications"

print_section "Environment Setup"
echo "NODE_ENV: $NODE_ENV"
echo "AWS_REGION: $AWS_REGION"
echo "Target Email: $NOTIFICATION_TARGET_EMAIL"
echo "Test Timeout: ${TEST_TIMEOUT}ms"
echo "Max Workers: $MAX_WORKERS"
echo ""

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must be run from the backend directory${NC}"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installing dependencies...${NC}"
    npm install
fi

# Build the project
print_section "Building Project"
echo "Building TypeScript project..."
npm run build
print_result $? "Project build completed"
echo ""

# Run the integration tests
print_section "Running Integration Tests"

# Test 1: Core End-to-End Flow Tests
echo -e "${YELLOW}Running core end-to-end flow tests...${NC}"
npx jest \
    --config jest.integration.config.js \
    --testPathPattern="book-workflow-notifications.integration.test.ts" \
    --testTimeout=$TEST_TIMEOUT \
    --maxWorkers=$MAX_WORKERS \
    --verbose \
    --detectOpenHandles \
    --forceExit

CORE_TESTS_EXIT_CODE=$?
print_result $CORE_TESTS_EXIT_CODE "Core end-to-end flow tests"
echo ""

# Test 2: Performance and Monitoring Tests
echo -e "${YELLOW}Running performance and monitoring tests...${NC}"
npx jest \
    --config jest.integration.config.js \
    --testPathPattern="book-workflow-notifications-performance.integration.test.ts" \
    --testTimeout=$TEST_TIMEOUT \
    --maxWorkers=$MAX_WORKERS \
    --verbose \
    --detectOpenHandles \
    --forceExit

PERFORMANCE_TESTS_EXIT_CODE=$?
print_result $PERFORMANCE_TESTS_EXIT_CODE "Performance and monitoring tests"
echo ""

# Test 3: All Integration Tests Together
echo -e "${YELLOW}Running all integration tests together...${NC}"
npx jest \
    --config jest.integration.config.js \
    --testPathPattern="integration" \
    --testTimeout=$TEST_TIMEOUT \
    --maxWorkers=$MAX_WORKERS \
    --verbose \
    --detectOpenHandles \
    --forceExit

ALL_TESTS_EXIT_CODE=$?
print_result $ALL_TESTS_EXIT_CODE "All integration tests"
echo ""

# Generate test coverage report
print_section "Test Coverage Report"
echo -e "${YELLOW}Generating coverage report for integration tests...${NC}"
npx jest \
    --config jest.integration.config.js \
    --testPathPattern="integration" \
    --coverage \
    --coverageDirectory="coverage-integration" \
    --testTimeout=$TEST_TIMEOUT \
    --maxWorkers=$MAX_WORKERS \
    --detectOpenHandles \
    --forceExit

COVERAGE_EXIT_CODE=$?
print_result $COVERAGE_EXIT_CODE "Coverage report generation"
echo ""

# Summary
print_section "Test Results Summary"
echo ""

TOTAL_FAILURES=0

if [ $CORE_TESTS_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Core End-to-End Flow Tests: PASSED${NC}"
else
    echo -e "${RED}❌ Core End-to-End Flow Tests: FAILED${NC}"
    TOTAL_FAILURES=$((TOTAL_FAILURES + 1))
fi

if [ $PERFORMANCE_TESTS_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Performance and Monitoring Tests: PASSED${NC}"
else
    echo -e "${RED}❌ Performance and Monitoring Tests: FAILED${NC}"
    TOTAL_FAILURES=$((TOTAL_FAILURES + 1))
fi

if [ $ALL_TESTS_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All Integration Tests: PASSED${NC}"
else
    echo -e "${RED}❌ All Integration Tests: FAILED${NC}"
    TOTAL_FAILURES=$((TOTAL_FAILURES + 1))
fi

if [ $COVERAGE_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Coverage Report: GENERATED${NC}"
else
    echo -e "${RED}❌ Coverage Report: FAILED${NC}"
    TOTAL_FAILURES=$((TOTAL_FAILURES + 1))
fi

echo ""
print_section "Final Result"

if [ $TOTAL_FAILURES -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL INTEGRATION TESTS PASSED!${NC}"
    echo -e "${GREEN}The book workflow notification system is working correctly.${NC}"
    echo ""
    echo -e "${BLUE}Coverage report available at: coverage-integration/lcov-report/index.html${NC}"
    exit 0
else
    echo -e "${RED}💥 $TOTAL_FAILURES TEST SUITE(S) FAILED${NC}"
    echo -e "${RED}Please review the test output above for details.${NC}"
    echo ""
    echo -e "${YELLOW}Common troubleshooting steps:${NC}"
    echo "1. Check that all dependencies are installed: npm install"
    echo "2. Verify the build completed successfully: npm run build"
    echo "3. Check environment variables are set correctly"
    echo "4. Review test logs for specific error messages"
    echo "5. Ensure no other processes are using test resources"
    exit 1
fi