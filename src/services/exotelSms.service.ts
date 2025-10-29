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
    this.apiUrl = `https://${subdomain}.exotel.com/v1/Accounts/${EXOTEL_ACCOUNT_SID}/Sms/send`;
    
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
   * @returns Formatted phone number with country code
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    let formatted = phoneNumber.replace(/\D/g, '');
    
    // Handle various input formats
    if (formatted.length === 10) {
      // 10-digit Indian number
      formatted = '+91' + formatted;
    } else if (formatted.startsWith('91')) {
      // Already has country code without +
      formatted = '+' + formatted;
    } else if (formatted.startsWith('0')) {
      // Starts with 0 (Indian format)
      formatted = '+91' + formatted.substring(1);
    } else if (!formatted.startsWith('+')) {
      // Missing + prefix
      formatted = '+91' + formatted;
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
   * @param message - SMS message content (ONLY used as fallback when DLT template is not configured or fails)
   *                  When DLT template is configured, this message is NOT sent - only the template is used
   * @param otpCode - OTP code to use with DLT template variables (maps to {#var#} placeholder)
   * @returns Promise with send result
   */
  async sendOtp(phoneNumber: string, message: string, otpCode?: string): Promise<SendSmsResponse> {
    try {
      logger.info({ phoneNumber, messageLength: message.length, hasTemplate: !!EXOTEL_DLT_TEMPLATE_ID }, 'Attempting to send SMS via Exotel');

      // Format phone number for international SMS
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      logger.info({ originalNumber: phoneNumber, formattedNumber }, 'Phone number formatting for Exotel');

      // Prepare request payload
      const requestData: any = {
        From: EXOTEL_SENDER_ID,
        To: formattedNumber
      };

      // If DLT Template ID is configured, use template with variables
      if (EXOTEL_DLT_TEMPLATE_ID) {
        // Extract OTP from message if not provided directly
        const otp = otpCode || this.extractOtpFromMessage(message);
        
        if (otp) {
          // Set DLT Template ID (required)
          requestData.DLTTemplateId = EXOTEL_DLT_TEMPLATE_ID;
          
          // IMPORTANT: Entity ID comes from Sender ID settings (NOT from template)
          // Location: SMS Settings → Sender IDs → "Entity ID" column
          // The template's "DLT Entity ID" column may be empty (awaiting DLT approval) - that's okay
          // We use the Entity ID from the Sender ID row, which is linked to your DLT registration
          if (EXOTEL_ENTITY_ID && EXOTEL_ENTITY_ID.trim() !== '') {
            // Entity ID from Sender ID settings (required for DLT compliance)
            // This works even if template's Entity ID column is empty/pending approval
            requestData.DltEntityId = EXOTEL_ENTITY_ID;
            logger.debug({ 
              entityId: EXOTEL_ENTITY_ID,
              senderId: EXOTEL_SENDER_ID,
              note: 'Entity ID from Sender ID settings (works even if template Entity ID is pending approval)'
            }, 'Including DLT Entity ID from Sender ID');
          } else {
            // Entity ID should be configured from Sender ID settings
            logger.warn({ 
              senderId: EXOTEL_SENDER_ID,
              note: 'Entity ID not configured - should be set from SMS Settings → Sender IDs → Entity ID column. ' +
                    'Template Entity ID column can be empty (awaiting approval) - use Sender ID Entity ID instead.'
            }, 'DLT Entity ID missing - may cause template matching issues');
          }
          
          // Exotel DLT variables format - trying multiple formats
          // Format 1: JSON string (what we're trying now)
          // The placeholder {#var#} in template needs variable named "var"
          requestData.DLTVariables = JSON.stringify({ var: otp });
          
          // IMPORTANT: Exotel API REQUIRES Body parameter even when using DLT template
          // The Body parameter is mandatory, but Exotel will use the DLT template text
          // We include the message here as required by API, but template text takes precedence
          requestData.Body = message;
          
          logger.info({ 
            templateId: EXOTEL_DLT_TEMPLATE_ID,
            entityId: EXOTEL_ENTITY_ID || 'not configured',
            otpMasked: otp.replace(/./g, '*'),
            variableName: 'var',
            usingTemplate: true,
            variablesFormat: 'JSON string',
            hasBody: true,
            note: 'Body parameter included as required by Exotel API (template text takes precedence)'
          }, 'Using DLT template with OTP variable');
          
          logger.debug({
            dltVariables: requestData.DLTVariables,
            dltEntityId: requestData.DltEntityId
          }, 'DLT Variables payload');
        } else {
          // Fallback: If OTP extraction fails, use plain message
          logger.warn('DLT template configured but OTP could not be extracted - falling back to plain message');
          requestData.Body = message;
        }
      } else {
        // No DLT template configured - use plain message body
        requestData.Body = message;
        logger.debug('Using plain message body (no DLT template configured)');
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

      // Parse XML response to extract actual status
      let parsedResponse: any = response.data;
      let messageStatus = 'unknown';
      let detailedStatus = '';
      let detailedStatusCode = '';
      
      if (typeof response.data === 'string' && response.data.includes('<TwilioResponse>')) {
        // Parse XML response
        const statusMatch = response.data.match(/<Status>(.*?)<\/Status>/);
        const detailedStatusMatch = response.data.match(/<DetailedStatus>(.*?)<\/DetailedStatus>/);
        const detailedStatusCodeMatch = response.data.match(/<DetailedStatusCode>(.*?)<\/DetailedStatusCode>/);
        const bodyMatch = response.data.match(/<Body>(.*?)<\/Body>/);
        const sidMatch = response.data.match(/<Sid>(.*?)<\/Sid>/);
        const fromMatch = response.data.match(/<From>(.*?)<\/From>/);
        
        if (statusMatch && statusMatch[1]) messageStatus = statusMatch[1];
        if (detailedStatusMatch && detailedStatusMatch[1]) detailedStatus = detailedStatusMatch[1];
        if (detailedStatusCodeMatch && detailedStatusCodeMatch[1]) detailedStatusCode = detailedStatusCodeMatch[1];
        
        parsedResponse = {
          Status: messageStatus,
          DetailedStatus: detailedStatus || '',
          DetailedStatusCode: detailedStatusCode || '',
          Body: bodyMatch && bodyMatch[1] ? bodyMatch[1] : null,
          Sid: sidMatch && sidMatch[1] ? sidMatch[1] : null,
          From: fromMatch && fromMatch[1] ? fromMatch[1] : null,
          xml: response.data
        };
        
        // Check for DLT_TEMPLATE_NOT_FOUND error
        if (detailedStatus && detailedStatus.includes('DLT_TEMPLATE_NOT_FOUND')) {
          logger.error({
            detailedStatus: detailedStatus,
            detailedStatusCode: detailedStatusCode,
            templateId: EXOTEL_DLT_TEMPLATE_ID,
            entityId: EXOTEL_ENTITY_ID,
            senderId: EXOTEL_SENDER_ID,
            fromInResponse: parsedResponse.From,
            bodyReceived: parsedResponse.Body,
            critical: true,
            action: 'Verify in Exotel Dashboard: SMS Settings → SMS Templates → Check Template ID matches exactly. ' +
                   'Ensure Template Status is "Approved". Verify Sender ID "NIVNAA" is approved for DLT. ' +
                   'Check Entity ID matches Sender ID row in SMS Settings → Sender IDs.'
          }, '❌ DLT_TEMPLATE_NOT_FOUND - Template configuration mismatch');
        }
        
        // Check if DLT template was used (Body should match template, not our plain message)
        const bodyText = parsedResponse.Body || '';
        if (bodyText && EXOTEL_DLT_TEMPLATE_ID) {
          if (!bodyText.includes('Dear Customer') && !bodyText.includes('NIVAANA') && bodyText.includes('verification code')) {
            logger.warn({
              bodyReceived: bodyText,
              note: 'DLT template may not be applied - plain message body returned'
            }, 'Possible DLT template issue');
          }
        }
      }
      
      // Log full response for debugging
      logger.debug({
        responseStatus: response.status,
        parsedStatus: messageStatus,
        detailedStatus: detailedStatus,
        detailedStatusCode: detailedStatusCode,
        responseData: parsedResponse,
        responseHeaders: response.headers
      }, 'Exotel API full response');
      
      // Check message status - warn if queued for too long or failed
      if (messageStatus === 'queued' && detailedStatusCode === '21010') {
        logger.info({
          status: messageStatus,
          detailedStatus: detailedStatus,
          note: 'Message queued and pending operator processing (normal for DLT)'
        }, 'Exotel message queued');
      } else if (detailedStatus && detailedStatus.includes('NOT_FOUND') || detailedStatus.includes('FAILED')) {
        logger.error({
          status: messageStatus,
          detailedStatus: detailedStatus,
          detailedStatusCode: detailedStatusCode,
          responseData: parsedResponse
        }, 'Exotel message failed - DLT configuration issue');
      } else if (messageStatus !== 'sent' && messageStatus !== 'delivered' && messageStatus !== 'queued') {
        logger.warn({
          status: messageStatus,
          detailedStatus: detailedStatus,
          detailedStatusCode: detailedStatusCode,
          responseData: parsedResponse
        }, 'Exotel message may not be sent - check status');
      }

      logger.info({ 
        phoneNumber: formattedNumber, 
        messageId: response.data?.SMSMessage?.Sid,
        status: response.data?.SMSMessage?.Status,
        responseStatusCode: response.status,
        fullResponse: response.data
      }, 'Exotel SMS sent successfully');

      return {
        success: true,
        messageId: response.data?.SMSMessage?.Sid,
        status: response.data?.SMSMessage?.Status || 'queued',
        provider: 'exotel',
        exotelResponse: response.data
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

// Export for convenience, but use getExotelSmsService() if you need error handling
export const exotelSmsService = getExotelSmsService();

