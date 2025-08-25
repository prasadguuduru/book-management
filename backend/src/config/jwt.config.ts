import { UserRole } from '../types/user';

export interface JwtPayload {
  sub: string;              // User ID
  email: string;           // User email
  role: UserRole;          // User role
  firstName: string;       // User first name
  lastName: string;        // User last name
  isActive: boolean;       // Account status
  emailVerified: boolean;  // Email verification status
  iat: number;            // Issued at
  exp: number;            // Expiration time
}

export const jwtConfig = {
  // For POC: Using secret-based approach
  secret: process.env.JWT_SECRET || 'your-256-bit-secret',
  
  // Token expiration times
  accessToken: {
    expiresIn: '15m',  // 15 minutes
  },
  refreshToken: {
    expiresIn: '7d',   // 7 days
  },

  // Generate token payload
  generatePayload: (user: any): JwtPayload => ({
    sub: user.userId,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
  }),

  // Token verification options
  verifyOptions: {
    clockTolerance: 30, // 30 seconds clock tolerance
  },
};

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
    timestamp: new Date().toISOString(),
    requestId: '', // Will be populated at runtime
  },
};

// Error response generator
export const createErrorResponse = (code: string, message: string, details?: any[]) => ({
  error: {
    code,
    message,
    details,
  },
  timestamp: new Date().toISOString(),
  requestId: '', // Will be populated at runtime
  traceId: '',  // Will be populated at runtime
});