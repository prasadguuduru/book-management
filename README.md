# Ebook Publishing Platform

A comprehensive, enterprise-grade serverless ebook publishing platform built with TypeScript, React, and AWS services, optimized for AWS Free Tier usage.

## 🚀 Features

- **Complete Publishing Workflow**: Draft → Edit → Review → Publish
- **Role-Based Access Control**: Author, Editor, Publisher, Reader roles
- **Real-time Collaboration**: Live editing and notifications
- **Enterprise Security**: JWT authentication, encryption, GDPR compliance
- **Serverless Architecture**: AWS Lambda, DynamoDB, S3, CloudFront
- **Free Tier Optimized**: Zero infrastructure costs for first 12 months
- **Local Development**: Complete LocalStack integration

## 🛠 Technology Stack

### Frontend
- **React 18+** with TypeScript
- **Vite** for fast development and builds
- **Material-UI** for consistent UI components
- **Zustand** for state management
- **React Query** for server state
- **React Router** for navigation

### Backend
- **Node.js 18+** with TypeScript
- **AWS Lambda** for serverless compute
- **DynamoDB** single-table design
- **API Gateway** for REST and WebSocket APIs
- **S3** for file storage and static hosting
- **CloudFront** for CDN

### Infrastructure
- **Terraform** for Infrastructure as Code
- **LocalStack** for local AWS simulation
- **Docker Compose** for development environment
- **GitHub Actions** for CI/CD

## 📋 Prerequisites

- **Node.js 18+**
- **npm 9+**
- **Docker** and **Docker Compose**
- **AWS CLI** (for production deployment)
- **Terraform** (for infrastructure management)

## 🏃‍♂️ Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd book-management
npm install
```

### 2. Start Local Development Environment

```bash
# Start LocalStack and all services
npm run setup

# Create DynamoDB table
node scripts/create-table.js

# In separate terminals:
npm run dev:backend   # Backend services
npm run dev:frontend  # Frontend application

# Seed test data (optional)
npm run seed:data
```

### 3. Access the Application

- **Frontend**: http://localhost:3001
- **API**: http://localhost:4566
- **DynamoDB Admin**: http://localhost:8001

## 🔧 Development Commands

```bash
# Setup and Development
npm run setup           # Complete environment setup
npm run dev            # Start both frontend and backend
npm run dev:backend    # Backend services only
npm run dev:frontend   # Frontend application only
# Then run the tests
node test-rbac.js
node test-frontend-integration.js


# Building
npm run build          # Build all services
npm run build:dev      # Build for development
npm run build:prod     # Build for production

# Testing
npm run test           # Run all tests
npm run test:coverage  # Run tests with coverage
npm run lint           # Lint all code
npm run type-check     # TypeScript type checking

# LocalStack Management
npm run localstack:start    # Start LocalStack
npm run localstack:stop     # Stop LocalStack
npm run localstack:reset    # Reset LocalStack data
npm run seed:data          # Seed mock data

# Deployment
npm run deploy:dev      # Deploy to development
npm run deploy:staging  # Deploy to staging
npm run deploy:prod     # Deploy to production
```

## 📁 Project Structure

```
book-management/
├── backend/                 # TypeScript Lambda services
│   ├── src/
│   │   ├── services/       # Domain services
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # Utilities
│   │   └── middleware/     # Express middleware
│   ├── tests/              # Backend tests
│   └── package.json
├── frontend/               # React TypeScript application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── store/          # Zustand stores
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   ├── public/             # Static assets
│   └── package.json
├── infrastructure/         # Terraform modules
│   ├── modules/            # Reusable Terraform modules
│   ├── environments/       # Environment-specific configs
│   └── main.tf
├── scripts/               # Development and deployment scripts
├── tests/                 # Integration and E2E tests
├── docker-compose.yml     # LocalStack configuration
└── package.json          # Root package.json with workspaces
```

## 🏗 Architecture Overview

### Serverless Architecture
- **API Gateway** → **Lambda Functions** → **DynamoDB**
- **S3** for file storage and static website hosting
- **CloudFront** for global CDN and frontend delivery
- **SNS/SQS** for event-driven architecture
- **CloudWatch** for monitoring and logging

### Data Model
- **Single-table DynamoDB design** for optimal performance
- **Entity types**: User, Book, Review, Workflow, Session, Notification
- **Access patterns** optimized with GSI indexes
- **Encryption** for PII data with AES-256-GCM

### Security
- **JWT authentication** with RS256 asymmetric encryption
- **Role-based access control** (RBAC)
- **Input validation** and sanitization
- **Rate limiting** and DDoS protection
- **GDPR compliance** features

## 🌍 Environment Configuration

### Local Development
- Uses **LocalStack** for complete AWS simulation
- **Hot reload** for both frontend and backend
- **Mock data** seeding for consistent testing
- **DynamoDB Admin UI** for data inspection

### Production Deployment
- **Multi-environment** support (dev, staging, prod)
- **Blue-green deployment** with rollback capability
- **CloudFront CDN** for global performance
- **Free Tier monitoring** and cost optimization

## 🧪 Testing Strategy

### Unit Tests
- **Jest** with TypeScript support
- **80% minimum coverage** requirement
- **React Testing Library** for component tests
- **LocalStack integration** for AWS services

### Integration Tests
- **Complete workflow testing** with LocalStack
- **API endpoint testing** with supertest
- **Database operations** with mock data

### End-to-End Tests
- **Playwright** for cross-browser testing
- **User journey validation** for all roles
- **Performance testing** with Artillery.js

## 📊 AWS Free Tier Optimization

### Always Free Services
- **Lambda**: 1M requests + 400K GB-seconds/month
- **DynamoDB**: 25GB storage + 25 RCU/WCU per second
- **API Gateway**: 1M REST API calls/month
- **CloudWatch**: 10 custom metrics + 10 alarms
- **CloudFront**: 1TB data transfer + 10M requests/month

### 12-Month Free Services
- **S3**: 5GB storage + 20K GET + 2K PUT requests
- **SNS**: 1M publishes + 100K HTTP deliveries
- **SQS**: 1M requests/month
- **SES**: 62K emails/month

### Cost Monitoring
- **Real-time usage tracking** with 80% threshold alerts
- **Monthly cost projections** and optimization recommendations
- **Automated cleanup** for development environments

## 🚀 Deployment

### Local Development
```bash
npm run setup              # Start LocalStack environment
npm run localstack:deploy  # Deploy infrastructure locally
npm run seed:data         # Seed test data
```

### AWS Deployment
```bash
# Deploy infrastructure
cd infrastructure
terraform init
terraform plan -var-file=environments/prod/terraform.tfvars
terraform apply

# Deploy application
npm run deploy:prod
```

## 📝 API Documentation

### Authentication Endpoints
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - User logout

### Book Management
- `GET /books` - List books (with filters)
- `POST /books` - Create book
- `GET /books/{id}` - Get book details
- `PUT /books/{id}` - Update book
- `DELETE /books/{id}` - Delete book
- `POST /books/{id}/submit` - Submit for editing

### Review System
- `GET /books/{id}/reviews` - Get book reviews
- `POST /books/{id}/reviews` - Create review
- `PUT /reviews/{id}` - Update review
- `DELETE /reviews/{id}` - Delete review

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions in GitHub Discussions

## 🎯 Roadmap

- [ ] Mobile app development (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] AI-powered content recommendations
- [ ] Blockchain-based royalty distribution
- [ ] Advanced collaboration features

---

**Built with ❤️ using TypeScript, React, and AWS**


curl -s http://localhost:3001/health
Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"author@example.com","password":"password123"}'
Registration
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"author@example.com","password":"password123"}'  

  curl -X OPTIONS -H "Origin: http://localhost:3002" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" -v http://localhost:3001/api/auth/login 2>&1 | grep -E "Access-Control-Allow-Origin|HTTP/"

  curl -s -X OPTIONS -H "Origin: http://localhost:3002" -H "Access-Control-Request-Method: POST" http://localhost:3001/api/auth/login -I