import { z } from 'zod';

/**
 * Phone number validation
 * Accepts: 10-15 digits, with or without country code
 */
const phoneNumberSchema = z
  .string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number must be at most 15 digits')
  .regex(/^\+?[0-9]+$/, 'Phone number must contain only digits (with optional + prefix)')
  .transform((val) => {
    // Remove any non-digit characters except leading +
    let cleaned = val.replace(/[^\d+]/g, '');
    
    // If no +, remove leading + if exists
    if (!cleaned.startsWith('+')) {
      cleaned = cleaned.replace(/\+/g, '');
    }
    
    // If exactly 10 digits and no country code, assume India (+91)
    if (cleaned.length === 10 && !cleaned.startsWith('+')) {
      cleaned = '+91' + cleaned;
    } else if (cleaned.length > 10 && !cleaned.startsWith('+')) {
      // If more than 10 digits without +, add it
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      // Default: add + if not present
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  });

/**
 * OTP validation
 * 6-digit numeric code
 */
const otpSchema = z
  .string()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only digits');

/**
 * Schema for sending OTP request
 */
export const sendOtpSchema = z.object({
  phoneNumber: phoneNumberSchema
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;

/**
 * Schema for verifying OTP request
 */
export const verifyOtpSchema = z.object({
  phoneNumber: phoneNumberSchema,
  otp: otpSchema
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/**
 * Schema for resending OTP request
 */
export const resendOtpSchema = z.object({
  phoneNumber: phoneNumberSchema
});

export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

