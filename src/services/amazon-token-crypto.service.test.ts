import assert from 'node:assert/strict';
import test from 'node:test';
import { AmazonTokenCryptoService, AmazonTokenEncryptionError } from './amazon-token-crypto.service.js';

const key = Buffer.alloc(32, 7).toString('base64');

test('rejects malformed configured keys without changing the encrypted token format', () => {
  const malformed = key.slice(0, 8) + ' ' + key.slice(8);
  assert.throws(() => new AmazonTokenCryptoService(malformed).encrypt('refresh-token'), AmazonTokenEncryptionError);
});

test('encrypts and decrypts Amazon refresh tokens with authenticated encryption', () => {
  const service = new AmazonTokenCryptoService(key);
  const encrypted = service.encrypt('Atzr|secret-refresh-token');

  assert.notEqual(encrypted, 'Atzr|secret-refresh-token');
  assert.match(encrypted, /^v1:/);
  assert.equal(service.decrypt(encrypted), 'Atzr|secret-refresh-token');
});

test('rejects plaintext and tampered Amazon refresh tokens', () => {
  const service = new AmazonTokenCryptoService(key);
  assert.throws(() => service.decrypt('plaintext-token'), AmazonTokenEncryptionError);

  const encrypted = service.encrypt('Atzr|secret-refresh-token');
  assert.throws(() => service.decrypt(`${encrypted}x`), AmazonTokenEncryptionError);
});
