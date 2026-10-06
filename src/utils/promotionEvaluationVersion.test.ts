import assert from 'node:assert/strict';
import test from 'node:test';
import { isV2PromotionEvaluationContext, legacyPromotionEvaluationIds } from './promotionEvaluationVersion.js';

test('recognizes V2 promotion evaluation contexts without misclassifying legacy rows', () => {
  assert.equal(isV2PromotionEvaluationContext({ schema_version: 2, channel: 'web' }), true);
  assert.equal(isV2PromotionEvaluationContext({ schema_version: '2' }), true);
  assert.equal(isV2PromotionEvaluationContext({ channel: 'web' }), false);
  assert.equal(isV2PromotionEvaluationContext(null), false);
  assert.equal(isV2PromotionEvaluationContext([]), false);
});

test('legacy cleanup preserves V2 evaluations for the same customer', () => {
  assert.deepEqual(legacyPromotionEvaluationIds([
    { evaluation_id: 'legacy-null', context: null },
    { evaluation_id: 'legacy-object', context: { channel: 'web' } },
    { evaluation_id: 'v2-number', context: { schema_version: 2 } },
    { evaluation_id: 'v2-string', context: { schema_version: '2' } },
  ]), ['legacy-null', 'legacy-object']);
});
