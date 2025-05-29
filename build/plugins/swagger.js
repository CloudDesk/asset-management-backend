import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '../config/env.js';
async function swaggerPlugin(fastify) {
    // Register Swagger
    await fastify.register(swagger, {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'Asset Management API',
                description: `
# 🏢 Asset Management API

A production-grade Node.js API backend with Fastify, TypeScript, and Prisma for comprehensive asset and inventory management.

## 🔐 Authentication

This API uses **Bearer Token Authentication** for all protected endpoints. You need to sign in to get a valid token.

### How to Authenticate:

#### 1. **Register a New Account** (First Time Users)
\`\`\`bash
POST /v1/auth/register
{
  "useremail": "your.email@example.com",
  "userpassword": "YourPassword123!",
  "firstname": "Your",
  "lastname": "Name"
}
\`\`\`

#### 2. **Sign In** (Existing Users)
\`\`\`bash
POST /v1/auth/signin
{
  "useremail": "your.email@example.com",
  "userpassword": "YourPassword123!"
}
\`\`\`

**Response will include a token:**
\`\`\`json
{
  "success": true,
  "data": {
    "user": { "id": 1, "useremail": "your.email@example.com", ... },
    "token": "your-session-token-here"
  }
}
\`\`\`

#### 3. **Using the Token**

**Option A: Authorization Header (Recommended)**
\`\`\`
Authorization: Bearer your-session-token-here
\`\`\`

**Option B: Query Parameter**
\`\`\`
?token=your-session-token-here
\`\`\`

### 🚀 Quick Start Example

1. **Register or Sign In:**
   - Use the \`/v1/auth/register\` or \`/v1/auth/signin\` endpoints below
   - Copy the \`token\` from the response

2. **Authorize in Swagger:**
   - Click the **🔒 Authorize** button at the top of this page
   - Enter: \`Bearer your-session-token-here\`
   - Click **Authorize**

3. **Test Protected Endpoints:**
   - Try any endpoint (they all require authentication except \`/health\` and \`/auth/*\`)
   - The token will be automatically included in requests

### 🔧 Using with cURL

\`\`\`bash
# Get a token first
curl -X POST "http://localhost:${env.PORT}/v1/auth/signin" \\
  -H "Content-Type: application/json" \\
  -d '{"useremail":"test@example.com","userpassword":"password123"}'

# Use the token in subsequent requests
curl -X GET "http://localhost:${env.PORT}/v1/inventoryusers" \\
  -H "Authorization: Bearer your-session-token-here"
\`\`\`

### 🔧 Using with JavaScript

\`\`\`javascript
// Sign in and get token
const response = await fetch('/v1/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    useremail: 'test@example.com',
    userpassword: 'password123'
  })
});
const { data } = await response.json();
const token = data.token;

// Use token for protected requests
const usersResponse = await fetch('/v1/inventoryusers', {
  headers: { 'Authorization': \`Bearer \${token}\` }
});
\`\`\`

### ⚡ Features

- **Secure Session Management**: Tokens are stored securely in the database
- **Rate Limiting**: Protection against brute force attacks
- **Password Reset**: Forgot password functionality with email notifications
- **Role-Based Access**: Different permission levels (admin, user, etc.)
- **Auto-Expiration**: Tokens automatically expire for security

### 🔒 Security Notes

- All passwords are hashed using bcrypt
- Session tokens are securely generated and stored
- Rate limiting prevents brute force attacks
- All endpoints (except auth and health) require valid authentication
- Tokens can be invalidated by signing out

---
`,
                version: '1.0.0',
                contact: {
                    name: 'API Support',
                    email: 'support@example.com'
                },
                license: {
                    name: 'MIT',
                    url: 'https://opensource.org/licenses/MIT'
                }
            },
            servers: [
                {
                    url: `http://localhost:${env.PORT}`,
                    description: 'Development server',
                },
                {
                    url: `https://your-api-domain.com`,
                    description: 'Production server',
                },
            ],
            tags: [
                {
                    name: 'Authentication',
                    description: `
## 🔐 Authentication Endpoints

**Public endpoints** - No authentication required:
- Register new account
- Sign in existing user  
- Password reset functionality
- Get current user info (requires token)

All other API endpoints require authentication.
          `
                },
                {
                    name: 'Health',
                    description: '🩺 Health check endpoints - No authentication required'
                },
                {
                    name: 'Inventory Users',
                    description: `
## 👥 Inventory Users Management

**🔒 Authentication Required** - All endpoints require a valid Bearer token.

Manage inventory users who have access to the system:
- List all users with filtering and pagination
- Get specific user details  
- Create new inventory users
- Update user information
- Delete users

**Required Role:** Admin or self-access for viewing own profile.
          `
                },
                {
                    name: 'Products',
                    description: '📦 Product management endpoints - **🔒 Authentication Required**'
                },
                {
                    name: 'Stocks',
                    description: '📊 Stock management endpoints - **🔒 Authentication Required**'
                },
                {
                    name: 'Picklists',
                    description: '📝 Picklist management endpoints - **🔒 Authentication Required**'
                },
                {
                    name: 'Suppliers',
                    description: '🏪 Supplier management endpoints - **🔒 Authentication Required**'
                },
                {
                    name: 'Purchase Orders',
                    description: '🛒 Purchase order management endpoints - **🔒 Authentication Required**'
                },
                {
                    name: 'Purchase Requests',
                    description: '📋 Purchase request management endpoints - **🔒 Authentication Required**'
                },
                {
                    name: 'Quotes',
                    description: '💰 Quote management endpoints - **🔒 Authentication Required**'
                },
                {
                    name: 'Notes',
                    description: '📝 Note management endpoints - **🔒 Authentication Required**'
                },
                {
                    name: 'Users',
                    description: '👤 User management endpoints - **🔒 Authentication Required**'
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'Token',
                        description: `
## 🔐 Bearer Token Authentication

**How to get a token:**
1. Register: \`POST /v1/auth/register\` 
2. Or Sign in: \`POST /v1/auth/signin\`
3. Copy the \`token\` from the response
4. Use it as: \`Bearer your-token-here\`

**Example:**
\`\`\`
Authorization: Bearer abc123def456ghi789
\`\`\`

**Alternative:** You can also pass the token as a query parameter:
\`\`\`
?token=abc123def456ghi789
\`\`\`
            `
                    },
                },
                examples: {
                    SignInRequest: {
                        summary: 'Sign in with credentials',
                        value: {
                            useremail: 'user@example.com',
                            userpassword: 'SecurePassword123!'
                        }
                    },
                    RegisterRequest: {
                        summary: 'Register new user account',
                        value: {
                            useremail: 'newuser@example.com',
                            userpassword: 'SecurePassword123!',
                            firstname: 'John',
                            lastname: 'Doe',
                            role: 'user',
                            location: 'Warehouse A'
                        }
                    },
                    AuthSuccessResponse: {
                        summary: 'Successful authentication response',
                        value: {
                            success: true,
                            data: {
                                user: {
                                    id: 1,
                                    useremail: 'user@example.com',
                                    firstname: 'John',
                                    lastname: 'Doe',
                                    role: 'user',
                                    location: 'Warehouse A'
                                },
                                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                            },
                            message: 'Authentication successful'
                        }
                    },
                    UnauthorizedResponse: {
                        summary: 'Unauthorized access attempt',
                        value: {
                            success: false,
                            message: 'Authentication required',
                            details: 'Please provide a valid Bearer token in the Authorization header',
                            statusCode: 401,
                            authenticationRequired: true,
                            authenticationMethods: [
                                'Bearer token in Authorization header',
                                'Token query parameter (?token=YOUR_TOKEN)'
                            ]
                        }
                    }
                },
                responses: {
                    UnauthorizedError: {
                        description: 'Authentication required - No valid token provided',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: false },
                                        message: { type: 'string', example: 'Authentication required' },
                                        details: { type: 'string', example: 'Please provide a valid Bearer token' },
                                        statusCode: { type: 'number', example: 401 },
                                        authenticationRequired: { type: 'boolean', example: true },
                                        authenticationMethods: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            example: ['Bearer token in Authorization header', 'Token query parameter']
                                        }
                                    }
                                }
                            }
                        }
                    },
                    ForbiddenError: {
                        description: 'Insufficient permissions for this operation',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: false },
                                        message: { type: 'string', example: 'Insufficient permissions' },
                                        details: { type: 'string', example: 'You need admin role to access this resource' },
                                        statusCode: { type: 'number', example: 403 }
                                    }
                                }
                            }
                        }
                    },
                    RateLimitError: {
                        description: 'Too many requests - Rate limit exceeded',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: false },
                                        message: { type: 'string', example: 'Too many attempts' },
                                        details: { type: 'string', example: 'Please try again later' },
                                        statusCode: { type: 'number', example: 429 },
                                        remainingAttempts: { type: 'number', example: 0 },
                                        retryAfter: { type: 'number', example: 900 }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            security: [
                {
                    bearerAuth: []
                }
            ]
        },
    });
    // Register Swagger UI
    await fastify.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
            defaultModelsExpandDepth: 2,
            defaultModelExpandDepth: 2,
            displayRequestDuration: true,
            tryItOutEnabled: true,
            requestInterceptor: (request) => {
                // Log requests for debugging
                console.log('Swagger UI request:', request.method, request.url);
                return request;
            },
        },
        staticCSP: true,
        transformStaticCSP: (header) => header,
        transformSpecification: (swaggerObject) => {
            return swaggerObject;
        },
        transformSpecificationClone: true,
    });
}
export default fp(swaggerPlugin, {
    name: 'swagger',
});
//# sourceMappingURL=swagger.js.map