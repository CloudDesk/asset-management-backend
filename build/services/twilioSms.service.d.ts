interface SendSmsResponse {
    success: boolean;
    messageId?: string;
    status?: string;
    errorMessage?: string;
    provider: 'twilio';
    twilioResponse?: any;
}
export declare class TwilioSmsService {
    private client;
    constructor();
    /**
     * Send SMS using Twilio API
     * @param phoneNumber - Recipient phone number
     * @param message - SMS message content
     * @returns Promise with send result
     */
    sendOtp(phoneNumber: string, message: string): Promise<SendSmsResponse>;
    /**
     * Check Twilio account balance
     */
    checkAccountBalance(): Promise<any>;
    /**
     * Get Twilio account info
     */
    getAccountInfo(): Promise<any>;
}
export {};
//# sourceMappingURL=twilioSms.service.d.ts.map