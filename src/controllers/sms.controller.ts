import { FastifyRequest, FastifyReply } from 'fastify';
import { SmsService } from '../services/sms.service.js';
import { TwilioSmsService } from '../services/twilioSms.service.js';
import { sendOtpSchema, SendOtpInput } from '../schemas/sms.schema.js';
import { createSuccessResponse, createErrorResponse, asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';

export class SmsController {
  private smsService = new SmsService();
  private twilioSmsService = new TwilioSmsService();

  /**
   * Send OTP SMS to phone number (Infobip)
   * POST /v1/sms/send-otp
   */
  sendOtp = asyncHandler(
    async (
      request: FastifyRequest<{ Body: SendOtpInput }>,
      reply: FastifyReply
    ) => {
      // Validate request body
      const { phoneNumber, message } = sendOtpSchema.parse(request.body);

      logger.info({ phoneNumber }, 'SMS OTP send request received');

      // Send SMS via Infobip service
      const result = await this.smsService.sendOtp(phoneNumber, message);

      if (result.success) {
        const response = createSuccessResponse(
          'SMS sent successfully via Infobip',
          {
            phoneNumber,
            messageId: result.messageId,
            status: result.status,
            provider: 'infobip',
            sentAt: new Date().toISOString()
          }
        );
        
        logger.info({ 
          phoneNumber, 
          messageId: result.messageId,
          provider: 'infobip'
        }, 'SMS sent successfully via Infobip');
        
        return reply.code(200).send(response);
      } else {
        const errorResponse = createErrorResponse(
          'Failed to send SMS via Infobip',
          result.errorMessage || 'Unknown error occurred',
          500
        );
        
        logger.error({ 
          phoneNumber, 
          error: result.errorMessage,
          provider: 'infobip'
        }, 'Failed to send SMS via Infobip');
        
        return reply.code(500).send(errorResponse);
      }
    }
  );

  /**
   * Send OTP SMS via Twilio
   * POST /v1/sms/send-otp-twilio
   */
  sendOtpTwilio = asyncHandler(
    async (
      request: FastifyRequest<{ Body: SendOtpInput }>,
      reply: FastifyReply
    ) => {
      // Validate request body
      const { phoneNumber, message } = sendOtpSchema.parse(request.body);

      logger.info({ phoneNumber }, 'SMS OTP send request received (Twilio)');

      // Send SMS via Twilio service
      const result = await this.twilioSmsService.sendOtp(phoneNumber, message);

      if (result.success) {
        const response = createSuccessResponse(
          'SMS sent successfully via Twilio',
          {
            phoneNumber,
            messageId: result.messageId,
            status: result.status,
            provider: 'twilio',
            sentAt: new Date().toISOString()
          }
        );
        
        logger.info({ 
          phoneNumber, 
          messageId: result.messageId,
          provider: 'twilio'
        }, 'SMS sent successfully via Twilio');
        
        return reply.code(200).send(response);
      } else {
        const errorResponse = createErrorResponse(
          'Failed to send SMS via Twilio',
          result.errorMessage || 'Unknown error occurred',
          500
        );
        
        logger.error({ 
          phoneNumber, 
          error: result.errorMessage,
          provider: 'twilio'
        }, 'Failed to send SMS via Twilio');
        
        return reply.code(500).send(errorResponse);
      }
    }
  );

  /**
   * Send OTP SMS with fallback (try Twilio if Infobip fails)
   * POST /v1/sms/send-otp-with-fallback
   */
  sendOtpWithFallback = asyncHandler(
    async (
      request: FastifyRequest<{ Body: SendOtpInput }>,
      reply: FastifyReply
    ) => {
      // Validate request body
      const { phoneNumber, message } = sendOtpSchema.parse(request.body);

      logger.info({ phoneNumber }, 'SMS OTP send request with fallback');

      // Try Infobip first
      let result = await this.smsService.sendOtp(phoneNumber, message);
      
      if (result.success) {
        const response = createSuccessResponse(
          'SMS sent successfully via Infobip',
          {
            phoneNumber,
            messageId: result.messageId,
            status: result.status,
            provider: 'infobip',
            sentAt: new Date().toISOString()
          }
        );
        
        logger.info({ 
          phoneNumber, 
          messageId: result.messageId,
          provider: 'infobip'
        }, 'SMS sent successfully via Infobip (fallback method)');
        
        return reply.code(200).send(response);
      }

      // If Infobip fails, try Twilio
      logger.info({ phoneNumber }, 'Infobip failed, trying Twilio fallback');
      result = await this.twilioSmsService.sendOtp(phoneNumber, message);

      if (result.success) {
        const response = createSuccessResponse(
          'SMS sent successfully via Twilio (fallback)',
          {
            phoneNumber,
            messageId: result.messageId,
            status: result.status,
            provider: 'twilio',
            fallbackUsed: true,
            sentAt: new Date().toISOString()
          }
        );
        
        logger.info({ 
          phoneNumber, 
          messageId: result.messageId,
          provider: 'twilio',
          fallbackUsed: true
        }, 'SMS sent successfully via Twilio fallback');
        
        return reply.code(200).send(response);
      } else {
        const errorResponse = createErrorResponse(
          'Failed to send SMS via both providers',
          `Infobip: ${result.errorMessage || 'Unknown error'}, Twilio: ${result.errorMessage || 'Unknown error'}`,
          500
        );
        
        logger.error({ 
          phoneNumber, 
          infobipError: 'Failed',
          twilioError: result.errorMessage
        }, 'Failed to send SMS via both Infobip and Twilio');
        
        return reply.code(500).send(errorResponse);
      }
    }
  );
}

