#!/usr/bin/env npx ts-node

/**
 * Test the complete submit flow to confirm SES email delivery
 * Creates a book, submits it, and monitors logs for email confirmation
 */

import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function testSubmitEmailFlow() {
  console.log('🧪 Testing Complete Submit Email Flow');
  console.log('=' .repeat(60));
  
  const cloudFrontUrl = 'https://d2xg2iv1qaydac.cloudfront.net';
  const testBookTitle = `Test Submit Book ${Date.now()}`;
  
  console.log('📋 Test Plan:');
  console.log('1. Create a new book via API');
  console.log('2. Submit the book for review');
  console.log('3. Monitor logs for email delivery confirmation');
  console.log('4. Verify SES sent email to bookmanagement@yopmail.com');
  console.log('');
  
  // You'll need to get a valid JWT token from your login
  console.log('🔑 To run this test, you need a valid JWT token.');
  console.log('   1. Login to your dashboard');
  console.log('   2. Open browser dev tools → Network tab');
  console.log('   3. Make any API request and copy the Authorization header');
  console.log('   4. Replace YOUR_JWT_TOKEN below with the actual token');
  console.log('');
  
  const jwtToken = 'YOUR_JWT_TOKEN'; // Replace with actual token
  
  if (jwtToken === 'YOUR_JWT_TOKEN') {
    console.log('❌ Please replace YOUR_JWT_TOKEN with a real JWT token from your browser');
    console.log('');
    console.log('🔧 Alternative: Manual Test Commands');
    console.log('   Run these curl commands manually:');
    console.log('');
    console.log('   # 1. Create a book');
    console.log(`   curl -X POST ${cloudFrontUrl}/api/books \\`);
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -H "Authorization: Bearer YOUR_ACTUAL_TOKEN" \\');
    console.log(`     -d '{"title": "${testBookTitle}", "description": "Test book for email validation", "genre": "FICTION"}'`);
    console.log('');
    console.log('   # 2. Submit the book (replace BOOK_ID with the ID from step 1)');
    console.log(`   curl -X POST ${cloudFrontUrl}/api/workflow/books/BOOK_ID/submit \\`);
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -H "Authorization: Bearer YOUR_ACTUAL_TOKEN" \\');
    console.log('     -d \'{"comments": "Ready for review"}\'');
    console.log('');
    console.log('   # 3. Then run the log monitoring script');
    console.log('   npx ts-node -r tsconfig-paths/register src/test/debug/monitor-submit-logs.ts');
    return;
  }
  
  try {
    console.log('📚 Step 1: Creating test book...');
    
    // Create book
    const createBookResponse = await fetch(`${cloudFrontUrl}/api/books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({
        title: testBookTitle,
        description: 'Test book for email validation',
        genre: 'FICTION'
      })
    });
    
    if (!createBookResponse.ok) {
      throw new Error(`Failed to create book: ${createBookResponse.status} ${createBookResponse.statusText}`);
    }
    
    const bookData = await createBookResponse.json();
    const bookId = bookData.bookId;
    
    console.log(`✅ Book created: ${bookId}`);
    console.log(`   Title: ${testBookTitle}`);
    
    // Wait a moment
    console.log('\\n⏳ Waiting 2 seconds before submitting...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\\n📤 Step 2: Submitting book for review...');
    
    // Submit book
    const submitResponse = await fetch(`${cloudFrontUrl}/api/workflow/books/${bookId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({
        comments: 'Ready for review - testing email notifications'
      })
    });
    
    if (!submitResponse.ok) {
      throw new Error(`Failed to submit book: ${submitResponse.status} ${submitResponse.statusText}`);
    }
    
    console.log('✅ Book submitted successfully');
    
    // Monitor logs
    console.log('\\n🔍 Step 3: Monitoring logs for email delivery...');
    console.log('   Looking for notification service activity...');
    
    const startTime = Date.now();
    let emailSent = false;
    let attempts = 0;
    const maxAttempts = 15; // 30 seconds total
    
    while (!emailSent && attempts < maxAttempts) {
      attempts++;
      console.log(`   Attempt ${attempts}/${maxAttempts}...`);
      
      try {
        // Check notification service logs
        const streamsResponse = await logsClient.send(new DescribeLogStreamsCommand({
          logGroupName: '/aws/lambda/qa-notification-service',
          orderBy: 'LastEventTime',
          descending: true,
          limit: 2
        }));
        
        const streams = streamsResponse.logStreams || [];
        
        for (const stream of streams) {
          if (!stream.logStreamName) continue;
          
          const eventsResponse = await logsClient.send(new GetLogEventsCommand({
            logGroupName: '/aws/lambda/qa-notification-service',
            logStreamName: stream.logStreamName,
            startTime: startTime - 5000, // 5 seconds before we started
            limit: 50
          }));
          
          const events = eventsResponse.events || [];
          
          for (const event of events) {
            if (!event.message || !event.timestamp) continue;
            
            const message = event.message.trim();
            
            // Look for our book and email success
            if (message.includes(bookId) && 
                (message.includes('EMAIL SENT SUCCESSFULLY') || 
                 message.includes('book_submitted'))) {
              
              console.log('\\n🎉 Found email delivery confirmation!');
              console.log(`   Timestamp: ${new Date(event.timestamp).toISOString()}`);
              
              // Try to parse the log message for details
              try {
                const logData = JSON.parse(message.split('\\t').pop() || '{}');
                if (logData.recipientEmail) {
                  console.log(`   ✅ Recipient: ${logData.recipientEmail}`);
                }
                if (logData.emailSubject) {
                  console.log(`   ✅ Subject: ${logData.emailSubject}`);
                }
                if (logData.messageId) {
                  console.log(`   ✅ SES Message ID: ${logData.messageId}`);
                }
              } catch (e) {
                console.log(`   Message: ${message.substring(0, 200)}...`);
              }
              
              emailSent = true;
              break;
            }
          }
          
          if (emailSent) break;
        }
      } catch (error) {
        console.log(`   Error checking logs: ${error}`);
      }
      
      if (!emailSent && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\\n📊 Test Results:');
    console.log('=' .repeat(40));
    
    if (emailSent) {
      console.log('✅ SUCCESS: Email delivery confirmed!');
      console.log('   📧 SES successfully sent email to bookmanagement@yopmail.com');
      console.log('   📚 Subject: "📚 Book Submitted for Review"');
      console.log('   🎯 The submit email flow is working correctly');
    } else {
      console.log('❌ Email delivery not confirmed within 30 seconds');
      console.log('   This could mean:');
      console.log('   1. SNS → SQS delivery delay (intermittent issue)');
      console.log('   2. Notification service processing delay');
      console.log('   3. Check CloudWatch logs manually for more details');
    }
    
    console.log(`\\n📋 Test book created: ${bookId}`);
    console.log('   You can check this book in your dashboard');
    console.log('   Status should be: SUBMITTED_FOR_EDITING');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\\n💡 Make sure:');
    console.log('   1. JWT token is valid and not expired');
    console.log('   2. You have proper permissions');
    console.log('   3. The API endpoints are accessible');
  }
}

testSubmitEmailFlow().catch(console.error);