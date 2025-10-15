/**
 * JWT payload interface for Firebase OTP sessions
 */
export interface FirebaseJWTPayload {
    uid: string;
    phone: string;
    email?: string;
    iat: number;
    exp: number;
}
/**
 * Simple JWT implementation for Firebase OTP session management
 * Using HMAC-SHA256 for signing
 */
export declare class JWTService {
    private secret;
    private expiresIn;
    constructor(secret?: string, expiresIn?: number);
    /**
     * Create a session token (JWT) for Firebase authenticated user
     */
    sign(payload: {
        uid: string;
        phone: string;
        email?: string;
    }): string;
    /**
     * Verify and decode a JWT token
     */
    verify(token: string): FirebaseJWTPayload;
    /**
     * Base64URL encode a string
     */
    private base64urlEncode;
    /**
     * Base64URL decode a string
     */
    private base64urlDecode;
}
export declare const jwtService: JWTService;
//# sourceMappingURL=jwt.d.ts.map