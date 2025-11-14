import crypto from 'crypto';
import { redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

// Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = parseInt(process.env.OTP_EXPIRY_SECONDS || '60'); // 60 seconds
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '3'); // 3 attempts per OTP
const RATE_LIMIT_SEND_MAX = parseInt(process.env.RATE_LIMIT_SEND_MAX || '3'); // 3 OTP requests
const RATE_LIMIT_SEND_WINDOW = parseInt(process.env.RATE_LIMIT_SEND_WINDOW || '900'); // 15 minutes
const RATE_LIMIT_VERIFY_MAX = parseInt(process.env.RATE_LIMIT_VERIFY_MAX || '5'); // 5 failed verifications
const RATE_LIMIT_VERIFY_WINDOW = parseInt(process.env.RATE_LIMIT_VERIFY_WINDOW || '3600'); // 1 hour
const BLOCK_DURATION = parseInt(process.env.BLOCK_DURATION || '3600'); // 1 hour

// Provider-specific configurations
export type OtpProvider = 'twilio' | 'exotel';

export interface ProviderConfig {
  otpLength: number;
  expirySeconds: number;
  resendCooldownSeconds: number;
  noLeadingZero: boolean; // For Exotel: OTP should not start with 0
  messageTemplate: string; // OTP message template with {otp} placeholder
}

const PROVIDER_CONFIGS: Record<OtpProvider, ProviderConfig> = {
  twilio: {
    otpLength: 6,
    expirySeconds: 60, // 60 seconds
    resendCooldownSeconds: 30, // 30 seconds
    noLeadingZero: false,
    messageTemplate: 'Your verification code is: {otp}. Valid for 60 seconds. Do not share this code.'
  },
  exotel: {
    otpLength: 4,
    expirySeconds: 300, // 5 minutes (300 seconds)
    resendCooldownSeconds: 60, // 1 minute (60 seconds)
    noLeadingZero: true, // Exotel OTP should not start with 0
    messageTemplate: 'Dear Customer, your one-time password (OTP) for logging in to your NIVAANA account is {otp}. This code is valid for 5 minutes. Please do not share it with anyone. Visit https://nivaana.in/ for further details.'
  }
};

interface OtpData {
  otp: string;
  attempts: number;
  createdAt: number;
  expiresAt: number;
  phoneNumber: string;
}

interface OtpGenerateResult {
  success: boolean;
  otp?: string;
  expiresAt?: number;
  error?: string;
  retryAfter?: number;
  expiresIn?: number; // Expiry in seconds for response
}

interface OtpVerifyResult {
  success: boolean;
  verified?: boolean;
  error?: string;
  attemptsRemaining?: number;
  canResend?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
  reason?: string;
}

export class OtpService {
  // Lazy getter for Redis client (gets client when needed, not at instantiation)
  private get redis() {
    return redisClient.getClient();
  }

  // Redis key patterns
  private getOtpKey(phoneNumber: string): string {
    return `otp:${phoneNumber}`;
  }

  private getRateLimitSendKey(phoneNumber: string): string {
    return `rate:send:${phoneNumber}`;
  }

  private getRateLimitVerifyKey(phoneNumber: string): string {
    return `rate:verify:${phoneNumber}`;
  }

  private getBlockKey(phoneNumber: string): string {
    return `blocked:${phoneNumber}`;
  }

  private getResendCooldownKey(phoneNumber: string): string {
    return `resend:cooldown:${phoneNumber}`;
  }

  /**
   * Generate a cryptographically secure random OTP
   * @param provider - Provider type ('twilio' or 'exotel')
   * @returns Generated OTP string
   */
  private generateSecureOtp(provider: OtpProvider = 'twilio'): string {
    const config = PROVIDER_CONFIGS[provider];
    
    if (config.noLeadingZero) {
      // For Exotel: Generate OTP that doesn't start with 0
      // Generate first digit (1-9), then remaining digits (0-9)
      const firstDigit = crypto.randomInt(1, 10); // 1 to 9
      const remainingDigits = crypto.randomInt(0, 10 ** (config.otpLength - 1))
        .toString()
        .padStart(config.otpLength - 1, '0');
      
      return `${firstDigit}${remainingDigits}`;
    } else {
      // For Twilio: Standard OTP generation (can start with 0)
      const otp = crypto.randomInt(0, 10 ** config.otpLength)
      .toString()
        .padStart(config.otpLength, '0');
    
    return otp;
    }
  }

  /**
   * Check if phone number is blocked
   */
  async isBlocked(phoneNumber: string): Promise<{ blocked: boolean; reason?: string; expiresIn?: number }> {
    try {
      const blockKey = this.getBlockKey(phoneNumber);
      const blockData = await this.redis.get(blockKey);
      
      if (blockData) {
        const ttl = await this.redis.ttl(blockKey);
        return {
          blocked: true,
          reason: blockData,
          expiresIn: ttl > 0 ? ttl : 0
        };
      }
      
      return { blocked: false };
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error checking if phone is blocked');
      return { blocked: false };
    }
  }

  /**
   * Block a phone number temporarily
   */
  async blockPhoneNumber(phoneNumber: string, reason: string, duration: number = BLOCK_DURATION): Promise<void> {
    try {
      const blockKey = this.getBlockKey(phoneNumber);
      await this.redis.setEx(blockKey, duration, reason);
      logger.warn({ phoneNumber, reason, duration }, 'Phone number blocked');
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error blocking phone number');
    }
  }

  /**
   * Check rate limit for sending OTP
   */
  async checkSendRateLimit(phoneNumber: string): Promise<RateLimitResult> {
    try {
      const rateLimitKey = this.getRateLimitSendKey(phoneNumber);
      const count = await this.redis.get(rateLimitKey);
      const currentCount = count ? parseInt(count) : 0;

      if (currentCount >= RATE_LIMIT_SEND_MAX) {
        const ttl = await this.redis.ttl(rateLimitKey);
        return {
          allowed: false,
          remaining: 0,
          retryAfter: ttl > 0 ? ttl : RATE_LIMIT_SEND_WINDOW,
          reason: 'Too many OTP requests. Please try again later.'
        };
      }

      return {
        allowed: true,
        remaining: RATE_LIMIT_SEND_MAX - currentCount - 1
      };
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error checking send rate limit');
      // Allow on error to prevent blocking legitimate users
      return { allowed: true };
    }
  }

  /**
   * Increment send rate limit counter
   */
  async incrementSendRateLimit(phoneNumber: string): Promise<void> {
    try {
      const rateLimitKey = this.getRateLimitSendKey(phoneNumber);
      const count = await this.redis.incr(rateLimitKey);
      
      // Set expiry only on first increment
      if (count === 1) {
        await this.redis.expire(rateLimitKey, RATE_LIMIT_SEND_WINDOW);
      }
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error incrementing send rate limit');
    }
  }

  /**
   * Check rate limit for verifying OTP (failed attempts)
   */
  async checkVerifyRateLimit(phoneNumber: string): Promise<RateLimitResult> {
    try {
      const rateLimitKey = this.getRateLimitVerifyKey(phoneNumber);
      const count = await this.redis.get(rateLimitKey);
      const currentCount = count ? parseInt(count) : 0;

      if (currentCount >= RATE_LIMIT_VERIFY_MAX) {
        const ttl = await this.redis.ttl(rateLimitKey);
        
        // Block the phone number
        await this.blockPhoneNumber(
          phoneNumber,
          'Too many failed OTP verification attempts',
          ttl > 0 ? ttl : RATE_LIMIT_VERIFY_WINDOW
        );

        return {
          allowed: false,
          remaining: 0,
          retryAfter: ttl > 0 ? ttl : RATE_LIMIT_VERIFY_WINDOW,
          reason: 'Too many failed verification attempts. Account temporarily blocked.'
        };
      }

      return {
        allowed: true,
        remaining: RATE_LIMIT_VERIFY_MAX - currentCount - 1
      };
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error checking verify rate limit');
      return { allowed: true };
    }
  }

  /**
   * Increment verify rate limit counter (for failed attempts)
   */
  async incrementVerifyRateLimit(phoneNumber: string): Promise<void> {
    try {
      const rateLimitKey = this.getRateLimitVerifyKey(phoneNumber);
      const count = await this.redis.incr(rateLimitKey);
      
      // Set expiry only on first increment
      if (count === 1) {
        await this.redis.expire(rateLimitKey, RATE_LIMIT_VERIFY_WINDOW);
      }
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error incrementing verify rate limit');
    }
  }

  /**
   * Check resend cooldown (prevent immediate resend)
   */
  async checkResendCooldown(phoneNumber: string): Promise<{ canResend: boolean; waitTime?: number }> {
    try {
      const cooldownKey = this.getResendCooldownKey(phoneNumber);
      const ttl = await this.redis.ttl(cooldownKey);
      
      if (ttl > 0) {
        return { canResend: false, waitTime: ttl };
      }
      
      return { canResend: true };
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error checking resend cooldown');
      return { canResend: true };
    }
  }

  /**
   * Set resend cooldown (provider-specific duration)
   */
  async setResendCooldown(phoneNumber: string, duration: number = 30): Promise<void> {
    try {
      const cooldownKey = this.getResendCooldownKey(phoneNumber);
      await this.redis.setEx(cooldownKey, duration, '1');
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error setting resend cooldown');
    }
  }

  /**
   * Generate and store OTP
   * @param phoneNumber - Phone number in E.164 format
   * @param provider - Provider type ('twilio' or 'exotel'), defaults to 'twilio'
   */
  async generateAndStoreOtp(phoneNumber: string, provider: OtpProvider = 'twilio'): Promise<OtpGenerateResult> {
    try {
      // 1. Check if phone is blocked
      const blockStatus = await this.isBlocked(phoneNumber);
      if (blockStatus.blocked) {
        logger.warn({ phoneNumber, reason: blockStatus.reason }, 'Blocked phone tried to request OTP');
        const result: OtpGenerateResult = {
          success: false,
          error: blockStatus.reason || 'Phone number is temporarily blocked'
        };
        if (blockStatus.expiresIn !== undefined) {
          result.retryAfter = blockStatus.expiresIn;
        }
        return result;
      }

      // 2. Check send rate limit
      const rateLimitResult = await this.checkSendRateLimit(phoneNumber);
      if (!rateLimitResult.allowed) {
        logger.warn({ phoneNumber }, 'Rate limit exceeded for OTP send');
        const result: OtpGenerateResult = {
          success: false,
          error: rateLimitResult.reason || 'Too many requests'
        };
        if (rateLimitResult.retryAfter !== undefined) {
          result.retryAfter = rateLimitResult.retryAfter;
        }
        return result;
      }

      // 3. Check resend cooldown
      const cooldownCheck = await this.checkResendCooldown(phoneNumber);
      if (!cooldownCheck.canResend) {
        logger.warn({ phoneNumber, waitTime: cooldownCheck.waitTime }, 'Resend cooldown active');
        const result: OtpGenerateResult = {
          success: false,
          error: `Please wait ${cooldownCheck.waitTime} seconds before requesting a new OTP`
        };
        if (cooldownCheck.waitTime !== undefined) {
          result.retryAfter = cooldownCheck.waitTime;
        }
        return result;
      }

      // 4. Get provider-specific configuration
      const config = PROVIDER_CONFIGS[provider];

      // 5. Generate OTP with provider-specific settings
      const otp = this.generateSecureOtp(provider);
      const now = Date.now();
      const expiresAt = now + (config.expirySeconds * 1000);

      // 6. Store OTP in Redis with provider-specific TTL
      const otpKey = this.getOtpKey(phoneNumber);
      const otpData: OtpData = {
        otp,
        attempts: 0,
        createdAt: now,
        expiresAt,
        phoneNumber
      };

      await this.redis.setEx(otpKey, config.expirySeconds, JSON.stringify(otpData));

      // 7. Increment send rate limit
      await this.incrementSendRateLimit(phoneNumber);

      // 8. Set resend cooldown with provider-specific duration
      await this.setResendCooldown(phoneNumber, config.resendCooldownSeconds);

      logger.info({ 
        phoneNumber: phoneNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3'), // Mask phone number in logs
        provider,
        otpLength: config.otpLength,
        expiresIn: config.expirySeconds 
      }, 'OTP generated and stored');

      return {
        success: true,
        otp, // Will be sent via SMS, not returned to client
        expiresAt,
        expiresIn: config.expirySeconds
      };

    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error generating and storing OTP');
      return {
        success: false,
        error: 'Failed to generate OTP. Please try again.'
      };
    }
  }

  /**
   * Verify OTP
   * Uses constant-time comparison to prevent timing attacks
   */
  async verifyOtp(phoneNumber: string, inputOtp: string): Promise<OtpVerifyResult> {
    try {
      // 1. Check if phone is blocked
      const blockStatus = await this.isBlocked(phoneNumber);
      if (blockStatus.blocked) {
        logger.warn({ phoneNumber, reason: blockStatus.reason }, 'Blocked phone tried to verify OTP');
        return {
          success: false,
          verified: false,
          error: blockStatus.reason || 'Phone number is temporarily blocked',
          canResend: false
        };
      }

      // 2. Check verify rate limit
      const rateLimitResult = await this.checkVerifyRateLimit(phoneNumber);
      if (!rateLimitResult.allowed) {
        logger.warn({ phoneNumber }, 'Verify rate limit exceeded');
        return {
          success: false,
          verified: false,
          error: rateLimitResult.reason || 'Too many failed attempts',
          canResend: false
        };
      }

      // 3. Get OTP from Redis
      const otpKey = this.getOtpKey(phoneNumber);
      const otpDataStr = await this.redis.get(otpKey);

      if (!otpDataStr) {
        logger.warn({ phoneNumber }, 'OTP not found or expired');
        return {
          success: false,
          verified: false,
          error: 'OTP not found or has expired. Please request a new OTP.',
          canResend: true
        };
      }

      const otpData: OtpData = JSON.parse(otpDataStr);

      // 4. Check if OTP has expired (double-check)
      if (Date.now() > otpData.expiresAt) {
        await this.redis.del(otpKey);
        logger.warn({ phoneNumber }, 'OTP expired during verification');
        return {
          success: false,
          verified: false,
          error: 'OTP has expired. Please request a new OTP.',
          canResend: true
        };
      }

      // 5. Check attempts
      if (otpData.attempts >= OTP_MAX_ATTEMPTS) {
        await this.redis.del(otpKey);
        logger.warn({ phoneNumber }, 'Max OTP attempts exceeded');
        return {
          success: false,
          verified: false,
          error: 'Maximum verification attempts exceeded. Please request a new OTP.',
          attemptsRemaining: 0,
          canResend: true
        };
      }

      // 6. Compare OTP using constant-time comparison (prevent timing attacks)
      const isValid = crypto.timingSafeEqual(
        Buffer.from(otpData.otp),
        Buffer.from(inputOtp)
      );

      if (isValid) {
        // SUCCESS: Delete OTP and clear rate limits
        await this.redis.del(otpKey);
        
        // Clear rate limits on successful verification
        await this.redis.del(this.getRateLimitVerifyKey(phoneNumber));
        
        logger.info({ 
          phoneNumber: phoneNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3') 
        }, 'OTP verified successfully');

        return {
          success: true,
          verified: true
        };
      } else {
        // FAILURE: Increment attempts and verify rate limit
        otpData.attempts += 1;
        const attemptsRemaining = OTP_MAX_ATTEMPTS - otpData.attempts;

        // Update attempts in Redis
        const ttl = await this.redis.ttl(otpKey);
        if (ttl > 0) {
          await this.redis.setEx(otpKey, ttl, JSON.stringify(otpData));
        }

        // Increment failed verification rate limit
        await this.incrementVerifyRateLimit(phoneNumber);

        logger.warn({ 
          phoneNumber: phoneNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3'),
          attemptsRemaining 
        }, 'Invalid OTP provided');

        return {
          success: false,
          verified: false,
          error: 'Invalid OTP. Please try again.',
          attemptsRemaining,
          canResend: attemptsRemaining === 0
        };
      }

    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error verifying OTP');
      return {
        success: false,
        verified: false,
        error: 'Failed to verify OTP. Please try again.'
      };
    }
  }

  /**
   * Delete OTP (cleanup)
   */
  async deleteOtp(phoneNumber: string): Promise<void> {
    try {
      const otpKey = this.getOtpKey(phoneNumber);
      await this.redis.del(otpKey);
      logger.info({ phoneNumber }, 'OTP deleted');
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error deleting OTP');
    }
  }

  /**
   * Get OTP data (for debugging/testing - DO NOT expose in production)
   */
  async getOtpData(phoneNumber: string): Promise<OtpData | null> {
    try {
      const otpKey = this.getOtpKey(phoneNumber);
      const otpDataStr = await this.redis.get(otpKey);
      
      if (!otpDataStr) {
        return null;
      }

      return JSON.parse(otpDataStr);
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error getting OTP data');
      return null;
    }
  }

  /**
   * Clear all rate limits and blocks for a phone number (admin function)
   */
  async clearAllLimits(phoneNumber: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.del(this.getOtpKey(phoneNumber)),
        this.redis.del(this.getRateLimitSendKey(phoneNumber)),
        this.redis.del(this.getRateLimitVerifyKey(phoneNumber)),
        this.redis.del(this.getBlockKey(phoneNumber)),
        this.redis.del(this.getResendCooldownKey(phoneNumber))
      ]);
      
      logger.info({ phoneNumber }, 'All limits cleared for phone number');
    } catch (error: any) {
      logger.error({ error: error.message, phoneNumber }, 'Error clearing limits');
    }
  }

  /**
   * Get OTP message template with OTP bound in
   * @param provider - Provider type ('twilio' or 'exotel')
   * @param otp - OTP code to bind into the message
   * @returns Message with OTP bound in
   */
  getOtpMessage(provider: OtpProvider, otp: string): string {
    const config = PROVIDER_CONFIGS[provider];
    // Replace {otp} placeholder with actual OTP
    return config.messageTemplate.replace(/\{otp\}/gi, otp);
  }

  /**
   * Get provider configuration
   * @param provider - Provider type ('twilio' or 'exotel')
   * @returns Provider configuration
   */
  getProviderConfig(provider: OtpProvider): ProviderConfig {
    return PROVIDER_CONFIGS[provider];
  }
}

export const otpService = new OtpService();

