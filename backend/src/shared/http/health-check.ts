/**
 * Shared Health Check Utility
 * Provides standardized health check responses for all Lambda services
 */

import { SharedLogger } from '../logging/logger';

/**
 * Health check response interface
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  timestamp: string;
  version: string;
  requestId?: string;
  capabilities?: string[];
  dependencies?: {
    [key: string]: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
  };
  metrics?: {
    uptime: number;
    memoryUsage?: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * Health check configuration interface
 */
export interface HealthCheckConfig {
  serviceName: string;
  version?: string;
  capabilities?: string[];
  dependencies?: {
    [key: string]: () => Promise<{ healthy: boolean; responseTime?: number; error?: string; }>;
  };
}

/**
 * Shared Health Check class
 */
export class SharedHealthCheck {
  private logger: SharedLogger;
  private config: HealthCheckConfig;
  private startTime: number;

  constructor(config: HealthCheckConfig) {
    this.config = config;
    this.logger = new SharedLogger(`${config.serviceName}-health`);
    this.startTime = Date.now();
  }

  /**
   * Perform health check
   */
  async performHealthCheck(requestId?: string): Promise<HealthCheckResponse> {
    if (requestId) {
      this.logger.setCorrelationId(requestId);
    }

    this.logger.info('Health check requested', { requestId });

    const response: HealthCheckResponse = {
      status: 'healthy',
      service: this.config.serviceName,
      timestamp: new Date().toISOString(),
      version: this.config.version || '1.0.0',
      ...(requestId && { requestId }),
      capabilities: this.config.capabilities || [],
      metrics: {
        uptime: Date.now() - this.startTime
      }
    };

    // Add memory usage if available
    if (process.memoryUsage) {
      const memUsage = process.memoryUsage();
      response.metrics!.memoryUsage = {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      };
    }

    // Check dependencies if configured
    if (this.config.dependencies) {
      response.dependencies = {};
      let hasUnhealthyDependency = false;

      for (const [name, checkFn] of Object.entries(this.config.dependencies)) {
        try {
          const startTime = Date.now();
          const result = await checkFn();
          const responseTime = Date.now() - startTime;

          response.dependencies[name] = {
            status: result.healthy ? 'healthy' : 'unhealthy',
            responseTime,
            ...(result.error && { error: result.error })
          };

          if (!result.healthy) {
            hasUnhealthyDependency = true;
          }
        } catch (error) {
          response.dependencies[name] = {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : String(error)
          };
          hasUnhealthyDependency = true;
        }
      }

      // Update overall status based on dependencies
      if (hasUnhealthyDependency) {
        response.status = 'degraded';
      }
    }

    this.logger.info('Health check completed', {
      requestId,
      status: response.status,
      dependencyCount: response.dependencies ? Object.keys(response.dependencies).length : 0
    });

    return response;
  }

  /**
   * Create a simple health check handler function
   */
  createHandler() {
    return async (requestId?: string) => {
      const healthResponse = await this.performHealthCheck(requestId);
      return {
        statusCode: healthResponse.status === 'healthy' ? 200 : 503,
        body: healthResponse
      };
    };
  }
}

/**
 * Create a health check instance with common configurations
 */
export function createHealthCheck(config: HealthCheckConfig): SharedHealthCheck {
  return new SharedHealthCheck(config);
}

/**
 * Common dependency check functions
 */
export const commonDependencyChecks = {
  /**
   * Check DynamoDB connectivity
   */
  dynamodb: (tableName?: string) => async () => {
    try {
      // This would require importing DynamoDB client
      // For now, return a placeholder
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  /**
   * Check SES connectivity
   */
  ses: () => async () => {
    try {
      // This would require importing SES client
      // For now, return a placeholder
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  /**
   * Check external API connectivity
   */
  externalApi: (url: string) => async () => {
    try {
      const startTime = Date.now();
      // This would require making an HTTP request
      // For now, return a placeholder
      const responseTime = Date.now() - startTime;
      return { healthy: true, responseTime };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
};