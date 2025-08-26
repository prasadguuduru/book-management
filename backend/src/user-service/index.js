// Lambda Function - Clean implementation without Express
// This function handles API Gateway proxy integration

// CORS headers for all responses
const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Max-Age': '86400'
};

// Helper function to create response
function createResponse(statusCode, body, additionalHeaders = {}) {
    return {
        statusCode,
        headers: {
            ...corsHeaders,
            ...additionalHeaders
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    };
}

// Main Lambda handler
exports.handler = async (event, context) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));
    
    try {
        // Extract HTTP method and path
        const httpMethod = event.httpMethod || 'GET';
        const path = event.path || '/';
        const origin = event.headers?.origin || event.headers?.Origin || null;
        
        console.log(`Processing ${httpMethod} ${path} from origin: ${origin}`);
        
        // Handle preflight OPTIONS requests
        if (httpMethod === 'OPTIONS') {
            console.log('Handling CORS preflight request');
            return createResponse(200, {
                message: 'CORS preflight successful',
                allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
                environment: process.env.NODE_ENV || 'qa',
                service: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown'
            });
        }
        
        // Health check endpoint
        if (path === '/health' || path.endsWith('/health')) {
            return createResponse(200, {
                status: 'healthy',
                service: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'qa',
                version: '1.0.0',
                cors: {
                    origin: origin,
                    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS || '*'
                }
            });
        }
        
        // Get service name from function name
        const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || '';
        const serviceName = functionName.includes('auth') ? 'auth' :
                           functionName.includes('book') ? 'book' :
                           functionName.includes('user') ? 'user' :
                           functionName.includes('workflow') ? 'workflow' :
                           functionName.includes('review') ? 'review' :
                           functionName.includes('notification') ? 'notification' : 'unknown';
        
        // Service-specific routing
        switch (serviceName) {
            case 'auth':
                return handleAuthService(event, context);
            case 'book':
                return handleBookService(event, context);
            case 'user':
                return handleUserService(event, context);
            case 'workflow':
                return handleWorkflowService(event, context);
            case 'review':
                return handleReviewService(event, context);
            case 'notification':
                return handleNotificationService(event, context);
            default:
                return createResponse(404, {
                    error: 'Not Found',
                    message: `Service not found: ${serviceName}`,
                    path: path,
                    method: httpMethod,
                    functionName: functionName
                });
        }
        
    } catch (error) {
        console.error('Error:', error);
        
        return createResponse(500, {
            error: 'Internal Server Error',
            message: error.message,
            service: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
            timestamp: new Date().toISOString()
        });
    }
};

// Service-specific handlers
function handleAuthService(event, context) {
    const path = event.path || '/';
    const method = event.httpMethod || 'GET';
    const body = event.body ? JSON.parse(event.body) : {};
    
    console.log(`Auth service handling: ${method} ${path}`);
    
    if (path.includes('/login') || method === 'POST') {
        return createResponse(200, {
            message: 'Auth service - login endpoint',
            service: 'auth-service',
            endpoint: 'login',
            method: method,
            status: 'success',
            data: {
                placeholder: true,
                received: body
            },
            timestamp: new Date().toISOString()
        });
    }
    
    return createResponse(200, {
        message: 'Auth service - working correctly',
        service: 'auth-service',
        availableEndpoints: ['/login', '/register', '/refresh', '/logout'],
        method: method,
        path: path,
        environment: process.env.NODE_ENV || 'qa'
    });
}

function handleBookService(event, context) {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    return createResponse(200, {
        message: 'Book service - working correctly',
        service: 'book-service',
        availableEndpoints: ['/books', '/books/:id', '/books/my-books'],
        method: method,
        path: path,
        environment: process.env.NODE_ENV || 'qa'
    });
}

function handleUserService(event, context) {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    return createResponse(200, {
        message: 'User service - working correctly',
        service: 'user-service',
        availableEndpoints: ['/users/profile', '/users/:id'],
        method: method,
        path: path,
        environment: process.env.NODE_ENV || 'qa'
    });
}

function handleWorkflowService(event, context) {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    return createResponse(200, {
        message: 'Workflow service - working correctly',
        service: 'workflow-service',
        availableEndpoints: ['/workflow/tasks', '/workflow/books/:id/history'],
        method: method,
        path: path,
        environment: process.env.NODE_ENV || 'qa'
    });
}

function handleReviewService(event, context) {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    return createResponse(200, {
        message: 'Review service - working correctly',
        service: 'review-service',
        availableEndpoints: ['/books/:id/reviews', '/reviews/:id'],
        method: method,
        path: path,
        environment: process.env.NODE_ENV || 'qa'
    });
}

function handleNotificationService(event, context) {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    return createResponse(200, {
        message: 'Notification service - working correctly',
        service: 'notification-service',
        availableEndpoints: ['/notifications', '/notifications/mark-read'],
        method: method,
        path: path,
        environment: process.env.NODE_ENV || 'qa'
    });
}
