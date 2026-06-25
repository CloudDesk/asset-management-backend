import axios from 'axios';
import qs from 'qs';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

// Exotel Configuration from environment variables
// IMPORTANT: These must be set in .env file for the service to work
const EXOTEL_ACCOUNT_SID = env.EXOTEL_ACCOUNT_SID;
const EXOTEL_API_KEY = env.EXOTEL_API_KEY;
const EXOTEL_API_TOKEN = env.EXOTEL_API_TOKEN;
const EXOTEL_SUBDOMAIN = env.EXOTEL_SUBDOMAIN || 'api';
const EXOTEL_SENDER_ID = env.EXOTEL_SENDER_ID;
const EXOTEL_DLT_TEMPLATE_ID = env.EXOTEL_DLT_TEMPLATE_ID;
const EXOTEL_ENTITY_ID = env.EXOTEL_ENTITY_ID;

interface SendSmsResponse {
  success: boolean;
  messageId?: string;
  status?: string;
  errorMessage?: string;
  provider: 'exotel';
  exotelResponse?: any;
}

export class ExotelSmsService {
  private apiUrl: string;
  private authHeader: string;

  constructor() {
    // Validate Exotel credentials before initialization
    if (!EXOTEL_ACCOUNT_SID || !EXOTEL_API_KEY || !EXOTEL_API_TOKEN || !EXOTEL_SENDER_ID) {
      const missingVars = [];
      if (!EXOTEL_ACCOUNT_SID) missingVars.push('EXOTEL_ACCOUNT_SID');
      if (!EXOTEL_API_KEY) missingVars.push('EXOTEL_API_KEY');
      if (!EXOTEL_API_TOKEN) missingVars.push('EXOTEL_API_TOKEN');
      if (!EXOTEL_SENDER_ID) missingVars.push('EXOTEL_SENDER_ID');
      
      throw new Error(
        `Missing required Exotel environment variables: ${missingVars.join(', ')}\n` +
        `Please add these to your .env file.`
      );
    }

    // Validate Account SID format (Exotel SIDs may have different formats)
    if (!EXOTEL_ACCOUNT_SID || EXOTEL_ACCOUNT_SID.length < 10) {
      throw new Error(
        `Invalid EXOTEL_ACCOUNT_SID format.\n` +
        `Current value: '${EXOTEL_ACCOUNT_SID}'\n` +
        `Please check your .env file.`
      );
    }

    // Build API URL
    // Handle case where EXOTEL_SUBDOMAIN might already include ".exotel.com"
    let subdomain = EXOTEL_SUBDOMAIN || 'api';
    if (subdomain.includes('.exotel.com')) {
      // Remove .exotel.com if already included
      subdomain = subdomain.replace('.exotel.com', '');
    }
    // Use .json endpoint for JSON response format
    this.apiUrl = `https://${subdomain}.exotel.com/v1/Accounts/${EXOTEL_ACCOUNT_SID}/Sms/send.json`;
    
    logger.debug({
      subdomain: subdomain,
      finalUrl: this.apiUrl.replace(EXOTEL_ACCOUNT_SID, '***')
    }, 'Exotel API URL constructed');

    // Create Basic Auth header
    const credentials = `${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`;
    this.authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

    try {
      logger.info('Exotel SMS service initialized successfully');
      logger.debug({
        subdomain: EXOTEL_SUBDOMAIN,
        accountSid: EXOTEL_ACCOUNT_SID.substring(0, 8) + '...',
        senderId: EXOTEL_SENDER_ID
      }, 'Exotel configuration loaded');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to initialize Exotel client');
      throw new Error(
        `Failed to initialize Exotel: ${error.message}\n` +
        `Please verify your Exotel credentials in .env file.`
      );
    }
  }

  /**
   * Format phone number for Exotel API
   * @param phoneNumber - Phone number in any format
   * @param includeCountryCode - Whether to include country code (default: false for Exotel)
   * @returns Formatted phone number (10 digits for Indian numbers)
   */
  private formatPhoneNumber(phoneNumber: string, includeCountryCode: boolean = false): string {
    // Remove any non-digit characters
    let formatted = phoneNumber.replace(/\D/g, '');
    
    // Handle various input formats
    if (formatted.length === 10) {
      // 10-digit Indian number - return as is for Exotel
      return formatted;
    } else if (formatted.startsWith('91') && formatted.length === 12) {
      // Has country code 91 - remove it
      formatted = formatted.substring(2);
    } else if (formatted.startsWith('0') && formatted.length === 11) {
      // Starts with 0 (Indian format) - remove leading 0
      formatted = formatted.substring(1);
    } else if (formatted.startsWith('+91')) {
      // Has +91 prefix - remove it
      formatted = formatted.substring(3);
    }
    
    // For Exotel, return 10-digit number without country code
    // Based on curl example: To="9994824573" (no country code)
    if (includeCountryCode && formatted.length === 10) {
      return '+91' + formatted;
    }
    
    return formatted;
  }

  /**
   * Extract OTP code from message text
   * @param message - Message containing OTP
   * @returns OTP code if found, null otherwise
   */
  private extractOtpFromMessage(message: string): string | null {
    // Try to extract 6-digit OTP from common message patterns
    // Pattern 1: "code is: 123456"
    const patterns = [
      /code is[:\s]+(\d{6})/i,
      /OTP is[:\s]+(\d{6})/i,
      /verification code is[:\s]+(\d{6})/i,
      /(\d{6})/ // Fallback: any 6-digit number
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Send SMS using Exotel API
   * @param phoneNumber - Recipient phone number
   * @param message - SMS message content with OTP placeholder (will be replaced with actual OTP)
   * @param otpCode - OTP code to bind into the message body
   * @returns Promise with send result
   */
  async sendOtp(phoneNumber: string, message: string, otpCode?: string): Promise<SendSmsResponse> {
    try {
      logger.info({ phoneNumber, messageLength: message.length, hasOtp: !!otpCode }, 'Attempting to send SMS via Exotel');

      // Format phone number for Exotel (10 digits, no country code)
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      logger.info({ originalNumber: phoneNumber, formattedNumber }, 'Phone number formatting for Exotel');

      // Prepare message body with OTP bound in
      let messageBody = message;
      if (otpCode) {
        // Replace OTP placeholder in message with actual OTP
        // Strategy: Replace OTP in context (after "is", ":", or placeholder patterns)
        
        // First, try placeholder patterns
        messageBody = messageBody.replace(/\{otp\}/gi, otpCode);
        messageBody = messageBody.replace(/\{OTP\}/gi, otpCode);
        
        // Then, replace OTP in context (e.g., "is 1234" -> "is {actualOTP}")
        // Match pattern: "is " followed by 4-digit number (for Exotel) or 6-digit (for Twilio)
        const otpLength = otpCode.length;
        if (otpLength === 4) {
          // Exotel: 4-digit OTP - replace "is 1234" pattern
          messageBody = messageBody.replace(/\bis\s+\d{4}\b/i, `is ${otpCode}`);
          // Also replace standalone 4-digit number if placeholder wasn't found
          if (!messageBody.includes(otpCode)) {
            messageBody = messageBody.replace(/\b\d{4}\b/, otpCode);
          }
        } else if (otpLength === 6) {
          // Twilio: 6-digit OTP - replace "is 123456" pattern
          messageBody = messageBody.replace(/\bis\s+\d{6}\b/i, `is ${otpCode}`);
          // Also replace standalone 6-digit number if placeholder wasn't found
          if (!messageBody.includes(otpCode)) {
            messageBody = messageBody.replace(/\b\d{6}\b/, otpCode);
          }
        }
        
        logger.debug({ 
          originalMessage: message.substring(0, 100) + '...', // Truncate for logs
          otpLength: otpCode.length,
          finalMessage: messageBody.substring(0, 100) + '...' // Truncate for logs
        }, 'OTP bound into message body');
      }

      // Prepare request payload (form data format)
      // Format: From, To, Body (as per curl example)
      const requestData: any = {
        From: EXOTEL_SENDER_ID,
        To: formattedNumber,
        Body: messageBody
      };

      // Optional: If DLT Template ID is configured, add DLT parameters
      // This is for DLT compliance but the Body with OTP will still be sent
      if (EXOTEL_DLT_TEMPLATE_ID && otpCode) {
        requestData.DLTTemplateId = EXOTEL_DLT_TEMPLATE_ID;
        
        if (EXOTEL_ENTITY_ID && EXOTEL_ENTITY_ID.trim() !== '') {
          requestData.DltEntityId = EXOTEL_ENTITY_ID;
          logger.debug({ 
            entityId: EXOTEL_ENTITY_ID,
            senderId: EXOTEL_SENDER_ID
          }, 'Including DLT Entity ID');
        }
        
        // DLT variables for template (if template uses {#var#} placeholder)
        requestData.DLTVariables = JSON.stringify({ var: otpCode });
        
        logger.info({ 
          templateId: EXOTEL_DLT_TEMPLATE_ID,
          usingDltTemplate: true,
          note: 'DLT template configured - Body message will be sent with DLT compliance'
        }, 'Using DLT template (Body message still sent)');
      } else {
        logger.debug('Sending plain message body with OTP bound in');
      }

      // Convert to URL-encoded format
      const urlEncodedData = qs.stringify(requestData);
      
      // Log the request payload for debugging (without sensitive OTP)
      logger.debug({
        url: this.apiUrl,
        payload: {
          ...requestData,
          DLTVariables: requestData.DLTVariables ? 
            JSON.stringify(JSON.parse(requestData.DLTVariables)).replace(/[0-9]/g, '*') : 
            undefined,
          Body: requestData.Body ? requestData.Body.replace(/\d{6}/, '******') : undefined
        },
        urlEncodedLength: urlEncodedData.length
      }, 'Exotel API request payload');
      
      // Log actual URL-encoded data for debugging (with OTP masked)
      logger.debug({
        urlEncodedData: urlEncodedData.replace(/var["\:]*(\d{6})/g, 'var":"******')
      }, 'URL-encoded request data (masked)');

      // Send SMS via Exotel API
      const response = await axios.post(this.apiUrl, urlEncodedData, {
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      // Parse response (JSON format from .json endpoint)
      let parsedResponse: any = response.data;
      let messageStatus = 'unknown';
      let messageId = null;
      
      // Handle JSON response from .json endpoint
      if (response.data && typeof response.data === 'object') {
        // JSON response format
        if (response.data.SMSMessage) {
          messageStatus = response.data.SMSMessage.Status || 'unknown';
          messageId = response.data.SMSMessage.Sid;
        } else if (response.data.Status) {
          messageStatus = response.data.Status;
          messageId = response.data.Sid;
        } else {
          // Direct response object
          messageStatus = response.data.status || response.data.Status || 'queued';
          messageId = response.data.sid || response.data.Sid || response.data.messageId;
        }
        
        parsedResponse = response.data;
      } else if (typeof response.data === 'string' && response.data.includes('<TwilioResponse>')) {
        // Fallback: XML response (for backward compatibility)
        // Parse XML response
        const statusMatch = response.data.match(/<Status>(.*?)<\/Status>/);
        const detailedStatusMatch = response.data.match(/<DetailedStatus>(.*?)<\/DetailedStatus>/);
        const detailedStatusCodeMatch = response.data.match(/<DetailedStatusCode>(.*?)<\/DetailedStatusCode>/);
        const bodyMatch = response.data.match(/<Body>(.*?)<\/Body>/);
        const sidMatch = response.data.match(/<Sid>(.*?)<\/Sid>/);
        const fromMatch = response.data.match(/<From>(.*?)<\/From>/);
        
        if (statusMatch && statusMatch[1]) messageStatus = statusMatch[1];
        if (sidMatch && sidMatch[1]) messageId = sidMatch[1];
        
        parsedResponse = {
          Status: messageStatus,
          DetailedStatus: detailedStatusMatch && detailedStatusMatch[1] ? detailedStatusMatch[1] : '',
          DetailedStatusCode: detailedStatusCodeMatch && detailedStatusCodeMatch[1] ? detailedStatusCodeMatch[1] : '',
          Body: bodyMatch && bodyMatch[1] ? bodyMatch[1] : null,
          Sid: messageId,
          From: fromMatch && fromMatch[1] ? fromMatch[1] : null,
          xml: response.data
        };
      }
      
      // Log full response for debugging
      logger.debug({
        responseStatus: response.status,
        parsedStatus: messageStatus,
        messageId: messageId,
        responseData: parsedResponse,
        responseHeaders: response.headers
      }, 'Exotel API full response');
      
      // Check message status
      if (messageStatus === 'queued' || messageStatus === 'sent' || messageStatus === 'delivered') {
        logger.info({
          status: messageStatus,
          messageId: messageId,
          phoneNumber: formattedNumber
        }, 'Exotel message sent successfully');
      } else if (messageStatus === 'failed' || messageStatus === 'undelivered') {
        logger.error({
          status: messageStatus,
          messageId: messageId,
          responseData: parsedResponse
        }, 'Exotel message failed');
      } else {
        logger.warn({
          status: messageStatus,
          messageId: messageId,
          responseData: parsedResponse
        }, 'Exotel message status unknown - check response');
      }

      logger.info({ 
        phoneNumber: formattedNumber, 
        messageId: messageId,
        status: messageStatus,
        responseStatusCode: response.status
      }, 'Exotel SMS sent successfully');

      return {
        success: true,
        messageId: messageId || parsedResponse?.Sid || parsedResponse?.sid,
        status: messageStatus || 'queued',
        provider: 'exotel',
        exotelResponse: parsedResponse
      };

    } catch (error: any) {
      // Handle different error types
      if (error.response) {
        // API returned error response
        const statusCode = error.response.status;
        let errorData = error.response.data;
        
        // Parse XML error response (Exotel sometimes returns XML)
        let errorMessage = error.message;
        if (typeof errorData === 'string' && errorData.includes('<TwilioResponse>')) {
          // Extract error message from XML
          const messageMatch = errorData.match(/<Message>(.*?)<\/Message>/);
          const codeMatch = errorData.match(/<Code>(.*?)<\/Code>/);
          
          if (messageMatch) {
            errorMessage = messageMatch[1];
            errorData = {
              message: messageMatch[1],
              code: codeMatch ? codeMatch[1] : null,
              xml: errorData
            };
          }
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        }
        
        logger.error({ 
          error: errorData,
          phoneNumber,
          statusCode,
          errorMessage: errorMessage,
          parsedMessage: errorData?.message
        }, 'Error sending SMS via Exotel API');
        
        return {
          success: false,
          errorMessage: this.getErrorMessage(statusCode, errorData) || errorMessage || 'Failed to send SMS via Exotel',
          provider: 'exotel',
          exotelResponse: errorData
        };
      } else if (error.request) {
        // Request made but no response received
        logger.error({ 
          error: error.message,
          phoneNumber
        }, 'Exotel API request timeout or network error');
        
        return {
          success: false,
          errorMessage: 'Network error: Could not reach Exotel API',
          provider: 'exotel'
        };
      } else {
        // Error setting up request
        logger.error({ 
          error: error.message,
          phoneNumber
        }, 'Error setting up Exotel API request');
        
        return {
          success: false,
          errorMessage: error.message || 'Failed to send SMS via Exotel',
          provider: 'exotel'
        };
      }
    }
  }

  /**
   * Get user-friendly error message from Exotel error response
   */
  private getErrorMessage(statusCode: number, errorData: any): string {
    // Extract actual error message from Exotel response
    const actualMessage = errorData?.message || errorData?.Message || '';
    
    switch (statusCode) {
      case 400:
        // Return the actual error message from Exotel if available
        if (actualMessage && !actualMessage.includes('Request failed')) {
          return actualMessage;
        }
        return 'Invalid request parameters. Please check phone number, DLT template ID, and variable format.';
      case 401:
        return 'Authentication failed. Please verify Exotel API credentials.';
      case 403:
        return 'Access forbidden. Please check your Exotel account permissions.';
      case 404:
        return 'Exotel API endpoint not found. Please verify API URL configuration.';
      case 429:
        return 'Too many requests. Please try again after some time.';
      case 503:
        return 'Exotel service temporarily unavailable. Please try again later.';
      default:
        return errorData?.message || `Exotel API error: ${statusCode}`;
    }
  }

  /**
   * Check Exotel account balance (if supported by API)
   */
  async checkAccountBalance(): Promise<any> {
    try {
      // Note: Exotel may use different endpoint for balance
      // Check Exotel documentation for balance API endpoint
      logger.warn('Account balance check not implemented. Check Exotel documentation.');
      return {
        success: false,
        error: 'Balance check not available in current implementation'
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error checking Exotel account balance');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get Exotel account info
   */
  async getAccountInfo(): Promise<any> {
    try {
      // Note: Exotel may use different endpoint for account info
      // Check Exotel documentation for account info API endpoint
      logger.warn('Account info check not implemented. Check Exotel documentation.');
      return {
        success: false,
        error: 'Account info not available in current implementation'
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting Exotel account info');
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Lazy initialization to avoid errors if env vars are not set
let exotelSmsServiceInstance: ExotelSmsService | null = null;

export const getExotelSmsService = (): ExotelSmsService => {
  if (!exotelSmsServiceInstance) {
    exotelSmsServiceInstance = new ExotelSmsService();
  }
  return exotelSmsServiceInstance;
};

// Export for convenience while preserving lazy initialization.
export const exotelSmsService = new Proxy({} as ExotelSmsService, {
  get(_target, property) {
    const service = getExotelSmsService();
    const value = service[property as keyof ExotelSmsService];

    if (typeof value === 'function') {
      return value.bind(service);
    }

    return value;
  }
});
