// API service layer for the Ebook Publishing Platform
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Book,
  Review,
  CreateBookRequest,
  UpdateBookRequest,
  CreateReviewRequest,
  ApiResponse,
  PaginatedResponse,
  WorkflowEntry,
} from '@/types';

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
  private client: AxiosInstance;

  constructor() {
    // Get API URL from environment variables with proper environment detection
    let apiUrl: string;
    const environment = import.meta.env.VITE_ENVIRONMENT;
    const viteApiGatewayUrl = import.meta.env.VITE_APIGATEWAY_URL;
    const viteApiUrl = import.meta.env.VITE_API_URL;

    console.log('🔧 Environment detection:', environment);
    console.log('🔧 VITE_APIGATEWAY_URL:', viteApiGatewayUrl);
    console.log('🔧 VITE_API_URL:', viteApiUrl);

    // For QA/production environments, always use VITE_APIGATEWAY_URL if it contains cloudfront
    if (environment === 'qa' || environment === 'production') {
      if (viteApiGatewayUrl && viteApiGatewayUrl.includes('cloudfront.net')) {
        apiUrl = viteApiGatewayUrl;
        console.log('🔧 Using CloudFront URL for QA/prod:', apiUrl);
      } else {
        apiUrl = (window.ENV?.VITE_APIGATEWAY_URL) || 'http://localhost:3001';
        console.log('🔧 Using fallback URL for QA/prod:', apiUrl);
      }
    } else if (environment === 'local') {
      // For local development, prefer LocalStack if available, otherwise direct backend
      if (viteApiGatewayUrl && viteApiGatewayUrl.includes('localhost:4566')) {
        apiUrl = viteApiGatewayUrl;
        console.log('🔧 Using LocalStack URL for local:', apiUrl);
      } else if (viteApiUrl && viteApiUrl.includes('localhost:3001')) {
        apiUrl = viteApiUrl;
        console.log('🔧 Using direct backend URL for local:', apiUrl);
      } else {
        apiUrl = 'http://localhost:3001';
        console.log('🔧 Using default local backend URL:', apiUrl);
      }
    } else {
      // Default fallback
      apiUrl = viteApiGatewayUrl || viteApiUrl || 'http://localhost:3001';
      console.log('🔧 Using default fallback URL:', apiUrl);
    }

    // Handle /api path normalization
    // If the base URL already includes /api, remove it since our endpoints add /api
    if (apiUrl.endsWith('/api')) {
      apiUrl = apiUrl.slice(0, -4);
      console.log('🔧 Removed /api from base URL to prevent duplication');
    }

    console.log('🚀 API Service initialized with URL:', apiUrl);
    console.log('🔧 Environment:', environment);
    console.log('🔧 VITE_APIGATEWAY_URL:', import.meta.env.VITE_APIGATEWAY_URL);
    console.log('🔧 VITE_API_URL:', import.meta.env.VITE_API_URL);
    console.log('🔧 window.ENV:', window.ENV);

    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(config => {
      const token = this.getAuthToken();
      console.log('🔑 Request interceptor - token found:', !!token);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('🔑 Added Authorization header');
      } else {
        console.log('🔑 No token - request will be unauthenticated');
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.log('🚨 API Error:', error.response?.status, error.response?.data);
        if (error.response?.status === 401) {
          console.log('🚨 401 Unauthorized - clearing auth and redirecting');
          // Token expired, clear auth state and redirect to login
          // Note: Using window.location for now, but should use React Router in a real app
          localStorage.removeItem('auth-storage');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      console.log('🔑 Raw auth storage:', authStorage);
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        console.log('🔑 Parsed auth storage:', parsed);
        // The token is stored directly in the state object, not nested under another state
        const token = parsed.state?.token || null;
        console.log('🔑 Extracted token:', token ? `${token.substring(0, 20)}...` : 'null');
        return token;
      }
    } catch (error) {
      console.error('🚨 Error getting auth token:', error);
    }
    console.log('🔑 No auth token found');
    return null;
  }

  // Books API
  async getBooks(
    status?: Book['status'],
    genre?: Book['genre'],
    limit: number = 100
  ): Promise<PaginatedResponse<Book> & { userCapabilities?: any; }> {
    const params = new URLSearchParams();
    if (status) {
      params.append('status', status);
    }
    if (genre) {
      params.append('genre', genre);
    }
    // Always include limit parameter, even with default value
    params.append('limit', limit.toString());

    // Always add CloudFront workaround parameter to ensure reliable routing
    // CloudFront has issues with /api/books but works fine with /api/books?anything
    params.append('_cf', '1'); // CloudFront workaround parameter for all requests

    const response = await this.client.get(`/api/books?${params.toString()}`);
    console.log('📚 Get books response:', response.data);
    console.log('📚 Books data:', response.data.data);
    console.log('📚 Books array:', response.data.books);
    console.log('📚 Response has data property:', !!response.data.data);
    console.log('📚 Response has books property:', !!response.data.books);
    console.log('📚 Books array length:', response.data.books?.length);
    console.log('📚 UserCapabilities:', response.data.userCapabilities);

    // Handle both new API format and current mock format
    if (response.data.data) {
      console.log('📚 Using response.data.data format');
      return response.data.data;
    } else if (response.data.books) {
      console.log('📚 Using response.data.books format');
      // Handle current API format - books are already in correct format
      return {
        items: response.data.books, // Use books directly since they have correct format
        totalCount: response.data.books.length,
        hasMore: false,
        userCapabilities: response.data.userCapabilities, // Include user capabilities from backend
      };
    }

    console.error('📚 Invalid response format - no data or books property found');
    throw new Error('Invalid response format');
  }

  async getMyBooks(limit: number = 100): Promise<PaginatedResponse<Book> & { userCapabilities?: any; }> {
    // Always add CloudFront workaround parameter to ensure reliable routing
    const params = new URLSearchParams();
    params.append('_cf', '1'); // CloudFront workaround
    // Always include limit parameter, even with default value
    params.append('limit', limit.toString());
    const response = await this.client.get(`/api/books/my-books?${params.toString()}`);
    console.log('📚 Get my books response:', response.data);

    // Handle the API response format
    if (response.data.books) {
      return {
        items: response.data.books,
        totalCount: response.data.books.length,
        hasMore: response.data.hasMore || false,
        lastEvaluatedKey: response.data.lastEvaluatedKey,
        userCapabilities: response.data.userCapabilities, // Include user capabilities from backend
      };
    }

    throw new Error('Invalid response format');
  }

  async getBook(bookId: string): Promise<Book> {
    const response = await this.client.get(
      `/api/books/${bookId}`
    );
    // Backend returns { book: Book, validTransitions: [], permissions: {}, ... } format
    return response.data.book;
  }

  async createBook(bookData: CreateBookRequest): Promise<Book> {
    const response = await this.client.post(
      '/api/books',
      bookData
    );
    console.log('📚 Create book response:', response.data);
    console.log('📚 Created book data:', response.data.book);
    // Backend returns { book: Book, message: string, ... } format
    return response.data.book;
  }

  async updateBook(bookData: UpdateBookRequest): Promise<Book> {
    // Add CloudFront workaround parameter to ensure reliable routing
    const response = await this.client.put(
      `/api/books/${bookData.bookId}?_cf=1`,
      bookData
    );
    // Backend returns { book: Book, message: string, ... } format
    return response.data.book;
  }

  async deleteBook(bookId: string): Promise<void> {
    await this.client.delete(`/api/books/${bookId}`);
  }

  async submitBookForEditing(bookId: string): Promise<Book> {
    // Add CloudFront workaround parameter to ensure reliable routing
    const response = await this.client.post(
      `/api/workflow/books/${bookId}/submit?_cf=1`
    );
    // Backend returns { book: Book, message: string, ... } format
    return response.data.book;
  }

  async approveBook(bookId: string, comments?: string): Promise<Book> {
    // Add CloudFront workaround parameter to ensure reliable routing
    const response = await this.client.post(
      `/api/workflow/books/${bookId}/approve?_cf=1`,
      { comments }
    );
    // Backend returns { book: Book, message: string, ... } format
    return response.data.book;
  }

  async rejectBook(bookId: string, comments: string): Promise<Book> {
    // Add CloudFront workaround parameter to ensure reliable routing
    const response = await this.client.post(
      `/api/workflow/books/${bookId}/reject?_cf=1`,
      { comments }
    );
    // Backend returns { book: Book, message: string, ... } format
    return response.data.book;
  }

  async publishBook(bookId: string): Promise<Book> {
    // Add CloudFront workaround parameter to ensure reliable routing
    const response = await this.client.post(
      `/api/workflow/books/${bookId}/publish?_cf=1`
    );
    // Backend returns { book: Book, message: string, ... } format
    return response.data.book;
  }

  async getBookWorkflow(bookId: string): Promise<WorkflowEntry[]> {
    const response: AxiosResponse<ApiResponse<WorkflowEntry[]>> =
      await this.client.get(`/api/workflow/books/${bookId}/history`);
    return response.data.data!;
  }

  async getWorkflowStatus(bookId: string): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> =
      await this.client.get(`/api/workflow/books/${bookId}/status`);
    return response.data.data!;
  }

  async getWorkflowTasks(): Promise<any[]> {
    const response: AxiosResponse<ApiResponse<any[]>> =
      await this.client.get('/api/workflow/tasks');
    return response.data.data!;
  }

  async getWorkflowStatistics(): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> =
      await this.client.get('/api/workflow/statistics');
    return response.data.data!;
  }

  async validateWorkflowTransition(bookId: string, action: string): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> =
      await this.client.post(`/api/workflow/books/${bookId}/validate-transition`, { action });
    return response.data.data!;
  }

  // Reviews API
  async getBookReviews(bookId: string): Promise<PaginatedResponse<Review>> {
    const response: AxiosResponse<ApiResponse<PaginatedResponse<Review>>> =
      await this.client.get(`/api/books/${bookId}/reviews`);
    return response.data.data!;
  }

  async createReview(reviewData: CreateReviewRequest): Promise<Review> {
    const response: AxiosResponse<ApiResponse<Review>> = await this.client.post(
      `/api/books/${reviewData.bookId}/reviews`,
      reviewData
    );
    return response.data.data!;
  }

  async updateReview(
    reviewId: string,
    reviewData: Partial<CreateReviewRequest>
  ): Promise<Review> {
    const response: AxiosResponse<ApiResponse<Review>> = await this.client.put(
      `/api/reviews/${reviewId}`,
      reviewData
    );
    return response.data.data!;
  }

  async deleteReview(reviewId: string): Promise<void> {
    await this.client.delete(`/api/reviews/${reviewId}`);
  }

  // Notifications API
  async getNotifications(): Promise<any[]> {
    const response = await this.client.get('/api/notifications');
    return response.data.notifications || [];
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.client.put(`/api/notifications/${notificationId}/read`);
  }
}

export const apiService = new ApiService();
