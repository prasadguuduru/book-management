# DLQ Analysis Report

Generated: 2025-09-07T23:12:56.684Z

## Summary

- **Total Messages**: 2
- **Reprocessable**: 0
- **Non-reprocessable**: 2
- **Date Range**: 2025-09-07T22:50:03.077Z to 2025-09-07T22:50:25.349Z

## Messages by Error Type

- **REPEATED_FAILURE**: 1
- **INVALID_EVENT_DATA**: 1

## Messages by Root Cause

- **Message failed processing multiple times**: 1
- **Event data missing required fields**: 1

## Critical Issues



## Common Patterns

- Most common error: REPEATED_FAILURE (1 occurrences)
- Average failure count per message: 4.0

## Recommendations

- 2 messages should be purged as they cannot be reprocessed

## Suggested Actions

- Deploy fixes for event detection logic
- Reprocess reprocessable messages after fixes
- Purge non-reprocessable messages
- Implement enhanced monitoring to prevent future accumulation

## Detailed Analysis


### Message 2703b48f-e108-4445-ae06-c234d92fb196

- **Error Type**: REPEATED_FAILURE
- **Root Cause**: Message failed processing multiple times
- **Reprocessable**: No
- **Failure Reason**: Exceeded maximum retry attempts
- **Event Type**: book_published
- **Book ID**: test-book-123
- **User ID**: test-user-456
- **Failure Count**: 4
- **Original Timestamp**: 2025-09-07T22:50:03.077Z
- **Log Entries**: 0


### Message 6cea213d-bfd0-44da-b161-f2bc91d73a0a

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: BOOK_PUBLISHED
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 4
- **Original Timestamp**: 2025-09-07T22:50:25.349Z
- **Log Entries**: 0

