// Simple test runner for API integration
import { authService } from '@/services/authService';
import { apiService } from '@/services/api';

async function runIntegrationTests() {
  console.log('🚀 Starting API Integration Tests...');

  try {
    // Test 1: Authentication
    console.log('📝 Testing authentication...');
    const loginResponse = await authService.login({
      email: 'author@test.com',
      password: 'password123',
    });

    console.log('✅ Login successful:', {
      userId: loginResponse.user.userId,
      email: loginResponse.user.email,
      role: loginResponse.user.role,
      hasToken: !!loginResponse.accessToken,
    });

    // Test 2: Fetch books
    console.log('📚 Testing book fetching...');
    const books = await apiService.getBooks();
    console.log('✅ Books fetched:', {
      count: books.items.length,
      hasMore: books.hasMore,
    });

    // Test 3: Create a book
    console.log('📖 Testing book creation...');
    const newBook = await apiService.createBook({
      title: 'Integration Test Book',
      description: 'A book created during integration testing',
      content: 'This is test content for the integration test book.',
      genre: 'fiction',
      tags: ['test', 'integration'],
    });

    console.log('✅ Book created:', {
      bookId: newBook.bookId,
      title: newBook.title,
      status: newBook.status,
    });

    // Test 4: Update the book
    console.log('✏️ Testing book update...');
    const updatedBook = await apiService.updateBook({
      bookId: newBook.bookId,
      title: 'Updated Integration Test Book',
      description: newBook.description,
      content: newBook.content,
      genre: newBook.genre,
      tags: newBook.tags,
      version: newBook.version,
    });

    console.log('✅ Book updated:', {
      title: updatedBook.title,
      version: updatedBook.version,
    });

    // Test 5: Submit for editing
    console.log('📤 Testing book submission...');
    const submittedBook = await apiService.submitBookForEditing(newBook.bookId);
    console.log('✅ Book submitted:', {
      status: submittedBook.status,
    });

    // Test 6: Get workflow
    console.log('🔄 Testing workflow fetch...');
    const workflow = await apiService.getBookWorkflow(newBook.bookId);
    console.log('✅ Workflow fetched:', {
      entries: workflow.length,
      actions: workflow.map(w => w.action),
    });

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    try {
      await apiService.deleteBook(newBook.bookId);
      console.log('✅ Test book deleted');
    } catch (error) {
      console.log('⚠️ Could not delete test book (may not be allowed):', error);
    }

    console.log('🎉 All integration tests passed!');
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  }
}

// Export for use in other contexts
export { runIntegrationTests };

// Run if called directly
if (typeof window === 'undefined') {
  runIntegrationTests().catch(console.error);
}
