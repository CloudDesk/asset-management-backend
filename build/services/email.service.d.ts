export declare class EmailService {
    private readonly transporter;
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
     * Send account deletion confirmation email with user data
     */
    sendAccountDeletionEmail(email: string, userName: string, userData: {
        orders: any[];
        orderlines: any[];
    }): Promise<void>;
    /**
     * Generate HTML template for account deletion email
     */
    private generateAccountDeletionEmailTemplate;
    /**
     * Generate plain text version for account deletion email
     */
    private generateAccountDeletionEmailText;
    /**
     * Test email connection
     */
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=email.service.d.ts.map