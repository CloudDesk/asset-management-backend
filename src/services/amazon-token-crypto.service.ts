import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const TOKEN_PREFIX = 'v1';

export class AmazonTokenEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmazonTokenEncryptionError';
  }
}

const decodeKey = (configuredKey?: string): Buffer => {
  const value = configuredKey?.trim();
  if (!value) {
    throw new AmazonTokenEncryptionError('Amazon token encryption key is not configured');
  }

  const key = /^[a-f\d]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new AmazonTokenEncryptionError('Amazon token encryption key must decode to exactly 32 bytes');
  }
  return key;
};

export class AmazonTokenCryptoService {
  constructor(private readonly configuredKey?: string) {}

  encrypt(plainText: string): string {
    const normalized = plainText.trim();
    if (!normalized) throw new AmazonTokenEncryptionError('Amazon refresh token is empty');

    const key = decodeKey(this.configuredKey ?? env.AMAZON_TOKEN_ENCRYPTION_KEY);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [TOKEN_PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':');
  }

  decrypt(payload: string): string {
    const [version, ivValue, tagValue, encryptedValue] = payload.split(':');
    if (version !== TOKEN_PREFIX || !ivValue || !tagValue || !encryptedValue) {
      throw new AmazonTokenEncryptionError('Stored Amazon refresh token is not encrypted; reconnect Amazon');
    }

    try {
      const key = decodeKey(this.configuredKey ?? env.AMAZON_TOKEN_ENCRYPTION_KEY);
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch (error) {
      if (error instanceof AmazonTokenEncryptionError) throw error;
      throw new AmazonTokenEncryptionError('Stored Amazon refresh token could not be decrypted');
    }
  }
}

export const amazonTokenCryptoService = new AmazonTokenCryptoService();
