interface SendSmsResponse {
    success: boolean;
    messageId?: string;
    status?: string;
    formattedNumber?: string;
    errorMessage?: string;
    infobipResponse?: any;
}
export declare class SmsService {
    /**
     * Send SMS using Infobip API
     * @param phoneNumber - Recipient phone number
     * @param message - SMS message content
     * @returns Promise with send result
     */
    sendOtp(phoneNumber: string, message: string): Promise<SendSmsResponse>;
    /**
     * Make HTTPS request to Infobip API
     * @param postData - JSON stringified request body
     * @returns Promise with Infobip response
     */
    private makeInfobipRequest;
}
export {};
//# sourceMappingURL=sms.service.d.ts.map