#!/usr/bin/env ts-node

import { SNSClient, GetTopicAttributesCommand, ListTopicsCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: 'us-east-1' });

async function main() {
  console.log('🔍 Checking SNS connectivity and topic configuration...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  
  try {
    // First, list all topics to see if our topic exists
    console.log('\n📋 Listing all SNS topics...');
    const listResponse = await snsClient.send(new ListTopicsCommand({}));
    
    if (listResponse.Topics) {
      console.log(`Found ${listResponse.Topics.length} topics:`);
      const qaTopics = listResponse.Topics.filter(topic => 
        topic.TopicArn?.includes('qa') || topic.TopicArn?.includes('book')
      );
      
      if (qaTopics.length > 0) {
        console.log('\n🎯 QA/Book-related topics:');
        qaTopics.forEach(topic => {
          console.log(`  ✅ ${topic.TopicArn}`);
        });
      } else {
        console.log('\n❌ No QA/book-related topics found');
      }
    }
    
    // Check if our specific topic exists
    console.log(`\n🔍 Checking specific topic: ${topicArn}`);
    const topicExists = listResponse.Topics?.some(topic => topic.TopicArn === topicArn);
    
    if (topicExists) {
      console.log('✅ Topic exists');
      
      // Get topic attributes
      const attributesResponse = await snsClient.send(new GetTopicAttributesCommand({
        TopicArn: topicArn
      }));
      
      console.log('\n📊 Topic attributes:');
      if (attributesResponse.Attributes) {
        Object.entries(attributesResponse.Attributes).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
      
    } else {
      console.log('❌ Topic does not exist!');
    }
    
  } catch (error) {
    console.error('❌ Error checking SNS:', error);
  }
}

main();