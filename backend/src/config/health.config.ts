import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  serverId: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  pid: number;
}

// Server instance ID (generated on startup)
const serverId = uuidv4();
const startTime = Date.now();

export const healthConfig = {
  // Get current health status
  getStatus: (): HealthStatus => {
    const memoryUsage = process.memoryUsage();
    
    return {
      status: 'healthy', // Can be updated based on system checks
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'local',
      version: process.env.API_VERSION || '1.0.0',
      serverId,
      uptime: (Date.now() - startTime) / 1000, // in seconds
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers || 0,
      },
      pid: process.pid,
    };
  },

  // Health check thresholds
  thresholds: {
    memory: {
      heapUsedPercent: 85, // Mark unhealthy if heap usage > 85%
      rssMax: 1024 * 1024 * 1024, // 1GB max RSS
    },
    uptime: {
      max: 24 * 60 * 60, // Suggest restart after 24 hours
    },
  },

  // System metrics collection
  metrics: {
    collectSystemMetrics: () => ({
      cpu: os.loadavg(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
    }),
  },
};
