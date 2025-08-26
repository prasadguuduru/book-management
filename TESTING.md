# Testing Guide for Ebook Publishing Platform

## Quick Test Commands

### 1. Backend Health Check
```bash
curl http://localhost:3001/health
```
**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-23T10:xx:xx.xxxZ",
  "environment": "local",
  "version": "1.0.0"
}
```

### 2. CORS Test
```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:3002" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v http://localhost:3001/api/auth/login
```
**Expected:** Should see `Access-Control-Allow-Origin` header in response

### 3. Registration Test
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "AUTHOR"
  }'
```
**Expected Response:**
```json
{
  "user": {
    "userId": "...",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "role": "AUTHOR",
    "isActive": true,
    "emailVerified": false
  },
  "accessToken": "...",
  "refreshToken": "...",
  "timestamp": "..."
}
```

### 4. Login Test
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 5. Frontend Integration Test
Open your browser to `http://localhost:3002` and:
1. Try to register a new user
2. Try to login with the registered user
3. Check browser console for any CORS errors

## Automated Test Script

Run this comprehensive test:
```bash
node test-frontend-integration.js
```

## Test Scenarios

### ✅ Success Cases
- [ ] Backend starts without TypeScript errors
- [ ] Health endpoint responds correctly
- [ ] CORS allows requests from port 3002
- [ ] User registration works
- [ ] User login works
- [ ] JWT tokens are generated
- [ ] Frontend can communicate with backend

### ❌ Error Cases to Test
- [ ] Invalid email format in registration
- [ ] Weak password (less than 8 characters)
- [ ] Duplicate email registration
- [ ] Invalid login credentials
- [ ] Missing required fields

## Debugging Tips

### Backend Issues
```bash
# Check backend logs
npm run dev:backend

# Check if backend is running
lsof -i :3001

# Test specific endpoint
curl -v http://localhost:3001/api/auth/login
```

### Frontend Issues
```bash
# Check frontend logs
npm run dev:frontend

# Check if frontend is running
lsof -i :3002

# Check browser console for errors
```

### CORS Issues
```bash
# Test CORS preflight
curl -X OPTIONS -H "Origin: http://localhost:3002" -v http://localhost:3001/api/auth/login
```

## Environment Verification

### Check Configuration
```bash
# Backend port
echo $BACKEND_PORT

# Frontend port  
echo $FRONTEND_PORT

# CORS origin
echo $CORS_ORIGIN

# API URL
echo $VITE_API_URL
```

### Current Expected Configuration
- **Backend:** http://localhost:3001
- **Frontend:** http://localhost:3002
- **CORS:** Allows both 3000 and 3002
- **API URL:** http://localhost:3001

## Next Steps After Basic Tests Pass

1. **Add Authentication Middleware** - Restore protected routes
2. **Add More Endpoints** - Books, users, reviews, etc.
3. **Add Frontend Pages** - Dashboard, book editor, etc.
4. **Add Real-time Features** - WebSocket connections
5. **Add File Upload** - Book covers and content