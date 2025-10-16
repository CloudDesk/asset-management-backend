import { SmsService } from '../services/sms.service.js';
import { TwilioSmsService } from '../services/twilioSms.service.js';
import { sendOtpSchema } from '../schemas/sms.schema.js';
import { sendOtpSchema as otpSendSchema, verifyOtpSchema } from '../schemas/otp.schema.js';
import { otpService } from '../services/otp.service.js';
import { createSuccessResponse, createErrorResponse, asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
export class SmsController {
    smsService = new SmsService();
    twilioSmsService = new TwilioSmsService();
    /**
     * Send OTP SMS to phone number (Infobip)
     * POST /v1/sms/send-otp
     */
    sendOtp = asyncHandler(async (request, reply) => {
        // Validate request body
        const { phoneNumber, message } = sendOtpSchema.parse(request.body);
        logger.info({ phoneNumber }, 'SMS OTP send request received');
        // Send SMS via Infobip service
        const result = await this.smsService.sendOtp(phoneNumber, message);
        if (result.success) {
            const response = createSuccessResponse('SMS sent successfully via Infobip', {
                phoneNumber,
                messageId: result.messageId,
                status: result.status,
                provider: 'infobip',
                sentAt: new Date().toISOString()
            });
            logger.info({
                phoneNumber,
                messageId: result.messageId,
                provider: 'infobip'
            }, 'SMS sent successfully via Infobip');
            return reply.code(200).send(response);
        }
        else {
            const errorResponse = createErrorResponse('Failed to send SMS via Infobip', result.errorMessage || 'Unknown error occurred', 500);
            logger.error({
                phoneNumber,
                error: result.errorMessage,
                provider: 'infobip'
            }, 'Failed to send SMS via Infobip');
            return reply.code(500).send(errorResponse);
        }
    });
    /**
     * Send OTP SMS via Twilio
     * POST /v1/sms/send-otp-twilio
     */
    sendOtpTwilio = asyncHandler(async (request, reply) => {
        // Validate request body
        const { phoneNumber, message } = sendOtpSchema.parse(request.body);
        logger.info({ phoneNumber }, 'SMS OTP send request received (Twilio)');
        // Send SMS via Twilio service
        const result = await this.twilioSmsService.sendOtp(phoneNumber, message);
        if (result.success) {
            const response = createSuccessResponse('SMS sent successfully via Twilio', {
                phoneNumber,
                messageId: result.messageId,
                status: result.status,
                provider: 'twilio',
                sentAt: new Date().toISOString()
            });
            logger.info({
                phoneNumber,
                messageId: result.messageId,
                provider: 'twilio'
            }, 'SMS sent successfully via Twilio');
            return reply.code(200).send(response);
        }
        else {
            const errorResponse = createErrorResponse('Failed to send SMS via Twilio', result.errorMessage || 'Unknown error occurred', 500);
            logger.error({
                phoneNumber,
                error: result.errorMessage,
                provider: 'twilio'
            }, 'Failed to send SMS via Twilio');
            return reply.code(500).send(errorResponse);
        }
    });
    /**
     * Send OTP SMS with fallback (try Twilio if Infobip fails)
     * POST /v1/sms/send-otp-with-fallback
     */
    sendOtpWithFallback = asyncHandler(async (request, reply) => {
        // Validate request body
        const { phoneNumber, message } = sendOtpSchema.parse(request.body);
        logger.info({ phoneNumber }, 'SMS OTP send request with fallback');
        // Try Infobip first
        let result = await this.smsService.sendOtp(phoneNumber, message);
        if (result.success) {
            const response = createSuccessResponse('SMS sent successfully via Infobip', {
                phoneNumber,
                messageId: result.messageId,
                status: result.status,
                provider: 'infobip',
                sentAt: new Date().toISOString()
            });
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
            const response = createSuccessResponse('SMS sent successfully via Twilio (fallback)', {
                phoneNumber,
                messageId: result.messageId,
                status: result.status,
                provider: 'twilio',
                fallbackUsed: true,
                sentAt: new Date().toISOString()
            });
            logger.info({
                phoneNumber,
                messageId: result.messageId,
                provider: 'twilio',
                fallbackUsed: true
            }, 'SMS sent successfully via Twilio fallback');
            return reply.code(200).send(response);
        }
        else {
            const errorResponse = createErrorResponse('Failed to send SMS via both providers', `Infobip: ${result.errorMessage || 'Unknown error'}, Twilio: ${result.errorMessage || 'Unknown error'}`, 500);
            logger.error({
                phoneNumber,
                infobipError: 'Failed',
                twilioError: result.errorMessage
            }, 'Failed to send SMS via both Infobip and Twilio');
            return reply.code(500).send(errorResponse);
        }
    });
    /**
     * Send OTP SMS with Redis storage and rate limiting
     * POST /v1/sms/send-otp-with-storage
     */
    sendOtpWithStorage = asyncHandler(async (request, reply) => {
        // Validate request body
        const { phoneNumber } = otpSendSchema.parse(request.body);
        logger.info({ phoneNumber }, 'OTP send request with storage received');
        // Generate and store OTP in Redis
        const otpResult = await otpService.generateAndStoreOtp(phoneNumber);
        if (!otpResult.success) {
            const statusCode = otpResult.retryAfter ? 429 : 400;
            const errorResponse = createErrorResponse('Failed to generate OTP', otpResult.error || 'Could not generate OTP', statusCode);
            if (otpResult.retryAfter) {
                reply.header('Retry-After', otpResult.retryAfter.toString());
            }
            logger.error({
                phoneNumber,
                error: otpResult.error
            }, 'Failed to generate OTP');
            return reply.code(statusCode).send(errorResponse);
        }
        // Send SMS via Twilio
        const otpMessage = `Your verification code is: ${otpResult.otp}. Valid for 60 seconds. Do not share this code.`;
        const smsResult = await this.twilioSmsService.sendOtp(phoneNumber, otpMessage);
        if (smsResult.success) {
            const response = createSuccessResponse('OTP sent successfully', {
                phoneNumber,
                expiresIn: 60,
                canResendAfter: 30,
                sentAt: new Date().toISOString()
            });
            logger.info({
                phoneNumber,
                messageId: smsResult.messageId
            }, 'OTP sent successfully via Twilio with Redis storage');
            return reply.code(200).send(response);
        }
        else {
            // SMS sending failed - delete OTP from Redis
            await otpService.deleteOtp(phoneNumber);
            const errorResponse = createErrorResponse('Failed to send OTP SMS', smsResult.errorMessage || 'Could not send SMS', 500);
            logger.error({
                phoneNumber,
                error: smsResult.errorMessage
            }, 'Failed to send OTP SMS via Twilio');
            return reply.code(500).send(errorResponse);
        }
    });
    /**
     * Verify OTP
     * POST /v1/sms/verify-otp
     */
    verifyOtp = asyncHandler(async (request, reply) => {
        // Validate request body
        const { phoneNumber, otp } = verifyOtpSchema.parse(request.body);
        logger.info({ phoneNumber }, 'OTP verification request received');
        // Verify OTP
        const verifyResult = await otpService.verifyOtp(phoneNumber, otp);
        if (verifyResult.success && verifyResult.verified) {
            const response = createSuccessResponse('OTP verified successfully', {
                verified: true,
                phoneNumber
            });
            logger.info({ phoneNumber }, 'OTP verified successfully');
            return reply.code(200).send(response);
        }
        else {
            const statusCode = verifyResult.canResend === false ? 429 : 400;
            const errorResponse = {
                success: false,
                message: 'OTP verification failed',
                details: verifyResult.error || 'Invalid OTP',
                ...(verifyResult.attemptsRemaining !== undefined && {
                    attemptsRemaining: verifyResult.attemptsRemaining
                }),
                ...(verifyResult.canResend !== undefined && {
                    canResend: verifyResult.canResend
                }),
                statusCode
            };
            logger.warn({
                phoneNumber,
                error: verifyResult.error,
                attemptsRemaining: verifyResult.attemptsRemaining
            }, 'OTP verification failed');
            return reply.code(statusCode).send(errorResponse);
        }
    });
    /**
     * Resend OTP
     * POST /v1/sms/resend-otp
     */
    resendOtp = asyncHandler(async (request, reply) => {
        // Validate request body
        const { phoneNumber } = otpSendSchema.parse(request.body);
        logger.info({ phoneNumber }, 'OTP resend request received');
        // Delete old OTP first
        await otpService.deleteOtp(phoneNumber);
        // Generate new OTP
        const otpResult = await otpService.generateAndStoreOtp(phoneNumber);
        if (!otpResult.success) {
            const statusCode = otpResult.retryAfter ? 429 : 400;
            const errorResponse = createErrorResponse('Failed to resend OTP', otpResult.error || 'Could not generate new OTP', statusCode);
            if (otpResult.retryAfter) {
                reply.header('Retry-After', otpResult.retryAfter.toString());
            }
            logger.error({
                phoneNumber,
                error: otpResult.error
            }, 'Failed to resend OTP');
            return reply.code(statusCode).send(errorResponse);
        }
        // Send SMS via Twilio
        const otpMessage = `Your verification code is: ${otpResult.otp}. Valid for 60 seconds. Do not share this code.`;
        const smsResult = await this.twilioSmsService.sendOtp(phoneNumber, otpMessage);
        if (smsResult.success) {
            const response = createSuccessResponse('OTP resent successfully', {
                phoneNumber,
                expiresIn: 60,
                canResendAfter: 30,
                sentAt: new Date().toISOString()
            });
            logger.info({
                phoneNumber,
                messageId: smsResult.messageId
            }, 'OTP resent successfully');
            return reply.code(200).send(response);
        }
        else {
            // SMS sending failed - delete OTP from Redis
            await otpService.deleteOtp(phoneNumber);
            const errorResponse = createErrorResponse('Failed to send OTP SMS', smsResult.errorMessage || 'Could not send SMS', 500);
            logger.error({
                phoneNumber,
                error: smsResult.errorMessage
            }, 'Failed to resend OTP SMS');
            return reply.code(500).send(errorResponse);
        }
    });
}
//# sourceMappingURL=sms.controller.js.map