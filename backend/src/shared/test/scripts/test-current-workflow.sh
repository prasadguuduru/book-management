#!/bin/bash

# Executable Test Script for Current Workflow Functionality
# This script tests all current workflow operations before refactoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
QA_API_BASE="https://d2xg2iv1qaydac.cloudfront.net/api"
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

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

increment_test() {
    ((TOTAL_TESTS++))
}

# Setup test users and tokens
setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Register test users for each role
    TIMESTAMP=$(date +%s)
    
    # Author user
    AUTHOR_EMAIL="workflow-author-$TIMESTAMP@example.com"
    AUTHOR_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$AUTHOR_EMAIL\",
            \"password\": \"TestPassword123!\",
            \"firstName\": \"Test\",
            \"lastName\": \"Author\",
            \"role\": \"AUTHOR\"
        }")
    
    if echo "$AUTHOR_RESPONSE" | grep -q "accessToken"; then
        AUTHOR_TOKEN=$(echo "$AUTHOR_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
        AUTHOR_ID=$(echo "$AUTHOR_RESPONSE" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
        log_success "Author user created: $AUTHOR_EMAIL"
    else
        log_error "Failed to create author user"
        echo "Response: $AUTHOR_RESPONSE"
        exit 1
    fi
    
    # Editor user
    EDITOR_EMAIL="workflow-editor-$TIMESTAMP@example.com"
    EDITOR_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$EDITOR_EMAIL\",
            \"password\": \"TestPassword123!\",
            \"firstName\": \"Test\",
            \"lastName\": \"Editor\",
            \"role\": \"EDITOR\"
        }")
    
    if echo "$EDITOR_RESPONSE" | grep -q "accessToken"; then
        EDITOR_TOKEN=$(echo "$EDITOR_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
        EDITOR_ID=$(echo "$EDITOR_RESPONSE" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
        log_success "Editor user created: $EDITOR_EMAIL"
    else
        log_error "Failed to create editor user"
        echo "Response: $EDITOR_RESPONSE"
        exit 1
    fi
    
    # Publisher user
    PUBLISHER_EMAIL="workflow-publisher-$TIMESTAMP@example.com"
    PUBLISHER_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$PUBLISHER_EMAIL\",
            \"password\": \"TestPassword123!\",
            \"firstName\": \"Test\",
            \"lastName\": \"Publisher\",
            \"role\": \"PUBLISHER\"
        }")
    
    if echo "$PUBLISHER_RESPONSE" | grep -q "accessToken"; then
        PUBLISHER_TOKEN=$(echo "$PUBLISHER_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
        PUBLISHER_ID=$(echo "$PUBLISHER_RESPONSE" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
        log_success "Publisher user created: $PUBLISHER_EMAIL"
    else
        log_error "Failed to create publisher user"
        echo "Response: $PUBLISHER_RESPONSE"
        exit 1
    fi
    
    log_info "Test environment setup complete"
    echo
}

# Create a test book
create_test_book() {
    local title="$1"
    local token="$2"
    
    curl -s -X POST "$QA_DIRECT_API/books" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"$title\",
            \"description\": \"Test book for workflow validation - created at $(date)\",
            \"content\": \"This is comprehensive test content for workflow testing. It contains multiple paragraphs to ensure the book has sufficient content for validation. This book will be used to test all workflow transitions including submission, approval, rejection, and publication. The content is designed to be realistic enough to pass any content validation while being clearly identifiable as test data.\",
            \"genre\": \"fiction\",
            \"tags\": [\"test\", \"workflow\", \"automation\"]
        }"
}

# Extract book ID from response
extract_book_id() {
    echo "$1" | grep -o '"bookId":"[^"]*' | cut -d'"' -f4
}

# Get book status
get_book_status() {
    local book_id="$1"
    local token="$2"
    
    curl -s -X GET "$QA_DIRECT_API/books/$book_id" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" | \
        grep -o '"status":"[^"]*' | cut -d'"' -f4
}

# Test 1: Book Creation and Initial State
test_book_creation() {
    log_info "Test 1: Book Creation and Initial State"
    increment_test
    
    BOOK_RESPONSE=$(create_test_book "Workflow Test Book - Creation" "$AUTHOR_TOKEN")
    
    if echo "$BOOK_RESPONSE" | grep -q '"bookId"'; then
        MAIN_BOOK_ID=$(extract_book_id "$BOOK_RESPONSE")
        
        # Verify initial status is DRAFT
        if echo "$BOOK_RESPONSE" | grep -q '"status":"DRAFT"'; then
            log_success "Book created successfully with DRAFT status (ID: $MAIN_BOOK_ID)"
        else
            log_error "Book created but not in DRAFT status"
            echo "Response: $BOOK_RESPONSE"
        fi
    else
        log_error "Failed to create book"
        echo "Response: $BOOK_RESPONSE"
    fi
    echo
}

# Test 2: Author Submits Book
test_book_submission() {
    log_info "Test 2: Author Submits Book for Editing"
    increment_test
    
    if [[ -z "$MAIN_BOOK_ID" ]]; then
        log_error "No book ID available for submission test"
        return
    fi
    
    SUBMIT_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$MAIN_BOOK_ID/submit" \
        -H "Authorization: Bearer $AUTHOR_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$SUBMIT_RESPONSE" | grep -q '"status":"SUBMITTED_FOR_EDITING"'; then
        log_success "Book submitted successfully for editing"
    else
        log_error "Book submission failed"
        echo "Response: $SUBMIT_RESPONSE"
    fi
    echo
}

# Test 3: Editor Approves Book
test_book_approval() {
    log_info "Test 3: Editor Approves Book"
    increment_test
    
    if [[ -z "$MAIN_BOOK_ID" ]]; then
        log_error "No book ID available for approval test"
        return
    fi
    
    APPROVE_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$MAIN_BOOK_ID/approve" \
        -H "Authorization: Bearer $EDITOR_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"comments": "Excellent work! Ready for publication."}')
    
    if echo "$APPROVE_RESPONSE" | grep -q '"status":"READY_FOR_PUBLICATION"'; then
        log_success "Book approved successfully for publication"
    else
        log_error "Book approval failed"
        echo "Response: $APPROVE_RESPONSE"
    fi
    echo
}

# Test 4: Publisher Publishes Book
test_book_publication() {
    log_info "Test 4: Publisher Publishes Book"
    increment_test
    
    if [[ -z "$MAIN_BOOK_ID" ]]; then
        log_error "No book ID available for publication test"
        return
    fi
    
    PUBLISH_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$MAIN_BOOK_ID/publish" \
        -H "Authorization: Bearer $PUBLISHER_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$PUBLISH_RESPONSE" | grep -q '"status":"PUBLISHED"'; then
        log_success "Book published successfully"
    else
        log_error "Book publication failed"
        echo "Response: $PUBLISH_RESPONSE"
    fi
    echo
}

# Test 5: Editor Rejection Workflow
test_book_rejection() {
    log_info "Test 5: Editor Rejection Workflow"
    increment_test
    
    # Create a new book for rejection testing
    REJECT_BOOK_RESPONSE=$(create_test_book "Workflow Test Book - Rejection" "$AUTHOR_TOKEN")
    REJECT_BOOK_ID=$(extract_book_id "$REJECT_BOOK_RESPONSE")
    
    if [[ -z "$REJECT_BOOK_ID" ]]; then
        log_error "Failed to create book for rejection test"
        return
    fi
    
    # Submit the book
    curl -s -X POST "$QA_DIRECT_API/books/$REJECT_BOOK_ID/submit" \
        -H "Authorization: Bearer $AUTHOR_TOKEN" \
        -H "Content-Type: application/json" > /dev/null
    
    # Reject the book
    REJECT_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$REJECT_BOOK_ID/reject" \
        -H "Authorization: Bearer $EDITOR_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"comments": "Please revise the introduction and add more examples."}')
    
    if echo "$REJECT_RESPONSE" | grep -q '"status":"DRAFT"'; then
        log_success "Book rejected successfully and returned to DRAFT"
        
        # Test resubmission after rejection
        RESUBMIT_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$REJECT_BOOK_ID/submit" \
            -H "Authorization: Bearer $AUTHOR_TOKEN" \
            -H "Content-Type: application/json")
        
        if echo "$RESUBMIT_RESPONSE" | grep -q '"status":"SUBMITTED_FOR_EDITING"'; then
            log_success "Book resubmitted successfully after rejection"
        else
            log_error "Book resubmission failed after rejection"
        fi
    else
        log_error "Book rejection failed"
        echo "Response: $REJECT_RESPONSE"
    fi
    echo
}

# Test 6: Permission Validation
test_permission_validation() {
    log_info "Test 6: Permission Validation"
    
    # Create a book for permission testing
    PERM_BOOK_RESPONSE=$(create_test_book "Workflow Test Book - Permissions" "$AUTHOR_TOKEN")
    PERM_BOOK_ID=$(extract_book_id "$PERM_BOOK_RESPONSE")
    
    if [[ -z "$PERM_BOOK_ID" ]]; then
        log_error "Failed to create book for permission test"
        return
    fi
    
    # Test 6a: Non-author cannot submit
    increment_test
    INVALID_SUBMIT=$(curl -s -X POST "$QA_DIRECT_API/books/$PERM_BOOK_ID/submit" \
        -H "Authorization: Bearer $EDITOR_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$INVALID_SUBMIT" | grep -q "FORBIDDEN\|403"; then
        log_success "Non-author correctly prevented from submitting book"
    else
        log_error "Non-author should not be able to submit book"
        echo "Response: $INVALID_SUBMIT"
    fi
    
    # Submit book for next tests
    curl -s -X POST "$QA_DIRECT_API/books/$PERM_BOOK_ID/submit" \
        -H "Authorization: Bearer $AUTHOR_TOKEN" \
        -H "Content-Type: application/json" > /dev/null
    
    # Test 6b: Non-editor cannot approve
    increment_test
    INVALID_APPROVE=$(curl -s -X POST "$QA_DIRECT_API/books/$PERM_BOOK_ID/approve" \
        -H "Authorization: Bearer $AUTHOR_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$INVALID_APPROVE" | grep -q "FORBIDDEN\|403"; then
        log_success "Non-editor correctly prevented from approving book"
    else
        log_error "Non-editor should not be able to approve book"
        echo "Response: $INVALID_APPROVE"
    fi
    
    # Test 6c: Non-publisher cannot publish
    increment_test
    INVALID_PUBLISH=$(curl -s -X POST "$QA_DIRECT_API/books/$PERM_BOOK_ID/publish" \
        -H "Authorization: Bearer $EDITOR_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$INVALID_PUBLISH" | grep -q "FORBIDDEN\|403"; then
        log_success "Non-publisher correctly prevented from publishing book"
    else
        log_error "Non-publisher should not be able to publish book"
        echo "Response: $INVALID_PUBLISH"
    fi
    echo
}

# Test 7: Invalid State Transitions
test_invalid_state_transitions() {
    log_info "Test 7: Invalid State Transitions"
    
    # Create a book in DRAFT state
    DRAFT_BOOK_RESPONSE=$(create_test_book "Workflow Test Book - Invalid Transitions" "$AUTHOR_TOKEN")
    DRAFT_BOOK_ID=$(extract_book_id "$DRAFT_BOOK_RESPONSE")
    
    if [[ -z "$DRAFT_BOOK_ID" ]]; then
        log_error "Failed to create book for invalid transition test"
        return
    fi
    
    # Test 7a: Cannot approve DRAFT book
    increment_test
    INVALID_APPROVE_DRAFT=$(curl -s -X POST "$QA_DIRECT_API/books/$DRAFT_BOOK_ID/approve" \
        -H "Authorization: Bearer $EDITOR_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$INVALID_APPROVE_DRAFT" | grep -q "INVALID_TRANSITION\|400"; then
        log_success "Cannot approve DRAFT book (correct behavior)"
    else
        log_error "Should not be able to approve DRAFT book"
        echo "Response: $INVALID_APPROVE_DRAFT"
    fi
    
    # Test 7b: Cannot publish DRAFT book
    increment_test
    INVALID_PUBLISH_DRAFT=$(curl -s -X POST "$QA_DIRECT_API/books/$DRAFT_BOOK_ID/publish" \
        -H "Authorization: Bearer $PUBLISHER_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$INVALID_PUBLISH_DRAFT" | grep -q "INVALID_TRANSITION\|400"; then
        log_success "Cannot publish DRAFT book (correct behavior)"
    else
        log_error "Should not be able to publish DRAFT book"
        echo "Response: $INVALID_PUBLISH_DRAFT"
    fi
    
    # Test 7c: Cannot reject DRAFT book
    increment_test
    INVALID_REJECT_DRAFT=$(curl -s -X POST "$QA_DIRECT_API/books/$DRAFT_BOOK_ID/reject" \
        -H "Authorization: Bearer $EDITOR_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$INVALID_REJECT_DRAFT" | grep -q "INVALID_TRANSITION\|400"; then
        log_success "Cannot reject DRAFT book (correct behavior)"
    else
        log_error "Should not be able to reject DRAFT book"
        echo "Response: $INVALID_REJECT_DRAFT"
    fi
    echo
}

# Test 8: Authentication Errors
test_authentication_errors() {
    log_info "Test 8: Authentication Error Handling"
    
    if [[ -z "$MAIN_BOOK_ID" ]]; then
        log_error "No book ID available for authentication test"
        return
    fi
    
    # Test 8a: No authorization header
    increment_test
    NO_AUTH_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$MAIN_BOOK_ID/submit" \
        -H "Content-Type: application/json")
    
    if echo "$NO_AUTH_RESPONSE" | grep -q "Missing Authentication Token\|Unauthorized\|401"; then
        log_success "Missing authentication token properly rejected"
    else
        log_error "Missing authentication token should be rejected"
        echo "Response: $NO_AUTH_RESPONSE"
    fi
    
    # Test 8b: Invalid token
    increment_test
    INVALID_TOKEN_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$MAIN_BOOK_ID/submit" \
        -H "Authorization: Bearer invalid-token-here" \
        -H "Content-Type: application/json")
    
    if echo "$INVALID_TOKEN_RESPONSE" | grep -q "Unauthorized\|Invalid\|401"; then
        log_success "Invalid authentication token properly rejected"
    else
        log_error "Invalid authentication token should be rejected"
        echo "Response: $INVALID_TOKEN_RESPONSE"
    fi
    echo
}

# Test 9: Book Not Found Errors
test_book_not_found() {
    log_info "Test 9: Book Not Found Error Handling"
    
    local non_existent_id="non-existent-book-id-12345"
    
    # Test all workflow operations with non-existent book
    OPERATIONS=("submit" "approve" "reject" "publish")
    TOKENS=("$AUTHOR_TOKEN" "$EDITOR_TOKEN" "$EDITOR_TOKEN" "$PUBLISHER_TOKEN")
    
    for i in "${!OPERATIONS[@]}"; do
        increment_test
        operation="${OPERATIONS[$i]}"
        token="${TOKENS[$i]}"
        
        RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$non_existent_id/$operation" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json")
        
        if echo "$RESPONSE" | grep -q "NOT_FOUND\|404"; then
            log_success "$operation operation properly handles non-existent book"
        else
            log_error "$operation operation should return 404 for non-existent book"
            echo "Response: $RESPONSE"
        fi
    done
    echo
}

# Test 10: Complete Workflow End-to-End
test_complete_workflow() {
    log_info "Test 10: Complete Workflow End-to-End"
    increment_test
    
    # Create a new book for complete workflow test
    E2E_BOOK_RESPONSE=$(create_test_book "Complete Workflow E2E Test" "$AUTHOR_TOKEN")
    E2E_BOOK_ID=$(extract_book_id "$E2E_BOOK_RESPONSE")
    
    if [[ -z "$E2E_BOOK_ID" ]]; then
        log_error "Failed to create book for E2E test"
        return
    fi
    
    # Step 1: Verify initial DRAFT state
    INITIAL_STATE=$(get_book_status "$E2E_BOOK_ID" "$AUTHOR_TOKEN")
    if [[ "$INITIAL_STATE" != "DRAFT" ]]; then
        log_error "Book not in DRAFT state initially: $INITIAL_STATE"
        return
    fi
    
    # Step 2: Submit for editing
    curl -s -X POST "$QA_DIRECT_API/books/$E2E_BOOK_ID/submit" \
        -H "Authorization: Bearer $AUTHOR_TOKEN" \
        -H "Content-Type: application/json" > /dev/null
    
    SUBMITTED_STATE=$(get_book_status "$E2E_BOOK_ID" "$AUTHOR_TOKEN")
    if [[ "$SUBMITTED_STATE" != "SUBMITTED_FOR_EDITING" ]]; then
        log_error "Book not in SUBMITTED_FOR_EDITING state after submission: $SUBMITTED_STATE"
        return
    fi
    
    # Step 3: Approve for publication
    curl -s -X POST "$QA_DIRECT_API/books/$E2E_BOOK_ID/approve" \
        -H "Authorization: Bearer $EDITOR_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"comments": "Approved for publication"}' > /dev/null
    
    APPROVED_STATE=$(get_book_status "$E2E_BOOK_ID" "$AUTHOR_TOKEN")
    if [[ "$APPROVED_STATE" != "READY_FOR_PUBLICATION" ]]; then
        log_error "Book not in READY_FOR_PUBLICATION state after approval: $APPROVED_STATE"
        return
    fi
    
    # Step 4: Publish
    curl -s -X POST "$QA_DIRECT_API/books/$E2E_BOOK_ID/publish" \
        -H "Authorization: Bearer $PUBLISHER_TOKEN" \
        -H "Content-Type: application/json" > /dev/null
    
    PUBLISHED_STATE=$(get_book_status "$E2E_BOOK_ID" "$AUTHOR_TOKEN")
    if [[ "$PUBLISHED_STATE" != "PUBLISHED" ]]; then
        log_error "Book not in PUBLISHED state after publication: $PUBLISHED_STATE"
        return
    fi
    
    log_success "Complete workflow executed successfully: DRAFT → SUBMITTED_FOR_EDITING → READY_FOR_PUBLICATION → PUBLISHED"
    echo
}

# Main test execution
main() {
    echo -e "${BLUE}=========================================="
    echo "CURRENT WORKFLOW FUNCTIONALITY TEST SUITE"
    echo "==========================================${NC}"
    echo
    
    # Setup
    setup_test_environment
    
    # Run all tests
    test_book_creation
    test_book_submission
    test_book_approval
    test_book_publication
    test_book_rejection
    test_permission_validation
    test_invalid_state_transitions
    test_authentication_errors
    test_book_not_found
    test_complete_workflow
    
    # Summary
    echo -e "${BLUE}=========================================="
    echo "TEST EXECUTION SUMMARY"
    echo "==========================================${NC}"
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}✓ All tests passed! Current workflow functionality is working correctly.${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed. Please review the failures above.${NC}"
        exit 1
    fi
}

# Run the test suite
main "$@"