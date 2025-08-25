#!/bin/bash

echo "🔍 LocalStack Troubleshooting"
echo "=============================="

# Check Docker
echo "🐳 Docker Status:"
docker --version
docker-compose --version
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check container status
echo "📊 Container Status:"
docker-compose ps
echo ""

# Check container logs
echo "📋 Recent LocalStack Logs:"
docker-compose logs --tail=50 localstack
echo ""

# Check port availability
echo "🔌 Port 4566 Status:"
if lsof -i :4566 > /dev/null 2>&1; then
    echo "✅ Port 4566 is in use"
    lsof -i :4566
else
    echo "❌ Port 4566 is not in use"
fi
echo ""

# Test LocalStack health
echo "🏥 LocalStack Health Check:"
if curl -f http://localhost:4566/health 2>/dev/null; then
    echo ""
    echo "✅ LocalStack is responding"
else
    echo "❌ LocalStack is not responding"
fi
echo ""

# Check available disk space
echo "💾 Disk Space:"
df -h .
echo ""

# Check memory usage
echo "🧠 Memory Usage:"
docker stats --no-stream localstack 2>/dev/null || echo "Container not running"
echo ""

echo "🛠️  Troubleshooting Steps:"
echo "1. Restart LocalStack: docker-compose down && docker-compose up -d"
echo "2. Check logs: docker-compose logs -f localstack"
echo "3. Clean restart: docker-compose down && docker system prune -f && docker-compose up -d"
echo "4. Manual health check: curl http://localhost:4566/health"