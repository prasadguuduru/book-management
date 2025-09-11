# DLQ Analysis Report

Generated: 2025-09-07T21:21:45.612Z

## Summary

- **Total Messages**: 13
- **Reprocessable**: 0
- **Non-reprocessable**: 13
- **Date Range**: 2025-09-07T09:56:05.982Z to 2025-09-07T16:19:49.052Z

## Messages by Error Type

- **INVALID_EVENT_DATA**: 13

## Messages by Root Cause

- **Event data missing required fields**: 13

## Critical Issues



## Common Patterns

- Most common error: INVALID_EVENT_DATA (13 occurrences)
- Average failure count per message: 57.7

## Recommendations

- 13 messages should be purged as they cannot be reprocessed

## Suggested Actions

- Deploy fixes for event detection logic
- Reprocess reprocessable messages after fixes
- Purge non-reprocessable messages
- Implement enhanced monitoring to prevent future accumulation

## Detailed Analysis


### Message a5f3bb5b-130a-4352-b792-6471d7555961

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 5
- **Original Timestamp**: 2025-09-07T16:19:49.052Z
- **Log Entries**: 0


### Message 303e5012-3fee-41b8-a546-11d4017ae07f

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 77
- **Original Timestamp**: 2025-09-07T10:17:37.550Z
- **Log Entries**: 0


### Message f46374da-dd97-440b-b437-fae62c1580ad

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 77
- **Original Timestamp**: 2025-09-07T10:29:53.588Z
- **Log Entries**: 0


### Message 78e6084b-1615-4ed5-b494-704edae9c47e

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 7
- **Original Timestamp**: 2025-09-07T15:54:39.479Z
- **Log Entries**: 0


### Message 997b3230-8e1e-4862-838c-200923025a7c

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 80
- **Original Timestamp**: 2025-09-07T10:28:47.336Z
- **Log Entries**: 0


### Message cee8bb27-6ac8-416d-9dee-1e5da417ffd2

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 6
- **Original Timestamp**: 2025-09-07T16:10:01.786Z
- **Log Entries**: 0


### Message 069aeddd-ff6e-41f5-9534-712626b0c349

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 82
- **Original Timestamp**: 2025-09-07T10:26:06.599Z
- **Log Entries**: 0


### Message 99006f28-fc66-4d12-b94c-1bde3fe05479

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 77
- **Original Timestamp**: 2025-09-07T10:05:42.109Z
- **Log Entries**: 0


### Message 6d317db1-b21f-467d-a0ef-f29d8c3c0e8c

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 79
- **Original Timestamp**: 2025-09-07T09:56:05.982Z
- **Log Entries**: 0


### Message ac5dfc1d-e83b-494b-a6a5-7e7b1d842e0d

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 56
- **Original Timestamp**: 2025-09-07T10:00:49.184Z
- **Log Entries**: 0


### Message c246351d-0856-4c8c-8382-87a332d37c80

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 55
- **Original Timestamp**: 2025-09-07T10:25:02.757Z
- **Log Entries**: 0


### Message a7e21482-0840-4343-8510-1d46f2bcf265

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 75
- **Original Timestamp**: 2025-09-07T10:09:22.599Z
- **Log Entries**: 0


### Message a9082d6c-eb7d-496e-b6ec-bf6976056fbb

- **Error Type**: INVALID_EVENT_DATA
- **Root Cause**: Event data missing required fields
- **Reprocessable**: No
- **Failure Reason**: Invalid or incomplete event data
- **Event Type**: book_status_changed
- **Book ID**: Unknown
- **User ID**: Unknown
- **Failure Count**: 74
- **Original Timestamp**: 2025-09-07T10:15:17.375Z
- **Log Entries**: 0

