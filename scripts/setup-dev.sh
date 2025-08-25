#!/bin/bash

# Exit on error
set -e

echo "🚀 Setting up development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Build backend
echo "🔨 Building backend..."
cd backend
npm run build
cd ..

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose down -v # Clean start
docker-compose up -d

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"status": "running"'; do
    echo "Waiting for LocalStack..."
    sleep 2
done

# Deploy Lambda function
echo "🚀 Deploying Lambda function..."
cd backend
npm run deploy:local
cd ..

# Start frontend
echo "🌐 Starting frontend development server..."
cd frontend
npm start &
cd ..

echo "✅ Development environment setup complete!"
echo "
🔍 Available endpoints:
- Frontend: http://localhost:3000
- LocalStack: http://localhost:4566
- API Gateway: http://localhost:4566/restapis/{api-id}/local/_user_request_/hello

📝 Usage:
- Use 'docker-compose logs -f' to view service logs
- Use 'docker-compose down' to stop services
- Frontend hot-reloading is enabled
- Backend changes require re-running 'npm run deploy:local' in the backend directory

Happy coding! 🎉"
