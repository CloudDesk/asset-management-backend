/**
 * reCAPTCHA Enterprise Service
 * Handles reCAPTCHA Enterprise token verification
 */

import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

interface CreateAssessmentParams {
  projectID?: string;
  recaptchaKey?: string;
  token?: string;
  recaptchaAction?: string;
}

export class RecaptchaEnterpriseService {
  private client: RecaptchaEnterpriseServiceClient;
  private projectID: string;
  private recaptchaKey: string;

  constructor() {
    this.client = new RecaptchaEnterpriseServiceClient();
    this.projectID = process.env.FIREBASE_PROJECT_ID || 'docblitz-437213';
    this.recaptchaKey = process.env.RECAPTCHA_SITE_KEY || '6LcToegrAAAAADC2HsGmZGSn98A9B-565D-DOGok';
  }

  /**
   * Create an assessment to analyze the risk of a UI action.
   */
  async createAssessment({
    projectID = this.projectID,
    recaptchaKey = this.recaptchaKey,
    token,
    recaptchaAction,
  }: CreateAssessmentParams): Promise<{ success: boolean; score?: number; message?: string }> {
    try {
      if (!token) {
        return { success: false, message: 'Token is required' };
      }

      if (!recaptchaAction) {
        return { success: false, message: 'Action is required' };
      }

      const projectPath = this.client.projectPath(projectID);

      // Build the assessment request
      const request = {
        assessment: {
          event: {
            token: token,
            siteKey: recaptchaKey,
          },
        },
        parent: projectPath,
      };

      const [response] = await this.client.createAssessment(request);

      // Check if the token is valid
      if (!response.tokenProperties?.valid) {
        console.log(`The CreateAssessment call failed because the token was: ${response.tokenProperties?.invalidReason}`);
        return { 
          success: false, 
          message: `Invalid token: ${response.tokenProperties?.invalidReason}` 
        };
      }

      // Check if the expected action was executed
      if (response.tokenProperties.action === recaptchaAction) {
        // Get the risk score
        const score = response.riskAnalysis?.score || 0;
        
        console.log(`The reCAPTCHA score is: ${score}`);
        
        if (response.riskAnalysis?.reasons) {
          response.riskAnalysis.reasons.forEach((reason) => {
            console.log('Risk reason:', reason);
          });
        }

        // Consider score >= 0.5 as successful (you can adjust this threshold)
        const isSuccessful = score >= 0.5;
        
        return {
          success: isSuccessful,
          score,
          message: isSuccessful ? 'reCAPTCHA verification successful' : `Low score: ${score}`
        };
      } else {
        console.log("The action attribute in your reCAPTCHA tag does not match the action you are expecting to score");
        return { 
          success: false, 
          message: 'Action mismatch' 
        };
      }
    } catch (error) {
      console.error('reCAPTCHA Enterprise assessment error:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Verify reCAPTCHA token for OTP sending
   */
  async verifyOTPToken(token: string): Promise<{ success: boolean; score?: number; message?: string }> {
    return this.createAssessment({
      token,
      recaptchaAction: 'send_otp'
    });
  }

  /**
   * Verify reCAPTCHA token for general actions
   */
  async verifyActionToken(token: string, action: string): Promise<{ success: boolean; score?: number; message?: string }> {
    return this.createAssessment({
      token,
      recaptchaAction: action
    });
  }
}

export const recaptchaEnterpriseService = new RecaptchaEnterpriseService();
