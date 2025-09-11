/**
 * Main entry point for the ebook publishing platform backend
 * This serves as the development server entry point with comprehensive logging
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import { config } from './shared/config/environment';
import { logger } from './shared/utils/logger';
import { errorHandler } from './shared/middleware/errorHandler';
import { requestLogger } from './shared/middleware/requestLogger';

// Import route handlers
import { authRoutes } from './shared/routes/auth';
import { bookRoutes } from './shared/routes/books';
import { userRoutes } from './shared/routes/users';
import { reviewRoutes } from './shared/routes/reviews';
import { workflowRoutes } from './shared/routes/workflow';
import { notificationRoutes } from './shared/routes/notifications';

const app = express();
const serverId = uuidv4();

logger.info('🚀 SERVER_INITIALIZATION_START', {
  serverId,
  environment: config.environment,
  nodeVersion: process.version,
  platform: process.platform,
  operation: 'SERVER_INIT',
});

// Security middleware
logger.debug('Configuring security middleware (Helmet)', {
  serverId,
  operation: 'MIDDLEWARE_SECURITY',
});

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
logger.debug('Configuring CORS middleware', {
  serverId,
  configuredOrigins: config.cors.origin,
  environment: config.environment,
  operation: 'MIDDLEWARE_CORS',
});

app.use(cors({
  origin: (origin, callback) => {
    const requestId = uuidv4();

    logger.debug('🌐 CORS_ORIGIN_CHECK', {
      serverId,
      requestId,
      origin,
      environment: config.environment,
      operation: 'CORS_CHECK',
    });

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      logger.debug('CORS: Allowing request with no origin', {
        serverId,
        requestId,
        operation: 'CORS_NO_ORIGIN_ALLOWED',
      });
      return callback(null, true);
    }

    // In local environment, be more permissive
    if (config.environment === 'local') {
      // Allow localhost and 127.0.0.1 on any port, plus any configured origins
      const isLocalhost = origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/);
      const isConfiguredOrigin = config.cors.origin.includes(origin);

      if (isLocalhost || isConfiguredOrigin) {
        logger.debug('CORS: Allowing local origin', {
          serverId,
          requestId,
          origin,
          isLocalhost: !!isLocalhost,
          isConfiguredOrigin,
          operation: 'CORS_LOCAL_ALLOWED',
        });
        return callback(null, true);
      }
    } else {
      // In production, only allow configured origins
      if (config.cors.origin.includes(origin)) {
        logger.debug('CORS: Allowing configured origin', {
          serverId,
          requestId,
          origin,
          operation: 'CORS_CONFIGURED_ALLOWED',
        });
        return callback(null, true);
      }
    }

    logger.security('CORS: Blocking unauthorized origin', {
      serverId,
      requestId,
      origin,
      configuredOrigins: config.cors.origin,
      environment: config.environment,
      operation: 'CORS_BLOCKED',
    });

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware
logger.debug('Configuring body parsing middleware', {
  serverId,
  jsonLimit: '10mb',
  urlencodedLimit: '10mb',
  operation: 'MIDDLEWARE_BODY_PARSER',
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
logger.debug('Configuring compression middleware', {
  serverId,
  operation: 'MIDDLEWARE_COMPRESSION',
});

app.use(compression());

// Request logging
logger.debug('Configuring request logging middleware', {
  serverId,
  operation: 'MIDDLEWARE_REQUEST_LOGGER',
});

app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  logger.debug('🏥 HEALTH_CHECK_REQUEST', {
    requestId,
    ip: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    operation: 'HEALTH_CHECK',
  });

  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.environment,
    version: process.env['npm_package_version'] || '1.0.0',
    serverId,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
  };

  const duration = Date.now() - startTime;

  logger.info('✅ HEALTH_CHECK_SUCCESS', {
    serverId,
    requestId,
    duration,
    status: healthData.status,
    uptime: healthData.uptime,
    operation: 'HEALTH_CHECK_SUCCESS',
  });

  res.json(healthData);
});

// API routes
logger.debug('Configuring API routes', {
  serverId,
  routes: ['/api/auth', '/api/books', '/api/users', '/api/reviews', '/api/workflow', '/api/notifications'],
  operation: 'ROUTES_SETUP',
});

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use('*', (req, res) => {
  const requestId: string | undefined = uuidv4();

  logger.warn('🔍 ENDPOINT_NOT_FOUND', {
    requestId: requestId ?? 'N/A',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    operation: 'ENDPOINT_NOT_FOUND',
  });

  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      requestId,
    },
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use(errorHandler);

const port = config.port || 3001;

if (require.main === module) {
  const server = app.listen(port, () => {
    logger.info('🎉 SERVER_STARTUP_COMPLETE', {
      serverId,
      port,
      environment: config.environment,
      corsOrigins: config.cors.origin,
      healthCheckUrl: `http://localhost:${port}/health`,
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      operation: 'SERVER_STARTED',
    });

    logger.audit('Backend server started successfully', {
      serverId,
      port,
      environment: config.environment,
      timestamp: new Date().toISOString(),
      operation: 'SERVER_AUDIT_START',
    });
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    logger.info('🛑 SIGTERM_RECEIVED - Starting graceful shutdown', {
      serverId,
      operation: 'SHUTDOWN_START',
    });

    server.close(() => {
      logger.info('🛑 SERVER_SHUTDOWN_COMPLETE', {
        serverId,
        operation: 'SHUTDOWN_COMPLETE',
      });
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('🛑 SIGINT_RECEIVED - Starting graceful shutdown', {
      serverId,
      operation: 'SHUTDOWN_START',
    });

    server.close(() => {
      logger.info('🛑 SERVER_SHUTDOWN_COMPLETE', {
        serverId,
        operation: 'SHUTDOWN_COMPLETE',
      });
      process.exit(0);
    });
  });

  // Unhandled error logging
  process.on('uncaughtException', (error) => {
    logger.error('💥 UNCAUGHT_EXCEPTION', error, {
      serverId,
      operation: 'UNCAUGHT_EXCEPTION',
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 UNHANDLED_REJECTION', reason as Error, {
      serverId,
      promise: promise.toString(),
      operation: 'UNHANDLED_REJECTION',
    });
  });
}

export { app };