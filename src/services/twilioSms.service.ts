import twilio from 'twilio';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

// Twilio Configuration from environment variables
// IMPORTANT: These must be set in .env file for the service to work
const TWILIO_ACCOUNT_SID = env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = env.TWILIO_PHONE_NUMBER;

interface SendSmsResponse {
  success: boolean;
  messageId?: string;
  status?: string;
  errorMessage?: string;
  provider: 'twilio';
  twilioResponse?: any;
}

export class TwilioSmsService {
  private client: twilio.Twilio;

  constructor() {
    // Validate Twilio credentials before initialization
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      const missingVars = [];
      if (!TWILIO_ACCOUNT_SID) missingVars.push('TWILIO_ACCOUNT_SID');
      if (!TWILIO_AUTH_TOKEN) missingVars.push('TWILIO_AUTH_TOKEN');
      if (!TWILIO_PHONE_NUMBER) missingVars.push('TWILIO_PHONE_NUMBER');
      
      throw new Error(
        `Missing required Twilio environment variables: ${missingVars.join(', ')}\n` +
        `Please add these to your .env file. See QUICK_ENV_SETUP.md for details.`
      );
    }

    // Validate Account SID format
    if (!TWILIO_ACCOUNT_SID.startsWith('AC')) {
      throw new Error(
        `Invalid TWILIO_ACCOUNT_SID format. It must start with 'AC'.\n` +
        `Current value: '${TWILIO_ACCOUNT_SID}'\n` +
        `Please check your .env file.`
      );
    }

    try {
      // Initialize Twilio client
      this.client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      logger.info('Twilio SMS service initialized successfully');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to initialize Twilio client');
      throw new Error(
        `Failed to initialize Twilio: ${error.message}\n` +
        `Please verify your Twilio credentials in .env file.`
      );
    }
  }

  /**
   * Send SMS using Twilio API
   * @param phoneNumber - Recipient phone number
   * @param message - SMS message content
   * @returns Promise with send result
   */
  async sendOtp(phoneNumber: string, message: string): Promise<SendSmsResponse> {
    try {
      logger.info({ phoneNumber, messageLength: message.length }, 'Attempting to send SMS via Twilio');

      // Format phone number for international SMS
      let formattedNumber = phoneNumber;
      
      // Remove any non-digit characters
      formattedNumber = formattedNumber.replace(/\D/g, '');
      
      // Add country code if missing (assuming India +91)
      if (formattedNumber.length === 10) {
        formattedNumber = '+91' + formattedNumber;
      } else if (formattedNumber.startsWith('91')) {
        formattedNumber = '+' + formattedNumber;
      } else if (formattedNumber.startsWith('0')) {
        formattedNumber = '+91' + formattedNumber.substring(1);
      } else if (!formattedNumber.startsWith('+')) {
        formattedNumber = '+91' + formattedNumber;
      }
      
      logger.info({ originalNumber: phoneNumber, formattedNumber }, 'Phone number formatting for Twilio');

      // Send SMS via Twilio
      const messageOptions: { body: string; to: string; from?: string; messagingServiceSid?: string } = {
        body: message,
        to: formattedNumber
      };

      // Use Messaging Service SID if available, otherwise use phone number
      const MESSAGING_SERVICE_SID = env.TWILIO_MESSAGING_SERVICE_SID;
      
      if (MESSAGING_SERVICE_SID) {
        messageOptions.messagingServiceSid = MESSAGING_SERVICE_SID;
      } else if (TWILIO_PHONE_NUMBER) {
        messageOptions.from = TWILIO_PHONE_NUMBER;
      }

      const twilioResponse = await this.client.messages.create(messageOptions);

      logger.info({ 
        phoneNumber: formattedNumber, 
        messageSid: twilioResponse.sid,
        status: twilioResponse.status 
      }, 'Twilio SMS sent successfully');

      return {
        success: true,
        messageId: twilioResponse.sid,
        status: twilioResponse.status,
        provider: 'twilio',
        twilioResponse: {
          sid: twilioResponse.sid,
          status: twilioResponse.status,
          from: twilioResponse.from,
          to: twilioResponse.to,
          body: twilioResponse.body,
          dateCreated: twilioResponse.dateCreated,
          dateUpdated: twilioResponse.dateUpdated,
          price: twilioResponse.price,
          priceUnit: twilioResponse.priceUnit
        }
      };

    } catch (error: any) {
      logger.error({ 
        error: error.message, 
        phoneNumber,
        errorCode: error.code,
        errorStatus: error.status
      }, 'Error sending SMS via Twilio');
      
      return {
        success: false,
        errorMessage: error.message || 'Failed to send SMS via Twilio',
        provider: 'twilio',
        twilioResponse: {
          error: error.message,
          code: error.code,
          status: error.status
        }
      };
    }
  }

  /**
   * Check Twilio account balance
   */
  async checkAccountBalance(): Promise<any> {
    try {
      const balance = await this.client.balance.fetch();
      return {
        success: true,
        balance: balance.balance,
        currency: balance.currency,
        accountSid: balance.accountSid
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error checking Twilio account balance');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get Twilio account info
   */
  async getAccountInfo(): Promise<any> {
    try {
      const account = await this.client.api.accounts(TWILIO_ACCOUNT_SID).fetch();
      return {
        success: true,
        account: {
          sid: account.sid,
          friendlyName: account.friendlyName,
          status: account.status,
          type: account.type,
          dateCreated: account.dateCreated,
          dateUpdated: account.dateUpdated
        }
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting Twilio account info');
      return {
        success: false,
        error: error.message
      };
    }
  }
}
