// Core types for the Ebook Publishing Platform

export interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER';
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  bookId: string;
  authorId: string;
  title: string;
  description: string;
  content: string;
  genre:
    | 'fiction'
    | 'non-fiction'
    | 'science-fiction'
    | 'mystery'
    | 'romance'
    | 'fantasy';
  status:
    | 'DRAFT'
    | 'SUBMITTED_FOR_EDITING'
    | 'READY_FOR_PUBLICATION'
    | 'PUBLISHED';
  tags: string[];
  wordCount: number;
  coverImageUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Review {
  reviewId: string;
  bookId: string;
  userId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  helpful: number;
  reportCount: number;
  isModerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEntry {
  bookId: string;
  fromState: Book['status'] | null;
  toState: Book['status'];
  actionBy: string;
  action: 'CREATE' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH';
  comments?: string | undefined;
  timestamp: string;
}

export interface CreateBookRequest {
  title: string;
  description: string;
  content: string;
  genre: Book['genre'];
  tags: string[];
}

export interface UpdateBookRequest extends Partial<CreateBookRequest> {
  bookId: string;
  version: number;
}

export interface CreateReviewRequest {
  bookId: string;
  rating: Review['rating'];
  comment: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: User['role'];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string[];
  };
  timestamp: string;
  requestId: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  lastEvaluatedKey?: string;
}
