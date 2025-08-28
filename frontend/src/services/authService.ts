// Authentication service for real API integration
import axios, { AxiosInstance } from 'axios';
import { User } from '@/types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER';
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  private client: AxiosInstance;

  constructor() {
    // Use the same URL logic as the main API service to ensure consistency
    const getBaseURL = () => {
      let apiUrl: string;
      const environment = import.meta.env.VITE_ENVIRONMENT;
      const viteApiGatewayUrl = import.meta.env.VITE_APIGATEWAY_URL;
      const viteApiUrl = import.meta.env.VITE_API_URL;

      console.log('🔐 AuthService - Environment:', environment);
      console.log('🔐 AuthService - VITE_APIGATEWAY_URL:', viteApiGatewayUrl);
      console.log('🔐 AuthService - VITE_API_URL:', viteApiUrl);

      // For QA/production environments, always use VITE_APIGATEWAY_URL if it contains cloudfront
      if (environment === 'qa' || environment === 'production') {
        if (viteApiGatewayUrl && viteApiGatewayUrl.includes('cloudfront.net')) {
          apiUrl = viteApiGatewayUrl;
          console.log('🔐 AuthService - Using CloudFront URL for QA/prod:', apiUrl);
        } else {
          apiUrl = 'http://localhost:3001';
          console.log('🔐 AuthService - Using fallback URL for QA/prod:', apiUrl);
        }
      } else if (environment === 'local') {
        // For local development, prefer LocalStack if available, otherwise direct backend
        if (viteApiGatewayUrl && viteApiGatewayUrl.includes('localhost:4566')) {
          apiUrl = viteApiGatewayUrl;
          console.log('🔐 AuthService - Using LocalStack URL for local:', apiUrl);
        } else if (viteApiUrl && viteApiUrl.includes('localhost:3001')) {
          apiUrl = viteApiUrl;
          console.log('🔐 AuthService - Using direct backend URL for local:', apiUrl);
        } else {
          apiUrl = 'http://localhost:3001';
          console.log('🔐 AuthService - Using default local backend URL:', apiUrl);
        }
      } else {
        // Default fallback
        apiUrl = viteApiGatewayUrl || viteApiUrl || 'http://localhost:3001';
        console.log('🔐 AuthService - Using default fallback URL:', apiUrl);
      }

      // Handle /api path normalization - remove if present to prevent duplication
      if (apiUrl.endsWith('/api')) {
        apiUrl = apiUrl.slice(0, -4);
        console.log('🔐 AuthService - Removed /api from base URL to prevent duplication');
      }

      console.log('🔐 AuthService - Final base URL:', apiUrl);
      return apiUrl;
    };

    this.client = axios.create({
      baseURL: getBaseURL(),
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for debugging
    this.client.interceptors.request.use(config => {
      console.log('🔐 AuthService - Outgoing request:', {
        method: config.method,
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`
      });
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error(
          'Auth service error:',
          error.response?.data || error.message
        );
        return Promise.reject(error);
      }
    );
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      console.log('🔐 AuthService - Making login request to:', this.client.defaults.baseURL + '/api/auth/login');
      console.log('🔐 AuthService - Request payload:', credentials);
      const response = await this.client.post('/api/auth/login', credentials);

      console.log('🔐 AuthService - Full response:', response);
      console.log('🔐 AuthService - Response data:', response.data);

      // Backend returns { accessToken, refreshToken, user }
      // The response data is directly in response.data (not nested)
      console.log('🔐 AuthService - Checking response data structure...');
      console.log('🔐 AuthService - Has accessToken:', !!response.data.accessToken);
      console.log('🔐 AuthService - Has user:', !!response.data.user);

      if (response.data.accessToken && response.data.user) {
        console.log('🔐 AuthService - Login successful, returning data');
        const loginResponse = response.data;
        console.log('🔐 AuthService - About to return:', loginResponse);
        return loginResponse;
      }

      console.error('🔐 AuthService - Invalid response format:', response.data);
      console.error('🔐 AuthService - AccessToken exists:', !!response.data.accessToken);
      console.error('🔐 AuthService - User exists:', !!response.data.user);
      throw new Error('Invalid response format');
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid email or password');
      }
      throw new Error(error.response?.data?.error?.message || 'Login failed');
    }
  }

  async register(userData: RegisterRequest): Promise<LoginResponse> {
    try {
      const response = await this.client.post('/api/auth/register', userData);

      // Backend returns { accessToken, refreshToken, user }
      if (response.data.accessToken && response.data.user) {
        return response.data;
      }

      throw new Error('Invalid response format');
    } catch (error: any) {
      if (error.response?.status === 409) {
        throw new Error('User with this email already exists');
      }
      throw new Error(
        error.response?.data?.error?.message || 'Registration failed'
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      const response = await this.client.post('/api/auth/refresh', {
        refreshToken,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error?.message || 'Token refresh failed'
      );
    }
  }

  async logout(token: string): Promise<void> {
    try {
      await this.client.post(
        '/api/auth/logout',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error: any) {
      // Logout errors are not critical
      console.warn('Logout error:', error.response?.data || error.message);
    }
  }

  async getProfile(token: string): Promise<User> {
    try {
      const response = await this.client.get('/api/auth/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data.user;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error?.message || 'Failed to get profile'
      );
    }
  }

  async updateProfile(token: string, updates: Partial<User>): Promise<User> {
    try {
      const response = await this.client.put('/api/auth/profile', updates, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data.user;
    } catch (error: any) {
      if (error.response?.status === 409) {
        throw new Error(
          'Profile was updated by another request. Please refresh and try again.'
        );
      }
      throw new Error(
        error.response?.data?.error?.message || 'Failed to update profile'
      );
    }
  }
}

export const authService = new AuthService();
