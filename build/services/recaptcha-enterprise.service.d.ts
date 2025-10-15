/**
 * reCAPTCHA Enterprise Service
 * Handles reCAPTCHA Enterprise token verification
 */
interface CreateAssessmentParams {
    projectID?: string;
    recaptchaKey?: string;
    token?: string;
    recaptchaAction?: string;
}
export declare class RecaptchaEnterpriseService {
    private client;
    private projectID;
    private recaptchaKey;
    constructor();
    /**
     * Create an assessment to analyze the risk of a UI action.
     */
    createAssessment({ projectID, recaptchaKey, token, recaptchaAction, }: CreateAssessmentParams): Promise<{
        success: boolean;
        score?: number;
        message?: string;
    }>;
    /**
     * Verify reCAPTCHA token for OTP sending
     */
    verifyOTPToken(token: string): Promise<{
        success: boolean;
        score?: number;
        message?: string;
    }>;
    /**
     * Verify reCAPTCHA token for general actions
     */
    verifyActionToken(token: string, action: string): Promise<{
        success: boolean;
        score?: number;
        message?: string;
    }>;
}
export declare const recaptchaEnterpriseService: RecaptchaEnterpriseService;
export {};
//# sourceMappingURL=recaptcha-enterprise.service.d.ts.map