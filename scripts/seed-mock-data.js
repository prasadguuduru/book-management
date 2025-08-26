#!/usr/bin/env node

/**
 * Comprehensive LocalStack Data Seeding Script
 * Populates DynamoDB with realistic mock data for ebook publishing platform
 * 
 * This script creates:
 * - Multiple users across all roles (AUTHOR, EDITOR, PUBLISHER, READER)
 * - Books in various workflow states (DRAFT, SUBMITTED, READY, PUBLISHED)
 * - Reviews and ratings for published books
 * - Workflow history entries for state transitions
 * - User sessions for authentication testing
 * - Notifications for workflow events
 * 
 * Usage: node scripts/seed-localstack-comprehensive.js
 */

const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
require('uuid');

// Configure AWS SDK for LocalStack
const dynamodb = new AWS.DynamoDB.DocumentClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
});

// Regular DynamoDB client for control plane operations
const dynamodbClient = new AWS.DynamoDB({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
});

// Configuration (matching create-table.js)
const TABLE_NAME = process.env.TABLE_NAME || process.env.DYNAMODB_TABLE_NAME || 'ebook-platform-data';
const DEFAULT_PASSWORD = 'password123';

// Utility functions
async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}

function generateTimestamp(daysAgo = 0, hoursAgo = 0) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(date.getHours() - hoursAgo);
    return date.toISOString();
}

function generateWordCount(content) {
    return content.split(/\\s+/).length;
}

// Mock data generators
async function createMockUsers() {
    const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

    return [
        // Authors
        {
            userId: 'author-001',
            email: 'john.author@example.com',
            firstName: 'John',
            lastName: 'Steinberg',
            role: 'AUTHOR',
            isActive: true,
            emailVerified: true,
            hashedPassword,
            preferences: {
                notifications: true,
                theme: 'light',
                language: 'en'
            },
            createdAt: generateTimestamp(30),
            updatedAt: generateTimestamp(1),
            version: 1
        },
        {
            userId: 'author-002',
            email: 'sarah.writer@example.com',
            firstName: 'Sarah',
            lastName: 'Mitchell',
            role: 'AUTHOR',
            isActive: true,
            emailVerified: true,
            hashedPassword,
            preferences: {
                notifications: true,
                theme: 'dark',
                language: 'en'
            },
            createdAt: generateTimestamp(25),
            updatedAt: generateTimestamp(2),
            version: 1
        },
        {
            userId: 'author-003',
            email: 'mike.novelist@example.com',
            firstName: 'Michael',
            lastName: 'Chen',
            role: 'AUTHOR',
            isActive: true,
            emailVerified: true,
            hashedPassword,
            preferences: {
                notifications: false,
                theme: 'light',
                language: 'en'
            },
            createdAt: generateTimestamp(20),
            updatedAt: generateTimestamp(3),
            version: 1
        },

        // Editors
        {
            userId: 'editor-001',
            email: 'jane.editor@example.com',
            firstName: 'Jane',
            lastName: 'Rodriguez',
            role: 'EDITOR',
            isActive: true,
            emailVerified: true,
            hashedPassword,
            preferences: {
                notifications: true,
                theme: 'light',
                language: 'en'
            },
            createdAt: generateTimestamp(35),
            updatedAt: generateTimestamp(1),
            version: 1
        },
        {
            userId: 'editor-002',
            email: 'david.reviewer@example.com',
            firstName: 'David',
            lastName: 'Thompson',
            role: 'EDITOR',
            isActive: true,
            emailVerified: true,
            hashedPassword,
            preferences: {
                notifications: true,
                theme: 'dark',
                language: 'en'
            },
            createdAt: generateTimestamp(28),
            updatedAt: generateTimestamp(2),
            version: 1
        },

        // Publishers
        {
            userId: 'publisher-001',
            email: 'lisa.publisher@example.com',
            firstName: 'Lisa',
            lastName: 'Anderson',
            role: 'PUBLISHER',
            isActive: true,
            emailVerified: true,
            hashedPassword,
            preferences: {
                notifications: true,
                theme: 'light',
                language: 'en'
            },
            createdAt: generateTimestamp(40),
            updatedAt: generateTimestamp(1),
            version: 1
        },
        {
            userId: 'publisher-002',
            email: 'robert.publications@example.com',
            firstName: 'Robert',
            lastName: 'Williams',
            role: 'PUBLISHER',
            isActive: true,
            emailVerified: true,
            hashedPassword,
            preferences: {
                notifications: true,
                theme: 'light',
                language: 'en'
            },
            createdAt: generateTimestamp(32),
            updatedAt: generateTimestamp(1),
            version: 1
        },

        // Readers
        {
            userId: 'reader-001',
            email: 'alice.reader@example.com',
            firstName: 'Alice',
            lastName: 'Johnson',
            role: 'READER',
            isActive: true,
            emailVerified: true,
            hashedPassword,
            preferences: {
                notifications: true,
                theme: 'light',
                language: 'en'
            },
            createdAt: generateTimestamp(15),
            updatedAt: generateTimestamp(1),
            version: 1
        },
        {
            userId: 'reader-002',
            email: 'bob.bookworm@example.com',
            firstName: 'Bob',
            lastName: 'Davis',
            role: 'READER',
            isActive: true,
            emailVerified: true,
            hashedPassword,
            preferences: {
                notifications: false,
                theme: 'dark',
                language: 'en'
            },
            createdAt: generateTimestamp(12),
            updatedAt: generateTimestamp(2),
            version: 1
        },
        {
            userId: 'reader-003',
            email: 'emma.bibliophile@example.com',
            firstName: 'Emma',
            lastName: 'Wilson',
            role: 'READER',
            isActive: true,
            emailVerified: true,
            hashedPassword,
            preferences: {
                notifications: true,
                theme: 'light',
                language: 'en'
            },
            createdAt: generateTimestamp(8),
            updatedAt: generateTimestamp(1),
            version: 1
        }
    ];
}

function createMockBooks() {
    const sampleContent = {
        fiction: `Chapter 1: The Beginning

The morning sun cast long shadows across the cobblestone streets of Elderbrook, a small town nestled between rolling hills and ancient forests. Margaret Thornfield had always found solace in these quiet moments before the world awakened, when the only sounds were the gentle chirping of birds and the distant lowing of cattle in the nearby pastures.

As she walked down the familiar path to the village square, her mind wandered to the strange letter that had arrived the previous evening. The parchment was yellowed with age, sealed with crimson wax bearing an unfamiliar crest. The message within had been brief but intriguing: "The time has come to claim your inheritance. Meet me at the old oak tree when the church bells toll midnight."

Margaret had dismissed it as a prank at first, but something about the elegant handwriting and the weight of the paper suggested otherwise. Now, as she made her way through the awakening village, she couldn't shake the feeling that her quiet life was about to change forever.

Chapter 2: The Revelation

The old oak tree stood sentinel at the edge of Elderbrook, its gnarled branches reaching toward the star-filled sky like ancient fingers. Margaret arrived just as the church bells began their midnight song, her heart pounding with a mixture of excitement and apprehension.

A figure emerged from the shadows—a tall woman dressed in a deep blue cloak, her silver hair gleaming in the moonlight. "Margaret Thornfield," she said, her voice carrying an authority that seemed to resonate through the very air. "I am Celestine Ravencrest, and I have been waiting a very long time to meet you."`,

        nonFiction: `Introduction: The Digital Revolution

In the span of just two decades, digital technology has fundamentally transformed every aspect of human society. From the way we communicate and work to how we learn and entertain ourselves, the digital revolution has created unprecedented opportunities while simultaneously presenting new challenges that previous generations could never have imagined.

This book explores the multifaceted impact of digital transformation on modern society, examining both the remarkable benefits and the significant concerns that have emerged as we navigate this new technological landscape. Through careful analysis of current trends, expert interviews, and real-world case studies, we will uncover the complex relationships between technology, society, and human behavior in the 21st century.

Chapter 1: The Connected World

The concept of global connectivity has evolved from a futuristic dream to an everyday reality. Today, more than 4.6 billion people worldwide have access to the internet, creating an interconnected web of communication, commerce, and collaboration that spans continents and cultures.

This unprecedented level of connectivity has democratized access to information, enabling individuals in remote locations to access the same educational resources, news, and entertainment as those in major metropolitan areas. Online learning platforms have made quality education accessible to millions, while social media has given voice to previously marginalized communities and enabled grassroots movements to organize and effect change on a global scale.

However, this connectivity comes with its own set of challenges. The digital divide between those with access to high-speed internet and modern devices and those without has created new forms of inequality. Privacy concerns have become paramount as personal data is collected, analyzed, and monetized by corporations and governments alike.`,

        mystery: `Prologue: The Last Entry

Detective Sarah Chen stared at the journal entry, her coffee growing cold as she read the final words written in Dr. Elizabeth Hartwell's precise handwriting:

"I know they're watching me now. The research I've uncovered threatens everything they've built, every lie they've told. If something happens to me, look for the truth in the place where it all began—where the first patient was treated, where the first lie was born. The key is in the lighthouse. Trust no one at Blackwood Institute. —E.H."

The journal had been found clutched in Dr. Hartwell's hand when her body was discovered in her locked office at the prestigious Blackwood Institute for Psychological Research. The official cause of death was listed as suicide, but Sarah's instincts told her otherwise. The scene was too clean, too convenient, and the doctor's research notes were conspicuously missing.

Chapter 1: The Institute

Blackwood Institute stood like a fortress against the gray Seattle sky, its Gothic architecture a stark contrast to the modern glass buildings surrounding it. Sarah had visited the facility once before, years ago, when she was investigating a missing person case that had gone cold. The place had given her the creeps then, and it hadn't improved with time.

Dr. Marcus Blackwood, the institute's founder and director, greeted her in his opulent office overlooking Elliott Bay. He was a man in his sixties, impeccably dressed, with silver hair and piercing blue eyes that seemed to see right through her.

"Detective Chen," he said, his voice smooth as silk. "I understand you have some questions about poor Elizabeth's death. Such a tragedy—she was one of our most brilliant researchers."`,

        scienceFiction: `Chapter 1: The Signal

Commander Elena Vasquez floated in the observation deck of the research vessel Prometheus, watching the swirling nebula of Kepler-442 paint the darkness with ethereal blues and purples. After eighteen months of deep space exploration, the beauty of the cosmos still took her breath away, but today something was different. Today, they had detected something that would change everything.

"Commander," came the voice of Dr. James Park through the comm system. "You need to see this. We're picking up a structured signal from the fourth planet."

Elena pushed off from the viewport and glided through the zero-gravity corridor toward the communications bay. The Prometheus was humanity's most advanced exploration vessel, equipped with quantum drives and AI systems that pushed the boundaries of known science. But nothing had prepared them for what they were about to discover.

The communications bay hummed with activity as the crew analyzed the incoming data. Dr. Park, the mission's xenolinguist, looked up from his console with an expression of barely contained excitement.

"It's not natural, Commander," he said, his voice trembling slightly. "The signal shows clear mathematical patterns, prime number sequences, and what appears to be linguistic structure. This is definitely artificial—and it's definitely not human."

Elena felt her heart rate increase as the implications sank in. After centuries of searching, humanity had finally found evidence of intelligent extraterrestrial life. But as she studied the complex waveforms dancing across the screens, a chill ran down her spine. The signal wasn't just a greeting or a beacon—it was a warning.

Chapter 2: First Contact Protocol

The next seventy-two hours passed in a blur of analysis, debate, and preparation. The signal from Kepler-442b continued to transmit, growing stronger as the Prometheus adjusted its orbit to maintain optimal reception. Dr. Park and his team worked around the clock to decode the message, while Elena grappled with the weight of command decisions that would affect not just her crew, but potentially all of humanity.`
    };

    return [
        // DRAFT books
        {
            bookId: 'book-001',
            authorId: 'author-001',
            title: 'The Elderbrook Chronicles: Shadows of the Past',
            description: 'A captivating fantasy tale about a young woman who discovers her mysterious inheritance and the ancient secrets that come with it.',
            content: sampleContent.fiction,
            genre: 'fantasy',
            status: 'DRAFT',
            tags: ['fantasy', 'mystery', 'inheritance', 'magic'],
            wordCount: generateWordCount(sampleContent.fiction),
            createdAt: generateTimestamp(5),
            updatedAt: generateTimestamp(1),
            version: 3
        },
        {
            bookId: 'book-002',
            authorId: 'author-002',
            title: 'Digital Transformation in the Modern Age',
            description: 'An in-depth analysis of how digital technology is reshaping society, business, and human relationships.',
            content: sampleContent.nonFiction,
            genre: 'non-fiction',
            status: 'DRAFT',
            tags: ['technology', 'society', 'digital', 'transformation'],
            wordCount: generateWordCount(sampleContent.nonFiction),
            createdAt: generateTimestamp(3),
            updatedAt: generateTimestamp(0, 2),
            version: 1
        },

        // SUBMITTED_FOR_EDITING books
        {
            bookId: 'book-003',
            authorId: 'author-003',
            title: 'The Blackwood Institute Mystery',
            description: 'A gripping psychological thriller about a detective investigating suspicious deaths at a prestigious research facility.',
            content: sampleContent.mystery,
            genre: 'mystery',
            status: 'SUBMITTED_FOR_EDITING',
            tags: ['mystery', 'thriller', 'detective', 'psychological'],
            wordCount: generateWordCount(sampleContent.mystery),
            createdAt: generateTimestamp(8),
            updatedAt: generateTimestamp(2),
            version: 2
        },
        {
            bookId: 'book-004',
            authorId: 'author-001',
            title: 'Cooking with Seasonal Ingredients',
            description: 'A practical guide to creating delicious meals using fresh, seasonal produce throughout the year.',
            content: `Introduction: The Joy of Seasonal Cooking

There's something magical about cooking with ingredients that are at their peak freshness and flavor. Seasonal cooking not only ensures that you're getting the best taste and nutritional value from your food, but it also connects you to the natural rhythms of the earth and supports local agriculture.

This book will guide you through the seasons, showing you how to make the most of each month's bounty. From spring's tender asparagus and peas to winter's hearty root vegetables and citrus fruits, you'll discover new ways to celebrate the changing seasons through your cooking.

Chapter 1: Spring Awakening

Spring is a time of renewal and fresh beginnings, and nowhere is this more evident than in the kitchen. After months of heavy winter fare, our bodies crave the light, fresh flavors that spring vegetables provide. Asparagus, artichokes, spring onions, and tender lettuces are just beginning to appear in markets, offering a welcome change from stored winter vegetables.`,
            genre: 'non-fiction',
            status: 'SUBMITTED_FOR_EDITING',
            tags: ['cooking', 'seasonal', 'recipes', 'healthy'],
            wordCount: 1250,
            createdAt: generateTimestamp(12),
            updatedAt: generateTimestamp(4),
            version: 1
        },

        // READY_FOR_PUBLICATION books
        {
            bookId: 'book-005',
            authorId: 'author-002',
            title: 'The Art of Mindful Living',
            description: 'A comprehensive guide to incorporating mindfulness practices into daily life for better mental health and well-being.',
            content: `Introduction: Finding Peace in a Chaotic World

In our fast-paced, constantly connected world, finding moments of peace and clarity can seem impossible. We're bombarded with information, notifications, and demands on our attention from the moment we wake up until we fall asleep. It's no wonder that anxiety, stress, and burnout have become epidemic in modern society.

But what if there was a way to find calm in the storm? What if you could learn to navigate life's challenges with greater ease and resilience? The practice of mindfulness offers exactly that—a path to greater awareness, peace, and fulfillment.

Chapter 1: Understanding Mindfulness

Mindfulness is the practice of paying attention to the present moment with openness, curiosity, and acceptance. It's about noticing what's happening in your mind, body, and environment without getting caught up in judgment or the need to change anything.

This ancient practice, rooted in Buddhist tradition but now backed by extensive scientific research, has been shown to reduce stress, improve focus, enhance emotional regulation, and increase overall well-being.`,
            genre: 'non-fiction',
            status: 'READY_FOR_PUBLICATION',
            tags: ['mindfulness', 'mental-health', 'self-help', 'wellness'],
            wordCount: 1180,
            createdAt: generateTimestamp(15),
            updatedAt: generateTimestamp(1),
            version: 4
        },

        // PUBLISHED books
        {
            bookId: 'book-006',
            authorId: 'author-003',
            title: 'Signals from Kepler-442',
            description: 'A thrilling science fiction novel about humanity\'s first contact with an alien civilization and the challenges that follow.',
            content: sampleContent.scienceFiction,
            genre: 'science-fiction',
            status: 'PUBLISHED',
            tags: ['sci-fi', 'space', 'first-contact', 'exploration'],
            wordCount: generateWordCount(sampleContent.scienceFiction),
            publishedAt: generateTimestamp(7),
            createdAt: generateTimestamp(20),
            updatedAt: generateTimestamp(7),
            version: 5
        },
        {
            bookId: 'book-007',
            authorId: 'author-001',
            title: 'The Complete Guide to Urban Gardening',
            description: 'Everything you need to know about growing your own food in small spaces, from balconies to rooftops.',
            content: `Introduction: Growing Green in the City

Urban living doesn't have to mean giving up your dreams of growing your own food. Whether you have a small balcony, a rooftop, or just a sunny windowsill, you can create a thriving garden that provides fresh, healthy produce for your table.

This comprehensive guide will show you how to maximize your growing space, choose the right plants for your environment, and maintain a productive garden year-round, even in the heart of the city.

Chapter 1: Assessing Your Space

The first step in creating an urban garden is understanding what you have to work with. Every space is different, and successful gardening starts with honest assessment of your conditions.

Light is the most critical factor. Most vegetables need at least 6-8 hours of direct sunlight per day, while leafy greens can tolerate partial shade. Observe your space throughout the day to understand how the sun moves across it.`,
            genre: 'non-fiction',
            status: 'PUBLISHED',
            tags: ['gardening', 'urban', 'sustainability', 'food'],
            wordCount: 1320,
            publishedAt: generateTimestamp(14),
            createdAt: generateTimestamp(25),
            updatedAt: generateTimestamp(14),
            version: 3
        },
        {
            bookId: 'book-008',
            authorId: 'author-002',
            title: 'Whispers in the Wind',
            description: 'A romantic novel about two souls finding each other across time and circumstance.',
            content: `Chapter 1: The Letter

Isabella Martinez had always believed that some things were meant to be. As she stood in the dusty attic of her grandmother's Victorian house, holding a bundle of letters tied with a faded blue ribbon, she felt the weight of destiny in her hands.

The letters were addressed to someone named Elena, written in a flowing script that spoke of another era. The return address was from a place she'd never heard of—Moonrise Bay—and the postmark was dated fifty years ago.

"My dearest Elena," the first letter began, "I write to you from across the miles that separate us, hoping that these words will bridge the distance between our hearts..."

Isabella sank into an old rocking chair, her heart racing as she read about a love that had transcended time. The writer, someone named Gabriel, poured his soul onto the pages, describing a love so pure and deep that it made Isabella's own romantic disappointments seem trivial.

Chapter 2: The Journey

Three weeks later, Isabella found herself driving along the winding coastal highway toward Moonrise Bay. She had taken a leave of absence from her job as a graphic designer in San Francisco, telling her friends and family that she needed time to settle her grandmother's estate. But the truth was more complicated—she was searching for something she couldn't quite name.`,
            genre: 'romance',
            status: 'PUBLISHED',
            tags: ['romance', 'love-letters', 'destiny', 'time'],
            wordCount: 1450,
            publishedAt: generateTimestamp(21),
            createdAt: generateTimestamp(30),
            updatedAt: generateTimestamp(21),
            version: 2
        }
    ];
}

function createMockReviews() {
    return [
        // Reviews for "Signals from Kepler-442"
        {
            reviewId: 'review-001',
            bookId: 'book-006',
            userId: 'reader-001',
            rating: 5,
            comment: 'Absolutely incredible! The scientific details are fascinating and the characters are so well-developed. I couldn\'t put it down. This is exactly the kind of hard sci-fi I love.',
            helpful: 12,
            reportCount: 0,
            isModerated: false,
            createdAt: generateTimestamp(6),
            updatedAt: generateTimestamp(6),
            version: 1
        },
        {
            reviewId: 'review-002',
            bookId: 'book-006',
            userId: 'reader-002',
            rating: 4,
            comment: 'Great concept and execution. The first contact scenario felt very realistic. My only complaint is that it ended on a cliffhanger - I need the sequel now!',
            helpful: 8,
            reportCount: 0,
            isModerated: false,
            createdAt: generateTimestamp(5),
            updatedAt: generateTimestamp(5),
            version: 1
        },
        {
            reviewId: 'review-003',
            bookId: 'book-006',
            userId: 'reader-003',
            rating: 5,
            comment: 'This book made me think about humanity\'s place in the universe. The author did an amazing job balancing scientific accuracy with compelling storytelling.',
            helpful: 15,
            reportCount: 0,
            isModerated: false,
            createdAt: generateTimestamp(4),
            updatedAt: generateTimestamp(4),
            version: 1
        },

        // Reviews for "The Complete Guide to Urban Gardening"
        {
            reviewId: 'review-004',
            bookId: 'book-007',
            userId: 'reader-001',
            rating: 5,
            comment: 'As someone living in a tiny apartment, this book has been a game-changer. I now have a thriving herb garden on my fire escape! The step-by-step instructions are perfect for beginners.',
            helpful: 23,
            reportCount: 0,
            isModerated: false,
            createdAt: generateTimestamp(12),
            updatedAt: generateTimestamp(12),
            version: 1
        },
        {
            reviewId: 'review-005',
            bookId: 'book-007',
            userId: 'reader-002',
            rating: 4,
            comment: 'Very practical advice with lots of helpful photos and diagrams. I wish there was more information about pest control in urban environments, but overall an excellent resource.',
            helpful: 7,
            reportCount: 0,
            isModerated: false,
            createdAt: generateTimestamp(10),
            updatedAt: generateTimestamp(10),
            version: 1
        },

        // Reviews for "Whispers in the Wind"
        {
            reviewId: 'review-006',
            bookId: 'book-008',
            userId: 'reader-003',
            rating: 5,
            comment: 'I\'m not usually a romance reader, but this book completely won me over. The connection between past and present is beautifully woven, and the characters feel so real.',
            helpful: 18,
            reportCount: 0,
            isModerated: false,
            createdAt: generateTimestamp(19),
            updatedAt: generateTimestamp(19),
            version: 1
        },
        {
            reviewId: 'review-007',
            bookId: 'book-008',
            userId: 'reader-001',
            rating: 4,
            comment: 'A lovely, heartwarming story. The descriptions of Moonrise Bay made me want to visit immediately. Perfect for a cozy weekend read.',
            helpful: 11,
            reportCount: 0,
            isModerated: false,
            createdAt: generateTimestamp(18),
            updatedAt: generateTimestamp(18),
            version: 1
        }
    ];
}

function createWorkflowEntries() {
    return [
        // Workflow for book-003 (SUBMITTED_FOR_EDITING)
        {
            bookId: 'book-003',
            fromState: null,
            toState: 'DRAFT',
            actionBy: 'author-003',
            action: 'CREATE',
            comments: 'Initial book creation',
            timestamp: generateTimestamp(8)
        },
        {
            bookId: 'book-003',
            fromState: 'DRAFT',
            toState: 'SUBMITTED_FOR_EDITING',
            actionBy: 'author-003',
            action: 'SUBMIT',
            comments: 'Ready for editorial review. This is my first mystery novel and I\'m excited to get feedback!',
            timestamp: generateTimestamp(2)
        },

        // Workflow for book-004 (SUBMITTED_FOR_EDITING)
        {
            bookId: 'book-004',
            fromState: null,
            toState: 'DRAFT',
            actionBy: 'author-001',
            action: 'CREATE',
            comments: 'New cookbook project',
            timestamp: generateTimestamp(12)
        },
        {
            bookId: 'book-004',
            fromState: 'DRAFT',
            toState: 'SUBMITTED_FOR_EDITING',
            actionBy: 'author-001',
            action: 'SUBMIT',
            comments: 'Seasonal cookbook ready for review. Includes 120 recipes organized by season.',
            timestamp: generateTimestamp(4)
        },

        // Workflow for book-005 (READY_FOR_PUBLICATION)
        {
            bookId: 'book-005',
            fromState: null,
            toState: 'DRAFT',
            actionBy: 'author-002',
            action: 'CREATE',
            comments: 'Mindfulness guide project',
            timestamp: generateTimestamp(15)
        },
        {
            bookId: 'book-005',
            fromState: 'DRAFT',
            toState: 'SUBMITTED_FOR_EDITING',
            actionBy: 'author-002',
            action: 'SUBMIT',
            comments: 'Comprehensive mindfulness guide ready for editorial review',
            timestamp: generateTimestamp(8)
        },
        {
            bookId: 'book-005',
            fromState: 'SUBMITTED_FOR_EDITING',
            toState: 'READY_FOR_PUBLICATION',
            actionBy: 'editor-001',
            action: 'APPROVE',
            comments: 'Excellent work! The content is well-researched and accessible. Minor formatting corrections have been made.',
            timestamp: generateTimestamp(1)
        },

        // Workflow for book-006 (PUBLISHED)
        {
            bookId: 'book-006',
            fromState: null,
            toState: 'DRAFT',
            actionBy: 'author-003',
            action: 'CREATE',
            comments: 'Science fiction novel project',
            timestamp: generateTimestamp(20)
        },
        {
            bookId: 'book-006',
            fromState: 'DRAFT',
            toState: 'SUBMITTED_FOR_EDITING',
            actionBy: 'author-003',
            action: 'SUBMIT',
            comments: 'First contact sci-fi novel ready for review',
            timestamp: generateTimestamp(12)
        },
        {
            bookId: 'book-006',
            fromState: 'SUBMITTED_FOR_EDITING',
            toState: 'READY_FOR_PUBLICATION',
            actionBy: 'editor-002',
            action: 'APPROVE',
            comments: 'Outstanding work! The scientific concepts are well-researched and the plot is engaging.',
            timestamp: generateTimestamp(9)
        },
        {
            bookId: 'book-006',
            fromState: 'READY_FOR_PUBLICATION',
            toState: 'PUBLISHED',
            actionBy: 'publisher-001',
            action: 'PUBLISH',
            comments: 'Approved for publication. This has strong commercial potential.',
            timestamp: generateTimestamp(7)
        },

        // Workflow for book-007 (PUBLISHED)
        {
            bookId: 'book-007',
            fromState: null,
            toState: 'DRAFT',
            actionBy: 'author-001',
            action: 'CREATE',
            comments: 'Urban gardening guide',
            timestamp: generateTimestamp(25)
        },
        {
            bookId: 'book-007',
            fromState: 'DRAFT',
            toState: 'SUBMITTED_FOR_EDITING',
            actionBy: 'author-001',
            action: 'SUBMIT',
            comments: 'Complete urban gardening guide with practical tips',
            timestamp: generateTimestamp(18)
        },
        {
            bookId: 'book-007',
            fromState: 'SUBMITTED_FOR_EDITING',
            toState: 'READY_FOR_PUBLICATION',
            actionBy: 'editor-001',
            action: 'APPROVE',
            comments: 'Very practical and well-organized. Great resource for urban dwellers.',
            timestamp: generateTimestamp(16)
        },
        {
            bookId: 'book-007',
            fromState: 'READY_FOR_PUBLICATION',
            toState: 'PUBLISHED',
            actionBy: 'publisher-002',
            action: 'PUBLISH',
            comments: 'Perfect timing with the growing interest in sustainable living.',
            timestamp: generateTimestamp(14)
        },

        // Workflow for book-008 (PUBLISHED)
        {
            bookId: 'book-008',
            fromState: null,
            toState: 'DRAFT',
            actionBy: 'author-002',
            action: 'CREATE',
            comments: 'Romance novel project',
            timestamp: generateTimestamp(30)
        },
        {
            bookId: 'book-008',
            fromState: 'DRAFT',
            toState: 'SUBMITTED_FOR_EDITING',
            actionBy: 'author-002',
            action: 'SUBMIT',
            comments: 'Time-spanning romance novel ready for review',
            timestamp: generateTimestamp(25)
        },
        {
            bookId: 'book-008',
            fromState: 'SUBMITTED_FOR_EDITING',
            toState: 'READY_FOR_PUBLICATION',
            actionBy: 'editor-002',
            action: 'APPROVE',
            comments: 'Beautiful storytelling with strong emotional depth.',
            timestamp: generateTimestamp(23)
        },
        {
            bookId: 'book-008',
            fromState: 'READY_FOR_PUBLICATION',
            toState: 'PUBLISHED',
            actionBy: 'publisher-001',
            action: 'PUBLISH',
            comments: 'Romance readers will love this. Approved for publication.',
            timestamp: generateTimestamp(21)
        }
    ];
}

function createMockSessions() {
    return [
        {
            sessionId: 'session-001',
            userId: 'author-001',
            refreshToken: 'hashed-refresh-token-001',
            deviceInfo: {
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                ipAddress: 'hashed-ip-001',
                location: 'San Francisco, CA'
            },
            isActive: true,
            lastActivity: generateTimestamp(0, 2),
            createdAt: generateTimestamp(1),
            ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days from now
        },
        {
            sessionId: 'session-002',
            userId: 'editor-001',
            refreshToken: 'hashed-refresh-token-002',
            deviceInfo: {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ipAddress: 'hashed-ip-002',
                location: 'New York, NY'
            },
            isActive: true,
            lastActivity: generateTimestamp(0, 1),
            createdAt: generateTimestamp(0, 8),
            ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        },
        {
            sessionId: 'session-003',
            userId: 'reader-001',
            refreshToken: 'hashed-refresh-token-003',
            deviceInfo: {
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
                ipAddress: 'hashed-ip-003',
                location: 'Austin, TX'
            },
            isActive: true,
            lastActivity: generateTimestamp(0, 0.5),
            createdAt: generateTimestamp(0, 4),
            ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        }
    ];
}

function createMockNotifications() {
    return [
        // Notifications for book submissions
        {
            notificationId: 'notification-001',
            userId: 'editor-001',
            type: 'BOOK_SUBMITTED',
            title: 'New Book Submitted for Review',
            message: 'Michael Chen has submitted "The Blackwood Institute Mystery" for editorial review.',
            data: {
                bookId: 'book-003',
                bookTitle: 'The Blackwood Institute Mystery',
                authorName: 'Michael Chen',
                submittedAt: generateTimestamp(2)
            },
            channels: ['email', 'in-app'],
            deliveryStatus: {
                email: 'delivered',
                inApp: 'delivered'
            },
            isRead: false,
            createdAt: generateTimestamp(2),
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
        },
        {
            notificationId: 'notification-002',
            userId: 'editor-002',
            type: 'BOOK_SUBMITTED',
            title: 'New Book Submitted for Review',
            message: 'John Steinberg has submitted "Cooking with Seasonal Ingredients" for editorial review.',
            data: {
                bookId: 'book-004',
                bookTitle: 'Cooking with Seasonal Ingredients',
                authorName: 'John Steinberg',
                submittedAt: generateTimestamp(4)
            },
            channels: ['email', 'in-app'],
            deliveryStatus: {
                email: 'delivered',
                inApp: 'read'
            },
            isRead: true,
            createdAt: generateTimestamp(4),
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
        },

        // Notifications for book approvals
        {
            notificationId: 'notification-003',
            userId: 'author-002',
            type: 'BOOK_APPROVED',
            title: 'Your Book Has Been Approved!',
            message: 'Congratulations! "The Art of Mindful Living" has been approved and is ready for publication.',
            data: {
                bookId: 'book-005',
                bookTitle: 'The Art of Mindful Living',
                editorName: 'Jane Rodriguez',
                approvedAt: generateTimestamp(1)
            },
            channels: ['email', 'in-app'],
            deliveryStatus: {
                email: 'delivered',
                inApp: 'delivered'
            },
            isRead: false,
            createdAt: generateTimestamp(1),
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
        },

        // Notifications for publications
        {
            notificationId: 'notification-004',
            userId: 'author-003',
            type: 'BOOK_PUBLISHED',
            title: 'Your Book is Now Published!',
            message: '"Signals from Kepler-442" is now available to readers. Congratulations on your publication!',
            data: {
                bookId: 'book-006',
                bookTitle: 'Signals from Kepler-442',
                publisherName: 'Lisa Anderson',
                publishedAt: generateTimestamp(7)
            },
            channels: ['email', 'in-app'],
            deliveryStatus: {
                email: 'delivered',
                inApp: 'read'
            },
            isRead: true,
            createdAt: generateTimestamp(7),
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
        },

        // Notifications for new reviews
        {
            notificationId: 'notification-005',
            userId: 'author-003',
            type: 'REVIEW_ADDED',
            title: 'New Review for Your Book',
            message: 'Alice Johnson left a 5-star review for "Signals from Kepler-442".',
            data: {
                bookId: 'book-006',
                bookTitle: 'Signals from Kepler-442',
                reviewerName: 'Alice Johnson',
                rating: 5,
                reviewId: 'review-001'
            },
            channels: ['email', 'in-app'],
            deliveryStatus: {
                email: 'delivered',
                inApp: 'delivered'
            },
            isRead: false,
            createdAt: generateTimestamp(6),
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
        }
    ];
}

// Main seeding function
async function seedLocalStackData() {
    console.log('🌱 Starting comprehensive LocalStack data seeding...');
    console.log(`📊 Target table: ${TABLE_NAME}`);
    console.log(`🔗 DynamoDB endpoint: ${process.env.AWS_ENDPOINT_URL || 'http://localhost:4566'}`);

    try {
        // Test connection
        console.log('🔍 Testing DynamoDB connection...');
        await dynamodbClient.describeTable({ TableName: TABLE_NAME }).promise();
        console.log('✅ DynamoDB connection successful');

        // Create all mock data
        console.log('🏗️  Generating mock data...');
        const users = await createMockUsers();
        const books = createMockBooks();
        const reviews = createMockReviews();
        const workflowEntries = createWorkflowEntries();
        const sessions = createMockSessions();
        const notifications = createMockNotifications();

        console.log(`📊 Generated: ${users.length} users, ${books.length} books, ${reviews.length} reviews, ${workflowEntries.length} workflow entries, ${sessions.length} sessions, ${notifications.length} notifications`);

        // Seed users
        console.log('👥 Seeding users...');
        for (const user of users) {
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: {
                    PK: `USER#${user.userId}`,
                    SK: 'PROFILE',
                    entityType: 'USER',
                    ...user
                }
            }).promise();
        }
        console.log(`✅ Seeded ${users.length} users`);

        // Seed books
        console.log('📚 Seeding books...');
        for (const book of books) {
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: {
                    PK: `BOOK#${book.bookId}`,
                    SK: 'METADATA',
                    GSI1PK: `STATUS#${book.status}`,
                    GSI1SK: `BOOK#${book.bookId}`,
                    GSI2PK: `GENRE#${book.genre.toUpperCase()}`,
                    GSI2SK: `BOOK#${book.bookId}`,
                    entityType: 'BOOK',
                    ...book
                }
            }).promise();
        }
        console.log(`✅ Seeded ${books.length} books`);

        // Seed reviews
        console.log('⭐ Seeding reviews...');
        for (const review of reviews) {
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: {
                    PK: `BOOK#${review.bookId}`,
                    SK: `REVIEW#${review.reviewId}`,
                    entityType: 'REVIEW',
                    ...review
                }
            }).promise();
        }
        console.log(`✅ Seeded ${reviews.length} reviews`);

        // Seed workflow entries
        console.log('🔄 Seeding workflow entries...');
        for (const entry of workflowEntries) {
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: {
                    PK: `WORKFLOW#${entry.bookId}`,
                    SK: entry.timestamp,
                    entityType: 'WORKFLOW',
                    ...entry
                }
            }).promise();
        }
        console.log(`✅ Seeded ${workflowEntries.length} workflow entries`);

        // Seed sessions
        console.log('🔐 Seeding user sessions...');
        for (const session of sessions) {
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: {
                    PK: `SESSION#${session.sessionId}`,
                    SK: 'METADATA',
                    entityType: 'SESSION',
                    ...session
                }
            }).promise();
        }
        console.log(`✅ Seeded ${sessions.length} sessions`);

        // Seed notifications
        console.log('🔔 Seeding notifications...');
        for (const notification of notifications) {
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: {
                    PK: `USER#${notification.userId}`,
                    SK: `NOTIFICATION#${notification.createdAt}`,
                    entityType: 'NOTIFICATION',
                    ...notification
                }
            }).promise();
        }
        console.log(`✅ Seeded ${notifications.length} notifications`);

        // Summary
        console.log('\\n🎉 LocalStack data seeding completed successfully!');
        console.log('\\n📊 Summary:');
        console.log(`   👥 Users: ${users.length} (${users.filter(u => u.role === 'AUTHOR').length} authors, ${users.filter(u => u.role === 'EDITOR').length} editors, ${users.filter(u => u.role === 'PUBLISHER').length} publishers, ${users.filter(u => u.role === 'READER').length} readers)`);
        console.log(`   📚 Books: ${books.length} (${books.filter(b => b.status === 'DRAFT').length} draft, ${books.filter(b => b.status === 'SUBMITTED_FOR_EDITING').length} submitted, ${books.filter(b => b.status === 'READY_FOR_PUBLICATION').length} ready, ${books.filter(b => b.status === 'PUBLISHED').length} published)`);
        console.log(`   ⭐ Reviews: ${reviews.length}`);
        console.log(`   🔄 Workflow entries: ${workflowEntries.length}`);
        console.log(`   🔐 Active sessions: ${sessions.length}`);
        console.log(`   🔔 Notifications: ${notifications.length}`);

        console.log('\\n🚀 Ready for testing! You can now:');
        console.log('   • Login with any user (password: password123)');
        console.log('   • Test the complete book publishing workflow');
        console.log('   • View books in different states');
        console.log('   • Read and write reviews');
        console.log('   • Check notifications and workflow history');

        console.log('\\n👥 Test Users:');
        console.log('   📝 Authors: john.author@example.com, sarah.writer@example.com, mike.novelist@example.com');
        console.log('   ✏️  Editors: jane.editor@example.com, david.reviewer@example.com');
        console.log('   📖 Publishers: lisa.publisher@example.com, robert.publications@example.com');
        console.log('   👀 Readers: alice.reader@example.com, bob.bookworm@example.com, emma.bibliophile@example.com');

    } catch (error) {
        console.error('❌ Error seeding LocalStack data:', error);

        if (error.code === 'ResourceNotFoundException') {
            console.error('\\n💡 The DynamoDB table does not exist. Please run:');
            console.error('   npm run db:create');
        } else if (error.code === 'NetworkingError') {
            console.error('\\n💡 Cannot connect to LocalStack. Please ensure:');
            console.error('   1. LocalStack is running: npm run localstack:start');
            console.error('   2. The endpoint URL is correct in your .env.local file');
        }

        process.exit(1);
    }
}

// Run the seeding if this script is executed directly
if (require.main === module) {
    seedLocalStackData();
}

module.exports = {
    seedLocalStackData,
    createMockUsers,
    createMockBooks,
    createMockReviews,
    createWorkflowEntries,
    createMockSessions,
    createMockNotifications
};