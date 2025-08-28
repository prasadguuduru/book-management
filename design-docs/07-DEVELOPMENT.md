# 🛠️ Development Workflow - Ebook Publishing Platform

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Local Development with LocalStack](#local-development-with-localstack)
3. [Project Structure](#project-structure)
4. [Development Scripts](#development-scripts)
5. [Testing Strategy](#testing-strategy)
6. [Code Quality & Standards](#code-quality--standards)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Development Environment Setup

### **Prerequisites**

```bash
# Required software versions
Node.js: >=18.0.0
npm: >=8.0.0
Docker: >=20.10.0
Docker Compose: >=2.0.0
AWS CLI: >=2.0.0
Terraform: >=1.3.0
Git: >=2.30.0

# Optional but recommended
pipx: latest (for awslocal)
jq: latest (for JSON processing)
curl: latest (for API testing)
```

### **Installation Steps**

#### **1. Clone and Setup Repository**

```bash
# Clone the repository
git clone https://github.com/your-org/ebook-platform.git
cd ebook-platform

# Install root dependencies
npm install

# Setup development environment
npm run setup:dev
```

#### **2. Install LocalStack Tools**

```bash
# Install pipx (if not already installed)
brew install pipx  # macOS
# or
sudo apt install pipx  # Ubuntu

# Install awslocal
pipx install awscli-local

# Add to PATH (if needed)
pipx ensurepath
export PATH=$PATH:~/.local/bin
```

#### **3. Environment Configuration**

```bash
# Copy environment templates
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local

# Update configuration files
# backend/.env.local
AWS_REGION=us-west-2
TABLE_NAME=ebook-platform-local
LOCALSTACK_ENDPOINT=http://localhost:4566
NODE_ENV=development

# frontend/.env.local
REACT_APP_API_URL=http://localhost:3001
REACT_APP_ENVIRONMENT=local
REACT_APP_DEBUG=true
```

---

## Local Development with LocalStack

### **LocalStack Configuration**

#### **Docker Compose Setup**

```yaml
# docker-compose.yml
version: '3.8'
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - '4566:4566'
    environment:
      - SERVICES=lambda,apigateway,dynamodb,s3,sns,sqs,ses,kms,cloudwatch
      - DEBUG=1
      - AWS_DEFAULT_REGION=us-west-2
      - LAMBDA_EXECUTOR=local
      - LAMBDA_REMOTE_DOCKER=false
      - PERSISTENCE=1
      - DATA_DIR=/tmp/localstack/data
    volumes:
      - './localstack-data:/tmp/localstack/data'
      - '/var/run/docker.sock:/var/run/docker.sock'
    networks:
      - ebook-network

networks:
  ebook-network:
    driver: bridge
```

#### **Start LocalStack**

```bash
# Start LocalStack services
docker-compose up -d localstack

# Verify services are running
docker-compose ps

# Check LocalStack health
curl -s http://localhost:4566/health | jq
```

### **Infrastructure Deployment to LocalStack**

#### **Deploy Core Infrastructure**

```bash
# Navigate to infrastructure directory
cd infrastructure/terraform/local

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Deploy to LocalStack
terraform apply -auto-approve

# Verify deployment
awslocal lambda list-functions
awslocal apigateway get-rest-apis
awslocal dynamodb list-tables
```

#### **Create Mock Data**

```bash
# Run mock data creation script
node scripts/create-mock-data.js

# Verify data creation
awslocal dynamodb scan --table-name ebook-platform-local

# Check created users
awslocal dynamodb query \
  --table-name ebook-platform-local \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"USER#author-1"}}'
```

---

## Project Structure

```
ebook-platform/
├── .github/                    # GitHub Actions workflows
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-dev.yml
│       └── deploy-prod.yml
├── backend/                    # Node.js + TypeScript backend
│   ├── src/
│   │   ├── handlers/          # Lambda function handlers
│   │   │   ├── auth.ts
│   │   │   ├── books.ts
│   │   │   ├── reviews.ts
│   │   │   └── users.ts
│   │   ├── services/          # Business logic services
│   │   │   ├── AuthService.ts
│   │   │   ├── BookService.ts
│   │   │   ├── ReviewService.ts
│   │   │   └── UserService.ts
│   │   ├── models/            # Data models and types
│   │   │   ├── User.ts
│   │   │   ├── Book.ts
│   │   │   └── Review.ts
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.ts
│   │   │   ├── validation.ts
│   │   │   └── errorHandler.ts
│   │   ├── utils/             # Utility functions
│   │   │   ├── crypto.ts
│   │   │   ├── validation.ts
│   │   │   └── constants.ts
│   │   └── index.ts           # Main entry point
│   ├── tests/                 # Test files
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
├── frontend/                   # React + TypeScript frontend
│   ├── public/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── auth/
│   │   │   ├── books/
│   │   │   ├── reviews/
│   │   │   └── common/
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useBooks.ts
│   │   │   └── useApi.ts
│   │   ├── services/          # API services
│   │   │   ├── api.ts
│   │   │   ├── auth.ts
│   │   │   └── websocket.ts
│   │   ├── store/             # State management
│   │   │   ├── authStore.ts
│   │   │   └── bookStore.ts
│   │   ├── types/             # TypeScript types
│   │   └── App.tsx
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
├── infrastructure/             # Infrastructure as Code
│   ├── terraform/
│   │   ├── modules/           # Reusable Terraform modules
│   │   │   ├── lambda/
│   │   │   ├── api-gateway/
│   │   │   ├── dynamodb/
│   │   │   └── s3/
│   │   ├── environments/      # Environment-specific configs
│   │   │   ├── dev/
│   │   │   ├── staging/
│   │   │   └── prod/
│   │   └── local/             # LocalStack configuration
│   └── scripts/               # Infrastructure scripts
├── scripts/                    # Development scripts
│   ├── setup-dev.sh          # Development environment setup
│   ├── deploy-local.sh       # Local deployment
│   ├── create-mock-data.js   # Mock data creation
│   ├── test-api.sh          # API testing
│   └── cleanup.sh           # Cleanup script
├── docs/                      # Additional documentation
├── docker-compose.yml         # Local services
├── package.json              # Root package.json for workspaces
├── .gitignore
└── README.md
```

---

## Development Scripts

### **Core Development Scripts**

#### **Setup and Installation**

```bash
# Initial development setup
npm run setup:dev

# Install all dependencies
npm run install:all

# Clean and reinstall
npm run clean && npm run install:all
```

#### **Local Development**

```bash
# Start LocalStack services
npm run localstack:start

# Deploy infrastructure to LocalStack
npm run deploy:local

# Create mock data
npm run data:seed

# Start backend development server
npm run backend:dev

# Start frontend development server
npm run frontend:dev

# Run full development environment
npm run dev  # Runs all above commands
```

#### **Testing Scripts**

```bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- --testNamePattern="AuthService"
```

#### **Code Quality Scripts**

```bash
# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check

# Run all quality checks
npm run quality:check
```

### **Backend Scripts**

```json
{
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts",
    "type-check": "tsc --noEmit",
    "clean": "rimraf dist",
    "local-server": "npm run build && node local-server.js"
  }
}
```

### **Frontend Scripts**

```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "test:coverage": "react-scripts test --coverage --watchAll=false",
    "eject": "react-scripts eject",
    "lint": "eslint src/**/*.{ts,tsx}",
    "lint:fix": "eslint src/**/*.{ts,tsx} --fix",
    "format": "prettier --write src/**/*.{ts,tsx}",
    "type-check": "tsc --noEmit",
    "analyze": "npm run build && npx bundle-analyzer build/static/js/*.js"
  }
}
```

---

## Testing Strategy

### **Testing Pyramid**

#### **1. Unit Tests (70%)**

```typescript
// backend/tests/unit/AuthService.test.ts
import { AuthService } from '../../src/services/AuthService';
import { MockUserRepository } from '../mocks/MockUserRepository';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepo: MockUserRepository;

  beforeEach(() => {
    mockUserRepo = new MockUserRepository();
    authService = new AuthService(mockUserRepo);
  });

  describe('authenticateUser', () => {
    it('should return user and tokens for valid credentials', async () => {
      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        hashedPassword: await bcrypt.hash('password123', 10),
        role: 'AUTHOR' as UserRole,
      };

      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      const result = await authService.authenticateUser(
        'test@example.com',
        'password123'
      );

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw error for invalid credentials', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        authService.authenticateUser('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
```

#### **2. Integration Tests (20%)**

```typescript
// backend/tests/integration/BookAPI.test.ts
import request from 'supertest';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
} from '../helpers/testSetup';

describe('Book API Integration', () => {
  let app: Express;
  let authToken: string;

  beforeAll(async () => {
    app = await setupTestEnvironment();

    // Create test user and get auth token
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'author@test.com',
      password: 'password123',
    });

    authToken = loginResponse.body.tokens.accessToken;
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  describe('POST /api/v1/books', () => {
    it('should create a new book', async () => {
      const bookData = {
        title: 'Test Book',
        description: 'A test book',
        content: 'Chapter 1: Test content...',
        genre: 'fiction',
      };

      const response = await request(app)
        .post('/api/v1/books')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bookData);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('bookId');
      expect(response.body.data.title).toBe('Test Book');
      expect(response.body.data.status).toBe('DRAFT');
    });

    it('should reject book creation without auth', async () => {
      const response = await request(app)
        .post('/api/v1/books')
        .send({ title: 'Test Book' });

      expect(response.status).toBe(401);
    });
  });
});
```

#### **3. End-to-End Tests (10%)**

```typescript
// e2e/tests/BookPublishingFlow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Complete Book Publishing Flow', () => {
  test('author creates, submits, and publishes a book', async ({ page }) => {
    // Login as author
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'author@test.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');

    // Navigate to create book
    await page.click('[data-testid=create-book-button]');

    // Fill book details
    await page.fill('[data-testid=book-title]', 'E2E Test Book');
    await page.fill(
      '[data-testid=book-description]',
      'A book created in E2E test'
    );
    await page.fill(
      '[data-testid=book-content]',
      'Chapter 1: This is test content for our E2E test...'
    );
    await page.selectOption('[data-testid=book-genre]', 'fiction');

    // Save book
    await page.click('[data-testid=save-book-button]');

    // Verify book created
    await expect(page.locator('[data-testid=book-status]')).toHaveText('DRAFT');

    // Submit for editing
    await page.click('[data-testid=submit-for-editing-button]');
    await expect(page.locator('[data-testid=book-status]')).toHaveText(
      'SUBMITTED_FOR_EDITING'
    );

    // Login as editor
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'editor@test.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');

    // Editor workflow...
    // (Continue with full workflow testing)
  });
});
```

### **Test Configuration**

#### **Jest Configuration**

```javascript
// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/__tests__/**',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
};
```

#### **Playwright Configuration**

```typescript
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './e2e/tests',
  timeout: 30000,
  retries: 2,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: 'http://localhost:3000',
    headless: !!process.env.CI,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
};

export default config;
```

---

## Code Quality & Standards

### **ESLint Configuration**

```javascript
// backend/.eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended', '@typescript-eslint/recommended', 'prettier'],
  plugins: ['@typescript-eslint', 'security', 'import'],
  rules: {
    // Security rules
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',

    // TypeScript rules
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'error',

    // Import rules
    'import/order': 'error',
    'import/no-unresolved': 'error',
    'import/no-cycle': 'error',

    // General rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  env: {
    node: true,
    es2021: true,
  },
};
```

### **Prettier Configuration**

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### **Husky Pre-commit Hooks**

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:unit",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write", "git add"],
    "*.{json,md}": ["prettier --write", "git add"]
  }
}
```

---

## CI/CD Pipeline

### **GitHub Actions Workflow**

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci
          cd ../frontend && npm ci

      - name: Lint code
        run: |
          npm run lint
          cd backend && npm run lint
          cd ../frontend && npm run lint

      - name: Run unit tests
        run: |
          cd backend && npm run test:coverage
          cd ../frontend && npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          directory: ./coverage/
          fail_ci_if_error: true

  security-scan:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  integration-tests:
    runs-on: ubuntu-latest
    needs: [lint-and-test]

    services:
      localstack:
        image: localstack/localstack:latest
        ports:
          - 4566:4566
        env:
          SERVICES: lambda,apigateway,dynamodb,s3
          DEBUG: 1
          AWS_DEFAULT_REGION: us-west-2

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci

      - name: Install AWS CLI Local
        run: |
          pip install awscli-local

      - name: Deploy test infrastructure
        run: |
          cd infrastructure/terraform/local
          terraform init
          terraform apply -auto-approve

      - name: Create test data
        run: node scripts/create-mock-data.js

      - name: Run integration tests
        run: cd backend && npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [integration-tests]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci
          cd ../frontend && npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Start services
        run: |
          npm run localstack:start
          npm run deploy:local
          npm run data:seed
          npm run backend:dev &
          npm run frontend:dev &
          sleep 30  # Wait for services to start

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  deploy-dev:
    runs-on: ubuntu-latest
    needs: [e2e-tests]
    if: github.ref == 'refs/heads/develop'

    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2

      - name: Deploy to dev environment
        run: |
          cd infrastructure/terraform/environments/dev
          terraform init
          terraform apply -auto-approve

      - name: Deploy application
        run: |
          cd backend && npm run build
          cd ../frontend && npm run build
          # Deploy Lambda functions and frontend to S3

      - name: Run smoke tests
        run: npm run test:smoke -- --env=dev

  deploy-prod:
    runs-on: ubuntu-latest
    needs: [e2e-tests]
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.PROD_AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.PROD_AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2

      - name: Deploy to production
        run: |
          cd infrastructure/terraform/environments/prod
          terraform init
          terraform apply -auto-approve

      - name: Health check
        run: |
          sleep 60  # Wait for deployment
          curl -f https://api.ebook-platform.com/health || exit 1
```

---

## Troubleshooting Guide

### **Common Issues and Solutions**

#### **1. LocalStack Connection Issues**

```bash
# Problem: Cannot connect to LocalStack
# Solution: Check if LocalStack is running and accessible
docker-compose ps
curl -s http://localhost:4566/health

# If not running, restart
docker-compose down
docker-compose up -d localstack

# Check logs
docker-compose logs localstack
```

#### **2. AWS CLI Local Issues**

```bash
# Problem: awslocal command not found
# Solution: Install and configure awslocal
pipx install awscli-local
export PATH=$PATH:~/.local/bin

# Test connection
awslocal lambda list-functions
```

#### **3. Lambda Deployment Issues**

```bash
# Problem: Lambda function deployment fails
# Solution: Check function code and dependencies
npm run build
zip -r function.zip dist/ node_modules/

# Deploy manually to test
awslocal lambda update-function-code \
  --function-name book-service \
  --zip-file fileb://function.zip
```

#### **4. DynamoDB Access Issues**

```bash
# Problem: Cannot read/write to DynamoDB
# Solution: Verify table exists and permissions
awslocal dynamodb list-tables
awslocal dynamodb describe-table --table-name ebook-platform-local

# Check IAM permissions
awslocal iam list-attached-role-policies --role-name lambda-execution-role
```

#### **5. Frontend API Connection Issues**

```bash
# Problem: Frontend cannot connect to backend
# Solution: Check API URL and CORS configuration

# Verify API Gateway is accessible
curl -v http://localhost:4566/restapis

# Check frontend environment
cat frontend/.env.local

# Update API URL if needed
echo "REACT_APP_API_URL=http://localhost:3001" > frontend/.env.local
```

#### **6. Test Failures**

```bash
# Problem: Tests failing due to timeouts
# Solution: Increase timeout values
export JEST_TIMEOUT=30000

# Problem: Database not clean between tests
# Solution: Add proper cleanup
beforeEach(async () => {
  await cleanupTestDatabase();
});
```

### **Debug Commands**

```bash
# Debug LocalStack services
curl -s http://localhost:4566/_localstack/health | jq

# Debug Lambda functions
awslocal lambda invoke \
  --function-name auth-service \
  --payload '{"test": true}' \
  output.json && cat output.json

# Debug DynamoDB
awslocal dynamodb scan --table-name ebook-platform-local --max-items 5

# Debug API Gateway
awslocal apigateway get-rest-apis
awslocal logs describe-log-groups

# Debug Docker containers
docker-compose logs --tail=50 localstack
docker stats
```

### **Performance Optimization**

```bash
# Monitor memory usage
docker stats localstack_localstack_1

# Optimize Lambda memory
awslocal lambda update-function-configuration \
  --function-name book-service \
  --memory-size 512

# Clean up old containers
docker system prune -f

# Reset LocalStack data
rm -rf ./localstack-data/*
docker-compose restart localstack
```

---

This comprehensive development workflow guide ensures consistent, efficient, and high-quality development practices for the ebook publishing platform while maintaining compatibility with the AWS Free Tier strategy.

---

## Related Documentation

- **[Requirements](./01-REQUIREMENTS.md)**: Comprehensive project requirements
- **[Architecture](./02-ARCHITECTURE.md)**: System design and component architecture
- **[Implementation](./03-IMPLEMENTATION.md)**: Development roadmap and tasks
- **[Security](./04-SECURITY.md)**: Security and compliance framework
- **[API Specification](./05-API.md)**: Complete REST API documentation
- **[Data Model](./06-DATA.md)**: Database design and access patterns
- **[Deployment](./08-DEPLOYMENT.md)**: Infrastructure deployment and management
