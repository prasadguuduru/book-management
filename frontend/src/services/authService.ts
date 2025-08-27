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
    this.client = axios.create({
      baseURL: import.meta.env.VITE_APIGATEWAY_URL || '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
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
      const response = await this.client.post('/api/auth/login', credentials);

      // Backend returns { accessToken, refreshToken, user }
      if (response.data.accessToken && response.data.user) {
        return response.data;
      }

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
