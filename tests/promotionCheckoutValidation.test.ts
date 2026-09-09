import assert from 'node:assert/strict';
import test from 'node:test';
import type { PromotionQuote } from '../src/services/promotion-v2-engine.js';
import { promotionQuotesMatchForCheckout } from '../src/utils/promotionCheckoutValidation.js';

const quote = (): PromotionQuote => ({
  schema_version: 2,
  evaluation_id: 'first-evaluation',
  currency: 'INR',
  original_total: 51000,
  shipping_amount: 15000,
  discount_total: 15000,
  payable_total: 36000,
  adjustments: [{
    adjustment_id: 'first-adjustment',
    promotion_id: 10,
    rule_version: 1,
    type: 'FREE_ITEM',
    product_id: '20',
    affected_quantity: 1,
    list_amount: 15000,
    amount: 15000,
    payable_amount: 0,
    source_product_ids: ['18'],
    metadata: { fulfilment: 'AUTO_ADD' },
  }],
  applied_promotions: [{ promotion_id: 10, name: 'Buy 2 get 1', saving: 15000 }],
  eligible_alternatives: [],
  rejected_candidates: [],
  next_tier_progress: [],
  gift_choices: [],
  expires_at: '2026-09-09T11:00:00.000Z',
});

test('checkout comparison ignores regenerated evaluation and adjustment identifiers', () => {
  const refreshed = quote();
  refreshed.evaluation_id = 'refreshed-evaluation';
  refreshed.adjustments[0]!.adjustment_id = 'refreshed-adjustment';
  refreshed.expires_at = '2026-09-09T11:05:00.000Z';

  assert.equal(promotionQuotesMatchForCheckout(quote(), refreshed), true);
});

test('checkout comparison detects a changed payable benefit', () => {
  const refreshed = quote();
  refreshed.discount_total = 10000;
  refreshed.payable_total = 41000;
  refreshed.adjustments[0]!.amount = 10000;

  assert.equal(promotionQuotesMatchForCheckout(quote(), refreshed), false);
});

test('checkout comparison detects a changed gift product', () => {
  const refreshed = quote();
  refreshed.adjustments[0]!.product_id = '21';

  assert.equal(promotionQuotesMatchForCheckout(quote(), refreshed), false);
});
