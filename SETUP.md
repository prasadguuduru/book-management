# Setup Guide

## Quick Fix for LocalStack Issues

If you're experiencing LocalStack startup issues, follow these steps:

### 1. Clean Restart LocalStack

```bash
# Stop and remove containers
docker-compose down -v

# Remove any existing LocalStack data
rm -rf tmp/localstack

# Start fresh
docker-compose up -d

# Wait for LocalStack to be ready
npm run localstack:wait
```

### 2. Troubleshoot LocalStack

```bash
# Run the troubleshooting tool
npm run localstack:troubleshoot

# View LocalStack logs
npm run localstack:logs
```

### 3. Manual Setup Steps

If the automated setup fails, you can set up manually:

```bash
# 1. Start LocalStack
docker-compose up -d

# 2. Wait for it to be ready (this may take 2-3 minutes)
npm run localstack:wait

# 3. Create basic AWS resources manually
aws --endpoint-url=http://localhost:4566 s3 mb s3://local-ebook-frontend
aws --endpoint-url=http://localhost:4566 s3 mb s3://local-ebook-assets
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name local-ebook-platform \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# 4. Seed mock data
npm run seed:data

# 5. Start development servers
npm run dev
```

### 4. Alternative: Skip LocalStack for Now

If LocalStack continues to have issues, you can start development without it:

```bash
# Install dependencies
npm install

# Start frontend only (will show mock data)
npm run dev:frontend
```

The frontend will run on http://localhost:3001 and show the UI even without the backend.

### 5. System Requirements

Make sure you have:
- **Docker Desktop** running
- **Node.js 18+**
- **At least 4GB RAM** available for Docker
- **Port 4566** not in use by other applications

### 6. Common Issues

**Issue: "Container is unhealthy"**
- Solution: Wait longer (LocalStack can take 2-3 minutes to start)
- Or try: `docker-compose down && docker-compose up -d`

**Issue: "Port already in use"**
- Solution: Check what's using port 4566: `lsof -i :4566`
- Kill the process or change the port in docker-compose.yml

**Issue: "Out of memory"**
- Solution: Increase Docker memory limit to at least 4GB
- Or disable some services in docker-compose.yml

### 7. Verify Setup

Once LocalStack is running, verify with:

```bash
# Check LocalStack health
curl http://localhost:4566/health

# Check if DynamoDB is working
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# Check if S3 is working
aws --endpoint-url=http://localhost:4566 s3 ls
```

### 8. Development Workflow

Once everything is set up:

```bash
# Start everything
npm run setup

# Or start services individually
npm run localstack:start
npm run localstack:wait
npm run dev:backend    # Terminal 1
npm run dev:frontend   # Terminal 2
```

Access the application:
- **Frontend**: http://localhost:3001
- **API**: http://localhost:4566
- **DynamoDB Admin**: http://localhost:8001

## Need Help?

If you're still having issues:

1. Run `npm run localstack:troubleshoot` for diagnostics
2. Check `npm run localstack:logs` for error messages
3. Try the manual setup steps above
4. Or start with frontend-only development