# Comprehensive Workflow Test Suite

## Overview

This document provides a complete test suite for the current workflow functionality in the ebook publishing system. It documents all existing workflow endpoints, expected behaviors, user role scenarios, and edge cases before the workflow service refactoring.

## Current Workflow Architecture

### Current State (Before Refactoring)
- **Service**: book-service handles both CRUD and workflow operations
- **Endpoints**: Workflow operations are part of book-service endpoints
- **State Management**: Book status transitions managed in book-service
- **Validation**: State transition validation in book DAO

### Workflow States
- `DRAFT` - Initial state when book is created
- `SUBMITTED_FOR_EDITING` - Author submits book for editorial review
- `READY_FOR_PUBLICATION` - Editor approves book for publication
- `PUBLISHED` - Publisher publishes the book

### State Transitions
```
DRAFT → SUBMITTED_FOR_EDITING (AUTHOR only)
SUBMITTED_FOR_EDITING → DRAFT (EDITOR only - rejection)
SUBMITTED_FOR_EDITING → READY_FOR_PUBLICATION (EDITOR only - approval)
READY_FOR_PUBLICATION → SUBMITTED_FOR_EDITING (EDITOR only - send back)
READY_FOR_PUBLICATION → PUBLISHED (PUBLISHER only)
PUBLISHED → (no transitions allowed)
```

## Test Environment Setup

### Prerequisites
```bash
# Environment variables
export QA_API_BASE="https://d2xg2iv1qaydac.cloudfront.net/api"
export QA_DIRECT_API="https://7tmom26ucc.execute-api.us-east-1.amazonaws.com/qa/api"

# Test user tokens (replace with actual tokens)
export AUTHOR_TOKEN="author-jwt-token"
export EDITOR_TOKEN="editor-jwt-token" 
export PUBLISHER_TOKEN="publisher-jwt-token"
export READER_TOKEN="reader-jwt-token"

# Common headers
export AUTH_HEADERS_AUTHOR="-H 'Authorization: Bearer $AUTHOR_TOKEN' -H 'Content-Type: application/json'"
export AUTH_HEADERS_EDITOR="-H 'Authorization: Bearer $EDITOR_TOKEN' -H 'Content-Type: application/json'"
export AUTH_HEADERS_PUBLISHER="-H 'Authorization: Bearer $PUBLISHER_TOKEN' -H 'Content-Type: application/json'"
export AUTH_HEADERS_READER="-H 'Authorization: Bearer $READER_TOKEN' -H 'Content-Type: application/json'"
```

### Test Data Setup
```bash
# Create test book for workflow testing
create_test_book() {
  local title="$1"
  local author_token="$2"
  
  curl -s -X POST "$QA_DIRECT_API/books" \
    -H "Authorization: Bearer $author_token" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"$title\",
      \"description\": \"Test book for workflow validation\",
      \"content\": \"This is test content for workflow testing. It contains enough words to be a valid book for testing purposes.\",
      \"genre\": \"fiction\",
      \"tags\": [\"test\", \"workflow\"]
    }"
}

# Extract book ID from response
extract_book_id() {
  echo "$1" | grep -o '"bookId":"[^"]*' | cut -d'"' -f4
}
```

## Current Workflow Endpoints Documentation

### 1. Book Creation (Initial State)
**Endpoint**: `POST /api/books`
**Role**: AUTHOR only
**Initial Status**: DRAFT

```bash
# Test: Create book (sets initial DRAFT status)
test_create_book() {
  echo "Testing book creation..."
  
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books" \
    $AUTH_HEADERS_AUTHOR \
    -d '{
      "title": "Test Workflow Book",
      "description": "A book for testing workflow transitions",
      "content": "This is the content of the test book for workflow validation.",
      "genre": "fiction",
      "tags": ["test", "workflow"]
    }')
  
  # Expected: 201 Created, book in DRAFT status
  if echo "$RESPONSE" | grep -q '"status":"DRAFT"'; then
    echo "✓ Book created successfully in DRAFT status"
    BOOK_ID=$(extract_book_id "$RESPONSE")
    echo "Book ID: $BOOK_ID"
  else
    echo "✗ Book creation failed or wrong initial status"
    echo "Response: $RESPONSE"
  fi
}
```

### 2. Submit Book for Editing
**Endpoint**: `POST /api/books/{bookId}/submit`
**Role**: AUTHOR only (own books)
**Transition**: DRAFT → SUBMITTED_FOR_EDITING

```bash
# Test: Author submits book for editing
test_submit_book() {
  local book_id="$1"
  echo "Testing book submission for editing..."
  
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/submit" \
    $AUTH_HEADERS_AUTHOR)
  
  # Expected: 200 OK, status changed to SUBMITTED_FOR_EDITING
  if echo "$RESPONSE" | grep -q '"status":"SUBMITTED_FOR_EDITING"'; then
    echo "✓ Book submitted successfully"
    echo "Response: $RESPONSE"
  else
    echo "✗ Book submission failed"
    echo "Response: $RESPONSE"
  fi
}

# Test: Invalid submission scenarios
test_submit_book_invalid() {
  local book_id="$1"
  
  # Test 1: Non-author tries to submit
  echo "Testing submission by non-author (should fail)..."
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/submit" \
    $AUTH_HEADERS_EDITOR)
  
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Non-author submission properly rejected"
  else
    echo "✗ Non-author submission should be rejected"
    echo "Response: $RESPONSE"
  fi
  
  # Test 2: Submit already submitted book
  echo "Testing double submission (should fail)..."
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/submit" \
    $AUTH_HEADERS_AUTHOR)
  
  if echo "$RESPONSE" | grep -q "INVALID_TRANSITION\|400"; then
    echo "✓ Double submission properly rejected"
  else
    echo "✗ Double submission should be rejected"
    echo "Response: $RESPONSE"
  fi
}
```

### 3. Approve Book
**Endpoint**: `POST /api/books/{bookId}/approve`
**Role**: EDITOR only
**Transition**: SUBMITTED_FOR_EDITING → READY_FOR_PUBLICATION

```bash
# Test: Editor approves book
test_approve_book() {
  local book_id="$1"
  echo "Testing book approval..."
  
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/approve" \
    $AUTH_HEADERS_EDITOR \
    -d '{"comments": "Book looks good, ready for publication"}')
  
  # Expected: 200 OK, status changed to READY_FOR_PUBLICATION
  if echo "$RESPONSE" | grep -q '"status":"READY_FOR_PUBLICATION"'; then
    echo "✓ Book approved successfully"
    echo "Response: $RESPONSE"
  else
    echo "✗ Book approval failed"
    echo "Response: $RESPONSE"
  fi
}

# Test: Invalid approval scenarios
test_approve_book_invalid() {
  local book_id="$1"
  
  # Test 1: Non-editor tries to approve
  echo "Testing approval by non-editor (should fail)..."
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/approve" \
    $AUTH_HEADERS_AUTHOR \
    -d '{"comments": "I approve my own book"}')
  
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Non-editor approval properly rejected"
  else
    echo "✗ Non-editor approval should be rejected"
    echo "Response: $RESPONSE"
  fi
  
  # Test 2: Approve book in wrong state
  echo "Testing approval of DRAFT book (should fail)..."
  # This would need a book in DRAFT state
}
```

### 4. Reject Book
**Endpoint**: `POST /api/books/{bookId}/reject`
**Role**: EDITOR only
**Transition**: SUBMITTED_FOR_EDITING → DRAFT

```bash
# Test: Editor rejects book
test_reject_book() {
  local book_id="$1"
  echo "Testing book rejection..."
  
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/reject" \
    $AUTH_HEADERS_EDITOR \
    -d '{"comments": "Please revise the introduction and add more details"}')
  
  # Expected: 200 OK, status changed to DRAFT
  if echo "$RESPONSE" | grep -q '"status":"DRAFT"'; then
    echo "✓ Book rejected successfully"
    echo "Response: $RESPONSE"
  else
    echo "✗ Book rejection failed"
    echo "Response: $RESPONSE"
  fi
}

# Test: Invalid rejection scenarios
test_reject_book_invalid() {
  local book_id="$1"
  
  # Test 1: Non-editor tries to reject
  echo "Testing rejection by non-editor (should fail)..."
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/reject" \
    $AUTH_HEADERS_AUTHOR \
    -d '{"comments": "I reject my own book"}')
  
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Non-editor rejection properly rejected"
  else
    echo "✗ Non-editor rejection should be rejected"
    echo "Response: $RESPONSE"
  fi
}
```

### 5. Publish Book
**Endpoint**: `POST /api/books/{bookId}/publish`
**Role**: PUBLISHER only
**Transition**: READY_FOR_PUBLICATION → PUBLISHED

```bash
# Test: Publisher publishes book
test_publish_book() {
  local book_id="$1"
  echo "Testing book publication..."
  
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/publish" \
    $AUTH_HEADERS_PUBLISHER)
  
  # Expected: 200 OK, status changed to PUBLISHED
  if echo "$RESPONSE" | grep -q '"status":"PUBLISHED"'; then
    echo "✓ Book published successfully"
    echo "Response: $RESPONSE"
  else
    echo "✗ Book publication failed"
    echo "Response: $RESPONSE"
  fi
}

# Test: Invalid publication scenarios
test_publish_book_invalid() {
  local book_id="$1"
  
  # Test 1: Non-publisher tries to publish
  echo "Testing publication by non-publisher (should fail)..."
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/publish" \
    $AUTH_HEADERS_EDITOR)
  
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Non-publisher publication properly rejected"
  else
    echo "✗ Non-publisher publication should be rejected"
    echo "Response: $RESPONSE"
  fi
  
  # Test 2: Publish book in wrong state
  echo "Testing publication of DRAFT book (should fail)..."
  # This would need a book in DRAFT state
}
```

## User Role Permission Testing

### Author Permissions
```bash
test_author_permissions() {
  local book_id="$1"
  echo "Testing AUTHOR role permissions..."
  
  # Can: Create books
  test_create_book
  
  # Can: Submit own books
  test_submit_book "$book_id"
  
  # Cannot: Approve books
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/approve" \
    $AUTH_HEADERS_AUTHOR)
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Author cannot approve books (correct)"
  else
    echo "✗ Author should not be able to approve books"
  fi
  
  # Cannot: Reject books
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/reject" \
    $AUTH_HEADERS_AUTHOR)
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Author cannot reject books (correct)"
  else
    echo "✗ Author should not be able to reject books"
  fi
  
  # Cannot: Publish books
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/publish" \
    $AUTH_HEADERS_AUTHOR)
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Author cannot publish books (correct)"
  else
    echo "✗ Author should not be able to publish books"
  fi
}
```

### Editor Permissions
```bash
test_editor_permissions() {
  local book_id="$1"
  echo "Testing EDITOR role permissions..."
  
  # Cannot: Create books (editors don't create)
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books" \
    $AUTH_HEADERS_EDITOR \
    -d '{"title": "Editor Book", "description": "Test", "content": "Test", "genre": "fiction", "tags": []}')
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Editor cannot create books (correct)"
  else
    echo "✗ Editor should not be able to create books"
  fi
  
  # Cannot: Submit books
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/submit" \
    $AUTH_HEADERS_EDITOR)
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Editor cannot submit books (correct)"
  else
    echo "✗ Editor should not be able to submit books"
  fi
  
  # Can: Approve books (if in SUBMITTED_FOR_EDITING state)
  test_approve_book "$book_id"
  
  # Can: Reject books (if in SUBMITTED_FOR_EDITING state)
  test_reject_book "$book_id"
  
  # Cannot: Publish books
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/publish" \
    $AUTH_HEADERS_EDITOR)
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Editor cannot publish books (correct)"
  else
    echo "✗ Editor should not be able to publish books"
  fi
}
```

### Publisher Permissions
```bash
test_publisher_permissions() {
  local book_id="$1"
  echo "Testing PUBLISHER role permissions..."
  
  # Cannot: Create books
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books" \
    $AUTH_HEADERS_PUBLISHER \
    -d '{"title": "Publisher Book", "description": "Test", "content": "Test", "genre": "fiction", "tags": []}')
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Publisher cannot create books (correct)"
  else
    echo "✗ Publisher should not be able to create books"
  fi
  
  # Cannot: Submit books
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/submit" \
    $AUTH_HEADERS_PUBLISHER)
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Publisher cannot submit books (correct)"
  else
    echo "✗ Publisher should not be able to submit books"
  fi
  
  # Cannot: Approve books
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/approve" \
    $AUTH_HEADERS_PUBLISHER)
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Publisher cannot approve books (correct)"
  else
    echo "✗ Publisher should not be able to approve books"
  fi
  
  # Cannot: Reject books
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/reject" \
    $AUTH_HEADERS_PUBLISHER)
  if echo "$RESPONSE" | grep -q "FORBIDDEN\|403"; then
    echo "✓ Publisher cannot reject books (correct)"
  else
    echo "✗ Publisher should not be able to reject books"
  fi
  
  # Can: Publish books (if in READY_FOR_PUBLICATION state)
  test_publish_book "$book_id"
}
```

## Error Handling and Edge Cases

### Authentication Errors
```bash
test_authentication_errors() {
  local book_id="$1"
  echo "Testing authentication error handling..."
  
  # Test 1: No authorization header
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/submit" \
    -H "Content-Type: application/json")
  
  if echo "$RESPONSE" | grep -q "Missing Authentication Token\|Unauthorized\|401"; then
    echo "✓ Missing auth token properly rejected"
  else
    echo "✗ Missing auth token should be rejected"
    echo "Response: $RESPONSE"
  fi
  
  # Test 2: Invalid token
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$book_id/submit" \
    -H "Authorization: Bearer invalid-token" \
    -H "Content-Type: application/json")
  
  if echo "$RESPONSE" | grep -q "Unauthorized\|Invalid\|401"; then
    echo "✓ Invalid token properly rejected"
  else
    echo "✗ Invalid token should be rejected"
    echo "Response: $RESPONSE"
  fi
  
  # Test 3: Expired token (would need expired token)
  echo "Note: Expired token test requires actual expired token"
}
```

### Invalid State Transitions
```bash
test_invalid_state_transitions() {
  echo "Testing invalid state transitions..."
  
  # Create books in different states for testing
  DRAFT_BOOK_RESPONSE=$(create_test_book "Draft Book" "$AUTHOR_TOKEN")
  DRAFT_BOOK_ID=$(extract_book_id "$DRAFT_BOOK_RESPONSE")
  
  # Test 1: Try to approve DRAFT book (should fail)
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$DRAFT_BOOK_ID/approve" \
    $AUTH_HEADERS_EDITOR)
  
  if echo "$RESPONSE" | grep -q "INVALID_TRANSITION\|400"; then
    echo "✓ Cannot approve DRAFT book (correct)"
  else
    echo "✗ Should not be able to approve DRAFT book"
    echo "Response: $RESPONSE"
  fi
  
  # Test 2: Try to publish DRAFT book (should fail)
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$DRAFT_BOOK_ID/publish" \
    $AUTH_HEADERS_PUBLISHER)
  
  if echo "$RESPONSE" | grep -q "INVALID_TRANSITION\|400"; then
    echo "✓ Cannot publish DRAFT book (correct)"
  else
    echo "✗ Should not be able to publish DRAFT book"
    echo "Response: $RESPONSE"
  fi
  
  # Test 3: Try to reject DRAFT book (should fail)
  RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$DRAFT_BOOK_ID/reject" \
    $AUTH_HEADERS_EDITOR)
  
  if echo "$RESPONSE" | grep -q "INVALID_TRANSITION\|400"; then
    echo "✓ Cannot reject DRAFT book (correct)"
  else
    echo "✗ Should not be able to reject DRAFT book"
    echo "Response: $RESPONSE"
  fi
}
```

### Book Not Found Errors
```bash
test_book_not_found() {
  echo "Testing book not found scenarios..."
  
  local non_existent_id="non-existent-book-id"
  
  # Test all workflow operations with non-existent book
  OPERATIONS=("submit" "approve" "reject" "publish")
  TOKENS=("$AUTHOR_TOKEN" "$EDITOR_TOKEN" "$EDITOR_TOKEN" "$PUBLISHER_TOKEN")
  
  for i in "${!OPERATIONS[@]}"; do
    operation="${OPERATIONS[$i]}"
    token="${TOKENS[$i]}"
    
    RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$non_existent_id/$operation" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json")
    
    if echo "$RESPONSE" | grep -q "NOT_FOUND\|404"; then
      echo "✓ $operation operation properly handles non-existent book"
    else
      echo "✗ $operation operation should return 404 for non-existent book"
      echo "Response: $RESPONSE"
    fi
  done
}
```

### Concurrent Access Testing
```bash
test_concurrent_access() {
  local book_id="$1"
  echo "Testing concurrent access scenarios..."
  
  # Test 1: Multiple users trying to transition same book simultaneously
  echo "Testing concurrent state transitions..."
  
  # Submit book first
  curl -s -X POST "$QA_DIRECT_API/books/$book_id/submit" $AUTH_HEADERS_AUTHOR > /dev/null
  
  # Try concurrent approve and reject
  (curl -s -X POST "$QA_DIRECT_API/books/$book_id/approve" $AUTH_HEADERS_EDITOR &)
  (curl -s -X POST "$QA_DIRECT_API/books/$book_id/reject" $AUTH_HEADERS_EDITOR &)
  
  wait
  
  # Check final state
  FINAL_STATE=$(curl -s -X GET "$QA_DIRECT_API/books/$book_id" $AUTH_HEADERS_AUTHOR | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  
  if [[ "$FINAL_STATE" == "READY_FOR_PUBLICATION" || "$FINAL_STATE" == "DRAFT" ]]; then
    echo "✓ Concurrent operations handled correctly, final state: $FINAL_STATE"
  else
    echo "✗ Concurrent operations may have caused inconsistent state: $FINAL_STATE"
  fi
}
```

## Complete Workflow Testing Scenarios

### Happy Path - Full Workflow
```bash
test_complete_workflow_happy_path() {
  echo "Testing complete workflow - happy path..."
  
  # Step 1: Author creates book
  echo "Step 1: Creating book..."
  BOOK_RESPONSE=$(create_test_book "Complete Workflow Test" "$AUTHOR_TOKEN")
  BOOK_ID=$(extract_book_id "$BOOK_RESPONSE")
  
  if [[ -z "$BOOK_ID" ]]; then
    echo "✗ Failed to create book"
    return 1
  fi
  
  # Verify initial state
  STATE=$(curl -s -X GET "$QA_DIRECT_API/books/$BOOK_ID" $AUTH_HEADERS_AUTHOR | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  if [[ "$STATE" != "DRAFT" ]]; then
    echo "✗ Book not in DRAFT state after creation: $STATE"
    return 1
  fi
  echo "✓ Book created in DRAFT state"
  
  # Step 2: Author submits for editing
  echo "Step 2: Submitting for editing..."
  SUBMIT_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$BOOK_ID/submit" $AUTH_HEADERS_AUTHOR)
  
  if echo "$SUBMIT_RESPONSE" | grep -q '"status":"SUBMITTED_FOR_EDITING"'; then
    echo "✓ Book submitted for editing"
  else
    echo "✗ Book submission failed"
    echo "Response: $SUBMIT_RESPONSE"
    return 1
  fi
  
  # Step 3: Editor approves
  echo "Step 3: Editor approving..."
  APPROVE_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$BOOK_ID/approve" \
    $AUTH_HEADERS_EDITOR \
    -d '{"comments": "Great work! Ready for publication."}')
  
  if echo "$APPROVE_RESPONSE" | grep -q '"status":"READY_FOR_PUBLICATION"'; then
    echo "✓ Book approved for publication"
  else
    echo "✗ Book approval failed"
    echo "Response: $APPROVE_RESPONSE"
    return 1
  fi
  
  # Step 4: Publisher publishes
  echo "Step 4: Publisher publishing..."
  PUBLISH_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$BOOK_ID/publish" $AUTH_HEADERS_PUBLISHER)
  
  if echo "$PUBLISH_RESPONSE" | grep -q '"status":"PUBLISHED"'; then
    echo "✓ Book published successfully"
  else
    echo "✗ Book publication failed"
    echo "Response: $PUBLISH_RESPONSE"
    return 1
  fi
  
  echo "✓ Complete workflow test passed - Book ID: $BOOK_ID"
}
```

### Rejection Path - Editor Rejects
```bash
test_workflow_rejection_path() {
  echo "Testing workflow with rejection..."
  
  # Step 1: Create and submit book
  BOOK_RESPONSE=$(create_test_book "Rejection Test Book" "$AUTHOR_TOKEN")
  BOOK_ID=$(extract_book_id "$BOOK_RESPONSE")
  
  curl -s -X POST "$QA_DIRECT_API/books/$BOOK_ID/submit" $AUTH_HEADERS_AUTHOR > /dev/null
  
  # Step 2: Editor rejects
  echo "Editor rejecting book..."
  REJECT_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$BOOK_ID/reject" \
    $AUTH_HEADERS_EDITOR \
    -d '{"comments": "Please revise the introduction and add more examples."}')
  
  if echo "$REJECT_RESPONSE" | grep -q '"status":"DRAFT"'; then
    echo "✓ Book rejected and returned to DRAFT"
  else
    echo "✗ Book rejection failed"
    echo "Response: $REJECT_RESPONSE"
    return 1
  fi
  
  # Step 3: Author can resubmit
  echo "Author resubmitting after revision..."
  RESUBMIT_RESPONSE=$(curl -s -X POST "$QA_DIRECT_API/books/$BOOK_ID/submit" $AUTH_HEADERS_AUTHOR)
  
  if echo "$RESUBMIT_RESPONSE" | grep -q '"status":"SUBMITTED_FOR_EDITING"'; then
    echo "✓ Book resubmitted successfully after rejection"
  else
    echo "✗ Book resubmission failed"
    echo "Response: $RESUBMIT_RESPONSE"
    return 1
  fi
  
  echo "✓ Rejection workflow test passed - Book ID: $BOOK_ID"
}
```

## Performance and Load Testing

### Response Time Testing
```bash
test_response_times() {
  local book_id="$1"
  echo "Testing response times for workflow operations..."
  
  OPERATIONS=("submit" "approve" "reject" "publish")
  TOKENS=("$AUTHOR_TOKEN" "$EDITOR_TOKEN" "$EDITOR_TOKEN" "$PUBLISHER_TOKEN")
  
  for i in "${!OPERATIONS[@]}"; do
    operation="${OPERATIONS[$i]}"
    token="${TOKENS[$i]}"
    
    echo "Testing $operation operation response time..."
    
    START_TIME=$(date +%s%N)
    curl -s -X POST "$QA_DIRECT_API/books/$book_id/$operation" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" > /dev/null
    END_TIME=$(date +%s%N)
    
    DURATION=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds
    
    if [[ $DURATION -lt 2000 ]]; then
      echo "✓ $operation operation completed in ${DURATION}ms (acceptable)"
    else
      echo "⚠ $operation operation took ${DURATION}ms (may be slow)"
    fi
  done
}
```

### Concurrent User Testing
```bash
test_concurrent_users() {
  echo "Testing concurrent user operations..."
  
  # Create multiple books for concurrent testing
  BOOK_IDS=()
  for i in {1..5}; do
    BOOK_RESPONSE=$(create_test_book "Concurrent Test Book $i" "$AUTHOR_TOKEN")
    BOOK_ID=$(extract_book_id "$BOOK_RESPONSE")
    BOOK_IDS+=("$BOOK_ID")
  done
  
  # Submit all books concurrently
  echo "Submitting ${#BOOK_IDS[@]} books concurrently..."
  for book_id in "${BOOK_IDS[@]}"; do
    (curl -s -X POST "$QA_DIRECT_API/books/$book_id/submit" $AUTH_HEADERS_AUTHOR &)
  done
  
  wait
  
  # Verify all submissions succeeded
  SUCCESS_COUNT=0
  for book_id in "${BOOK_IDS[@]}"; do
    STATE=$(curl -s -X GET "$QA_DIRECT_API/books/$book_id" $AUTH_HEADERS_AUTHOR | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    if [[ "$STATE" == "SUBMITTED_FOR_EDITING" ]]; then
      ((SUCCESS_COUNT++))
    fi
  done
  
  if [[ $SUCCESS_COUNT -eq ${#BOOK_IDS[@]} ]]; then
    echo "✓ All $SUCCESS_COUNT concurrent submissions succeeded"
  else
    echo "✗ Only $SUCCESS_COUNT out of ${#BOOK_IDS[@]} submissions succeeded"
  fi
}
```

## CORS and Cross-Origin Testing

```bash
test_cors_configuration() {
  echo "Testing CORS configuration for workflow endpoints..."
  
  local book_id="$1"
  
  # Test preflight requests
  ENDPOINTS=("submit" "approve" "reject" "publish")
  
  for endpoint in "${ENDPOINTS[@]}"; do
    echo "Testing CORS for $endpoint endpoint..."
    
    CORS_RESPONSE=$(curl -s -X OPTIONS "$QA_DIRECT_API/books/$book_id/$endpoint" \
      -H "Origin: http://localhost:3000" \
      -H "Access-Control-Request-Method: POST" \
      -H "Access-Control-Request-Headers: Authorization,Content-Type" \
      -v 2>&1)
    
    if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
      echo "✓ CORS properly configured for $endpoint"
    else
      echo "⚠ CORS may need configuration for $endpoint"
    fi
  done
}
```

## Master Test Runner

```bash
#!/bin/bash
# Master test runner for comprehensive workflow testing

run_comprehensive_workflow_tests() {
  echo "=========================================="
  echo "COMPREHENSIVE WORKFLOW TEST SUITE"
  echo "=========================================="
  
  # Setup
  echo "Setting up test environment..."
  
  # Create test book for general testing
  MAIN_BOOK_RESPONSE=$(create_test_book "Main Test Book" "$AUTHOR_TOKEN")
  MAIN_BOOK_ID=$(extract_book_id "$MAIN_BOOK_RESPONSE")
  
  if [[ -z "$MAIN_BOOK_ID" ]]; then
    echo "✗ Failed to create main test book. Exiting."
    exit 1
  fi
  
  echo "Main test book created: $MAIN_BOOK_ID"
  echo
  
  # Run all test categories
  echo "1. BASIC WORKFLOW OPERATIONS"
  echo "----------------------------"
  test_create_book
  test_submit_book "$MAIN_BOOK_ID"
  test_approve_book "$MAIN_BOOK_ID"
  test_publish_book "$MAIN_BOOK_ID"
  echo
  
  echo "2. USER ROLE PERMISSIONS"
  echo "------------------------"
  test_author_permissions "$MAIN_BOOK_ID"
  test_editor_permissions "$MAIN_BOOK_ID"
  test_publisher_permissions "$MAIN_BOOK_ID"
  echo
  
  echo "3. ERROR HANDLING"
  echo "-----------------"
  test_authentication_errors "$MAIN_BOOK_ID"
  test_invalid_state_transitions
  test_book_not_found
  echo
  
  echo "4. COMPLETE WORKFLOWS"
  echo "--------------------"
  test_complete_workflow_happy_path
  test_workflow_rejection_path
  echo
  
  echo "5. PERFORMANCE TESTING"
  echo "----------------------"
  test_response_times "$MAIN_BOOK_ID"
  test_concurrent_users
  echo
  
  echo "6. CORS TESTING"
  echo "---------------"
  test_cors_configuration "$MAIN_BOOK_ID"
  echo
  
  echo "=========================================="
  echo "COMPREHENSIVE WORKFLOW TESTS COMPLETED"
  echo "=========================================="
}

# Run the comprehensive test suite
run_comprehensive_workflow_tests
```

## Expected Results Summary

### Successful Operations
- **Book Creation**: 201 Created, status = "DRAFT"
- **Book Submission**: 200 OK, status = "SUBMITTED_FOR_EDITING"
- **Book Approval**: 200 OK, status = "READY_FOR_PUBLICATION"
- **Book Rejection**: 200 OK, status = "DRAFT"
- **Book Publication**: 200 OK, status = "PUBLISHED"

### Error Scenarios
- **Invalid Role**: 403 Forbidden
- **Invalid State Transition**: 400 Bad Request, "INVALID_TRANSITION"
- **Missing Authentication**: 401 Unauthorized
- **Book Not Found**: 404 Not Found
- **Invalid Token**: 401 Unauthorized

### Performance Expectations
- **Response Time**: < 2000ms for all operations
- **Concurrent Operations**: Should handle 5+ concurrent requests
- **State Consistency**: No race conditions in state transitions

### CORS Requirements
- **Preflight Requests**: Should return proper CORS headers
- **Origin Validation**: Should allow configured origins
- **Method Support**: Should support POST, GET, OPTIONS

## Validation Checklist

Before refactoring, ensure all these tests pass:

- [ ] All workflow operations work with correct roles
- [ ] All invalid operations are properly rejected
- [ ] State transitions follow the defined rules
- [ ] Authentication and authorization work correctly
- [ ] Error messages are clear and helpful
- [ ] Performance meets acceptable thresholds
- [ ] CORS is properly configured
- [ ] Concurrent operations don't cause race conditions
- [ ] Complete workflows work end-to-end
- [ ] Edge cases are handled gracefully

This comprehensive test suite serves as the baseline for validating that the workflow service refactoring maintains all existing functionality while improving the system architecture.