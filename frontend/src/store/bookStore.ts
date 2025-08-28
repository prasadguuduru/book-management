// Book store using Zustand
import { create } from 'zustand';
import {
  Book,
  CreateBookRequest,
  UpdateBookRequest,
  WorkflowEntry,
  UserCapabilities,
} from '@/types';
import { apiService } from '@/services/api';

interface BookState {
  books: Book[];
  currentBook: Book | null;
  workflow: WorkflowEntry[];
  userCapabilities: UserCapabilities | null;
  isLoading: boolean;
  error: string | null;
}

interface BookActions {
  // Book CRUD operations
  fetchBooks: (status?: Book['status'], genre?: Book['genre']) => Promise<void>;
  fetchMyBooks: () => Promise<void>;
  fetchBook: (bookId: string) => Promise<void>;
  createBook: (bookData: CreateBookRequest) => Promise<Book>;
  updateBook: (bookData: UpdateBookRequest) => Promise<Book>;
  deleteBook: (bookId: string) => Promise<void>;

  // Workflow operations
  submitBookForEditing: (bookId: string) => Promise<Book>;
  approveBook: (bookId: string, comments?: string) => Promise<Book>;
  rejectBook: (bookId: string, comments: string) => Promise<Book>;
  publishBook: (bookId: string) => Promise<Book>;
  fetchBookWorkflow: (bookId: string) => Promise<void>;

  // State management
  setCurrentBook: (book: Book | null) => void;
  setUserCapabilities: (capabilities: UserCapabilities | null) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

type BookStore = BookState & BookActions;

export const useBookStore = create<BookStore>(set => ({
  // Initial state
  books: [],
  currentBook: null,
  workflow: [],
  userCapabilities: null,
  isLoading: false,
  error: null,

  // Book CRUD operations
  fetchBooks: async (status?: Book['status'], genre?: Book['genre']) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.getBooks(status, genre);
      console.log('📚 BookStore - API response:', response);
      console.log('📚 BookStore - Items:', response.items);
      console.log('📚 BookStore - Items length:', response.items?.length);
      console.log('📚 BookStore - UserCapabilities:', response.userCapabilities);
      
      set({ 
        books: response.items || [], // Ensure we always have an array
        userCapabilities: response.userCapabilities || null,
        isLoading: false 
      });
    } catch (error) {
      console.error('📚 BookStore - Fetch error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch books',
        isLoading: false,
      });
    }
  },

  fetchMyBooks: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.getMyBooks();
      set({ 
        books: response.items, 
        userCapabilities: response.userCapabilities || null,
        isLoading: false 
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch my books',
        isLoading: false,
      });
    }
  },

  fetchBook: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      const book = await apiService.getBook(bookId);
      set({ currentBook: book, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch book',
        isLoading: false,
      });
    }
  },

  createBook: async (bookData: CreateBookRequest) => {
    set({ isLoading: true, error: null });

    try {
      const newBook = await apiService.createBook(bookData);

      // Add to books list
      set((state: BookState) => ({
        books: [newBook, ...state.books],
        currentBook: newBook,
        isLoading: false,
      }));

      return newBook;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create book';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  updateBook: async (bookData: UpdateBookRequest) => {
    set({ isLoading: true, error: null });

    try {
      const updatedBook = await apiService.updateBook(bookData);

      // Update in books list
      set((state: BookState) => ({
        books: state.books.map((book: Book) =>
          book.bookId === updatedBook.bookId ? updatedBook : book
        ),
        currentBook:
          state.currentBook?.bookId === updatedBook.bookId
            ? updatedBook
            : state.currentBook,
        isLoading: false,
      }));

      return updatedBook;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update book';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  deleteBook: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      await apiService.deleteBook(bookId);

      // Remove from books list
      set((state: BookState) => ({
        books: state.books.filter((book: Book) => book.bookId !== bookId),
        currentBook:
          state.currentBook?.bookId === bookId ? null : state.currentBook,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete book',
        isLoading: false,
      });
      throw error;
    }
  },

  // Workflow operations
  submitBookForEditing: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      const updatedBook = await apiService.submitBookForEditing(bookId);

      // Update book status
      set((state: BookState) => ({
        books: state.books.map((book: Book) =>
          book.bookId === bookId ? updatedBook : book
        ),
        currentBook:
          state.currentBook?.bookId === bookId
            ? updatedBook
            : state.currentBook,
        isLoading: false,
      }));

      return updatedBook;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to submit book';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  approveBook: async (bookId: string, comments?: string) => {
    set({ isLoading: true, error: null });

    try {
      const updatedBook = await apiService.approveBook(bookId, comments);

      // Update book status
      set((state: BookState) => ({
        books: state.books.map((book: Book) =>
          book.bookId === bookId ? updatedBook : book
        ),
        currentBook:
          state.currentBook?.bookId === bookId
            ? updatedBook
            : state.currentBook,
        isLoading: false,
      }));

      return updatedBook;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to approve book';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  rejectBook: async (bookId: string, comments: string) => {
    set({ isLoading: true, error: null });

    try {
      const updatedBook = await apiService.rejectBook(bookId, comments);

      // Update book status
      set((state: BookState) => ({
        books: state.books.map((book: Book) =>
          book.bookId === bookId ? updatedBook : book
        ),
        currentBook:
          state.currentBook?.bookId === bookId
            ? updatedBook
            : state.currentBook,
        isLoading: false,
      }));

      return updatedBook;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to reject book';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  publishBook: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      const updatedBook = await apiService.publishBook(bookId);

      // Update book status
      set((state: BookState) => ({
        books: state.books.map((book: Book) =>
          book.bookId === bookId ? updatedBook : book
        ),
        currentBook:
          state.currentBook?.bookId === bookId
            ? updatedBook
            : state.currentBook,
        isLoading: false,
      }));

      return updatedBook;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to publish book';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  fetchBookWorkflow: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      const workflow = await apiService.getBookWorkflow(bookId);
      set({ workflow, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to fetch workflow',
        isLoading: false,
      });
    }
  },

  // State management
  setCurrentBook: (book: Book | null) => set({ currentBook: book }),
  setUserCapabilities: (capabilities: UserCapabilities | null) => set({ userCapabilities: capabilities }),
  clearError: () => set({ error: null }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
