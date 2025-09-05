export declare const PASSWORD_RULES: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
};
/**
 * Hash a password using bcrypt with secure salt rounds
 */
export declare function hashPassword(password: string): Promise<string>;
/**
 * Verify a password against its hash
 */
export declare function verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
/**
 * Validate password strength according to security rules
 */
export declare function validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
};
/**
 * Generate a secure session token for authentication
 */
export declare function generateSessionToken(): string;
/**
 * Generate a secure reset token for password recovery
 */
export declare function generateResetToken(): {
    token: string;
    hashedToken: string;
    expiresAt: Date;
};
/**
 * Verify a reset token
 */
export declare function verifyResetToken(token: string, hashedToken: string, expiresAt: Date): boolean;
/**
 * Generate a unique username if email-based username already exists
 */
export declare function generateUniqueUsername(baseUsername: string, existingUsernames: string[]): string;
/**
 * Sanitize user data for API responses (remove sensitive fields)
 */
export declare function sanitizeUserData(user: any): any;
/**
 * Rate limiting helper for authentication attempts
 */
export declare class AuthRateLimit {
    private attempts;
    private readonly maxAttempts;
    private readonly windowMs;
    constructor(maxAttempts?: number, windowMs?: number);
    /**
     * Check if an identifier (email/IP) is rate limited
     */
    isRateLimited(identifier: string): boolean;
    /**
     * Record a failed attempt
     */
    recordAttempt(identifier: string): void;
    /**
     * Clear attempts for an identifier (on successful login)
     */
    clearAttempts(identifier: string): void;
    /**
     * Get remaining attempts
     */
    getRemainingAttempts(identifier: string): number;
}
export declare const authRateLimit: AuthRateLimit;
//# sourceMappingURL=auth.d.ts.map