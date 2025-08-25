#!/bin/bash

echo "🚀 Starting LocalStack..."

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Clean up any orphaned containers
docker container prune -f

# Create tmp directory for LocalStack data
mkdir -p tmp/localstack

# Start LocalStack
echo "🐳 Starting LocalStack container..."
docker-compose up -d localstack

# Wait for container to be running
echo "⏳ Waiting for container to start..."
sleep 10

# Check container status
echo "📊 Container status:"
docker-compose ps

# Check logs if there are issues
echo "📋 Recent logs:"
docker-compose logs --tail=20 localstack

echo "✅ LocalStack startup initiated!"
echo "🔍 Check status with: docker-compose ps"
echo "📋 View logs with: docker-compose logs -f localstack"
echo "🌐 Health check: curl http://localhost:4566/health"