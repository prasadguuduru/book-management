#!/usr/bin/env npx tsx

/**
 * Test what happens when we try to publish a non-existent book
 */

import https from 'https';

async function testNonExistentBookPublish() {
    console.log('🧪 Testing Publish with Non-Existent Book');
    console.log('==========================================');

    const bookId = '5ec5066b-3c98-44bc-8c9f-cb62fba6d48f';
    const apiUrl = 'https://d2xg2iv1qaydac.cloudfront.net';
    const endpoint = `/api/workflow/books/${bookId}/publish`;

    console.log(`📞 Calling: ${apiUrl}${endpoint}`);

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            action: 'PUBLISH',
            comments: 'Test publish of non-existent book'
        });

        const options = {
            hostname: 'd2xg2iv1qaydac.cloudfront.net',
            port: 443,
            path: endpoint,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': 'Bearer your-test-token', // You'll need a valid token
                'Origin': 'https://d2xg2iv1qaydac.cloudfront.net'
            }
        };

        const req = https.request(options, (res) => {
            console.log(`📊 Response Status: ${res.statusCode}`);
            console.log(`📋 Response Headers:`, res.headers);

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`📄 Response Body:`, data);

                try {
                    const jsonResponse = JSON.parse(data);
                    console.log(`📝 Parsed Response:`, JSON.stringify(jsonResponse, null, 2));
                } catch (e) {
                    console.log('❌ Could not parse response as JSON');
                }

                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (error) => {
            console.error('❌ Request Error:', error);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// Test with an existing book too
async function testExistingBookPublish() {
    console.log('\n🧪 Testing Publish with Existing Book');
    console.log('=====================================');

    const bookId = '125eca00-7fe5-45c1-a1d6-0b9a9673f99e'; // This book exists and is already PUBLISHED
    const apiUrl = 'https://d2xg2iv1qaydac.cloudfront.net';
    const endpoint = `/api/workflow/books/${bookId}/publish`;

    console.log(`📞 Calling: ${apiUrl}${endpoint}`);
    console.log(`📚 Book Status: PUBLISHED (should fail - already published)`);

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            action: 'PUBLISH',
            comments: 'Test publish of already published book'
        });

        const options = {
            hostname: 'd2xg2iv1qaydac.cloudfront.net',
            port: 443,
            path: endpoint,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': 'Bearer your-test-token', // You'll need a valid token
                'Origin': 'https://d2xg2iv1qaydac.cloudfront.net'
            }
        };

        const req = https.request(options, (res) => {
            console.log(`📊 Response Status: ${res.statusCode}`);
            console.log(`📋 Response Headers:`, res.headers);

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`📄 Response Body:`, data);

                try {
                    const jsonResponse = JSON.parse(data);
                    console.log(`📝 Parsed Response:`, JSON.stringify(jsonResponse, null, 2));
                } catch (e) {
                    console.log('❌ Could not parse response as JSON');
                }

                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (error) => {
            console.error('❌ Request Error:', error);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

async function runTests() {
    try {
        await testNonExistentBookPublish();
        await testExistingBookPublish();
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the tests
runTests().catch(console.error);