export declare class EmailService {
    private transporter;
    constructor();
    /**
     * Send password reset email
     */
    sendPasswordResetEmail(email: string, resetToken: string, userName?: string): Promise<void>;
    /**
     * Generate HTML template for password reset email
     */
    private generatePasswordResetEmailTemplate;
    /**
     * Generate plain text version for password reset email
     */
    private generatePasswordResetEmailText;
    /**
     * Send email verification (for future use)
     */
    sendEmailVerification(email: string, verificationToken: string, userName?: string): Promise<void>;
    /**
     * Test email connection
     */
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=email.service.d.ts.map