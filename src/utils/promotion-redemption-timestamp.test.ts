import assert from 'node:assert/strict';
import test from 'node:test';

import { promotionRedemptionTimestamp } from './promotion-redemption-timestamp.js';

test('stores promotion redemption history timestamps in epoch milliseconds', () => {
  const now = Date.parse('2026-10-02T10:30:45.123Z');

  assert.equal(promotionRedemptionTimestamp(now), BigInt(now));
  assert.equal(String(promotionRedemptionTimestamp(now)).length, 13);
});

test('preserves chronological ordering for new redemption timestamps', () => {
  const earlier = promotionRedemptionTimestamp(Date.parse('2026-10-02T10:30:45.123Z'));
  const later = promotionRedemptionTimestamp(Date.parse('2026-10-02T10:30:46.123Z'));

  assert.ok(later > earlier);
});

test('rejects invalid promotion redemption timestamps', () => {
  assert.throws(() => promotionRedemptionTimestamp(Number.NaN));
  assert.throws(() => promotionRedemptionTimestamp(-1));
});
