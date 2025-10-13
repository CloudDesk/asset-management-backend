import admin from 'firebase-admin';
/**
 * Firebase OTP Service
 * Handles Firebase phone authentication business logic
 */
export declare class FirebaseOTPService {
    /**
     * Validate phone number format (E.164)
     */
    validatePhoneNumber(phoneNumber: string): boolean;
    /**
     * Check rate limiting for phone number/IP
     */
    checkRateLimit(identifier: string): {
        isLimited: boolean;
        remainingAttempts: number;
    };
    /**
     * Record an OTP attempt
     */
    recordAttempt(identifier: string): void;
    /**
     * Clear rate limit attempts (on successful auth)
     */
    clearAttempts(identifier: string): void;
    /**
     * Verify Firebase ID token
     * Returns decoded token with user information
     */
    verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken>;
    /**
     * Create application session from Firebase token
     * Returns JWT token and user data
     */
    createSession(idToken: string): Promise<{
        ok: boolean;
        uid: string;
        phone: string;
        email?: string;
        token: string;
    }>;
    /**
     * Verify app session token
     * Returns decoded user data
     */
    verifySession(token: string): {
        uid: string;
        phone: string;
        email?: string;
        iat: number;
        exp: number;
    };
    /**
     * Get user from Firebase by UID
     */
    getUserByUID(uid: string): Promise<admin.auth.UserRecord>;
    /**
     * Optional: Create or update custom user claims in Firebase
     */
    setCustomClaims(uid: string, claims: Record<string, any>): Promise<void>;
    /**
     * Optional: Revoke Firebase refresh tokens (for logout)
     */
    revokeRefreshTokens(uid: string): Promise<void>;
}
//# sourceMappingURL=firebase-otp.service.d.ts.map