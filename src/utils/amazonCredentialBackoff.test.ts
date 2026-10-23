import test from 'node:test';
import assert from 'node:assert/strict';

import { credentialBackoff, isCredentialFailure } from './amazonCredentialBackoff.ts';

const NEW_MESSAGE = 'Amazon rejected the configured credentials. Check the selected credential source and reconnect if needed. (invalid_client: Client authentication failed)';
const OLD_MESSAGE = 'Amazon authorization is invalid or has expired';
const at = (iso: string) => new Date(iso);
const failed = (iso: string, errorMessage = NEW_MESSAGE) => ({ status: 'FAILED', errorMessage, createdAt: at(iso) });

test('recognises old and new credential failure messages only', () => {
  assert.ok(isCredentialFailure(NEW_MESSAGE));
  assert.ok(isCredentialFailure(OLD_MESSAGE));
  assert.ok(isCredentialFailure('… (invalid_grant: The request has an invalid grant parameter)'));
  assert.ok(!isCredentialFailure('QuotaExceeded: You exceeded your quota'));
  assert.ok(!isCredentialFailure(null));
});

test('no backoff after a success or a non-credential failure', () => {
  assert.equal(credentialBackoff([{ status: 'COMPLETED', errorMessage: null, createdAt: at('2026-10-22T06:45:50Z') }], at('2026-10-22T07:00:00Z')).skip, false);
  assert.equal(credentialBackoff([failed('2026-10-22T06:45:00Z', 'QuotaExceeded')], at('2026-10-22T06:46:00Z')).skip, false);
  assert.equal(credentialBackoff([], at('2026-10-22T06:46:00Z')).skip, false);
});

test('waits 15, 30, 60 … minutes after 1, 2, 3 credential failures in a row', () => {
  const one = credentialBackoff([failed('2026-10-22T06:00:00Z')], at('2026-10-22T06:10:00Z'));
  assert.deepEqual([one.skip, one.waitMinutes], [true, 15]);
  assert.equal(credentialBackoff([failed('2026-10-22T06:00:00Z')], at('2026-10-22T06:15:00Z')).skip, false);

  const three = [failed('2026-10-22T06:00:00Z'), failed('2026-10-22T05:30:00Z'), failed('2026-10-22T05:15:00Z')];
  const result = credentialBackoff(three, at('2026-10-22T06:45:00Z'));
  assert.deepEqual([result.skip, result.streak, result.waitMinutes], [true, 3, 60]);
  assert.equal(credentialBackoff(three, at('2026-10-22T07:00:00Z')).skip, false);
});

test('the wait is capped at 6 hours and a success in between resets the streak', () => {
  const many = Array.from({ length: 10 }, (_, index) => failed(new Date(Date.UTC(2026, 9, 21, 20 - index)).toISOString()));
  assert.equal(credentialBackoff(many, at('2026-10-21T21:00:00Z')).waitMinutes, 360);

  const reset = [failed('2026-10-22T06:00:00Z'), { status: 'COMPLETED', errorMessage: null, createdAt: at('2026-10-22T05:45:00Z') }, failed('2026-10-22T05:30:00Z')];
  assert.equal(credentialBackoff(reset, at('2026-10-22T06:05:00Z')).streak, 1);
});
