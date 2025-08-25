/**
 * Main entry point for the ebook publishing platform backend
 * This serves as the development server entry point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import route handlers
import { authRoutes } from './routes/auth';
import { bookRoutes } from './routes/books';
import { userRoutes } from './routes/users';
import { reviewRoutes } from './routes/reviews';
import { workflowRoutes } from './routes/workflow';
import { notificationRoutes } from './routes/notifications';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In local environment, be more permissive
    if (config.environment === 'local') {
      // Allow localhost and 127.0.0.1 on any port, plus any configured origins
      const isLocalhost = origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/);
      const isConfiguredOrigin = config.cors.origin.includes(origin);
      
      if (isLocalhost || isConfiguredOrigin) {
        return callback(null, true);
      }
    } else {
      // In production, only allow configured origins
      if (config.cors.origin.includes(origin)) {
        return callback(null, true);
      }
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.environment,
    version: process.env['npm_package_version'] || '1.0.0',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use(errorHandler);

const port = config.port || 3001;

if (require.main === module) {
  app.listen(port, () => {
    logger.info(`🚀 Backend server running on port ${port}`);
    logger.info(`📊 Environment: ${config.environment}`);
    logger.info(`🌐 CORS origin: ${config.cors.origin}`);
    logger.info(`🔍 Health check: http://localhost:${port}/health`);
  });
}

export { app };