#!/bin/bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to display status
status() {
    echo -e "${BLUE}🚀 $1${NC}"
}

# Function to display success
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to display error and exit
error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check Docker
status "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker and try again."
fi

# Create project structure
status "Creating project structure..."
mkdir -p backend/src/{functions,lib,models,services,utils} \
       frontend/src/{components,hooks,services,utils,styles} \
       infrastructure/{modules,environments} \
       scripts \
       docs/chat-logs/sessions

# Install dependencies
status "Installing root dependencies..."
npm install

status "Installing backend dependencies..."
cd backend
npm install
npm run build
cd ..

status "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Make scripts executable
status "Making scripts executable..."
chmod +x scripts/*.sh

# Build and start Docker services
status "Building Docker images..."
docker-compose build

status "Starting Docker services..."
docker-compose up -d

# Wait for LocalStack
status "Waiting for LocalStack to be ready..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"status": "running"'; do
    echo "⏳ Waiting for LocalStack..."
    sleep 2
done

# Deploy Lambda function
status "Deploying Lambda function..."
docker-compose exec -T lambda-deployer ./scripts/deploy-local.sh

# Verify services
status "Verifying services..."
docker-compose ps

success "Setup complete! Development environment is ready."
echo "
📝 Available endpoints:
- Frontend: http://localhost:3000
- LocalStack: http://localhost:4566
- DynamoDB Admin: http://localhost:8001

📋 Useful commands:
- View all logs: docker-compose logs -f
- Access dev tools: docker-compose exec devtools bash
- Stop all services: docker-compose down

Happy coding! 🎉"
