import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { debugEnv } from '../debug-env';
import {
  authService,
  LoginRequest,
  RegisterRequest,
} from '@/services/authService';
import { User } from '@/types';

// Debug environment on store initialization
debugEnv();

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (userData: RegisterData) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER';
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const credentials: LoginRequest = { email, password };
          const response = await authService.login(credentials);

          set({
            user: response.user,
            token: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        const { token } = get();

        // Call logout endpoint if we have a token
        if (token) {
          try {
            await authService.logout(token);
          } catch (error) {
            console.warn('Logout API call failed:', error);
          }
        }

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
      },

      register: async (userData: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
          const registerRequest: RegisterRequest = userData;
          const response = await authService.register(registerRequest);

          set({
            user: response.user,
            token: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Registration failed',
            isLoading: false,
          });
          throw error;
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const response = await authService.refreshToken(refreshToken);

          set({
            token: response.accessToken,
            refreshToken: response.refreshToken,
          });
        } catch (error) {
          // If refresh fails, logout the user
          await get().logout();
          throw error;
        }
      },

      clearError: () => set({ error: null }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      partialize: state => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
