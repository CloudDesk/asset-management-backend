import https from 'https';
import { logger } from '../config/logger.js';

// Infobip API Configuration (hardcoded as per requirement)
const INFOBIP_API_KEY = 'App b87f14fb04a90291e48aee9c8d90ad98-edc7eee8-aa49-4917-b50f-3f3b45020ef7';
const INFOBIP_BASE_URL = 'ypnlnd.api.infobip.com';
const INFOBIP_SMS_ENDPOINT = '/sms/2/text/advanced';

interface SendSmsResponse {
  success: boolean;
  messageId?: string;
  status?: string;
  errorMessage?: string;
  infobipResponse?: any;
}

export class SmsService {
  /**
   * Send SMS using Infobip API
   * @param phoneNumber - Recipient phone number
   * @param message - SMS message content
   * @returns Promise with send result
   */
  async sendOtp(phoneNumber: string, message: string): Promise<SendSmsResponse> {
    try {
      logger.info({ phoneNumber, messageLength: message.length }, 'Attempting to send SMS via Infobip');

      // Format phone number for international SMS
      let formattedNumber = phoneNumber;
      
      // Remove any non-digit characters
      formattedNumber = formattedNumber.replace(/\D/g, '');
      
      // Add country code if missing (assuming India +91)
      if (formattedNumber.length === 10) {
        formattedNumber = '91' + formattedNumber;
      } else if (formattedNumber.startsWith('0')) {
        formattedNumber = '91' + formattedNumber.substring(1);
      }
      
      logger.info({ originalNumber: phoneNumber, formattedNumber }, 'Phone number formatting');

      // Prepare request payload for Infobip SMS API
      const postData = JSON.stringify({
        messages: [
          {
            // Remove sender ID to use default
            destinations: [
              {
                to: formattedNumber
              }
            ],
            text: message
          }
        ]
      });

      // Make HTTPS request to Infobip
      const infobipResponse = await this.makeInfobipRequest(postData);

      logger.info({ 
        phoneNumber, 
        response: infobipResponse 
      }, 'Infobip SMS API response received');

      // Parse Infobip response
      if (infobipResponse.messages && infobipResponse.messages.length > 0) {
        const messageResult = infobipResponse.messages[0];
        
        return {
          success: messageResult.status?.groupId === 1, // groupId 1 = PENDING (successfully sent)
          messageId: messageResult.messageId,
          status: messageResult.status?.name || messageResult.status?.description,
          formattedNumber: formattedNumber,
          infobipResponse: infobipResponse
        };
      }

      // If no messages in response
      return {
        success: false,
        errorMessage: 'No messages in Infobip response',
        infobipResponse: infobipResponse
      };

    } catch (error: any) {
      logger.error({ 
        error: error.message, 
        phoneNumber 
      }, 'Error sending SMS via Infobip');
      
      return {
        success: false,
        errorMessage: error.message || 'Failed to send SMS'
      };
    }
  }

  /**
   * Make HTTPS request to Infobip API
   * @param postData - JSON stringified request body
   * @returns Promise with Infobip response
   */
  private makeInfobipRequest(postData: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        hostname: INFOBIP_BASE_URL,
        path: INFOBIP_SMS_ENDPOINT,
        headers: {
          'Authorization': INFOBIP_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000 // 10 seconds timeout
      };

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const responseText = body.toString();

          try {
            const jsonResponse = JSON.parse(responseText);
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(jsonResponse);
            } else {
              reject(new Error(`Infobip API error: ${res.statusCode} - ${responseText}`));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse Infobip response: ${responseText}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout - Infobip API did not respond in time'));
      });

      req.write(postData);
      req.end();
    });
  }
}

