const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure AWS SDK for LocalStack
const dynamoDB = new AWS.DynamoDB.DocumentClient({
  endpoint: 'http://localhost:4566',
  region: 'us-west-2',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local'
  }
});

const TABLE_NAME = 'books-local';

// Mock data
const mockBooks = [
  {
    id: uuidv4(),
    title: 'The Great Adventure',
    author: 'John Doe',
    status: 'PUBLISHED',
    genre: 'Fiction',
    publishedDate: '2024-01-01'
  },
  {
    id: uuidv4(),
    title: 'Programming 101',
    author: 'Jane Smith',
    status: 'DRAFT',
    genre: 'Technical',
    publishedDate: null
  },
  {
    id: uuidv4(),
    title: 'Mystery Manor',
    author: 'Alice Johnson',
    status: 'PUBLISHED',
    genre: 'Mystery',
    publishedDate: '2024-01-10'
  }
];

// Function to create DynamoDB items
const createItems = async () => {
  console.log('Creating mock data in DynamoDB...');

  for (const book of mockBooks) {
    const item = {
      PK: `BOOK#${book.id}`,
      SK: 'METADATA',
      GSI1PK: `STATUS#${book.status}`,
      GSI1SK: `BOOK#${book.id}`,
      id: book.id,
      title: book.title,
      author: book.author,
      status: book.status,
      genre: book.genre,
      publishedDate: book.publishedDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await dynamoDB.put({
        TableName: TABLE_NAME,
        Item: item
      }).promise();
      console.log(`Created book: ${book.title}`);
    } catch (error) {
      console.error(`Error creating book ${book.title}:`, error);
    }
  }
};

// Function to verify data
const verifyData = async () => {
  try {
    const result = await dynamoDB.scan({
      TableName: TABLE_NAME
    }).promise();

    console.log('\nVerifying data in DynamoDB:');
    console.log(`Total items: ${result.Items.length}`);
    console.log('Items:', JSON.stringify(result.Items, null, 2));
  } catch (error) {
    console.error('Error verifying data:', error);
  }
};

// Main execution
const main = async () => {
  try {
    await createItems();
    await verifyData();
    console.log('\nMock data population complete!');
  } catch (error) {
    console.error('Error in main execution:', error);
    process.exit(1);
  }
};

main();
