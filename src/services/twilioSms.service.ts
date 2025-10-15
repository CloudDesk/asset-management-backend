import twilio from 'twilio';
import { logger } from '../config/logger.js';

// Twilio Configuration (hardcoded as per requirement)
const TWILIO_ACCOUNT_SID = 'ACbec90816980e03561f55ad7974990aa8';
const TWILIO_AUTH_TOKEN = '3ed2c97fd12cbd109383f21e97e00b8d';
// Note: You need to get a Twilio phone number from your account or use the default
const TWILIO_PHONE_NUMBER = '+16205298067'; // Your Twilio phone number

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
    // Initialize Twilio client
    this.client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
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
      const messageOptions: { body: string; to: string; from?: string } = {
        body: message,
        to: formattedNumber
      };

      // Only add 'from' if we have a valid Twilio phone number
      if (TWILIO_PHONE_NUMBER) {
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
