# AWS Serverless TypeScript Project

## Overview
This project implements a serverless application using AWS services with TypeScript, React, and Terraform. It follows security best practices and provides comprehensive logging for both local development and AWS environments.

## Architecture
![Architecture Diagram](development-artifacts/architecture.png)

### Core Components
- **Frontend**: React + TypeScript application served via CloudFront
- **Backend**: AWS Lambda functions written in TypeScript
- **Infrastructure**: Terraform-managed AWS resources
- **Local Development**: LocalStack for AWS service emulation

## Project Structure
```
.
├── backend/                 # TypeScript Lambda functions
│   ├── src/
│   │   ├── functions/      # Lambda function handlers
│   │   ├── lib/           # Shared libraries
│   │   ├── models/        # Data models and types
│   │   ├── services/      # Business logic services
│   │   └── utils/         # Utility functions
├── frontend/               # React TypeScript application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API and service integrations
│   │   ├── utils/        # Utility functions
│   │   └── styles/       # CSS/SCSS styles
├── infrastructure/         # Terraform configurations
│   ├── modules/          # Reusable Terraform modules
│   └── environments/     # Environment-specific configs
├── scripts/               # Development and utility scripts
└── development-artifacts/ # Documentation and development resources
```

## Prerequisites
- Node.js >= 18
- AWS CLI configured
- Terraform >= 1.0
- Docker (for LocalStack)
- LocalStack CLI

## Getting Started

### Local Development Setup
1. Install dependencies:
   ```bash
   # Install root dependencies
   npm install

   # Install backend dependencies
   cd backend && npm install

   # Install frontend dependencies
   cd frontend && npm install
   ```

2. Start LocalStack:
   ```bash
   npm run localstack:start
   ```

3. Deploy local infrastructure:
   ```bash
   npm run deploy:local
   ```

4. Start development servers:
   ```bash
   # Start backend
   npm run backend:dev

   # Start frontend
   npm run frontend:dev
   ```

### AWS Deployment
1. Initialize Terraform:
   ```bash
   cd infrastructure
   terraform init
   ```

2. Deploy to AWS:
   ```bash
   terraform apply
   ```

## Security Best Practices
- JWT-based authentication
- API Gateway authorization
- CORS configuration
- Input validation
- XSS prevention
- CSRF protection
- Secure headers
- Rate limiting
- AWS IAM least privilege

## Logging
- Structured logging format
- Log levels (DEBUG, INFO, WARN, ERROR)
- Request/Response logging
- Performance metrics
- Error tracking
- AWS CloudWatch integration
- Local log aggregation

## Local Development
- LocalStack for AWS service emulation
- Mock data generation
- Hot reloading
- Debug configurations
- Environment variable management

## Testing
- Unit tests
- Integration tests
- E2E tests
- Security tests
- Performance tests

## CI/CD
- GitHub Actions workflows
- Automated testing
- Infrastructure validation
- Security scanning
- Deployment automation

## Contributing
1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

## License
MIT

## Support
For issues and support:
- Create a GitHub issue
- Contact the development team
