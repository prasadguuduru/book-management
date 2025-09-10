/**
 * Tests for shared CORS utilities
 */

import { sharedCorsHandler, getCorsHeaders, createOptionsResponse } from '../cors-utils';

describe('Shared CORS Utilities', () => {
  // Store original environment
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    // Restore original environment
    process.env['NODE_ENV'] = originalEnv;
  });

  describe('sharedCorsHandler.getHeaders', () => {
    it('should return default CORS headers', () => {
      const headers = sharedCorsHandler.getHeaders();
      
      expect(headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(headers).toHaveProperty('Access-Control-Max-Age');
      expect(headers).toHaveProperty('Access-Control-Allow-Credentials');
      expect(headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should allow CloudFront origin', () => {
      const origin = 'https://d2xg2iv1qaydac.cloudfront.net';
      const headers = sharedCorsHandler.getHeaders(origin);
      
      expect(headers['Access-Control-Allow-Origin']).toBe(origin);
    });

    it('should allow localhost origins in development', () => {
      process.env['NODE_ENV'] = 'development';
      
      const origin = 'http://localhost:3000';
      const headers = sharedCorsHandler.getHeaders(origin);
      
      expect(headers['Access-Control-Allow-Origin']).toBe(origin);
    });

    it('should reject unauthorized origins in production', () => {
      process.env['NODE_ENV'] = 'production';
      
      const origin = 'https://malicious-site.com';
      const headers = sharedCorsHandler.getHeaders(origin);
      
      expect(headers['Access-Control-Allow-Origin']).not.toBe(origin);
      expect(headers['Access-Control-Allow-Origin']).toBe('https://d2xg2iv1qaydac.cloudfront.net');
    });

    it('should handle missing origin gracefully', () => {
      const headers = sharedCorsHandler.getHeaders(undefined);
      
      expect(headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(headers['Access-Control-Allow-Origin']).toBeTruthy();
    });

    it('should include all required methods', () => {
      const headers = sharedCorsHandler.getHeaders();
      const methods = headers['Access-Control-Allow-Methods'];
      
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('OPTIONS');
    });

    it('should include required headers', () => {
      const headers = sharedCorsHandler.getHeaders();
      const allowedHeaders = headers['Access-Control-Allow-Headers'];
      
      expect(allowedHeaders).toContain('Content-Type');
      expect(allowedHeaders).toContain('Authorization');
      expect(allowedHeaders).toContain('X-Requested-With');
    });
  });

  describe('sharedCorsHandler.createOptionsResponse', () => {
    it('should return valid OPTIONS response', () => {
      const response = sharedCorsHandler.createOptionsResponse();
      
      expect(response.statusCode).toBe(200);
      expect(response.headers).toBeDefined();
      expect(response.body).toBeDefined();
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('timestamp');
    });

    it('should include CORS headers in OPTIONS response', () => {
      const origin = 'https://d2xg2iv1qaydac.cloudfront.net';
      const response = sharedCorsHandler.createOptionsResponse(origin);
      
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', origin);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
    });
  });

  describe('sharedCorsHandler.validateConfig', () => {
    it('should validate default configuration', () => {
      const validation = sharedCorsHandler.validateConfig();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('sharedCorsHandler.getConfig', () => {
    it('should return development config by default', () => {
      process.env['NODE_ENV'] = 'development';
      const config = sharedCorsHandler.getConfig();
      
      expect(config.allowedOrigins).toContain('http://localhost:3000');
      expect(config.allowedOrigins).toContain('http://localhost:5173');
    });

    it('should return production config in production', () => {
      process.env['NODE_ENV'] = 'production';
      const config = sharedCorsHandler.getConfig();
      
      expect(config.allowedOrigins).toHaveLength(1);
      expect(config.allowedOrigins[0]).toBe('https://d2xg2iv1qaydac.cloudfront.net');
    });

    it('should return QA config in QA environment', () => {
      process.env['NODE_ENV'] = 'qa';
      const config = sharedCorsHandler.getConfig();
      
      expect(config.allowedOrigins).toContain('https://d2xg2iv1qaydac.cloudfront.net');
      expect(config.allowedOrigins).toContain('http://qa-ebook-frontend-96c175f3.s3-website-us-east-1.amazonaws.com');
    });
  });

  describe('Backward compatibility functions', () => {
    it('getCorsHeaders should work like existing function', () => {
      const origin = 'https://d2xg2iv1qaydac.cloudfront.net';
      const headers = getCorsHeaders(origin);
      
      expect(headers).toHaveProperty('Access-Control-Allow-Origin', origin);
      expect(headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('createOptionsResponse should work like existing function', () => {
      const response = createOptionsResponse();
      
      expect(response.statusCode).toBe(200);
      expect(response.headers).toBeDefined();
      expect(response.body).toBeDefined();
    });
  });

  describe('Environment-specific behavior', () => {
    it('should be more restrictive in production', () => {
      process.env['NODE_ENV'] = 'production';
      const prodConfig = sharedCorsHandler.getConfig();
      
      process.env['NODE_ENV'] = 'development';
      const devConfig = sharedCorsHandler.getConfig();
      
      expect(prodConfig.allowedOrigins.length).toBeLessThan(devConfig.allowedOrigins.length);
    });

    it('should handle unknown environments gracefully', () => {
      process.env['NODE_ENV'] = 'unknown';
      const config = sharedCorsHandler.getConfig();
      
      expect(config.allowedOrigins).toBeDefined();
      expect(config.allowedMethods).toBeDefined();
      expect(config.allowedHeaders).toBeDefined();
    });
  });

  describe('Security considerations', () => {
    it('should not allow arbitrary origins in production', () => {
      process.env['NODE_ENV'] = 'production';
      
      const maliciousOrigin = 'https://evil.com';
      const headers = sharedCorsHandler.getHeaders(maliciousOrigin);
      
      expect(headers['Access-Control-Allow-Origin']).not.toBe(maliciousOrigin);
    });

    it('should set credentials flag appropriately', () => {
      const headers = sharedCorsHandler.getHeaders();
      
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should set reasonable max age', () => {
      const headers = sharedCorsHandler.getHeaders();
      const maxAgeHeader = headers['Access-Control-Max-Age'];
      const maxAge = maxAgeHeader ? parseInt(maxAgeHeader) : 0;
      
      expect(maxAge).toBeGreaterThan(0);
      expect(maxAge).toBeLessThanOrEqual(86400); // 24 hours max
    });
  });
});