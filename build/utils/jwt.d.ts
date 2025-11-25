export interface JWTPayload {
    userId: number;
    email: string;
    roleId?: number | undefined;
    iat?: number;
    exp?: number;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
/**
 * Generate JWT access token
 * Short-lived token for API requests
 */
export declare function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string;
/**
 * Generate JWT refresh token
 * Long-lived token for refreshing access tokens
 */
export declare function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string;
/**
 * Generate both access and refresh tokens
 */
export declare function generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): TokenPair;
/**
 * Verify and decode JWT token
 * Returns decoded payload or throws error
 */
export declare function verifyToken(token: string): JWTPayload;
/**
 * Refresh access token (generate new access token from refresh token)
 * Optionally extends refresh token expiry if JWT_REFRESH_ON_USE is true
 */
export declare function refreshAccessToken(refreshToken: string): TokenPair;
/**
 * Decode token without verification (for debugging)
 */
export declare function decodeToken(token: string): JWTPayload | null;
//# sourceMappingURL=jwt.d.ts.map