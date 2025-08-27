// API service layer for the Ebook Publishing Platform
import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { 
  Book, 
  Review, 
  CreateBookRequest, 
  UpdateBookRequest, 
  CreateReviewRequest,
  ApiResponse,
  PaginatedResponse,
  WorkflowEntry
} from '@/types'

// Extend Window interface to include ENV
declare global {
  interface Window {
    ENV?: {
      VITE_APIGATEWAY_URL?: string;
      VITE_ENVIRONMENT?: string;
      VITE_APP_NAME?: string;
      VITE_DEBUG_MODE?: string;
      VITE_ENABLE_ANALYTICS?: string;
      VITE_ENABLE_REAL_TIME?: string;
    };
  }
}

class ApiService {
  private client: AxiosInstance

  constructor() {
    // Hardcoded CloudFront API URL for QA environment
    const apiUrl = 'https://d2xg2iv1qaydac.cloudfront.net/api'
    
    console.log('🚀 API Service initialized with hardcoded URL:', apiUrl)
    
    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      const token = this.getAuthToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired, redirect to login
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  private getAuthToken(): string | null {
    try {
      const authStorage = localStorage.getItem('auth-storage')
      if (authStorage) {
        const parsed = JSON.parse(authStorage)
        return parsed.state?.token || null
      }
    } catch (error) {
      console.error('Error getting auth token:', error)
    }
    return null
  }

  // Books API
  async getBooks(status?: Book['status'], genre?: Book['genre']): Promise<PaginatedResponse<Book>> {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    if (genre) params.append('genre', genre)

    const response = await this.client.get(`/api/books?${params.toString()}`)
    
    // Handle both new API format and current mock format
    if (response.data.data) {
      return response.data.data
    } else if (response.data.books) {
      // Handle current mock format
      return {
        items: response.data.books.map((book: any) => ({
          bookId: book.id,
          authorId: book.authorId || 'mock-author',
          title: book.title,
          description: book.description || '',
          content: book.content || '',
          genre: book.genre || 'fiction',
          status: book.status,
          tags: book.tags || [],
          wordCount: book.wordCount || 0,
          createdAt: book.createdAt || new Date().toISOString(),
          updatedAt: book.updatedAt || new Date().toISOString(),
          version: book.version || 1,
          ...(book.publishedAt && { publishedAt: book.publishedAt })
        })),
        totalCount: response.data.books.length,
        hasMore: false
      }
    }
    
    throw new Error('Invalid response format')
  }

  async getBook(bookId: string): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.get(`/api/books/${bookId}`)
    return response.data.data!
  }

  async createBook(bookData: CreateBookRequest): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.post('/api/books', bookData)
    return response.data.data!
  }

  async updateBook(bookData: UpdateBookRequest): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.put(
      `/api/books/${bookData.bookId}`,
      bookData
    )
    return response.data.data!
  }

  async deleteBook(bookId: string): Promise<void> {
    await this.client.delete(`/api/books/${bookId}`)
  }

  async submitBookForEditing(bookId: string): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.post(
      `/api/books/${bookId}/submit`
    )
    return response.data.data!
  }

  async approveBook(bookId: string, comments?: string): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.post(
      `/api/books/${bookId}/approve`,
      { comments }
    )
    return response.data.data!
  }

  async rejectBook(bookId: string, comments: string): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.post(
      `/api/books/${bookId}/reject`,
      { comments }
    )
    return response.data.data!
  }

  async publishBook(bookId: string): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.post(
      `/api/books/${bookId}/publish`
    )
    return response.data.data!
  }

  async getBookWorkflow(bookId: string): Promise<WorkflowEntry[]> {
    const response: AxiosResponse<ApiResponse<WorkflowEntry[]>> = await this.client.get(
      `/books/${bookId}/workflow`
    )
    return response.data.data!
  }

  // Reviews API
  async getBookReviews(bookId: string): Promise<PaginatedResponse<Review>> {
    const response: AxiosResponse<ApiResponse<PaginatedResponse<Review>>> = await this.client.get(
      `/books/${bookId}/reviews`
    )
    return response.data.data!
  }

  async createReview(reviewData: CreateReviewRequest): Promise<Review> {
    const response: AxiosResponse<ApiResponse<Review>> = await this.client.post(
      `/books/${reviewData.bookId}/reviews`,
      reviewData
    )
    return response.data.data!
  }

  async updateReview(reviewId: string, reviewData: Partial<CreateReviewRequest>): Promise<Review> {
    const response: AxiosResponse<ApiResponse<Review>> = await this.client.put(
      `/reviews/${reviewId}`,
      reviewData
    )
    return response.data.data!
  }

  async deleteReview(reviewId: string): Promise<void> {
    await this.client.delete(`/reviews/${reviewId}`)
  }
}

export const apiService = new ApiService()