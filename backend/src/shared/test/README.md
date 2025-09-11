# Workflow Testing Suite

## Overview

This directory contains comprehensive testing documentation and scripts for validating the current workflow functionality before and after the workflow service refactoring.

## Files in this Directory

### Documentation Files

1. **`workflow-comprehensive-test-suite.md`**
   - Complete test suite documentation with all test scenarios
   - Covers happy path, error cases, edge cases, and performance testing
   - Includes curl commands and expected responses
   - Serves as the master reference for all workflow testing

2. **`current-workflow-endpoints-documentation.md`**
   - Detailed documentation of all existing workflow endpoints
   - Complete API specification with request/response formats
   - Access control rules and validation requirements
   - Error codes and response formats

3. **`workflow-validation-checklist.md`**
   - Comprehensive checklist for validating workflow functionality
   - Pre-refactoring and post-refactoring validation items
   - Performance, security, and integration requirements
   - Sign-off criteria for refactoring completion

### Executable Scripts

1. **`scripts/test-current-workflow.sh`**
   - Automated test script for current workflow functionality
   - Creates test users, books, and executes all workflow operations
   - Validates permissions, error handling, and state transitions
   - Provides pass/fail results with detailed output

## Usage Instructions

### Running the Automated Test Suite

```bash
# Make sure you're in the project root directory
cd /path/to/your/project

# Run the comprehensive workflow test
./backend/src/test/scripts/test-current-workflow.sh
```

The script will:
1. Create test users for each role (AUTHOR, EDITOR, PUBLISHER)
2. Test all workflow operations with proper permissions
3. Validate error scenarios and edge cases
4. Provide a summary of passed/failed tests

### Manual Testing

Use the documentation files to perform manual testing:

1. **Reference**: `current-workflow-endpoints-documentation.md`
2. **Test Cases**: `workflow-comprehensive-test-suite.md`
3. **Validation**: `workflow-validation-checklist.md`

### Environment Requirements

- QA environment deployed and accessible
- API Gateway and Lambda functions working
- DynamoDB tables created and accessible
- Authentication service functional

### Environment Variables

The test script uses these API endpoints:
- `QA_API_BASE`: CloudFront distribution URL
- `QA_DIRECT_API`: Direct API Gateway URL

These are configured in the script but can be overridden:

```bash
export QA_API_BASE="https://your-cloudfront-domain.cloudfront.net/api"
export QA_DIRECT_API="https://your-api-gateway.execute-api.region.amazonaws.com/stage/api"
```

## Test Categories

### 1. Core Workflow Operations
- Book creation and initial DRAFT state
- Author submission (DRAFT → SUBMITTED_FOR_EDITING)
- Editor approval (SUBMITTED_FOR_EDITING → READY_FOR_PUBLICATION)
- Editor rejection (SUBMITTED_FOR_EDITING → DRAFT)
- Publisher publication (READY_FOR_PUBLICATION → PUBLISHED)

### 2. Role-Based Access Control
- AUTHOR permissions and restrictions
- EDITOR permissions and restrictions
- PUBLISHER permissions and restrictions
- READER permissions and restrictions

### 3. Error Handling
- Authentication errors (missing/invalid tokens)
- Authorization errors (wrong roles)
- Validation errors (invalid state transitions)
- Not found errors (non-existent books)

### 4. Edge Cases
- Concurrent operations
- Invalid state transitions
- Book not found scenarios
- Malformed requests

### 5. Integration Testing
- Complete workflow end-to-end
- Multiple user scenarios
- Cross-service communication
- CORS validation

## Expected Results

### Success Criteria
- All automated tests pass (0 failures)
- Response times under acceptable thresholds
- Proper error handling for all scenarios
- Correct state transitions and data integrity
- Proper access control enforcement

### Performance Benchmarks
- Book creation: < 2000ms
- State transitions: < 1500ms
- Book retrieval: < 1000ms
- Concurrent operations: 10+ requests handled

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify API Gateway and custom authorizer are deployed
   - Check JWT token generation and validation
   - Ensure user registration is working

2. **Permission Errors**
   - Verify role-based access control implementation
   - Check user role assignment in tokens
   - Validate access control service logic

3. **State Transition Failures**
   - Check book DAO state transition validation
   - Verify workflow entry creation
   - Ensure database consistency

4. **Network/Timeout Issues**
   - Verify API Gateway and Lambda deployment
   - Check CloudFront distribution configuration
   - Validate CORS settings

### Debug Commands

```bash
# Test API Gateway health
curl -X GET "$QA_DIRECT_API/books/health"

# Test authentication
curl -X POST "$QA_DIRECT_API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","firstName":"Test","lastName":"User","role":"AUTHOR"}'

# Test with verbose output
curl -v -X GET "$QA_DIRECT_API/books" \
  -H "Authorization: Bearer your-token-here"
```

## Integration with Refactoring

### Pre-Refactoring
1. Run all tests to establish baseline
2. Document any failing tests or issues
3. Ensure all tests pass before starting refactoring

### During Refactoring
1. Run tests frequently to catch regressions
2. Update tests as new endpoints are implemented
3. Validate backward compatibility

### Post-Refactoring
1. Run complete test suite against new architecture
2. Verify all tests still pass
3. Test new workflow service endpoints
4. Validate enhanced features

## Maintenance

### Updating Tests
- Modify test scripts when endpoints change
- Update documentation when new features are added
- Maintain test data and user accounts

### Adding New Tests
- Follow existing patterns for new test cases
- Update the comprehensive test suite documentation
- Add new validation items to the checklist

### Test Data Management
- Test scripts create temporary users and books
- Clean up test data periodically if needed
- Use unique identifiers to avoid conflicts

## Support

For issues with the testing suite:
1. Check the troubleshooting section above
2. Review the detailed documentation files
3. Examine the test script output for specific errors
4. Verify environment configuration and deployment status

The testing suite is designed to be comprehensive and self-contained, providing confidence that the workflow functionality works correctly before and after refactoring.