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
   */
  private generateSecureOtp(): string {
    // Use crypto.randomInt for cryptographically secure random numbers
    const otp = crypto.randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
    
    return otp;
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
   * Set resend cooldown (30 seconds between resend requests)
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
   */
  async generateAndStoreOtp(phoneNumber: string): Promise<OtpGenerateResult> {
    try {
      // 1. Check if phone is blocked
      const blockStatus = await this.isBlocked(phoneNumber);
      console.log(blockStatus,"blockStatus")
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

      // 4. Generate OTP
      const otp = this.generateSecureOtp();
      const now = Date.now();
      const expiresAt = now + (OTP_EXPIRY_SECONDS * 1000);

      // 5. Store OTP in Redis
      const otpKey = this.getOtpKey(phoneNumber);
      const otpData: OtpData = {
        otp,
        attempts: 0,
        createdAt: now,
        expiresAt,
        phoneNumber
      };

      await this.redis.setEx(otpKey, OTP_EXPIRY_SECONDS, JSON.stringify(otpData));

      // 6. Increment send rate limit
      await this.incrementSendRateLimit(phoneNumber);

      // 7. Set resend cooldown
      await this.setResendCooldown(phoneNumber);

      logger.info({ 
        phoneNumber: phoneNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3'), // Mask phone number in logs
        expiresIn: OTP_EXPIRY_SECONDS 
      }, 'OTP generated and stored');

      return {
        success: true,
        otp, // Will be sent via SMS, not returned to client
        expiresAt
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
}

export const otpService = new OtpService();

