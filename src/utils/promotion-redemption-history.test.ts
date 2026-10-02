import test from 'node:test';
import assert from 'node:assert/strict';
import {
  promotionRedemptionTimestampMilliseconds,
  promotionRedemptionTimestampSeconds,
  sortPromotionRedemptionsNewestFirst,
} from './promotion-redemption-history.js';

test('normalizes legacy second timestamps without changing millisecond timestamps', () => {
  assert.equal(promotionRedemptionTimestampMilliseconds(1_790_793_000n), 1_790_793_000_000);
  assert.equal(promotionRedemptionTimestampMilliseconds(1_790_793_000_000n), 1_790_793_000_000);
});

test('converts millisecond date boundaries for legacy second records', () => {
  assert.equal(promotionRedemptionTimestampSeconds(1_790_793_999_999), 1_790_793_999n);
});

test('sorts mixed legacy and current timestamps chronologically', () => {
  const sorted = sortPromotionRedemptionsNewestFirst([
    { id: 'older-ms', redeemed_at: 1_790_700_000_000n },
    { id: 'newer-seconds', redeemed_at: 1_790_793_000n },
    { id: 'newest-ms', redeemed_at: 1_790_800_000_000n },
  ]);

  assert.deepEqual(sorted.map((item) => item.id), [
    'newest-ms',
    'newer-seconds',
    'older-ms',
  ]);
});
