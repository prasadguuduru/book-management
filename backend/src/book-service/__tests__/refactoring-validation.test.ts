/**
 * Validation tests for book-service refactoring
 * These tests verify that the refactoring was successful
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Book Service Refactoring Validation', () => {
  const indexPath = path.join(__dirname, '../index.ts');
  let indexContent: string;

  beforeAll(() => {
    indexContent = fs.readFileSync(indexPath, 'utf8');
  });

  describe('Code Cleanup', () => {
    it('should have removed unused helper functions', () => {
      // Verify that old helper functions are no longer present
      expect(indexContent).not.toContain('function extractBookIdFromPath');
      expect(indexContent).not.toContain('function extractStatusFromPath');
      expect(indexContent).not.toContain('function extractGenreFromPath');
      expect(indexContent).not.toContain('function createErrorResponse');
    });

    it('should have removed old routing logic', () => {
      // Verify that the old monolithic routing function is gone
      expect(indexContent).not.toContain('async function routeRequest');
      expect(indexContent).not.toContain('switch (httpMethod)');
    });

    it('should not contain debug or development code', () => {
      // Verify no debug code remains
      expect(indexContent).not.toContain('DEPLOYMENT TEST');
      expect(indexContent).not.toContain('console.log');
      expect(indexContent).not.toContain('console.error');
      expect(indexContent).not.toContain('DEBUG');
    });
  });

  describe('Shared Utilities Integration', () => {
    it('should import shared utilities', () => {
      // Verify that shared utilities are imported
      expect(indexContent).toContain("import { Router, RouteHandler, RouteParams } from '../shared/http/router'");
      expect(indexContent).toContain("import { sharedResponseHandler } from '../shared/http/response-utils'");
      expect(indexContent).toContain("import { extractUserContext, UserContext } from '../shared/auth/auth-middleware'");
      expect(indexContent).toContain("import { SharedLogger } from '../shared/logging/logger'");
    });

    it('should use Router class for routing', () => {
      // Verify Router is instantiated and configured
      expect(indexContent).toContain('const router = new Router');
      expect(indexContent).toContain('corsEnabled: true');
      expect(indexContent).toContain('authMiddleware:');
    });

    it('should use shared response handler', () => {
      // Verify shared response handler is used
      expect(indexContent).toContain('sharedResponseHandler.success');
      expect(indexContent).toContain('sharedResponseHandler.error');
      expect(indexContent).toContain('sharedResponseHandler.internalError');
    });

    it('should use shared logger', () => {
      // Verify SharedLogger is used
      expect(indexContent).toContain('new SharedLogger');
      expect(indexContent).toContain("'book-service'");
    });
  });

  describe('Route Configuration', () => {
    it('should configure health check route', () => {
      expect(indexContent).toContain("router");
      expect(indexContent).toContain(".get('/health', handleHealthCheck)");
    });

    it('should configure book CRUD routes', () => {
      expect(indexContent).toContain(".get('/books', handleGetAllBooks");
      expect(indexContent).toContain(".get('/books/my-books', handleGetMyBooks");
      expect(indexContent).toContain(".get('/books/{id}', handleGetBook");
      expect(indexContent).toContain(".post('/books', handleCreateBook");
      expect(indexContent).toContain(".put('/books/{id}', handleUpdateBook");
      expect(indexContent).toContain(".delete('/books/{id}', handleDeleteBook");
    });

    it('should configure workflow routes with role-based auth', () => {
      expect(indexContent).toContain(".post('/books/{id}/submit', handleSubmitBook");
      expect(indexContent).toContain("requiredRoles: ['AUTHOR']");
      expect(indexContent).toContain(".post('/books/{id}/approve', handleApproveBook");
      expect(indexContent).toContain("requiredRoles: ['EDITOR']");
      expect(indexContent).toContain(".post('/books/{id}/publish', handlePublishBook");
      expect(indexContent).toContain("requiredRoles: ['PUBLISHER']");
    });

    it('should configure query routes', () => {
      expect(indexContent).toContain(".get('/books/status/{status}', handleGetBooksByStatus");
      expect(indexContent).toContain(".get('/books/genre/{genre}', handleGetBooksByGenre");
    });
  });

  describe('Handler Structure', () => {
    it('should have clean handler functions', () => {
      // Verify handler functions are present
      expect(indexContent).toContain('const handleHealthCheck: RouteHandler');
      expect(indexContent).toContain('const handleGetAllBooks: RouteHandler');
      expect(indexContent).toContain('const handleCreateBook: RouteHandler');
      expect(indexContent).toContain('const handleUpdateBook: RouteHandler');
    });

    it('should use consistent error handling', () => {
      // Verify consistent error handling patterns
      expect(indexContent).toContain('getUserContextFromParams(params)');
      expect(indexContent).toContain('context.awsRequestId');
      expect(indexContent).toContain('logger.error');
    });

    it('should use router for main handler', () => {
      // Verify main handler uses router
      expect(indexContent).toContain('export const handler = async');
      expect(indexContent).toContain('return await router.route(event, context)');
    });
  });

  describe('Business Logic Preservation', () => {
    it('should preserve all business logic functions', () => {
      // Verify that business logic functions are still present
      expect(indexContent).toContain('async function createBook');
      expect(indexContent).toContain('async function getBook');
      expect(indexContent).toContain('async function updateBook');
      expect(indexContent).toContain('async function deleteBook');
      expect(indexContent).toContain('async function submitBook');
      expect(indexContent).toContain('async function approveBook');
      expect(indexContent).toContain('async function rejectBook');
      expect(indexContent).toContain('async function publishBook');
      expect(indexContent).toContain('async function getAllBooks');
      expect(indexContent).toContain('async function getMyBooks');
    });

    it('should preserve access control integration', () => {
      // Verify access control is still used
      expect(indexContent).toContain('accessControlService');
      expect(indexContent).toContain('canAccessBook');
      expect(indexContent).toContain('canEditBook');
      expect(indexContent).toContain('canDeleteBook');
    });

    it('should preserve DAO integration', () => {
      // Verify DAO is still used
      expect(indexContent).toContain('bookDAO');
      expect(indexContent).toContain('createBook');
      expect(indexContent).toContain('getBookById');
      expect(indexContent).toContain('updateBook');
    });
  });
});

describe('Bundle Size Optimization', () => {
  const packageJsonPath = path.join(__dirname, '../package.json');
  let packageJson: any;

  beforeAll(() => {
    const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
    packageJson = JSON.parse(packageContent);
  });

  it('should have optimized package.json', () => {
    // Verify package.json has been updated
    expect(packageJson.description).toContain('refactored with shared utilities');
    expect(packageJson.main).toBe('dist/index.js');
  });

  it('should have build optimization scripts', () => {
    // Verify build scripts are present
    expect(packageJson.scripts.build).toBeDefined();
    expect(packageJson.scripts.clean).toBeDefined();
    expect(packageJson.scripts.package).toBeDefined();
  });

  it('should have minimal dependencies', () => {
    // Verify dependencies are minimal
    const deps = Object.keys(packageJson.dependencies || {});
    expect(deps.length).toBeLessThanOrEqual(5); // Should be minimal
    expect(deps).toContain('joi'); // For validation
  });
});

describe('TypeScript Configuration', () => {
  it('should have optimized tsconfig.json', () => {
    const tsconfigPath = path.join(__dirname, '../tsconfig.json');
    expect(fs.existsSync(tsconfigPath)).toBe(true);
    
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    expect(tsconfig.compilerOptions.removeComments).toBe(true);
    expect(tsconfig.compilerOptions.sourceMap).toBe(false);
  });

  it('should have webpack configuration for bundling', () => {
    const webpackPath = path.join(__dirname, '../webpack.config.js');
    expect(fs.existsSync(webpackPath)).toBe(true);
  });
});