/**
 * Public Routes Configuration
 * 
 * This file defines all routes that should be accessible without authentication.
 * All routes not listed here will require authentication via Bearer token.
 * 
 * Format: "METHOD /path"
 * - Use exact paths (no wildcards)
 * - Include /v1 prefix for API routes
 * - Query parameters are ignored for matching
 */

// ============================================================================
// E-COMMERCE PUBLIC ROUTES
// ============================================================================

export const ECOMMERCE_PUBLIC_ROUTES = [
    // 1. Authentication APIs
    'POST /v1/mobile-auth/request-otp',
    'POST /v1/mobile-auth/verify-otp',

    // 2. Product Browsing APIs (only nivapp platform is public, other platforms like amazon are protected)
    'GET /v1/products/platform/nivapp',
    'GET /v1/products/platform/nivapp/counts',
    'GET /v1/products/:productId/platform/:platform', // Support any platform for dynamic routing


    // 3. Promotions & Deals APIs
    'GET /v1/promotions', // Main promotions route - supports optional userid parameter

    // 4. Ratings & Reviews APIs
    'GET /v1/ratings',
    'GET /v1/ratings/product/:productId',

    // 5. Picklists APIs
    'GET /v1/picklists',

    // 6. Health Check APIs
    'GET /v1/health',
    'GET /health',

    // 7. System & Webhook APIs (Internal but public for cloud tasks/webhooks)
    'POST /v1/phonepe/cleanup-lock',
    'POST /v1/ekart/webhook/track-status', // Ekart tracking status webhook

    // 8. Payment Callback APIs (PhonePe SDK redirects)
    'GET /v1/phonepe/callback/:transactionId',
    'POST /v1/phonepe/callback/:transactionId',
    'OPTIONS /v1/phonepe/callback/:transactionId',
];

// ============================================================================
// INVENTORY PUBLIC ROUTES
// ============================================================================

export const INVENTORY_PUBLIC_ROUTES = [
    // 1. Authentication APIs
    'POST /v1/auth/signin',
    'POST /v1/auth/forgot-password',
    'POST /v1/auth/reset-password',

    // 2. User Management APIs
    'POST /v1/inventoryusers',

    // 3. Roles APIs
    'GET /v1/roles',

    // 4. Health Check APIs
    'GET /v1/health',
    'GET /health',

    // 5. Analytics APIs (Public for testing)
    'GET /v1/analytics/inventory-health',
    'GET /v1/analytics/fulfillment-summary',
    'GET /v1/analytics/sales-velocity',
    'GET /v1/analytics/supply-chain',
    'GET /v1/analytics/orders',
];

// ============================================================================
// COMBINED PUBLIC ROUTES
// ============================================================================

export const ALL_PUBLIC_ROUTES = Array.from(
    new Set([...ECOMMERCE_PUBLIC_ROUTES, ...INVENTORY_PUBLIC_ROUTES])
);

// ============================================================================
// ROUTE MATCHING UTILITIES
// ============================================================================

/**
 * Normalize a URL path by removing query parameters and trailing slashes
 */
function normalizePath(path: string): string {
    // Remove query parameters
    const pathWithoutQuery = path.split('?')[0] || path;
    // Remove trailing slash (except for root)
    return pathWithoutQuery.length > 1 && pathWithoutQuery.endsWith('/')
        ? pathWithoutQuery.slice(0, -1)
        : pathWithoutQuery;
}

/**
 * Check if a route pattern matches the actual path
 * Supports :param style path parameters
 * 
 * @param pattern - Route pattern (e.g., "/v1/products/:productId/platform/:platform")
 * @param actualPath - Actual request path (e.g., "/v1/products/123/platform/ecommerce")
 * @returns true if pattern matches path
 */
function matchesPattern(pattern: string, actualPath: string): boolean {
    const normalizedPath = normalizePath(actualPath);

    // Exact match (no parameters)
    if (pattern === normalizedPath) {
        return true;
    }

    // Pattern matching with :param
    const patternParts = pattern.split('/');
    const pathParts = normalizedPath.split('/');

    // Must have same number of segments
    if (patternParts.length !== pathParts.length) {
        return false;
    }

    // Check each segment
    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        const pathPart = pathParts[i];

        // Skip if either part is undefined (not checking for empty string, which is valid)
        if (patternPart === undefined || pathPart === undefined) {
            return false;
        }

        // If pattern part is a parameter (starts with :), it matches any value
        if (patternPart.startsWith(':')) {
            continue;
        }

        // Otherwise, must be exact match
        if (patternPart !== pathPart) {
            return false;
        }
    }

    return true;
}

/**
 * Check if a route is public (does not require authentication)
 * 
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param url - Request URL path
 * @returns true if route is public, false if it requires authentication
 */
export function isPublicRoute(method: string, url: string): boolean {
    const normalizedPath = normalizePath(url);
    const routeSignature = `${method.toUpperCase()} ${normalizedPath}`;

    // Check against all public routes
    for (const publicRoute of ALL_PUBLIC_ROUTES) {
        const parts = publicRoute.split(' ');
        const publicMethod = parts[0];
        const publicPath = parts[1];

        // Skip if route format is invalid
        if (!publicMethod || !publicPath) {
            continue;
        }

        // Method must match
        if (publicMethod !== method.toUpperCase()) {
            continue;
        }

        // Check if path matches (with parameter support)
        if (matchesPattern(publicPath, normalizedPath)) {
            return true;
        }
    }

    return false;
}

/**
 * Get a list of all public routes for documentation purposes
 */
export function getPublicRoutes(): {
    ecommerce: string[];
    inventory: string[];
    all: string[];
} {
    return {
        ecommerce: ECOMMERCE_PUBLIC_ROUTES,
        inventory: INVENTORY_PUBLIC_ROUTES,
        all: ALL_PUBLIC_ROUTES,
    };
}
