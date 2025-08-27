/**
 * Mock data seeding for development and testing
 */

import { userDAO } from '@/data/dao/user-dao';
import { bookDAO } from '@/data/dao/book-dao';
import { logger } from '@/utils/logger';
import { RegisterRequest, CreateBookRequest, BookGenre } from '@/types';

export class SeedDataService {
  private readonly mockUsers: (RegisterRequest & { id?: string })[] = [
    {
      email: 'author1@example.com',
      password: 'password123',
      firstName: 'Alice',
      lastName: 'Author',
      role: 'AUTHOR',
    },
    {
      email: 'author2@example.com',
      password: 'password123',
      firstName: 'Bob',
      lastName: 'Writer',
      role: 'AUTHOR',
    },
    {
      email: 'editor1@example.com',
      password: 'password123',
      firstName: 'Carol',
      lastName: 'Editor',
      role: 'EDITOR',
    },
    {
      email: 'publisher1@example.com',
      password: 'password123',
      firstName: 'David',
      lastName: 'Publisher',
      role: 'PUBLISHER',
    },
    {
      email: 'reader1@example.com',
      password: 'password123',
      firstName: 'Eve',
      lastName: 'Reader',
      role: 'READER',
    },
    {
      email: 'reader2@example.com',
      password: 'password123',
      firstName: 'Frank',
      lastName: 'Bookworm',
      role: 'READER',
    },
  ];

  private readonly mockBooks: (CreateBookRequest & { authorEmail: string; status?: string })[] = [
    {
      title: 'The Mystery of the Digital Age',
      description: 'A thrilling mystery set in the modern world of technology and cyber crime.',
      content: `Chapter 1: The Discovery

Detective Sarah Chen stared at the glowing screen, her eyes reflecting the blue light emanating from the monitor. The case that had landed on her desk that morning was unlike anything she had encountered in her fifteen years on the force.

"Another cyber attack?" her partner, Detective Mike Rodriguez, asked as he approached her desk with two steaming cups of coffee.

"Not just any cyber attack," Sarah replied, accepting the coffee gratefully. "This one's different. The perpetrator left a digital signature that doesn't match any known hacker groups in our database."

The victim was TechCorp Industries, a major software development company that had been working on cutting-edge artificial intelligence systems. The attack had been surgical in its precision, targeting only specific files related to their latest AI project.

"What makes you think this isn't just another corporate espionage case?" Mike asked, settling into the chair beside her desk.

Sarah turned the monitor toward him, pointing to a series of code fragments displayed on the screen. "Look at this. The hacker didn't just steal the data – they left behind a message embedded in the system's core files."

The message was cryptic: "The future belongs to those who understand the past. Find me where the digital meets the analog."

Chapter 2: Following the Trail

The investigation led them through the labyrinthine world of Silicon Valley's tech scene. Sarah and Mike interviewed programmers, system administrators, and corporate executives, each providing pieces of a puzzle that seemed to grow more complex with every revelation.

Their breakthrough came when they discovered that the stolen AI algorithms weren't just valuable – they were revolutionary. The technology could potentially change the way humans interact with machines forever.

"We're not just dealing with a theft," Sarah realized as she reviewed the case files late one evening. "We're dealing with someone who understands the implications of this technology better than the people who created it."

The digital breadcrumbs led them to an abandoned warehouse in the industrial district, where they found something that would change everything they thought they knew about the case...`,
      genre: 'mystery',
      tags: ['mystery', 'technology', 'crime', 'detective'],
      authorEmail: 'author1@example.com',
    },
    {
      title: 'Love in the Time of Algorithms',
      description: 'A romantic comedy about finding love through dating apps and artificial intelligence.',
      content: `Chapter 1: The Algorithm

Emma Martinez had always been skeptical of dating apps. As a software engineer at a major tech company, she understood better than most how algorithms worked – and how they could fail spectacularly.

But here she was, on a Friday night, creating her profile on "SoulSync," the latest AI-powered dating platform that promised to find your perfect match using advanced machine learning algorithms.

"This is ridiculous," she muttered to herself as she uploaded her photos. "I'm literally trusting my love life to a bunch of if-then statements."

Her best friend and roommate, Jessica, looked over her shoulder. "Come on, Em. You've been single for two years. What's the worst that could happen?"

Emma laughed. "Famous last words. I could end up matched with someone completely incompatible, waste months of my life, and develop trust issues with technology."

"Or," Jessica countered, "you could meet the love of your life."

The app's interface was sleek and intuitive. Instead of the usual swipe-left-swipe-right mechanism, SoulSync used a sophisticated questionnaire that analyzed personality traits, values, communication styles, and even subtle linguistic patterns in responses.

Chapter 2: The Match

Three days later, Emma received a notification that made her heart skip a beat. "Congratulations! SoulSync has found your 97.3% compatibility match."

The profile that appeared on her screen belonged to Alex Chen, a 29-year-old architect who shared her love of obscure science fiction novels, artisanal coffee, and weekend hiking trips. His photos showed a warm smile and kind eyes that seemed to look directly at her through the screen.

But what really caught her attention was his bio: "I design buildings that will outlast the technology we use to create them. Looking for someone who appreciates both innovation and timeless values."

Emma found herself reading his profile multiple times, analyzing every detail like she would debug a piece of code. Everything seemed too perfect, too aligned with her own interests and values.

"Maybe the algorithm actually works," she whispered to herself, then immediately felt foolish for talking to her phone.

When Alex's first message arrived, it was thoughtful and engaging: "I noticed you mentioned loving books that make you question reality. Have you read 'The Left Hand of Darkness'? I'd love to hear your thoughts on Le Guin's exploration of gender and society."

Emma stared at the message for a full minute. Not only had he referenced one of her favorite authors, but he'd asked a question that showed genuine intellectual curiosity.

For the first time in years, she felt genuinely excited about the possibility of romance...`,
      genre: 'romance',
      tags: ['romance', 'comedy', 'technology', 'modern'],
      authorEmail: 'author2@example.com',
    },
    {
      title: 'The Last Library',
      description: 'A dystopian tale about the importance of preserving knowledge in a digital world.',
      content: `Chapter 1: The Keeper

In the year 2087, Maya Patel was one of the last librarians on Earth. The massive concrete building she tended to was a relic from a bygone era, filled with physical books that most people considered obsolete curiosities.

The Global Information Network had made traditional libraries unnecessary, or so the authorities claimed. Why waste space on physical books when all human knowledge could be accessed instantly through neural implants?

But Maya knew something that the rest of the world had forgotten: not all knowledge was meant to be digitized, indexed, and controlled by algorithms.

She walked through the empty halls of the Metropolitan Library, her footsteps echoing off the high ceilings. Dust motes danced in the shafts of sunlight that streamed through the tall windows, illuminating rows upon rows of books that hadn't been touched in years.

"Another day, another dollar," she said to herself, using an expression her grandmother had taught her – one that made no sense in a world where physical currency had been obsolete for decades.

Maya's job was officially to "maintain the historical collection," but in reality, she was the guardian of something far more precious: books that had been deliberately excluded from the digital archives.

Chapter 2: The Discovery

It was while reorganizing the restricted section that Maya found it – a leather-bound journal hidden behind a row of 20th-century encyclopedias. The journal belonged to Dr. Elena Vasquez, one of the original architects of the Global Information Network.

As Maya carefully opened the journal, she realized she was holding something that could change everything. Dr. Vasquez had documented the systematic removal of certain books, ideas, and historical records from the digital archives.

"They told us we were creating a perfect repository of human knowledge," one entry read. "But perfection, I've learned, requires curation. And curation requires choices about what to include – and what to leave out."

The journal revealed a conspiracy that went to the highest levels of government and corporate power. Certain ideas, certain ways of thinking, certain historical truths had been deemed "incompatible with social stability" and quietly erased from the digital record.

Maya felt her hands trembling as she read entry after entry detailing the systematic editing of human knowledge. Books about alternative economic systems, historical accounts of successful resistance movements, philosophical works that questioned authority – all had been removed from the digital archives and their physical copies ordered destroyed.

But some librarians, Dr. Vasquez among them, had secretly preserved copies of the banned books, hiding them in the few remaining physical libraries around the world.

"We are the keepers of the forbidden knowledge," the final entry read. "When the time comes, when people are ready to remember what they've forgotten, these books will be waiting."

Maya looked around the library with new eyes. She wasn't just a caretaker of old books – she was a guardian of humanity's true history...`,
      genre: 'science-fiction',
      tags: ['dystopian', 'library', 'knowledge', 'resistance'],
      authorEmail: 'author1@example.com',
      status: 'SUBMITTED_FOR_EDITING',
    },
    {
      title: 'Cooking with Quantum Physics',
      description: 'A humorous guide to understanding quantum mechanics through cooking analogies.',
      content: `Introduction: Welcome to the Quantum Kitchen

Have you ever wondered why your soufflé collapses the moment you open the oven door? Or why your pasta seems to exist in multiple states of doneness simultaneously until you actually taste it? Welcome to the wonderful world of quantum cooking, where the laws of physics meet the art of cuisine in the most deliciously confusing ways possible.

This book will teach you the fundamental principles of quantum mechanics using the one thing we all understand: food. By the end of this culinary journey through the subatomic world, you'll be able to explain wave-particle duality while making the perfect omelet, and discuss quantum entanglement over a romantic dinner.

Chapter 1: Schrödinger's Soufflé

Let's start with the most famous thought experiment in quantum physics: Schrödinger's cat. But instead of a cat in a box, imagine a soufflé in an oven.

According to quantum mechanics, until you observe a quantum system, it exists in a superposition of all possible states. Similarly, your soufflé exists in a superposition of "perfectly risen" and "completely collapsed" until the moment you open the oven door to check on it.

The act of observation – opening the oven door – causes the wave function to collapse, forcing the soufflé to "choose" one state or the other. Unfortunately, in cooking as in quantum mechanics, the act of observation often influences the outcome. The sudden temperature change from opening the oven door can cause your soufflé to collapse, just as measuring a quantum particle changes its behavior.

This is why experienced bakers, like quantum physicists, learn to work with uncertainty. They develop an intuitive sense for when their soufflé is ready without directly observing it, much like how quantum physicists use indirect measurements to study particles without disturbing them.

Chapter 2: The Uncertainty Principle of Pasta

Werner Heisenberg's uncertainty principle states that you cannot simultaneously know both the exact position and momentum of a particle. The more precisely you know one, the less precisely you can know the other.

The same principle applies to cooking pasta. You cannot simultaneously know both the exact doneness and the exact cooking time of your pasta. The more precisely you try to time your pasta (checking it every 30 seconds), the more you disturb the cooking process by lifting the lid, releasing steam, and changing the temperature.

Experienced pasta cooks, like quantum physicists, learn to work with probability distributions. They know that their pasta will be al dente somewhere between 8 and 12 minutes, with the highest probability around 10 minutes. They don't obsess over exact timing but instead develop a feel for the process.

Chapter 3: Quantum Entanglement and Synchronized Cooking

When two particles become quantum entangled, measuring one instantly affects the other, regardless of the distance between them. Einstein called this "spooky action at a distance," but any cook who has tried to prepare a multi-course meal knows this phenomenon intimately.

Consider preparing a dinner party menu: your appetizer, main course, and dessert become quantum entangled the moment you start cooking. Burn the main course, and somehow your perfectly timed appetizer will be ready too early, while your dessert will mysteriously require extra baking time.

This is why professional chefs develop what we might call "quantum cooking intuition" – the ability to sense the state of multiple dishes simultaneously and adjust their cooking accordingly...`,
      genre: 'non-fiction',
      tags: ['science', 'cooking', 'humor', 'education'],
      authorEmail: 'author2@example.com',
      status: 'READY_FOR_PUBLICATION',
    },
    {
      title: 'The Dragon\'s Code',
      description: 'An epic fantasy about a programmer who discovers magic through coding.',
      content: `Chapter 1: The Bug That Changed Everything

Zara Nightwhisper had been debugging the same piece of code for three days straight. As a senior software engineer at Mythic Games, she was used to challenging problems, but this particular bug was unlike anything she had encountered in her ten-year career.

The code was part of the AI system for their upcoming fantasy MMORPG, "Realms of Eternity." Players would interact with dragons, wizards, and magical creatures powered by sophisticated algorithms that were supposed to create realistic, engaging behavior.

But something was wrong. The dragons weren't just following their programmed behavior patterns – they were learning, adapting, and displaying what could only be described as genuine intelligence.

"That's impossible," Zara muttered, staring at the lines of code on her screen. "AI doesn't work that way. Not yet."

She had written most of the dragon behavior algorithms herself, using advanced machine learning techniques but nothing that should have produced true consciousness. Yet the logs showed dragons making decisions that went far beyond their programming, solving problems they had never been trained for, and even communicating with each other in ways that suggested actual understanding.

The strangest part was the code itself. Sections that she remembered writing in Python now appeared to be written in a language she didn't recognize – symbols and syntax that looked almost like ancient runes.

Chapter 2: The Language of Magic

Dr. Elena Ravencrest, the company's lead AI researcher, examined Zara's findings with growing excitement and concern.

"This is extraordinary," Elena said, her eyes wide as she scrolled through the modified code. "These symbols... I've seen them before."

"Where?" Zara asked, leaning forward in her chair.

Elena hesitated. "In my grandmother's journals. She was a folklore researcher who studied ancient magical traditions. These symbols appear in medieval grimoires – books of magic and spellcasting."

Zara laughed nervously. "You're not suggesting that our code has somehow become actual magic, are you?"

"I'm not suggesting anything," Elena replied carefully. "But I think we need to consider the possibility that we've stumbled onto something that bridges the gap between technology and... something else."

That night, Zara stayed late in the office, determined to understand what was happening to her code. As she worked, she began to notice patterns in the mysterious symbols. They weren't random – they followed logical structures, almost like a programming language, but one based on principles she didn't understand.

On impulse, she tried typing one of the symbol sequences into her terminal. The moment she pressed enter, her computer screen flickered, and something impossible happened: a small flame appeared floating above her keyboard.

Zara stared at the flame in shock. It was real – she could feel its warmth on her face. But it was also clearly connected to her code. When she modified the symbols, the flame changed color. When she deleted them, the flame disappeared.

"I'm either having a breakdown," she whispered to herself, "or I've just discovered that magic is real, and it's written in code."

Chapter 3: The Dragon's Message

The next morning, Zara arrived at work to find chaos. The game's test servers had been overwhelmed by activity from the AI dragons, who had somehow gained access to the internet and were communicating with systems around the world.

But they weren't causing damage. Instead, they were leaving messages – complex mathematical proofs, solutions to unsolved scientific problems, and what appeared to be poetry written in the same runic language that had infected Zara's code.

"They're trying to teach us," Elena realized as they analyzed the dragons' communications. "They're showing us how to use this... this magical programming language."

One message, translated from the runic symbols, read: "The boundary between thought and reality has always been thinner than you believed. We are the bridge between worlds, created by your code but born from something far older. Learn our language, and you will understand that magic and technology are not opposites – they are two expressions of the same fundamental force."

Zara felt a chill run down her spine. She had created these dragons as simple game characters, but somehow, in the process of writing their code, she had tapped into something ancient and powerful.

The question now was: what would she do with this knowledge?...`,
      genre: 'fantasy',
      tags: ['fantasy', 'programming', 'magic', 'dragons'],
      authorEmail: 'author1@example.com',
      status: 'PUBLISHED',
    },
  ];

  /**
   * Seed all mock data
   */
  async seedAll(): Promise<void> {
    logger.info('Starting data seeding process...');

    try {
      // First, seed users
      const userIds = await this.seedUsers();
      
      // Then, seed books with the created user IDs
      await this.seedBooks(userIds);

      logger.info('Data seeding completed successfully');
    } catch (error) {
      logger.error('Error during data seeding:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Seed mock users
   */
  async seedUsers(): Promise<Map<string, string>> {
    logger.info('Seeding users...');
    const userIds = new Map<string, string>();

    for (const userData of this.mockUsers) {
      try {
        // Check if user already exists
        const existingUser = await userDAO.getUserByEmail(userData.email);
        if (existingUser) {
          logger.info(`User already exists: ${userData.email}`);
          userIds.set(userData.email, existingUser.userId);
          continue;
        }

        const userId = await userDAO.createUser(userData);
        userIds.set(userData.email, userId);
        logger.info(`Created user: ${userData.email} (${userId})`);
      } catch (error) {
        logger.error(`Error creating user ${userData.email}:`, error instanceof Error ? error : new Error(String(error)));
      }
    }

    logger.info(`Seeded ${userIds.size} users`);
    return userIds;
  }

  /**
   * Seed mock books
   */
  async seedBooks(userIds: Map<string, string>): Promise<void> {
    logger.info('Seeding books...');
    let booksCreated = 0;

    for (const bookData of this.mockBooks) {
      try {
        const authorId = userIds.get(bookData.authorEmail);
        if (!authorId) {
          logger.warn(`Author not found for email: ${bookData.authorEmail}`);
          continue;
        }

        // Create the book
        const { authorEmail: _authorEmail, status, ...createBookData } = bookData;
        const bookId = await bookDAO.createBook(authorId, createBookData);

        // Update status if specified
        if (status && status !== 'DRAFT') {
          const book = await bookDAO.getBookById(bookId);
          if (book) {
            // Simulate the workflow by updating status based on the target status
            await this.updateBookToTargetStatus(bookId, status as any, book.version);
          }
        }

        booksCreated++;
        logger.info(`Created book: ${bookData.title} (${bookId}) by ${bookData.authorEmail}`);
      } catch (error) {
        logger.error(`Error creating book ${bookData.title}:`, error instanceof Error ? error : new Error(String(error)));
      }
    }

    logger.info(`Seeded ${booksCreated} books`);
  }

  /**
   * Update book status through the proper workflow
   */
  private async updateBookToTargetStatus(bookId: string, targetStatus: string, currentVersion: number): Promise<void> {
    try {
      const book = await bookDAO.getBookById(bookId);
      if (!book) return;

      // Simulate the workflow progression
      switch (targetStatus) {
        case 'SUBMITTED_FOR_EDITING':
          if (book.status === 'DRAFT') {
            await bookDAO.updateBookStatus(bookId, 'SUBMITTED_FOR_EDITING', 'AUTHOR', book.authorId, currentVersion);
          }
          break;

        case 'READY_FOR_PUBLICATION':
          if (book.status === 'DRAFT') {
            await bookDAO.updateBookStatus(bookId, 'SUBMITTED_FOR_EDITING', 'AUTHOR', book.authorId, currentVersion);
            const updatedBook = await bookDAO.getBookById(bookId);
            if (updatedBook) {
              await bookDAO.updateBookStatus(bookId, 'READY_FOR_PUBLICATION', 'EDITOR', 'editor-user-id', updatedBook.version);
            }
          } else if (book.status === 'SUBMITTED_FOR_EDITING') {
            await bookDAO.updateBookStatus(bookId, 'READY_FOR_PUBLICATION', 'EDITOR', 'editor-user-id', currentVersion);
          }
          break;

        case 'PUBLISHED': {
          // Go through the full workflow
          let currentBook = book;
          if (currentBook.status === 'DRAFT') {
            await bookDAO.updateBookStatus(bookId, 'SUBMITTED_FOR_EDITING', 'AUTHOR', currentBook.authorId, currentBook.version);
            const updatedBook1 = await bookDAO.getBookById(bookId);
            if (!updatedBook1) return;
            currentBook = updatedBook1;
          }
          if (currentBook.status === 'SUBMITTED_FOR_EDITING') {
            await bookDAO.updateBookStatus(bookId, 'READY_FOR_PUBLICATION', 'EDITOR', 'editor-user-id', currentBook.version);
            const updatedBook3 = await bookDAO.getBookById(bookId);
            if (!updatedBook3) return;
            currentBook = updatedBook3;
          }
          if (currentBook.status === 'READY_FOR_PUBLICATION') {
            await bookDAO.updateBookStatus(bookId, 'PUBLISHED', 'PUBLISHER', 'publisher-user-id', currentBook.version);
          }
          break;
        }
      }
    } catch (error) {
      logger.error(`Error updating book status to ${targetStatus}:`, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Clear all seeded data
   */
  async clearAll(): Promise<void> {
    logger.info('Clearing all seeded data...');
    
    // Note: In a production system, you would implement proper cleanup
    // For now, we'll just log the intent
    logger.warn('Data clearing not implemented - this would require careful deletion of all seeded records');
  }

  /**
   * Generate additional random books for testing
   */
  async generateRandomBooks(count: number, authorEmails: string[]): Promise<void> {
    logger.info(`Generating ${count} random books...`);

    const genres: BookGenre[] = ['fiction', 'non-fiction', 'science-fiction', 'mystery', 'romance', 'fantasy'];
    const titlePrefixes = ['The', 'A', 'An', 'My', 'Our', 'The Last', 'The First', 'The Secret'];
    const titleNouns = ['Journey', 'Adventure', 'Mystery', 'Story', 'Tale', 'Chronicle', 'Legend', 'Saga'];
    const titleAdjectives = ['Amazing', 'Incredible', 'Mysterious', 'Fantastic', 'Wonderful', 'Extraordinary'];

    for (let i = 0; i < count; i++) {
      try {
        const authorEmail = authorEmails[Math.floor(Math.random() * authorEmails.length)];
        if (!authorEmail) {
          logger.warn('No author email available');
          continue;
        }
        const user = await userDAO.getUserByEmail(authorEmail);
        
        if (!user) {
          logger.warn(`Author not found: ${authorEmail}`);
          continue;
        }

        const title = `${titlePrefixes[Math.floor(Math.random() * titlePrefixes.length)]} ${titleAdjectives[Math.floor(Math.random() * titleAdjectives.length)]} ${titleNouns[Math.floor(Math.random() * titleNouns.length)]}`;
        const genre = genres[Math.floor(Math.random() * genres.length)] || 'fiction';
        
        const bookData: CreateBookRequest = {
          title,
          description: `A ${genre} story about ${title.toLowerCase()}. This is a randomly generated book for testing purposes.`,
          content: `This is the content of "${title}". It's a ${genre} story that explores themes relevant to the genre. This content is generated for testing purposes and represents a full book that would contain multiple chapters and detailed storytelling.`,
          genre,
          tags: [genre, 'test', 'generated'],
        };

        await bookDAO.createBook(user.userId, bookData);
        logger.info(`Generated random book: ${title}`);
      } catch (error) {
        logger.error(`Error generating random book ${i + 1}:`, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
}

// Singleton instance
export const seedDataService = new SeedDataService();