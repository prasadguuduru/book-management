#!/bin/bash

# Simplified Workflow Test Script for debugging
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
QA_DIRECT_API="https://7tmom26ucc.execute-api.us-east-1.amazonaws.com/qa/api"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Utility functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

increment_test() {
    ((TOTAL_TESTS++))
}

# Create a test user
create_test_user() {
    local role="$1"
    local timestamp=$(date +%s)
    local email="workflow-$(echo $role | tr '[:upper:]' '[:lower:]')-$timestamp@example.com"
    
    log_info "Creating $role user: $email"
    
    local response=$(curl -s -X POST "$QA_DIRECT_API/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$email\",
            \"password\": \"TestPassword123!\",
            \"firstName\": \"Test\",
            \"lastName\": \"$role\",
            \"role\": \"$role\"
        }")
    
    if echo "$response" | grep -q "accessToken"; then
        local token=$(echo "$response" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
        local user_id=$(echo "$response" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
        log_success "$role user created successfully"
        echo "$token"
    else
        log_error "Failed to create $role user"
        echo "Response: $response"
        return 1
    fi
}

# Create a test book
create_test_book() {
    local title="$1"
    local token="$2"
    
    log_info "Creating book: $title"
    
    local response=$(curl -s -X POST "$QA_DIRECT_API/books" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"$title\",
            \"description\": \"Test book for workflow validation\",
            \"content\": \"This is comprehensive test content for workflow testing. It contains multiple paragraphs to ensure the book has sufficient content for validation.\",
            \"genre\": \"fiction\",
            \"tags\": [\"test\", \"workflow\"]
        }")
    
    if echo "$response" | grep -q '"bookId"'; then
        local book_id=$(echo "$response" | grep -o '"bookId":"[^"]*' | cut -d'"' -f4)
        log_success "Book created successfully: $book_id"
        echo "$book_id"
    else
        log_error "Failed to create book"
        echo "Response: $response"
        return 1
    fi
}

# Test workflow operation
test_workflow_operation() {
    local operation="$1"
    local book_id="$2"
    local token="$3"
    local expected_status="$4"
    
    increment_test
    log_info "Testing $operation operation"
    
    local response=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/$operation" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json")
    
    if echo "$response" | grep -q "\"status\":\"$expected_status\""; then
        log_success "$operation operation successful - status: $expected_status"
    else
        log_error "$operation operation failed"
        echo "Response: $response"
    fi
}

# Main test execution
main() {
    echo -e "${BLUE}=========================================="
    echo "SIMPLIFIED WORKFLOW TEST"
    echo "==========================================${NC}"
    echo
    
    # Create test users
    log_info "Creating test users..."
    AUTHOR_TOKEN=$(create_test_user "AUTHOR")
    if [[ -z "$AUTHOR_TOKEN" ]]; then
        log_error "Failed to create author user"
        exit 1
    fi
    
    EDITOR_TOKEN=$(create_test_user "EDITOR")
    if [[ -z "$EDITOR_TOKEN" ]]; then
        log_error "Failed to create editor user"
        exit 1
    fi
    
    PUBLISHER_TOKEN=$(create_test_user "PUBLISHER")
    if [[ -z "$PUBLISHER_TOKEN" ]]; then
        log_error "Failed to create publisher user"
        exit 1
    fi
    
    echo
    
    # Create test book
    log_info "Creating test book..."
    BOOK_ID=$(create_test_book "Workflow Test Book" "$AUTHOR_TOKEN")
    if [[ -z "$BOOK_ID" ]]; then
        log_error "Failed to create test book"
        exit 1
    fi
    
    echo
    
    # Test workflow operations
    log_info "Testing workflow operations..."
    
    # Test submission
    test_workflow_operation "submit" "$BOOK_ID" "$AUTHOR_TOKEN" "SUBMITTED_FOR_EDITING"
    
    # Test approval
    test_workflow_operation "approve" "$BOOK_ID" "$EDITOR_TOKEN" "READY_FOR_PUBLICATION"
    
    # Test publication
    test_workflow_operation "publish" "$BOOK_ID" "$PUBLISHER_TOKEN" "PUBLISHED"
    
    echo
    
    # Test permission validation
    log_info "Testing permission validation..."
    
    # Create another book for permission testing
    PERM_BOOK_ID=$(create_test_book "Permission Test Book" "$AUTHOR_TOKEN")
    
    # Test invalid permission (editor trying to submit)
    increment_test
    log_info "Testing invalid permission: editor submitting book"
    INVALID_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$PERM_BOOK_ID/submit" \
        -H "Authorization: Bearer $EDITOR_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$INVALID_RESPONSE" | grep -q "FORBIDDEN\|403"; then
        log_success "Invalid permission correctly rejected"
    else
        log_error "Invalid permission should be rejected"
        echo "Response: $INVALID_RESPONSE"
    fi
    
    echo
    
    # Summary
    echo -e "${BLUE}=========================================="
    echo "TEST SUMMARY"
    echo "==========================================${NC}"
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed.${NC}"
        exit 1
    fi
}

# Run the test
main "$@"