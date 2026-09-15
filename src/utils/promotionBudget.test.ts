import assert from 'node:assert/strict';
import test from 'node:test';

import { getRemainingPromotionBudget } from './promotionBudget.js';

test('treats missing and zero promotion budgets as unlimited', () => {
  assert.equal(getRemainingPromotionBudget(null, 100), null);
  assert.equal(getRemainingPromotionBudget(undefined, 100), null);
  assert.equal(getRemainingPromotionBudget(0, 100), null);
  assert.equal(getRemainingPromotionBudget('0.00', 100), null);
});

test('calculates the remaining amount for a positive promotion budget', () => {
  assert.equal(getRemainingPromotionBudget('500.00', 125.5), 374.5);
  assert.equal(getRemainingPromotionBudget(100, 100), 0);
});
