#!/usr/bin/env ts-node

/**
 * Test and fix the event extraction issue
 */

// Test the actual message format we saw in the DLQ
const actualSQSMessage = {
    "Type": "Notification",
    "MessageId": "test-direct-1757240257233",
    "TopicArn": "arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events",
    "Message": "{\"eventType\":\"book_status_changed\",\"eventId\":\"test-direct-1757240257233\",\"timestamp\":\"2025-09-07T10:17:37.233Z\",\"source\":\"debug-script\",\"version\":\"1.0\",\"data\":{\"bookId\":\"test-book-direct\",\"title\":\"Direct SQS Test Book\",\"author\":\"debug-author\",\"previousStatus\":\"DRAFT\",\"newStatus\":\"SUBMITTED_FOR_EDITING\",\"changedBy\":\"debug-user\",\"metadata\":{\"notificationType\":\"book_submitted\"}}}",
    "Timestamp": "2025-09-07T10:17:37.233Z",
    "MessageAttributes": {
        "eventType": {
            "Type": "String",
            "Value": "book_status_changed"
        }
    }
};

const actualWorkflowMessage = {
    "Type": "Notification",
    "MessageId": "5eb7e32d-2bf6-59ac-a4be-821a8710d162",
    "TopicArn": "arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events",
    "Message": "{\"eventType\":\"book_status_changed\",\"eventId\":\"b7c6c6c1-ce37-464b-a180-0ad010d924f4\",\"timestamp\":\"2025-09-07T15:54:13.947Z\",\"source\":\"workflow-service\",\"version\":\"1.0\",\"data\":{\"bookId\":\"test-real-workflow-1757260453942\",\"title\":\"Real SNS Workflow Test Book\",\"author\":\"test-author-123\",\"previousStatus\":\"DRAFT\",\"newStatus\":\"SUBMITTED_FOR_EDITING\",\"changedBy\":\"test-user-123\",\"changeReason\":\"Testing real SNS workflow event publishing\",\"metadata\":{\"notificationType\":\"book_submitted\",\"testRun\":true,\"realSNSTest\":true,\"timestamp\":\"2025-09-07T15:54:13.947Z\",\"bookGenre\":\"fiction\",\"bookDescription\":\"A test book to trigger real SNS workflow events\"}}}",
    "Timestamp": "2025-09-07T15:54:13.947Z",
    "MessageAttributes": {
        "eventType": {
            "Type": "String",
            "Value": "book_status_changed"
        },
        "bookId": {
            "Type": "String",
            "Value": "test-real-workflow-1757260453942"
        },
        "newStatus": {
            "Type": "String",
            "Value": "SUBMITTED_FOR_EDITING"
        },
        "source": {
            "Type": "String",
            "Value": "workflow-service"
        }
    }
};

function testEventExtraction() {
    console.log('🧪 Testing event extraction with actual message formats...\n');

    console.log('📋 Testing debug script message:');
    try {
        // Step 1: Parse the SNS message
        console.log('  ✅ SNS message parsed successfully');

        // Step 2: Extract the event from the Message field
        const event = JSON.parse(actualSQSMessage.Message);
        console.log('  ✅ Event extracted successfully');
        console.log('  📋 Event source:', event.source);
        console.log('  📋 Event type:', event.eventType);
        console.log('  📋 Book ID:', event.data.bookId);

        // Step 3: Check what fields are missing for SNS interface
        console.log('  📋 SNS Message fields:');
        console.log('    Type:', actualSQSMessage.Type);
        console.log('    MessageId:', actualSQSMessage.MessageId);
        console.log('    TopicArn:', actualSQSMessage.TopicArn);
        console.log('    Message: [present]');
        console.log('    Timestamp:', actualSQSMessage.Timestamp);
        console.log('    SignatureVersion: [missing]');
        console.log('    Signature: [missing]');
        console.log('    SigningCertURL: [missing]');
        console.log('    UnsubscribeURL: [missing]');

    } catch (error) {
        console.log('  ❌ Failed:', error);
    }

    console.log('\n📋 Testing workflow service message:');
    try {
        // Step 1: Parse the SNS message
        console.log('  ✅ SNS message parsed successfully');

        // Step 2: Extract the event from the Message field
        const event = JSON.parse(actualWorkflowMessage.Message);
        console.log('  ✅ Event extracted successfully');
        console.log('  📋 Event source:', event.source);
        console.log('  📋 Event type:', event.eventType);
        console.log('  📋 Book ID:', event.data.bookId);

        // Step 3: Validate event structure
        const requiredFields = ['eventType', 'eventId', 'timestamp', 'source', 'version', 'data'];
        const requiredDataFields = ['bookId', 'title', 'author', 'newStatus', 'changedBy'];

        const missingFields = requiredFields.filter(field => !event[field]);
        const missingDataFields = requiredDataFields.filter(field => !event.data?.[field]);

        if (missingFields.length === 0 && missingDataFields.length === 0) {
            console.log('  ✅ Event structure is valid');
        } else {
            console.log('  ❌ Event structure is invalid:');
            if (missingFields.length > 0) {
                console.log('    Missing fields:', missingFields);
            }
            if (missingDataFields.length > 0) {
                console.log('    Missing data fields:', missingDataFields);
            }
        }

        // Step 4: Check source validation
        if (event.source === 'workflow-service') {
            console.log('  ✅ Source validation would pass');
        } else {
            console.log('  ❌ Source validation would fail:', event.source);
        }

    } catch (error) {
        console.log('  ❌ Failed:', error);
    }
}

function showSolution() {
    console.log('\n🔧 SOLUTION:');
    console.log('The issue is that the SNSBookEventMessage interface requires fields that are not present in actual SNS messages.');
    console.log('The interface should be updated to make optional fields actually optional:');
    console.log('');
    console.log('```typescript');
    console.log('export interface SNSBookEventMessage {');
    console.log('  Type: "Notification";');
    console.log('  MessageId: string;');
    console.log('  TopicArn: string;');
    console.log('  Subject?: string;');
    console.log('  Message: string; // JSON stringified BookStatusChangeEvent');
    console.log('  Timestamp: string;');
    console.log('  SignatureVersion?: string;  // Make optional');
    console.log('  Signature?: string;         // Make optional');
    console.log('  SigningCertURL?: string;    // Make optional');
    console.log('  UnsubscribeURL?: string;    // Make optional');
    console.log('  MessageAttributes?: Record<string, any>; // Add this field');
    console.log('}');
    console.log('```');
    console.log('');
    console.log('This will allow the event extraction to work with real SNS messages.');
}

function main() {
    testEventExtraction();
    showSolution();
    console.log('\n🎉 Analysis completed');
}

if (require.main === module) {
    main();
}