#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to display status
status() {
    echo -e "${BLUE}🧹 $1${NC}"
}

# Function to display success
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Stop all containers
status "Stopping all containers..."
docker-compose down

# Remove LocalStack data
status "Cleaning LocalStack data..."
rm -rf localstack-data/* localstack-tmp/*

# Create fresh directories
status "Creating fresh directories..."
mkdir -p localstack-data localstack-tmp logs/{localstack,frontend,lambda}

success "Cleanup completed! You can now start the services again."
