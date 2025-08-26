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

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || '/api',
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

    const response: AxiosResponse<ApiResponse<PaginatedResponse<Book>>> = await this.client.get(
      `/books?${params.toString()}`
    )
    return response.data.data!
  }

  async getBook(bookId: string): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.get(`/books/${bookId}`)
    return response.data.data!
  }

  async createBook(bookData: CreateBookRequest): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.post('/books', bookData)
    return response.data.data!
  }

  async updateBook(bookData: UpdateBookRequest): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.put(
      `/books/${bookData.bookId}`,
      bookData
    )
    return response.data.data!
  }

  async deleteBook(bookId: string): Promise<void> {
    await this.client.delete(`/books/${bookId}`)
  }

  async submitBookForEditing(bookId: string): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.post(
      `/books/${bookId}/submit`
    )
    return response.data.data!
  }

  async approveBook(bookId: string, comments?: string): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.post(
      `/books/${bookId}/approve`,
      { comments }
    )
    return response.data.data!
  }

  async rejectBook(bookId: string, comments: string): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.post(
      `/books/${bookId}/reject`,
      { comments }
    )
    return response.data.data!
  }

  async publishBook(bookId: string): Promise<Book> {
    const response: AxiosResponse<ApiResponse<Book>> = await this.client.post(
      `/books/${bookId}/publish`
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