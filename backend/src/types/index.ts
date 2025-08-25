// Common types for the ebook publishing platform

export interface User {
  userId: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  isActive: boolean
  emailVerified: boolean
  preferences: UserPreferences
  createdAt: string
  updatedAt: string
  version: number
}

export type UserRole = 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER'

export interface UserPreferences {
  notifications: boolean
  theme: 'light' | 'dark'
  language: string
}

export interface Book {
  bookId: string
  authorId: string
  title: string
  description: string
  content: string
  genre: BookGenre
  status: BookStatus
  tags: string[]
  wordCount: number
  coverImageUrl?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
  version: number
}

export type BookGenre = 'fiction' | 'non-fiction' | 'science-fiction' | 'mystery' | 'romance' | 'fantasy'
export type BookStatus = 'DRAFT' | 'SUBMITTED_FOR_EDITING' | 'READY_FOR_PUBLICATION' | 'PUBLISHED'

export interface Review {
  reviewId: string
  bookId: string
  userId: string
  rating: 1 | 2 | 3 | 4 | 5
  comment: string
  helpful: number
  reportCount: number
  isModerated: boolean
  createdAt: string
  updatedAt: string
  version: number
}

export interface WorkflowEntry {
  bookId: string
  fromState: BookStatus | null
  toState: BookStatus
  actionBy: string
  action: WorkflowAction
  comments?: string
  metadata?: Record<string, any>
  timestamp: string
}

export type WorkflowAction = 'CREATE' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH'

export interface Session {
  sessionId: string
  userId: string
  refreshToken: string
  deviceInfo: DeviceInfo
  isActive: boolean
  lastActivity: string
  createdAt: string
  ttl: number
}

export interface DeviceInfo {
  userAgent: string
  ipAddress: string
  location?: string
}

export interface Notification {
  notificationId: string
  userId: string
  type: NotificationType
  title: string
  message: string
  data: Record<string, any>
  channels: NotificationChannel[]
  deliveryStatus: DeliveryStatus
  isRead: boolean
  createdAt: string
  ttl: number
}

export type NotificationType = 'BOOK_SUBMITTED' | 'BOOK_APPROVED' | 'BOOK_PUBLISHED' | 'REVIEW_ADDED'
export type NotificationChannel = 'email' | 'in-app' | 'push'

export interface DeliveryStatus {
  email?: 'pending' | 'sent' | 'delivered' | 'failed'
  inApp?: 'pending' | 'delivered' | 'read'
  push?: 'pending' | 'sent' | 'delivered' | 'failed'
}

// API Request/Response types
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: Omit<User, 'version'>
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
}

export interface CreateBookRequest {
  title: string
  description: string
  content: string
  genre: BookGenre
  tags: string[]
}

export interface UpdateBookRequest {
  title?: string
  description?: string
  content?: string
  genre?: BookGenre
  tags?: string[]
}

export interface CreateReviewRequest {
  bookId: string
  rating: 1 | 2 | 3 | 4 | 5
  comment: string
}

// JWT Token types
export interface AccessTokenPayload {
  sub: string
  email: string
  role: UserRole
  permissions: Permission[]
  iat: number
  exp: number
  aud: string
  iss: string
  jti: string
}

export interface RefreshTokenPayload {
  sub: string
  tokenId: string
  sessionId: string
  iat: number
  exp: number
  aud: string
  iss: string
}

export interface Permission {
  resource: string
  action: string
  conditions?: string[]
}

// Error types
export interface ApiError {
  code: string
  message: string
  details?: any[]
  timestamp: string
  requestId: string
  traceId?: string
}

// DynamoDB Entity types
export interface DynamoDBEntity {
  PK: string
  SK: string
  entityType: string
  GSI1PK?: string
  GSI1SK?: string
  GSI2PK?: string
  GSI2SK?: string
  ttl?: number
  version: number
}

export interface EncryptedData {
  encrypted: string
  iv: string
  tag: string
}